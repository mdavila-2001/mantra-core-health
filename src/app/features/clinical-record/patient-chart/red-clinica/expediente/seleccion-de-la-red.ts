import { computed, inject, Injectable, signal } from '@angular/core';

import { AnchoDelCajon } from '../ancho-del-cajon';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { dataOf } from '../../../../../core/view-state/view-state';
import { CLASE_DEL_TIPO } from '../../recorrido-clinico/red-clinica.adaptador';
import { lecturasComprobadas } from '../lecturas/red-clinica-lecturas';
import { alertasDeApoyo } from '../red-clinica-alertas';
import { visiblesCombinados } from '../red-clinica-del-expediente';
import { aplicarFiltro, criteriosActivos, FILTRO_VACIO, type FiltroDeRed } from '../red-clinica-filtro';
import type { ValorDeResultado } from '../red-clinica.types';
import { guiaDelExpediente } from '../superficie/guia-de-la-red';
import { RedDelExpediente } from './red-del-expediente';

/**
 * **What is chosen on a chart's network (Strip 3): filters, alerts and the
 * open node.**
 *
 * Built from the same as the network —its records and links, plus the reads
 * already on screen—: the panel requests nothing the network does not have,
 * and the filter and the network cannot disagree on which node is which.
 * Provided by the chart screen next to {@link RedDelExpediente}.
 */
@Injectable()
export class SeleccionDeLaRed {
  private readonly red = inject(RedDelExpediente);
  private readonly cajon = inject(AnchoDelCajon);

  /**
   * The filter by type, over the network: the ids that are drawn. Empty
   * —nothing hidden— is «all». The episodes are built with everything anyway:
   * hiding the diagnoses stops drawing them, it does not undo the problems.
   */
  private readonly visiblesPorTipo = computed<readonly string[]>(() => {
    const ocultos = this.red.fuente.tiposOcultos();
    if (ocultos.size === 0) {
      return [];
    }
    const clasesOcultas = new Set([...ocultos].map((tipo) => CLASE_DEL_TIPO[tipo]));
    return this.red
      .registros()
      .filter((r) => !clasesOcultas.has(r.clase))
      .map((r) => r.id);
  });

  /** What the network's filter bar asks for. Empty: it does not filter. */
  readonly filtro = signal<FiltroDeRed>(FILTRO_VACIO);

  /** The ids the bar lets through; `null` if it has no criteria set. */
  private readonly visiblesPorFiltro = computed<readonly string[] | null>(() => {
    const filtro = this.filtro();
    return criteriosActivos(filtro) === 0
      ? null
      : aplicarFiltro(this.red.nodos(), filtro, this.red.aristas()).map((n) => n.id);
  });

  private readonly combinados = computed(() => visiblesCombinados(this.visiblesPorTipo(), this.visiblesPorFiltro()));

  /**
   * The ids the network draws: the chart's filter by type **and** the
   * network's bar. Empty —neither filters— is «all».
   */
  readonly visibles = computed<readonly string[]>(() => this.combinados() ?? []);

  /** How many records the combination lets through, for the bar's summary. */
  readonly cuantosVisibles = computed(() => this.combinados()?.length ?? this.red.nodos().length);

  /**
   * The filters let nothing through: the network cannot receive «none» (for
   * it empty is «all»), and instead it is said and clearing is offered.
   */
  readonly sinResultado = computed(() => this.combinados()?.length === 0);

  limpiarFiltros(): void {
    this.filtro.set(FILTRO_VACIO);
    this.red.fuente.tiposOcultos.set(new Set());
  }

  /** The reports the panel already read: their values feed the alerts, without reading more. */
  private readonly informesLeidos = signal<ReadonlyMap<string, readonly ValorDeResultado[]>>(new Map());

  alLeerInforme(leido: { readonly informeId: string; readonly valores: readonly ValorDeResultado[] }): void {
    this.informesLeidos.update((actual) => new Map(actual).set(leido.informeId, leido.valores));
  }

  /** The support alerts, over what was read of this person. */
  readonly alertas = computed(() => {
    const datos = this.red.fuente.datos();
    if (datos === null) {
      return [];
    }
    const lecturas = this.red.lecturas();
    const estudios = lecturas === null ? null : dataOf(lecturas.estudios);
    const etiquetas = this.red.fuente.etiquetas();
    const deLaRed = this.red.etiquetas();
    const presentes = new Set(this.red.registros().map((r) => r.id));
    return alertasDeApoyo({
      ahora: this.red.ahora(),
      leidas: lecturasComprobadas(lecturas),
      diagnosticos: datos.resumen.conditions,
      ordenes: estudios?.orders ?? [],
      informes: estudios?.reports ?? [],
      derivaciones: (lecturas === null ? null : dataOf(lecturas.derivaciones)) ?? [],
      atenciones: datos.resumen.encounters,
      resultados: [...this.informesLeidos()].map(([nodoId, valores]) => ({ nodoId, valores, estudio: this.red.registros().find((r) => r.id === nodoId)?.titulo ?? 'el estudio' })),
      codigoDe: (id) => (id === undefined ? undefined : (etiquetas.get(id)?.code ?? deLaRed.get(id)?.code)),
      etiquetaDe: (id) => (id === undefined ? undefined : (etiquetas.get(id)?.display ?? deLaRed.get(id)?.display)),
    }).filter((alerta) => presentes.has(alerta.nodoId));
  });

  /** The node whose detail is open in the panel. */
  readonly nodoAbiertoId = signal<string | null>(null);

  readonly nodoAbierto = computed(() => {
    const id = this.nodoAbiertoId();
    return id === null ? null : (this.red.nodos().find((n) => n.id === id) ?? null);
  });

  /** ≥ 780 px the panel goes next to the map; below, as a sheet. */
  readonly panelAlLado = computed(() => this.nodoAbierto() !== null && !this.cajon.isNavDrawer());

  /** The record the open panel can open in the usual detail (the blocks' ones). */
  readonly filaDelNodoAbierto = computed(() => {
    const id = this.nodoAbiertoId();
    return id === null
      ? null
      : (this.red.fuente
          .bloques()
          .flatMap((bloque) => bloque.filas)
          .find((fila) => fila.id === id) ?? null);
  });

  /** What the step-by-step tour narrates: the same reads as the network. */
  readonly guia = computed(() => {
    const datos = this.red.fuente.datos();
    const lecturas = this.red.lecturas();
    const [etiquetas, deLaRed] = [this.red.fuente.etiquetas(), this.red.etiquetas()];
    const leida = <T>(estado: ViewState<T> | undefined): T | null => (estado === undefined ? null : dataOf(estado));
    return datos === null
      ? null
      : guiaDelExpediente(
          { resumen: datos.resumen, citas: leida(lecturas?.citas), derivaciones: leida(lecturas?.derivaciones), estudios: leida(lecturas?.estudios) },
          (id) => etiquetas.get(id) ?? deLaRed.get(id),
          this.red.fuente.perfilPropio(),
          this.red.ahora(),
        );
  });

  /** Another person's chart: their filter, open node and reports are not this one's. */
  reiniciar(): void {
    this.filtro.set(FILTRO_VACIO);
    this.nodoAbiertoId.set(null);
    this.informesLeidos.set(new Map());
  }
}
