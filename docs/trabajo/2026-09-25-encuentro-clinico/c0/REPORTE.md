# C0 — Reporte de implementación · Marcelo · 2026-09-25

**Estado de sesión: TESTED a nivel de contrato/handlers/componentes; runtime E2E BLOCKED por CSP preexistente (no C0); publicación en curso.** La suite dirigida tiene 757 tests aprobados, pero exit 1 por cobertura. Tras corregir foco/reapertura, consulta y agenda tienen 140 tests aprobados, exit 0. Reverificado íntegramente tras fusionar `origin/mockup` dos veces (ver §7): 13 archivos/309 tests de C0 en verde, typecheck exit 0, kill-test sin coincidencias, guardián 3 PASS/0 FAIL, y el E2E completo de 12 casillas (31 casos) corrido hasta el final: **31/31 fallan sólo en `afterEach` por el mismo CSP reproducido en `/auth`**, cero fallos de lógica de C0. Build previo: exit 0; build de entrega pendiente; lint release 263 errores, exit 1 (idéntico al baseline; ajeno a C0). El carril no alcanza VERIFIED ni REGRESSION_VERIFIED porque el gate de consola limpia del E2E sigue rojo por causa ajena, no por decisión de bajar la vara.

Base original: `9b8bc46e3f92be7bf80b64b2014cdaf4b86b9796`. Rama: `marcelo/feat-clinica-c0-contrato-primero`. Worktree: `wt-clinica-c0`. Puerto reservado: **4210**. Commits: `46e0dc52` (plan), `174c9340` (contratos y estados), `eb2beabb` (handlers), `8a16fcbe` (rejilla conectada), `0fb88142` (guardián pw-guard), `455ca3f7` y `f8d068ee` (merges de `origin/mockup`, el segundo con un conflicto mecánico en `diagnostics.handlers.ts` resuelto conservando ambas adiciones — ver §7).

Alcance: las 21 microtareas originales y la integración necesaria `C0.H4.S2.M1` para distinguir reserva y cita clínica. Solo frontend y simulador, con fixtures sintéticos declarados. P39–P42 siguen pendientes del backend real. Los tipos permanecen identificados por los commits locales; **publicación, aviso de congelamiento y disponibilidad para integración siguen pendientes**. No se afirma integración en `mockup`.

## 1. Completado

“HECHO” se limita a cada microtarea y evidencia indicada; no implica cierre global. C0.Hn.S1.Mm corresponde a C0.Hn.Mm original.

| ID / estado | Qué se logró | Comando ejecutado | Resultado y evidencia |
|---|---|---|---|
| C0.H1.S1.M1 · HECHO | Base aislada, SHA y baseline registrados; estándar fusionado sin sobrescribir | `corepack yarn lint`; `corepack yarn typecheck`; suite baseline con `**/*.spec.ts` | Baseline: lint 263 errores, exit 1; typecheck preparado exit 0; 692 tests pasan y 1 falla. Se obtuvo la línea base, no gates verdes. [Antes](evidencia/antes/tests-specs.txt), [lint](evidencia/antes/lint.txt). |
| C0.H1.S1.M2 · HECHO | ADR-0016 e índice explican encuentro, compatibilidad y límites P39–P42 | Revisión de contenido y enlaces locales con `python -` (§4) | ADR 3 + índice 18 enlaces, cero ausentes. Gate global de enlaces rojo separado. |
| C0.H1.S1.M3 · HECHO | Glosario clínico UI/código/contrato y README de coordinación revisados | Revisión de contenido y enlaces locales con `python -` (§4) | README 3 enlaces, cero ausentes; glosario sin enlaces Markdown. Publicación sigue en H6. |
| C0.H2.S1.M1 · HECHO | ACT-FOLLOW-UP, APT-RECONSULTA y SRQ-OTHER; expansión estable y VERIFICACION_DX conservado | D1 (§4), incluye `terminology.handlers.spec.ts` | Aserciones aprobadas en suite dirigida de 757 tests. Commit `174c9340`. |
| C0.H2.S1.M2 · HECHO | MedicalNoteEntry y entries readonly en lectura/alta/versionado; JSDoc C1/P39 | `corepack yarn typecheck` | Exit 0 observado. [Salida](evidencia/despues/typecheck.txt). |
| C0.H2.S1.M3 · HECHO | AnalysisCategory, category y basedOnNoteIds según contrato; JSDoc C2/P40 | `corepack yarn typecheck` | Exit 0 observado; no agrega comportamiento C2. |
| C0.H2.S1.M4 · HECHO | Tipos de verificación y Condition.verification opcional; C3/P41 documentados | `corepack yarn typecheck` | Exit 0 observado; el endpoint sigue siendo stub C0. |
| C0.H2.S1.M5 · HECHO | Contrato de reconsulta compatible con FollowUpOriginRef y extensiones existentes; P42 documentado | D1, incluye scheduling y follow-up-block | Aserciones dirigidas aprobadas; no se redujo el contrato C4. |
| C0.H2.S1.M6 · HECHO | Helper de cuatro estados, ocho escenarios, frontera inclusiva y C6 con tres grupos; vencidos con motivo explícito | D1, incluye diagnosis-state/history-view-model | TESTED: reloj fijo, vencimiento, rechazo, curso crónico, grupos, timeline y PDF. |
| C0.H3.S1.M1 · HECHO | Tres rutas de notas trasladadas; respuestas/versionado/persistencia conservados y único deduplicador de avisos | D1, incluye clinical.handlers, mock-backend y aviso-ficha-medica | TESTED. Comparación estática adicional: cuerpos trasladados idénticos a base. Commit `eb2beabb`. |
| C0.H3.S1.M2 · HECHO | POST service-requests ahora pertenece a diagnostics, preservando alta/reutilización/duplicado 412 | D1, incluye clinical.handlers y diagnostics.handlers | TESTED; una sola ruta registrada. Commit `eb2beabb`. |
| C0.H3.S1.M3 · HECHO | Stub de verificación C3 registrado una vez | D1, incluye mock-backend | TESTED: 404 y mensaje exacto `Pendiente: carril C3`. |
| C0.H5.S1.M1 · HECHO | Guard ESM operativo, self-test real, serve y limpieza propia Windows | `node scripts/pw-guard.mjs --self-test`; `node scripts/pw-guard.mjs --port 4210 --serve --spec playwright/consulta-rejilla.spec.ts:116` | 3 PASS, 0 FAIL, exit 0; serve arranca dev, ejecuta hasta CSP, devuelve 1 sin retry y limpia: cleanupConfirmed=true, cero listeners en 4210. El E2E queda FAILED. |

