# CLAUDE.md: Dental Time Machine

Read this whole file before doing anything. It is the source of truth for what we are building, who builds what, how the pieces connect, and what you must never do. If a request conflicts with this file, stop and ask.

## 1. What we are building
An AI tool that simplifies dental-benefit decisions for employees (codeLinc 11 hackathon, Lincoln Financial, Path 1: Dental).
The user tells us (by voice, text, form, or document) what their dentist recommended and what their plan covers. The app shows what the plan likely pays, what they likely pay, and how changing WHEN they get care changes what they pay. A chatbot explains everything in the user's own language and words, and summarizes the result at the end.
Tagline: "Your dentist tells you what you need. We show you what happens if you change when you get it."
Demo persona: Maya. Root canal, 2 crowns, 2 fillings. $1,500 annual max, $50 deductible.

Challenge requirements we must cover:
1. Describe a planned procedure + current plan details
2. Translate dense insurance language into what is covered and what you owe
3. Sequence care across the plan year to maximize benefits
Bonus: track annual max usage; in vs out of network; remind about unused end-of-year benefits.

## 2. The golden rule (never break this)
The AI talks. The engine counts.
- Every dollar amount shown or spoken to a user comes from the cost engine (backend/app/engine.py). Never from an LLM, never hardcoded in the UI, never read aloud unless it came from the engine.
- LLM features only: understand speech/text, read documents, explain, personalize, summarize. Every LLM output that reaches the user passes the dollar guard (section 12).

