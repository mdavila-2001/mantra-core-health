# Franja F3 — internación / ADT (frontend)

Rama `claude/web-infra-f3`. Evidencia contra la **maqueta** (backend simulado en
el navegador): `playwright/infra-f3-evidencia.mjs`, 61 de 61 comprobaciones en
verde (`resultados.json`) y 62 capturas a 1440, 768 y 390 px, en claro y oscuro
las clave, en esta carpeta. **Contra la API real NO se probó**: la API de F3 la
implementa otro agente y no está en este árbol; el integrador reconcilia.

## Qué hay

- `core/data-access/adt/`: cliente (una operación por fila de §F3.3 de
  `CONTRATO-F2-F5.md`), tipos, lectura de los `reason` de error, catálogos y
  lógica pura (justificación de 20 caracteres sin espacios de borde).
- `core/mock/handlers/adt.{handlers,store}.ts` y `fixtures/adt.data.ts`:
  simulador coherente con el contrato. Suma habitaciones y camas al árbol de F1
  sin tocar las existentes. Censo e indicadores se **calculan** de las
  ubicaciones; cerrar congela el snapshot (guarda de inmutabilidad) y un ajuste
  es una fila aparte.
- `features/inpatient/`: `admission-new` (cuatro pasos), `stay` (una tarjeta, cuatro
  pestañas), `bed-actions` (asignar, reservar, trasladar, intercambiar, egresar,
  cancelar), `census`, `indicators` y `shared/` (`bed-picker`, `compat-panel`,
  `bed-status`, selector de establecimiento).
- `clinical-record/patient-chart/admission-block`: cama y unidad del episodio
  abierto, enlace a la ficha, «Internar»; montado en la pestaña Internaciones del
  expediente. El alta de episodio existente se conserva.

## Contrato del slot `adtActions` (para el tablero de F2)

```html
<app-bed-actions adtActions [siteId]="siteId()" [cell]="seleccionada()"
                 [viewer]="viewer()" (changed)="recargarTablero()" />
```

`cell` es la `BedBoardCell` del panel; `viewer` (opcional) lo que la API declara
que la persona puede hacer; `changed` emite el texto del resultado y el tablero
vuelve a leerse. Está documentado en `bed-actions.ts`. **El plano interactivo**
sustituye a `app-bed-picker` conservando sus tres puntos: `cells`, `value`,
`picked`.

## Supuestos y desvíos (el contrato no los fija)

- **F3-1** `viewer` (`canOperateBeds`, `canOverride`, `canReviewIncidents`,
  `canCloseCensus`, `canAdjustCensus`) en stay, censo, inpatients y bed-board:
  el token no trae las asignaciones delegadas. Solo refleja; la API decide.
- **F3-2** `StayMovement.cancellableUntil` (ventana `infra.adt_cancel_window_minutes`).
- **F3-3** `GET /sites/:id/inpatients` con `cursor` va envuelto en
  `{items, nextCursor, generatedAt}`; el cliente acepta también un arreglo.
- **F3-4** Envoltura del censo por unidad: `{siteId, date, asOf, units:[{day, adjustments, adjustedTotals}]}`.
- **F3-5** `InpatientIndicators.asOf` (S7 obligatorio de `procesos/12`) y `byUnit`.
- **F3-6** Los catálogos (nivel, procedencia, disposición, motivo de traslado
  `ADT_RSN_*`) viven en el cliente con los códigos del contrato.
- **F3-7** `StayEncounter.siteId` opcional.
- **DESVÍO F3-A (propuesta, no contratada)** `POST /clinical/admissions/bed-compatibility`:
  el endpoint contratado pide un encuentro y en el ingreso todavía no existe. Si la
  API no lo implementa (404/405), el paso Cama lo dice y la compatibilidad se
  decide al confirmar con los errores de `POST /clinical/admissions`.
- `deltaPct` de la prueba cruzada = (recalculada − calculada) ÷ calculada × 100.
- `infra.inspection_required=false`, ventana de cancelación 120 min, gracia de
  cierre 15 min, `swap_requires_cleaning=false` (en el simulador).
