import { createHash, randomUUID } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

import { runGit } from "./git.js";

const nodeFs = {
  chmod,
  lstat,
  mkdir,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
};

function inside(parent, child) {
  const fromParent = relative(parent, child);
  return fromParent === "" || (!fromParent.startsWith(`..${sep}`) && fromParent !== ".." && !isAbsolute(fromParent));
}

function movedPath(path, source, destination) {
  return inside(source, path) ? resolve(destination, relative(source, path)) : path;
}

export async function snapshotDirectory(path, fs = nodeFs, ignoredPaths = new Set()) {
  const root = resolve(path);
  const snapshot = [];

  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = resolve(directory, entry.name);
      if (ignoredPaths.has(absolutePath)) continue;
      const metadata = await fs.lstat(absolutePath);
      const item = {
        path: relative(root, absolutePath).replaceAll("\\", "/"),
        mode: metadata.mode,
      };
      if (metadata.isDirectory()) {
        snapshot.push({ ...item, type: "directory" });
        await visit(absolutePath);
      } else if (metadata.isFile()) {
        const content = await fs.readFile(absolutePath);
        snapshot.push({
          ...item,
          type: "file",
          hash: createHash("sha256").update(content).digest("hex"),
        });
      } else if (metadata.isSymbolicLink()) {
        snapshot.push({
          ...item,
          type: "symlink",
          target: await fs.readlink(absolutePath),
        });
      } else {
        throw new Error(`Unsupported task artifact type: ${absolutePath}`);
      }
    }
  }

  await visit(root);
  return snapshot;
}

async function assertSourceSnapshot({ expected, fs, ignoredPaths, source }) {
  const actual = await snapshotDirectory(source, fs, ignoredPaths);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("Task artifacts changed after transition planning");
  }
}

async function exists(fs, path) {
  try {
    await fs.lstat(path);
    return true;
  } catch (caught) {
    if (caught.code === "ENOENT") return false;
    throw caught;
  }
}

async function journalPath(root, git) {
  const result = git(root, ["rev-parse", "--git-path", "repoledger-transaction.json"]);
  if (!result.ok || !result.stdout) {
    throw new Error("Git could not resolve the private transaction journal path");
  }
  return isAbsolute(result.stdout) ? result.stdout : resolve(root, result.stdout);
}

async function contentHash(fs, path) {
  return createHash("sha256").update(await fs.readFile(path)).digest("hex");
}

function validateJournal(record, root, taskRoot) {
  const repositoryRoot = resolve(root);
  const tasks = resolve(taskRoot ?? root);
  if (record.version !== 1 || record.root !== repositoryRoot) {
    throw new Error("The repoledger transaction journal has an unsupported identity or version");
  }
  assertInside(tasks, record.source, "Journal source");
  assertInside(tasks, record.destination, "Journal destination");
  for (const item of record.items ?? []) {
    for (const [label, path] of [
      ["Journal temporary", item.temporary],
      ["Journal moved temporary", item.temporaryAfter],
      ["Journal target", item.targetAfter],
      ["Journal backup", item.backup],
    ]) {
      if (path) assertInside(repositoryRoot, path, label);
    }
  }
}

