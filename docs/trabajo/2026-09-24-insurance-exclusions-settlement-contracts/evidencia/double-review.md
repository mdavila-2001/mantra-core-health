# Doble revisión adversarial — H5 (Playwright, Tarea 3 · H8)

Regla 35: dos pasadas independientes sobre las cuatro pantallas capturadas por
`playwright/carril-insurance-exclusions-settlement.spec.ts`. Corrida final:
`docs/trabajo/2026-09-24-insurance-exclusions-settlement-contracts/evidencia/playwright-exclusions-settlement.txt`
— 4/4 `passed`.

## Primera pasada (antes de corregir)

La primera corrida real (no simulada) del spec falló 3 de 4 pruebas por
desborde horizontal (`document.documentElement.scrollWidth >
document.documentElement.clientWidth`), aunque la ecuación de la liquidación y
la cita textual de la cláusula ya eran correctas en las cuatro pantallas. Se
investigó con un script de diagnóstico ad hoc (no comiteado) que listaba los
elementos cuyo borde derecho excedía el ancho del viewport:

1. **Molécula del paciente** (`patient-insurance-settlement`): el
   `<app-badge>` que envuelve la cláusula (`settlement-exclusion-clause`)
   hereda `white-space: nowrap` del átomo `Badge` (pensado para chips de
   estado cortos, no para citar ~250 caracteres de texto legal). La clase
   `settlement__clause` que sí desactivaba el `nowrap` estaba puesta en el
   `<p>` contenedor, no en el badge — el badge nunca se enteraba. Confirmado
   en pantalla ancha (1440 px) y angosta (390 px) por igual, porque el badge
   se niega a partir la línea sin importar el viewport.
2. **Tabla de exclusiones del prestador** (`claim-exclusions-table`, detalle
   de solicitud): reutiliza `.claim__table`, que fuerza
   `min-inline-size: 52rem` — a propósito, para no comprimir ocho columnas de
   la tabla de ítems hasta partir palabras — pero **exige** estar envuelta en
   `.claim__table-scroll` (`overflow-x: auto`) para contener ese mínimo. Se
   copió la tabla sin el contenedor, así que a 390 px empujaba `<body>`
   entero, no solo la tabla.

**Veredicto de la primera pasada: RECHAZADA** en las tres pantallas afectadas
(prestador móvil, paciente escritorio, paciente móvil). La causa era código
del propio carril (H4), no un defecto preexistente: se verificó aparte que
`/dashboard` no desborda con la misma cuenta y viewport.

## Corrección aplicada

- `patient-insurance-settlement.html`/`.css`: clase `settlement__clause-badge`
  puesta directamente en el `<app-badge>` de la cláusula, con
  `white-space: normal` — mismo patrón que ya usa `insurance-claim-detail`
  para el badge de motivo de línea (`claim__clause`).
- `insurance-claim-detail.html`: la tabla `claim-exclusions-table` ahora va
  envuelta en `<div class="claim__table-scroll">`, igual que la tabla de
  ítems.

No se tocó `badge.css` (su `nowrap` por defecto es correcto para chips de
estado; el problema era específico de estos dos usos con texto largo) ni la
lógica de negocio: ambos cambios son de layout puro.

## Segunda pasada (tras corregir)

Re-corrida completa: **4/4 `passed`**. Revisión pantalla por pantalla sobre
las capturas:

| Captura | Ecuación (BigInt, centavos) | Cláusula visible | Desborde horizontal | Veredicto |
|---|---|---|---|---|
| `prestador-escritorio.png` (1440×900, CLM-2026-0177) | 300 = 150 + 30 + 120 ✓ | «Cláusula 12.3» + justificación, envuelta dentro de la tabla | No | **APROBADA** |
| `prestador-movil.png` (390×844, CLM-2026-0177) | 300 = 150 + 30 + 120 ✓ | Igual, tabla dentro de su contenedor con scroll propio, `<body>` sin barra | No | **APROBADA** |
| `paciente-escritorio.png` (1440×900, orden «Perfil lipídico») | 100 = 50 + 20 + 30 ✓ | «Cláusula 14.2» completa, partida en dos líneas dentro del badge | No | **APROBADA** |
| `paciente-movil.png` (390×844, orden «ECG») | 300 general de la solicitud del prestador se corresponde; en la vista paciente 100 = 50 + 20 + 30 ✓ | Cláusula 14.2 visible, badge envuelto en varias líneas | No | **APROBADA** |

Comprobaciones adicionales de la segunda pasada:
- Sin errores de consola salvo el ruido esperado de CSP de `ng serve` (filtrado
  explícitamente en el spec).
- El caso `DENIED` (Electrocardiograma, orden del paciente) muestra
  «Justificación: No informada» — no se inventa una justificación que la
  maqueta no declaró (regla 00), consistente con el caso ya cubierto en
  `patient-insurance-settlement.spec.ts`.
- El caso `PENDING_PUBLICATION` (Ecografía abdominal) no muestra ningún
  importe de cobertura, sólo el aviso de que la aseguradora no publicó la
  liquidación — correcto, no hay dato que mostrar todavía.
- El panel flotante «Modo de demostración» (`Datos de prueba` / `Ver
  componentes`) se superpone levemente a la tarjeta de la Ecografía en la
  captura de escritorio del paciente: es un widget del propio entorno de
  maqueta, ajeno a este carril, y no afecta ninguna aserción del spec.

**Veredicto final: las cuatro pantallas quedan APROBADAS.**
