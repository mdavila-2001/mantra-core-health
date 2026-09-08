import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import type { ChartTemplateField } from '@core/data-access/chart-templates/chart-templates.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Checkbox } from '@shared/components/atoms/checkbox/checkbox';
import { DataTypeIcon, familiaDe } from '@shared/components/atoms/data-type-icon/data-type-icon';
import { Input } from '@shared/components/atoms/input/input';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { Textarea } from '@shared/components/atoms/textarea/textarea';

/** Lo que el editor emite al guardar. */
export interface CambiosDelCampo {
  readonly name: string;
  /** El tipo **técnico**, el que viaja: `code` para los dos de elección. */
  readonly dataType: string;
  readonly required: boolean;
  /** Sólo en los de elección; las opciones enteras, nunca una suelta. */
  readonly options?: readonly string[];
  /** Sólo en los de elección: si admite marcar más de una. */
  readonly multiple?: boolean;
}

/**
 * El tipo tal como se **elige en la pantalla**.
 *
 * No es el tipo técnico. «Opción múltiple» y «Casillas de verificación» son
 * dos entradas distintas del desplegable —que es como las nombra cualquiera
 * que haya usado un formulario— y las dos viajan como `code`: lo que las
 * separa es la cardinalidad, no el tipo del dato. Traducir acá y no en el
 * contrato es lo que deja que la pantalla hable el idioma de quien la usa sin
 * inventarle tipos al backend.
 */
export type TipoDeCampo =
  | 'string'
  | 'text'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'choice'
  | 'checkboxes';

/**
 * Los tipos que el generador ofrece, en el orden del desplegable.
 *
 * `uuid`, `json`, `binary` y `reference` quedan fuera: piden un dato que esta
 * pantalla no pide —un target de referencia, un archivo—, así que ofrecerlos
 * dejaría campos que el backend rechaza al completarse. `code` sí entra, pero
 * partido en los dos de elección: suelto no se puede ofrecer, porque sin
 * opciones un campo codificado no tiene nada entre qué elegir.
 */
export const TIPOS_DE_DATO: readonly SelectOption<TipoDeCampo>[] = [
  { value: 'string', label: 'Texto corto' },
  { value: 'text', label: 'Texto largo' },
  { value: 'choice', label: 'Opción múltiple' },
  { value: 'checkboxes', label: 'Casillas de verificación' },
  { value: 'integer', label: 'Número entero' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'date', label: 'Fecha' },
];

/** Los dos que piden una lista de respuestas. */
export function esDeEleccion(tipo: TipoDeCampo): boolean {
  return tipo === 'choice' || tipo === 'checkboxes';
}

/** El tipo técnico que viaja, desde el que se eligió en pantalla. */
export function aDataType(tipo: TipoDeCampo): string {
  return esDeEleccion(tipo) ? 'code' : tipo;
}

/**
 * El de la pantalla, desde lo que devolvió la API.
 *
 * `number` se traduce a `integer` porque es el vocabulario del seed del
 * catálogo clínico, no del contrato: son el mismo dato escrito distinto.
 */
export function aTipoDeCampo(dataType: string, multiple = false): TipoDeCampo {
  const familia = familiaDe(dataType, multiple);
  if (familia === 'eleccion') return 'choice';
  if (familia === 'casillas') return 'checkboxes';
  const t = dataType.toLowerCase();
  if (t === 'number' || t === 'numeric') return 'integer';
  return TIPOS_DE_DATO.some((o) => o.value === t) ? (t as TipoDeCampo) : 'string';
}

