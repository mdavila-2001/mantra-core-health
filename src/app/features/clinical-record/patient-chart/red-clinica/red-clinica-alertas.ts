/* ============================================================================
    Alertas de apoyo: lo que quedó abierto en la historia del paciente.

    Decisión del usuario (06/11/2026): **alertas sí, sugerencias de diagnóstico
    no**. Cada alerta señala un hecho verificable en los registros —un
    presuntivo que nadie resolvió, un estudio sin resultado, una derivación sin
    respuesta, algo que se repite, un valor fuera de rango— y nunca concluye qué
    tiene el paciente. La redacción se cuida en ese sentido: «sin resolver», «se
    repite», «fuera del rango informado»; nunca «posible», «compatible con» ni
    «descartar».

    Funciones puras sobre los tipos de `core/data-access` tal como llegan del
    API. Lo que el API no dice en claro (los códigos de catálogo) se resuelve
    con `codigoDe`, igual que en `diagnosis-block`. Los vínculos de la franja 1
    (`reasonConditionId`, `targetEncounterId`, `replacedByConditionId`) son
    opcionales en el contrato: ausentes, las alertas trabajan con lo que hay.
    ========================================================================== */

import type { Condition, Encounter } from '../../../../core/data-access/clinical/clinical.types';
import type {
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  type ResolverCodigo,
} from '../../../../shared/clinical/diagnosis-state';
import { normalizarTexto } from './red-clinica-filtro';
import { esCritico, estaFueraDeRango, textoDelRango, textoDelValor } from './red-clinica-valores';
import type { TipoDeNodo, ValorDeResultado } from './red-clinica.types';

/* -- El contrato de salida ------------------------------------------------- */

export const TIPOS_DE_ALERTA = [
  'resultado-critico',
  'resultado-fuera-de-rango',
  'presuntivo-sin-resolver',
  'estudio-sin-resultado',
  'derivacion-sin-respuesta',
  'derivacion-sin-contrarreferencia',
  'diagnostico-repetido',
  'motivo-repetido',
] as const;

export type TipoDeAlerta = (typeof TIPOS_DE_ALERTA)[number];

/**
 * - `alta`: conviene mirarlo hoy (valor crítico, plazo muy vencido);
 * - `media`: pasó el plazo de referencia;
 * - `baja`: abierto, pero dentro de lo esperable, o un patrón para tener presente.
 */
export type PrioridadDeAlerta = 'alta' | 'media' | 'baja';

export interface AlertaDeApoyo {
  /** Estable entre recálculos: `tipo:idDelRegistro`. */
  readonly id: string;
  readonly tipo: TipoDeAlerta;
  readonly prioridad: PrioridadDeAlerta;
  /** Una línea: qué quedó abierto. */
  readonly titulo: string;
  /** El dato que la sostiene: antigüedad, cuántas veces, qué valor. */
  readonly detalle: string;
  /** El nodo al que lleva el clic. */
  readonly nodoId: string;
  /** Todos los nodos que la red debe resaltar (incluye `nodoId`). */
  readonly nodoIds: readonly string[];
  /** Días desde el hecho que la origina, si aplica. */
  readonly dias?: number;
}

/* -- El contrato de entrada ------------------------------------------------ */

/** Un resultado liberado con sus valores, ya traducidos (ver `ValorDeResultado`). */
export interface ResultadoParaAlertas {
  /** El nodo del estudio (o del informe) en la red. */
  readonly nodoId: string;
  readonly estudio: string;
  readonly valores: readonly ValorDeResultado[];
}

export interface Umbrales {
  /** Días tras los que un presuntivo sin resolver sube a prioridad media. */
  readonly presuntivoDias: number;
  /** Días tras los que un estudio sin resultado sube a prioridad media. */
  readonly estudioDias: number;
  /** Días tras los que una derivación sin respuesta sube a prioridad media. */
  readonly derivacionDias: number;
  /** Días desde la llegada tras los que falta la contrarreferencia. */
  readonly contrarreferenciaDias: number;
  /** Cuántas veces tiene que aparecer un motivo para avisar. */
  readonly repeticiones: number;
}

/**
 * Los plazos por omisión. Son de **referencia**, no normas clínicas: cada
 * servicio puede pasar los suyos. El triple del plazo sube a prioridad alta.
 */
export const UMBRALES_POR_OMISION: Umbrales = Object.freeze({
  presuntivoDias: 14,
  estudioDias: 7,
  derivacionDias: 7,
  contrarreferenciaDias: 14,
  repeticiones: 2,
});

