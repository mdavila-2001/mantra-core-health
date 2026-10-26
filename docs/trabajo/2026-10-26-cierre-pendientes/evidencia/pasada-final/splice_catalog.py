"""Inserta en el catálogo versionado SOLO las tuplas que `yarn orm:catalog`
produjo para las tablas de esta noche (diff entre la corrida base y la corrida con
las notas sintetizadas), sin arrastrar el ruido de orden/bóveda del resto.

uso: python3 splice_catalog.py <cat-base> <cat-synth> <catalogo-repo> <excluir-regex>
"""
import re
import sys
from pathlib import Path

base, synth, repo, exclude = (Path(sys.argv[1]), Path(sys.argv[2]),
                              Path(sys.argv[3]), re.compile(sys.argv[4]))
row = re.compile(r"^  \['([a-z0-9_]+)',")
count_re = re.compile(r"^( \* )(\d+)( (?:restricciones|definiciones)\.)")

for kind in ("foreign-keys", "indexes"):
    for synth_file in sorted((synth / kind).glob("*.ts")):
        base_lines = set((base / kind / synth_file.name).read_text().splitlines())
        new = [l for l in synth_file.read_text().splitlines()
               if row.match(l) and l not in base_lines and not exclude.search(l)]
        if not new:
            continue
        target = repo / kind / synth_file.name
        lines = target.read_text().splitlines()
        for tuple_line in new:
            if tuple_line in lines:
                continue
            table = row.match(tuple_line).group(1)
            rows = [i for i, l in enumerate(lines) if row.match(l)]
            same = [i for i in rows if row.match(lines[i]).group(1) == table]
            if same:
                at = same[-1] + 1
            else:
                after = [i for i in rows if row.match(lines[i]).group(1) > table]
                at = after[0] if after else rows[-1] + 1
            lines.insert(at, tuple_line)
            for i, l in enumerate(lines):
                m = count_re.match(l)
                if m:
                    lines[i] = f"{m.group(1)}{int(m.group(2)) + 1}{m.group(3)}{l[m.end():]}"
                    break
        target.write_text("\n".join(lines) + "\n")
        print(f"{kind}/{synth_file.name}: +{len(new)}")
