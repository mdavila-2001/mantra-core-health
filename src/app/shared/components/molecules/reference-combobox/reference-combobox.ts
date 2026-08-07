import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { Input } from '../../atoms/input/input';
import { Spinner } from '../../atoms/spinner/spinner';
import { AppButton } from '../../atoms/button/button';
import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
  type FormControlContext,
} from '@shared/forms/form-control.context';
import {
  REFERENCE_COMBOBOX_DEBOUNCE_MS,
  REFERENCE_COMBOBOX_MIN_QUERY_LENGTH,
  type ReferenceOption,
} from './reference-combobox.types';

/**
 * Buscador de referencia: se escribe un nombre, se elige de una lista y se
 * guarda un uuid.
 *
 * ```html
 * <app-form-field label="Médico tratante" required>
 *   <app-reference-combobox
 *     [(value)]="form.practitionerId"
 *     [options]="resultados()"
 *     [loading]="buscando()"
 *     [selected]="medicoActual()"
 *     (searched)="buscarMedicos($event)"
 *     placeholder="Nombre o matrícula"
 *   />
 * </app-form-field>
 * ```
 *
 * ## Qué problema resuelve
 *
 * El modelo referencia entidades por uuid, así que ocho de las once vistas de
 * `V05` piden el mismo control: «autocompletar sobre la entidad referenciada,
 * muestra nombre y guarda uuid». Sin una pieza del banco, cada pantalla lo
 * habría compuesto a mano con `app-search-field` + `app-menu` — y ese apaño
 * sale mal: `app-menu` es `role="menu"`, no `role="listbox"`, se muda al
 * `<body>` y no puede ser el `aria-controls` de un combobox. El lector de
 * pantalla anunciaría un menú de acciones donde hay una lista de valores.
 *
 * ## Quién busca
 *
 * La molécula **no** consulta la red: recibe `options` y emite `searched` con
 * espera. Es deliberado —un componente del sistema de diseño que sepa de
 * `HttpClient` deja de poder probarse y de poder reutilizarse— y además es lo
 * que la arquitectura del proyecto exige: la superficie de red vive entera en
 * `core/data-access/`.
 *
 * ## Texto libre, nunca
 *
 * Lo que se guarda es un uuid. Si se sale del campo sin elegir, el texto vuelve
 * a lo último elegido (o se vacía): dejar escrito «Dr. Pére» junto a un uuid que
 * no le corresponde sería peor que no ofrecer el campo.
 *
 * ## Teclado
 *
 * Poner el foco **no** despliega nada: la lista se abre al escribir o con `↓`.
 * Abrir al enfocar parece amable y no lo es —tras elegir, el foco vuelve al
 * campo y el panel se reabriría solo sobre la opción recién elegida— y además
 * dispararía la consulta cada vez que alguien tabula por el formulario.
 *
 * `↓`/`↑` abren y recorren con vuelta, `Alt+↓` abre sin mover, `Alt+↑` cierra,
 * `Home`/`End` van a los extremos, `Enter` elige la opción activa, `Escape`
 * cierra —y si ya estaba cerrado, borra la selección—, `Tab` cierra y restaura.
 * Las opciones deshabilitadas se saltan al recorrer.
 */
@Component({
  selector: 'app-reference-combobox',
  imports: [Input, Spinner, AppButton],
  templateUrl: './reference-combobox.html',
  styleUrl: './reference-combobox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: FORM_CONTROL_CONTEXT, useExisting: forwardRef(() => ReferenceCombobox) },
  ],
  host: {
    class: 'reference-combobox',
    '(keydown)': 'handleKeydown($event)',
    '(focusout)': 'handleFocusOut($event)',
  },
})
export class ReferenceCombobox implements FormControlContext {
  /** El campo que lo envuelva, si existe. `skipSelf` salta el que publica él mismo. */
  private readonly outerField = inject(FORM_CONTROL_CONTEXT, {
    optional: true,
    skipSelf: true,
  });

  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * `read: ElementRef` es obligatorio: una referencia de plantilla sobre un
   * componente devuelve **la instancia**, no su elemento, y buscar el `<input>`
   * nativo ahí adentro falla en silencio.
   */
  private readonly inputHost = viewChild('inputHost', { read: ElementRef });

  /** Identificador de la entidad elegida. Es lo que se persiste. */
  readonly value = model<string | null>(null);

  /**
   * Opción ya elegida, para hidratar el rótulo al editar un registro existente.
   *
   * Hace falta porque `value` es un uuid y el componente no consulta la red: sin
   * esto, abrir un formulario de edición mostraría el campo vacío aunque tenga
   * valor guardado.
   */
  readonly selected = input<ReferenceOption | null>(null);

  /** Resultados de la última búsqueda. Los provee quien consulta. */
  readonly options = input<readonly ReferenceOption[]>([]);

  readonly loading = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly placeholder = input<string>('Buscar');
  readonly debounceMs = input<number>(REFERENCE_COMBOBOX_DEBOUNCE_MS);
  readonly minQueryLength = input<number>(REFERENCE_COMBOBOX_MIN_QUERY_LENGTH);

