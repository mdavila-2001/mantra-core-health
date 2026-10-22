# TASK PROMPT: BR-26 — Visitadores médicos y laboratorio farmacéutico: modelo, DDL y pantallas

> **MODO DE EJECUCIÓN:** este prompt se ejecuta en **Modo Planificación (Planning Mode)**.
> El desarrollador o el agente arranca investigando, sin tocar código fuente. Con eso escribe un
> `implementation_plan.md` detallado y espera la aprobación explícita del usuario. Después
> ejecuta los cambios en commits atómicos, verifica con pruebas unitarias y de integración, y
> **contra un stack reconstruido desde cero**. El resultado queda documentado en `walkthrough.md`.

| Campo | Valor |
|---|---|
| **Cierra** | AG-30, AG-31, AG-43 (anexo C) · CV-17 (anexo E). Defecto **B-8** de `REGISTRO-DEFECTOS.md` de la API |
| **Severidad máxima** | **Bloqueante demo** (AG-30: todas las rutas de `pharma_lab` responden 500 contra cualquier base del pipeline) |
| **Repo(s)** | `mantra-core-health-model` (`.puml`, DDL, seeds) · `mantra-core-health-redesa-api` (vendor, catálogo ORM, roles) · `mantra-core-health` (cliente y pantallas) |
| **Toca el modelo** | **Sí, y es el grueso**: promover un módulo entero (31 entidades) por las 4 capas. Es un **carril propio**, no una tarea suelta (B-8 lo asigna a Marcelo, M4) |
| **Depende de** | Nada para empezar el modelo. Las pantallas nuevas (AG-43, CV-17) pueden avanzar contra el mock con el contrato actual. La emisión de roles se coordina con **BR-06** (AG-31 también figura ahí) |
| **Decisión previa** | Ninguna de README §8. El plan fija el **número de diagrama** (ver §5) y cómo llegan los roles al token |

---

## 1. Contexto de negocio y justificación técnica

### A. Por qué importa
El visitador médico pide visitas, el médico publica su agenda de visitas y las acepta, el
laboratorio farmacéutico administra visitadores, productos, material y encuestas. En `mockup`
el recorrido se ve; contra la API real **no existe el schema `pharma_lab` en ninguna base
construida por el pipeline**, así que cada ruta del módulo responde 500
`relation "pharma_lab.…" does not exist`. Es el mismo defecto que tuvieron `audio_assets` y
`surveys` (módulo que vivía sólo en el código), un orden de magnitud más grande.

### B. Estado del frontend (`mantra-core-health`, rama `mockup`)
- `core/data-access/pharma-lab/pharma-lab.client.ts:60-240` llama `/pharma-labs*`,
  `/visit-agenda/*`, `/visit-requests*` y `/visit-records*` (el anexo cuenta 21 llamadas; en el
  archivo hay 16 `this.http.*`, más `pharma-lab-concepts.client.ts`). En `mockup` las sirve
  `core/mock/handlers/pharma-lab.handlers.ts:129-254`; el mock decide «soy visitador» con
  `request.user?.roles.includes('MEDICAL_VISITOR')` (`:125`).
- Rutas: `administration/pharma-lab` → `features/pharma-lab/pharma-lab-home`, `my-visits` →
  `visitor-visits`, `lab-visits` → `doctor-visits` (`app.routes.ts:296-301`). Menú:
  `core/navigation/navigation.map.ts:512-520` (`roles:['MEDICAL_VISITOR']`) y `:1057-1063`
  (`PHARMA_LAB_ADMIN`, `BUSINESS_ADMIN`, `PLATFORM_ADMIN`). Nombres en `core/auth/role-labels.ts:25,30`.
- **AG-43 / CV-17:** el cliente no llama `/visit-surveys/*`, `POST /visit-records`,
  `/visit-records/:id/confirm`, `/rating`, `/visit-requests/:id/propose-time|reschedule|request-info`,
  `/visit-agenda/blocks` ni `/pharma-labs/:id/visitor-posts`. `/my-visits` sólo lista y cancela.
  `pharma_lab` tiene **54 de 76** rutas sin UI (`api-unused.json`).

