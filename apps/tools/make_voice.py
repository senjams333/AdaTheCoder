"""Record the app's voice: a cute boy's voice (or any natural voice) instead of the computer's robot voice.

    pip install edge-tts
    python apps/tools/make_voice.py python_adventure
    python apps/tools/make_voice.py python_adventure --voice en-IN-NeerjaNeural      (Indian English)
    python apps/tools/make_voice.py --list                                           (all English voices)

It makes one small .mp3 per sentence the app says ("Fantastic job!...", "Click the examples...", the
"oops" messages) in apps/<app>/voice/. They go into the .exe when you build, and play without internet.
Needs internet once, while recording (it uses Microsoft's neural voices through edge-tts).

The voice, speed and pitch come from app.json → "voice" (or --voice/--rate/--pitch). The default is a
cute boy: en-US-AnaNeural (Microsoft's English child voice) a little lower. Another boy sound: a young
man's voice made higher, e.g. --voice en-US-AndrewNeural --pitch +25Hz. A young lady teacher instead:
--voice en-US-JennyNeural --pitch +14Hz (or en-IN-NeerjaNeural). A sentence can be said more kindly than it's written: app.json → "voice" → "say".
"""
import argparse
import asyncio
import os
import re
import sys

APPS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(APPS, "engine"))
from appconfig import load_config, voice_key  # noqa: E402

# How the app's short messages are said: same meaning, warmer words
KIND_WORDS = {
    "A bracket is not closed": "Oops! A bracket is not closed. Let's look at it together.",
    "A quote is missing": "Oh! A quote is missing. Let's find it together.",
    "A colon is missing": "Almost! A colon is missing at the end of the line.",
    "Some spaces are missing": "Oops! This line needs some spaces at the start.",
    "There are too many spaces": "Oops! This line has too many spaces at the start.",
    "Use == to compare": "To compare, we use two equals signs.",
    "Mistake in function name or variable": "Hmm, a name is spelled a little differently. Let's check it together.",
    "Words and numbers are mixed": "Oh! Words and numbers got mixed up.",
    "You can't divide by zero": "Oops! We can't divide by zero.",
    "Oops! Something went wrong": "Oops! Something went wrong. Let's read the hint together.",
    "Click the examples here to start !": "Hi there! Click an example to start. You can do it!",
    "Fantastic job! Code ran correctly!": "Fantastic job! Your code ran perfectly. I'm so proud of you!",
    "You missed to type input": "Oops! You forgot to type something. Try again, you're doing great.",
    "Code missing ) or string error": "Oh! A bracket or a quote is missing. Let's look at it together.",
    "Mistake in function name or variable": "Hmm, a name is spelled a little differently. Let's check it together.",
    "OpenCV / Module not installed in system": "This lesson needs a helper called OpenCV. Ask a grown-up to install it.",
}


def clean(text):
    """The same as the lesson page's cleanForSpeech: no emoji, single spaces."""
    return " ".join("".join(ch for ch in text if ord(ch) < 0x2190).split())


def phrases(cfg):
    """Every sentence the app speaks: from the engine's code, plus app.json → voice → extra_phrases."""
    src = open(os.path.join(APPS, "engine", "kids_app.py"), encoding="utf-8").read()
    found = re.findall(r'speakWithKidVoice\("([^"]+)"\)', src)
    found += re.findall(r'^\s*msg = "([^"{}]+)"', src, re.M)       # the "oops" messages (not f-strings)
    from explain import SHORT                                       # the short messages Tom says
    found += list(SHORT.values())
    found += list(cfg.get("voice", {}).get("extra_phrases", []))
    out = {}
    for f in found:
        shown = clean(f)
        if shown:
            out.setdefault(voice_key(shown), shown)
    return out


async def record(items, folder, voice, rate, pitch, say):
    import edge_tts  # pip install edge-tts
    os.makedirs(folder, exist_ok=True)
    for key, shown in items.items():
        spoken = say.get(shown) or KIND_WORDS.get(shown) or shown
        path = os.path.join(folder, key + ".mp3")
        await edge_tts.Communicate(spoken, voice, rate=rate, pitch=pitch).save(path)
        print(f"  {key}.mp3  ←  {spoken}")


async def list_voices():
    import edge_tts
    for v in await edge_tts.list_voices():
        if v["Locale"].startswith("en-"):
            print(f"{v['ShortName']:28} {v['Gender']:7} {v['Locale']}")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("app", nargs="?")
    p.add_argument("--voice")
    p.add_argument("--rate", help='e.g. "-8%%" (slower) or "+5%%"')
    p.add_argument("--pitch", help='e.g. "-8Hz" (lower) or "+14Hz" (higher)')
    p.add_argument("--list", action="store_true", help="list the English voices")
    args = p.parse_args()
    if args.list:
        asyncio.run(list_voices())
        return
    if not args.app:
        p.error("which app? e.g. python_adventure")
    app_dir = os.path.join(APPS, args.app)
    cfg = load_config(app_dir)
    v = cfg.get("voice", {})
    voice = args.voice or v.get("name") or "en-US-AnaNeural"
    items = phrases(cfg)
    print(f"Recording {len(items)} sentences with {voice} into {os.path.relpath(os.path.join(app_dir, 'voice'))}/")
    asyncio.run(record(items, os.path.join(app_dir, "voice"), voice,
                       args.rate or v.get("rate") or "-4%", args.pitch or v.get("pitch") or "-8Hz", v.get("say") or {}))
    print("Done. Open the app and press Run on an example to hear it.")


if __name__ == "__main__":
    main()
