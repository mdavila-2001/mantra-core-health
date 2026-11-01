# Reporte — Atlas 3D: cuerpo femenino con piezas reales

> **AVANCE: 6 / 7 — 85,7 %.** La prueba visual quedó a medias (ver abajo).

- Fecha: 2026-10-27 → 2026-11-01 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/atlas-cuerpo-femenino` → PR a `dev`
- Peldaño de evidencia alcanzado: `TESTED` en el catálogo y el front; `VERIFIED_FUNCTIONAL_ONLY` en «Mujer» (Playwright real con WebGL, sin la ronda completa de capturas por viewport y tema).

## Qué cambió para quien usa el atlas

- **«Mujer» ahora muestra anatomía femenina real**: pelvis ósea femenina (ilion, isquion, pubis, sacro, cóccix), útero con 11 partes (cuello, orificios, fondo, cuerpo, paredes…), trompas con ampolla/istmo/infundíbulo/fimbria, ovarios y mamas con 8 partes cada una (lóbulos, conductos y senos galactóforos, areola, pezón, ligamentos, tejido adiposo). 45 piezas del Visible Human Female publicadas por el HuBMAP Human Reference Atlas (CC BY 4.0), alineadas al cuerpo de referencia.
- Cada pieza abre su ficha; «útero», «trompa uterina», «glándula mamaria» resaltan el órgano entero. Antes resaltaban nada (útero) o venas sin relación (cuello del útero).
- «Hombre» queda igual (las piezas femeninas se ocultan; los nodos de referencia no cambian: diferencia 0,000000 mm).
- Bug corregido: el esfínter anal externo y los pubococcígeos se escondían en «Mujer».
- El aviso deja de decir «no existe un modelo femenino libre» y dice qué sale de HuBMAP y qué sigue siendo del cuerpo de referencia (músculos, vasos, nervios). Vagina y vulva siguen sin malla libre y se listan aparte.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | 45 piezas femeninas en `skeleton.glb`/`organs.glb`, ICP pelvis 3,91 mm | `python -I tools/anatomy-atlas-3d/build_female_parts.py --cache …` | PASS — `evidencia/build_female_parts.txt` |
| H1.S1.M2 | Tres músculos del periné como `shared` | `build_models.py` + manifiesto | PASS |
| H1.S2.M1 | Catálogo regenerado: 15→17 estructuras femeninas con pieza, 0 compuestas perdidas | `yarn mock:anatomy-ontology` | PASS — `evidencia/gen-catalogo.txt` |
| H1.S3.M1 | `sex: 'female'` en tipo, visor y lógica | `yarn ng test --include …` (5 archivos) | 59/59 PASS — `evidencia/tests-atlas.txt` |
| H1.S3.M2 | Aviso, etiqueta accesible y lista en dos grupos | ídem + `yarn typecheck` + eslint | PASS |
| H1.S5.M1 | PR a `dev` | `gh pr create` | ver el PR |

## A medias

### H1.S4.M1 — Prueba visual
- Qué anda: Playwright con WebGL real (`start:demo`): «Mujer» abre el útero desde la lista y lo pinta en verde (conteo de píxeles), y lista la vagina sin pieza — 2/2 PASS (`evidencia/playwright-mujer.txt`). La captura de la pantalla muestra mamas y pelvis femenina en su lugar.
- Qué no anda: la corrida completa de `atlas-anatomico-3d` (8 casos de viewport/tema) falló en el login con `yarn dev` (apunta a la API real, no al simulador) — entorno, no producto; no se volvió a correr con `start:demo` por ahorro de uso.
- Qué falta: `yarn start:demo` y `yarn pw --workers=1 atlas-anatomico-3d`; mirar las capturas 375/768/1440 claro y 1440 oscuro.
- Dónde quedó: rama `claude/atlas-cuerpo-femenino`, compila.

## Pendiente
ninguna

## No cubierto
- Las 8 capturas por viewport y tema (ver A medias). La captura de la zona de trabajo del útero salió con el lienzo en blanco aunque la comprobación de píxeles del lienzo pasó.
- Revisión independiente (`NO_SELF_APPROVAL`): la hace quien revise el PR.

## Desvíos del plan
- La rama `test` está dada de baja: un solo PR a `dev`. `mockup` no se tocó.
- La lista «Piezas femeninas del modelo» filtra las clases genéricas («conducto», «tubérculo»): 51 entradas.

## Riesgos residuales
- `organs.glb` pasa de 295 KB a 829 KB y `skeleton.glb` de 885 KB a 974 KB; «Hombre» también los baja.
- Las piezas se escalan al cuerpo de referencia (escala 0,80): forma femenina, tamaño del modelo masculino.
- `build_models.py` reescribe los GLB: hay que correr `build_female_parts.py` después (documentado en los dos).

## Decisiones y ambigüedades
- A1: escala uniforme al cuerpo de referencia (ver riesgo). Confirmar con quien pidió el cambio.
- Nombres en castellano de 25 estructuras nuevas en `data/anatomy-ontology/es/HRA-FEMALE.json`: traducción automática sin revisión humana, rotulada como el resto.
