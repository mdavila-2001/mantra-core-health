# Estado

**Última tarea verificada:** rama `infra-f1-web` · 2026-10-30 · **Infraestructura hospitalaria F1 (web)**
(contrato `SALUD/Arquitectura/infraestructura-hospitalaria/CONTRATO-F0-F1.md` §4). Detalle en
`EVIDENCIAS.md` § «Infraestructura F1». Revisión independiente (`visual-reviewer`, `frontend-reviewer`,
`regression-auditor`): **pendiente** — quien implementa no aprueba.

| Pantalla | Qué quedó |
|---|---|
| Consola «Organización médica» | pestañas Infraestructura (árbol N niveles + panel, físico/organizativo) y Establecimiento (regulatorio, habilitaciones, capacidad declarada vs. real); estado M34 una sola vez en la cabecera con requestId; pestaña, sede, espacio y vista en la URL; vacíos con ruta |
| `spaces/:id` | una tarjeta centrada con 5 pestañas; editar, mover, activar/suspender/reactivar/retirar con `confirmWithReason` y lista de bloqueos |
| `spaces/new`, `spaces/:id/edit` | `PaginatedForm` con páginas según el perfil de función |
| `spaces/bulk`, `spaces/import` | alta masiva con vista previa; CSV parseado en el cliente, dry-run, tabla por línea, confirmación |
| `app-tree` (organismo nuevo) | `role=tree`, flechas, Home/End, `*`, type-ahead, tabindex itinerante |

Pendientes declarados: edición de unidades clínicas (sólo cliente y maqueta); prueba contra API real (otra franja).

## Antes (2026-09-18)

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
