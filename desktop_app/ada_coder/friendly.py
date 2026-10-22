"""Turns Python errors into short, kind explanations a 6 to 11 year old can act on."""
import re


def _quoted(message):
    m = re.search(r"'([^']*)'", message)
    return m.group(1) if m else ""


def _syntax_hint(message, code_line):
    msg = message.lower()
    if "was never closed" in msg or "unexpected eof" in msg:
        opener = _quoted(message) or "("
        closer = {"(": ")", "[": "]", "{": "}"}.get(opener, ")")
        return f"A bracket {opener} was opened but never closed. Add {closer} at the end."
    if "unterminated string" in msg or "eol while scanning" in msg or "unterminated triple-quoted" in msg:
        return 'Some text is missing its closing quote. Start and end text with the same quote: "like this".'
    if "expected ':'" in msg:
        return "Lines that start with if, elif, else, for, while or def need a colon : at the end."
    if "unmatched" in msg or "does not match opening" in msg:
        return "There's a closing bracket without a matching opening one. Count your ( and ) brackets."
    if "invalid character" in msg or "invalid non-printable" in msg:
        if any(ch in (code_line or "") for ch in "“”‘’"):
            return 'Use straight quotes " or \' instead of curly ones “ ”.'
        return "There's a strange character Python can't read. Try deleting it and typing it again."
    if "forgot a comma" in msg:
        return "Maybe a comma , is missing between two things."
    if "cannot assign to literal" in msg or "cannot assign to expression" in msg:
        return "The name goes on the left of =, and the value on the right. Like: age = 8"
    if "'=' " in message or "maybe you meant '=='" in msg:
        return "To check if two things are equal, use two equals signs: =="
    if "invalid decimal literal" in msg:
        return "A variable name can't start with a number. Try my_number instead of 1number."
    if "missing parentheses in call to 'print'" in msg:
        return 'print needs brackets: print("Hello")'
    return "Python couldn't understand this line. Check the brackets ( ), quotes \" \" and colons :."


def _indent_hint(message):
    msg = message.lower()
    if "expected an indented block" in msg:
        return "The line after a colon : needs 4 spaces at the start (press Tab)."
    if "unexpected indent" in msg:
        return "This line starts with spaces it doesn't need. Delete the spaces at the start."
    if "unindent does not match" in msg or "inconsistent use of tabs" in msg:
        return "The spaces at the start of the lines in this block don't line up. Make them the same."
    return "Check the spaces at the start of your lines. Lines inside a block need 4 spaces."


def explain(error_type, message, line=None, code_line=""):
    """Returns {"title", "hint", "line"} for the error card in the lesson screen."""
    message = str(message or "")
    where = f" on line {line}" if line else ""

    if error_type in ("IndentationError", "TabError"):
        return {"title": f"Wobbly spaces{where} 📏", "hint": _indent_hint(message), "line": line}

    if error_type == "SyntaxError":
        return {"title": f"Python got stuck{where} 🙈", "hint": _syntax_hint(message, code_line), "line": line}

    if error_type in ("NameError", "UnboundLocalError"):
        name = _quoted(message)
        hint = "Check the spelling, and capital letters too (print, not Print)."
        if name:
            hint += f" If {name} is a variable, give it a value first, like: {name} = 5"
        suggestion = re.search(r"Did you mean: '([^']+)'", message)
        if suggestion:
            hint = f"Did you mean {suggestion.group(1)}? " + hint
        return {"title": f"Python doesn't know “{name or 'that name'}”{where} 🤔", "hint": hint, "line": line}

    if error_type == "TypeError":
        msg = message.lower()
        if "can only concatenate str" in msg or ("unsupported operand" in msg and "str" in msg):
            hint = "You're mixing text and a number. Turn the number into text with str(...), or use a comma in print()."
        elif "positional argument" in msg or "missing" in msg and "argument" in msg:
            hint = "The function got the wrong number of things inside its brackets. Check how many it needs."
        elif "not callable" in msg:
            hint = "Something that isn't a function has brackets after it. Check for a missing * or a name you reused."
        elif "not subscriptable" in msg:
            hint = "Square brackets [ ] only work on lists, text and dictionaries."
        else:
            hint = message
        return {"title": f"Those things don't mix{where} 🧩", "hint": hint, "line": line}

    if error_type == "ValueError":
        if "invalid literal for int()" in message:
            hint = "int() needs a whole number like 7, but it got something else. Type digits only."
        elif "could not convert string to float" in message:
            hint = "float() needs a number like 3.5, but it got something else."
        else:
            hint = message
        return {"title": f"That value doesn't fit{where} 🔢", "hint": hint, "line": line}

    if error_type == "ZeroDivisionError":
        return {"title": f"Dividing by zero{where} 😄", "hint": "Nobody can divide by zero, not even Python! Use a different number.", "line": line}

    if error_type == "IndexError":
        return {"title": f"That item isn't there{where} 📋",
                "hint": "The list doesn't have that many items. Remember: counting starts at 0.", "line": line}

    if error_type == "KeyError":
        key = message.strip("'\"")
        return {"title": f"No “{key}” in the dictionary{where} 📖",
                "hint": "Check the spelling of the key, or add it to the dictionary first.", "line": line}

    if error_type == "AttributeError":
        return {"title": f"Can't find that{where} 🔍",
                "hint": "Check the spelling of the word after the dot, like text.upper()", "line": line}

    if error_type in ("ModuleNotFoundError", "ImportError"):
        module = _quoted(message) or "that"
        if module.split(".")[0] == "cv2":
            hint = "OpenCV (cv2) isn't installed. Ask a grown-up to reinstall Ada The Coder."
        else:
            hint = f"The {module} toolbox isn't installed on this computer. Check the spelling after import."
        return {"title": f"Missing toolbox{where} 🧰", "hint": hint, "line": line}

    if error_type == "EOFError":
        return {"title": "The program stopped 🛑", "hint": "It was waiting for you to type an answer.", "line": None}

    if error_type == "RecursionError":
        return {"title": f"A function kept calling itself{where} 🔁",
                "hint": "Make sure your function has a way to stop.", "line": line}

    if error_type == "TimeoutError":
        return {"title": "Your program ran for a long time ⏰",
                "hint": "Is there a loop that never ends? Check that the loop's condition can become False, or add break.",
                "line": None}

    if error_type == "EmptyCode":
        return {"title": "There's no code yet ✏️", "hint": "Type some code, or click an example to start.", "line": None}

    if error_type == "EmptyInput":
        return {"title": "You didn't type anything 🙈", "hint": "Type an answer, then press Enter.", "line": None}

    return {"title": f"Oopsie! {error_type}{where} 🙈", "hint": message, "line": line}
