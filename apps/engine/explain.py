"""Explains a mistake in a child's code: what went wrong, on which line, why, and how to fix it.

    text, short = explain(error, code)

text is shown in the output box; short is the one-line message Tom says (also the name of its voice
recording, so the shorts are a fixed list: SHORT). No PyQt here: the tests use it, and the program runner
for input() lessons copies this file's code in.
"""
import builtins
import difflib
import keyword
import re
import traceback

SHORT = {
    "bracket": "A bracket is not closed",
    "extra_bracket": "There is an extra bracket",
    "quote": "A quote is missing",
    "colon": "A colon is missing",
    "indent_missing": "Some spaces are missing",
    "indent_extra": "There are too many spaces",
    "indent_mixed": "The spaces don't line up",
    "equals": "Use == to compare",
    "comma": "A comma is missing",
    "strange": "There is a strange letter",
    "syntax": "Python can't read this line",
    "name": "Mistake in function name or variable",
    "mix": "Words and numbers are mixed",
    "not_function": "That is not a function",
    "args": "Wrong number of things in the brackets",
    "type": "Those don't go together",
    "zero": "You can't divide by zero",
    "not_number": "That is not a number",
    "index": "The list is not that long",
    "key": "That key is not in the dictionary",
    "module": "A helper is not installed",
    "attribute": "That can't be used here",
    "eof": "You missed to type input",
    "other": "Oops! Something went wrong",
}

PIP_NAMES = {"cv2": "opencv-python", "PIL": "pillow", "sklearn": "scikit-learn", "yaml": "pyyaml"}
KNOWN_WORDS = sorted(set(dir(builtins)) | set(keyword.kwlist))


def _line_of(error, code, filename):
    """(number, text) of the line where the mistake is, or (None, "")."""
    lines = code.splitlines()
    n = None
    if isinstance(error, SyntaxError):
        n = error.lineno
    else:
        for frame in traceback.extract_tb(error.__traceback__):
            if frame.filename == filename:
                n = frame.lineno
    if n and 1 <= n <= len(lines):
        return n, lines[n - 1].strip()
    return n, ""


def _names_in(code):
    return set(re.findall(r"\b([A-Za-z_]\w*)\s*=(?!=)", code)) | set(re.findall(r"\bdef\s+(\w+)", code)) | \
        set(re.findall(r"\bfor\s+(\w+)\s+in\b", code))


def _syntax(error, n):
    msg = (error.msg or "").lower()
    at = f" on line {n}" if n else ""
    where = f"line {n}" if n else "this line"
    if isinstance(error, IndentationError) or "indent" in msg:
        if "expected an indented block" in msg:
            return ("indent_missing", "The line after a colon : must start with 4 spaces, so Python knows it belongs inside.",
                    f"Press the space bar 4 times at the start of {where}.")
        if "unexpected indent" in msg:
            return ("indent_extra", "This line starts with spaces, but it isn't inside an if, for, while or def.",
                    f"Delete the spaces at the start of {where}.")
        return ("indent_mixed", "The lines inside the same block must start with the same number of spaces.",
                "Make the lines line up: use 4 spaces for each step in.")
    if "was never closed" in msg or "unexpected eof" in msg:
        return ("bracket", "You opened a bracket ( [ or { but didn't close it.",
                f"Add the closing bracket ) ] or }} at the end of {where}.")
    if "unterminated" in msg or "eol while scanning" in msg or "eof while scanning" in msg:
        return ("quote", 'Words in Python go between two quotes, like "hello". One of the quotes is missing.',
                f'Add the missing " at the end of the words{at}.')
    if "unmatched" in msg or "does not match opening" in msg:
        return ("extra_bracket", "There's a closing bracket ) without an opening ( before it, or they don't match.",
                f"Remove the extra bracket{at}, or add the one that's missing.")
    if "expected ':'" in msg:
        return ("colon", "Lines that start with if, elif, else, for, while or def end with a colon :",
                f"Put : at the end of {where}.")
    if "maybe you meant '=='" in msg or "cannot assign to" in msg:
        return ("equals", "One = puts a value in a box (a variable). Two == ask if two things are the same.",
                f"To compare two things, use == instead of ={at}.")
    if "forgot a comma" in msg:
        return ("comma", "Things inside brackets are separated by commas, like print(\"Hi\", name).",
                f"Add a comma between the things{at}.")
    if "invalid character" in msg or "invalid non-printable" in msg:
        return ("strange", "This line has a letter Python doesn't know, like curly quotes “ ” or an emoji outside the quotes.",
                'Use straight quotes " and keep emoji inside the quotes.')
    return ("syntax", "Something on this line is written in a way Python doesn't understand.",
            "Check the brackets ( ), the quotes \" \" and the colons : on this line.")


