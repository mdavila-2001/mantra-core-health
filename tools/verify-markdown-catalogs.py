#!/usr/bin/env python3
"""Comprueba, fila por fila, que cada dato de `markdown_convertidos/` está en la maqueta.

No reutiliza el código de `extract-markdown-catalogs.py`: vuelve a leer los doce
`.md` con su propio parser y los compara contra los `*.generated.ts` que carga el
simulador. Si el extractor pierde una fila, esto lo dice con el número de fila.

Además comprueba lo contrario para los datos personales: que ninguna cédula,
celular ni correo de las planillas de usuarios aparezca en el repositorio.

Uso:
    python3 tools/verify-markdown-catalogs.py <carpeta markdown_convertidos>

Sale en 0 sólo si todo cuadra.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

FIXTURES = Path("src/app/core/mock/fixtures")
failures: list[str] = []
report: list[tuple[str, int, int, str]] = []


def norm(text: str | None) -> str:
    plain = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode().upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", plain).split())


def tokens(text: str | None) -> frozenset[str]:
    return frozenset(norm(text).split())


def rows(path: Path, stop: str | None = None) -> list[list[str]]:
    out = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if stop and line.startswith("## ") and stop in line:
            break
        if line.startswith("|") and not line.startswith("| ---"):
            out.append([c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", line.strip().strip("|"))])
    return out


def generated(file: str, name: str):
    text = (FIXTURES / file).read_text(encoding="utf-8")
    match = re.search(rf"export const {name}: [^=]+= (.*?);\n", text, re.S)
    if match is None:
        raise SystemExit(f"{file}: no encuentro {name}")
    return json.loads(match.group(1))


def check(label: str, total: int, missing: list[str], note: str = "") -> None:
    report.append((label, total, total - len(missing), note))
    failures.extend(f"{label}: {m}" for m in missing[:20])


def main() -> None:
    src = Path(sys.argv[1])

    # 1-2. Redes médicas: cada fila → su médico, su especialidad, su consultorio y su plan.
    red = generated("insurer-network.generated.ts", "INSURER_NETWORK_PRACTITIONERS")
    by_name: dict[frozenset[str], list[dict]] = {}
    for p in red:
        by_name.setdefault(tokens(f"{p['surnames']} {p['givenNames']}"), []).append(p)
    for file, insurer, cols in (
        ("Alianza_Medicos_Habilitados.md", "Alianza Seguros", (2, 1, 4, 3)),
        ("Nacional_Seguros_Red_Medica_Bolivia.md", "Nacional Seguros", (2, 1, 3, 5)),
    ):
        body = rows(src / file)[1:]
        missing = []
        for i, row in enumerate(body, start=1):
            name, specialty, address, plans = (row[c] for c in cols)
            candidates = by_name.get(tokens(name), [])
            ok = any(
                any(norm(o["address"]) == norm(address) for o in p["offices"])
                and any(norm(s) in norm(specialty) or norm(specialty).startswith(norm(s)) for s in p["specialties"])
                and any(
                    n["insurer"] == insurer and all(pl.strip() in n["plans"] for pl in plans.split(",") if pl.strip())
                    for n in p["networks"]
                )
                for p in candidates
            )
            if not ok:
                missing.append(f"fila {i}: {name} · {specialty} · {address[:40]}")
        check(file, len(body), missing)

    # 3. Arancel médico: la fila i de la hoja es la prestación i, en orden.
    medical = generated("fee-schedules.generated.ts", "MEDICAL_FEE_SCHEDULE")
    body = rows(src / "Arancel_Honorarios_Medicos_Santa_Cruz_2025_3_columnas.md", stop="Referencia")[1:]
    missing = []
    if len(body) != len(medical):
        missing.append(f"{len(body)} filas en la hoja y {len(medical)} en la maqueta")
    for i, (row, item) in enumerate(zip(body, medical), start=1):
        if row[0] != item["specialty"] or (row[1] and row[1] not in item["display"]):
            missing.append(f"fila {i}: {row[:2]}")
        uma = row[-1] if len(row) > 2 else ""
        if re.fullmatch(r"\d+(?:[.,]\d+)?", uma) and item["referencePrice"] != uma.replace(",", "."):
            missing.append(f"fila {i}: UMA {uma} ≠ {item['referencePrice']}")
    declared = re.search(r"Registros extraídos \| (\d+)", (src / "Arancel_Honorarios_Medicos_Santa_Cruz_2025_3_columnas.md").read_text(encoding="utf-8"))
    note = f"la hoja «Referencia» declara {declared.group(1)}" if declared else ""
    if declared and int(declared.group(1)) != len(medical):
        missing.append(f"la hoja Referencia declara {declared.group(1)} y hay {len(medical)}")
    check("Arancel médico 2025", len(body), missing, note)

    # 4. Arancel odontológico: cada renglón con precio o numerado.
    dental = generated("fee-schedules.generated.ts", "DENTAL_FEE_SCHEDULE")
    notes = generated("fee-schedules.generated.ts", "DENTAL_FEE_SCHEDULE_NOTES")
    lines = (src / "LISTADO_ARANCEL_ODONTOLOGICO_2026_1.md").read_text(encoding="utf-8").splitlines()
    body = [r for r in rows(src / "LISTADO_ARANCEL_ODONTOLOGICO_2026_1.md") if r[0] != "Concepto"]
    texts = " || ".join(norm(f"{i['group'] or ''} {i['display']} {i['referencePrice'] or ''}") for i in dental)
    missing = []
    for i, row in enumerate(body, start=1):
        concept = norm(re.sub(r"^(\d+|[a-z])\)\s*", "", row[0]).rstrip(" 0"))
        if concept and concept not in texts:
            missing.append(f"renglón {i}: {row[0]}")
        if row[1] and norm(row[1]) not in texts:
            missing.append(f"renglón {i}: precio {row[1]}")
    observations = [ln for ln in lines if ln.startswith("*Observ")]
    for obs in observations:
        if not any(norm(obs.strip("*"))[:30] in norm(n["text"]) for n in notes):
            missing.append(f"observación: {obs[:40]}")
    check("Arancel odontológico 2026", len(body) + len(observations), missing, f"{len(dental)} prestaciones + {len(notes)} observaciones")

    # 5-7. Clínicas, hospitales y aseguradoras.
    instituciones = {
        "CLINICAS_REALES": generated("instituciones.generated.ts", "CLINICAS_REALES"),
        "HOSPITALES_REALES": generated("instituciones.generated.ts", "HOSPITALES_REALES"),
        "ASEGURADORAS_REALES": generated("instituciones.generated.ts", "ASEGURADORAS_REALES"),
    }

    def present(pool: list[dict], name: str, *values: str) -> bool:
        for item in pool:
            if norm(item["name"]) == norm(name) or norm(item.get("shortName")) == norm(name):
                blob = norm(json.dumps(item, ensure_ascii=False))
                if all(norm(v) in blob for v in values if v):
                    return True
        return False

    body = rows(src / "LISTA_DE_CLINICAS_PRIVADAS_1.md")[1:]
    check("Clínicas privadas", len(body), [
        f"{r[0]}" for r in body if not present(instituciones["CLINICAS_REALES"], r[0], r[1], r[2], r[4])
    ])
    body = [r for r in rows(src / "LISTA_DE_HOSPITAL_DE_TERCER_SEGUNDO_NIVEL_Y_CAJAS_1.md") if r[0] != "ESTABLECIMIENTO"]
    check("Hospitales 3.º/2.º nivel y cajas", len(body), [
        r[0] for r in body if not present(instituciones["HOSPITALES_REALES"], r[0], r[1])
    ])
    body = [r for r in rows(src / "LISTADO_DE_ASEGURADORAS_1.md") if r[0] and r[0] not in ("NOMBRE EMPRESA", "PRINCIPALES ASEGURADORAS GENERALES Y FIANZAS")]
    names = [(r[0], r[2]) for r in body]
    check("Aseguradoras", len(names), [
        n for n, nit in names if not any(norm(a["name"]) == norm(n) and a["taxId"] == nit for a in instituciones["ASEGURADORAS_REALES"])
    ] + ([] if len(names) == len(instituciones["ASEGURADORAS_REALES"]) else [f"{len(names)} filas y {len(instituciones['ASEGURADORAS_REALES'])} aseguradoras"]),
    "BISA y Fortaleza figuran en los dos ramos: 19 filas, 19 fichas")
    conceptos = (FIXTURES / "conceptos.ts").read_text(encoding="utf-8")
    departments = [r[5] for r in rows(src / "LISTADO_DE_ASEGURADORAS_1.md") if len(r) > 5 and r[5] and r[5] != "DEPARTAMENTO"]
    check("Aseguradoras · tabla de departamentos", len(departments), [
        d for d in departments if not any(norm(d).startswith(norm(x)) or norm(x).startswith(norm(d)) for x in re.findall(r"\['geo:bo:department:\w+', '([^']+)'\]", conceptos))
    ], "ya son el catálogo VS_BO_DEPARTMENT")

    # 8. Especialidades odontológicas.
    body = rows(src / "LISTA_DE_ESPECIALIDADES_ODONTOLOGICAS.md")[1:]
    labels = [norm(x) for x in re.findall(r"\['[A-Z_]+', '([^']+)'", conceptos)]
    check("Especialidades odontológicas", len(body), [
        r[1] for r in body if norm(r[1]) not in labels and norm(r[1]).replace(" GENERAL", "") not in labels
    ], "ODONTOLOGIA GENERAL = «Odontología»")

    # 9. Farmacias, laboratorios y análisis.
    pool = generated("markdown-institutions.generated.ts", "PHARMACIES_AND_LABS")
    body = [r for r in rows(src / "LISTA_DE_FARMACIAS__LABORATORIOS_Y_ANALISIS_MEDICOS.md") if r[0] != "NOMBRE COMERCIAL"]
    check("Farmacias, laboratorios y análisis", len(body), [
        r[0] for r in body
        if not any(
            i["name"] == r[0] and (i["legalName"] or "") == r[1] and (i["taxId"] or "") == r[2]
            and (i["phone"] or "") == r[3] and (i["address"] or "") == r[4]
            for i in pool
        )
    ])

    # 10. Primer nivel.
    pool = generated("markdown-institutions.generated.ts", "PRIMARY_CARE_CENTERS")
    body = rows(src / "LISTA_DE_HOSPITAL_DE_PRIMER_NIVEL_SANTA_CRUZ_1.md")[1:]
    keys = {(norm(i["municipality"]), norm(i["name"]), norm(i["address"])) for i in pool}
    check("Primer nivel Santa Cruz", len(body), [
        f"{r[1]} · {r[2]}" for r in body if (norm(r[1]), norm(r[2]), norm(r[3])) not in keys
    ] + ([] if len(pool) == len(body) else [f"{len(body)} filas y {len(pool)} centros"]))

    # 11-12. Usuarios: toda persona está; ningún dato sensible viaja.
    sensitive: list[str] = []
    for file, const in (("USUARIO_MEDICOS_1.md", "REGISTERED_PRACTITIONERS"), ("USUARIO_PACIENTES_1.md", "REGISTERED_PATIENTS")):
        table = rows(src / file)
        header, body = table[0], table[1:]
        people = [dict(zip(header, r)) for r in body if r[1] or r[3]]
        pool = generated("registered-people.generated.ts", const)
        have = {tokens(" ".join(filter(None, [p["givenName"], p["middleName"], p["surname"], p["motherSurname"]]))) for p in pool}
        check(file, len(people), [
            f"fila {p['NUMERO']}: {p['NOMBRE']} {p['APELLIDO PATERNO']}"
            for p in people
            if tokens(" ".join([p["NOMBRE"], p["NOMBRE 2"], p["APELLIDO PATERNO"], p["APELLIDO MATERNO"]])) not in have
        ], f"{len(body) - len(people)} filas vacías de la plantilla")
        for p in people:
            sensitive += [v for k, v in p.items() if k in ("CEDULA IDENTIDAD", "NUMERO CELULAR", "CORREO ELECTRONICO") and len(v) >= 6]

    # Lo que escribe este pipeline. Un teléfono que la aseguradora publica en
    # su red médica ya es público y no cuenta como filtración.
    written = [
        *(FIXTURES / f for f in ("insurer-network.generated.ts", "fee-schedules.generated.ts", "markdown-institutions.generated.ts", "registered-people.generated.ts", "insurer-network.ts", "registered-people.ts")),
        *(p for d in ("insurer-networks", "fee-schedules", "markdown-institutions", "registered-people") for p in (Path("data") / d).glob("*.json")),
    ]
    haystack = "\n".join(p.read_text(encoding="utf-8") for p in written).upper()
    public = "\n".join((src / f).read_text(encoding="utf-8") for f in ("Alianza_Medicos_Habilitados.md", "Nacional_Seguros_Red_Medica_Bolivia.md")).upper()
    leaked = [v for v in set(sensitive) if v.upper() in haystack and v.upper() not in public]
    check("Privacidad · cédulas, celulares y correos ausentes del repo", len(set(sensitive)), leaked)

    width = max(len(r[0]) for r in report)
    total_rows = total_ok = 0
    for label, total, ok, note in report:
        total_rows += total
        total_ok += ok
        mark = "OK " if ok == total else "FALTA"
        print(f"{mark} {label.ljust(width)}  {ok:>5}/{total:<5} {note}")
    print(f"\nTOTAL {total_ok}/{total_rows} ({100 * total_ok / total_rows:.2f} %)")
    if failures:
        print("\nFaltantes:")
        for f in failures:
            print("  -", f)
        sys.exit(1)


if __name__ == "__main__":
    main()
