# Catálogo de laboratorio: fuentes, método y pendientes

Archivo: `laboratorio.json` (versión `2026-10-31`). Validado con
`python3 -I -c "import json,sys;json.load(open(sys.argv[1]))" laboratorio.json`.

## Conteos

| | |
|---|---|
| Análisis que se pueden pedir | **532** |
| Componentes («features») | **690** |
| Códigos LOINC distintos en uso | 719 |
| Análisis con LOINC verificado | 454 |
| Perfiles sin código LOINC de panel (cada componente lleva su LOINC) | 73 |
| Análisis con `verificar: true` (`loinc: null`) | 5 |
| Componentes con `verificar: true` (`loinc: null`) | 5 de 690 |
| Muestras | 49 (46 con SNOMED CT verificado, 38 con HL7 0487 verificado) |
| Secciones | 20 |

### Por sección

| Sección | Análisis | Componentes | Con LOINC | `verificar` | Paneles/perfiles |
|---|---:|---:|---:|---:|---:|
| HEMATO Hematología | 27 | 78 | 24 | 1 | 9 |
| COAG Coagulación y hemostasia | 30 | 26 | 27 | 0 | 5 |
| INMUNOHEMATO Banco de sangre | 9 | 10 | 7 | 0 | 3 |
| BIOQ Bioquímica clínica | 64 | 101 | 57 | 1 | 15 |
| GASES Gases y ácido-base | 5 | 18 | 4 | 0 | 3 |
| ENDOCRINO Endocrinología | 60 | 39 | 52 | 0 | 10 |
| TUMORALES Marcadores tumorales | 16 | 7 | 14 | 0 | 2 |
| CARDIACO Marcadores cardíacos | 10 | 14 | 8 | 0 | 2 |
| INMUNO Inmunología/autoinmunidad | 32 | 45 | 21 | 0 | 12 |
| ALERGIA IgE específicas | 31 | 24 | 29 | 0 | 2 |
| SEROLOGIA Serología infecciosa | 78 | 36 | 72 | 0 | 7 |
| MICRO Microbiología | 29 | 2 | 29 | 0 | 1 |
| PARASITO Parasitología | 18 | 9 | 15 | 1 | 2 |
| MOLECULAR Biología molecular | 26 | 9 | 23 | 0 | 4 |
| UROANALISIS Orina | 17 | 91 | 13 | 2 | 8 |
| LIQUIDOS Líquidos biológicos | 8 | 55 | 3 | 0 | 6 |
| TOXICO Toxicología y fármacos | 31 | 11 | 30 | 0 | 1 |
| VITAMINAS Vitaminas y oligoelementos | 17 | 2 | 16 | 0 | 1 |
| GENETICA Genética y tamizaje | 12 | 12 | 10 | 0 | 3 |
| PERFILES Perfiles frecuentes | 12 | 101 | 0 | 0 | 12 |

En «Con LOINC» no cuentan los perfiles: no tienen código de panel, pero sí
LOINC en cada componente.

## Fuentes (`fuentes[]` del JSON)

- **LOINC 2.83**: cada código se comprobó con `CodeSystem/$lookup` en
  `https://tx.fhir.org/r4` (system `http://loinc.org`, versión 2.83). Solo se
  aceptó un código si existe, no está inactivo y su nombre no empieza con
  «Deprecated». En `loinc_nombre` queda el nombre LOINC oficial (LONG_COMMON_NAME)
  devuelto por el servidor, para auditarlo.
- **NLM Clinical Tables**: se usaron `loinc_items/v3/search` (tipos
  `question` y `panel`) para encontrar candidatos por nombre y
  `loinc_form_definitions` para leer los miembros oficiales de los paneles:
  57021-8 hemograma, 24356-8 EGO, 24323-8 CMP, 24362-6 renal, 24325-3 hepático,
  24326-1 electrolitos, 24336-0 y 24339-4 gases, 50190-8 hierro, 24351-9
  proteinograma y 24331-1 lípidos.
- **SNOMED CT International 2025-02-01** (jerarquía *Specimen* 123038009) y la
  **tabla 0487 de HL7 v2** (CodeSystem `v2-0487` 3.0.0) para las muestras. Ambas
  se verificaron en tx.fhir.org con `$lookup`, y con `$expand` para buscar
  candidatos.
