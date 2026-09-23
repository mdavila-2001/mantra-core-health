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

import type {
  AnswerType,
  SurveyQuestion,
  SurveyQuestionEdit,
} from '@core/data-access/surveys/surveys.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Checkbox } from '@shared/components/atoms/checkbox/checkbox';
import { Input } from '@shared/components/atoms/input/input';
import { QuestionTypeIcon } from '@shared/components/atoms/question-type-icon/question-type-icon';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { FormField } from '@shared/components/molecules/form-field/form-field';

/** Los tipos de respuesta, en el orden en que se ofrecen. */
export const TIPOS_DE_RESPUESTA: readonly SelectOption<string>[] = [
  { value: 'TEXT', label: 'Texto libre' },
  { value: 'SCALE', label: 'Escala numérica' },
  { value: 'BOOLEAN', label: 'Sí / No' },
  { value: 'SINGLE_CHOICE', label: 'Elección simple' },
  { value: 'MULTIPLE_CHOICE', label: 'Elección múltiple' },
];

/** Los tipos que exigen un catálogo de opciones. */
const CON_OPCIONES: ReadonlySet<string> = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

/** Etiqueta legible de cada tipo, para la fila plegada. */
export const ETIQUETA_TIPO: Readonly<Record<AnswerType, string>> = {
  TEXT: 'Texto libre',
  SCALE: 'Escala',
  BOOLEAN: 'Sí / No',
  SINGLE_CHOICE: 'Elección simple',
  MULTIPLE_CHOICE: 'Elección múltiple',
};

/**
 * Una pregunta del cuestionario: plegada se lee, desplegada se edita.
 *
 * ```html
 * <app-question-editor
 *   [pregunta]="p" [abierta]="abierta() === p.id"
 *   (abrir)="abrir(p.id)" (guardar)="guardar(p.id, $event)" (borrar)="borrar(p.id)"
 * />
 * ```
 *
 * ## Por qué la edición es en línea y no en otra card
 *
 * Porque es donde está la pregunta. El editor anterior tenía un asistente
 * aparte —«Agregar una pregunta», paso 1 de 1— que sólo sabía **agregar al
 * final**: para corregir la tercera pregunta no había nada que hacer más que
 * tirar la encuesta. Editar donde se lee es lo que hace Google Forms y es lo
 * que convierte una lista en un editor.
 *
 * ## Las opciones son filas, no un `textarea`
 *
 * Antes se escribían «una por línea» en un área de texto. Eso obliga a saber la
 * convención, no dice cuántas van, no deja quitar la del medio sin seleccionar
 * su renglón entero, y un salto de línea de más creaba una opción vacía que el
 * servidor rechazaba **después** de guardar. Una fila por opción con su botón
 * de quitar no tiene ninguno de esos problemas.
 *
 * ## Lo que NO hace este componente
 *
 * No habla con la API. Emite `guardar` con lo que cambió y la pantalla decide;
 * así se puede probar sin levantar nada y la pantalla conserva el control de
 * cuándo se pide y qué se hace con el error.
 */
@Component({
  selector: 'app-question-editor',
  imports: [AppButton, Checkbox, FormField, Input, QuestionTypeIcon, Select],
  templateUrl: './question-editor.html',
  styleUrl: './question-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'editor-pregunta',
    '[class.editor-pregunta--abierta]': 'abierta()',
  },
})
export class QuestionEditor {
  readonly pregunta = input.required<SurveyQuestion>();
  readonly abierta = input(false, { transform: booleanAttribute });

  /** Si se puede editar. En falso la pregunta sólo se lee: versión publicada. */
  readonly editable = input(true, { transform: booleanAttribute });

  /** Para deshabilitar «subir» en la primera y «bajar» en la última. */
  readonly esPrimera = input(false, { transform: booleanAttribute });
  readonly esUltima = input(false, { transform: booleanAttribute });

  /** Si hay una petición en vuelo sobre esta pregunta. */
  readonly guardando = input(false, { transform: booleanAttribute });

  readonly abrir = output<void>();
  readonly cerrar = output<void>();
  readonly guardar = output<SurveyQuestionEdit>();
  readonly borrar = output<void>();
  readonly mover = output<-1 | 1>();

  protected readonly tipos = TIPOS_DE_RESPUESTA;

  /* -- el borrador local ---------------------------------------------------- */

  protected readonly texto = signal('');
  protected readonly tipo = signal<AnswerType>('TEXT');
  protected readonly obligatoria = signal(false);
  protected readonly opciones = signal<readonly string[]>([]);
  protected readonly minimo = signal(1);
  protected readonly maximo = signal(5);

