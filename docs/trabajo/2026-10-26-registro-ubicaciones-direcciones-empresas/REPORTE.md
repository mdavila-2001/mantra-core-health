# Reporte — Alta de paciente: mapa, GPS obligatorio, calle automática, libreta de direcciones y empresas del SEPREC

> **AVANCE: 13 / 14 — 92,9 %.** Falta H3.M5 (la API real de punta a punta): BLOQUEADO por Docker Hub (429).

- Fecha: 2026-10-26 · Plan: [PLAN.md](./PLAN.md)
- Rama `claude/ecstatic-keller-pp0xrx` en los tres repos, sobre `origin/dev`:
  `mantra-core-health` (front), `mantra-core-health-api` (API), `mantra-core-health-model` (modelo).
- Peldaño de evidencia:
  - Front: `VERIFIED` contra el **backend mock** (config `demo`, la misma del sitio demo). Navegador en 390/768/1440, claro y oscuro.
  - API: `TESTED` (pruebas dirigidas con dobles). No llegó a `VERIFIED`: la API no se pudo levantar (ver Pendiente).
  - Modelo: `VERIFIED` del patch sobre Postgres 16 real.
  - Peldaño del trabajo (el más bajo): **`TESTED`**.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1 | Acercamiento: fondo gris, departamento gris con líneas negras, municipio azul petróleo, punto rojo | navegador: `getComputedStyle` | PASS: fondo `rgb(225,226,226)`, departamento `rgb(204,205,205)`, municipio `rgb(11,85,126)`, punto `rgb(181,83,60)` ([navegador.txt](evidencia/navegador.txt), `02-acercamiento-*.png`) |
| H1.M2 | Etiqueta completa «Departamento: … · Provincia: … · Municipio: …» | `department-map.spec` + navegador | PASS: «Departamento: Santa Cruz · Provincia: Andrés Ibáñez · Municipio: Santa Cruz de la Sierra» |
| H1.M3 | `municipalityAt` (punto → municipio, sin red) | `locality-detail.spec` | PASS 12/12; con geometría real: la plaza de Santa Cruz → `070101`, Cobija → Cobija, Lima → `null` |
| H1.M4 | El GPS elige y resalta el municipio | `location-picker.spec` | PASS 20/20; **falla sin la función** (1 failed, comprobado) |
| H2.M1 | GPS de la casa obligatorio (confirmado) | `register-patient.spec` + navegador | PASS (la spec completa, dentro de las 1355 de abajo); en el navegador no avanza sin punto y muestra «Marque su casa en el mapa y pulse «Confirmar dirección actual».» en las 5 combinaciones |
| H2.M2 | La calle se escribe desde el punto | `register-patient.spec` (6 nuevas) + navegador | PASS; no pisa lo tecleado, descarta respuestas tardías, dice si no hay calle o si el proveedor cae |
| H2.M3 | «Otra empresa» primera y visible al buscar | `register-patient.spec` | PASS |
| H3.M1 | Modelo v4.2.61 (`label`, `is_preferred`, índices, patch) | `psql -f patch` ×2 + inserción en conflicto + `python3 -m unittest salud-db/test_addresses_label_preferred_patch.py` | PASS: 2.ª pasada sólo NOTICE; 2.ª preferida vigente rechazada por `uq_addresses_owner_preferred`; contrato 4/4 |
| H3.M2 | API de la libreta | `corepack yarn test src/modules/profiles/application/services/patient-address-book` | PASS 11/11 (doble que imita el índice único) |
| H3.M3 | Pantalla «Mis direcciones» | `address-book.spec`, `my-profile*.spec` + navegador | PASS; guardar → la nueva queda preferida y primera → **recargar** → sigue igual (mock con persistencia), en 390/768/1440 y oscuro |
| H3.M4 | Dobles mock (sitio demo) | `node scripts/check-mock-vs-client.mjs` | PASS para las rutas nuevas |
| H4.M1 | `POST /public/geo/reverse` | `corepack yarn test src/modules/geo` | PASS 74/74; incluye respuesta real de Nominatim capturada y tope de cola (falla sin el tope, comprobado) |
| H5.M1 | 10 empresas del SEPREC en `VS_BO_EMPLOYER` | `corepack yarn test src/common/seed/bo-employers` | PASS 13/13 |
| H6.M1 | Diagnóstico del duplicado | bundle del demo descargado | El demo sirve un build **anterior** al arreglo ([duplicado-ambulancia-demo.txt](evidencia/duplicado-ambulancia-demo.txt)) |

