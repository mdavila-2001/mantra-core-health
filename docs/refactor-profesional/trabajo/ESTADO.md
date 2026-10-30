# Estado

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

## Incremento WEB-F0 — infraestructura de organizaciones (2026-10-30)

Rama `claude/trusting-hawking-q3p12v`. Doce defectos de la auditoría F0; detalle de evidencia en
`EVIDENCIAS.md` § «WEB-F0».

| # | Defecto | Arreglo |
|---|---|---|
| 1-2 | Ficha: sólo `ready`/`error`, «Cargando…» eterno; `button[app-button]` sin importar | `app-view-state-host` (S1-S9), retry de la primitiva |
| 3 | Altas sólo en el vacío; listado sin ir a la ficha | `page-actions` por permiso (`rolesAlcanzan` + `canAdminister`); enlace + `rowNavigable` |
| 4 | Plantilla/sub-org. con `limit 25` sin cursor; uuid de persona | `historialDeCursor`; `GET /iam/users/:id` (o «Nombre no disponible») |
| 5 | «Completá la asignación desde la ficha» imposible | Modal «Asignar sede» (POST + relectura); el alta abre `?tab=plantilla` |
| 6 | Errores tragados (vinculaciones, sedes, búsqueda) y 404 mudo en 5 altas | `ViewState` con reintento; `errorMessageOf` con S6 |
| 7 | `my-organizations` y tutorial sin `?tab=memberships`; diferida muerta; rótulo duplicado | Redirección y tutorial con tab; se quita la diferida; ver D-20 |
| 8 | `eligeSede` contradictorio, JSDoc desplazados, `practiceId` vacío | bloque vs. desplegable separados; `practiceId` de `GET /practices` |
| 9 | `mi-recurso` «sólo la primera página» | **No es defecto**: el endpoint no pagina (verificado en la API); contrato fijado con prueba |
| 10 | Acceso delegado pide UUID de sede/área/espacio | Selectores de `GET /practices` y `/practices/:id/organization` |
| 11 | Guard `SECURITY_ADMIN` en `branches/new`, `memberships/new` | `organizacionAdministrableGuard` (= `assertCanAdminister`) |
| 12 | Mock de recursos sin aislar por tenant (`|| true`) | Filtro real; consultorio propio en su tenant |

**Revisión independiente (`visual-reviewer`, `frontend-reviewer`, `regression-auditor`): pendiente** —
quien implementa no aprueba.

Hallazgos que quedan abiertos (no se tocaron):

- `GET /iam/users` y `/iam/users/:id` exigen `SECURITY_ADMIN`: el OWNER/ADMIN que ahora entra a
  «Sumar a alguien» no puede buscar personas (la pantalla lo dice) y ve «Nombre no disponible» en la
  plantilla. Hace falta un endpoint de la API acotado a la organización.
- Con la maqueta aislada por tenant, «Mis citas» del paciente (`appointments.ts`) pide recursos con
  su tenant de plataforma y no ve agendas — igual que contra la API real. El defecto es de la pantalla.
- Las etiquetas de rol de la plantilla salen «—» en la maqueta: terminología no siembra esos conceptos.

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
