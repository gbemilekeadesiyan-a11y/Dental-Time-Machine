# 🦷 Dental Time Machine

> **Your dentist tells you what you need. We show you what happens if you change *when* you get it.**

Dental Time Machine is a free web app that turns a confusing dental treatment plan into plain answers:
**what your insurance will likely pay, what you will likely pay, and how changing the timing of your care could lower your bill.**

You can talk to it, type to it, or just snap a photo of your paperwork. It does the math, explains every insurance word in everyday language, and even reminds you before your benefits reset.

*Built in 20 hours for **codeLinc 11** (Lincoln Financial), Path 1: Dental.*

---

## 😟 The problem

**Problem statement:** *Employees with dental benefits get a treatment plan from their dentist and have to say yes on the spot, without knowing what they will pay, what their plan's words mean, or that changing **when** they get care could cost less. The math lives in dense plan documents, and nobody does it for them.*

Picture it. Your dentist says:

> *"You need a root canal, two crowns and two fillings."*

Right then, three questions hit at once:

1. **"What will I actually pay?"** The answer depends on how the deductible, the coverage percentages and the yearly maximum stack up. Very few people can work that out.
2. **"What does any of this mean?"** Benefits summaries are written in insurance language: deductible, coinsurance, annual maximum, plan year.
3. **"Is there a cheaper way?"** Most dental plans cap what they pay each plan year. A big treatment plan goes past that cap, and you pay everything above it.

<p align="center"><img src="docs/readme/01-the-problem.png" alt="Hand-drawn sketch: a small black creature tips a stack of dental bills (root canal, crowns, fillings) into a cup labeled yearly max $1,500. The cup overflows and the overflow is labeled everything over the cap comes out of your pocket." width="760"></p>

**What happens today:** people agree to everything at once and get a surprise bill, put off care because they fear the cost, or let benefits go unused before the plan year resets.

**Who it's for:** employees choosing and using their dental benefits, starting with the moment their dentist recommends treatment.

**What the challenge asked, and where we answer it:**

| codeLinc 11, Path 1: Dental asks... | Dental Time Machine answers with... |
|---|---|
| Describe a planned procedure and current plan details | Talk, type, upload a document, or fill a form (step 1) |
| Translate dense insurance language into what is covered and what you owe | One clear line per procedure plus tappable term explanations (step 2) |
| Sequence care across the plan year to maximize benefits | The timing optimizer and the "two futures" timeline (step 3) |
| Bonus: track the annual max, network, unused benefits | Max ring, plan comparison, dentist finder, reset reminder (steps 4 to 6) |

## 💡 The big idea: timing matters

Most dental plans have a **yearly limit** (an "annual maximum"), the most the plan will pay in one plan year. Once you hit it, you pay everything else yourself.

When your plan year resets, eligible benefits may become available again, based on your plan's rules. So **if your dentist confirms that some of your care can safely wait**, splitting it across two plan years can mean your plan pays more and you pay less.

That's the "time machine": the same care with smarter timing.

<p align="center"><img src="docs/readme/02-the-time-machine.png" alt="Hand-drawn sketch: two cups labeled this plan year and next plan year, separated by a dashed line labeled plan year resets. A small black creature carries crown 2 across the line. Notes read $2,500 to $1,975, about $525 less, and only if your dentist says it can wait." width="760"></p>

### Meet Maya (our demo patient)

Maya needs a root canal, two crowns and two fillings. Her plan has a **$1,500** yearly limit and a **$50** deductible.

| | Maya likely pays |
|---|---|
| Everything this plan year | **$2,500** |
| Crown 2 after her plan resets (if her dentist confirms it can wait) | **$1,975** |
| **Difference** | **$525 saved** 💚 |

Same treatment, same dentist, just a different date on the calendar. Dental Time Machine finds this for you automatically.

---

## 🧭 How it simplifies the journey, step by step

The app walks you through six short steps. A step bar at the top always shows where you are, and the **Back** and **Next** buttons stay on screen so you never have to scroll to find them.

### 1. 🗣️ Tell us, your way
*No forms to decode. Use whatever's easiest for you.*

- **Talk to it.** Press the microphone and say what your dentist told you, like *"I need a root canal and two crowns."* The assistant understands and fills things in for you.
- **Type to it,** like texting a friend.
- **Upload your paperwork.** Take a photo of your benefits summary or the dentist's treatment estimate. A scanning beam sweeps over the page, then the important insurance terms **pop out as cards**. Tap any card for a plain-language explanation.
- **Or fill in a simple form** if you prefer.

