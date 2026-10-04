"""Warms the voice cache for the Maya demo. Run it by hand before presenting, never on startup:

    cd backend
    .venv\\Scripts\\python scripts\\warm_maya_voice.py              (server at http://localhost:8000)
    .venv\\Scripts\\python scripts\\warm_maya_voice.py http://host:8000

It asks the running server for the guide's captions (POST /narrate) for Maya in English and
Spanish, with crown 2 unmoved and moved, then speaks each caption once (POST /speak) so the
server's in-memory cache holds the audio. Restarting the server empties the cache.

The Summary recap is written by the AI and differs each time, so it can't be warmed: it's
spoken live during the demo. Each caption is spoken once, so this uses about 3,000
ElevenLabs characters.
"""

from __future__ import annotations

import sys
from collections import Counter

import httpx

STEPS = ["what_it_means", "two_futures", "summary", "find_care", "your_year"]
LANGUAGES = ["en", "es"]
SCHEDULES = [{}, {"crown2": "next_year"}]


def main(base_url: str) -> int:
    client = httpx.Client(base_url=base_url, timeout=30)
    try:
        demo = client.get("/demo").json()
    except httpx.HTTPError as exc:
        print(f"Can't reach the server at {base_url} ({type(exc).__name__}). Start it first.")
        return 1

    # Maya with both crowns marked "my dentist said this can wait", as in the demo.
    procedures = [{**p, "can_wait": p["id"] in ("crown1", "crown2")} for p in demo["procedures"]]

    captions: list[tuple[str, str]] = []
    for language in LANGUAGES:
        for schedule in SCHEDULES:
            for step in STEPS:
                body = {
                    "step": step,
                    "preferences": {"language": language, "style": "simple", "voice_on": True},
                    "procedures": procedures,
                    "plan": demo["plan"],
                    "schedule": schedule,
                }
                response = client.post("/narrate", json=body)
                if response.status_code != 200:
                    print(f"  /narrate {step} ({language}) failed: HTTP {response.status_code}")
                    continue
                captions += [(s["text"], language) for s in response.json()["segments"]]

    unique = list(dict.fromkeys(captions))  # Each caption once: no credits spent twice.
    voices: Counter[str] = Counter()
    characters = 0
    for i, (text, language) in enumerate(unique, 1):
        response = client.post("/speak", json={"text": text, "language": language})
        voice = response.headers.get("x-voice", f"failed (HTTP {response.status_code})")
        voices[voice] += 1
        characters += len(text)
        print(f"  {i}/{len(unique)} {language} {voice}")

    print(f"\nWarmed {len(unique)} captions ({characters} characters): " + ", ".join(f"{n} {v}" for v, n in voices.items()))
    if voices.get("polly"):
        print("Some captions used Polly: check the ElevenLabs key, voice id and credits, then run this again.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"))
