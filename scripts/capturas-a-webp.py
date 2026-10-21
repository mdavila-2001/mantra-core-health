"""Convierte las capturas PNG de una carpeta a WebP (calidad 82) y mueve los
PNG originales a otra carpeta fuera del repositorio.

Las capturas de `playwright/movil-captura.spec.ts` son planos de color y pesan
~0,6 MB en PNG: 217 pantallas × 2 temas × 2 fases serían ~460 MB en git. En WebP
son ~40 MB por fase y se siguen leyendo igual a ojo.

    python3 -I scripts/capturas-a-webp.py <carpeta-de-capturas> <carpeta-de-originales>
"""
import sys, pathlib
from PIL import Image
raiz = pathlib.Path(sys.argv[1]); orig = pathlib.Path(sys.argv[2])
antes = despues = 0
for png in sorted(raiz.rglob('*.png')):
    im = Image.open(png).convert('RGB')
    out = png.with_suffix('.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    antes += png.stat().st_size; despues += out.stat().st_size
    dest = orig / png.relative_to(raiz); dest.parent.mkdir(parents=True, exist_ok=True)
    png.rename(dest)
print(f'{antes/1e6:.0f} MB png -> {despues/1e6:.0f} MB webp')