### C. Estado de la API (`mantra-core-health-redesa-api`, rama `dev`)
- `src/modules/pharma_lab/`: **31 entidades** con `schema: 'pharma_lab'`, **12 archivos de
  controlador** con **76 decoradores de ruta** (verificado; el anexo C dice 13 controladores y
  47 rutas, cifra del 18/08 en B-8), `pharma_lab.concepts.ts`, `pharma_lab.roles.ts`.
- **Sin modelo:** no existe `diagram_*_pharma_lab.puml` en
  `mantra-core-health-model/Mantra Core Health Context/modules/` (el último es
  `diagram_66_medical_groups.puml`) ni `SQL/NN_pharma_lab/`, ni `CREATE TABLE "pharma_lab".` en
  `database/SQL/` (patches incluidos). `src/orm/catalog/schemas.catalog.ts:51` declara
  `['pharma_lab', null, 'pharma_lab', 31]`: módulo **`null`**, la firma que tenía `surveys` antes
  de promoverse. Faltan también las historias `audit.pharma_lab_staff_history`,
  `pharma_products_history`, `regulatory_documents_history` y `visit_requests_history` (las
  entidades existen en `src/modules/audit/entities/`).
- `database/README.md:60-64`: «`pharma_lab` entero … es B-8 de `REGISTRO-DEFECTOS.md`, todavía
  abierto». `REGISTRO-DEFECTOS.md:324-339` (B-8): deriva medida con `ORM_SCHEMA_SYNC=dry-run`
  contra base limpia, `69 diferencias (tabla-ausente=45, obligatoriedad-divergente=24)`.
- **La tolerancia está escrita en el verificador:** `scripts/db/verify-clean-init.sh:261-264`
  imprime «heredado (pharma_lab/polyglot_storage), no bloquea» para **cualquier**
  `tabla-ausente`. Mientras eso siga así, una tabla nueva sin DDL tampoco bloquea.
- **AG-31 (matiz al anexo):** los roles **sí existen como semilla**: `pharma_lab.roles.ts` declara
  `PHARMA_LAB_ADMIN`, `MEDICAL_VISITOR`, `PHARMACOVIGILANCE_OFFICER` y `REGULATORY_AFFAIRS`
  (scope `TENANT`) y `src/common/seed/authz-clinical-roles-seed.service.ts:7,19` los siembra en
  `authz.roles`. Lo que **no** hay: ningún camino que los **asigne** (el alta de visitador en
  `services/medical-visitors.service.ts` audita `MEDICAL_VISITOR_LINKED` pero no crea la
  asignación) y **sin confirmar** que el login arme `roles[]` desde las asignaciones de `authz`.
  El único camino manual es `POST /authz/users/:userId/role-assignments`
  (`authz/controllers/authz-grants.controller.ts:33`). El `grep` del anexo dio 0 porque buscó
  fuera de `modules/pharma_lab`.
- `@Roles('MEDICAL_VISITOR')` en `visit-requests.controller.ts:47,58` (`mine`) y
  `visit-records.controller.ts`; `@Roles('PHARMA_LAB_ADMIN', …)` en `pharma-labs.controller.ts` y
  `medical-visitors.controller.ts`. Sin asignación, sólo `SUPERADMIN` pasa por comodín.
- **Conceptos `PHL_*`:** ya los siembra la app al arrancar (`pharma_lab.concepts.ts` →
  `src/common/seed/module-concepts.ts`). No hace falta sembrarlos también desde `gen_seeds.py`:
  dos dueños darían ids distintos.
- **Avisos:** usan `relatedResourceType` en minúsculas (`visit_request`, `visit_record`,
  `regulatory_document`…): la campana del front no los abre (se resuelve en BR-22).

### D. Aislamiento
- Fuera de alcance: **pasarela de pago** (costos y `pharma_cost_allocations` se modelan, no se
  cobran) y **delivery**.
- No se cambian los contratos que el anexo verificó OK (`PutVisitPolicyDto`,
  `CreateVisitRequestDto`, `VisitDecisionDto`, `CancelVisitDto` = `pharma-lab.types.ts:103-222`).
