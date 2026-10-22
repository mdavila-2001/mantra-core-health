# M6 · Acer Aspire 3 — evidencia H4 (identificador en castellano falla en CI)

Rama `marcelo/test-m6-suite-lint` sobre `origin/test` @ `ec7037f7`.

## Qué se construyó

`scripts/check-english-identifiers.mjs`: mira sólo las líneas **agregadas** del diff contra
`origin/test` (o `CHECK_ENGLISH_BASE`), y dentro de ellas sólo declaraciones
(`const`/`let`/`var`/`function`/`class`/`interface`/`type`/`enum`), `data-testid="..."` y
`path: '...'` de rutas — nunca prosa (comentarios, `it('...')`, mensajes de toast), que sigue
en castellano por regla del proyecto. Marca un identificador si alguna sub-palabra (separada
por camelCase/kebab/snake) es una stopword del castellano (artículos, preposiciones, y un
puñado de sustantivos de dominio muy repetidos) o lleva tilde/eñe. Excepciones declaradas del
manual REDSAT: `firma`, `cifrasTabulares`.

## H4.S1.M1 — Sobre el diff, no sobre el árbol

```
$ node scripts/check-english-identifiers.mjs
check-english-identifiers: OK — sin identificadores nuevos en castellano contra "origin/test".
(exit 0)
```

El árbol de `origin/test` tiene años de identificadores en castellano (`persistir()`,
`claveDe()`, `ahora()` de `cart.store.ts` son un ejemplo real) y el verificador no los reporta,
porque no están en el diff.

## H4.S1.M3 — Con un identificador en castellano a propósito, falla

Se agregó temporalmente `export const nombreDeUsuario = 'x';` a un archivo tocado por este
carril, se commiteó, se corrió el verificador, y se revirtió (`git reset --hard HEAD~1`) antes
de seguir:

```
$ node scripts/check-english-identifiers.mjs
check-english-identifiers: 1 identificador(es) nuevo(s) en castellano.
  src/app/features/organization/pharmacy-inbox/pharmacy-inbox.ts:3 — "nombreDeUsuario" («nombre» es una palabra del castellano)
    export const nombreDeUsuario = 'x';
(exit 1)
```

## H4.S1.M2 — Las excepciones del manual REDSAT siguen pasando

Misma mecánica (commit temporal con `cifrasTabulares` y `firma`, revertido después):

```
$ node scripts/check-english-identifiers.mjs
check-english-identifiers: OK — sin identificadores nuevos en castellano contra "origin/test".
(exit 0)
```

## Wireado a CI

Nuevo paso «Identificadores nuevos en inglés» en `.github/workflows/ci.yml`, con un fetch
acotado del commit base antes (el checkout de arriba es `fetch-depth: 1`, no alcanza para
diffear): usa `github.event.pull_request.base.sha` en un PR o `github.event.before` en un push,
y si ninguno resuelve, el propio script lo dice y sale en 0 (no hay diff que mirar, no
inventa una violación).

## No cubierto

- El verificador es heurístico (lista de stopwords + tildes), no un diccionario completo: un
  identificador en castellano sin ninguna de esas palabras ni tildes no se detecta. Es la
  misma clase de límite que cualquier chequeo basado en texto de este repositorio
  (`check-route-prefixes.mjs`, etc.), documentado a propósito en vez de agregar una dependencia
  de NLP para este alcance.
- No se probó en un PR real de GitHub Actions (harness sin acceso a disparar un workflow desde
  acá); la lógica del fetch de la base se razonó contra la documentación de los eventos
  `pull_request`/`push` de GitHub Actions, no se ejecutó en el runner self-hosted real.

## Peldaño

**REGRESSION_VERIFIED** para H4: las tres salidas (pase limpio, falla con identificador nuevo,
pasan las excepciones) están verificadas con salida literal arriba; el wireado a CI está
escrito y razonado pero no ejercitado contra un runner real (queda declarado, no oculto).