  /** Nombre accesible. Sin campo externo alrededor, es lo único que lo nombra. */
  readonly label = input<string>('Buscar');

  /** Qué decir cuando la búsqueda no encontró nada. */
  readonly emptyMessage = input<string>('Sin resultados');

  /**
   * Nombre en pasado, no `search`: un output llamado como un evento nativo del
   * DOM se dispara también cuando ese evento burbujea desde adentro.
   */
  readonly searched = output<string>();

  /** La opción completa que se eligió, para quien necesite el rótulo. */
  readonly selectionChange = output<ReferenceOption | null>();

  /* ---- FormControlContext: el campo se nombra a sí mismo ------------------ */

  private readonly baseId = nextControlId('reference-combobox');
  readonly controlLabelable = signal(true);
  readonly controlId = computed(() => this.outerField?.controlId() ?? `${this.baseId}-control`);
  readonly labelId = computed(() => this.outerField?.labelId() ?? `${this.baseId}-label`);
  readonly describedBy = computed(() => this.outerField?.describedBy() ?? null);
  readonly invalid = computed(() => this.outerField?.invalid() === true);
  readonly required = computed(() => this.outerField?.required() === true);

  /** Sin campo externo el label propio es el único nombre; con él, sobraría. */
  protected readonly ownsLabel = computed(() => this.outerField === null);

  protected readonly listboxId = `${this.baseId}-listbox`;
  protected readonly statusId = `${this.baseId}-status`;

  /** Lo que hay escrito en el campo. */
  protected readonly query = signal('');
  protected readonly open = signal(false);

  /** Posición activa dentro de `options`, o -1 si no hay ninguna. */
  protected readonly activeIndex = signal(-1);

  /** Lo último que se eligió; gobierna qué texto se restaura al salir. */
  protected readonly chosen = signal<ReferenceOption | null>(null);

  /** Último texto ya avisado: evita que la espera repita lo que salió al instante. */
  private readonly emitted = signal<string | null>(null);

