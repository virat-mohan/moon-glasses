"""Builds the Instagram review images (1080x1350 slides, 1080x1920 story) from existing store images only.
Never stretches: product shots are trimmed and fitted (contain); model shots are cropped (cover) to 4:5.
Usage: python3 scripts/ig-review/build_images.py <dir with downloaded sources>  (reads products.source.json)"""
import json, sys, os
from PIL import Image, ImageChops, ImageDraw, ImageFont
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "public", "ig-review")
PAPER = (243, 241, 236)  # brand paper #F3F1EC
INK = (17, 17, 17); MUTED = (107, 105, 98); GOLD = (169, 134, 52)
W, H, SH = 1080, 1350, 1920
SERIF = "/System/Library/Fonts/Supplemental/Bodoni 72 OS.ttc"
SANS = "/System/Library/Fonts/Helvetica.ttc"

def trim(im):
    im = im.convert("RGBA")
    flat = Image.new("RGBA", im.size, (255, 255, 255, 255)); flat.alpha_composite(im)
    diff = ImageChops.difference(flat.convert("RGB"), Image.new("RGB", im.size, (255, 255, 255))).convert("L").point(lambda p: 255 if p > 14 else 0)
    box = diff.getbbox()
    return im.crop(box) if box else im

def on_paper(im, canvas_size, max_w, max_h, cy):
    """Place a trimmed product on paper. White pixels become paper (multiply), transparency too."""
    im = trim(im); s = min(max_w / im.width, max_h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    flat = Image.new("RGBA", im.size, (255, 255, 255, 255)); flat.alpha_composite(im)
    r, g, b = flat.convert("RGB").split()
    mul = Image.merge("RGB", [r.point(lambda v: v * PAPER[0] // 255), g.point(lambda v: v * PAPER[1] // 255), b.point(lambda v: v * PAPER[2] // 255)])
    return mul

def cover(im, w, h, top_bias=0.35):
    im = im.convert("RGB"); s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2; y = round((im.height - h) * top_bias)
    return im.crop((x, y, x + w, y + h))

def centered(draw, text, font, y, fill, w=SH and W):
    tw = draw.textlength(text, font=font); draw.text(((w - tw) / 2, y), text, font=font, fill=fill)

ps = json.load(open(os.path.join(os.path.dirname(__file__), "products.source.json")))
for o in ps:
    d = os.path.join(OUT, o["slug"]); os.makedirs(d, exist_ok=True)
    prod = Image.open(os.path.join(SRC, os.path.basename(o["productUrlFile"])))
    model = Image.open(os.path.join(SRC, os.path.basename(o["modelUrlFile"])))
    # slide 1: product on paper
    p = on_paper(prod, (W, H), 940, 700, 0)
    s1 = Image.new("RGB", (W, H), PAPER); s1.paste(p, ((W - p.width) // 2, (H - p.height) // 2 - 20))
    s1.save(os.path.join(d, "slide1.jpg"), quality=88, optimize=True, progressive=True)
    # slide 2: model, cropped to 4:5
    cover(model, W, H).save(os.path.join(d, "slide2.jpg"), quality=88, optimize=True, progressive=True)
    # story 9:16: model on top (4:5), product + name + price below
    st = Image.new("RGB", (W, SH), PAPER); st.paste(cover(model, W, H), (0, 0))
    p2 = on_paper(prod, (W, SH), 560, 260, 0); st.paste(p2, ((W - p2.width) // 2, 1392 + (260 - p2.height) // 2))
    dr = ImageDraw.Draw(st)
    name = o["name"].split(" — ")[0]; colour = o["name"].split(" — ")[1] if " — " in o["name"] else ""
    centered(dr, name, ImageFont.truetype(SERIF, 62, index=0), 1676, INK)
    centered(dr, f"{colour}  ·  ₹{o['price']:,}  ·  free shipping".upper() if colour else f"₹{o['price']:,}", ImageFont.truetype(SANS, 28), 1760, MUTED)
    st.save(os.path.join(d, "story.jpg"), quality=88, optimize=True, progressive=True)
    print("ok", o["slug"])

# Standard: every post and story carries the Moon Glasses logo top-left.
sys.path.insert(0, os.path.dirname(__file__))
from stamp_logo import stamp_folder
for o in ps:
    d = os.path.join(OUT, o["slug"])
    if os.path.exists(os.path.join(d, ".logo")): os.remove(os.path.join(d, ".logo"))  # images were just rebuilt unstamped
    stamp_folder(d)
