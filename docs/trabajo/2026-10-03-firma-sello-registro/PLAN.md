# Plan — Persistir firma y sello desde el registro profesional

- Fecha: 2026-10-03. Rama nueva: marcelo/feat-firma-sello-registro, desde origin/dev en cada repositorio.
- Resultado: las imágenes elegidas en el alta se suben y quedan vinculadas al perfil real.
- Predecesor: PRs 902/904 del frontend, que omiten imágenes; contrato autenticado de firma/sello ya incorporado al backend dev.
- Kill-test: un alta exitosa con imágenes no guarda sus fileId en el perfil.

## Alcance

IN: precarga multipart limitada de imágenes de firma/sello, referencias UUID en RegisterPractitionerDto, reclamación transaccional de archivos y vínculo al perfil; cliente y formulario para cargar antes del alta, manteniendo progreso al reintentar; pruebas y PRs vinculados contra dev.
OUT: aceptar base64 en el DTO real, aumentar límites JSON, nuevos cambios de modelo, refactor visual, integrar todo test o cambios clínicos/chat, desplegar y borrar datos.
La aclaración del usuario exige enviar y guardar firma/sello, no simplemente suprimirlos. Se sustituye la propuesta de omitir imágenes por un flujo real de archivos. Reutilizar la precarga anónima existente, con límites, firma binaria y reclamación; los archivos abandonados mantienen la deuda de limpieza ya documentada por el flujo de PDF.

## H1 — Alta con persistencia real
**CA:** Dado un profesional con imágenes, cuando completa el alta, entonces el perfil referencia sus archivos privados.
**DoD:** pruebas dirigidas, builds, comprobación real con datos sintéticos, PRs vinculados.
**Estado:** HECHO

### H1.S1 — API
**CA:** Dado un archivo elegible, cuando se precarga y registra, entonces se valida y reclama dentro de la transacción del alta.
**DoD:** Jest serial en los specs afectados y build del backend.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Precarga de imagen | Dado contenido inválido o mayor a 2 MB, cuando se sube, entonces se rechaza | specs de subida y controlador → PASS | HECHO |
| H1.S1.M2 | Vincular firma/sello | Dado un archivo ajeno o inválido, cuando se registra, entonces falla sin alta parcial | specs de registro, DTO y repositorio → PASS | HECHO |
| H1.S1.M3 | Compilar API | Dado el nuevo contrato, cuando se compila, entonces no hay errores | `yarn build` → salida 0 | HECHO |

### H1.S2 — Frontend
**CA:** Dadas imágenes elegidas, cuando se registra contra API real, entonces viajan como fileId tras subir sus bytes.
**DoD:** Vitest dirigido, build Angular y comprobación del contrato.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Conectar precarga | Dada firma/sello, cuando se envía el alta, entonces no envía base64 al DTO real | specs del cliente y registro → PASS | HECHO |
| H1.S2.M2 | Manejar fallo/reintento | Dada una carga fallida, cuando se reintenta, entonces conserva cargas confirmadas sin duplicarlas | spec dirigido → PASS | HECHO |
| H1.S2.M3 | Compilar frontend | Dado el flujo nuevo, cuando se construye, entonces las plantillas compilan | `yarn build` → salida 0 | HECHO |

### H1.S3 — Entrega
**CA:** Dada la implementación, cuando se publica, entonces se revisa contra dev con evidencia y límites explícitos.
**DoD:** revisar diff, ejercitar camino real, abrir PRs; backend primero.
**Estado:** HECHO

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S3.M1 | Comprobar persistencia | Dado un registro sintético, cuando se consulta el perfil, entonces conserva ambos fileId | ejecución HTTP y consulta real → PASS | HECHO |
| H1.S3.M2 | Publicar PRs | Dadas ramas nuevas, cuando se publican, entonces apuntan a dev y se vinculan | `gh pr view --json url,baseRefName` | HECHO |

## Riesgos
Las precargas abandonadas permanecen sin dueño como los PDF existentes; no ampliar permisos públicos de lectura. Coordinar API antes del frontend. No registrar nombres, imágenes ni credenciales en evidencia. No declarar E2E completo sobre dobles unitarios.

## Ajuste de alcance por evidencia real

El esquema aplicado carece de signature_file_id/seal_file_id (SQLSTATE 42703). El modelo dev ya incorporó ambos y su patch en PR #44, commit b6587c7; se copia ese patch canónico sin modificarlo al snapshot SQL de la API y se aplica solo en la base aislada. Se requiere aplicar el mismo patch durante el despliegue.

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M4 | Incorporar el patch canónico | Dado un esquema anterior, cuando se aplica dos veces, entonces existen columnas/FK/índices compatibles | `psql -v ON_ERROR_STOP=1 -f 2026-10-03_profiles_signature_assets.sql` dos veces; consulta information_schema → 2 columnas nullable | HECHO |

La primera corrida de integración fría superó 180 s durante la siembra de 38 501 registros/25 etapas; el seed terminó sin fallos. Se repite sobre esa base ya inicializada, sin cambiar timeouts. Tres casos heredados del arnés general fallan por fixtures de geografía/registro asistido; se comprobará su estado también en el código base. Las pruebas nuevas de firma/sello se mantienen en un spec propio con las mismas aserciones.

Documentación dentro del alcance: actualizar la sección de firma/sello de docs/pendientes-backend-perfil-profesional.md, conservando los pendientes de PDF. La prueba de persistencia descarga ambos archivos con JWT y compara sus bytes.

## Entrega y límites

API: https://github.com/mdavila-2001/mantra-core-health-api/pull/549
Frontend: https://github.com/mdavila-2001/mantra-core-health/pull/907
Ambos apuntan a dev, listos para revisión por la preferencia previa del usuario. CI remoto pendiente. Sin merge ni despliegue; no se afirma verde global. Bases temporales eliminadas y ningún contenedor de prueba persistente.