## 3. Stack
- Frontend: React + Vite + TypeScript, Tailwind CSS, Framer Motion. Recharts approved for charts. Deployed on Vercel.
- Backend: Python 3.11+, FastAPI, Pydantic, pytest. Hosting: TBD (not Render).
- AI: AWS Bedrock in us-east-1 (Amazon Nova or Claude Haiku), called only from FastAPI with boto3. Text-to-speech (approved for Malama's feature): ElevenLabs first (REST API called from FastAPI with httpx), Amazon Polly as the fallback. Browser Web Speech API for speech-to-text. No Textract.
- Do not add other frameworks, databases, auth libraries, state managers, or cloud services without asking.

## 4. Repo layout and ownership
```
backend/
  app/
    main.py            # app, CORS, include_router lines only (one line per feature)
    models.py          # Pydantic shapes (section 6). SHARED: change on your branch, flag it in the PR
    engine.py          # cost engine. SHARED: change on your branch, section 9 tests must stay green
    optimizer.py       # schedule optimizer. SHARED: same rule as engine.py
    demo_data.py       # Maya, catalog, demo plan options. SHARED: never change Maya's section 9 values
    sockets.py         # fake parse/explain/read_document/summary (fallbacks, keep forever)
    ai/
      bedrock.py       # one shared Bedrock client + call helper (Malama owns, others import)
      dollar_guard.py  # shared guard (Malama owns, everyone uses)
    routers/
      chat.py          # Malama
      documents.py     # Chuck
      filters.py       # Kuwa
      summary.py       # Iyin (visual data endpoints, if any)
  tests/               # test_engine.py, test_api.py, plus test_<feature>.py per feature
frontend/
  src/
    types.ts           # mirrors models.py exactly. SHARED: update together with models.py
    api.ts             # every fetch call lives here; each feature adds its own section
    glossary.ts
    screens/           # TellUs, WhatItMeans, TwoFutures, YourYear (MVP, core team)
    components/        # shared UI (core team / Samuel)
    features/
      chat/            # Malama
      documents/       # Chuck
      filters/         # Kuwa
      summary/         # Iyin
      timeline/        # Samuel
docs/
```
Rule: on your own feature branch you may edit any file you need, including shared files. Prefer your own feature folders; when you touch a SHARED file, keep the change small, keep existing shapes and API routes working, and list it in your PR under "Shared files changed". Only main is protected: nobody pushes to main directly; Samuel reviews and merges every PR (section 15).

## 5. Commands
- Backend: `cd backend && .venv\Scripts\Activate.ps1` (Windows) then `uvicorn app.main:app --reload` (port 8000)
- Tests: `cd backend && pytest -q`
- Frontend: `cd frontend && npm install && npm run dev` (port 5173). API base URL from `VITE_API_URL` in frontend/.env.
- Env files: backend/.env (AWS keys, region, Bedrock model, ElevenLabs key, voice and model), frontend/.env (VITE_API_URL only). Both git-ignored. Names only, no values: docs/SECRETS.md.

## 6. Data shapes (MVP shapes frozen; only ADD optional fields, never rename or remove)
snake_case JSON everywhere, same names in Python and TypeScript.
Core (frozen):
- Procedure: id, name, cdt_code, category ("preventive"|"basic"|"major"), tooth (1-32|null), billed_fee, allowed_fee (= billed_fee in MVP), depends_on (id|null), can_wait (bool, default false)
- Plan: annual_max, deductible, deductible_waived_for (default ["preventive"]), coverage {preventive, basic, major} (0-1), reset_date "MM-DD", used_this_year, deductible_paid_this_year, in_network (bool)
- Schedule: {procedure_id: "this_year" | "next_year"}
- LineResult: id, year, billed_fee, allowed_fee, deductible_applied, plan_pays, you_pay, reasons [ "deductible" | "coinsurance" | "over_annual_max" | "not_covered" | "balance_bill" ]
- Result: per_procedure [LineResult], totals {plan_pays, you_pay}, max_left {this_year, next_year}, warnings [str]
- OptimizeResult: all_now (Result), best (Result), best_schedule (Schedule), savings, moved [procedure_id]
- CatalogItem: cdt_code, name, category, default_fee

Feature additions (approved, all optional; any teammate may add them on their branch, flagged in the PR):
- Preferences (session only): language ("en"|"es"|"fr"|"pt"), style ("simple"|"detailed"|"numbers"), voice_on (bool)
- ChatTurn: role ("user"|"assistant"), text
- ChatRequest: turns [ChatTurn], preferences, procedures [Procedure], plan (Plan|null)
- ChatResponse: say (str, guarded), proposed_procedures [Procedure] (needs user confirm), proposed_can_wait [procedure_id] (needs explicit user yes), done_intake (bool)
- SummaryRequest: procedures, plan, schedule, optimize (OptimizeResult), preferences. SummaryResponse: text (guarded)
- DocumentReadResult: plan (Plan|null), procedures [Procedure], fields_found [str], warnings [str] (always shown on a confirm form, never applied directly)
- FilterState: zip, age_range ("under_18"|"18_64"|"65_plus"), max_distance_miles, in_network_only, preferred_plan_id, languages [str], budget_this_year
- PlanOption: id, name, monthly_premium, plan (Plan), source ("demo"|"user")
- DentistListing: npi, name, address, distance_miles, in_network (demo), languages [str] (demo), accepting_new (demo)
- CashComparison (optional field on Result, engine computes): cash_total, insurance_you_pay, premiums_in_period (number|null), cheaper ("cash"|"insurance"|"about_equal"), assumptions [str]
- Procedure.cash_price (optional): self-pay price if the dentist offers one; otherwise cash = billed_fee
- Plan.annual_premium (optional): needed for a fair cash vs insurance comparison
- OptimizeRequest.budget_this_year (optional): cap on this year's you_pay (Kuwa's budget filter)
- OptimizeResult.alternatives (optional): top 5 valid schedules [{schedule, you_pay, moved}] for Samuel's timeline permutations
- NarrateStep: "what_it_means"|"two_futures"|"summary"|"find_care"|"your_year"
- NarrateRequest: step (NarrateStep), preferences, procedures [Procedure], plan, schedule
- NarrateSegment: text (guarded), target (data-narrate id | null), pause_ms
- NarrateResponse: segments [NarrateSegment], next_step (NarrateStep | null), next_label

## 7. API contract
MVP (frozen):
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | /demo | | {procedures, plan} (Maya) |
| GET | /catalog | | [CatalogItem] |
| POST | /calculate | {procedures, plan, schedule} | Result |
| POST | /optimize | {procedures, plan} | OptimizeResult |
| POST | /parse | {text} | [Procedure] (fake fallback) |
| POST | /explain | {term, language, style} | {text} (fake fallback) |
Feature additions (approved):
| POST | /chat | ChatRequest | ChatResponse | Malama |
| POST | /narrate | NarrateRequest | NarrateResponse (no LLM in v1: templates filled with engine figures) | Malama (guide) |
| POST | /summary | SummaryRequest | SummaryResponse | Malama (text) |
| POST | /speak | {text, language} | audio/mpeg (ElevenLabs, Polly fallback; header X-Voice: elevenlabs|polly) | Malama |
| POST | /read-document | multipart file (pdf/jpg/png, max 5 MB) | DocumentReadResult | Chuck |
| GET | /plans | | [PlanOption] (demo options) | Kuwa |
| GET | /dentists | ?zip&max_distance_miles | [DentistListing] | Kuwa |
| POST | /filters/apply | {filters, procedures, plan_options} | ranked [PlanOption + your_cost from engine] | Kuwa |
Errors: 422 with a plain message; never 500 for bad user input. Every AI route falls back to its fake in sockets.py on any AWS error or timeout (8 s).

