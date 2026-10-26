# REPORT — Carril 34 · auditoría de pantallas en `test`

## Veredicto

El criterio visual se cumple en todas las celdas, para los tres actores. Se mide fondo blanco en claro,
superficie oscura en oscuro, contenido centrado, ancho de al menos el 85 % y ausencia de
desplazamiento horizontal, a 375, 768 y 1440 px en claro y a 1440 en oscuro.

Esta medición reemplaza la copia del 2026-10-06, que se había tomado sobre `mockup`.

## Matriz

| Actor | Rutas | Celdas | En rojo antes | En rojo después |
|---|---|---|---|---|
| Médica | 37 | 148 | 24 | 0 visuales |
| Paciente | 38 | 152 | 23 | 0 visuales |
| Administración | 48 | 192 | 43 | 0 visuales |

El inventario se generó con `scripts/corr-rutas.mjs` sobre las rutas en inglés: 87 rutas en total.

- `antes/`: la primera pasada.
- `despues/`: las pantallas que se volvieron a medir.

## Qué cambió

- **El auditor mide bien en checkouts con fin de línea CRLF.** Además acepta la carpeta de evidencia por
  variable (`CORR_EVIDENCE_DESTINATION`).
- **Alta de profesional (`/auth/register/practitioner`).** La página «Su nombre y su cédula» tiene cinco
  campos por decisión del propietario, igual que el alta de paciente, y se marca con
  `[allowLargePages]="true"`. Sin esa marca dejaba un aviso en consola.
- **Pantallas medidas de nuevo:** la portada (`/posts`) y la farmacia del paciente
  (`/my-account/pharmacy`). En la primera pasada no habían terminado de cargar; medidas de nuevo, pasan
  en los cuatro cortes.

## Rojos de consola que no son del front

- **Telemetría de las altas (`/auth/register/*`).** El servicio responde 400 porque su contrato no
  declara el campo `events`. Se corrige del lado del servicio.
- **Pantallas de aseguradora y «Mi cuenta» con la cuenta de administración.** El servicio niega el
  acceso a `insurance-analytics`, `received-claims` e `insurance-campaigns`, `insurance-patients` todavía
  no tiene implementación (501), y `/my-account` requiere perfil de paciente. Son decisiones de acceso
  del servicio, no del front.

## Regresión de rutas con datos reales (route-health)

Se corrió en `dev`.

- **Administración:** 171 aperturas sin errores visuales. Los errores de consola son negativas del
  servicio a una cuenta que no es médica, aseguradora ni farmacia, o transiciones de vista
  interrumpidas.
- **Vistas sin sesión:** sin errores visuales.
- **Médica y paciente:** quedan para una pasada con cuentas de prueba de esos roles.
