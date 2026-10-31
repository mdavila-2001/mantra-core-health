# Reporte — AloVida Insights (franjas F0 a F12)

Estado al 31/10/2026. Rama `claude/insights-f5-panel-general` (PR mdavila-2001/mantra-core-health#1829). API: mdavila-2001/mantra-core-health-api#1221 (lecturas) y #1222 (escrituras, apilado). Modelo: mantra-core-technologies/mantra-core-health-model#99.

**Peldaño global: «demostrado en navegador contra el simulador».** Ninguna escritura se demostró contra el API real y la base: el total es el peldaño más bajo.

## Evidencia por área

| Área | Qué hay | Peldaño |
|---|---|---|
| Portal `/insights`, acceso, redirecciones | Specs de reporting-access, portal-selector, navegación y auth (revisión de regresión: 359 + 15 + 39 + 198 pruebas verdes) | Pruebas por carpeta |
| Panel general, Campañas (drill), Redes, Opinión, Embudo, Observatorio | Capturas 390/768/1440 claro y oscuro en `evidencia/capturas/`, consola sin errores, sin desborde (`f*-consola-red.json`); 125 pruebas de dominio y mock verdes | Navegador (simulador) |
| Alertas (estado y responsable) | `f7-mutacion.json`: persiste tras recargar y 412 con aviso. **Persistencia en `localStorage` del simulador; no hay petición de red porque el simulador responde dentro del navegador** | Navegador (simulador); NO prueba SQL |
| Informes | `f8-informes.json`: el informe de cliente oculta costos; historial persiste | Navegador (simulador) |
| Marco (paleta Ctrl K, ajustes, vistas guardadas, barra móvil) | `f12-marco.json`: densidad y tema sobreviven a la recarga, la vista guardada persiste | Navegador (simulador) |
| API (lecturas y escrituras) | 450 pruebas de `src/modules/marketing`; integración contra Postgres 16 descartable (20 pruebas: 412, concurrencia, 409, límite de 12, aislamiento) | Integración con base real descartable |
| Modelo | Seeds idempotentes, 98 pruebas | Pruebas |

Comandos de cierre en el front: `yarn build` exit 0; `tsc -p tsconfig.app.json` limpio; `eslint src/app/features/insights src/app/core/mock src/app/core/data-access/insights` limpio.

## Revisiones independientes

- **frontend-reviewer**: NO APROBADO con 3 HIGH. Corregidos: filtros del explorador de comentarios que no se restablecían, 412 de preferencias (relee versión y reintenta una vez; la carga tardía ya no pisa un cambio), insignia de alertas ligada al estado guardado. También corregidos M1 (el filtro global limpia el drill), cola de escrituras de alertas (dos cambios seguidos ya no se chocan) y 403/404 con mensaje propio. **No se volvió a pasar la revisión.**
- **visual-reviewer**: FAIL por evidencia insuficiente. Corregido: «Negativo» en naranja (antes verde casi igual a Neutral). Abiertos: Opinión/Percepción con ~10 tarjetas apiladas (regla del cliente §6), hueco de ~750 px bajo «Registros por día» en el Panel, etiquetas truncadas y líneas sin leyenda en Redes (oscuro), etiquetas que chocan en tendencias del Observatorio, y capturas de 390 sin tramos legibles. No se hizo la comparación punto por punto con el prototipo.
- **regression-auditor**: no emite `REGRESSION_VERIFIED`. Pruebas por carpeta verdes. Corregidos: prefijo `/marketing` agregado a `proxy.conf.json`, `proxy.conf.docker.json` y `deploy/api-locations.conf` (sin él, con API real las llamadas devolvían el HTML); rutas literales en el cliente y en el simulador para que `check-api-contract-drift` y `check-mock-vs-client` vuelvan a su nivel de la base; filas nuevas en `docs/integrations/backend-api.md`. Sin verificar: Playwright `pw:rutas` y `pw:accesos`, redirección real desde `/administration/marketing-insights`.

## Abierto y límites declarados

1. Prueba UI → petición → respuesta → SQL → recarga con el API real: **no ejecutada** (depende de desplegar #1221/#1222).
2. Faltan pruebas de componente y de `InsightsWorkflow`/`InsightsPreferences` (400 de dominio y mock sí; servicios no).
3. M2, M4, M5, M7, M8 y M9 de la revisión de frontend siguen abiertos (campos no controlados tras un rechazo del API, el Panel no distingue carga/error del flujo, estados a mano en vez de `ViewState`, falta confirmar borrados, accesibilidad de la paleta, colisión de clase `.rp__title`).
4. Omitido: popover de la campana, «Crear alerta» desde Opinión/Observatorio, filtros avanzados por módulo, Excel/PPT (no disponible, sin stub).
5. Estados M34 no felices (carga, vacío, error, parcial) sin capturas.
6. Gates ya rojos en la base (usted, inglés, max-lines, css-tokens, colores sueltos en otros módulos): sin cambio por este trabajo salvo los cuatro identificadores `el` (corregidos) y el nombre de la captura `f8-informe-cliente.png`.
7. La densidad compacta solo reduce el relleno del contenido.

## Decisiones que necesitan a la persona responsable

- `MARKETING_MANAGER` es un rol de tenant, pero las tablas `insights_*` no tienen `tenant_id`: cualquier gerente de marketing de cualquier organización lee datos de plataforma.
- `PUT alert-workflow` es compartido y sigue abierto a `MARKETING_MANAGER`; `PATCH alert-rules` ya es solo de plataforma.
- Valores por defecto de preferencias inventados por el API (matriz de notificaciones, `digestHour` 8, densidad cómoda, tema sistema).
- ADR-0018 sigue en «Propuesto»: pasa a «Aceptado» cuando el API real esté probado.
