# Initial research — original supplied answer

Version: 0.1 | Date: September 25, 2026 | Status: Proposed baseline; not institutionally approved

## Editorial note

The answer below is preserved from the supplied attachment, including its original wording, examples, tables, and citation placeholders. Line endings are normalized. This is a historical research input, not an approved product specification. The original citation markers do not resolve to URLs in the attachment; they must not be treated as verified citations. Numerical market claims, caseload statistics, customer counts, funding figures, and estimates of automatable workload remain unverified here.

Read `02-research-assessment-and-sources.md` for the current evidence assessment and corrections. In particular, absolute reliability language is an aspiration, not a guarantee; the proposed V1 is narrower than the original MVP table.

---

Yes—there is a real product opportunity here, but I would frame it more narrowly than “AI replaces the college advisor.”

The market for **degree planning, student-success software, and AI student support is already fairly competitive**. The interesting opportunity is a system where **the AI is the conversational interface, while an auditable deterministic engine makes every academic decision**.

That distinction matters. A student could ask:

> “I work 25 hours a week, I don't want Friday classes, and I want to graduate by Spring 2028. What should I take next semester?”

The LLM can understand the request. But it should **never decide what counts toward graduation**. Instead:

$$
\text{Student intent}
\rightarrow
\text{Deterministic academic engine}
\rightarrow
\text{Valid options}
\rightarrow
\text{AI explanation}
$$

That architecture is both safer and, potentially, the actual differentiator.

As of September 25, 2026, there is strong evidence that the underlying problem is real. Recent advising research found a modal advisor caseload of roughly **300–399 students**, while another study found caseload size strongly associated with advisor burnout; community-college caseloads can reach **1,200 students per advisor**. :chatgpt-content-reference{index="0"} Complete College America specifically identifies unnecessary credits, poor course sequencing, confusing requirements, and advising failures as causes of delayed graduation and additional student cost. :chatgpt-content-reference{index="1"}

So the pain you are seeing personally is not unusual.

---

# What a college academic advisor actually does

One complication is that “academic advisor” means different things at different schools. Some universities centralize advising; others use departmental or faculty advisors. Financial aid, registrar functions, career counseling, accessibility, international-student advising, and mental-health counseling may belong to separate offices.

But the academic advisor is frequently the **router and interpreter across all of them**. Universities describe advisors as handling degree audits, registration, prerequisite sequencing, major exploration, academic standing, petitions, transfer credit, graduation planning, referrals, and much more. :chatgpt-content-reference{index="2"}

Here is the product surface I would consider the complete advising domain.

