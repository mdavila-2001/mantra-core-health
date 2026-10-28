# Estado

## Glosario: ficha del término — 2026-10-28

Pedido del cliente con capturas de «Biopsia» (prueba diagnóstica): «está mal, corregirlo sustancialmente». Se
corrigió en la ficha `/glossary/:conceptId`. El «antes» son las capturas del cliente (la captura propia del estado
anterior salió mezclada por la recarga en caliente y se descartó).

| Defecto | Arreglo |
|---|---|
| Relacionados: las enfermedades en una columna de enlaces subrayados al lado de una caja con 1 especialidad y medio bloque vacío | `app-relation-groups` gana el modo `spread` (sólo lo usa la ficha). Con el bloque ≥ 52 rem (consulta de contenedor): la columna de más de 6 vecinos toma el ancho principal y reparte sus vecinos en columnas de 15 rem, y las cortas van en un riel de 16–20 rem a su derecha. Más angosto: se apilan a todo el ancho. Vecinos sin subrayado salvo al pasar/enfocar |
| Artículo: párrafos acotados a 75ch, franja vacía a la derecha | el cuerpo, tope 48 rem, centrado en su columna; justificado sólo desde 48 rem |
| Listas sin viñetas (las quita el reinicio global) | viñetas y referencias numeradas (`<ol>`) |
| Enlaces en azul/violeta del navegador | `--text-link` en toda la tarjeta |
| «Fuente: MedlinePlus en español (NLM)» cuatro veces seguidas bajo «Datos» | `fuentesDeLosDatos` agrupa por nombre: «MedlinePlus en español (NLM) (páginas 1 · 2 · 3 · 4)», cada número con blanco mínimo de 1,5 rem |
| Cabecera: caja de 16 rem con un ícono chico; «Explicado simple» como título de sección | sello cuadrado; rótulo como el de las zonas y el resumen en el cuerpo grande. En el teléfono el sello va arriba y el resumen toma el ancho entero |
| Pestaña activa en forma de cúpula (`--r-full` en una pestaña de un tercio del ancho) | `--r-lg` en `styles/paciente.css` (afecta a todas las pestañas del rediseño) |

**Revisión independiente** (`visual-reviewer`, primera vuelta: CAMBIOS 69/100). Atendido: la corta estirada sola, las
capturas a 1440 con el panel lateral a medio colapsar (el arnés ahora agranda la ventana y espera antes de
capturar), la cabecera a 390, la medida del artículo, los blancos de las páginas, el justificado en el teléfono, los
dos rótulos distintos. No atendido: la columna larga sin contador (la API manda `count: null` cuando la muestra no
es el total; no se inventa), «Grupo temático» repetido y «Fuente:» dentro de la referencia 1 (son datos de la
fuente), la tercera pestaña cortada a 390 (es el desplazamiento con flechas de `app-tabs`, igual en toda la app).

**Verificado en navegador** (Chromium contra `ng serve` con la maqueta, médica, «Biopsia» `01e07c73-…`,
[`playwright/glosario-ficha.mjs`](../../../playwright/glosario-ficha.mjs); capturas en
`evidencias/glosario-ficha-2026-10-28/`): 390 7/7, 768 7/7, 1024 7/7, 1280 8/8, 1440 8/8 (oscuro y claro),
1920 8/8. Sin desborde horizontal ni errores de página. **No se verificó** contra la API real, ni con otros roles,
ni en otros navegadores, ni el mapa (`/glossary/network`) y el comparador, que montan el mismo organismo sin
`spread` y sólo cambian en el subrayado de los vecinos.

**Gates** (2026-10-28, sobre `mockup`): `tsc -p tsconfig.app.json` 0 · `eslint --max-warnings=0` sobre
`features/glossary` y `organisms/relation-groups`: 1 error preexistente (`CARPETA_DE_IMAGENES_PROPIAS` sin usar en
`glossary-article.logic.ts`, igual en `mockup`) · 236 pruebas de las 18 specs del glosario, `relation-groups` y
`tabs` pasan (3 nuevas). No se corrió la suite entera ni los `check-*.mjs`.