- `polyglot_storage` sigue en la tolerancia del verificador: no es de este prompt.

---

## 2. Flujo de Git y entrega

```bash
cd mantra-core-health-model && git status && git fetch origin
git checkout -b <dev>/feat-modulo-pharma-lab origin/dev
cd ../mantra-core-health-redesa-api && git status && git fetch origin
git checkout -b <dev>/feat-pharma-lab-ddl-y-roles origin/dev
cd ../mantra-core-health && git status && git fetch origin
git checkout -b <dev>/feat-visitas-medicas-ciclo-completo origin/mockup
```

- Orden de merge sugerido: modelo → API (vendor + catálogo + roles) → front. El front puede abrir
  su PR antes, trabajando contra el mock.
- Commits atómicos, por ejemplo: `feat(67): promover pharma_lab al modelo (B-8)`,
  `feat(10): historias de auditoría de pharma_lab`, `build(db): vendor del DDL de pharma_lab`,
  `fix(orm): pharma_lab con módulo en el catálogo`, `fix(db): verify-clean-init bloquea tablas
  ausentes de pharma_lab`, `feat(pharma_lab): el alta del visitador le asigna MEDICAL_VISITOR`,
  `feat(pharma-lab): registrar, confirmar y calificar la visita`.
- PRs: API `gh pr create --base dev --reviewer jsaldias39,PabloArauzCaballero`; front
  `gh pr create --base mockup --reviewer jsaldias39,PabloArauzCaballero`; modelo, quien lo
  mantiene. **El merge exige revisión humana.** El flujo termina en abrir los PR.

---

## 3. Diagrama

```mermaid
flowchart LR
    E["31 entidades MikroORM<br/>src/modules/pharma_lab"] -->|transcribir columna, tipo,<br/>obligatoriedad, FKs declaradas| P["diagram_NN_pharma_lab.puml<br/>(mantra-core-health-model)"]
    P -->|salud-db/gen_ddl.py| S["SQL/NN_pharma_lab/*<br/>+ historias en 10_audit"]
    S -->|corepack yarn db:vendor<br/>(rsync, WSL en Windows)| V["database/SQL (API)"]
    V -->|compose init / rebuild| DB[("Postgres:<br/>schema pharma_lab")]
    DB -->|ORM_SCHEMA_SYNC=dry-run| F{"Deriva sin<br/>tablas pharma_lab"}
    F -->|sí| R["GET /visit-agenda/me → 200/404 de dominio"]
    F -->|no| X["FAIL: volver al .puml"]
```

---

## 4. Archivos a modificar o crear

**Modelo (`mantra-core-health-model`)**
- `[CREAR]` `Mantra Core Health Context/modules/diagram_NN_pharma_lab.puml`: **transcribe** las 31
  entidades (columnas, tipos, obligatoriedad, índices y FKs que el código ya declara). Lo que el
  código no declara explícito se marca `TODO`, no se adivina.
- `[MODIFICAR]` `Mantra Core Health Context/modules/diagram_10_audit.puml`: las 4 tablas de historia.
- `[REGENERAR]` `salud-db/gen_ddl.py` → `SQL/NN_pharma_lab/*` y `SQL/10_audit/*`; `gen_apply.py`
  para `apply_all.sql`; `gen_integrity.py` si hay `<<LOG>>`/`<<APPEND_ONLY>>`.
- `[MODIFICAR]` `salud-db/gen_seeds.py`: tablas del módulo en `INTENTIONALLY_EMPTY` o con boot/mock
  explícito (decidir por tabla); **no** re-sembrar los `PHL_*` que ya siembra la app.

**API (`mantra-core-health-redesa-api`)**
- `[REGENERAR]` `database/SQL/*` con `corepack yarn db:vendor`; `corepack yarn db:vendor:check`.
- `[MODIFICAR]` `src/orm/catalog/schemas.catalog.ts:51`: `['pharma_lab', NN, 'pharma_lab', 31]`.
- `[MODIFICAR]` `scripts/db/verify-clean-init.sh:261-264`: `tabla-ausente` de `pharma_lab` pasa a
  bloquear (sólo `polyglot_storage` queda como heredado).