  /** La primera corrida del efecto es el valor inicial, no una búsqueda. */
  private isFirstRun = true;

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return index >= 0 && index < this.options().length ? this.optionId(index) : null;
  });

  protected readonly comboboxAria = computed(() => ({
    expanded: this.open(),
    controls: this.listboxId,
    activeDescendant: this.activeOptionId(),
    autocomplete: 'list' as const,
  }));

  /** Se despliega sólo si hay algo que mostrar: un panel vacío es ruido. */
  protected readonly showPanel = computed(
    () => this.open() && !this.disabled() && (this.options().length > 0 || this.showEmpty()),
  );

  /** Hubo búsqueda, terminó, y no trajo nada. */
  protected readonly showEmpty = computed(
    () => !this.loading() && this.options().length === 0 && this.queryIsSearchable(),
  );

  /**
   * Qué se anuncia por el canal de cortesía. La molécula sí lo hace —a
   * diferencia de `app-search-field`— porque acá los resultados son suyos: es la
   * única que sabe cuántos hay.
   */
  protected readonly statusMessage = computed(() => {
    if (!this.open()) {
      return '';
    }
    if (this.loading()) {
      return 'Buscando';
    }
    if (!this.queryIsSearchable()) {
      return '';
    }
    const total = this.options().length;
    if (total === 0) {
      return this.emptyMessage();
    }
    return total === 1 ? '1 resultado' : `${total} resultados`;
  });

  constructor() {
    // El rótulo de lo ya elegido llega desde fuera: es lo que permite editar un
    // registro existente sin que el componente tenga que consultar nada.
    effect(() => {
      const hidratada = this.selected();
      untracked(() => {
        this.chosen.set(hidratada);
        if (hidratada) {
          this.query.set(hidratada.label);
          this.emitted.set(hidratada.label);
        }
      });
    });

    effect((onCleanup) => {
      const texto = this.query();
      const espera = untracked(() => this.debounceMs());

      if (this.isFirstRun) {
        // Un valor precargado no dispara ninguna consulta.
        this.isFirstRun = false;
        this.emitted.set(texto);
        return;
      }

      if (untracked(() => this.emitted()) === texto) {
        return;
      }

      const temporizador = setTimeout(() => this.emitSearch(texto), espera);
      onCleanup(() => clearTimeout(temporizador));
    });
  }

  protected optionId(index: number): string {
    return `${this.baseId}-option-${index}`;
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (this.disabled()) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (event.altKey) {
          // `Alt+↓` despliega sin mover: es la forma de ver la lista sin elegir.
          this.open.set(true);
          return;
        }
        this.openAndMove(1);
        return;

      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey) {
          this.close();
          return;
        }
        this.openAndMove(-1);
        return;

      case 'Home':
        if (!this.open()) {
          return;
        }
        event.preventDefault();
        this.activeIndex.set(this.firstSelectable());
        return;

      case 'End':
        if (!this.open()) {
          return;
        }
        event.preventDefault();
        this.activeIndex.set(this.lastSelectable());
        return;

      case 'Enter': {
        const activa = this.options()[this.activeIndex()];
        if (this.open() && activa) {
          // Sólo se roba el Enter cuando hay algo que elegir: si no, el
          // formulario que lo envuelve debe poder enviarse con Enter.
          event.preventDefault();
          this.choose(activa);
        }
        return;
      }

      case 'Escape':
        if (this.open()) {
          event.preventDefault();
          this.close();
          return;
        }
        if (this.chosen() || this.query()) {
          event.preventDefault();
          this.clear();
        }
        return;

      case 'Tab':
        // Tab no se intercepta: se cierra y se deja ir el foco, restaurando el
        // texto para no dejar escrito algo que no corresponde a ningún uuid.
        this.close();
        return;

      default:
        return;
    }
  }

  /**
   * El foco salió del componente. Se comprueba a dónde fue: al pulsar una opción
   * el foco viaja dentro del propio host, y cerrar ahí cancelaría la elección
   * antes de que ocurra.
   */
  protected handleFocusOut(event: FocusEvent): void {
    const destino = event.relatedTarget as Node | null;
    if (destino && this.hostElement.nativeElement.contains(destino)) {
      return;
    }
    this.close();
  }

  /**
   * `mousedown` sobre una opción no debe robar el foco del campo: si lo hiciera,
   * `focusout` cerraría el panel antes de que llegue el `click`.
   */
  protected keepFocus(event: MouseEvent): void {
    event.preventDefault();
  }

  protected choose(option: ReferenceOption): void {
    if (option.disabled) {
      return;
    }
    this.chosen.set(option);
    this.query.set(option.label);
    // El rótulo elegido no es una búsqueda nueva: se marca como ya avisado para
    // que la espera pendiente no dispare una consulta por él.
    this.emitted.set(option.label);
    this.value.set(option.value);
    this.selectionChange.emit(option);
    this.close();
    this.focusInput();
  }

  protected clear(): void {
    this.chosen.set(null);
    this.value.set(null);
    this.query.set('');
    this.emitted.set('');
    this.activeIndex.set(-1);
    this.selectionChange.emit(null);
    this.focusInput();
  }

  /** Cierra y devuelve el texto a lo último elegido: nunca queda texto huérfano. */
  private close(): void {
    if (!this.open() && this.query() === (this.chosen()?.label ?? '')) {
      return;
    }
    this.open.set(false);
    this.activeIndex.set(-1);
    const rotulo = this.chosen()?.label ?? '';
    if (this.query() !== rotulo) {
      this.query.set(rotulo);
      this.emitted.set(rotulo);
    }
  }

  /** Abre si hacía falta y mueve la posición activa, saltando lo deshabilitado. */
  private openAndMove(paso: 1 | -1): void {
    if (!this.open()) {
      this.open.set(true);
    }
    const total = this.options().length;
    if (total === 0) {
      this.activeIndex.set(-1);
      return;
    }

    // Sin posición activa, `↓` entra por el principio y `↑` por el final. La
    // aritmética circular sola no lo da: desde -1, un paso hacia atrás cae en la
    // penúltima, no en la última.
    let indice = this.activeIndex();
    if (indice < 0) {
      indice = paso === 1 ? -1 : 0;
    }

    for (let intento = 0; intento < total; intento += 1) {
      indice = (indice + paso + total) % total;
      if (!this.options()[indice]?.disabled) {
        this.activeIndex.set(indice);
        return;
      }
    }
    // Todas deshabilitadas: no hay nada que activar.
    this.activeIndex.set(-1);
  }

  private firstSelectable(): number {
    const indice = this.options().findIndex((option) => !option.disabled);
    return indice;
  }

  private lastSelectable(): number {
    const opciones = this.options();
    for (let indice = opciones.length - 1; indice >= 0; indice -= 1) {
      if (!opciones[indice].disabled) {
        return indice;
      }
    }
    return -1;
  }

  /** El texto tiene largo suficiente como para que valga la pena consultar. */
  private queryIsSearchable(): boolean {
    return this.query().trim().length >= this.minQueryLength();
  }

  /**
   * Avisa que hay que buscar y deja constancia, para que el temporizador
   * pendiente —si lo hay— no repita el mismo texto.
   */
  private emitSearch(texto: string): void {
    if (untracked(() => this.emitted()) === texto) {
      return;
    }
    this.emitted.set(texto);

    // Escribir invalida la elección anterior: el uuid guardado dejaría de
    // corresponder al texto en pantalla, que es justo lo que hay que evitar.
    if (this.chosen() && this.chosen()?.label !== texto) {
      this.chosen.set(null);
      this.value.set(null);
      this.selectionChange.emit(null);
    }

    if (texto.trim().length < this.minQueryLength()) {
      this.activeIndex.set(-1);
      return;
    }

    this.open.set(true);
    this.activeIndex.set(-1);
    this.searched.emit(texto);
  }

  /**
   * Alcanza el `<input>` nativo por el DOM y no por una API del átomo: el
   * `app-input` no expone `focus()`.
   */
  private focusInput(): void {
    const host = this.inputHost()?.nativeElement as HTMLElement | undefined;
    host?.querySelector('input')?.focus();
  }
}
