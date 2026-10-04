# Dental-Time-Machine

HI!!!

## Find care: searching for a dentist (Kuwa's part)

### The idea in plain words

Finding a dentist should feel like booking a place on Airbnb or a car on Turo: you set a few filters and the list narrows to what fits you.

The **Find care** step lets you search for dentists near you using filters like:

- **Where:** your ZIP code and how far you're willing to travel
- **Cost:** your budget, whether you're using insurance or paying yourself (self-pay), which plan, and whether you only want in-network dentists
- **Care:** the procedure you need (cleaning, filling, root canal, crown), the kind of dentist (general, pediatric, orthodontist and so on), a dentist's name, and the patient's age
- **When:** how soon you need to be seen (today, by tomorrow, this week) and whether to sort by earliest opening
- **More:** dentists accepting new patients, languages spoken, and no referral needed

### Just say what you want

You don't have to click through every filter. You can type what you're looking for, the way you'd say it to a friend:

> "Find me an in-network dentist within 10 miles, under $200, that can see me this week."

The app reads that and sets the filters for you: distance 10 miles, budget $200, in-network only, available this week. You can watch the filters change on screen.

If you change your mind:

> "Actually I'll drive 25 miles if someone can see me tomorrow."

Only the distance (now 25 miles) and the timing (now tomorrow) change. Everything else you already picked stays the same.

The reading is done by AI (Claude on Amazon Bedrock). The AI only sets filters: any number it uses, like miles or dollars, has to be one you typed. If the AI is ever unavailable, a simpler built-in reader takes over, so the search keeps working.

### Typing and clicking always agree

Typing a request and clicking the filters change the same settings. If the app sets something you don't want, just click it to change it or tap the x on its tag to remove it.

### Where the information comes from

- **Dentist names, addresses and specialties** are real, from the official U.S. government provider directory (the CMS NPI Registry).
- **Distances** are approximate, measured between ZIP code centers (U.S. Census data).
- **Network status, languages, new patients, next opening and referral details** are sample data for this demo, and the app labels them that way.
- **Cost estimates** come from the app's cost engine, the same one used everywhere else in the app. Prices don't differ by dentist yet, because we only have one typical fee per procedure.

As everywhere in this app: this is an estimate, not medical or coverage advice. Confirm with your dentist and plan.
