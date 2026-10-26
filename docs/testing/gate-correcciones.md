# Gate de cierre de las correcciones 31–40

`scripts/check-correcciones.mjs` decide, carril por carril, si la evidencia
alcanza para declarar cerrada una corrección (carriles 31 a 40). No mide nada
por su cuenta: **juzga evidencia ya producida** y la compara contra el árbol de
git. Sale distinto de 0 si algún carril no pasa.

Reemplaza al `scripts/atlas/fable-proof-check.py` que citaban los planes de los
carriles. Ese archivo no existe en ningún repositorio ni rama (los informes de
`origin/mockup` lo dan por «no disponible», salvo el del carril 36, que lo corrió
en un workspace padre y reporta que falló por falta del claim de cierre y de
`docs/progress/BUGS.md`). Los criterios de esta página salen de lo que esos
planes e informes pedían como cierre; la columna «Fuente» dice de dónde.

## Cómo se corre

```bash
node scripts/check-correcciones.mjs                  # los diez carriles
node scripts/check-correcciones.mjs --carril 34      # uno, o varios: --carril 31,32
node scripts/check-correcciones.mjs --json           # lo mismo, para otra herramienta
node scripts/check-correcciones.mjs criterios        # los criterios con su fuente
node --test scripts/lib/correcciones-gate.test.mjs   # pruebas del propio gate
```

| Código | Significado |
|---|---|
| `0` | todos los carriles evaluados `PASA` |
| `1` | al menos un carril `FALLA` |
| `2` | ningún carril falla, pero alguno es `NO EVALUABLE` |
| `64` | uso incorrecto (carril desconocido, argumentos) |

## Veredictos

Cada criterio está `OK`, `FALLA` o `FALTA`. El veredicto del carril es el peor:

| Veredicto | Cuándo | Qué significa |
|---|---|---|
| `PASA` | todos los criterios en `OK` | el carril puede declararse cerrado |
| `FALLA` | algún criterio contradicho por la evidencia | hay una celda roja, una medición anterior al código, un hash que no coincide, una regresión roja, una revisión rechazada… |
| `NO EVALUABLE` | nada contradicho, pero algo no se puede comprobar | no hay captura, no hay registro de la suite, el backend era simulado… **Nunca se redondea a `PASA`.** |

`FALLA` gana a `NO EVALUABLE`. Un código `137` o una señal en un comando
registrado es `FALTA` (memoria agotada, hay que repetir), no un fallo del código.

## Dónde vive la evidencia

Por defecto en `artifacts/evidencia/correcciones/` (ignorada por git, como el
resto de las capturas); `--evidencia <dir>` o `CORR_EVIDENCIA_DIR` la cambian.

```text
lane-NN/MATRIZ-visual.md       matriz de la fase «después»
lane-NN/MANIFIESTO.json        una entrada por celda + commit medido + build servido + hash de fotos
lane-NN/MATRIZ-premium.md      acabado (carril 34): premium-hallazgos.json, PREMIUM-MANIFIESTO.json
lane-NN/fotos/despues/*.png
lane-NN/registros/<nombre>.json   registros propios del carril (opcional)
lane-NN/REVISION.json          revisión independiente
registros/<nombre>.json        registros del árbol entero (typecheck, build, suite…)
```

El carril 34 mide tres actores y guarda los dos últimos en subcarpetas:
`lane-34/`, `lane-34/paciente/`, `lane-34/administrador/`.

### Producir la medición visual

```bash
corepack yarn start:demo                      # o un build de demo servido estático
scripts/corr-evidencia.sh 35                  # CORR_USUARIO=paciente|administrador para el 34
```

`playwright/corr-evidencia.spec.ts` escribe la matriz y el manifiesto. El
manifiesto lleva el commit del árbol medido, los archivos versionados con cambios
sin confirmar y el commit del build que servía el puerto (el sello que la maqueta
guarda en `sessionStorage`).

### Registrar una regresión