export async function recoverMoveTransaction({
  fs = nodeFs,
  git = runGit,
  root,
  taskRoot,
} = {}) {
  const journal = await journalPath(root, git);
  if (!(await exists(fs, journal))) return { recovered: false, journal };

  let record;
  try {
    record = JSON.parse(await fs.readFile(journal, "utf8"));
    validateJournal(record, root, taskRoot);
  } catch (caught) {
    caught.journal = journal;
    throw caught;
  }

  const recoveryErrors = [];
  if (record.state === "committed") {
    for (const item of record.items ?? []) {
      for (const path of [item.backup, item.temporary, item.temporaryAfter]) {
        if (!path) continue;
        try {
          await fs.rm(path, { force: true });
        } catch (caught) {
          recoveryErrors.push(caught.message);
        }
      }
    }
  } else if (record.state === "preparing") {
    for (const item of [...(record.items ?? [])].reverse()) {
      try {
        const backupExists = item.backup && await exists(fs, item.backup);
        const targetExists = await exists(fs, item.targetAfter);
        if (backupExists) {
          if (targetExists) {
            if (await contentHash(fs, item.targetAfter) !== item.contentHash) {
              throw new Error(`Recovery target changed: ${item.targetAfter}`);
            }
            await fs.rm(item.targetAfter, { force: true });
          }
          await fs.rename(item.backup, item.targetAfter);
        } else if (item.create && targetExists) {
          if (await contentHash(fs, item.targetAfter) !== item.contentHash) {
            throw new Error(`Generated recovery target changed: ${item.targetAfter}`);
          }
          await fs.rm(item.targetAfter, { force: true });
        }
      } catch (caught) {
        recoveryErrors.push(caught.message);
      }
    }

    try {
      const sourceExists = await exists(fs, record.source);
      const destinationExists = await exists(fs, record.destination);
      if (!sourceExists && destinationExists) {
        await fs.rename(record.destination, record.source);
      } else if (sourceExists && destinationExists) {
        throw new Error("Both transaction source and destination exist during recovery");
      } else if (!sourceExists && !destinationExists) {
        throw new Error("Neither transaction source nor destination exists during recovery");
      }
    } catch (caught) {
      recoveryErrors.push(caught.message);
    }

    for (const item of record.items ?? []) {
      for (const path of [item.temporary, item.temporaryAfter]) {
        if (!path) continue;
        try {
          await fs.rm(path, { force: true });
        } catch (caught) {
          recoveryErrors.push(caught.message);
        }
      }
    }
  } else {
    recoveryErrors.push(`Unknown transaction state: ${String(record.state)}`);
  }

  if (recoveryErrors.length > 0) {
    const failure = new Error(`Transaction recovery failed: ${recoveryErrors.join("; ")}`);
    failure.journal = journal;
    failure.recoveryErrors = recoveryErrors;
    throw failure;
  }
  await fs.rm(journal, { force: true });
  return { recovered: true, journal, state: record.state };
}

function assertInside(parent, child, label) {
  if (!inside(parent, child)) throw new Error(`${label} escapes its allowed root: ${child}`);
}

async function assertRegularFile(fs, path, label) {
  const metadata = await fs.lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`${label} must be a regular file: ${path}`);
  }
}

