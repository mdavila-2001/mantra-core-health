# Tabla de horarios y «Hora de inicio» con horario flexible · 2026-10-31

Pedido del propietario (31/10/2026), con tres capturas:

1. En «¿Qué días atiende?» (`/schedule/new`, `/schedule/edit`) la tabla con turnos fijos salía cortada
   a la derecha («Descan…»), mientras que con «toda la semana flexible» se veía entera. Las dos tienen
   que verse completas.
2. En «Agendar una cita» (`/schedule/appointment/new`), un día con **horario flexible** dejaba
   «Hora de inicio» en «Sin horarios libres». Lo mismo en la reconsulta de la ficha del paciente.

## Qué había por detrás

**Tabla.** Con turnos fijos tiene nueve columnas y pide ~1 040 px. Con la barra lateral abierta en
una laptop de 1 280 px la tarjeta da 944 px: la tabla desbordaba 93 px y `overflow-x` la hacía
scrollear de costado, cortando «Descanso» y «Horarios». Con la semana flexible desaparecen cuatro
columnas y entra; por eso una captura estaba bien y la otra no. De paso: los días que **no**
atiende salían en negrita (el `<th>` es bold por el navegador y sólo el día activo fijaba su peso).

**Hora de inicio.** Un día «Horario flexible» no tiene cupos fijos: sus horas las calcula la API al
leer, en `GET /scheduling/resources/:id/flexible-availability`. «Agendar una cita» y la reconsulta
(`follow-up-block`) sólo leían `GET /scheduling/slots`, así que veían el día vacío. «Mis citas» del
paciente ya leía las dos cosas; estas pantallas no.

## Qué cambió

- `core/data-access/scheduling/free-starts.ts` (nuevo): `listFreeStarts` lee cupos fijos y horas
  flexibles y los devuelve en una lista ordenada. Si la lectura flexible falla, siguen los fijos.
- `appointment-new`: usa `listFreeStarts`; la cuenta de minutos libres de corrido acepta horas que
  se pisan (las flexibles arrancan cada 15 min). La cita se sigue creando con
  `POST /scheduling/appointments/direct` (inicio + minutos), que no exige cupo previo.
- `follow-up-block`: el calendario del mes y las tarjetas de horario usan `listFreeStarts`.
- `agenda-create` + `schedule-day-row`: la caja de la tabla es un contenedor (`horario`). Si no
  alcanza (≤ 1 060 px con turnos fijos, ≤ 700 px con semana flexible), cada día se reparte en
  renglones con el rótulo encima de cada campo; el encabezado queda sólo para lector de pantalla.
  Peso del día: 400 apagado, 600 encendido. «Sí / No» con ancho propio en el teléfono (antes «Sí N.»).

## Evidencia

Entorno: Linux, `yarn start:demo` en `http://localhost:4300`, sesión `medica@alovida.mock`,
Chromium. Scripts: `playwright/agenda-tabla-horario-ancho.mjs` y
`playwright/agenda-cita-hora-flexible.mjs`.

| Comprobación | Antes | Después |
|---|---|---|
| Tabla, 1 280 px, turnos fijos | desborda 93 px, cortados «Descanso» y «Horarios» (`capturas/tabla-1280-antes.png`) | 0 px, en renglones (`capturas/tabla-1280-despues.png`) |
| Tabla, 1 024 px, turnos fijos | desborda 325 px | 0 px |
| Tabla, 390 px | desborda 710 px | 0 px (`capturas/tabla-390-despues.png`) |
| Tabla, 1 440 / 1 920 px | entra | igual que antes, tabla (`capturas/tabla-1440-despues.png`) |
| Semana flexible, 1 280 / 1 024 px | entra | igual que antes, tabla (`capturas/tabla-1280-semana-flexible-despues.png`) |
| Peso del día activo / apagado | 600 / negrita del `<th>` (se ve en las capturas; no medido) | 600 / 400 (medido) |
| «Hora de inicio», lunes con semana flexible | «Sin horarios libres» (`capturas/cita-hora-flexible-antes.png`) | 10 horas, 15:20 a 18:35 (`capturas/cita-hora-flexible-despues.png`) |

Medidas completas en `medidas-tabla.json`. El «antes» de la hora se tomó con `appointment-new.ts`
de `dev` sobre el mismo servidor y la misma maqueta.

No se probó contra la API real: el contrato de `flexible-availability` se tomó del código de la API
(`scheduling-flexible-booking.service.ts`, responde 200 con lista vacía si no hay horario flexible).
La mutación completa (UI → request → persistencia → recarga) de agendar en una hora flexible
**no se ejecutó en navegador**; está cubierta en la prueba unitaria de la reconsulta
(`startAt` y `durationMinutes` de la hora elegida).

| Verificación | Resultado |
|---|---|
| `eslint` de lo tocado | 0 |
| `yarn typecheck` | 0 |
| `ng test` `features/agenda/**` | 763/763 |
| `ng test` `features/clinical-record/patient-chart/**` | 746/746 |
| `ng test` `core/data-access/scheduling/**` + los tres componentes | 294/294 |
| `yarn build` | no se corrió |

Revisión independiente (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`):
**pendiente** — quien implementa no aprueba.
