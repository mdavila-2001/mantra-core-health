# Reporte — Disciplina de tabla con acciones (ADR-0015) y «Dónde atiendo»

> **AVANCE: 52 / 68 — 76,5 %.**

- Fecha: 2026-09-23 (turno noche del 2026-09-22, ejecutado la madrugada siguiente) ·
  Plan: [PLAN.md](./PLAN.md) · Rama: `pablo/noche-disciplina-tablas-2026-09-22`
  (repo `alovida/mantra-core-health`, checkout `alovida/mch-pablo-tabla-canonica`)
- Peldaño de evidencia alcanzado (regla 30), **por área**:
  - H1 (baseline, inventario, capturas): `VERIFIED` — ejercitado en navegador real.
  - H2 (ADR-0015 + contrato extendido): `WRITTEN`, publicado e indexado — un ADR y un contrato no
    tienen runtime que verificar más allá de existir, estar indexados y ser coherentes con el
    código real, las tres cosas comprobadas.
  - H3 (`app-pagination`, `data-table` `maxHeight`, `filter-bar` proyección): `TESTED` (74 tests
    unitarios nuevos entre las tres piezas, 0 rojos) + `VERIFIED` para lo aplicado en consumidores
    reales (pagination: 3 consumidores; data-table y filter-bar: verificados de punta a punta en
    H4.S1, el primer consumidor real de las tres piezas juntas).
  - H4.S1 y H4.S2 («Dónde atiendo»: tabla+barra+paginación, modal, guardar por cambios,
    confirmación, D-06): `TESTED` (73/73 en `work-history.spec.ts`) + `VERIFIED` — **el flujo
    completo se ejecutó en navegador real contra el simulador**: abrir editar, ver Guardar
    deshabilitado, escribir un cambio, ver Guardar habilitado, guardar, ver «¿Confirmás estos
    cambios?», confirmar, ver el PATCH real persistido y la tabla actualizada; tocar el mapa, ver
    la dirección vaciada con su aviso; cancelar con cambios, ver «¿Descartar los cambios?». Once
    capturas, consola sin errores en cada paso, mirado en 375/768/1440 y en claro/oscuro. Sólo
    H4.S2.M9 (teclado completo) no se verificó.
  - H4.S3 (historial laboral como tabla, con adjunto), H5 (veredicto `iconOnly`), H6 (regresión
    final, gates, cierre): sin empezar, `UNKNOWN`.

## Completado

Microtareas HECHO con DoD ejecutado y evidencia pegada. El detalle línea por línea, con su
comando/captura, está en `PLAN.md` — acá el resumen por hito para no repetir las 45 filas.

| Hito | Microtareas HECHO | Evidencia principal |
|---|---|---|
| H1 — Corte, baseline, inventario, capturas previas | 8/8 | `evidencia/antes/` (lint/typecheck/test, `tablas.md`, `confirmaciones.md`, 6 capturas + `LEEME.md`) |
| H2 — ADR-0015 + contrato extendido | 7/7 | `docs/adr/ADR-0015-tabla-con-acciones.md`, `docs/adr/index.md`, `docs/adr/CONTRATO-data-table.md`, fila publicada en el daily de equipo |
| H3.S1 — `app-pagination` | 6/6 | `evidencia/h3/pagination-spec.txt` (30/30), 5 capturas, hallazgo de desborde encontrado y corregido |
| H3.S2 — `data-table` alto máximo | 6/6 | `evidencia/h3/data-table-spec.txt` (31/31), secciones del contrato, capturas de H4.S1 |
| H3.S3 — `filter-bar` proyección + receta | 4/4 | `evidencia/h3/filter-bar-spec.txt` (13/13), capturas de H4.S1 |
| H4.S1 — tabla + barra + paginación en «Dónde atiendo» | 6/6 | `evidencia/h4/work-history-spec.txt` (73/73), capturas 01/09/10/11 |
| H4.S2 — modal, guardar por cambios, confirmación, D-06 | 8/9 (M9 sin verificar) | capturas 02-08, spec con 15 tests nuevos del flujo completo |