async function preflight({
  creates,
  destination,
  edits,
  fs,
  root,
  source,
  sourceSnapshot,
  taskRoot,
}) {
  const repositoryRoot = resolve(root);
  const tasks = resolve(taskRoot ?? root);
  assertInside(repositoryRoot, tasks, "Task root");
  assertInside(tasks, source, "Move source");
  assertInside(tasks, destination, "Move destination");

  const taskRootMetadata = await fs.lstat(tasks);
  if (taskRootMetadata.isSymbolicLink() || !taskRootMetadata.isDirectory()) {
    throw new Error(`Task root must be a real directory: ${tasks}`);
  }
  const sourceMetadata = await fs.lstat(source);
  if (sourceMetadata.isSymbolicLink() || !sourceMetadata.isDirectory()) {
    throw new Error(`Move source must be a real directory: ${source}`);
  }
  if (await exists(fs, destination)) {
    throw new Error(`Destination already exists: ${destination}`);
  }
  const destinationParent = dirname(destination);
  const parentMetadata = await fs.lstat(destinationParent);
  if (parentMetadata.isSymbolicLink() || !parentMetadata.isDirectory()) {
    throw new Error(`Destination parent must be a real directory: ${destinationParent}`);
  }

  const realRoot = await fs.realpath(repositoryRoot);
  const realTaskRoot = await fs.realpath(tasks);
  const realSource = await fs.realpath(source);
  const realDestinationParent = await fs.realpath(destinationParent);
  assertInside(realRoot, realTaskRoot, "Task root");
  assertInside(realTaskRoot, realSource, "Move source");
  assertInside(realTaskRoot, realDestinationParent, "Destination parent");
  const expectedSnapshot = sourceSnapshot ?? await snapshotDirectory(source, fs);
  const symbolicArtifact = expectedSnapshot.find(({ type }) => type === "symlink");
  if (symbolicArtifact) {
    throw new Error(`Task artifacts must not be symbolic links: ${symbolicArtifact.path}`);
  }
  await assertSourceSnapshot({
    expected: expectedSnapshot,
    fs,
    ignoredPaths: new Set(),
    source,
  });

  const mutationPaths = new Set();
  for (const edit of edits) {
    const absolutePath = resolve(edit.absolutePath);
    const postMovePath = resolve(edit.postMovePath);
    assertInside(repositoryRoot, absolutePath, "Markdown input");
    assertInside(repositoryRoot, postMovePath, "Markdown output");
    if (postMovePath !== movedPath(absolutePath, source, destination)) {
      throw new Error(`Markdown output does not match the task move: ${edit.path}`);
    }
    await assertRegularFile(fs, absolutePath, "Markdown input");
    const realFile = await fs.realpath(absolutePath);
    assertInside(realRoot, realFile, "Markdown input");
    const current = await fs.readFile(absolutePath, "utf8");
    const hash = createHash("sha256").update(current).digest("hex");
    if (hash !== edit.hash) {
      throw new Error(`Markdown input changed after planning: ${edit.path}`);
    }
    if (mutationPaths.has(postMovePath)) {
      throw new Error(`Duplicate transaction output: ${postMovePath}`);
    }
    mutationPaths.add(postMovePath);
  }

  for (const create of creates) {
    const absolutePath = resolve(create.absolutePath);
    const postMovePath = resolve(create.postMovePath);
    assertInside(source, absolutePath, "Generated input");
    assertInside(destination, postMovePath, "Generated output");
    if (postMovePath !== movedPath(absolutePath, source, destination)) {
      throw new Error(`Generated output does not match the task move: ${postMovePath}`);
    }
    if (await exists(fs, absolutePath) || await exists(fs, postMovePath)) {
      throw new Error(`Generated file already exists: ${postMovePath}`);
    }
    const realParent = await fs.realpath(dirname(absolutePath));
    assertInside(realSource, realParent, "Generated file parent");
    if (mutationPaths.has(postMovePath)) {
      throw new Error(`Duplicate transaction output: ${postMovePath}`);
    }
    mutationPaths.add(postMovePath);
  }
  return expectedSnapshot;
}

