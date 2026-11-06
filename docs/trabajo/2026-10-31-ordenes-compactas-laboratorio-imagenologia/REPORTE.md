> **AVANCE: 7 / 8 — 87,5 %.**

# Reporte — Órdenes compactas de laboratorio e imagenología + marketplace en una tarjeta

- Fecha: 2026-11-06 (trabajo iniciado 2026-10-31) · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-0rqq5g` (rebasada sobre `origin/dev`) · PR #1755 (**ya mergeado** en `dev` el 31/10, con los 3 primeros commits) + PR nuevo para lo posterior (esta rama, rehecha sobre `dev` del 06/11)
- Peldaño de evidencia alcanzado: **H1 y H2 web → `VERIFIED`** (flujo y medición en navegador, claro y oscuro, 390/768/1440, con revisión visual independiente que terminó en «entregable con reservas»). **H3 Flutter → `TESTED`** (analyze + tests, sin emulador).
- Todo el ciclo de órdenes corre **solo contra el simulador** (P52): la API real no publica `/diagnostics/lab/*`.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | El menú del laboratorio queda en Resumen, Órdenes, Precios y Sucursales; las rutas viejas redirigen a Órdenes | `yarn ng test` (navigation, app.routes, diagnostics, laboratory, mock) | PASS |
| H1.S1.M2 | «Órdenes»: una tarjeta con pestañas por estado, conteo, búsqueda, vacío orientador y error con reintento | `laboratory-orders*.spec.ts` | PASS |
| H1.S1.M3 | Acciones Recibir, Marcar como procesada, Subir resultados y Descargar; 409 ante un paso fuera de orden; subir exige orden procesada | `lab-portal.handlers.spec.ts` + Playwright `hito2 · laboratorio` (390 y 1440) | PASS; descarga idéntica byte a byte; estado «Subidos» tras recargar |
| H1.S1.M4 | Evidencia visual en 3 viewports con 3 pasadas independientes (la última sin BLOQUEANTE ni MAYOR) | `evidencia/doble-revision.md` | PASS con reservas |
| H2.S1.M1 | `/my-services`: una tarjeta con pestañas Todos / Activos / Inactivos | specs + `evidencia/recorrido-marketplace.log` | PASS: 1 `app-card`, holguras 0/0 px, 100 % del área, sin desborde, 390/768/1440 |
| H2.S1.M2 | Ficha del laboratorio: una tarjeta con pestañas Estudios / Sedes (y Equipos / Acreditaciones si hay datos) | ídem | PASS: ídem; sin desbordes en la segunda pestaña |
| H2.S1.M3 | Ficha pública de farmacia: una tarjeta con pestañas Medicamentos / Sucursales (la búsqueda de receta vive en Sucursales) | specs + Playwright `chat-marketplace` (12/12) | PASS: ídem; la segunda pestaña ya no desborda ni queda acotada |

Otros gates: `tsc` limpio · `eslint` limpio · Playwright `chat-marketplace` + `hito2-laboratory-insurance` → 16 passed · Flutter `analyze` sin problemas y 215 tests.

## A medias
### H3.S1.M1 — Paridad móvil Flutter
- Qué anda: repo `mantra_core_health_mobile`, misma rama (commit subido). Pantalla «Órdenes» con pestañas por estado y menú de cuatro acciones, `actionsOf` espejo de la web, repositorio abstracto con un doble en memoria probado en tres niveles (regla 65). 29 tests nuevos; suite completa 215 PASS.
- Qué no anda: signup, login y los flujos de laboratorio/farmacia no existen; no hay cliente HTTP (la API no publica el ciclo); «Subir» usa un archivo sintético y «Descargar» solo avisa; sin capturas ni emulador.
- Qué falta exactamente: signup y login con los átomos existentes; `OrdersRepository` HTTP cuando la API lo publique; selector de archivo y descarga reales; verificación visual. SDK: `git clone https://github.com/flutter/flutter.git -b stable --depth 1 /home/user/flutter-sdk/flutter` funciona por el proxy. `flutter pub get/analyze` modifica `analysis_options.yaml` y `pubspec.lock`: revertir con `git checkout --` antes de commitear.
- Dónde quedó: rama `claude/compassionate-franklin-0rqq5g` del repo móvil.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| PR hacia `test` | DESCARTADO | `test` está dada de baja desde el 30/10/2026 (CLAUDE.md): no se le abren PR |
| Signup/login/flujos móviles | TODO | Trabajo de producto en Flutter |
| ¿El laboratorio puede rechazar/cancelar órdenes? | DECISION_REQUIRED | Producto; se mantuvieron las cuatro acciones pedidas |

## Evidencia
```text
yarn ng test (152 archivos: marketplace + laboratorio + navegación + mock + rutas) → 152 passed · 2195 passed (corrida limpia, sin otros procesos)
  └ una corrida anterior del mismo conjunto falló 1 test de otro módulo (core/mock/handlers/diagnostic-coverage.handlers.spec.ts «aceptado: …», esperaba [ECO], recibió 2 conceptos); aislado 13/13 PASS y la repetición limpia pasó: INTERMITENTE, causa raíz sin determinar, no toca archivos de este cambio.
playwright chat-marketplace + hito2-laboratory-insurance → 16 passed (1440 y 390 px)
recorrido-final.log        → Órdenes: descarga iguales=true · tras recargar: Subidos · errores de consola/red: ninguno (390/768/1440)
recorrido-marketplace.log  → tres pantallas × 390/768/1440 (claro) y 390/1440 (oscuro): una app-card, holguras 0/0, ocupa 100 %, desbordes=[]
flutter test → All tests passed (+215) · flutter analyze → No issues found
```
Archivos en `evidencia/`: capturas `01…08-*.png` (Órdenes) y `m1…m3-*.png` (marketplace), `doble-revision.md`, logs, y los guiones `flow3.cjs`, `pw.config.ts` (el de marketplace se describe en el log).

## No cubierto
- Contra la API real: nada (no existe el contrato de órdenes). `carril-22-mis-servicios` y `datos-bolivia-en-pantalla` corren contra la API real y no se ejecutaron.
- Mis servicios: pestañas Activos/Inactivos y su vacío/error en navegador; oscuro 768 y Sedes en oscuro; estados de carga y error en navegador.
- Teclado, foco visible, contraste medido, objetivos táctiles medidos.
- Orden **Rechazada** en pantalla (solo tests) y estado «Subiendo» con progreso (solo test del componente: la maqueta termina la subida al instante).
- Petición/respuesta de red de la maqueta: el simulador responde dentro del navegador.
- `yarn test` completo (4985): solo se corrió lo afectado.

## Desvíos del plan
- La rama salía de `master` (413 commits atrás de `dev`): se rebasó sobre `origin/dev` (force-with-lease sobre mi propio commit de docs).
- **Se borró `features/lab-reception/`** (recepción de muestras, con su `lab-reception.spec.ts` de 568 líneas) por decisión («lo más recomendado»). Justificación (regla 80.5.5): no tiene ruta ni menú desde el 31/10; su flujo es hoy una acción de «Órdenes», probada por `laboratory-orders*.spec.ts`, `lab-portal.handlers.spec.ts` y el Playwright de `hito2`. **No se borró** `laboratory/results/laboratory-results.*`: tras el merge de #1755 otra sesión lo endureció en `dev` (commit `a8da3c2c7`: orden obligatoria, tamaño y tipo validados), así que se respeta su versión; sigue sin ruta ni menú y queda como deuda de limpieza para quien lo decida.
- Se pidió «tres puntos»: se usó `app-row-actions` (ADR-0012), cuyo disparador dice «Acciones» con ícono.
- Dos Playwright dependían de pantallas retiradas y se actualizaron: `hito2-laboratory-insurance` (reescrito al flujo de Órdenes) y `modales-fuera-de-consulta` (se quitó el caso del modal «Recibir muestra»).
- Farmacia: la pestaña «Sucursales y receta» pasó a «Sucursales» tras la revisión independiente (en 390 px la etiqueta larga quedaba cortada); se actualizaron los 3 asertos de rótulo del spec sin debilitar nada.
- `lab-portal.handlers.ts` queda en 1009 líneas (techo congelado 1008); `app.routes.ts` ya superaba su techo en `dev`.

## Riesgos residuales
- Hallazgos de componentes compartidos sin tocar: menú de acciones pegado al borde en 390; pestañas cortadas bajo la flecha; doble borde tarjeta + caja de pestañas; botón «Acciones» ≈40 px; `directory-page` con controles de 40 px y `open-now-pharmacies` con «Ver más» de 32 px.
- Formato de dinero inconsistente dentro del marketplace (Mis servicios muestra «520.00 Bs», las fichas «60,00 Bs»): preexistente, no se tocó.
- Contadores repetidos (cabecera / pestaña / título de sección) en las fichas de laboratorio y farmacia.
- Los listados `/laboratory-directory` y `/pharmacies-directory` no cambiaron: los dibuja `DirectoryPage`, compartido.

## Decisiones y ambigüedades
- «Subidos» = estado final tras Procesada (confirmado). La UI no ofrece cancelar ni rechazar: el pedido listó solo cuatro acciones y se mantuvo («lo más recomendado»). Confirmar con producto si el laboratorio debe poder rechazar.
- Alcance: laboratorio + imagenología (cuenta `DIAGNOSTIC_CENTER`), sin farmacia (confirmado).
- «Mis servicios» usa Todos/Activos/Inactivos (el filtro «Estado» que ya existía); no se inventaron pestañas sin contenido. La ficha de farmacia no tiene «Horarios»: los horarios solo existen dentro de cada sucursal.
- «Horarios y equipos» aparece en la captura del usuario pero no existe en `dev`; no se tocó.
