import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  viewChild,
  type OnDestroy,
} from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { AppButton } from '../../atoms/button/button';

/** Los cuatro anchos de referencia del panel. Ver {@link ContentDialog.size}. */
export const CONTENT_DIALOG_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export type ContentDialogSize = (typeof CONTENT_DIALOG_SIZES)[number];

/**
 * Un modal **con contenido propio**, sobre el `<dialog>` nativo.
 *
 * ```html
 * @if (abierto()) {
 *   <app-content-dialog heading="Dónde conseguirlo" (closed)="cerrar()"
 *                       (opened)="mapaListo.set(true)">
 *     …lista, mapa, lo que la pantalla necesite…
 *   </app-content-dialog>
 * }
 * ```
 *
 * ## Por qué no es `DialogService.confirm()`
 *
 * Porque aquél es una **confirmación**: su contrato es título + mensaje +
 * (opcional) motivo, y devuelve `boolean`. No proyecta contenido, y no puede
 * hacerlo sin cambiarle la firma a las veintitantas pantallas que lo llaman.
 * Lo que este organismo necesita mostrar es una lista de farmacias con un mapa
 * al lado, que no entra en un `message: string`.
 *
 * Lo que **no** se reimplementa es la parte difícil: el fondo, la inertización
 * de lo que queda atrás, la trampa de foco y el cierre con `Escape` los sigue
 * dando `showModal()` del navegador, igual que en `molecules/dialog`. Acá sólo
 * se agrega la proyección de contenido y el bloqueo del scroll de la página.
 *
 * ## `opened` existe por Leaflet
 *
 * Un mapa necesita **layout real** para montarse: creado dentro de un
 * `<dialog>` todavía cerrado, mide 0×0 y se dibuja gris. Por eso el evento se
 * emite **después** de `showModal()`: quien lo escucha recién ahí instancia el
 * mapa.
 *
 * ## El pie de acciones se proyecta y no se recorre
 *
 * Lo que se marque con el atributo `dialog-actions` viaja al pie, fuera del
 * área con scroll: en un formulario largo, el botón que guarda tiene que seguir
 * alcanzable sin llegar al final del cuerpo.
 *
 * ```html
 * <app-content-dialog heading="Adjuntar archivos" size="lg" [dismissible]="false"
 *                     (dismissAttempt)="preguntarSiSeDescarta()" (closed)="cerrar()">
 *   …el formulario…
 *   <button dialog-actions app-button (clicked)="guardar()">Adjuntar archivos</button>
 * </app-content-dialog>
 * ```
 *
 * ## `size` son objetivos de ancho, no una caja fija
 *
 * Cuatro medidas —confirmación breve, formulario clínico, cola de adjuntos,
 * listados— porque un formulario de dos campos en 58rem queda perdido y una
 * conversación de grupo en 30rem no se lee. En teléfono las cuatro colapsan al
 * mismo modal casi completo: la medida es un techo, no un piso.
 *
 * ## `dismissible` es para las ediciones, y no atrapa a nadie
 *
 * Con `false`, el clic en el fondo y `Escape` dejan de cerrar solos y pasan a
 * emitir {@link dismissAttempt}: quien lo escucha pregunta si se descarta lo
 * escrito y recién entonces cierra. El gesto no se bloquea —eso dejaría un
 * modal sin salida de teclado—, se le cambia el destino.
 */
