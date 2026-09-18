# Decisiones (ADR breves)

### D-01 · Aplicar el kit sobre el protocolo existente, no en su lugar
**Contexto:** el repo ya tiene playbook FABLE, inventarios, sistema de diseño y estados M34.
**Decisión:** los entregables de `trabajo/` apuntan a esos artefactos; no se reescriben.
**Consecuencia:** sin `ARCH-DUPLICATE`; el kit aporta auditoría, piloto y evidencia.

### D-02 · Conservar la identidad REDSAT
**Decisión:** ni paleta, ni tipografía, ni tokens de color nuevos (ver `DIRECCION_VISUAL.md`).
**Por qué:** identidad definida por un diseñador, con contraste medido y espejo en Flutter.

### D-03 · Piloto = «Mis citas» del paciente
**Por qué:** tarea principal del rol más numeroso y 5 hallazgos con evidencia (H-03…H-07).

### D-04 · No reorganizar la navegación global
**Por qué:** el cliente la ajustó explícitamente varias veces (carriles 09 y 31–40) y hay pruebas
que la fijan. Sin participantes, moverla sería cambiar hábitos sin evidencia.
**Reabrir si:** hay pruebas con usuarios que muestren problemas de descubribilidad del menú.

### D-05 · H-10 (métricas internas en el panel de la médica): registrado, no cambiado
**Por qué:** quitar o mover «Secciones disponibles/Organizaciones» es una decisión de producto
sobre qué muestra el panel. Propuesta concreta para el propietario: llevar «Ver mi agenda de
hoy» y la próxima consulta al primer bloque y bajar las cifras al final.

### D-06 · Orden en presentación, no en `turnosListos`
Ver `ARQUITECTURA.md`. Evita romper calendario, cancelación y pruebas existentes.

### D-07 · Filtros plegables con botón `aria-expanded`, no `<details>`
El estado abierto de `<details>` no depende del ancho; en escritorio no se pliegan.

### D-08 · Una sola escala de movimiento
`--dur-*`/`--ease-*` son canónicos (documentados, espejo Flutter). `--mov-*` quedan como alias.
150 ms → 120 ms (`--dur-fast`) y `ease` → `--ease-standard`: diferencia imperceptible, a
cambio de una única regla.

### D-09 · Acciones de la tabla de Consultas: volver a `flex-wrap: wrap`
Revierte una parte de `a18d8e97` (13/09), que puso `nowrap` al pasar a íconos. El pedido era
«acciones como íconos», no «en una línea»; con `nowrap` la acción quedaba oculta. Los íconos
sólo bajan de línea cuando no entran.

### D-10 · Indicio de scroll con `animation-timeline`, no con «tapas»
El fondo real (degradado en oscuro) haría visibles las tapas de color fijo. Mejora progresiva:
sin soporte, sin sombra. Con movimiento reducido se fuerza `animation-duration: auto` porque
sigue al scroll, no al tiempo.

### D-11 · `rowLabel` opcional en `data-table`
El nombre accesible nunca es el `trackBy`. Respaldo por posición para las 23 pantallas que no lo
pasan todavía.

### D-12 · Fallas preexistentes: se registran, no se tocan
H-13 y H-17 fallan igual con el `src/` de la base; son reglas de negocio de otros carriles.

### D-13 · Skills del kit: uso por ruta, sin instalar
El encargo no pidió instalarlas en `.claude/skills/`, y el repo ya tiene `project-design-system`,
`visual-quality-gate` y `frontend-production-gate` que cubren lo mismo. Quedan legibles en
`docs/refactor-profesional/skills/`.
