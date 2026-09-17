export const PORTABLE_IDENTITY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function readIdentityState(root, git) {
  const extension = git(root, [
    "config",
    "--local",
    "--type=bool",
    "--get",
    "extensions.worktreeConfig",
  ]);
  const binding = git(root, [
    "config",
    "--worktree",
    "--get",
    "task-ledger.identity",
  ]);
  const origin = git(root, [
    "config",
    "--show-origin",
    "--show-scope",
    "--get",
    "task-ledger.identity",
  ]);
  const originMatch = /^(\S+)\s+(\S+)\s+(.+)$/.exec(origin.stdout);

  return {
    extensionEnabled: extension.ok && extension.stdout === "true",
    extensionValue: extension.ok ? extension.stdout : null,
    identity: binding.ok && binding.stdout ? binding.stdout : null,
    origin: originMatch?.[2] ?? null,
    resolvedIdentity: originMatch?.[3] ?? null,
    scope: originMatch?.[1] ?? null,
  };
}

export function readDefaultIdentity(root, git) {
  const result = git(root, [
    "config",
    "--global",
    "--get",
    "task-ledger.defaultIdentity",
  ]);
  return result.ok && result.stdout ? result.stdout : null;
}