**You stay in control:** nothing is added until you confirm it. The assistant also asks, *"Did your dentist say this can wait?"* It never decides that for you.

Works in **English, Spanish, French and Portuguese**, and you can pick how you like things explained: **simple**, **detailed**, or **just the numbers**.

### 2. 📖 What it means
*Insurance language, translated.*

Every procedure becomes **one clear line: what your plan likely pays, and what you likely pay**, with a short reason why (for example, "the deductible applies here"). Confusing words like *deductible* or *annual maximum* are tappable chips that open a one-sentence explanation.

### 3. ⏳ Two futures
*The "time machine" itself.*

Side by side, you see:
- **Everything now**: what you'd pay doing all your care this plan year.
- **Best timing**: the cheapest schedule your dentist's advice allows.

Below that is a timeline with a line marking when your plan resets. **Drag a procedure across the line** (or tap its button) and the price updates instantly. Care your dentist hasn't cleared stays **locked** where it is. Behind the scenes the app tries every allowed combination to find the lowest cost, so you don't have to.

### 4. 📊 Your summary
*Everything on one screen, without the scrolling.*

- **The short version** at the top: *"You'll likely pay $1,975. Your plan likely pays $2,025."*
- **Three simple tabs:**
  - **Overview**: your plan's share vs. yours, the timing savings, and how much of your yearly limit is used and left.
  - **Each procedure**: a chart (or a table, if you prefer) of every procedure.
  - **Cash or insurance?**: would paying the dentist directly be cheaper? For Maya, cash would be about **$4,000**, so her insurance likely saves her money. The app also lists what the comparison assumes, like "premiums not included".
- **🔔 "Before your plan resets" reminder:** *"Your plan resets January 1, in 89 days. You have $100 of your annual maximum left."* One tap **adds a reminder to your phone or computer calendar** a month before, so unused benefits don't slip away.
- **🎧 A spoken recap:** a short summary in your language that the app can **read aloud** in a natural voice.

### 5. 📍 Find care
*Find a dentist the way you'd book a hotel.*

- **Just say what you want:** *"Find me an in-network dentist within 10 miles, under $200, that can see me this week."* The app sets the filters for you, and you can watch them change. Change your mind (*"Actually I'll drive 25 miles"*) and only that part updates.
- **Real dentists:** names, addresses and specialties come from the official U.S. government provider directory (the CMS NPI Registry).
- **Compare plan options:** see **your exact care priced under different plans** side by side, including what each plan costs per year. A cheap monthly price isn't always cheaper overall, and this shows you when. It compares; it never tells you which plan to pick.

### 6. 📅 Your year
*The big picture.* A simple ring shows how much of your yearly limit your care will use and what's left.

### 🎙️ Plus: a built-in guide
Not sure where to look? Turn on the **guide** and it talks you through each step, highlighting each part of the screen as it explains it, in your language. You can pause, skip or replay at any time.

---

## ⭐ What makes it impressive

| Feature | Why it matters |
|---|---|
| **The timing optimizer** | Automatically tests every allowed way to schedule your care and finds the cheapest. This is the heart of the app. |
| **Talk, type or upload** | Three easy ways in, plus a form. No insurance knowledge needed. |
| **AI document reader** | Reads a photo or PDF of your plan or estimate, pulls out the details, and explains the jargon on tappable cards. |
| **Four languages, three explanation styles** | English, Spanish, French and Portuguese, explained simply, in detail, or as just the numbers. |
| **Natural voice** | Speak your answers and hear the results read back in a lifelike voice, with a backup voice if needed. |
| **The "dollar guard"** | The AI is **never allowed to make up a number**. Every dollar amount it says is checked against the calculator first (see below). |
| **Cash vs. insurance** | Shows whether paying the dentist directly might cost less, with its assumptions spelled out. |
| **Fair plan comparison** | Prices *your* care under different plans over the *same* time period, so the comparison is apples to apples. |
| **Calendar reminder** | A one-tap reminder before your benefits reset. |
| **Plain-language dentist search** | Real U.S. dentist data, filtered by just describing what you need. |
| **Narrated guide** | A step-by-step tour that points at what it's talking about. |
| **It never breaks mid-demo** | If an AI service is slow or offline, a simpler built-in version takes over, so the app keeps working. |
| **Accessible** | Works with a keyboard and screen readers, every drag has a button alternative, voice always has a text alternative, and animations calm down for people who prefer less motion. |

---

## 🛡️ Why you can trust it

### "The AI talks. The calculator counts."
This is our golden rule. **Every dollar amount you see or hear comes from one carefully tested calculator**, never from the AI. The AI's job is only to understand you, read documents, and explain things in friendly words.

