# Plan — Paridad estética de la versión móvil (web 390 px + app Flutter) con marca ALOVIDA

- Fecha: 2026-10-21 · Repos afectados: `mantra-core-health` (web Angular, principal),
  `mantra_core_health_mobile` (Flutter) · Predecesor:
  `docs/refactor-profesional/trabajo/ESTADO.md` (tercera tanda, 2026-09-18) y
  `docs/trabajo/2026-10-21-mapa-de-calor-ux`.
- Rama (ambos repos): `claude-marcelo/kind-archimedes-ozh6en`.
- Resultado observable: una persona que abre la web en un teléfono (390 × 844) ve
  **todas** las funcionalidades que tiene en escritorio, con la misma jerarquía,
  sin recortes ni tablas ilegibles, con la marca ALOVIDA presente donde
  corresponde, y puede comparar en una página «antes / después» con capturas
  reales de cada pantalla. La app Flutter arranca con la marca ALOVIDA, muestra
  un armazón móvil (cabecera + navegación inferior) y tiene un mapa que dice qué
  pantalla web corresponde a qué pantalla móvil y en qué orden se portan.
- Kill-test: abrir `/dashboard` o `/schedule` como médica a 390 px y encontrar
  desplazamiento horizontal, un control recortado, una tabla de 6 columnas sin
  alternativa, o una cabecera sin la marca; o abrir la página antes/después y no
  distinguir a simple vista qué cambió.

## Hechos (descubrimiento)

| Hecho | Dónde |
|---|---|
| Catálogo real de rutas: 62 secciones, 110 hijas, 126 portadas | `docs/reports/generated/rutas.json` |
| Barrido automático existente ruta × 1440/768/390 por actor (paciente 47, médica 45, superadmin 90 rutas a 390) | `playwright/refac-ux-barrido.spec.ts` → `docs/refactor-profesional/trabajo/barrido/*.json` |
| Ese barrido mide defectos **mecánicos** (overflow, nombres repetidos, columnas vacías); no juzga estética ni jerarquía | cabecera del spec |
| Corte móvil del sistema: `< 780 px` cajón, `≥ 780` columna fija de 260 px | `docs/design-system/responsive-design.md`, `core/layout/breakpoints.ts` |
| Tema claro/oscuro/sistema por `data-theme` | `docs/design-system/themes.md`, `src/styles/alovida.css` |
| Logo ALOVIDA: `public/alovida/imagenes/alovida-logo{,-blanco}.svg`, favicon `public/alovida_logo.svg`, vector para PDF `shared/utils/pdf-export/alovida-mark.ts` | rutas citadas |
| Logo hoy visible en: barra lateral del armazón, `auth-split`, armazón de la maqueta `features/alovida/shell`. No en: cabecera móvil (el nav se vuelve cajón), 404, `/error`, estados vacíos/error, pantalla de organización, verificación de correo | `grep alovida-logo src/` |
| «La UI sigue diciendo *Mantra Core Health*» hasta que ALOVIDA se confirme como nombre: **no se renombra** (decisión del cliente en la pregunta de encuadre) | `mantra-core-health-model/.../identidad-visual.md` |
| Playwright ya instalado en el repo (`@playwright/test ^1.62`), Chromium preinstalado en `/opt/pw-browsers`; `workers: 1` por el límite de 10 logins/min | `playwright.config.ts` |
| Backend simulado (`mockBackend: true` en `development`) con actores `paciente@alovida.mock`, `medica@alovida.mock`, `superadmin@alovida.mock` | `src/environments/environment.development.ts`, `playwright/support/actores.ts` |
| `node_modules` no existía; `repo.yarnpkg.com` está bloqueado por el proxy, Yarn 4.18 se obtiene con `COREPACK_NPM_REGISTRY=https://registry.npmjs.org` | log en `evidencia/00-entorno/` |
| App Flutter: solo sistema de diseño (`lib/theme`, `lib/shared/{atoms,molecules}`) y una `HomeScreen` vacía; `initialRoute: '/design-system'`; íconos y splash ya configurados | `mantra_core_health_mobile/lib/main.dart` |
| No hay SDK de Flutter en el entorno; el canal de descarga responde 200 → se instala 3.47.7 (Dart 3.13, cubre `sdk: ^3.12.2`) en `/home/user/.flutter-sdk` | `releases_linux.json` |
| Sin emulador ni pantalla: la **captura real** de la app Flutter se obtiene con `flutter build web` servido en local y Chromium a 390 × 844 (es el mismo motor de render de Flutter, no una maqueta) | decisión D-02 |
| Skills de marketing (MIT) clonadas en el scratchpad: 52 skills; las útiles para un portal de salud se copian al repo | `coreyhaines31/marketingskills` |

