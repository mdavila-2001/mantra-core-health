# Catálogo de imagenología — metodología, fuentes y pendientes

Archivo de datos: `imagenologia.json` (versión `2026-10-31`). Este documento explica de dónde sale cada dato y qué quedó sin verificar.

## Conteos

| Bloque | Cantidad |
|---|---|
| Fuentes citadas | 27 |
| Modalidades | 14 |
| Lateralidades | 4 (IZQ, DER, BIL, UNI) |
| Regiones | 156: 9 grupos raíz, 7 combinadas, 121 anatómicas y 19 vasculares |
| Regiones que admiten lateralidad | 71 |
| Regiones con Body Part Examined DICOM | 132 |
| Estudios | 475 |
| Estudios que exigen lateralidad | 121 |
| Estudios con código LOINC (genérico o por lado) | 437 |
| Estudios con RPID de RadLex (genérico o por lado) | 343 |
| Estudios sin LOINC ni RPID (`verificar: true`) | 31 |
| Códigos `IMG_*` de la API enlazados (`codigo_api_existente`) | 27 de 27 |

### Estudios por modalidad

| Modalidad | DICOM | Estudios | Con LOINC | Con RPID | `verificar` |
|---|---|---|---|---|---|
| RX (radiografía simple) | DX (alt. CR, RG) | 92 | 89 | 76 | 1 |
| RF (contrastados / fluoroscopia) | RF | 36 | 36 | 34 | 0 |
| MG (mamografía, tomosíntesis) | MG | 13 | 11 | 10 | 1 |
| TC (incl. angio-TC, uro-TC, cardio-TC) | CT | 76 | 72 | 45 | 3 |
| RM (incl. angio-RM, colangio-RM, entero-RM, cardio-RM, funcional/difusión) | MR | 74 | 66 | 51 | 6 |
| US (ecografía, Doppler, obstétrica, ecocardiograma) | US | 86 | 76 | 55 | 10 |
| DXA (densitometría) | BMD | 6 | 4 | 3 | 1 |
| BDUS (densitometría por ultrasonido) | BDUS | 1 | 0 | 0 | 1 |
| NM (gammagrafía / SPECT) | NM | 42 | 39 | 36 | 3 |
| PET / PET-TC | PT | 12 | 9 | 8 | 3 |
| XA (angiografía / intervencionismo) | XA | 28 | 27 | 24 | 1 |
| PANORAMICA (ortopantomografía) | PX | 1 | 1 | 0 | 0 |
| INTRAORAL (periapical, bitewing, oclusal) | IO | 4 | 4 | 0 | 0 |
| CBCT (haz cónico) | CT | 4 | 3 | 1 | 1 |

La cefalometría lateral está en `RX` porque DICOM no tiene una modalidad propia para ella.

Los estudios guiados por imagen (biopsias, PAAF, drenajes, nefrostomía, TIPS, filtro de cava) se clasifican por la modalidad que guía el procedimiento: US, TC, MG, RM o XA.

## Metodología

1. **Modalidades.** Todos los códigos DICOM salen de **CID 29 Acquisition Modality** de PS3.16 2026d: DX, CR, RG, RF, MG, CT, MR, US, BMD, BDUS, NM, PT, XA, PX e IO. CID 33 solo incluye CID 29 y CID 32. Los nombres y sinónimos en español salen de las carteras de servicios citadas.
2. **Lateralidad.** Se usan **CID 247**: R = 24028007 y L = 7771000. **CID 244** agrega Bilateral = 51440002 y Unilateral = 66459002.
3. **Regiones.**
   - **Body Part Examined y SNOMED.** Salen de **PS3.16 Annex L**. Se descargó la tabla completa (341 términos con Body Part Examined) y se extrajo la correspondencia BPE → SCT.
   - **Lateralidad.** `admite_lateralidad` sale de la tabla **Paired Structure** del mismo Annex L. Cuando no hay dato o la práctica clínica lo contradice, se marca `lateralidad_fuente: "criterio clínico"` con una `nota`. Un ejemplo: Annex L marca el riñón como no par (N), pero el catálogo admite izquierda y derecha.
   - **Regiones sin Body Part Examined.** Se buscó el concepto SNOMED (jerarquía *Body structure* 123037004) en tx.fhir.org.
   - **Verificación SNOMED.** Los 160 códigos se verificaron con `CodeSystem/$lookup` contra SNOMED CT International 20250201, y el display quedó en `snomed_display`.
   - **Antepié y retropié.** Annex L asigna FOREFOOT y HINDFOOT a conceptos veterinarios que están inactivos (419176008 y 416804009). Para esas dos regiones se usa el concepto humano y no se propone Body Part Examined.
