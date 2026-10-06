"""Stamps the Moon Glasses logo top-left on every Instagram image (standard for all posts and stories).
Product-on-paper images get the gold logo directly; photos get it on a soft paper plate so it stays readable.
Stories start lower (230px) to clear Instagram's own profile bar. Idempotent: a <slug>/.logo marker stops a folder being stamped twice. Re-run build_images.py (which calls
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
    img = img.convert("RGB"); lg = _logo()
    if plate:
        pad = 22; box = (MARGIN - pad, top - pad, MARGIN + lg.width + pad, top + lg.height + pad)
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(layer).rounded_rectangle(box, radius=18, fill=PAPER + (225,))
        img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    base = img.convert("RGBA"); base.alpha_composite(lg, (MARGIN, top)); return base.convert("RGB")

def stamp_folder(d):
    if os.path.exists(os.path.join(d, ".logo")): return False
    for f, plate, top in (("slide1.jpg", False, MARGIN), ("slide2.jpg", True, MARGIN), ("story.jpg", True, 230)):
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
