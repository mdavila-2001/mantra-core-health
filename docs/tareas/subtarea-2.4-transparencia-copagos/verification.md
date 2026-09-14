# Subtarea 2.4 — Verificación de la interfaz del paciente

Fecha: 13 de septiembre de 2026. Este registro complementa el plan aprobado y el walkthrough integrado de API, modelo y bóveda. El perfil está **VERIFICADO** en el recorrido navegador → API → PostgreSQL aislado. La liquidación por pedidos en ese recorrido sigue **PENDIENTE**. Las pruebas visuales con mocks se registran por separado.

## Resultado comprobado

- «Seguros y tutores» usa `PatientCoverageCard`, conserva tutores y admite coberturas de una API anterior sin `benefits`.
- Las pólizas vencidas y futuras permanecen visibles con vigencia coherente. La afiliación provisional no se presenta como carnet validado.
- Los beneficios distinguen servicio específico, categoría, cero, valores ausentes, porcentajes fraccionarios, copago, deducible y moneda. Sólo BOB se presenta como «Bs».
- WhatsApp y call center se renderizan independientemente. El enlace de WhatsApp incluye paciente, aseguradora y póliza disponible, conserva `noopener` y el aviso de apertura en otra pestaña. No se enviaron mensajes.
- Farmacia y diagnósticos muestran la publicación mediante `PatientInsuranceSettlement`. «A tu cargo» y «Excluido sin asignar» permanecen separados; los importes se conservan como cadenas decimales.
- La normalización retira publicaciones incompletas o sustituidas. El adaptador de farmacia excluye la liquidación del acceso de personal.

## Pruebas Angular

Primer lote: **5 archivos, 107 pruebas aprobadas**.

```powershell
yarn.cmd ng test --watch=false --include=src/app/features/account/my-profile/my-profile.spec.ts --include=src/app/core/data-access/profiles/profiles.client.spec.ts --include=src/app/shared/components/molecules/patient-coverage-card/patient-coverage-card.spec.ts --include=src/app/shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement.spec.ts --include=src/app/core/data-access/pharmacy-orders/pharmacy-orders.adapter.spec.ts --include=src/app/features/account/diagnostic-orders/diagnostic-orders.spec.ts
```

El patrón `pharmacy-orders.adapter.spec.ts` no correspondía a un archivo y Angular lo omitió. El lote final ejecutó el archivo existente `pharmacy-orders.client.spec.ts`, además del normalizador y la adaptación de liquidaciones.

Lote final, posterior a las correcciones detectadas en capturas: **7 archivos, 76 pruebas aprobadas**. Compilación de pruebas: 245,777 s; ejecución: 65,29 s.

```powershell
$env:NG_BUILD_MAX_WORKERS='1'
yarn.cmd ng test --watch=false --include=src/app/core/data-access/insurance/patient-insurance-settlement.types.spec.ts --include=src/app/shared/components/molecules/patient-coverage-card/patient-coverage-card.spec.ts --include=src/app/shared/components/molecules/patient-insurance-settlement/patient-insurance-settlement.spec.ts --include=src/app/core/data-access/pharmacy-orders/pharmacy-orders.client.spec.ts --include=src/app/core/data-access/diagnostics/diagnostics.client.spec.ts --include=src/app/features/account/pharmacy-orders/order-detail/order-detail.spec.ts --include=src/app/features/account/pharmacy-orders/pharmacy-orders.spec.ts
```

Los dos lotes comparten las diez pruebas de las tarjetas; los conteos anteriores son por ejecución y no deben sumarse como casos diferentes. El lote final cubre también importes mayores que el entero seguro de JavaScript, publicaciones malformadas, exclusiones por ítem, clientes y plantillas de lista y detalle de farmacia.

Último lote, posterior al hallazgo de estados canónicos en PostgreSQL: **un archivo, ocho pruebas aprobadas**, duración del runner 45,99 s. Comprueba códigos antiguos y con namespace, pólizas vencidas y futuras, contactos y precisión. Se solapa con los lotes anteriores; no son ocho casos adicionales.

```powershell
$env:NG_BUILD_MAX_WORKERS='1'
yarn.cmd ng test --watch=false --include=src/app/shared/components/molecules/patient-coverage-card/patient-coverage-card.spec.ts
```

## Tipos, lint y producción

```powershell
yarn.cmd typecheck
yarn.cmd eslint src/app/core/data-access/insurance/patient-insurance-settlement.types.ts src/app/core/data-access/insurance/patient-insurance-settlement.types.spec.ts playwright/patient-coverage-copays.real.spec.ts
$env:NG_BUILD_MAX_WORKERS='1'
yarn.cmd ng build
git diff --check
```

