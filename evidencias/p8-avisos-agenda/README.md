# Evidencias · Carril P8 «Avisos de agenda» (front)

Capturas de navegador reales, tomadas con `playwright/carril-p8-avisos-agenda.spec.ts`
contra el front servido sobre la API viva. Sin maquetas.

| Archivo | Qué prueba |
|---|---|
| `paciente-turno-con-demora.png` | «Mis turnos» del paciente: el turno confirmado muestra «El profesional avisó que se demora unos 15 minutos: Sigo con una urgencia». Aviso 2 del carril, visible en el detalle aunque no se entregue la notificación. |
| `paciente-lista-de-espera.png` | Bloque «En lista de espera» con la agenda y el estado «En espera», y arriba el turno cancelado con su motivo visible («Indicaste: Me surgió un viaje esa semana»). Avisos 1 y 4. |
| `profesional-panel-de-demora.png` | Agenda del profesional: panel «Avisar demora de la agenda» (minutos + mensaje) y la acción «Avisar demora» por turno. Origen del aviso 2. |

Evidencia de backend (recorrido y bandeja in-app): `mantra-core-health-api/evidencias/p8-avisos-agenda/`.