def _runtime(error, code):
    name = type(error).__name__
    text = str(error)
    if isinstance(error, NameError):
        m = re.search(r"name '(\w+)' is not defined", text)
        word = m.group(1) if m else "that word"
        why = f"Python doesn't know the word {word}."
        close = difflib.get_close_matches(word, KNOWN_WORDS + sorted(_names_in(code)), n=1, cutoff=0.75)
        if close and close[0] != word:
            fix = f"Did you mean {close[0]}? Check the spelling."
        elif word[:1].isupper() or len(word) > 2:
            fix = f'If {word} is words to show, put it in quotes: print("{word}"). ' \
                  f"If it's a variable, give it a value first, like {word} = 5."
        else:
            fix = f"Give {word} a value first, like {word} = 5, then use it."
        return "name", why, fix
    if isinstance(error, ZeroDivisionError):
        return ("zero", "Nobody can share sweets among 0 friends! Dividing by 0 isn't allowed in maths or in Python.",
                "Change the 0 after / to another number.")
    if isinstance(error, (ModuleNotFoundError, ImportError)):
        m = re.search(r"No module named '([\w.]+)'", text)
        mod = (m.group(1) if m else "it").split(".")[0]
        return ("module", f"Your code uses import {mod}, but {mod} isn't on this computer.",
                f"Ask a grown-up to type this in the Command Prompt: pip install {PIP_NAMES.get(mod, mod)}")
    if isinstance(error, TypeError):
        if "concatenate" in text or ("unsupported operand" in text and "str" in text):
            return ("mix", "You tried to join words and a number with +. Python can't add words to numbers.",
                    'Turn the number into words with str(), like "Age: " + str(8). '
                    "Or turn words into a number with int(), like int(\"8\") + 2.")
        if "not callable" in text:
            return ("not_function", "You put ( ) after something that isn't a function, so Python can't run it.",
                    "Remove the ( ), or check that you didn't use the same name for a variable and a function.")
        if "positional argument" in text or "argument" in text:
            return ("args", "A function got more or fewer things in its brackets than it needs.",
                    "Check how many things the function wants between ( ) and give it exactly that many.")
        return "type", "These two things can't be used together like this.", "Check what kind each one is: words, a number or a list."
    if isinstance(error, ValueError):
        if "invalid literal for int()" in text or "could not convert" in text:
            return ("not_number", "int() and float() turn words like \"8\" into numbers, but this wasn't a number.",
                    "Use digits only, like 8 or 3.5.")
        return "type", "The value isn't the right kind for this.", "Check the value you gave."
    if isinstance(error, IndexError):
        return ("index", "The list doesn't have an item at that place. Remember: counting starts at 0, so the first item is [0]!",
                "Use a smaller number inside [ ].")
    if isinstance(error, KeyError):
        return ("key", f"The dictionary has no key called {text}.", "Check the spelling of the key, or add it to the dictionary first.")
    if isinstance(error, AttributeError):
        return ("attribute", f"{text}.", "Check the spelling of the word after the dot.")
    if isinstance(error, EOFError):
        return "eof", "The program asked you to type something, but nothing was typed.", "Type your answer and press Enter."
    return "other", f"Python stopped with a {name}.", "Read the line shown above and check it carefully."


def explain(error, code, filename="<string>"):
    n, line = _line_of(error, code, filename)
    if isinstance(error, SyntaxError):
        kind, why, fix = _syntax(error, n)
        said = f"{type(error).__name__}: {error.msg}"
    else:
        kind, why, fix = _runtime(error, code)
        said = f"{type(error).__name__}: {error}"
    short = SHORT[kind]
    parts = [f"❌ {short}"]
    if n:
        parts.append(f"📍 Line {n}:  {line}" if line else f"📍 Line {n}")
    parts += [f"💡 Why: {why}", f"🔧 Try: {fix}", f"🐍 Python says: {said}"]
    return "\n".join(parts), short + (" 🙈" if kind in ("eof",) else " 💡")
