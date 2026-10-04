# Codelinc Hackathon Playbook (codeLinc 11, Oct 3-4 2026, Greensboro NC)

## DECISION (Oct 3, afternoon): team is going full on PATH 1 DENTAL, "Dental Time Machine" (see claude/ideation-IDN-002-dental-time-machine.md). Life insurance ideas (Beacon, "Who leans on you?") are parked as backup.

## STACK UPDATE (Oct 3): switched to a WEB APP (replaces Expo/mobile notes below)
- Frontend: React + Vite + TypeScript, Tailwind, Framer Motion (animation), Recharts or D3/visx for the morphing timeline. Deploy on Vercel.
- Voice: browser Web Speech API (SpeechRecognition + speechSynthesis), demo in Chrome; always keep a text box + suggestion chips as fallback.
- Backend unchanged: Python FastAPI, host TBD (enable CORS for the Vercel domain), LLM via Bedrock or backup key.
- Claude Design exports web HTML/React, so handoff to Claude Code is direct (no React Native conversion).
- Concept being explored: setup screens -> "assistant room" with talking AI orb + live morphing coverage timeline; AI returns {say, update} so voice and graph stay in sync.

## The event (from opening presentation)
- Host: Lincoln Financial. Sponsors: AWS, Cognizant, IBM, LTIMindtree, Accenture, Deloitte.
- Timeline: coding starts Sat 1:30pm -> student presentations Sun 10am-12pm (~20 hrs). Prizes ~12:45pm Sun.
- Rules: you can leave anytime but NO re-entry once you leave. Watch the clock, take breaks, ask coaches (Discord: tinyurl.com/codelinc11discord). One person registers the team: tinyurl.com/codelinc11team.

## The challenge
- Path 1 (Dental): AI tool where an employee describes a planned procedure + plan details; translate insurance language into what's covered / what they owe; sequence care across the plan year. Bonus: track annual max, in vs out-of-network, remind of unused benefits. Refs: tinyurl.com/codelinc11dental, FAIR Health dental cost estimator.
- Path 2 (Life Insurance) — TEAM PICK: "Build a Conversational AI Tool to Right-Size Life Insurance Coverage"
  1. Conversational AI walks user through situation: dependents, income, debts, existing coverage
  2. Personalized needs assessment with clear explanation of reasoning
  3. Communicate the math clearly without triggering anxiety or confusion
  - Stretch: explain term vs whole life; surface tradeoffs specific to the user's scenario
- Lincoln's listed inputs that shape need (slide 17): dependents on income, income to replace, mortgage/other debts, education/future family expenses, existing employer or personal coverage, amount the customer can comfortably afford.
- Term = defined period, straightforward protection. Permanent = stays in place longer, may include extra features.
- CANDIDATE (not final; team is brainstorming and pitching ideas to each other): Path 2, "Coverage you lose" + Life Timeline (see claude/ideation-IDN-001-synthesis.md). Demo persona: Peter (Lincoln's "Protector": married, 3 kids, ~20 yrs to retirement).

## Core idea
- Golden rule: AI chats and explains; Python calculates (deterministic, testable numbers).
- Formula: debts + (income x years to replace) + future goals (education etc.) - existing coverage - savings = coverage gap. Then an affordability step -> suggest term vs permanent with tradeoffs.
- One-sentence pitch test: "Chat for 2 minutes, see why you need $X, no scary sales pitch."

## AI provider options
- AWS Bedrock (sponsor): each team makes its own AWS account (Free plan, $100 credits, up to $200). No event credits. Set a $0 budget alert. Python works with Strands / AgentCore (Python 3.10+).
- Or Claude/other LLM API key if a teammate has one. Keep the LLM behind one backend function so it's swappable.
- Kiro (AWS IDE, free for students at kiro.dev/students) and IBM Bob trial are offered; we use Claude Code, but keep a SPEC.md/README updated: "specs double as judging documentation".

## Working agreement
1. Agree the API contract (endpoints + JSON shapes) first, so frontend and backend build in parallel. Frontend uses mock JSON until the backend is live.
2. Design system before screens: tokens in one file. Every screen uses only tokens.
3. Iteration loop: reference screenshot -> prompt -> run in Expo -> screenshot result -> targeted fix prompt. One screen at a time.
4. Keep a CLAUDE.md in the repo with stack, folder structure, tokens, and "do/don't" rules.

## Frontend scope (Samuel)
- Screens: Welcome/intro -> Chat (conversational intake) -> Results (big coverage number + breakdown + "why" explanation) -> Term vs Permanent explainer (stretch).
- Calm tone: soft colors, no red alarm states, show breakdown as building blocks, plain language.
- Palette idea: warm, calm, inspired by Lincoln's maroon/orange/cream (don't use their logo).

## Hosting / deployment
- Backend hosting: host TBD (team decision Oct 3).
  - Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- EXPO_PUBLIC_API_URL env var for local <-> deployed backend.