4. **Estudios.**
   - **Nombres en español.** Cada nombre está respaldado por al menos una cartera o arancel de España, Chile o México. Los identificadores de esas carteras van en `fuente`.
   - **RadLex.** Se descargó el **CSV oficial del RadLex Playbook** (994 orderables) y se comprobó que cada RPID exista. Cuando RadLex solo tiene variantes Left, Right, Bilateral o Unilateral, se publican en `radlex_rpid_por_lateralidad` y `radlex_rpid` queda en null.
   - **LOINC.** Se construyó un diccionario de 6.964 términos radiológicos LOINC desde la API de NLM Clinical Tables. Cada código se eligió por **nombre largo exacto**: por resolución automática o por elección manual entre candidatos reales. No se escribió ningún código de memoria.
   - **Verificación LOINC.** Los 692 códigos (genéricos y por lado) se revisaron uno a uno en **tx.fhir.org (LOINC 2.83)**. Todos existen: 690 están ACTIVE y 2 están DISCOURAGED, marcados con `loinc_estado`.
   - **LOINC por lado.** `loinc_por_lateralidad` (IZQ, DER, BIL) se generó buscando el término exacto `"<región> - left|right|bilateral"` en el diccionario.
   - **Contraste.** `contraste` toma los valores `sin`, `con` o `sin_y_con`. `via_contraste` sigue el eje *Rad.Pharmaceutical.Route* del Playbook LOINC/RSNA: IV, oral, rectal, intraarticular, intratecal, IA, etc.
   - **Proyecciones.** `proyecciones` se llenó solo en RX, MG y algunas series dentales.
   - **Preparación.** `preparacion` es orientativa. Prevalece siempre el protocolo del centro.
5. **Códigos internos.** Están en MAYÚSCULAS_SNAKE y son únicos en cada bloque. Se validó que cada estudio apunte a una modalidad y una región existentes, que cada `padre` exista y que cada id de `fuente` esté en `fuentes`.

Convenciones de campos que no estaban en el formato pedido:
- `fuente` es un texto con ids de fuente separados por `;`.
- Las regiones incluyen `tipo` (`grupo`, `combinada`, `region` o `vascular`), `lateralidad_fuente` y `snomed_display`.
- Los estudios incluyen `via_contraste`, `loinc_nombre`, `radlex_nombre`, `loinc_por_lateralidad`, `radlex_rpid_por_lateralidad`, `sinonimos` y `nota`.
- `verificar: true` marca un estudio sin LOINC ni RPID. `verificar_loinc: true` marca un estudio que tiene RPID pero no LOINC, o cuyo LOINC está DISCOURAGED.
- `codigo_api_existente`: el código `IMG_*` actual de la API (`clinical.concepts.ts`, conceptos `STUDY_*`), con el mismo criterio que usó el catálogo de laboratorio con los `LAB_*`. Es uno a uno: cada `IMG_*` aparece en un solo estudio.
- Cuando un estudio exige lateralidad y `loinc_por_lateralidad` existe, conviene usar el código del lado. `loinc` queda como término genérico o bilateral.

## Fuentes (consultadas el 2026-10-31)