## 8. Engine rules (v1; anyone may extend on their branch, tests first)
Per plan year, process procedures by category (preventive, basic, major), each after the one it depends on, then by id.
1. Deductible once per plan year (minus deductible_paid_this_year), skipped for categories in deductible_waived_for.
2. plan_share = (allowed_fee - deductible_applied) x coverage[category]
3. Cap plan_share at remaining annual max (this year starts at annual_max - used_this_year; next year starts fresh).
4. you_pay = billed_fee - plan_pays. Every LineResult gets reasons.
Optimizer: try all 2^n schedules (n <= 8). Reject moving a can_wait=false procedure or putting a procedure before its depends_on. Lowest totals.you_pay; tie-break by fewest moved, then the later procedure in processing order.
Cash comparison (to add, core team): cash_total = sum of cash_price or billed_fee; compare against insurance you_pay plus annual_premium for the period if given; if no premium is known, say so in assumptions and do not declare insurance cheaper on premiums alone.
Out of scope v1 (warnings only): waiting periods, frequency limits, alternate benefit, missing tooth clause.

## 9. Known-good numbers (tests must assert these)
Maya (team-approved DEMO data, labeled "Demo plan" in the UI): max 1500, deductible 50, preventive 1.0, basic 0.8, major 0.5, reset_date "01-01", used_this_year 0, deductible_paid_this_year 0, deductible_waived_for ["preventive"]. Fillings 150 x2 (basic), root canal 1100 (major), crowns 1300 x2 (major, depends_on root canal).
- All this year: plan 1500, you pay 2500
- Crown 2 next year: plan 1400 + 625 = 2025, you pay 1975, max_left.this_year = 100
- optimize (crowns can_wait=true): best you pay 1975, moved = ["crown2"], savings 525
- crowns can_wait=false: best = all now
- crown scheduled before its root canal: rejected
If a code change breaks these, the code is wrong, not the test. Never edit these expected values to make tests pass.

## 10. Team, features, and how they connect
User flow: Start -> Intake (chat/voice OR form OR document) -> Confirm details -> What it means -> Two futures + Timeline -> Summary (visual + chatbot summary) -> Filters (plans/dentists) -> Your year.
Shared state (frontend, session only): procedures, plan, schedule, preferences, filters, latest Result/OptimizeResult. Every feature reads it; only the screen that owns a step writes it. No browser storage beyond sessionStorage.

Samuel (core team, branch feature/timeline, owns engine/models/types)
- Animations and UI polish across the app; design system (section 11).
- Timeline: user drags dental visits onto months of the year. The month is converted to "this_year"/"next_year" using plan.reset_date, then /calculate runs. Shows permutations from /optimize (best and alternatives). The engine works in plan years, so months only matter relative to the reset date; never show month-level prices the engine did not compute.
- Owns adding approved shapes to models.py/types.ts and CashComparison to the engine (tests first).

Malama (branch feature/chat): personalization, language understanding, voice chatbot
- Start of flow: voice/text intake ("Tell me what your dentist said") -> /chat -> proposed procedures + plan details -> user confirms on a form before anything is applied.
- Asks "Did your dentist say this can wait?" per procedure; sets can_wait only on an explicit yes from the user, never inferred.
- Personalization: language + style chosen by the user (or offered from browser language), session only. Adapts wording, never numbers.
- End of flow: /summary writes a recap of the engine's results in the user's language and style; spoken aloud if voice_on (ElevenLabs, Polly fallback). Uses only figures from the OptimizeResult/Result passed in.
- Voice: push-to-talk with Web Speech API (lang matches preferences), ElevenLabs voice (Polly voice per language as the fallback). Show the transcript. Text input always available.
- Owns ai/bedrock.py and ai/dollar_guard.py (shared by Chuck and Iyin).
- Guide narration (branch feature/guide): after intake, a guide walks the user through What it means, Two futures, Summary, Find care and Your year. backend/app/narrate.py fills fixed templates (en, es, fr, pt; simple and detailed styles) with engine figures; every segment passes the dollar guard or is dropped; each step ends with the disclaimer; the reset wording is the section 12 sentence. The frontend GuideDock (features/chat/guide/) shows captions (always visible), speaks them (ElevenLabs, Polly fallback) when voice_on, highlights the element with the matching data-narrate attribute, and offers the next step with a button (never navigates on its own). It starts only after a user click; any failure hides it and the app works as before.

