# Auditoría funcional de farmacia — traspaso

> Estado al 2026-10-31 · sesión en la nube, VM propia, datos simulados · **trabajo en curso: lo continúa otro agente** (ver «Cómo continuar»)

## Qué es esto

Auditoría de punta a punta, con análisis de brechas, del módulo de farmacia. Cada frase del pedido del
propietario (`contrato/pedido-propietario.md`) y cada `REQ-FAR-0N-NNN` (`contrato/CONTRATO.md`) se compara
contra lo que la app hace, en el navegador y por la API. Código auditado: API `origin/dev` `e1805fa83`,
front `origin/dev` `2e4ae4191`, modelo `origin/dev` `8a3f361fa`.

**Este PR no cambia código de producto.** Solo documenta, con evidencia, lo que se ejecutó, y deja el
entorno reproducible. **Ninguna corrección está integrada**: las de la fase 2 están como parches sin
commitear en `parches-en-curso/` (ver «Cómo continuar»).

## Qué está hecho

- **Preflight Q1–Q11:** hecho y respondido en la conversación. Resumen en «Preflight» abajo.
- **`informes/promos-servicios.md`:** terminado (Promociones, Servicios, importación masiva general).
- **Los cuatro informes de carriles FAR** están terminados en `informes/`: `far01-02.md` (36 PASS, 1 FAIL, 1 bloqueado),
  `far03.md` (14 PASS, 1 FAIL, 1 bloqueado), `far04-05.md` (26 PASS, 3 FAIL, 4 bloqueados) y `far06-07.md`
  (33 PASS, 5 FAIL). Hallazgos con `ruta:línea` y corrección mínima propuesta en cada uno.
- **Evidencia:** `evidencia/<carril>/*.jpg` (capturas con Playwright + Chromium sin ventana, comprimidas a
  JPEG; el original era PNG). `entorno/q6-calls.log` tiene las 62 llamadas de la carga de datos.

## Hallazgos ya confirmados (sin investigar a fondo, con evidencia en los informes)

| ID | Gravedad | Qué |
|---|---|---|
| HP-01 | Crítica | `POST /promotions` → 422 `fk_discount_rules_promotion_id` incluso con SUPERADMIN. Causa probable: `promotions-discounts.service.ts:165-205` inserta las reglas sin volcar la promoción |
| HP-02/03 | Alta | No hay activar/editar/listar/borrar promociones; la farmacia recibe 403 al crear; `/promotions/me` filtra por el tenant del paciente |
| HP-04/08 | Alta | El modelo no tiene tipo de partner, imagen, precio ni ubicación |
| HP-05/06/07 | Alta | La pantalla de promociones de la farmacia está apagada (`campaignsDemo:false`); «Ver ficha» lleva a la tienda; `/promotions/:id` siempre responde «No encontramos» |
| HP-09/12 | Media | Laboratorio: CRUD solo en el simulador; aseguradora: `PUT`/`DELETE /insurance-plans` → 404 |
| HP-13 | Media | Importación masiva solo en 5 áreas de ~35 módulos |

Hallazgos del preflight (rotos al pasar):
1. `database/SQL` de la API desfasada del modelo en ambos sentidos; faltan en el modelo los parches v4.2.63 y
   v4.2.67 (están en `claude/laughing-newton-c021s4` del modelo, sin fusionar). Sin ellos,
   `POST /iam/auth/register-practitioner` da **500** (`profiles.admission_requirements` no existe).
2. `rebuild_stack.py` se niega a correr por ese desfase y por `tools/terminology-import/symptoms/proposal/concept_relationship_evidence.sql` (`CREATE TABLE` fuera de `SQL/`); además no ve `postgres`/`mongodb` sin `COMPOSE_PROFILES=local-db` (`rebuild_stack.py:144`).
3. `seed:boot` se queda sin memoria (`package.json:29`, sin `with-heap.mjs`) y los pasos `cuentas-de-proveedores`/`cuentas-de-aseguradoras` rompen la FK `created_by_user_id` si corre antes de `postman:bootstrap`.
4. `register-organization` exige país y jurisdicción para `PHARMACY` aunque el DTO dice que solo `PROVIDER` (`register-organization.dto.ts:681-694`).
5. El QR del PDF apunta a `/verify/rx/:id` (`prescription-pdf.service.ts:534`), no a `/rx/<token>`: posible brecha con el pedido.
6. `GET /clinical/prescription-shares/by-token/:token` devuelve solo `{shareId, resourceType, resourceId}`; el contrato §1 dice «200 con la receta».
7. Una apertura de la farmacia genera dos `GET /pharmacy/prescription-shares/:token` (uno abortado) y 4 usos `OPENED` para 2 aperturas reales: posible doble registro.
8. `/public/medications` y `/pharmacy/catalog-products` responden vacíos con el vademécum sembrado (2541 filas).
9. FKs de la base 7387 ≠ 7372 en `SQL/`; seeds mock de OpenSearch fallan con `geo_point`.

