# Hallazgos del recorrido completo (2026-10-31)

Origen de cada hallazgo:

- Recorrido automático contra el **simulador** (`yarn start:demo`, commit `b4de5c8c`), detallado
  en [README.md](README.md).
- Captura de pantalla de cada caso, revisada a ojo.
- Cuando aplica, la línea de consola.

Estos hallazgos se observaron en el simulador. Los marcados **«confirmar con la API real»**
pueden deberse solo al simulador y hay que repetirlos con el backend levantado.

## Lo que está bien

- **Pantallas sin excepción.** 1.274 visitas en escritorio y 515 en móvil, sin ninguna
  excepción de JavaScript. Hay una sola salvedad: la del mapa en el alta (H-07).
- **Móvil.** A 390 px, ninguna pantalla real se desborda en horizontal. Se miraron las de
  paciente, médica, farmacia y las públicas. Solo se desborda el banco de componentes interno
  `/design-system/stock`, que es una herramienta de la demo.
- **Rutas privadas.** El visitante sin cuenta rebota al login en las 207 rutas privadas que
  se probaron.
- **Alta de paciente.** Recorre los 5 pasos y termina en «¡Bienvenido a AloVida!», en
  escritorio y en móvil. La prueba `carril-03-alta-paciente.spec.ts` pasó 3 de 3.
- **Reservas.** El paciente llega del directorio a la ficha, al cupo y a la reserva.

## Hallazgos

| # | Severidad | Dónde | Qué pasa | Quién lo ve | Evidencia |
|---|---|---|---|---|---|
| H-01 | **Mayor** | `/my-account` («Mi perfil», primer ítem de todos los menús) | Muestra «No encontramos lo que busca» en «Sus datos», porque pide `GET /profiles/patients/me` y la cuenta no es de paciente. La pantalla está vacía para las cuentas que no son de paciente ni de médico | admin, superadmin, aprobador, aseguradora (personal), visitador: **5 de 11 cuentas** | Captura `visitador/0002.jpg`; consola `GET /profiles/patients/me → 404 «No tiene perfil de paciente»`. Confirmar con la API real |
| H-02 | **Mayor** | `/my-account/profile/edit` («Editar sus datos») | Misma causa que H-01: muestra «No encontramos lo que busca» | 9 de 11 cuentas: todas salvo paciente y médica | Captura de farmacia en móvil `0027.jpg` |
| H-03 | **Mayor** | `/administration/identity-assurance/queue` («Cola de revisión») | Muestra «Algo salió mal · Ocurrió un error inesperado» con «Código de soporte: **sin-id**». Con admin la misma pantalla carga bien | superadmin | Captura `superadmin/0314.jpg` |
| H-04 | **Mayor** | `/administration/my-organization` de la aseguradora, bloque «Solicitudes de médicos» | Muestra «Algo salió mal» con «Código de soporte: sin-id» | aseguradora (administración y personal) | Texto de la captura `aseguradora/0010.jpg` |
| H-05 | Mayor (contrato) | H-03 y H-04 | El estado de error no trae el ID de petición: el código de soporte sale «sin-id». `CLAUDE.md` del front dice que S9 exige el ID de petición | — | Ver H-03 y H-04 |
| H-06 | Menor | Tarjeta de doctores en tendencia (`/posts`, portada) | «Ramiro Céspedes Villca · ★ **0** · 78 reseñas»: promedio 0 con 78 reseñas. Se ve en el sitio de demo publicado y en local | todos, incluido el anónimo | Captura `anon/0001.jpg` |
| H-07 | Menor | Alta de paciente, paso 2 (mapa) | Error de consola `TypeError: Cannot read properties of undefined (reading '_leaflet_pos')` con código `[E-b4de5c8c-001]`. No frena el alta. Ocurre cuando se avanza rápido después de confirmar la dirección | quien se registra | Salida de `alta.js` (escritorio y móvil) |
| H-08 | Menor (UX) | Login después del alta | La cuenta recién creada sin confirmar el correo recibe «Las credenciales no son válidas», en lugar de «Confirme su correo» con la opción de reenviar | paciente nuevo | `07-login-nueva.jpg`. Confirmar con la API real |
| H-09 | A confirmar | Menú del **visitador médico** (laboratorio farmacéutico) | Ve la consola de **farmacia**: Resumen, Catálogo, Horario y turnos, Solicitudes de retiro, Promociones, Sucursales | visitador | `out/visitador/menu.json` |
| H-10 | A confirmar | Menú del **aprobador de admisiones** | Mezcla secciones de paciente, de aseguradora y «Sistema de diseño». En tres pantallas de aseguradora recibe 403 | aprobador | `out/aprobador/menu.json`; consola 403 en `/administration/insurance-*` |
| H-11 | Menor | `/search/symptoms` sin cuenta y con cuentas que no son de paciente | Pide `GET /profiles/patients/me`, que devuelve 404 y deja un error de consola. La pantalla funciona igual | anónimo y 9 cuentas | Consola |
| H-12 | Menor (simulador) | `/administration/services-catalog/import`, `/my-services/import` | `GET /billing/service-catalog/procedure-specialties/mine` no tiene manejador en el simulador (501). Sale «No pudimos leer sus especialidades, así que mostramos todo el arancel» | médica, admin | Consola `[mock] sin manejador` |
| H-13 | Menor (simulador) | `/glossary/:conceptId` | `glossary-neighborhood` no tiene manejador (501) | médica, visitador, admin | Consola |
| H-14 | Menor (simulador) | `/administration/identity-assurance/cases/:caseId` | `GET /identity/verification-cases/:id` no tiene manejador (501) | admin | Pasada dirigida |
| H-15 | Menor (texto) | `/superadmin/web-analytics` | La pestaña dice «Ultimas 24 h», sin tilde | admin, superadmin | Captura `admin/0027.jpg` |
| H-16 | Menor (voz) | Toda la app | La interfaz trata de **usted** («Busque», «Cuéntenos», «Complete su perfil»). Las publicaciones del simulador y el contexto de marketing (`.agents/product-marketing.md`) usan **voseo** («Controlá tu presión», «tenés»). Hay que decidir una sola voz de marca | — | Capturas `anon/0001.jpg` y `paciente/0001.jpg` |
| H-17 | A confirmar | Landing B2B `/home` | Muestra cifras como si fueran reales: «CITAS 148», «OCUPACIÓN 82 %», «12 480 PERSONAS», «37 duplicados detectados», «100 % de accesos clínicos trazables», junto a nombres de personas. Las reglas de marketing de la casa prohíben publicar cifras sin fuente: rotularlas como ilustrativas o respaldarlas | visitante | Texto de `/home` |

