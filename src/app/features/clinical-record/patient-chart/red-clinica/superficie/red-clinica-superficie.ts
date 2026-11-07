import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import {
  RecorridoClinico,
  type NodoElegido,
  type PlegadoDeLaRed,
} from '../../recorrido-clinico/recorrido-clinico';
import { type RegistroDeLaRed, type VinculoDeLaRed } from '../../recorrido-clinico/red-clinica.model';
import { agruparEnEpisodios } from '../../recorrido-clinico/red-clinica.episodios';
import { RecorridoGuiado, type PasoActualDelRecorrido } from '../../recorrido-guiado/recorrido-guiado';
import { armarRecorridoGuiado, type PasoDelRecorrido } from '../../recorrido-guiado/recorrido-guiado.model';
import { RedClinicaAlertasLista } from '../alertas/red-clinica-alertas-lista';
import { RedClinicaFiltros } from '../filtros/red-clinica-filtros';
import { filtrosNombrados, unirConY } from '../filtros/red-clinica-filtros.nombres';
import type { AlertaDeApoyo } from '../red-clinica-alertas.types';
import type { LecturasComprobadas } from '../lecturas/red-clinica-lecturas';
import { FILTRO_VACIO, type FiltroDeRed } from '../red-clinica-filtro';
import type { NodoDeRed } from '../red-clinica.types';
import {
  episodioPropuesto,
  idsDelEpisodio,
  NINGUNO_VISIBLE,
  visiblesDelPaso,
  type GuiaDeLaRed,
} from './guia-de-la-red';

/** «Toda la historia» in the selector of what to tour. */
const TODA = '';

/**
 * **The Tour's surface**: filter bar, alerts, guided tour and network, in ONE
 * card (composition rule 6). Each strip is set apart from the next by a rule,
 * not by a box of its own.
 *
 * ## The guided tour (Strip 4, ADR-0022)
 *
 * «Recorrido paso a paso» mounts `app-recorrido-guiado` with the steps of
 * `armarRecorridoGuiado` over the same reads that draw the network (`guia`).
 * While it lasts:
 *
 * - the network draws only what has been revealed up to the step, crossed
 *   with the filters;
 * - what the step focuses is highlighted, and the network expands it and
 *   brings it into view (`irANodo`);
 * - any touch or key on the network or the alerts pauses playback;
 * - a single episode can be followed: the open node's or the thread filter's,
 *   proposed on opening, or the one chosen.
 *
 * Leaving returns the network to how it was: what was expanded, what was open
 * and the canvas' scroll.
 */
