# QA final — fase 10

## Seguimiento de `/schedule` y menú móvil · 2026-10-05

**Estado: revisión visual cerrada dentro del recorrido descrito.** En Chromium con rol médico simulado se revisó `/schedule` en claro a 390×844 y 1280×900, en oscuro a 390×844, y la vista semanal oscura a 390×844 y 320×720. También se abrió «Mis horarios» y el preview del horario anterior a 320×720; se recorrieron día, semana, mes e histórico del 3 de octubre con reservas/estados. La semana usa dos columnas a 390/320 px y la grilla del modal conserva desplazamiento horizontal interno.

En el menú «Más accesos» a 390 px, el snapshot muestra Red social, Tutoriales, Chats (4 no leídos), facturas, solicitudes y ajustes. «Tutoriales» navega a `/tutorials` y cierra el menú; Escape también lo cierra y devuelve el foco al botón. El menú mide 252×269 px. Con viewport de 390 y 320 px, `documentElement` y `body` tienen exactamente el ancho del viewport (sin overflow horizontal del documento).

| Comprobación | Resultado |
|---|---|
| Día/semana, tema y anchos indicados arriba | Revisión visual manual con capturas persistidas; no es cobertura automatizada. |
| Apertura/cierre del menú y foco tras Escape | Comprobado por interacción/snapshot. |
| Navegación al activar «Tutoriales» | Aprobada: `/tutorials`; el menú se cierra. |
| Vista mensual oscura a 320×720 y 390×844 | Aprobada tras compactar conteos a `N libres`/`Bloq.`; no se observó solapamiento ni overflow horizontal del documento (320/320 y 390/390). Las causas completas se conservan en los nombres accesibles. Se conserva la captura previa al arreglo como registro del defecto. |
| Medición de overflow horizontal y captura del menú abierto | Aprobada: ancho del documento 390/390 y 320/320; captura persistida. |
| Gates finales del repo | yarn typecheck y yarn build: exit 0; el build conserva avisos existentes de presupuesto CSS y dependencias CommonJS. |
| Prueba unitaria enfocada de la vista mensual | Aprobada: 29/29. |
| Consola | Dos errores CSP de scripts inline en `/auth` en modo desarrollo; no se atribuyen a la agenda. |

Las capturas están en `capturas/despues/schedule-*.png` y `capturas/despues/header-mas-accesos-oscuro-movil-390.png`; `schedule-mes-oscuro-movil-320-antes-ajuste.png` conserva el hallazgo original. No se probaron otros navegadores, roles ni API real; esta aprobación se limita a la inspección visual manual descrita.

## Cierre adicional: panel principal · 2026-10-05

El piloto de `/dashboard` queda listo para revisión visual dentro de su alcance. Se verificaron personal, administración y paciente con datos simulados, claro/oscuro y anchos desde 320 hasta 1920 px. El árbol de accesos devuelve el foco al control de origen tras Escape; el mapa conserva contraste AA y scroll local; el pulso del reloj se apaga con movimiento reducido.

| Gate | Estado |
|---|---|
| Build de producción | Aprobado (`yarn build`, exit 0) |
| Typecheck | Aprobado (`yarn typecheck`, exit 0) |
| Navegador enfocado | Aprobado (4/4 pruebas: 2 de jornada y 2 del refactor) |
| Lint del archivo nuevo | Aprobado |
| Lint global | Aprobado (`yarn lint`, exit 0) tras corregir el manejador de Escape del menú. |
| Estados de error/vacío | Revisados en código; sin captura mediante fallo inyectado |
| Rendimiento | Build aprobado; sin perfilado de pintura ni medición de campo |

La decisión de alcance y el inventario para `/schedule` están en `PLAN_PANEL_PRINCIPAL.md`. Las evidencias y capturas están en `EVIDENCIAS.md` y `capturas/despues/`. No se reclama certificación de todas las rutas ni de la API real.

---

**Candidato:** `e7261cb4` (segunda tanda; la primera fue `36104a9d`) (rama `justin/refac-ux-profesional`, base `origin/mockup` @ `1f8e8bfd`).
Backend simulado; ningún dato real ni productivo.

## Checks

| Check | Resultado |
|---|---|
| `yarn lint` | ✅ 0 |
| `yarn typecheck` | ✅ 0 |
| `yarn build` | ✅ 0 · 22 avisos = base |
| `yarn test` | ⚠️ 6 346 ✅ · **10 ❌ preexistentes** (idénticas en la base: H-13, H-17) |
| E2E del refactor (11 casos, 1 worker) | ✅ 11/11 |
| Kill-test H-01 | ✅ la prueba detecta el defecto |

## Rúbrica (con incertidumbre explícita)

| Criterio | Estado | Evidencia |
|---|---|---|
| R01 Contexto y alcance | Aprobado | `CONTEXTO_REAL.md`, `INVENTARIO.md` |
| R02 Problemas priorizados | Aprobado | `HALLAZGOS.md` (20) |
| R03 Navegación comprensible | **Parcial** | Dentro de «Mis citas» sí; navegación global no tocada (D-04) |
| R04 Identidad consistente | Aprobado en alcance | `DIRECCION_VISUAL.md` |
| R05 Contratos | Aprobado | `ARQUITECTURA.md`; ningún cliente de API tocado |
| R06 Componentes completos | Aprobado en alcance | `data-table` + piloto, con pruebas |
| R07 Flujo de extremo a extremo | **Parcial** | Llegar, leer, ubicar y pedir: verificado; orden → reserva en laboratorio: verificado. Confirmar la reserva y cancelar no cambiaron y no se re-ejecutaron de punta a punta |
| R08 Movimiento | Aprobado en alcance | `MATRIZ_MOVIMIENTO.md`; sin perfilado de pintura |
| R09 Cobertura del resto | **Parcial** | `MATRIZ_COBERTURA.md`: piloto + panel médica + órdenes/resultados + 4 familias |
| R10 Accesibilidad | **Parcial** | Teclado, foco, `aria-expanded`, nombres accesibles verificados; **sin lector de pantalla real** ni auditoría axe completa |
| R11 Rendimiento | Aprobado (laboratorio) | bundle inicial 332.77 kB transferido (base 332,73 kB); sin medición de campo |
| R12 Entrega recuperable | Aprobado | commits atómicos, `ENTREGA.md` |
| R13 Skills | Aprobado | uso por ruta (D-13) |
| R14 Afirmaciones honestas | Aprobado | cada cifra con su fuente; lo no medido se dice |

## No ejecutado

- Lector de pantalla (VoiceOver/NVDA).
- Safari y Firefox (sólo Chromium). La sombra de scroll no aparece en navegadores sin
  `animation-timeline`, por diseño.
- Perfilado de rendimiento de pintura / INP.
- Pruebas con usuarios.

## Decisión

**Listo para revisión** dentro del alcance declarado. Sin P0/P1 abiertos en los flujos tocados.
