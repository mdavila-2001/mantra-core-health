import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { Badge } from '../../atoms/badge/badge';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';
import { FactList } from '../../molecules/fact-list/fact-list';
import type { Hecho } from '../../molecules/fact-list/fact-list.types';
import {
  TIPOS_DE_HECHO,
  type EncounterHeader,
  type HechoDeLaLinea,
  type TimelineCondition,
  type TimelineFollowUp,
  type TimelineNote,
  type TimelineOrder,
  type TimelinePrescription,
  type TipoDeHecho,
} from './encounter-timeline.types';

/**
 * El día y la hora de la reconsulta: «02/10 a las 10:30».
 *
 * A mano y no con `Intl.DateTimeFormat`: `es-BO` con `day: '2-digit'` devuelve
 * `2/10` en el ICU de este entorno y `02/10` en otro, así que el rótulo que el
 * carril pide letra por letra dependería de qué datos de locale tenga la
 * máquina. El relleno con cero es del rótulo, no del idioma.
 */
function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** «02/10», en la zona de quien lo lee. */
function diaCorto(cuando: Date): string {
  return `${dosDigitos(cuando.getDate())}/${dosDigitos(cuando.getMonth() + 1)}`;
}

/** «10:30», en la zona de quien lo lee: una cita se cumple en hora local. */
function hora(cuando: Date): string {
  return `${dosDigitos(cuando.getHours())}:${dosDigitos(cuando.getMinutes())}`;
}

/**
 * El dibujo de cada tipo de hecho.
 *
 * Del set cerrado de la navegación (`app-nav-icon`) y no de
 * `app-data-type-icon` ni de `app-service-icon`: aquél habla de tipos de dato
 * de un formulario y éste de servicios del catálogo, y un hecho clínico no es
 * ninguna de las dos cosas. Reusar el ícono equivocado hace que dos pantallas
 * digan lo mismo con dibujos distintos, que es justo lo que un set cerrado
 * viene a evitar.
 */
const ICONOS: Readonly<Record<TipoDeHecho, NavIconName>> = Object.freeze({
  nota: 'note',
  orden: 'flask',
  diagnostico: 'stethoscope',
  reconsulta: 'calendar',
  receta: 'pill',
});

/** Cuánto pesa cada tipo al desempatar. Es el orden en que se cuenta la consulta. */
const PESO: Readonly<Record<TipoDeHecho, number>> = Object.freeze(
  Object.fromEntries(TIPOS_DE_HECHO.map((tipo, indice) => [tipo, indice])) as Record<
    TipoDeHecho,
    number
  >,
);

/**
 * **La línea del encuentro**: lo que pasó en una atención, en el orden en que pasó.
 *
 * ```html
 * <app-encounter-timeline
 *   [encounter]="atencion"
 *   [notes]="notas"
 *   [orders]="ordenes"
 *   [conditions]="diagnosticos"
 *   [prescriptions]="recetas"
 *   [followUp]="reconsulta"
 * />
 * ```
 *
 * ## Qué reemplaza
 *
 * Una atención se leía como tres datos sueltos —motivo, fecha, «Diagnósticos:
 * A, B»— y todo lo demás vivía en otra pestaña o directamente no se mostraba:
 * la nota del profesional, los estudios que pidió, la reconsulta que dejó
 * agendada y la receta que emitió eran cinco hechos de **la misma consulta**
 * repartidos por cinco lugares. Quien lee su historia no piensa en cinco
 * módulos: piensa en «qué pasó aquel día».
 *
 * ## Es presentacional puro, y eso es parte del contrato
 *
 * No inyecta ningún cliente ni conoce la terminología: todo llega traducido y
 * rotulado desde quien la monta. Por eso la puede montar el archivo del
 * paciente y, después, la consulta y el expediente del profesional (C8) sin que
 * el mismo hecho clínico salga distinto según quién lo mire.
 *
 * ## El orden
 *
 * Por instante, de lo más viejo a lo más nuevo. Dos hechos del mismo instante
 * —o sin instante— se desempatan por el orden en que se cuenta una consulta:
 * nota → orden → diagnóstico → reconsulta → receta. Los hechos **sin fecha van
 * al final**: uno que no sabe cuándo pasó no puede afirmar que pasó antes que
 * uno fechado.
 */
@Component({
  selector: 'app-encounter-timeline',
  imports: [Badge, DatePipe, FactList, NavIcon],
  templateUrl: './encounter-timeline.html',
  styleUrl: './encounter-timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'linea-encuentro',
  },
})
export class EncounterTimeline {
  /** La atención. Da el nombre accesible de la línea y su cierre; no se pinta el id. */
  readonly encounter = input.required<EncounterHeader>();

  readonly notes = input<readonly TimelineNote[]>([]);
  readonly orders = input<readonly TimelineOrder[]>([]);
  readonly conditions = input<readonly TimelineCondition[]>([]);
  readonly prescriptions = input<readonly TimelinePrescription[]>([]);

  /** La reconsulta agendada a partir de esta atención, si la hay. */
  readonly followUp = input<TimelineFollowUp | null>(null);

