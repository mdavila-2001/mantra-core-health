# Agendar una cita: estado y pendientes (31/10/2026)

## Qué se pidió

1. «Hora de inicio» debe ser un select con los cupos disponibles del médico, no texto libre.
2. Crear al paciente desde el mismo formulario no funcionaba bien.

## Qué se subió

Todo mergeado el 31/10/2026.

| Repositorio | Hacia `dev` | Hacia `test` |
|---|---|---|
| API | mantra-core-health-api#1184 | mantra-core-health-api#1185 |
| Front | mantra-core-health#1786 | mantra-core-health#1787 |

- **Hora:** el select sale de `GET /scheduling/slots?onlyAvailable=true`, y la duración se limita
  a los cupos libres contiguos.
- **Paciente nuevo:** el formulario usaba el endpoint de mostrador, que siempre abre la atención,
  aunque la cita sea para otro día. Causa deducida leyendo el código, no reproducida contra la API
  real. `POST /scheduling/appointments/walk-in` acepta ahora `startAttention: false`: la cita queda
  confirmada y sin encuentro abierto.

## Nivel de evidencia

| Comprobación | Resultado |
|---|---|
| Pruebas de front dirigidas, en `dev` y `test` | 856/856 |
| Pruebas de walk-in en la API, en `dev` y `test` | 5/5 |
| Recorrido en navegador sobre la maqueta, en la rama de `dev` antes de resolver conflictos | Correcto, sin errores de consola |
| Front publicado en `dev.alovidasalud.com` | El código nuevo está en los archivos servidos |
| Flujo completo contra la API real | **No corrido** |

El cambio llega a `TESTED`; no a `VERIFIED`.

## Pendientes

### 1. Probar el flujo contra la API real

Bloqueado por dos cosas: Docker no responde en la Mac, y en `dev` no entran las dos cuentas
documentadas (`medica@alovida.mock` y `doctor.completo@alovida.test` dan «Las credenciales no son
válidas»). Hace falta una cuenta de médico de `dev` con horarios publicados.

Pasos:

1. Abrir «Agendar una cita» y comprobar que la hora es un select con los cupos del médico.
2. Crear un paciente con un nombre claramente de prueba y agendarle una cita para otro día.
3. Recargar y confirmar que la cita sigue en la agenda, confirmada y sin atención abierta.

### 2. Confirmar que la API de `dev` y de `test` tiene el cambio

No se pudo comprobar: la ruta exige sesión y la consulta por SSH quedó bloqueada. Si el paso 2 de
arriba responde 400, la API desplegada todavía es la vieja, porque rechaza el campo nuevo.

### 3. Revisar el entorno `test`

`test.alovidasalud.com` redirige a `dev.alovidasalud.com`, y
`test.173.249.39.237.sslip.io` no responde (tiempo agotado a los 12 s). Por eso no se pudo
comprobar el front de `test`. No se investigó la causa.

### 4. Chequeo de OpenAPI en CI

Regenerar el contrato produce muchos cambios ajenos, porque ya estaba desactualizado. En estos PR se
agregó solo el campo nuevo, a mano. El `git diff --exit-code` de CI va a fallar hasta que alguien
regenere los artefactos en un PR propio.

### 5. Prueba intermitente del chat

`support-access.chat.handlers.spec.ts` falla a veces: con el cambio pasó 1 de 3 veces y sin él, 1 de
1. Causa sin confirmar. Este trabajo no tocó el chat.

### 6. Decisión: horas fuera de horario en la API

La API sigue aceptando horas fuera del horario si alguien la llama directamente; la restricción está
solo en el formulario. No se cambió porque la cita puntual está diseñada así (la documentación de
`create-direct-appointment.use-case.ts` dice «decidido, no reabrir»). Si se quiere impedir también en
el servidor, hay que revisar antes qué otros flujos dependen de ella.