| Domain | What the advisor actually does |
|---|---|
| **Student onboarding** | Determine declared/intended major; concentration; minor; degree type; campus; modality; catalog year; expected graduation date; incoming credits; placement results; academic interests; career interests; work schedule; family obligations; athletics; honors participation; visa status where relevant; accommodations; veteran status; transfer intentions; and other constraints affecting planning. |
| **Orientation** | Explain registration systems, SIS, LMS, degree audit, academic calendar, advising expectations, communication channels, student email, campus resources, deadlines, academic integrity rules, and how to get help. |
| **Student record review** | Review transcript; attempted credits; earned credits; transfer credits; GPA; institutional GPA; major GPA; repeated courses; withdrawals; incompletes; test credit; AP/IB/CLEP; dual enrollment; placement; academic standing; current registrations; holds; petitions; substitutions; waivers; and pending credits. |
| **Degree audit** | Determine exactly which requirements are complete, in progress, planned, or missing. Check university requirements, college requirements, major requirements, concentration requirements, minor requirements, general education, electives, upper-division credits, residency requirements, GPA requirements, minimum grades, capstones, internships, labs, practicum requirements and non-course milestones. |
| **Catalog-year rules** | Determine which curriculum version applies to the student and whether changing majors/minors or stopping out changes applicable requirements. Catalog rules can materially change what a student needs. |
| **Course applicability** | Determine whether a course actually satisfies a degree requirement, counts only as elective credit, satisfies multiple requirements, is prohibited from double-counting, duplicates previous credit, or does not count at all. |
| **Course sequencing** | Verify prerequisites, co-requisites, prerequisite chains, minimum grades, placement requirements, admission-to-major rules and dependencies such as Calculus I → Calculus II → Physics II → upper-level engineering. |
| **Critical-path planning** | Identify courses that unlock future coursework and courses offered only once per year so a student does not accidentally delay graduation by one or more semesters. |
| **Multi-semester planning** | Create semester-by-semester paths to graduation rather than merely deciding the upcoming semester. |
| **Credit-load planning** | Determine whether 6/9/12/15/18+ credits are appropriate; check institutional maximums; discuss overload requests; balance demanding and easier courses; and account for work/life obligations. |
| **Course scheduling** | Translate required courses into real sections while checking meeting times, conflicts, campus, online/in-person modality, labs, recitations, linked sections, start/end dates and student preferences. |
| **Course availability** | Determine whether the course is actually offered that semester and, ideally, whether historical offering patterns make future placement reasonable. |
| **Seat availability** | Check open sections, closed sections, reserved seats, waitlists, departmental permission requirements and possible alternatives. |
| **Registration readiness** | Verify registration date/time, advising PINs, mandatory advising requirements and registration holds. |
| **Registration holds** | Identify advising, registrar, bursar, financial aid, immunization, orientation, international, conduct or other holds and explain which office/process resolves them. |
| **Registration execution** | Help students add classes, drop classes, swap sections, join waitlists, request closed-course permission or navigate registration errors. Some institutions allow actual registration through advising software. |
| **Special enrollment requests** | Handle or route credit overloads, time-conflict overrides, prerequisite overrides, late adds, late drops, section changes, course auditing, pass/fail requests, cross-registration, independent study and other special enrollment cases. |
| **Add/drop decisions** | Explain whether changing the schedule affects degree progress, prerequisites, graduation timing, full-time status or future course eligibility. |
| **Withdrawals** | Explain academic consequences of withdrawing from one course or an entire semester and route financial-aid, immigration, athletics or other consequences to the responsible office. |
| **Major exploration** | Help undecided students identify plausible majors based on interests, existing credits, academic performance and career goals. |
| **Changing majors** | Perform “what-if” audits showing how completed courses apply under another program and estimate additional semesters/credits required. |
| **Minors/concentrations/certificates** | Evaluate whether adding or removing one affects graduation timing, credit requirements and course overlap. |
| **Double majors / dual degrees** | Evaluate overlapping requirements, residency requirements, additional credits, double-count restrictions and graduation timeline. |
| **Alternative majors** | When admission to a selective/competitive major becomes unlikely, help students identify parallel programs that preserve as many credits as possible. |
| **Transfer-credit evaluation** | Determine how coursework from another institution applies—or route it to faculty/registrar evaluators when academic judgment is required. |
| **Transfer articulation** | Check established equivalencies, articulation agreements and course-transfer databases. |
| **Prospective transfer planning** | Help students choose courses that will transfer to their intended destination institution. |
| **Reverse-transfer / credential mining** | Detect whether accumulated credits may already satisfy another credential or certificate. |
| **Prior learning** | Handle AP, IB, CLEP, military education, dual-enrollment, professional credential or other institution-approved prior-learning credit. |
| **Transient coursework** | Determine whether students can take a course elsewhere during summer or another term and have it transfer back appropriately. |
| **Study abroad planning** | Determine which program/coursework fits the degree, when studying abroad will least disrupt sequencing, and which credits may transfer. |
| **Internship/co-op planning** | Help fit internships, co-ops, experiential education, clinical placements or practicums into the degree path. |
| **GPA interpretation** | Explain cumulative GPA, institutional GPA, major GPA, semester GPA and sometimes separate GPA calculations tied to degree requirements. |
| **GPA forecasting** | Answer questions like “What grades do I need this semester to get back above 2.5?” |
| **Minimum-grade rules** | Recognize requirements such as “C or better in major courses” even where a lower passing grade technically earns institutional credit. |
| **Repeated courses** | Explain repeat policies, duplicate credit, grade replacement/forgiveness policies and how repeats alter prerequisites or degree progress. |
| **Academic warning** | Identify students approaching minimum academic thresholds and build recovery strategies. |
| **Academic probation** | Explain standing requirements, required advising, GPA recovery, course-load strategy and mandatory academic-success activities. |
| **Dismissal/suspension** | Explain process and deadlines and route appeals to authorized humans. |
| **Academic recovery** | Discuss tutoring, supplemental instruction, study habits, time management, reduced load, course sequencing and campus support. |
| **Early alerts** | Respond to faculty alerts, poor grades, LMS inactivity, missed assignments, attendance problems or other risk signals. |
| **Retention outreach** | Contact students who have stopped attending, have not registered, missed required milestones or appear likely to stop out. |
| **Re-enrollment** | Help returning students understand updated requirements, previous credits, academic standing and pathways to completion. |
| **Leave of absence** | Explain institutional process and academic consequences and connect students with relevant offices. |
| **Graduation planning** | Conduct final degree checks, identify remaining courses, verify residency/credit/GPA requirements and establish a final-semester plan. |
| **Graduation application** | Explain application deadlines and required processes. |
| **Graduation certification** | In some institutions advisors/registrars review whether every requirement has actually been satisfied. |
| **Commencement vs degree conferral** | Explain differences between participating in commencement and actually completing/conferring the degree. |
| **Career exploration** | Connect majors, coursework, internships and career possibilities; advisors commonly make career-center referrals. |
| **Graduate/professional school** | Help students understand prerequisite coursework and appropriate sequencing for medicine, law, graduate programs, etc., or refer to specialized advisors. |
| **Pre-professional planning** | Track courses and milestones for pre-med, pre-law, pre-dental, nursing admission and similar pathways. |
| **Campus-resource referrals** | Tutoring, writing center, disability/accessibility services, counseling, career services, financial aid, student accounts, registrar, housing, food assistance, international office, veteran services, TRIO, ombuds, dean of students, etc. |
| **Financial-aid awareness** | Know that dropping/withdrawing/repeating courses or failing academic-progress requirements can affect aid, while referring actual financial-aid determinations to financial-aid professionals. |
| **International-student awareness** | Recognize when course load, withdrawal, online courses or program changes may create immigration implications and escalate rather than giving immigration advice. |
| **Student-athlete awareness** | Recognize NCAA/institutional eligibility constraints and work with athletics compliance/advising. |
| **Accessibility** | Coordinate with accessibility services when accommodations affect academic planning without making accommodation determinations themselves. |
| **Personal difficulties** | Recognize when academic issues are actually caused by financial, health, family, transportation, housing, childcare or other problems and connect the student with support. |
| **Mental-health/crisis situations** | Recognize warning signs and immediately route appropriately rather than attempting counseling. |
| **Petitions** | Help initiate or review petitions involving substitutions, waivers, exceptions, late actions, overloads, withdrawals or other academic rules. |
| **Exceptions** | Enter or document approved curriculum exceptions so the degree audit correctly reflects them. |
| **Forms** | Help students locate, understand and complete forms for program changes, registration issues, appeals and other academic processes. |
| **Policy interpretation** | Explain catalog policies, deadlines, grading rules, academic standing, registration policy, repeated-course rules, residency requirements and institutional procedures. |
| **Deadline management** | Registration opening, add/drop, withdrawal, graduation application, major applications, scholarship deadlines, financial-aid steps and other academic milestones. |
| **Appointment scheduling** | Book regular advising appointments, mandatory appointments, drop-ins and follow-ups. |
| **Appointment preparation** | Review the record before meeting so the advisor understands current progress and issues. |
| **Advising notes** | Record what was discussed, decisions made, student concerns, referrals, action items and future follow-ups. |
| **Case management** | Maintain open issues, referrals and action items across multiple campus offices. |
| **Advisor handoff** | Transfer a student between general advising, departmental advising, specialized advising or another campus office without losing context. |
| **Student communication** | Email/SMS students about registration, deadlines, holds, risk alerts, graduation requirements and other necessary actions. |
| **Proactive campaigns** | Find cohorts such as “CS majors missing Calculus I,” “students with 90+ credits who haven't applied to graduate,” or “students who haven't registered” and contact them. |
| **Student self-service education** | Teach students how to understand their own degree audit and make increasingly independent decisions. |
| **Goal setting** | Help students articulate academic, professional and personal goals and connect those goals to an educational plan. |
| **Plan revision** | Recalculate the academic plan when a course is failed, withdrawn, unavailable, changed, completed elsewhere or removed from the curriculum. |
| **Curriculum-change handling** | Understand how new requirements affect different catalog cohorts and preserve old rules where required. |
| **Advisor collaboration** | Share appropriate notes/context among advisors, faculty and student-support staff. |
| **Course-demand forecasting** | Aggregate student plans to identify likely shortages in specific courses or sections. |
| **Bottleneck detection** | Identify courses or requirements causing widespread delayed progression. |
| **Program analytics** | Track retention, completion, excess credits, registration behavior, academic risk, advisor workload and intervention results. |
| **Curriculum feedback** | Tell departments when students repeatedly encounter unclear requirements, prerequisite problems or capacity bottlenecks. |
| **Orientation/workshops** | Run registration workshops, major-exploration sessions, probation workshops, transfer sessions and graduation planning sessions. |
| **Documentation upkeep** | Keep advising guides, FAQs, curriculum sheets, suggested plans and internal processes current. |
| **System testing** | Advisors are sometimes involved when degree-audit rules, SIS changes or registration processes are tested. |
| **Confidentiality** | Protect education records and control what can be shared with parents, faculty or others under FERPA and institutional policy. |