## Previewing / showcasing
- Building: `npx expo start --tunnel` on event Wi-Fi + Expo Go.
- On stage: real phone mirrored (iPhone+Mac: QuickTime; Android: scrcpy). Fallback: simulator or web.
- Judges: web build (`npx expo export --platform web`) on Vercel/Netlify static.
- Android APK via `eas build --profile preview`. TestFlight not worth it here.
- Record a 60-90s backup demo video before Sun 10am.

## Design -> code flow
- Claude Design: screenshots -> design system -> screens -> iterate. Export -> Send to Claude Code.
- Claude Design outputs web; Claude Code must rebuild in Expo React Native + NativeWind with tokens, no HTML elements.

## "Premium feel" checklist
- Press scale ~0.97 (reanimated), haptics, spring animations, skeleton loaders, big animated numbers, 8pt grid, max 2 fonts, subtle blur/gradients, designed empty/success states.

## Useful libraries
NativeWind, react-native-reanimated, expo-linear-gradient, expo-blur, lucide-react-native, react-native-gifted-charts, expo-haptics

## Reference links (slides 14 & 19), checked Oct 3
- Slide 14 dental site (tinyurl.com/codelinc11dental -> ohl.go2dental.com/oral-health?cli=lincoln): Lincoln-branded oral health library. Risk-assessment quiz, dental videos, glossary, emergencies, care by life stage, oral/medical conditions, "planning a visit" (exams, cleanings, X-rays, 14 procedures incl. implants, root canals, ortho), Ask a dentist, dentist locator, benefit basics. NO plan prices or coverage %.
- Slide 14 enrollment video (tinyurl.com/codelinc11dentalvideo -> contentshare.gp.lincolnfinancial.com): JS viewer, showed "temporarily unavailable" when checked.
- Slide 14 FAIR Health (fairhealthconsumer.org/dental/category): free consumer cost lookup by procedure code/keyword, 13 categories (diagnostic/X-rays, preventive, fillings/root canal/extraction, crowns, surgery/perio, prosthetics...). Prices appear per procedure (likely needs zip). Only real cost data source on the slides.
- Slide 19 links all go to lincolnfinancial.com (JS-rendered):
  - What are your goals?: 4 personas. The Protector = Peter, married, 3 kids, retiring in ~20 yrs; questions: "Could my family pay household expenses if something happened to me?", "Could our family's future plans still happen (college)?", "Will taxes minimize the legacy?", "Can we sustain our lifestyle after retirement?". The Planners = Dave & Joan near retirement, legacy/survivor. The Professional = Henry, maxed retirement accounts, tax-advantaged growth. Business Owner = Andrea retaining key employee Kyle (executive bonus, SERP, split-dollar).
  - Calculators and tools: tabs Financial wellness / Insurance / IRS-qualified / Retirement. Insurance tab: Life insurance calculator ("How long will my current life insurance proceeds last?"), Life insurance needs calculator ("How much life insurance do I need?"), Disability risk, Disability insurance, Long-term care. Calculators open as CalcXML popups (white-label), not inspectable by Claude.
  - Permanent life page: UL, IUL, VUL with comparison chart; "customizable and flexible". Products on life page: Term, IUL, UL, VUL, permanent.
  - Brand tone: "take charge of their financial lives with confidence and optimism". Disclaimers: no tax/legal advice; coverage can lapse if premiums unpaid.
- Takeaway: use Lincoln's own persona "Peter" (married, 3 kids, ~20 yrs to retirement) as the demo persona, and his questions as chat prompts. No dataset is provided for Path 2; formula inputs come from the user.

## Official judging criteria (codelinc11.devpost.com)
1. UI & intuitiveness (cohesive, easy for target user)
2. Functional requirements & impact (addresses challenge, real problem)
3. Solution design & innovation
4. Demonstration & presentation (clear, positive, demo shows functionality)
5. Does it work? Would Lincoln use it? (core functionality >> login etc.)
6. Technology platforms (novel platforms / libraries / open-source / APIs)
7. Security accommodations (no need to build login; describe security via public mechanisms)
8. Technical creativity (novel approach)
9. Architecture & methodology (show architecture; storyboarding / roadmapping)
10. Complexity (not more complex than needed, but not glossing over)
- Idea candidates (Oct 3): "Who leans on you?" hidden-dependents constellation (recommended), "A paycheck, not a lump sum", "Ask the person who'd live it" (two-partner mode); Beacon voice co-pilot + "coverage you lose" as supporting features.
- Lincoln dental page (professionals/employeebenefitsoverview/dentalinsurance), checked Oct 3: broker-facing marketing, no plan tables or state-by-state options. Useful: "Dental is the most common employee benefit after health insurance"; stats: >40% have periodontal disease by 35; 234M productivity hours lost yearly to emergency dental care; >$45B lost US productivity yearly. Network name: Lincoln DentalConnect (leased networks). Only state note: "Product availability and/or features may vary by state"; NY policies issued by Lincoln Life & Annuity Co. of NY. White papers (visit.lfg.com/DTL-DENWP-WPR001/002, brochure DTL-DTLBR-BRC001, DTL-DENPM-FLI001) blocked to Claude (403); open manually. "Not all dental plans are created equal" paper = plan design matters, supports the benefits SELECTION angle.