@Component({
  selector: 'app-content-dialog',
  imports: [AppButton],
  templateUrl: './content-dialog.html',
  styleUrl: './content-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContentDialog implements OnDestroy {
  /** El título del modal. Es su nombre accesible. */
  readonly heading = input.required<string>();

  /** Una línea bajo el título. `null` no dibuja nada. */
  readonly description = input<string | null>(null);

  readonly closeLabel = input('Cerrar');

  /**
   * Se consulta antes de cerrar, salvo que `close(true)` lo salte.
   *
   * `null` —el valor por omisión— no pregunta nada: es el comportamiento de
   * siempre, el que usan los consumidores que no lo declaran. Quien lo
   * declara puede devolver una promesa: es lo que necesita `EditDialog` para
   * preguntar «¿Descartás los cambios?» antes de dejar que `Escape`, el fondo
   * o el botón de cerrar tiren lo que no se guardó.
   */
  readonly closeGuard = input<(() => boolean | Promise<boolean>) | null>(null);

  /**
   * Ancho de referencia del panel.
   *
   * `sm` una confirmación breve, `md` un formulario clínico, `lg` una cola de
   * adjuntos con su contexto, `xl` un listado con navegación interna.
   */
  readonly size = input<ContentDialogSize>('md');

  /**
   * Si el fondo y `Escape` cierran solos.
   *
   * `false` en una edición con cambios pendientes: el gesto pasa a
   * {@link dismissAttempt} en vez de perder lo escrito.
   */
  readonly dismissible = input(true);

  /** Se emite **después** de `showModal()`: recién ahí hay layout real. */
  readonly opened = output<void>();

  /**
   * Alguien intentó cerrar por el fondo o con `Escape` teniendo
   * `dismissible` en `false`. Quien lo escucha decide: confirmar el descarte y
   * llamar a {@link close}, o dejar el modal donde está.
   */
  readonly dismissAttempt = output<void>();

  /** Se cerró, por el botón, por `Escape` o por el fondo. */
  readonly closed = output<void>();

  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly dialogRef = viewChild.required<ElementRef<HTMLDialogElement>>('nativeDialog');

  private readonly baseId = nextControlId('content-dialog');
  protected readonly headingId = this.baseId + '-heading';
  protected readonly descriptionId = this.baseId + '-description';

  /** Quién lo abrió: al cerrar, el foco vuelve ahí. */
  private readonly origen: Element | null;

  /** El `overflow` que el documento tenía antes de bloquearlo. */
  private overflowPrevio = '';
  private bloqueado = false;
  private cerrado = false;

  /** Se está evaluando `closeGuard()`: una segunda petición no abre un segundo diálogo. */
  private cerrando = false;

  constructor() {
    this.origen = this.isBrowser ? this.document.activeElement : null;
    afterNextRender(() => this.showModal());
  }

  ngOnDestroy(): void {
    this.unlockScroll();
  }

  /**
   * Cierra el modal. Idempotente: `Escape` y el botón pueden llegar juntos.
   *
   * Con `force` en verdadero se salta `closeGuard()`: lo usa quien ya decidió
   * por su cuenta —por ejemplo, al guardar— y no quiere que se le pregunte si
   * quiere descartar lo que acaba de confirmar.
   */
  close(force = false): void {
    if (this.cerrado || this.cerrando) {
      return;
    }
    const guard = this.closeGuard();
    if (force || guard === null) {
      this.doClose();
      return;
    }
    this.cerrando = true;
    Promise.resolve(guard()).then((permitido) => {
      this.cerrando = false;
      if (permitido) {
        this.doClose();
      }
    });
  }

  private doClose(): void {
    this.cerrado = true;
    this.closeNative();
    this.unlockScroll();
    this.returnFocus();
    this.closed.emit();
  }

  /**
   * El camino de los tres gestos de cierre —el botón, `Escape` y el fondo—.
   *
   * Uno solo y no tres: si el botón cerrara de una mientras `Escape` pregunta,
   * la confirmación de descarte sería una formalidad que se esquiva con el ratón.
   */
  protected solicitarCierre(): void {
    if (!this.dismissible()) {
      this.dismissAttempt.emit();
      return;
    }
    this.close();
  }

  /**
   * `Escape` lo maneja el navegador y dispara `cancel`: se lo escucha en vez de
   * bloquearlo, para que cerrar siga siendo una sola cosa.
   */
  protected handleNativeCancel(event: Event): void {
    event.preventDefault();
    this.solicitarCierre();
  }

  /**
   * El `<dialog>` ocupa toda la pantalla y su fondo es el `::backdrop`, así que
   * un clic «afuera» es un clic sobre el propio `<dialog>` pero fuera del panel.
   */
  protected handleBackdropClick(event: MouseEvent): void {
    const panel = this.dialogRef().nativeElement.querySelector('.content-dialog__panel');
    if (panel === null || !(event.target instanceof Node)) {
      return;
    }
    if (panel.contains(event.target)) {
      return;
    }
    this.solicitarCierre();
  }

  /**
   * jsdom no implementa `showModal()`/`close()` —sólo el elemento—, así que los
   * dos accesos caen al atributo `open`. Es el mismo resguardo que usa
   * `molecules/dialog`; en un navegador real siempre gana el método nativo, que
   * es el que trae fondo, inertización y trampa de foco.
   */
  private showModal(): void {
    const nativo = this.dialogRef().nativeElement;
    if (typeof nativo.showModal === 'function') {
      nativo.showModal();
    } else {
      nativo.setAttribute('open', '');
    }
    this.lockScroll();
    this.opened.emit();
  }

  private closeNative(): void {
    const nativo = this.dialogRef().nativeElement;
    if (typeof nativo.close !== 'function') {
      nativo.removeAttribute('open');
      return;
    }
    if (nativo.open) {
      nativo.close();
    }
  }

  /**
   * El fondo no se recorre mientras el modal está abierto.
   *
   * `showModal()` inertiza lo de atrás pero **no** bloquea el scroll del
   * documento: en un teléfono, arrastrar sobre el fondo mueve la página que hay
   * debajo y al cerrar el modal se vuelve a otro lugar de la lista.
   */
  private lockScroll(): void {
    if (!this.isBrowser || this.bloqueado) {
      return;
    }
    this.overflowPrevio = this.document.body.style.overflow;
    this.document.body.style.overflow = 'hidden';
    this.bloqueado = true;
  }

  private unlockScroll(): void {
    if (!this.bloqueado) {
      return;
    }
    this.document.body.style.overflow = this.overflowPrevio;
    this.bloqueado = false;
  }

  private returnFocus(): void {
    if (this.origen instanceof HTMLElement && this.origen.isConnected) {
      this.origen.focus();
    }
  }
}
