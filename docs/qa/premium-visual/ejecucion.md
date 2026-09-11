# Ejecución — el bucle, con los comandos exactos

Todo esto lo corre **el agente principal, en serie**. Un subagente a la vez y
sólo para revisar (`.claude/rules/20-resource-control.md`).

## 0 · Antes de empezar (una vez por sesión)

```bash
cd mantra-core-health
git branch --show-current          # tiene que ser mockup o una rama derivada
git status --porcelain             # vacío: se empieza desde un árbol limpio
corepack yarn start                # dejalo vivo toda la sesión (puerto 4200)
```

El servidor de desarrollo se levanta **una sola vez**. No se reconstruye por
rebanada: `ng build` con SSR tarda minutos y no aporta nada a un juicio visual.
El stack Docker **no se toca** — esta rama corre con `mockBackend: true`.

## 1 · Rebanadas, no «toda la aplicación»

El barrido del carril 34 son **53 rutas**. Se trabajan de a familias de 6-10,
en este orden (la primera paga el arreglo compartido; las demás lo heredan):

| # | Familia | Rutas |
|---|---|---|
| 1 | Cascarón y cuenta | `/my-account` y sus 7 hijas, `/settings`, `/notification-center` |
| 2 | Agenda y clínica | `/schedule`, `/medical-records`, `/progress-notes`, `/diagnostics`, `/interventions`, `/my-visits` |
| 3 | Directorios y comunidad | `/directories`, `/nearby-places`, `/groups`, `/laboratory-directory`, `/pharmacies-directory`, `/messaging`, `/tutorials` |
| 4 | Servicios y formularios | `/my-services`, `/my-quotations`, `/questionnaires`, `/form-builder`, `/glossary` |
| 5 | Administración A | las 10 primeras de `/administration/*` |
| 6 | Administración B | el resto de `/administration/*`, `/billing`, `/assets-liabilities` |

Una familia se cierra entera —medida, arreglada y vuelta a medir— antes de abrir
la siguiente. Si una familia se estira, se parte; no se abre otra en paralelo.

## 2 · Línea base de la rebanada (rung DISCOVERED)

```bash
scripts/corr-evidencia.sh 34 --antes          # composición: fondo, centrado, ancho, scroll
scripts/premium-visual.sh 34 --antes          # acabado: nombres, globos, foco, target, tipografía, motion
```

Sale `MATRIZ-visual-antes.md`, `MATRIZ-premium-antes.md`,
`premium-hallazgos-antes.json` y las fotos, en
`docs/progress/evidence/lane-34/`. Para una sola ruta:
`scripts/premium-visual.sh 34 --antes --ruta=/schedule`.

**Antes de arreglar nada, leer `premium-hallazgos-antes.json` y descartar lo que
no sea defecto.** Escribiendo esta herramienta aparecieron **cinco** clases de
falso positivo, las cinco tapadas y explicadas en el código:

| Lo que denunciaba | Lo que era | Dónde quedó la tapa |
|---|---|---|
| 11 íconos sin nombre en `/schedule` | enlaces de un grupo del menú **plegado**: `innerText` vacío porque no están pintados | `checkVisibility(...)` en `escanear` |
| «área táctil de 34×19 px» | un enlace de texto en las migas; WCAG 2.2 lo excluye (2.5.8, «Inline») | `enlaceDeTexto` |
| «área táctil de 1×1 px» | el gemelo accesible de un control visible (`.solo-lectores`, `clip: rect(0,0,0,0)`) | `recortadoParaLectores` |
| «texto de 10,5 px» | la insignia de la campana, que el sistema declara así | exclusión de `app-badge, app-chip` |
| «texto de 11 px» en 9 rutas | `--fs-overline`, el escalón más chico de la escala REDSAT | `TIPOGRAFIA_MIN_PX = 11` |

La sexta la vas a encontrar vos: **verificala en el navegador antes de tocar un
componente**, y si es falso positivo, el arreglo va en el auditor, no en la
pantalla. Una compuerta que discute con el sistema de diseño no encuentra
defectos: enseña a ignorar el rojo.

