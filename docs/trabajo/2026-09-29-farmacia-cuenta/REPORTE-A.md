# Carril A · Registro público de farmacia — reporte

Fecha: 2026-09-29 · Rama: `justin/farmacia-registro-2026-09-29` (worktree `wt-farmacia-registro`,
base `origin/mockup` @ `a63ffb57`) · Plan: [`A-registro-de-farmacia.md`](A-registro-de-farmacia.md)

## Kill-test (§1 del prompt)

**PASA.** Una persona sin cuenta entra a `/auth/register`, ve la tarjeta «Farmacia» junto a las
cinco que ya había, la elige, llega a `/auth/register/pharmacy`, completa sólo lo obligatorio,
avanza por las páginas, envía, y el simulador responde 201 → pantalla «Tu cuenta está lista»,
igual que en el resto de los registros. Con los seis PDF, la central marcada en el mapa, una
sucursal y las tres gerencias completas, todo viaja en el mismo `POST`. Verificado con Playwright
contra `ng serve` real (no sólo unitarias): `playwright/registro-farmacia.spec.ts`, 8/8 PASS.

## Qué se hizo

- **`src/app/features/auth/register-pharmacy/`** (nuevo): `register-pharmacy.ts` (formulario +
  envío real), `.html`, `.css`, `.spec.ts` (14 pruebas). El molde de estructura es
  `RegisterLaboratory` (páginas, sucursales, controles planos); el mecanismo de envío —estado,
  `errorMessage`, `IamClient`— es el de `RegisterOrganization` (la aseguradora), que es la otra
  alta que ya sale a la red de verdad.
- **`src/app/features/auth/register-account-type/`**: sexta tarjeta «Farmacia» → ícono nuevo,
  ruta `/auth/register/pharmacy`, `testId: 'tipo-farmacia'`. Spec actualizado (5→6 tarjetas).
- **`src/app/app.routes.ts`**: una ruta nueva en el bloque `auth/register/*`, diferida
  (`loadComponent`), nada más de ese archivo.
- **`src/app/shared/components/atoms/account-icon/`**: ícono `pharmacy` (una cruz enmarcada),
  agregado a `ACCOUNT_ICON_NAMES`.
- **`src/app/core/data-access/iam/iam.types.ts`**: `PharmacyOrganizationRegistration` y
  `PharmacyBranchRegistration`, con el JSDoc de por qué es una interfaz aparte de
  `OrganizationRegistration` (no hay bloque `pharmacy` en el DTO real — ver P50).
- **`src/app/core/data-access/iam/iam.client.ts`**: `registerPharmacyOrganization()`, análogo a
  `registerOrganization()` pero con `tenantType: 'PHARMACY'` y sin el bloque `payer`.
  `registerOrganization()` **no se tocó**.
- **`src/app/features/auth/registro-compartido/documentos-legales.ts`**: `camposDeDocumentosLegales`
  y `campoDelPoderNotariado` ganaron un tercer parámetro `required` (por defecto `true`, el
  comportamiento que ya tenía la aseguradora) para que farmacia pueda declarar los seis papeles
  como opcionales sin duplicar el helper. `documentos-legales.spec.ts` sigue en 7/7 sin tocarlo.
- **`src/app/core/mock/handlers/auth.handlers.ts`** (handler `register-organization`): acepta
  `tenantType` (no lo validaba antes), agrega el bloque `pharmacy` (`latitude`/`longitude`/
  `branches[]`, misma validación que `payer`), relaja `legalRepresentative.idNumber` y
  `.powerOfAttorneyFileId` a opcionales (el registro de procesos de farmacia no pide cédula del
  representante), y agrega el 409 por correo de owner repetido que no existía para este endpoint
  (el kill-test lo exige explícitamente). Nuevo spec:
  `src/app/core/mock/handlers/auth.handlers.pharmacy.spec.ts` (7 pruebas).
- **`playwright/registro-farmacia.spec.ts`** (nuevo, 8 pruebas): tarjeta visible, las 8 figuras
  bolivianas, validación de campo obligatorio, kill-test mínimo, 409 en pantalla, kill-test
  completo (6 PDF + mapa + sucursal + 3 gerencias), responsive en 375/768/1440, tema oscuro 1440.
