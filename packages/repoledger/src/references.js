import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";

import { runGit } from "./git.js";

function error(code, path, message, remediation) {
  return { code, level: "error", path, message, remediation };
}

function warning(code, path, message, remediation) {
  return { code, level: "warning", path, message, remediation };
}

function displayPath(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

function escapesRoot(root, path) {
  const fromRoot = relative(root, path);
  return fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot);
}

function inside(parent, child) {
  const fromParent = relative(parent, child);
  return fromParent === "" || (!fromParent.startsWith(`..${sep}`) && fromParent !== ".." && !isAbsolute(fromParent));
}

function splitTarget(value) {
  const suffixIndex = value.search(/[?#]/);
  return suffixIndex === -1
    ? { path: value, suffix: "" }
    : { path: value.slice(0, suffixIndex), suffix: value.slice(suffixIndex) };
}

function localTarget(value) {
  return Boolean(value) &&
    !value.startsWith("#") &&
    !value.startsWith("//") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(value) &&
    !/^[a-z]:[/\\]/i.test(value);
}

function movedPath(path, source, destination) {
  return inside(source, path) ? resolve(destination, relative(source, path)) : path;
}

function encodePath(path) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function rewrittenTarget({
  fileAfter,
  root,
  rootRelative,
  suffix,
  targetAfter,
  trailingSlash,
}) {
  let path;
  if (rootRelative) {
    path = `/${displayPath(root, targetAfter)}`;
  } else {
    path = relative(dirname(fileAfter), targetAfter).replaceAll("\\", "/");
    if (!path.startsWith(".")) path = `./${path}`;
  }
  if (trailingSlash && !path.endsWith("/")) path += "/";
  return `${encodePath(path)}${suffix}`;
}

function visit(node, callback) {
  callback(node);
  if (!Array.isArray(node.children)) return;
  for (const child of node.children) visit(child, callback);
}

async function replacementsForTree(tree, text, rewrite) {
  const changed = [];
  const candidates = [];
  visit(tree, (node) => {
    if (["link", "image", "definition"].includes(node.type) && node.url) {
      candidates.push(node);
    }
  });
  for (const node of candidates) {
    const nextUrl = await rewrite(node.url);
    if (!nextUrl || nextUrl === node.url) continue;
    const previousUrl = node.url;
    node.url = nextUrl;
    changed.push({ node, previousUrl, nextUrl });
  }

  const outermost = changed
    .filter(({ node }) => node.position?.start.offset !== undefined && node.position?.end.offset !== undefined)
    .sort((left, right) => {
      const start = left.node.position.start.offset - right.node.position.start.offset;
      return start || right.node.position.end.offset - left.node.position.end.offset;
    })
    .filter(({ node }, index, entries) =>
      !entries.slice(0, index).some(({ node: parent }) =>
        parent.position.start.offset <= node.position.start.offset &&
        parent.position.end.offset >= node.position.end.offset,
      ),
    )
    .sort((left, right) => right.node.position.start.offset - left.node.position.start.offset);

  let content = text;
  for (const { node } of outermost) {
    const serialized = toMarkdown(node).replace(/\n$/, "");
    content = `${content.slice(0, node.position.start.offset)}${serialized}${content.slice(node.position.end.offset)}`;
  }
  return { changed, content };
}

export async function planReferenceUpdates({
  destinationPath,
  git = runGit,
  root,
  sourcePath,
  updateAllReferences = false,
}) {
  const diagnostics = [];
  const edits = [];
  const references = [];
  const repositoryRoot = resolve(root);
  const source = resolve(sourcePath);
  const destination = resolve(destinationPath);
  const listed = git(repositoryRoot, ["ls-files", "--cached", "--others", "--exclude-standard"]);
  if (!listed.ok) {
    return {
      diagnostics: [
        error(
          "reference.inventory.unavailable",
          ".git",
          "Git could not enumerate repository Markdown files.",
          "Restore Git worktree access before planning a task move.",
        ),
      ],
      edits,
      references,
    };
  }

  const realRoot = await realpath(repositoryRoot);
  const files = [...new Set(listed.stdout.split(/\r?\n/).filter((path) => path.toLowerCase().endsWith(".md")))]
    .sort();
  for (const relativeFile of files) {
    const filePath = resolve(repositoryRoot, relativeFile);
    if (escapesRoot(repositoryRoot, filePath)) {
      diagnostics.push(
        error(
          "reference.file.escape",
          relativeFile,
          `Markdown candidate escapes the repository: ${relativeFile}`,
          "Remove the escaping path from the repository index.",
        ),
      );
      continue;
    }
    let realFile;
    try {
      realFile = await realpath(filePath);
    } catch {
      continue;
    }
    if (escapesRoot(realRoot, realFile)) {
      diagnostics.push(
        error(
          "reference.file.symlink-escape",
          relativeFile,
          `Markdown candidate resolves outside the repository: ${relativeFile}`,
          "Replace the escaping symlink with a repository-local file.",
        ),
      );
      continue;
    }

    const text = await readFile(filePath, "utf8");
    const fileAfter = movedPath(filePath, source, destination);
    const tree = fromMarkdown(text);
    const rewritten = await replacementsForTree(tree, text, async (rawTarget) => {
      if (!localTarget(rawTarget)) return null;
      const { path: pathTarget, suffix } = splitTarget(rawTarget);
      let decoded;
      try {
        decoded = decodeURIComponent(pathTarget.replace(/^<|>$/g, ""));
      } catch {
        diagnostics.push(
          error(
            "reference.encoding.invalid",
            displayPath(repositoryRoot, filePath),
            `Reference has invalid percent encoding: ${rawTarget}`,
            "Correct the encoded Markdown target before moving the task.",
          ),
        );
        return null;
      }
      const rootRelative = decoded.startsWith("/");
      const targetBefore = rootRelative
        ? resolve(repositoryRoot, decoded.replace(/^[/\\]+/, ""))
        : resolve(dirname(filePath), decoded);
      if (escapesRoot(repositoryRoot, targetBefore)) {
        diagnostics.push(
          error(
            "reference.target.escape",
            displayPath(repositoryRoot, filePath),
            `Reference escapes the repository: ${rawTarget}`,
            "Correct the Markdown target before moving the task.",
          ),
        );
        return null;
      }

      const fileMoves = inside(source, filePath);
      const targetMoves = inside(source, targetBefore);
      if (!fileMoves && !targetMoves) return null;
      try {
        const realTarget = await realpath(targetBefore);
        if (escapesRoot(realRoot, realTarget)) {
          diagnostics.push(
            error(
              "reference.target.symlink-escape",
              displayPath(repositoryRoot, filePath),
              `Reference resolves outside the repository: ${rawTarget}`,
              "Replace the escaping symlink with a repository-local target before moving the task.",
            ),
          );
          return null;
        }
      } catch (caught) {
        if (caught.code !== "ENOENT") throw caught;
        diagnostics.push(
          error(
            "reference.target.missing",
            displayPath(repositoryRoot, filePath),
            `Affected reference target does not exist: ${rawTarget}`,
            "Create the target or correct the Markdown reference before moving the task.",
          ),
        );
        return null;
      }
      const targetAfter = movedPath(targetBefore, source, destination);
      const nextTarget = rewrittenTarget({
        fileAfter,
        root: repositoryRoot,
        rootRelative,
        suffix,
        targetAfter,
        trailingSlash: pathTarget.endsWith("/"),
      });
      if (nextTarget === rawTarget) return null;
      const reference = {
        file: displayPath(repositoryRoot, filePath),
        from: rawTarget,
        to: nextTarget,
        updated: updateAllReferences,
      };
      references.push(reference);
      if (!updateAllReferences) {
        diagnostics.push(
          warning(
            "reference.update-skipped",
            reference.file,
            `Affected reference will not be updated: ${rawTarget}`,
            "Before applying, rerun with --update-all-refs; after applying, update this reference manually.",
          ),
        );
        return null;
      }
      return nextTarget;
    });

    if (rewritten.changed.length > 0 && rewritten.content !== text) {
      edits.push({
        path: displayPath(repositoryRoot, filePath),
        absolutePath: filePath,
        postMovePath: fileAfter,
        original: text,
        content: rewritten.content,
        hash: createHash("sha256").update(text).digest("hex"),
      });
    }
  }

  return { diagnostics, edits, references };
}