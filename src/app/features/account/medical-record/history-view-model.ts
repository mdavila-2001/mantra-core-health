import type {
  ChartNote,
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../core/data-access/diagnostics/diagnostics.types';
import {
  esReconsulta,
  type Booking,
} from '../../../core/data-access/scheduling/scheduling.types';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import type {
  EncounterHeader,
  TimelineCondition,
  TimelineFollowUp,
  TimelineNote,
  TimelineOrder,
  TimelinePrescription,
} from '../../../shared/components/organisms/encounter-timeline/encounter-timeline.types';
import type { Tone } from '../../../shared/components/tone/tone.types';
import type {
  DiagnosticoDeLaHistoria,
  LineaDeAtencion,
  SeccionesNuevasDeLaHistoria,
} from '../../../shared/utils/clinical-pdf/historia-con-encuentros';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  esCronica,
  type ResolverCodigo,
} from '../../../shared/clinical/diagnosis-state';

/* ============================================================================
    De lo que devolvió la API a lo que el paciente lee.

    ## Por qué es un archivo de funciones puras y no métodos del componente

    Porque son **las mismas frases** que después imprime el PDF: «Diagnóstico
    confirmado: Hipertensión — activa hasta 24/11» tiene que decir lo mismo en
    la pantalla y en el papel, y dos mapeos separados se separan en el primer
    retoque. Puras, además, porque así se prueban sin TestBed.

    ## Acá no queda un solo identificador

    Todo lo que sale de este archivo es texto ya resuelto. El único `id` que
    sobrevive es la clave de dibujo, y ninguna plantilla la pinta.
    ========================================================================== */

/** Lo que se muestra cuando el registro no trae ese dato. */
export const SIN_DATO = 'Sin registrar';

/** Resuelve un identificador de concepto a su etiqueta legible. */
export type ResolverEtiqueta = (conceptId: string | undefined) => string;

/**
 * «24/11/2026» — la fecha corta con la que se leen los plazos clínicos.
 *
 * ## Por qué a mano y en UTC, y no con `Intl` ni con el `DatePipe`
 *
 * Dos razones, las dos comprobadas al escribir sus pruebas:
 *
 * 1. **`Intl` no rellena con cero.** `es-BO` con `dateStyle: 'short'` devuelve
 *    `9/1/24` en el ICU de este entorno; el rótulo que el carril pide —«hasta
 *    24/11»— quedaría dependiendo de qué datos de locale tenga la máquina.
 * 2. La presentación conserva el día UTC recibido. Leer una medianoche UTC
 *    en hora local la corre un día hacia atrás en Bolivia (UTC−4). Esto sólo
 *    decide el texto: el helper canónico compara los instantes completos para
 *    determinar si el diagnóstico sigue vigente.
 */
function fechaClinica(cuando: Date): string {
  const dos = (valor: number): string => String(valor).padStart(2, '0');
  return `${dos(cuando.getUTCDate())}/${dos(cuando.getUTCMonth() + 1)}/${cuando.getUTCFullYear()}`;
}

/** «1 de marzo de 2026». La fecha larga de un encabezado. */
const DIA_LARGO = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/**
 * Una atención, tal como la lee quien fue atendido.
 *
 * Renombra a `AtencionVisible`: ya no es una fila con tres datos, es **el
 * encuentro entero** con todo lo que pasó en él. El nombre viejo describía la
 * fila y el nuevo describe el hecho clínico, que es lo que el carril pide que
 * el paciente vea.
 */
export interface EncounterInHistory {
  readonly id: string;
  /** La cabecera que consume `app-encounter-timeline`. */
  readonly encabezado: EncounterHeader;
  /** «Consulta · 1 de marzo de 2026» — el rótulo plegado del acordeón. */
  readonly titulo: string;
  readonly sello: string;
  readonly notas: readonly TimelineNote[];
  readonly ordenes: readonly TimelineOrder[];
  readonly diagnosticos: readonly TimelineCondition[];
  readonly recetas: readonly TimelinePrescription[];
  /** La reconsulta que salió de esta atención (C4), o `null` si no hubo. */
  readonly reconsulta: TimelineFollowUp | null;
}

/** Un diagnóstico de la pestaña «Diagnósticos». */
export interface DiagnosticoVisible {
  readonly id: string;
  readonly nombre: string;
  readonly sello: string;
  readonly tono: Tone;
  readonly hechos: readonly Hecho[];
}

