import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { DiagnosticsClient } from '../../../../../core/data-access/diagnostics/diagnostics.client';
import { FileDownloadService } from '../../../../../shared/utils/file-download/file-download.service';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { ready } from '../../../../../core/view-state/view-state';
import { Breakpoints } from '../../../../../core/layout/breakpoints';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../../shared/components/atoms/nav-icon/nav-icon';
import { nextControlId } from '../../../../../shared/forms/form-control.context';
import { antiguedad, diasEntre } from '../red-clinica-alertas';
import { resultadoDelInforme } from '../red-clinica-informe';
import { ORIGEN, SIGUIENTES, vinculosDe } from './red-clinica-panel.vinculos';
import { DescargaDelInforme } from './descarga-del-informe';
import { RedPanelEstudio } from './estudio/red-panel-estudio';
import { RedPanelRazonamiento } from './razonamiento/red-panel-razonamiento';
import { RedPanelDerivacion } from './derivacion/red-panel-derivacion';
import {
  ASPECTO_DE_TIPO,
  type ArchivoDeInforme,
  type ResultadoDeEstudio,
  type AspectoDeTipo,
  type TipoDeNodo,
  type NodoDeRed,
  type ValorDeResultado,
} from '../red-clinica.types';
import { type AristaDeRed } from '../red-clinica-vinculos.types';

export { vinculosDe, type VinculoDelPanel } from './red-clinica-panel.vinculos';

/** How it is presented: a column next to the map, or a modal bottom sheet. */
export type PresentacionDelPanel = 'auto' | 'lateral' | 'hoja';