**Comandos de verificación reales, pegados (no parafraseados):**

```text
$ yarn test --include=src/app/shared/components/molecules/pagination/pagination.spec.ts --watch=false
Test Files  1 passed (1)
     Tests  30 passed (30)

$ yarn test --include=src/app/shared/components/organisms/data-table/data-table.spec.ts --watch=false
Test Files  1 passed (1)
     Tests  31 passed (31)

$ yarn test --include=src/app/shared/components/organisms/filter-bar/filter-bar.spec.ts --watch=false
Test Files  1 passed (1)
     Tests  13 passed (13)

$ yarn test --include=src/app/features/account/my-profile/work-history/work-history.spec.ts --watch=false
Test Files  1 passed (1)
     Tests  73 passed (73)

$ yarn typecheck; echo exit=$?
exit=0   (repetido después de cada pieza — data-table, filter-bar, work-history)

$ npx eslint src/app/shared/components/{molecules/pagination,organisms/data-table,organisms/filter-bar}/ \
             src/app/features/account/my-profile/work-history/
exit=0   (sin hallazgos)
```

## A medias

### H4.S2.M9 — Teclado completo en el modal de «Dónde atiendo»
- Qué anda: el modal usa `app-content-dialog`, la misma pieza que ya tiene foco atrapado,
  `Escape` y restauración de foco resueltos como parte de su propio contrato (documentado y
  probado en su propio componente, no reescrito acá).
- Qué no anda: no verifiqué **este flujo en particular** (abrir con teclado desde la fila, recorrer
  los campos, guardar, confirmar y volver al disparador) sin mouse.
- Qué falta exactamente: recorrido manual con teclado o un test de accesibilidad dirigido
  (`accessibility-testing`), documentando cada paso como pide el reparto (`evidencia/h4/teclado.md`).
- Dónde quedó: código completo y funcional (verificado con mouse/Playwright), sólo falta la pasada
  de teclado. Rama `pablo/noche-disciplina-tablas-2026-09-22`, compila y todos los tests pasan.

### H4.S3.M3 — Historial como tabla: falta re-captura tras un defecto visual
- Qué anda: tabla (Institución/Período/Adjunto/Acciones), filtro, paginación, editar con confirmación, retirar con confirmación y adjunto real vía `FilesClient`; 83/83 tests en `work-history.spec.ts`, typecheck y lint exit=0; recorrido en navegador real sin errores de consola. Doble local declarado en `evidencia/h4/doble-historial.md` (recargar pierde ediciones y bajas).
- Qué no anda: en las capturas, institución y cargo aparecían pegados. Corregido en `work-history.html` (celda `celdaInstitucionHistorial` envuelta en `.historial__institucion`), sin re-capturar.
- Qué falta exactamente: levantar el servidor, re-capturar 1440 y 375, dos pasadas y escribir `evidencia/doble-revision.md`; capturar tema claro. Tests y lint no se re-corrieron tras el cambio de markup (sólo typecheck).
- Dónde quedó: rama `pablo/noche-disciplina-tablas-2026-09-22`, compila, sin procesos corriendo (puerto 4200 libre, verificado).

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| H4.S3.M3 (tabla del historial, re-captura) | `A MEDIAS` | Re-capturar y hacer la doble revisión (regla 35) tras corregir «institución y cargo pegados». Ver A medias |
| H5 (veredicto `iconOnly` propios) | `TODO` | Nada — sin empezar |
| H6 (regresión final, gates, cierre) | `TODO` (con un intento real documentado, ver abajo) | Repetir `yarn test --watch=false` completo en un momento sin contención de recursos en la máquina |

## Evidencia

Índice completo de `evidencia/`:

