import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
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
import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { ContentDialog } from '@shared/components/organisms/content-dialog/content-dialog';
import { crearBorradorAislado, hayCambioGuardable } from '@shared/utils/form-draft/form-draft';

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

/** Etiqueta legible de cada tipo, para la fila en lectura. */
export const ETIQUETA_TIPO: Readonly<Record<AnswerType, string>> = {
  TEXT: 'Texto libre',
  SCALE: 'Escala',
  BOOLEAN: 'Sí / No',
  SINGLE_CHOICE: 'Elección simple',
  MULTIPLE_CHOICE: 'Elección múltiple',
};

/** Lo que se ve en el control de muestra de un tipo que no lista opciones. */
function muestraDe(pregunta: SurveyQuestion): string {
  switch (pregunta.answerType) {
    case 'SCALE':
      return `De ${pregunta.scaleMin ?? 1} a ${pregunta.scaleMax ?? 5}`;
    case 'BOOLEAN':
      return 'Sí / No';
    default:
      return 'Respuesta del paciente';
  }
}

/**
 * Lo que identifica el estado guardable de una pregunta, en una sola cadena.
 *
 * La usan las dos comparaciones del borrador: «¿hay algo que se perdería al
 * cerrar?» —para preguntar antes de descartar— y «¿lo que volvió es lo que yo
 * mismo emití?» —para no pisar lo tecleado con la relectura de después de
 * guardar—. Ver `@shared/utils/form-draft`.
 */
function firmaDeCambios(cambios: SurveyQuestionEdit): string {
  return JSON.stringify([
    cambios.questionText ?? '',
    cambios.answerType ?? 'TEXT',
    cambios.required ?? false,
    cambios.options ?? null,
    cambios.scaleMin ?? null,
    cambios.scaleMax ?? null,
  ]);
}

/** La pregunta guardada, escrita en el mismo vocabulario que emite el editor. */
function edicionDe(pregunta: SurveyQuestion): SurveyQuestionEdit {
  const tipo = pregunta.answerType;
  return {
    questionText: pregunta.questionText.trim(),
    answerType: tipo,
    required: pregunta.required,
    ...(CON_OPCIONES.has(tipo)
      ? { options: (pregunta.options ?? []).map((o) => o.trim()).filter((o) => o !== '') }
      : {}),
    ...(tipo === 'SCALE' ? { scaleMin: pregunta.scaleMin ?? 1, scaleMax: pregunta.scaleMax ?? 5 } : {}),
  };
}

/**
 * Una pregunta del cuestionario: en la lista se lee, en un modal se edita.
 *
 * ```html
 * <app-question-editor
 *   [pregunta]="p" [abierta]="abierta() === p.id"
 *   (abrir)="abrir(p.id)" (guardar)="guardar(p.id, $event)" (borrar)="borrar(p.id)"
 * />
 * ```
 *
 * ## Por qué la edición vive en un modal y no dentro de la fila
 *
 * Porque desplegar el formulario en la fila **empuja la lista entera**: la
 * pregunta que se estaba comparando con la de al lado se va de la pantalla en
 * cuanto se abre el editor, y las de abajo saltan varios cientos de píxeles.
 * El modal deja la lista quieta, da al formulario el ancho que necesita y trae
 * gratis lo que un desplegable no tiene: fondo, inertización de lo de atrás,
 * trampa de foco, `Escape` y devolución del foco a quien lo abrió. Todo eso lo
 * pone `app-content-dialog` sobre el `<dialog>` nativo; acá sólo se agrega qué
 * se pregunta antes de dejar cerrar con cambios sin guardar.
 *
 * La fila, mientras tanto, **se lee con aspecto de formulario**: el rótulo, la
 * marca de obligatoria y el control con el que se va a responder, deshabilitado.
 * Es una muestra de cómo se ve la pregunta, no un lugar donde escribir; para
 * cambiar algo está el botón que abre el modal.
 *
 * ## Las opciones son filas, no un `textarea`
 *
 * Antes se escribían «una por línea» en un área de texto. Eso obliga a saber la
 * convención, no dice cuántas van, no deja quitar la del medio sin seleccionar
 * su renglón entero, y un salto de línea de más creaba una opción vacía que el
 * servidor rechazaba **después** de guardar. Una fila por opción con su botón
 * de quitar no tiene ninguno de esos problemas.
 *
 * ## El borrador no sale del modal hasta Listo
 *
 * Lo tecleado vive en señales locales y no toca la pregunta: cancelar —por el
 * botón, por `Escape` o por el fondo— no emite nada y la fila sigue mostrando
 * lo de antes. Si hay algo escrito, cerrar pregunta primero; confirmar es una
 * decisión ya tomada y cierra sin volver a preguntar.
 *
 * ## Lo que NO hace este componente
 *
 * No habla con la API. Emite `guardar` con lo que cambió y la pantalla decide;
 * así se puede probar sin levantar nada y la pantalla conserva el control de
 * cuándo se pide y qué se hace con el error.
 */
@Component({
  selector: 'app-question-editor',
  imports: [AppButton, Checkbox, ContentDialog, FormField, Input, QuestionTypeIcon, Select],
  templateUrl: './question-editor.html',
  styleUrl: './question-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'editor-pregunta',
    '[class.editor-pregunta--abierta]': 'abierta()',
  },
})
export class QuestionEditor {
  private readonly dialogs = inject(DialogService);

  readonly pregunta = input.required<SurveyQuestion>();

  /** Si el modal de edición de esta pregunta está abierto. Lo decide la pantalla. */
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

  /** El modal, mientras está abierto: cerrar pasa siempre por él. */
  private readonly modal = viewChild(ContentDialog);

