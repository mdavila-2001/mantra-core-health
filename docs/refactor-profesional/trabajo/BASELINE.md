# Baseline — fase 00

**Candidato de partida:** `origin/mockup` @ `1f8e8bfd` · 2026-09-17 22:25 (BOT) · macOS, Node 24.19,
Chromium del MCP de Playwright · `ng serve` en `:4310` · backend simulado (`mockBackend: true`).
Todas las medidas son **de laboratorio**, en una sola máquina compartida con otras 5 sesiones
(carga 2–5). No hay datos de campo (Core Web Vitals reales).

## Configuración de captura

- Viewports: 1440×900 y 390×844 (barrido); 375×812, 768×1024, 1280×800 (verificación).
- Tema: del sistema (claro); oscuro emulado donde se indica.
- Datos: fixtures deterministas de `core/mock/` (mismo paciente, mismas citas en cada carga).

## Medidas iniciales

| Medida | Resultado |
|---|---|
| `yarn start` en worktree limpio | **falla** (H-02) |
| Desborde horizontal de página, 50 celdas ruta×viewport | 0 |
| Errores de consola, médica a 390 px | ≥ 20 `NotFoundError` (la lista se truncó en 20; aparecen en cada ruta visitada antes del corte) (H-01) |
| «Mis citas» · distancia hasta «Agendar una cita» | ≈2 900 px (1440) · ≈3 700 px (390) |
| «Mis citas» · primera cita futura | debajo de todo el historial |
| «Consultas» (médica) · contenido oculto tras scroll lateral a 1440 | 65 px (la columna de acciones) |
| Transiciones con duración literal | 65 líneas; dos escalas de tokens paralelas |
| Bundle inicial (build de producción de `1f8e8bfd`) | 1,17 MB crudo · **332,73 kB** transferido |
| Avisos de presupuesto de CSS por componente (umbral 4 kB) | **22** (lista en `EVIDENCIAS.md`) |

## Checks existentes al partir

| Comando | Resultado |
|---|---|
| `yarn lint` | **2 errores** (`tools/promo/deck-aseguradoras.html`, H-18) |
| `yarn typecheck` | 0 |
| `yarn build` | 0 (con los 22 avisos de presupuesto) |
| `yarn test` | **10 pruebas rojas** en 3 archivos (H-13, H-17), idénticas antes y después |

## Defectos preexistentes que no deben confundirse con regresiones

- H-13 · `agenda.spec.ts` «una solicitud sin responder no ofrece moverla».
- H-17 · `work-history.spec.ts` (7) e `instituciones.spec.ts` (2).
- H-14 · error de CSP en la primera carga bajo `ng serve`.
- Aviso de prettier en `appointment-calendar.html` (archivo no tocado).
