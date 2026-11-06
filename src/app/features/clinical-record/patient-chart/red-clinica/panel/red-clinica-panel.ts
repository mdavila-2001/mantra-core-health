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
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { nextControlId } from '../../../../../shared/forms/form-control.context';
import { antiguedad, diasEntre } from '../red-clinica-alertas';
import { RedClinicaInformeEstado } from './informe-estado/red-clinica-informe-estado';
import { resultadoDelInforme } from '../red-clinica-informe';
import {
  leerValor,
  SIMBOLO_DE_LECTURA,
  TEXTO_DE_LECTURA,
  textoDelRango,
  textoDelValor,
  type LecturaDeValor,
} from '../red-clinica-valores';
import { ORIGEN, SIGUIENTES, vinculosDe } from './red-clinica-panel.vinculos';
import {
  ASPECTO_DE_TIPO,
  type ArchivoDeInforme,
  type AristaDeRed,
  type ResultadoDeEstudio,
  type AspectoDeTipo,
  type TipoDeNodo,
  type NodoDeRed,
  type ValorDeResultado,
} from '../red-clinica.types';

export { vinculosDe, type VinculoDelPanel } from './red-clinica-panel.vinculos';

/** Cómo se presenta: columna al lado del mapa, o hoja inferior modal. */
export type PresentacionDelPanel = 'auto' | 'lateral' | 'hoja';

/** Una fila de la tabla de valores, ya leída. */
interface FilaDeValor {
  readonly valor: ValorDeResultado;
  readonly texto: string;
  readonly rango: string;
  readonly lectura: LecturaDeValor;
  readonly simbolo: string;
  readonly fuera: boolean;
}

