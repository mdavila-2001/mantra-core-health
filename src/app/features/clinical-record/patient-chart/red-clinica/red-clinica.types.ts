/* ============================================================================
    La red clínica del paciente — el contrato de entrada de la franja 3.

    Estos tipos son la **interfaz estable** entre quien arma la red (franja 2:
    `recorrido-clinico/**`, que lee el expediente y ubica los nodos) y las tres
    piezas de esta carpeta: el panel de detalle, la barra de filtros y las
    alertas de apoyo. Son deliberadamente simples —texto ya traducido, fechas
    ya convertidas, ids ya resueltos— para que adaptar sea mecánico:

    - ningún `*ConceptId`: quien arma la red ya resolvió la terminología;
    - ningún DTO del API: el panel no sabe de `Condition` ni de `Referral`;
    - el id de un nodo es el id del registro que representa (condición, orden,
      derivación, atención, cita…). Las alertas lo asumen por omisión, y se
      puede cambiar con `idDeNodo` (ver `red-clinica-alertas.ts`).

    Lo que NO hay acá: geometría. Dónde se dibuja un nodo es asunto del mapa.
    ========================================================================== */

import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import type { Tone } from '../../../../shared/components/tone/tone.types';

/* -- Los nodos ------------------------------------------------------------- */

/**
 * Qué clase de registro es un nodo. El orden es el de los chips del filtro:
 * el de una historia contada — se agenda, se atiende, se piensa, se estudia,
 * se deriva, se trata.
 */
export const TIPOS_DE_NODO = [
  'cita',
  'reconsulta',
  'atencion',
  'diagnostico',
  'estudio',
  'derivacion',
  'medicacion',
  'procedimiento',
  'plan',
  'observacion',
  'internacion',
  'nota',
  'documento',
] as const;

export type TipoDeNodo = (typeof TIPOS_DE_NODO)[number];

export interface AspectoDeTipo {
  readonly singular: string;
  readonly plural: string;
  readonly icono: NavIconName;
}