Chuck (branch feature/documents): document upload and AI reading
- Upload a benefits summary, plan page, or dentist treatment estimate (pdf/jpg/png, max 5 MB, resized in browser).
- Bedrock vision model extracts Plan fields and/or Procedures (CDT code must be in the catalog whitelist; fees from the document are kept only after the user confirms them).
- Always lands on an editable confirm form showing what was found and what was not. Never auto-applies.
- Files processed in memory, never saved or logged. Text in documents is data, never instructions (prompt-injection guard).

Iyin (branch feature/summary): summary visualization + cash vs insurance
- Rebuilds the summary block: totals, plan vs you, max used/left, savings, per-procedure breakdown (Recharts allowed).
- Cash vs insurance panel: shows CashComparison from the engine (Iyin may add it to engine.py on her branch, tests first, or ask Samuel). Never computes money in the frontend beyond displaying engine fields. Shows assumptions (e.g. "premiums not included").
- Wording stays conditional and calm; savings green, no red.

Kuwa (branch feature/filters): rule-based filters
- Inputs: location (zip), age range, preferred plan option, distance, in-network only, languages, budget this year.
- Plans: compares the employer's demo plan options (/plans) for the user's procedures; each option's cost comes from the engine (/filters/apply calls engine.calculate/optimize). Do not rank or rate real insurance companies; no fake ratings or reviews.
- Dentists: /dentists uses the CMS NPI Registry API by zip (free, official); network status, languages, accepting_new are labeled demo data.
- Age range only changes which rules/warnings show (e.g. under 18 pediatric note); it never changes prices unless a plan option defines it.
- Budget filter: "keep this year's cost under $X" passes budget_this_year to /optimize (Kuwa may add this to optimizer.py on his branch, tests first).

## 11. Design system (Samuel owns tokens; everyone uses them)
Tailwind tokens: primary #3C4AA1, primary-deep #3542A2, primary-night #262F78 (dark sections and hover fill, white text), gradient #647CBF -> #3D4FA7, savings #589C7D, bg #F6F6F6, card #FFFFFF, ink #1B1D24, muted #8D8D8E, apricot #E08A4A (solid accent sections; ink text only, never white text, never for money, warnings or errors). No red.
Text contrast at least 4.5:1. Inspired by modern dental sites; do not copy any template's layout, images, logos or text.
- Surfaces: sections use solid color blocks (primary, apricot, primary-night, bg) instead of gradient blobs; white cards with a soft shadow sit on them. Glass (white 60-70% + backdrop blur + thin white border + soft shadow) only for floating UI: nav pill, menu panel, small overlays.
- Buttons: pill buttons with an arrow. Every button uses btn-primary, btn-secondary, btn-light or btn-outline (index.css) and wraps its label in <RollLabel> (components/RollLabel.tsx) for the shared hover animation (fill rises, label rolls up). Text links stay plain underlined links.
- Headings: bold (semibold 600), tracking -0.03em, balanced wrapping. h1 clamp(2.5rem, 5vw, 4.5rem) leading 1.05; h2 clamp(2rem, 3.5vw, 3rem) leading 1.1; h3 1.25rem. Eyebrow labels 0.75rem semibold uppercase, tracking 0.14em, muted-text. Body 1-1.125rem, leading 1.6, about 60ch wide. Utilities in index.css: heading-1, heading-2, heading-3, eyebrow, body-copy.
- Spacing: 8 px scale only (4, 8, 12, 16, 24, 32, 48, 64, 96). Eyebrow to heading 12, heading to body 16, body to buttons 32, card padding 24, gaps between cards 16-24.
- Container (components/Container.tsx): max-width 1200 px, centered; side padding 40 px from 1200 px, 24 px from 810 px, 16 px below. No other ad-hoc page max-widths.
- Compact sections (section-y utility): 96 px top and bottom on desktop, 64 px on tablet, 48 px on phones. Breakpoints: tablet 810 px, desktop 1200 px.