- `[MODIFICAR]` `database/README.md:60-64` y `REGISTRO-DEFECTOS.md` (B-8 cerrado con evidencia).
- `[MODIFICAR]` `src/modules/pharma_lab/services/medical-visitors.service.ts`: vincular un
  visitador crea la asignación `MEDICAL_VISITOR` (scope tenant del laboratorio) **en la misma
  transacción**; desvincular la revoca. Idem `PHARMA_LAB_ADMIN` para el alta del laboratorio si
  el plan lo decide.
- `[VERIFICAR/MODIFICAR]` el servicio de login de `iam` que arma `roles[]`: que lea las
  asignaciones de `authz` (coordinado con BR-06).
- `[CREAR]` int-specs `test/integration/pharma-lab-visits.int-spec.ts` (visitador pide → médico
  acepta → visitador registra → médico confirma y califica) y de roles (token con
  `MEDICAL_VISITOR` tras el alta).

**Front (`mantra-core-health`)**
- `[MODIFICAR]` `src/app/core/data-access/pharma-lab/pharma-lab.client.ts` + `pharma-lab.types.ts`:
  `visit-surveys/*`, `POST /visit-records`, `confirm`, `rating`, `propose-time`, `reschedule`,
  `request-info`, `visit-agenda/blocks`, `visitor-posts`.
- `[MODIFICAR]` `src/app/core/mock/handlers/pharma-lab.handlers.ts`: las mismas rutas con la forma
  de la API.
- `[MODIFICAR]` `src/app/features/pharma-lab/{visitor-visits,doctor-visits,pharma-lab-home}`:
  registrar la visita (visitador), confirmar y calificar (médico), bandeja de pendientes del
  médico, encuesta de una sola respuesta, alta de visitadores y productos (laboratorio).

---

## 5. Reglas de implementación

- **Paso 1 del plan:**
  - **Número de diagrama:** el siguiente libre es **67**, que también propone AG-44 para
    `data_catalog` (BR-30/portal admin). Acordar el número antes de escribir; quien mergea
    primero se lo queda.
  - **Roles al token:** *A)* asignación en `authz` al vincular (recomendado: respeta scope
    tenant). *B)* rol derivado de la membresía al tenant del laboratorio en el login. Anotar qué
    elige BR-06 para no hacerlo dos veces.
  - **Alcance del front:** qué pantallas de las 54 rutas sin UI entran en la demo (mínimo: el
    ciclo de la visita y la encuesta).
- **4 capas sin atajos:** `.puml` → `gen_ddl.py` → `SQL/` del modelo → `yarn db:vendor` → entidad
  (ya existe: transcribir, no reinventar) → DTO. **Nunca** `ORM_SCHEMA_SYNC=safe`, nunca DDL a
  mano en `database/SQL` ni en la base, nunca el `SQL/` de la raíz del workspace (está viejo).
- **Temperatura 0:** no inventar FKs, columnas ni enums que las entidades no declaren. Si una
  entidad y la spec discrepan, gana lo que el código ya persiste, y se anota.
- Invariantes: `row_version` → `@Version()`; `<<LOG>>`/`<<APPEND_ONLY>>` (historias, access log
  de documentos regulatorios) sin update/delete; un caso de uso = una transacción (vincular +
  asignar rol); avisos por outbox, fuera de locks.
- `yarn db:vendor` usa `rsync`: en Windows corre en WSL, no en PowerShell ni Git Bash a secas.
- Mobile-first y estados M34 en cada pantalla nueva.

---

## 6. Criterios de aceptación (Gherkin)

