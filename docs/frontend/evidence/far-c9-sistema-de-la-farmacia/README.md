# El sistema de la farmacia en la pestaña Integración (FAR-C9 · C9-4, 01/11/2026)

Capturas de `playwright/far-c9-sistema-de-la-farmacia.mjs`, contra `ng serve` (configuración
`real-api`), la API local con C9-3 (mdavila-2001/mantra-core-health-api#1259 y #1261), PostgreSQL 16
con el DDL de `database/SQL` y el simulador de `mock-provider-server/` (Estándar ALOVIDA y cadena
simulada, una clave por farmacia). Cuenta dueña de la organización de farmacia «Farmacia Central
C93»; conexión por lotes para todas las sucursales y un vínculo `ERP-0001` → `PARA-500`. Ventana
fija, sin `fullPage`: 1440×900 en **claro** y 390×844 en **oscuro**. El oscuro se fija con la
preferencia guardada (`mantra-core-health.theme`) antes de cargar: la app no sigue
`prefers-color-scheme`; `red-y-consola.txt` anota `data-theme: dark`. Esto es evidencia, no
aprobación: la revisión visual la hace otra persona.

Todo se escribió de verdad por la API. La clave no aparece en ninguna captura ni en
`red-y-consola.txt`: el script anota solo que viajó en el cuerpo.

## Recorrido, en orden (los dos tamaños)

| Paso | Captura | Petición → respuesta | Qué se ve después |
|---|---|---|---|
| Sin sistema | `01-sin-sistema-*` | `GET …/integration-connections` 200, `system: null` | El aviso dice qué falta y dónde, sin negar el «Activa» de arriba («Falta cargar el sistema de la farmacia, abajo…»); el formulario en dos columnas (formato y dirección, código y clave), una en el teléfono |
| Sin sistema, sincronizar | `01b-sin-sistema-sincronizar-*` | ninguna | «Sincronizar ahora» deshabilitado (`aria-disabled=true` en el registro) |
| «Guardar y probar» vacío | `02-faltan-campos-*` | ninguna | Cada campo vacío marcado con su motivo |
| Clave equivocada | `03-clave-equivocada-*` | `PUT …/external-system` → **502** | Debajo de la introducción: «Su sistema no respondió con esa dirección, ese código y esa clave… no se guardó nada», con el ID de la petición; lo escrito se conserva |
| Clave correcta (Estándar ALOVIDA) | `04-guardado-*` | `PUT` → 200, después `GET …/integration-connections` 200 | Los datos del sistema **releídos de la API**, en filas (la dirección entera en una línea), «Clave: Guardada» |
| Recargar la página | `05-tras-recargar-*` | `GET` 200 | Lo mismo: está en la base, no en la pantalla |
| «Probar conexión» | `06-probado-*` | `POST …/external-system/test` → 200 | «El sistema de la farmacia respondió y aceptó la clave.» |
| «Cambiar» | `07-cambiar-*` | ninguna | Formato, dirección y código guardados; la clave vacía, con el porqué |
| Cadena simulada | `08-cadena-*` | `PUT` → 200, `GET` 200 | «Cadena simulada (pruebas)», `CHAIN-C93`; a 390 las tres acciones apiladas a lo ancho |
| «Sincronizar ahora» | `09-sincronizado-*` | `POST …/sync` → 200 | 12 recibidas, 1 vinculada, 11 sin vínculo, por la cadena (Bearer, paginada) |
| «Quitar» | `10-quitar-confirmar-*` | ninguna | Diálogo **quieto** (el script espera a que termine su animación), foco en «Cancelar» |
| Confirmar | `11-quitado-*` | `DELETE …/external-system` → 204, `GET` 200 | El formulario otra vez |

«Quitar» pausa la **conexión de integraciones** (`integrations.provider_connections`) y retira la
clave; la conexión de la farmacia sigue **activa** (por eso «Estado: Activa» arriba): lo que deja de
haber es un sistema con quién sincronizar, y el aviso lo dice.

## Releído de la base al terminar

```
connection_id nulo: true
conexiones de integraciones del tenant: 12 · pausadas: 12
credenciales activas: 0
stock de PARA-500 en la sede: 13
estado de la conexión de la farmacia: pharmacy:CONNECTION_ACTIVE
```

Cada recorrido crea una conexión de integraciones al guardar por primera vez, la reusa al
«Cambiar» y la pausa al «Quitar»; todas son de las corridas sobre esta base. El stock es
lo que la cadena simulada mandaba para `ERP-0001` en esa ventana de cinco minutos.

## Consola

`red-y-consola.txt` tiene cada petición y cada error de consola. Los únicos errores ajenos al
recorrido son `GET /me/ui-visibility` → 500 y `GET /tenants/me/membership-invitations` → 404, del
armazón y de esta base local (sin la tabla de visibilidad sembrada); salen en todas las pantallas,
no en esta pestaña. El 502 del paso 3 es el buscado.

## Lo que no se vio en vivo

- **Dirección no permitida** (422 `PHARMACY_INTEGRATION_HOST_NOT_ALLOWED`) y **dirección
  inválida** (400 `PHARMACY_INTEGRATION_URL_INVALID`): cubiertas por `integration-system.spec.ts`,
  y en la API por su recorrido real.
- **Con el sistema del servidor** (sin sistema propio, `providerConfigured: true`): el texto se
  cubre en la prueba; esta API corría sin `PHARMACY_ERP_BASE_URL`.
- **Los avisos emergentes**: el script los cierra antes de cada captura (si no, tapaban «Guardar y
  probar»). Que se apilen y duren es del servicio compartido de toasts, no de esta sección.
