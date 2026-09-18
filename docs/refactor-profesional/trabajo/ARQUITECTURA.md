# Arquitectura y contratos — fase 04

## Mapa del piloto

```text
Appointments (página, features/account/appointments)
 ├─ SchedulingClient.searchBookings()  → ViewState<TurnoVisible[]>   (transporte, sin cambios)
 ├─ todosLosTurnos → turnosListos      (filtros de la URL; orden del servidor)
 │     ├─ turnosDeCalendario            (calendario: no depende del orden)
 │     ├─ turnoEnDetalle / cancelarTurno
 │     └─ turnosPorMomento ── splitUpcomingAndPast(turnos, momentoDeLectura)   ← SEAM NUEVO
 │            └─ gruposDeLista → plantilla («Próximas», «Anteriores»)
 └─ PageHeader [page-actions] → irAPedirTurno() → foco en #pedir-turno
```

## Seam introducido

`upcoming-and-past.ts` — `splitUpcomingAndPast<T extends TimedItem>(items, now)`.

| Aspecto | Contrato |
|---|---|
| Entrada | cualquier lista con `cuando: Date \| null` y `hasta: Date \| null`; `now` explícito |
| Salida | `{ upcoming, past }`, sin mutar la entrada, sin perder ni duplicar |
| Reglas | próxima si fin (o inicio) ≥ `now` o sin horario; próximas ascendentes, anteriores descendentes; empates estables |
| Errores | ninguno: es pura |
| Por qué función y no servicio | una sola responsabilidad sin estado ni dependencias; inyectarla sería una abstracción sin segundo consumidor |

**Qué no se tocó a propósito:** `turnosListos` conserva el orden del servidor. La consumen el
calendario, el detalle y la cancelación, y varias pruebas existentes la leen por índice (`turnosListos()[0]`, 9 líneas directas en el spec). El orden es
una decisión de presentación y vive en la capa de presentación.

`momentoDeLectura` se fija al recibir la respuesta: una cita no cambia de grupo mientras la
persona la lee, y las pruebas no dependen del reloj.

## Contrato de organismo ampliado

`DataTable.rowLabel?: (row) => string` — opcional, retrocompatible. Sin él, «la fila N». Nunca
`trackBy` (id técnico). Consumidor inicial: Consultas (`nombreDeCita` = `fila.paciente`, que ya
aplica la compuerta de permisos del servidor: sin permiso llega «Paciente asignado»).

## Autoridad y garantías

- **El refactor no cambia permisos, contratos de API ni persistencia.** Ningún cliente de
  `core/data-access` se modificó.
- Cancelar sigue siendo la misma operación con confirmación; el servidor valida.
- No se inventó idempotencia, reintentos ni estados nuevos: `ViewState` M34 intacto.

## Retirada de legado

| Legado | Condición de retiro |
|---|---|
| Alias `--mov-*` en `alovida.css` | cuando `grep -- "--mov-"` en `src/` dé sólo la definición; hoy los usan componentes portados del marco ALOVIDA |
| 22 hojas sobre el presupuesto de 4 kB | fuera de alcance; preexistentes |