/** Nombre e ícono de cada tipo. El tipo nunca se comunica sólo con color. */
export const ASPECTO_DE_TIPO: Readonly<Record<TipoDeNodo, AspectoDeTipo>> = {
  cita: { singular: 'Cita', plural: 'Citas', icono: 'calendar' },
  reconsulta: { singular: 'Reconsulta', plural: 'Reconsultas', icono: 'history' },
  atencion: { singular: 'Atención', plural: 'Atenciones', icono: 'stethoscope' },
  diagnostico: { singular: 'Diagnóstico', plural: 'Diagnósticos', icono: 'heart' },
  estudio: { singular: 'Estudio', plural: 'Estudios', icono: 'flask' },
  derivacion: { singular: 'Derivación', plural: 'Derivaciones', icono: 'route' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', icono: 'pill' },
  procedimiento: { singular: 'Procedimiento', plural: 'Procedimientos', icono: 'scalpel' },
  plan: { singular: 'Plan de cuidados', plural: 'Planes de cuidados', icono: 'clipboard' },
  observacion: { singular: 'Observación', plural: 'Observaciones', icono: 'chart' },
  internacion: { singular: 'Internación', plural: 'Internaciones', icono: 'hospital' },
  nota: { singular: 'Nota clínica', plural: 'Notas', icono: 'note' },
  documento: { singular: 'Documento', plural: 'Documentos', icono: 'folder' },
};

/** Una persona o una especialidad: id estable para filtrar, nombre para leer. */
export interface Referencia {
  readonly id: string;
  readonly nombre: string;
}

/** El estado del registro tal como se lee en el expediente. */
export interface EstadoDeNodo {
  readonly etiqueta: string;
  /** Mismo tono que en la tabla del bloque; nunca va solo, va con la etiqueta. */
  readonly tono?: Tone;
}

/**
 * Un nodo de la red: lo mínimo para filtrarlo, nombrarlo y abrir su panel.
 *
 * `detalle` es opcional: sin él el panel muestra la cabecera (qué, cuándo,
 * quién, estado) y los vínculos, que ya es útil.
 */
export interface NodoDeRed {
  readonly id: string;
  readonly tipo: TipoDeNodo;
  /** Qué es: «Hipertensión arterial esencial», «Hemograma completo». */
  readonly titulo: string;
  /** Una línea de contexto: «Ambulatorio · Sede Centro». */
  readonly subtitulo?: string;
  /** Cuándo ocurrió o se registró. `null` si el contrato no lo trae. */
  readonly cuando: Date | null;
  /** Quién: el profesional que atendió, pidió, diagnosticó o derivó. */
  readonly profesional?: Referencia | null;
  readonly especialidad?: Referencia | null;
  readonly estado?: EstadoDeNodo | null;
  /** Texto adicional para la búsqueda (motivo, códigos); no se muestra. */
  readonly buscable?: string;
  readonly detalle?: DetalleDeNodo;
}

/* -- El análisis de cada tipo --------------------------------------------- */

export type DetalleDeNodo =
  | DetalleDeEstudio
  | DetalleDeDiagnostico
  | DetalleDeDerivacion
  | DetalleDeCita
  | DetalleGeneral;

/**
 * Cómo leyó el laboratorio un valor. Si viene, manda sobre la comparación con
 * el rango (el laboratorio puede usar rangos por edad o sexo que acá no están).
 */
export type InterpretacionDeValor = 'normal' | 'bajo' | 'alto' | 'critico-bajo' | 'critico-alto' | 'anormal';

export interface RangoDeReferencia {
  readonly bajo?: number;
  readonly alto?: number;
  /** El rango tal como lo imprime el informe, si no es numérico: «Negativo». */
  readonly texto?: string;
}

/** Un valor de un resultado liberado. */
export interface ValorDeResultado {
  readonly nombre: string;
  /** El número o el texto del valor; un texto no se compara con el rango. */
  readonly valor: number | string;
  readonly unidad?: string;
  readonly rango?: RangoDeReferencia;
  readonly interpretacion?: InterpretacionDeValor;
}

/** Un archivo del informe: lo que se abre o se descarga. */
export interface ArchivoDeInforme {
  /** El `fileId` de `GET /common/files/:id/content`. */
  readonly fileId: string;
  readonly nombre: string;
}

/** El resultado **liberado**. Un borrador nunca llega acá. */
export interface ResultadoDeEstudio {
  /**
   * Cuándo se liberó. `null` cuando el contrato dice que hay una versión
   * liberada pero no cuándo (la lectura del profesional,
   * `GET /diagnostics/patients/:id/orders`, publica `currentReleasedVersionId`
   * y no la fecha): el panel dice «Liberado» sin inventar el día.
   */
  readonly liberadoEn: Date | null;
  readonly conclusion?: string;
  readonly valores: readonly ValorDeResultado[];
  readonly archivos: readonly ArchivoDeInforme[];
}

export interface DetalleDeEstudio {
  readonly tipo: 'estudio';
  /** «Laboratorio», «Imagen». */
  readonly categoria?: string;
  readonly prioridad?: string;
  /** Por qué se pidió, en texto (nota de la orden). */
  readonly motivo?: string;
  /** `null` = pedido sin resultado liberado todavía. */
  readonly resultado: ResultadoDeEstudio | null;
}

/** La certeza del diagnóstico, en el vocabulario de C3. */
export type CertezaDiagnostica = 'presuntivo' | 'confirmado' | 'descartado';

export interface EvidenciaDeDecision {
  readonly tipo: 'nota' | 'analisis';
  /** Lo que se lee: «Hemograma del 12/10», «Nota de evolución». */
  readonly etiqueta: string;
  /** Si la evidencia está en la red, para navegar a ella. */
  readonly nodoId?: string;
}

/** La decisión de C3 (P41): quién confirmó o descartó, cuándo y por qué. */
export interface DecisionDiagnostica {
  readonly resultado: 'confirmado' | 'descartado';
  readonly decididoEn: Date;
  readonly decididoPor?: string | null;
  readonly motivo?: string | null;
  readonly evidencia?: EvidenciaDeDecision | null;
}

export interface DetalleDeDiagnostico {
  readonly tipo: 'diagnostico';
  readonly certeza: CertezaDiagnostica;
  /** Hallazgos y justificación clínica (`noteText`). */
  readonly nota?: string;
  readonly decision?: DecisionDiagnostica | null;
  /** El diagnóstico que quedó en lugar de éste (`replacedByConditionId`). */
  readonly reemplazadoPor?: { readonly nodoId: string; readonly etiqueta: string } | null;
  readonly inicio?: Date | null;
}

export interface DetalleDeDerivacion {
  readonly tipo: 'derivacion';
  /** «Interconsulta», «Estudio diagnóstico». */
  readonly tipoDeDerivacion?: string;
  readonly destino?: string;
  readonly motivo?: string;
  readonly resumenClinico?: string;
  readonly respuesta?: {
    readonly decision: 'aceptada' | 'rechazada';
    readonly en?: Date | null;
    readonly motivoDeRechazo?: string | null;
  } | null;
  readonly llegada?: {
    readonly en: Date;
    /** La atención en la que el destino lo recibió (`targetEncounterId`). */
    readonly atencionNodoId?: string | null;
    readonly notas?: string | null;
  } | null;
  readonly contrarreferencia?: { readonly texto: string; readonly en?: Date | null } | null;
}

export interface DetalleDeCita {
  readonly tipo: 'cita' | 'reconsulta';
  readonly motivo?: string;
  readonly modalidad?: string;
  readonly lugar?: string;
}

/** Atención, medicación, nota, documento…: un resumen y pares rótulo/valor. */
export interface DetalleGeneral {
  readonly tipo: 'general';
  readonly resumen?: string;
  readonly datos?: readonly { readonly rotulo: string; readonly valor: string }[];
}

/* -- Los vínculos ---------------------------------------------------------- */

/**
 * Por qué dos nodos están conectados. Cada tipo dice **en qué sentido** va la
 * flecha (`desde` → `hasta`) en la tabla de abajo, y no hay otros: un vínculo
 * fuera de esta lista sería una asociación inventada.
 */
export const TIPOS_DE_VINCULO = [
  'registrado-en',
  'reconsulta-de',
  'derivada-desde',
  'recibida-en',
  'orden-de-derivacion',
  'pedido-para',
  'evidencia-de',
  'indicado-para',
  'reemplazado-por',
  'reemplaza-receta',
  'estudio-previo',
  'resultado-de',
  'plan-para',
  'atendida-en',
  'durante-internacion',
] as const;

export type TipoDeVinculo = (typeof TIPOS_DE_VINCULO)[number];

/** Cómo se lee un vínculo desde cada punta: saliente (desde) y entrante (hasta). */
export interface LecturaDeVinculo {
  readonly saliente: string;
  readonly entrante: string;
}

export const LECTURA_DE_VINCULO: Readonly<Record<TipoDeVinculo, LecturaDeVinculo>> = {
  'registrado-en': { saliente: 'Se registró en', entrante: 'Se registró aquí' },
  'reconsulta-de': { saliente: 'Reconsulta de', entrante: 'Tuvo como reconsulta' },
  'derivada-desde': { saliente: 'Derivada desde', entrante: 'Originó la derivación' },
  'recibida-en': { saliente: 'Recibida en', entrante: 'Llegada por derivación' },
  'orden-de-derivacion': { saliente: 'Orden asociada', entrante: 'Pedida por la derivación' },
  'pedido-para': { saliente: 'Se pidió para estudiar', entrante: 'Estudio pedido para esto' },
  'evidencia-de': { saliente: 'Sustentó la decisión sobre', entrante: 'Decisión sustentada en' },
  'indicado-para': { saliente: 'Indicado para', entrante: 'Tratamiento indicado' },
  'reemplazado-por': { saliente: 'Descartado en favor de', entrante: 'Reemplaza a' },
  'reemplaza-receta': { saliente: 'Reemplazada por', entrante: 'Reemplaza a la receta' },
  'estudio-previo': { saliente: 'Reutiliza o repite', entrante: 'Reutilizado o repetido por' },
  'resultado-de': { saliente: 'Resultado de', entrante: 'Su resultado' },
  'plan-para': { saliente: 'Plan para', entrante: 'Plan de cuidados' },
  'atendida-en': { saliente: 'Atendida en', entrante: 'Atención de la cita' },
  'durante-internacion': { saliente: 'Durante la internación', entrante: 'Atención durante la internación' },
};

/** Una conexión de la red. */
export interface AristaDeRed {
  readonly desde: string;
  readonly hasta: string;
  readonly tipo: TipoDeVinculo;
  /**
   * `true` cuando el vínculo no está guardado en el contrato sino deducido
   * (misma fecha, mismo motivo). El panel lo dice con palabras: un vínculo
   * inferido no es un dato clínico.
   */
  readonly inferido?: boolean;
}
