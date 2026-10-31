/* ============================================================================
    ESPEJO DE LA API (copia, no se edita a mano).

    Este archivo es la copia de `mantra-core-health-api/src/modules/clinical_import/clinical-import.messages.ts`.
    La maqueta valida y genera plantillas con el MISMO código que la API, para
    que lo que se ve en pantalla (vista previa, errores por fila, plantillas
    CSV y JSON) sea lo que dirá la API. Si cambia el esquema en la API, se
    vuelve a copiar; no se corrige acá.
    ========================================================================== */

/**
 * Mensajes estables por motivo. Es el ÚNICO lugar donde un motivo se vuelve
 * texto: así ningún mensaje puede interpolar el valor de una celda por
 * descuido (regla 90.2.1: se informan identificadores y motivos, no contenido).
 */
export const ISSUE_MESSAGES: Readonly<Record<string, string>> = {
  FILE_UNREADABLE: 'No se pudo leer el archivo',
  FILE_EMPTY: 'El archivo no trae filas',
  KIND_MISMATCH: 'El archivo es de otro tipo de carga',
  COLUMN_MISSING: 'Falta una columna obligatoria',
  UNKNOWN_FIELD: 'Hay una columna que no figura en la plantilla',
  DUPLICATE_COLUMN: 'Hay una columna repetida',
  REQUIRED: 'El campo es obligatorio',
  INVALID_FORMAT: 'El valor no tiene el formato esperado',
  TOO_LONG: 'El valor es más largo que el máximo',
  OUT_OF_RANGE: 'El valor está fuera de rango (por ejemplo, una fecha futura)',
  FIELD_COMBINATION_INVALID: 'La combinación de campos no es válida',
  DUPLICATE_IN_FILE: 'La misma clave de origen ya vino en una fila anterior',
  PATIENT_NOT_FOUND:
    'No hay un paciente que coincida con el documento y la fecha de nacimiento',
  PATIENT_AMBIGUOUS:
    'Más de un paciente coincide con el documento y la fecha de nacimiento',
  CONSENT_REVOKED:
    'El paciente revocó su consentimiento: no se agregan registros',
  CODE_NOT_FOUND: 'El código no existe en la terminología',
  CODE_AMBIGUOUS: 'El código coincide con más de un concepto',
  PRACTITIONER_NOT_FOUND: 'No hay un profesional con esa matrícula',
  PRACTITIONER_AMBIGUOUS: 'Más de un profesional tiene esa matrícula',
  RESOLUTION_UNAVAILABLE:
    'No se pudo consultar el padrón de pacientes o la terminología',
  ALREADY_LOADED: 'Ya existía un registro idéntico de este origen',
  CONTENT_CONFLICT:
    'Existe un registro de este origen con otro contenido; no se sobrescribe',
  WRITE_FAILED: 'No se pudo escribir la fila',
  ROW_TIMEOUT: 'Se agotó el plazo de la fila',
  BATCH_TIMEOUT: 'Se agotó el plazo del lote',
  RUNNER_ERROR: 'El procesamiento se interrumpió',
  KIND_UNKNOWN: 'El tipo de registro no existe',
  FORMAT_UNSUPPORTED: 'El formato debe ser csv o json',
  SOURCE_MISSING: 'Falta el archivo',
  DECLARATION_INVALID:
    'La declaración del lote (origen, base legal y fecha) es inválida o está incompleta',
  FILE_TOO_LARGE: 'El archivo supera el tamaño máximo',
  ROW_LIMIT_EXCEEDED: 'El lote supera la cantidad máxima de filas',
  IDEMPOTENCY_KEY_REQUIRED: 'Falta una clave de idempotencia válida',
  IDEMPOTENCY_KEY_REUSED: 'La clave de idempotencia ya se usó en otro lote',
  BATCH_NOT_AVAILABLE: 'El lote no existe',
  BATCH_NOT_CONFIRMABLE: 'El lote no está en un estado confirmable',
  BATCH_ALREADY_CONFIRMED: 'El lote ya fue confirmado con otra clave',
  REPORT_NOT_READY: 'El lote todavía no terminó',
  AUDIT_UNAVAILABLE:
    'No se pudo dejar el rastro de auditoría: sin rastro no se escribe más',
};

/** El texto de un motivo; uno desconocido se devuelve como código, nunca como dato. */
export function messageFor(code: string): string {
  return ISSUE_MESSAGES[code] ?? code;
}
