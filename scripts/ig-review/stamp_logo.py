"""Stamps the Moon Glasses logo top-left on every Instagram image (standard for all posts and stories).
The logo is placed on a transparent background (no plate); photos get a soft shadow so it stays readable.
Stories sit 110px down, just clear of the edge. Idempotent: a <slug>/.logo marker stops a folder being stamped twice. Re-run build_images.py (which calls
stamp()) to regenerate from sources. Usage: python3 scripts/ig-review/stamp_logo.py [slug ...]  (default: all)"""
import os, sys
from PIL import Image, ImageDraw, ImageChops
ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
OUT = os.path.join(ROOT, "public", "ig-review")
LOGO = os.path.join(ROOT, "public", "images", "brand", "moon-glasses-logo.png")
PAPER = (243, 241, 236)
WIDTH, MARGIN = 230, 44

def _logo():
    im = Image.open(LOGO).convert("RGBA"); im = im.crop(im.getbbox())
    return im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)

def stamp(img, plate, top=MARGIN):
    """Logo on a transparent background. On photos it gets a soft shadow (no plate) so it stays readable."""
    base = img.convert("RGBA"); lg = _logo()
    if plate:
        from PIL import ImageFilter
        sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
        mask = Image.new("L", lg.size, 0); mask.paste(lg.getchannel("A"))
        dark = Image.new("RGBA", lg.size, (0, 0, 0, 255)); dark.putalpha(mask.point(lambda v: v * 0.55))
        sh.alpha_composite(dark, (MARGIN, top + 3))
        base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5)))
    base.alpha_composite(lg, (MARGIN, top)); return base.convert("RGB")

def stamp_folder(d):
    if os.path.exists(os.path.join(d, ".logo")): return False
    for f, plate, top in (("slide1.jpg", False, MARGIN), ("slide2.jpg", True, MARGIN), ("story.jpg", True, 110)):
        p = os.path.join(d, f)
        if os.path.exists(p):
            stamp(Image.open(p), plate, top).save(p, quality=88, optimize=True, progressive=True)
    open(os.path.join(d, ".logo"), "w").write("stamped")
    return True

if __name__ == "__main__":
    slugs = sys.argv[1:] or sorted(os.listdir(OUT))
    for s in slugs:
        d = os.path.join(OUT, s)
        if os.path.isdir(d): print("stamped" if stamp_folder(d) else "skip", s)