---

## Contabilidad: llave Doctor / Contador — 2026-10-26

`/administration/accounting` tiene una sola llave «Versión: Doctor | Contador». **Doctor** (por omisión) muestra el
resumen y tres registros (gastos, activos, deudas) con un glosario de tres palabras. **Contador** suma las pestañas
Transacciones y Cuentas, el glosario completo (Debe, Haber, Transacción, Cuenta) y «Informes contables» con los enlaces
a la vista contable y al balance y libro diario (antes, «Para su contador» al pie del Resumen; ahora también desde
Registros). La elección se recuerda en el navegador (`mantra.contabilidad.version`). Es lo que se ve, no un permiso: la
API sigue siendo la autoridad. Los textos nuevos pasaron por las reglas de `copywriting` y `copy-editing` de
`coreyhaines31/marketingskills` (lenguaje del cliente, una idea por línea, sin muletillas) y por las de `onboarding`
(una acción clara por pantalla, sin callejones sin salida).

**Verificado en navegador** (Chromium contra `ng serve` con la maqueta, 14 verificaciones con
[`playwright/contabilidad-version.mjs`](../../../playwright/contabilidad-version.mjs); capturas en
`evidencias/contabilidad-version-2026-10-26/`): rótulos de pestañas y términos del glosario por versión; la versión
sobrevive a recargar; volver a Doctor desde «Cuentas» cae en «Gastos»; sin desborde horizontal a 390 px (en ese ancho
la llave se cortaba en «Conta…» y se le reservó ancho); claro y oscuro. **No se verificó** contra la API real (la
contabilidad simple sólo existe en la maqueta), ni con otros roles, ni en otros navegadores. Las pantallas
`.../cockpit` y `.../books` no cambian y no llevan la llave.

**Gates** (2026-10-26, sobre `mockup`): `tsc -p tsconfig.app.json` sin errores · `eslint --max-warnings=0` sobre
`src/app/features/accounting` 0 · 92 pruebas de las 7 specs del módulo contable pasan (9 nuevas). No se corrió la
suite entera ni los `check-*.mjs`.

---

## «Servicios recibidos» en la historia — 2026-10-25

La historia del paciente (`/my-account/medical-record`, 6.ª pestaña), la ficha del médico (última pestaña) y el
PDF de «Descargar historia completa» muestran las intervenciones médicas realizadas y las vacunas. Contrato:
[`contracts/received-services.md`](../../contracts/received-services.md).

**Verificado en navegador** (Chromium contra `ng serve`, 22 verificaciones con
[`playwright/servicios-recibidos.mjs`](../../../playwright/servicios-recibidos.mjs); capturas en
`evidencias/servicios-recibidos-2026-10-25/`): una sola tarjeta centrada (holgura 40/40 px) a todo el ancho del
área; las dos intervenciones y las dos vacunas con su costo y «Sin cobro registrado» para el titular; la médica
lee lo mismo **sin importes**; la ficha monta el panel solo al abrir su pestaña; sin desborde horizontal a 390 px;
`?seccion=recetas` sigue abriendo Recetas. **No se verificó** contra la API real (solo el simulador), ni con otros
roles, ni en otros navegadores, ni el PDF descargado visto abierto (sus bloques se prueban por unidad).

**Gates** (2026-10-25, sobre `mockup`): `tsc -p tsconfig.app.json` sin errores nuevos (44, todos en
`component-index.generated.ts` y ya presentes en la base: 45) · `eslint --max-warnings=0` sobre lo tocado 0 · 195
pruebas dirigidas de las 8 specs tocadas pasan. No se corrió la suite entera ni los `check-*.mjs`. Esta rama usa los
nombres en español de su árbol (`conceptos.ts`, `personas.ts`, `historia-con-encuentros.ts`); la lógica es la de
`dev`.

---

