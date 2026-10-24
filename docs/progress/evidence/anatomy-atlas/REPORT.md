# Atlas anatómico 3D — informe de cierre (2026-10-24)

Rama `feature/anatomy-atlas-3d` sobre `origin/mockup` (355e01e9). Cada cifra de
este informe sale de un archivo de esta carpeta o del código generado; donde
algo **no se pudo hacer**, se dice y se dice por qué.

## 0. Lo que condicionó todo: la red

La política de red de la sesión **rechazó** PubMed E-utilities, Europe PMC,
OpenAlex, Crossref, OLS4, Wikimedia Commons (API y `upload.wikimedia.org`),
Wikipedia, Wikidata, Open Library, purl.obolibrary.org, el archivo de DBCLS y
el visor de TA2. Sí alcanzaba GitHub y el registro de npm
(`phase0/network-reachability.txt`). De ahí salen casi todas las cosas que no
se hicieron (§6).

## 1. Conteos reales

| Qué | Cifra | Fuente |
|---|---|---|
| Clases UBERON 2026-10-01 en la release | 16 141 | `data/anatomy-ontology/provenance.json` |
| Estructuras humanas (UBERON con xref FMA) en el catálogo | **6 074** | `ATLAS_3D_META` |
| Fichas de piezas 3D sin cruce con UBERON (sólo FMA/BodyParts3D) | 248 | idem |
| **Fichas totales** | **6 322** | idem |
| Relaciones declaradas por UBERON publicadas (salientes) | **7 315** | idem (part_of 5 180 · has_part 258 · connected_to 204 · has_muscle_insertion 203 · vessel_supplies_blood_to 198 · has_muscle_origin 196 · adjacent_to 184 · connecting_branch_of 179 · innervated_by 154 · tributary_of 144 · attaches_to 112 · vessel_drains_blood_from 112 · innervates 106 · branching_part_of 81 · indirectly_supplies 4) |
| Las mismas, leídas desde la otra punta (entrantes) | 6 678 | catálogo |
| Definiciones de UBERON publicadas tal cual (CC-BY) | **5 152** | `ATLAS_3D_META` (17 de relleno «Missing definition…» se trataron como ausentes) |
| Definiciones traducidas al castellano (automática, sin revisión humana) | 5 152 | idem |
| Nombres en castellano (traducción automática, rotulada) | 6 322 | idem |
| Mallas 3D (BodyParts3D 3.0, sin tegumentario) | **930** · 358 984 triángulos | `public/anatomy-atlas-3d/models/parts-manifest.json` |
| Mallas cruzadas con UBERON | 682 (161 por xref FMA exacto, 521 por el paso «Right X → X») | `bodyparts3d-parts.json` |
| Entradas del índice de Netter | 3 161 | |
| — cruzadas con UBERON (label o sinónimo EXACTO, recomprobado por el generador) | **805** | `data/anatomy-ontology/netter-mapping-report.json` |
| — sin cruce, cada una con su motivo | **2 356** | idem (la mayoría son fragmentos del índice dañados por OCR, vistas o agrupaciones) |
| — rechazadas por el generador al recomprobar | 0 | idem |
| Estructuras femeninas del catálogo | 121, **ninguna con malla** | `ATLAS_3D_META` |
| Códigos TA2 | **0** — no alcanzable y UBERON no los trae | `phase0/DISCOVERY.md` |
| Imágenes publicadas | **0** | §6 |
| Descripciones extendidas con literatura | **0** | §6 |

### Referencias que UBERON declara en sus definiciones (publicadas como «fuentes» de la ficha)

| Tipo | Apariciones | Distintas |
|---|---|---|
| Wikipedia | 2 092 | 2 028 |
| Referencia cruzada a otra ontología | 3 058 | 1 649 |
| URL | 586 | 487 |
| Curador (ORCID) | 602 | 17 |
| ISBN | 237 | 30 |
| PMID | 154 | 93 |
| DOI | 46 | 32 |

