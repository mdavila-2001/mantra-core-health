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
| Licencias y procedencia | 3 graves + 3 menores: **texto del índice de Netter (Elsevier) visible** → ahora sólo número de lámina; castellano sin rótulo en varios lugares → aviso de página y marca en el título; lista femenina sin útero → raíces ampliadas; DISCOVERY corregido | idem |

## 5. Pruebas (salida literal en `gates/`)

PENDIENTE_GATES

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
   rotula en pantalla.
8. **Integración con el glosario.** Las 6 322 fichas viven en el atlas, no en
   los shards del glosario (`public/glossary-seed/`), que se generan con otra
   tubería; el glosario enlaza al atlas.
9. **CI.** El CI propio está caído (CLAUDE.md); las pruebas se corrieron a mano.