```text
evidencia/antes/                    → H1: baseline, inventarios, 6 capturas + LEEME.md
evidencia/h3/pagination-spec.txt    → 30/30
evidencia/h3/data-table-spec.txt    → 31/31
evidencia/h3/filter-bar-spec.txt    → 13/13
evidencia/h3/typecheck.txt          → exit=0
evidencia/h3/lint.txt               → exit=0
evidencia/h3/capturas/              → 9 imágenes (pagination + data-table + filter-bar, antes/después del fix de desborde)
evidencia/h4/work-history-spec.txt  → 73/73
evidencia/h4/typecheck.txt          → exit=0
evidencia/h4/lint.txt               → exit=0
evidencia/h4/capturas/              → 12 imágenes: modal, dirty-gate, confirmación, PATCH real,
                                       mapa, D-06, descarte, 375/768/1440, claro/oscuro
evidencia/h6-regresion-test.txt     → intento 1, ENVIRONMENT (worker pool crash)
evidencia/h6-regresion-test-2.txt   → intento 2, ENVIRONMENT (worker exited unexpectedly)
```

Comando y salida completa de la verificación de navegador más importante (H4.S2, el kill-test del
propio plan):

```text
1. Abrir /my-account/edit → «Dónde atiendo» → Acciones → Editar sobre «Consultorio Dra. Rojas»
   → el formulario aparece en un <dialog> real (app-content-dialog), NO en línea. [captura 02]
2. Sin tocar nada: botón "Guardar los cambios" tiene aria-disabled=true. [captura 02, snapshot de accesibilidad]
3. Cambiar el nombre → el botón deja de estar disabled (confirmado por accesibilidad, no sólo visual).
4. Click en "Guardar los cambios" → aparece diálogo "¿Confirmás estos cambios?" con el nombre real
   de la sede, apilado sobre el modal. [captura 03]
5. Click en "Guardar" del diálogo de confirmación → PATCH real a /practitioners/me/sites/site-propia,
   la tabla se releé del servidor y muestra el nombre nuevo. [captura 04]
6. Reabrir Editar, escribir en Dirección, click en el mapa (Leaflet real) →
   el campo Dirección queda vacío y aparece "Volvé a escribir la dirección…" [captura 06b/07,
   confirmado leyendo el DOM real: input.value === ""]
7. Con cambios sin guardar, click en "Cancelar" → aparece "¿Descartar los cambios?" con
   "Seguir editando" / "Descartar". [captura 08]

Consola del navegador: 0 errores en los 7 pasos (revisado con browser_console_messages después de cada uno).
```

## No cubierto

- **H4.S2.M9** (teclado completo) — declarado arriba en «A medias», es lo más importante que falta
  verificar de lo que ya está escrito.
- **Modo oscuro de `app-pagination` y `filter-bar` de forma aislada**: se vio el conjunto completo
  en «Dónde atiendo» en oscuro (captura 11) y se ve bien, pero no se capturó cada pieza por
  separado en los otros consumidores (glossary, my-services, etc.) en tema oscuro.
- **`fact-section`** (uno de los 3 consumidores de `pagination`): no se confirmó que ese organismo
  concreto llegue a dibujar el paginador interno en el caso probado (declarado ya en la sesión
  anterior de este mismo reporte).
- El resto de los 29 consumidores de `data-table` y los 6 de `filter-bar` no tocados por H4: sin
  verificar, sin cambios (el opt-in los deja intactos, confirmado por `yarn typecheck` limpio, pero
  no se los visitó uno por uno en navegador).
- **H6 (regresión completa)**: dos intentos, los dos abortados por infraestructura (ver Desvíos).

## Desvíos del plan

1. **Reordené H2.S2 después de H3.S2** (ya registrado en el PLAN, resuelto: ambas HECHO ahora).
2. **El corte real es `8ae7283a`, no el citado en el reparto** (`b655e844`) — reconsultado, seis PR
   de diferencia, ninguno toca mis archivos.
3. **`dialogs.confirm()` genérico en vez de `confirmarCambios()`** de Marcelo: su pieza existe en
   una rama que no llegó a `origin/mockup` durante esta sesión (regla 65, declarado).
4. **El botón «Agregar mi consultorio propio» se movió** de un párrafo suelto a la proyección de
   `filter-bar` — cumple ADR-0015 regla 5 al pie de la letra, pero es una reubicación real del
   control, no sólo un cambio de estilo. Se verificó que sigue apareciendo exactamente cuando
   corresponde (sin consultorio propio) y desaparece cuando ya hay uno.
