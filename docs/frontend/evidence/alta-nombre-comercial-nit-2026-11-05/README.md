# El alta pregunta lo que la ficha muestra: nombre comercial y NIT

Chromium contra `ng serve --configuration development,demo` (simulador, no API real), 2026-11-05.

**El problema.** «Mi perfil» de una organización (`OrganizationProfile`, `GET /tenants/me`) muestra
«Nombre comercial» y «NIT», y en un centro de imagenología recién registrado los dos salían
«Sin registrar». La raíz estaba en el alta, no en la ficha:

- **NIT.** Los cuatro formularios lo piden (`taxId`), pero sólo la farmacia lo mandaba como
  `organization.taxIdentifier`. El de imagenología lo usaba sólo para elegir el PDF y el de
  laboratorio sólo para derivar el `code`. La API (`RegisterOrganizationDetailsDto.taxIdentifier`)
  lo guarda como número del documento tributario (`TAX_IDENTIFIER_DOC.documentNumber`) y desde ahí
  lo devuelve `GET /tenants/me`; sin la clave, no hay nada que mostrar.
- **Nombre comercial.** Sólo el alta de aseguradora lo preguntaba. La API lo acepta en todos los
  tipos (`tradeName`), lo guarda en `directory.tenants.trade_name` y lo muestra la ficha y el
  directorio.

**El arreglo.** Imagenología, laboratorio, farmacia y organización médica preguntan
«Nombre comercial (opcional)» junto a la razón social y lo mandan sólo si se escribió; imagenología y
laboratorio mandan `taxIdentifier` como ya hacía la farmacia. La API no cambia.

| Captura | Qué muestra |
|---|---|
| `imagenologia-empresa-1440.png` / `-390.png` | «La empresa» del alta de imagenología con el campo nuevo |
| `laboratorio-empresa-1440.png` / `-390.png` | Lo mismo en el alta de laboratorio |
| `farmacia-empresa-1440.png` / `-390.png` | Lo mismo en el alta de farmacia |
| `organizacion-medica-empresa-1440.png` / `-390.png` | Lo mismo en «La organización» del alta médica, ahora de a dos (2 × 2) |

La página «La organización» del alta médica pasó de `tres-columnas` a `dos-columnas`: con cuatro
campos, tres columnas dejaban «Tipo societario» solo en el segundo renglón con dos tercios vacíos al
lado (hallazgo del revisor de frontend; regla 6 del cliente, `composition-rules.md` §5).

`captura.cjs` es el guion que las tomó; imprime, por alta y ancho, el rótulo del campo, que no es
obligatorio, y el desborde horizontal.

**Lo que el cuerpo del `POST` lleva** lo fijan las unitarias (`register-imaging-center.spec.ts`,
`register-laboratory.spec.ts`, `register-pharmacy.spec.ts`, `register-medical-center.spec.ts`,
`iam.client.spec.ts`): `taxIdentifier` con el NIT escrito y `tradeName` sólo cuando se escribió.

**Del lado de la API**, el camino `organization.taxIdentifier` → `TAX_IDENTIFIER_DOC.documentNumber`
→ `GET /tenants/me.taxIdentifier` lo acreditan sus propias unitarias, corridas en esta sesión:
`iam-organization-self-registration.service.spec.ts` («el NIT de organization.taxIdentifier manda
sobre el del bloque»), `tenant-affiliation-documents.service.spec.ts` (el número queda sólo en el
documento tributario) y `directory-read.service.spec.ts` (la ficha lo devuelve). `tradeName` ya se
guardaba en `directory.tenants.trade_name` y la ficha lo lee de ahí.

**No se verificó:** el alta de punta a punta contra la API real ni la recarga de «Mi perfil» con
los datos nuevos (`UI → request → persistencia → recarga → UI`). En el entorno de esta sesión no
hay daemon de Docker ni Mongo, MinIO u OpenSearch, que el API exige para arrancar, y el simulador
no cierra ese ciclo (la cuenta nace pendiente de verificación). Queda para el despliegue en `dev`:
registrar un centro de imagenología con sus cuatro PDF y abrir «Mi perfil». Tampoco tema oscuro ni
otros navegadores.

**NIT sin PDF.** En laboratorio y farmacia los papeles son opcionales, y la API sólo guardaba el NIT
como número del documento tributario: sin el PDF, se perdía. Lo arregla el PR del API
[mdavila-2001/mantra-core-health-api#1350](https://github.com/mdavila-2001/mantra-core-health-api/pull/1350),
que guarda el NIT en `common.identifiers` haya PDF o no. Este front ya lo manda en las cuatro altas;
con los dos PR en `dev`, la ficha lo muestra aunque no se haya adjuntado el papel.
