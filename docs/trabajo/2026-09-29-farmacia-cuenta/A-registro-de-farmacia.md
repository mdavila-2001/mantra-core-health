# Carril A · Registro público de una farmacia — prompt para pegar

Sos la máquina que construye **el alta de una farmacia** en el front de AloVida
(`mantra-core-health`, Angular 21 + SSR, **yarn 4 PnP**). Sólo front, sólo simulador, rama base
**`origin/mockup`**. Leé primero [`README.md`](README.md) de esta carpeta: ahí están las decisiones
D1–D2, los bloqueantes B1–B14 y las reglas para no chocar con el carril B, que corre en paralelo
en otra máquina. **No esperás a nadie y nadie te espera.**

## 0 · Arranque (10 min)

```bash
git -C mantra-core-health fetch origin
git -C mantra-core-health worktree add ../wt-farmacia-registro -b justin/farmacia-registro-2026-09-29 origin/mockup
cd ../wt-farmacia-registro
corepack yarn install --immutable
grep -n mockBackend src/environments/*.ts        # en mockup debe ser true; no lo commitees
yarn typecheck
```

Línea base **antes de tocar nada** (anotá lo que ya esté rojo; no es tuyo):

```bash
yarn test --watch=false --include='src/app/features/auth/**'
```

Reglas de máquina, aunque no tengas los hooks del repo raíz: un solo navegador, los e2e con
`--workers=1`, nunca `npm`, nunca `run_in_background`.

## 1 · Resultado observable (el kill-test)

Una persona sin cuenta entra a `/auth/register`, ve la tarjeta **«Farmacia»** junto a las cinco
que ya hay, la elige, llega a `/auth/register/pharmacy`, completa **sólo lo obligatorio** (razón
social, tipo de sociedad de la lista, NIT, dirección legal de la central, nombre y correo del
representante, correo de acceso y contraseña), avanza por las páginas, envía, y el simulador
responde 201 → aparece la pantalla de «revisá tu correo», igual que en los otros registros. Si además
adjunta los PDF, marca la central en el mapa, agrega sucursales y las gerencias, todo viaja en el
mismo `POST`.

Si la tarjeta no está, si el formulario frena por un PDF, o si el `POST` no lleva
`tenantType: 'PHARMACY'`: **no está hecho**.

## 2 · Fuente de los campos: registro de procesos, «MÓDULO FARMACIA» §1

`REGISTRO DE PROCESOS POR MODULO.md` líneas 254–277 (raíz del repo padre). Los 18 puntos, con lo que
decide D2:

| Punto | Campo | En el alta |
|---|---|---|
| 1.1 | Nombre o razón social | **obligatorio** |
| 1.1.1 | Tipo de sociedad — **se elige de la lista cerrada**: UNIPERSONAL · SRL · LTDA · S.A. · SOCIEDAD COLECTIVA · SOCIEDAD EN COMANDITA SIMPLE · SOCIEDAD EN COMANDITA POR ACCIONES · SUCURSAL DE SOCIEDAD EXTRANJERA | **obligatorio** |
| 1.1.2 | Constitución de la empresa (PDF) | opcional |
| 1.2 | Número de NIT | **obligatorio** |
| 1.2.1 | NIT en PDF | opcional |
| 1.3 | SEPREC (PDF) | opcional |
| 1.4 | Licencia de funcionamiento (PDF) | opcional |
| 1.5 | Certificado del SEDES (PDF) | opcional |
| 1.6 | Dirección legal de la central | **obligatorio** |
| 1.7 | Ubicación GPS de la central | opcional |
| 1.8 | Nombre del representante legal | **obligatorio** |
| 1.8.1 | Poder del representante (PDF) | opcional |
| 1.8.2 | Correo del representante legal | **obligatorio** |
| 1.9–1.11 | Gerente general: nombre, celular, correo | opcional |
| 1.12–1.14 | Gerente comercial: nombre, celular, correo | opcional |
| 1.15–1.17 | Gerente de marketing: nombre, celular, correo | opcional |
| 1.18 | GPS de cada sucursal | opcional (una fila por local) |
| — | Correo de acceso y contraseña (con quién se entra) | **obligatorio** |

Todo lo opcional lleva la ayuda «Podés completarlo después desde la Ficha de la farmacia». Es la
regla del propietario: lo básico para nacer; el resto, desde adentro; exigirlo para operar es del
backend, después.

