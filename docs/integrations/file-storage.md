# Archivos

Una operación de subida, ninguna de descarga. La sensibilidad del contenido se
declara explícitamente en cada envío.

---

## `POST /common/files/upload`

```ts
upload(file: File, category: FileCategory, sensitivity: FileSensitivity): Observable<UploadedFile>
```

| Parámetro | Valores | Nota |
|---|---|---|
| `file` | `File` | El campo del formulario se llama `file` |
| `category` | `'DOCUMENT'` · `'IMAGE'` | Los dos únicos que admite el backend |
| `sensitivity` | `'NORMAL'` · `'PHI'` | **Ver abajo** |

Respuesta: `{ id: string }`.

## `PHI` no es una etiqueta decorativa

```ts
/**
 * Sensibilidad del contenido. `PHI` marca información de salud protegida y
 * cambia cómo se guarda y quién puede descargarla: no es una etiqueta
 * decorativa, así que se pide explícita en cada subida.
 */
export type FileSensitivity = 'NORMAL' | 'PHI';
```

**Es un parámetro obligatorio, no opcional con valor por defecto.** La diferencia
importa: un valor por defecto haría que el caso silencioso fuera `NORMAL`, y un
documento clínico subido por descuido quedaría guardado sin la protección que le
corresponde.

Obligarlo fuerza la decisión en cada llamada.

## El `Content-Type` lo pone el navegador

```ts
const form = new FormData();
form.append('file', file);
form.append('category', category);
form.append('sensitivity', sensitivity);

return this.http.post<UploadedFile>(apiUrl(this.baseUrl, '/common/files/upload'), form);
```

> *«**no se fija el `Content-Type` a mano**. El navegador tiene que ponerlo él
> para incluir el `boundary`, y escribirlo rompe la petición del lado del
> servidor.»*

Es el error más común con `multipart/form-data`, y está evitado con un comentario
que explica por qué.

## El componente: `app-file-input`

| Entrada | Para qué |
|---|---|
| `multiple` | Varios archivos |
| `disabled` | |
| `accept` | Tipos admitidos |
| `maxSizeBytes` | Tamaño máximo |
| `maxFiles` | Cantidad máxima |

| Modelo / salida | |
|---|---|
| `files` (modelo) | La selección |
| `rejected` (salida) | Los que no pasaron los límites |

**Que `rejected` sea una salida separada es lo correcto**: el componente no
decide qué mensaje mostrar, avisa qué rechazó y la pantalla decide.

Consume `FORM_CONTROL_CONTEXT`, así que dentro de un `app-form-field` obtiene
nombre accesible, `aria-describedby` y estado de error.

## Sin consumidor todavía

**Ninguna pantalla sube archivos hoy.** `FilesClient` y `app-file-input` existen,
están probados y se exhiben en la vitrina, pero su primer uso real será el flujo
de verificación de identidad:

```text
FilesClient.upload(evidencia, 'DOCUMENT', 'PHI')  →  { id }
      ↓
IdentityClient.requestPatientIdentityVerification({ evidenceFileId: id })
      ↓
IdentityClient.getVerificationCase(caseId)
```

La cadena está completa del lado de los datos. Falta la pantalla — y falta que
`IDENTITY_VERIFICATION_ROUTE` apunte a una ruta de Angular y no a una de la API.
Ver [el mapa de integraciones](../architecture/integration-map.md#3--operaciones-sin-consumidor).

## Lo que no hay

| Elemento | Estado | Impacto cuando se use |
|---|---|---|
| **Descarga de archivos** | No existe ninguna operación | Alto: subir evidencia sin poder verla es medio flujo |
| Progreso de subida | `HttpClient` lo soporta con `reportProgress`; no se usa | Medio: un documento grande sin barra parece colgado |
| Cancelación | No existe | Medio |
| Reanudación | No existe | Bajo |
| Vista previa antes de subir | No existe | Bajo |
| Validación de tipo real (magic bytes) | Solo `accept`, que es una sugerencia del navegador | **Lo valida el backend, que es donde corresponde** |
| Subida directa a almacenamiento (S3 presignado) | No. Todo pasa por la API | — |
| Antivirus / análisis | Del lado del backend | — |

### La descarga es la ausencia que más va a doler

Se puede subir evidencia y no se puede recuperarla. Para el flujo de verificación
alcanza —la revisa alguien del otro lado— pero cualquier funcionalidad de
historia clínica con adjuntos la necesita.

Registrada en [el análisis de brechas](../reports/documentation-gap-analysis.md).

## Reglas al implementar la primera pantalla de subida

1. **`sensitivity: 'PHI'` para cualquier cosa clínica.** Ante la duda, `PHI`.
2. **Límites en el componente y en el backend.** `maxSizeBytes` evita el viaje;
   `PAYLOAD_TOO_LARGE` (que ya se traduce a S4 con el mensaje «El archivo es
   demasiado grande») lo hace cumplir.
3. **Nunca poner el `Content-Type` a mano.**
4. **El identificador devuelto no es una URL.** Es un `id` que otra operación
   consume; no se puede pegar en un `<img src>`.
5. **Nada de nombres de archivo en registros ni en telemetría**: un nombre puede
   ser identificable por sí solo.