## Alcance

- IN (web): todas las rutas del catálogo que un actor ve de verdad (paciente,
  médica, superadmin) más las públicas (`/auth/*`, `/error`, 404,
  `/verify/portability`), en 390 × 844, tema claro y oscuro; correcciones de
  CSS/plantilla por **familia** (armazón móvil, tablas, fichas, formularios,
  diálogos, estados, cabeceras de página, movimiento); marca ALOVIDA en las
  superficies razonables **sin renombrar textos**; copias de las skills de
  marketing útiles y el documento de contexto de producto que exigen; textos de
  las superficies de entrada (login, registro, vacíos, errores) revisados con
  `copywriting`/`copy-editing`/`onboarding`/`signup`; página antes/después.
- IN (Flutter): instalar SDK; captura real del estado actual; marca ALOVIDA en
  arranque y cabecera; armazón móvil piloto (cabecera + navegación inferior +
  pantalla de inicio con la jerarquía del panel web, con datos de muestra
  declarados); `MAPA_PARIDAD.md` web → móvil con orden de porte; `flutter
  analyze` y `flutter test` en verde; captura real del después.
- OUT: cambios en la API; cambios de comportamiento (autorización, navegación,
  contratos, persistencia, validación); renombrar «Mantra Core Health» a
  ALOVIDA; portar las funcionalidades de negocio a Flutter (login real,
  agenda, expediente…) — eso es el plan que sale de H5, no este trabajo;
  Tailwind o librerías nuevas; las 10 pruebas rojas preexistentes
  (`work-history` 7, instituciones 2, H-13/H-17); iOS/Android nativos (sin
  toolchain); Cypress.
- Ambigüedades registradas:
  1. «Todas y cada una de las funcionalidades de web» → se toma como *toda
     ruta del catálogo que un actor del backend simulado ve*; las rutas que
     rebotan por rol o exigen un id sin enlace se listan como «no
     alcanzables» en vez de inventarlas. Confirmar con Marcelo.
  2. «Versión mobile» → Marcelo respondió **ambas**: web a 390 px (verificable
     acá) y app Flutter (plan + piloto verificable por build web).
  3. «Logo siempre que se pueda» → Marcelo eligió *todas las superficies
     razonables, sin renombrar*. Se registra en D-01 qué superficies y cuáles
     no (una tabla de datos no lleva logo).
  4. «Copiá todas las skills de marketing» → se copian las útiles para este
     producto (lista en H2.S1) y se deja constancia de por qué se excluyen las
     demás (ads, cold-email, pricing, paywalls, sms…: no hay venta ni
     publicidad en el portal).
  5. Modo oscuro: el gate visual pide ambos temas si existen. Se captura en los
     dos; se corrige lo que esté roto en oscuro **dentro de la misma familia**.

## H0 — Entorno listo para producir evidencia real
**CA:** Dado el contenedor limpio, cuando se corre la aplicación y Playwright,
entonces `ng serve` responde en 4200 con el backend simulado y una captura
390 × 844 de `/auth` existe en disco; y `flutter doctor` reconoce el SDK.
**DoD:** `curl -s -o /dev/null -w '%{http_code}' localhost:4200/auth` → `200` ·
captura `evidencia/00-entorno/auth-390-{light,dark}.png` · `flutter --version` → 3.47.7.
**Estado:** HECHO (evidencia en `evidencia/00-entorno/`)

| ID | Microtarea | CA (binario) | DoD | Estado |
|---|---|---|---|---|
| H0.S1.M1 | `yarn install --immutable` vía registro npm | `node_modules/` existe (766 paquetes) | `corepack yarn install --immutable` → el único fallo es el binario de Cypress (`download.cypress.io` bloqueado; Cypress está OUT) | HECHO |
| H0.S1.M2 | `ng serve` (development, mock) arranca | `/auth` → 200 | `serve.txt`: `HTTP 200 after 128s` | HECHO |
| H0.S1.M3 | Playwright usa el Chromium preinstalado (`PW_CHROMIUM=/opt/pw-browsers/chromium`, el 1234 no se puede bajar) y captura `/auth` a 390 claro y oscuro | PNG existe y se ve el formulario | `humo.txt`: `2 passed (13.2s)` | HECHO |
| H0.S1.M4 | SDK Flutter 3.47.7 instalado y `flutter pub get` del repo móvil | `flutter --version` 3.47.7 | `flutter.txt`: `Flutter 3.47.7 • Dart 3.13.5`; `pub get` → `Changed 4 dependencies!` | HECHO |

