# Doble local del historial laboral (H4.S3, regla 65)

## H4.S3.M1 — lo que existe realmente (`DISCOVERED`)

- `ProfilesClient` (`src/app/core/data-access/profiles/profiles.client.ts`) expone
  `listAffiliations()` y `addAffiliation()` para `PractitionerAffiliation`. **No hay** método de
  actualización ni de baja (ni `update`, ni `remove`, ni `patch`, ni `delete`) — confirmado leyendo
  el archivo completo, no por ausencia de búsqueda.
- `PractitionerAffiliation` (`profiles.types.ts`) no tiene campo `fileId` ni ningún campo de
  adjunto — confirmado leyendo la interfaz completa.
- El manejador simulado de afiliaciones vive en un archivo reservado a Itzan
  (`core/mock/handlers/profiles.handlers.ts`, ver la ficha de asignación del carril, §0), así que
  agregar ahí el `PATCH`/`DELETE` y el campo `fileId` está fuera de mi alcance esta noche (regla 00
  §3: no tocar archivos ajenos).

## H4.S3.M2 — pedido y doble

**Pedido anotado** (a publicar en el daily de equipo, H4.S3.M8): Itzan, para que el historial
laboral tenga edición y baja reales, `profiles.handlers.ts` necesita:
1. `PATCH /profiles/practitioners/me/affiliations/:id` (cuerpo: `{ roleTitle?, fileId? }`).
2. `DELETE /profiles/practitioners/me/affiliations/:id`.
3. Un campo `fileId: string | null` en `PractitionerAffiliation`.

**Mientras tanto**, `work-history.ts` aísla el contrato detrás de un doble **local, declarado y en
memoria** (no persiste entre recargas — se dice así en el código, en el `PLAN.md` y acá, nunca como
`VERIFIED` a secas):

- `edicionesLocalesDeAfiliacion: Signal<ReadonlyMap<string, {roleTitle, fileId}>>` — las
  correcciones de cargo y adjunto, superpuestas en `afiliacionesEnTabla` sobre lo que
  `listAffiliations()` trae real del simulador.
- `idsRetiradosLocalmente: Signal<ReadonlySet<string>>` — las bajas, aplicadas como filtro.

### Los tres niveles del contrato, ejercitados (regla 65 §2.3)

| Nivel | Qué se probó | Dónde |
|---|---|---|
| **Correcto** | Editar el cargo de una afiliación existente y confirmar → el doble lo aplica, sin `PATCH` real | `work-history.spec.ts` — «guardar el cargo editado pide confirmación y lo aplica sólo al doble local, sin PATCH real (nivel correcto)»; verificado también en navegador real (`evidencia/h4s3/capturas/h4s3-guardado.png`): «Clínica Los Olivos» pasa de «Jefa de servicio» a «Jefa de guardia» |
| **Límite** | Si `afiliaciones()` se relee del servidor y un id editado localmente ya no está en la respuesta, el `Map.get()` no encuentra la fila y el dato local queda huérfano sin romper nada (no inventa una fila que el servidor no mandó) — documentado como comentario en `work-history.ts:1352-1361` | Lectura del código + `afiliacionesEnTabla` sólo mapea sobre lo que `afiliaciones()` trae, nunca sobre las claves del `Map` |
| **Inválido** | No confirmar el guardado → no se aplica el cambio, el modal sigue abierto | `work-history.spec.ts` — «si no se confirma el guardado, el cargo no cambia y el modal sigue abierto (nivel inválido)» |

Mismo patrón para «retirar» (correcto: confirmar retira sin `DELETE` real, verificado en spec y en
navegador — `evidencia/h4s3/capturas/h4s3-retirado.png`, toast «Ya no figura en tu historial
(guardado en este dispositivo)»; límite/negativo: no confirmar deja la fila).

### Lo que NO es parte del doble

La **subida del archivo en sí** (`FilesClient.upload()`, `POST /common/files/upload`) es real y
comparte infraestructura ya usada por `practitioner-profile-edit.ts` y `site-bank-qr-dialog.ts`
para otros adjuntos. Verificado en navegador: seleccionar un archivo y guardar dispara el `POST`
real contra el simulador y el `fileId` devuelto queda asociado a la fila en el doble local
(`evidencia/h4s3/capturas/h4s3-editar-modal.png` → flujo completo en `work-history.spec.ts`, tests
de subida correcta e inválida).

## Qué falta contra lo real

Todo lo de este documento queda sin efecto en cuanto Itzan publique el `PATCH`/`DELETE` reales y el
campo `fileId`: en ese momento `aplicarEdicionLocal`/`retirarAfiliacionLocal` se reemplazan por
llamadas HTTP reales y el `Map`/`Set` local se puede borrar. Mientras tanto, **recargar la página
pierde las ediciones y bajas** hechas en este dispositivo — se declara así en el `REPORTE.md`, nunca
como `VERIFIED` a secas.