Todos finalizaron con código 0. Previamente también pasó ESLint sobre los archivos TypeScript y HTML modificados y nuevos del alcance. El segundo comando anterior cerró los cambios posteriores del contrato y del spec real. Las últimas aserciones añadidas al spec mock se ejecutaron en el recorrido visual final.

`typecheck` revisa aplicación, Cypress y Playwright; la comprobación de plantillas Angular procede de las pruebas y del build. Se invocó `ng build` directamente para no regenerar configuración de entorno ni inventario de componentes fuera del alcance.

El build de producción terminó en **166,570 s**, generó `dist/mantra-core-health` y prerenderizó ocho rutas estáticas. El paquete inicial fue de **1,15 MB**: supera el umbral de advertencia de 620 kB y permanece bajo el umbral de error de 1,3 MB. También informó imports Angular no usados, dependencias CommonJS y presupuestos de estilos de componentes existentes; las tarjetas nuevas no produjeron advertencias de presupuesto. No se debilitaron umbrales. Las pruebas informaron las advertencias existentes de `localStorage` experimental y canvas de jsdom, sin fallos.

El push del commit UI `7dc9c765` completó con código 0 el hook oficial `.githooks/pre-push`: ejecutó `yarn build` y `node scripts/check-bundle-budget.mjs`. El build de producción pasó sin omitir el hook. Se abrió el [PR UI #454](https://github.com/mdavila-2001/mantra-core-health/pull/454) como borrador hacia `dev`, con revisores `jsaldias39` y `PabloArauzCaballero`, mientras se completa el recorrido real.

El push final del código `78345b46` terminó con **código 0**, ejecutando el hook oficial sin `SALTAR_BUILD` ni `--no-verify`. `yarn build` pasó en **162,317 s**, prerenderizó ocho rutas y reportó **1,15 MB** de inicial (326,96 kB estimados de transferencia). `check-bundle-budget` también pasó; su medición de entradas fue **248,42 kB**. Son métricas de herramientas distintas y no se suman. Se conservaron las advertencias existentes de imports, presupuestos y CommonJS. Log local: `artifacts/patient-coverage-copays/real-profile/ui-pre-push-final.log`.

## Playwright y revisión visual

```powershell
$env:NG_BUILD_MAX_WORKERS='1'
yarn.cmd ng serve --host 127.0.0.1 --port 4214

# En otra consola, cuando el servidor indicó que estaba disponible:
$env:E2E_BASE_URL='http://127.0.0.1:4214'
yarn.cmd pw playwright/patient-coverage-copays.spec.ts --reporter=list --output=artifacts/playwright/patient-coverage-copays-mocks
```

Resultado final: **6 pruebas aprobadas en 1,8 minutos**, un trabajador y ejecución serial, en 1440×900 y 390×844. El servidor se detuvo después de las pruebas para liberar memoria.

El recorrido comprobó pólizas, beneficios, canales independientes, navegación con Tab, foco visible, área táctil del contacto de al menos 44 px, enlaces seguros y ausencia de desbordes. Farmacia y diagnósticos incluyeron aprobación, aprobación parcial, rechazo del seguro y publicación pendiente. Se preservaron las indicaciones de preparación, los enlaces a resultados y la distinción del rechazo logístico de farmacia. Las esperas se basan en contenido concreto.

Se inspeccionaron visualmente las seis capturas definitivas, conservadas fuera de Git:

| Superficie       | 1440×900                                                                                                      | 390×844                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pólizas          | [coverage-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/coverage-1440.png)                 | [coverage-390.png](../../../artifacts/patient-coverage-copays/final-mocks/coverage-390.png)                 |
| Farmacia parcial | [pharmacy-partial-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/pharmacy-partial-1440.png) | [pharmacy-partial-390.png](../../../artifacts/patient-coverage-copays/final-mocks/pharmacy-partial-390.png) |
| Diagnósticos     | [diagnostics-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/diagnostics-1440.png)           | [diagnostics-390.png](../../../artifacts/patient-coverage-copays/final-mocks/diagnostics-390.png)           |

La primera revisión detectó una contradicción entre vigencia y estado «activa», una exclusión mock asignada íntegramente al primer medicamento y la posición del encabezado fijo al capturar tras enfocar un contacto. Se corrigieron las tres causas y se repitió el recorrido. Las imágenes finales muestran 29,50 = 14,75 + 5,90 + 8,85 en farmacia, con exclusiones de 2,40 y 6,45 para sus respectivos ítems. El rechazo diagnóstico mantiene 100,00 excluidos y 0,00 a cargo del paciente; las cláusulas completas permanecen legibles.

El control flotante existente de datos de prueba aparece en las capturas desktop mock; no se ocultó para producir evidencia. El banner global también aparece en el entorno real porque `app.html` lo monta incondicionalmente; ni `mockBackend:false` ni `demoPresets` controlan ese banner. Se conserva visible como comportamiento previo. `view_image` falló por el helper ACL de Windows; la revisión utilizó la lectura autorizada del PNG y su presentación como imagen, sin editarlo.

## Perfil real, API y límites pendientes

La integración real detectó dos defectos que los primeros mocks no revelaban. MikroORM expandía `ANY(?)` como escalar y PostgreSQL devolvía HTTP 400; el filtro usa ahora `IN` con parámetros escalares deduplicados. La primera revisión visual real encontró «Inactiva» junto a «Cobertura activa»: los conceptos registrados incluyen `insurance:`. La API determina ahora la vigencia por FK e identidades `INS.*`, conserva el código registrado en DTO y la tarjeta admite explícitamente ambos formatos del código. Las fechas civiles mantienen referencia `America/La_Paz` y límites inclusivos.

La moneda usa la utilidad compartida de seguros para resolver identidades canónicas y alias legacy USD, con la FK de la misma consulta y sin nuevas lecturas ni cambios de elegibilidad. `coverageOrder` permanece en DTO y normalizador, con prueba de compatibilidad; API ordena por prioridad y la lista conserva ese orden. La lista anterior no mostraba prioridad como texto.

Último lote API: **tres suites, 148 pruebas aprobadas en 13,162 s** (115 de perfil/vigencia y 33 de proyección). Es el último resultado de este alcance y no se suma con los lotes anteriores de 112, 114 o 115. Lint de siete archivos y compilación incremental terminaron con código 0.

```powershell
# Desde API:
yarn.cmd test --runInBand --runTestsByPath src/modules/profiles/services/profiles-patients.service.spec.ts src/modules/profiles/patient-coverage-validity.spec.ts src/modules/insurance/services/patient-settlement-projection.spec.ts
yarn.cmd tsc -p tsconfig.build.json --incremental
python node_modules/.cache/verify-copays-profile.py
```

El último comando usa el fixture local ignorado, login y lectura HTTP reales. API `evidence/api-final/profile-real-http-final.json` acredita: ambos pacientes obtienen login/perfil 200 e identidad propia; póliza y beneficio del primero `CURRENT`; BOB, porcentaje `80.25`, copago `0`, deducible `10.50`; el segundo no recibe póliza ni plan del primero. No registra credenciales, tokens ni payloads privados. Los datos se crearon mediante escrituras HTTP del setup aislado; esta comprobación no escribió tablas.

El servicio del beneficio está registrado como **Complete blood count**. **Hemograma completo** es el nombre de la oferta diagnóstica y no reemplaza el concepto del beneficio. Los teléfonos ficticios añadidos siguen exclusivamente en el handler mock de perfiles y expectativas de prueba. El perfil real sin canales muestra «No informado».

También pasaron el último `yarn.cmd typecheck` completo (aplicación, Cypress y Playwright) y ESLint sobre tarjeta, spec de tarjeta y spec real. Logs UI: `artifacts/patient-coverage-copays/real-profile/{coverage-card-final-tests,ui-final-typecheck,ui-final-lint}.log`.

### Playwright real y capturas

Se generó el entorno mediante el mecanismo oficial, con URL de API vacía. `e2e-real` desactiva el interceptor mock y el proxy HTTP/WebSocket apunta a API 3125. `env.generated.ts` permanece ignorado y no se publica.

```powershell
@'
process.env.PUBLIC_API_BASE_URL = '';
process.env.PUBLIC_TELEMETRY_ENABLED = 'false';
await import('./scripts/generate-env.mjs');
'@ | node --input-type=module
$env:NG_BUILD_MAX_WORKERS='1'
yarn.cmd ng serve --configuration e2e-real --host 127.0.0.1 --port 4215 --proxy-config proxy.conf.json

# En otra consola; E2E_COPAYS_FIXTURE apunta al JSON local ignorado de API:
$env:E2E_BASE_URL='http://127.0.0.1:4215'
$env:E2E_API_URL='http://127.0.0.1:3125'
yarn.cmd pw playwright/patient-coverage-copays.real.spec.ts --grep 'real patient profile' --reporter=list --output=artifacts/playwright/patient-coverage-copays-real-profile-final
```

Resultado final: **2/2 aprobadas en 26,6 s**, serial con un worker, en **1440×900 y 390×844**. Cada prueba entra desde el formulario, navega a «Seguros y tutores», exige póliza y beneficio vigentes, comprueba importes exactos y ausencia de desbordes. Ambas capturas se inspeccionaron visualmente después del resultado automático:

| Evidencia real           | 1440×900                                                                                             | 390×844                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Perfil                   | [coverage-1440.png](../../../artifacts/patient-coverage-copays/final-real-profile/coverage-1440.png) | [coverage-390.png](../../../artifacts/patient-coverage-copays/final-real-profile/coverage-390.png) |
| Tráfico sin credenciales | [traffic-1440.json](../../../artifacts/patient-coverage-copays/final-real-profile/traffic-1440.json) | [traffic-390.json](../../../artifacts/patient-coverage-copays/final-real-profile/traffic-390.json) |

Los JSON contienen POST `/iam/auth/login` 200 y GET `/profiles/patients/me` 200 desde el origen 4215, resueltos por el proxy aislado. `blockedPort3000Requests` está vacío en ambos. El guard de contexto aborta HTTP al puerto 3000 y cierra WebSockets hacia él sin conectarlos; cualquier intento falla la prueba. No fabrica respuestas ni usa `route.fulfill`. Los service workers están bloqueados y los archivos sólo registran método, origen, ruta y estado.

La primera ejecución real pasó 2/2, pero la revisión de capturas encontró el defecto de estado; se conservan en `artifacts/patient-coverage-copays/real-profile/initial`. Ese resultado automático no se tomó como cierre. Las capturas finales muestran póliza y beneficio vigentes, afiliación provisional identificada, importes completos y campos ausentes informados. Se conservó el banner global previo sin ocultarlo por CSS. El tráfico, el entorno y los datos persistidos acreditan el backend real. `view_image` falló por el helper ACL de Windows; se utilizó lectura autorizada del PNG como imagen, sin modificarlo.

El servidor UI final se detuvo tras validar PID, comando y listener 4215. No se enviaron mensajes ni se abrió WhatsApp en el recorrido real.

### Recorrido financiero todavía pendiente

[patient-coverage-copays.real.spec.ts](../../../playwright/patient-coverage-copays.real.spec.ts) contiene cinco pruebas seriales: perfil y liquidaciones por separado en cada viewport, más aislamiento por identificador de pedido. El descubrimiento estático encontró cinco; únicamente las dos de perfil se ejecutaron contra API real.

`beforeAll` exige credenciales no vacías y UUID del paciente. Las pruebas financieras y el aislamiento por pedido requieren cuatro UUID distintos por origen antes de navegar: aprobación, parcial, rechazo y pendiente. Una colección incompleta falla y no produce un falso aprobado. La responsabilidad cero se valida exactamente en `dd`, con cualquier escala decimal de cero en BOB y sin aceptar `100.00`.

**PENDIENTE:** completar fixtures financieros mediante escrituras autorizadas y ejecutar las otras tres pruebas reales. Este documento no acredita publicación real, recarga de liquidaciones, las ocho órdenes ni aislamiento por identificador de pedido. La comprobación del segundo perfil no sustituye esos casos. Los seis escenarios mock permanecen separados del recorrido real.

## SECURITY — Detalle operativo para el prestador

Amenaza: un OWNER/ADMIN necesita las identidades de las líneas congeladas para crear un reclamo, pero ese acceso no debe revelar la póliza o liquidación privada del paciente ni alcanzar pedidos de otro tenant.

Control incorporado en `PharmacyOrdersService.getOrder`: comprobar primero que la farmacia pertenece al tenant de la petición; después resolver titularidad, rol de plataforma o membresía activa OWNER/ADMIN mediante `TenantAdministrationService`. El GET mantiene autenticación JWT y delega la autorización al servicio. Listado operativo y mutaciones conservan sus decoradores de roles. La comprobación del tenant precede la expiración perezosa y la composición; terceros e inexistentes producen el mismo cuerpo 404. Sólo el titular consulta `PatientSettlementService`.

Pruebas añadidas a la suite de pedidos: OWNER/ADMIN activos con líneas congeladas, STAFF e inactivos rechazados, aislamiento de tenant antes de expirar, acceso de plataforma, enriquecimiento exclusivo del titular y metadatos de rutas privadas y mutaciones. Se actualizaron los doubles de `pharmacy-orders.service.spec.ts` y `pharmacy-orders.staff.spec.ts`. La coordinación ejecutó ambas suites: **84/84 pruebas aprobadas en dos archivos**, y el typecheck API finalizó con código 0.

```powershell
# Desde el repositorio API:
yarn.cmd test --runInBand src/modules/pharmacy_inventory/services/pharmacy-orders.service.spec.ts src/modules/pharmacy_inventory/services/pharmacy-orders.staff.spec.ts
```

La comprobación HTTP/PostgreSQL de la nueva autorización permanece como límite pendiente del recorrido real. La actualización final del spec, compatibilidad de la tarjeta y este registro utiliza el PR UI #454; el resultado del hook de producción se registra en la evidencia de la coordinación.