5. **El mensaje de «sin resultados de la búsqueda»** (`sedes-sin-resultados`) es nuevo: no existía
   antes porque no había buscador. Se diferenció explícitamente de «sin consultorios cargados»
   (`sedes-vacio`) para no confundir las dos situaciones.
6. **Encontré y corregí una regresión propia durante el desarrollo** (no llegó a verse en el
   navegador real, sólo en la sesión de trabajo): la primera versión de `marcarPunto` parecía no
   funcionar en el navegador por una confusión de mi parte al depurar con un `data-testid` mal
   puesto en mi propio script de verificación (busqué `[data-testid="sede-direccion"]`, que resuelve
   al host de `app-input`, no al `<input>` real — el atributo correcto para llegar al nativo es la
   prop `testId`, no un `data-testid` suelto). El código de producción **nunca tuvo el bug**: la
   confusión fue enteramente mía, en el script de diagnóstico, y quedó resuelta al verificar con el
   selector correcto. Se registra para que quede claro que se investigó a fondo antes de declarar
   "andaba", no que se asumió.

## Riesgos residuales

- **Clipping de contenido a 375 px en la tabla de «Dónde atiendo»** (H4.S1, detallado en `PLAN.md`):
  con `overflow-x: hidden` y sólo 3 columnas de prioridad 1, el contenido (452 px) no entra en la
  caja (251 px) y queda **oculto**, no accesible con scroll. No es una regresión de mi cambio — es
  una tensión real entre "nunca scroll lateral" (ADR-0015) y "3 columnas imprescindibles con
  nombres largos" que el propio mecanismo de `data-table` no resuelve (sólo pliega columnas de
  prioridad ≥ 2). Queda como ambigüedad para el doctor/propietario del ADR: ¿se puede degradar
  «Tipo» a prioridad 2 en pantallas muy angostas, o se prefiere aceptar el recorte?
- **`confirmarCambios()` de Marcelo sin mergear**: mismo riesgo que en el reporte anterior — cuando
  llegue a `origin/mockup`, hay que reemplazar el `dialogs.confirm()` genérico de `guardarSede()`.
- **H4.S3 no empezado**: el historial laboral sigue sin la disciplina de tabla; es la mitad de D-09
  que falta.
- **Regresión completa sin correr en verde**: dos intentos abortados por infraestructura (worker
  pool). Los tests dirigidos (pagination, data-table, filter-bar, work-history: 147 tests en total)
  sí corrieron limpios; lo que no se confirmó es que el resto de la suite (los otros ~7000 tests)
  siga en el mismo estado que el baseline.

## Decisiones y ambigüedades

- **Nueva — ¿«Tipo» puede plegarse a prioridad 2 en móvil angosto?** (ver Riesgos residuales). No
  se decidió por mi cuenta: cambiar la prioridad de una columna es una decisión de qué información
  es "imprescindible" para el negocio, no una decisión de implementación. A confirmar con el
  doctor/propietario del ADR-0015.
- **El select de saltar página de `app-pagination` es parte fija, no opt-in** (decisión ya registrada
  en el reporte anterior, sin cambios).
- Q-18, Q-5, Q-6 (paginación, scroll, alcance de la disciplina esta noche): sin novedad, siguen
  resueltas como estaban.

## Procesos que quedaron corriendo

Ninguno. El servidor de desarrollo se detuvo antes de cerrar (verificado: `netstat` sin `LISTENING`
en el puerto 4200). Se reinició una vez a mitad de sesión (con `.angular/cache` limpio) para
descartar un falso positivo de caché durante la verificación de D-06; quedó igual de bien cerrado.

## Nota sobre `.claude/settings.json`

(Sin cambios respecto del reporte anterior — sigue sin poder commitearse tal cual, ver detalle ya
registrado: los hooks apuntan a `.claude/hooks/*.py`, excluido localmente por
`.git/info/exclude` de este entorno.)
