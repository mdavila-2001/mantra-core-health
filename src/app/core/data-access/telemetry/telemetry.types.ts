/**
 * Contrato de `POST /telemetry/activity-events` (UC-28-07).
 *
 * Copia de `CaptureActivityEventsDto` y `ActivityEventsResponseDto` de
 * `mantra-core-health-api/src/modules/telemetry/dto/activity-event.dto.ts`.
 * La API valida con `forbidNonWhitelisted`: una clave que no esté acá vuelve
 * 400 el lote entero.
 */

/** Una propiedad del evento. Solo una de las tres `value*` por propiedad. */
export interface ActivityEventProperty {
  readonly propertyName: string;
  readonly valueType: 'STRING' | 'NUMBER' | 'BOOLEAN';
  readonly valueString?: string;
  readonly valueNumber?: number;
  readonly valueBoolean?: boolean;
}

/**
 * Un evento del lote.
 *
 * **No lleva `userId`, `sessionId` ni `tenantId`**: la identidad la pone el
 * servidor desde el token (usuario y sesión `sid`) y el contexto de tenant, y
 * el `ValidationPipe` global (`forbidNonWhitelisted`) responde 400 al lote que
 * mande cualquiera de los tres. Contrato en
 * `docs/trabajo/2026-10-31-portal-observabilidad-gobierno/evidencia-f0/CONTRATO-ingesta-ux.md`.
 */
export interface ActivityEvent {
  /**
   * Esquema registrado en la API; de él sale el propósito del consentimiento.
   * `ux_interaccion` v2 exige consentimiento `GRANTED`; `pagina_vista_anonima`
   * (propósito agregado) no lo exige y no admite propiedades.
   */
  readonly eventSchemaDefinitionId: string;
  /** Override del nombre del esquema: `pagina_vista`, `clic`… */
  readonly eventName: string;
  /** Un uuid por evento: un reenvío del mismo lote no duplica nada. */
  readonly eventIdempotencyKey: string;
  /** Plantilla, nunca la URL: `/pacientes/:id`, no `/pacientes/8437`. */
  readonly routeTemplate: string;
  readonly occurredAt: string;
  readonly properties: readonly ActivityEventProperty[];
}

export interface CaptureActivityEvents {
  /** Entre 1 y 500 eventos. */
  readonly events: readonly ActivityEvent[];
}

export interface CaptureActivityEventsResult {
  /** Eventos persistidos. */
  readonly inserted: number;
  /** Descartados por falta de consentimiento o por reenvío. */
  readonly skipped: number;
  readonly eventIds: readonly string[];
  readonly sessionJourneyId?: string;
}
