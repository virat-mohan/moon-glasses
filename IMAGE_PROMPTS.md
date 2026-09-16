# MOON GLASSES — Image Prompts

Reference aesthetic (moonglasses.vision, matched from your screenshots):
pure black backgrounds, high-contrast black-and-white crowd/portrait
photography with the sunglasses' lens colour as the only saturated colour
in frame (duotone effect), hard single-source flash lighting with deep
shadows, visible film grain, close-cropped editorial portraits mixed with
product-only shots in the same grid. Subjects are young (22-35), stylish,
confident — genuine energy (laughing, tongue-out, mid-motion), not posed
stock-photo smiles.

Save each image where noted and nothing else needs to change in the code.

---

## 1. Hero — homepage full-bleed banner
**Save as:** `public/images/brand/hero.jpg` (the site already looks for this file and will show it automatically)

```
Black and white documentary photo shot from directly above a dense crowd
of young, good-looking people (mixed genders, 22-35) packed together at a
night party, arms raised, phones and drinks in hand, several wearing
colourful mirrored sunglasses that are the only saturated colour in the
frame (hot pink, electric blue, amber lenses), hard direct flash
photography, heavy film grain, high contrast, moody low-key lighting, 35mm
analog style, no text, no logos, vertical negative space at the bottom
third for headline text to sit over.
```

---

## 2. Editorial portrait inserts (the single-person shots mixed into the product grid)
**Use:** as the "editorial split" images between product rows (section 27) — one portrait next to one product shot, alternating sides down the page.
**Save as:** `public/images/brand/editorial-01.jpg`, `-02.jpg`, `-03.jpg` etc.

```
Direct-flash editorial portrait of a strikingly good-looking [man in his
late 20s / woman in her late 20s] with an edgy, confident expression,
wearing bold mirrored or tinted sunglasses, plain white or black shirt,
shot against a plain dark studio background with a hard shadow cast
behind them, harsh on-camera flash look (slightly overexposed skin
highlights, crushed black shadows), 35mm film grain, fashion-editorial
mood, no text.
```

Variation for high-energy shots (laughing, tongue out, mid-shout):
```
Direct-flash candid portrait of a good-looking young person (22-30) caught
mid-laugh with mouth open and tongue out, wearing colourful tinted
sunglasses even though it's clearly night/indoors, dramatic single hard
flash from one side creating deep shadow on the other, dark studio or
party background completely out of focus, film grain, raw and sexy energy,
no text.
```

---

## 3. Product studio shots — reshoots for the 10 real SKUs
The current product photos are cropped video-frame grabs (blurry, poorly
framed) — replace them with proper studio shots using the base prompt
below, one per SKU. **Save as:** `public/images/chapters/<Product Name>/hero_no_bg.png` (exact folder names are in `lib/chapters.ts`).

```
Studio product photo of a single pair of [FRAME SHAPE] sunglasses, [FRAME
COLOR] frame, [LENS COLOR] lens, shot in three-quarter side profile,
resting on a dark reflective surface, single dramatic spotlight from the
upper left, near-black background fading to full black vignette,
realistic material reflections, ultra sharp focus, premium and moody, no
text, no model, no hands.
```

| Product | Frame shape | Frame color | Lens color |
|---|---|---|---|
| MOON P01 Midnight Square | square acetate | black | pale yellow |
| MOON P02 Tortoise Mint | square acetate | tortoiseshell | soft mint green |
| MOON P03 Black Olive | square acetate | black | warm olive |
| MOON P04 Blue Cat | cat-eye acetate | translucent blue | pale blue |
| MOON M01 Bordeaux Aviator | aviator, metal | silver | bordeaux/burgundy |
| MOON M02 Ink Aviator | aviator, metal | black | blue-grey |
| MOON M03 Black Luxe Square | square, metal | black | dark grey |
| MOON M04 Tortoise Rect | rectangular, metal | tortoiseshell trim, metal | brown |
| MOON M05 Forest Square | square, metal | deep navy-green | green |
| MOON M06 Champagne Oval | oval, metal | champagne/gold | pale gold |

---

## 4. "Worn By" crowd strip (homepage social-proof row)
**Save anywhere under** `public/images/community/` — 6-8 images, square crop.

```
Black and white candid photo of two or three good-looking young friends
(22-30) at a night party or rooftop event, laughing and dancing close
together, one wearing brightly coloured mirrored sunglasses (the only
colour in the frame), hard flash lighting, string lights or stage lasers
blurred in the background, 35mm film grain, high contrast, joyful and
confident energy, no text.
```
Vary the scene: "close-up over-the-shoulder selfie style", "sitting on a
friend's shoulders mid-cheer", "leaning into each other laughing", "walking
away from camera at night, sunglasses glinting" — keep the same
black-and-white-plus-lens-colour treatment across all of them so they read
as one consistent set.

---

## Style rules to repeat in every prompt
- Black and white / heavily desaturated base image — colour appears only in
  the sunglasses lenses.
- Hard, direct on-camera flash look (not soft studio light) for people
  shots — this is what makes it read as nightlife/editorial, not corporate.
- Visible 35mm film grain, never a clean digital render.
- No text, no watermarks, no logos baked into the image.
- Square (1:1) for product + crowd shots; tall/vertical or wide for hero
  and editorial portraits depending on placement.