- El tablero de F2 es un **doble** registrado al final de `crearRouterSimulado` y
  solo si nadie más registra `GET /sites/:siteId/bed-board`. El ciclo de higiene
  (limpiar → inspeccionar) es de F2: el simulador marca sucia y crea la orden;
  `window.__adtSim.completarLimpieza(código)` lo cierra para la evidencia.

## Integración (cosas que el integrador debe saber)

- `navigation.subgroups.ts`: subgrupo «Internación» (Atención) con tres rutas; si
  F2 agrega otro con el mismo nombre, unirlos.
- Las tres secciones (`inpatient/admissions/new`, `/census`, `/indicators`) se ven
  con `roles: [ANY_ROLE] + requiresTenant` (menos paciente) y
  `onlyForTenantTypes: HOSPITAL, CLINIC`: quién opera camas no es un rol del
  token, y una farmacia, un laboratorio o una aseguradora conservan su menú
  (comprobado en navegador: `farmacia@` no ve las entradas y `/inpatient/census`
  la manda al panel; `superadmin@` y `medica@` en el Hospital San Lucas sí).
  `inpatient/stays/:encounterId` no es sección.
- Las camas de ADT se insertan en el árbol de F1 al registrar el simulador
  (`sembrarCamasAdt`, idempotente); no hay edición de `infrastructure.data.ts`.
- `marcarSucia`/`registrarOcupacion` de `adt.store.ts` son el doble de
  `CareSpaceOpsPort`: al integrar F2 se reemplazan por su store.

## Recorrido demostrado en navegador (maqueta)

Ingreso (compatibilidad forzable, justificación corta rechazada y de 20 caracteres
aceptada, incidente en la ficha y revisión) · rechazo por cama ocupada
(`BED_NOT_ASSIGNABLE`) y por carrera (`BED_DOUBLE_OCCUPANCY`) · ingreso sin cama y
asignación · traslado (origen sucio + orden) · intercambio A17 · egreso · la cama
vuelve a ser asignable al terminar la limpieza · censo (vista previa → cierre →
ajuste → recarga dura) · indicadores · expediente · nueve estados M34 salvo S1.
Cada paso de datos se lee otra vez del servidor simulado tras la acción; los
eventos HL7 (A01, A02, A17, A03, A20) se comprueban en el registro del simulador
(no es un `SELECT` del outbox: no hay base).

## Hallazgos del recorrido (no los veían las pruebas unitarias)

- Las secciones del menú tienen su pantalla en `PANTALLAS_DIFERIDAS`; una ruta
  suelta en `app.routes.ts` queda tapada por el marcador de sección.
- Un hombre a una habitación de mujeres sale también por «alojamiento del mismo
  sexo» si la habitación comparte; la regla solo mira habitaciones, no áreas.
- La prueba cruzada se desvía con los datos sembrados (pacientes que cruzan los
  bordes del período): es el aviso esperado, no un fallo.

## Verificación (peldaños reales)

- `tsc` app limpio; `eslint --max-warnings=0` limpio sobre lo tocado.
- Unit corrida: 78 pruebas (simulador + cliente + lógica + F1) en verde al cierre
  del primer commit; ver el commit de pruebas para las de componentes.
- Navegador (maqueta, build `development,demo` **JIT** por memoria): 61/61. Tras
  esa corrida solo cambió metadato del registro de menú (`onlyForTenantTypes`) y
  se comprobó aparte con un guion corto (arriba); el recorrido completo no se
  repitió porque el Chromium compartido empezó a morir por memoria.
- **No corridas** (el build AOT de pruebas muere por memoria con el árbol completo):
  `navigation.map.spec`, `navigation.subgroups.spec`, `navigation.service.spec`,
  `app.routes.spec` y `patient-chart.spec`, que son las que ejercitan lo que tocan
  el menú, las rutas y el expediente. Quedan como primera comprobación del integrador.
- **No verificado**: API real; axe ni lector de pantalla; la suite completa;
  S1 (ruta con autenticación pendiente) en navegador; el plano ni el tablero de F2
  reales; un build AOT completo (el de navegador se hizo con `--aot=false` porque
  los builds AOT mueren por memoria en este entorno compartido; `tsc` no revisa
  plantillas, pero el recorrido las ejercitó todas en ejecución).
