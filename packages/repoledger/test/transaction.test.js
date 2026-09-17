import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as nodeFs from "node:fs/promises";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
  applyMoveTransaction,
  recoverMoveTransaction,
  snapshotDirectory,
} from "../src/transaction.js";

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "repoledger-transaction-"));
  temporaryDirectories.push(root);
  const source = join(root, "tasks", "backlog", "move-task");
  const destination = join(root, "tasks", "ongoing", "fixture", "move-task");
  const external = join(root, "docs", "links.md");
  await mkdir(source, { recursive: true });
  await mkdir(join(root, "tasks", "ongoing", "fixture"), { recursive: true });
  await mkdir(join(root, "docs"));
  await mkdir(join(root, ".git"));
  await writeFile(join(source, "Task.md"), "original task\n");
  await writeFile(external, "original links\n");
  const original = await readFile(external, "utf8");
  const git = (_root, args) => args[0] === "rev-parse"
    ? { ok: true, stdout: ".git/repoledger-transaction.json" }
    : { ok: false, status: 1, stderr: "unexpected", stdout: "" };
  return { destination, external, git, original, root, source };
}

test("moves a task and atomically installs edits and generated files", async () => {
  const { destination, external, git, original, root, source } = await fixture();

  const result = await applyMoveTransaction({
    creates: [
      {
        absolutePath: join(source, "Progress.md"),
        postMovePath: join(destination, "Progress.md"),
        content: "generated progress\n",
      },
    ],
    destinationPath: destination,
    edits: [
      {
        absolutePath: external,
        postMovePath: external,
        path: "docs/links.md",
        original,
        content: "rewritten links\n",
        hash: createHash("sha256").update(original).digest("hex"),
      },
    ],
    git,
    root,
    sourcePath: source,
    verify: async () => {
      assert.equal(await readFile(join(destination, "Task.md"), "utf8"), "original task\n");
    },
  });

  assert.equal(result.moved, true);
  assert.equal(await readFile(external, "utf8"), "rewritten links\n");
  assert.equal(await readFile(join(destination, "Progress.md"), "utf8"), "generated progress\n");
  await assert.rejects(nodeFs.access(source));
});

test("rolls back the task move and file contents after an injected rename failure", async () => {
  const { destination, external, git, original, root, source } = await fixture();
  let renames = 0;
  const fs = {
    ...nodeFs,
    async rename(from, to) {
      renames += 1;
      if (renames === 3) throw new Error("injected replacement failure");
      return nodeFs.rename(from, to);
    },
  };

  await assert.rejects(
    applyMoveTransaction({
      destinationPath: destination,
      edits: [
        {
          absolutePath: external,
          postMovePath: external,
          path: "docs/links.md",
          original,
          content: "rewritten links\n",
          hash: createHash("sha256").update(original).digest("hex"),
        },
      ],
      fs,
      git,
      root,
      sourcePath: source,
    }),
    /injected replacement failure/,
  );

  assert.equal(await readFile(join(source, "Task.md"), "utf8"), "original task\n");
  assert.equal(await readFile(external, "utf8"), original);
  await assert.rejects(nodeFs.access(destination));
});

test("rejects changed Markdown input before moving the task", async () => {
  const { destination, external, git, original, root, source } = await fixture();
  await writeFile(external, "changed after planning\n");

  await assert.rejects(
    applyMoveTransaction({
      destinationPath: destination,
      edits: [
        {
          absolutePath: external,
          postMovePath: external,
          path: "docs/links.md",
          original,
          content: "rewritten links\n",
          hash: createHash("sha256").update(original).digest("hex"),
        },
      ],
      git,
      root,
      sourcePath: source,
    }),
    /changed after planning/,
  );

  assert.equal(await readFile(join(source, "Task.md"), "utf8"), "original task\n");
  await assert.rejects(nodeFs.access(destination));
});

test("rejects a generated-file collision before moving the task", async () => {
  const { destination, git, root, source } = await fixture();
  await writeFile(join(source, "Progress.md"), "existing progress\n");

  await assert.rejects(
    applyMoveTransaction({
      creates: [
        {
          absolutePath: join(source, "Progress.md"),
          postMovePath: join(destination, "Progress.md"),
          content: "generated progress\n",
        },
      ],
      destinationPath: destination,
      git,
      root,
      sourcePath: source,
      taskRoot: join(root, "tasks"),
    }),
    /already exists/,
  );

  assert.equal(await readFile(join(source, "Progress.md"), "utf8"), "existing progress\n");
  await assert.rejects(nodeFs.access(destination));
});

test("keeps committed state and journal when backup cleanup fails", async () => {
  const { destination, external, git, original, root, source } = await fixture();
  const fs = {
    ...nodeFs,
    async rm(path, options) {
      if (path.includes(".repoledger-") && path.endsWith(".bak")) {
        throw new Error("injected backup cleanup failure");
      }
      return nodeFs.rm(path, options);
    },
  };

  const result = await applyMoveTransaction({
    destinationPath: destination,
    edits: [
      {
        absolutePath: external,
        postMovePath: external,
        path: "docs/links.md",
        original,
        content: "rewritten links\n",
        hash: createHash("sha256").update(original).digest("hex"),
      },
    ],
    fs,
    git,
    root,
    sourcePath: source,
    taskRoot: join(root, "tasks"),
  });

  assert.equal(result.moved, true);
  assert.equal(result.cleanupErrors.length, 1);
  assert.equal(result.journal, join(root, "tasks", ".repoledger-transaction.json"));
  assert.equal(await readFile(external, "utf8"), "rewritten links\n");
  await nodeFs.access(destination);
  await nodeFs.access(result.journal);

  await assert.rejects(
    applyMoveTransaction({
      destinationPath: destination,
      git,
      root,
      sourcePath: source,
      taskRoot: join(root, "tasks"),
    }),
    (caught) => {
      assert.equal(caught.recovered?.state, "committed");
      assert.match(caught.message, /Recovered a previous committed/);
      return true;
    },
  );
  await assert.rejects(nodeFs.access(result.journal));
  assert.equal(await readFile(external, "utf8"), "rewritten links\n");
  await nodeFs.access(destination);
});

