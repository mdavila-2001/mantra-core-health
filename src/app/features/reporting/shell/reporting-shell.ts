import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { DOCUMENT } from '@angular/common';

import { ETIQUETA_VERTICAL, VERTICALES } from '@core/data-access/reporting/reporting-labels';
import type { AlcanceReporte } from '@core/data-access/reporting/reporting.types';
import { AuthService } from '../../../core/auth/auth.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { BrandMark } from '../../../shared/components/atoms/brand-mark/brand-mark';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import {
  accesoAPortales,
  puedeVerPlataforma,
  PORTAL_ADMINISTRACION_ROUTE,
  PORTAL_SELECTOR_ROUTE,
} from '../reporting-access';
import { ETIQUETA_ALCANCE, ReportContextStore } from '../state/report-context.store';
// El asistente se monta con `@defer`: quien nunca abre el panel no descarga su código.
import { ReportAssistant } from '../assistant/report-assistant';

/** El alcance se rotula corto en el conmutador; el largo vive en `ETIQUETA_ALCANCE`. */
const OPCIONES_ALCANCE: readonly SegmentedOption<AlcanceReporte>[] = [
  { value: 'plataforma', label: 'Plataforma', description: ETIQUETA_ALCANCE.plataforma },
  { value: 'organizacion', label: 'Mi organización', description: ETIQUETA_ALCANCE.organizacion },
];

/**
 * El armazón del portal de reportería: cabecera, navegación lateral, el área
 * central donde viven los reportes y, a la derecha, un panel plegable con el
 * asistente.
 *
 * ## Por qué tiene su propio armazón
 *
 * El `ShellLayout` de la aplicación es el de administración y atención: su menú
 * es el registro de secciones por rol. El portal de reportería es otra cosa
 * —un panel de lectura con filtros globales— y compartir marco obligaría a
 * meter sus pestañas en un menú que no las conoce. Por eso cuelga de la ruta
 * `/reports` directamente, detrás de `authGuard` y del guard de rol.
 *
 * ## El centro son los reportes
 *
 * El asistente es secundario: **cerrado por defecto**, se abre con un botón
 * y no cambia lo que hay en el centro. Mientras está abierto, en escritorio
 * convive en una tercera columna; en pantallas angostas se superpone.
 *
 * ## Qué NO hace
 *
 * Los enlaces «Cambiar de portal» y «Portal de administración» solo se ofrecen
 * a quien tiene los dos accesos; no autorizan nada. Cada destino valida por su
 * cuenta.
 */