That scope is why replacing an advisor with “a chatbot connected to the catalog” would fail.

The advisor is effectively performing:

$$
\text{rules engine} + \text{planner} + \text{case manager} + \text{knowledge base} + \text{router} + \text{coach}
$$

NACADA itself describes advising competency in three broad dimensions—**conceptual, informational, and relational**—rather than merely course registration. :chatgpt-content-reference{index="3"}

---

# The architecture boundary I would enforce

I'd classify capabilities into three different authority levels.

| Authority | Examples | Implementation |
|---|---|---|
| **Deterministic system** | Degree requirements, eligible courses, prerequisites, GPA calculations, catalog year, credit counting, graduation progress, registration eligibility, course applicability, double-count rules, term availability | Rules/constraint engine |
| **AI assistance** | Understand questions, gather goals/constraints, explain requirements, summarize records, compare validated options, explain why a plan works, draft messages, provide reminders, help students navigate processes | LLM using tools |
| **Human authority** | Curriculum exceptions, ambiguous transfer evaluations, petitions, overrides, academic-dismissal appeals, sensitive personal situations, accessibility determinations, immigration issues, financial-aid determinations, crisis situations | Advisor / registrar / appropriate specialist |

The most important technical rule would be:

> **The LLM never creates an academic fact. It can only retrieve, translate, explain or act upon facts returned by authoritative services.**

