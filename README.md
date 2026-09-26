# College Advisory Assistant

Verified Advising Runtime: an institution-sponsored web app that helps students plan next term. A conversational interface handles intent; a deterministic engine makes every academic decision, and anything uncertain is shown as uncertain and routed to an advisor.

## Quick start

Prerequisite for working with the agent team: the Claude Code sandbox (bubblewrap and socat on Linux/WSL2). See [Sandbox setup](docs/team/README.md#sandbox-setup-once-per-machine).

```bash
nvm use                                   # Node 22
pnpm install
docker compose -f infra/docker-compose.yml up -d   # local Postgres (synthetic data only)
pnpm dev                                  # web :3000, api :4000, worker
pnpm verify                               # everything CI checks
```

## Where things are

| Read this                                          | For                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                           | Repo layout, commands, and the non-negotiable rules                                   |
| [`docs/planning/`](docs/planning/00-start-here.md) | Product scope, requirements, architecture, and SDLC gates                             |
| [`docs/standards/`](docs/standards/README.md)      | Binding coding standards: structure, naming, comments, data objects, APIs, tests, PRs |
| [`docs/team/`](docs/team/README.md)                | The agent team, file ownership, handoffs, and the review panel                        |
| [`docs/adr/`](docs/adr/)                           | Architecture decision records                                                         |

## Contributing

Every change goes through a pull request from a branch named `<owner-agent>/<issue>-<slug>`. CI checks quality, tests, the build, file ownership, and the PR title, and an AI reviewer panel must approve the head commit before merge. See [`docs/standards/08-git-and-pull-requests.md`](docs/standards/08-git-and-pull-requests.md).