/** Etiqueta legible de un tipo, para los campos del estándar. */
export function etiquetaDeTipo(tipo: string, multiple = false): string {
  const t = tipo.toLowerCase();
  // Los de elección primero: `code` no es uno de los valores del desplegable,
  // así que buscarlo ahí no lo encontraría.
  const familia = familiaDe(t, multiple);
  if (familia === 'eleccion') return 'Opción múltiple';
  if (familia === 'casillas') return 'Casillas de verificación';

  const delGenerador = TIPOS_DE_DATO.find((o) => o.value === t)?.label;
  if (delGenerador !== undefined) return delGenerador;

  // El seed del catálogo clínico usa otro vocabulario (`NUMBER`, `TEXT`): son
  // los campos del estándar, que se leen aunque no se editen.
  if (t === 'number') return 'Número';
  if (t === 'boolean') return 'Sí / No';
  if (t === 'date') return 'Fecha';
  return 'Texto';
}

/** Con cuántas opciones nace un campo de elección. */
const OPCIONES_INICIALES = ['Opción 1', 'Opción 2'] as const;

/** Por debajo de esto un campo de elección no ofrece elegir nada. */
const MINIMO_DE_OPCIONES = 2;

/** Cuánto se espera tras la última tecla antes de guardar. */
const PAUSA_DE_GUARDADO_MS = 700;

/** Cuánto se muestra el «Guardado» antes de apagarse. */
const AVISO_GUARDADO_MS = 2000;

/**
 * La tarjeta de un campo del formulario.
 *
 * ```html
 * <app-field-editor [campo]="campo" (guardar)="guardar(campo, $event)" (borrar)="quitar(campo)" />
 * ```
 *
 * ## Siempre abierta, como en Google Forms
 *
 * No hay estado plegado. La tarjeta muestra a la vez **qué se pregunta**, **de
 * qué tipo es** y **el control con el que se va a responder**, porque esas tres
 * cosas juntas son lo que deja decidir si el campo está bien.
 *
 * ## Los dos tipos de elección
 *
 * «Opción múltiple» (una sola respuesta, círculos) y «Casillas de
 * verificación» (varias, cuadrados) son las dos entradas que faltaban: sin
 * ellas el generador sólo sabía pedir texto y números, que es justo lo que un
 * formulario clínico menos usa —«¿Fuma?: nunca / ex fumador / fumador» no es
 * un texto libre—. Las opciones se escriben acá mismo, una por renglón, y se
 * reemplazan **enteras** al guardar: el orden importa y un parche por índice se
 * rompe en cuanto alguien inserta una en el medio.
 *
 * ## El control de muestra va deshabilitado
 *
 * Es una muestra de cómo se ve, no un lugar donde escribir. Habilitado
 * invitaría a completar el formulario desde el editor, y lo tecleado no iría a
 * ninguna parte. En los de elección la muestra son las opciones de verdad, con
 * su marca redonda o cuadrada: es lo que deja ver que quedaron bien escritas.
 *
 * ## Se guarda solo
 *
 * El nombre y las opciones con una pausa tras la última tecla; el tipo y lo
 * obligatorio en el acto, porque son un solo gesto y no hay nada que esperar.
 *
 * ## Los campos del estándar se ven y no se tocan
 *
 * Con `editable` en falso no hay entradas ni acciones —ni agarre para
 * arrastrar—: son la parte que hace comparable una ficha entre consultorios y
 * el backend los rechaza igual. **Se siguen mostrando enteros**, con sus
 * opciones si las tienen: esconderlos dejaría al doctor sin saber qué pregunta
 * ya está cubierta.
 *
 * ## Lo que NO hace
 *
 * No habla con la API. Emite `guardar` y la pantalla decide; así se prueba sin
 * levantar nada y la pantalla conserva el control del error.
 */
@Component({
  selector: 'app-field-editor',
  imports: [AppButton, Checkbox, DataTypeIcon, Input, Select, Textarea],
  templateUrl: './field-editor.html',
  styleUrl: './field-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'editor-campo',
    '[class.editor-campo--estandar]': '!editable()',
  },
})
export class FieldEditor {
  readonly campo = input.required<ChartTemplateField>();