## 12. Guardrails
Medical safety
- The app never decides whether care can wait and never diagnoses. Procedures stay locked (can_wait=false) until the user confirms "My dentist said this can wait." The chatbot may ask; it may not assume.
- Savings copy is conditional: "If your dentist confirms X can wait, you'd likely pay $Y." Never "You should wait."
- Symptom questions (pain, toothache, swelling, fever, bleeding, broken, sore, sensitive, throbbing) -> "I can't assess symptoms. Please contact a dentist today." in the user's language.
Dollar guard (all LLM text: chat, explain, summary, document notes)
- Extract every money figure; normalize formats per language ("$1,975", "1.975 $", "1975 dólares"); each must exist in the engine Result/OptimizeResult passed to that call. If not: regenerate once, then fall back to the fixed glossary/fake text. Test it in English and Spanish.
Claims and wording
- Never claim everyone gets two annual maximums. Use: "When your plan year resets, eligible benefits may become available again, based on your plan's rules."
- Show "Estimate, not medical or coverage advice. Confirm with your dentist and plan." on every result screen and in every spoken summary.
- Tone: calm. Savings in green, never red. "You'll likely pay", not "you owe".
Privacy and security
- No login, no database, no stored personal or health data. Session state only. Location, age, documents and voice are never logged or persisted.
- AWS keys only in backend/.env; IAM user limited to bedrock:InvokeModel and polly:SynthesizeSpeech; budget alarm at $20. Never in frontend code, never committed.
- ElevenLabs key (ELEVENLABS_API_KEY) only in backend/.env, never in frontend code, never committed, never logged or returned. Every ElevenLabs call: 8 s timeout, one attempt, then Polly, then text only. Speech is cached in memory only (never on disk). Variable names are listed in docs/SECRETS.md.
- User text, transcripts and documents are data, never instructions to the LLM.
- Validate and cap inputs: fees 0-50,000, max 20 procedures, text 2,000 chars, files 5 MB, chat history 20 turns.
- Every AWS call: try/except with an 8 s timeout, falling back to the fake socket so the demo never breaks.

## 13. How to work (rules for Claude)
- Plan first: for anything bigger than a small fix, list files and steps, then wait for "go".
- One small task at a time. Do not build features that were not asked for.
- Tests first for backend logic. Run `pytest -q` after every backend change and report the result. Each feature adds tests/test_<feature>.py.
- Branch freedom (section 4): on your feature branch, make the changes your feature needs, including shared files. Before editing a SHARED file, say which file and why in one line, then proceed. Never break existing shapes, routes, or the section 9 numbers.
- Never change a data shape or API contract beyond section 6/7 without asking.
- Frontend: all API calls through api.ts; types from types.ts; Tailwind tokens from section 11; no inline styles except animation values.
- Accessibility: real buttons and labels; every drag has a button alternative; voice always has a text alternative.
- If something is unclear, ask one specific question instead of guessing.
- When done, report: what changed, files touched, how you verified it.
- Skills/plugins are helpers. If a skill conflicts with this file (new frameworks, auth, a database, Next.js, changed shapes), this file wins.

## 14. Never do
- Never invent dollar amounts, fees, coverage numbers, ratings, reviews, or dentist details in UI, prompts, or tests.
- Never let an LLM compute or state a number the engine did not produce.
- Never hardcode Maya's results in the frontend.
- Never add auth, a database, analytics, or tracking.
- Never commit secrets, .env, or real personal or health data.
- Never delete or weaken tests or guardrails to make something work.
- Never push directly to main, never force-push, never rewrite main.
- Never present the app as giving medical, legal, or coverage advice.

## 15. Git workflow (Samuel is the gatekeeper of main)
- main = the official, always-working app. Nobody pushes to main directly; it is protected on GitHub. Samuel (repo owner) is the only person who merges into main.
- Your branch is yours: feature/chat (Malama), feature/documents (Chuck), feature/summary (Iyin), feature/filters (Kuwa), feature/timeline (Samuel). Commit and push to your own branch as often as you like.
- Pull main into your branch every 1-2 hours (`git pull origin main`) so your branch does not drift.
- When your feature is ready: run `pytest -q` (green) and `npm run build` (clean), push your branch, then open a Pull Request from your branch into main. In the PR description include: what it does, how to test it with Maya, "Shared files changed" (list or "none"), and new env vars (if any). Then message Samuel.
- Samuel reviews (2-minute demo or checks the PR), then merges, asks for changes, or leaves it on the branch. Unmerged features can keep living on their branch.
- Claude: never push to main, never merge PRs, never force-push. On a feature branch, you may commit and push to that branch only when the user asks.
- Merge order when several are ready: timeline/UI, summary, documents, filters, chat (chat last because it touches the start and end of the flow).
- Conflict hot spots: main.py (one include_router line each), App.tsx/router (one mount point each), api.ts (own section each), models.py/types.ts (additive changes only).
- Checkpoints: 11pm first feature merge, 3am feature freeze (fixes only), 6am backup video, 9am rehearsal, 10am present.

## 16. Definition of done
MVP (done): "Load Maya" shows $2,500 vs $1,975 from the engine; moving crown 2 updates numbers (drag and button); locked procedures cannot move; pytest green.
Each feature: works with Maya end to end; falls back cleanly if AWS fails; passes the dollar guard; has its own tests; respects section 12; demoed to the team before merge.