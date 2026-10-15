# REPORT — Carril 32 · CORR-02

## Veredicto: VERIFIED_FUNCTIONAL_ONLY

Se restauró «Mi consultorio propio» como acceso de Administración para profesionales. La ruta muestra ese nombre, conserva el flujo compartido «Dónde atiendo» para crear y editar lugares, y el perfil sigue ofreciendo la pestaña para administrar los lugares propios. La ficha pública del directorio y «Mis artículos» se conservan.

La línea base `mockup` ya contenía la ruta, la lista compartida y la pestaña del perfil; el acceso no aparecía en el árbol del panel y la ruta se titulaba «Mis organizaciones». El cambio atiende esos dos puntos: recupera el acceso en Administración y adopta el nombre confirmado por el cliente. El panel de organizaciones queda disponible para administradores de organizaciones.

## Rutas

| Ruta | 375 | 768 | 1440 | oscuro | fondo | centrado | ancho | scroll | consola |
|---|---|---|---|---|---|---|---|---|---|
| `/administration/my-practice` · listado | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| `/administration/my-practice` · alta | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| `/my-account/edit` · «Dónde atiendo» | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| `/dashboard` · Administración | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

La línea base conserva sus 16 celdas sin errores. La matriz posterior actualizada el 15/10/2026 registra 16 celdas y cero errores; las 16 fotos posteriores se abrieron y revisaron en esta corrida. En el panel, las fotos muestran la zona Administración abierta: antes aparecen «Organización médica» y «Contabilidad»; después aparece además «Mi consultorio propio».

La revisión visual encontró una carrera de captura en «Dónde atiendo»: la prueba esperaba el contenedor, pero fotografiaba antes de que terminara de cargar la lista. La cuenta simulada `medica` usa el ID de perfil esperado y termina mostrando sus cuatro sedes. El spec ahora espera una sede visible antes de fotografiar; la repetición de la matriz confirma las cuatro filas en los cuatro tamaños/temas de esa ruta.

- [Matriz antes](MATRIZ-visual-antes.md) · [Matriz después](MATRIZ-visual.md)
- [Fotos antes](fotos/antes/) · [Fotos después](fotos/despues/)

## Comandos y salida

- `E2E_BASE_URL=http://127.0.0.1:4213 CORR_USUARIO=medica scripts/corr-evidencia.sh 32 --antes` — PASS, 16 celdas, 0 rojas.
- `corepack yarn start:dev` + `scripts/corr-evidencia.sh 32` — PASS, 16 celdas, 0 rojas; Playwright usó `--workers=1` y el servidor se detuvo al terminar.
- `node scripts/check-route-prefixes.mjs` — PASS, 269 rutas; sin colisiones con los 79 prefijos API.
- `corepack yarn build` — PASS; quedan avisos existentes de CommonJS, prerender y NG8113.
- `corepack yarn test --watch=false --include=access-tree.spec.ts --include=navigation.map.spec.ts --include=work-history.spec.ts` — 176 PASS, 1 FAIL preexistente: `navigation.map.spec.ts` espera una lista de roles excluidos sin `psychological-help`; el mismo fallo está en `mockup`. No se modificó esa expectativa.
- `corepack yarn test --watch=false` — línea base: 10.633 PASS / 74 FAIL / 10.707 total. Rama: 10.632 PASS / 76 FAIL / 10.708 total. Los fallos ocurren en specs ajenos a los archivos cambiados y fluctúan entre corridas; la suite completa no queda verde, por eso no se declara el DoD integral.
- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint playwright/corr-evidencia.spec.ts` — PASS; `git diff --check` — PASS.
- `corepack yarn lint` — FAIL global: 268 errores reportados en el repositorio, fuera de los archivos modificados. No se debilitó ninguna regla ni test.
- `corepack yarn pw playwright/carril-19-route-health.spec.ts --workers=1` — BLOQUEADO antes del barrido: API local no disponible.
- `corepack yarn pw playwright/fable-matriz-roles.spec.ts --workers=1` — BLOQUEADO: el inicio de sesión quedó en `/auth` y venció la espera de navegación.
- `python3 -S scripts/atlas/fable-proof-check.py --lane 32` — NO DISPONIBLE: el script no existe en esta base.

## Revisión de código

Autorrevisión del diff según `.claude/agents/corr-revisor-codigo.md`:

- **Alcance:** PASS. Cambios limitados al nombre/ruta visible, acceso del árbol, specs de navegación y generación de evidencia; decisión documentada en `DECISIONS.md`.
- **Sólo visual:** PASS. No se tocaron modelo, API, `.env` ni `proxy.conf.json`.
- **Criterio:** PASS. La tarjeta del panel y el encabezado dicen «Mi consultorio propio»; se reutiliza la gestión compartida de lugares.
- **Organismos y regla §6:** PASS en las vistas existentes; no se agregó maquetado ni CSS.
- **Tokens y modo oscuro:** PASS; no se añadieron estilos ni tokens, y las fotos oscuras se revisaron.
- **Tests:** PASS en revisión. No se añadieron `skip`/`xit`/`todo`, no se quitaron aserciones; el nuevo spec comprueba rol, nombre, visibilidad y resumen.
- **Convenciones y accesibilidad:** PASS; nombres internos en inglés, textos visibles en castellano y sin controles nuevos.
- **Rutas:** PASS; no se creó ruta nueva y el chequeo de prefijos pasó.
- **Comandos:** PASS con las salidas reales registradas arriba; las compuertas globales y de API quedan explícitamente pendientes.

**Resultado de revisión del diff: APROBADO.** La aprobación cubre los cambios de CORR-32; el veredicto de carril no acredita la suite global ni las rutas que requieren API.

## Bugs encontrados / corregidos

- «Mi consultorio propio» no figuraba entre los accesos disponibles de Administración. Se restauró al árbol para el rol que ya tenía acceso a esa ruta.
- La generación de evidencia tomaba el diálogo de alta durante su transición, el panel antes de encuadrar la zona abierta y «Dónde atiendo» antes de terminar la lectura. Se añadieron esperas sobre el diálogo, el elemento relevante y una sede visible para que las capturas documenten el estado cargado.

## Riesgos residuales

- La suite completa tiene dos fallos más que la corrida de línea base; son de specs no relacionados y sus archivos varían entre corridas. Requiere análisis independiente antes de declarar DoD integral.
- No se verificaron las rutas de salud ni la matriz Fable completa por dependencias locales ausentes/fallidas.
- El chequeo Fable específico no está presente en `mockup`.

## Decisiones

- El propietario confirmó que la tarjeta «Tu organización» a renombrar es el acceso del consultorio; el nombre visible elegido fue «Mi consultorio propio».
- Se conserva el listado de lugares propios y vinculados en la vista; también se conserva la ficha pública del directorio y «Mis artículos».
- El panel de organizaciones sigue siendo la herramienta de administración de una organización; no reemplaza la gestión del consultorio individual.
