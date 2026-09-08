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
  readonly dataType: string;
  readonly required: boolean;
}

/**
 * Los tipos de dato que el generador ofrece.
 *
 * `uuid`, `json`, `binary`, `reference` y `code` quedan fuera: piden un dato
 * que esta pantalla no pide —un target de referencia, un archivo, un concepto
 * del catálogo—, así que ofrecerlos dejaría campos que el backend rechaza al
 * completarse.
 */
export const TIPOS_DE_DATO: readonly SelectOption<string>[] = [
  { value: 'string', label: 'Texto corto' },
  { value: 'text', label: 'Texto largo' },
  { value: 'integer', label: 'Número entero' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'date', label: 'Fecha' },
];

/** Etiqueta legible de un tipo, para los campos del estándar. */
export function etiquetaDeTipo(tipo: string): string {
  const t = tipo.toLowerCase();
  const delGenerador = TIPOS_DE_DATO.find((o) => o.value === t)?.label;
  if (delGenerador !== undefined) return delGenerador;
  // El seed del catálogo clínico usa otro vocabulario (`NUMBER`, `TEXT`): son
  // los campos del estándar, que se leen aunque no se editen.
  if (t === 'number') return 'Número';
  if (t === 'boolean') return 'Sí / No';
  if (t === 'date') return 'Fecha';
  return 'Texto';
}

/** Cuánto se espera tras la última tecla antes de guardar el nombre. */
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
 * cosas juntas son lo que deja decidir si el campo está bien. Plegarlas
 * escondía justo lo que hay que ver.
 *
 * La pantalla anterior era peor todavía: una lista de sólo lectura con el
 * nombre y el código, y un formulario aparte al final que **sólo sabía
 * agregar**. Un campo mal escrito no se podía corregir.
 *
 * ## El control de muestra va deshabilitado
 *
 * Es una muestra de cómo se ve, no un lugar donde escribir. Habilitado
 * invitaría a completar el formulario desde el editor, y lo tecleado no iría a
 * ninguna parte.
 *
 * ## Se guarda solo
 *
 * El nombre con una pausa tras la última tecla; el tipo y lo obligatorio en el
 * acto, porque son un solo gesto y no hay nada que esperar. Un botón «Guardar»
 * por campo obligaría a acordarse de pulsarlo en cada uno de los veinte.
 *
 * ## Los campos del estándar se ven y no se tocan
 *
 * Con `editable` en falso no hay entradas ni acciones: son la parte que hace
 * comparable una ficha entre consultorios y el backend los rechaza igual.
 * Mostrar controles que el servidor va a negar sería ofrecer algo que no se
 * puede.
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

  protected readonly tipos = TIPOS_DE_DATO;

  /* -- el borrador local ---------------------------------------------------- */

  protected readonly nombre = signal('');
  protected readonly tipo = signal('string');
  protected readonly obligatorio = signal(false);

  /** Si se acaba de guardar, para el aviso del pie. */
  protected readonly guardado = signal(false);

  protected readonly etiquetaDelTipo = computed(() => etiquetaDeTipo(this.campo().dataType));

  /** La familia del control de muestra: la del borrador, no la guardada. */
  protected readonly familia = computed(() => familiaDe(this.tipo()));

  private pausa: ReturnType<typeof setTimeout> | null = null;
  private aviso: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // El borrador sigue al campo: al recargar la plantilla tras guardar, la
    // tarjeta tiene que mostrar lo que quedó guardado y no lo que se tecleó.
    effect(() => {
      const campo = this.campo();
      this.nombre.set(campo.name);
      this.tipo.set(campo.dataType.toLowerCase());
      this.obligatorio.set(campo.required);
    });
  }

  protected cambiarNombre(valor: string | number | null): void {
    this.nombre.set(String(valor ?? ''));
    // Con pausa: guardar por tecla serían quince peticiones para escribir
    // «¿Fuma?», y la última llegaría después de las otras catorce.
    if (this.pausa !== null) clearTimeout(this.pausa);
    this.pausa = setTimeout(() => this.emitir(), PAUSA_DE_GUARDADO_MS);
  }

  /** Al salir del campo se guarda ya: no hay razón para esperar la pausa. */
  protected guardarNombre(): void {
    if (this.pausa !== null) {
      clearTimeout(this.pausa);
      this.pausa = null;
    }
    this.emitir();
  }

  protected cambiarTipo(valor: string | null): void {
    this.tipo.set(valor ?? 'string');
    this.emitir();
  }

  protected cambiarObligatorio(valor: boolean): void {
    this.obligatorio.set(valor);
    this.emitir();
  }

  /**
   * Emite lo editado, si cambió algo y el nombre no quedó vacío.
   *
   * Un nombre vacío no se manda: el backend lo rechaza y, peor, dejaría la
   * tarjeta sin forma de identificarse mientras se escribe el siguiente. Se
   * espera a que haya algo escrito.
   */
  private emitir(): void {
    const campo = this.campo();
    const nombre = this.nombre().trim();
    if (nombre === '') return;

    const sinCambios =
      nombre === campo.name &&
      this.tipo() === campo.dataType.toLowerCase() &&
      this.obligatorio() === campo.required;
    if (sinCambios) return;

    this.guardar.emit({ name: nombre, dataType: this.tipo(), required: this.obligatorio() });

    this.guardado.set(true);
    if (this.aviso !== null) clearTimeout(this.aviso);
    this.aviso = setTimeout(() => this.guardado.set(false), AVISO_GUARDADO_MS);
  }
}
