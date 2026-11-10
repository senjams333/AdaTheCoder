"""Explains a mistake in a child's code: what went wrong, on which line, why, and how to fix it.

    text, short = explain(error, code)

text is shown in the output box; short is the one-line message Tom shows (a fixed list: SHORT). No PyQt here: the tests use it, and the program runner
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
    "print_brackets": "print needs brackets",
    "bracket_mix": "The brackets don't match",
    "capital": "Python words use small letters",
    "spelling": "A Python word is misspelled",
    "reserved": "That name is a Python word",
    "space_name": "Names can't have spaces",
    "digit_name": "A name can't start with a number",
    "outside": "That word is in the wrong place",
    "elif": "Use elif, not else if",
    "for_in": "The word in is missing",
    "fstring": "The f-string has a mistake",
    "try": "try needs an except",
    "operator": "Something is missing between the words",
    "empty": "Something is missing here",
    "local": "The variable has no value yet",
    "compare_mix": "Words and numbers can't be compared",
    "len": "That has no length",
    "subscript": "That can't use [ ]",
    "iterable": "That can't be looped over",
    "none": "Something has no value",
    "unpack": "The number of boxes doesn't match",
    "recursion": "The function never stops",
    "file": "That file can't be found",
    "one_line": "One command per line",
    "def_name": "The function's name has a mistake",
    "def_brackets": "def needs brackets",
    "no_if": "else needs an if before it",
    "no_try": "except needs a try before it",
    "other_lang": "That's not how Python writes it",
    "apostrophe": "A quote is inside the words",
    "multiply": "Use * to multiply",
    "too_early": "Used before it was made",
    "empty_input": "Nothing was typed",
    "whole_number": "A whole number is needed",
    "index_type": "Use a whole number in [ ]",
    "change_str": "Words can't be changed like that",
    "not_in_list": "That is not in the list",
    "empty_list": "The list is empty",
    "too_big": "That number is too big",
    "print_kw": "print can't use = inside",
    "module_name": "Check the helper's name",
    "other": "Oops! Something went wrong",
}

OPEN_FOR = {")": "(", "]": "[", "}": "{"}
CLOSE_FOR = {"(": ")", "[": "]", "{": "}"}
BLOCK_WORDS = ("if", "elif", "else", "for", "while", "def", "class", "try", "except", "finally", "with")
# words children type at the start of a line, for spotting a misspelled one (wihle, esle, retrun, pritn ...)
LINE_WORDS = ("if", "elif", "else", "for", "while", "def", "class", "return", "import", "from", "try", "except",
              "finally", "with", "print", "input", "break", "continue", "pass", "global", "lambda")

COMMON_MODULES = ("random", "math", "time", "turtle", "datetime", "os", "sys", "string", "statistics", "calendar",
                  "json", "csv", "tkinter", "pygame", "cv2")
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


def _first_word(line):
    m = re.match(r"\s*([A-Za-z_]\w*)", line or "")
    return m.group(1) if m else ""


def _odd_quotes(line):
    """The quote that has no partner on this line (" or '), or ''. Quotes inside the other kind don't count."""
    open_q = ""
    for ch in line or "":
        if open_q:
            if ch == open_q:
                open_q = ""
        elif ch in "\"'":
            open_q = ch
        elif ch == "#":
            break
    return open_q


def _bracket_balance(line):
    """(first bracket left open, first closing bracket with no opening), ignoring brackets inside quotes."""
    stack, extra, q = [], "", ""
    for ch in line or "":
        if q:
            if ch == q:
                q = ""
            continue
        if ch in "\"'":
            q = ch
        elif ch == "#":
            break
        elif ch in "([{":
            stack.append(ch)
        elif ch in ")]}":
            if stack and stack[-1] == OPEN_FOR[ch]:
                stack.pop()
            elif not extra:
                extra = ch
    return (stack[0] if stack else ""), extra


def _syntax(error, n, line=""):
    msg = (error.msg or "").lower()
    at = f" on line {n}" if n else ""
    where = f"line {n}" if n else "this line"
    word = _first_word(line)
    low = word.lower()

    # spaces at the start of lines
    if isinstance(error, IndentationError) or "indent" in msg or "inconsistent use of tabs" in msg:
        if "expected an indented block" in msg:
            m = re.search(r"after '(\w+)' statement", msg)
            after = f" after {m.group(1)}" if m else " after a colon :"
            return ("indent_missing", f"The lines{after} must start with 4 spaces, so Python knows they belong inside.",
                    f"Press the space bar 4 times at the start of {where}.")
        if "unexpected indent" in msg:
            return ("indent_extra", "This line starts with spaces, but it isn't inside an if, for, while or def.",
                    f"Delete the spaces at the start of {where}.")
        if "tab" in msg:
            return ("indent_mixed", "Some lines start with a Tab and others with spaces. Python counts them differently.",
                    "Start every line with spaces only: 4 spaces for each step in.")
        return ("indent_mixed", "The lines inside the same block must start with the same number of spaces.",
                "Make the lines line up: use 4 spaces for each step in.")

    # print without brackets: print "Hi"
    if "missing parentheses in call to" in msg:
        m = re.search(r"call to '(\w+)'", msg)
        fn = m.group(1) if m else "print"
        return ("print_brackets", f"{fn} needs round brackets ( ) around what it shows.",
                f'Write {fn}("Hello") with ( ) around the words{at}.')

    # quotes
    if "unterminated triple-quoted" in msg or "eof while scanning triple-quoted" in msg:
        return ("quote", 'Text that starts with three quotes """ must also end with three quotes """.',
                'Add """ at the end of the text.')
    if "unterminated string" in msg or "eol while scanning" in msg or "eof while scanning" in msg:
        if re.search(r"'[^'\"]*\w'\w", line):
            return ("apostrophe", "The words have an apostrophe ' (like it's) inside ' quotes, so Python thinks the words end there.",
                    f"Put the words between double quotes instead, like print(\"it's fun\"){at}.")
        if '"' in line and "'" in line:
            return ("quote", "The words start with one kind of quote and end with the other. Both ends must use the same quote.",
                    f"Use \" at both ends, like \"hello\", or ' at both ends{at}.")
        return ("quote", 'Words in Python go between two quotes, like "hello". One of the quotes is missing.',
                f'Add the missing " so the words have a quote at the start and at the end{at}.')

    # brackets
    m = re.search(r"closing parenthesis '(.)' does not match opening parenthesis '(.)'", msg)
    if m:
        close, opened = m.group(1), m.group(2)
        return ("bracket_mix", f"You opened with {opened} but closed with {close}. Brackets come in pairs: ( ), [ ] and {{ }}.",
                f"Change {close} to {CLOSE_FOR.get(opened, ')')}{at}.")
    m = re.search(r"'(.)' was never closed", msg)
    if m:
        opened = m.group(1)
        return ("bracket", f"You opened a bracket {opened} but didn't close it.",
                f"Add the closing bracket {CLOSE_FOR.get(opened, ')')} at the end of {where}.")
    m = re.search(r"unmatched '(.)'", msg)
    if m:
        close = m.group(1)
        return ("extra_bracket", f"There's a closing bracket {close} without an opening {OPEN_FOR.get(close, '(')} before it.",
                f"Add the missing {OPEN_FOR.get(close, '(')}, like print(\"Hi\"), or remove the extra {close}{at}.")
    if "unexpected eof" in msg:
        opened, _ = _bracket_balance(line)
        b = opened or "("
        return ("bracket", f"You opened a bracket {b} but didn't close it.",
                f"Add the closing bracket {CLOSE_FOR.get(b, ')')} at the end of {where}.")

    # f"Hi {name}"
    if "f-string" in msg:
        return ("fstring", 'In an f-string, each { needs a }, with a name between them, like f"Hi {name}".',
                f"Check the {{ }} in the f-string{at}.")

    # if / for / while ... :
    if re.match(r"\s*else\s+if\b", line):
        return ("elif", "In Python, 'else if' is written as one word: elif.",
                f"Write elif instead of else if{at}, and end the line with :")
    if re.match(r"\s*(" + "|".join(k for k in keyword.kwlist if k.islower()) + r")\s*=(?!=)", line):
        return ("reserved", f"{word} is a special Python word, so it can't be the name of a variable.",
                f"Choose another name, like my_{word} = ...{at}.")
    if "maybe you meant '=='" in msg or ("cannot assign to" in msg and low in ("if", "elif", "while")) \
            or "expression cannot contain assignment" in msg:
        return ("equals", "One = puts a value in a box (a variable). Two == ask if two things are the same.",
                f"To compare two things, use == instead of ={at}.")
    if "expected ':'" in msg or (low in BLOCK_WORDS and word == low and not line.rstrip().endswith(":")
                                 and "invalid syntax" in msg):
        start = f"start with {word}" if low in BLOCK_WORDS else "start with if, elif, else, for, while or def"
        return ("colon", f"Lines that {start} must end with a colon :",
                f"Put : at the end of {where}.")
    if re.match(r"\s*for\s+\w+\s+(?!in\b)\w", line) and " in " not in f" {line} ":
        return ("for_in", "A for loop needs the word in, like: for i in range(5):",
                f"Add in after the loop name{at}.")
    if "expected 'except' or 'finally'" in msg:
        return ("try", "After try: you need an except: part that says what to do if something goes wrong.",
                "Add except: below the try block, at the same number of spaces as try.")

    # words in the wrong place
    m = re.search(r"'(\w+)' outside (function|loop)", msg) or re.search(r"'(\w+)' not properly in loop", msg)
    if m:
        w = m.group(1)
        inside = "a def function" if w in ("return", "yield") else "a for or while loop"
        return ("outside", f"{w} only works inside {inside}.",
                f"Move {w} inside {inside} (with spaces in front), or remove it{at}.")

    # names and Python words
    if word and word != low and low in keyword.kwlist:
        return ("capital", f"Python's special words use small letters. {word} should be {low}.",
                f"Write {low} instead of {word}{at}.")
    if "invalid decimal literal" in msg or "invalid syntax" in msg and re.search(r"(^|[^\w.])\d+[A-Za-z_]", line):
        return ("digit_name", "A name can't start with a number, and a number can't have letters stuck to it.",
                f'Write the name like age1 instead of 1age, put words in quotes, like "5 apples", or use * to multiply, like 2 * x{at}.')
    m = re.match(r"\s*([A-Za-z_]\w*)((?:\s+[A-Za-z_]\w*)+)\s*=(?!=)", line)
    if m and m.group(1) not in keyword.kwlist and not any(w in keyword.kwlist for w in m.group(2).split()):
        joined = "_".join([m.group(1)] + m.group(2).split())
        return ("space_name", "A variable's name can't have spaces in it.",
                f"Join the words with _ , like {joined}{at}.")
    if word and low not in keyword.kwlist and low not in dir(builtins) and "invalid syntax" in msg:
        close = difflib.get_close_matches(low, LINE_WORDS, n=1, cutoff=0.6)
        if close:
            return ("spelling", f"{word} looks like the Python word {close[0]}, spelled a little differently.",
                    f"Did you mean {close[0]}? Check the spelling{at}.")

    # functions
    if re.match(r"\s*def\s+\w+\s+\w+", line):
        name = "_".join(re.match(r"\s*def\s+([\w\s]+?)\s*[(:]", line + ":").group(1).split())
        return ("def_name", "A function's name can't have spaces in it.",
                f"Join the words with _ , like def {name}():{at}.")
    if re.match(r"\s*def\s+\w+\s*:", line) or ("expected '('" in msg and low == "def"):
        m = re.match(r"\s*def\s+(\w+)", line)
        return ("def_brackets", "A function needs round brackets after its name, even when they are empty.",
                f"Write def {m.group(1) if m else 'hello'}():{at}.")
    if re.match(r"\s*def\s+(" + "|".join(k for k in keyword.kwlist if k.islower()) + r")\s*\(", line):
        w = re.match(r"\s*def\s+(\w+)", line).group(1)
        return ("reserved", f"{w} is a special Python word, so it can't be the name of a function.",
                f"Choose another name, like def my_{w}():{at}.")

    # else / elif / except with nothing before them
    if "invalid syntax" in msg and low in ("else", "elif") and line.rstrip().endswith(":"):
        return ("no_if", f"{low} must come right after an if block, and start with the same number of spaces as that if.",
                f"Check there's an if just above, and line up {low} with it{at}.")
    if "invalid syntax" in msg and low in ("except", "finally") and line.rstrip().endswith(":"):
        return ("no_try", f"{low} must come right after a try: block, with the same number of spaces as try.",
                f"Put a try: block above, or line {low} up with it{at}.")

    # habits from other languages or from maths
    code_part = line.split("#")[0]
    if re.search(r"\w\s*(\+\+|--)\s*$", code_part) or re.search(r"^\s*(\+\+|--)\w", code_part):
        return ("other_lang", "Python doesn't have ++ or --.",
                f"To add 1, write x = x + 1 (or x += 1){at}.")
    if "&&" in code_part or "||" in code_part:
        return ("other_lang", "Python uses the words and / or instead of && and ||.",
                f"Write and instead of &&, and or instead of ||{at}.")
    if re.search(r"(^|[\s(])!\s*[A-Za-z_(]", code_part) and "!=" not in code_part:
        return ("other_lang", "Python uses the word not instead of !.",
                f"Write not instead of !, like if not done:{at}")
    if "=!" in code_part or "<>" in code_part:
        return ("other_lang", "In Python, \"is not equal to\" is written !=",
                f"Write != {at.strip() and at}.".replace(" .", "."))
    if "÷" in line or "×" in line or re.search(r"\d\s*[xX]\s*\d", code_part):
        return ("multiply", "Python uses * to multiply and / to divide.",
                f"Write 3 * 4 instead of 3 x 4, and 8 / 2 instead of 8 ÷ 2{at}.")
    if re.search(r"\)\s+[A-Za-z_]\w*\s*\(", code_part) and "invalid syntax" in msg:
        return ("one_line", "Two commands are on the same line.",
                f"Put each command on its own line{at}.")

    # quotes inside quotes
    if re.search(r'"[^"]*"\w+"[^"]*"', line):
        return ("apostrophe", 'There are " quotes inside words that are already between " quotes.',
                f"Use ' inside and \" outside, like print(\"He said 'hi'\"){at}.")

    # commas, quotes and brackets that the message doesn't name
    if "forgot a comma" in msg and re.search(r"\bprint\s*\(", line) and '"' not in line and "'" not in line:
        inside = re.search(r"\bprint\s*\((.*)\)", line)
        words = inside.group(1).strip() if inside else "Hello World"
        return ("quote", "Words to show must go between quotes. Without quotes Python thinks they are names.",
                f'If these are words to show, write print("{words}"). If they are variables, put a comma between them{at}.')
    if "forgot a comma" in msg:
        return ("comma", "Things inside brackets are separated by commas, like print(\"Hi\", name).",
                f"Add a comma between the things{at}.")
    if ("invalid character" in msg or "invalid non-printable" in msg) and re.search(r"'[^'\"]*\w'\w", line):
        return ("apostrophe", "The words have an apostrophe ' (like it's) inside ' quotes, so Python thinks the words end there.",
                f"Put the words between double quotes instead, like print(\"it's fun\"){at}.")
    if "invalid character" in msg or "invalid non-printable" in msg:
        if any(c in line for c in "“”‘’") or re.search(r"'[“”‘’]'", msg):
            return ("strange", "This line has curly quotes “ ” (from a document or phone). Python only knows straight quotes.",
                    'Type the quotes again with the keyboard: " or \'.')
        return ("strange", "This line has a letter Python doesn't know, like an emoji outside the quotes.",
                'Keep emoji and special letters inside the quotes, like print("Hi 😊").')
    q = _odd_quotes(line)
    if q:
        return ("quote", f"There's a {q} with no partner {q} on this line.",
                f"Add the missing {q} so the words have a quote at the start and at the end{at}.")
    opened, extra = _bracket_balance(line)
    if opened:
        return ("bracket", f"You opened a bracket {opened} but didn't close it.",
                f"Add the closing bracket {CLOSE_FOR[opened]}{at}.")
    if extra:
        return ("extra_bracket", f"There's a closing bracket {extra} without an opening {OPEN_FOR[extra]} before it.",
                f"Add the missing {OPEN_FOR[extra]}, or remove the extra {extra}{at}.")
    if re.search(r"(=|\+|-|\*|/|,|==|<|>)\s*[)\]}]*\s*$", line.split("#")[0]):
        return ("empty", "The line stops in the middle: something is missing after the last sign.",
                f"Finish the line{at}, like x = 5 or print(\"Hi\").")
    if re.search(r"[\"'\w)\]]\s+[\"'\w(]", line) and "invalid syntax" in msg:
        return ("operator", "Two things are next to each other with nothing between them.",
                f"Put a comma , or a + between them{at}, like print(\"Age\", age) or \"Hi \" + name.")
    return ("syntax", "Something on this line is written in a way Python doesn't understand.",
            "Check the brackets ( ), the quotes \" \" and the colons : on this line.")


def _runtime(error, code, line_no=None):
    name = type(error).__name__
    text = str(error)
    if isinstance(error, UnboundLocalError):
        m = re.search(r"variable '(\w+)'", text) or re.search(r"'(\w+)'", text)
        word = m.group(1) if m else "that variable"
        return ("local", f"Inside a function, {word} is used before it gets a value there.",
                f"Give {word} a value inside the function first, or pass it in between the brackets: def my_function({word}):")
    if isinstance(error, NameError):
        m = re.search(r"name '(\w+)' is not defined", text)
        word = m.group(1) if m else "that word"
        why = f"Python doesn't know the word {word}."
        later = None
        for i, l in enumerate(code.splitlines(), 1):
            if re.match(rf"(def\s+{re.escape(word)}\s*\(|{re.escape(word)}\s*=(?!=))", l):   # at the left edge only
                later = i
                break
        close = difflib.get_close_matches(word, KNOWN_WORDS + sorted(_names_in(code)), n=1, cutoff=0.75)
        if later and (line_no is None or later > line_no):
            made = f"def {word}():" if code.splitlines()[later - 1].lstrip().startswith("def") else f"{word} = ..."
            return ("too_early", f"{word} is used before the line that makes it ({made} on line {later}). Python reads from the top down.",
                    f"Move line {later} (and the lines that belong to it) above the line that uses {word}.")
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
        close = difflib.get_close_matches(mod.lower(), COMMON_MODULES, n=1, cutoff=0.7)
        if close and close[0] != mod:
            return ("module_name", f"There's no helper called {mod}. Helper names use small letters and exact spelling.",
                    f"Did you mean import {close[0]}?")
        return ("module", f"Your code uses import {mod}, but {mod} isn't on this computer.",
                f"Ask a grown-up to type this in the Command Prompt: pip install {PIP_NAMES.get(mod, mod)}")
    if isinstance(error, RecursionError):
        return ("recursion", "A function kept calling itself again and again, and never stopped.",
                "Make sure the function has a way to stop, like an if that returns without calling itself.")
    if isinstance(error, FileNotFoundError):
        return ("file", "The program tried to open a file that isn't there.", "Check the file's name and that it is in the same folder.")
    if "NoneType" in text:
        return ("none", "Something has no value (None). Often a function didn't give back a value with return.",
                "Add return to the function, or check that the variable got a value.")
    if isinstance(error, OverflowError):
        return ("too_big", "The number got too big for Python to work with.", "Use smaller numbers.")
    if isinstance(error, TypeError):
        m = re.search(r"(\w+)\(\) missing (\d+) required positional arguments?: (.+)", text)
        if m:
            fn, names = m.group(1), m.group(3).replace("'", "")
            return ("args", f"{fn}() needs {names} between its brackets.",
                    f"Give it a value for each, like {fn}(\"Tom\").")
        m = re.search(r"(\w+)\(\) takes (\d+) positional arguments? but (\d+) (?:was|were) given", text)
        if m:
            fn, want, got = m.group(1), m.group(2), m.group(3)
            how = f"{fn}()" if want == "0" else f"exactly {want} thing{'s' if want != '1' else ''}"
            return ("args", f"{fn}() takes {want} thing{'s' if want != '1' else ''} in its brackets, but got {got}.",
                    f"Write {how} with nothing inside." if want == "0" else f"Give it {how} between the brackets.")
        if "invalid keyword argument for print" in text or re.search(r"print\(\) got an unexpected keyword", text):
            return ("print_kw", "print( ) shows things; it can't make a variable with = inside its brackets.",
                    "Make the variable on its own line first, like x = 5, then print(x).")
        if "cannot be interpreted as an integer" in text:
            if "'str'" in text:
                return ("whole_number", "This needs a number, but it got words. Remember: input() always gives words.",
                        "Turn the words into a number with int(), like n = int(input(\"How many? \")).")
            return ("whole_number", "This needs a whole number, like 3, not a number with a dot like 3.5.",
                    "Use a whole number, or round it with int(), like range(int(n)).")
        if "indices must be integers" in text:
            return ("index_type", "The number inside [ ] must be a whole number, like [0] or [2].",
                    "Use a whole number, or int() to turn it into one, like items[int(n)].")
        if "does not support item assignment" in text:
            return ("change_str", "You can't change one letter inside words with [ ] =.",
                    'Make new words instead, like word = "H" + word[1:].')
        if "not supported between instances of" in text:
            return ("compare_mix", "You compared words with a number. Remember: input() always gives words, even \"8\".",
                    "Turn the words into a number first, like age = int(input(\"Age? \")).")
        if "can't multiply sequence by non-int" in text:
            return ("mix", "You can repeat words with a number, like \"Hi\" * 3, but not with other words or with 2.5.",
                    "Use a whole number, or turn words into a number with int().")
        if "has no len()" in text:
            return ("len", "len() counts the letters in words or the items in a list. A number has no length.",
                    "Use len() on words or a list, like len(\"hello\"), or turn the number into words with str().")
        if "not subscriptable" in text:
            return ("subscript", "Only lists, words and dictionaries can use [ ] to pick an item.",
                    "Check that the thing before [ ] is a list or words, or use ( ) if it's a function.")
        if "not iterable" in text:
            return ("iterable", "for can only go through a list, words or range(). A single number can't be looped over.",
                    "Use range(), like for i in range(5):")
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
        if "values to unpack" in text:
            return ("unpack", "The number of names on the left of = is different from the number of values on the right.",
                    "Use as many names as values, like a, b = 1, 2.")
        if re.search(r"invalid literal for int\(\) with base 10: ''", text) or "could not convert string to float: ''" in text:
            return ("empty_input", "Enter was pressed without typing a number first.",
                    "Type a number, like 8, and then press Enter.")
        if "not in list" in text:
            return ("not_in_list", "You asked the list for something that isn't in it.",
                    "Check the spelling, or check with if thing in my_list: before using it.")
        if "empty sequence" in text or "empty range" in text or "argument is empty" in text:
            return ("empty_list", "max(), min() or random.choice() got an empty list, with nothing to pick from.",
                    "Put some items in the list first.")
        if "invalid literal for int()" in text or "could not convert" in text:
            return ("not_number", "int() and float() turn words like \"8\" into numbers, but this wasn't a number.",
                    "Use digits only, like 8 or 3.5.")
        return "type", "The value isn't the right kind for this.", "Check the value you gave."
    if isinstance(error, IndexError):
        if "empty" in text:
            return ("empty_list", "The list is empty, so there's nothing to take or choose from it.",
                    "Put some items in the list first, like items = [\"a\", \"b\"].")
        what = "These words don't have a letter" if "string" in text else "The list doesn't have an item"
        return ("index", f"{what} at that place. Remember: counting starts at 0, so the first one is [0]!",
                "Use a smaller number inside [ ].")
    if isinstance(error, KeyError):
        return ("key", f"The dictionary has no key called {text}.", "Check the spelling of the key, or add it to the dictionary first.")
    if isinstance(error, AttributeError):
        m = re.search(r"'(\w+)' object has no attribute '(\w+)'", text)
        if m:
            kinds = {"str": ("words", str), "list": ("a list", list), "dict": ("a dictionary", dict),
                     "int": ("a number", int), "float": ("a number", float)}
            kind_name, kind = kinds.get(m.group(1), (m.group(1), None))
            close = difflib.get_close_matches(m.group(2), [a for a in dir(kind) if not a.startswith("_")], n=1, cutoff=0.6) if kind else []
            fix = f"Did you mean .{close[0]}()? Check the spelling after the dot." if close else "Check the spelling of the word after the dot."
            return ("attribute", f"{kind_name.capitalize()} can't use .{m.group(2)}.", fix)
        m = re.search(r"module '(\w+)' has no attribute '(\w+)'", text)
        if m:
            import sys as _sys
            mod = _sys.modules.get(m.group(1))
            names = {a.lower(): a for a in dir(mod) if not a.startswith("_")} if mod else {}
            close = [names[c] for c in difflib.get_close_matches(m.group(2).lower(), list(names), n=1, cutoff=0.6)]
            fix = f"Did you mean {m.group(1)}.{close[0]}? Spelling and small or capital letters must match." if close \
                else "Check the spelling of the word after the dot."
            return ("attribute", f"The {m.group(1)} helper has nothing called {m.group(2)}.", fix)
        return ("attribute", f"{text}.", "Check the spelling of the word after the dot.")
    if isinstance(error, EOFError):
        return "eof", "The program asked you to type something, but nothing was typed.", "Type your answer and press Enter."
    return "other", f"Python stopped with a {name}.", "Read the line shown above and check it carefully."


def explain(error, code, filename="<string>"):
    n, line = _line_of(error, code, filename)
    if isinstance(error, SyntaxError):
        kind, why, fix = _syntax(error, n, line)
        said = f"{type(error).__name__}: {error.msg}"
    else:
        kind, why, fix = _runtime(error, code, n)
        said = f"{type(error).__name__}: {error}"
    short = SHORT[kind]
    parts = [f"❌ {short}"]
    if n:
        parts.append(f"📍 Line {n}:  {line}" if line else f"📍 Line {n}")
    parts += [f"💡 Why: {why}", f"🔧 Try: {fix}", f"🐍 Python says: {said}"]
    return "\n".join(parts), short + (" 🙈" if kind in ("eof",) else " 💡")