**Estándares y terminologías**
- DICOM PS3.16 2026d: [CID 29](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/sect_CID_29.html), [CID 33](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/sect_CID_33.html), [CID 244](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/sect_CID_244.html), [CID 247](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/sect_CID_247.html), [CID 4031](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/sect_CID_4031.html) y [Annex L](https://dicom.nema.org/medical/dicom/current/output/chtml/part16/chapter_L.html).
- RSNA RadLex Playbook: [CSV base](https://api3.rsna.org/radlex/v1/createCsv?csvType=base) y [buscador](https://playbook.radlex.org/playbook/SearchRadlexAction).
- [LOINC/RSNA Radiology Playbook User Guide](https://loinc.org/kb/users-guide/loinc-rsna-radiology-playbook-user-guide), que define los ejes Rad.Modality, Rad.Anatomic Location.Region Imaged / Imaging Focus / Laterality, Rad.Pharmaceutical.Route y Rad.Views. Loinc.org devuelve 403 a clientes automáticos, así que los códigos se verificaron en NLM y tx.fhir.org.
- [NLM Clinical Tables — LOINC](https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search) y [tx.fhir.org](https://tx.fhir.org/r4/) (LOINC 2.83 y SNOMED CT International 20250201).
- ACR Appropriateness Criteria: [listado](https://acsearch.acr.org/list) y [portal](https://www.acr.org/Clinical-Resources/Clinical-Tools-and-Reference/Appropriateness-Criteria). Se usaron como referencia de qué estudios son frecuentes. Ningún código del catálogo depende de ellos.

**Nombres en español (carteras y aranceles)**
- España:
  - [H. U. Virgen de la Victoria (SAS) — Radiodiagnóstico](https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/hospital/virgen-victoria/sites/default/files/2024-11/Cartera%20de%20Servicios%20-%20Radiodiagn%C3%B3stico.pdf). Es la fuente principal: lista estudio por estudio.
  - [SAS — Cartera de Procedimientos de Medicina Nuclear 2017](https://www.sspa.juntadeandalucia.es/servicioandaluzdesalud/hospital/virgen-victoria/sites/default/files/2024-11/Cartera%20de%20Servicios%20-%20Medicina%20Nuclear.pdf).
  - Osakidetza: [Radiodiagnóstico 2024](https://www.euskadi.eus/contenidos/informacion/osk_ezencr_cartera_servicios/es_def/adjuntos/servicios_generales/2024/CS-RADIOLOGIA-2024.pdf) y [Medicina Nuclear 2024](https://www.euskadi.eus/contenidos/informacion/osk_ezencr_cartera_servicios/es_def/adjuntos/servicios_generales/2024/CS-MEDICINA-NUCLEAR-2024.pdf).
  - [H. U. Virgen Macarena 2021](https://www.hospitalmacarena.es/wp-content/uploads/2021/03/Cartera-de-Servicios-RD-2021.pdf).
  - Quirónsalud: [Vallès](https://www.quironsalud.com/valles/es/servicios-medicos/diagnostico-imagen/tecnicas) y [Málaga](https://www.quironsalud.com/malaga/es/cartera-servicios/radiologia-diagnostico-imagen/servicios).
  - [Complejo Asistencial de Zamora — Cardiología 2025](https://www.saludcastillayleon.es/CAZamora/es/cartera-servicios/cardiologia/informacion-ano-2025.ficheros/3263877-13.%20Cartera%20de%20Servicios%20CAZA%202025.pdf), para ecocardiografía.
- Latinoamérica:
  - Chile: [Clínica Costanera — Arancel de Imagenología 2023, códigos FONASA](https://ccostanera.cl/wp-content/uploads/2023/07/ARANCEL-DE-IMAGENOLOGA_A-2023-1-8.pdf).
  - México: [Bupa — Estudios de Gabinete 2026](https://www.bupasalud.com.mx/sites/default/files/documentos/2026-04/central/Estudios%20de%20Gabinete_BNV_2026.pdf).
  - Bolivia: [ABEN — Red de Centros de Medicina Nuclear](https://www.aben.gob.bo/wp-content/uploads/2025/11/volante-red-Esperanza.pdf). De aquí sale el uso de «centellograma» y «PET/CT».
- Odontología: [Revista COEM — CBCT](https://coem.org.es/pdf/publicaciones/cientifica/vol7num2/67-79.pdf) y [Revista IUNIR — panorámica, telerradiografía lateral y CBCT](https://revistaodontologia.iunir.edu.ar/docs/1/6%20Tomografia_pag29-35.pdf).

No se encontró una cartera boliviana publicada estudio por estudio. Las búsquedas sobre la CNS y clínicas de La Paz y Santa Cruz no la devolvieron. Los sinónimos de uso local («TAC», «Rx», «ecotomografía», «centellograma», «SEGD») se agregaron en `sinonimos`. Conviene contrastarlos con el servicio de imagenología de un cliente boliviano.

## Pendientes de verificar

**Estudios sin LOINC ni RPID (`verificar: true`, 31).** Para todos hay respaldo del nombre en español; lo que falta es un código externo.
- RX y CBCT: RX_COLUMNA_TOTAL_BENDING y CBCT_ATM.
- MG: MG_CONTRASTE (mamografía con contraste; LOINC no tiene un término exacto).
- TC: VENOTC_CEREBRAL, TC_CTAP_CON y ARTROTC_HOMBRO.
- RM: UROARM, RM_RECTO, RM_CANAL_ANAL_FISTULAS, ARTRORM_HOMBRO, ARTRORM_CADERA y RM_GUIA_BIOPSIA_PROSTATA.
- US: ECO_PROSTATA_ABDOMINAL, ECO_OBST_TN, ECO_PERFIL_BIOFISICO, ECOCARDIO_FETAL, ECO_FAST, ECO_ELASTOGRAFIA_HEPATICA, ECO_CONTRASTE, ECO_DOPPLER_FISTULA_DIALISIS, ECO_DOPPLER_VCI y ECOCARDIO_ESTRES.
- Densitometría: DXA_CUERPO_ENTERO y BDUS_CALCANEO.
- NM: NM_PIROFOSFATOS, NM_INERVACION_MIOCARDICA y NM_DATSCAN.
- PET: PETTC_PSMA, PETTC_COLINA y PETTC_DOTATATE. Los radiotrazadores nuevos no tienen término LOINC en el diccionario consultado.
- XA: XA_EMBOLIZACION_PROSTATICA.

**Con RPID pero sin LOINC, o con LOINC DISCOURAGED (`verificar_loinc`).**
- Sin LOINC: RX_SERIE_OSEA_MALTRATO, RX_CUERPO_EXTRANO, MG_BAV_ESTEREOTAXICA, ENTEROTC, RM_CEREBRO_FUNCIONAL, ENTERORM y DXA_COLUMNA_CADERA.
- LOINC DISCOURAGED: TC_MIELOGRAFIA (47985-7) y ECO_COLUMNA_NEONATAL (24926-8).

**Equivalencias aproximadas, con código real pero menos específico que el estudio:**
- ECO_NERVIO_PERIFERICO usa «US Wrist».
- ECO_TENDON_AQUILES usa «US Extremity musculoskeletal tissue».
- RX_CAVUM usa «XR Neck Lateral».
- NM_VENTRICULOGRAFIA_MUGA usa «NM Heart Blood pool».
- NM_GANGLIO_CENTINELA_MAMA usa «NM Lymph node Views».
- PET_PERFUSION_MIOCARDICA: el RPID es de estudio simple y el LOINC de reposo más estrés.
- RX_TELERRADIOGRAFIA_MMII: el RPID es «Scanogram Bone Length».

**Regiones.**
- SENOS_PARANASALES: la fila de Annex L muestra «SINUS» en una celda corrida, y no está confirmado si es un Body Part Examined. Se dejó `dicom_body_part: null`.
- Lateralidad por criterio clínico: 34 regiones (lista en el campo `lateralidad_fuente`). Conviene que las revise un radiólogo.

**Para revisión clínica.** Las preparaciones son orientativas. El LOINC de lateralidad no cubre todos los estudios lateralizados: 24 de 119 no tienen variante por lado en el diccionario consultado.

## Enlace con los códigos `IMG_*` de la API (H0.M2)

La API tiene 27 códigos `IMG_*` en `mantra-core-health-api/src/modules/clinical/clinical.concepts.ts` (conceptos `STUDY_RX_*`, `STUDY_ECO_*`, `STUDY_TC_*`, `STUDY_RM_*`, `STUDY_MAMOGRAFIA` y `STUDY_DENSITOMETRIA`). El comentario del archivo dice que siguen los grupos del Arancel de Honorarios Médicos de Santa Cruz 2025 y que solo tienen `display` en inglés. Los 27 quedaron enlazados desde `codigo_api_existente`; los dos `CAR_*` (ECG y ecocardiograma) no son `IMG_*` y no entran en esta tarea, aunque el ecocardiograma ya existe aquí como ECOCARDIO_TT.

Criterios:
- **Exacto:** el código local y el estudio describen lo mismo.
- **Genérico, estudio nuevo:** el código local es más amplio que cualquier estudio del catálogo y LOINC tiene un término genérico real para él. Se agregaron 4 estudios genéricos (RX_MIEMBRO_SUPERIOR, RX_MIEMBRO_INFERIOR, ECO_OBSTETRICA y ECO_DOPPLER_GENERICO), con LOINC verificado y una `nota` que remite a los estudios específicos. Es mejor que forzar «RX de miembro superior» sobre «RX de mano».
- **Genérico, más cercano:** el código local no distingue segmento o contraste y no hay término genérico útil. Se enlaza al estudio de uso más frecuente y la `nota` del estudio nombra las alternativas.

| Código local | Estudio del catálogo | Criterio |
|---|---|---|
| IMG_RX_TORAX | RX_TORAX_PA_LAT | Exacto: la radiografía de tórax estándar es PA y lateral |
| IMG_RX_CRANEO | RX_CRANEO_AP_LAT | Exacto |
| IMG_RX_SENOS | RX_SENOS_PARANASALES | Exacto |
| IMG_RX_COL_CERVICAL | RX_COLUMNA_CERVICAL_AP_LAT | Exacto |
| IMG_RX_COL_DORSAL | RX_COLUMNA_DORSAL | Exacto |
| IMG_RX_COL_LUMBAR | RX_COLUMNA_LUMBOSACRA_AP_LAT | Exacto: en las carteras la lumbar se pide como lumbosacra |
| IMG_RX_ABDOMEN | RX_ABDOMEN_SIMPLE | Exacto |
| IMG_RX_PELVIS | RX_PELVIS_AP | Exacto |
| IMG_RX_MIEMBRO_SUP | RX_MIEMBRO_SUPERIOR | Genérico, estudio nuevo (LOINC 24689-2) |
| IMG_RX_MIEMBRO_INF | RX_MIEMBRO_INFERIOR | Genérico, estudio nuevo (LOINC 24686-8) |
| IMG_ECO_ABDOMINAL | ECO_ABDOMEN_COMPLETO | Exacto |
| IMG_ECO_RENAL | ECO_RENAL_VESICAL | Exacto: el display dice «renal and urinary tract» |
| IMG_ECO_PELVICA | ECO_PELVICA_ABDOMINAL | Exacto: la transvaginal es ECO_TRANSVAGINAL |
| IMG_ECO_OBSTETRICA | ECO_OBSTETRICA | Genérico, estudio nuevo (LOINC 11525-3) |
| IMG_ECO_TIROIDES | ECO_TIROIDES | Exacto |
| IMG_ECO_MAMARIA | ECO_MAMA_BILATERAL | Exacto: la unilateral es ECO_MAMA_UNILATERAL |
| IMG_ECO_PARTES_BLANDAS | ECO_PARTES_BLANDAS | Exacto |
| IMG_ECO_DOPPLER | ECO_DOPPLER_GENERICO | Genérico, estudio nuevo (LOINC 93241-8) |
| IMG_TC_CRANEO | TC_CRANEO_SIN | Más cercano: el local no distingue contraste; la TC de cráneo habitual es sin contraste |
| IMG_TC_TORAX | TC_TORAX_SIN | Más cercano: el local no distingue contraste |
| IMG_TC_ABDOMEN | TC_ABDOMEN_PELVIS_CON | Más cercano: el display es «abdomen and pelvis»; se eligió la variante con contraste IV por ser la de uso habitual |
| IMG_TC_COLUMNA | TC_COLUMNA_LUMBAR | Más cercano: el local no distingue segmento |
| IMG_RM_CEREBRAL | RM_CEREBRO_SIN | Más cercano: el local no distingue contraste |
| IMG_RM_COLUMNA | RM_COLUMNA_LUMBAR | Más cercano: el local no distingue segmento |
| IMG_RM_ARTICULAR | RM_RODILLA | Más cercano: el local no distingue articulación; la RM de rodilla es la articular más pedida |
| IMG_MAMOGRAFIA | MG_CRIBADO_BILATERAL | Más cercano: el local no distingue cribado de diagnóstica |
| IMG_DENSITOMETRIA | DXA_COLUMNA_CADERA | Exacto: la densitometría estándar es columna lumbar y cadera |

`sin_equivalente`: ninguno. Los 27 códigos tienen estudio.

Lo que conviene decidir al adoptar el catálogo: los 11 enlaces «más cercano» y «genérico» significan que una orden guardada hoy con ese `IMG_*` es menos específica que el estudio al que apunta. Al migrar, esas órdenes deberían conservar el nombre genérico o pedir que el médico elija el segmento, el contraste o la articulación.

## Nota para el mapeo 3D

`regiones-cuerpo-3d.json` (de otro agente) dice que su lista es un borrador tentativo hasta que exista este catálogo. Varios de sus códigos tienen equivalente directo aquí:

| Borrador 3D | Este catálogo |
|---|---|
| MACIZO_FACIAL | CARA, o HUESOS_FACIALES para huesos |
| PIEZAS_DENTARIAS | DIENTES |
| OIDO_PENASCO | PENASCO (padre OIDO) |
| SILLA_TURCA_HIPOFISIS | SILLA_TURCA |
| SACRO_COXIS | SACRO y COCCIX |
| COLUMNA_TOTAL | COLUMNA |
| PARRILLA_COSTAL | COSTILLAS |
| RENAL | RINON |
| VESICAL | VEJIGA |
| TESTICULAR | TESTICULO / ESCROTO |
| UTERO_ANEXOS | UTERO / ANEXOS_UTERINOS |
| SACROILIACA | SACROILIACAS |

Los demás códigos coinciden. Los códigos de región de este catálogo se consideran estables.

## Reproducibilidad

Los scripts de generación (`regiones.py`, `estudios.py`, `loinc_fix.py`, `api_img.py` y `gen.py`) y las descargas (CSV RadLex, Annex L, diccionario LOINC y respuestas de tx.fhir.org) quedaron en el scratchpad de la sesión. No forman parte del repositorio.
