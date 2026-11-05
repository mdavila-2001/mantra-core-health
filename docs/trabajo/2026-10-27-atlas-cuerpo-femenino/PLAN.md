# Plan — Atlas 3D: cuerpo femenino con piezas reales

- Fecha: 2026-10-27 · Repos afectados: `mantra-core-health` (ramas `dev`, `test`, `mockup`) · Predecesor: `feat(atlas)` #1285 y `fix(glosario)` 96bbb3813
- Resultado observable: en `/glosario/atlas-3d?sex=female` la persona ve un cuerpo femenino — pelvis femenina, útero con cuello, trompas, ovarios y mamas con sus partes — puede tocar cada pieza y abrir su ficha; «Hombre» queda como estaba.
- Kill-test: abrir la vista «Mujer», tocar la pelvis menor y que no aparezca ningún útero, o que la ficha de «útero» siga diciendo «sin pieza 3D».

## Hallazgos (fase 1)

- La vista «Mujer» nunca tuvo malla femenina: muestra el cuerpo masculino de BodyParts3D sin genitales (`anatomy-viewer.ts`, `pintar`) y lista 121 estructuras femeninas «sin pieza» (`ATLAS_3D_FEMALE_ONLY_IDS`, `femaleOnlyWithMesh: 0`).
- El aviso de la pantalla dice que no existe un modelo femenino libre. Sí existe: el **HuBMAP Human Reference Atlas** publica órganos de referencia 3D del Visible Human Female con **CC BY 4.0** (útero v1.2, ovarios v1.3, trompas v1.2, mamas v1.1, pelvis v1.3, esternón y manubrio v1.0), con tabla de cruce nodo → UBERON/FMA por órgano (`crosswalk.csv`).
- Bug aparte: `build_models.py` marca como `male` todo lo que cuelga del sistema genital del FMA, y eso incluye el esfínter anal externo (`FMA21930`) y los pubococcígeos (`FMA45854`, `FMA45855`), que existen en los dos sexos: la vista «Mujer» los esconde.
- El generador del catálogo reproduce byte a byte el catálogo de `dev` (`yarn mock:anatomy-ontology` sin diff): es seguro regenerar.

## Alcance

- IN: script nuevo `tools/anatomy-atlas-3d/build_female_parts.py` (baja HRA, alinea, reduce, agrega nodos a `skeleton.glb` y `organs.glb`, escribe el manifiesto y `data/anatomy-ontology/hra-female-parts.json`); el generador lee esas piezas; `AnatomyPart.sex` admite `female`; el visor dibuja `female` sólo en «Mujer» y `male` sólo en «Hombre»; textos de la pantalla y atribución de HuBMAP; fix de los tres músculos.
- OUT: vagina y vulva (HRA no las publica: siguen como fichas sin pieza, y la pantalla lo dice); músculos, vasos y nervios femeninos (no hay malla libre: se usan los de referencia); reconstruir las mallas de BodyParts3D.
- Ambigüedades registradas: (A1) la pelvis y el tórax femeninos se escalan al tamaño del cuerpo de referencia con escala uniforme — conservan su forma femenina pero no su tamaño absoluto; confirmar con quien pidió el cambio.

## H1 — «Mujer» muestra anatomía femenina real
**CA:** Dado el atlas en «Mujer», cuando se carga, entonces se ven la pelvis femenina, el útero, las trompas, los ovarios y las mamas en su lugar, y al tocar el útero se abre su ficha.
**DoD:** typecheck · lint de lo tocado · specs del visor, la lógica y la página · Playwright del atlas · capturas en navegador (móvil, tablet, escritorio; claro y oscuro).
**Estado:** A MEDIAS (ver REPORTE.md)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Script HRA: baja, alinea (ICP pelvis, esternón para el tórax), reduce y agrega nodos | GLB válidos con nodos `VH_F_*`; error medio de la pelvis < 6 mm | salida del script en `evidencia/build_female_parts.txt` | HECHO |
| H1.S1.M2 | Fix de sexo de los tres músculos en `build_models.py` y manifiesto | `FMA21930`, `FMA45854`, `FMA45855` con `shared` | `grep` en `parts.json` | HECHO |
| H1.S2.M1 | Generador lee `hra-female-parts.json` y fuente HuBMAP | `femaleOnlyWithMesh` > 0 | `yarn mock:anatomy-ontology` | HECHO |
| H1.S3.M1 | Tipo `sex` con `female` + visor + lógica | spec del visor y de la lógica en verde con casos `female` | `yarn ng test --include …` | HECHO |
| H1.S3.M2 | Textos de la página: aviso, etiqueta del visor, lista femenina en dos grupos | el aviso nombra HuBMAP y lo que falta | spec de la página | HECHO |
| H1.S4.M1 | Prueba visual | capturas mirando la pelvis y el tórax en «Mujer» | Playwright + capturas en `evidencia/` | A MEDIAS |
| H1.S5.M1 | Abrir PR a `dev` (`test` dada de baja) | PR abierto contra `dev` | URLs de los PR | HECHO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Las mallas HRA pesan (mama derecha 585 k triángulos) | GLB grandes para «Hombre», que también los baja | reducción con presupuesto por pieza; medir tamaño antes/después |
| El cuerpo femenino es de otra persona: la pelvis no calza con fémures y L5 | piezas flotando | ICP de escala uniforme contra coxales + sacro; revisar en captura |
| `build_models.py` reescribe los GLB | las piezas femeninas se perderían al rearmar | el script femenino es idempotente y se corre después; documentado en los dos |
