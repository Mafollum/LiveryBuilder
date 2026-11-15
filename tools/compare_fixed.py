"""Compares the app's fixed-element rendering with psd-tools.
Usage: python3 -I tools/compare_fixed.py <template.psd> <app.png> <side-by-side.png>
Prints coverage agreement (IoU of opaque pixels) and the mean colour difference where both are opaque.
"""
import re
import sys

import numpy as np
from PIL import Image
from psd_tools import PSDImage

FIXED = re.compile(r'(numb|nimber|numplate|sticker|icon|decal|sponsor|panel|banner|clamp|t cam|hinge)', re.I)
psd_path, app_path, out_path = sys.argv[1:4]
psd = PSDImage.open(psd_path)
ref = Image.new('RGBA', (psd.width, psd.height), (0, 0, 0, 0))
for layer in psd:
    if FIXED.search(layer.name) and 'metal plates' not in layer.name.lower() and layer.visible:
        im = layer.composite(viewport=(0, 0, psd.width, psd.height))
        if im is not None:
            ref.alpha_composite(im.convert('RGBA'))
r = np.asarray(ref).astype(int)
a = np.asarray(Image.open(app_path).convert('RGBA')).astype(int)
ro, ao = r[..., 3] > 127, a[..., 3] > 127
iou = (ro & ao).sum() / max(1, (ro | ao).sum())
both = ro & ao
diff = np.abs(r[..., :3] - a[..., :3])[both].mean() if both.any() else 0
print(f'{psd_path.split("/")[-1]}: coverage IoU {iou:.3f}, mean colour diff {diff:.1f}/255')
bg = Image.new('RGBA', (psd.width, psd.height), (128, 128, 128, 255))
left = bg.copy(); left.alpha_composite(ref)
right = bg.copy(); right.alpha_composite(Image.open(app_path).convert('RGBA'))
side = Image.new('RGB', (1600, 800)); side.paste(left.convert('RGB').resize((800, 800)), (0, 0)); side.paste(right.convert('RGB').resize((800, 800)), (800, 0))
side.save(out_path)
