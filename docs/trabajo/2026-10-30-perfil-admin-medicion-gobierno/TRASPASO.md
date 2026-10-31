# Traspaso — Perfil admin, medición, gobernanza, permisos y cargas masivas

> **Para quien continúe (otro agente o persona).** Léelo entero antes de tocar nada. El plan completo y su estado
> están en [`PLAN.md`](./PLAN.md); las decisiones del cliente, en su tabla D1–D10. Rama de trabajo en los dos repos:
> `claude/stoic-johnson-4vl5bf` (`mantra-core-health` front, `mantra-core-health-api` API).
> **Escalera de evidencia:** casi todo está en `TESTED` contra dobles o `VERIFIED_FUNCTIONAL_ONLY` contra el simulador.
> **Nada se ejecutó contra Postgres, Redis ni la API real.** No digas «listo» sin subir ese peldaño.

## Qué quedó hecho (y dónde)

| Pieza | Repo | Dónde | Estado |
|---|---|---|---|
| Menú del perfil de gestión (sin «Mis…») | front | `core/navigation/navigation.management.ts` | `VERIFIED_FUNCTIONAL_ONLY` (simulador, capturas en `evidencia/capturas-h1/`) |
| Portada «Centro de la plataforma» (2 portales + estado) | front | `features/dashboard/platform-home/` | funcional, **RECHAZADA visualmente** (ver «Pendiente visual») |
| Instancias, herramientas y dispositivos | front + API | `features/admin/instances/`; API `ops_console` (sonda), `platform_ops` (herramientas), `telemetry` (dispositivos) | `TESTED` con dobles |
| Detalle del portal de inventario y flujos | front | `features/admin/portal/operations/`, `features/admin/flows/flow-data/` | `TESTED` (simulador) |
| Dinero por módulo y heatmap | API | `reporting/` (`/admin/analytics/money`), `telemetry/` (`/admin/analytics/heatmap`) | `TESTED` con dobles |
| Medición por funcionalidad (pantalla) | front | `features/admin/measurement/` | escrita, con specs; **sin captura de navegador** |
| Catálogos Servicios y Glosario (CRUD admin) | API | `billing/` y `terminology/` (`/admin/catalogs/...`) | `TESTED` con dobles |
| Gobernanza (auditoría, insights de catálogo, lecturas) | API | `audit/`, `data_catalog/`, `system_ops/` | `TESTED` con dobles; contrato en `contratos/H4-gobernanza.md` |
| Ciclo de vida de usuarios, «quién puede qué», revisión de accesos, seed de permisos `bulk_import.*` | API | `iam/`, `authz/` | `TESTED` con dobles |
| Motor de cargas masivas (10 plantillas CSV **y** JSON) | API | `bulk_import/` | `TESTED` con dobles; **no persiste ni da de alta de verdad** |
| Pantalla de cargas masivas | front | `features/admin/bulk-imports/` + cliente/mock | escrita; **sin spec propio y sin captura** |

Contratos de la API para el front: `contratos/H2-dinero-y-heatmap.md`, `H3-catalogos.md`, `H4-gobernanza.md`.
Informes de descubrimiento: `descubrimiento/01..04-*.md`. Revisión adversarial de capturas: `evidencia/doble-revision.md`.

## Qué NO está hecho (en orden de prioridad)

1. **Verificar contra la API real.** Levantar Postgres + Redis + API (`mantra-core-health-api/docker-compose.yml`, perfil `local-db`) y repetir las pruebas
   de integración de: sonda de vida (parar un worker → CAÍDA), registro de herramientas (2.ª corrida del seeder = 0 inserciones), dinero (cuadre contra
   `SELECT sum(...)`), dispositivos, catálogos, ciclo de vida de usuarios. Es lo que sube `TESTED` → `VERIFIED`.
2. **Arreglos visuales** de la revisión adversarial (`evidencia/doble-revision.md`): **B1** el Centro apila tarjetas y debe ser UNA tarjeta con pestañas
   (regla del cliente 09/09/2026, `docs/components/composition-rules.md` §5; `platform-home.html`); **B2** faltan capturas tablet/móvil/oscuro;
   M1 contraste de encabezados de grupo del menú (3,6–3,8:1, AA exige 4,5:1); M3 selects a ancho completo en Instancias (`admin/instances/instances.html`);
   M6 identificadores crudos (`HEARTBEAT_EXPIRED`, `NEVER_SEEN`, `DEP_SUCCEEDED`…); M7 color de enlaces de pacientes; M8 Contabilidad mezcla perfiles;
   M10 el superadmin ve «212 pacientes» de otra organización. Tras corregir: recapturar TODO y pasar otra vez la doble revisión **por otro agente**.