## H1 — ANTES: captura real de toda la web a 390 px e inventario de defectos
**CA:** Dado el catálogo de rutas, cuando corre el barrido móvil, entonces hay
una captura 390 × 844 por ruta alcanzable y actor (claro y oscuro), y un
inventario que dice por pantalla qué defecto estético/funcional tiene,
agrupado por familia y con severidad.
**DoD:** `yarn pw playwright/movil-captura.spec.ts` → passed · `ls
evidencia/01-antes/<actor>/*.png | wc -l` = rutas alcanzables del actor ·
`HALLAZGOS_MOVIL.md` con una fila por defecto (ruta, captura, familia, qué se
ve, qué debería verse).
**Estado:** TODO

### H1.S1 — Spec de captura móvil (reusa `refac-ux-barrido`: login real, catálogo, resolución de ids)
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | `playwright/movil-captura.spec.ts`: por actor, por ruta alcanzable, 390 × 844, página completa, claro y oscuro, guarda PNG + `medicion.json` (overflow horizontal, elementos que exceden el viewport, objetivos táctiles < 24 px, texto < 12 px, tablas con > 3 columnas sin alternativa) | corre de punta a punta sin rutas inventadas | `yarn pw playwright/movil-captura.spec.ts` → passed; `medicion.json` por actor | TODO |
| H1.S1.M2 | Rutas públicas (`/auth/*`, `/error`, 404, `/verify/portability/x`, `/design-system`) en el mismo spec sin sesión | capturas existen | ídem | TODO |

### H1.S2 — Inspección y clasificación
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Mirar **cada** captura (no solo medir) y registrar defectos en `HALLAZGOS_MOVIL.md` por familia: F1 armazón móvil (cabecera, cajón, marca, acciones), F2 cabeceras de página y acciones, F3 tablas, F4 fichas/tarjetas con pestañas, F5 formularios, F6 diálogos/hojas, F7 estados S1–S9, F8 tipografía/espaciado/jerarquía, F9 movimiento, F10 marca/logo, F11 tema oscuro | cada ruta tiene veredicto (OK / defecto / no alcanzable) | archivo escrito con conteo = rutas capturadas | TODO |
| H1.S2.M2 | Priorizar: severidad × frecuencia (familias que afectan a ≥ 10 pantallas primero) | tabla ordenada | sección «Orden de ataque» en `HALLAZGOS_MOVIL.md` | TODO |

## H2 — Skills de marketing en el repo y textos de entrada revisados
**CA:** Dado el repo, cuando alguien abre `.claude/skills/marketing/`, entonces
encuentra las skills útiles con su origen y licencia, y un
`docs/marketing/product-marketing.md` que describe producto, audiencia,
posicionamiento y voz **sin inventar datos** (lo que no se sabe queda como
pregunta). Los textos de login, registro, vacíos y errores siguen esa voz.
**DoD:** `ls .claude/skills/marketing` lista las copiadas · `yarn lint`,
`yarn typecheck` verdes · specs de los componentes con texto cambiado en verde.
**Estado:** TODO

### H2.S1 — Copia y contexto
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S1.M1 | Copiar `product-marketing`, `copywriting`, `copy-editing`, `cro`, `signup`, `onboarding`, `marketing-psychology`, `launch`, `aso`, `analytics`, `popups`, `ab-testing` (SKILL.md + referencias) a `.claude/skills/marketing/<skill>/` con `README.md` de origen (URL, commit, fecha, MIT) y la lista de excluidas con motivo | las 12 carpetas existen con su SKILL.md intacto | `diff -r` contra el clon = sin diferencias en SKILL.md | TODO |
| H2.S1.M2 | `docs/marketing/product-marketing.md` según la plantilla de `product-marketing`, con fuentes citadas (`docs/business/*`, identidad visual) y «desconocido» donde no hay fuente | sin datos inventados | revisión de `anti-hallucination-guard` anotada en el archivo | TODO |

### H2.S2 — Textos de las superficies de entrada (móvil primero)
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H2.S2.M1 | Login/registro/recuperación: titular, subtítulo, CTA y microcopy de error con `copywriting` + `signup` (sin cambiar validaciones ni contratos) | textos nuevos en plantilla; mismos `data-testid` | specs de `auth/*` en verde | TODO |
| H2.S2.M2 | Estados vacíos (S3) y de error (S9) del paciente y la médica: próxima acción clara con `onboarding` + `copy-editing` | cada S3 tiene verbo + destino | specs en verde + captura | TODO |