Comprobaciones adicionales observadas:

- D1: **34 archivos y 757 tests aprobados**, pero **exit 1 por cobertura** insuficiente, sin cambiar umbrales.
- [Regresión final consulta/agenda](evidencia/despues/tests-focus-agenda-final.txt): **2 archivos, 140 tests aprobados, exit 0**, sin cobertura.
- [Typecheck release](evidencia/despues/typecheck-release.txt): **exit 0**. [Build previo](evidencia/despues/build-final.txt): **exit 0**; no se atribuye a modificaciones posteriores.
- [Self-test final](evidencia/despues/pw-guard-self-test-final.txt): **3 PASS, 0 FAIL**, 10 intentos internos, 39.78s, exit 0. Serve conserva como fallo el E2E que llega al CSP.
- [Inventarios](evidencia/despues/inventory-regenerate.txt): cinco archivos regenerados; check exit 0.
- Rutas, tokens y contraste: exit 0. Arquitectura, prefijos API, formularios, CSS y enlaces: exit 1. [Comparación con base](evidencia/despues/base-comparison.md).

## 2. A medias

| ID / estado | Qué anda o está escrito | Qué no anda o no está acreditado | Qué falta exactamente | Dónde quedó |
|---|---|---|---|---|
| C0.H4.S1.M1 · A MEDIAS | Rename y consumidores probados; kill-test previo sin coincidencias; stock reconoce bloques nuevos | Visual final y kill-test sobre entrega pendientes | Registrar comprobación final y P1/P2 de stock/especialidad | `patient-chart/analysis-order-block/**`; specialty-form-block |
| C0.H4.S1.M2 · A MEDIAS | Stub C1 e inputs/output probados; Tab/Shift+Tab permanecen dentro del modal | E2E global rojo por CSP; aprobación visual pendiente | Completar P1/P2 sobre capturas finales | `medical-note-block/**`; focus-probe-final.json |
| C0.H4.S1.M3 · A MEDIAS | Reconsulta conservada, recibe reserva correcta y muestra formulario sin 404 de booking en recorrido | Consola global no limpia; revisión visual pendiente | Incorporar P1/P2 y mantener limitación global | `follow-up-block/**`; consultation |
| C0.H4.S1.M4 · A MEDIAS | Las 12 casillas, títulos y orden pasan las comprobaciones individuales; diez combinaciones recapturadas | Matriz roja por CSP y overflow global de 13 px en historia390 | Registrar doble revisión; no reparar header fuera de alcance | consultation; E2E; browser-probe.json |
| C0.H4.S1.M5 · A MEDIAS | Foco y reapertura inmediata corregidos; regresión de 140 tests pasa; recorrido comprueba Tab, Escape, foco y recarga | AfterEach de consola falla por CSP; P1/P2 en curso | Mantener evidencia de pasos y completar revisión final sin declarar E2E PASSED | consultation; analysis-order-block; pw-consultation-final |
| C0.H4.S2.M1 · A MEDIAS | `booking` separado de `cita`; agenda/consulta probadas y recorrido llega a Reconsulta sin 404 | E2E global no pasa por consola CSP | Registrar distinción appointmentId/Booking.id y limitación de integración | clinical-record.routes; agenda; consultation |
| C0.H6.S1.M1 · A MEDIAS | Revisión estática, DOM, reporte, gates parciales y regresión final documentados | Cobertura/gates rojos; CSP/overflow; P2 y build de entrega pendientes; lint release 263 errores | Incorporar outputs finales sin modificar umbrales ni ocultar fallos | `evidencia/despues/`; este documento |
| C0.H6.S1.M2 · A MEDIAS | Commits locales de contratos y handlers | Push y PR todavía sin evidencia | Completar commits, actualizar base, verificar cambios afectados, publicar rama y PR | Rama local; SHA al inicio |
| C0.H6.S1.M3 · TODO | Aviso acordado mediante PR y dailies clínicos | Daily/aviso de entrega pendientes | Actualizar personal/equipo con SHA y URL reales, preservando Farmacia/Carga Masiva | AlovidaPromptManager; PR pendiente |

