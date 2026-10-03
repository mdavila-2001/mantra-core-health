# Reporte — Firma/sello del registro hacia el backend real

- Fecha: 2026-10-03. [Plan](./PLAN.md).
- Rama: marcelo/feat-firma-sello-registro; base frontend dev ae80aba7.
- Evidencia: TESTED para frontend; VERIFIED para el HTTP y la persistencia de la API hermana. No E2E de navegador.
- Avance conjunto: 9 / 9 microtareas (100%); entrega de código y verificaciones dirigidas.

## Completado

| ID | Resultado | Evidencia |
|---|---|---|
| H1.S1.M1 | Precarga privada de imagen en API | Jest API: 5 suites PASS |
| H1.S1.M2 | Reclamación y vínculo de referencias | Jest API: 159 PASS |
| H1.S1.M3 | API compila | Docker build: salida 0 |
| H1.S1.M4 | Patch canónico idempotente | psql: salida 0 dos veces; dos columnas uuid nullable |
| H1.S2.M1 | Cliente/formulario suben multipart y envían fileId | Vitest: 2 archivos PASS |
| H1.S2.M2 | Fallo/reintento conserva la primera carga | Vitest: 157 PASS |
| H1.S2.M3 | Build productivo con API real | `yarn build --configuration production`: salida 0; `Application bundle generation complete. [169.088 seconds]` |
| H1.S3.M1 | Registro/consulta/descarga con PostgreSQL real | integración API: 2 PASS; bytes y rollback verificados |

| H1.S3.M2 | PRs publicados hacia dev | API #549; frontend #907; base dev |

[Resumen sanitizado](./evidencia/VALIDACION.txt). ESLint dirigido: salida 0, sin diagnósticos.

## A medias

- No se ejercitó el formulario desplegado en navegador. Los tests de Angular interceptan HTTP; la persistencia se comprueba en el arnés real del productor, sin sustituir sus servicios por mocks.
- Tres fallos del arnés general heredado de la API se reproducen en el código original de dev. Las pruebas nuevas pasan; no se afirma verde global.

## No hecho

- Merge, despliegue y aplicar patch en la base de AloVida Dev.
- Estampado de firma/sello en PDFs oficiales de la API; limpieza automática de precargas abandonadas.

## Cambio y coordinación

En API real, el formulario precarga cada imagen por `POST /iam/auth/upload-registration-signature-image` y envía `signatureFileId`/`sealFileId` al registro. No manda base64 al DTO real. Si falla una carga no crea la cuenta; guarda en memoria las cargas confirmadas para reintentar. La imagen cambiada se vuelve a cargar; una imagen quitada deja de enviarse. El simulador conserva su contrato existente.

Integra el control central del cliente que proponía Pablo (#902), pero además carga y persiste las imágenes como pidió el usuario; no se acepta la omisión silenciosa de imágenes. No incorpora todos los cambios históricos de #902 ni de test/#904.

Orden: aplicar patch del modelo (ya mergeado en #44) → API #549 → frontend. No mergear encima la versión antigua de #902 que descarta las referencias nuevas. Revertir este PR permite restaurar el contrato anterior del formulario; conservar el esquema nullable y los archivos existentes.

Los contenedores temporales se eliminan con --rm; bases temporales ya eliminadas. Ningún servicio del despliegue se reinició.

## PRs y estado remoto

- API: https://github.com/mdavila-2001/mantra-core-health-api/pull/549
- Frontend: https://github.com/mdavila-2001/mantra-core-health/pull/907
- Ambos listos para revisión, sin conflictos al publicar; CI remoto pendiente. Orden: patch → API → frontend.
- Las bases temporales PostgreSQL y MongoDB se eliminaron; no queda un contenedor temporal de verificación.