/** Los estados canónicos se muestran en los tres grupos ya publicados por C6. */
type HistoryDiagnosisGroup = 'en-estudio' | 'activa' | 'historico';

const HISTORY_GROUP_BY_STATE = {
  IN_STUDY: 'en-estudio',
  ACTIVE: 'activa',
  HISTORIC: 'historico',
  REFUTED: 'historico',
} as const;

/** Usa los códigos ya cargados por la historia, sin otra lectura de terminología. */
function historyDiagnosisGroup(
  condition: Condition,
  code: ResolverCodigo,
  now: Date,
): HistoryDiagnosisGroup {
  const state = diagnosisStateOf(
    {
      ...condition,
      verificationStatusConceptId: code(condition.verificationStatusConceptId),
      clinicalStatusConceptId: code(condition.clinicalStatusConceptId),
    },
    { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
    now,
  );
  return HISTORY_GROUP_BY_STATE[state];
}

/** Uno de los tres bloques de la pestaña. */
export interface BloqueDeDiagnosticos {
  readonly estado: HistoryDiagnosisGroup;
  readonly titulo: string;
  /** El `data-testid` con el que la prueba de navegador lo encuentra. */
  readonly testId: string;
  readonly filas: readonly DiagnosticoVisible[];
  /** Qué se dice cuando el bloque no tiene nada. El vacío orienta. */
  readonly vacio: string;
}

/** El tono de cada bloque. El color acompaña; la palabra la pone el sello. */
const TONO_DEL_BLOQUE: Readonly<Record<HistoryDiagnosisGroup, Tone>> = Object.freeze({
  'en-estudio': 'warning',
  activa: 'success',
  historico: 'info',
});

/** El `data-testid` de cada bloque, tal como lo nombra el carril. */
const TESTID_DEL_BLOQUE: Readonly<Record<HistoryDiagnosisGroup, string>> = Object.freeze({
  'en-estudio': 'historia-en-estudio',
  activa: 'historia-activas',
  historico: 'historia-historicos',
});

/** Qué dice cada bloque vacío. Ninguno se calla: un bloque mudo no es un dato. */
const VACIO_DEL_BLOQUE: Readonly<Record<HistoryDiagnosisGroup, string>> = Object.freeze({
  'en-estudio': 'No tenés diagnósticos en estudio.',
  activa: 'No tenés enfermedades activas registradas.',
  historico: 'No tenés diagnósticos históricos.',
});

/* ---- la pestaña «Diagnósticos» ------------------------------------------- */

/**
 * Los tres bloques, siempre los tres.
 *
 * Un bloque que desaparece cuando está vacío obliga a quien lee a adivinar si
 * no tiene nada o si el sistema no lo trajo — y en una historia clínica eso no
 * es lo mismo.
 */
export function bloquesDeDiagnosticos(
  condiciones: readonly Condition[],
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
): readonly BloqueDeDiagnosticos[] {
  const now = new Date();
  const titulos: Readonly<Record<HistoryDiagnosisGroup, string>> = {
    'en-estudio': 'En estudio',
    activa: 'Enfermedades activas',
    historico: 'Históricos',
  };

  return (['en-estudio', 'activa', 'historico'] as const).map((estado) => ({
    estado,
    titulo: titulos[estado],
    testId: TESTID_DEL_BLOQUE[estado],
    vacio: VACIO_DEL_BLOQUE[estado],
    filas: condiciones
      .filter((condicion) => historyDiagnosisGroup(condicion, codigo, now) === estado)
      .map((condicion) => diagnosticoVisible(condicion, estado, etiqueta, codigo, now)),
  }));
}

function diagnosticoVisible(
  condicion: Condition,
  estado: HistoryDiagnosisGroup,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  now: Date,
): DiagnosticoVisible {
  const hechos: Hecho[] = [];

  if (condicion.onsetAt !== undefined) {
    hechos.push({ etiqueta: 'Desde', valor: fechaClinica(condicion.onsetAt) });
  }

  const plazo = plazoDe(condicion, estado, codigo);
  if (plazo !== null) {
    hechos.push({ etiqueta: 'Duración', valor: plazo });
  }

  if (estado === 'historico') {
    hechos.push({ etiqueta: 'Por qué', valor: razonDelHistorico(condicion, etiqueta, codigo, now) });
  }

  // El estado clínico entero, siempre: el bloque resume y esta fila no esconde
  // el matiz —«En remisión» no es lo mismo que «Resuelta»—.
  if (condicion.clinicalStatusConceptId !== undefined) {
    hechos.push({ etiqueta: 'Estado clínico', valor: etiqueta(condicion.clinicalStatusConceptId) });
  }

  if (condicion.noteText !== undefined && condicion.noteText.trim() !== '') {
    hechos.push({ etiqueta: 'Nota del profesional', valor: condicion.noteText });
  }

  // TODO C8: «quién lo confirmó» (§4 del carril) no se puede completar: el
  // contrato de `Condition` no declara autor ni profesional, y el paciente no
  // puede leer el padrón. Inventar el dato sería atribuirle el diagnóstico a
  // alguien. Cuando el resumen lo exponga, entra como una fila más acá.

  return {
    id: condicion.id,
    nombre: etiqueta(condicion.codeConceptId),
    sello: etiqueta(condicion.verificationStatusConceptId),
    tono: TONO_DEL_BLOQUE[estado],
    hechos,
  };
}

/**
 * «crónica» o «hasta el 24/11/2026», sólo para lo que sigue en curso.
 *
 * Un histórico no tiene plazo: ya se cerró, y una fecha esperada de resolución
 * en un diagnóstico resuelto se leería como que todavía falta.
 */
function plazoDe(
  condicion: Condition,
  estado: HistoryDiagnosisGroup,
  codigo: ResolverCodigo,
): string | null {
  if (estado === 'historico') {
    return null;
  }
  if (esCronica(condicion, codigo)) {
    return 'crónica';
  }
  return condicion.expectedResolutionAt === undefined
    ? null
    : `hasta el ${fechaClinica(condicion.expectedResolutionAt)}`;
}

/**
 * Por qué un diagnóstico es histórico: resolución, plazo vencido o estado.
 * El vencimiento del plazo no afirma que el profesional lo haya resuelto.
 *
 * // TODO C8: C3 iba a dejar `verification.reasonText` —el motivo escrito del
 * // rechazo— y no llegó. Mientras tanto se dice la **etiqueta del catálogo**
 * // («Descartado»), que es un hecho publicado, en vez de un texto inventado.
 */
function razonDelHistorico(
  condicion: Condition,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  now: Date,
): string {
  if (condicion.resolvedAt !== undefined) {
    return `resuelto el ${fechaClinica(condicion.resolvedAt)}`;
  }
  if (
    codigo(condicion.verificationStatusConceptId) === CODIGO_CONFIRMADO &&
    codigo(condicion.clinicalStatusConceptId) === CODIGO_ACTIVA &&
    condicion.expectedResolutionAt !== undefined &&
    condicion.expectedResolutionAt.getTime() < now.getTime()
  ) {
    return `plazo esperado vencido el ${fechaClinica(condicion.expectedResolutionAt)}`;
  }
  if (condicion.verificationStatusConceptId !== undefined) {
    return etiqueta(condicion.verificationStatusConceptId);
  }
  return etiqueta(condicion.clinicalStatusConceptId);
}

/* ---- la línea de cada atención ------------------------------------------- */

/** Lo que las dos lecturas perezosas aportan a la línea. */
export interface DetalleDeAtenciones {
  readonly notas: readonly ChartNote[];
  readonly ordenes: readonly PatientOrder[];
  /**
   * Las citas del titular, de donde sale la reconsulta de cada atención (C8).
   *
   * Viene con las otras dos y no por separado porque se pide en la misma
   * lectura perezosa: el vínculo sólo se puede resolver cuando alguien despliega
   * una atención, y hasta entonces no hay nada que atar.
   */
  readonly citas: readonly Booking[];
}

/**
 * Las atenciones, de la más reciente a la más vieja, con su línea.
 *
 * Al revés que en el expediente del profesional, que las ordena como vienen:
 * quien entra a su archivo busca la última consulta, no la primera de su vida.
 */
export function atencionesDeLaHistoria(
  resumen: ClinicalSummary,
  detalle: DetalleDeAtenciones,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
): readonly EncounterInHistory[] {
  const now = new Date();
  return [...resumen.encounters]
    .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
    .map((encuentro) => atencionDeLaHistoria(encuentro, resumen, detalle, etiqueta, codigo, now));
}

function atencionDeLaHistoria(
  encuentro: Encounter,
  resumen: ClinicalSummary,
  detalle: DetalleDeAtenciones,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  now: Date,
): EncounterInHistory {
  const motivo = encuentro.reasonText ?? 'Consulta';
  const cuando = encuentro.startAt ?? null;

  return {
    id: encuentro.id,
    encabezado: {
      id: encuentro.id,
      motivo,
      cuando,
      cerrada: encuentro.endAt !== undefined,
    },
    titulo: cuando === null ? motivo : `${motivo} · ${DIA_LARGO.format(cuando)}`,
    sello: encuentro.endAt === undefined ? 'En curso' : 'Cerrada',
    notas: detalle.notas
      .filter((nota) => nota.encounterId === encuentro.id && nota.releasedToPatient)
      .map((nota) => notaDeLaLinea(nota)),
    ordenes: detalle.ordenes
      .filter((orden) => orden.encounterId === encuentro.id)
      .map((orden) => ordenDeLaLinea(orden, etiqueta)),
    diagnosticos: resumen.conditions
      .filter((condicion) => condicion.encounterId === encuentro.id)
      .map((condicion) => diagnosticoDeLaLinea(condicion, etiqueta, codigo, now)),
    recetas: resumen.medicationRequests
      .filter((receta) => receta.encounterId === encuentro.id)
      .map((receta) => recetaDeLaLinea(receta, resumen, etiqueta)),
    reconsulta: reconsultaDeLaLinea(detalle.citas, encuentro.id, etiqueta),
  };
}

/**
 * La reconsulta que salió de esta atención, si se agendó alguna (C4 → C8).
 *
 * Se resuelve por `followUpOf.encounterId` —el vínculo que estrena C4— y no por
 * el tipo de cita: una cita sin origen no es una reconsulta por más que el
 * catálogo la clasifique así.
 *
 * Si hubiera más de una, gana **la más próxima**. El organismo declara un solo
 * hecho, y de dos fechas la que importa es la que todavía está por venir; una
 * sin fecha pierde contra cualquiera que la tenga en vez de colarse primera.
 *
 * `profesional` va en `null` a propósito: la reserva no nombra a quien atiende
 * —trae `resourceId`, que es un identificador— y esta pantalla tiene prohibido
 * mostrarlos. `null` no es «con nadie»: es «la reserva no lo dice».
 *
 * El estado sale del catálogo, y si el catálogo no lo nombró va **vacío** en vez
 * de «Sin registrar»: el organismo omite el sello, que es más honesto que un
 * sello que declara ignorancia.
 */
function reconsultaDeLaLinea(
  citas: readonly Booking[],
  encounterId: string,
  etiqueta: ResolverEtiqueta,
): TimelineFollowUp | null {
  const cita = [...citas]
    .filter((fila) => esReconsulta(fila) && fila.followUpOf?.encounterId === encounterId)
    .sort(
      (a, b) =>
        (a.startAt?.getTime() ?? Number.POSITIVE_INFINITY) -
        (b.startAt?.getTime() ?? Number.POSITIVE_INFINITY),
    )[0];

  if (cita === undefined) {
    return null;
  }

  const estado = etiqueta(cita.statusConceptId);
  return {
    id: cita.id,
    cuando: cita.startAt ?? null,
    profesional: null,
    estado: estado === SIN_DATO ? '' : estado,
  };
}

/**
 * Una nota del expediente, en los apartados que el paciente lee.
 *
 * Sólo las **liberadas al paciente**: `releasedToPatient` es la decisión del
 * profesional sobre si esa nota se comparte, y aunque el servidor ya filtre,
 * esta pantalla no puede ser la que la muestre si alguna vez dejara de hacerlo.
 *
 * // TODO C8: cuando llegue `entries` de C1, los apartados salen de lo que la
 * // nota declara en vez de estos cinco campos fijos.
 */
function notaDeLaLinea(nota: ChartNote): TimelineNote {
  // C1: las filas campo/valor van primero, como las escribió quien atendió.
  const entradas = nota.entries ?? [];
  const filas: Hecho[] = [
    ...entradas.map((fila) => ({ etiqueta: fila.label, valor: fila.value })),
    { etiqueta: 'Motivo de la consulta', valor: nota.chiefComplaintText || null },
    { etiqueta: entradas.length > 0 ? 'Lo que anotó' : 'Lo que contaste', valor: nota.subjectiveText || null },
    { etiqueta: 'Lo que se observó', valor: nota.objectiveText || null },
    { etiqueta: 'Evaluación', valor: nota.assessmentText || null },
    { etiqueta: 'Plan', valor: nota.planText || null },
  ];

  return {
    id: nota.noteId,
    // «Nota #a1b2»: cuatro caracteres alcanzan para distinguir dos notas del
    // mismo día y no son el identificador — que es lo que esta pantalla tiene
    // prohibido mostrar.
    rotulo: `Nota #${nota.noteId.replace(/-/g, '').slice(-4)}`,
    cuando: nota.signedAt ?? nota.createdAt,
    filas,
  };
}

/**
 * Una orden del portal, en la línea.
 *
 * // TODO C8: C2 iba a dejar `category` ya resuelta. Mientras tanto la
 * // categoría se traduce del `categoryConceptId` contra el catálogo, que es
 * // exactamente lo que el carril indica hacer si C2 no llega.
 */
function ordenDeLaLinea(orden: PatientOrder, etiqueta: ResolverEtiqueta): TimelineOrder {
  return {
    id: orden.id,
    estudio: etiqueta(orden.codeConceptId),
    categoria: orden.categoryConceptId === undefined ? '' : etiqueta(orden.categoryConceptId),
    estado: etiqueta(orden.statusConceptId),
    cuando: orden.createdAt,
    resultadoDisponible: orden.hasReleasedResult,
  };
}

/** «Diagnóstico confirmado: Hipertensión — activa hasta el 24/11/2026». */
function diagnosticoDeLaLinea(
  condicion: Condition,
  etiqueta: ResolverEtiqueta,
  codigo: ResolverCodigo,
  now: Date,
): TimelineCondition {
  const estado = historyDiagnosisGroup(condicion, codigo, now);
  const plazo = plazoDe(condicion, estado, codigo);

  return {
    id: condicion.id,
    nombre: etiqueta(condicion.codeConceptId),
    estado: ROTULO_EN_LA_LINEA[estado],
    tono: TONO_DEL_BLOQUE[estado],
    detalle:
      estado === 'historico'
        ? razonDelHistorico(condicion, etiqueta, codigo, now)
        : matizVigente(plazo),
    cuando: condicion.onsetAt ?? condicion.createdAt,
  };
}

/**
 * Cómo se encabeza el diagnóstico **dentro de la línea del encuentro**.
 *
 * Distinto del título del bloque: ahí el encabezado ya dice de qué grupo es, y
 * acá el hecho tiene que decirlo solo porque está entre una orden y una receta.
 */
const ROTULO_EN_LA_LINEA: Readonly<Record<HistoryDiagnosisGroup, string>> = Object.freeze({
  'en-estudio': 'Diagnóstico en estudio',
  activa: 'Diagnóstico confirmado',
  historico: 'Diagnóstico histórico',
});

/**
 * El matiz de un diagnóstico vigente: «activa hasta el 24/11/2026», «crónica».
 *
 * El «activa» se agrega acá y no en `plazoDe` porque en la pestaña
 * «Diagnósticos» el bloque ya dice que está activa y repetirlo sería decirlo
 * dos veces en la misma tarjeta; en la línea del encuentro, en cambio, no hay
 * bloque que lo diga.
 */
function matizVigente(plazo: string | null): string | null {
  if (plazo === null) {
    return null;
  }
  return plazo === 'crónica' ? 'crónica' : `activa ${plazo}`;
}

/** «Receta: Losartán — por Hipertensión». */
function recetaDeLaLinea(
  receta: MedicationRequest,
  resumen: ClinicalSummary,
  etiqueta: ResolverEtiqueta,
): TimelinePrescription {
  const porDiagnostico = resumen.conditions.find(
    (condicion) => condicion.id === receta.indicationConditionId,
  );
  const indicacion =
    porDiagnostico !== undefined
      ? etiqueta(porDiagnostico.codeConceptId)
      : (receta.indicationText ?? null);

  const detalle = [receta.doseText, receta.frequencyText].filter(Boolean).join(' · ');

  return {
    id: receta.id,
    medicamento: etiqueta(receta.medicationConceptId),
    indicacion,
    detalle: detalle === '' ? null : detalle,
    cuando: receta.issuedAt ?? receta.createdAt,
  };
}

/* ---- lo mismo, para el papel --------------------------------------------- */

/**
 * Las dos secciones que C6 agrega a «Descargar tu historia».
 *
 * Se arman **desde los mismos view-models que la pantalla dibuja** y no desde
 * el resumen crudo: es lo que garantiza que el papel diga exactamente lo que se
 * leyó en la pantalla. Si el PDF volviera a mapear por su cuenta, un diagnóstico
 * descartado podría salir en un bloque en la pantalla y en otro en el papel.
 */
export function seccionesNuevasDeLaHistoria(
  bloques: readonly BloqueDeDiagnosticos[],
  atenciones: readonly EncounterInHistory[],
): SeccionesNuevasDeLaHistoria {
  return {
    diagnosticos: {
      enEstudio: filasDelBloque(bloques, 'en-estudio'),
      activas: filasDelBloque(bloques, 'activa'),
      historicos: filasDelBloque(bloques, 'historico'),
    },
    lineas: atenciones.map((atencion) => lineaDeAtencion(atencion)),
  };
}

function filasDelBloque(
  bloques: readonly BloqueDeDiagnosticos[],
  estado: HistoryDiagnosisGroup,
): readonly DiagnosticoDeLaHistoria[] {
  const bloque = bloques.find((candidato) => candidato.estado === estado);
  return (bloque?.filas ?? []).map((fila) => ({
    nombre: fila.nombre,
    certeza: fila.sello,
    // La duración y el porqué son las dos filas que el papel necesita; el resto
    // ya lo cuenta la línea de la atención y repetirlo alargaría el documento
    // sin agregar un hecho.
    detalle: detalleDeLaFila(fila),
  }));
}

/** «activa hasta el 24/11/2026» o «resuelto el 03/09/2026», si constan. */
function detalleDeLaFila(fila: DiagnosticoVisible): string | null {
  const duracion = fila.hechos.find((hecho) => hecho.etiqueta === 'Duración')?.valor ?? null;
  const porque = fila.hechos.find((hecho) => hecho.etiqueta === 'Por qué')?.valor ?? null;
  return porque ?? duracion;
}

/**
 * Una atención, con sus hechos **en el mismo orden que la línea de la pantalla**.
 *
 * El orden se recalcula acá con la misma regla —instante y, a igualdad, el
 * orden del relato— porque el organismo la aplica de puertas adentro y el papel
 * no puede leerle el DOM.
 */
function lineaDeAtencion(atencion: EncounterInHistory): LineaDeAtencion {
  const hechos = [
    ...atencion.notas.map((nota, indice) => ({
      titulo: nota.rotulo,
      detalle: null,
      cuando: nota.cuando,
      peso: [0, indice] as const,
    })),
    ...atencion.ordenes.map((orden, indice) => ({
      titulo: orden.categoria === '' ? orden.estudio : `${orden.categoria}: ${orden.estudio}`,
      detalle: orden.resultadoDisponible ? 'resultado disponible' : orden.estado,
      cuando: orden.cuando,
      peso: [1, indice] as const,
    })),
    ...atencion.diagnosticos.map((diagnostico, indice) => ({
      titulo: `${diagnostico.estado}: ${diagnostico.nombre}`,
      detalle: diagnostico.detalle,
      cuando: diagnostico.cuando,
      peso: [2, indice] as const,
    })),
    ...atencion.recetas.map((receta, indice) => ({
      titulo: `Receta: ${receta.medicamento}`,
      detalle: receta.indicacion === null ? receta.detalle : `por ${receta.indicacion}`,
      cuando: receta.cuando,
      peso: [4, indice] as const,
    })),
  ].sort(porInstanteYRelato);

  return {
    titulo: atencion.titulo,
    sello: atencion.sello,
    hechos: hechos.map((hecho) => ({
      titulo: hecho.titulo,
      detalle: hecho.detalle,
      cuando: hecho.cuando === null ? null : DIA_LARGO.format(hecho.cuando),
    })),
  };
}

/** Un hecho del papel, con lo que hace falta para ordenarlo. */
interface HechoOrdenable {
  readonly cuando: Date | null;
  readonly peso: readonly [tipo: number, posicion: number];
}

/** Misma regla que el organismo: sin fecha pesa infinito y va al final. */
function porInstanteYRelato(a: HechoOrdenable, b: HechoOrdenable): number {
  const instanteA = a.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  const instanteB = b.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  if (instanteA !== instanteB) {
    return instanteA - instanteB;
  }
  return a.peso[0] === b.peso[0] ? a.peso[1] - b.peso[1] : a.peso[0] - b.peso[0];
}
