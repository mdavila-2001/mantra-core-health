# Reporte — «Precios»: sin precio ≠ 0.00, modalidades aparte y guardado que no pierde lo escrito

- Fecha: 2026-11-05 · Rama: `claude/nice-bohr-c3bns1` (front y API, las dos sobre `origin/dev`)
- Origen: captura de `dev.alovidasalud.com/administration/laboratory-prices` de un centro de imagen recién
  registrado: seis filas `MODALITY_*` a «0.00 Bs», «Visible», y el guardado «no deja cargar».

## Diagnóstico (confirmado en código)

1. El alta crea una `diagnostic_study_offering` por modalidad declarada, sin precio
   (`diagnostic-unit-provisioning.service.ts`, paso 6). La pantalla las listaba como servicios.
2. `toLabService` convertía «sin precio» en `price: "0.00"`: el front no podía distinguirlo de «gratis».
3. `save()` del front hacía `edits.set({})` + `reload()` aunque la API rechazara: lo escrito desaparecía y sólo
   quedaba un aviso. Visto desde la persona: «no me deja cargar».

## Qué cambió

### API (`mantra-core-health-api`)
- `LabServiceDto.price` y `alovidaPrice` pasan a `string | null`; sin precio vigente la respuesta es `null`.
- `kind: 'SERVICE' | 'MODALITY'`; una oferta es `MODALITY` cuando su `study_code` es el de su
  `modality_concept_id` en el catálogo de modalidades (`isModalityOffering`).
- `PATCH` con `price` o `alovidaDiscountPercent` sobre una `MODALITY` → `422` con el motivo y qué hacer.
- Prueba de integración `test/integration/lab-portal-prices.int-spec.ts`: alta de centro de imagen con dos
  modalidades → `GET` las muestra `MODALITY` y `null` → `PATCH` a una modalidad 422 → `POST` de un estudio
  con precio → `PATCH` nuevo precio → relectura y dos versiones en `diagnostic_study_prices`.
- Documentado en `docs/modules/diagnostic_units.md`.

### Front (`mantra-core-health`)
- `LabService.price`/`alovidaPrice` nulos y `kind` en el contrato; la maqueta responde igual que la API
  (siembra una `MODALITY_LABORATORY` sin precio y rechaza su `PATCH` de precio).
- La pantalla se parte (regla `LEAN_CODE_MAX_300`): contenedor `laboratory-prices.ts` (184 líneas), tabla
  tonta `price-table/lab-price-table` (95), panel `modalities/lab-modalities-panel` (22), reglas puras
  `laboratory-prices.rules.ts` (130).
- Una tarjeta con dos pestañas: «Servicios» (tabla editable) y «Modalidades declaradas (n)» (lista con la
  explicación y el botón para cargar estudios por CSV). Sin precio se ve «Sin precio», nunca 0.00.
- Guardar conserva lo escrito en las filas rechazadas, las marca en error y muestra el motivo de la API;
  sólo quita de la edición las filas que entraron, y relee la lista.
- Fuera de la pantalla: la columna «Disponible hoy» (la API no la guarda, respondía 422) y la búsqueda por
  categoría (la API no tiene categorías).

## Evidencia

Ver [`evidencias/2026-11-05-precios-modalidades/`](../../../evidencias/2026-11-05-precios-modalidades/)
y el ciclo UI → request → response → relectura → UI en `ciclo-mutacion.json` (se completa abajo).

| Qué | Resultado |
|---|---|
| Pruebas dirigidas del front (`prices/**`, maqueta y cliente del portal) | 5 archivos, 54 pruebas, PASS |
| Pruebas unitarias de la API (`lab-portal*`) | 4 archivos, 22 pruebas, PASS |
| `tsc` app del front | sin errores en lo tocado; los 5 de `motivo-figura.ts` ya estaban en `dev` |
| `tsc` de la API, `eslint` de lo tocado en los dos repos | limpio |
| `check-css-tokens`, `check-contrast`, `check-max-lines` sobre lo tocado | limpio |
| Navegador, maqueta, 1440 px | «Servicios» sin modalidades; «Modalidades declaradas (1)» con explicación y sin casillas de precio (`01`, `02`) |
| Ciclo de mutación | Glucosa 33.50 y 15 % → vista previa 28.48 Bs → Guardar → salir y volver a entrar → 33.50, 15, 28.48 Bs (`03`–`05`, `ciclo-mutacion.json`) |
| Navegador, 390 px | sin scroll lateral; el precio entra completo en su casilla (`06`, `07`) |

**No ejecutado:** la prueba de integración de la API (`lab-portal-prices.int-spec.ts`) necesita PostgreSQL
con el esquema del modelo y este contenedor no tiene Docker. Jest la enumera; no se corrió. Tampoco se
probó contra la API real de `dev`. La maqueta corre dentro del navegador, así que `ciclo-mutacion.json` no
registra peticiones de red: la persistencia se prueba por la relectura tras navegar.

## Fuera de alcance, anotado

- `dev` no compila hoy por `motivo-figura.ts` (importa `triage-ia.client` y `symptom-check/ai-reading`,
  borrados en `0915125f9`). Para sacar la evidencia se restauraron esos módulos **sólo en el árbol local**, sin
  commitearlos. Va como tarea aparte.
