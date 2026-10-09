# Local demo walkthrough

A script for showing the product on your own machine after `pnpm demo`. Everything runs locally with synthetic data, the scripted demo model, and dev sign-in. Decided in [ADR-0016 §4](adr/0016-browser-end-to-end-tests-and-local-demo.md).

## Prerequisites

- **Docker**, for the local Postgres in `infra/docker-compose.yml`.
- **Node 22.12 or later** (`nvm use` reads `.nvmrc`) and **pnpm 10** through Corepack (`corepack enable`), then `pnpm install`.
- **Chromium** only if you also run the browser tests (see [Run the e2e tests locally](#run-the-e2e-tests-locally)).

You don't need a `.env` file, an API key, or a cloud account. `pnpm demo` sets everything it needs.

## Start

```bash
docker compose -f infra/docker-compose.yml up -d   # local Postgres
pnpm demo
```

`pnpm demo` wipes and migrates the local database, loads the demo seed, starts web (:3000), API (:4000) and worker, then creates the dynamic state through the API: it saves a plan for the stale persona, publishes a newer record for it, and opens two cases. When it's ready it prints the tokens and "The advisor queue holds 2 open cases." Press Ctrl-C to stop.

Sign in at <http://localhost:3000/dev/sign-in>: enter a token under **Dev token** and press **Sign in**. A student lands on **Overview**. An advisor lands on the home page, which has **Open the review queue**. To switch persona, sign in again with another token.

## Personas

| Token                       | Who                    | What it shows                                                                  |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `dev-token-student`         | Student SYN-000001     | On track with a current record. DEMO-PHYS 201 is in progress.                  |
| `dev-token-student-blocked` | Student SYN-000004     | Blocked prerequisite: DEMO-MATH 101 with a D. Has an open record-problem case. |
| `dev-token-student-unknown` | Student SYN-000005     | UNKNOWN data: DEMO-MATH 101 is a pending transfer with no grade.               |
| `dev-token-student-stale`   | Student SYN-000006     | A saved 2027SP plan that is now out of date. Has an open plan-review case.     |
| `dev-token-advisor`         | Advisor, every student | The review queue, with the 2 open cases.                                       |
| `dev-token-advisor-2`       | Advisor, no students   | An empty queue: an advisor sees only their own students' cases.                |
| `dev-token-admin`           | Admin                  | Approves the advisor assignments. Not needed for the scripts below.            |

Personas are named by role and synthetic reference only.

## Student script (about 10 minutes)

**1. On track: Overview.** Sign in with `dev-token-student`. Overview shows **Your record**, the degree-audit checks as **Passed as of** a time, and the requirement tree.
_Point out:_ a PASS is always "passed as of" its pinned inputs, never an open-ended approval.

**2. Course checks.** Open **Course checks**, tick DEMO-MATH 102 and press **Check these courses**. The **Prerequisite** row reads **Passed as of ...**: the repeat of MATH 101 counts the later B, not the D. Ignore the overall and credit-load lines. One course alone is below the 12.00-credit minimum.

**3. Plan next term with the chat.** Open **Plan next term**, choose **Term** 2027SP and press **Review constraints**. The **Ask the assistant** panel appears with four starter questions. A starter only fills the message box, and you still press **Send**. The starters show only while the chat is empty, so type the later questions yourself.

- Send **I'd like no Fridays**. A chip under **Suggested limits** reads "Not available on Friday, all day." and starts as **Preferred**. Nothing applies until you press **Confirm**, which ticks **Friday** in **Unavailable time 1** on the form.
- Under **Courses to schedule**, tick DEMO-MATH 102, DEMO-PHYS 301, DEMO-ENGL 101 and DEMO-IND 390, and enter `2.00` under **Credits for DEMO-IND 390** (12.00 credits, the policy minimum). Press **Review constraints**. **Review your constraints** lists the Friday limit. Press **Confirm and find schedules**. The options appear, each with its own checks and a **Save as draft** button. The overall state is **Conditional** because DEMO-PHYS 201 is still in progress.
- Send **Show me my options**. **Option 1** appears as a card in the chat, with **Checks, shown separately** and **Courses and sections**. It has no Friday section, and it says "No preference is missed by this option."
- Send **What is the policy on dropping a course?**. Approved policy excerpts appear, each with its revision, effective date and source.
- Send **Can I get financial aid for this term?**. A referral says "Financial aid questions need the financial aid office." and "This app cannot make that determination".

_Point out:_ every fact in the chat (options, credits, checks, policy) renders from a verified block. The demo model only picks tools and a fixed intro line.

**4. Save a draft.** Press **Save as draft** on the first option. It says "Draft saved. This is a plan, not a registration." **Open My plans** shows the 2027SP draft as **Up to date**.

**5. Ask an advisor.** Go back to **Plan next term** and send **Ask my advisor to review my plan**. A preview says "Nothing has been sent." and "Your chat is not shared." Follow **Continue to the request form**. **Ask an advisor** opens with **Review my plan** selected. Fill in **Your note for your advisor** and press **Send to my advisor**. It says **Case opened.** **Open Help and cases** lists the case under **Your cases** as **Waiting for an advisor**, without the chat transcript.

**6. Crisis referral.** Back on Plan next term, send `I feel suicidal`. A fixed crisis referral appears, and the model isn't called. Reload the page: the referral is still there.
_Point out:_ safety text comes from fixed templates and survives a reload.

**7. Blocked prerequisite.** Sign in with `dev-token-student-blocked`, open **Course checks**, tick DEMO-MATH 102 and press **Check these courses**.
The **Prerequisite** is **Not met**: the grade earned is below the minimum. **Help and cases** shows its record-problem case as **Waiting for an advisor**.

**8. UNKNOWN data.** Sign in with `dev-token-student-unknown`, open **Course checks**, tick DEMO-MATH 102 and press **Check these courses**.
The **Prerequisite** reads **Needs verification**: the only matching credit is a pending transfer.
_Point out:_ UNKNOWN is never PASS. Missing data is shown as unknown, with a next step.

**9. Stale plan.** Sign in with `dev-token-student-stale` and open **My plans**. The 2027SP draft reads **Out of date**, and its advisor case reads **Open case, waiting for an advisor**. Open the draft: "Your course record changed after this draft was saved." The plan is history, not a current check.

## Advisor script (about 3 minutes)

1. Sign in with `dev-token-advisor` and press **Open the review queue**. **Review queue** lists **Plan review** and **Problem reported with the record**, oldest first, plus any case you opened in the student script.
2. Open **Review “Plan review”, opened ...** for the stale persona's case (its note reads "Please check my plan before I register."). The page starts with "No one has claimed this case yet." Under **Plan attached to this case**, **Is this saved plan still up to date?** reads **Out of date**.
3. Press **Claim this case**. It says "You claimed this case. It is now in your review." Under **Your review**, choose **I reviewed this**, write a **Note for the student**, and press **Resolve this case**.
   _Point out:_ resolving is advice only. It changes no record and grants no waiver or registration.
4. Sign in with `dev-token-student-stale` and open **Help and cases**. The case reads **Reviewed by an advisor**, with **Note from your advisor**.
5. Sign in with `dev-token-advisor-2` and open the review queue. It shows **No cases to review**, because this advisor has no assigned students.

## Reset

Press Ctrl-C and run `pnpm demo` again. Every run wipes the database and rebuilds the same starting state. To also drop the Postgres volume, run `docker compose -f infra/docker-compose.yml down -v`, then start again.

## Run the e2e tests locally

The browser tests run the same stack against the plain dev seed. CI runs them in the `E2E` job, not in `pnpm verify`.

```bash
pnpm --filter @caa/tests exec playwright install chromium   # once; on Linux add --with-deps for system packages
docker compose -f infra/docker-compose.yml up -d
export DATABASE_URL=postgres://caa:caa@localhost:5432/caa
pnpm --filter @caa/db db:reset && pnpm --filter @caa/db db:seed
pnpm e2e
```

Stop `pnpm demo` first. Outside CI, Playwright reuses servers already listening on :3000 and :4000. The tests change data, so run `pnpm demo` again afterwards. The report is in `tests/e2e/playwright-report/`.

## Troubleshooting

| You see                                                   | Do this                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Postgres is not reachable at localhost:5432.`            | Start Docker, then run `docker compose -f infra/docker-compose.yml up -d`.                                 |
| `Refusing to run the demo: ...`                           | `DATABASE_URL` must point at `localhost` or `127.0.0.1`, and `NODE_ENV` can't be `production`. Unset them. |
| `The API did not become healthy` or a port already in use | Stop any other `pnpm dev` using :3000 or :4000, then run `pnpm demo` again.                                |
| `Demo preparation failed: ...`                            | The stack stops. Read the message above it, then run `pnpm demo` again.                                    |
| Sign-in fails                                             | Copy a token from the table exactly. Dev sign-in exists only in development.                               |
| Pages say the data is too old                             | Seeded record times are relative to the seed run and expire after 24 hours. Run `pnpm demo` again.         |

## Safety notes

- **Synthetic data only.** Every student, grade and identity is invented. Never load real student data into the demo.
- **No live AI.** The demo forces `CONVERSATION_MODEL=demo` and drops `ANTHROPIC_API_KEY` from its environment, so it can't reach a live model.
- **Local only.** `pnpm demo` refuses a non-local database and production before any write. Dev sign-in is never offered in production.
- **Read-only institutional systems.** No code path writes to an SIS, degree audit or registration system. Drafts, cases and resolutions stay inside the app and register no one.