/**
 * **Detail panel of a clinical network node.**
 *
 * User's decision: a side panel, not a modal, so the map is not lost.
 *
 * - **Side** (from 780 px): an `<aside>` the parent places next to the map (in
 *   a `map | panel` grid). It does not trap the focus on purpose: the map stays
 *   within Tab's reach to pick another node without closing. On opening, the
 *   focus goes to the title; `Escape` inside the panel closes it and the focus
 *   returns to whoever opened it (the map node), if it is still in the document.
 * - **Sheet** (phone): a modal `<dialog>` anchored at the bottom, almost full
 *   screen. There the focus is trapped (the browser does it) because the map is
 *   covered; `Escape` and «Cerrar» return it all the same.
 *
 * Presentational: it does not read the chart. All it requests on its own is a
 * study's released report on opening it (with `pacienteId` and the result's
 * `informeId`: `DiagnosticsClient.getPractitionerResult`) and its files when
 * asked (`downloadPractitionerResultFile`, the practitioner route:
 * `/common/files` only serves whoever uploaded the file). Both reads have their
 * M34 states.
 *
 * ```html
 * <app-red-clinica-panel
 *   [nodo]="nodoAbierto()" [nodos]="nodos()" [aristas]="aristas()"
 *   (nodoElegido)="abrir($event)" (cerrado)="nodoAbierto.set(null)" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-panel',
  imports: [AppButton, Badge, DatePipe, NavIcon, NgTemplateOutlet, RedPanelDerivacion, RedPanelEstudio, RedPanelRazonamiento],
  templateUrl: './red-clinica-panel.html',
  styleUrls: ['./red-clinica-panel.css', './red-clinica-panel.secciones.css', './red-clinica-panel.vinculos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaPanel {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly breakpoints = inject(Breakpoints);
  private readonly diagnostics = inject(DiagnosticsClient);
  protected readonly descarga = new DescargaDelInforme(this.diagnostics, inject(FileDownloadService));

  /** The open node; `null` = panel closed. */
  readonly nodo = input<NodoDeRed | null>(null);
  /** Every network node, to name the other end of each link. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  readonly aristas = input<readonly AristaDeRed[]>([]);
  /** Reference for «hace N días». Injectable for tests and screenshots. */
  readonly ahora = input<Date>(new Date());
  readonly presentacion = input<PresentacionDelPanel>('auto');
  /**
   * Whether closing the panel returns the focus to whoever opened it. `false`
   * when the parent knows better where it goes (the node open now, which may
   * not be the first): the panel only closes the sheet and does not compete for
   * the focus.
   */
  readonly devolverFoco = input(true);
  /**
   * The chart's person. With it, a study with a released report is read whole
   * on opening and its files are downloaded through the practitioner route.
   * Without it (the component bench), the panel shows what the node brings.
   */
  readonly pacienteId = input<string | null>(null);

  /** Another node was chosen from a link or a reference in the panel. */
  readonly nodoElegido = output<string>();
  /** Closing was requested (button, `Escape`). The parent sets `nodo` to `null`. */
  readonly cerrado = output<void>();
  /** A report was read: its values, for the «fuera de rango» alerts (without reading more). */
  readonly informeLeido = output<{ readonly informeId: string; readonly valores: readonly ValorDeResultado[] }>();

  protected readonly tituloId = nextControlId('red-panel-titulo');
  /** A type's name and icon. A method and not an index: the `ng-template` context is untyped. */
  protected aspectoDe(tipo: TipoDeNodo): AspectoDeTipo {
    return ASPECTO_DE_TIPO[tipo];
  }

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly hoja = viewChild<ElementRef<HTMLDialogElement>>('hoja');

  protected readonly esHoja = computed(() => {
    const modo = this.presentacion();
    return modo === 'hoja' || (modo === 'auto' && this.breakpoints.isNavDrawer());
  });

  protected readonly vinculos = computed(() => {
    const n = this.nodo();
    return n === null ? [] : vinculosDe(n.id, this.aristas(), this.nodos());
  });

  protected readonly origen = computed(() =>
    this.vinculos().filter((v) => ORIGEN.has(`${v.sentido}:${v.tipo}`)),
  );
  protected readonly siguientes = computed(() =>
    this.vinculos().filter((v) => SIGUIENTES.has(`${v.sentido}:${v.tipo}`)),
  );

  /** The open study's report read, with its M34 states. */
  protected readonly lecturaDelInforme = signal<{ readonly informeId: string; readonly estado: ViewState<ResultadoDeEstudio> } | null>(null);
  private lecturaEnCurso: Subscription | null = null;

  /** The result to show: the one read, if it arrived; otherwise the node's. */
  protected readonly resultado = computed<ResultadoDeEstudio | null>(() => {
    const d = this.nodo()?.detalle;
    if (d?.tipo !== 'estudio' || d.resultado === null) return null;
    const leido = this.lecturaDelInforme();
    return leido !== null && leido.informeId === d.resultado.informeId && leido.estado.status === 'ready'
      ? leido.estado.data
      : d.resultado;
  });

  /** «hace 12 días» since the node's date. */
  protected readonly hace = computed(() => {
    const cuando = this.nodo()?.cuando;
    return cuando ? antiguedad(diasEntre(cuando, this.ahora())) : '';
  });

  /** Who had the focus on opening: where it returns on closing. */
  private retorno: HTMLElement | null = null;
  private abiertoAntes = false;
  private readonly idAbierto = computed(() => this.nodo()?.id ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.descarga.cancelar();
      this.lecturaEnCurso?.unsubscribe();
    });

    // A study with a released report is read whole on opening: one read per
    // open node, never in advance.
    effect(() => {
      const d = this.nodo()?.detalle;
      const paciente = this.pacienteId();
      const informeId = d?.tipo === 'estudio' ? d.resultado?.informeId : undefined;
      untracked(() => {
        if (this.lecturaDelInforme()?.informeId === informeId && informeId !== undefined) return;
        this.lecturaEnCurso?.unsubscribe();
        this.lecturaEnCurso = null;
        this.lecturaDelInforme.set(null);
        if (paciente !== null && informeId !== undefined) this.leerInforme(paciente, informeId);
      });
    });

    // Open, switch node, close: focus and dialog. Keyed by id (`idAbierto`), so
    // a new reference to the same node (the chart re-derives its nodes) does
    // not steal focus nor cancel a download in progress.
    effect(() => {
      const id = this.idAbierto();
      const hoja = this.esHoja();
      untracked(() => {
        if (id !== null && !this.abiertoAntes) {
          const activo = this.document.activeElement;
          this.retorno = activo instanceof HTMLElement && activo !== this.document.body ? activo : null;
        }
        if (id === null && this.abiertoAntes) this.alCerrar();
        this.abiertoAntes = id !== null;
        this.descarga.cancelar();
        if (id === null) return;
        afterNextRender(
          () => {
            const dialogo = this.hoja()?.nativeElement;
            if (hoja && dialogo && !dialogo.open) {
              if (typeof dialogo.showModal === 'function') dialogo.showModal();
              else dialogo.setAttribute('open', '');
            }
            this.titulo()?.nativeElement.focus();
          },
          { injector: this.injector },
        );
      });
    });
  }

  protected cerrar(): void {
    this.cerrado.emit();
  }

  /** `Escape` in the side panel (in the sheet it arrives as `cancel`). */
  protected alPulsarEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cerrar();
  }

  /** The sheet's `<dialog>` delivers `Escape` as `cancel`. */
  protected alCancelarHoja(event: Event): void {
    event.preventDefault();
    this.cerrar();
  }

  protected elegir(id: string): void {
    this.nodoElegido.emit(id);
  }

  /** Reads the report again (its notice's «Reintentar»). */
  protected releerInforme(): void {
    const leido = this.lecturaDelInforme();
    const paciente = this.pacienteId();
    if (leido !== null && paciente !== null) this.leerInforme(paciente, leido.informeId);
  }

  private leerInforme(paciente: string, informeId: string): void {
    this.lecturaEnCurso?.unsubscribe();
    this.lecturaDelInforme.set({ informeId, estado: { status: 'loading' } });
    this.lecturaEnCurso = this.diagnostics.getPractitionerResult(paciente, informeId).subscribe({
      next: (informe) => {
        const resultado = resultadoDelInforme(informe);
        this.lecturaDelInforme.set({ informeId, estado: ready(resultado) });
        this.informeLeido.emit({ informeId, valores: resultado.valores });
      },
      error: (error: unknown) => this.lecturaDelInforme.set({ informeId, estado: errorToViewState<ResultadoDeEstudio>(error) }),
    });
  }

  /** Files can be downloaded: there is a patient and the report they hang from. */
  protected readonly descargable = computed(() => this.pacienteId() !== null && this.resultado()?.informeId !== undefined);

  protected abrirArchivo(archivo: ArchivoDeInforme): void {
    const paciente = this.pacienteId();
    const informeId = this.resultado()?.informeId;
    if (paciente !== null && informeId !== undefined) this.descarga.abrir(paciente, informeId, archivo);
  }

  private alCerrar(): void {
    const dialogo = this.hoja()?.nativeElement;
    if (dialogo?.open && typeof dialogo.close === 'function') dialogo.close();
    const destino = this.retorno;
    this.retorno = null;
    if (this.devolverFoco() && destino?.isConnected) {
      afterNextRender(() => destino.focus(), { injector: this.injector });
    }
  }
}