## A medias

Ninguna.

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H3.M5 — API real de punta a punta (libreta y calle contra Postgres) | BLOQUEADO | `docker compose --profile local-db up postgres postgres-init` falló: `registry-1.docker.io … 429 Too Many Requests` al bajar `timescale/timescaledb-ha:pg18`. Se destraba con acceso a Docker Hub, o en el entorno dev/test tras desplegar. Lo que sí se probó contra el doble: correcto (crear/preferir/corregir/quitar), límite (tope de 10, domicilio no se quita, sin preferida = domicilio), inválido (id ajeno 404, carrera 409). |

## Evidencia

```text
# front — suites afectadas (incluye toda la capa mock)
yarn ng test --include register-patient, location-picker, department-map, locality-detail,
  my-profile, my-profile.offered-verification, address-book, core/mock/**
 Test Files  106 passed (106)
      Tests  1355 passed (1355)
yarn typecheck → exit 0 · eslint (archivos tocados) → exit 0 · check-contrast → 116 combinaciones, sin excepciones

# front — suite completa (ver evidencia/suite-completa.txt)
 Test Files  10 failed | 923 passed (933) / Tests 35 failed | 12770 passed
 2 de los 10 eran míos y se corrigieron después (my-profile.offered-verification sin dobles de la libreta;
 address-book: timeout de 5 s sólo bajo carga, 115 ms sola). Los otros 8, corridos solos:
 con el cambio 80/80 PASS, sobre dev limpio 80/80 PASS → carga del entorno, no el cambio.

# front — revisión independiente (frontend-reviewer): NO APROBADO en la primera pasada; corregido:
#  HIGH  2 specs e2e sin marcar la casa (registro-persistencia, registro-empresa-y-mapa) → agregado marcarYConfirmarCasa
#  HIGH  el punto con el que NACE el selector pisaba la localidad elegida (borrador, «Editar») → sólo un punto NUEVO elige
#  MED   aviso «Escribimos la calle» aunque se conservara la de la persona → estado «conservada»
#  MED   la calle del punto no se re-sembraba al elegir A MANO otro municipio → salida municipioPorPunto del selector
#  MED   geocodificación sin cancelar ni timeout → switchMap + timeout(10 s) + takeUntilDestroyed; guardar ya no espera la calle
#  MED   foco perdido al abrir/cerrar el formulario; «Quitar» sin confirmación → foco gestionado + DialogService.confirm
#  MED   la libreta se construía con la pestaña cerrada → @if por pestaña + prueba (no pide hasta abrirla)
#  LOW   $any en plantilla → método; calleDelPunto se reinicia al abrir
yarn ng test (6 specs afectadas, tras las correcciones) → Test Files 6 passed · Tests 257 passed
yarn typecheck → exit 0 · eslint → exit 0 · check-max-lines sin los archivos tocados por este trabajo (salvo register-patient, ver Riesgos)

# front — e2e Playwright contra `ng serve --configuration development,demo` (Chromium de /opt/pw-browsers)
carril-03 + carril-04 + registro-empresa-y-mapa → 10 passed · 2 failed · 3 did not run (serie)
  FAIL carril-03 «el alta completa viaja…»: sólo por `POST /telemetry/onboarding-events → 400`
       («property events should not exist»), que el mock devuelve AL CARGAR la página, antes de tocar nada → previo y ajeno.
  FAIL registro-empresa-y-mapa «el paso del trabajo…»: espera `registration-work-address` visible sin elegir la
       localidad del trabajo; en origin/dev ese campo ya tiene `showWhen: workMunicipalityConceptId` → previo, no corría
       antes porque el test anterior de la serie fallaba (ese sí era mío de arreglar y quedó en verde).

# API
corepack yarn test src/modules/profiles/application/services/patient-address-book src/modules/common → 18 suites, 170 tests PASS
corepack yarn test src/modules/geo → 10 suites, 74 tests PASS
corepack yarn test src/common/seed/bo-employers → 13 tests PASS
yarn typecheck → sin errores · eslint (archivos tocados) → exit 0

# modelo
psql -f SQL/patches/2026-10-26_v4261_addresses_label_preferred.sql   (dos veces) → PASADA1 OK / PASADA2 OK (NOTICE already exists)
insertar 2 preferidas vigentes del mismo dueño → ERROR duplicate key … uq_addresses_owner_preferred
python3 -m unittest salud-db/test_addresses_label_preferred_patch.py → Ran 4 tests OK
```