@Component({
  selector: 'app-reporting-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    AppButton,
    BrandMark,
    NavIcon,
    SegmentedControl,
    ReportAssistant,
  ],
  templateUrl: './reporting-shell.html',
  styleUrl: './reporting-shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Escape cierra lo que esté superpuesto; escuchar en el anfitrión evita un
  // `div` con manejador de teclado que no es enfocable.
  host: { '(keydown)': 'alTeclear($event)' },
})
export class ReportingShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  protected readonly contexto = inject(ReportContextStore);

  /** Quien no es de plataforma solo ve su organización: no se le ofrece un alcance que la API le va a negar. */
  protected readonly puedeElegirAlcance = computed(() => puedeVerPlataforma(this.auth.roles()));
  protected readonly opcionesAlcance = OPCIONES_ALCANCE;
  protected readonly etiquetaAlcance = ETIQUETA_ALCANCE;
  protected readonly pestanas = VERTICALES.map((vertical) => ({
    vertical,
    etiqueta: ETIQUETA_VERTICAL[vertical],
  }));
  protected readonly selectorRoute = PORTAL_SELECTOR_ROUTE;
  protected readonly administracionRoute = PORTAL_ADMINISTRACION_ROUTE;

  /** Quien tiene los dos accesos puede volver al otro portal; el resto no tiene adónde. */
  protected readonly puedeCambiarDePortal = computed(() => {
    const acceso = accesoAPortales(this.auth.roles());
    return acceso.administracion && acceso.reporteria;
  });

  /** Cerrado por defecto: el centro son los reportes. */
  readonly asistenteAbierto = signal(false);
  /**
   * El panel se monta la primera vez que se abre y ya no se desmonta: cerrarlo lo oculta. Destruirlo
   * al cerrar (o al pulsar Escape sin querer) borraba la pregunta a medio escribir y la conversación.
   */
  readonly asistenteMontado = signal(false);

  /** El cajón de navegación, que solo existe en pantallas angostas. */
  readonly menuAbierto = signal(false);

  private readonly botonAsistente = viewChild('botonAsistente', {
    // El `#botonAsistente` está en un `button[app-button]`: sin `read`, la
    // referencia es la instancia del componente y no su elemento.
    read: ElementRef<HTMLButtonElement>,
  });
  private readonly panelAsistente = viewChild<ElementRef<HTMLElement>>('panelAsistente');

  private readonly documento = inject(DOCUMENT);
  /** A 1024 px o menos el asistente es una hoja que tapa el contenido: lo de atrás no debe poder recibir foco. */
  private readonly hojaSuperpuesta = signal(false);
  protected readonly fondoInerte = computed(() => this.asistenteAbierto() && this.hojaSuperpuesta());

  constructor() {
    // Reactivo y no solo al construir: `restablecer()` (al cerrar sesión) devuelve el alcance a «plataforma» y
    // quien no es de plataforma no debe ver ni consultar ese alcance ni por un instante.
    effect(() => {
      if (!this.puedeElegirAlcance() && this.contexto.alcance() !== 'organizacion') {
        this.contexto.alcance.set('organizacion');
      }
    });
    const consulta = this.documento.defaultView?.matchMedia?.('(max-width: 1024px)');
    if (consulta !== undefined) {
      this.hojaSuperpuesta.set(consulta.matches);
      const alCambiar = (e: MediaQueryListEvent): void => this.hojaSuperpuesta.set(e.matches);
      consulta.addEventListener('change', alCambiar);
      inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', alCambiar));
    }
    // Elegir un destino cierra el cajón: si no, en el teléfono el menú taparía
    // justo el reporte al que se acaba de ir.
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.menuAbierto.set(false));
  }

  protected cambiarAlcance(alcance: AlcanceReporte): void {
    this.contexto.alcance.set(alcance);
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  protected alternarAsistente(): void {
    const abrir = !this.asistenteAbierto();
    if (abrir) {
      this.asistenteMontado.set(true);
    }
    this.asistenteAbierto.set(abrir);
    // El foco acompaña al panel: al abrir entra en él, al cerrar vuelve al botón
    // que lo abrió. Sin esto, quien navega con teclado abre el panel y sigue
    // parado en el botón, sin saber que apareció nada.
    afterNextRender(
      () => {
        // Al abrir, el foco va al campo de la pregunta (si ya cargó) y si no al panel; al cerrar, al botón.
        const panel = this.panelAsistente()?.nativeElement;
        const destino = abrir
          ? (panel?.querySelector<HTMLElement>('input.native-input') ?? panel)
          : this.botonAsistente()?.nativeElement;
        destino?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  protected alTeclear(evento: KeyboardEvent): void {
    // Un menú o un diálogo anidado (el «Más» de un gráfico, «Ver en grande») ya cerró lo suyo con este
    // mismo Escape: si lo marcó como atendido, aquí no se cierra además el asistente ni el menú lateral.
    if (evento.key !== 'Escape' || evento.defaultPrevented) {
      return;
    }
    const origen = evento.target instanceof Element ? evento.target : null;
    // `<dialog>` nativo («Ver en grande») no lleva `role`: `closest` no resuelve roles implícitos.
    if (origen?.closest('dialog, [role="menu"], [role="dialog"], [role="listbox"]')) {
      return;
    }
    if (this.asistenteAbierto()) {
      // Como columna al lado, el asistente no es modal: un Escape que viene de otro control (limpiar el
      // buscador, un filtro) no es para él. Solo se cierra con el foco dentro o cuando es una hoja encima.
      const panel = this.panelAsistente()?.nativeElement;
      const boton = this.botonAsistente()?.nativeElement;
      const suyo = origen !== null && (panel?.contains(origen) === true || origen === boton);
      if (suyo || this.hojaSuperpuesta()) {
        this.alternarAsistente();
      }
    } else if (this.menuAbierto()) {
      this.menuAbierto.set(false);
    }
  }
}