  /**
   * Las órdenes todavía no llegaron.
   *
   * Una bandera y no un `ViewState`: el organismo no pide nada, sólo necesita
   * saber si tiene que decir «faltan los estudios» en vez de callarse. Quien la
   * monta es quien sabe si hay una lectura en vuelo.
   */
  readonly loadingOrders = input(false, { transform: booleanAttribute });

  /** Los cinco orígenes, normalizados y ordenados. */
  protected readonly linea = computed<readonly HechoDeLaLinea[]>(() =>
    [
      ...this.notes().map((nota) => hechoDeNota(nota)),
      ...this.orders().map((orden) => hechoDeOrden(orden)),
      ...this.conditions().map((condicion) => hechoDeDiagnostico(condicion)),
      ...hechosDeReconsulta(this.followUp()),
      ...this.prescriptions().map((receta) => hechoDeReceta(receta)),
    ].sort(porCuandoYTipo),
  );

  protected readonly vacia = computed(() => this.linea().length === 0);

  /** «Línea de la atención: Dolor de garganta». El id jamás entra acá. */
  protected readonly nombreAccesible = computed(
    () => `Línea de la atención: ${this.encounter().motivo}`,
  );

  protected readonly cierre = computed(() =>
    this.encounter().cerrada ? 'Atención cerrada' : 'Atención en curso',
  );

  protected iconoDe(tipo: TipoDeHecho): NavIconName {
    return ICONOS[tipo];
  }
}

/**
 * Por instante y, a igualdad, por el orden del relato.
 *
 * Sin fecha pesa infinito: va al final en vez de colarse al principio, que es
 * lo que hace un `0` y lo que dejaría la nota de una consulta vieja encabezando
 * la línea de otra.
 */
function porCuandoYTipo(a: HechoDeLaLinea, b: HechoDeLaLinea): number {
  const instanteA = a.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  const instanteB = b.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  return instanteA === instanteB ? PESO[a.tipo] - PESO[b.tipo] : instanteA - instanteB;
}

function hechoDeNota(nota: TimelineNote): HechoDeLaLinea {
  return {
    id: nota.id,
    tipo: 'nota',
    titulo: nota.rotulo,
    detalle: null,
    sello: null,
    tono: 'info',
    cuando: nota.cuando,
    hechos: nota.filas,
  };
}

/** «Análisis de laboratorio: Hemograma — resultado disponible». */
function hechoDeOrden(orden: TimelineOrder): HechoDeLaLinea {
  return {
    id: orden.id,
    tipo: 'orden',
    titulo: orden.categoria === '' ? orden.estudio : `${orden.categoria}: ${orden.estudio}`,
    detalle: orden.resultadoDisponible ? 'resultado disponible' : null,
    sello: orden.estado === '' ? null : orden.estado,
    tono: orden.resultadoDisponible ? 'success' : 'info',
    cuando: orden.cuando,
    hechos: [],
  };
}

/** «Diagnóstico confirmado: Hipertensión — activa hasta 24/11». */
function hechoDeDiagnostico(condicion: TimelineCondition): HechoDeLaLinea {
  return {
    id: condicion.id,
    tipo: 'diagnostico',
    titulo: `${condicion.estado}: ${condicion.nombre}`,
    detalle: condicion.detalle,
    sello: null,
    tono: condicion.tono,
    cuando: condicion.cuando,
    hechos: [],
  };
}

/**
 * «Reconsulta el 02/10 a las 10:30».
 *
 * Devuelve una lista de cero o un elemento para que el llamador la concatene
 * sin un `if` por fuera: no hay reconsulta es no hay hecho, no es un hecho vacío.
 */
function hechosDeReconsulta(reconsulta: TimelineFollowUp | null): readonly HechoDeLaLinea[] {
  if (reconsulta === null) {
    return [];
  }
  const hechos: Hecho[] =
    reconsulta.profesional === null ? [] : [{ etiqueta: 'Con', valor: reconsulta.profesional }];
  return [
    {
      id: reconsulta.id,
      tipo: 'reconsulta',
      titulo:
        reconsulta.cuando === null
          ? 'Reconsulta agendada'
          : `Reconsulta el ${diaCorto(reconsulta.cuando)} a las ${hora(reconsulta.cuando)}`,
      detalle: null,
      sello: reconsulta.estado === '' ? null : reconsulta.estado,
      tono: 'primary',
      cuando: reconsulta.cuando,
      hechos,
    },
  ];
}

/** «Receta: Losartán — por Hipertensión». */
function hechoDeReceta(receta: TimelinePrescription): HechoDeLaLinea {
  return {
    id: receta.id,
    tipo: 'receta',
    titulo: `Receta: ${receta.medicamento}`,
    detalle: receta.indicacion === null ? null : `por ${receta.indicacion}`,
    sello: null,
    tono: 'secondary',
    cuando: receta.cuando,
    hechos: receta.detalle === null ? [] : [{ etiqueta: 'Indicación', valor: receta.detalle }],
  };
}
