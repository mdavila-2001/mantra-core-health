"""Extrae las imágenes y renderiza cada página de un PDF, y decodifica los QR que encuentre."""
import sys, io
import pymupdf, zxingcpp
from PIL import Image
doc = pymupdf.open(sys.argv[1])
found = set()
for page in doc:
    pix = page.get_pixmap(dpi=200)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    for r in zxingcpp.read_barcodes(img):
        found.add((r.format.name, r.text))
for f in sorted(found): print(*f)
if not found: print("NO_QR"); sys.exit(2)
