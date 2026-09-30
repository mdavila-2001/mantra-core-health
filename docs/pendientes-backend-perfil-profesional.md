# Pendientes de backend — corregir y descargar lo cargado en el perfil profesional

**Estado:** el cliente y el simulador ya los implementan. El backend real todavía no.

## Por qué

«Configurar tu perfil» (`/my-account/edit`) muestra desde el 13/09/2026 tres
tablas con lo ya cargado: formación, especialidades y matrículas. El propietario
pidió ese mismo día que la tabla permita **eliminar registros, editar registros y
descargar elementos**, como botones de acción sobre la fila.

De esas operaciones, el módulo `profiles` expone hoy **una**:

```
DELETE /profiles/practitioners/me/credentials/:credentialId   → 204
```

Todo lo demás no tiene ruta. En la práctica eso significa que:

- **Nada se corrige.** Un número de título mal tecleado, una institución
  equivocada o una fecha de emisión corrida no tienen arreglo: la única maniobra
  disponible es cargar el dato de nuevo y convivir con los dos. En formación eso
  además duplica trabajo de quien verifica.
- **Una especialidad o una matrícula cargada por error se queda para siempre.**
  El título sí se puede retirar; sus dos vecinas no, sin ninguna razón de dominio
  que las distinga.
- **El diploma entra y no vuelve a salir.** `AddOwnCredentialDto` acepta `fileId`
  desde siempre y `CreateJurisdictionAuthorizationDto` desde el 13/09/2026
  (modelo v4.2.11 + API #398), pero **la lectura no lo devuelve**:
  `PractitionerCredentialDto` y el DTO de la matrícula no lo declaran. Quien
  adjuntó su diploma no tiene forma de volver a verlo, ni siquiera siendo el
  dueño.

La rama `mockup` corre con `mockBackend: true` fijo, así que ahí las cinco cosas
ya funcionan contra el simulador y se pueden mirar. Lo de abajo es lo que falta
del otro lado para que funcionen contra la API real, **sin tocar la pantalla**:
`ProfilesClient` ya pide exactamente estas rutas con estos cuerpos.

## 1. El archivo, en la lectura

Dos campos opcionales, en el `GET /profiles/practitioners/me/summary` (y en el
de un profesional por id, que comparte DTO):

```ts
class PractitionerCredentialDto {
  …
  @ApiPropertyOptional({ format: 'uuid' }) fileId?: string;   // el diploma
}

class PractitionerLicenseDto {
  …
  @ApiPropertyOptional({ format: 'uuid' }) fileId?: string;   // el carnet del colegio
}
```

Es el id que ya se guarda al crear, devuelto. **No hace falta un endpoint de
descarga propio del dominio**: el cliente baja el contenido con
`GET /common/files/:id/content`, que ya exige ser quien lo subió o tener rol
revisor. Es el mismo camino que usa la evidencia de los casos de verificación
(FT-32-R02), y por el mismo motivo —la CSP del servidor deja `connect-src` en
`'self'` y la URL firmada de `/download-url` apunta a `file://local/<sha>`, que
el navegador no abre—.

## 2. Corregir un título

```
PATCH /profiles/practitioners/me/credentials/:credentialId
{ "credentialTypeConceptId"?, "number"?, "issuingInstitutionText"?, "issueDate"?, "fileId"? }
→ 204
```

Parcial: se manda sólo lo que cambió, y una clave **ausente** no significa
«vaciá esto» —para borrar la institución se manda `issuingInstitutionText: ""`—.

**Mismo límite que el retiro:** sólo mientras el título sigue PENDIENTE. Uno ya
verificado o rechazado es un hecho de la autoridad que lo revisó, y corregirlo
por detrás invalidaría la comprobación: `422`, igual que el `DELETE`. La pantalla
ya no ofrece el botón en ese caso, pero la regla tiene que vivir en el servidor.

## 3. Corregir y retirar una especialidad

```
PATCH  /profiles/practitioners/me/specialties/:specialtyId
{ "specialtyConceptId"?, "boardCertified"? }
→ 204

DELETE /profiles/practitioners/me/specialties/:specialtyId
→ 204
```

**`isPrimary` no viaja en el `PATCH`**, a propósito: cuál es la principal ya
tiene su propia operación desde el 13/09/2026
(`PATCH …/me/specialties/:id/primary`, API #399), que es la única que sabe
desmarcar a la anterior. Dos caminos para el mismo hecho dejarían dos principales.

Al retirar la que era principal, el perfil queda **sin principal** hasta que se
marque otra: el simulador borra la elección junto con la fila. Elegir una
sustituta automáticamente sería decidir por la persona con qué especialidad se
presenta.

## 4. Corregir y retirar una matrícula

```
PATCH  /profiles/practitioners/me/jurisdiction-authorizations/:licenseId
{ "licenseNumber"?, "regulatoryAuthority"?, "validFrom"?, "fileId"? }
→ 204

DELETE /profiles/practitioners/me/jurisdiction-authorizations/:licenseId
→ 204
```

Las cuatro rutas de arriba van bajo `practitioners/me` y no bajo
`practitioners/:profileId`, por lo mismo que el alta del título: el sujeto sale
de la sesión, así que no existe la forma de escribir la trayectoria de otro
profesional ni equivocándose de id. `404` —indistinguible entre «no existe» y
«es de otro»— para todo lo que no sea propio, como el resto del módulo.

## Y el padrón de instituciones educativas

Aparte de las rutas, el mismo pedido del 13/09/2026 convirtió «Institución» en
una lista cerrada. **No hay padrón de universidades en ninguna de las cuatro
capas** —ni value set en la terminología, ni tabla en el modelo, ni endpoint—,
así que el catálogo vive hoy en el frontend
(`src/app/core/profesion/instituciones-educativas.ts`), curado a mano, con una
salida a texto libre para quien se formó en el exterior.

El valor de cada opción es **el nombre**, no un id: `issuingInstitutionText`
sigue recibiendo lo mismo que recibía. El día que exista el catálogo del lado del
servidor, el frontend pasa a ser un mapeo y no cambia dónde se guarda la
respuesta. Mismo criterio, y mismo archivo vecino, que
`titulos-profesionales.ts`.

## El logo del consultorio (2026-09-30)

Justin pidió que el logo del consultorio del doctor salga en la pestaña
«Facturación» del perfil —al mirar y al editar— y en el membrete de los PDF. El
frontend está entregado contra el simulador de `mockup`; **el backend no tiene
dónde guardarlo**, y esta sección deja escrito qué hace falta y cuál es el
contrato que el frontend ya usa, para construir la API contra él.

### Lo que hay hoy

- `directory.tenants` **no tiene columna de logo**, y `practice.practices` tampoco.
  `practice.practice_sites` sólo tiene `bank_qr_file_id` (parche v4215).
- El logo de una organización que sí existe en el modelo es
  `community.public_profiles.avatar_file_id` (con `target_type` de organización).
  Se escribe con `PUT /admin/tenants/:tenantId/public-profile`, que exige
  `SUPERADMIN` o `SECURITY_ADMIN`: **un doctor no puede cambiar el de su propio
  consultorio.**

### Decisión pendiente (una de las dos)

1. **Columna `logo_file_id` en `practice.practice_sites`**, con el mismo molde que
   `bank_qr_file_id`: `SQL/patches/…_practice_sites_logo_file_id.sql` + FK a
   `common.files` + índice, empezando por el `.puml` del módulo 14 (ADR-0021: el
   DDL no se escribe a mano).
2. **Permitir que el dueño de un consultorio propio escriba el
   `avatar_file_id` de su perfil público de organización**, y leerlo de ahí.
   Evita un segundo logo que se contradiga con el de la vitrina, pero mezcla dos
   conceptos: el logo del papel y la foto pública.

### Contrato que el frontend ya espera

Va todo detrás de `LogoDelConsultorioClient`
(`core/data-access/practice-sites/logo-del-consultorio.client.ts`); el día que
exista el backend se cambia **ese archivo** y las pantallas y el PDF no se
tocan.

```http
PUT /practitioners/me/sites/:siteId/logo
{ "fileId": "<uuid de un archivo ya subido>" | null }
→ 200  la sede con el logo aplicado (mismo formato que la lista)
```

- `null` quita el logo. **Sólo el consultorio propio** (`isOwnSite`): en una
  clínica ajena responde `404`, indistinguible entre «no existe» y «no es tuyo».
- La lectura es `GET /practitioners/:profileId/sites`, que ya devuelve las sedes:
  sólo falta el campo `logoFileId` (opcional; ausente = «sin logo»).
- El archivo se sube antes con `POST /common/files/upload` como `IMAGE` de
  sensibilidad `NORMAL` (`upload-policy.ts` ya cita «el logo de una
  organización»). PNG, JPG o WEBP, hasta 2 MB.

### Lo que sigue abierto aunque llegue la ruta

- **Quién puede verlo.** `GET /common/files/:id/content` sólo entrega a quien
  subió el archivo, así que hoy el logo lo ve **su dueño**. Para que un paciente
  lo vea en un documento o en el directorio hace falta servirlo por
  `/public/media/<fileId>`.
- **El PDF oficial de la receta** sale de la API (`prescription-pdf.service.ts`,
  pdfkit) y **no lleva logo**; los otros dos generadores pdfkit
  (`encounter-pdf.service.ts`, `insurance-portability-pdf.service.ts`) tampoco.
  Los 12 documentos que arma el frontend (`buildBlocksPdf`) sí. pdfkit necesita un
  paso previo que baje el archivo y lo dibuje en la misma caja de 120×34 pt que
  usa el frontend (`LOGO_DEL_CONSULTORIO` en `pdf-theme.ts`).
- **El selector «Mi consultorio» del encabezado** no muestra logo
  (`TenantOption` no tiene imagen).
- **Simulador:** `PUT /practitioners/me/sites/:id/logo` y la semilla
  `file-logo-consultorio` (`practice.handlers.ts`, `files.handlers.ts`) son sólo
  maqueta y se borran cuando exista la ruta real. Los bytes de un logo recién
  subido viven en memoria: un F5 los pierde (limitación conocida del simulador).

## La firma y el sello médicos (2026-09-30)

Justin pidió que el doctor pueda **subir, ver, cambiar y quitar** su **firma** y su
**sello médico** desde su perfil («Datos personales», al mirar y al editar), que se
**estampen al pie de los documentos que emite** —los 12 del maquetador del
frontend— con su nombre y su matrícula debajo, y que el alta permita cargarlos como
paso **opcional**. El frontend está entregado contra el simulador de `mockup`;
**el backend no tiene dónde guardarlas.**

### Qué es y qué NO es

Son **imágenes**: la firma manuscrita escaneada o fotografiada, y el sello. **No es
una firma electrónica** —no hay certificado, ni criptografía, ni sello de tiempo, ni
validez legal por sí misma—. Si alguna vez se pide firma electrónica, es otro
trabajo (ver `clinical.prescription_signatures` y la política de firma de recetas D-05
en la API, que sí existen y no se tocan acá).

### Lo que hay hoy

- `profiles.practitioner_profiles` y `profiles.persons` sólo tienen `photo_file_id`.
  No hay columna ni tabla para la firma ni para el sello.
- `IamClient.registerPractitioner` **arma el cuerpo campo por campo**: las claves
  `signatureImageBase64` y `sealImageBase64` se mandan sólo si el alta las tiene, y
  **un DTO real con `forbidNonWhitelisted` las rechazaría con 400**. Hoy las atiende
  únicamente el simulador.

### Decisión pendiente

Un lugar donde viva cada imagen, por ejemplo dos columnas nuevas
`signature_image_file_id` y `seal_image_file_id` en `profiles.practitioner_profiles`
(con FK a `common.files` e índice, empezando por el `.puml` del módulo de perfiles,
ADR-0021), o una tabla de «activos del profesional» si se prevén más.

### Contrato que el frontend ya espera

Todo va detrás de `FirmaYSelloClient`
(`core/data-access/profiles/firma-y-sello.client.ts`); el día que exista el backend
se cambia **ese archivo** y las pantallas, el alta y el PDF no se tocan.

```http
GET /profiles/practitioners/me/signature-assets
→ 200 { "signatureFileId": "<uuid>" | null, "sealFileId": "<uuid>" | null }

PUT /profiles/practitioners/me/signature-assets
{ "signatureFileId"?: "<uuid>" | null, "sealFileId"?: "<uuid>" | null }
→ 200 lo mismo que el GET
```

- Una clave **ausente** deja lo que había; `null` quita esa imagen.
- Sólo el profesional de la sesión (`me`): no existe la forma de escribir la de otro.
- El archivo se sube antes con `POST /common/files/upload` como `IMAGE` de
  sensibilidad `NORMAL`. PNG, JPG o WEBP, hasta 2 MB cada una.
- Para el alta, o bien se admiten las dos claves `…Base64` como la foto
  (`profilePhotoBase64`), o se agrega un paso posterior a la primera sesión. Hoy el
  simulador hace lo primero.

### Lo que sigue abierto aunque llegue la ruta

- **El PDF oficial de la receta** sale de la API (`prescription-pdf.service.ts`,
  pdfkit) y **no lleva el bloque de firma**; tampoco los otros dos generadores
  pdfkit. Los 12 documentos del frontend (`buildBlocksPdf`) sí. pdfkit necesita un
  paso previo que baje las dos imágenes y las dibuje en las mismas cajas fijas del
  frontend (`FIRMA_Y_SELLO` en `pdf-theme.ts`: firma 150×56 pt, sello 56×56 pt).
- **Quién puede ver las imágenes.** `GET /common/files/:id/content` sólo entrega a
  quien subió el archivo: hoy la ve **su dueño**. Para que una receta impresa o
  descargada por un paciente las lleve, el PDF tiene que generarse del lado del
  servidor o las imágenes servirse por `/public/media/<fileId>`.
- **El nombre y la matrícula** del bloque salen de `getOwnPractitionerProfile`
  (`displayName` y la primera matrícula cargada). Falta decidir cuál matrícula
  imprimir cuando hay varias (vigente, de una jurisdicción concreta).
- **Simulador:** `GET/PUT …/signature-assets`, las semillas `file-firma-medica` y
  `file-sello-medica` y las claves `…ImageBase64` del alta (`firma-y-sello.handlers.ts`,
  `files.handlers.ts`, `auth.handlers.ts`) son sólo maqueta y se borran cuando exista
  la ruta real. Los bytes de una imagen recién subida viven en memoria: un F5 los
  pierde (limitación conocida).
