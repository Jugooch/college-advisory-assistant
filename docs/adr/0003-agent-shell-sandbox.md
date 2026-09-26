# ADR-0003: Contain agent shells with the Claude Code sandbox

- **Status:** Accepted
- **Date:** 2026-09-26
- **Deciders:** Product owner, tech lead
- **Related:** ADR-0002, issue #2, planning doc 12 (threat register)

## Context

Agents run Bash with the user's permissions. The foundation PR first tried a PreToolUse hook that pattern-matched command text against an allowlist. Ten review rounds kept finding new bypasses: quoting, escapes, environment assignments, and programs that write files through their own flags. A guard that reads shell text can't contain what the shell will actually do, and builders must run their own tests, which execute arbitrary code by design. That guard was removed before merge.

## Decision

Enable Claude Code's OS-level sandbox for Bash in the checked-in `.claude/settings.json`. The operating system enforces it (bubblewrap on Linux and WSL2, Seatbelt on macOS), and it applies to every subagent.

- **Writes:** only the repository and the per-user temp directory. Claude Code also protects `.claude/` and `.git/hooks` from sandboxed writes.
- **Reads:** `~/.ssh`, `~/.aws`, and `~/.gnupg` are denied. The existing `Read(./.env)` and `Read(./.env.*)` deny rules also apply inside the sandbox.
- **Network:** only GitHub (`github.com`, `api.github.com`, `*.githubusercontent.com`) and the npm registry.
- **No escape hatch:** `allowUnsandboxedCommands: false`, so a command that fails in the sandbox can't be retried outside it.
- **Prompts:** `autoAllowBashIfSandboxed: true`, so sandboxed commands run without a prompt. The `permissions.deny` rules (for example force-push) still apply.

## Consequences

- Agents can't write outside the repository or reach arbitrary network hosts, however a command is phrased.
- **The sandbox has no per-agent path scoping.** One agent's shell could still change another agent's files inside the repository. The edit hook blocks this through the Write and Edit tools, and the required CI `Ownership` check catches it in any PR. This split is deliberate: the OS contains the machine, and CI contains the repository.
- Each developer machine needs `bubblewrap` and `socat` (Linux/WSL2). If they're missing, Claude Code warns and runs Bash **unsandboxed**. To refuse to start instead, set `failIfUnavailable` in user settings (it can't be set from project settings). Setup is in `docs/team/README.md`.
- Commands that need other hosts or system services (for example `docker compose`) must be run by a human outside Claude Code, or their domains added here through a reviewed change.
- The AI review workflow in GitHub Actions doesn't use the sandbox. Those reviewers are limited instead by `--allowedTools` to read-only `git` and `gh` commands, and they never post: a trusted step posts their verdicts.

## Revisit when

Claude Code supports per-agent sandbox rules or permission scopes, or a new workflow step needs a host outside the allowlist.