```gherkin
Escenario: El schema existe en una base limpia
  Dado un stack reconstruido desde cero con el DDL vendorizado
  Cuando un PRACTITIONER hace GET /visit-agenda/me
  Entonces responde 200 o 404 de dominio, nunca 500 "relation pharma_lab… does not exist"

Escenario: Sin deriva de pharma_lab
  Dado el arranque con ORM_SCHEMA_SYNC=dry-run
  Entonces la deriva no lista ninguna tabla pharma_lab ni sus historias de audit
  Y verify-clean-init falla si se borra una tabla de pharma_lab del DDL

Escenario: El visitador recibe su rol
  Dado un usuario dado de alta como visitador de un laboratorio
  Cuando inicia sesión
  Entonces su token trae MEDICAL_VISITOR y GET /visit-requests/mine responde 200
  Pero un PATIENT recibe 403 en la misma ruta

Escenario: Ciclo completo de la visita
  Dada una visita aceptada y realizada
  Cuando el visitador la registra
  Entonces el médico la ve en /visit-records/inbox, la confirma y la califica
  Y el laboratorio ve la calificación en su panel

Escenario: Encuesta de una sola respuesta
  Dada una encuesta publicada por el laboratorio
  Cuando el médico la responde
  Entonces un segundo intento es rechazado por la API y la pantalla lo explica
```

---

## 7. Definition of Done

- [ ] `implementation_plan.md` aprobado: número de diagrama, camino de roles y alcance del front.
- [ ] `.puml` + DDL + historias generados; `apply_all.sql` al día; `db:vendor:check` limpio.
- [ ] `schemas.catalog.ts` con módulo; `verify-clean-init.sh` ya no tolera `pharma_lab`.
- [ ] **Stack reconstruido desde cero** (`corepack yarn db:verify-clean-init` o el compose con
      `down -v`) con veredicto PASS; `information_schema.schemata` lista `pharma_lab`; salida
      literal de la deriva con `ORM_SCHEMA_SYNC=dry-run` pegada en el PR (antes/después).
- [ ] **Rutas mapeadas:** `node dist/src/main.js` + `grep "Mapped {/visit-" ` y
      `grep "Mapped {/pharma-labs"` en el log; `[CREAR]` `pharma_lab.module.spec.ts` (hoy no existe)
      que exija los 12 controladores.
- [ ] Alta de visitador asigna el rol en la misma transacción; int-specs de visitas y roles en verde.
- [ ] Front: cliente y pantallas del ciclo; mock alineado.
- [ ] API: `corepack yarn lint`, `typecheck`, `test`, `test:integration
      --testPathPatterns=pharma-lab`. Front: `lint`, `typecheck`, `build`, `test --watch=false`,
      `check-*.mjs` a mano.
- [ ] **Evidencia de runtime contra la API viva** (`UI → request → response → persistencia →
      recarga → UI`): visitador pide visita → `SELECT` en `pharma_lab.visit_requests` → médico
      acepta → visitador registra → médico confirma y califica → recarga del panel del laboratorio.
- [ ] B-8 marcado cerrado en `REGISTRO-DEFECTOS.md` con la evidencia. PRs abiertos con revisores
      `jsaldias39` y `PabloArauzCaballero`, `walkthrough.md` con la evidencia.

---

## 8. Plan de QA

### A. Pruebas automatizadas
```bash
corepack yarn db:vendor:check                                         # API
corepack yarn test --testPathPatterns=pharma_lab
corepack yarn test:integration --testPathPatterns=pharma-lab
corepack yarn test --watch=false --include=src/app/features/pharma-lab/**              # front
corepack yarn test --watch=false --include=src/app/core/data-access/pharma-lab/**
```
- Spec del módulo: los 12 controladores registrados.
- Spec de `medical-visitors.service`: vincular crea la asignación; desvincular la revoca.

### B. Integración (stack limpio)
1. `down -v` + `up` + init + seeds (o `corepack yarn db:verify-clean-init`).
2. Arranque con `ORM_SCHEMA_SYNC=dry-run`; guardar la línea `Deriva detectada …` o
   `Fidelidad verificada …`.
3. Recorrido de tres actores con sus credenciales de seed: laboratorio → visitador → médico.

### C. Verificación manual y logs
- Log de la API: ningún `relation "pharma_lab.` en todo el recorrido.
- `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'pharma_lab'` = número de
  entidades transcritas.