- **MedlinePlus, Cholesterol Levels**: fuente del ayuno de 9 a 12 horas para el
  perfil lipídico y los triglicéridos. Ver
  https://medlineplus.gov/lab-tests/cholesterol-levels/.
- **Composición del perfil prenatal**: estrategia ETMI del Ministerio de Salud de
  Bolivia (VIH, sífilis, Chagas y hepatitis B), según
  [Los Tiempos, 08/09/2025](https://www.lostiempos.com/tendencias/salud/20250908/activaran-estrategia-controlar-transmision-vih-sifilis-chagas-hepatitis-b).
  No se encontró en línea la norma ministerial con la lista completa de exámenes
  prenatales; el resto de esa composición queda como práctica habitual.
- **Composición del perfil prequirúrgico**:
  [Guía de tratamiento preoperatorio (Cuba)](https://instituciones.sld.cu/fcmdoct/files/2019/02/Guia-para-en-tratamiento-preoperatorio.pdf)
  y el [perfil preoperatorio de Laboratorio Echevarne](https://laboratorioechevarne.com/en/products/test-preoperative).
- **Repositorio**: `mantra-core-health-api/src/modules/clinical/clinical.concepts.ts`.

## Método

1. **Repositorio.** `grep -ril loinc` sobre `src`, `public`, el modelo y
   `api/src` no encontró ningún catálogo de laboratorio con códigos LOINC. El
   front y `public` solo mencionan LOINC en el glosario y en las pantallas de
   terminología. El seed `03_terminology` solo declara la fuente `src_loinc`.
   Lo que sí existe es el catálogo de estudios de la API: 47 códigos `LAB_*`
   sin LOINC, en `clinical.concepts.ts` (`STUDY_*`). Los 47 quedan enlazados
   desde `codigo_api_existente`, uno a uno, sin faltantes ni duplicados.
   **Ojo:** el comentario de ese archivo justifica no usar LOINC porque
   «elegir mal el código LOINC es peor que no ponerlo». Este catálogo lo
   respeta: todo código está verificado y el que no se pudo verificar queda en
   `null`. Si se adopta, conviene revisar esa decisión junto con quien la escribió.
2. **Borrador** escrito a mano por sección: nombres en español, sinónimos de
   Latinoamérica (Bolivia, México, Argentina y España), muestra y componentes.
3. **Verificación en tres rondas.**
   - Ronda 1: unos 140 códigos que escribí de memoria no existían o no
     significaban lo esperado, casi siempre por el dígito verificador.
     Se reemplazaron por una búsqueda en NLM con una expresión regular sobre el
     nombre LOINC oficial, o por un código leído en los resultados de esa búsqueda.
   - Ronda 2: 19 códigos existían pero LOINC 2.83 los marca inactivos o
     *discouraged*. Se cambiaron por equivalentes activos.
   - Ronda 3: revisión semántica línea por línea, comparando el nombre en
     español con `loinc_nombre`. Corrigió, entre otros: glucosa 1 h y 2 h
     post 75 g (20438-8 y 20436-2 estaban invertidos), c-ANCA y p-ANCA,
     leucocitos y hematíes en LCR, insulina post glucosa, oxihemoglobina y la
     IgE de trigo, que había resuelto a «Wheat Bran».
4. **Paneles.** Si existe un panel LOINC, `loinc` es el del panel y los
   componentes salen de los miembros oficiales (NLM form definitions),
   recortados a lo que se informa en la práctica. Los miembros raros quedan con
   `seleccionado_por_defecto: false`, por ejemplo cilindros céreos, PDW o
   granulocitos inmaduros. Si no existe, como en el perfil tiroideo, el ENA o
   el prequirúrgico, va `loinc: null`, `verificar: false`, una `nota` y LOINC en
   cada componente. Cuando la composición no tiene fuente citada se marca
   `verificar_composicion: true`; son 70 perfiles.
5. **Ayuno y tiempos.** `ayuno` solo vale `true` cuando hay fuente:
   - el propio término LOINC «Fasting glucose» (1558-6), en `ayuno_fuente: loinc-2.83`;
   - MedlinePlus, para el perfil lipídico.

   En todos los demás casos `ayuno` es `null`. `tiempo_entrega_horas` es `null`
   en los 532 análisis: ninguna fuente pública consultada da tiempos de entrega
   que se puedan aplicar a Bolivia, así que deben salir del laboratorio que se
   integre.

## Campos añadidos al formato pedido

- `loinc_nombre` (análisis y componentes): el nombre LOINC oficial, para auditar.
- `verificar` y `nota`.
- `verificar_composicion`: perfil sin fuente que respalde su composición.
- `ayuno_fuente`.
- `codigo_api_existente`: el código `LAB_*` actual de la API.
- En muestras: `snomed_nombre`, `hl7_0487_nombre` y una `nota` cuando no hay
  equivalente.
- `fuente` es un id o una lista de ids de `fuentes[]`.

## Pendientes de verificar

**Análisis con `loinc: null` y `verificar: true` (5):**

| Código | Motivo |
|---|---|
| `FORMULA_LEUCOCITARIA_MANUAL` | El panel 24318-8 está inactivo en 2.83. Los componentes manuales sí están verificados. |
| `INMUNOFIJACION` | Solo hay códigos por banda o por isotipo; no se encontró uno genérico de suero. |
| `CHAGAS_MICROMETODO` | No se encontró un código LOINC de *T. cruzi* por microscopía en sangre. Clave en Bolivia para el Chagas congénito; la PCR (`T_CRUZI_PCR`, 49801-4) sí está. |
| `SEDIMENTO_URINARIO` | 24365-9 está inactivo y la alternativa es «by Automated count». Los componentes del sedimento sí están verificados. |
| `BENCE_JONES` | Solo hay cadenas ligeras urinarias; falta elegir el término. |

**Componentes con `loinc: null` y `verificar: true` (5):** RDW-SD (21000-5 está
deprecado), lactato en LCR, recuento total de espermatozoides por eyaculado y
hemoglobinopatías en papel filtro (54104-5 está *discouraged*). RDW-SD aparece
dos veces, en `HEMOGRAMA` y en `HEMOGRAMA_SIN_FORMULA`.

**Muestras:**
- Sin SNOMED: `SECRECION_NASAL`, más `PACIENTE` y `MULTIPLE`, que no son muestras.
- Sin código HL7 0487: los hisopados nasofaríngeo, faríngeo, endocervical,
  uretral, perianal y vaginal-rectal, la secreción ótica y el papel filtro.
  La tabla 0487 no los distingue.
- `PLASMA_FLUORURO` usa el concepto genérico de plasma.

**Revisión clínica recomendada:**
- La composición de los 70 perfiles marcados `verificar_composicion`. Conviene
  contrastarla con la cartera del laboratorio que se integre.
- Algunos códigos de método específico pueden diferir del método que use ese
  laboratorio:
  - Chagas por ELISA (57320-4), por hemaglutinación indirecta (22599-5, un
    título sin método) y por inmunofluorescencia (25813-7).
  - Brucelosis por aglutinación.
  - Baciloscopía por Ziehl-Neelsen.

  LOINC codifica el método; si el laboratorio usa otro, el código cambia.
- Los paneles comerciales de PCR multiplex (respiratorio 92143-7,
  gastrointestinal 79381-0, meningitis 99087-9) se dejaron como análisis
  simples, sin la lista de patógenos, porque varía según el kit.
- No se pudieron leer catálogos de laboratorios bolivianos: la búsqueda no
  devolvió carteras públicas. Mayo, LabCorp y Quest no se consultaron en esta
  pasada. Los nombres en español y los sinónimos salen de la práctica
  hispanoamericana y no de una fuente citable. Revisarlos con el laboratorio
  socio.

## Reproducibilidad

Los scripts de construcción y verificación están en el scratchpad de la sesión
y no forman parte del repo: `build.py`, `final.py`, `fixes.py`, `fix2.py` y
`tx.py`, con caché de respuestas de tx.fhir.org y de NLM. Para volver a
verificar un código:
`curl "https://tx.fhir.org/r4/CodeSystem/\$lookup?system=http://loinc.org&code=<código>&_format=json"`.
