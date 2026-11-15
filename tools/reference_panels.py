"""Independent reference for panel maps, using psd-tools.

Renders the template's mask layer (pixel alpha x layer mask) and treats coverage < 128 as panel.
Usage: python3 -I tools/reference_panels.py <template.psd> <out.png> [--compare <app-map.png>]
Requires: pip install psd-tools pillow numpy
"""
import sys

import numpy as np
from PIL import Image
from psd_tools import PSDImage


def is_mask(name: str) -> bool:
    n = name.strip().lower()
    return 'disable for export' in n or n.startswith('mask') or n.startswith('maks')


def main() -> None:
    psd_path, out_path = sys.argv[1], sys.argv[2]
    psd = PSDImage.open(psd_path)
    layer = next(l for l in psd if not l.is_group() and is_mask(l.name))
    layer.visible = True
    alpha = np.asarray(layer.composite(viewport=(0, 0, psd.width, psd.height), force=True).convert('RGBA'))[..., 3]
    panel = alpha < 128
    Image.fromarray((panel * 255).astype(np.uint8)).save(out_path)
    if '--compare' in sys.argv:
        app = np.asarray(Image.open(sys.argv[sys.argv.index('--compare') + 1]).convert('L')) > 127
        diff = float(np.mean(app != panel))
        print(f'{psd_path}: {diff * 100:.3f}% of pixels differ')


if __name__ == '__main__':
    main()