## 3 · Arreglar (rung WRITTEN)

Un componente por vez, con `docs/components/composition-rules.md` §5 y
`contrato-visual.md` al lado. Reusar los organismos que ya existen —`app-card`,
`app-tabs`, `app-data-table`, `app-page-header`, `app-form-section`— antes de
escribir CSS nuevo: la regla `50-frontend.md` §1-3 y el hecho de que ya hay 92
carpetas de componentes.

Prohibido para conseguir que se vea mejor: tocar contratos HTTP, validaciones,
permisos, rutas, `package.json`, lockfiles o tests. Si hace falta, se para y se
pregunta.

## 4 · Volver a medir (rung TESTED)

```bash
scripts/corr-evidencia.sh 34 --ruta=/la-que-tocaste
scripts/premium-visual.sh 34 --ruta=/la-que-tocaste
```

Sin `--antes` las dos **aseveran**: una fila roja hace fallar la corrida. Cuando
la familia entera está en verde, se corre la familia completa sin `--ruta`.

## 5 · Mirar las fotos (rung VERIFIED)

Las compuertas no ven la pantalla. Un agente **distinto del que implementó**
—`corr-revisor-visual`, uno solo a la vez— abre las fotos de `fotos/` y
`fotos/premium/` y dictamina contra `contrato-visual.md` §3 y §4. Devuelve
defectos con pantalla, viewport, artefacto, observación y arreglo pedido; «se ve
feo» no es un hallazgo.

Severidades (de `QUALITY_GATES` del paquete, que en esto acierta): **P0** pérdida
de función o dato · **P1** pantalla rota, control esencial inalcanzable, falta la
evidencia · **P2** defecto visible de calidad · **P3** sugerencia. **Con un P0,
P1 o P2 abierto no se cierra la rebanada.** Un P2 no se baja a P3 para terminar.

## 6 · Regresión y cierre del carril (rung REGRESSION_VERIFIED)

```bash
corepack yarn lint
corepack yarn typecheck
corepack yarn test --watch=false
corepack yarn build
scripts/corr-evidencia.sh 34                  # las 53 rutas, aseverando
scripts/premium-visual.sh 34                  # idem
```

Evidencia y claim:

```bash
python3 .claude/hooks/progress.py --lane 34 --phase "cierre" --state done \
  --qa pass --message "<qué quedó>"
python3 .claude/hooks/claim.py --lane 34 --level REGRESSION_VERIFIED \
  --evidence "docs/progress/evidence/lane-34/REPORT.md"
python3 -S scripts/atlas/fable-proof-check.py --lane 34   # desde la raíz del proyecto
```

El `REPORT.md` dice qué se midió, qué se miró a ojo y qué quedó fuera. Se
escriben también los defectos en `docs/progress/BUGS.md` y las decisiones en
`docs/progress/DECISIONS.md`.

## 7 · Presupuesto y freno

- Una familia por vez; ninguna otra corrida de navegador en paralelo.
- Si una ruta no carga, no se inventa: se anota `SIN CARGAR` y se investiga.
- Si un arreglo pide tocar algo de la lista prohibida (§3), la rebanada se
  declara **BLOCKED** con evidencia y se pregunta. No se cambia el examen.
- Si una compuerta da un rojo que no se puede explicar en el navegador, se
  arregla el auditor y se vuelve a correr la línea base: la matriz vieja deja de
  valer.

## 8 · Lo que este bucle deja escrito

| Artefacto | Dónde |
|---|---|
| Matriz de composición | `docs/progress/evidence/lane-34/MATRIZ-visual.md` |
| Matriz de acabado | `…/MATRIZ-premium.md` |
| Hallazgos accionables | `…/premium-hallazgos.json` |
| Fotos por ruta y viewport | `…/fotos/` y `…/fotos/premium/` |
| Dictamen humano | `…/REPORT.md` |
| Rung alcanzado | `.claude/runtime/lane-34-claim.json` |