**Citas válidas comprobadas en línea: 0.** No porque sean inválidas: porque no
se pudo resolver ninguna (§3). Nunca se escribió «verificado» sin la prueba.

## 2. Qué se construyó

- **Fase 0** — `phase0/DISCOVERY.md`: licencias y cobertura de BodyParts3D y
  Z-Anatomy, tamaños de GLB, alcance de red. **No existe modelo femenino libre**
  (evidencia en `phase0/*-female-coverage.txt`).
- **Fase 1** — `tools/anatomy-atlas-3d/extract_ontology.py` (extracto y
  procedencia con SHA-256), cruce Netter→UBERON y castellano por **12 agentes
  en paralelo** (R01–R07, R01 dividido en dos, 4 lotes sistémicos), con
  `uberon_lookup.py` como única vía de aceptación. Lo que cada agente reportó:
  `phase1-region-agents.json`. Generador: `scripts/gen-anatomy-ontology-fixture.mjs`
  → `public/anatomy-atlas-3d/catalog/` (32 shards bajo demanda) y
  `src/app/core/mock/fixtures/anatomy-ontology.generated.ts`.
- **Fase 2** — definición de UBERON tal cual, con atribución CC-BY y sus
  referencias, más traducción rotulada. La descripción extendida con
  literatura **no se hizo** (§6).
- **Fase 3** — imágenes: **no se hizo** (§6).
- **Fase 4** — `/glossary/anatomy-atlas`: visor three.js (organismo
  `app-anatomy-viewer`), cinco capas GLB diferidas, selección por clic/tacto,
  búsqueda y teclado, resaltado de la pieza y de sus relacionadas, ficha en
  una tarjeta con pestañas (Ficha · Relacionadas · Fuentes), selector
  Hombre/Mujer honesto, créditos CC visibles, claro/oscuro, reduced motion,
  inerte bajo SSR. Ficha de ruta: `docs/routes/glossary-anatomy-atlas.md`.
- **Fase 5** — auditoría por agentes que no redactaron: §4.

## 3. Validador de citas, IDs y licencias

`scripts/validate-anatomy-atlas.mjs` resuelve cada DOI (Crossref, con
respaldo en doi.org), PMID (E-utilities), artículo de Wikipedia, ISBN (Open
Library), URL, ID UBERON y FMA (OLS4) y la licencia de cada imagen (Commons
`extmetadata`), y **sale con 1 ante una sola irresoluble**.

Resultado en esta sesión: ver `validator-*.md` — **FALLIDO**: ninguna cita ni
ID pudo resolverse porque el proxy rechazó cada host («Request was
cancelled» = CONNECT 403). Las comprobaciones sin red pasaron: los 6 074 IDs
UBERON del catálogo están en el extracto y el SHA-256 de la release coincide
con `provenance.json`. Eso **no** reemplaza la resolución en línea.

Para cerrarlo: habilitar en la red del entorno `api.crossref.org`, `doi.org`,
`eutils.ncbi.nlm.nih.gov`, `en.wikipedia.org`, `openlibrary.org`,
`www.ebi.ac.uk` y `commons.wikimedia.org`, y correr
`NODE_USE_ENV_PROXY=1 node scripts/validate-anatomy-atlas.mjs`. Se espera que
falle igual por URLs viejas que UBERON cita (diccionarios en línea caídos):
esa es la regla, y el informe lo dirá.

## 4. Auditoría independiente

