# Mejora de adjuntos y registro de laboratorio

## Resultado solicitado y plan

El registro de laboratorio debe permitir seleccionar o arrastrar documentos y mostrar su contenido antes de continuar. El mismo patrón se propaga a los adjuntos del frontend, preservando las validaciones y las operaciones existentes.

1. **Inventario y baseline:** revisar `CLAUDE.md`, FABLE_STACK, las skills de diseño y calidad, los organismos y todos los `input[type=file]`. Capturar el registro original en cinco tamaños.
2. **Componente compartido:** extender `FileInput`, utilizado por `AttachmentUploader`; añadir `FilePreview` porque no existía un visor local reutilizable. Mantener tokens, teclado y área táctil.
3. **Registro:** conectar laboratorio, imagenología y los respaldos/títulos profesionales. Conservar los objetos `File` al cambiar de paso; presentar documentos en dos columnas cuando el motor lo permite y una en móvil.
4. **Propagación:** las cargas documentales heredan el selector y preview. Avatares, portadas y comentarios conservan sus controles compactos y reciben arrastre con la directiva `FileDropTarget`. El chat utiliza la misma vista previa.
5. **Verificación:** compilar, verificar tipos/lint, ejecutar pruebas afectadas y Playwright serial. Revisar evidencia de forma independiente y corregir hallazgos.

## Implementación

| Superficie | Cambio |
|---|---|
| Laboratorio | Seis documentos con arrastre, preview, reemplazo y eliminación; mismos tres obligatorios y límite de 5 MB |
| Imagenología | Siete documentos con el mismo patrón, incluida radioprotección opcional |
| Registro profesional | Diploma, respaldos de habilitación y títulos adicionales con preview; arrastre en foto |
| `AttachmentUploader` | Hereda preview y mejoras de selección; conserva subida y vinculación existentes |
| Verificación de identidad | Hereda selector y preview; conserva límites y contrato del trámite |
| Importación de terminología | Preview textual seguro para JSON/NDJSON/JSONL, limitado a los primeros 64 KB |
| Fotos y portadas de perfiles | Arrastre sobre controles existentes; misma validación, subida y avatar resultante |
| Comentarios | Arrastre en botones de medios; respeta `accept` antes de ejecutar subida |
| Chat | Arrastre sobre compositor y preview compartida para imagen/PDF/audio/video |

La preview se genera localmente: imagen con `FileReader`, PDF con PDF.js cargado bajo demanda y worker servido por la aplicación, audio/video con URL temporal revocada al reemplazar o desmontar. El texto se interpola como texto, nunca como HTML. No se envía un documento a un servicio externo para previsualizarlo.

Referencia técnica del visor: [ejemplos oficiales de PDF.js](https://mozilla.github.io/pdf.js/examples/). El worker se incorpora desde la dependencia versionada a través de `angular.json`.

Los PDF tienen navegación entre páginas. Archivos dañados o formatos sin representación compatible (por ejemplo, documentos Office en un selector de aceptación libre) muestran una explicación; no se inventa una preview. Seleccionar un reemplazo inválido conserva el documento anterior. Los errores de selección se anuncian y se asocian al control.

## Alcance de la evidencia

Repositorio: `mantra-core-health`, rama inicial `justin/mockup-alta-imagenologia`, base `7abe8fe840c6703e00f1cfbaf2972f8512af57b1`. Runtime: `http://localhost:4200`. Navegador: Chromium. Rol: público; el stock de componentes es una herramienta de desarrollo.

El registro de laboratorio y el de imagenología ya eran **maquetas sin endpoint de alta**. Este cambio verifica selección y preview reales en el navegador; no acredita envío ni persistencia en backend de esos registros. Los pipelines autenticados existentes se preservan y su regresión se verifica con pruebas del repositorio.

Evidencia en `evidence/file-upload/`: capturas originales, capturas posteriores, PDFs e imágenes de prueba y manifests con ruta, viewport, consola y peticiones fallidas. La prueba repetible es `playwright/file-upload-preview.spec.ts`, siempre con `--workers=1`.

## Hallazgos previos separados del cambio

- El test de identidad `encadena la apertura del caso con el identificador de la subida` espera `{id,status}`, pero el estado incluye también `type: PATIENT_IDENTITY`. Reproducido con el mismo fallo en un worktree intacto del SHA base: 19 pasan y 1 falla. No se debilitó la aserción.
- Los dos avisos CSP de scripts inline de `ng serve` también se reprodujeron en el SHA base, servido en `localhost:4201`. Los mensajes exactos están en `evidence/file-upload/baseline/console.json`; el test compara esos mensajes exactos y falla ante errores nuevos.
- `check-form-pages` señala cinco formularios sin paginar en organizaciones y activos/pasivos, archivos fuera de esta modificación.

## Resultado de la verificación

| Comprobación | Resultado |
|---|---|
| `yarn build` | PASS, con avisos de dependencias/imports existentes |
| `yarn lint` y `yarn typecheck` | PASS |
| Pruebas focalizadas Angular | PASS: 403 pruebas, 19 archivos |
| Pruebas de cabeceras CSP con Vitest | PASS: 25 pruebas |
| `yarn pw playwright/file-upload-preview.spec.ts --workers=1` | PASS: 10 escenarios |
| `check-css-tokens` | PASS: sin referencias a tokens inexistentes |
| `check-architecture` | PASS: sin ciclos ni violaciones de capas |
| `git diff --check` | PASS |
| Regresión de identidad ampliada | Fallo previo reproducido en SHA base; detalle arriba |
| `check-form-pages` | Los mismos cinco hallazgos fuera de alcance, reproducidos en SHA base |

Playwright verifica 390×844, 768×1024, 1024×768, 1440×900 y 1920×1080; selección por teclado, arrastre, decodificación de imágenes y PDF, paginación, reemplazo, tamaño/formato inválidos, nombre largo, eliminación, obligatoriedad, navegación entre pasos, tema oscuro, documento dañado, texto, audio, video y rechazo en comentarios. Los videos y audios de prueba se decodifican en Chromium; no se comprueba solamente que exista una etiqueta.

Logs literales: `evidence/file-upload/logs/`. Las capturas no incluyen documentos reales de pacientes. Revisión visual independiente del laboratorio: **93/100**.

## Verificación previa al commit y push a mockup

La entrega se preparó sobre `origin/mockup` en `f57b50f3`, incorporando sus cambios posteriores al baseline original sin conflictos. Compilación, tipos y lint: PASS. Playwright repetido sobre esa base: **10/10 PASS**.

La suite Angular completa ejecutó **5.243 pruebas: 5.241 PASS y 2 FAIL**. Además del fallo de identidad ya identificado, la prueba de navegación detecta que el catálogo de iconos no incluye `edit` en ambas listas. Los dos fallos se reprodujeron ejecutando esos specs sobre un worktree intacto de `origin/mockup`: 54 PASS y los mismos 2 FAIL. Se conservaron las aserciones y no se modificaron esos módulos.

Evidencia adicional: `logs/push-full-tests.log`, `logs/push-baseline-tests.log`, `logs/push-build.log` y `logs/push-playwright.log`. En los logs versionados sólo se eliminaron espacios finales y líneas vacías finales para cumplir `git diff --check`.
