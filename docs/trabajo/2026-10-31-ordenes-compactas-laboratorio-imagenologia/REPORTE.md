> **AVANCE: 4 / 8 — 50,0 %.**

# Reporte — Órdenes compactas de laboratorio e imagenología

- Fecha: 2026-10-31 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/compassionate-franklin-0rqq5g` (rebasada sobre `origin/dev`)
- Peldaño de evidencia alcanzado: **web, H1 → `VERIFIED` funcional** (flujo observado en navegador con persistencia tras recarga); **visual → `VERIFIED_FUNCTIONAL_ONLY`** hasta que el juego final de capturas pase la segunda revisión independiente. H2 y H3: `UNKNOWN`.
- Solo contra el **simulador** (P52): la API real no publica `/diagnostics/lab/*`, así que el ciclo de órdenes no existe en el backend.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | El menú del laboratorio queda en Resumen, Órdenes, Precios y Sucursales; recepción, cola y resultados redirigen a Órdenes | `yarn ng test` (navigation, app.routes, diagnostics, lab-reception, laboratory, mock) | PASS, 141 archivos / 2026 tests |
| H1.S1.M2 | «Órdenes»: una tarjeta con pestañas por estado (Todas, Borrador, Recibidas, Procesadas, Subidos, Canceladas y rechazadas), conteo, búsqueda, vacío orientador y error con reintento | `laboratory-orders.spec.ts`, `laboratory-orders.logic.spec.ts` | PASS (24 tests) |
| H1.S1.M3 | Acciones Recibir, Marcar como procesada, Subir resultados y Descargar; un paso fuera de orden responde 409; subir exige orden procesada | `lab-portal.handlers.spec.ts` + Playwright «laboratorio: portal…» | PASS; en navegador 390 y 1440: Borrador → Recibida → Procesada → Subidos, descarga byte a byte igual, estado «Subidos» tras recargar (`evidencia/recorrido-final.log`) |

| H1.S1.M4 | Evidencia visual en 3 viewports; 3 pasadas independientes, la última sin BLOQUEANTE ni MAYOR («entregable con reservas») | `evidencia/doble-revision.md` | PASS con reservas |

Otros gates: `tsc -p tsconfig.app.json --noEmit` limpio · `eslint` limpio sobre lo tocado · `tsc -p playwright/tsconfig.json` limpio · `check-architecture` sin el ciclo nuevo.

## A medias

### H2.S1.M1 / M2 / M3 — Marketplace de servicios con una tarjeta y pestañas
- Qué anda: código de las tres pantallas escrito por tres agentes en paralelo con archivos disjuntos. `tsc` y `eslint` limpios. Specs en verde: `yarn ng test` sobre my-services, laboratory-directory, public-directories, laboratory, navigation y shared → **147 archivos / 2245 tests PASS** (tras corregir un tipo en `laboratory-detail.spec.ts`: `detail: unknown` → `object`).
- Qué no anda / no se probó: ningún navegador, ninguna captura, ninguna medición de centrado (§5: holguras ≤2 px, bloque ≥85 %), ningún tema oscuro, ningún Playwright (`carril-22-mis-servicios`, `chat-marketplace`, `mockup-barrido` apuntan a estas pantallas).
- Qué falta exactamente:
  1. Levantar `yarn ng serve --configuration development,demo` (NO `ng serve` a secas: apunta a la API real) y capturar en 390/768/1440, claro y oscuro: `/my-services`, `/laboratory-directory/<id>`, `/pharmacies-directory/farmacia-vida` (ver `flow3.cjs` en esta carpeta de evidencia como guion; ojo: usar viewport alto y NO `fullPage` en 1440, que dispara la animación de la barra lateral).
  2. Correr los Playwright citados arriba con Chromium del entorno (`/opt/pw-browsers/chromium`, config temporal que sobrescribe `launchOptions.executablePath`).
  3. Doble revisión independiente (agente distinto) de esas capturas; corregir y recapturar.
  4. Medir centrado según `docs/components/composition-rules.md` §5.
- Decisiones de los agentes que conviene confirmar: «Mis servicios» usa Todos/Activos/Inactivos (el filtro «Estado» que ya existía) y no «Condiciones/Altas» (no hay lista que mostrar); la ficha del laboratorio muestra pestañas Equipos/Sedes/Acreditaciones solo si hay datos; la ficha de farmacia tiene Medicamentos y Sucursales y receta, sin pestaña «Horarios» (los horarios solo existen dentro de cada sucursal). El **listado** `/laboratory-directory` y `/pharmacies-directory` no cambió: lo dibuja `DirectoryPage`, componente compartido.
- Hallazgos para quien sea dueño de lo compartido: `directory-page` (`.mercado__orden select` y `.directorio__vista` miden 40 px, el comentario dice 44); `open-now-pharmacies` («Ver más» en `size="sm"` = 32 px); `laboratory-directory.ts` carga `directory-map.css` que la plantilla ya no usa.
- Dónde quedó: rama `claude/compassionate-franklin-0rqq5g`, compila, specs verdes.

### H3.S1.M1 — Paridad móvil Flutter
- Qué anda: repo `mantra_core_health_mobile` (misma rama). Pantalla «Órdenes» con pestañas por estado y menú de cuatro acciones, `actionsOf` espejo de la web, repositorio abstracto con doble en memoria probado en tres niveles (regla 65). `flutter analyze`: sin problemas; `flutter test`: 215 PASS (29 nuevos). SDK: `git clone https://github.com/flutter/flutter.git -b stable --depth 1 /home/user/flutter-sdk/flutter` funciona por el proxy; `export PATH=/home/user/flutter-sdk/flutter/bin:$PATH`.
- Qué no anda: signup, login y flujos de laboratorio/farmacia no existen; no hay cliente HTTP contra la API real (que además no publica el ciclo de órdenes, P52); «Subir» usa un archivo sintético y «Descargar» solo avisa; sin capturas ni emulador.
- Qué falta exactamente: construir signup/login con los átomos existentes; `OrdersRepository` HTTP cuando la API lo publique; selector de archivo y descarga reales; verificación visual.
- Dónde quedó: commit en la rama del repo móvil; **cuidado**: `flutter pub get/analyze` modifica `analysis_options.yaml` y `pubspec.lock`; revertir con `git checkout --` antes de commitear.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| Dos PRs (`dev` y `test`) | `dev` abierto como borrador; `test`: ver descripción del PR | Que alguien cierre H2 (capturas + revisión) y lo pase a «listo» |
| Signup/login/flujos móviles | TODO | Trabajo de producto en Flutter (ver H3) |
| Decisión: ¿el laboratorio puede rechazar/cancelar órdenes? | DECISION_REQUIRED | Usuario/producto; hoy la UI ofrece solo las cuatro acciones pedidas |
| Borrar `LabReception` / `LaboratoryResults` (sin ruta) | Decisión | Usuario |

## Evidencia
```text
yarn ng test (141 archivos, H1)  → Tests 2026 passed
yarn ng test (147 archivos, H1+H2) → Test Files 147 passed · Tests 2245 passed
flutter test → All tests passed (+215) · flutter analyze → No issues found
playwright hito2 · laboratorio → 2 passed (1440 y 390 px)
recorrido-final.log → descarga … iguales=true · tras recargar: Subidos · errores de consola/red: ninguno (390/768/1440)
```
Archivos en `evidencia/`: `01…08-*.png`, `doble-revision.md`, `recorrido-final.log` y dos logs de tandas previas (`recorrido-1.log`, `recorrido-2-flujo.log`, superados).

## No cubierto
- Petición/respuesta de red: el simulador responde dentro del navegador, así que no hay tráfico HTTP que mostrar; lo observado es la UI, el estado persistido en `sessionStorage` y la descarga.
- Contra la API real: nada (no existe el contrato).
- Teclado, foco visible, contraste medido, estados de carga y de error en navegador, tema oscuro en 768.
- Orden **Rechazada** en pantalla (solo tests) y estado «Subiendo» con progreso (solo test del componente).
- `yarn test` completo (4985 pruebas): se corrió solo lo afectado.

## Desvíos del plan
- La rama salía de `master` (413 commits atrás de `dev`): se rebasó sobre `origin/dev`.
- Se pidió «tres puntos»: se usó `app-row-actions` (ADR-0012), cuyo disparador dice «Acciones» con ícono.
- `lab-portal.handlers.ts` está congelado en 1008 líneas: las órdenes se movieron a `lab-orders.handlers.ts`; aun así el original quedó en **1009** (+1 sobre el techo). `app.routes.ts` (2486) ya superaba su techo de 2273 en `dev`.
- Se actualizaron dos Playwright que dependían de pantallas retiradas: `hito2-laboratory-insurance` (reescrito al flujo de Órdenes) y `modales-fuera-de-consulta` (se quitó el caso del modal «Recibir muestra», que ya no existe).

## Riesgos residuales
- `LabReception` y `LaboratoryResults` quedan en el repo sin ruta (código muerto con sus tests); `ResultUploadQueue` y `picked-files` se reusan. Borrarlos es una decisión aparte.
- `Pedida` en prioridad 1 hace la tabla más justa en tablet.
- Hallazgos de componentes compartidos sin tocar (menú pegado al borde en 390, pestañas cortadas, botón «Acciones» de ≈40 px).
- El servidor `ng serve` que levanté fue detenido; no queda ningún proceso en segundo plano.

## Decisiones y ambigüedades
- «Subidos» se tomó como estado final tras Procesada (confirmado por el usuario); Cancelada y Rechazada salen de una orden recibida/borrador (cancelar) o recibida (rechazar). La UI **no ofrece** cancelar ni rechazar: el pedido listó solo cuatro acciones. Confirmar con el usuario si el laboratorio debe poder rechazar.
- Alcance: laboratorio + imagenología (cuenta `DIAGNOSTIC_CENTER`), sin farmacia (confirmado).
- «Horarios y equipos» aparece en la captura del usuario pero no existe en `dev`; no se tocó.