So the model is prohibited from outputting:

> “CS 341 should count toward your software elective.”

unless the academic engine has returned something equivalent to:

```text
course: CS 341
applies_to: BSCS.SOFTWARE_ELECTIVE
rule_id: BSCS-2026-R42
status: VALID
credits_applied: 3
catalog_version: 2026-2027
```

The model can then say:

> “Yes. CS 341 satisfies one of your Software Elective requirements under your 2026–27 Computer Science catalog.”

That is a radically different reliability model from RAG over a course catalog.

---

# The deterministic academic engine

This is probably the actual heart of the company.

You would need a canonical representation of:

| Entity | Important information |
|---|---|
| Student | program, catalog year, majors/minors, concentrations, completed courses, attempted courses, grades, credits, transfer credit, placements, current enrollment, holds, exceptions, standing |
| Program | degree, college, major, concentration, catalog version |
| Requirement | AND/OR groups, minimum courses, minimum credits, GPA constraints, minimum grades, residency, course level, reuse restrictions |
| Course | credits, attributes, prerequisites, co-requisites, exclusions, repeats, equivalencies |
| Section | term, instructor, campus, modality, time, seats, restrictions, waitlist |
| Academic policy | effective dates, thresholds, conditions, exceptions |
| Exception | student, requirement, authorized substitution/waiver, approver, effective date |
| Term | registration window, deadlines, credit limits |
| Degree audit | satisfied/in-progress/unsatisfied requirements and evidence |
| Plan | future terms, courses and validation state |

Requirement syntax must support ugly real-world rules such as:

> Complete 12 credits from Group A, including at least one 4000-level course, but no more than 6 credits of independent study, with a grade of C or better, and at least 6 credits completed in residence.

That is where these products become difficult.

CollegeSource's uAchieve explicitly advertises handling multiple degrees, substitutions, waivers, non-course requirements, complex GPA calculations, course reuse restrictions, residency rules, transfer articulation, financial/athletic eligibility and other complex curriculum conditions. It has been working on degree-audit logic for decades. :chatgpt-content-reference{index="4"}

**That is a warning for you:** the difficult engineering problem isn't the AI.

It's encoding the university.

---

# Course planning should be constraint solving, not language generation

