"""Character packs. Each pack decides who appears on the home screen and in the lessons.

To add a pack: put its pictures in assets/images and add an entry below.
  hero     three friends shown on the home screen: (name, picture, emoji if the picture is missing)
  guide    points at the examples when a lesson opens
  success  celebrates when code works
  oops     explains what went wrong when code has a mistake
"""
THEMES = {
    "friends": {
        "name": "Friends Adventure",
        "tagline": "Learn Python with Tom, Penny & Teddy! 🚀",
        "hero": [("Tom", "tom.png", "🧒"), ("Penny", "penny.png", "🐍"), ("Teddy", "teddy.png", "🧸")],
        "guide": "ada.png",
        "success": "teddy.png",
        "oops": "tom.png",
    },
    "fairies": {
        "name": "Fairies & Angels",
        "tagline": "Code some magic with Twinkle, Fern & Sparkle! ✨",
        "hero": [("Twinkle", "twinkle.png", "🧚"), ("Fern", "fern.png", "🧚"), ("Sparkle", "sparkle.png", "🦄")],
        "guide": "twinkle.png",
        "success": "sparkle.png",
        "oops": "fern.png",
    },
    "coding_club": {
        "name": "Ada's Coding Club",
        "tagline": "Code along with Ada and Byte the owl! 🦉",
        "hero": [("Ada", "ada.png", "👧"), ("Byte", "byte.png", "🦉"), ("Penny", "penny.png", "🐍")],
        "guide": "ada.png",
        "success": "byte.png",
        "oops": "byte.png",
    },
}
DEFAULT_THEME = "friends"


def get_theme(key):
    return THEMES.get(key) or THEMES[DEFAULT_THEME]