- **`PENDIENTES-BACKEND.md`**: fila y sección **P50** (no P49: ese número ya lo tomó la
  contabilidad simple del consultorio, agregada el mismo día — se documenta la razón en la
  sección para quien lea la ficha del carril, que pedía P49).

## Por qué el molde no alcanzaba solo

`RegisterLaboratory` (el molde de estructura, §3 del prompt) es una maqueta pura: su `submit()`
no sale a la red. El kill-test de este carril exige un `POST` real contra el simulador con 201 →
pantalla de verificación, 400 y 409 mostrados en pantalla — eso es lo que hace `RegisterOrganization`
(la aseguradora), no `RegisterLaboratory`. Por eso el componente combina la estructura de páginas
y el trato de sucursales del laboratorio con el mecanismo de envío de la aseguradora.

## Decisiones tomadas (y su porqué)

1. **Representante legal como un único campo de texto** (`legalRepName`), no las cinco partes que
   usa `RegisterOrganization`. El registro de procesos de farmacia sólo pide «nombre del
   representante legal» como un dato, igual que el molde de laboratorio; el backend real acepta
   `fullName` como forma alternativa (deprecada pero vigente) a `name`/`lastName`, así que no hace
   falta partir el nombre.
2. **El correo de acceso es el del representante legal**, no un campo separado. El registro de
   procesos no pide un «correo de acceso» distinto del representante (1.8.2), y el molde de
   laboratorio ya decide esto mismo en su ayuda lateral («Con este correo se entra»). `owner.email`
   = `legalRepresentative.email`.
3. **`owner.displayName` en vez de partir el nombre en `name`/`lastName`.** El DTO real acepta
   `displayName` como forma alternativa (deprecada pero vigente). Partir «Mariana Siles» a mano
   en nombre/apellido sería inventar una regla que el registro de procesos no pide.
4. **`code` se deriva del NIT** (`FARM-<nit>`), no de una «sigla» como en el alta de aseguradora:
   el registro de procesos de farmacia no tiene ese campo, y el NIT es el único dato estable y
   obligatorio disponible para derivar un identificador único.
5. **Las tres gerencias son nueve controles planos**, no tres `FormGroup` anidados — ver el bug
   real que esto evitó, abajo.
6. **Gerencias y documentos legales viajan «todo o nada» en el `POST`**: una gerencia con sólo el
   nombre cargado no se manda (el mock, como el DTO real, exige la gerencia completa si el bloque
   `executives` viaja). Se pierde el dato parcial en el envío, pero el formulario lo conserva en
   pantalla — se puede completar y reintentar. Documentado en el JSDoc de `datos()`.
7. **Sólo Bolivia** (`PAIS = 'BO'`, constante fija): el registro de procesos de farmacia no tiene
   selector de país, a diferencia del alta de aseguradora.

## Un bug real encontrado y corregido en el camino

Al declarar las tres gerencias como `FormGroup` anidados (`generalManager: new
FormGroup({name, phone, email})`) y sus campos con `key: 'generalManager.name'`, el motor
(`app-paginated-form`) los resuelve con la directiva `formControlName`, que busca un control
**directo** del `FormGroup` raíz — no acepta una ruta con punto como sí haría `FormGroup.get()`.
Se manifestó como `NG0304: Cannot find control with name: 'generalManager.name'` en la consola del
navegador y la página «Gerencia general» renderizaba sin sus tres campos (verificado con
Playwright: `getByTestId(...)` nunca encontraba el control, timeout de 180 s). Se corrigió
aplanando las nueve controles (mismo patrón que ya usa `RegisterLaboratory` para sus gerencias, y
por el mismo motivo). Clasificación: `PRODUCT_BUG` en el código de este mismo carril, corregido y
re-testeado antes de reportar `HECHO` — no se subió ningún timeout.

## Comandos corridos y resultado

