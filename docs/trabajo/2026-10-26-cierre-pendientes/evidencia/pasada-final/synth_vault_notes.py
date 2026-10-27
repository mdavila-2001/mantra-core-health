"""Escribe en una COPIA descartable de la bóveda las notas de las tablas de esta
noche, tomadas del modelo canónico (.puml para campos e índices, DDL generado
para el destino de cada FK). Sólo sirve de entrada a `yarn orm:catalog`; no se
versiona ni toca la bóveda compartida.

uso: python3 synth_vault_notes.py <modelo> <SALUD-copia> schema.tabla[:modulo] ...
"""
import re
import sys
from pathlib import Path

model, vault = Path(sys.argv[1]), Path(sys.argv[2])
targets = [(a.split(":")[0].split(".")[0], a.split(":")[0].split(".")[1], a.split(":")[1]) for a in sys.argv[3:]]
modules = model / "Mantra Core Health Context" / "modules"
sql = model / "SQL"


def block(text: str, header_re: str) -> str | None:
    m = re.search(header_re + r"[^\n]*\{\n(.*?)\n\}", text, re.S)
    return m.group(1) if m else None


fk_re = re.compile(
    r'ALTER TABLE "(\w+)"\."(\w+)"\s+ADD CONSTRAINT "\w+" FOREIGN KEY \(([^)]*)\)\s+'
    r'REFERENCES "(\w+)"\."(\w+)"',
    re.S,
)
all_fks = []
for f in sql.glob("*/0[3]_fk_intra.sql"):
    all_fks += fk_re.findall(f.read_text())
for f in sql.glob("*/90_fk_deferred.sql"):
    all_fks += fk_re.findall(f.read_text())

for schema, table, module in targets:
    puml = next(modules.glob(f"diagram_{module}_*.puml")).read_text()
    ent = block(puml, rf"\nentity {table} ")
    idx = block(puml, rf'\nentity "INDEXES · {table}" as idxset_{table} ')
    tags = f"---\ntags:\n  - entidad\n  - schema/{schema}\n  - modulo/{module}\n"
    if ent:
        (vault / "Entidades" / f"E {schema}.{table}.md").write_text(
            f"{tags}---\n# {table}\n\n## Campos\n```puml\n{ent}\n```\n")
    if idx:
        (vault / "Entidades" / f"E {schema}.idxset_{table}.md").write_text(
            f"{tags}  - tipo/index_set\n---\n# idxset_{table}\n\n## Campos\n```puml\n{idx}\n```\n")
    n = 0
    for s, t, cols, ts, tt in all_fks:
        if (s, t) != (schema, table):
            continue
        col = [c.strip().strip('"') for c in cols.split(",")][-1]
        (vault / "FK" / f"FK {schema}.{table}.{col}.md").write_text(
            f"---\ntags:\n  - fk\n  - schema/{schema}\n  - modulo/{module}\n---\n"
            f"# {table}.{col}  `<<FK>>`\n\n## Apunta a →\n- [[E {ts}.{tt}|{tt}]]\n")
        n += 1
    print(f"{schema}.{table}: entidad={'sí' if ent else 'no'} idxset={'sí' if idx else 'no'} fk={n}")