```bash
node scripts/check-correcciones.mjs registrar typecheck -- /tmp/heavy.sh corepack yarn typecheck
node scripts/check-correcciones.mjs registrar specs-dirigidos --carril 35 -- corepack yarn test --watch=false --include='src/app/features/notifications/**/*.spec.ts'
node scripts/check-correcciones.mjs registrar suite-base -- …     # la misma suite sobre la base
node scripts/check-correcciones.mjs registrar mutacion --carril 38 --backend real -- corepack yarn pw playwright/…
```

`registrar` ejecuta el comando, deja pasar su salida y su código de salida, y
guarda `comando`, `exit`, el commit, los archivos sin confirmar, la fecha y el
resumen que logra leer de Vitest o Playwright. Los registros sin `--carril` valen
para todos los carriles; uno con `--carril` prevalece sobre el global.

### Registrar la revisión

```bash
node scripts/check-correcciones.mjs revisar 35 --revisor "Ana" --veredicto APROBADO --desde <rev-previa-al-carril> [--abiertos P3]
```

`--desde` es el origen del rango en el que se buscan los implementadores.

## Criterios

Las rutas de «Fuente» son `origin/mockup:docs/progress/evidence/lane-NN/REPORT.md`
(`REPORT`), `…/MATRIZ-visual.md` (`MATRIZ`) y
`origin/mockup:docs/trabajo/2026-10-13-corr-31-borrar-consulta-medica/PLAN.md`
(`PLAN-31`) o `…-corr-33-mis-organizaciones/PLAN.md` (`PLAN-33`), con línea.
`mockup` conserva esos documentos; `dev` no.

| Id | Exige | Fuente |
|---|---|---|
| `evidencia.presente` | existe `MATRIZ-visual.md` del carril | `CLAUDE.md` (`NO_EVIDENCE_NO_DONE`); `PLAN-31` L19 |
| `evidencia.fase` | la matriz es de la fase «después» y del carril pedido; el manifiesto es legible y coincide | Playbook §46-48; `REPORT` 31 L21 |
| `arnes.soporta` | el spec entiende todo lo que `corr-rutas.json` declara para el carril (`esperado`, `fixture`, `accion`, `destino`) | hallazgo de la sincronización dev↔mockup |
| `inventario.vigente` | (carril 34) `corr-rutas.json` es el que sale hoy del mapa de navegación: `node scripts/corr-rutas.mjs --check` | `REPORT` 34 L14-19 |
| `cobertura.celdas` | están todas las celdas ruta × {375, 768, 1440 claro; 1440 oscuro}; la cabecera cuenta lo que hay; la matriz coincide fila por fila con el manifiesto | `REPORT` 34 L45-48 |
| `cobertura.tema-oscuro` | cada ruta tiene su celda en oscuro | `REPORT` 34 L45; `REPORT` 35 L17 |
| `medicion.verde` | ninguna celda con `FAIL` o `SIN CARGAR` en fondo, centrado, ancho o scroll; «en rojo: N» es el recuento real | `MATRIZ` 31 L3; `composition-rules.md` §5 |
| `medicion.consola` | consola limpia: columna, sección «## Errores» y manifiesto | Playbook §1.4; `REPORT` 33 L44 |
| `fotos.integras` | cada foto existe, pesa al menos `fotoMinBytes` (salvo rutas retiradas a propósito) y su SHA-256 es el del manifiesto | `corr-evidencia.spec.ts` (`FOTO_MIN_BYTES`) |
| `frescura.commit` | el último commit del código del carril (ver abajo) es ancestro del commit medido; sin cambios sin confirmar en ese alcance | Playbook §46-48; `REPORT` 34 L71-73 |
| `build.servido` | el build que servía el puerto es el árbol medido | `core/mock/mock-store.ts` (sello `buildInfo.commit`) |
| `acabado.premium` | (carril 34) `MATRIZ-premium.md` y `premium-hallazgos.json` de `scripts/premium-visual.sh` sin celdas rojas ni hallazgos, y frescos | `docs/qa/premium-visual/ejecucion.md` §6 |
| `regresion.typecheck` | registro `typecheck` con exit 0, fresco | `PLAN-31` L19 |
| `regresion.lint-dirigido` | registro `lint-dirigido` con exit 0, fresco | `PLAN-33` L18; `REPORT` 33 L15 |
| `regresion.specs-dirigidos` | registro con exit 0, sin pruebas rojas y con **al menos una** corrida | `PLAN-31` L19; `REPORT` 39 L38 |
| `regresion.build` | registro `build` con exit 0, fresco | `REPORT` 33 L41 |
| `regresion.suite` | registro `suite` sin más pruebas rojas ni archivos rojos nuevos que `suite-base`, y `suite-base` ancestro de la suite | `PLAN-31` L37; `REPORT` 35 L50 |
| `regresion.route-health` | registro con exit 0, sin pruebas fallidas ni sin correr, y al menos una pasada | `PLAN-31` L37; `REPORT` 36 L42 |
| `mutacion.cadena` | (carriles que escriben datos: 33, 38, 39) registro `mutacion` contra backend **real**: UI → request → response → persistencia → recarga → UI | `CLAUDE.md`; Playbook §41 |
| `revision.independiente` | `REVISION.json` en `APROBADO`, sobre el código de hoy, sin P0/P1/P2 abiertos (`--abiertos`), y el revisor no figura entre los autores de commits del alcance desde `--desde` | `CLAUDE.md` (`NO_SELF_APPROVAL`); `docs/qa/premium-visual/ejecucion.md` §5; `REPORT` 38 L68, L79 |
| `coherencia.entre-carriles` | dos carriles no exigen reglas opuestas sobre la misma pantalla | `REPORT` 34 L74-76; `REPORT` 36 L16, L76 |

