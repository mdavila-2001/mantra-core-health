# QA final — fase 10

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
