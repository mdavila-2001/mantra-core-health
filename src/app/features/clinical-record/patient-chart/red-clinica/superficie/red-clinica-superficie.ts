import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
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
import type { AlertaDeApoyo } from '../red-clinica-alertas';
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

/** «Toda la historia» en el selector de qué recorrer. */
const TODA = '';

/**
 * **La superficie del Recorrido**: barra de filtros, alertas, recorrido guiado
 * y red, en UNA tarjeta (regla 6 de composición). Cada franja se separa de la
 * siguiente con un filete, no con un recuadro propio.
 *
 * ## El recorrido guiado (Franja 4, ADR-0022)
 *
 * «Recorrido paso a paso» monta `app-recorrido-guiado` con los pasos de
 * `armarRecorridoGuiado` sobre las mismas lecturas que dibujan la red
 * (`guia`). Mientras dura:
 *
 * - la red dibuja sólo lo revelado hasta el paso, cruzado con los filtros;
 * - lo que el paso enfoca se resalta, y la red lo despliega y lo trae a la
 *   vista (`irANodo`);
 * - cualquier toque o tecla sobre la red o las alertas pausa la reproducción;
 * - se puede seguir un solo episodio: el del nodo abierto o el del filtro de
 *   hilo, propuesto al abrir, o el que se elija.
 *
 * Salir devuelve la red a como estaba: lo desplegado, lo abierto y el
 * desplazamiento del lienzo.
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

  readonly registros = input.required<readonly RegistroDeLaRed[]>();
  readonly vinculos = input.required<readonly VinculoDeLaRed[]>();
  /** Los nodos del contrato del panel: de acá salen las opciones de los filtros. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  /** Lo que dejan los filtros (el del expediente y el de la barra). Vacío: todos. */
  readonly visibles = input<readonly string[]>([]);
  readonly cuantosVisibles = input<number | null>(null);
  /** Los filtros juntos no dejan nada: se avisa en lugar de dibujar la red. */
  readonly sinResultado = input(false);
  readonly alertas = input<readonly AlertaDeApoyo[]>([]);
  /** `false` while the readings they come from load: S2 (loading), not an S3 «nothing open». */
  readonly alertasListas = input(true);
  /** Which readings arrived whole: the alerts' «nothing open» only covers those. */
  readonly alertasComprobadas = input<LecturasComprobadas>({ ordenes: true, informes: true, derivaciones: true });
  readonly seleccionado = input<string | null>(null);
  readonly filtro = model<FiltroDeRed>(FILTRO_VACIO);
  /** Lo que narra el recorrido guiado. `null`: todavía no hay expediente. */
  readonly guia = input<GuiaDeLaRed | null>(null);

  readonly elegido = output<NodoElegido>();
  /** Una alerta pidió abrir su nodo. */
  readonly nodoElegido = output<string>();
  readonly limpiar = output<void>();

  private readonly red = viewChild(RecorridoClinico);

  /* -- Alertas ------------------------------------------------------------ */

  /** Los nodos que una alerta (bajo el puntero o con foco) pide resaltar. */
  protected readonly resaltadosPorAlerta = signal<readonly string[]>([]);

  /* -- Recorrido guiado -------------------------------------------------- */

  protected readonly guiado = signal(false);
  protected readonly paso = signal<PasoActualDelRecorrido | null>(null);
  /** Cambia con cada toque sobre la red: el recorrido se pausa. */
  protected readonly interaccion = signal(0);
  /** El episodio que se sigue (su id en la red), o `TODA`. */
  protected readonly episodioSeguido = signal<string>(TODA);
  private plegadoPrevio: PlegadoDeLaRed | null = null;

  private readonly porEpisodios = computed(() => agruparEnEpisodios(this.registros(), this.vinculos()));
  private readonly presentes = computed(() => new Set(this.registros().map((r) => r.id)));

  /** Los pasos, sólo mientras el modo guiado está abierto (no se arman de más). */
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

  /** Lo que la red dibuja: con el modo guiado, sólo lo revelado (y filtrado). */
  protected readonly visiblesDeLaRed = computed<readonly string[]>(() => {
    const paso = this.paso();
    return this.guiado() && paso !== null
      ? visiblesDelPaso(paso.revelados, this.visibles(), this.presentes())
      : this.visibles();
  });

  /** El paso no deja nada a la vista con los filtros puestos. */
  protected readonly pasoSinNodos = computed(
    () => this.guiado() && this.visiblesDeLaRed().length === 1 && this.visiblesDeLaRed()[0] === NINGUNO_VISIBLE,
  );

  protected readonly resaltados = computed<readonly string[]>(() =>
    this.guiado() ? (this.paso()?.enfocar ?? []) : this.resaltadosPorAlerta(),
  );

  constructor() {
    // Otra persona u otra lectura: lo resaltado por una alerta ya no aplica.
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

  /** Sale del modo guiado y devuelve la red a como estaba antes. */
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
   * Un paso nuevo: la red se actualiza (lo revelado) y, ya dibujada, despliega
   * y trae a la vista lo que el paso enfoca. El principal (el primero) va
   * último, para que sea el que queda a la vista y con el camino iluminado.
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

  /** Toda interacción con la red o las alertas pausa la reproducción. */
  protected tocarLaRed(): void {
    if (this.guiado()) this.interaccion.update((n) => n + 1);
  }

  /** Tab sólo recorre: no es «tocar la red». */
  protected teclaEnLaRed(evento: KeyboardEvent): void {
    if (evento.key !== 'Tab' && evento.key !== 'Shift') this.tocarLaRed();
  }

  /** La red a un registro, para el panel y las alertas. */
  irANodo(id: string, opciones: { readonly foco?: boolean } = {}): boolean {
    return this.red()?.irANodo(id, opciones) ?? false;
  }
}