3. **Pantallas que faltan** (la API ya está lista, ver contratos): editores de catálogos (Servicios, Glosario), gobernanza (políticas, PII, calidad, linaje,
   auditoría), permisos finos y gobierno de usuarios (suspender/reactivar/baja, «quién puede qué», simulador, revisión de accesos). Copiar el patrón de
   `features/admin/instances/` y de Atlas (`/home/user/pabloarauzcaballero/atlasadminportal`, solo lectura).
4. **Cargas masivas — lo bloqueado:** (a) falta la **tabla del lote** en `mantra-core-health-model` (estado, declaración, contadores, clave de confirmación
   única por organización, filas); hoy los lotes viven en memoria (`InMemoryBatchRepository`, doble declarado); (b) adaptadores **no conectados** (alta real de
   usuarios, escritura clínica, resolutor de pacientes y de códigos): esas filas salen `RECHAZADA`, nunca «creada»; (c) decisiones de negocio: cómo se entrega
   el token de activación, qué cuenta como consentimiento revocado (DPO), qué versión de terminología es la vigente. Falta el spec de la pantalla.
5. **Reporte contable:** NO implementado. No existe un catálogo «por tipo de usuario» y editar cuentas toca el mayor. Decisión de negocio pendiente.
6. **Faltantes de modelo** (`mantra-core-health-model`, sin DDL a mano): columnas de criticidad, variables requeridas y procedencia en `tool_registry`;
   la tabla del lote; propiedades de `ux_interaccion` (ver siguiente punto).
7. **Heatmap:** el seeder `src/common/seed/telemetry-ux-heatmap-seed.service.ts` crea `ux_interaccion` sin `propertySchemaJson` y la política rechaza propiedades
   no declaradas: con datos reales el mapa de calor daría 0 clics (el endpoint lo declara en `notMeasured`). Declarar las propiedades del cliente (`x_doc`, `y_doc_px`, …).
8. **Seguridad — cierre conservador a abrir:** `PlatformAdminScopeGuard` (`mantra-core-health-api/src/common/auth/`) exige administrador de **plataforma** en el
   ciclo de vida de cuentas y en `authz-governance`; el glosario exige `SUPERADMIN` de plataforma. Una versión acotada a la organización exigiría comprobar que el
   usuario objetivo pertenece al tenant resuelto. Revisar además las demás rutas `@Roles('SECURITY_ADMIN')` de `iam-users` (previas).
9. **Despliegue:** definir `OPS_LIVENESS_REQUIRED_WORKERS=messaging,scheduling,workflow,read_models` en `docker-compose.coolify.yml`; sin eso, en Coolify los 20
   workers apagados a propósito figuran `SIN_DATO` y el estado general sale `DEGRADADA`. Regenerar `openapi/` (exige `yarn build`) y los comentarios «20 workers» (son 25).
10. **Ruido previo, no causado por este trabajo:** `check-max-lines`, `check-architecture`, `check-usted` y otros `check-*.mjs` del front ya estaban rojos en la base;
    `community-reviewable-care.handlers.spec.ts` es sensible a la hora del día (fixtures «hoy a las 09:00»); las specs de `src/worker` son lentas.

## Cómo arrancar (comandos verificados)

```bash
# Front (Yarn 4 por corepack; NO usar npm)
corepack enable && corepack yarn install --immutable
node scripts/generate-component-index.mjs && node scripts/generate-env.mjs
NG_BUILD_PARALLEL_TS=0 NODE_OPTIONS=--max-old-space-size=8192 corepack yarn ng test --include '<glob>' --watch=false
NODE_OPTIONS=--max-old-space-size=8192 corepack yarn typecheck
corepack yarn start:demo        # simulador; cuentas en src/app/core/mock/README.md (login en /auth; superadmin: superadmin@alovida.mock, elegir «AloVida Plataforma»)
# El pre-push corre un build de producción (necesita el yarn 4 de corepack y ~8 GB).

# API
corepack yarn install --immutable
NODE_OPTIONS=--max-old-space-size=8192 corepack yarn typecheck
node --experimental-vm-modules node_modules/jest-cli/bin/jest.js <spec> --runInBand
```

**Reglas del repo que no se negocian** (`CLAUDE.md` del front): usar primitivas existentes; los 9 estados `ViewState` (M34); sin Tailwind; fichas en UNA tarjeta con pestañas;
las mutaciones se demuestran UI → request → respuesta → persistencia → recarga → UI; quien implementa no aprueba su propia revisión visual.
**Entrega:** según el `CLAUDE.md`, dos PRs por cambio terminado (uno a `dev` y otro a `test`, este último por cherry-pick desde una rama creada desde `test`).

## Sin datos reales
Todos los datos de prueba son sintéticos y están marcados «SIMULADO». Ningún dato real de paciente entró a los repositorios, capturas ni reportes.