## Lo que falta (en este orden)

1. ~~Informes de carriles FAR~~: hechos (ver arriba). Los hallazgos nuevos están en cada informe (H12-NN, H3-NN, H45-NN, H67-NN, HP-NN); los más graves están abajo en «Cómo continuar».
2. Consolidar hallazgos por severidad y repartir correcciones, **una por franja y en orden de dependencias**
   (`NO_BIG_BANG_REWRITE`). Cada corrección con prueba `UI → request → response → persistencia → recarga → UI`.
3. Dos PRs por cambio terminado, uno hacia `dev` y otro hacia `test` (CLAUDE.md, «Git»).
4. La aprobación visual del marketplace de promociones y del ERP por pestañas la hace un revisor
   (`NO_SELF_APPROVAL`); aquí solo hay capturas.

## Qué no se pudo validar

- Escaneo del QR con un teléfono y envío real por WhatsApp (se decodificó el QR del PDF con zxing-cpp y se abrió la URL; `wa.me` y `navigator.share` se comprueban solo por código).
- Verificación de correo del paciente: el token solo viaja en el email (`iam-patient-self-registration.service.ts:593-607`).
- Cuentas de imagenología, laboratorio y aseguradora: no existen; solo análisis de código.
- Fidelidad con dev: la base de referencia es el `SQL/` del modelo + dos parches de la API + un OpenSearch armado a mano.

## Cómo reconstruir el entorno (de cero)

Lo aprendido en esta VM; los scripts están en `entorno/`.

1. Docker: `dockerd` no arranca solo; Docker Hub da 429 seguido (reintentar con backoff). Si OpenSearch no baja,
   armar la imagen desde `artifacts.opensearch.org/.../opensearch-3.8.0-linux-x64.tar.gz` (verificar SHA-512).
   El kernel de la VM no admite `nofile 65536`/`memlock -1`: usar `entorno/compose.vm-override.yml`.
2. Worktrees de `origin/dev` de la API y el front en una carpeta hermana; `SALUD_WORKSPACE` apuntando a ella.
3. `.env` local de la API (valores ficticios, base en `localhost:5433`, Mongo `27018`): `SEED_ON_BOOT=false`,
   `ORM_SCHEMA_SYNC=off`, `SQL_MODEL_DIR=../mantra-core-health-model/SQL`, `NOSQL_MODEL_DIR=.../NoSQL`,
   `CORS_ALLOWED_ORIGINS=http://localhost:4000`, `WEB_APP_BASE_URL=http://localhost:4000`,
   `PHARMACY_ERP_BASE_URL=http://127.0.0.1:4100`. Sin `BOOTSTRAP_ADMIN_*` (el admin se crea a mano).
4. Base: `COMPOSE_PROFILES=local-db python salud-db/rebuild_stack.py --yes` con `entorno/rebuild_wrap.py`
   (salta solo el gate de fuentes DDL y suma el override). Veredicto FAIL esperado por las +15 FKs. Después,
   aplicar a mano `database/SQL/patches/2026-10-28_v4263_medical_facility.sql` y
   `2026-10-29_v4267_practitioner_admissions.sql` de la API.
5. API: `corepack yarn build` (≈1m43s); `NODE_OPTIONS=--max-old-space-size=6144 corepack yarn seed:boot`
   (≈11 min); `corepack yarn postman:bootstrap` con `ADMIN_EMAIL`/`ADMIN_PASSWORD`; repetir los pasos
   fallidos con `node dist/src/seed-cli.js --only=requisitos-de-admision-de-profesionales,cuentas-de-proveedores,cuentas-de-aseguradoras`.
   Arrancar con `corepack yarn start:prod`. `RATE_LIMIT_DISABLED=true` si hay varios agentes.
6. Simulador: `mock-provider-server/` con `yarn@1` (su lockfile es v1): `install`, `build`, `PORT=4100 node dist/main.js`.
7. Front: `PUBLIC_API_BASE_URL=http://localhost:3000 corepack yarn build`; servir con
   `PORT=4000 PUBLIC_API_BASE_URL=http://localhost:3000 corepack yarn start` (la CSP toma la URL de la API al arrancar).
8. Datos: `entorno/q6.py` (pasos `pharmacy verify_pharmacy site product patient practitioner care rx pdf share erp`),
   solo por la API. Las claves (`Audit.Local.2026`, `Audit.Admin.2026`) son de una base local descartable.

Notas de prueba: nunca esperar `networkidle` en Playwright; el modo oscuro solo se ve con
`localStorage['mantra-core-health.theme']='dark'` (`src/index.html:16`).

## Cómo continuar (instrucciones para el siguiente agente)

