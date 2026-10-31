# Pendientes clínicos de los catálogos de laboratorio e imagenología

Tarea H0.M4 del `PLAN.md`. Generado con `pendientes.py` (scratchpad de la sesión) a partir de `laboratorio.json`, `laboratorio-FUENTES.md`, `imagenologia.json` e `imagenologia-FUENTES.md`, versión `2026-10-31`.

**Regla del repo:** nada con `verificar: true` se siembra como válido hasta tener **decisión** y **responsable** anotados en este archivo. Lo mismo aplica a `verificar_composicion`, `verificar_loinc`, `loinc_estado` y a las muestras y regiones listadas abajo. Un código que no se pudo verificar va como `null`; no se inventa ni se completa de memoria.

## Conteos

| Categoría | Filas |
|---|---:|
| (a) Análisis y componentes de laboratorio con `verificar: true` | 10 (5 análisis + 5 componentes) |
| (b) Perfiles de laboratorio con `verificar_composicion: true` | 70 |
| (c) Muestras sin SNOMED CT o sin HL7 0487 | 12 |
| (d) Estudios de imagen sin LOINC ni RadLex (`verificar: true`) | 31 |
| (d') Estudios de imagen con RPID pero LOINC sin verificar (`verificar_loinc: true`) | 9 |
| (e) Regiones con `lateralidad_fuente: "criterio clínico"` | 34 |
| (f) LOINC en estado desaconsejado (`loinc_estado`) | 2 (imagen 2, laboratorio 0) |
| (g) Nombres y sinónimos en español sin fuente boliviana | 2 filas generales |
| **Total de filas** | **170** |

Cómo cerrar una fila: escribir en «Responsable» quién decide (nombre y rol) y en «Decisión» el código elegido o la acción (`aceptar null`, `reemplazar por <código>`, `quitar del catálogo`, `confirmar composición`), con fecha. Al cerrar, actualizar el JSON y quitar la marca `verificar`.

## (a) Laboratorio: análisis y componentes con `verificar: true`

`loinc` es `null` en todos. Los dos RDW-SD son el mismo pendiente en dos paneles.

### Análisis

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| FORMULA_LEUCOCITARIA_MANUAL | Fórmula leucocitaria manual (diferencial en frotis) | El panel 24318-8 está inactivo en LOINC 2.83; los componentes manuales sí están verificados. Decidir si se acepta sin código de panel. Muestra: SANGRE_EDTA. |  |  |
| INMUNOFIJACION | Inmunofijación sérica | LOINC solo tiene códigos por banda o por isotipo; no hay uno genérico de inmunofijación en suero. Muestra: SUERO. |  |  |
| CHAGAS_MICROMETODO | Chagas parasitológico directo (micrométodo / Strout) | No se encontró código LOINC de T. cruzi por microscopía en sangre. Clave para Chagas congénito en Bolivia; la PCR (T_CRUZI_PCR, 49801-4) sí está. Muestra: SANGRE_HEPARINA. |  |  |
| SEDIMENTO_URINARIO | Sedimento urinario (microscopía) | El panel 24365-9 está inactivo; la alternativa 53293-7 es «by Automated count». Los componentes del sedimento sí están verificados. Muestra: ORINA_AISLADA. |  |  |
| BENCE_JONES | Proteína de Bence Jones en orina | LOINC solo ofrece cadenas ligeras urinarias (p. ej. 1929-9); falta elegir el término que use el laboratorio. Muestra: ORINA_24H. |  |  |

### Componentes

| Código (análisis.componente) | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| HEMOGRAMA.RDW_SD | Hemograma completo (con fórmula leucocitaria) → Amplitud de distribución eritrocitaria (RDW-SD) | 21000-5 está deprecado y no se encontró reemplazo activo. El panel padre tiene LOINC 57021-8. |  |  |
| HEMOGRAMA_SIN_FORMULA.RDW_SD | Hemograma (sin diferencial) → Amplitud de distribución eritrocitaria (RDW-SD) | 21000-5 está deprecado y no se encontró reemplazo activo. El panel padre tiene LOINC 58410-2. |  |  |
| CITOQUIMICO_LCR.LACTATO | Citoquímico de líquido cefalorraquídeo → Lactato en LCR | La búsqueda devolvió solo lactato deshidrogenasa en LCR; falta el término de lactato. El panel padre no tiene LOINC de panel. |  |  |
| ESPERMOGRAMA.RECUENTO_TOTAL | Espermograma (seminograma, OMS 2021) → Recuento total de espermatozoides | LOINC tiene concentración (9780-8) pero no se encontró recuento total por eyaculado. El panel padre tiene LOINC 13361-1. |  |  |
| TAMIZ_NEONATAL.HEMOGLOBINOPATIAS | Tamizaje metabólico neonatal (prueba del talón) → Hemoglobinopatías neonatales | 54104-5 (HPLC) y sus variantes están DISCOURAGED en 2.83. El panel padre tiene LOINC 54089-8. |  |  |

## (b) Laboratorio: perfiles con `verificar_composicion: true`

Perfiles sin código LOINC de panel. Cada componente tiene su LOINC verificado, pero no hay fuente que respalde cuáles componentes forman el perfil. Los que sí tienen fuente (prequirúrgico, prenatal, prenatal infeccioso, hemograma, EGO, CMP, perfil lipídico, etc.) no aparecen aquí.

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| LDH_HEMOLISIS | Bilirrubina indirecta y LDH (perfil de hemólisis) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_ANEMIA | Perfil de anemia | Perfil sin código LOINC de panel y sin fuente que respalde su composición (9 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| AGREGACION_PLAQUETARIA | Agregación plaquetaria (ADP, colágeno, epinefrina, ácido araquidónico, ristocetina) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_COAGULACION | Perfil de coagulación básico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_TROMBOFILIA | Perfil de trombofilia | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| FENOTIPO_RH | Fenotipo Rh (C, c, E, e) y Kell | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| GRUPO_RH_NEONATO_COOMBS | Grupo, Rh y Coombs directo del recién nacido | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CTOG | Curva de tolerancia oral a la glucosa (75 g, 2 horas) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CTOG_EMBARAZO | Curva de tolerancia a la glucosa en embarazo (75 g; basal, 1 h, 2 h) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| QUIMICA_SANGUINEA_BASICA | Química sanguínea de 6 elementos (glucosa, urea, creatinina, ácido úrico, colesterol, triglicéridos) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_MINERAL | Perfil mineral (calcio, fósforo, magnesio) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PROTEINAS_TOTALES | Proteínas totales y fraccionadas | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CADENAS_LIGERAS_LIBRES | Cadenas ligeras libres kappa/lambda en suero | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| COOXIMETRIA | Cooximetría (carboxihemoglobina y metahemoglobina) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CURVA_INSULINA | Curva de insulina (basal y 2 horas) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_TIROIDEO | Perfil tiroideo | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| METANEFRINAS_PLASMA | Metanefrinas libres en plasma | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| METANEFRINAS_ORINA | Metanefrinas fraccionadas en orina de 24 horas | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CATECOLAMINAS_ORINA | Catecolaminas en orina de 24 horas | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_HORMONAL_FEMENINO | Perfil hormonal femenino | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_ANDROGENICO | Perfil androgénico (hiperandrogenismo/SOP) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_OSEO | Perfil de metabolismo óseo | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PSA_LIBRE | PSA libre y relación libre/total | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_TUMORAL_OVARIO | Marcadores tumorales de ovario (CA 125, HE4, índice ROMA) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_CARDIACO | Perfil cardíaco (enzimas cardíacas) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_RIESGO_CARDIOVASCULAR | Perfil de riesgo cardiovascular | Perfil sin código LOINC de panel y sin fuente que respalde su composición (9 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ENA | Anticuerpos contra antígenos nucleares extraíbles (perfil ENA) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| INMUNOGLOBULINAS | Inmunoglobulinas séricas (IgG, IgA, IgM) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ANCA | Anticuerpos anticitoplasma de neutrófilo (ANCA, IFI) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ANTI_MPO_PR3 | Anticuerpos anti-MPO y anti-PR3 | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ANTICARDIOLIPINAS | Anticuerpos anticardiolipina IgG e IgM | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ANTI_BETA2_GP1 | Anticuerpos anti-beta-2 glicoproteína I IgG e IgM | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_ANTIFOSFOLIPIDO | Perfil antifosfolípido | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_CELIACO | Perfil celíaco | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| SUBPOBLACIONES_CD4_CD8 | Subpoblaciones linfocitarias CD4/CD8 | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_REUMATOLOGICO | Perfil reumatológico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (7 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_LUPUS | Perfil de lupus (LES) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PANEL_ALERGIA_RESPIRATORIA | Panel de alergia respiratoria (IgE específicas inhalantes) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (12 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PANEL_ALERGIA_ALIMENTARIA | Panel de alergia alimentaria (IgE específicas alimentos) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (12 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_HEPATITIS_B | Perfil de hepatitis B | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_TORCH | Perfil TORCH (IgG e IgM) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| INFLUENZA_AG | Influenza A y B antígeno (prueba rápida) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_DENGUE | Perfil dengue (NS1, IgM, IgG) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| WIDAL | Reacción de Widal (aglutininas febriles para Salmonella) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| COPROPARASITOLOGICO_SERIADO | Coproparasitológico seriado (3 muestras) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| COPROLOGICO_FUNCIONAL | Coprológico funcional (examen físico-químico de heces) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CT_NG_PCR | Chlamydia trachomatis y Neisseria gonorrhoeae por PCR | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| MTB_GENEXPERT | Mycobacterium tuberculosis y resistencia a rifampicina (GeneXpert MTB/RIF) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| INFLUENZA_PCR | Influenza A/B ARN por RT-PCR | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| ELECTROLITOS_ORINA | Electrolitos en orina aislada (sodio, potasio, cloro) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_LITIASIS | Perfil metabólico de litiasis en orina de 24 horas | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CITOQUIMICO_LCR | Citoquímico de líquido cefalorraquídeo | Perfil sin código LOINC de panel y sin fuente que respalde su composición (12 componentes, todos con LOINC salvo los marcados verificar). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CITOQUIMICO_SINOVIAL | Citoquímico de líquido sinovial | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CITOQUIMICO_PLEURAL | Citoquímico de líquido pleural (con criterios de Light) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (10 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CITOQUIMICO_ASCITICO | Citoquímico de líquido ascítico (peritoneal) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (10 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CITOQUIMICO_PERICARDICO | Citoquímico de líquido pericárdico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (4 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| DROGAS_ABUSO_ORINA | Drogas de abuso en orina (tamizaje) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (11 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| VITAMINA_B12_FOLATO | Vitamina B12 y ácido fólico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| TRIPLE_MARCADOR | Tamizaje prenatal del segundo trimestre (triple marcador) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| TAMIZAJE_PRIMER_TRIMESTRE | Tamizaje bioquímico del primer trimestre (PAPP-A y beta-hCG libre) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (2 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| CHEQUEO_GENERAL | Chequeo general de laboratorio (adulto) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (16 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_DIABETICO | Perfil diabético (control de diabetes) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_PANCREATICO | Perfil pancreático | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_PROSTATICO | Perfil prostático | Perfil sin código LOINC de panel y sin fuente que respalde su composición (3 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_INFECCIOSO_ITS | Perfil de infecciones de transmisión sexual | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_FEBRIL | Perfil febril (síndrome febril agudo) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (8 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_HEPATICO_AMPLIADO | Perfil hepático ampliado (con coagulación) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_GERIATRICO | Perfil geriátrico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (10 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_PEDIATRICO | Perfil pediátrico básico | Perfil sin código LOINC de panel y sin fuente que respalde su composición (5 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |
| PERFIL_INFERTILIDAD_FEMENINA | Perfil de fertilidad femenina (día 3 del ciclo) | Perfil sin código LOINC de panel y sin fuente que respalde su composición (6 componentes, todos con LOINC). Confirmar la lista de componentes y cuáles van marcados por defecto. |  |  |

## (c) Laboratorio: muestras sin SNOMED CT o sin HL7 0487

`PACIENTE` y `MULTIPLE` no son muestras reales; la decisión es si se mantienen como marcadores del pedido.

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| SANGRE_PAPEL_FILTRO | Gota de sangre seca en papel filtro (prueba del talón) | sin HL7 0487. sin equivalente en HL7 0487 |  |  |
| HISOPADO_NASOFARINGEO | Hisopado nasofaríngeo | sin HL7 0487. HL7 0487 no tiene código de hisopado nasofaríngeo |  |  |
| HISOPADO_FARINGEO | Hisopado faríngeo | sin HL7 0487. HL7 0487 no tiene código de hisopado faríngeo |  |  |
| HISOPADO_VAGINAL_RECTAL | Hisopado vaginal y rectal (introito y recto) | sin HL7 0487. sin equivalente en HL7 0487 |  |  |
| HISOPADO_ENDOCERVICAL | Hisopado endocervical | sin HL7 0487. HL7 0487 solo tiene moco cervical (CVM) |  |  |
| HISOPADO_URETRAL | Hisopado uretral | sin HL7 0487. sin equivalente en HL7 0487 |  |  |
| HISOPADO_PERIANAL | Hisopado o cinta adhesiva perianal | sin HL7 0487. sin equivalente en HL7 0487 |  |  |
| SECRECION_OTICA | Secreción ótica (hisopado de oído) | sin HL7 0487. sin equivalente en HL7 0487 |  |  |
| SECRECION_NASAL | Moco/secreción nasal | sin SNOMED CT. no se encontró concepto SNOMED específico |  |  |
| MUESTRA_CLINICA | Muestra clínica (según sitio) | sin HL7 0487. concepto raíz de muestra; el sitio se especifica al pedir |  |  |
| PACIENTE | Prueba in vivo sobre el paciente (sin muestra) | sin SNOMED CT; sin HL7 0487. no es una muestra |  |  |
| MULTIPLE | Varias muestras (ver cada componente) | sin SNOMED CT; sin HL7 0487. perfil con muestras distintas por componente |  |  |

## (d) Imagen: estudios sin LOINC ni RadLex (`verificar: true`)

El nombre en español está respaldado por la cartera citada en `fuente`, pero no hay código LOINC ni RPID verificado. Decidir: buscar código con el servicio de imagen, codificar solo localmente o quitar del catálogo.

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| RX_COLUMNA_TOTAL_BENDING | Telerradiografía de columna completa con inclinaciones laterales (bending) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RX, región COLUMNA. |  |  |
| CBCT_ATM | Tomografía de haz cónico (CBCT) de ATM | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad CBCT, región ATM. |  |  |
| MG_CONTRASTE | Mamografía con contraste (espectral, CEM) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad MG, región MAMA. |  |  |
| VENOTC_CEREBRAL | Angio-TC venosa cerebral (venografía TC) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad TC, región SENOS_VENOSOS_DURALES. |  |  |
| TC_CTAP_CON | TC de cuello, tórax, abdomen y pelvis con contraste IV | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad TC, región CUELLO_TORAX_ABDOMEN_PELVIS. |  |  |
| ARTROTC_HOMBRO | Artro-TC de hombro | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad TC, región HOMBRO. |  |  |
| UROARM | Uro-RM (urografía por RM) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región VIAS_URINARIAS. |  |  |
| RM_RECTO | RM de recto (estadificación) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región RECTO. |  |  |
| RM_CANAL_ANAL_FISTULAS | RM de canal anal (fístulas perianales) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región CANAL_ANAL. |  |  |
| ARTRORM_HOMBRO | Artro-RM de hombro (directa) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región HOMBRO. |  |  |
| ARTRORM_CADERA | Artro-RM de cadera | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región CADERA. |  |  |
| RM_GUIA_BIOPSIA_PROSTATA | Biopsia de próstata con fusión RM-ecografía | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad RM, región PROSTATA. |  |  |
| ECO_PROSTATA_ABDOMINAL | Ecografía vesicoprostática (suprapúbica) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región PROSTATA. |  |  |
| ECO_OBST_TN | Ecografía de primer trimestre con translucencia nucal (11–13+6 sem) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región UTERO. |  |  |
| ECO_PERFIL_BIOFISICO | Perfil biofísico fetal | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región UTERO. |  |  |
| ECOCARDIO_FETAL | Ecocardiografía fetal | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región UTERO. |  |  |
| ECO_FAST | Ecografía FAST (politraumatismo) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región ABDOMEN. |  |  |
| ECO_ELASTOGRAFIA_HEPATICA | Elastografía hepática por ecografía | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región HIGADO. |  |  |
| ECO_CONTRASTE | Ecografía con contraste (CEUS) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región HIGADO. |  |  |
| ECO_DOPPLER_FISTULA_DIALISIS | Eco-Doppler de fístula arteriovenosa de diálisis | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región ARTERIAS_MIEMBRO_SUPERIOR. |  |  |
| ECO_DOPPLER_VCI | Eco-Doppler de vena cava inferior e ilíacas | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región VENA_CAVA_INFERIOR. |  |  |
| ECOCARDIO_ESTRES | Ecocardiograma de estrés (ejercicio o farmacológico) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad US, región CORAZON. |  |  |
| DXA_CUERPO_ENTERO | Densitometría DXA de cuerpo entero (composición corporal) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad DXA, región CUERPO_ENTERO. |  |  |
| BDUS_CALCANEO | Densitometría ósea por ultrasonido de calcáneo | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad BDUS, región CALCANEO. |  |  |
| NM_PIROFOSFATOS | Gammagrafía miocárdica con pirofosfatos / DPD (amiloidosis TTR) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad NM, región CORAZON. |  |  |
| NM_INERVACION_MIOCARDICA | Gammagrafía de inervación miocárdica (MIBG) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad NM, región CORAZON. |  |  |
| NM_DATSCAN | SPECT cerebral de transportador de dopamina (DaTSCAN) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad NM, región ENCEFALO. |  |  |
| PETTC_PSMA | PET-TC con PSMA (cáncer de próstata) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad PET, región CUERPO_ENTERO. |  |  |
| PETTC_COLINA | PET-TC con 18F-fluorocolina | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad PET, región CUERPO_ENTERO. |  |  |
| PETTC_DOTATATE | PET-TC con análogos de somatostatina (68Ga-DOTA) | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad PET, región CUERPO_ENTERO. |  |  |
| XA_EMBOLIZACION_PROSTATICA | Embolización de arterias prostáticas | Sin código LOINC ni RPID verificados para este estudio; nombre en español respaldado por la cartera citada. Modalidad XA, región PROSTATA. |  |  |

### (d') Imagen: estudios con RPID de RadLex pero LOINC sin verificar (`verificar_loinc: true`)

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| RX_SERIE_OSEA_MALTRATO | Serie ósea infantil (sospecha de maltrato) | Tiene RPID RPID6068 pero el LOINC no se encontró.  |  |  |
| RX_CUERPO_EXTRANO | Radiografía de nariz a recto para cuerpo extraño ingerido (pediatría) | Tiene RPID RPID6069 pero el LOINC no se encontró.  |  |  |
| MG_BAV_ESTEREOTAXICA | Biopsia asistida por vacío de mama guiada por estereotaxia | Tiene RPID por lado (IZQ,DER) pero el LOINC no se encontró.  |  |  |
| TC_MIELOGRAFIA | Mielo-TC (TC tras mielografía) | Tiene RPID por lado () pero el LOINC 47985-7 está en estado DISCOURAGED.  |  |  |
| ENTEROTC | Entero-TC (enterografía por TC) | Tiene RPID RPID152 pero el LOINC no se encontró.  |  |  |
| RM_CEREBRO_FUNCIONAL | RM funcional cerebral (BOLD, mapeo motor/lenguaje) | Tiene RPID RPID6300 pero el LOINC no se encontró.  |  |  |
| ENTERORM | Entero-RM (enterografía por RM) | Tiene RPID RPID645 pero el LOINC no se encontró.  |  |  |
| ECO_COLUMNA_NEONATAL | Ecografía de columna/canal raquídeo neonatal | Tiene RPID RPID5926 pero el LOINC 24926-8 está en estado DISCOURAGED.  |  |  |
| DXA_COLUMNA_CADERA | Densitometría ósea DXA de columna lumbar y cadera | Tiene RPID RPID6344 pero el LOINC no se encontró.  |  |  |

## (e) Imagen: regiones con lateralidad por criterio clínico

`admite_lateralidad` no sale de la tabla Paired Structure de DICOM PS3.16 Annex L, sino de la práctica clínica. Confirmar con el servicio de imagen si el pedido debe exigir lado.

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| FOSA_POSTERIOR | Fosa posterior / cerebelo | Admite lateralidad: no. Annex L marca el cerebelo como estructura par; para pedir estudios se trata como región única. |  |  |
| SENOS_PARANASALES | Senos paranasales | Admite lateralidad: no. Annex L lo marca como estructura par (Y), pero el estudio se pide siempre de ambos lados; la tabla lista SINUS en una celda corrida (verificar si es Body Part Examined). |  |  |
| HUESOS_PROPIOS_NARIZ | Huesos propios de la nariz | Admite lateralidad: no. Annex L: par (Y); se pide como un solo estudio. |  |  |
| MAXILAR | Maxilar superior | Admite lateralidad: no. Annex L: par (Y); se pide como un solo estudio. |  |  |
| DIENTES | Dientes / piezas dentarias | Admite lateralidad: no. La ubicación se indica por pieza dentaria (FDI), no por lateralidad. |  |  |
| ARCADA_DENTARIA_SUPERIOR | Arcada dentaria superior | Admite lateralidad: no. Sin nota; lateralidad decidida por criterio clínico, no por DICOM Annex L. |  |  |
| ARCADA_DENTARIA_INFERIOR | Arcada dentaria inferior | Admite lateralidad: no. Sin nota; lateralidad decidida por criterio clínico, no por DICOM Annex L. |  |  |
| PENASCO | Peñasco / hueso temporal | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| GLANDULAS_SALIVALES | Glándulas salivales | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| SENOS_VENOSOS_DURALES | Senos venosos durales (venas cerebrales) | Admite lateralidad: no. Sin Body Part Examined en Annex L. |  |  |
| PARATIROIDES | Paratiroides | Admite lateralidad: no. Annex L: par (Y); el estudio se pide de todas las glándulas. |  |  |
| GANGLIOS_CERVICALES | Ganglios linfáticos cervicales | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| ARTERIAS_PULMONARES | Arterias pulmonares | Admite lateralidad: no. Annex L: par (Y); el estudio diagnóstico se pide de ambas. |  |  |
| ABDOMEN_SUPERIOR | Abdomen superior | Admite lateralidad: no. Sin Body Part Examined en Annex L (usar ABDOMEN en DICOM). |  |  |
| RINON | Riñón | Admite lateralidad: sí. Annex L marca el riñón como NO par (N); se admite lateralidad por práctica clínica (riñón izq./der., biopsia, nefrostomía). |  |  |
| VIAS_URINARIAS | Vías urinarias (aparato urinario) | Admite lateralidad: no. Sin nota; lateralidad decidida por criterio clínico, no por DICOM Annex L. |  |  |
| TRACTO_DIGESTIVO_SUPERIOR | Tracto digestivo superior (esófago-estómago-duodeno) | Admite lateralidad: no. Sin nota; lateralidad decidida por criterio clínico, no por DICOM Annex L. |  |  |
| PARED_ABDOMINAL | Pared abdominal | Admite lateralidad: no. Sin Body Part Examined en Annex L. |  |  |
| ARTERIAS_RENALES | Arterias renales | Admite lateralidad: no. Se piden ambas en el estudio diagnóstico. |  |  |
| ANEXOS_UTERINOS | Anexos uterinos | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| SUELO_PELVICO | Suelo pélvico | Admite lateralidad: no. Sin Body Part Examined en Annex L. |  |  |
| PLEXO_BRAQUIAL | Plexo braquial | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| CARPO | Carpo | Admite lateralidad: sí. Annex L no informa si es par; lateralidad por práctica clínica. |  |  |
| ESCAFOIDES | Escafoides carpiano | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| METACARPO | Metacarpo | Admite lateralidad: sí. Annex L no informa si es par; lateralidad por práctica clínica. |  |  |
| ARTERIAS_MIEMBRO_SUPERIOR | Arterias del miembro superior | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| VENAS_MIEMBRO_SUPERIOR | Venas del miembro superior | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| TENDON_AQUILES | Tendón de Aquiles | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| TARSO | Tarso | Admite lateralidad: sí. Annex L no informa si es par; lateralidad por práctica clínica. |  |  |
| ANTEPIE | Antepié | Admite lateralidad: sí. Annex L asigna FOREFOOT a 419176008 (Forefoot of quadruped, inactivo en SNOMED, uso veterinario); se usa el concepto humano 396956009 y no se propone Body Part Examined. |  |  |
| RETROPIE | Retropié | Admite lateralidad: sí. Annex L asigna HINDFOOT a 416804009 (inactivo en SNOMED, uso veterinario); se usa el concepto humano 116668006 y no se propone Body Part Examined. |  |  |
| METATARSO | Metatarso | Admite lateralidad: sí. Annex L no informa si es par; lateralidad por práctica clínica. |  |  |
| ARTERIAS_MIEMBRO_INFERIOR | Arterias del miembro inferior | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |
| VENAS_MIEMBRO_INFERIOR | Venas del miembro inferior | Admite lateralidad: sí. Sin Body Part Examined en Annex L. |  |  |

## (f) LOINC en estado desaconsejado (`loinc_estado`)

Laboratorio: 0. La verificación de `laboratorio.json` descarta todo código inactivo o DISCOURAGED en LOINC 2.83 y lo deja en `null` (ya cuentan en la categoría a: sedimento urinario 24365-9, fórmula manual 24318-8, hemoglobinopatías en DBS 54104-5). Imagen: 2 estudios que conservan el código con la marca.

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| TC_MIELOGRAFIA | Mielo-TC (TC tras mielografía) | LOINC 47985-7 (CT Spine W contrast IT) en estado DISCOURAGED en LOINC 2.83. Elegir un reemplazo activo o aceptar el término desaconsejado. |  |  |
| ECO_COLUMNA_NEONATAL | Ecografía de columna/canal raquídeo neonatal | LOINC 24926-8 (US Spine) en estado DISCOURAGED en LOINC 2.83. Elegir un reemplazo activo o aceptar el término desaconsejado. |  |  |

## (g) Nombres y sinónimos en español sin fuente boliviana

| Código | Nombre | Qué falta | Responsable | Decisión |
|---|---|---|---|---|
| LAB_NOMBRES_ES | Nombres y sinónimos en español de los 532 análisis y 690 componentes de laboratorio | Salen de la práctica hispanoamericana, sin una fuente boliviana citable (no se encontraron carteras públicas de laboratorios de Bolivia). Revisar nombre, sinónimos, muestra, ayuno y tiempo de entrega con el laboratorio socio; en especial los códigos que dependen del método (Chagas HAI/ELISA/IFI, baciloscopía Ziehl-Neelsen, brucelosis por aglutinación). |  |  |
| IMG_NOMBRES_ES | Nombres y sinónimos en español de los 471 estudios de imagen | Respaldados por carteras de España, Chile y México, no de Bolivia. Revisar nombres, sinónimos, preparaciones (orientativas) y qué estudios ofrece realmente el servicio de imagen socio. |  |  |

Recomendación: una sesión de revisión con el laboratorio socio y otra con el servicio de imagen socio, recorriendo el catálogo por sección, antes de sembrar nombres en producción. Lo que se acuerde ahí se anota en `fuentes[]` de cada JSON como fuente propia del socio.
