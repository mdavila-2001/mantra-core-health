/**
 * Tipos de la vista para `geo` (M13): sujetos rastreados, sesiones, pings,
 * viajes y geocercas.
 *
 * ## Tres cosas del contrato que sorprenden y no son errores
 *
 * - **Las coordenadas entran como número y salen como texto.** El `POST` de
 *   pings las valida con `@IsLatitude`/`@IsLongitude` sobre `number`, y la
 *   lectura las devuelve `string` porque son `numeric` de Postgres. La asimetría
 *   es del backend y se respeta: convertirlas al leer perdería decimales.
 * - **`state`, `status`, `subjectType`, `shapeType` y `eventType` de las
 *   respuestas son uuid de concepto**, no las palabras que se mandan al crear.
 *   Para mostrarlos como texto hay que resolverlos contra terminología.
 * - **`distanceM` de un viaje también es texto**, por lo mismo que las
 *   coordenadas; `durationS`, en cambio, es un entero y llega como número.
 */

/** Qué se rastrea. */
export type TrackedSubjectType = 'PERSON' | 'VEHICLE';

/** Por dónde se reportó el ping. */
export type PingNetwork = 'CELLULAR' | 'WIFI';

/** Forma de una geocerca. Cada una exige campos distintos. */
export type GeofenceShapeType = 'CIRCLE' | 'POLYGON';

/** Sentido del cruce. Dos iguales seguidos son un 409: el evento es idempotente. */
export type GeofenceEventType = 'ENTER' | 'EXIT';

/* -- Sujetos rastreados ---------------------------------------------------- */

/**
 * Alta de un sujeto.
 *
 * `tenantId` es un **campo de propiedad**: si se manda, tiene que coincidir con
 * el `X-Tenant-Id` de la petición o el backend responde 403. Conviene omitirlo
 * y dejar que lo resuelva el interceptor.
 */
export interface NewTrackedSubject {
  readonly subjectId: string;
  readonly subjectType?: TrackedSubjectType;
  readonly deviceId?: string;
  readonly tenantId?: string;
}

export interface TrackedSubject {
  readonly id: string;
  readonly subjectId: string;
  /** uuid de concepto, no `'PERSON'`. */
  readonly subjectType: string;
  readonly state: string;
  readonly createdAt: Date;
}

/** Un punto reportado por el dispositivo. */
export interface LocationPing {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracyM?: number;
  readonly altitudeM?: number;
  readonly speedMps?: number;
  readonly headingDeg?: number;
  /** Entero de 0 a 100. */
  readonly batteryPct?: number;
  readonly network?: PingNetwork;
  readonly deviceId?: string;
  /** ISO 8601. */
  readonly capturedAt?: string;
}

/** Lote de ingesta. El backend acepta de 1 a 1000 por petición. */
export interface PingBatch {
  readonly pings: readonly LocationPing[];
}

export interface PingsIngested {
  readonly recorded: number;
}

/**
 * La última posición conocida.
 *
 * Latitud, longitud y precisión son **texto** a propósito: ver la nota de la
 * cabecera. El componente las formatea para mostrar, no las convierte.
 */
export interface LastPosition {
  readonly pingId: string;
  readonly trackedSubjectId: string;
  readonly latitude: string;
  readonly longitude: string;
  readonly accuracyM?: string;
  readonly capturedAt?: Date;
  readonly recordedAt: Date;
}

/* -- Sesiones y viajes ----------------------------------------------------- */

/** Un sujeto tiene como mucho una sesión abierta, y debe estar activo. */
export interface NewTrackingSession {
  readonly trackedSubjectId: string;
  readonly purposeConceptId?: string;
  readonly relatedResourceType?: string;
  readonly relatedResourceId?: string;
}

export interface TrackingSession {
  readonly id: string;
  readonly trackedSubjectId: string;
  /** uuid de concepto. */
  readonly status: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

/** Una sesión abierta admite como mucho un viaje en curso. */
export interface NewTrip {
  readonly trackingSessionId: string;
  readonly originAddressId?: string;
  readonly destinationAddressId?: string;
}

/** Cierre de un viaje. Las dos medidas son opcionales y no negativas. */
export interface TripClosure {
  readonly distanceM?: number;
  readonly durationS?: number;
}

export interface Trip {
  readonly id: string;
  readonly trackingSessionId?: string;
  /** uuid de concepto. */
  readonly status: string;
  /** Texto: `numeric` de Postgres. */
  readonly distanceM?: string;
  readonly durationS?: number;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

/* -- Geocercas ------------------------------------------------------------- */

/**
 * Alta de una geocerca.
 *
 * `tenantId` es **obligatorio** acá —a diferencia del sujeto rastreado— y sigue
 * siendo campo de propiedad: tiene que coincidir con `X-Tenant-Id`.
 *
 * La coherencia forma/geometría la valida el servicio, no el DTO: un `CIRCLE`
 * sin radio y centro, o un `POLYGON` sin `geometryJson`, es un 422.
 */
export interface NewGeofence {
  readonly tenantId: string;
  readonly name: string;
  readonly shapeType: GeofenceShapeType;
  readonly radiusM?: number;
  readonly centerLat?: number;
  readonly centerLng?: number;
  readonly geometryJson?: Record<string, unknown>;
}

export interface Geofence {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  /** uuid de concepto. */
  readonly shapeType: string;
  readonly state: string;
  readonly createdAt: Date;
}

/** Un cruce. Repetir el mismo sentido consecutivo es un 409. */
export interface NewGeofenceEvent {
  readonly geofenceId: string;
  readonly trackedSubjectId: string;
  readonly eventType: GeofenceEventType;
  readonly locationPingId?: string;
  /** ISO 8601. */
  readonly occurredAt?: string;
}

export interface GeofenceEvent {
  readonly id: string;
  readonly geofenceId: string;
  readonly trackedSubjectId: string;
  /** uuid de concepto. */
  readonly eventType: string;
  readonly occurredAt?: Date;
  readonly recordedAt: Date;
}

/** Lo que devuelven las operaciones que no crean nada. */
export interface OperationOk {
  readonly ok: boolean;
}