To make sure of that, a **"dollar guard"** checks every sentence the AI writes, in every language. If the AI mentions an amount the calculator didn't produce, the sentence is thrown out and rewritten, or replaced with safe, pre-written text.

The calculator is backed by **over 1,000 automated checks**, including Maya's exact numbers.

<p align="center"><img src="docs/readme/03-the-golden-rule.png" alt="Hand-drawn sketch: a small black creature turns the crank of a box labeled the engine. A number passes a red gate labeled dollar guard into a speech bubble labeled the AI talks. A made-up number is stopped at the gate." width="760"></p>

### It never plays doctor
- The app **never decides whether care can wait**. Only your dentist can. Procedures stay locked until *you* confirm "My dentist said this can wait."
- Savings are always worded carefully: *"If your dentist confirms crown 2 can wait, you'd likely pay $1,975."* It never says *"you should wait."*
- If you mention pain, swelling or other symptoms, it replies: **"I can't assess symptoms. Please contact a dentist today."**

### Your privacy
- **No account, no login, no database.** Nothing about you or your health is stored. Close the tab and it's gone.
- **Uploaded documents are read in memory and never saved or logged.** Your voice is turned into text by your own browser, and the app never stores your recordings or transcripts.
- For the dentist search, only a shortened version of your ZIP code is sent to the government directory.

### Calm and honest
- Wording is reassuring: "you'll likely pay," never "you owe." Savings are shown in green and nothing is ever red.
- Every result says: **"Estimate, not medical or coverage advice. Confirm with your dentist and plan."**

---

## 🔍 What's real and what's demo

We're upfront about which information is real and which is sample data for the hackathon. The app labels demo data on screen.

| Information | Real or demo? |
|---|---|
| The cost calculations (deductibles, coverage, yearly limits, timing) | ✅ Real math, thoroughly tested |
| Dentist names, addresses, specialties | ✅ Real (CMS NPI Registry) |
| Distances to dentists | ✅ Approximate, using U.S. Census ZIP code data |
| Maya and her plan | 🧪 Demo example, labeled "Demo plan" |
| Plan options in "Compare plan options" | 🧪 Demo plans, labeled "(demo)" |
| Dentists' network status, languages, availability | 🧪 Demo data, labeled "Demo" |
| Procedure prices | 🧪 One typical fee per procedure for the demo |

Not checked yet (the app reminds you to confirm these with your plan): waiting periods, how often a procedure is covered, "alternate benefit" rules, and missing-tooth clauses.

---

## 🛠️ Behind the scenes (for the curious)

Think of the app like a restaurant:

| | In a restaurant | In Dental Time Machine |
|---|---|---|
| **Frontend** | The dining room: what you see | The website: React, TypeScript, Tailwind CSS, Framer Motion animations, Recharts charts |
| **Backend** | The kitchen | A Python server (FastAPI) that does all the work |
| **The engine** | The head chef | The cost calculator and timing optimizer, the only place dollar amounts are made |
| **AI** | A friendly waiter who explains the menu | Claude on Amazon Bedrock (understanding, reading documents, explaining), ElevenLabs and Amazon Polly (voice), and your browser's speech recognition (listening) |

---

## 💻 Running it yourself (for developers)

You'll need **Python 3.11+** and **Node.js**.

**1. Backend** (the kitchen), in one terminal:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload    # runs at http://localhost:8000
```

**2. Frontend** (the website), in a second terminal:
```bash
cd frontend
cp .env.example .env             # points the website at the backend
npm install
npm run dev                      # open http://localhost:5173
```

**3. Try it:** open http://localhost:5173 and click **"See Maya's example"**.

**AI features (optional):** the app works without any keys, using built-in fallbacks. To turn on the AI and the natural voice, put your keys in `backend/.env`. Never commit or share them. The setting names are listed in [`docs/SECRETS.md`](docs/SECRETS.md).

**Run the automated checks:**
```bash
cd backend && pytest -q          # over 1,000 checks
cd frontend && npm run build     # makes sure the website builds
```

> 🔄 After pulling new changes from teammates, re-run `pip install -r requirements.txt` and `npm install`, then restart both servers.

---

<p align="center"><strong>Estimate, not medical or coverage advice. Confirm with your dentist and plan.</strong></p>

<p align="center"><sub>Sketches drawn in the style of <a href="https://github.com/helloianneo/ian-xiaohei-illustrations">Ian Xiaohei Illustrations</a> (MIT), featuring Ian's character 小黑 (Xiaohei).</sub></p>