## 3 · El molde: el alta de Laboratorio

`src/app/features/auth/register-laboratory/` (`register-laboratory.ts` 866 líneas, `.html` 245) ya
hace **exactamente estos 18 puntos** para el laboratorio, con las piezas compartidas:

- `app-auth-split` + `app-paginated-form` (organismos) — páginas con título por paso y la columna
  de ayuda que cambia con el paso (`titulo: 'La empresa, no el local'`, `'El tipo se elige de la
  lista'`, `'Tres papeles frenan, tres no'`…). **Acá el texto de ayuda cambia**: ningún papel frena.
- `registro-compartido/documentos-legales.ts` — los 5 PDF como campos `custom`
  (`constitutionFileId`, `taxIdentifierFileId`, `commerceRegistryFileId`, `operatingLicenseFileId`,
  `healthAuthorityCertificateFileId`) con `<app-dropzone-pdf>`; el poder del representante va en
  `legalRepresentative.powerOfAttorneyFileId`.
- `registro-compartido/politica-de-contrasena.ts`, `location-picker/`, `ubicacion-picker/`,
  `registro.css`.
- Los códigos de tipo societario que el simulador acepta (**códigos, no rótulos** — B6):
  `UNIPERSONAL · SRL · LTDA · SA · SOCIEDAD_COLECTIVA · COMANDITA_SIMPLE · COMANDITA_ACCIONES ·
  SUCURSAL_EXTRANJERA` (`TIPO_SOCIETARIO` en `core/mock/handlers/auth.handlers.ts`, rótulos en
  `register-laboratory.ts:70-81`).
- El desglose del nombre en cinco partes y `unirNombres` están en `register-organization.ts`
  (115–177): el backend recibe siempre el compuesto.

**Copiá la estructura, no el archivo.** Lo que sea idéntico entre Laboratorio y Farmacia (los pasos
de empresa, papeles, central, sucursales, representante, gerencias, acceso) es candidato a
extraerse a `registro-compartido/`; hacelo **sólo** si el diff de Laboratorio se limita a importar
lo extraído y sus specs siguen verdes sin tocarlos. Si no, duplicá y anotalo en el reporte: no es
tu carril refactorizar el laboratorio.

## 4 · Contrato (D1): `POST /iam/auth/register-organization`

Mismo endpoint y misma forma que la aseguradora, con:

```jsonc
{
  "owner": { "email": "...", "password": "...", "name": "...", "lastName": "..." },
  "organization": {
    "tenantType": "PHARMACY",
    "legalName": "...",
    "legalEntityType": "SRL",
    "taxIdentifier": "...",
    "legalAddress": "...",
    "headquarters": { "latitude": -17.78, "longitude": -63.18 },   // opcional
    "legalDocuments": { "constitutionFileId": "...", "...": "..." }, // opcionales
    "legalRepresentative": { "fullName": "...", "email": "...", "powerOfAttorneyFileId": "..." },
    "executives": { "generalManager": {...}, "commercialManager": {...}, "marketingManager": {...} },
    "pharmacy": { "branches": [{ "name": "...", "latitude": 0, "longitude": 0 }] } // opcional
  }
}
```

Antes de fijar nombres de claves, **leé el DTO real** en
`mantra-core-health-api/src/modules/iam/dto/register-organization.dto.ts` (`tenantType` línea 434,
`legalEntityType` 454, `legalRepresentative`, `executives`) y usá **sus** nombres para todo lo que
ya exista; inventá clave nueva sólo para `pharmacy.branches` y anotala en P49. Los archivos se suben
antes por el mismo camino que usa la aseguradora (`files.handlers` → `fileId`).

**En el simulador** (`auth.handlers.ts`, handler `register-organization`, línea ~165): que acepte
`tenantType: 'PHARMACY'` (hoy no lo rechaza; verificalo con un test), valide `pharmacy.branches[]`
como valida `payer.latitude/longitude` (ambas coordenadas o ninguna, en rango; 400 si no), y
devuelva lo mismo que para la aseguradora. **No** agregues cuentas a `MOCK_USERS` ni toques
`mock-session.ts` (B5, D10).

## 5 · Archivos: qué es tuyo y qué no

**Tuyos (creás o editás):**

- `src/app/features/auth/register-pharmacy/**` — generá con el CLI:
  `yarn ng generate component features/auth/register-pharmacy` (convención: `register-pharmacy.ts`
  + `.html` + `.css` + `.spec.ts`, clase `RegisterPharmacy`, sin sufijo `.component`).
