"""Clean a character picture made on a magenta or green background.

    python apps/tools/clean_picture.py in.png out.png --screen magenta   (or green, or none)

The background must already be see-through; this removes the coloured fringe ("spill") the magenta or
green screen leaves on the edges (hair, wings), and makes big pictures smaller so the app stays light.
Needs Pillow and numpy (pip install pillow numpy).
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter


def clean(src, dst, screen="none", max_size=900, edge=4):
    im = Image.open(src).convert("RGBA")
    im.thumbnail((max_size, max_size), Image.LANCZOS)
    a = np.asarray(im).astype(np.int16)
    rgb, alpha = a[..., :3], a[..., 3]
    # the edge: pixels within `edge` px of the see-through background
    clear = Image.fromarray(((alpha < 250) * 255).astype(np.uint8))
    near = np.asarray(clear.filter(ImageFilter.MaxFilter(2 * edge + 1))) > 0
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    fix = np.zeros_like(near)
    if screen == "magenta":
        spill = np.minimum(r, b) - g
        fix = near & (spill > 0)
        r[fix] -= spill[fix]
        b[fix] -= spill[fix]
    elif screen == "green":
        spill = g - np.maximum(r, b)
        fix = near & (spill > 0)
        g[fix] -= spill[fix]
    rgb[alpha == 0] = 0
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(dst, optimize=True)
    return screen, int(fix.sum())


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--screen", choices=["magenta", "green", "none"], default="none",
                   help="the colour of the background the picture was made on (none: only make it smaller)")
    p.add_argument("--max", type=int, default=900)
    args = p.parse_args()
    print(args.dst, *clean(args.src, args.dst, args.screen, args.max))