export interface EntradaDeAlertas {
  readonly ahora: Date;
  readonly diagnosticos?: readonly Condition[];
  readonly ordenes?: readonly DiagnosticOrder[];
  readonly informes?: readonly DiagnosticReport[];
  readonly derivaciones?: readonly Referral[];
  readonly atenciones?: readonly Encounter[];
  readonly resultados?: readonly ResultadoParaAlertas[];
  /** concepto → código de catálogo (`TerminologyClient.readConceptLabels`). */
  readonly codigoDe?: ResolverCodigo;
  /** concepto → nombre legible; sin él se dice «Diagnóstico», «Estudio». */
  readonly etiquetaDe?: (conceptId: string | undefined) => string | undefined;
  /** El id de nodo de un registro. Por omisión, el id del registro. */
  readonly idDeNodo?: (tipo: TipoDeNodo, idDelRegistro: string) => string;
  readonly umbrales?: Partial<Umbrales>;
}

/* -- Utilidades ------------------------------------------------------------ */

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días completos entre dos instantes (nunca negativo). */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS));
}

/**
 * «hoy», «hace 1 día», «hace 12 días»; desde 60 días, «hace 3 meses (94 días)»:
 * los meses se leen rápido y los días son el dato que se compara con un plazo.
 */
export function antiguedad(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  if (dias < 60) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} meses (${dias} días)`;
}

function prioridadPorPlazo(dias: number, plazo: number): PrioridadDeAlerta {
  if (dias >= plazo * 3) return 'alta';
  if (dias >= plazo) return 'media';
  return 'baja';
}

function fecha(d: Date): string {
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

const sinCodigo: ResolverCodigo = () => undefined;

/* -- Las reglas ------------------------------------------------------------ */

/**
 * Presuntivos sin resolver: la condición no está confirmada ni descartada
 * (por catálogo **o** por la decisión de C3) y no se resolvió.
 */
export function presuntivosSinResolver(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const codigo = entrada.codigoDe ?? sinCodigo;
  const umbral = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.presuntivoDias;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  return (entrada.diagnosticos ?? [])
    .filter((c) => {
      if (c.verification?.outcome !== undefined) return false;
      if (c.resolvedAt !== undefined) return false;
      if (c.replacedByConditionId !== undefined) return false;
      const estado = diagnosisStateOf(
        {
          ...c,
          verificationStatusConceptId: codigo(c.verificationStatusConceptId),
          clinicalStatusConceptId: codigo(c.clinicalStatusConceptId),
        },
        { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
        entrada.ahora,
      );
      return estado === 'IN_STUDY';
    })
    .map((c) => {
      const dias = diasEntre(c.createdAt, entrada.ahora);
      const nombre = entrada.etiquetaDe?.(c.codeConceptId) ?? 'Diagnóstico presuntivo';
      const nodo = idDeNodo('diagnostico', c.id);
      const estudios = (entrada.ordenes ?? []).filter(
        (o) => o.reasonConditionId === c.id,
      );
      const conEstudios =
        estudios.length === 0
          ? 'Sin estudios pedidos para confirmarlo o descartarlo.'
          : `${estudios.length} ${estudios.length === 1 ? 'estudio pedido' : 'estudios pedidos'} para resolverlo.`;
      return {
        id: `presuntivo-sin-resolver:${c.id}`,
        tipo: 'presuntivo-sin-resolver' as const,
        prioridad: prioridadPorPlazo(dias, umbral),
        titulo: `Presuntivo sin resolver: ${nombre}`,
        detalle: `Registrado ${antiguedad(dias)} (${fecha(c.createdAt)}), sigue sin confirmarse ni descartarse. ${conEstudios}`,
        nodoId: nodo,
        nodoIds: [nodo, ...estudios.map((o) => idDeNodo('estudio', o.id))],
        dias,
      };
    });
}

const ESTADO_DE_ORDEN_CERRADA = /CANCEL|REVOK|ENTERED_IN_ERROR|ERROR|ANULAD/;

/**
 * Estudios pedidos sin resultado **liberado**. No cuenta la orden satisfecha
 * por un informe previo (antiduplicación) ni la cancelada o anulada.
 */
export function estudiosSinResultado(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const codigo = entrada.codigoDe ?? sinCodigo;
  const umbral = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.estudioDias;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const liberadas = new Set(
    (entrada.informes ?? [])
      .filter((i) => i.currentReleasedVersionId !== undefined && i.serviceRequestId !== undefined)
      .map((i) => i.serviceRequestId as string),
  );
  return (entrada.ordenes ?? [])
    .filter((o) => !liberadas.has(o.id))
    .filter((o) => o.previousDiagnosticReportId === undefined)
    .filter((o) => !ESTADO_DE_ORDEN_CERRADA.test(codigo(o.statusConceptId) ?? ''))
    .map((o) => {
      const dias = diasEntre(o.createdAt, entrada.ahora);
      const nombre = entrada.etiquetaDe?.(o.codeConceptId) ?? 'Estudio';
      const nodo = idDeNodo('estudio', o.id);
      const motivo = o.reasonConditionId;
      const borrador = (entrada.informes ?? []).some(
        (i) => i.serviceRequestId === o.id && i.currentVersionId !== undefined,
      );
      return {
        id: `estudio-sin-resultado:${o.id}`,
        tipo: 'estudio-sin-resultado' as const,
        prioridad: prioridadPorPlazo(dias, umbral),
        titulo: `Estudio sin resultado liberado: ${nombre}`,
        detalle:
          `Pedido ${antiguedad(dias)} (${fecha(o.createdAt)}).` +
          (borrador ? ' Hay un informe en redacción, todavía no validado.' : ' Aún no hay informe.'),
        nodoId: nodo,
        nodoIds: motivo === undefined ? [nodo] : [nodo, idDeNodo('diagnostico', motivo)],
        dias,
      };
    });
}

/** Derivaciones sin respuesta del destino, y aceptadas sin contrarreferencia. */
export function derivacionesAbiertas(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const umbrales = { ...UMBRALES_POR_OMISION, ...entrada.umbrales };
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const alertas: AlertaDeApoyo[] = [];
  for (const r of entrada.derivaciones ?? []) {
    const destino = r.targetDisplayName ?? r.targetTenantName ?? r.targetExternalName ?? 'el destino';
    const nodo = idDeNodo('derivacion', r.id);
    const estado = r.status;
    if (estado === 'CANCELLED' || estado === 'REJECTED') continue;

    const sinRespuesta =
      estado === 'PENDING' || (estado === undefined && r.respondedAt === undefined);
    if (sinRespuesta) {
      const dias = diasEntre(r.createdAt, entrada.ahora);
      alertas.push({
        id: `derivacion-sin-respuesta:${r.id}`,
        tipo: 'derivacion-sin-respuesta',
        prioridad: prioridadPorPlazo(dias, umbrales.derivacionDias),
        titulo: `Derivación sin respuesta de ${destino}`,
        detalle: `Enviada ${antiguedad(dias)} (${fecha(r.createdAt)}); el destino no la aceptó ni la rechazó.`,
        nodoId: nodo,
        nodoIds: [nodo],
        dias,
      });
      continue;
    }

    if (r.counterReferralText !== undefined && r.counterReferralText.trim() !== '') continue;
    const llegada = r.transfer?.arrivedAt;
    // Sólo existe tras ACCEPT: lo escribe el destino al aceptar o al registrar la llegada.
    const atencionDestino = r.targetEncounterId;
    const desde = llegada ?? r.respondedAt;
    // Sin llegada ni respuesta fechada no hay desde cuándo contar: no se avisa.
    if (desde === undefined) continue;
    const dias = diasEntre(desde, entrada.ahora);
    if (dias < umbrales.contrarreferenciaDias) continue;
    const ids = [nodo];
    if (atencionDestino !== undefined) ids.push(idDeNodo('atencion', atencionDestino));
    alertas.push({
      id: `derivacion-sin-contrarreferencia:${r.id}`,
      tipo: 'derivacion-sin-contrarreferencia',
      prioridad: prioridadPorPlazo(dias, umbrales.contrarreferenciaDias * 2),
      titulo: `Derivación sin contrarreferencia de ${destino}`,
      detalle:
        (llegada !== undefined
          ? `El paciente llegó ${antiguedad(dias)} (${fecha(llegada)})`
          : `Aceptada ${antiguedad(dias)} (${fecha(desde)})`) +
        '; el destino todavía no devolvió su informe.',
      nodoId: nodo,
      nodoIds: ids,
      dias,
    });
  }
  return alertas;
}

/** El mismo diagnóstico (mismo concepto) registrado más de una vez. */
export function diagnosticosRepetidos(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const minimo = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.repeticiones;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const porConcepto = new Map<string, Condition[]>();
  for (const c of entrada.diagnosticos ?? []) {
    const lista = porConcepto.get(c.codeConceptId) ?? [];
    lista.push(c);
    porConcepto.set(c.codeConceptId, lista);
  }
  return [...porConcepto.entries()]
    .filter(([, lista]) => lista.length >= minimo)
    .map(([concepto, lista]) => {
      const ordenadas = [...lista].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const nombre = entrada.etiquetaDe?.(concepto) ?? 'Un diagnóstico';
      const primera = ordenadas[0].createdAt;
      const ultima = ordenadas[ordenadas.length - 1].createdAt;
      const ids = ordenadas.map((c) => idDeNodo('diagnostico', c.id));
      return {
        id: `diagnostico-repetido:${concepto}`,
        tipo: 'diagnostico-repetido' as const,
        prioridad: 'baja' as const,
        titulo: `Diagnóstico registrado ${lista.length} veces: ${nombre}`,
        detalle: `Entre el ${fecha(primera)} y el ${fecha(ultima)}. Conviene revisar si es el mismo episodio o uno nuevo.`,
        nodoId: ids[ids.length - 1],
        nodoIds: ids,
      };
    });
}

/** El mismo motivo de consulta (texto normalizado) en varias atenciones. */
export function motivosRepetidos(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const minimo = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.repeticiones;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const porMotivo = new Map<string, { texto: string; atenciones: Encounter[] }>();
  for (const e of entrada.atenciones ?? []) {
    const texto = e.reasonText?.trim();
    if (!texto) continue;
    const clave = normalizarTexto(texto).replace(/\s+/g, ' ').replace(/[.,;:]+$/, '');
    const grupo = porMotivo.get(clave) ?? { texto, atenciones: [] };
    grupo.atenciones.push(e);
    porMotivo.set(clave, grupo);
  }
  return [...porMotivo.entries()]
    .filter(([, g]) => g.atenciones.length >= minimo)
    .map(([clave, g]) => {
      const fechas = g.atenciones
        .map((e) => e.startAt)
        .filter((d): d is Date => d !== undefined)
        .sort((a, b) => a.getTime() - b.getTime());
      const ordenadas = [...g.atenciones].sort(
        (a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0),
      );
      const ids = ordenadas.map((e) => idDeNodo('atencion', e.id));
      const rango =
        fechas.length >= 2
          ? `Entre el ${fecha(fechas[0])} y el ${fecha(fechas[fechas.length - 1])}.`
          : 'En atenciones distintas.';
      return {
        id: `motivo-repetido:${clave}`,
        tipo: 'motivo-repetido' as const,
        prioridad: 'baja' as const,
        titulo: `Motivo de consulta repetido ${g.atenciones.length} veces: «${g.texto}»`,
        detalle: `${rango} Puede valer la pena mirar las atenciones juntas.`,
        nodoId: ids[ids.length - 1],
        nodoIds: ids,
      };
    });
}

/** Valores de resultados liberados fuera del rango informado (o críticos). */
export function resultadosFueraDeRango(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const alertas: AlertaDeApoyo[] = [];
  for (const r of entrada.resultados ?? []) {
    const fuera = r.valores.filter(estaFueraDeRango);
    if (fuera.length === 0) continue;
    const criticos = fuera.filter(esCritico);
    const describir = (v: ValorDeResultado) =>
      `${v.nombre} ${textoDelValor(v)} (referencia ${textoDelRango(v.rango, v.unidad)})`;
    const lista = fuera.slice(0, 3).map(describir).join('; ');
    const resto = fuera.length > 3 ? `; y ${fuera.length - 3} más` : '';
    const critico = criticos.length > 0;
    alertas.push({
      id: `${critico ? 'resultado-critico' : 'resultado-fuera-de-rango'}:${r.nodoId}`,
      tipo: critico ? 'resultado-critico' : 'resultado-fuera-de-rango',
      prioridad: critico ? 'alta' : 'media',
      titulo: critico
        ? `Valor crítico informado en ${r.estudio}`
        : `${fuera.length} ${fuera.length === 1 ? 'valor fuera' : 'valores fuera'} del rango de referencia en ${r.estudio}`,
      detalle: `${lista}${resto}.`,
      nodoId: r.nodoId,
      nodoIds: [r.nodoId],
    });
  }
  return alertas;
}

const PESO_DE_PRIORIDAD: Readonly<Record<PrioridadDeAlerta, number>> = { alta: 0, media: 1, baja: 2 };

/**
 * Todas las alertas, de la más urgente a la menos: por prioridad, luego por
 * el orden de `TIPOS_DE_ALERTA`, luego por antigüedad (la más vieja primero).
 */
export function alertasDeApoyo(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const todas = [
    ...resultadosFueraDeRango(entrada),
    ...presuntivosSinResolver(entrada),
    ...estudiosSinResultado(entrada),
    ...derivacionesAbiertas(entrada),
    ...diagnosticosRepetidos(entrada),
    ...motivosRepetidos(entrada),
  ];
  return todas.sort(
    (a, b) =>
      PESO_DE_PRIORIDAD[a.prioridad] - PESO_DE_PRIORIDAD[b.prioridad] ||
      TIPOS_DE_ALERTA.indexOf(a.tipo) - TIPOS_DE_ALERTA.indexOf(b.tipo) ||
      (b.dias ?? 0) - (a.dias ?? 0),
  );
}

/** Los ids de nodo a resaltar por un conjunto de alertas. */
export function nodosAlertados(alertas: readonly AlertaDeApoyo[]): ReadonlySet<string> {
  return new Set(alertas.flatMap((a) => a.nodoIds));
}