- `src/app/features/auth/register-account-type/register-account-type.ts` — la sexta tarjeta:
  `titulo: 'Farmacia'`, `ruta: '/auth/register/pharmacy'`, `testId: 'tipo-farmacia'`, con su ícono
  en `AccountIcon` si hace falta uno nuevo (mirá cómo se resolvió «Laboratorio»).
- `src/app/app.routes.ts` — **sólo** una ruta nueva en el bloque `auth/register/*` (línea ~2087,
  junto a `auth/register/laboratory`), con `loadComponent`. Nada más de ese archivo.
- `src/app/core/mock/handlers/auth.handlers.ts` — el handler de `register-organization` (§4) y su
  spec.
- `src/app/features/auth/registro-compartido/**` — sólo si extraés (§3).
- `playwright/registro-farmacia.spec.ts` — escribilo con Write/Edit, no con heredoc (B10).
- `PENDIENTES-BACKEND.md` — fila **P49** en la tabla del principio + sección **P49 al final del
  archivo**: «Registro de farmacia: la API acepta `tenantType: PHARMACY` pero no crea la fila de
  `directory.pharmacies`, no tiene bloque `pharmacy.branches` y no enlaza la sede central; lo
  obligatorio para operar (los 6 PDF, SEDES) hoy no se exige en ninguna capa».
- Al cierre: `docs/trabajo/2026-09-29-farmacia-cuenta/REPORTE-A.md` + `evidencia/A/`.

**Prohibidos** (son del carril B o de nadie): `core/navigation/**`, `core/mock/mock-session.ts`,
`core/mock/handlers/pharmacy.handlers.ts`, `features/organization/**`, `features/pharmacy/**`,
`features/account/**`, `shared/components/organisms/{header,side-nav,shell}/**`, los otros cinco
registros (salvo importar de `registro-compartido/`), `environments/`, `proxy.conf*.json`,
`component-index.generated.ts`.

## 6 · Orden de trabajo

1. Línea base (§0) → checkpoint.
2. Tarjeta «Farmacia» + ruta `auth/register/pharmacy` + componente vacío que renderiza el
   `app-auth-split` → `yarn build` → checkpoint («compila»).
3. Páginas del formulario, en el orden del registro: **La empresa** (1.1, 1.1.1, 1.2) · **Los
   papeles** (los 6 PDF, todos opcionales, en el orden de la fuente) · **Dónde está la central**
   (1.6 obligatorio, 1.7 opcional con el picker) · **Tus sucursales** (1.18, una fila por local) ·
   **Representante legal** (1.8, 1.8.1, 1.8.2) · **Gerencias** (1.9–1.17, «todo este paso es
   opcional») · **Tu acceso**. Cada página: errores asociados al campo, datos preservados al ir y
   volver, foco al primer error. Ayuda lateral escrita para una farmacia, no copiada del laboratorio.
4. `submit()` real contra el simulador (§4) → 201 → el mismo cierre que la aseguradora: la
   pantalla pasa al estado «registrado, revisá tu correo» (`registered` + `verificationSent`,
   `register-organization.ts:1158-1166`) y el botón de salida vuelve a `/auth` (`:1178`) → 409
   (correo repetido) y 400 (tipo fuera de lista) mostrados en pantalla, no en consola.
5. Specs unitarios: obligatorios/opcionales exactos de D2, códigos de tipo societario, el cuerpo del
   `POST` (`tenantType: 'PHARMACY'`, sin claves vacías), 400/409.
6. E2E dirigido (chromium, `--workers=1`): el recorrido del kill-test dos veces, mínimo y completo;
   capturas de cada página en 375 / 768 / 1440 claro y 1440 oscuro.
7. `yarn typecheck; yarn lint; yarn build; node scripts/check-route-prefixes.mjs` → PR contra
   `mockup` → recién ahí `REPORTE-A.md`.

Checkpoints: no más de 3 operaciones materiales seguidas sin decir «Hecho / Evidencia / Ahora /
Riesgo / QA». Ante un fallo, primero causa raíz; nunca subir un timeout ni relajar una aserción.

## 7 · Lo que NO hacés

Login con la cuenta nueva · que lo registrado aparezca en la Ficha de la farmacia · tocar el menú ·
tocar el laboratorio más allá de importar lo compartido · backend · inventar campos que el registro
de procesos no pide.
