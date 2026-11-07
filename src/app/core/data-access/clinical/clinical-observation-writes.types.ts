/* ============================================================================
    Writing an observation and a diagnostic report into the clinical record
    (part of `clinical.types.ts`, which re-exports it).
    ========================================================================== */

/**
 * Quién ejecutó la observación.
 *
 * `performerId` es el perfil del profesional —el claim `hpid` de la sesión
 * cuando lo registra quien atiende—, no el identificador de la cuenta. Son dos
 * tablas distintas y la clave foránea apunta a la primera.
 */
export interface NewObservationPerformer {
  readonly performerTypeConceptId: string;
  readonly performerId: string;
  readonly performerRoleConceptId?: string;
}

/**
 * La familia de valor de una observación, tal como la declara el contrato.
 *
 * Los seis caminos son **excluyentes**: se manda uno. Van en un tipo aparte
 * porque el DTO también los reparte entre la observación y cada uno de sus
 * componentes, y duplicarlos a mano garantizaría que se separen.
 */
export interface ObservationValue {
  readonly valueTypeConceptId?: string;
  readonly valueDecimal?: number;
  readonly valueBoolean?: boolean;
  readonly valueText?: string;
  readonly valueConceptId?: string;
  readonly quantityValue?: number;
  readonly quantityUnitConceptId?: string;
}

/** Un componente de una observación: la sistólica de una presión, por ejemplo. */
export interface NewObservationComponent extends ObservationValue {
  readonly codeConceptId: string;
  readonly interpretationConceptId?: string;
}

/** Un rango de referencia con el que se lee el valor. */
export interface NewObservationReferenceRange {
  readonly lowValue?: number;
  readonly highValue?: number;
  readonly unitConceptId?: string;
  readonly text?: string;
}

/**
 * Lo que hace falta para registrar una observación (UC-08-03).
 *
 * ## `performers` se manda siempre que se pueda nombrar, y no siempre se puede
 *
 * Una medición sin autor no es un registro clínico —no se puede repreguntar, ni
 * auditar, ni desestimar—, y por eso este tipo lo declaró obligatorio durante
 * un tiempo aunque el DTO lo tuviera opcional. La restricción se levantó al
 * escribir la primera pantalla que registra observaciones, y no por comodidad:
 * un ejecutante son **dos** datos —quién y de qué clase—, y el segundo es un
 * `*_concept_id` que sale de `clinical.observation_performers.performer_type_concept_id`.
 * Esa columna puede no tener conjunto de valores publicado en una instalación,
 * y entonces el único ejecutante que la pantalla podría armar llevaría un uuid
 * inventado. Entre registrar la medición sin autor y registrarla con un autor
 * falso, lo primero es lo honesto; lo segundo es lo que la auditoría no puede
 * distinguir de un dato real.
 *
 * Quien escribe una observación **debe** mandarlo cuando el catálogo lo permita:
 * ver `ObservationBlock`, que lo resuelve del binding y lo omite sólo cuando el
 * catálogo no publica la columna.
 */
export interface NewObservation extends ObservationValue {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly performers?: readonly NewObservationPerformer[];
  readonly encounterId?: string;
  readonly basedOnServiceRequestId?: string;
  readonly categoryConceptId?: string;
  readonly interpretationConceptId?: string;
  readonly methodConceptId?: string;
  readonly bodySiteConceptId?: string;
  readonly sourceDeviceId?: string;
  readonly effectiveStartAt?: Date;
  readonly issuedAt?: Date;
  readonly components?: readonly NewObservationComponent[];
  readonly referenceRanges?: readonly NewObservationReferenceRange[];
  readonly notes?: readonly string[];
}

/**
 * La observación recién registrada.
 *
 * Trae `rowVersion` porque la enmienda (UC-08-04) lo exige para el bloqueo
 * optimista: quien acaba de crearla ya tiene la versión con la que corregirla,
 * sin releer.
 */
export interface ObservationRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly status: string;
  readonly componentIds: readonly string[];
  readonly rowVersion: number;
  readonly createdAt: Date;
}

/**
 * Lo que hace falta para emitir un informe diagnóstico (UC-08-06).
 *
 * ## Existe el contrato y no la pantalla, a propósito
 *
 * El informe **no aparece en ninguna lectura**: no está en el bloque de
 * `getSummary`, no está en `getChart`, y el backend no expone ningún `GET` de
 * reportes. Construir el formulario hoy sería exactamente lo que el resto de
 * este archivo evita —tragarse el dato y no mostrarlo—: quien lo emitiera no
 * tendría forma de comprobar que existe, ni al recargar.
 *
 * El tipo y sus dos métodos entran igual porque el contrato **sí** está
 * verificado. La ficha del vault lo dice con el mismo aviso: «Tabla ⚠︎ — la
 * pantalla necesita un listado que el backend todavía no expone».
 */
export interface NewDiagnosticReport {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly serviceRequestId?: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  readonly currentVersionId?: string;
}

/**
 * El informe recién emitido o recién liberado.
 *
 * Dos estados y no uno: `lifecycleStatus` dice en qué punto está el informe
 * —parcial, preliminar, final— y `resultReleaseStatus` si el resultado ya se
 * le liberó a la persona. Son decisiones distintas: un informe final puede
 * seguir retenido, y esa diferencia es justamente la que la liberación cambia.
 */
export interface DiagnosticReportRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly lifecycleStatus: string;
  readonly resultReleaseStatus: string | null;
  readonly serviceRequestId: string | null;
  readonly createdAt: Date;
}