| H-18 | Menor (datos del simulador) | `/my-account/questionnaires?seccion=encuestas` | Las fechas no cierran. Una consulta del 3/11/2026 tiene «El plazo venció el 27/09/2026». Una teleconsulta del 30/10 figura «Respondido el 16/10» | paciente | Texto de la pantalla |
| H-19 | Menor | `/tutorials` | Pide sesión: el visitante sin cuenta rebota al login. El tutorial «Conozca AloVida en 1 minuto» solo lo ven quienes ya tienen cuenta | anónimo | Fila de `/tutorials` en `anon/filas.json` |

## Superadmin entra a pantallas de paciente y de profesional

`superadmin` «entra a todo», así que también abre pantallas de paciente y de profesional (carrito,
pedido, onboarding, privacidad). En todas recibe 404, 403 o 422 coherentes, porque no tiene esos
perfiles. Esto es lo esperado y no se cuenta como hallazgo. Sí es un hallazgo que esas pantallas
le muestren «No encontramos lo que busca» en vez de explicarle que su cuenta no tiene ese
perfil: es el mismo patrón de H-01.

## Lo que no se cubrió

- **La API real.** Todo se corrió contra el simulador. Levantar la API exige Postgres 18 con
  TimescaleDB, MongoDB, Redis, OpenSearch, MinIO y ClamAV, y este entorno no tiene Docker.
- **Clic en cada botón.** Se recorrió cada pantalla, pero no se pulsó cada botón. Para eso existe
  `playwright/mockup-click-sweep.spec.ts`, que no se corrió en esta pasada.
- **Tema oscuro.** No se capturó.
- **Algunas altas.** Del alta de médico, farmacia, laboratorio, imagenología y organización solo
  se capturó la primera pantalla. Del alta de paciente se recorrió el flujo entero.
- **Rutas sin enlace navegable.** `/p/:slug/post/:postId` y `/verify/portability/:manifestHash`
  no tienen enlace en el simulador.
