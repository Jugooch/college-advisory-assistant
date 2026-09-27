# College Advisory Assistant

Verified Advising Runtime: an institution-sponsored web app that helps students plan next term. A conversational interface handles intent; a deterministic engine makes every academic decision, and anything uncertain is shown as uncertain and routed to an advisor.

## Quick start

Prerequisite for working with the agent team: the Claude Code sandbox (bubblewrap and socat on Linux/WSL2). See [Sandbox setup](docs/team/README.md#sandbox-setup-once-per-machine).

```bash
nvm use                                   # Node 22
pnpm install
cp infra/env.example .env                 # local settings (synthetic data only)
docker compose -f infra/docker-compose.yml up -d   # local Postgres (synthetic data only)
pnpm dev                                  # web :3000, api :4000, worker
pnpm verify                               # everything CI checks
```

### Seed and sign in locally

Everything below uses synthetic data only. Never load real student records on a development machine.

```bash
docker compose -f infra/docker-compose.yml up -d   # local Postgres
cp infra/env.example .env
set -a && . ./.env && set +a                       # export the variables into this shell
pnpm --filter @caa/db db:migrate                    # create the tables
pnpm --filter @caa/db db:seed                       # synthetic colleges, users, students, assignment (safe to re-run)
pnpm dev                                            # web :3000, api :4000, worker

# Who am I? Sign in as the synthetic advisor (AUTH_MODE=dev)
curl -H 'Authorization: Bearer dev-token-advisor' http://localhost:4000/v1/me
```

`db:seed` refuses to run when `NODE_ENV=production`, and the API refuses to start with `AUTH_MODE=dev` in production. The available tokens, and the synthetic identities they sign in as, are defined by `DEV_AUTH_TOKENS` in `.env`.

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
