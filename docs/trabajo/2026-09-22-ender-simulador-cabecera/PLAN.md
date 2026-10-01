# Plan — Simulador que responde a tiempo, agendas para todos, Chats y Tutoriales en la cabecera

- Fecha: 2026-09-22 · Repos afectados: `alovida/mantra-core-health` (frontend) · Predecesor: `Refactor-CatalogoEInventario` (21/09, queda `A MEDIAS`, declarado en su propio reporte)
- Resultado observable: el doctor y el paciente ven agendas para los 13 médicos registrados, el simulador
  responde con una latencia decidida (sin azar bajo E2E), y la cabecera tiene Chats y Tutoriales como
  íconos con globo, fuera del menú lateral.
- Kill-test: entrar como `paciente@alovida.mock`, abrir `/directory`, elegir uno de los 13 registrados y
  tocar «Revisar disponibilidad» → si dice «No tiene turnos disponibles», R-03 no está hecho.

> **Este `PLAN.md` es el artefacto en disco que exige la regla 20.** El detalle de las tres capas
> (hitos → subtareas → microtareas, cada una con CA y DoD) **vive en el carril**, que es la estructura
> propia del reparto de esta casa (ver `.claude/rules/20-plan-obligatorio.md` §"Si el trabajo es un
> carril con estructura propia" y la skill `lane-authoring`). No se duplica acá para no tener dos fuentes
> de verdad que puedan divergir.
>
> **Carril completo (fuente de las 48 microtareas, CA y DoD):**
> `../../../../../AlovidaPromptManager/repartos/2026-09-22/PromptNoche/Ender/Noche-SimuladorYCabecera.MockNavegacion/LatenciaAgendasParaTodosYChatsYTutorialesEnLaCabecera.md`
> (repo hermano `AlovidaPromptManager`, ruta relativa desde este archivo)
>
> **Daily de cierre:**
> `../../../../../AlovidaPromptManager/repartos/2026-09-22/PromptNoche/Ender/Ender-Daily-Noche-2026-09-22.md`

## Alcance

- IN: baseline y `stock:generate` idéntico · medición de latencia y de agendas · tabla de latencia por
  prefijo, determinismo bajo E2E, spec del interceptor · recursos, plantillas y cupos para los 13
  registrados · escenarios de flujo completo en el README del mock · enlaces-ícono de Tutoriales y Chats
  en la cabecera con globo y nombre accesible, contador de no leídos, `fueraDelMenuPara` para ambos roles ·
  renglón «Cotizaciones» del paciente y redirect de «Mis puntos» **a pedido** (regla 65 si no llegan) ·
  spec de navegación actualizado con motivo · veredicto de los 3 `iconOnly` · specs · capturas por rol,
  viewport y tema · este `PLAN.md`, el `REPORTE.md` y `evidencia/`.
- OUT: cualquier archivo fuera de los reservados de la ficha (§0 del carril) · la ficha del médico y sus
  peticiones (Justin) · `directory.handlers.ts` (Justin) · `profiles.handlers.ts` (Itzan) · bajar la
  latencia a cero · sembrar médicos con nombres inventados nuevos · agregar íconos al set «de paso» ·
  debilitar `navigation.service.spec.ts` · `mantra-core-health-api/**`.
- Ambigüedades registradas: las 7 de la tabla §5 del carril (Q-10, Q-14, Q-17, Q-E1 a Q-E4) — supuesto
  tomado y a quién confirmar, ahí mismo. No se resuelven acá por conveniencia.

## Corte

- `TARGET_REF` declarado en la ficha: `origin/mockup` @ `b655e8449abd662d6b24156fd6e2b06aeb120cc1`
  (2026-09-22T18:04-04).
- **Reconsultado ahora** (regla 00 §1.1 — no se asume, se verifica): `origin/mockup` había avanzado a
  `05d83cb8a29463033066ccfbdfc5b4b3f113535d` (incluye trabajo de Justin sobre cotizaciones del paciente,
  de Itzan sobre registros, y un merge de un carril previo de Ender sobre catálogo). **Corte real de
  trabajo: `05d83cb8`.** Antes de ejecutar H4.S2 (Cotizaciones/Mis puntos) se verifica contra código si
  Justin ya resolvió N-02, en vez de asumir que sigue pendiente.
- Rama: `ender/simulador-cabecera-2026-09-22`, creada desde `origin/mockup` @ `05d83cb8`.

## Baseline (H1.S1) — rojos previos clasificados

| Comando | Exit code | Rojos previos | Clase (regla 80.4) | Evidencia |
|---|---|---|---|---|
| `yarn lint` | 0 | ninguno | — | `evidencia/antes/lint.txt` |
| `yarn typecheck` | 0 | ninguno | — | `evidencia/antes/typecheck.txt` |
| `yarn test --watch=false` | 1 | 2 tests en rojo en `shell-layout.spec.ts` (fuera de mi cambio, ya en el corte) + 543 errores de worker (`EPIPE`/"Worker exited unexpectedly") | Tests: `TEST_BUG` — Justin agregó la ruta `/my-account/cotizaciones` (legítima, ya en `origin/mockup`) y el test que fija la lista cerrada del menú (`shell-layout.spec.ts:147` y `:449`) no se actualizó. Se corrige **con motivo** en H4.S2.M3, sin debilitar el requisito. Workers: `ENVIRONMENT` — pool de vitest (`forks`) crashea con `EPIPE`/"Worker exited unexpectedly" en este entorno; no toca ningún archivo mío ni cambia con mi código; documentado, no se toca | `evidencia/antes/test.txt` |

**Regla:** cualquier corrida posterior de `yarn test --watch=false` se compara contra estos 2 rojos y esta
clase de error de entorno. Un rojo **nuevo** distinto de estos dos detiene el avance (regla 80.1 §8).

`yarn stock:generate` ×2 (`evidencia/antes/stock-1.txt`, `stock-2.txt`): primer intento con `exit=1`
(`ENVIRONMENT`: `Cannot find module '...corepack\dist\yarn.js'` + error de `cygheap` de `sed` en Git Bash
sobre Windows — no toca código del repo, no reproducible en la segunda corrida). Reintentado dos veces
consecutivas: `exit=0` ambas, diff de `component-index.generated.ts` vacío (`evidencia/antes/stock-diff.txt`,
0 líneas). **H1.S1.M5: HECHO.**

## H1 — Corte, baseline, `stock:generate` idéntico y medición

**CA:** Dado el entorno, cuando se pregunta contra qué versión se trabajó, si el arranque de los otros
cuatro está a salvo, cuánto tarda hoy el simulador y cuántos médicos tienen agenda, entonces hay SHA, un
diff vacío y dos tablas medidas.
**DoD:** salidas en `evidencia/antes/`; `evidencia/antes/latencia.md` y `evidencia/antes/agendas.txt`.
**Estado:** A MEDIAS (casi completo — falta sólo el conteo en vivo de H1.S2.M3 y 2 de las 4 capturas de H1.S2.M4).

- Qué anda: H1.S1 completo (5 microtareas `HECHO`). H1.S2.M1 `HECHO` completo: tabla leída del
  interceptor **y** observada con medición real — `npx ng test --include=.../latencia-observada.spec.ts`
  PASS, `evidencia/antes/latencia.md` (9 de 10 peticiones entre 135.5 y 319.9 ms, consistente con el
  `120 + random(180)` del código; el valor descartado es el costo único de carga perezosa del router).
  Se descubrió y quedó documentado que la Red del navegador **no puede** medir esto — el interceptor
  nunca llama a `next(request)` para rutas simuladas, así que no hay `XMLHttpRequest`/`fetch` real que
  Chrome DevTools Protocol vea; se corrigió el método, no sólo se reintentó. H1.S2.M2 `HECHO` con
  medición real: 791 en el directorio, 14 con recurso, 14 con cupos ±14 días, 13 registrados con 0
  agenda (12 con especialidad mapeada, 1 sin ninguna — persona real proveniente de la planilla — REDACTADA;
  ese es el caso límite real de H3.S1.M3). H1.S2.M4: 3 de 4 capturas — directorio
  del paciente (escritorio) y la ficha de un registrado sin agenda (escritorio y móvil, **miradas**:
  confirman el estado «Todavía no publicó horarios» y, de paso, que Tutoriales/Chats/Cotizaciones siguen
  en el menú lateral — evidencia «antes» real para H4).
- **Actualización:** H1.S2.M3 pasa a `HECHO` — medido en vivo con un contador temporal en el interceptor
  (`window.__mockRequestLog`, retirado después): 6 peticiones reales para Valeria Rojas Mendoza (2 sedes),
  confirmando la fórmula leída del código. `evidencia/h2/elegir-medico-en-vivo.md`.
- Qué no anda (histórico, ya resuelto): H1.S2.M3 (conteo en vivo del flujo «elegir médico») sigue sin un N medido.
  Se leyó el código real (`practitioner-detail.ts:139-165`, `practitioner-availability.ts:230-256`): el
  perfil dispara 1 petición de perfil + 1 de etiquetas de terminología + 1 de foto (si tiene), y la
  disponibilidad dispara 1 petición de recursos más 1–2 `listSlots` **por cada sede** del profesional (el
  «próximo hueco» sólo si la semana sale vacía) — la forma exacta ya no es una suposición, pero el total
  real depende de cuántas sedes tenga el médico elegido y no se contó en vivo. Falta 1 captura con
  `medica@alovida.mock` (escritorio o móvil).
- Qué falta exactamente: un conteo en vivo de H1.S2.M3 (instrumentar el interceptor con un contador
  durante un render real de `PractitionerDetail`+`PractitionerAvailability`, o esperar el número de
  Justin) y una captura con `medica@alovida.mock`. Ninguna de las dos bloquea H2–H4, que ya tienen lo que
  necesitan.
- Dónde quedó: `evidencia/antes/{latencia.md,agendas.txt,red-flujo-reserva.md,latencia-observada-raw.txt,capturas/}`.
  Archivos nuevos en el repo de producto: `src/app/core/mock/fixtures/agendas-cobertura.spec.ts` y
  `src/app/core/mock/latencia-observada.spec.ts` (specs de sólo lectura, sin tocar producto todavía).

## H2 — Latencia decidida por ruta (R-02)

**CA:** Dado el simulador, cuando responde, la espera es una tabla por prefijo con valores justificados,
sin azar bajo E2E, y «elegir médico» baja de lo medido.
**DoD:** spec del interceptor de tres niveles; medición «después».
**Estado:** A MEDIAS.

- Qué anda: H2.S1.M1-M3 `HECHO`. La tabla por prefijo reemplazó el azar
  (`mock-backend.interceptor.ts:250-284`): `/terminology` y `/scheduling/slots` en 40ms (el mínimo
  elegido, Q-E1, con motivo escrito), `/profiles` en 90ms, subida sin cambios en 600ms, resto en 120ms.
  `git grep -c Math.random -- mock-backend.interceptor.ts` → 0 (sin salida, exit 1). Spec de tres niveles
  y de determinismo en verde: `npx ng test --include=src/app/core/mock/mock-backend-latencia.spec.ts
  --watch=false` → 5/5 PASS. Regresión del router completa sigue verde:
  `npx ng test --include=src/app/core/mock/mock-backend.spec.ts --watch=false` → 21/21 PASS. H2.S2.M1
  `HECHO` como decisión documentada (no como código): Q-E2 ya venía resuelta en la ficha — no compartir
  `GET` idénticas en vuelo, para no esconder dobles disparos del cliente; se mantiene esa decisión, sin
  cambio de código.
- Qué no anda: H2.S1.M4 (medición «después» del flujo «elegir médico» comparada con un «antes») no se
  puede cerrar todavía — el «antes» de H1.S2.M3 quedó en `DISCOVERED` (forma del fan-out verificada
  contra el código), no en una medición en vivo con un N real, así que no hay con qué comparar el
  «después». H2.S1.M5 (publicar la tabla a Justin) va en el daily de cierre, no acá.
- Qué falta exactamente: el mismo N en vivo que falta en H1.S2.M3. H2.S2.M2 queda `DESCARTADO`: la
  decisión de H2.S2.M1 fue no implementar el compartido de `GET` en vuelo, así que no hay código nuevo
  que necesite su propio spec.
- Dónde quedó: `src/app/core/mock/mock-backend.interceptor.ts` (editado),
  `src/app/core/mock/mock-backend-latencia.spec.ts` (nuevo).

## H3 — Agendas para todos, y escenarios documentados (R-03)

**CA:** Dado cualquier médico del directorio, cuando el paciente lo elige, tiene cupos en las próximas dos
semanas; el README describe al menos dos flujos completos.
**DoD:** conteo N/N; `mock-backend.spec` en verde; README; barrido.
**Estado:** A MEDIAS.

- Qué anda: H3.S1.M1-M4 `HECHO`. `recursos` (`agenda.ts:103-150`) ahora incluye a los registrados con
  especialidad; plantillas y cupos ±21 días salen gratis del bucle genérico que ya existía (no hubo que
  tocarlos). Después: `conRecurso` pasó de 14 a **26** (14 + 12 registrados), medido con
  `agendas-cobertura.spec.ts` (`evidencia/h3/agendas-despues.txt`). Sede determinista por índice entre
  las 3 existentes (Q-E3), documentada en el código. Casos límite con evidencia real:
  `agenda-casos-limite.spec.ts` → 3/3 PASS (el sin-especialidad sigue sin recurso; los 12 restantes sí;
  la sede es siempre una de las tres reales). `mock-backend.spec.ts` → 21/21 PASS, sin rojos nuevos.
  H3.S2.M3 `HECHO`: sección «Escenarios de flujo completo» en `core/mock/README.md`, 2 escenarios (A con
  la médica, B con un registrado), `grep -c Escenario` → 3.
- Qué no anda: H3.S1.M5 (captura del directorio con cupos para un registrado) y H3.S2.M1/M2/M4
  (recorrer los dos escenarios de verdad en el navegador, con capturas por paso, y el barrido de
  Playwright) siguen sin hacerse — quedan para la sesión de navegador que junta esto con lo que falta de
  H1 y H4.
- Qué falta exactamente: una sesión de `ng serve` + Playwright que cubra en un solo pase: captura de
  cupos de un registrado (H3.S1.M5), los dos escenarios completos con capturas por paso (H3.S2.M1-M2), y
  el barrido `mockup-barrido.spec.ts` (H3.S2.M4).
- Dónde quedó: `src/app/core/mock/fixtures/agenda.ts` (editado), `agenda-casos-limite.spec.ts` (nuevo),
  `core/mock/README.md` (editado).

## H4 — Cabecera y menú (N-01, y N-02/N-03 a pedido)

**CA:** Dado el doctor o el paciente, cuando mira la cabecera, ve Tutoriales y Chats como íconos con globo
y nombre accesible, fuera del menú lateral; los renglones que Justin e Itzan pidieron existen o están
simulados contra su contrato (regla 65).
**DoD:** `navigation.service.spec.ts` actualizado con motivo; specs del shell; capturas.
**Estado:** A MEDIAS.

- Qué anda: H4.S1.M1-M4 y M6 `HECHO`. Cabecera: `<a>` con `appTooltip` + `aria-label`, calcados de
  «Ajustes», con `<app-nav-icon>` (reuso, no SVG nuevo) para Tutoriales y Chats
  (`shell-layout.html`/`.ts`). Contador de no leídos: `ChatStore.sinLeer()` inyectado (ya vivía en `core/`,
  no se duplicó ni se encendió un sondeo nuevo — decisión documentada en el código, Q-E4). `fueraDelMenuPara:
  [ANY_ROLE]` en `tutorials` y `messaging` (`navigation.map.ts`). `navigation.service.spec.ts` **y**
  `shell-layout.spec.ts` actualizados con motivo (los 2 rojos del baseline de H1 más los que mi propio cambio
  introdujo): `npx ng test --include=.../navigation.service.spec.ts --include=.../shell-layout.spec.ts
  --watch=false` → 85/85 PASS. H4.S2 `HECHO`: N-02 (Cotizaciones del paciente) ya estaba implementado por
  Justin — verificado contra código, no recreado (regla 00). N-03/Q-17 (Mis puntos): renglón retirado,
  `/my-account/loyalty` redirige a `/my-account` (`SECCIONES_REDIRIGIDAS` en `app.routes.ts`, regla 65 —
  la pestaña de Itzan no llegó, contrato simulado y declarado). Al implementarlo apareció y se corrigió un
  error real de Angular (`NG04014`: `redirectTo` y `canActivate` no pueden combinarse) — ver
  `app.routes.spec.ts`, 48/48 PASS tras el arreglo.
- Qué no anda: H4.S1.M5 (orden de tabulación y `scrollWidth` a 375px, medidos en vivo) y las 12 capturas
  de H4.S1.M7 (×2 roles ×3 viewports ×2 temas) no se hicieron todavía.
- Qué falta exactamente: la misma sesión de navegador consolidada que falta para H1/H3 — orden de
  tabulación con teclado real, medición de desborde a 375px, y las capturas por rol/viewport/tema.
- Dónde quedó: `shell-layout.html/.ts`, `navigation.map.ts`, `navigation.service.spec.ts`,
  `shell-layout.spec.ts`, `app.routes.ts`, `app.routes.spec.ts`, `styles/alovida.css` (editados).

## H5 — D-05 en la cabecera

**CA:** Dados los 3 `iconOnly` de `header.html` y `shell-layout.html`, tienen texto o la excepción escrita
con `aria-label` y `appTooltip`, incluido el interruptor de tema.
**DoD:** veredictos aplicados; captura; spec.
**Estado:** A MEDIAS.

- Qué anda: H5.S1.M1-M2 `HECHO`. Los 3 `iconOnly` del grep tienen veredicto (`evidencia/h5/iconos.md`):
  `app-back-link` ya cumplía sin cambios; el botón de menú/hamburguesa queda como excepción documentada;
  el interruptor de tema de la galería recibió `appTooltip`. Se sumó el cuarto caso real, el interruptor
  del armazón real (`shell-layout.html`, con la directiva `[app-theme-toggle]`), que no aparecía en el
  grep por no usar la prop `iconOnly`: también recibió `appTooltip`. `npx ng test
  --include=.../header.spec.ts --include=.../shell-layout.spec.ts --watch=false` → 66/66 PASS.
- Qué no anda: H5.S1.M3 (spec o captura dedicada al veredicto en sí) — el veredicto quedó documentado en
  `evidencia/h5/iconos.md` con la verificación de los specs existentes, pero no hay una captura específica
  mostrando el globo en pantalla.
- Qué falta exactamente: una captura del globo del tema visible al pasar el mouse, dentro de la misma
  sesión de navegador pendiente.
- Dónde quedó: `shell-layout.html`, `organisms/header/{header.ts,header.html}` (editados),
  `evidencia/h5/iconos.md` (nuevo).

## H6 — Regresión y cierre

**CA:** Dado el cierre, quien no vio el turno sabe qué quedó demostrado, qué a medias y qué no se cubrió;
`yarn start` arranca.
**DoD:** baseline repetido y comparado; `yarn start` limpio; `REPORTE.md`.
**Estado:** TODO — microtareas H6.S1, H6.S2 en el carril.

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `origin/mockup` avanzó respecto del corte declarado en la ficha | Trabajo duplicado o conflicto con Justin/Itzan | Verificar contra código antes de cada hito, no contra el texto de la ficha |
| `stock:generate` corre antes de `start`/`build` | Rompe el arranque de los otros cuatro | Verificación de diff vacío en H1 y de nuevo en H6 |
| `navigation.service.spec.ts` fija la lista del menú por nombre | Tentación de debilitar el test | Se cambia con motivo (regla 80.5.4), nunca se borra una aserción |
| Pedidos de Justin/Itzan (N-02, N-03, medición de «elegir médico») pueden no llegar a tiempo | Bloqueo de coordinación | Regla 65: aislar el contrato y simular en los tres niveles, cerrar igual |