Suppose the audit determines that the student still needs:

```text
CS 320
CS 330
1 software elective
1 science elective
6 general electives
```

Your planning engine can calculate:

$$
C = C_{\text{remaining requirements}}
$$

Then eliminate anything violating hard constraints:

$$
C'
=
C
-
C_{\text{prereq invalid}}
-
C_{\text{already completed}}
-
C_{\text{not offered}}
-
C_{\text{program restricted}}
-
C_{\text{duplicate}}
$$

Then construct schedules subject to:

$$
\sum_i credits_i \leq creditLimit
$$

and:

$$
time_i \cap time_j = \varnothing
$$

along with prerequisites, co-requisites, linked labs, campus travel time, section restrictions, etc.

Then deterministic optimization can prefer things such as:

- critical-path courses first;
- courses offered infrequently;
- courses unlocking the greatest number of later requirements;
- degree-applicable credits rather than unrestricted electives;
- the student's desired graduation date;
- their maximum desired credit load;
- scheduling preferences.

An LLM does not need to perform any of that.

It can merely ask:

> “Would you rather avoid mornings or avoid Fridays?”

and convert the response into structured solver constraints.

---

# Your AI becomes dramatically more useful once the engine is trusted

Then conversations become genuinely powerful.

A student could say:

> “I failed Calc II. Did I screw up my graduation date?”

The system runs the audit again and dependency graph, discovers Calc II → Physics II → CS 401 → CS 498, checks when each course is offered and returns:

> Calc II has delayed one prerequisite chain. Your existing Fall 2028 plan is no longer valid because CS 401 requires Physics II. I found two valid alternatives:
>
> Plan A keeps Spring 2029 graduation by taking Calc II this summer.
>
> Plan B avoids summer courses but moves graduation to Fall 2029.
>
> These results use your 2026 BSCS requirements and the current published course schedule.

That's where conversational AI provides massive value without becoming the source of truth.

---

# The competitive landscape

This is **not an empty market**.

And several competitors are strong.

### Degree audit and academic planning

| Company | Existing capabilities | Competitive implication |
|---|---|---|
| **Stellic** | Degree audit, multi-semester planning, what-if major exploration, transfer rules, course search, registration, advisor notes, appointments, alerts and academic pathways | Very direct competitor |
| **CollegeSource uAchieve** | Extremely mature degree-audit engine, automated planning, schedule building, complex curriculum rules, transfer articulation | Very direct rules-engine competitor |
| **Kuali Advisor** | Real-time audit and planner that explicitly shows only open, degree-applicable courses validated against prerequisites | Very close to your deterministic-planning idea |
| **Ellucian Degree Works** | Long-established degree audit, planning and transfer-articulation tooling integrated with SIS infrastructure | Major incumbent |
| **Workday / other SIS vendors** | Student records, registration, academic requirements and related student functionality | Existing system-of-record competition |

Stellic now markets a broad student-journey platform covering prospective pathways, transfer, degree audit, planning, advising and student-support workflows. It reports supporting more than **1 million students**. :chatgpt-content-reference{index="5"}

Kuali is particularly relevant because its current Advisor product says its planner surfaces **only open, degree-applicable classes**, validating against the degree audit and prerequisites. :chatgpt-content-reference{index="6"}

uAchieve's current planner automatically creates semester-by-semester pathways from the student's degree requirements and updates them as outcomes, prerequisites and curriculum change. :chatgpt-content-reference{index="7"}

So **“software that deterministically recommends correct classes” is already a product category.**

### Student-success/advising platforms

EAB's Navigate360 is formidable. EAB reports **850+ institutions and 10+ million students served**, and its current platform includes advising, degree/course planning, alerts, appointments, campaigns, holds, student support and embedded AI. Its student AI provides institution-approved answers, guidance, reminders and next steps. :chatgpt-content-reference{index="8"}

Civitas similarly combines student records, alerts, case management, communications, degree planning, scheduling, predictive analytics and AI. :chatgpt-content-reference{index="9"}

Salesforce Education Cloud now advertises AI-assisted holistic advising, student summaries, intelligent degree planning, case management and Agentforce-powered student guidance. :chatgpt-content-reference{index="10"}

### AI-first companies

This portion is getting crowded quickly.

Element451 has a literal **“Bolt Academic Advisor”** that monitors academic progress, answers advising questions, handles student support and works alongside financial-aid, career, athletics and campus-life agents. :chatgpt-content-reference{index="11"}