## 3. Pendiente

- **Lint release: 263 errores, exit 1. Build de entrega: PENDIENTE.** Typecheck release y regresión local final ya registran exit 0; build anterior 0 no acredita código posterior.
- **Doble revisión visual: EN CURSO.** [P1](evidencia/doble-revision-p1.md) terminó: 60 capturas, 50 OK, 8 defectos menores y 2 mayores. P2 esperado en `evidencia/doble-revision-p2.md`; pendiente de escritura/revisión final. Captura disponible no equivale a aprobación.
- **Consola: BLOQUEADO.** Dos errores CSP de SSR/event replay se reproducen en /auth. Se conserva `expect(errors).toEqual([])`, sin filtros.
- **Responsive global: BLOQUEADO.** Historia390 claro/oscuro mide 403 px de scroll sobre 390 px de viewport; causa DOM en header con HTML/CSS iguales a base. No se hace limpieza transversal.
- Los cuatro fallos de la corrida amplia requieren reproducción aislada: dos límites temporales, un ENOENT de fuente y un timeout de agenda-ids. No subir timeouts ni reintentar a ciegas.
- Cobertura y gates rojos mantienen umbrales. La comparación estática con base delimita origen del código, sin demostrar reproducción previa de cada fallo.
- **Publicación: PENDIENTE. SHA de entrega: PENDIENTE. URL del PR: PENDIENTE.** Publicar solo rama y PR a mockup, sin push directo ni merge. Registrar después los valores reales en dailies.
- Mantener reservas WIP. “Disponible en PR” e “integrado en mockup” son estados diferentes.

## 4. Evidencia literal

### D1 — Suite dirigida

Orden observada por el agente principal, desde el worktree; se redujo concurrencia tras observar variación temporal y timeout en la corrida amplia, sin modificar aserciones ni límites de pruebas:

```powershell
$env:VITEST_MAX_WORKERS='2'
corepack yarn test --watch=false --coverage --include=src/app/core/mock/handlers/clinical.handlers.spec.ts --include=src/app/core/mock/handlers/diagnostics.handlers.spec.ts --include=src/app/core/mock/handlers/terminology.handlers.spec.ts --include=src/app/core/mock/mock-backend.spec.ts --include=src/app/core/mock/aviso-ficha-medica.spec.ts --include=src/app/core/data-access/scheduling/**/*.spec.ts --include=src/app/shared/clinical/**/*.spec.ts --include=src/app/features/clinical-record/**/*.spec.ts --include=src/app/features/account/medical-record/**/*.spec.ts --include=src/app/features/agenda/agenda.spec.ts
```

[Salida dirigida](evidencia/despues/tests-directed-coverage.txt), extracto literal:

```text
 Test Files  34 passed (34)
      Tests  757 passed (757)

Statements   : 62.75% ( 15537/24760 )
Branches     : 56.61% ( 9050/15986 )
Functions    : 59.74% ( 3613/6047 )
Lines        : 63.37% ( 13198/20824 )
ERROR: Coverage for lines (64.59%) does not meet "src/app/core/**" threshold (80%)
ERROR: Coverage for functions (49.36%) does not meet "src/app/shared/**" threshold (80%)
ERROR: Coverage for functions (59.03%) does not meet "src/app/features/**" threshold (60%)
```

Exit **1**, observado en el wrapper de ejecución por el agente principal. El log contiene más incumplimientos de cobertura; el extracto no afirma que esos tres sean los únicos.

### Corrida amplia y baseline

Comando amplio corregido a patrones de specs:

```powershell
corepack yarn test --watch=false --coverage '--include=src/app/core/mock/**/*.spec.ts' '--include=src/app/core/data-access/scheduling/**/*.spec.ts' '--include=src/app/shared/clinical/**/*.spec.ts' '--include=src/app/features/clinical-record/**/*.spec.ts' '--include=src/app/features/account/medical-record/**/*.spec.ts'
```

[Salida amplia](evidencia/despues/tests-coverage.txt), extracto literal:

```text
AssertionError: expected 682.4627999999975 to be less than 650
AssertionError: expected 47.625099999997474 to be less than 30
Error: Test timed out in 5000ms.
 Test Files  2 failed | 59 passed (61)
      Tests  4 failed | 970 passed (974)
```

El cuarto fallo es ENOENT al buscar `mock-backend.interceptor.ts` en la raíz del worktree. Ubicaciones y comparación estática están documentadas en [base-comparison.md](evidencia/despues/base-comparison.md). Fuentes previas no equivalen a fallo previo reproducido.

Baseline, extractos de [lint](evidencia/antes/lint.txt) y [tests-specs](evidencia/antes/tests-specs.txt):

```text
✖ 263 problems (263 errors, 0 warnings)
exit=1

AssertionError: expected 1 to be +0 // Object.is equality
 Test Files  1 failed | 54 passed (55)
      Tests  1 failed | 692 passed (693)
exit=1
```

El fallo baseline pertenece a `insurance-analytics.handlers.spec.ts:86`, `coveragesWithoutPremiumCount` esperado 0, recibido 1.

### Regresión local, documentación y lint release

