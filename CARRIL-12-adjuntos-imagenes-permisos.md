# Carril 12 · Subida de imágenes/adjuntos a la ficha clínica, con permisos de acceso

**Punto del reclamo:** 12a + 12g (mensaje del 2026-08-14: "subir imágenes" + "permisos y nivel
de acceso a archivo de ficha médica"). Van juntos porque un permiso sin algo que controlar no
tiene sentido — este carril construye las dos mitades del mismo problema. **Repos:** backend +
frontend, los dos. **Rama sugerida:** `carril-12/adjuntos-permisos` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## Lo que ya existe, y por qué no alcanza (evidencia verificada en el código)

Esta vez la sorpresa es al revés de lo habitual: **la base ya está construida**, mucho más de
lo que parecía.

- **Subida de archivos** — `FilesClient.upload()`
  (`src/app/core/data-access/files/files.client.ts:54-75`) ya llama a
  `POST /common/files/upload`, ya distingue `FileCategory: 'DOCUMENT' | 'IMAGE'` y
  `FileSensitivity: 'NORMAL' | 'PHI'`, y ya manda el archivo como `multipart/form-data`. **La
  subida de imágenes no hay que inventarla — ya funciona.** Lo que falta es *dónde se usa*: hoy
  solo aparece en formularios sueltos de `redsat` (maqueta), no en la ficha clínica.
- **Vincular un archivo a un registro** — el backend ya modela esto:
  `redesa-api/src/modules/common/controllers/common-files.controller.ts` expone
  `CreateFileLinkDto`/`FileLinkResponseDto` (además de versión y derivados —
  `file_versions.entity.ts`, `file_derivatives.entity.ts`) y `DownloadUrlResponseDto` para
  descargas controladas. Es decir, el backend ya sabe "este archivo pertenece a este encuentro/
  esta nota" — el frontend no tiene ningún cliente que use ese link.
- **Permisos** — el módulo `authz` (backend) ya tiene `authz-grants.controller.ts`,
  `authz-policies.controller.ts` y un **PDP real** (`authz-pdp.controller.ts` — Policy Decision
  Point), además de `authz-clinical.controller.ts` y `authz-care-relationships.controller.ts`.
  Del lado del frontend, `AuthzClient` (`src/app/core/data-access/authz/authz.client.ts`) hoy
  solo tiene `listCareRelationships()` y `listLegalRepresentations()` — **nada de grants ni de
  PDP**. El backend ya sabe decidir "¿esta persona puede ver este archivo?"; el frontend nunca
  se lo pregunta.

Conclusión: este carril es sobre todo de **integración**, no de construcción desde cero — y por
eso probablemente sea el más rápido de cerrar de los diez, si no aparece una sorpresa al leer
`authz-pdp.controller.ts` de cerca.

## Backend (`mantra-core-health-redesa-api`)

**Primer paso, antes de escribir nada:** leé `authz-pdp.controller.ts` y confirmá si ya expone
un endpoint tipo "¿puede el usuario actual hacer `X` sobre el archivo `Y`?", o si solo evalúa
políticas genéricas sin ese caso de uso todavía. Si el PDP ya sirve la pregunta genérica, no hay
nada que construir del lado del backend para permisos — el trabajo es puramente de frontend.

Si falta algo puntual, la extensión es acotada:

```
src/modules/common/controllers/common-files.controller.ts   (extender, si falta un GET de "archivos vinculados a X", no reescribir)
src/modules/authz/controllers/authz-pdp.controller.ts        (extender, si falta el caso de archivos, no reescribir)
```

**Archivos existentes que tocás:** solo dentro de `src/modules/common/` (subsistema de
archivos) y, si hace falta, `src/modules/authz/`. Ningún otro carril de este plan toca estos dos
módulos.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/shared/components/organisms/attachment-uploader/attachment-uploader.ts  + .html + .css + .spec.ts
src/app/features/clinical-record/patient-chart/attachments-block/attachments-block.ts + .html + .css + .spec.ts
```

- `attachment-uploader`: componente reusable de subida (arrastrar y soltar, elegir
  `category`/`sensitivity`, barra de progreso). Pensalo genérico a propósito — los carriles 1
  (presupuestos), 3 (procedimientos) y 4 (laboratorios) van a querer adjuntar archivos más
  adelante y no deberían tener que reconstruirlo.
- `attachments-block`: **sibling nuevo** dentro de `patient-chart/`, junto a
  `medication-block`/`diagnosis-block` — no los edites. Lista los archivos vinculados al
  encuentro activo, con su estado de sensibilidad visible, y respeta lo que diga el PDP: si el
  usuario actual no puede ver un archivo `PHI`, la pantalla lo dice, no lo esconde en silencio
  (mismo criterio que ya usa la agenda para "no hay" vs. "no podés ver", documentado en
  `COORDINACION-AGENTES.md`, sesión 2026-08-08).

**Archivos existentes que tocás — son tuyos, ningún otro carril los toca:**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/data-access/files/files.client.ts` | métodos `linkFile()`, `listLinkedFiles()`, `getDownloadUrl()` — solo métodos nuevos, no tocás `upload()` |
| `src/app/core/data-access/files/files.client.spec.ts` | specs de los métodos nuevos |
| `src/app/core/data-access/authz/authz.client.ts` | método(s) nuevos para consultar el PDP (`checkAccess()` o el nombre que calce con el endpoint real) — no tocás `listCareRelationships`/`listLegalRepresentations` |
| `src/app/core/data-access/authz/authz.types.ts` | tipos nuevos para la respuesta del PDP |

**Archivos compartidos con otros carriles (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de `attachments-block` + una entrada en el ensamblado de bloques, al final, en tu último commit — **este archivo ya lo tocan los carriles 1, 2, 3 y 5**, coordiná el orden en `COORDINACION-AGENTES.md` |

**Lo que NO tocás:** `medication-block/`, `diagnosis-block/`, `specialty-form-block/` (carril
2), `budget-block/` (carril 1), `procedures-block/` (carril 3), `admission-block/` (carril 5), y
todo `redsat/` (sus formularios de subida son maqueta — no tu punto de partida, aunque se vean
parecidos).

## Definición de hecho

- Se puede adjuntar una imagen a un encuentro clínico y verla después desde la ficha del
  paciente.
- Un archivo marcado `PHI` respeta el resultado del PDP: quien no tiene permiso no lo ve, y la
  pantalla lo dice explícitamente en vez de mostrar una lista vacía sin explicación.
- CRUD completo del lado de adjuntos: subir, listar, descargar (con URL controlada) y eliminar —
  no solo subir.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
