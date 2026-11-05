/* ============================================================================
    Datos de traslado de una derivación (API v4274, brecha B8).

    La Norma Nacional de Referencia y Contrarreferencia (MSD Bolivia, 2.ª ed.)
    pide que el formulario de referencia registre el medio de transporte,
    quién acompaña, los signos vitales y el estado del paciente al salir, y el
    aviso previo al establecimiento receptor en la referencia de urgencia; el
    receptor anota la llegada y el estado en que llegó.

    Separado de `referrals.types.ts` por tamaño: son los tipos y las reglas
    del traslado, que viajan dentro de `transfer` en el alta y en
    `PATCH /referrals/:id/transfer`, y la llegada (`PATCH …/arrival`).
    ========================================================================== */

/** Medio de transporte (`transport_mode`). Las ambulancias primero: son las que pide un traslado inestable. */
export const TRANSPORT_MODES = [
  'AMBULANCE_BASIC',
  'AMBULANCE_ADVANCED',
  'AIR_AMBULANCE',
  'RIVER',
  'PRIVATE_VEHICLE',
  'PUBLIC_TRANSPORT',
  'ON_FOOT',
  'OTHER',
] as const;

export type TransportMode = (typeof TRANSPORT_MODES)[number];

/** Los medios que la API admite para un paciente inestable o crítico. */
export const AMBULANCE_MODES: ReadonlySet<TransportMode> = new Set<TransportMode>([
  'AMBULANCE_BASIC',
  'AMBULANCE_ADVANCED',
  'AIR_AMBULANCE',
]);

/** Estado del paciente al salir (`departure_condition`). */
export const DEPARTURE_CONDITIONS = ['STABLE', 'UNSTABLE', 'CRITICAL'] as const;
export type DepartureCondition = (typeof DEPARTURE_CONDITIONS)[number];

/** Estado al llegar (`arrival_condition`): el de salida más el fallecimiento en el trayecto. */
export const ARRIVAL_CONDITIONS = ['STABLE', 'UNSTABLE', 'CRITICAL', 'DECEASED'] as const;
export type ArrivalCondition = (typeof ARRIVAL_CONDITIONS)[number];

/** Si el estado obliga a ambulancia, personal de salud y aviso al receptor. */
export function isUnstable(condition: DepartureCondition | undefined): boolean {
  return condition === 'UNSTABLE' || condition === 'CRITICAL';
}

/** Signos vitales al salir. Todos opcionales; los que vienen, dentro de rango. */
export interface ReferralVitals {
  readonly recordedAt?: Date;
  readonly systolicBp?: number;
  readonly diastolicBp?: number;
  readonly heartRate?: number;
  readonly respiratoryRate?: number;
  readonly temperatureC?: number;
  readonly oxygenSaturation?: number;
  readonly glasgow?: number;
}

export type VitalKey = Exclude<keyof ReferralVitals, 'recordedAt'>;

/** Rangos de los CHECK de la base (§6.1). La temperatura admite un decimal; el resto, enteros. */
export const VITAL_RANGES: Readonly<Record<VitalKey, { readonly min: number; readonly max: number; readonly decimals: 0 | 1 }>> = {
  systolicBp: { min: 40, max: 300, decimals: 0 },
  diastolicBp: { min: 20, max: 200, decimals: 0 },
  heartRate: { min: 20, max: 300, decimals: 0 },
  respiratoryRate: { min: 4, max: 80, decimals: 0 },
  temperatureC: { min: 30, max: 45, decimals: 1 },
  oxygenSaturation: { min: 50, max: 100, decimals: 0 },
  glasgow: { min: 3, max: 15, decimals: 0 },
};

/** Topes de texto del DTO (§6.1). */
export const TRANSFER_LIMITS = {
  transportDetail: 200,
  companionName: 200,
  companionRelationship: 80,
  companionPhone: 40,
  escortProfessionalName: 200,
  escortProfessionalRole: 80,
  receiverContactName: 200,
  arrivalNotes: 4000,
} as const;

/**
 * Cuerpo de `transfer` en `POST /referrals` y de `PATCH /referrals/:id/transfer`.
 * Los opcionales vacíos se **omiten**: la API valida con `forbidNonWhitelisted`.
 */
export interface ReferralTransferInput {
  /** ¿El paciente se traslada físicamente? */
  readonly required: boolean;
  readonly transportMode?: TransportMode;
  /** Placa o identificación de la unidad, o el detalle de «Otro». */
  readonly transportDetail?: string;
  readonly companionName?: string;
  readonly companionRelationship?: string;
  readonly companionPhone?: string;
  /** Personal de salud que acompaña. */
  readonly escortProfessionalName?: string;
  readonly escortProfessionalRole?: string;
  readonly departureCondition?: DepartureCondition;
  readonly vitals?: ReferralVitals;
  /** Se avisó al receptor antes de salir. */
  readonly receiverContacted?: boolean;
  readonly receiverContactName?: string;
  readonly receiverContactedAt?: Date;
  readonly departedAt?: Date;
}