  /* -- el borrador local ---------------------------------------------------- */

  protected readonly texto = signal('');
  protected readonly tipo = signal<AnswerType>('TEXT');
  protected readonly obligatoria = signal(false);
  protected readonly opciones = signal<readonly string[]>([]);
  protected readonly minimo = signal(1);
  protected readonly maximo = signal(5);

  protected readonly pideOpciones = computed(() => CON_OPCIONES.has(this.tipo()));
  protected readonly pideEscala = computed(() => this.tipo() === 'SCALE');

  /** La etiqueta del tipo, para la fila en lectura. */
  protected readonly etiquetaDelTipo = computed(() => ETIQUETA_TIPO[this.pregunta().answerType]);

  /** Las opciones **guardadas**, para la muestra de la fila. */
  protected readonly opcionesGuardadas = computed<readonly string[]>(
    () => this.pregunta().options ?? [],
  );

  /** Si la pregunta guardada se responde eligiendo de una lista. */
  protected readonly listaEnLaFila = computed(
    () => CON_OPCIONES.has(this.pregunta().answerType) && this.opcionesGuardadas().length > 0,
  );

  /** Lo que dice el control deshabilitado de la fila cuando no hay lista. */
  protected readonly muestraDeRespuesta = computed(() => muestraDe(this.pregunta()));

  /** El resumen de la fila: opciones o extremos de la escala. */
  protected readonly detalle = computed(() => {
    const p = this.pregunta();
    if (p.answerType === 'SCALE') return `De ${p.scaleMin ?? 1} a ${p.scaleMax ?? 5}`;
    const opciones = p.options ?? [];
    if (opciones.length === 0) return '';
    // Tres y «y N más»: el renglón de resumen tiene que caber en una línea, y
    // una pregunta con doce opciones lo empujaría a tres.
    const visibles = opciones.slice(0, 3).join(' · ');
    const resto = opciones.length - Math.min(3, opciones.length);
    return resto > 0 ? `${visibles} · y ${resto} más` : visibles;
  });

  /** Lo que impide guardar, o `null`. Se muestra en el pie del modal. */
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

  /**
   * Lo que el modal emitiría si se confirmara ahora mismo.
   *
   * Manda **sólo** las claves que el tipo admite: el backend valida con
   * `forbidNonWhitelisted` y una clave que no corresponde vuelve 400. Es el
   * mismo cuidado que ya tenía el alta de pregunta.
   */
  protected readonly cambios = computed<SurveyQuestionEdit>(() => {
    const tipo = this.tipo();
    return {
      questionText: this.texto().trim(),
      answerType: tipo,
      required: this.obligatoria(),
      ...(CON_OPCIONES.has(tipo)
        ? { options: this.opciones().map((o) => o.trim()).filter((o) => o !== '') }
        : {}),
      ...(tipo === 'SCALE' ? { scaleMin: this.minimo(), scaleMax: this.maximo() } : {}),
    };
  });

  /** Si lo tecleado difiere de lo guardado: es lo que se perdería al cerrar. */
  protected readonly conCambios = computed(() =>
    hayCambioGuardable(firmaDeCambios(edicionDe(this.pregunta())), firmaDeCambios(this.cambios())),
  );

  /**
   * Reconoce lo último que se emitió, para no pisar el borrador cuando vuelve.
   *
   * La ficha se recarga tras cada guardado y la pregunta llega como un objeto
   * nuevo. Si lo que llega es lo que este editor mandó, el borrador ya lo
   * tiene, así que no se toca. Ver `@shared/utils/form-draft`.
   */
  private readonly borrador = crearBorradorAislado();

  constructor() {
    // El borrador se rehace cada vez que el modal se abre —o cuando la
    // pregunta cambia por debajo—: así cancelar de verdad descarta, en vez de
    // dejar lo tecleado esperando la próxima apertura.
    effect(() => {
      const p = this.pregunta();
      if (!this.abierta()) return;
      if (this.borrador.esLoPropio(firmaDeCambios(edicionDe(p)))) return;
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

  /* -- abrir, cerrar, confirmar --------------------------------------------- */

  /**
   * Se consulta antes de cerrar sin pasar por «Listo».
   *
   * Sin cambios cierra en silencio; con algo escrito pregunta, porque cerrar
   * ahí tira lo tecleado y `Escape` está a un dedo de distancia. Es el mismo
   * camino para el botón «Cancelar», `Escape`, el fondo y «Cerrar»:
   * `ContentDialog.close()` los une en uno.
   */
  protected readonly guardaDeCierre = (): boolean | Promise<boolean> => {
    if (!this.conCambios()) return true;
    return this.dialogs.confirm({
      title: '¿Descartar los cambios?',
      message: 'Lo que escribiste no se guardó y se va a perder.',
      confirmLabel: 'Descartar',
      destructive: true,
    });
  };

  /** Cancelar: ni emite ni toca la pregunta; el foco vuelve al disparador. */
  protected cancelar(): void {
    const modal = this.modal();
    if (modal === undefined) {
      // Sin modal montado no hay nada que cerrar salvo avisar a la pantalla.
      this.cerrar.emit();
      return;
    }
    modal.close();
  }

  /**
   * Emite lo editado y cierra.
   *
   * Con `force`: confirmar ya es una decisión tomada y preguntar «¿descartás
   * los cambios?» justo después de guardarlos no tiene sentido. La firma
   * emitida queda registrada para que la recarga de la ficha no pise nada.
   */
  protected confirmar(): void {
    if (this.problema() !== null || this.guardando()) return;
    const cambios = this.cambios();
    this.borrador.registrarEmision(firmaDeCambios(cambios));
    this.guardar.emit(cambios);
    this.modal()?.close(true);
  }
}
