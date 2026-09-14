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