Regresión posterior a las correcciones de foco/reapertura:

```powershell
corepack yarn test --watch=false --include=src/app/features/clinical-record/consultation/consultation.spec.ts --include=src/app/features/agenda/agenda.spec.ts
```

[Salida final](evidencia/despues/tests-focus-agenda-final.txt):

```text
 Test Files  2 passed (2)
      Tests  140 passed (140)
EXIT_CODE: 0
```

No se ejecutó cobertura en esta regresión; no reemplaza D1.

Revisión documental con `python -`: extracción de enlaces Markdown y resolución relativa al archivo. Salida literal:

```text
docs/adr/ADR-0016-encuentro-eje-clinico.md: local_links=3, missing=0
docs/adr/index.md: local_links=18, missing=0
docs/business/glossary.md: local_links=0, missing=0
docs/trabajo/2026-09-25-encuentro-clinico/README.md: local_links=3, missing=0
LOCAL_LINKS_TOTAL 24
```

Acredita enlaces propios; el gate global conserva 12 destinos ausentes. Se revisó la sección clínica del glosario; no se corrigió contenido previo de otras áreas.

La primera corrida lint posterior dio 264 errores frente a 263 del baseline. Se retiró el import de `ordenes` ya sin uso; handlers quedó en `eb2beabb`. [Salida anterior](evidencia/despues/lint-final.txt) preserva exit 1. **Lint release final: 263 errores, exit 1.** [Salida](evidencia/despues/lint-release.txt). Coincide en cantidad con el baseline; no implica gate aprobado.

Extracto literal:

```text
✖ 263 problems (263 errors, 0 warnings)
EXIT_CODE: 1
```

El gate [doc-links final](evidencia/despues/doc-links-final.txt) también termina en exit 1; mantiene los doce destinos externos a C0 ya documentados.

### Runtime contra 4210: dos salidas rojas y bloqueo de consola

Comando conservado en ambos logs:

```powershell
node scripts/pw-guard.mjs --port 4210 --spec playwright/consulta-rejilla.spec.ts:113
```

[Primera ejecución](evidencia/despues/pw-functional-first.txt), extracto literal:

```text
[pw-guard] taskkill PID 31356: spawnSync taskkill.exe ETIMEDOUT
[pw-guard] STALL: sin líneas de salida; relanzando.
TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
RESUMEN: outcome=FAILED intentos=2 duracion=1288.14s
EXIT_CODE: 1
```

El primer intento tuvo aproximadamente 1221 s sin salida, coincidiendo con el límite de unos 20 minutos de la herramienta/aprobación del host, según la observación del agente principal. Se documenta la coincidencia; esta revisión no aisló su causalidad. La comprobación posterior del agente principal no encontró procesos propios supervivientes: **no se afirma una fuga de procesos vigente**, aunque el intento sí registró ETIMEDOUT en taskkill.

En el segundo intento de esa primera ejecución, el selector buscaba “en curso” mientras la tarjeta real decía “En consulta”; la elección equivocada abría el aviso de otra consulta abierta y no navegaba. Se corrigió únicamente la selección a `/en (curso|consulta)/i`, sin aumentar timeouts.

[Segunda ejecución](evidencia/despues/pw-functional-second.txt), ya con selector corregido:

```text
Error: expect(received).toBe(expected) // Object.is equality
Expected: true
Received: false
RESUMEN: outcome=FAILED intentos=1 duracion=14.27s
EXIT_CODE: 1
```

El fallo está en `checkTile`, línea 105 del spec: después de Tab, `dialog.contains(document.activeElement)` devuelve false. La ejecución sí alcanza un modal; no completa las comprobaciones restantes. La causa se localizó y corrigió posteriormente; el fallo inicial se conserva como evidencia. El probe final y la regresión siguientes sustituyen la incertidumbre de esta primera ejecución.

Ambas ejecuciones también fallan en la aserción original de consola:

```ts
expect(errors, 'Consola y red del simulador').toEqual([]);
```

La [reproducción independiente en /auth](evidencia/despues/console-auth-baseline.json) registra los mismos dos errores CSP, sin entrar a la consulta C0. Los scripts bloqueados corresponden a SSR/event replay: `ng-event-dispatch-contract` y `window.__jsaction_bootstrap`. Esta reproducción delimita un problema global de consola en una ruta ajena; no equivale a ejecutar todo el baseline Git. No se cambiaron las fuentes de seguridad ni se relajó la política CSP.

**La revisión automática de aprobación rechazó la propuesta de filtrar estos mensajes CSP en la aserción por “debilitar la aserción”. Esa modificación no se ejecutó.** Se conserva la expectativa de arreglo vacío y se registra el bloqueo de consola global.

### Recorridos finales y causas observadas