test("rejects a symbolic-link move source before mutation", async () => {
  const { destination, git, root, source } = await fixture();
  const external = join(root, "external-task");
  await rm(source, { recursive: true });
  await mkdir(external);
  await writeFile(join(external, "Task.md"), "external task\n");
  await symlink(
    external,
    source,
    process.platform === "win32" ? "junction" : "dir",
  );

  await assert.rejects(
    applyMoveTransaction({
      destinationPath: destination,
      git,
      root,
      sourcePath: source,
      taskRoot: join(root, "tasks"),
    }),
    /Move source must be a real directory/,
  );

  assert.equal(await readFile(join(external, "Task.md"), "utf8"), "external task\n");
  await assert.rejects(nodeFs.access(destination));
});

test("rejects a symbolic-link artifact inside the moving task", async () => {
  const { destination, git, root, source } = await fixture();
  const external = join(root, "external-artifact");
  await mkdir(external);
  await writeFile(join(external, "artifact.txt"), "external artifact\n");
  await symlink(
    external,
    join(source, "artifact-link"),
    process.platform === "win32" ? "junction" : "dir",
  );

  await assert.rejects(
    applyMoveTransaction({
      destinationPath: destination,
      git,
      root,
      sourcePath: source,
      taskRoot: join(root, "tasks"),
    }),
    /Task artifacts must not be symbolic links/,
  );

  assert.equal(
    await readFile(join(external, "artifact.txt"), "utf8"),
    "external artifact\n",
  );
  await nodeFs.access(source);
  await assert.rejects(nodeFs.access(destination));
});

test("rejects a task artifact changed while transaction files are staged", async () => {
  const { destination, git, root, source } = await fixture();
  const sourceSnapshot = await snapshotDirectory(source);
  let changed = false;
  const fs = {
    ...nodeFs,
    async writeFile(path, content, options) {
      const result = await nodeFs.writeFile(path, content, options);
      if (!changed && path.includes(".repoledger-") && path.endsWith(".tmp")) {
        changed = true;
        await nodeFs.writeFile(join(source, "Task.md"), "concurrent change\n");
      }
      return result;
    },
  };

  await assert.rejects(
    applyMoveTransaction({
      creates: [
        {
          absolutePath: join(source, "Progress.md"),
          postMovePath: join(destination, "Progress.md"),
          content: "generated progress\n",
        },
      ],
      destinationPath: destination,
      fs,
      git,
      root,
      sourcePath: source,
      sourceSnapshot,
      taskRoot: join(root, "tasks"),
    }),
    /Task artifacts changed/,
  );

  assert.equal(await readFile(join(source, "Task.md"), "utf8"), "concurrent change\n");
  await assert.rejects(nodeFs.access(destination));
});

test("recovers a preparing transaction after a simulated process interruption", async () => {
  const { destination, external, git, original, root, source } = await fixture();
  const id = "interrupted";
  const backup = `${external}.repoledger-${id}.bak`;
  const temporary = `${external}.repoledger-${id}.tmp`;
  const journal = join(root, "tasks", ".repoledger-transaction.json");
  const rewritten = "rewritten before interruption\n";
  await rename(source, destination);
  await rename(external, backup);
  await writeFile(external, rewritten);
  await writeFile(
    journal,
    `${JSON.stringify({
      version: 1,
      id,
      root,
      taskRoot: join(root, "tasks"),
      source,
      destination,
      state: "preparing",
      moved: true,
      items: [
        {
          temporary,
          temporaryAfter: temporary,
          targetAfter: external,
          backup,
          contentHash: createHash("sha256").update(rewritten).digest("hex"),
          create: false,
          replaced: true,
        },
      ],
    }, null, 2)}\n`,
  );

  const recovery = await recoverMoveTransaction({
    git,
    root,
    taskRoot: join(root, "tasks"),
  });

  assert.equal(recovery.recovered, true);
  assert.equal(recovery.state, "preparing");
  assert.equal(await readFile(external, "utf8"), original);
  assert.equal(await readFile(join(source, "Task.md"), "utf8"), "original task\n");
  await assert.rejects(nodeFs.access(destination));
  await assert.rejects(nodeFs.access(journal));
});

test("rejects a journal whose cleanup path is not transaction-derived", async () => {
  const { external, root, source } = await fixture();
  const journal = join(root, "tasks", ".repoledger-transaction.json");
  await writeFile(
    journal,
    `${JSON.stringify({
      version: 1,
      id: "tampered",
      root,
      taskRoot: join(root, "tasks"),
      source,
      destination: join(root, "tasks", "ongoing", "fixture", "move-task"),
      state: "committed",
      moved: true,
      items: [
        {
          temporary: null,
          temporaryAfter: null,
          targetAfter: external,
          backup: external,
          contentHash: "unused",
          create: false,
          replaced: true,
        },
      ],
    }, null, 2)}\n`,
  );

  await assert.rejects(
    recoverMoveTransaction({ root, taskRoot: join(root, "tasks") }),
    /backup path does not match/,
  );
  assert.equal(await readFile(external, "utf8"), "original links\n");
});