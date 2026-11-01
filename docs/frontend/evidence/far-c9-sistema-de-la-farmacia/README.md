# El sistema de la farmacia en la pestaña Integración (FAR-C9 · C9-4, 01/11/2026)

Capturas de `playwright/far-c9-sistema-de-la-farmacia.mjs`, contra `ng serve` (configuración
`real-api`), la API local con C9-3 (mdavila-2001/mantra-core-health-api#1259 y #1261), PostgreSQL 16
con el DDL de `database/SQL` y el simulador de `mock-provider-server/` (Estándar ALOVIDA y cadena
simulada, una clave por farmacia). Cuenta dueña de la organización de farmacia «Farmacia Central
C93»; conexión por lotes para todas las sucursales y un vínculo `ERP-0001` → `PARA-500`. Ventana
fija (1440×900 en claro y 390×844 en oscuro), sin `fullPage`. Esto es evidencia, no aprobación: la
revisión visual la hace otra persona.

Todo se escribió de verdad por la API. La clave no aparece en ninguna captura ni en
`red-y-consola.txt`: el script anota solo que viajó en el cuerpo.

## Recorrido, en orden (los dos tamaños)

| Paso | Captura | Petición → respuesta | Qué se ve después |
|---|---|---|---|
| Sin sistema | `01-sin-sistema-*` | `GET …/integration-connections` 200, `system: null` | Formulario en dos columnas (formato y dirección, código y clave); el aviso de arriba dice que no está configurada |
| «Guardar y probar» vacío | `02-faltan-campos-*` | ninguna | Cada campo vacío marcado con su motivo |
| Clave equivocada | `03-clave-equivocada-*` | `PUT …/external-system` → **502** | «Su sistema no respondió con esa dirección, ese código y esa clave…» con el ID de la petición; lo escrito se conserva |
| Clave correcta (Estándar ALOVIDA) | `04-guardado-*` | `PUT` → 200, después `GET …/integration-connections` 200 | Los datos del sistema **releídos de la API**: formato, dirección, código, «Clave: Guardada», fecha |
| Recargar la página | `05-tras-recargar-*` | `GET` 200 | Lo mismo: está en la base, no en la pantalla |
| «Probar conexión» | `06-probado-*` | `POST …/external-system/test` → 200 | «El sistema de la farmacia respondió y aceptó la clave.» |
| «Cambiar» | `07-cambiar-*` | ninguna | Formato, dirección y código guardados; la clave vacía, con el porqué |
| Cadena simulada | `08-cadena-*` | `PUT` → 200, `GET` 200 | «Cadena simulada (pruebas)», `CHAIN-C93` |
| «Sincronizar ahora» | `09-sincronizado-*` | `POST …/sync` → 200 | 12 recibidas, 1 vinculada, 11 sin vínculo, 1 aplicada, por la cadena (Bearer, paginada) |
| «Quitar» | `10-quitar-confirmar-*` | ninguna | Confirmación destructiva: la clave se borra, los vínculos y el stock se conservan |
| Confirmar | `11-quitado-*` | `DELETE …/external-system` → 204, `GET` 200 | El formulario otra vez |

## Releído de la base al terminar

```
connection_id nulo: true
conexiones de integraciones del tenant: 4 · pausadas: 4
credenciales activas: 0
stock de PARA-500 en la sede: 19
lotes de sincronización: 4
```

Cuatro conexiones de integraciones: cada recorrido crea una al guardar por primera vez, la reusa al
«Cambiar» y la pausa al «Quitar», y hubo dos recorridos con dos ciclos cada uno. El 19 es lo que la
cadena simulada mandaba para `ERP-0001` en esa ventana de cinco minutos.

## Consola

`red-y-consola.txt` tiene cada petición y cada error de consola. Los únicos errores ajenos al
recorrido son `GET /me/ui-visibility` → 500 y `GET /tenants/me/membership-invitations` → 404, del
armazón y de esta base local (sin la tabla de visibilidad sembrada); salen en todas las pantallas,
no en esta pestaña. El 502 del paso 3 es el buscado.

## Lo que no se vio en vivo

- **Dirección no permitida** (422 `PHARMACY_INTEGRATION_HOST_NOT_ALLOWED`) y **dirección
  inválida** (400): cubiertas por `integration-system.spec.ts` y en la API por su recorrido real.
- **Con el sistema del servidor** (`providerConfigured` sin sistema propio): el texto se cubre en
  la prueba; esta API corría sin `PHARMACY_ERP_BASE_URL`.