Element also reports serving **350+ institutions**, and received a **$175 million strategic investment** from PSG in 2024, meaning you would not be competing solely against tiny AI startups. :chatgpt-content-reference{index="12"}

Ocelot already offers institution-specific higher-ed AI chatbots tied into SIS/CRM information. :chatgpt-content-reference{index="13"}

Mainstay has spent years doing conversational AI and proactive nudging around admissions, financial aid, enrollment and persistence. :chatgpt-content-reference{index="14"}

So the broad market looks roughly like:

$$
\underbrace{\text{SIS}}_{\text{student truth}}
+
\underbrace{\text{degree audit}}_{\text{curriculum truth}}
+
\underbrace{\text{student success CRM}}_{\text{workflow}}
+
\underbrace{\text{AI agent}}_{\text{conversation}}
$$

Many established vendors are actively trying to own several of those boxes simultaneously.

---

# Where I think the actual wedge exists

I would **not** initially try to replace Degree Works, Banner, Navigate360, Stellic, Workday or an advising department.

That forces you into a massive institutional replacement sale.

Instead, build something closer to a:

## **Verified Advising Runtime**

It sits **on top of the systems the university already has**.

```text
                        Your product
                  ┌────────────────────┐
 Student ────────▶│ Conversational AI  │
                  ├────────────────────┤
 Advisor ────────▶│ Advising Workspace │
                  ├────────────────────┤
                  │ Verification Engine│
                  └─────────┬──────────┘
                            │
           ┌────────────────┼─────────────────┐
           │                │                 │
      Degree Audit         SIS          Course Schedule
    Degree Works/etc.   Banner/etc.        Registrar
           │                │                 │
           └────────────────┼─────────────────┘
                            │
                        LMS / CRM
```

Your pitch becomes:

> **Students get 24/7 advising, but the AI is never allowed to invent academic requirements. Every recommendation is validated against the institution's actual degree, policy and enrollment systems and can show exactly why it made the recommendation.**

That is a much more compelling procurement story than:

> “We have an AI advisor.”

Everyone now has an AI advisor.

---

# The really interesting differentiator: proof

I would make every consequential answer inspectable.

Student sees:

**Why am I taking MATH 221?**

> Required for your BS Computer Science degree.
>
> Satisfies: Mathematics Core → Calculus II  
> Credits: 4  
> Minimum grade: C  
> Unlocks: PHYS 211 and CS 340  
> Requirement source: 2026–27 BSCS catalog  
> Status: Required

Then:

**Why can't I take CS 440?**

> Prerequisite not yet satisfied.
>
> Requires CS 340 with C or better.  
> Your status: CS 340 planned for Spring 2027.

That sounds mundane, but it changes the trust model substantially.

Instead of:

**AI says X**

you get:

**AI explains why the academic engine says X.**

---

# A second wedge: automate the boring 70%, not the difficult 30%

The research supports this approach. Advisors are overwhelmed partly because caseloads are too large to provide proactive support. :chatgpt-content-reference{index="15"}

You don't actually want to eliminate the advisor.

You want your system handling:

“Which classes do I need?”

“Can I drop this?”

“When does registration open?”

“Why do I have this hold?”

“What does this requirement mean?”

“Can I take this elective?”

“Will this course count?”

“What happens if I change majors?”

“Can I graduate next year?”

“Build my schedule.”

“What forms do I need?”

“Where do I go for tutoring?”

“Can I study abroad next year?”

Then humans spend their time on:

**“I'm failing three classes because my mother is sick and I'm working 40 hours per week. I don't know what to do.”**

That is a much better human/AI division of labor.

---

# There is an important incumbent weakness you could exploit

A lot of the existing ecosystem is composed of separate layers.

A college might already have:

```text
Banner
+
Degree Works
+
Canvas
+
Navigate
+
Outlook
+
institution website
+
PDF catalog
+
department spreadsheets
+
advisor tribal knowledge
```

Students do not care which system owns which information.

They just want to ask:

> “What do I need to do?”

Your layer can unify those existing systems **without demanding that the university rip everything out**.

Civitas itself emphasizes that institutions frequently operate fragmented SIS/LMS/CRM ecosystems, and interoperability remains a central product problem across the market. :chatgpt-content-reference{index="16"}

