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
- **Reads:** credential stores are denied: `~/.ssh`, `~/.aws`, `~/.gnupg`, `~/.azure`, `~/.kube`, `~/.docker`, `~/.config/gcloud`, `~/.npmrc`, `~/.netrc`, `~/.git-credentials`, and Claude's own `~/.claude/.credentials.json`. The `Read(...)` deny rules for `.env` files, at the root and at any depth, also apply inside the sandbox.
- **Network:** only `github.com`, `api.github.com`, and `registry.npmjs.org`. Add a host only through a reviewed change to this file.
- **No escape hatch:** `allowUnsandboxedCommands: false`, so a command that fails in the sandbox can't be retried outside it.
- **Prompts:** `autoAllowBashIfSandboxed: true`, so sandboxed commands run without a prompt. The `permissions.deny` rules (for example force-push) still apply.

## Consequences

- Agents can't write outside the repository or reach arbitrary network hosts, however a command is phrased.
- **The sandbox has no per-agent path scoping.** One agent's shell could still change another agent's files inside the repository. The edit hook blocks this through the Write and Edit tools, and the required CI `Ownership` check catches it in any PR. This split is deliberate: the OS contains the machine, and CI contains the repository.
- **Accepted residual risk: GitHub CLI credentials.** Agents open and inspect PRs with `gh`, so `~/.config/gh` stays readable. Code running in the sandbox could read that token and use the allowed GitHub or npm hosts to send it out, for example as a gist, a push, or `npm publish`. This is mitigated but not eliminated: the network is limited to those hosts, tokens should use the narrowest scopes available (a fine-grained token limited to this repository is preferred), and every change still lands through review. Revisit if Claude Code's credential masking (`sandbox.credentials`) can supply the `gh` token without exposing it.
- Each developer machine needs `bubblewrap` and `socat` (Linux/WSL2). If they're missing, Claude Code warns and runs Bash **unsandboxed**. To refuse to start instead, set `failIfUnavailable` in user settings (it can't be set from project settings). Setup is in `docs/team/README.md`.
- Commands that need other hosts or system services (for example `docker compose`) must be run by a human outside Claude Code, or their domains added here through a reviewed change.
- The AI review workflow in GitHub Actions doesn't use the sandbox. Those reviewers are limited instead by `--allowedTools` to read-only `git` and `gh` commands, and they never post: a trusted step posts their verdicts.

## Revisit when

Claude Code supports per-agent sandbox rules or permission scopes, or a new workflow step needs a host outside the allowlist.