```
yarn typecheck                                                    → exit 0
yarn build                                                         → exit 0 (bundle inicial 1.32 MB,
                                                                       preexistente: la ruta nueva es
                                                                       loadComponent, no suma al inicial)
yarn lint                                                          → 273 errores preexistentes en
                                                                       specs ajenos (OnPush faltante en
                                                                       componentes de prueba); ninguno
                                                                       en archivos de este carril
node scripts/check-route-prefixes.mjs                              → 251 rutas, 0 colisiones
yarn test --watch=false --include='.../register-pharmacy.spec.ts'          → 14/14
yarn test --watch=false --include='.../register-account-type.spec.ts'      → 6/6
yarn test --watch=false --include='.../auth.handlers.pharmacy.spec.ts'     → 7/7
yarn test --watch=false --include='.../register-organization.spec.ts'      → 62/62 (sin regresión)
yarn test --watch=false --include='.../documentos-legales.spec.ts'         → 7/7 (sin regresión)
yarn test --watch=false --include='.../diagnostic-registration.handlers.spec.ts' → 3/3 (sin regresión)
yarn test --watch=false --include='.../iam.client.spec.ts'                 → 21/21 (sin regresión)
yarn test --watch=false (suite completa)                           → 8893/8913 (661/667 archivos)
yarn pw registro-farmacia.spec.ts --workers=1                      → 8/8 PASS
```

## Suite completa: 20 fallos preexistentes, ninguno de este carril

`yarn test --watch=false` sobre toda la rama da **6 archivos / 20 pruebas en rojo**, ninguno
tocado por este carril ni dependiente de algo que este carril cambió (verificado: ningún archivo
de esos 6 importa `auth.handlers.ts`, `documentos-legales.ts`, `iam.client.ts`, `iam.types.ts`,
`account-icon.ts`, `register-pharmacy` ni `register-account-type`):

- `appointment-calendar.spec.ts` — falla de calendario/fecha.
- `aseguradoras-listado.spec.ts` — `TestBed` reconfigurado sobre módulo ya instanciado.
- `representacion-grafica.spec.ts` (billing) — PDF de factura simulada.
- `follow-up-block.spec.ts` — aserción de calendario clínico.
- `access-tree.spec.ts` — zonas visibles para aseguradora.
- `pharmacy-inbox.spec.ts` (13 pruebas) — `TypeError: this.auth.userId is not a function` en
  `core/data-access/pharmacy-cart/cart.store.ts`, y `GET /pharmacy/orders` sin resolver. Es
  `features/organization/pharmacy-inbox/**`, **prohibido para este carril** (§5 del prompt: es
  territorio del carril B, portal de farmacia) y no depende de nada que yo haya tocado.

Estado igual al de B3 del `README.md`: rojo preexistente en `mockup`, sin medir hasta ahora. No es
mío arreglarlo — está fuera de alcance del carril A.

## Evidencia visual

`evidencia/A/` (copiado de `artifacts/registro-farmacia/`): tarjeta en `/auth/register`, paso 1
(«La empresa»), central con mapa confirmado, papeles completos, sucursal agregada, error de correo
repetido, éxito (mínimo y completo), responsive 375/768/1440 en claro, paso 1 y éxito en oscuro
1440. Revisadas dos veces (verificación + pasada adversarial): sin desborde horizontal, sin texto
cortado, contraste correcto en los dos temas, ícono de farmacia distinguible del resto de la
rejilla. Ninguna pantalla rechazada.

**No cubierto**: tema oscuro en las páginas intermedias (documentos, sucursales, gerencias) — sólo
se capturó paso 1 y éxito en oscuro; capturas de tablet en oscuro; Firefox/Safari (la suite es
sólo Chromium, como el resto del proyecto).

## Lo que NO se hizo (fuera de alcance, §7 del prompt)

Login con la cuenta nueva (el simulador no crea cuentas logueables en ningún alta, B5) · que lo
registrado aparezca en la Ficha de la farmacia · el menú/portal de farmacia (carril B) · el
laboratorio, más allá de leer `TIPOS_DE_SOCIEDAD`/`documentos-legales.ts` compartidos · backend
real (documentado en P50).

## Definición de terminado (§6 del `README.md`)

`yarn typecheck` 0 ✓ · `yarn lint` limpio en lo tocado ✓ · `yarn build` exit 0 ✓ · specs dirigidos
en verde ✓ · specs de navegación: no aplica a este carril (no se tocó `core/navigation/**`) ·
e2e dirigido `--workers=1` PASS ✓ · capturas 375/768/1440 claro + 1440 oscuro ✓ (con el «no
cubierto» de arriba) · `check-route-prefixes` ✓ · PR contra `mockup` → siguiente paso.