La fase 2 (correcciones) se lanzó con seis agentes en paralelo y se cortó al subir este PR: **ninguno había
commiteado**. Sus cambios sin commitear están como parches en `parches-en-curso/<id>-wip.patch`, hechos con
`git diff --cached HEAD --binary` (incluyen archivos nuevos). **Son trabajo a medio hacer, sin revisar y sin
probar de punta a punta**: tratalos como borrador, no como corrección. Reglas de la fase en
`informes/REGLAS-CORRECCION.md` (worktrees aislados, un commit por hallazgo, serializar builds y navegador,
no aflojar pruebas ni techos).

| Id | Repo y base del parche | Hallazgos que ataca | Archivos del parche |
|---|---|---|---|
| `api1` | API, `5f76e5bf9` | H12-01 token en logs (`pino-options.ts:76-79`), H12-02 aperturas públicas contadas como de farmacia (`prescription-shares.service.ts:369-376`, además partir el archivo de 630 líneas), H67-03 `"false"` → true (`validation-pipe.ts:119`, `site-availability.dto.ts:13`) | 3 |
| `api2` | API, `5f76e5bf9` | H3-02 404 al titular en el detalle de sus pedidos (`pharmacy-orders.use-cases.ts:588`), H3-04 pedido aceptado con la sede en «No lo tengo», H67-01 producto invisible con conteo de catálogo 0 (`read-pharmacy-inventory.use-case.ts:192`, `pharmacy-catalog-rules.ts:142-145`), H3-09 receta con `validTo` pasado | 2 |
| `api3` | API, `5f76e5bf9` | `dryRun` no booleano escribe, H45-02 `medicationConceptId` en `products/bulk`, motivo `REQUIRED` en nombres largos | 4 |
| `api4` | API, `e1805fa83` | HP-01 `POST /promotions` → 422 FK, HP-02 activar/editar/listar/borrar, HP-03 farmacia y visibilidad al paciente | 2 |
| `front1` | Front, `2e4ae419` | H3-01 `ISSUED_STATUS_CODE='MR_ISSUED'` vs `clinical:MEDICATION_REQUEST_ISSUED` (`orderable-prescription.ts:15`), H3-03 estados de «Mis recetas» y «Compartir», H3-05 error genérico en «Enviar pedido» | 3 |
| `front2` | Front, `80ad44ea` | H45-03 tarjeta dentro de tarjeta, H45-01 claves repetidas entre lotes en la vista previa, REQ-FAR-04-011 techos de `navigation.map.ts`/`app.routes.ts` (bajarlos, nunca subirlos) | 26 |

Cómo aplicarlos: `git worktree add <dir> -b fix/<id> <base>` y `git apply --index parches-en-curso/<id>-wip.patch`.
`origin/dev` avanzó mientras tanto (las bases no coinciden entre agentes): rebasar y volver a probar.
Los parches `api*` son de la **API** (`mantra-core-health-api`), no de este repo; viven aquí solo para el traspaso.

### Orden sugerido

1. Reconstruir el entorno («Cómo reconstruir», abajo) y aplicar un parche por vez.
2. Primero lo que bloquea el pedido: **H3-01** (front1) y **H3-02** (api2): sin ellos el paciente no puede pedir con receta ni abrir su pedido.
3. Seguridad: **H12-01** (api1, token en claro en logs; incumple S-6 del contrato).
4. Promociones: **HP-01** (api4) es un bug crítico; el resto de HP exige decisiones de producto.
5. Cada corrección con prueba `UI → request → response → persistencia → recarga → UI` y un revisor distinto de quien implementa.
6. Dos PRs por cambio terminado (`dev` y `test`, CLAUDE.md «Git»); el de `test` desde una rama creada desde `test` con cherry-pick.

### Decisiones pendientes para Itzan (no son bugs, no se tocaron)

- Marketplace de promociones estilo Facebook: el modelo no tiene tipo de partner, imagen, precio ni ubicación (HP-04, HP-08): exige cambio de modelo y de diseño.
- Importación masiva con UPSERT y vista previa en precios de laboratorio, catálogo de aseguradora, promociones, «Mis servicios», procedimientos por sede y sucursales (H45-10); la API de servicios no tiene `@Delete` ni UPSERT.
- Si el QR del PDF debe apuntar a `/rx/<token>` (hoy `/verify/rx/<id>`, `prescription-pdf.service.ts:534`) y si el enlace debe atarse a una farmacia (H12-03, H12-04).
- Actualizar CONTRATO §4: la regla de disponibilidad pasó a «por producto» (commit `3686ec2d`, `site-product-availability.ts:19-22`); el contrato y los REQ de FAR-06 quedaron desfasados (H67-02).

### Avisos

- El entorno de la VM se corta con los reinicios del contenedor; la base y los archivos sobreviven, los procesos no.
- El disco de la sesión es el límite real (≈40 GB): no instalar dependencias de nuevo, enlazar `node_modules`.
- Lo que se creó con prefijos `far12-`, `far3-`, `far45-`, `far67-` y `promo-` quedó en la base local, no en dev.