export async function applyMoveTransaction({
  creates = [],
  destinationPath,
  edits = [],
  fs = nodeFs,
  git = runGit,
  root,
  sourcePath,
  sourceSnapshot,
  taskRoot,
  verify,
}) {
  const source = resolve(sourcePath);
  const destination = resolve(destinationPath);
  const id = randomUUID();
  const journal = await journalPath(root, git);
  if (await exists(fs, journal)) {
    const recovery = await recoverMoveTransaction({ fs, git, root, taskRoot });
    const recovered = new Error(
      `Recovered a previous ${recovery.state} repoledger transaction; recompute and rerun the requested move`,
    );
    recovered.recovered = recovery;
    throw recovered;
  }
  const expectedSnapshot = await preflight({
    creates,
    destination,
    edits,
    fs,
    root,
    source,
    sourceSnapshot,
    taskRoot,
  });

  const staged = [...edits, ...creates].map((item) => {
    const temporary = `${item.absolutePath}.repoledger-${id}.tmp`;
    const targetAfter = item.postMovePath ?? movedPath(item.absolutePath, source, destination);
    const create = !Object.hasOwn(item, "original");
    return {
      ...item,
      temporary,
      temporaryAfter: movedPath(temporary, source, destination),
      targetAfter,
      backup: create ? null : `${targetAfter}.repoledger-${id}.bak`,
      contentHash: createHash("sha256").update(item.content).digest("hex"),
      create,
    };
  });
  const replacements = [];
  let moved = false;
  const rollbackErrors = [];
  const journalRecord = {
    version: 1,
    id,
    root: resolve(root),
    taskRoot: resolve(taskRoot ?? root),
    source,
    destination,
    state: "preparing",
    moved: false,
    items: staged.map((item) => ({
      temporary: item.temporary,
      temporaryAfter: item.temporaryAfter,
      targetAfter: item.targetAfter,
      backup: item.backup,
      contentHash: item.contentHash,
      create: item.create,
      replaced: false,
    })),
  };

  await fs.mkdir(dirname(journal), { recursive: true });
  await fs.writeFile(journal, `${JSON.stringify(journalRecord, null, 2)}\n`, { flag: "wx" });

  try {
    for (const item of staged) {
      await fs.writeFile(item.temporary, item.content, { flag: "wx" });
      if (item.absolutePath && await exists(fs, item.absolutePath)) {
        const metadata = await fs.stat(item.absolutePath);
        await fs.chmod(item.temporary, metadata.mode);
      }
    }

    await assertSourceSnapshot({
      expected: expectedSnapshot,
      fs,
      ignoredPaths: new Set(
        staged
          .map(({ temporary }) => temporary)
          .filter((temporary) => inside(source, temporary)),
      ),
      source,
    });

    await fs.rename(source, destination);
    moved = true;
    journalRecord.moved = true;
    await fs.writeFile(journal, `${JSON.stringify(journalRecord, null, 2)}\n`);

    for (const [index, item] of staged.entries()) {
      const backup = item.backup;
      if (!item.create) {
        await assertRegularFile(fs, item.targetAfter, "Markdown input");
        const current = await fs.readFile(item.targetAfter, "utf8");
        const hash = createHash("sha256").update(current).digest("hex");
        if (hash !== item.hash) {
          throw new Error(`Markdown input changed during apply: ${item.path}`);
        }
      } else if (await exists(fs, item.targetAfter)) {
        throw new Error(`Generated file appeared during apply: ${item.targetAfter}`);
      }
      if (!item.create) {
        await fs.rename(item.targetAfter, backup);
        replacements.push({ ...item, backup });
      }
      try {
        await fs.rename(item.temporaryAfter, item.targetAfter);
      } catch (caught) {
        throw caught;
      }
      if (item.create) replacements.push({ ...item, backup: null });
      journalRecord.items[index].replaced = true;
      await fs.writeFile(journal, `${JSON.stringify(journalRecord, null, 2)}\n`);
    }

    if (verify) await verify();
    journalRecord.state = "committed";
    await fs.writeFile(journal, `${JSON.stringify(journalRecord, null, 2)}\n`);
  } catch (caught) {
    for (const replacement of replacements.reverse()) {
      try {
        if (await exists(fs, replacement.targetAfter)) {
          if (await contentHash(fs, replacement.targetAfter) !== replacement.contentHash) {
            throw new Error(`Rollback target changed: ${replacement.targetAfter}`);
          }
          await fs.rm(replacement.targetAfter, { force: true });
        }
        if (replacement.backup) await fs.rename(replacement.backup, replacement.targetAfter);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    if (moved) {
      try {
        await fs.rename(destination, source);
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError.message);
      }
    }
    for (const item of staged) {
      for (const temporary of [item.temporary, item.temporaryAfter]) {
        try {
          await fs.rm(temporary, { force: true });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError.message);
        }
      }
    }
    if (rollbackErrors.length === 0) await fs.rm(journal, { force: true });
    caught.rollbackErrors = rollbackErrors;
    caught.journal = journal;
    throw caught;
  }

  const cleanupErrors = [];
  for (const replacement of replacements) {
    if (!replacement.backup) continue;
    try {
      await fs.rm(replacement.backup, { force: true });
    } catch (caught) {
      cleanupErrors.push(caught.message);
    }
  }
  if (cleanupErrors.length === 0) {
    try {
      await fs.rm(journal, { force: true });
    } catch (caught) {
      cleanupErrors.push(caught.message);
    }
  }
  return {
    journal,
    moved: true,
    rewritten: edits.length,
    created: creates.length,
    cleanupErrors,
  };
}