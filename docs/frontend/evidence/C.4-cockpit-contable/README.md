# Evidencia C.4 · Cockpit contable conectado a la API real

Capturas tomadas contra la API real (datos sembrados por API, no por el
interceptor mock) en `/administration/accounting` y sus rutas vecinas.

| Archivo | Rol | Viewport | Qué se ve | Veredicto |
|---|---|---|---|---|
| `cockpit-admin-datos-390x844.png` | SECURITY_ADMIN | 390×844 | Cockpit con `tile-resultado`, ejercicio, documentos y tabs; sin overflow horizontal | PASS |
| `cockpit-admin-datos-768x1024.png` | SECURITY_ADMIN | 768×1024 | Igual, tablet vertical | PASS |
| `cockpit-admin-datos-1024x768.png` | SECURITY_ADMIN | 1024×768 | Igual, tablet horizontal | PASS |
| `cockpit-admin-datos-1440x900.png` | SECURITY_ADMIN | 1440×900 | Tarjetas de resultado, debe/haber, activo=pasivo+patrimonio, por cobrar/pagar, documentos con activo y devengo sembrados por API | PASS |
| `cockpit-admin-datos-1920x1080.png` | SECURITY_ADMIN | 1920×1080 | Igual, escritorio grande | PASS |
| `cockpit-admin-partidas-abiertas-1440x900.png` | SECURITY_ADMIN | 1440×900 | Pestaña "Partidas abiertas" con 5 `tramo-*` | PASS |
| `cockpit-admin-cierre-periodo-1440x900.png` | SECURITY_ADMIN | 1440×900 | Pestaña "Cierre del período" con 2 `activo-*` (ambos depreciables, `/mes`) y 1 `devengo-*` | PASS |
| `cockpit-admin-libros-1440x900.png` | SECURITY_ADMIN | 1440×900 | `/administration/accounting/libros`: balance de sumas y saldos, libro diario, registrar gasto: las pantallas vecinas del cockpit siguen funcionando | PASS |
| `cockpit-admin-flujo-cadena-1440x900.png` | SECURITY_ADMIN | 1440×900 | Un `flujo-*` (documento del libro) expandido muestra la `cadena-*` origen→reversión sin salir de la pantalla | PASS |
| `cockpit-doctora-422-vinculo-1440x900.png` | PRACTITIONER | 1440×900 | Slot de validación propio (`practice-access-denied`): "No podés ver la contabilidad de esta práctica" / "El profesional no tiene una vinculación activa con esa práctica" — 422 real de la API | PASS |
| `cockpit-doctora-422-vinculo-390x844.png` | PRACTITIONER | 390×844 | Mismo slot, móvil | PASS |
| `cockpit-admin-sin-ejercicio-1440x900.png` | SECURITY_ADMIN | 1440×900 | Práctica nueva sin ejercicio fiscal: la tarjeta muestra `fiscal-year-empty`+`fiscal-year-retry`, las demás tarjetas siguen con datos | PASS |
| `cockpit-admin-sin-ejercicio-390x844.png` | SECURITY_ADMIN | 390×844 | Igual, móvil | PASS |
| `cockpit-admin-activo-no-depreciable-1440x900.png` | SECURITY_ADMIN | 1440×900 | Activo sin `usefulLifeMonths`: "amortizado del todo, no entra en la corrida" sin `/mes` | PASS |
| `cockpit-paciente-rebote-dashboard-1440x900.png` | PATIENT | 1440×900 | Al entrar a `/administration/accounting`, el router rebota antes de renderizar `app-accounting-cockpit`: la pantalla final es el panel del paciente | PASS |

## Nota sobre el rol PRACTITIONER

La cuenta de demostración de profesional no tiene vínculo activo
con ninguna práctica que además tenga datos contables sembrados, así que lo
que se observó con ese rol es el propio slot de validación 422 que la tarea
agrega (estado S4 propio del `view-state-host`), que es a la vez la prueba
de permisos de ese rol.

## Permisos por API (rol paciente)

Con sesión de paciente los 6 `GET /accounting/*` (`fiscal-years`,
`open-items`, `dimensions`, `assets`, `accrual-objects`, `accounts`)
responden `403 FORBIDDEN` (`{"code":"FORBIDDEN","message":"Rol insuficiente
para la operación"}`); por pantalla, `/administration/accounting` nunca
renderiza `app-accounting-cockpit`.
