# Inventario — fases 00–01

No se duplica lo que el repo ya mantiene (ver `docs/frontend/FABLE_STACK.md`, «Fases 1-3 ya
hechas»). Fuentes canónicas:

| Qué | Dónde |
|---|---|
| Rutas (232) | `docs/reports/generated/rutas.json` · `src/app/app.routes.ts` · `core/navigation/navigation.map.ts` |
| Componentes (458) | índice generado por `yarn stock:generate`; vitrina en `/design-system/stock` |
| Sistema de diseño | `docs/design-system/` (tokens, colores, espaciado, tipografía, movimiento…) · `src/styles.css` |
| Estados de vista | `ViewState<T>` (9 estados M34), `docs/adr/ADR-0005-view-state-m34.md` |
| Accesibilidad | `docs/accessibility/` |
| Pruebas | `docs/testing/`, Vitest (`*.spec.ts`), e2e en el directorio del arnés (`yarn pw`) |

## Lo que agrega este refactor (observado)

### Menú por rol **[O]**

| Rol | Destinos del menú lateral |
|---|---|
| Paciente | Mi perfil · Notificaciones · Panel · Tutoriales · Chats · Directorios · Lugares cercanos · Dependientes · Mis citas · Mis pedidos · Mis puntos · Promociones · Mi historia clínica · Mis resultados · Mis órdenes · Mis cuestionarios |
| Médica | Mi perfil · Notificaciones · Chats · Directorios · Consultas médicas · Archivo clínico · Evoluciones · Glosario · Formularios · Mis servicios · Cotizaciones · Contabilidad · Activos y pasivos |

### Rutas recorridas en el baseline **[O]**

Paciente (11): `/dashboard`, `/my-account/appointments`, `/my-account/medical-record`,
`/my-account/diagnostic-results`, `/my-account/pharmacy-orders`, `/directories`, `/directory`,
`/notification-center`, `/my-account`, `/messaging`, `/nearby-places` — × 1440 y 390.

Médica (14): los 14 destinos de su menú — × 1440 y 390.

### Superficies tocadas y sus consumidores

| Pieza | Tipo | Consumidores | Cambio |
|---|---|---|---|
| `features/account/appointments/` | página | `/my-account/appointments` | piloto |
| `upcoming-and-past.ts` | función pura nueva | `Appointments` | seam de orden |
| `organisms/data-table` | organismo | 24 plantillas | `rowLabel`, sombras de scroll |
| `organisms/page-header` | organismo | — | **sin cambios**: se usó su ranura `[page-actions]` |
| `core/alovida/alovida-runtime.service.ts` | servicio de marco | todo el shell autenticado | H-01 |
| 35 hojas de `src/app/**` + `styles/alovida.css` | CSS | todo | tokens de movimiento |
| `features/agenda/agenda.*` | página | `/schedule` | acciones con wrap, `rowLabel` |
| `patient-home`, `accounting`, `organization-panel` | CSS | panel, contabilidad, organización | fechas con «de» |

### Funciones preservadas

Filtros en la URL (compartibles, «atrás» los deshace), vista lista/calendario sobre la misma
colección, cancelación con confirmación, lista de espera, reprogramación visible, motivo del
cambio y demora, elección profesional/laboratorio, sede, reserva. Ninguna ruta cambió.
