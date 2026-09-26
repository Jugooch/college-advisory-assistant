# The agent team

Work is done by specialist Claude Code subagents defined in `.claude/agents/`. Each builder owns one area of the repository and never edits another's. Reviewers never edit anything. You (the human) and the main Claude session act as **product owner and orchestrator**: you create issues, split work by owner, and dispatch agents.

## Roster

### Builders

| Agent               | Owns                                                                                            | Typical work                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `tech-lead`         | `docs/**`, `CLAUDE.md`, `README.md`, `.claude/**`, PR/issue templates, `.github/ownership.json` | ADRs, standards changes, splitting features into owner-sized issues, settling review disputes |
| `devops-engineer`   | `.github/workflows/**`, `scripts/**`, `infra/**`, root configs                                  | CI, lint and tooling rules, local infrastructure, deployment                                  |
| `domain-engineer`   | `packages/domain/**`, `packages/api-contract/**`                                                | Data objects, enums, endpoint contracts, typed client                                         |
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
   - **Reads:** `.env` files, `~/.ssh`, `~/.aws`, and `~/.gnupg` are unreadable.
   - **Network:** only GitHub and the npm registry.
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
