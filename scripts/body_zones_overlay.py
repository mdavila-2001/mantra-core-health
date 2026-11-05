"""Fit check for `split-body-zones.py --overlay`: the fine zones drawn over each render."""

from pathlib import Path


def overlay(profiles, folder: Path, polygons, centres, root: Path):
    from PIL import Image, ImageDraw

    folder.mkdir(parents=True, exist_ok=True)
    palette = [(230, 57, 70), (42, 157, 143), (233, 196, 106), (69, 123, 157), (244, 162, 97), (131, 56, 236)]
    for key, views in profiles.items():
        for v in views:
            img = Image.open(root / "public" / v["image"].lstrip("/")).convert("RGBA")
            s = img.width / float(v["viewBox"].split()[2])
            layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(layer)
            for i, (zid, _m, geom) in enumerate(v["fine"]):
                c = palette[i % len(palette)]
                for pol in polygons(geom):
                    draw.polygon([(x * s, y * s) for x, y in pol.exterior.coords], fill=c + (110,), outline=(0, 0, 0, 255))
                for x, y in centres(geom):
                    draw.text((x * s - 20, y * s - 6), zid, fill=(0, 0, 0, 255))
            Image.alpha_composite(img, layer).save(folder / f"{key}-{v['id']}.png")
