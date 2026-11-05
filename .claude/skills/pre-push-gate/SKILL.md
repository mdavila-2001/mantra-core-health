---
name: pre-push-gate
description: Obligatoria antes de CADA git push, PR o escritura remota en GitHub. Asegura que la rama contiene el dev actual, que el resultado compila y que el cambio se probó de verdad (Playwright en el front, pruebas de integración contra base real en la API). Úsala siempre que vayas a subir algo.
allowed-tools: Read, Grep, Glob, Bash
---

# Pre-push gate

Nace del informe `docs/trabajo/2026-11-05-historial-regresiones/INFORME.md`: en dos
semanas hubo 155 merges con resolución manual y varias regresiones por merges que
pisaron archivos o por PRs probados contra una base vieja. **Nada sale de esta máquina
sin esta puerta.**

## La pregunta que va antes de todo

> **¿Esto sirve a largo plazo? ¿Soluciona el problema a largo plazo? Si no, no sirve.**

Se responde **antes de escribir** la solución y se deja por escrito en cada commit con la
línea `Largo plazo: <respuesta>` (mínimo 25 caracteres; la puerta rechaza «sí», «ok» o vacío).
Responde estas cuatro, con hechos:

1. **¿Ataca la causa o el síntoma?** Nombra la causa. Si no la sabes, el trabajo es
   encontrarla, no parchear.
2. **¿Qué impide que vuelva?** Un test, una regla del hook o del CI, un cambio de proceso.
   «Estaré atento» no impide nada.
3. **¿Lo entiende quien no vio la sesión?** Si la razón vive solo en tu cabeza o en el
   chat, la solución se pierde.
4. **¿Qué deuda deja y quién la paga?** Todo lo que quede sin resolver se nombra con dueño.

**Si la respuesta honesta es «no sirve a largo plazo», NO se sube.** Un parche que solo
tapa el síntoma no es una entrega parcial: es deuda disfrazada de avance. Se le dice a la
persona qué haría falta de fondo y ella decide. Prueba rápida: *si el mismo problema vuelve
en dos semanas y nadie lo ve, la solución no sirvió.*

## Qué impide (lo hace el hook, no la buena voluntad)

El hook `PreToolUse` (`.claude/settings.json` → `scripts/pre-push-gate.mjs hook`) bloquea
`git push`, `gh pr create` y las escrituras remotas del MCP de GitHub
(`create_pull_request`, `push_files`, `create_or_update_file`, `delete_file`) hasta que
exista una prueba válida **para este commit exacto contra el `dev` actual**.

## Flujo obligatorio

0. **Responde la pregunta de largo plazo** (arriba). Cada commit lleva `Largo plazo: ...`.
1. **Pregunta «¿Quién es el responsable?»** y espera la respuesta (CLAUDE.md). Cada commit
   lleva `Responsable: <nombre>`. La puerta rechaza commits sin ninguna de las dos líneas.
2. **Rama nueva desde `dev`.** Nunca reutilices una rama ya mergeada.
   `git fetch origin dev && git checkout -b <rama> origin/dev`.
3. **Un PR, un asunto.** Si tocaste algo ajeno, sácalo a su propio PR.
4. **Trae `dev` antes de probar** (`git merge origin/dev`). En un conflicto, **gana el
   contenido de `dev`** salvo lo que el PR cambia a propósito. Después comprueba que
   `git diff origin/dev --stat` lista **solo tus archivos** y que no hay borrados que no
   hiciste (un merge que elimina archivos se revisa uno por uno).
5. **Escribe la prueba que demuestra el cambio**:
   - **Front:** un spec de `playwright/` que recorra el flujo real
     (`UI → request → response → persistencia → recarga → UI`). Debe fallar sin tu cambio.
     Prohibido `networkidle`, `waitForTimeout`, `skip`, `only`. Un navegador a la vez.
     Si el cambio toca contratos de la API, además un spec contra la API real.
   - **API / backend:** una prueba de integración (`test/**/*.int-spec.ts` o `e2e-spec.ts`)
     contra Postgres real. Los dobles no prueban persistencia.
   - **Otro repo (modelo, móvil, docs):** el equivalente real: `rebuild_stack`/gates del
     modelo, `flutter test` en móvil, `yarn docs:validate` en documentación. Si no hay
     forma de ejercitar el cambio, no se sube: se lo dices a la persona.