  /** Si el campo se puede tocar. En falso sólo se lee: viene del estándar. */
  readonly editable = input(true, { transform: booleanAttribute });

  readonly esPrimero = input(false, { transform: booleanAttribute });
  readonly esUltimo = input(false, { transform: booleanAttribute });
  readonly guardando = input(false, { transform: booleanAttribute });

  readonly guardar = output<CambiosDelCampo>();
  readonly borrar = output<void>();
  readonly mover = output<-1 | 1>();

  /**
   * El agarre se apretó (`true`) o se soltó (`false`).
   *
   * La tarjeta no se arrastra sola: quien pone `draggable` es la lista, que es
   * la que sabe el orden. Sin esto el `<li>` sería arrastrable siempre y
   * seleccionar el texto del nombre empezaría un arrastre en vez de
   * seleccionar.
   */
  readonly agarrar = output<boolean>();

  protected readonly tipos = TIPOS_DE_DATO;

  /* -- el borrador local ---------------------------------------------------- */

  protected readonly nombre = signal('');
  protected readonly tipo = signal<TipoDeCampo>('string');
  protected readonly obligatorio = signal(false);
  protected readonly opciones = signal<readonly string[]>([]);

  /** Si se acaba de guardar, para el aviso del pie. */
  protected readonly guardado = signal(false);

  protected readonly etiquetaDelTipo = computed(() =>
    etiquetaDeTipo(this.campo().dataType, this.campo().multiple ?? false),
  );

  /**
   * La familia del control de muestra.
   *
   * En un campo propio, la del **borrador**: cambiar el tipo tiene que cambiar
   * la muestra en el acto, antes de que el guardado vuelva. En uno del
   * estándar, la del campo tal cual vino — su `dataType` puede estar en el
   * vocabulario del seed (`NUMBER`, `TEXT`), que el desplegable no tiene y que
   * pasar por el borrador aplanaría a texto.
   */
  protected readonly familia = computed(() =>
    this.editable()
      ? familiaDe(aDataType(this.tipo()), this.tipo() === 'checkboxes')
      : familiaDe(this.campo().dataType, this.campo().multiple ?? false),
  );

  /** Si el tipo elegido pide una lista de respuestas. */
  protected readonly pideOpciones = computed(() => esDeEleccion(this.tipo()));

  /**
   * El tipo técnico del **borrador**, para el ícono de la cabecera.
   *
   * No el del campo guardado: al elegir «Opción múltiple» el dibujo tiene que
   * cambiar en el acto, y esperar a que vuelva el guardado deja un par de
   * segundos con el ícono contando otra cosa que el desplegable.
   */
  protected readonly tipoTecnico = computed(() => aDataType(this.tipo()));

  /** Las que se muestran en la tarjeta de un campo del estándar. */
  protected readonly opcionesDelEstandar = computed<readonly string[]>(
    () => this.campo().options ?? [],
  );

  /** Con dos no se puede quitar ninguna: dejaría un campo sin qué elegir. */
  protected readonly puedeQuitarOpcion = computed(
    () => this.opciones().length > MINIMO_DE_OPCIONES,
  );