| Auditoría | Resultado | Archivo |
|---|---|---|
| Muestra del 5 % de fichas (317 de 6 322, semilla 20261024), frase por frase contra UBERON, 6 auditores | 390 frases revisadas, **381 fieles (97,7 %)**; nombres 303 OK de 305 cotejables (2 errores: «núcleo fastigio», «línea nucal suprema» por su sitio de fijación); relaciones 305/305 iguales a la fuente. Las 12 fichas restantes de la muestra son piezas sólo-FMA: sin definición ni relaciones de UBERON que cotejar, y su nombre en castellano se agregó después de tomar la muestra (no fue auditado); **2 errores graves** (traducción de «rostrum» por «tribuna»; «supplied by» bronquiolos como «irrigada») y 9 menores — **todos corregidos** | `audit-b-raw.json`, `audit-sample-ids.json` |
| Muestra del 5 % del cruce Netter (41 aceptadas + 118 sin cruce) | **0 falsos positivos de 41**; 2 «omisiones» señaladas (riñón, arterias segmentarias renales) que no lo son: esas clases de UBERON no declaran xref FMA y quedan fuera del criterio (§6) | `audit-a-raw.json` |
| Revisión de frontend (agente `frontend-reviewer`) | 4 graves + 6 menores: carrera de piezas, liberación de GPU, colores de resaltado que se confundían con capas, falta de evidencia de navegador; todos corregidos | idem |
| Regresión (agente `regression-auditor`) | sin regresión bloqueante; orden de rutas, guardas, CSP sin tocar, interceptor; 2 menores (cobertura de docs, rutas.json) corregidos | idem |
| Revisión visual (agente `visual-reviewer`, sobre las capturas) | 1.ª pasada **FAIL 61/100** (lienzo vacío en capturas de página entera, ocre sin evidencia, captura del útero sin ficha, pestaña cortada, panel cortado); corregido. 2.ª pasada (otro agente) **FAIL 79/100**: confirmó las 7 correcciones y halló 1 HIGH («resaltada» de piezas en capa apagada) y 3 MEDIUM; corregidos salvo las insignias de desarrollo. **No hubo tercera pasada**: no hay veredicto de revisor sobre las capturas finales | `audit-c-raw.json`, `audit-visual-2.md` |
| Muestra del 5 % de los nombres de piezas sólo-FMA (13 de 248) | **13/13 OK** | `audit-c-raw.json`, `audit-fma-only-sample.json` |
| Licencias y procedencia | 3 graves + 3 menores: **texto del índice de Netter (Elsevier) visible** → ahora sólo número de lámina; castellano sin rótulo en varios lugares → aviso de página y marca en el título; lista femenina sin útero → raíces ampliadas; DISCOVERY corregido | idem |

## 5. Pruebas (salida literal en `gates/`)

| Compuerta | Resultado | Archivo |
|---|---|---|
| `corepack yarn typecheck` | **verde** (EXIT=0) | `gates/typecheck.txt` |
| `corepack yarn build` | **verde** (EXIT=0). Bundle inicial 1,36 MB, igual que la base: el aviso de presupuesto (620 kB) ya existía en `origin/mockup` (740,05 kB por encima); la rama queda 740,23 kB por encima, +0,18 kB por la entrada de ruta. three.js y el atlas van en trozos diferidos. Lejos del techo de error (1,5 MB) | `gates/build.txt`, `build/` |
| `corepack yarn test --watch=false` | **rojo, y no por este cambio**: 11 038 pruebas, 77 fallan. **74 fallan igual en `origin/mockup`** (mismos archivos, corridos en un worktree de la base: medication-block, faker, fichas estándar, tokens, rutas viejas, etc.). Las 3 restantes (dos PDF con jsPDF y un temporizador de laboratorio) **pasan aisladas** en la rama (33/33): inestables bajo carga, no relacionadas con el atlas. Las pruebas nuevas del atlas pasan (21 en esa corrida; 22 tras la segunda revisión visual) | `gates/test.txt`, `gates/test-base-same-failing-files.txt`, `gates/test-branch-3-extra-failures-isolated.txt` |
| Playwright `--workers=1` contra `ng serve` | **10/10 verde**: tocar una pieza abre su ficha y sus relaciones en Hombre y Mujer a 375/768/1440 claro y 1440 oscuro; el lienzo tiene dibujo (conteo de píxeles), la pieza elegida se ve en verde y, con el fémur, las relacionadas en ocre; el útero se abre como ficha sin pieza, a la vista y con foco; selección por teclado desde la búsqueda | `gates/playwright.txt`, `screenshots/` |