6. **Corre la puerta** (todo tu trabajo commiteado, árbol limpio):

   ```bash
   node scripts/pre-push-gate.mjs run --pw playwright/mi-flujo.spec.ts          # front
   node scripts/pre-push-gate.mjs run --int test/integration/mi-caso.int-spec.ts # API
   ```

   Hace, en orden: estado de Git (árbol limpio **sin archivos sin trackear**, `dev`
   contenido en HEAD, el diff no vacío, `Responsable:` y `Largo plazo:`), `generate-env`,
   `typecheck`, `eslint` de lo cambiado, `build`, y la prueba real (levanta `yarn start:demo`, corre Playwright y
   baja el servidor; en la API corre `test:integration`). Deja `.claude/gate/proof.json`.
7. **Mira la evidencia visual** (front): capturas en móvil, tablet y escritorio, claro y
   oscuro (skill `visual-quality-gate`). Un spec en verde sin mirar la pantalla solo
   prueba «verificado funcionalmente».
8. **Sube** con `git push`. Verifican la prueba dos capas: el hook de Claude Code y el
   `pre-push` real de Git (`.githooks/pre-push`, que ve cualquier push sin importar cómo se
   invoque y que `SALTAR_BUILD=1` no apaga). Si `dev` se movió, vuelve al paso 4.
9. **PR a `dev`** con una sección «Evidencia» que pegue el resumen de `proof.json` y diga
   qué NO se probó. Si el cambio va también a `mockup`, su propio PR desde una rama sobre
   `mockup` con cherry-pick.

## Prohibido (cada punto salió de un incidente)

- **`--no-verify`, `SALTAR_BUILD=1`, o editar `proof.json`.** Hacia `dev` no es legítimo.
- **Stubs o archivos locales sin commitear que hagan pasar el build.** Con ellos `dev`
  roto «pasaba» (S9 del informe). La puerta rechaza el árbol con archivos sin trackear.
- **Resolver un conflicto «tomando mi lado»** sin comparar contra `dev` (S1, S2, S7).
- **Subir un commit `wip`** o trabajo «sin verificar» a una rama que va a `dev` (A1).
- **Reutilizar una rama mergeada** (S10).
- **Debilitar un test para que pase.** Si la puerta falla, se arregla el código.

## Si la puerta falla porque `dev` está roto

No lo tapes. Detente, demuestra que el fallo es de `dev` (mismos errores sin tus cambios,
en un worktree limpio de `origin/dev`), y repórtalo a la persona con el archivo y el
error. Ella decide quién lo arregla. **Nunca** empujes saltándote la puerta.

## Si no se puede probar

Sin base de datos, sin navegador o sin forma de ejercitar el cambio: el veredicto es
**BLOQUEADO**, no PASS. Dilo con qué se intentó y qué lo destraba. No hay excepción
automática: solo la persona responsable puede decidir saltarse la puerta, por escrito.

## Límites de esta puerta (para no sobre-afirmar)

Prueba que el resultado del merge **compila y que el flujo probado funciona**. No prueba
que el spec sea bueno, ni que no haya regresiones en otras pantallas, ni sustituye la
revisión humana ni a los revisores independientes (`NO_SELF_APPROVAL`).

Es **un freno, no una cerradura**. Lo que no cubre, dicho sin adornos:

- **`proof.json` es falsificable**: quien puede correr el script puede escribir el archivo.
  Firmarlo con una clave que el mismo usuario lee no arregla nada.
- **`git push --no-verify`** apaga el hook de Git; el hook de Claude Code lo ve en el
  comando, pero no cubre un push hecho fuera de Claude.
- **El hook de Claude Code mira el repositorio de la sesión.** Con `git -C otro push` o
  `cd otro && git push` en una sesión multi-repo verifica el repo equivocado; el `pre-push`
  de Git del repo destino es el que cuenta.
- **Un cambio solo de documentación** no tiene superficie observable: la puerta lo deja
  pasar sin prueba (no corre Playwright). Es decisión consciente, no un olvido.
- **Modelo y móvil**: este script cubre front y API. En el modelo y el móvil rige el paso 5
  a mano; nadie lo hace cumplir aún.

**La cerradura de verdad vive en el servidor** y no la puede poner una skill: CI reactivado
y, en la protección de rama de `dev`, «rama actualizada con `dev`» más el check obligatorio.
Mientras eso no exista, esta puerta reduce el riesgo pero no lo elimina.