Capturas (`evidencia/`): `01-gps-obligatorio-*`, `02-acercamiento-*`, `03-lugares-donde-vive-confirmado-*`,
`04-contacto-ambulancia-*`, `05..07-mis-direcciones-*` en 390/768/1440 claro y 390/1440 oscuro.
Las capturas son anteriores a las correcciones de la revisión: esas correcciones cambian conducta (foco,
confirmación, cancelación), no el aspecto, y están cubiertas por las pruebas de arriba.

## No cubierto

- **La API real** (H3.M5): ni la libreta ni `/public/geo/reverse` se ejercitaron contra la API levantada. La calle real de Nominatim sólo se probó con `curl` directo al proveedor y con su respuesta capturada en una prueba.
- **La deriva ORM ↔ DDL** con `yarn orm:audit` no corrió: necesita la bóveda `Mantra Core Health Vault`, que no está en este entorno. El DDL de `common.addresses` y la entidad se compararon a mano (dos columnas).
- **«Otra empresa» primera**: sólo prueba unitaria, sin captura de navegador.
- **e2e no corridos**: `altas-api-real-tres-escenarios` (necesita la API real), `altas-sin-cobertura`, `auditoria-qa-mockup`, `registro-persistencia`. Se actualizaron para marcar la casa y compilan (`tsc -p playwright/tsconfig.json` exit 0).
- **Revisión, puntos abiertos (LOW)**: los errores del servidor en «Mis direcciones» se muestran en un aviso general, no por campo; el error de localidad no queda enlazado por `aria-describedby` al select; un punto guardado no se puede quitar desde la libreta (sólo moverlo); editar el domicilio en la libreta no refresca la pestaña «Datos personales» hasta recargar.
- **El seed de empresas en una base**: no se corrió `seed:boot` (sin base); el catálogo se probó a nivel de datos.
- **El sitio demo**: no se volvió a desplegar desde aquí.

## Desvíos del plan

- El plan se escribió durante la ejecución, no antes.
- El acercamiento se rehízo: la primera lectura (departamento negro) dejaba el cuadrado casi todo negro con Santa Cruz; la captura lo mostró y se pasó a relleno gris con líneas negras.
- `gen_ddl.py` reescribía 110 archivos ajenos (falta la bóveda de FK): sólo se versionó `SQL/02_common/02_tables.sql` y `04_indexes.sql`.
- El patch se numeró **v4261** porque la API ya vendoriza v4252..v4260 que el modelo todavía no tiene; por lo mismo **no** se corrió `yarn db:vendor` completo (habría borrado esos 7 patches): se copiaron los 3 archivos a mano.
- La revisión de seguridad automática encontró la cola de geocodificación sin tope: corregido en un commit aparte.

## Riesgos residuales y deuda

- **El demo sigue con el build viejo** hasta que se despliegue: allí seguirá el duplicado y no estará nada de esto.
- **Nominatim público**: 1 consulta/s y política de uso justo. Para volumen real: servidor propio o proveedor pago (`GEOCODING_REVERSE_URL`). La cola tiene tope de 10: con más altas simultáneas, la calle no se escribe y la persona la tipea (no bloquea el alta).
- **`register-patient.ts/.html` crecen** (+107/+8 líneas) y ya estaban por encima de su techo en `dev` (`check-max-lines`). Partirlo es trabajo aparte.
- **GPS obligatorio**: quien no puede o no quiere marcar su casa ya no puede crear la cuenta. Es lo pedido; si genera abandono, se vuelve atrás quitando `required`. Si fallan a la vez los mosaicos de OpenStreetMap y la geolocalización del navegador, no hay forma de marcar el punto: no hay respaldo (decisión del cliente).
- La libreta todavía **no la usa ningún flujo de envío** (farmacia): es el siguiente paso.
- Avisos previos y ajenos en consola del demo: `POST /telemetry/onboarding-events → 400` («property events should not exist») y `ResizeObserver loop` en 390/768.

## Decisiones y ambigüedades

Las cinco ambigüedades (A-1..A-5) están en el [PLAN.md](./PLAN.md); confirmar con el cliente / Pablo. Decisión fullstack tomada:
una sola tabla (`common.addresses`) con un uso nuevo `ADDR_SAVED` en vez de una tabla paralela; la preferida garantizada por la base;
la calle desde el punto la pide la API (la CSP del front no se abre).
