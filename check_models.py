"""
check_models.py - finds which Gemini models YOUR key can use right now.

Run from the project root (same folder as .env):
    python check_models.py

It lists every Gemini "flash" model your key can see, sends each one a
tiny test message, and tells you which are:
    WORKS        - usable right now, has quota left
    QUOTA USED   - exists, but today's free limit is used up
    NOT AVAILABLE- retired / not offered to your key (like gemini-2.5-flash)
Your API key is never printed.
"""

import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise SystemExit("GEMINI_API_KEY not found. Run this from the folder that contains .env")

client = genai.Client(api_key=api_key)

names = []
for m in client.models.list():
    actions = getattr(m, "supported_actions", None) or []
    name = m.name.replace("models/", "")
    if "generateContent" in actions and "flash" in name:
        names.append(name)

names = sorted(set(names))
print(f"Found {len(names)} flash models. Testing each with one tiny request...\n")

working = []
for name in names:
    try:
        client.models.generate_content(model=name, contents="Reply with the word OK.")
        print(f"  WORKS          {name}")
        working.append(name)
    except Exception as e:
        msg = str(e)
        if "PerDay" in msg or "RESOURCE_EXHAUSTED" in msg or "429" in msg:
            print(f"  QUOTA USED     {name}")
        elif "404" in msg or "NOT_FOUND" in msg:
            print(f"  NOT AVAILABLE  {name}")
        else:
            print(f"  OTHER ERROR    {name}  ({msg[:80]})")

print("\nModels that work right now:", working if working else "none (wait for the daily reset)")
if len(working) >= 3:
    print("\nPut three DIFFERENT ones in .env so they don't share one quota:")
    print(f"  AGENT_MODEL={working[0]}")
    print(f"  ATTACKER_MODEL={working[1]}")
    print(f"  JUDGE_GEMINI_MODEL={working[2]}")
elif working:
    print("\nFewer than 3 working models - use what you have, e.g.:")
    print(f"  AGENT_MODEL={working[0]}")
