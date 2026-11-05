# Auditoría funcional de farmacia — traspaso

> Estado al 2026-10-31 · sesión en la nube, VM propia, datos simulados · **trabajo en curso: lo continúa otro agente**

## Qué es esto

Auditoría de punta a punta, con análisis de brechas, del módulo de farmacia. Cada frase del pedido del
propietario (`contrato/pedido-propietario.md`) y cada `REQ-FAR-0N-NNN` (`contrato/CONTRATO.md`) se compara
contra lo que la app hace, en el navegador y por la API. Código auditado: API `origin/dev` `e1805fa83`,
front `origin/dev` `2e4ae4191`, modelo `origin/dev` `8a3f361fa`.

**Este PR no cambia código de producto.** Solo documenta, con evidencia, lo que se ejecutó, y deja el
entorno reproducible. Ninguna corrección está hecha.

## Qué está hecho

- **Preflight Q1–Q11:** hecho y respondido en la conversación. Resumen en «Preflight» abajo.
- **`informes/promos-servicios.md`:** terminado (Promociones, Servicios, importación masiva general).
- **Los otros cuatro informes** (`far01-02.md`, `far03.md`, `far04-05.md`, `far06-07.md`): los escribían
  agentes en paralelo al abrir este PR. **Si no están en `informes/`, no terminaron: hay que rehacerlos.**
  Cada uno debe traer tabla `REQ → PASS/FAIL/BLOQUEADO → evidencia en una línea` y hallazgos con `ruta:línea`.
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

1. Terminar o rehacer los cuatro informes de carriles FAR (alcance en la tabla de arriba).
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