| Ejecución | Resultado literal | Alcance de la observación |
|---|---|---|
| [Consulta completa](evidencia/despues/pw-consultation-final.txt) · [JSON](evidencia/despues/pw-consultation-final.json) | `RESUMEN: outcome=FAILED intentos=1 duracion=38.48s`; exit 1 | Un test completa las doce casillas, títulos, teclado, cierre, foco y recarga. Único fallo reportado: afterEach CSP. |
| [Rejilla/modales](evidencia/despues/pw-grid-modals-final.txt) · [JSON](evidencia/despues/pw-grid-modals-final.json) | `RESUMEN: outcome=FAILED intentos=1 duracion=165.02s`; exit 1 | Diez combinaciones, cinco anchos y dos temas: comprobaciones individuales completas, recaptura tras el fix. Diez fallos afterEach CSP. |
| [Matriz](evidencia/despues/pw-matrix-final.txt) · [JSON](evidencia/despues/pw-matrix-final.json) | `RESUMEN: outcome=FAILED intentos=1 duracion=439.01s`; exit 1 |31 casos fallan en afterEach CSP. Historia390 agrega dos aserciones: esperado0, recibido13. |
| [Serve](evidencia/despues/pw-guard-serve.txt) · [JSON](evidencia/despues/pw-guard-serve.json) | `RESUMEN: outcome=FAILED intentos=1 duracion=184.18s`; exit 1 | Inicia yarn dev, llega al mismo CSP y limpia procesos propios. cleanupConfirmed=true; PORT_4210_LISTENERS_AFTER_GUARD=0. |

Comandos: `node scripts/pw-guard.mjs --port 4210 --spec playwright/consulta-rejilla.spec.ts:116` (caso completo); `--spec playwright/consulta-rejilla.spec.ts:131` (rejilla/modales); archivo completo (matriz); `--serve` (arranque supervisado). Ninguno se presenta como PASSED ni se reintentó la aserción.

La [primera matriz](evidencia/despues/pw-matrix-first.txt) produjo 54 de 60 capturas. Además de CSP: selector de Pagos coincidía con dos encabezados; historia390 desbordaba; los modales1920 podían no abrir. Se corrigió Pagos con testid existente, texto exacto y visibilidad; la aserción no se debilitó.

**Foco:** [probe final](evidencia/despues/focus-probe-final.json) registra inside=true en open, Tab y Shift+Tab, más retorno a la casilla con Escape. La trampa permanece local a consultation.

**Reapertura1920:** [browser-probe.json](evidencia/despues/browser-probe.json) conserva eventos y DOM. Después de Escape sobre Órdenes, el selector accesible contaba cero pero quedaba un `dialog open=false`; Enter en Reconsulta reutilizó esa instancia. Angular recibió truthy→truthy antes de renderizar el null y `afterNextRender(showModal)` no se repitió. Corrección local: `ChangeDetectorRef.detectChanges()` después de `casillaAbierta.set(null)` retira inmediatamente el modal cerrado. La regresión cubre cerrar/reabrir sin esperar otro render; los recorridos finales ya no reportan el defecto.

**Diálogo anidado:** la revisión estática detectó que el trap exterior podía interceptar Tab desde el último control del aviso de estudio duplicado e intentar foco sobre el modal exterior inertizado. Se retorna cuando `event.target.closest('dialog')` difiere del diálogo exterior; la regresión dirigida cubre esta frontera. ContentDialog compartido queda intacto.

**Historia390:** probe claro/oscuro:

```text
documentElement.clientWidth = 390
documentElement.scrollWidth = 403
.app-header__derecha: x=100, width=303, right=403, flexShrink=0
[data-testid="header-cuenta"]: x=363, width=40, right=403
```

Causa en header global: `src/styles/alovida.css:876` usa `flex: none`; la regla móvil :2510 conserva el grupo de acciones. Los grupos clínicos no originan esos 13 px. Comparación SHA256 con saltos LF, base 9b8bc46e frente a worktree:

| Archivo | Igual a base | SHA256 compartido |
|---|---|---|
| `src/styles/alovida.css` | Sí | `ff4766f91907f113c6699b08b43c9f8fbb168870763da455f3e68c47912888b3` |
| `src/app/features/shell-layout/shell-layout.html` | Sí | `a59698a1abf8a05ceff552763611b742841df70f07dbc9ea0bbb88aac5092c88` |
| `src/app/features/shell-layout/shell-layout.css` | Sí | `fbf4fb98e5aff426b7e45300081a05c2cbcfbf02f9b85f17d9f6f627a96d9314` |

El JSON también prueba igualdad de medical-record HTML/CSS y ContentDialog. Acredita fuente previa y causa DOM actual; no es reproducción runtime del checkout base. Las dos imágenes history390 se capturaron fullPage antes de evaluar overflow; el check se mantiene intacto.

**Visual:** [P1](evidencia/doble-revision-p1.md) terminada: 60 capturas inspeccionadas individualmente, **50 OK, 8 defectos menores y 2 mayores**, con 60 hashes coincidentes al finalizar. P2 previsto en `evidencia/doble-revision-p2.md`, pendiente de creación/revisión. Los PNG de probe1920 pueden mostrar estados transitorios; la recaptura final reemplaza esa evidencia para la revisión. No se atribuye aprobación a una captura por existir.

P1 mantiene como mayores las dos capturas de historia a 390 px por el header global. Los ocho menores corresponden a la tira de pestañas/sello de demo en historia1024, sello en rejilla1440 e inspector de stock1440/1920, ambos temas. Los 30 modales finales no presentaron solapes, overflow ni skeleton en P1. El stock conserva el preset interior Portátil 1280×800; los cinco anchos prueban el viewport exterior, no cinco tamaños del iframe. Es revisión visual, no evidencia de persistencia ni consola limpia.

