# CARRIL 13 y 16 — front · organización médica y laboratorio médico

Informe del carril en `mantra-core-health`, según
`alovida_carriles_CORREGIDO_fullspec_2026-08-15/lanes/13_MEDICAL_ORGANIZATION.md`
y `16_MEDICAL_LAB_ORG.md`.

- **Branch:** `fix/alovida-c13-c16-org-lab`
- **Base:** `origin/dev` en `42599eb`
- **Backend que consume:** rama `fix/alovida-c13-medical_organization` de
  `mantra-core-health-api`

> **Por qué este carril trabajó en un worktree aparte.** Al empezar, el árbol
> principal de `mantra-core-health` tenía cambios sin commitear de **otro
> carril** en curso (navegación/RBAC, dashboard, side-nav, `ci.yml`). Editar
> `navigation.map.ts` y `app.routes.ts` ahí habría mezclado los dos carriles en
> un mismo commit, que es justo lo que el protocolo prohíbe. Se creó
> `git worktree ../mch-c13-c16` sobre `origin/dev` limpio. Los dos carriles tocan
> regiones distintas de esos dos archivos, así que el merge a `dev` es limpio.

---

## 1. Qué se agregó

Dos secciones nuevas en **Administración**, ambas encendidas —no `planificada`—
porque el backend de este mismo carril les dio la lectura que les faltaba.

| Sección | Ruta | Roles | Módulo |
|---|---|---|---|
| Organización médica | `administration/medical-organization` | `SECURITY_ADMIN`, `PERIOP_ADMIN`, `PRACTITIONER` | M14 `practice` |
| Laboratorio médico | `administration/medical-laboratory` | `SECURITY_ADMIN` | M23 `diagnostic_units` |

### Organización médica (C13)

Siete pestañas sobre una sola lectura (`GET /practices/:id/organization`):
**Sedes · Áreas · Infraestructura · Servicios · Plantilla · Legajo ·
Inventario**.

- La **práctica es el ámbito de la pantalla, no un filtro**: va arriba una sola
  vez y no se repite como columna en ninguna tabla. El selector aparece sólo con
  más de una organización — ofrecer una lista de un elemento es ruido.
- **Avisos calculados por el servidor**: documentación vencida o por vencer
  dentro del mes, e insumos en el punto de reposición. No se recalculan en el
  navegador; el reloj del cliente daría un resultado por pantalla.
- Los `siteId` y `clinicalUnitId` crudos que devuelven las otras pestañas se
  **resuelven contra las sedes y áreas de la misma respuesta**: nunca se muestra
  un uuid.
- Un profesional sin nombre registrado se dice como tal («Profesional sin nombre
  registrado»), no se sustituye por su identificador.

### Laboratorio médico (C16)

Cinco pestañas sobre `GET /diagnostic-units/:id/administration`: **Sucursales ·
Equipamiento · Estudios · Personal · Acreditaciones**.

- Es **distinta de «Directorio de laboratorios»**, que sigue en pie sin cambios:
  aquélla es la vitrina del paciente y sólo muestra lo publicado. Ésta muestra
  también el borrador, la oferta retirada y el cronograma interno de una
  aseguradora.
- La ficha dice si la unidad **se ve hoy en el directorio**, con la bandera que
  calcula el servidor. La consola no reimplementa la regla de publicación.
- La pestaña de estudios muestra **todos** los precios, marcando `interno` los
  de cronogramas no públicos.
- Avisa cuando **nadie tiene permiso para validar resultados**: sin eso ningún
  resultado se puede dar por definitivo, y es una condición de operación, no un
  detalle de configuración.

### Cobertura declarada, no simulada

Las dos pantallas cierran con una sección que dice **qué administran y qué no**,
nombrando el módulo donde vive cada dominio que el carril menciona y que no
corresponde a estos módulos: contabilidad (M16), publicaciones y foros (M19),
encuestas (M09), notificaciones (M25), reservas y resultados (M20), visitas
médicas (M41).

Es lo que pide la regla del carril —«cada tab debe declarar si es `FUNCTIONAL`,
`PARTIAL`, `NOT_IMPLEMENTED_BY_SPEC_DEPENDENCY`; nunca mostrar éxito
ficticio»— resuelto como texto en pantalla en vez de como pestañas que no
persistirían nada.

## 2. Archivos

| Archivo | Qué es |
|---|---|
| `core/data-access/medical-organization/*` | Cliente y tipos de C13 |
| `core/data-access/diagnostic-units/diagnostic-units-admin.*` | Cliente y tipos de C16 |
| `features/admin/medical-organization/*` | La pantalla de C13 |
| `features/admin/medical-laboratory/*` | La pantalla de C16 |
| `core/navigation/navigation.map.ts` | Las dos secciones nuevas |
| `app.routes.ts` | Las dos cargas diferidas |
| `docs/integrations/backend-api.md` | Los dos clientes y sus cuatro operaciones |

**No se tocó el proxy.** Los cuatro endpoints cuelgan de `/practices` y
`/diagnostic-units`, que ya estaban declarados en las tres fuentes de prefijos.
Lo confirma `check-api-prefixes`.

**Las dos secciones cuelgan de `administration/`** y no de una raíz propia:
`/practices` es prefijo del proxy y se compara por inicio de ruta, así que una
sección llamada así a nivel raíz se iría entera a la API. Lo hace cumplir
`check-route-prefixes`.

## 3. Pruebas y verificadores

```
yarn typecheck                          → sin errores
yarn lint                               → 0 errores
ng test --watch=false                   → 255 suites, 2396 tests, 0 fallos
node scripts/check-architecture.mjs     → ✓ 793 archivos, sin ciclos
node scripts/check-api-prefixes.mjs     → ✓ 28 prefijos, iguales en las 3 fuentes
node scripts/check-route-prefixes.mjs   → ✓ 132 rutas, ninguna colisiona
node scripts/check-tokens.mjs           → ✓ 205 tokens
node scripts/generate-doc-report.mjs    → ✓ las 10 verificaciones pasan
yarn build && check-bundle-budget       → ✓ dentro del umbral
```

Cobertura nueva: 4 specs (2 clientes, 2 pantallas) con 21 casos propios, más los
dos casos agregados a `navigation.service.spec.ts` que fijan qué rol ve cada
consola.

## 4. Hallazgos ajenos corregidos para no dejar CI en rojo

Los tres eran **anteriores a este carril** y bloqueaban su PR:

1. `navigation.service.spec.ts` y `shell-layout.spec.ts` no incluían
   `/laboratory-directory` en la lista de secciones sin rol. Entró al mapa con el
   carril de laboratorios y las dos listas no se actualizaron. Se agregó con su
   comentario.
2. `dashboard.ts` importaba `TutorialTarget` sin usarlo, y `yarn lint` fallaba.
   Se quitó el import.

Ninguno tiene relación con organización médica ni con laboratorio; se declaran
acá para que el integrador sepa de dónde salieron.

## 5. Deuda

- Las dos consolas son **de lectura**. Las altas y bajas ya existen en la API y
  no se expusieron en pantalla: entran con sus propias vistas, y hacerlo acá
  habría duplicado formularios que otros carriles están construyendo.
- `practice.practitioner_role_assignments` estaba vacía en el entorno local: la
  pestaña de plantilla lo muestra como vacío con acción, no como fallo.