/** Cuerpo de `PATCH /referrals/:id/arrival`: lo registra el destino. */
export interface ReferralArrivalInput {
  readonly arrivedAt: Date;
  readonly arrivalCondition: ArrivalCondition;
  readonly arrivalNotes?: string;
}

/** El traslado tal como lo devuelve la API (`ReferralResponseDto.transfer`). */
export interface ReferralTransfer extends Omit<ReferralTransferInput, 'required'> {
  /** `undefined` en las filas que nunca registraron traslado. */
  readonly required?: boolean;
  readonly arrivedAt?: Date;
  readonly arrivalCondition?: ArrivalCondition;
  readonly arrivalNotes?: string;
}

/**
 * Los sub-códigos que la API devuelve al validar el traslado (400, §6.2). El
 * front aplica las mismas reglas y ata cada una al campo que la corrige.
 */
export type TransferRule =
  | 'TRANSFER_INCOMPLETE'
  | 'TRANSFER_UNSAFE_TRANSPORT'
  | 'TRANSFER_RECEIVER_NOT_CONTACTED'
  | 'TRANSFER_VITALS_OUT_OF_RANGE'
  | 'TRANSFER_DETAIL_REQUIRED'
  | 'TRANSFER_ARRIVAL_BEFORE_DEPARTURE';

/** Los campos del traslado a los que se puede atar un problema. */
export type TransferField =
  | 'transportMode'
  | 'transportDetail'
  | 'departureCondition'
  | 'escortProfessionalName'
  | 'receiverContacted'
  | 'receiverContactName'
  | VitalKey
  | 'companionName'
  | 'companionRelationship'
  | 'companionPhone'
  | 'escortProfessionalRole'
  | 'arrivedAt'
  | 'arrivalCondition'
  | 'arrivalNotes';

export interface TransferIssue {
  readonly rule: TransferRule | 'TOO_LONG';
  readonly field: TransferField;
  readonly message: string;
}

const VITAL_NAMES: Readonly<Record<VitalKey, string>> = {
  systolicBp: 'La presión sistólica',
  diastolicBp: 'La presión diastólica',
  heartRate: 'La frecuencia cardíaca',
  respiratoryRate: 'La frecuencia respiratoria',
  temperatureC: 'La temperatura',
  oxygenSaturation: 'La saturación de oxígeno',
  glasgow: 'El Glasgow',
};

const TEXT_NAMES: Readonly<Record<keyof typeof TRANSFER_LIMITS, string>> = {
  transportDetail: 'El detalle del transporte',
  companionName: 'El nombre del acompañante',
  companionRelationship: 'El parentesco',
  companionPhone: 'El teléfono del acompañante',
  escortProfessionalName: 'El nombre del personal de salud',
  escortProfessionalRole: 'El cargo del personal de salud',
  receiverContactName: 'El nombre de quien recibió el aviso',
  arrivalNotes: 'Las notas de llegada',
};

/**
 * Las reglas del traslado de la API (§6.2), en el orden del formulario.
 *
 * No reemplazan a la API —que vuelve a validar y decide—: evitan mandar algo
 * que va a volver rechazado y dicen qué corregir junto a cada campo.
 *
 * El aviso al receptor lo exige el estado (inestable o crítico), no la
 * prioridad: la API no tiene un concepto de prioridad urgente para
 * derivaciones con el que reconocerla.
 *
 * @param transfer - Lo cargado, ya recortado.
 */