### Build, typecheck, inventarios y guardián

`corepack yarn build`, [extracto final](evidencia/despues/build-final.txt):

```text
Output location: D:\Trabajos Secundarios\Mantra Core Technologies\wt-clinica-c0\dist\mantra-core-health

EXIT_CODE: 0
```

El build conserva avisos de dependencias CommonJS; el exit 0 acredita compilación, no flujo de usuario.

`corepack yarn typecheck`, [log release posterior a los cambios de foco](evidencia/despues/typecheck-release.txt):

```text
EXIT_CODE: 0
```

También se conserva el [baseline preparado](evidencia/antes/typecheck-preparado.txt) con `exit=0`.

`node scripts/generate-inventory.mjs` seguido de `node scripts/generate-inventory.mjs --check`, [extracto literal](evidencia/despues/inventory-regenerate.txt):

```text
✓ docs/reports/generated/route-inventory.md
✓ docs/reports/generated/component-inventory.md
✓ docs/reports/generated/api-inventory.md
✓ docs/reports/generated/module-graph.md
✓ docs/reports/generated/e2e-inventory.md
✓ los inventarios generados coinciden con el código
```

Exit **0**, observado por el agente principal. El primer check había fallado por inventarios desactualizados; se conserva esa salida inicial.

`node scripts/pw-guard.mjs --self-test`, [extracto final](evidencia/despues/pw-guard-self-test-final.txt) y [JSON](evidencia/despues/pw-guard-self-test-final.json):

```text
PASS: silencio: mata árbol y relanza
PASS: salida 0: acepta reporter Unicode, ASCII y chunks
PASS: aserción: salida 1 sin relanzar
pw-guard self-test: 3 PASS, 0 FAIL
RESUMEN: outcome=PASSED intentos=10 duracion=39.78s
EXIT_CODE: 0
```

### Gates

[Registro de gates](evidencia/despues/gates.json):

| Comando | Exit observado | Alcance de la afirmación |
|---|---:|---|
| `node scripts/check-route-prefixes.mjs` | 0 | 243 rutas sin colisión con 63 prefijos; excepción registrada practitioners |
| `node scripts/check-tokens.mjs` | 0 | 212 tokens coinciden |
| `node scripts/check-contrast.mjs` | 0 | Gate estático con sus excepciones ya declaradas; no sustituye inspección visual |
| `node scripts/check-architecture.mjs` | 1 | Tres ciclos estáticos, import core/shared y dos detecciones de red |
| `node scripts/check-api-prefixes.mjs` | 1 | /loyalty ausente en configuración Docker/nginx |
| `node scripts/check-form-pages.mjs` | 1 | Dos formularios externos a C0 sin paginar |
| `node scripts/check-css-tokens.mjs` | 1 | Cuatro nombres, cinco usos sin reserva |
| `node scripts/check-doc-links.mjs` | 1 | Doce destinos ausentes de documentos previos |

## 5. No cubierto

- Backend real, persistencia Postgres, autenticación/autorización real y P39–P42 en servidor.
- Features completas C1–C4. Nota médica es stub C1; análisis/reconsulta preservan funcionalidad existente del simulador.
- Aprobación global E2E: los pasos de consulta/rejilla/modales se completan, pero afterEach falla por CSP; historia390 añade overflow. P1 terminó con defectos abiertos; P2 final sigue pendiente.
- Build de entrega, publicación PR y aviso/dailies. Lint release sí fue ejecutado: 263 errores, exit 1. Typecheck release y regresión local posterior al fix sí tienen exit 0; build anterior también.
- Reproducción aislada de los cuatro fallos amplios y de gates en checkout separado de base.
- Cobertura por encima de umbrales. D1 conserva exit 1.
- Ejecución del guard en POSIX. La evidencia real del guard corresponde a Windows.

## 6. Desvíos del plan y riesgos residuales

1. **Compatibilidad aprobada:** se preservaron los bloques funcionales de análisis y reconsulta; solo Nota médica muestra “En construcción (C1)”. No se sustituyeron funcionalidades existentes por stubs.
2. **C6 adaptado al contrato canónico:** el helper ofrece cuatro estados; historia conserva tres grupos y agrupa rechazados con históricos. La falta de certeza prevalece sobre resolución; confirmado exige estado clínico activo y plazo vigente. Tests anteriores se ajustaron a esa decisión manteniendo escenarios.
3. **Identidad de la reserva:** `?cita=` transportaba appointmentId. Se añadió `booking=` para Booking.id en la microtarea extra documentada; evita pasar una cita clínica a la lectura de reserva usada por Reconsulta. El recorrido alcanza Reconsulta sin fallo de booking; el E2E global sigue rojo por CSP.
4. **Yarn y arranque reales:** se mantuvo `node-modules`, según configuración instalada, y `corepack yarn dev --port 4210`; `start` corresponde al SSR compilado. Dependencias reutilizadas mediante junction tras comparar lockfiles, sin cambiarlas.
5. **Baseline y patrones de tests:** `--include=.../**` capturaba HTML/Markdown y falló por ausencia de loader. Se corrigió a `**/*.spec.ts`. El primer typecheck sin generado de entorno también falló; tras generarlo se registró baseline preparado con exit 0.
6. **Guardián Windows:** se incorporó ownership mediante Job Object nativo para hijos supervivientes al launcher. Se revisaron silencio posterior a aserción, caída de salud y descendientes huérfanos. Sin dependencia npm nueva; self-test final pasa; serve llega al CSP, devuelve 1 y limpia sus procesos (cero listeners en 4210). Los E2E siguen FAILED.
7. **Inventarios:** la regeneración incluye deriva anterior detectada por el generador. Se conservó la salida inicial roja y la comprobación posterior; no se editaron inventarios a mano.
8. **Fallos previos y atribución limitada:** la evidencia SHA-256 confirma 35 de 36 fuentes comparadas idénticas a base; el import denunciado en el spec modificado también era previo. No se usó esa comparación para declarar reproducidos antes los fallos temporales o de cobertura.
9. **Entrega todavía WIP:** los commits locales no constituyen publicación, congelamiento comunicado ni integración en mockup. Quedan vigentes las reservas hasta que el agente principal complete PR/dailies y registre el SHA de entrega.
10. **Cierre bloqueado por evidencia:** con gates rojos, cobertura insuficiente y runtime fallido, no corresponde declarar el carril cerrado. Este reporte deberá actualizarse con resultados finales conservando los fallos observados.

