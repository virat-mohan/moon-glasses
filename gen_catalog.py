import csv

with open('feed.csv', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    items = [r for r in reader if r.get('availability') == 'in stock']

html = """<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<title>Moon Glasses Live Catalog (29 Products)</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f12; color: #fff; padding: 20px; }
  h1 { text-align: center; color: #f5f5f7; margin-bottom: 8px; }
  p.sub { text-align: center; color: #888; margin-bottom: 30px; font-size: 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; max-width: 1200px; margin: auto; }
  .card { background: #1c1c21; border-radius: 12px; padding: 16px; border: 1px solid #2a2a32; text-align: center; }
  .card img { width: 100%; height: 220px; object-fit: cover; border-radius: 8px; background: #26262e; }
  .title { font-size: 16px; font-weight: 600; margin: 12px 0 6px; color: #fff; }
  .price { font-size: 18px; font-weight: 700; color: #4ade80; margin-bottom: 8px; }
  .desc { font-size: 12px; color: #aaa; text-align: left; height: 50px; overflow: hidden; line-height: 1.4; margin-bottom: 12px; }
  .btn { display: inline-block; padding: 8px 14px; background: #3b82f6; color: #fff; border-radius: 6px; text-decoration: none; font-size: 12px; font-weight: 600; }
</style>
</head>
<body>
<h1>Moon Glasses Live Catalog</h1>
<p class='sub'>Total 29 In-Stock Products with Direct Image URLs & Prices</p>
<div class='grid'>
"""

for it in items:
    img = it.get('image_link') or it.get('additional_image_link')
    t = it.get('title', '')
    p = it.get('price', '').replace(' INR', '')
    d = it.get('description', '')
    html += f"""
    <div class='card'>
      <img src='{img}' alt='{t}'>
      <div class='title'>{t}</div>
      <div class='price'>₹{p}</div>
      <div class='desc'>{d}</div>
      <a href='{img}' target='_blank' class='btn'>Download / View Photo</a>
    </div>
"""

html += """
</div>
</body>
</html>
"""

with open('c:/Users/hp/Desktop/Manzil/moonglasses_catalog.html', 'w', encoding='utf-8') as out:
    out.write(html)
print(f"Generated moonglasses_catalog.html with {len(items)} products.")
