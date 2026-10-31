# Rutas del personal de apoyo

Las rutas marcadas **propuesta** no están en el contrato compartido (`CONTRATO.md`); son del front y se
anotan para que la API las confirme o las nombre distinto. Las del backend simulado están en
[contrato propuesto](contrato-propuesto.md).

## Pantallas

| Ruta | Pantalla | Quién la ve | Estado |
|---|---|---|---|
| `/administration/session-controls` | Controles de sesión | La **cuenta de una organización** (cualquier tipo: hospital, farmacia, laboratorio…) con el rol `SECURITY_ADMIN` | propuesta |
| `/administration/support-review` | Revisión periódica | La cuenta de la organización con `SECURITY_ADMIN`, en hospital, clínica o prestador | propuesta |
| `/administration/support-activity` | Actividad del equipo de apoyo | Igual que la anterior | propuesta |
| `/administration/support-requests` | Solicitudes de apoyo | Igual que la anterior | contrato |
| `/administration/support-team` y `/administration/support-team/:engagementId` | Equipo de apoyo y editor de permisos | Igual que la anterior | contrato |
| `/administration/support-access-lookup` | Quién tiene acceso | Igual que la anterior | contrato |
| `/administration/support-invitations` | Invitaciones y QR | Igual que la anterior | contrato |
| `/administration/support-team/reply-templates` | Respuestas preparadas | Igual que la anterior; **no es una entrada del menú**, se llega desde «Equipo de apoyo» | API |
| `/my-account/security/mfa` | Verificación en dos pasos | Cualquier persona con sesión; es la única ruta del armazón que queda abierta mientras el token es el de alcance limitado (`mfaEnrollment`); la API también lo hace cumplir (403 `MFA_ENROLLMENT_REQUIRED`) | API |
| `/my-account/security/organization-invitations` | Invitaciones de organizaciones | Cualquier persona con sesión; aceptar activa la membresía y renueva el token, rechazar la descarta. Se llega desde «Seguridad» y desde el selector de organización | API |
| `/my-team` | Mi equipo | Un doctor (`PRACTITIONER`) | contrato |
| `/my-team/activity` | Actividad de mi equipo | Un doctor; **no es una entrada del menú**, se llega desde «Mi equipo» | propuesta |
| `/my-support` | Mis accesos | Una **persona** (`accountKind: PERSON`) con rol `USER` **o `PRACTITIONER`** en una organización médica: es donde se canjea un código, y el QR multiuso de doctores lo canjea un médico | contrato |
| `/my-support/activity` | Mi actividad | Igual; se llega desde «Mis accesos» | propuesta |
| `/combined-agenda`, `/support-inbox` | Agenda combinada y bandeja de mensajes | La persona de apoyo | contrato |

«Quién la ve» es **presentación**: lo decide `AppSection` (`onlyForAccountKind`, `roles`, `onlyForTenantTypes`) y el guard de rutas por
prefijo. La API autoriza cada petición. Las hijas (`…/activity`) heredan la regla de su sección.

## Parámetros de dirección

| Dirección | Para qué |
|---|---|
| `/administration/support-requests?persona=<userId>&rol=<CÓDIGO>&estado=<ESTADO>&antiguedad=<LT3\|D3_7\|D8_14\|GE15>` | Filtros de la bandeja. Se escriben solos al usar la barra; recargar o compartir el enlace los reproduce. `estado=EXPIRED` abre las vencidas. |
| `…/activity?persona=&doctor=&accion=&desde=YYYY-MM-DD&hasta=YYYY-MM-DD&q=` | Filtros de la actividad (persona solo en la de organización y la del doctor; doctor solo en la de organización y la propia). |
| `/my-support#code=<código>` | Lo que lleva el QR de una invitación. El código va en el **fragmento**, nunca en la query: no llega a logs ni a `Referer`. Apenas se lee, la pantalla lo borra de la barra y del historial. Un QR impreso con `?code=` también se entiende y se limpia. |

## Rutas de la API que usan las pantallas

Ver [contrato propuesto](contrato-propuesto.md), que separa lo que está en el contrato, lo que la API ya sirve y lo que falta.