  protected readonly pideOpciones = computed(() => CON_OPCIONES.has(this.tipo()));
  protected readonly pideEscala = computed(() => this.tipo() === 'SCALE');

  /** La etiqueta del tipo, para la fila plegada. */
  protected readonly etiquetaDelTipo = computed(() => ETIQUETA_TIPO[this.pregunta().answerType]);

  /** El resumen de la fila plegada: opciones o extremos de la escala. */
  protected readonly detalle = computed(() => {
    const p = this.pregunta();
    if (p.answerType === 'SCALE') return `De ${p.scaleMin ?? 1} a ${p.scaleMax ?? 5}`;
    const opciones = p.options ?? [];
    if (opciones.length === 0) return '';
    // Tres y «y N más»: la fila plegada tiene que caber en un renglón, y una
    // pregunta con doce opciones las empujaría a tres líneas.
    const visibles = opciones.slice(0, 3).join(' · ');
    const resto = opciones.length - Math.min(3, opciones.length);
    return resto > 0 ? `${visibles} · y ${resto} más` : visibles;
  });

  /** Lo que impide guardar, o `null`. Se muestra en el pie del editor. */
  protected readonly problema = computed<string | null>(() => {
    if (this.texto().trim() === '') return 'Escribí la pregunta.';
    if (this.pideOpciones()) {
      const utiles = this.opciones().filter((o) => o.trim() !== '');
      if (utiles.length < 2) return 'Una pregunta de elección necesita al menos dos opciones.';
      const normalizadas = utiles.map((o) => o.trim().toLowerCase());
      if (new Set(normalizadas).size !== normalizadas.length) {
        // Dos opciones iguales no se pueden distinguir al responder ni al leer
        // el resumen: la barra de una taparía a la otra.
        return 'Hay dos opciones repetidas.';
      }
    }
    if (this.pideEscala() && this.maximo() <= this.minimo()) {
      return 'El máximo de la escala tiene que ser mayor que el mínimo.';
    }
    return null;
  });

  constructor() {
    // El borrador se rehace cada vez que se abre —o cuando la pregunta cambia
    // por debajo, tras guardar—: así cancelar de verdad descarta, en vez de
    // dejar lo tecleado esperando la próxima apertura.
    effect(() => {
      const p = this.pregunta();
      if (!this.abierta()) return;
      this.texto.set(p.questionText);
      this.tipo.set(p.answerType);
      this.obligatoria.set(p.required);
      this.opciones.set([...(p.options ?? [])]);
      this.minimo.set(p.scaleMin ?? 1);
      this.maximo.set(p.scaleMax ?? 5);
    });
  }

  protected cambiarTexto(valor: string | number | null): void {
    this.texto.set(String(valor ?? ''));
  }

  protected cambiarTipo(valor: string | null): void {
    this.tipo.set((valor ?? 'TEXT') as AnswerType);
    // Al pasar a una elección sin opciones se siembran dos vacías: es lo que
    // hay que llenar, y una lista vacía con un «+ Agregar opción» esconde que
    // hacen falta dos.
    if (CON_OPCIONES.has(this.tipo()) && this.opciones().length < 2) {
      this.opciones.set([...this.opciones(), ...Array(2 - this.opciones().length).fill('')]);
    }
  }

  protected cambiarOpcion(indice: number, valor: string | number | null): void {
    this.opciones.update((actuales) =>
      actuales.map((opcion, i) => (i === indice ? String(valor ?? '') : opcion)),
    );
  }

  protected agregarOpcion(): void {
    this.opciones.update((actuales) => [...actuales, '']);
  }

  protected quitarOpcion(indice: number): void {
    this.opciones.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  protected cambiarMinimo(valor: string | number | null): void {
    this.minimo.set(Number(valor ?? 0));
  }

  protected cambiarMaximo(valor: string | number | null): void {
    this.maximo.set(Number(valor ?? 0));
  }

  /**
   * Emite lo editado.
   *
   * Manda **sólo** las claves que el tipo admite: el backend valida con
   * `forbidNonWhitelisted` y una clave que no corresponde vuelve 400. Es el
   * mismo cuidado que ya tenía el alta de pregunta.
   */
  protected confirmar(): void {
    if (this.problema() !== null || this.guardando()) return;
    const tipo = this.tipo();
    this.guardar.emit({
      questionText: this.texto().trim(),
      answerType: tipo,
      required: this.obligatoria(),
      ...(CON_OPCIONES.has(tipo)
        ? { options: this.opciones().map((o) => o.trim()).filter((o) => o !== '') }
        : {}),
      ...(tipo === 'SCALE' ? { scaleMin: this.minimo(), scaleMax: this.maximo() } : {}),
    });
  }
}
