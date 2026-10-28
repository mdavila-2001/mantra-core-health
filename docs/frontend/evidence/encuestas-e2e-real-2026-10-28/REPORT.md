# Prueba real de punta a punta — Encuestas, resumen del médico y reseña pública (28/10/2026)

**Qué es.** Navegador real (Chromium) → `ng serve` (configuración `e2e-real`: development **sin simulador**) → proxy → **API NestJS real** → **PostgreSQL real**. Login por la interfaz. Todo el tráfico de red es real; la persistencia se verificó con `psql` y recargando la pantalla.

**Qué NO es.** No corrió en CI (el CI propio está caído). No probó SSR/hidratación (`e2e-real` usa `ssr:false`), ni el interruptor real de modo oscuro (se aplicó `data-theme`), ni Mongo/OpenSearch/workers (no están en el entorno local).

## Resultado

| # | Paso | Resultado |
|---|---|---|
| 1 | Médica: el menú lateral ya no trae «Laboratorio e imagen», «Organización médica» ni «Encuestas»; «Mis organizaciones» está en la barra superior y abre la pantalla | OK |
| 2 | «Formularios» con pestañas «Formularios \| Encuestas» en una sola pantalla | OK |
| 3 | «Cómo le va» con datos reales (6 de 10 enviadas, tasa 60 %, NPS, satisfacción, alertas, barras por pregunta, tendencia, comentarios sin nombre ni fecha) | OK |
| 4 | Periodo (este mes / 3 meses / 12 meses) y servicio disparan `GET /surveys/insights` con límites de mes | OK |
| 5 | Un servicio con menos de 5 respuestas: estado de privacidad (no se muestran distribuciones ni comentarios) | OK |
| 6 | Asociar una encuesta a un servicio con el selector → `POST /surveys/assignments` 201; «Asociada hoy a …»; recarga y persiste; repetir da 409 visible | OK |
| 7 | Médico B: no ve nada de la médica A (404 sobre su plantilla, resumen suprimido) | OK |
| 8 | Paciente sin atención terminada: **no** aparece «Mis encuestas»; paciente con invitaciones: ícono con contador (= pendientes en la base) | OK |
| 9 | Encuesta de consulta incompleta: error visible y **nada** persiste; completa: 201, 9 respuestas en `survey_answers`, invitación «answered» | OK |
| 10 | «¿Quiere compartir una reseña pública?» (`reviewable-care` real) → reseña **anónima** → aparece en la ficha pública del médico con el promedio; `publishedAt` público al día | OK |
| 11 | Recarga: el contador baja, la encuesta figura respondida, no se vuelve a ofrecer la reseña (`alreadyReviewed`) | OK |
| 12 | Encuesta de servicio (7 preguntas opcionales) con 2 respuestas: 201 | OK |
| 13 | La médica vuelve: el resumen refleja las respuestas nuevas | OK |

Backend, además, por HTTP puro contra la misma base: **262/262** aserciones (encuesta base de consulta con 8 obligatorias y de servicio con todas opcionales; la extensión del médico siempre opcional; plantilla de sistema inmutable con 403; aislamiento entre médicos; insights con cohorte mínima; `reviewable-care`; reseña anónima por defecto; respuestas del médico sin reserva ni hora).

## Defectos que encontró esta prueba y que se corrigieron después

Se corrigieron en commits posteriores (ver el historial de esta rama); se verificaron con el simulador, specs y Playwright, **no se repitió el recorrido completo contra la API real tras las correcciones de frontend** (sí se repitió por HTTP para las del backend):

- el aviso «Faltan responder N…» quedaba fuera de la vista y sin foco;
- las tarjetas de la bandeja del paciente eran idénticas (ahora dicen médico/servicio y fecha);
- los chips de filtro se cortaban a 390 px;
- huecos en «Por pregunta» y el texto «Durante este servicio…» al mirar consultas;
- «Abrir»/«Responder» se dibujaban como enlaces sin estilo (selector de atributo equivocado);
- `POST /patients/me/reviews` sin `displayMode` firmaba con el nombre real (ahora anónimo por defecto);
- la lista de respuestas mostraba la hora exacta y la reserva (ahora solo el día, sin reserva).

## Riesgos residuales (declarados)

- Con ventanas casi iguales o con y sin filtro de servicio, un resumen agregado nunca es 100 % imposible de diferenciar sin ruido añadido; la cohorte mínima (5) y los periodos por mes calendario lo acotan.
- `invitationId` sigue en la lista de respuestas del médico; solo permitiría cruzar con una reserva si el médico emitió la invitación a mano, y ese camino devuelve `ids=[]` cuando ya existe.
- La emisión automática se registra en el log si falla; no hay barrido automático (hay una consulta interna y un runbook en el README del módulo `surveys` de la API).

## Capturas (solo las posteriores a las correcciones o que no se vieron afectadas)

`01` barra superior con «Mis organizaciones» · `03` Formularios \| Encuestas (1440 y 390) · `04` «Cómo le va» (claro y oscuro) · `06` privacidad por servicio · `08` ficha asociada · `12` médico B suprimido · `16` cabecera del paciente con contador (1440 y 390) · `20` encuesta de consulta completa · `21` oferta de reseña · `22` reseña anónima · `25` ficha pública con la reseña · `41` el resumen refleja lo nuevo.