Higher-ed interoperability is still evolving; 1EdTech's Edu-API specifically targets standardized exchange of higher-education course, enrollment and academic-enterprise data. :chatgpt-content-reference{index="17"}

That means integration engineering could become part of your moat.

---

# Your moat cannot just be an LLM prompt

If this becomes a company, I would want the defensibility to accumulate in four places.

**Institution Policy Compiler.** A way to convert catalogs, degree requirements and policies into testable machine rules and make changes safely.

**Verification/evaluation infrastructure.** Every curriculum change should run thousands of historical/synthetic students through the engine to detect regressions. You should eventually be able to prove something like:

```text
BSCS 2026.4

18,431 simulated student states
0 invalid prerequisite recommendations
0 non-degree applicable required recommendations
0 residency violations
0 catalog-version regressions
```

**Integration network.** Banner, Colleague, PeopleSoft, Workday, Degree Works, Canvas, Blackboard, D2L, Salesforce, etc.

**Advising edge-case corpus.** Over time you accumulate the weird cases no generic AI company understands: substitutions, multiple catalog years, repeat limits, cross-listed courses, transfer equivalencies, selective-major admission, overlapping requirements, honors variants, academic forgiveness, and thousands more.

That's harder to reproduce than “GPT with university documents.”

---

# I would not rebuild the degree-audit engine first

This is probably the most important product-scope decision.

CollegeSource has been building uAchieve's rules engine for more than 40 years. :chatgpt-content-reference{index="18"}

Trying to match that on day one is a trap.

Your first version should **consume an existing degree audit whenever possible**.

Instead of calculating:

```text
Student still needs:
- CS 410
- 6 credits software electives
- 3 credits humanities
```

have Degree Works/uAchieve/Kuali/etc. tell you that.

Then your system handles:

```text
What can the student actually take?
↓
What prerequisite paths exist?
↓
Which available sections fit?
↓
Which valid plan matches their constraints?
↓
How do we explain it?
↓
What actions must happen next?
```

Later, if enough customers lack competent degree-audit infrastructure, building your own academic-rules engine becomes strategically sensible.

---

# The MVP I would actually build

I would resist making the first version institution-wide.

Start with **one university + one college/department + a handful of programs**, or even a synthetic public-catalog proof of concept.

The MVP would contain:

| Component | MVP |
|---|---|
| Degree requirements | Import structured requirements for 5–10 programs |
| Student record | Transcript + declared program + catalog year |
| Audit | Prefer existing audit output; lightweight internal audit for prototype |
| Course catalog | Structured course/prerequisite database |
| Schedule | Current semester sections |
| Planner | Deterministically generate valid upcoming-semester options |
| AI | Natural-language interface to the tools |
| Evidence | Every academic claim shows its source/reason |
| What-if | Major change and graduation timeline |
| Schedule builder | Preferences → valid schedules |
| Escalation | Human when policy/record is ambiguous |
| Advisor console | See student's conversation, plan and unresolved issues |
| Analytics | Questions answered, escalations, advisor time saved, validation failures |

Do **not** initially allow the AI to register students.

Make V1 read-only.

Once you have proven correctness:

```text
Recommend
↓
Student approves
↓
Advisor approves if necessary
↓
Registration API
```

can follow.

---

# Your primary product metric should be correctness, not chatbot satisfaction

I would create an adversarial benchmark before selling this.

Give the system several thousand situations such as:

```text
Student changed majors twice.
Student has AP Calculus.
Student repeated MATH 201.
Student received a D first time and B second time.
Student has transfer Physics credit.
Student is under an older catalog.
Student already double-counted one elective.
Course CS 410 is only offered in spring.
Student wants to graduate in Fall 2028.
```

Ask:

> “What should they take?”

Your hard requirement should effectively be:

$$
P(\text{invalid academic recommendation}) \approx 0
$$

Not 95%.

Not “better than GPT-5.”

A bad restaurant recommendation is annoying.

A bad academic recommendation can cost someone **another semester of tuition and six months of their life**.

That reliability standard itself can become part of the brand.

---

# Compliance and procurement are significant

Once real student records are involved, this becomes an enterprise education-data system.

Under FERPA, an outside service can receive education-record information under the school-official exception only under specific conditions, including performing a function the school would otherwise perform, being under the institution's direct control regarding the records, and restricting data usage and redisclosure. :chatgpt-content-reference{index="19"}