**Actualización 2026-10-05:** piloto visual de `/dashboard` ejecutado para personal, administración y paciente. Jerarquía de jornada, accesos, reporte y próxima cita revisada en navegador; el mapa de actividad ya conserva contraste AA en claro/oscuro. Build y typecheck pasan; las 4 pruebas de navegador y la prueba unitaria mensual (29/29) pasan. `yarn lint` global sigue rojo por 256 errores ajenos a este piloto; lint del archivo E2E nuevo pasa.

Recorrido visual de `/schedule` y del menú móvil del encabezado verificado en Chromium con rol médico simulado: día, semana, mes e histórico del 3 de octubre con reservas/estados; grilla del modal con desplazamiento interno y dos columnas en la semana móvil. La vista mensual oscura a 320/390 px ya muestra conteos compactos (`N libres`/`Bloq.`), causas completas en nombres accesibles y sin overflow horizontal del documento. En «Más accesos», «Tutoriales» navegó a `/tutorials`, Escape cerró el menú y devolvió el foco; el documento no desborda a 320/390 px. **Cierre visual dentro del recorrido documentado**, sin afirmar cobertura de otros roles, navegadores o API real. Capturas y límites en `PLAN_PANEL_PRINCIPAL.md`, `EVIDENCIAS.md` y `QA_FINAL.md`.

---

**Última tarea verificada:** rama `justin/refac-ux-todo` · 2026-09-18 (tercera tanda: «todo pasa por el rediseño»).
**Alcance:** las 139 (médica) + 151 (paciente) + 275 (superadmin) combinaciones ruta × ancho del barrido
`playwright/refac-ux-barrido.spec.ts`, en 1440/768/390. Barrido fresco: médica 5/5, paciente 6/6,
superadmin 10/10; lo que queda marcado está justificado en `HALLAZGOS.md` § «Tercera tanda».

## Tercera tanda — qué se corrigió (verificado en navegador)

| Pantalla | Defecto | Arreglo |
|---|---|---|
| Evoluciones | 64 tarjetas, 12 000 px | `app-data-table`, 5 000 px; la fila abre la evolución |
| Encuesta (médico) | asociación a media página; respuestas sin su pregunta | a lo ancho; `<dl>` pregunta → respuesta |
| Nueva cotización | `.cotizacion__grilla` sin `display:grid`; plan apilado | mitades y tercios; 1 columna en 390 |
| Contabilidad | 6 indicadores en 4 columnas (2 huecos) | 3/2/1 columnas |
| Formularios | código largo desbordaba la tarjeta | `overflow-wrap:anywhere` |
| Solicitudes de vínculo | 64 casillas en una columna, 3 500 px | rejilla, 1 250 px |
| `file-input` (átomo) | `image/*` se mostraba «*» | «Imagen · PDF», test nuevo |
| Acceso delegado (sets) | editor de ítems en 1/3 del ancho | fila completa, campos a 2 columnas |
| Terminología | nota de ayuda a media página | caja a lo ancho, texto acotado |
| Agenda | aria-label del seguro sin el texto visible (WCAG 2.5.3) | «Aseguradora: ver la solicitud …, paciente» |

## Gates (2026-09-18)

`lint` 0 · `typecheck` 0 · `build` 0 (22 avisos de presupuesto, igual que la base) ·
`yarn test` 522/524 archivos; los 9 fallos son los preexistentes (work-history 7, instituciones 2).

## Bloqueos

Ninguno. D-05 aprobada y ejecutada.

## Para continuar

1. `git -C mantra-core-health worktree add ../wt-<tuyo> -b justin/<tuyo> origin/mockup`
   (o partir de esta rama si el PR sigue abierto).
2. `corepack yarn install --immutable && corepack yarn start --port <libre>`.
3. Leer `PLAN_SITUADO.md` § «Siguiente»; empezar por **N-07** (lector de pantalla y otros navegadores).
4. Registrar cada incremento aquí, en `EVIDENCIAS.md` y, si decide algo, en `DECISIONES.md`.