  private pausa: ReturnType<typeof setTimeout> | null = null;
  private aviso: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // El borrador sigue al campo: al recargar la plantilla tras guardar, la
    // tarjeta tiene que mostrar lo que quedó guardado y no lo que se tecleó.
    effect(() => {
      const campo = this.campo();
      this.nombre.set(campo.name);
      this.tipo.set(aTipoDeCampo(campo.dataType, campo.multiple ?? false));
      this.obligatorio.set(campo.required);
      this.opciones.set(campo.options ?? []);
    });
  }

  protected cambiarNombre(valor: string | number | null): void {
    this.nombre.set(String(valor ?? ''));
    // Con pausa: guardar por tecla serían quince peticiones para escribir
    // «¿Fuma?», y la última llegaría después de las otras catorce.
    this.conPausa();
  }

  /** Al salir del campo se guarda ya: no hay razón para esperar la pausa. */
  protected guardarNombre(): void {
    this.cancelarPausa();
    this.emitir();
  }

  /**
   * Cambia el tipo, sembrando o descartando las opciones según haga falta.
   *
   * Pasar a un tipo de elección sin opciones dejaría una tarjeta que dice
   * «elegí una» y no ofrece ninguna; se siembran dos, que es el mínimo con el
   * que elegir significa algo. Al revés no se borran: volver a «Texto corto»
   * por error y perder las cinco opciones escritas es un castigo por un clic.
   */
  protected cambiarTipo(valor: TipoDeCampo | null): void {
    const tipo = valor ?? 'string';
    this.tipo.set(tipo);
    if (esDeEleccion(tipo) && this.opciones().length < MINIMO_DE_OPCIONES) {
      this.opciones.set([...OPCIONES_INICIALES]);
    }
    this.cancelarPausa();
    this.emitir();
  }

  protected cambiarObligatorio(valor: boolean): void {
    this.obligatorio.set(valor);
    this.cancelarPausa();
    this.emitir();
  }

  /* -- las opciones ---------------------------------------------------------- */

  protected cambiarOpcion(indice: number, valor: string | number | null): void {
    this.opciones.update((actuales) =>
      actuales.map((opcion, i) => (i === indice ? String(valor ?? '') : opcion)),
    );
    this.conPausa();
  }

  protected agregarOpcion(): void {
    this.opciones.update((actuales) => [...actuales, `Opción ${actuales.length + 1}`]);
    this.cancelarPausa();
    this.emitir();
  }

  protected quitarOpcion(indice: number): void {
    if (!this.puedeQuitarOpcion()) {
      return;
    }
    this.opciones.update((actuales) => actuales.filter((_, i) => i !== indice));
    this.cancelarPausa();
    this.emitir();
  }

  /* -- el guardado ----------------------------------------------------------- */

  private conPausa(): void {
    this.cancelarPausa();
    this.pausa = setTimeout(() => this.emitir(), PAUSA_DE_GUARDADO_MS);
  }

  private cancelarPausa(): void {
    if (this.pausa !== null) {
      clearTimeout(this.pausa);
      this.pausa = null;
    }
  }

  /**
   * Emite lo editado, si cambió algo y quedó en un estado que se puede guardar.
   *
   * No se manda un nombre vacío —el backend lo rechaza y dejaría la tarjeta sin
   * forma de identificarse— ni un campo de elección con menos de dos opciones o
   * con una en blanco: las tres cosas son formularios que el paciente vería
   * rotos.
   */
  private emitir(): void {
    const campo = this.campo();
    const nombre = this.nombre().trim();
    if (nombre === '') return;

    const tipo = this.tipo();
    const eleccion = esDeEleccion(tipo);
    const opciones = this.opciones().map((opcion) => opcion.trim());
    if (eleccion && (opciones.length < MINIMO_DE_OPCIONES || opciones.some((o) => o === ''))) {
      return;
    }

    const dataType = aDataType(tipo);
    const multiple = tipo === 'checkboxes';
    const opcionesGuardadas = campo.options ?? [];

    const sinCambios =
      nombre === campo.name &&
      dataType === campo.dataType.toLowerCase() &&
      this.obligatorio() === campo.required &&
      multiple === (campo.multiple ?? false) &&
      opciones.length === opcionesGuardadas.length &&
      opciones.every((opcion, i) => opcion === opcionesGuardadas[i]);
    if (sinCambios) return;

    this.guardar.emit({
      name: nombre,
      dataType,
      required: this.obligatorio(),
      ...(eleccion ? { options: opciones, multiple } : {}),
    });

    this.guardado.set(true);
    if (this.aviso !== null) clearTimeout(this.aviso);
    this.aviso = setTimeout(() => this.guardado.set(false), AVISO_GUARDADO_MS);
  }
}