## H3 — Correcciones móviles por familia (web)
**CA:** Dado cada defecto de `HALLAZGOS_MOVIL.md`, cuando se corrige su
familia, entonces la captura «después» de cada ruta afectada no muestra el
defecto y la captura a 1440 no cambia salvo lo previsto.
**DoD:** por familia: `yarn pw playwright/movil-captura.spec.ts --grep <familia>`
verde · specs dirigidos en verde · `yarn lint` + `yarn typecheck` verdes ·
`node scripts/check-css-tokens.mjs` y `check-contrast.mjs` verdes.
**Estado:** TODO

### H3.S1 — F1/F10 Armazón móvil con marca
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S1.M1 | Cabecera móvil (< 780 px) con isotipo ALOVIDA + palabra, botón de menú de 44 px, acciones agrupadas; sin desplazamiento horizontal | captura 390 muestra marca y menú | spec `shell-layout.spec` + captura | TODO |
| H3.S1.M2 | Cajón de navegación: marca arriba, grupos legibles, cierre por Escape y toque fuera, foco atrapado y restaurado | observación en navegador | spec + captura abierto/cerrado | TODO |
| H3.S1.M3 | Marca en: `/error`, 404, `/auth/organization`, `/auth/verify-email`, `/auth/activate`, `/auth/resend-verification`, estado S9 global, pantalla de carga inicial (`index.html`) | cada superficie muestra el isotipo con `alt` correcto o decorativo | capturas + specs | TODO |

### H3.S2 — F3 Tablas en móvil
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S2.M1 | `app-data-table`: modo tarjeta por fila bajo 780 px (etiqueta → valor, acciones visibles) manteniendo `rowLabel` y orden | ninguna tabla > 3 columnas queda ilegible a 390 | `data-table.spec` + capturas de 3 pantallas representativas | TODO |
| H3.S2.M2 | Tablas que no usan `app-data-table` (inventario de H1): mismo tratamiento o `overflow` con indicio y columna fija | listadas y corregidas | capturas | TODO |

### H3.S3 — F4/F5 Fichas y formularios
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S3.M1 | Pestañas (`app-tabs`) desplazables horizontalmente con indicio en móvil, sin recorte del rótulo | observación | spec + captura | TODO |
| H3.S3.M2 | Formularios: una columna, campos a lo ancho, botones de acción fijos abajo (barra pegajosa) con `safe-area`, sin doble envío | observación | specs + capturas | TODO |

### H3.S4 — F6/F7 Diálogos y estados
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S4.M1 | `app-dialog`: hoja inferior en < 780 px, dentro del viewport, foco y Escape intactos | observación | `dialog.spec` + captura | TODO |
| H3.S4.M2 | S2/S3/S9 (`view-state-host`): centrados, con isotipo donde D-01 lo admite, próxima acción visible sin desplazarse | observación | spec + capturas | TODO |

### H3.S5 — F2/F8 Cabeceras de página, jerarquía y tipografía
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S5.M1 | `page-header`: título, migas y acciones apilados sin recorte; acción primaria visible | observación | spec + capturas | TODO |
| H3.S5.M2 | Rejillas de panel/indicadores a 1 columna con el mismo orden de lectura que en escritorio | observación | capturas | TODO |

### H3.S6 — F9/F11 Movimiento y tema oscuro
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H3.S6.M1 | Transiciones del cajón/hoja/pestañas con la escala de `motion.md`, `prefers-reduced-motion` respetado | medición | `check` de reduced-motion en spec | TODO |
| H3.S6.M2 | Defectos de tema oscuro hallados en H1 (contraste, fondos fijos) | `check-contrast.mjs` verde | salida pegada | TODO |

## H4 — DESPUÉS, comparativa y revisión independiente
**CA:** Dado el trabajo de H2–H3, cuando se vuelve a correr la captura, entonces
existe `evidencia/02-despues/` con las mismas rutas, y una página
`ANTES_DESPUES.html` (+ `.md`) con pares lado a lado por pantalla donde el
cambio se nota a simple vista; un revisor independiente emite veredicto.
**DoD:** `yarn pw playwright/movil-captura.spec.ts` verde · `ANTES_DESPUES.html`
abre y muestra N pares · `visual-reviewer` y `regression-auditor` con veredicto
registrado · `yarn lint` · `yarn typecheck` · `yarn build` · `yarn test`
(mismos 9–10 rojos preexistentes y ninguno nuevo) · `check-*.mjs` aplicables.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H4.S1.M1 | Re-captura completa → `evidencia/02-despues/` | mismas rutas que antes | passed + conteo igual | TODO |
| H4.S1.M2 | `scripts/lib/antes-despues.mjs` genera `ANTES_DESPUES.html` con pares, familia y defecto corregido | página abre | `node …` → archivo generado | TODO |
| H4.S1.M3 | Revisión independiente (`visual-reviewer`, `regression-auditor`) | veredicto escrito | archivo en `evidencia/03-revision/` | TODO |
| H4.S1.M4 | Regresión y gates | todo verde salvo rojos preexistentes documentados | salidas en `evidencia/04-gates/` | TODO |

