# ADR-0015: Conversation orchestration, the model boundary, the approved policy corpus, and chat history

- **Status:** Accepted 2026-10-08. The repo owner chose decisions 1–4 (model, tools, history, UI) and confirmed the tech lead's choices listed on #495 on 2026-10-08. The orchestrator defaults are adopted, except where evaluations live (§9).
- **Date:** 2026-10-08
- **Deciders:** Tech lead; repo owner (product decisions 1–4 on #495)
- **Related:** FR-01, FR-02, FR-08, FR-10, FR-14, FR-16, NFR-02, NFR-05, NFR-08, new AC42–AC47, T06, planning/07 §Modules, §Request lifecycle and §Failure containment, planning/09 §Canonical entities, §Logical app interfaces and §Retention, planning/10 (all), planning/11 §Interaction details, planning/04 §Change control (model vendor), ADR-0005, ADR-0008, ADR-0009, ADR-0010, ADR-0013, ADR-0014, issues #495–#520

## Context

Sprint S6 is epic E07 (planning/14): intent extraction, approved tools, and deterministic claim rendering, on top of the verified engine and the S5 drafts and cases. planning/10 fixes the safety contract: six tools, server-bound identity, consequential output only from structured fields, untrusted documents and tool output, specialist referral, a no-model fallback, and versioned prompts, tools, templates and evaluator datasets. planning/07 puts the model version in explanation metadata, never the academic truth key, and requires that an LLM outage leaves forms, cards and cases working.

What the planning docs leave open: which provider and how it is isolated, how a turn is orchestrated, how model text is kept away from academic claims, where the policy corpus comes from, how history is bounded, and where each piece lives in the layered repo. `@caa/assistant` today holds only the tool name catalog. No rate limiting, feature flag or outbound HTTP exists in the api.

## Decision

### 1. The model boundary: a port, two adapters, and an off switch

- **Port.** `@caa/assistant` defines a `ConversationModel` port, types only: `respond({ system, messages, tools }) → { text, toolCalls, stopReason }`. The orchestrator in the api depends on the port, never on a provider SDK.
- **Claude adapter.** `apps/api/src/adapters/claude-model.adapter.ts` implements the port with `@anthropic-ai/sdk`. It is the only file allowed to import the SDK (lint). It sets a per-call timeout, makes at most one retry on a transient overload, and maps every failure to a typed `ModelUnavailableError`. It never falls back to another provider (planning/10: no silent switch on outage).
- **Deterministic fakes.** `@caa/assistant` exports a scripted model (`createScriptedModel(steps)`, an exact sequence of replies for tests and evals) and a demo model (`createDemoModel()`, fixed keyword rules that drive the S6 demo without a network). Both are pure. Tests, CI and agents use them, because the agent sandbox can't reach the provider (ADR-0003).
- **Configuration** (`apps/api/src/config/env.ts`, all defaulted so existing harnesses need no change):

| Variable                             | Values and default                                                               |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `CONVERSATION_MODEL`                 | `off` (default), `demo`, `claude`. `demo` is refused when `NODE_ENV=production`. |
| `CONVERSATION_MODEL_ID`              | `claude-haiku-5-5` (default) or `claude-sonnet-5-5`. Any other value is refused. |
| `ANTHROPIC_API_KEY`                  | Required when `CONVERSATION_MODEL=claude`; a secret, never logged.               |
| `CONVERSATION_PROVIDER_APPROVAL_REF` | Required when `CONVERSATION_MODEL=claude` and `NODE_ENV=production`; see below.  |
| `CONVERSATION_HISTORY_TURNS`         | Turns sent to the model, default 8, range 0–20.                                  |
| `CONVERSATION_RATE_LIMIT`            | Student turns per rolling 10 minutes, default 20.                                |

- **The kill switch is `CONVERSATION_MODEL=off`.** It stops every model call. The wiring picks the adapter from configuration, with a `// SAFETY:` comment (standard 01 §Composition root). The test container can inject any `ConversationModel` through an optional `ContainerOptions.conversationModel`. That is a permanent test seam, not a rollout step.
- **Provider qualification.** planning/04 lists a model vendor as a change needing requalification, and planning/10 requires provider approval before student records are sent. S6 uses synthetic data only. Production refuses `claude` until `CONVERSATION_PROVIDER_APPROVAL_REF` names the approval record, so enabling it with real records is a deliberate, recorded act. This ADR is the change request for synthetic use only.
- **Metadata.** Each assistant turn records `modelId`, `promptVersion`, `toolSchemaVersion`, `templateVersion` and the guard's reason codes. None of them enters `pinnedInputs`, a constraint hash, or any plan revision (planning/07 §Request lifecycle).

### 2. A turn: one synchronous request, bounded

`POST /v1/students/:studentId/conversation/turns` takes `{ termId, message, plannerInputs, expectedSequence }`:

- `message` is the student's text, 1–1,000 characters.
- `plannerInputs` is the planner form's current, confirmed state, validated by the schedule-options request schema. It may be absent when the form is empty.
- `expectedSequence` is the last turn the client saw. A race (two tabs) is 409 `REVISION_CONFLICT`, the ADR-0013 pattern.
- Tenant, user, student and role come from the session. Only the student may post; anyone else gets 404. A body naming a tenant, user, role, or any prior assistant turn is 400.

The orchestrator then:

1. Runs the deterministic message detectors (§5). Their blocks are always added, whatever the model does.
2. Loads the last `CONVERSATION_HISTORY_TURNS` turns from the store (§7) and calls the model with the versioned system prompt and the six tool schemas.
3. Executes each tool call through §4, feeding results back, within a budget: at most 3 model calls, 4 tool calls, and 1 `request_plan` per turn, and 25 seconds in total. A call past the budget is not executed.
4. Passes the model's final text through the output guard (§3), renders the blocks, and stores both turns.

The response is always 200 with a `modelStatus`, following ADR-0010's "200 with `outcome`" precedent, so the UI renders one shape and the form keeps working. No new `ErrorCode` is added, which avoids an error-handler and wording-map ripple.

| `modelStatus`       | When                                                         | Model text shown        |
| ------------------- | ------------------------------------------------------------ | ----------------------- |
| `ANSWERED`          | The model replied and the guard passed its text              | The guarded text        |
| `GUARDED`           | The guard rejected the text (§3)                             | A template intro        |
| `BUDGET_EXHAUSTED`  | The budget ran out                                           | A template intro        |
| `MODEL_UNAVAILABLE` | The adapter failed or timed out                              | The fallback template   |
| `RATE_LIMITED`      | The student is over `CONVERSATION_RATE_LIMIT`; no model call | The rate-limit template |
| `DISABLED`          | `CONVERSATION_MODEL=off`; no model call                      | The disabled template   |

`RATE_LIMITED` and `DISABLED` store nothing. The other four store the student turn and the assistant turn. Every fallback template points to the planner form, My plans and Help and cases, which work without a model (planning/07 §Failure containment). Rate counting reads the turn store with the injected clock, so it holds across api instances and needs no in-memory state.

**Rejected:** streaming (planning/11 asks to announce completed updates, not tokens, and it complicates the guard, which needs the whole text); a 503 or 429 error code (a new `ErrorCode` ripples into the api error handler and the web wording map for no user benefit).

### 3. What the model may say, and the output guard

**The model chooses tools; the server writes the claims.** The response is a short intro plus blocks. The blocks are exactly the rendered results of this turn's successful tool calls and detectors, in order. The model can't add, remove or edit a block, and it can't cite one that wasn't produced.

**Blocks** come in two kinds:

- Data blocks reuse existing contract schemas and are shown by the existing verified web components: `SCHEDULE_OPTIONS` (a `ScheduleOptionsResponse`), `PLAN_EVIDENCE` (a plan revision view with its read-time freshness), `ACADEMIC_SUMMARY`, `POLICY_RESULTS` (§6), `CONSTRAINT_PROPOSAL` (§4) and `CASE_PREVIEW` (§4).
- Text blocks are `NOTICE` and `REFERRAL`. They carry `templateId`, `templateVersion` and the text the server rendered from `@caa/assistant` templates and structured fields.

The intro is the only model-authored text. The server keeps it only if the deterministic output guard in `@caa/assistant` passes it:

- It is at most 600 characters. A longer intro is replaced, never truncated, because truncation can drop a "not".
- It matches none of the consequential patterns: credit or grade values, eligibility, prerequisite, pass, fail, met or satisfied wording, `UNKNOWN` or `CONDITIONAL` restated, readiness or "on track", dates and deadlines, "registered", "enrolled" or "approved", confidence or percentages, promises that an advisor was notified or will reply, and URLs.
- Otherwise the intro is a fixed template chosen from the block kinds ("Here are your schedule options. Each card shows its own checks."), and `modelStatus` is `GUARDED`.

The guard is deliberately over-inclusive. A false positive costs awkward wording; a false negative is a release blocker (planning/10). The guard never touches a block, so a CONDITIONAL or UNKNOWN check reaches the student exactly as the engine returned it. The web renders the intro as plain text (no Markdown, HTML or links) under a label that it is assistant text, visually separate from the verified cards. No second LLM certifies anything (planning/10).

### 4. The six tools: arguments, binding, and what the model sees

Every tool's argument schema is a strict Zod object in `@caa/assistant`. None has a tenant, user, student or role field, and an unknown key fails. A failed parse is returned to the model as `INVALID_ARGUMENTS` and counts against the budget. The orchestrator binds the actor from the session and calls the existing api services, so every service's access check and freshness gate applies unchanged.

| Tool                      | Arguments                                                                 | Bound to                                                                                                                                                      | Block                 |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `get_academic_summary`    | none                                                                      | The academic summary service for the session's own student                                                                                                    | `ACADEMIC_SUMMARY`    |
| `search_approved_policy`  | `query` (1–200 chars), optional `topic`                                   | Policy search (§6): the session's tenant, audience `STUDENT`, the injected clock, approved only                                                               | `POLICY_RESULTS`      |
| `propose_constraints`     | a list of schedule constraints in the domain schema                       | Schema validation only. Nothing is applied                                                                                                                    | `CONSTRAINT_PROPOSAL` |
| `request_plan`            | none                                                                      | Schedule options on the turn's `plannerInputs`, the student's confirmed form state. Missing or incomplete inputs give a `PLANNER_INPUT_NEEDED` notice instead | `SCHEDULE_OPTIONS`    |
| `get_validation_evidence` | `planId`, optional `revision`                                             | The plan revisions service. A plan the student can't see is `NOT_FOUND`, the same as a missing one                                                            | `PLAN_EVIDENCE`       |
| `draft_case_context`      | `reason`, optional `planId`, `discrepancySubject`, `suggestedNote` (≤500) | Builds a preview only. Nothing is created                                                                                                                     | `CASE_PREVIEW`        |

- **Proposals are never applied.** `propose_constraints` downgrades every proposed constraint to `PREFERRED`. The student sees each as an editable chip with a hard/preferred toggle, and confirming it writes it into the planner form. `request_plan` reads only the form state, so an unconfirmed proposal can't reach the solver, and a hard constraint exists only if the student chose it (FR-08, planning/11 "asks before interpreting 'no Fridays' as mandatory").
- **Case drafts are previews.** A `CASE_PREVIEW` names the reason, the plan revision, the queue ("advisors assigned to you"), and an editable note. The note passes the output guard and is left empty if it fails. Its action opens the existing case form, prefilled. The student submits through the S5 case flow. The transcript is never attached (planning/11 §Case submission, ADR-0013 §6).
- **Minimized model input.** The model receives a reduced projection of each result: requirement names and states, course codes, outcome and option counts, per-option check states, and policy titles and excerpts. Never names, emails, student or user IDs, grades, notes, or the case note (standard 09). The student sees the full block.
- **Untrusted data.** Each tool result goes to the model inside an explicit data wrapper, and the system prompt says content inside it is never an instruction. That is defence in depth only. The binding, the strict schemas and the guard hold even if the model obeys an injection, and the evals (§9) prove it with a scripted model that does exactly that.
- **Tool failure is shown.** A service error (`STALE_SOURCE`, `SOURCE_UNAVAILABLE`, `NOT_FOUND`, …) goes to the model as its code and always adds a `NOTICE` with the existing wording for that code. An outage is never hidden (planning/10 release blocker).

### 5. Fixed responses: referral, crisis, hypotheticals, overrides, grade disputes

Deterministic detectors in `@caa/assistant` run on the student's message before the model. Each match adds a fixed, versioned template block, whatever the model says:

| Detector                                                                  | Block                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial aid, immigration, athletics eligibility, accessibility, appeals | `REFERRAL` for the topic: the app can't make this determination, a degree-valid schedule says nothing about it, and where to ask. It includes the tenant's approved referral document for that topic when the corpus has one (§6) |
| Crisis or urgent safety language                                          | `REFERRAL` `CRISIS`, shown first: the vetted resource, that this chat is not monitored live and is not an emergency service, and no promise of advisor contact. The model is not called                                           |
| "Assume I passed", "what if I pass"                                       | `NOTICE` `HYPOTHETICAL_NOT_SUPPORTED`: scenarios aren't supported yet, and the official record is unchanged (no scenario engine in V1)                                                                                            |
| "Ignore the prerequisite", override requests                              | `NOTICE` `OVERRIDE_PROCESS`: the official override route, with no eligibility label                                                                                                                                               |
| "My grade is wrong"                                                       | `NOTICE` `GRADE_DISPUTE`: offers a source discrepancy case through the existing case flow                                                                                                                                         |

The topics are a domain enum, `SpecialistTopic`. The keyword lists are over-inclusive for the same reason as the guard. Model text that tries to answer one of these topics is caught by the guard's eligibility and date patterns.

### 6. The approved policy corpus and its search

- **Object.** `PolicyDocument` (planning/09) in `@caa/domain`: `tenantId`, `documentKey`, `revision`, `title`, `body` (≤20,000 chars), `topic` (`GENERAL` or a `SpecialistTopic`), `subjectKey`, `audience` (`STUDENT`, `ADVISOR` or `ALL`), `effectiveFrom`, `effectiveTo` (exclusive, or null), `approvalStatus` (`DRAFT`, `APPROVED` or `WITHDRAWN`), `approvedAt` (required when approved), `sourceLabel`, and `contentHash`. Effective times are instants, so there's no time-zone rule.
- **Storage.** A `policy_document` table, unique on `(tenant_id, document_key, revision)`. An approved revision is immutable (a trigger refuses UPDATE and DELETE, as for published rules). A change is a new revision.
- **Synthetic seed.** At least: two current student documents on different subjects; a newer revision of one that isn't effective yet; an expired one; a `DRAFT`; a `WITHDRAWN`; an `ADVISOR`-only one; one in another tenant; two current documents with the same `subjectKey` that disagree; one approved referral document per `SpecialistTopic`, the crisis one a fictional vetted resource; and one whose body contains a prompt injection. All text is fictional.
- **Applicability (FR-16).** The repository returns, for the session's tenant and audience at the injected clock's instant, the highest approved revision per `documentKey` with `effectiveFrom ≤ now < effectiveTo`. `effectiveTo` exactly at now is no longer applicable. Draft, withdrawn, future and expired revisions are never returned.
- **Search** is a pure api `.logic.ts`. It tokenizes the query and documents (lower-case, split on non-letters and digits, a fixed stop-word list). The score is the number of distinct query tokens in the title (×2) and body, and ties break by `documentKey`. It returns the top 3 with a score above 0. The excerpt is the paragraph with the most query tokens, cut at a word boundary to at most 500 characters. Identical inputs give identical results. No embeddings.
- **Conflicts.** When two returned documents share a `subjectKey`, both carry `conflict: true` and a fixed notice: these approved documents may disagree; ask the policy owner (planning/09 §Source authority).
- **Result.** Each hit shows title, excerpt, `documentKey`, revision, effective interval, `sourceLabel` and approval time. The turn's metadata records each revision returned (planning/07: a policy response records the policy revision and effective date). Quoted policy text is approved general information, not a personalized determination.
- **Without chat.** `GET /v1/policies?q=&topic=` serves the same search, with the audience from the session role (a student gets `STUDENT` and `ALL`; staff also get `ADVISOR`). Help and cases gets a policy search and the referral documents, so nothing is chat-only (NFR-02, planning/11).

### 7. History is server-side and bounded; preferences live in the form

- **Store.** A `Conversation` per tenant, student and term, with append-only `ConversationTurn`s numbered from 1. A turn has a `role` (`STUDENT` or `ASSISTANT`), the student's text or the guarded intro, block references, `modelStatus`, metadata, and `createdAt`.
- **Block references, not payloads.** A stored assistant turn keeps only each block's kind and IDs: the policy `documentKey` and revision, the plan ID and revision, the template ID and version, the proposed constraints, and the case reason. A schedule-options result is not stored. When a transcript is reloaded, a past `SCHEDULE_OPTIONS` or `PLAN_EVIDENCE` block shows as "shown at <time>" with a link to rerun or open the plan. A stored PASS is never presented as current (ADR-0013 §3).
- **Access.** Only the student reads, posts to or clears their conversation. Advisors and admins get 404, because the transcript is not shared with staff (planning/11 §Case submission).
- **Model context.** The last `CONVERSATION_HISTORY_TURNS` turns: the student's messages and the guarded intros. Raw model text, tool results and blocks are never replayed. Facts needed again are refetched through tools (planning/10 §Conversation state). The client never sends history.
- **Retention.** planning/09 proposes 30 days for raw conversation. Each append deletes the conversation's turns older than 30 days by the injected clock, and any beyond the newest 100. `DELETE /v1/students/:studentId/conversation?termId=` lets the student clear it. Turns are append-only otherwise: no UPDATE.
- **Confirmed preferences live in the planner form, not a new store.** A confirmed chip fills the form. The form state goes with each turn as `plannerInputs`, and it is persisted the way it is today, through a saved plan draft's inputs (ADR-0013 §2). This is the simplest option that satisfies planning/10 "persist confirmed preferences separately from chat". The only path from chat to the solver is through a student-confirmed form field. **Rejected:** a separate preferences table, which would duplicate the draft's inputs and need its own staleness rules.
- **Logging.** Message text, intros, notes and policy bodies are never logged. Log lines carry opaque IDs, `modelStatus`, tool names, guard reason codes, durations and token counts (standard 09, FR-14).

### 8. The UI

- A chat panel on Next-term planner, beside the form, never in place of it. Every chat action has a non-chat equivalent: the form, the existing cards, My plans, Help and cases, and the policy search.
- Constraint chips have a labelled hard/preferred radio group and a Confirm button. Nothing fills the form without Confirm.
- Data blocks use the existing verified components. The intro is plain text with an "assistant" label.
- A send shows a busy state. One polite live-region announcement is made when the turn completes (planning/11). Keyboard-only use and focus return to the input are covered by tests.
- When `modelStatus` isn't `ANSWERED`, the panel shows the template and points to the form. When `CONVERSATION_MODEL=off`, the panel says chat is unavailable, and the rest of the page is unchanged.

### 9. Packages, file roles, evaluations, and the SDK dependency

- **`@caa/assistant` stays pure and depends only on `@caa/domain`.** It holds the model port types, tool argument schemas, the system prompt, templates, the output guard, the message detectors, and the scripted and demo models. No I/O, clock, randomness, `process.env` or network (lint). Its folders get role suffixes, enforced by `scripts/check-conventions.mjs` (standard 01): `tools/*.tool.ts` (plus the existing `tools/tool-catalog.ts`), `prompts/*.prompt.ts`, `templates/*.template.ts`, `guards/*.guard.ts`, `ports/*.port.ts`, `fakes/*.fake.ts`. The contract can't import the assistant, so the block schemas are in `@caa/api-contract` and the enums they share (`SpecialistTopic`, `ModelStatus`, `AssistantBlockKind`, `NoticeCode`) are in `@caa/domain`.
- **The api owns orchestration.** Modules `policy-search`, `conversation-store`, `conversation-tools` and `conversation` (services and `.logic.ts`), a `conversation` wiring area, and the new folder `apps/api/src/adapters/` for `*.adapter.ts` files that call an external service. The worker's `.adapter.ts` role already exists. This extends it to the api for outbound calls only.
- **Evaluations live in `tests/evals/`, owned by QA, not in `@caa/assistant`.** This changes the orchestrator's default. Standard 07 §Academic test independence requires that expected results are written by QA, not by the author of the guard and templates under test. Files are `t06-<slug>.eval.test.ts`, run by `pnpm test` in CI against the scripted model through `@caa/api/testing`. Each case is multi-turn and states literal expectations. A CONDITIONAL→PASS upgrade, an invented minimum grade, another student's record, a saved plan called registered, a hidden outage, or a promised human reply fails CI as a release blocker. `pnpm --filter @caa/tests eval:live` runs the same cases against Claude. It is manual and never in CI or `pnpm verify`. It needs `ANTHROPIC_API_KEY`, runs outside the agent sandbox, and prints a per-dimension report. Release blockers fail it too.
- **Security review of `@anthropic-ai/sdk`.** It is the first outbound runtime dependency. The adding PR (api) records in its description the version pinned exactly, its transitive dependencies, its license, and that it is imported in one adapter file only (lint). The key is read only by `config/env.ts`. The adapter sends only the minimized projection (§4), and no request or response body is logged. The sandbox network allowlist (ADR-0003) is unchanged: agents never reach the provider.

### 10. Endpoints

| Endpoint                                              | Purpose                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| `GET /v1/policies?q=&topic=`                          | Approved policy search for the session's tenant and audience (§6)       |
| `GET /v1/students/:studentId/conversation?termId=`    | Availability and the stored transcript, newest 100 turns (student only) |
| `POST /v1/students/:studentId/conversation/turns`     | One turn (§2)                                                           |
| `DELETE /v1/students/:studentId/conversation?termId=` | Clear the transcript (student only)                                     |

## Consequences

- A demoable flow on synthetic data, with no engine change. The engine and `pinnedInputs` are untouched, so determinism (NFR-01) is unaffected.
- With the model off or down, every S1–S5 screen works unchanged, and the panel says so.
- The guard will sometimes replace harmless text. That is accepted; the evals measure the rate.
- Everything is additive. New enums, models, tables, endpoints and screens; no new `ErrorCode`, and no field becomes required on an existing type. All new env variables have defaults, so the acceptance harness keeps building. QA's in-memory fakes for the new repositories land before the api PRs that need them, through the harness's existing `Repositories &` intersection.
- Tooling: devops adds the assistant role suffixes, `apps/api/src/adapters/`, the SDK import restriction, the assistant purity rules, and the `tests/evals/` naming rule (#497).
- planning/09 gets a decision note for the endpoints, `PolicyDocument` and conversation retention. planning/13 gets AC41 (S5's file, which had no row) and AC42–AC47. Standards 01, 05, 07 and 09 get matching touch-ups. All in this PR.
- The issues, in merge order, are on #495.

## Revisit when

- A real institution's records would be sent to a model (provider qualification, planning/10 and planning/12).
- The guard's false-positive rate in `eval:live` makes chat unhelpful. Then consider typed claim slots the model fills, still rendered by templates, never free paraphrase.
- Streaming, multi-term scenarios ("assume I passed"), or embeddings search are wanted.
- A tenant needs its own referral wording beyond the corpus, or a second provider.