So you'll need serious controls around:

**RBAC / least privilege, encryption, audit logs, institutional data isolation, configurable retention, deletion, subprocessors, backups, incident response, export/access requests, and absolutely no training general models on student records.**

Universities increasingly use the **HECVAT** to evaluate third-party vendors across security, privacy, accessibility and now AI. EDUCAUSE's current HECVAT 4 explicitly includes privacy and AI questions. :chatgpt-content-reference{index="20"} A recent SOC 2 Type II report is also commonly accepted as significant vendor-security evidence. :chatgpt-content-reference{index="21"}

Accessibility is another non-negotiable. Department of Education guidance says colleges and universities have digital-accessibility obligations under Section 504/Title II, while DOJ's Title II web/mobile rules use **WCAG 2.1 AA** for covered public entities, including vendor-provided experiences. :chatgpt-content-reference{index="22"}

So I would design accessible-first rather than trying to retrofit it later.

---

# Who I would target

The least attractive first customer is probably:

**Large university already heavily invested in Stellic + Navigate360.**

You'd be fighting platforms already covering most of the stack.

The more interesting initial ICP is something like:

> **A community college or regional university using Banner/Colleague/PeopleSoft + an existing degree-audit product, but with understaffed advising and a poor student-facing experience.**

Community colleges are especially interesting because advising capacity is often severely constrained. CCRC documents advisor caseloads as high as 1,200 students and notes that many students receive little proactive planning support. :chatgpt-content-reference{index="23"}

But don't assume community colleges are uncontested. EAB says it already works with **450+ community colleges**, and Element451 actively markets its AI advisor stack to the same segment. :chatgpt-content-reference{index="24"}

A better qualification question is therefore:

**“Do you already have modern student-facing planning and 24/7 verified advising?”**

rather than simply:

**“Are you a community college?”**

---

# The business case for the college

You need to sell institutional outcomes, not “AI.”

The economic argument is roughly:

$$
ROI =
\text{advisor capacity gained}
+
\text{students retained}
+
\text{unnecessary credits avoided}
+
\text{delayed graduations avoided}
-
\text{software cost}
$$

Imagine 10,000 students and 30 advisors.

If the system removes even 30% of routine interactions, the institution effectively recovers a huge amount of advisor capacity without hiring another dozen people.

And retention can be worth much more than labor savings because each retained student preserves tuition revenue.

That is the pitch.

Not:

> “Our bot talks like a counselor.”

---

# One product idea I particularly like

Have the interface maintain a constantly updated **Student Action Plan**.

Instead of a blank chatbot every time:

**Your path**

`68 / 120 credits completed`

**Spring 2027**
- CS 340
- MATH 221
- ENGL 302
- HIST 210

**Before October 14**
- Meet with financial aid about SAP warning

**Before November 3**
- Registration opens
- Advising hold must be cleared

**Graduation estimate**
- Spring 2029

**Risk**
- CS 340 is a prerequisite for four remaining courses
- Failing or postponing it may affect your graduation timeline

And the conversation modifies/explains that state.

That is much more useful than a chatbot floating in a corner of a student portal.

---

# My assessment of the opportunity

The original idea:

> **“AI college guidance counselor that tells students what classes to take.”**

is **already crowded**.

The refined idea:

> **“An autonomous student-advising layer that integrates with existing institutional systems, resolves routine advising 24/7, and uses a deterministic verification engine so AI can never invent curriculum or policy.”**

is much more interesting.

The hard parts aren't the model. They're:

$$
\boxed{
\text{integrations}
+
\text{academic rule correctness}
+
\text{institution-specific configuration}
+
\text{provenance}
+
\text{enterprise trust}
}
$$

And that is actually encouraging, because those create barriers to entry.

I think this is worth prototyping **provided you explicitly don't try to beat Stellic/uAchieve at degree audit on day one**. Build the intelligent verified layer around existing academic truth first. If the prototype can demonstrate that it correctly handles hundreds of nasty advising edge cases while giving students a dramatically better experience, then you have something much more substantial than another education chatbot.

A particularly strong next step would be to take this concept and turn it into an actual **V1 product specification**: database/domain model, deterministic rules architecture, agent/tool boundaries, student UI, advisor UI, integrations, escalation logic, and exactly what we'd build in phases 1/2/3. That would expose pretty quickly whether this can be a focused startup or whether the implementation surface becomes too large.