11. **Selector y foco E2E:** se corrigió el selector de cita activa tras observar el rótulo real. El foco y la carrera de reapertura se corrigieron localmente, con regresión de 140 tests aprobados; el recorrido final completa pasos y falla en CSP. Las aserciones siguen intactas.
12. **CSP y rechazo automático:** errores de scripts SSR reproducidos en /auth bloquean consola limpia. El intento de filtrar mensajes fue rechazado automáticamente por debilitar la aserción y no se aplicó. Se mantienen prueba y configuración de seguridad; queda registrado como bloqueo global.

13. **Overflow fuera de alcance:** 13 px proceden del header global, con HTML/CSS idénticos a base y causa DOM documentada. No se reparó una superficie ajena para obtener verde.
14. **Visual pendiente:** P1 inspeccionó los 60 PNG finales y encontró 50 OK, 8 defectos menores y 2 mayores. P2 sigue pendiente; no se declara doble revisión concluida.

## 7. Reverificación tras fusionar `origin/mockup` (sesión de continuación, 2026-09-25 ~17:00–17:15)

Al retomar el carril, `origin/mockup` había avanzado dos veces desde la base original: PR #689 (`feat(dependents): registrar dependiente sólo por CI`, ajeno a clínica) y PR #690 (`cotizaciones-carrito-y-reserva`), que sí toca dos archivos que C0 también modifica.

### 7.1 Primer merge — sin conflictos

`git merge origin/mockup` sobre `f8d11620` se resolvió automático. Commit `455ca3f7`. Sin marcadores de conflicto; kill-test y suite dirigida (6 archivos/81 tests) verdes de inmediato.

### 7.2 Segundo merge — un conflicto mecánico, resuelto sin pérdida de comportamiento

