# Mapa UX — fase 02

## Alcance

La navegación global (menú lateral por rol) **no se reorganiza** en esta iteración: ya fue
ajustada varias veces por pedido explícito del cliente (carriles 09, 31–40) y tiene pruebas que
la fijan. Moverla sin participantes ni pedido sería cambiar un hábito sin evidencia. El trabajo de
arquitectura de información es **dentro de la vista**, donde los hallazgos H-03…H-07 sí tienen
evidencia.

## Tarea piloto: «¿Cuándo es mi próxima cita? / Quiero pedir una»

| Paso | Disparador | Información necesaria | Decisión | Acción | Resultado |
|---|---|---|---|---|---|
| 1 | Entra a «Mis citas» (menú, panel «Ver o reprogramar», enlace directo) | Sus citas **futuras** primero | ¿Tengo que ir a algún lado pronto? | Leer | Ve la próxima sin desplazarse |
| 2 | Quiere pedir otra | Dónde se pide | — | «Pedir una cita» visible arriba | Salta a la sección y el foco queda en su título |
| 3 | Busca una cita vieja | Filtros | ¿Por médico, estado o fecha? | Abrir filtros (móvil) / usarlos (escritorio) | Lista acotada, con «Limpiar filtros» |
| 4 | Cancela una próxima | Estado y hora | ¿Seguro? | «Cancelar» (ya existe, con confirmación del flujo actual) | Estado actualizado |

Pasos que **no** se eliminan: la elección profesional/laboratorio antes del buscador (decide
qué lista se busca, J2) y la advertencia de horarios incompletos.

## Estructura actual → propuesta

```text
ANTES                                   DESPUÉS
─────                                   ───────
Mis citas (h1)                          Mis citas (h1)            [Pedir una cita]  ← primaria
Tus citas (h2)   [Lista|Calendario]     Tus citas (h2)   [Lista|Calendario]
[buscar][estado][desde][hasta]          Filtros: escritorio en una fila que no recorta;
  (4 filas en móvil)                              móvil tras «Más filtros (n activos)»
- 27 Ago  Atendido                      Próximas (h3) · n
- 9 Sept  Atendido                        - vie 18 sept 09:30  Confirmada   [Cancelar]
- …                                       - …
- 18 Sept Confirmada   ← la que importa Anteriores (h3) · n   (más reciente primero)
- …                                       - 16 sept  Atendido
Lista de espera (h2)                      - …
Agendar una cita (h2)  ← al final       Lista de espera (h2)
                                        Agendar una cita (h2)  ← destino del botón
```

## Fichas de reubicación

### R-01 · «Agendar una cita»: acceso adicional arriba

- **Antes:** sólo la sección al pie de la página (`appointments.html:315`).
- **Después:** la sección **no se mueve** (sigue siendo el lugar del flujo largo); se agrega la
  acción primaria «Pedir una cita» en la ranura `[page-actions]` de `app-page-header`, que la
  garantiza visible en todos los anchos.
- **Razón:** H-03 — la acción principal de la vista estaba a ~2 900 px.
- **Afectados:** pacientes. Médicos sin perfil de paciente no ven la sección ni el botón (misma
  condición `sinPerfilDePaciente`).
- **Compatibilidad:** sin cambio de URL; el enlace «Pedir mi primer turno» del panel sigue
  llevando a `/my-account/appointments`. Se agrega `#pedir-turno` como ancla estable.
- **Prueba de descubribilidad:** en 1440 y 390 el botón está dentro del primer viewport
  (medido en fase 06) y al activarlo con teclado el foco queda en «Agendar una cita».

### R-02 · Orden de la lista: próximas antes que anteriores

- **Antes:** orden del servidor (ascendente por inicio).
- **Después:** dos grupos: «Próximas» (fin —o inicio, si no tiene fin— ≥ ahora, o sin horario; ascendente) y «Anteriores»
  (descendente). Los filtros y el calendario operan sobre **la misma** colección (el calendario
  no depende del orden).
- **Razón:** H-04.
- **Riesgo:** una prueba que dependa del orden del servidor. Se revisa en fase 04.

### R-03 · Filtros plegables en móvil

- **Antes:** 4 controles apilados antes del contenido.
- **Después:** la búsqueda de texto queda siempre visible; estado, desde y hasta se pliegan
  detrás de un botón «Más filtros» (`aria-expanded`, `aria-controls`, «(n activos)»). Se abre
  solo si ya hay alguno puesto. En escritorio el botón no se dibuja y los campos están siempre.
  *Se descartó `<details>`* (lo que decía la primera versión de esta ficha): su estado abierto
  no puede depender del ancho, y en escritorio los filtros no deben plegarse.
- **Razón:** H-05.

## Validación

Sin participantes disponibles: revisión **heurística** (identificada como tal) + medición de
posición del botón primario y de la primera cita futura en los dos viewports. El protocolo con
usuarios queda en `ENTREGA.md` como seguimiento.