export function transferIssues(transfer: ReferralTransferInput): readonly TransferIssue[] {
  const issues: TransferIssue[] = [];
  const filled = (v: string | undefined): boolean => v !== undefined && v.trim() !== '';
  const unstable = isUnstable(transfer.departureCondition);

  if (transfer.required && transfer.transportMode === undefined) {
    issues.push({
      rule: 'TRANSFER_INCOMPLETE',
      field: 'transportMode',
      message: 'Elija el medio de transporte del traslado.',
    });
  }
  if (unstable && transfer.transportMode !== undefined && !AMBULANCE_MODES.has(transfer.transportMode)) {
    issues.push({
      rule: 'TRANSFER_UNSAFE_TRANSPORT',
      field: 'transportMode',
      message: 'Un paciente inestable o crítico viaja en ambulancia (básica, avanzada o aérea).',
    });
  }
  if (transfer.transportMode === 'OTHER' && !filled(transfer.transportDetail)) {
    issues.push({
      rule: 'TRANSFER_DETAIL_REQUIRED',
      field: 'transportDetail',
      message: 'Con «Otro» medio de transporte, describa cuál es.',
    });
  }
  if (transfer.required && transfer.departureCondition === undefined) {
    issues.push({
      rule: 'TRANSFER_INCOMPLETE',
      field: 'departureCondition',
      message: 'Indique el estado del paciente al salir: estable, inestable o crítico.',
    });
  }
  if (unstable && !filled(transfer.escortProfessionalName)) {
    issues.push({
      rule: 'TRANSFER_UNSAFE_TRANSPORT',
      field: 'escortProfessionalName',
      message: 'Un paciente inestable o crítico viaja acompañado por personal de salud: escriba quién.',
    });
  }
  if (unstable) {
    if (transfer.receiverContacted !== true) {
      issues.push({
        rule: 'TRANSFER_RECEIVER_NOT_CONTACTED',
        field: 'receiverContacted',
        message: 'Con el paciente inestable o crítico, avise al establecimiento receptor antes de salir.',
      });
    }
    if (!filled(transfer.receiverContactName)) {
      issues.push({
        rule: 'TRANSFER_RECEIVER_NOT_CONTACTED',
        field: 'receiverContactName',
        message: 'Escriba quién recibió el aviso en el establecimiento receptor.',
      });
    }
  }
  issues.push(...vitalsIssues(transfer.vitals));
  for (const key of Object.keys(TEXT_NAMES) as (keyof typeof TRANSFER_LIMITS)[]) {
    if (key === 'arrivalNotes') continue;
    const value = (transfer as unknown as Readonly<Record<string, unknown>>)[key];
    if (typeof value === 'string' && value.length > TRANSFER_LIMITS[key]) {
      issues.push({
        rule: 'TOO_LONG',
        field: key,
        message: `${TEXT_NAMES[key]} admite hasta ${TRANSFER_LIMITS[key]} caracteres.`,
      });
    }
  }
  return issues;
}

/** Rangos de §6.1 y diastólica por debajo de la sistólica. */
export function vitalsIssues(vitals: ReferralVitals | undefined): readonly TransferIssue[] {
  if (vitals === undefined) return [];
  const issues: TransferIssue[] = [];
  for (const key of Object.keys(VITAL_RANGES) as VitalKey[]) {
    const value = vitals[key];
    const range = VITAL_RANGES[key];
    if (value === undefined) continue;
    if (!Number.isFinite(value) || value < range.min || value > range.max) {
      issues.push({
        rule: 'TRANSFER_VITALS_OUT_OF_RANGE',
        field: key,
        message: `${VITAL_NAMES[key]} va de ${range.min} a ${range.max}.`,
      });
    } else if (range.decimals === 0 && !Number.isInteger(value)) {
      issues.push({
        rule: 'TRANSFER_VITALS_OUT_OF_RANGE',
        field: key,
        message: `${VITAL_NAMES[key]} se anota sin decimales.`,
      });
    }
  }
  const { systolicBp, diastolicBp } = vitals;
  if (systolicBp !== undefined && diastolicBp !== undefined && diastolicBp >= systolicBp) {
    issues.push({
      rule: 'TRANSFER_VITALS_OUT_OF_RANGE',
      field: 'diastolicBp',
      message: 'La presión diastólica tiene que ser menor que la sistólica.',
    });
  }
  return issues;
}

/**
 * Las reglas de `PATCH /referrals/:id/arrival`: estado obligatorio y la
 * llegada no antes de la salida.
 *
 * @param departedAt - La salida registrada, si la hay.
 */
export function arrivalIssues(
  arrival: Partial<ReferralArrivalInput>,
  departedAt: Date | undefined,
): readonly TransferIssue[] {
  const issues: TransferIssue[] = [];
  if (arrival.arrivedAt === undefined) {
    issues.push({ rule: 'TRANSFER_INCOMPLETE', field: 'arrivedAt', message: 'Indique la fecha y la hora de llegada.' });
  } else if (departedAt !== undefined && arrival.arrivedAt < departedAt) {
    issues.push({
      rule: 'TRANSFER_ARRIVAL_BEFORE_DEPARTURE',
      field: 'arrivedAt',
      message: 'La llegada no puede ser anterior a la salida registrada.',
    });
  }
  if (arrival.arrivalCondition === undefined) {
    issues.push({
      rule: 'TRANSFER_INCOMPLETE',
      field: 'arrivalCondition',
      message: 'Indique en qué estado llegó el paciente.',
    });
  }
  if ((arrival.arrivalNotes ?? '').length > TRANSFER_LIMITS.arrivalNotes) {
    issues.push({
      rule: 'TOO_LONG',
      field: 'arrivalNotes',
      message: `${TEXT_NAMES.arrivalNotes} admiten hasta ${TRANSFER_LIMITS.arrivalNotes} caracteres.`,
    });
  }
  return issues;
}