/**
 * **Panel de detalle de un nodo de la red clínica.**
 *
 * Decisión del usuario: panel lateral, no modal, para no perder el mapa.
 *
 * - **Lateral** (desde 780 px): un `<aside>` que el padre ubica al lado del
 *   mapa (en una rejilla `mapa | panel`). No atrapa el foco a propósito: el
 *   mapa sigue al alcance del Tab para elegir otro nodo sin cerrar. Al abrir,
 *   el foco va al título; `Escape` dentro del panel cierra y el foco vuelve a
 *   quien lo abrió (el nodo del mapa), si sigue en el documento.
 * - **Hoja** (teléfono): un `<dialog>` modal anclado abajo, a pantalla casi
 *   completa. Ahí sí se atrapa el foco (lo hace el navegador) porque el mapa
 *   queda tapado; `Escape` y «Cerrar» lo devuelven igual.
 *
 * Es presentacional: no lee el expediente. Lo único que pide por su cuenta es
 * el informe liberado de un estudio al abrirlo (con `pacienteId` y el
 * `informeId` del resultado: `DiagnosticsClient.getPractitionerResult`) y sus
 * archivos cuando se los piden (`downloadPractitionerResultFile`, la ruta del
 * médico: `/common/files` sólo sirve a quien subió el archivo). Las dos
 * lecturas tienen sus estados M34.
 *
 * ```html
 * <app-red-clinica-panel
 *   [nodo]="nodoAbierto()" [nodos]="nodos()" [aristas]="aristas()"
 *   (nodoElegido)="abrir($event)" (cerrado)="nodoAbierto.set(null)" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-panel',
  imports: [AppButton, Alert, Badge, DatePipe, NavIcon, NgTemplateOutlet, RedClinicaInformeEstado],
  templateUrl: './red-clinica-panel.html',
  styleUrl: './red-clinica-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaPanel {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly breakpoints = inject(Breakpoints);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly downloads = inject(FileDownloadService);

  /** El nodo abierto; `null` = panel cerrado. */
  readonly nodo = input<NodoDeRed | null>(null);
  /** Todos los nodos de la red, para nombrar la otra punta de cada vínculo. */
  readonly nodos = input<readonly NodoDeRed[]>([]);
  readonly aristas = input<readonly AristaDeRed[]>([]);
  /** Referencia para «hace N días». Inyectable para pruebas y capturas. */
  readonly ahora = input<Date>(new Date());
  readonly presentacion = input<PresentacionDelPanel>('auto');
  /**
   * Si al cerrar el panel devuelve el foco a quien lo abrió. `false` cuando el
   * padre sabe mejor a dónde va (el nodo que está abierto ahora, que puede no
   * ser el primero): el panel sólo cierra la hoja y no compite por el foco.
   */
  readonly devolverFoco = input(true);
  /**
   * La persona del expediente. Con él, un estudio con informe liberado se lee
   * entero al abrirlo y sus archivos se bajan por la ruta del médico. Sin él
   * (el banco de componentes), el panel muestra lo que trae el nodo.
   */
  readonly pacienteId = input<string | null>(null);

  /** Se eligió otro nodo desde un vínculo o una referencia del panel. */
  readonly nodoElegido = output<string>();
  /** Se pidió cerrar (botón, `Escape`). El padre pone `nodo` en `null`. */
  readonly cerrado = output<void>();
  /** Se leyó un informe: sus valores, para las alertas de «fuera de rango» (sin leer de más). */
  readonly informeLeido = output<{ readonly informeId: string; readonly valores: readonly ValorDeResultado[] }>();

  protected readonly tituloId = nextControlId('red-panel-titulo');
  /** El nombre y el ícono de un tipo. Método y no índice: el contexto de `ng-template` no está tipado. */
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

  /** La lectura del informe del estudio abierto, con sus estados M34. */
  protected readonly lecturaDelInforme = signal<{ readonly informeId: string; readonly estado: ViewState<ResultadoDeEstudio> } | null>(null);
  private lecturaEnCurso: Subscription | null = null;

  /** El resultado a mostrar: el leído, si llegó; si no, el que trae el nodo. */
  protected readonly resultado = computed<ResultadoDeEstudio | null>(() => {
    const d = this.nodo()?.detalle;
    if (d?.tipo !== 'estudio' || d.resultado === null) return null;
    const leido = this.lecturaDelInforme();
    return leido !== null && leido.informeId === d.resultado.informeId && leido.estado.status === 'ready'
      ? leido.estado.data
      : d.resultado;
  });

  protected readonly filas = computed<readonly FilaDeValor[]>(() => {
    const r = this.resultado();
    if (r === null) return [];
    return r.valores.map((valor) => {
      const lectura = leerValor(valor);
      return {
        valor,
        texto: textoDelValor(valor),
        rango: textoDelRango(valor.rango, valor.unidad),
        lectura,
        simbolo: SIMBOLO_DE_LECTURA[lectura],
        fuera: lectura !== 'normal' && lectura !== 'sin-referencia',
      };
    });
  });

  protected readonly fueraDeRango = computed(() => this.filas().filter((f) => f.fuera).length);

  /** «hace 12 días» desde la fecha del nodo. */
  protected readonly hace = computed(() => {
    const cuando = this.nodo()?.cuando;
    return cuando ? antiguedad(diasEntre(cuando, this.ahora())) : '';
  });

  protected readonly textoDeLectura = TEXTO_DE_LECTURA;

  /** La descarga de un archivo del informe, con sus estados. */
  protected readonly descarga = signal<{ readonly fileId: string; readonly estado: ViewState<null> } | null>(null);
  private suscripcion: Subscription | null = null;

  /** Quién tenía el foco al abrir: a donde vuelve al cerrar. */
  private retorno: HTMLElement | null = null;
  private abiertoAntes = false;
  private readonly idAbierto = computed(() => this.nodo()?.id ?? null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.suscripcion?.unsubscribe();
      this.lecturaEnCurso?.unsubscribe();
    });

    // Un estudio con informe liberado se lee entero al abrirlo: una lectura por
    // nodo abierto, nunca por adelantado.
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
        this.cancelarDescarga();
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

  /** `Escape` en el panel lateral (en la hoja llega como `cancel`). */
  protected alPulsarEscape(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cerrar();
  }

  /** El `<dialog>` de la hoja entrega `Escape` como `cancel`. */
  protected alCancelarHoja(event: Event): void {
    event.preventDefault();
    this.cerrar();
  }

  protected elegir(id: string): void {
    this.nodoElegido.emit(id);
  }

  /** Vuelve a leer el informe (el «Reintentar» de su aviso). */
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

  /** Se puede bajar: hay paciente y el informe del que cuelga el archivo. */
  protected readonly descargable = computed(() => this.pacienteId() !== null && this.resultado()?.informeId !== undefined);

  protected abrirArchivo(archivo: ArchivoDeInforme): void {
    const paciente = this.pacienteId();
    const informeId = this.resultado()?.informeId;
    if (paciente === null || informeId === undefined) return;
    this.cancelarDescarga();
    this.descarga.set({ fileId: archivo.fileId, estado: { status: 'loading' } });
    // El cliente ya relee el cuerpo Blob del error (`parseBlobError`): un 403
    // del contrato se ve como 403 y no como un error genérico.
    this.suscripcion = this.diagnostics.downloadPractitionerResultFile(paciente, informeId, archivo.fileId).subscribe({
      next: ({ blob, fileName }) => {
        this.downloads.save(blob, fileName ?? archivo.nombre);
        this.descarga.set({ fileId: archivo.fileId, estado: { status: 'ready', data: null } });
      },
      error: (error: unknown) =>
        this.descarga.set({ fileId: archivo.fileId, estado: errorToViewState<null>(error) }),
    });
  }

  protected descargando(fileId: string): boolean {
    const d = this.descarga();
    return d !== null && d.fileId === fileId && d.estado.status === 'loading';
  }

  protected tonoDeLectura(lectura: LecturaDeValor): 'error' | 'warning' | null {
    if (lectura.startsWith('critico')) return 'error';
    if (lectura === 'normal' || lectura === 'sin-referencia') return null;
    return 'warning';
  }

  private cancelarDescarga(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.descarga.set(null);
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
