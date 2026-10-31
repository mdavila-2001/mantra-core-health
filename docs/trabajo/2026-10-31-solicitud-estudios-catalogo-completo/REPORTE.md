> **AVANCE: 0 / 38 microtareas de producto — 0,0 %.** Planificación e investigación terminadas; H0 a medias (realineación del mapeo 3D en curso). No hay código de producto.

# Reporte — Solicitud de estudios con catálogo completo

- Fecha: 2026-10-31 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/brave-carson-h23qzh` (front, API y modelo; sincronizada con `dev`)
- Peldaño de evidencia: `DISCOVERED` + catálogos `VALIDATED` (JSON validados con `python3 -I`; códigos externos verificados contra tx.fhir.org, NLM, DICOM PS3.16 y RadLex Playbook por los agentes de investigación; no se ejecutó nada contra una base ni un navegador).

## Completado
| Qué | Dónde | Verificación |
|---|---|---|
| Hallazgos del front (bloque del médico, «Órdenes», simulador, primitivas, brechas B1–B11) | `hallazgos-front.md` | lectura de código + `check-max-lines` |
| Hallazgos API + modelo (esquema, terminología, DDL `v4.2.80`, C1–C6, V1–V11, autorización) | `hallazgos-api-modelo.md` | lectura de código y NDJSON versionados |
| Hallazgos del visor 3D y diseño de `app-body-region-picker` | `hallazgos-cuerpo-3d.md` | lectura + script sobre el atlas real |
| Catálogo de laboratorio: 532 análisis, 690 componentes, 49 muestras | `catalogo/laboratorio.json`, `laboratorio-FUENTES.md` | JSON válido; LOINC 2.83 verificado uno a uno; 10 ítems `verificar:true` |
| Catálogo de imagenología: 14 modalidades, 156 regiones, 471 estudios | `catalogo/imagenologia.json`, `imagenologia-FUENTES.md` | JSON válido; referencias cruzadas verificadas; 31 estudios sin código externo |
| Mapeo región → mallas del atlas (48 regiones, 419/930 mallas) | `catalogo/regiones-cuerpo-3d.json` | generado por script; en realineación a los códigos definitivos |
| Plan unificado con 15 decisiones adoptadas y franjas H0–H6 | `PLAN.md` | — |

## A medias
- **H0.M1** — realineación del mapeo 3D a los códigos de `imagenologia.json` (agente en curso). Falta: regenerar el JSON, actualizar §5 y §9 de `hallazgos-cuerpo-3d.md`.

## Pendiente
Todo H0.M2 → H6 (ver PLAN.md). Lo destraba: confirmar o corregir D1, D3 y D9 (§8 del plan); mientras, H0 y H1 pueden empezar.

## No cubierto
Ninguna ejecución: ni lint, ni typecheck, ni build, ni tests, ni base de datos, ni navegador. Nombres en español sin revisión clínica boliviana.

## Desvíos del plan predecesor
Reemplaza al plan `2026-10-31-estudios-muestra-y-region-corporal` y corrige: ORM MikroORM (no TypeORM); un solo PR a `dev` (sin `test`); región como concepto FK (no varchar); 88 códigos locales (no 92); alcance ampliado al visor 3D (`focus`).