### Qué invalida una medición: el alcance del carril

La medición es fresca si el último commit que toca el **alcance** del
carril es ancestro del commit medido. El alcance es la unión de lo común (estilos
globales, `index.html`, rutas, navegación, componentes compartidos) y los
directorios propios del carril, sin `*.spec.ts`, `*.test.*`, `*.generated.ts` ni el
índice de componentes: lo que no cambia lo que se ve no invalida. Está en
`scripts/lib/correcciones-carriles.json`; una prueba comprueba que cada ruta del
alcance coincide con archivos versionados.

Una **medición visual** suma al alcance el arnés (`corr-evidencia.spec.ts`,
`corr-rutas.json`, `support/simulador.ts`): si cambia lo que se mide, las fotos
viejas dejan de valer. Un registro de regresión (typecheck, suite…) usa el alcance
sin el arnés. Una medición sin commit (evidencia
heredada de antes del manifiesto) sólo puede **refutarse** por fecha: si es
anterior al último cambio de código, `FALLA`; si no, queda `FALTA`, porque la
fecha no basta para afirmar que describe el código actual.

### Coherencia entre carriles

El arnés aplica a todos los carriles la regla «fondo blanco en claro, superficie
oscura conservada en oscuro», salvo que el spec fuerce lo contrario para uno
(`const exigeFondoBlanco = LANE === '36' || tema === 'claro'`). El gate compara
esas reglas, y las que muestra la evidencia, por pantalla (sin query). Si dos
carriles piden cosas opuestas sobre la misma pantalla, los dos `FALLAN` hasta que
exista una decisión. La decisión se registra en el campo `decisiones` de
`correcciones-carriles.json` (`ruta`, `tema`, `regla`: `white` o `dark`, `fuente`);
con ella, sólo falla el carril que la contradice.

## Qué no hace

- No lanza navegadores ni compila: juzga lo que otros comandos produjeron.
- No impide fabricar un registro a mano. Lo que impide es cerrar sin él, y detecta
  los desajustes que una fabricación descuidada deja: commit inexistente, commit
  anterior al código, hash de foto distinto, fila de la matriz que no coincide con
  el manifiesto, recuento que no cierra, revisor que es autor.
- No juzga calidad visual (la puntuación de `visual-quality-gate`) ni accesibilidad:
  la regla que mide es la del propietario del 2026-09-10 (fondo, centrado, ancho,
  scroll) más consola.
- Sin API real, `mutacion.cadena` y `regresion.route-health` no pueden pasar: el
  techo de la evidencia con la maqueta es «probado», no «verificado».
