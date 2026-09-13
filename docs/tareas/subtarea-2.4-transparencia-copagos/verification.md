# Subtarea 2.4 — Verificación de la interfaz del paciente

Fecha: 13 de septiembre de 2026. Este registro complementa el plan aprobado y el walkthrough integrado de API, modelo y bóveda. El recorrido navegador → API → PostgreSQL está **PENDIENTE**; las pruebas visuales de este documento usan mocks.

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

| Superficie | 1440×900 | 390×844 |
|---|---|---|
| Pólizas | [coverage-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/coverage-1440.png) | [coverage-390.png](../../../artifacts/patient-coverage-copays/final-mocks/coverage-390.png) |
| Farmacia parcial | [pharmacy-partial-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/pharmacy-partial-1440.png) | [pharmacy-partial-390.png](../../../artifacts/patient-coverage-copays/final-mocks/pharmacy-partial-390.png) |
| Diagnósticos | [diagnostics-1440.png](../../../artifacts/patient-coverage-copays/final-mocks/diagnostics-1440.png) | [diagnostics-390.png](../../../artifacts/patient-coverage-copays/final-mocks/diagnostics-390.png) |

La primera revisión detectó una contradicción entre vigencia y estado «activa», una exclusión mock asignada íntegramente al primer medicamento y la posición del encabezado fijo al capturar tras enfocar un contacto. Se corrigieron las tres causas y se repitió el recorrido. Las imágenes finales muestran 29,50 = 14,75 + 5,90 + 8,85 en farmacia, con exclusiones de 2,40 y 6,45 para sus respectivos ítems. El rechazo diagnóstico mantiene 100,00 excluidos y 0,00 a cargo del paciente; las cláusulas completas permanecen legibles.

El control flotante existente de datos de prueba aparece en las capturas desktop mock; no se ocultó para producir evidencia. El entorno real desactiva esos controles. `view_image` falló por el helper ACL de Windows; la revisión utilizó la lectura autorizada del PNG y su presentación como imagen, sin editarlo.

## Perfil API y límites pendientes

La lectura del perfil se verifica además mediante dos suites API: **112 pruebas aprobadas**, correspondientes al servicio de pacientes y al helper de vigencia. Las consultas de cobertura y beneficios se hacen por lotes; las fechas civiles se comparan con una referencia en `America/La_Paz`. El registro integrado del backend conserva sus comandos y verificación PostgreSQL.

Los teléfonos de ejemplo nuevos se encuentran exclusivamente en `src/app/core/mock/handlers/profiles.handlers.ts` y expectativas de prueba. Las liquidaciones ficticias se construyen en `src/app/core/mock/fixtures/patient-settlements.ts` y son consumidas únicamente por handlers mock y pruebas; no hay teléfonos ficticios añadidos a la lectura API ni a componentes de producción.

**PENDIENTE:** ejecutar [patient-coverage-copays.real.spec.ts](../../../playwright/patient-coverage-copays.real.spec.ts) contra UI 4215, API 3125 y PostgreSQL aislado, usando `E2E_COPAYS_FIXTURE` creado mediante escrituras HTTP reales. El spec tiene cinco pruebas seriales: perfil y liquidaciones por separado en cada viewport, más aislamiento de otro paciente. El perfil puede comprobarse aunque la preparación de liquidaciones todavía esté pendiente.

`beforeAll` exige credenciales del paciente no vacías y un identificador de perfil UUID. Antes de navegar, cada prueba de liquidaciones y la prueba de aislamiento exigen cuatro órdenes distintas con UUID válidos por origen: aprobación, parcial, rechazo y pendiente. Una colección vacía o incompleta falla; no puede producir una aprobación sin recorrer pedidos. Las credenciales del segundo paciente se validan al ejecutar aislamiento y no bloquean el recorrido exclusivo de perfil.

El descubrimiento ligero del spec real terminó con código 0: **cinco pruebas en un archivo**. Se ejecutaron sólo formato y listado, sin navegador, hooks `beforeAll` ni llamadas a API:

```powershell
yarn.cmd prettier --write playwright/patient-coverage-copays.real.spec.ts
yarn.cmd pw playwright/patient-coverage-copays.real.spec.ts --list
```

El primer listado detectó que Playwright carga este repositorio como CommonJS y no admite `import.meta.dirname`. Se corrigió la ruta alternativa del fixture usando `process.cwd()` desde el repositorio UI, con `E2E_COPAYS_FIXTURE` como primera opción, y el segundo listado encontró las cinco pruebas. Este resultado acredita el parseo y descubrimiento; no acredita las precondiciones de fixture ni el recorrido real.

Comando preparado para ejecutar exclusivamente el perfil real, todavía **no ejecutado**:

```powershell
$env:E2E_BASE_URL='http://127.0.0.1:4215'
$env:E2E_API_URL='http://127.0.0.1:3125'
yarn.cmd pw playwright/patient-coverage-copays.real.spec.ts --grep 'real patient profile' --reporter=list --output=artifacts/playwright/patient-coverage-copays-real-profile
```

La separación del spec y las validaciones de fixture están pendientes de ejecutar. Aprobar únicamente perfil no acredita la publicación, la recarga de liquidaciones, las ocho órdenes ni el aislamiento de otro paciente. El recorrido completo y su evidencia visual permanecen pendientes. Publicación de PR y cierre documental integrado corresponden a la coordinación principal.

## SECURITY — Detalle operativo para el prestador

Amenaza: un OWNER/ADMIN necesita las identidades de las líneas congeladas para crear un reclamo, pero ese acceso no debe revelar la póliza o liquidación privada del paciente ni alcanzar pedidos de otro tenant.

Control incorporado en `PharmacyOrdersService.getOrder`: comprobar primero que la farmacia pertenece al tenant de la petición; después resolver titularidad, rol de plataforma o membresía activa OWNER/ADMIN mediante `TenantAdministrationService`. El GET mantiene autenticación JWT y delega la autorización al servicio. Listado operativo y mutaciones conservan sus decoradores de roles. La comprobación del tenant precede la expiración perezosa y la composición; terceros e inexistentes producen el mismo cuerpo 404. Sólo el titular consulta `PatientSettlementService`.

Pruebas añadidas a la suite de pedidos: OWNER/ADMIN activos con líneas congeladas, STAFF e inactivos rechazados, aislamiento de tenant antes de expirar, acceso de plataforma, enriquecimiento exclusivo del titular y metadatos de rutas privadas y mutaciones. Se actualizaron los doubles de `pharmacy-orders.service.spec.ts` y `pharmacy-orders.staff.spec.ts`. **Resultado pendiente de ejecución por la coordinación principal**; no se iniciaron procesos Node durante esta edición. La comprobación HTTP/PostgreSQL de la nueva autorización permanece como límite pendiente del recorrido real.
