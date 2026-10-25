# `/glossary/anatomy-atlas` — Atlas anatómico 3D

`src/app/features/glossary/glossary-anatomy-atlas.ts` · `GlossaryAnatomyAtlas` · `app-glossary-anatomy-atlas`
Organismo: `src/app/shared/components/organisms/anatomy-viewer/anatomy-viewer.ts` · `AnatomyViewer` · `app-anatomy-viewer`
Datos: `src/app/core/data-access/anatomy-atlas/anatomy-atlas.client.ts` · `AnatomyAtlasClient`

---

## 1 · Propósito

El cuerpo humano en 3D: tocar una pieza abre su ficha (nombre, definición de
UBERON, identificadores, región, láminas de Netter donde aparece) y resalta las
estructuras con las que la ontología la relaciona. Se busca por nombre en
castellano o inglés, y se elige también desde el teclado.

## 2 · Acceso y permisos

| Aspecto | Valor |
|---|---|
| Guard | `seccionRolesGuard`, los mismos roles que `/glossary` |
| Render | Cliente: bajo SSR la pantalla queda inerte; three.js y el catálogo se piden sólo en el navegador |
| Título | «Mantra Core Health - Atlas anatómico 3D» |
| Entrada | Enlace «Atlas anatómico 3D» en `/glossary` |

## 3 · Estado en la URL

`?sex=female` (vista «Mujer»), `?structure=<UBERON:…|FMA:…>` (ficha abierta) y
`?mesh=<id de malla>` (la pieza tocada, para decir el lado). Una ficha abierta
se comparte con el enlace.

## 4 · Datos

No es un recurso de la API: es contenido de referencia abierto que viaja con el
frontend, en el mismo origen, y se lee igual contra la maqueta y contra la API
real. `AnatomyAtlasClient` baja `public/anatomy-atlas-3d/catalog/parts.json`,
`index.json` y los 32 `structures-NN.json` bajo demanda; el visor baja un GLB
por capa (`public/anatomy-atlas-3d/models/`). Los genera
`scripts/gen-anatomy-ontology-fixture.mjs` desde `data/anatomy-ontology/`.

## 5 · Lo que dice y lo que no

- La vista «Mujer» **no** es un modelo femenino: no existe uno libre. Muestra el
  cuerpo masculino de referencia sin sus genitales y lista las estructuras
  femeninas como fichas sin pieza, con un aviso visible.
- Nombres y definiciones en castellano: traducción automática sin revisión
  humana, rotulada; el original de UBERON va al lado.
- Sin descripción extendida ni imágenes: exigían APIs que no estuvieron
  accesibles. La ficha lo dice.

## 6 · Pruebas

`glossary-anatomy-atlas.spec.ts`, `glossary-anatomy-atlas.logic.spec.ts`,
`anatomy-viewer.spec.ts`, `anatomy-atlas.client.spec.ts` y, con navegador,
`playwright/atlas-anatomico-3d.spec.ts`.
