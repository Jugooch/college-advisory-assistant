# The agent team

Work is done by specialist Claude Code subagents defined in `.claude/agents/`. Each builder owns one area of the repository and never edits another's. Reviewers never edit anything. You (the human) and the main Claude session act as **product owner and orchestrator**: you create issues, split work by owner, and dispatch agents.

## Roster

### Builders

| Agent               | Owns                                                                                            | Typical work                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tech-lead`         | `docs/**`, `CLAUDE.md`, `README.md`, `.claude/**`, PR/issue templates, `.github/ownership.json` | ADRs, standards changes, splitting features into owner-sized issues, settling review disputes |
| `devops-engineer`   | `.github/workflows/**`, `scripts/**`, `infra/**`, root configs                                  | CI, lint and tooling rules, local infrastructure, deployment                                  |
| `domain-engineer`   | `packages/domain/**`, `packages/api-contract/**`                                                | Data objects, enums, shared invariants (ADR-0005), endpoint contracts, typed client           |
| `engine-engineer`   | `packages/engine/**`                                                                            | Deterministic verification and scheduling rules                                               |
| `data-engineer`     | `packages/db/**`, `apps/worker/**`                                                              | Tables, migrations, repositories, import adapters, jobs                                       |
| `api-engineer`      | `apps/api/**`                                                                                   | Routes, controllers, services, auth plugins, composition root                                 |
| `ai-engineer`       | `packages/assistant/**`                                                                         | Tool catalog, prompts, claim templates, AI evaluations                                        |
| `frontend-engineer` | `apps/web/**`                                                                                   | Pages, feature components, hooks, frontend API calls                                          |
| `qa-engineer`       | `tests/**`, `packages/test-kit/**`                                                              | Golden corpus, acceptance cases AC01–AC20, synthetic builders, e2e                            |

### Reviewers (read-only)

`architecture-reviewer`, `standards-reviewer`, `correctness-reviewer`, `security-reviewer`, `academic-safety-reviewer`, `accessibility-reviewer`. See `docs/standards/08-git-and-pull-requests.md` for when each runs.

## Isolation

Four layers keep agents in their lane. The operating system contains the machine; the hooks and CI contain the repository.

1. **Shell sandbox** (`sandbox` in `.claude/settings.json`, see ADR-0003): every Bash command, including subagents', runs in Claude Code's OS sandbox.
   - **Writes:** only the repository and the temp directory.
   - **Reads:** `.env` and every `.env.*` file at any depth are unreadable. The example config lives at `infra/env.example` so agents can maintain it. Credential stores in your home directory are denied through your **user** settings, because their paths differ per machine (see setup step 3). The GitHub CLI login stays readable so agents can open PRs; see ADR-0003.
   - **Network:** only `github.com`, `api.github.com`, and `registry.npmjs.org`.
   - **No escape hatch:** commands can't fall back to running unsandboxed.
2. **Edit hook** (`.claude/hooks/enforce-ownership.mjs`): denies a team agent's Write/Edit outside its area, and any write that resolves outside the repository (after resolving `..` and symlinks), except to the session scratchpad. Reviewers are denied every edit.
3. **Git pre-push hook** (`lefthook.yml`): runs `pnpm check:ownership` against the branch's owner prefix.
4. **CI** (`Ownership` check): the same script runs on every PR and is a required check. It catches any in-repo change that got past the local layers, however it was made.

**Known limit:** the sandbox can't scope an individual agent to its own folders. An agent's shell can technically change another area inside the repository. Layers 3 and 4 stop that from ever reaching `main`.

### Sandbox setup (once per machine)

On Linux or WSL2 (WSL1 and native Windows aren't supported; macOS needs nothing):

```bash
sudo apt-get install -y bubblewrap socat
```

On **Ubuntu 24.04 or later**, AppArmor can stop bubblewrap from creating user namespaces. Follow the AppArmor profile steps in the [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing.md) if `/sandbox` reports that bubblewrap fails.

Then, in Claude Code:

1. Run `/sandbox`. It should show the sandbox as available, with no missing dependencies.
2. Make a missing sandbox fatal instead of silently unsandboxed. Add this to your **user** settings (`~/.claude/settings.json`); project settings can't set it:
   ```json
   { "sandbox": { "failIfUnavailable": true } }
   ```
3. Deny your credential stores, also in **user** settings. List the ones that exist on your machine, resolved to their real location:
   ```bash
   for p in .ssh .aws .gnupg .azure .kube .docker .config/gcloud .npmrc .netrc .git-credentials .claude/.credentials.json; do
     [ -e ~/$p ] && readlink -f ~/$p
   done
   ```
   Add each printed path to `sandbox.filesystem.denyRead`. Write paths inside your home as `~/...`, and anything outside it (such as a WSL symlink target on `/mnt/c`) as an absolute path with a leading `//`:
   ```json
   {
     "sandbox": {
       "failIfUnavailable": true,
       "filesystem": {
         "denyRead": [
           "~/.ssh",
           "~/.docker",
           "~/.claude/.credentials.json",
           "//mnt/c/Users/you/.aws"
         ]
       }
     }
   }
   ```
   Always use the resolved path: bubblewrap can't mount over a symlink (`bwrap: Can't mount tmpfs ...`), and a single bad entry stops every Bash command. Missing paths are harmless, but there's no reason to list them.
4. Run `/sandbox` again and check the **Config** tab. Your deny paths should be listed, and a quick command such as `ls ~/.ssh` should fail while `pnpm lint` works.

A `SessionStart` hook (`.claude/hooks/check-local-safety.mjs`) warns at the start of every session if the sandbox is off on your machine or step 3 is missing.

**Performance on a Windows-mounted drive.** If the repository lives on `/mnt/c` under WSL2, every file access crosses to Windows, and the sandbox adds setup cost to each command. That combination can make agent work very slow. The supported fix is to clone into the Linux filesystem (for example `~/code`).

If you stay on `/mnt/c`, you can turn the sandbox off for your machine with `/sandbox` (saved to your uncommitted `.claude/settings.local.json`). You then lose all machine-level containment:

- agent Bash can read every credential in your home directory;
- it can reach any network host;
- it can write anywhere your user can;
- Bash permission prompts return, because `autoAllowBashIfSandboxed` only applies to sandboxed commands.

The edit hook, pre-push check, and CI still protect the repository, but nothing protects the machine. Choose this knowingly; the session-start warning will remind you.

Commands that need other hosts or system services (for example `docker compose -f infra/docker-compose.yml up -d`) are run by you in your own terminal, not by agents.

`pnpm-lock.yaml` is shared: any builder may change it by adding dependencies to its own `package.json`.

## Handoffs

When an agent needs a change outside its area, it stops and ends its turn with a handoff block instead of editing:

```markdown
### Handoff request

- **To:** domain-engineer
- **Why:** `PlanResponseSchema` needs a `staleSince` field for FR-11.
- **Change needed:** add `staleSince: z.iso.datetime({ offset: true }).nullable()` to `packages/api-contract/src/contracts/plans.contract.ts`.
- **Blocks:** my PR api-engineer/57-stale-plans until merged.
```

The orchestrator creates the sub-issue, dispatches the owner, and resumes the blocked agent after the dependency merges.

There's one exception to that order. When a new required domain field breaks a test-kit builder, the orchestrator applies the builder fix inside the domain PR, under the `ownership-override` label, linking #108. That follows standard 08 §Required-field ripple (ADR-0004). No other cross-area edit is made without a case listed there.

## Feature workflow

1. **Issue.** The orchestrator (or `tech-lead`) writes the issue: requirement IDs, acceptance examples, failure states, and the owner split.
2. **Order.** Sub-issues are merged in dependency order: contract/domain → db → engine → api → web. QA writes acceptance tests in parallel from the planning docs.
3. **Build.** Each owner works on `<owner>/<issue>-<slug>`, runs `pnpm verify`, and opens a PR with `/open-pr`.
4. **Review.** CI runs checks and the reviewer panel. Findings go back to the owner, who pushes fixes; reviews re-run on the new head.
5. **Merge.** Squash merge when every required check is green.

## Dispatching agents from the main session

Ask for the work by role:

> Use the domain-engineer agent to implement issue #12 (PlanRevision model).

Independent owners can run in parallel, each on its own branch (use worktree isolation for parallel builders so branches don't collide). Reviewers can always run in parallel.
