"""Stitch captured frames into one labelled filmstrip.

    python tests/sheet.py out.png frame1.png frame2.png ... [--cols 2] [--width 640]
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

args = sys.argv[1:]
cols, width = 2, 640
if '--cols' in args:
    i = args.index('--cols'); cols = int(args[i + 1]); del args[i:i + 2]
if '--width' in args:
    i = args.index('--width'); width = int(args[i + 1]); del args[i:i + 2]
out, frames = args[0], args[1:]

imgs = []
for f in frames:
    im = Image.open(f).convert('RGB')
    h = round(im.height * width / im.width)
    imgs.append((Path(f).stem, im.resize((width, h), Image.LANCZOS)))

rows = (len(imgs) + cols - 1) // cols
cell_h = max(im.height for _, im in imgs) + 22
sheet = Image.new('RGB', (cols * width + (cols - 1) * 6, rows * cell_h), (40, 40, 46))
draw = ImageDraw.Draw(sheet)
for n, (label, im) in enumerate(imgs):
    x = (n % cols) * (width + 6)
    y = (n // cols) * cell_h
    sheet.paste(im, (x, y + 22))
    draw.text((x + 6, y + 5), label, fill=(255, 200, 120))
sheet.save(out)
print(out, sheet.size)