## H5 — App Flutter: marca, armazón piloto y mapa de paridad
**CA:** Dado el repo móvil, cuando se compila para web y se abre a 390 × 844,
entonces se ve la pantalla de arranque con el logo ALOVIDA, un armazón con
cabecera y navegación inferior, y una pantalla de inicio con la jerarquía del
panel web; `MAPA_PARIDAD.md` lista cada funcionalidad web con su pantalla móvil
destino, el patrón de UI y el orden de porte.
**DoD:** `flutter analyze` → 0 issues · `flutter test` → passed ·
`flutter build web` → exit 0 · capturas `evidencia/05-flutter/{antes,despues}/*.png`.
**Estado:** TODO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H5.S1.M1 | Baseline: `flutter analyze`, `flutter test`, `flutter build web`, captura 390 de `/design-system` y `/` (antes) | PNG existen | salidas en `evidencia/05-flutter/antes/` | TODO |
| H5.S1.M2 | Logo ALOVIDA como asset (`assets/marca/alovida-logo{,-blanco}.svg`, con `flutter_svg` justificado o PNG exportado) + widget `MantraMarca` | widget test en verde | `flutter test test/marca_test.dart` | TODO |
| H5.S1.M3 | Armazón `MantraShell`: cabecera con marca, navegación inferior (Inicio, Agenda, Expediente, Mensajes, Yo — del registro de secciones web), `SafeArea`, tema claro/oscuro | widget test de navegación | `flutter test` | TODO |
| H5.S1.M4 | `HomeScreen` con la jerarquía del panel web (saludo, próximas citas, acciones rápidas, indicadores) sobre un `FakePanelRepository` **declarado** (correcto / vacío / error) | tres estados visibles | widget tests por estado | TODO |
| H5.S1.M5 | `docs/MAPA_PARIDAD.md`: funcionalidad web → pantalla móvil → patrón → prioridad → dependencias de API | cubre todas las secciones del catálogo web | conteo = 62 secciones | TODO |
| H5.S1.M6 | Captura después (build web a 390, claro y oscuro) | PNG existen | `evidencia/05-flutter/despues/` | TODO |

## H6 — Reporte, commits y push
| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H6.S1.M1 | `REPORTE.md` (regla 40) con avance calculado, evidencia enlazada, no cubierto | tres secciones + primera línea de avance | archivo | TODO |
| H6.S1.M2 | Commits por familia en ambos repos y `git push -u origin claude-marcelo/kind-archimedes-ozh6en` | ramas remotas al día | `git log origin/...` | TODO |

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Límite de 10 logins/min del backend simulado | barrido lento o 429 | `workers: 1`, una sesión por actor, reutilizar contexto |
| Rutas con parámetro sin enlace en el barrido | quedan sin captura | se listan como «no alcanzables», no se inventan ids |
| `yarn test` tarda ~140 s y tiene 9–10 rojos preexistentes | ruido en la regresión | se compara contra la base documentada en `ESTADO.md` |
| Flutter sin dispositivo | sin captura nativa | build web + Chromium a 390: captura real del motor de Flutter; se declara que no es iOS/Android |
| Cambiar `data-table` toca 21+ pantallas | regresión amplia | modo tarjeta solo bajo 780 px, 1440 se vuelve a capturar y comparar |
| `.claude/skills/marketing` pesa (≈ 16 k líneas) | ruido en el repo | se copian solo las útiles, con README de origen |

## Decisiones
- **D-01 Superficies con logo** (según Marcelo, 2026-10-21): cabecera móvil,
  cajón, todas las pantallas públicas de `/auth/*`, `/error`, 404, pantalla de
  carga, S9 global, PDFs (ya). **Sin logo**: tablas, formularios internos,
  diálogos de confirmación, estados S2/S3 dentro de una tarjeta (ruido).
- **D-02 Captura real de Flutter** por `flutter build web` + Chromium 390 × 844.
- **D-03 Sin renombrar** «Mantra Core Health» → ALOVIDA (identidad visual,
  decisión vigente del cliente).