@Component({
  selector: 'app-red-clinica-superficie',
  imports: [
    Alert,
    AppButton,
    Card,
    FormField,
    NavIcon,
    RecorridoClinico,
    RecorridoGuiado,
    RedClinicaAlertasLista,
    RedClinicaFiltros,
    Select,
  ],
  templateUrl: './red-clinica-superficie.html',
  styleUrl: './red-clinica-superficie.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaSuperficie {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);

  readonly registros = input.required<readonly RegistroDeLaRed[]>();
  readonly vinculos = input.required<readonly VinculoDeLaRed[]>();
  /** The panel contract's nodes: the filters' options come from here. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  /** What the filters let through (the chart's and the bar's). Empty: all. */
  readonly visibles = input<readonly string[]>([]);
  readonly cuantosVisibles = input<number | null>(null);
  /** The filters together let nothing through: it is said instead of drawing the network. */
  readonly sinResultado = input(false);
  readonly alertas = input<readonly AlertaDeApoyo[]>([]);
  /** `false` while the readings they come from load: S2 (loading), not an S3 «nothing open». */
  readonly alertasListas = input(true);
  /** Which readings arrived whole: the alerts' «nothing open» only covers those. */
  readonly alertasComprobadas = input<LecturasComprobadas>({ ordenes: true, informes: true, derivaciones: true });
  readonly seleccionado = input<string | null>(null);
  readonly filtro = model<FiltroDeRed>(FILTRO_VACIO);
  /** What the guided tour narrates. `null`: no chart yet. */
  readonly guia = input<GuiaDeLaRed | null>(null);

  readonly elegido = output<NodoElegido>();
  /** An alert asked to open its node. */
  readonly nodoElegido = output<string>();
  readonly limpiar = output<void>();

  private readonly red = viewChild(RecorridoClinico);

  /* -- Alertas ------------------------------------------------------------ */

  /** The nodes an alert (under the pointer or focused) asks to highlight. */
  protected readonly resaltadosPorAlerta = signal<readonly string[]>([]);

  /* -- Recorrido guiado -------------------------------------------------- */

  protected readonly guiado = signal(false);
  protected readonly paso = signal<PasoActualDelRecorrido | null>(null);
  /** Changes with each touch on the network: the tour pauses. */
  protected readonly interaccion = signal(0);
  /** The episode being followed (its network id), or `TODA`. */
  protected readonly episodioSeguido = signal<string>(TODA);
  private plegadoPrevio: PlegadoDeLaRed | null = null;

  private readonly porEpisodios = computed(() => agruparEnEpisodios(this.registros(), this.vinculos()));
  private readonly presentes = computed(() => new Set(this.registros().map((r) => r.id)));

  /** The steps, only while the guided mode is open (not built needlessly). */
  protected readonly pasos = computed<readonly PasoDelRecorrido[]>(() => {
    const guia = this.guia();
    return this.guiado() && guia !== null ? armarRecorridoGuiado(guia.registros, guia.lector, guia.ahora) : [];
  });

  protected readonly opcionesDeEpisodio = computed<readonly SelectOption<string>[]>(() => [
    { value: TODA, label: 'Toda la historia' },
    ...this.porEpisodios()
      .episodios.filter((e) => e.clase === 'problema')
      .map((e) => ({ value: e.id, label: e.nombre, ...(e.estado === '' ? {} : { description: e.estado }) })),
  ]);

  private readonly episodio = computed(() => {
    const id = this.episodioSeguido();
    return id === TODA ? null : (this.porEpisodios().episodios.find((e) => e.id === id) ?? null);
  });
  protected readonly idsDelEpisodio = computed(() => {
    const e = this.episodio();
    return e === null ? null : idsDelEpisodio(e);
  });
  protected readonly nombreDelEpisodio = computed(() => this.episodio()?.nombre ?? null);

  /** What the network draws: in guided mode, only what is revealed (and filtered). */
  protected readonly visiblesDeLaRed = computed<readonly string[]>(() => {
    const paso = this.paso();
    return this.guiado() && paso !== null
      ? visiblesDelPaso(paso.revelados, this.visibles(), this.presentes())
      : this.visibles();
  });

  /** The step leaves nothing in view with the filters set. */
  protected readonly pasoSinNodos = computed(
    () => this.guiado() && this.visiblesDeLaRed().length === 1 && this.visiblesDeLaRed()[0] === NINGUNO_VISIBLE,
  );

  /** The step notice names what hides the step («con este filtro: el hilo de …»), not «los filtros puestos». */
  protected readonly filtrosQueOcultan = computed(() => {
    const nombres = filtrosNombrados(this.filtro(), this.nodos());
    if (nombres.length === 0) return 'con los filtros puestos';
    return `${nombres.length === 1 ? 'con este filtro' : 'con estos filtros'}: ${unirConY(nombres)}`;
  });

  protected readonly resaltados = computed<readonly string[]>(() =>
    this.guiado() ? (this.paso()?.enfocar ?? []) : this.resaltadosPorAlerta(),
  );

  constructor() {
    // Another person or another read: what an alert highlighted no longer applies.
    effect(() => {
      this.registros();
      untracked(() => this.resaltadosPorAlerta.set([]));
    });
  }

  protected abrirGuiado(): void {
    if (this.guiado()) return;
    this.plegadoPrevio = this.red()?.plegado() ?? null;
    const propuesto = episodioPropuesto(this.porEpisodios(), {
      seleccionado: this.seleccionado(),
      hiloDeDiagnosticoId: this.filtro().hiloDeDiagnosticoId,
    });
    this.episodioSeguido.set(propuesto?.id ?? TODA);
    this.paso.set(null);
    this.guiado.set(true);
  }

  /** Leaves guided mode and returns the network to how it was before. */
  protected cerrarGuiado(): void {
    if (!this.guiado()) return;
    this.guiado.set(false);
    this.paso.set(null);
    const previo = this.plegadoPrevio;
    this.plegadoPrevio = null;
    if (previo !== null) {
      afterNextRender(() => this.red()?.restaurarPlegado(previo), { injector: this.injector });
    }
  }

  protected elegirEpisodio(valor: string | null): void {
    this.episodioSeguido.set(valor ?? TODA);
  }

  /**
   * A new step: the network updates (what is revealed) and, once drawn,
   * expands and brings into view what the step focuses. The main one (the
   * first) goes last, so it is the one left in view with its path lit.
   */
  protected alPaso(paso: PasoActualDelRecorrido): void {
    this.paso.set(paso);
    afterNextRender(
      () => {
        const red = this.red();
        if (red === undefined || !this.guiado()) return;
        [...paso.enfocar].reverse().forEach((id) => red.irANodo(id));
      },
      { injector: this.injector },
    );
  }

  /**
   * «Quitar filtros» from the step notice. The parent clears its filters,
   * which are the only copy: leaving the guided mode restores the fold, not
   * the filters the person removed on purpose. The button disappears with the
   * notice, so the focus goes to what the step tells, now in view.
   */
  protected quitarFiltros(): void {
    this.limpiar.emit();
    afterNextRender(
      () => {
        const id = this.paso()?.enfocar[0];
        const activo = this.document.activeElement;
        if (id !== undefined && (activo === null || activo === this.document.body)) this.red()?.irANodo(id, { foco: true });
      },
      { injector: this.injector },
    );
  }

  /** Any interaction with the network or the alerts pauses playback. */
  protected tocarLaRed(): void {
    if (this.guiado()) this.interaccion.update((n) => n + 1);
  }

  /** Tab only moves around: it is not «touching the network». */
  protected teclaEnLaRed(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab' && evento.key !== 'Shift') this.tocarLaRed();
  }

  /** The network to a record, for the panel and the alerts. */
  irANodo(id: string, opciones: { readonly foco?: boolean } = {}): boolean {
    return this.red()?.irANodo(id, opciones) ?? false;
  }
}