Commit de cada compuerta (primera línea de cada archivo): typecheck, build y
Playwright sobre `9b3bc933`, el código final. La suite completa se corrió
sobre `dc69d624`; los cambios posteriores tocan sólo el atlas (plantilla,
lógica, CSS y la prueba de Playwright), y sus 22 pruebas unitarias se
volvieron a correr en verde sobre el código final. La suite completa no se
repitió.

Una corrida anterior dio verde contra un servidor equivocado (un build de
producción viejo que un auditor dejó en el puerto 4200); se descartó y se
volvió a correr contra `ng serve` recién arrancado. Otra corrida mostró que
las capturas de página entera borraban el lienzo WebGL: las capturas son ahora
de la zona de trabajo, y la prueba exige píxeles dibujados.

## 6. Lo que NO se hizo, y por qué

1. **Descripciones extendidas con literatura (fase 2b).** Exigían PubMed,
   Europe PMC, OpenAlex y Crossref para encontrar, parafrasear y citar
   literatura comprobable; ninguno era alcanzable. Escribirlas de memoria
   habría violado la regla «cada afirmación con cita resoluble». La ficha
   dice «No disponible» y por qué.
2. **Imágenes (fase 3).** Commons (API y archivos) rechazado: sin
   `extmetadata` no hay autor ni licencia comprobables, así que no se publicó
   ninguna. Tampoco Gray's 1918 (vive en Commons/Wikisource).
3. **Modelo femenino.** No existe uno libre (BodyParts3D y Z-Anatomy son un
   único cuerpo masculino; Z-Anatomy además trae piezas NC). Se implementó la
   alternativa honesta descrita en `phase0/DISCOVERY.md`.
4. **TA2.** El visor de FIPAT no era alcanzable y UBERON no trae xrefs TA2.
5. **Resolución en línea de citas e IDs.** El validador existe y falla, como
   debe, sin red (§3).
6. **Criterio de «humana».** Se tomó «clase UBERON con xref FMA». Deja afuera
   clases humanas sin ese cruce: **riñón** y **ojo**, entre otras. Se evaluaron
   dos ampliaciones (padres por `part_of` y cruce por nombre FMA = UBERON) y se
   descartaron: la primera arrastra estructuras embrionarias o de otras
   especies, la segunda sólo sumaba dientes. Pendiente con criterio explícito.
7. **Revisión humana del castellano.** Todo el castellano es traducción
   automática; la muestra auditada da 97,7 % de frases fieles, no 100 %. Se
   rotula en pantalla. Los agentes además leyeron como palabras correctas
   algunos textos de UBERON con caracteres rotos («choanC&» → coanas); el
   original en inglés se muestra tal cual.
10. **Suite completa en verde.** No se logró: 74 fallos ya estaban en
    `origin/mockup`; arreglarlos excede este alcance (§5).
11. **Aprobación visual.** Las dos revisiones visuales dieron FAIL (61 y 79
    sobre 100, con 92 como umbral). Lo hallado se corrigió, pero no se pidió
    una tercera revisión: las capturas finales no tienen veredicto de un
    revisor, sólo las aserciones de Playwright (incluido el conteo de píxeles).
    Por `NO_SELF_APPROVAL`, eso queda para quien revise el PR.
8. **Integración con el glosario.** Las 6 322 fichas viven en el atlas, no en
   los shards del glosario (`public/glossary-seed/`), que se generan con otra
   tubería; el glosario enlaza al atlas.
9. **CI.** El CI propio está caído (CLAUDE.md); las pruebas se corrieron a mano.