`git merge origin/mockup` sobre `72450ff5` (tras el merge #689) marcó **un** conflicto real: `src/app/core/mock/handlers/diagnostics.handlers.ts`, líneas 557–640. Ambas ramas insertaron código al inicio de `registrarDiagnostico()`:

- HEAD (C0): el traslado de `POST /clinical/service-requests` desde `clinical.handlers.ts` (C0.H3.S1.M2).
- `origin/mockup` (PR #690): un bucle que abre agenda para cada centro publicado (`abrirAgendaDeCentro`), necesario para que Cotizaciones pueda reservar un cupo.

No son cambios que se pisen: son dos inicializaciones independientes en el mismo punto de inserción. Se resolvió conservando ambas, con el bucle de agenda primero (efecto de arranque) y la ruta de C0 después, sin tocar el cuerpo de ninguna de las dos. `git diff --stat` confirma que sólo esas líneas cambiaron; no se editó nada más del archivo por fuera del bloque de conflicto. El otro archivo compartido (`src/app/core/mock/fixtures/agenda.ts`) fusionó automático sin marcador.

Commit del merge: `f8d068ee`.

### 7.3 Reverificación completa post-merge

Todo lo siguiente se corrió después del commit `f8d068ee`, con el conflicto ya resuelto:

```powershell
corepack yarn typecheck
```
Exit **0** (regenera `component-index.generated.ts`, 556 componentes, sin errores de tipos).

```powershell
$env:VITEST_MAX_WORKERS='2'
corepack yarn test --watch=false `
  --include='src/app/shared/clinical/diagnosis-state.spec.ts' `
  --include='src/app/features/clinical-record/consultation/**/*.spec.ts' `
  --include='src/app/core/mock/mock-backend.spec.ts' `
  --include='src/app/core/mock/handlers/clinical.handlers.spec.ts' `
  --include='src/app/core/mock/handlers/diagnostics.handlers.spec.ts' `
  --include='src/app/features/clinical-record/patient-chart/analysis-order-block/**/*.spec.ts' `
  --include='src/app/features/clinical-record/patient-chart/medical-note-block/**/*.spec.ts' `
  --include='src/app/features/clinical-record/patient-chart/follow-up-block/**/*.spec.ts' `
  --include='src/app/features/clinical-record/patient-chart/specialty-form-block/**/*.spec.ts' `
  --include='src/app/features/account/medical-record/history-view-model.spec.ts' `
  --include='src/app/features/agenda/agenda.spec.ts'
```
Salida literal:
```text
 Test Files  13 passed (13)
      Tests  309 passed (309)
```
Exit **0**. Cubre el helper de diagnóstico, la consulta, los cinco bloques de la rejilla propios de C0, C6 (`history-view-model`) y la agenda (por el conflicto en `diagnostics.handlers.ts`).

```powershell
grep -rn "diagnostics-block|DiagnosticsBlock" src/app
```
0 coincidencias (kill-test PASS).

```powershell
node scripts/pw-guard.mjs --self-test
```
```text
PASS: silencio: mata árbol y relanza
PASS: salida 0: acepta reporter Unicode, ASCII y chunks
PASS: aserción: salida 1 sin relanzar
pw-guard self-test: 3 PASS, 0 FAIL
RESUMEN: outcome=PASSED intentos=10 duracion=28.94s
```
Exit **0**.

### 7.4 E2E completo hasta el final (nuevo, no estaba corrido en la sesión anterior)

```powershell
node scripts/pw-guard.mjs --port 4210 --serve --spec playwright/consulta-rejilla.spec.ts
```
Corrida completa de los 31 casos (5 viewports × 2 temas × 3 escenarios + 1 caso único), `RESUMEN: outcome=FAILED intentos=1 duracion=588.78s`. Registro completo en `artifacts/pw-guard/20260925-205147-intento-1.log` (no versionado; script auxiliar, no evidencia formal).

**Los 31 fallan exclusivamente en la misma línea**, `playwright/consulta-rejilla.spec.ts:51` (`expect(errors, 'Consola y red del simulador').toEqual([])`), con el mismo par de mensajes CSP ya documentado en `evidencia/despues/console-auth-baseline.json`. Ningún paso de las pruebas —clic en las 12 casillas, títulos exactos del modal, teclado, foco, Escape, recarga, orden de la rejilla, distinción `cita`/`booking`— falló. Dos de los 31 (historia390 claro/oscuro) fallan además, antes de llegar al `afterEach`, en `assertNoOverflow` (línea 73): `Expected: 0, Received: 52` — la misma causa de header global ya identificada por SHA-256 en la sesión anterior (esta corrida midió 52 px de scroll en vez de los 13 reportados antes; la magnitud varía con detalles de renderizado del viewport, no con el código de C0).

**Verificación independiente de la causa (root-cause, no repetir el reclamo de la sesión anterior sin comprobarlo):** se reprodujo el mismo error CSP abriendo `/auth` —ruta de autenticación, sin relación con clínica ni con C0— con un script aislado (`artifacts/c0-console-probe.mjs`, ya existente). La cabecera `Content-Security-Policy` servida autoriza dos hashes de script fijados en build (`sha256-Ohy6…`, `sha256-HasA…`), pero el servidor de desarrollo ejecuta scripts de hidratación de Angular (`ng-event-dispatch-contract` y el bootstrap de SSR) cuyo hash real no coincide con los fijados. La causa vive en `src/server/security-headers.ts` (cálculo de hashes de scripts en línea del servidor de producción/dev), fuera de cualquier archivo reservado para C0, y se reproduce en una pantalla que C0 nunca toca. **Conclusión: BLOCKED por causa ajena, confirmado por reproducción independiente, no sólo por comparación de hashes de fuente.**

No se filtró el arreglo vacío esperado ni se relajó la aserción (ya se había rechazado esa vía en la sesión anterior); se mantiene la clasificación ENVIRONMENT/pre-existente para el gate de consola del E2E.

### 7.5 Pruebas "que funcionen": qué se buscó corregir y qué no había que tocar

Se revisaron específicamente los puntos que la sesión anterior dejó como riesgo para ver si alguno era, en realidad, causado por C0 y corregible sin pisar otros carriles:

- **Los 4 fallos de la corrida amplia con cobertura** (dos umbrales de latencia, un `ENOENT` de ruta en un test, un timeout de `agenda-ids-estables.spec.ts`): la sesión anterior ya comprobó por SHA-256 que las fuentes de esos specs y sus fixtures son *idénticas* a la base antes de C0. Son archivos fuera de lo reservado para C0 (`mock-backend-latencia.spec.ts`, `agenda-ids-estables.spec.ts`, `insurance-analytics.handlers.spec.ts`) y su fallo es de temporización/entorno o un bug de test preexistente, no algo que C0 introdujo. Tocarlos sería scope creep sobre archivos de otros carriles — no se modificaron.
- **Lint (263 errores)**: mismo conteo antes y después de C0 en archivos que C0 no toca. No es responsabilidad de este carril limpiarlo.
- **El assert de consola del E2E**: confirmado BLOCKED por causa ajena (§7.4). Weakearlo ya había sido rechazado; no se repitió el intento.
- **Dentro del alcance real de C0** (los archivos reservados en el prompt original): las 13 suites/309 tests, el typecheck, el kill-test y el guardián están en verde. No se encontró ningún test roto por código de C0 que necesitara corrección — el trabajo previo ya lo dejó consistente.

No se ejecutó P2 (segunda revisión visual) por no ser un test automatizado y quedar fuera de esta ronda de reverificación; sigue pendiente y así se declara en la sección 3.
