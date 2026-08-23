import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '@shared/forms/form-control.context';
import { AppButton } from '../../atoms/button/button';
import type { TreeSelectGroup, TreeSelectItem } from './tree-select.types';

/**
 * Una rama tal como se pinta: con sus hojas ya filtradas y su estado de
 * apertura resuelto.
 */
export interface RamaVisible<T> {
  /** Posición de la rama en el árbol completo; entra en los ids del DOM. */
  readonly indice: number;
  readonly label: string;
  /** Sus hojas, ya pasadas por el filtro. */
  readonly items: readonly HojaVisible<T>[];
  /** Cuántas hojas tiene en total, filtre o no. */
  readonly total: number;
  /** Si está desplegada ahora mismo. */
  readonly abierta: boolean;
}

/** Una hoja tal como se pinta. */
export interface HojaVisible<T> {
  /** Posición dentro de su rama en el árbol completo. */
  readonly indice: number;
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

/** Una fila del recorrido de teclado: o una rama, o una hoja de una rama. */
interface Fila {
  readonly rama: number;
  /** `null` en la fila de la propia rama. */
  readonly hoja: number | null;
}

/**
 * Quita acentos y mayúsculas, para que «Potosi» encuentre «Potosí».
 *
 * Sin esto, media Bolivia queda inbuscable desde un teclado que no pone tildes
 * con comodidad, que son casi todos en un teléfono.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es');
}

/**
 * Selector de árbol con búsqueda: un grupo, sus opciones, y un cuadro de texto
 * que filtra sobre los dos niveles.
 *
 * ## Cuándo usarlo en lugar de `app-select`
 *
 * Cuando la lista es larga y sus opciones **sólo son inequívocas dentro de su
 * grupo**. El caso que lo motivó son los 340 municipios de Bolivia: siete
 * nombres se repiten entre departamentos, así que un desplegable plano ofrece
 * dos «San Pedro» idénticos y obliga a adivinar. Con el árbol, cada nombre
 * vuelve a estar bajo su departamento.
 *
 * Para nueve opciones que se leen de un vistazo, `app-select` sigue siendo lo
 * correcto: un `<select>` nativo trae el teclado y el manejo del móvil gratis.
 *
 * ## Por qué es un diálogo modal y no un desplegable
 *
 * Por dos motivos, uno de forma y otro de fondo:
 *
 * - Un panel `absolute` lo recorta cualquier ancestro con `overflow: hidden`, y
 *   uno `fixed` lo desplaza cualquier ancestro con `backdrop-filter` — que es
 *   exactamente el bug que tenía el calendario en esta misma pantalla. La capa
 *   superior del navegador no tiene ninguno de los dos problemas.
 * - Elegir entre 340 cosas es una tarea, no un gesto: merece la pantalla entera
 *   en un teléfono y un foco claro en el escritorio.
 *
 * ## Accesibilidad
 *
 * Es el patrón «combobox con árbol»: el foco vive en el cuadro de búsqueda
 * (`role="combobox"`) y la fila activa se señala con `aria-activedescendant`
 * sobre un `role="tree"`. Así se puede escribir y navegar sin que el foco salte,
 * que es lo que rompe a los lectores de pantalla en los selectores caseros.
 *
 * Teclado: flechas arriba/abajo recorren lo visible, derecha despliega una
 * rama, izquierda la pliega o sube a ella, Enter elige, Escape cierra.
 */
@Component({
  selector: 'app-tree-select',
  standalone: true,
  imports: [AppButton],
  templateUrl: './tree-select.html',
  styleUrl: './tree-select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-tree-select-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class TreeSelect<T> {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly value = model<T | null>(null);
  readonly groups = input<readonly TreeSelectGroup<T>[]>([]);
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);

  /** Lo que dice el disparador cuando no hay nada elegido. */
  readonly placeholder = input<string>('Sin especificar');
  /** Titular del diálogo. Describe la tarea, no el campo. */
  readonly dialogTitle = input<string>('Elegí una opción');
  /** Pista dentro del cuadro de búsqueda. */
  readonly searchPlaceholder = input<string>('Buscar…');
  /** Qué decir cuando la búsqueda no encuentra nada. */
  readonly emptyMessage = input<string>('No encontramos nada con ese nombre.');

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly trigger =
    viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  protected readonly isOpen = signal(false);
  protected readonly query = signal('');

  /** Índices de las ramas desplegadas a mano. La búsqueda despliega aparte. */
  private readonly abiertas = signal<ReadonlySet<number>>(new Set());

  /** Fila señalada por el teclado. `null` mientras nadie navegó. */
  protected readonly activa = signal<Fila | null>(null);

  private readonly ownId = nextControlId('tree');
  protected readonly controlId = computed(
    () => this.field?.controlId() ?? this.ownId,
  );
  protected readonly describedBy = computed(
    () => this.field?.describedBy() ?? null,
  );
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /** Id del árbol, para que el `aria-controls` del buscador lo apunte. */
  protected readonly treeId = computed(() => `${this.controlId()}-tree`);

  /** La búsqueda ya normalizada; cadena vacía significa «sin filtrar». */
  private readonly filtro = computed(() => normalizar(this.query().trim()));

  /**
   * Lo elegido, resuelto contra los grupos: su etiqueta y la de su rama.
   *
   * Se resuelve por búsqueda y no se guarda al elegir porque el valor puede
   * venir de afuera —un formulario que lo escribe, una edición que lo carga— y
   * en ese caso nadie pasó por `elegir()`.
   */
  protected readonly seleccion = computed<{
    item: TreeSelectItem<T>;
    grupo: string;
  } | null>(() => {
    const actual = this.value();
    if (actual === null) {
      return null;
    }
    for (const grupo of this.groups()) {
      const item = grupo.items.find((hoja) => hoja.value === actual);
      if (item) {
        return { item, grupo: grupo.label };
      }
    }
    return null;
  });

  /** Lo que muestra el disparador: «Sacaba · Cochabamba». */
  protected readonly displayValue = computed(() => {
    const elegido = this.seleccion();
    return elegido === null
      ? ''
      : `${elegido.item.label} · ${elegido.grupo}`;
  });

  /**
   * El árbol filtrado.
   *
   * Una rama sobrevive de dos maneras: porque su propio nombre casa —y entonces
   * trae todas sus hojas, que es lo que uno espera al escribir «Tarija»— o
   * porque alguna de sus hojas casa, y entonces trae sólo ésas.
   *
   * Con filtro, todo lo que sobrevive se muestra desplegado: esconder un
   * resultado detrás de un clic más es esconderlo.
   */
  protected readonly ramas = computed<readonly RamaVisible<T>[]>(() => {
    const filtro = this.filtro();
    const abiertas = this.abiertas();

    return this.groups()
      .map((grupo, indice) => {
        const ramaCasa = filtro !== '' && normalizar(grupo.label).includes(filtro);
        const items = grupo.items
          .map((item, posicion) => ({ item, posicion }))
          .filter(
            ({ item }) =>
              filtro === '' ||
              ramaCasa ||
              normalizar(item.label).includes(filtro),
          )
          .map(({ item, posicion }) => ({
            indice: posicion,
            value: item.value,
            label: item.label,
            hint: item.hint,
          }));

        return {
          indice,
          label: grupo.label,
          items,
          total: grupo.items.length,
          abierta: filtro === '' ? abiertas.has(indice) : items.length > 0,
        };
      })
      .filter((rama) => rama.items.length > 0);
  });

  /** Cuántas hojas hay a la vista, para anunciar el resultado de la búsqueda. */
  protected readonly totalVisible = computed(() =>
    this.ramas().reduce((suma, rama) => suma + rama.items.length, 0),
  );

  /**
   * Las filas recorribles con las flechas, en el orden en que se ven: cada rama
   * y, si está desplegada, sus hojas debajo.
   */
  private readonly filas = computed<readonly Fila[]>(() =>
    this.ramas().flatMap((rama) => [
      { rama: rama.indice, hoja: null },
      ...(rama.abierta
        ? rama.items.map((hoja) => ({ rama: rama.indice, hoja: hoja.indice }))
        : []),
    ]),
  );

  constructor() {
    // Abrir el diálogo y llevar el foco al buscador recién cuando el @if lo
    // pintó: `viewChild` avisa justo en ese momento.
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) {
        return;
      }
      this.showModal(dialog);
      this.search()?.nativeElement.focus();
    });
  }

  /** Id de la fila de una rama, para `aria-activedescendant`. */
  protected idRama(indice: number): string {
    return `${this.treeId()}-g${indice}`;
  }

  /** Id de la fila de una hoja. */
  protected idHoja(rama: number, hoja: number): string {
    return `${this.treeId()}-g${rama}-i${hoja}`;
  }

  /** Id de la fila activa, o `null` si no hay ninguna. */
  protected readonly idActivo = computed(() => {
    const fila = this.activa();
    if (fila === null) {
      return null;
    }
    return fila.hoja === null
      ? this.idRama(fila.rama)
      : this.idHoja(fila.rama, fila.hoja);
  });

  /** Si esta rama es la fila señalada por el teclado. */
  protected ramaActiva(indice: number): boolean {
    const fila = this.activa();
    return fila !== null && fila.hoja === null && fila.rama === indice;
  }

  /** Si esta hoja es la fila señalada por el teclado. */
  protected hojaActiva(rama: number, hoja: number): boolean {
    const fila = this.activa();
    return fila !== null && fila.rama === rama && fila.hoja === hoja;
  }

  /** Si esta hoja es la elegida. */
  protected hojaElegida(value: T): boolean {
    return this.value() !== null && this.value() === value;
  }

  protected open(): void {
    if (this.disabled()) {
      return;
    }
    this.query.set('');
    this.activa.set(null);
    // Se abre con la rama de lo ya elegido desplegada: quien vuelve al campo
    // para cambiar su municipio empieza mirando su departamento, no nueve
    // titulares cerrados.
    const elegido = this.seleccion();
    const indice = elegido
      ? this.groups().findIndex((grupo) => grupo.label === elegido.grupo)
      : -1;
    this.abiertas.set(indice >= 0 ? new Set([indice]) : new Set());
    this.isOpen.set(true);
  }

  protected close(): void {
    if (!this.isOpen()) {
      return;
    }
    // Cerrar el elemento antes de que el @if lo saque del DOM: un `<dialog>`
    // que se quita abierto deja su entrada en la capa superior, con el velo
    // puesto y el resto de la página bloqueado.
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open && typeof dialog.close === 'function') {
      dialog.close();
    }
    this.isOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  /** Un clic en el velo cierra; ver la nota de `handleBackdropClick` del calendario. */
  protected handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  protected handleSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    // Lo activo se descarta al cambiar el filtro: señalaba una fila que puede
    // ya no estar, y `aria-activedescendant` apuntando a la nada deja al lector
    // de pantalla sin decir nada.
    this.activa.set(null);
  }

  /** Despliega o pliega una rama. */
  protected toggleRama(indice: number): void {
    const abiertas = new Set(this.abiertas());
    if (abiertas.has(indice)) {
      abiertas.delete(indice);
    } else {
      abiertas.add(indice);
    }
    this.abiertas.set(abiertas);
    this.activa.set({ rama: indice, hoja: null });
  }

  /** Elige una hoja y cierra: elegir ES el final de la tarea. */
  protected elegir(value: T): void {
    this.value.set(value);
    this.close();
  }

  /** Borra la elección sin cerrar, para el caso «me equivoqué de campo». */
  protected limpiar(): void {
    this.value.set(null);
    this.close();
  }

  protected handleDialogKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.mover(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.mover(-1);
        return;
      case 'ArrowRight':
        event.preventDefault();
        this.desplegarActiva();
        return;
      case 'ArrowLeft':
        event.preventDefault();
        this.plegarActiva();
        return;
      case 'Enter':
        event.preventDefault();
        this.activarFila();
        return;
      default:
        return;
    }
  }

  /** Mueve la fila activa `paso` lugares, sin dar la vuelta. */
  private mover(paso: number): void {
    const filas = this.filas();
    if (filas.length === 0) {
      return;
    }
    const actual = this.activa();
    if (actual === null) {
      this.activa.set(filas[paso > 0 ? 0 : filas.length - 1]);
      return;
    }
    const posicion = filas.findIndex(
      (fila) => fila.rama === actual.rama && fila.hoja === actual.hoja,
    );
    // Sin vuelta a propósito: en una lista larga, saltar del final al principio
    // se siente como haber perdido el lugar.
    const siguiente = Math.min(
      Math.max(posicion + paso, 0),
      filas.length - 1,
    );
    this.activa.set(filas[siguiente]);
  }

  private desplegarActiva(): void {
    const fila = this.activa();
    if (fila === null || fila.hoja !== null) {
      return;
    }
    const abiertas = new Set(this.abiertas());
    abiertas.add(fila.rama);
    this.abiertas.set(abiertas);
  }

  /** Izquierda: pliega la rama activa, o sube a la rama desde una hoja. */
  private plegarActiva(): void {
    const fila = this.activa();
    if (fila === null) {
      return;
    }
    if (fila.hoja !== null) {
      this.activa.set({ rama: fila.rama, hoja: null });
      return;
    }
    const abiertas = new Set(this.abiertas());
    abiertas.delete(fila.rama);
    this.abiertas.set(abiertas);
  }

  /** Enter: sobre una rama despliega o pliega; sobre una hoja, elige. */
  private activarFila(): void {
    const fila = this.activa();
    if (fila === null) {
      return;
    }
    if (fila.hoja === null) {
      this.toggleRama(fila.rama);
      return;
    }
    const item = this.groups()[fila.rama]?.items[fila.hoja];
    if (item) {
      this.elegir(item.value);
    }
  }

  /**
   * Sube el diálogo a la capa superior. El `typeof` es por jsdom, que no
   * implementa `showModal`; ver la nota gemela en `date-picker.ts`.
   */
  private showModal(dialog: HTMLDialogElement): void {
    if (dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      return;
    }
    dialog.setAttribute('open', '');
  }
}
