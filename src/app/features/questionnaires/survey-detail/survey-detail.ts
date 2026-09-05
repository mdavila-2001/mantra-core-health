import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import type {
  AnswerType,
  SurveyDetail,
  SurveyQuestion,
  SurveyResponse,
} from '../../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Los tipos de respuesta, en el orden en que se ofrecen. */
const TIPOS: readonly SelectOption<string>[] = [
  { value: 'TEXT', label: 'Texto libre' },
  { value: 'SCALE', label: 'Escala numérica' },
  { value: 'BOOLEAN', label: 'Sí / No' },
  { value: 'SINGLE_CHOICE', label: 'Elección simple' },
  { value: 'MULTIPLE_CHOICE', label: 'Elección múltiple' },
];

/** Los tipos que exigen un catálogo de opciones. */
const CON_OPCIONES: ReadonlySet<string> = new Set(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']);

/**
 * Piso de respuestas para mostrar un agregado o habilitar el CSV.
 *
 * El README de `surveys` (backend) documenta la decisión **D-13** —cuál es el
 * umbral mínimo de participantes para publicar un agregado— como abierta, y
 * dice literalmente que congela "indicadores agregados y exportación
 * anonimizada" hasta que se resuelva. Con menos respuestas que este número, un
 * gráfico de barras o un CSV equivalen a señalar la respuesta de una persona
 * puntual, que es justo lo que la encuesta promete no hacer.
 *
 * 5 es el piso convencional de control de divulgación estadística (la misma
 * cifra que usa, por ejemplo, el criterio de tamaño de celda mínimo de HIPAA
 * Safe Harbor para reportes públicos de salud) — un valor conservador para no
 * bloquear la función mientras D-13 se resuelve formalmente, no la resolución
 * de D-13 en sí. Cuando el equipo fije el número real, este es el único lugar
 * que hay que tocar.
 */
const UMBRAL_MINIMO_RESPUESTAS = 5;

/** Una barra del gráfico de una pregunta: cuántos eligieron esta opción, y qué porcentaje del total es. */
interface BarraDeResumen {
  readonly etiqueta: string;
  readonly cantidad: number;
  /** 0 a 100, sobre quienes respondieron *esta* pregunta (no sobre toda la encuesta). */
  readonly porcentaje: number;
}

/**
 * El resumen de una pregunta: sus barras (vacío en texto libre, donde un
 * gráfico no dice nada) y, para escala, el promedio.
 */
interface ResumenDePregunta {
  readonly questionId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly totalRespondida: number;
  readonly promedio: number | null;
  readonly barras: readonly BarraDeResumen[];
}

/** Etiqueta legible de cada tipo, para la lista de preguntas ya cargadas. */
const ETIQUETA_TIPO: Readonly<Record<AnswerType, string>> = {
  TEXT: 'Texto libre',
  SCALE: 'Escala',
  BOOLEAN: 'Sí / No',
  SINGLE_CHOICE: 'Elección simple',
  MULTIPLE_CHOICE: 'Elección múltiple',
};

/**
 * La ficha de una encuesta: componer el cuestionario, publicarlo, asociarlo y
 * leer lo que respondieron.
 *
 * ## Por qué todo vive en una pantalla
 *
 * Son cuatro tareas distintas, pero encadenadas y sobre el mismo objeto:
 * agregar preguntas → publicar → asociar a un servicio → leer respuestas. Cada
 * paso solo tiene sentido si el anterior se hizo, y la pantalla lo refleja
 * habilitando lo que corresponde en vez de ofrecer cuatro rutas donde tres
 * darían error.
 *
 * ## Publicar es irreversible y la pantalla lo dice
 *
 * Una versión publicada ya no acepta preguntas. No es una limitación técnica:
 * es lo que hace que una respuesta dada hace meses se pueda seguir
 * interpretando. El aviso está antes del botón, no después del error.
 */
@Component({
  selector: 'app-survey-detail',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Badge,
    Card,
    Checkbox,
    DatePipe,
    DecimalPipe,
    FormField,
    PageHeader,
    PaginatedForm,
    ReactiveFormsModule,
    Select,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './survey-detail.html',
  styleUrl: './survey-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyDetailScreen {
  private readonly surveys = inject(SurveysClient);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tipos = TIPOS;
  protected readonly etiquetaTipo = ETIQUETA_TIPO;

  /** Etiqueta legible de un tipo de respuesta. */
  protected etiquetaDe(tipo: AnswerType): string {
    return ETIQUETA_TIPO[tipo];
  }

  private readonly surveyId = this.route.snapshot.paramMap.get('surveyId') ?? '';

  private readonly estado = signal<ViewState<SurveyDetail>>(loading());
  protected readonly vista = this.estado.asReadonly();

  /** Los datos cuando los hay. La unión de estados no se indexa desde la plantilla. */
  protected readonly encuesta = computed(() => dataOf(this.estado()));

  protected readonly respuestas = signal<readonly SurveyResponse[]>([]);
  protected readonly cargandoRespuestas = signal(false);

  /** Si ya hay respuestas suficientes para un agregado o un CSV sin poner en riesgo el anonimato (D-13). */
  protected readonly suficientesRespuestas = computed(
    () => this.respuestas().length >= UMBRAL_MINIMO_RESPUESTAS,
  );

  /**
   * El dashboard que pide FT-29: un gráfico de barras por pregunta.
   *
   * Se arma en el cliente a partir de `respuestas()`, ya cargadas para la
   * lista de abajo — no hace falta un endpoint de agregación nuevo. Vacío
   * mientras no haya respuestas suficientes: ver {@link UMBRAL_MINIMO_RESPUESTAS}.
   */
  protected readonly resumenPorPregunta = computed<readonly ResumenDePregunta[]>(() => {
    const encuesta = this.encuesta();
    if (!encuesta || !this.suficientesRespuestas()) return [];
    return encuesta.questions.map((pregunta) => resumirPregunta(pregunta, this.respuestas()));
  });

  protected readonly guardandoPregunta = signal(false);
  protected readonly publicando = signal(false);
  protected readonly asignando = signal(false);
  protected readonly creandoVersion = signal(false);

  /** Si la versión vigente todavía admite preguntas. */
  protected readonly editable = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' && !actual.data.published;
  });

  /** Si ya hay algo publicado que se pueda asociar a un servicio. */
  protected readonly publicada = computed(() => {
    const actual = this.estado();
    return actual.status === 'ready' && actual.data.published;
  });

  protected readonly formularioPregunta = new FormGroup({
    questionText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    answerType: new FormControl<AnswerType>('TEXT', { nonNullable: true }),
    required: new FormControl(false, { nonNullable: true }),
    /** Una opción por línea. Se parte al enviar. */
    options: new FormControl('', { nonNullable: true }),
    scaleMin: new FormControl(1, { nonNullable: true }),
    scaleMax: new FormControl(5, { nonNullable: true }),
  });

  protected readonly formularioAsignacion = new FormGroup({
    targetId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  /** Si el tipo elegido pide opciones, para mostrar el campo. */
  protected readonly pideOpciones = signal(false);

  /** Si el tipo elegido es una escala, para mostrar mínimo y máximo. */
  protected readonly pideEscala = signal(false);

  /**
   * Las páginas del alta de pregunta, **según el tipo elegido**.
   *
   * Las opciones sólo las pide una elección; el mínimo y el máximo, sólo una
   * escala. Mostrarlos siempre sería pedir datos que no se van a guardar, y
   * mostrarlos deshabilitados sería lo mismo con más ruido.
   */
  protected readonly paginasDePregunta = computed(() =>
    paginarCampos([
      {
        titulo: 'La pregunta',
        campos: [
          {
            key: 'questionText',
            label: 'Pregunta',
            hint: 'Cómo la va a leer el paciente.',
            control: 'text' as const,
            required: true,
            testId: 'pregunta-texto',
            mensajeDeError: 'Escribí la pregunta (hasta 500 caracteres).',
          },
          {
            key: 'answerType',
            label: 'Tipo de respuesta',
            control: 'select' as const,
            required: true,
            options: TIPOS,
          },
          ...(this.pideOpciones()
            ? [
                {
                  key: 'options',
                  label: 'Opciones',
                  hint: 'Una por línea. Hacen falta al menos dos.',
                  control: 'textarea' as const,
                  required: true,
                  testId: 'pregunta-opciones',
                },
              ]
            : []),
          ...(this.pideEscala()
            ? [
                { key: 'scaleMin', label: 'Mínimo', control: 'number' as const, required: true },
                { key: 'scaleMax', label: 'Máximo', control: 'number' as const, required: true },
              ]
            : []),
          { key: 'required', label: 'Obligatoria', control: 'checkbox' as const },
        ],
      },
    ]),
  );

  constructor() {
    this.cargar();
    this.formularioPregunta.controls.answerType.valueChanges.subscribe((tipo) => {
      this.pideOpciones.set(CON_OPCIONES.has(tipo));
      this.pideEscala.set(tipo === 'SCALE');
    });
  }

  /** Trae la encuesta con su cuestionario. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.getSurvey(this.surveyId).subscribe({
      next: (encuesta) => {
        this.estado.set(ready(encuesta));
        if (encuesta.published) this.cargarRespuestas();
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /** Trae las respuestas recibidas. */
  protected cargarRespuestas(): void {
    this.cargandoRespuestas.set(true);
    this.surveys.listResponses(this.surveyId).subscribe({
      next: (recibidas) => {
        this.respuestas.set(recibidas);
        this.cargandoRespuestas.set(false);
      },
      error: () => {
        // Un fallo acá no debe tapar la ficha: el cuestionario sigue siendo
        // legible y editable aunque las respuestas no hayan llegado.
        this.cargandoRespuestas.set(false);
      },
    });
  }

  /** Agrega la pregunta a la versión en borrador. */
  protected agregarPregunta(): void {
    if (this.formularioPregunta.invalid || this.guardandoPregunta()) {
      this.formularioPregunta.markAllAsTouched();
      return;
    }

    const valores = this.formularioPregunta.getRawValue();
    const opciones = valores.options
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== '');

    if (CON_OPCIONES.has(valores.answerType) && opciones.length < 2) {
      this.toast.error('Una pregunta de elección necesita al menos dos opciones.');
      return;
    }

    this.guardandoPregunta.set(true);
    this.surveys
      .addQuestion(this.surveyId, {
        questionText: valores.questionText.trim(),
        answerType: valores.answerType,
        required: valores.required,
        // Cada clave se omite si no corresponde al tipo: el backend valida con
        // `forbidNonWhitelisted` y una clave declarada en `undefined` vuelve 400.
        ...(CON_OPCIONES.has(valores.answerType) ? { options: opciones } : {}),
        ...(valores.answerType === 'SCALE'
          ? { scaleMin: valores.scaleMin, scaleMax: valores.scaleMax }
          : {}),
      })
      .subscribe({
        next: () => {
          this.guardandoPregunta.set(false);
          this.formularioPregunta.reset({
            answerType: 'TEXT',
            required: false,
            options: '',
            scaleMin: 1,
            scaleMax: 5,
          });
          this.pideOpciones.set(false);
          this.pideEscala.set(false);
          this.toast.success('Pregunta agregada.');
          this.cargar();
        },
        error: (error: unknown) => {
          this.guardandoPregunta.set(false);
          this.estado.set(errorToViewState(error));
        },
      });
  }

  /** Publica la versión vigente y le da vigencia abierta. */
  protected publicar(): void {
    const actual = this.estado();
    if (actual.status !== 'ready' || this.publicando()) return;

    this.publicando.set(true);
    this.surveys.publishSurvey(this.surveyId, actual.data.latestVersionNumber).subscribe({
      next: () => {
        this.publicando.set(false);
        this.toast.success('Encuesta publicada: ya se puede asociar a un servicio.');
        this.cargar();
      },
      error: (error: unknown) => {
        this.publicando.set(false);
        this.estado.set(errorToViewState(error));
      },
    });
  }

  /** Asocia la versión publicada a un servicio de salud. */
  protected asignar(): void {
    const actual = this.estado();
    if (actual.status !== 'ready' || this.formularioAsignacion.invalid || this.asignando()) {
      this.formularioAsignacion.markAllAsTouched();
      return;
    }

    this.asignando.set(true);
    this.surveys
      .assignSurvey({
        surveyVersionId: actual.data.latestVersionId,
        targetType: 'SERVICE',
        targetId: this.formularioAsignacion.getRawValue().targetId.trim(),
      })
      .subscribe({
        next: () => {
          this.asignando.set(false);
          this.formularioAsignacion.reset();
          this.toast.success(
            'Encuesta asociada. Se le ofrecerá al paciente al cerrar una consulta de ese servicio.',
          );
        },
        error: (error: unknown) => {
          this.asignando.set(false);
          this.estado.set(errorToViewState(error));
        },
      });
  }

  /**
   * Abre una versión nueva en borrador, para corregir el cuestionario de una
   * encuesta ya publicada (FT-31). La versión vieja sigue vigente para lo ya
   * asociado hasta que ésta se publique y alguien la reasocie.
   */
  protected crearNuevaVersion(): void {
    if (this.creandoVersion()) return;
    this.creandoVersion.set(true);
    this.surveys.createNextVersion(this.surveyId).subscribe({
      next: () => {
        this.creandoVersion.set(false);
        this.toast.success('Versión nueva creada. Agregale preguntas y publicala.');
        this.cargar();
      },
      error: (error: unknown) => {
        this.creandoVersion.set(false);
        this.estado.set(errorToViewState(error));
      },
    });
  }

  /** Desactiva la encuesta: corta las emisiones nuevas. */
  protected desactivar(): void {
    this.surveys.deactivateSurvey(this.surveyId).subscribe({
      next: () => {
        this.toast.success('Encuesta desactivada. Lo ya respondido sigue disponible.');
        this.cargar();
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /** Texto legible de una respuesta, sea del tipo que sea. */
  protected valorDe(answer: SurveyResponse['answers'][number]): string {
    if (answer.valueText !== undefined) return answer.valueText;
    if (answer.valueNumber !== undefined) return String(answer.valueNumber);
    if (answer.valueBoolean !== undefined) return answer.valueBoolean ? 'Sí' : 'No';
    if (answer.valueChoices !== undefined) return answer.valueChoices.join(', ');
    return '—';
  }

  /**
   * Descarga las respuestas en CSV: una fila por respuesta, una columna por
   * pregunta. Se arma en el cliente porque los mismos datos ya están acá
   * (`respuestas()`) — no hace falta ida y vuelta al servidor.
   *
   * **Anónimo a propósito** (FT-29): ninguna columna identifica al paciente,
   * porque el contrato del servidor tampoco lo manda.
   */
  protected descargarCsv(): void {
    const encuesta = this.encuesta();
    // Defensa en profundidad: el botón ya está oculto por debajo del umbral,
    // pero esta función no debería exportar un CSV identificable ni aunque
    // alguien la invoque de otra forma.
    if (!encuesta || !this.suficientesRespuestas()) return;

    const encabezado = ['Fecha de envío', ...encuesta.questions.map((p) => p.questionText)];
    const filas = this.respuestas().map((respuesta) => {
      const porPregunta = new Map(respuesta.answers.map((a) => [a.questionId, this.valorDe(a)]));
      return [
        respuesta.submittedAt ? respuesta.submittedAt.toISOString() : '',
        ...encuesta.questions.map((p) => porPregunta.get(p.id) ?? ''),
      ];
    });

    const csv = [encabezado, ...filas]
      .map((fila) => fila.map(celdaCsv).join(','))
      .join('\r\n');
    // BOM al frente: sin él, Excel en Windows adivina Latin-1 y descompone
    // toda tilde y «ñ» de las preguntas y respuestas.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `${slugify(encuesta.title)}-respuestas.csv`;
    enlace.click();
    URL.revokeObjectURL(url);
  }
}

/** Arma el resumen (barras + promedio) de una pregunta a partir de las respuestas recibidas. */
export function resumirPregunta(
  pregunta: SurveyQuestion,
  respuestas: readonly SurveyResponse[],
): ResumenDePregunta {
  const respondidas = respuestas
    .map((r) => r.answers.find((a) => a.questionId === pregunta.id))
    .filter((a): a is SurveyResponse['answers'][number] => a !== undefined);
  const total = respondidas.length;

  const conBarras = (etiquetas: readonly string[], cantidadDe: (etiqueta: string) => number) =>
    etiquetas.map((etiqueta) => {
      const cantidad = cantidadDe(etiqueta);
      return { etiqueta, cantidad, porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 100) };
    });

  let barras: readonly BarraDeResumen[] = [];
  let promedio: number | null = null;

  switch (pregunta.answerType) {
    case 'BOOLEAN':
      barras = conBarras(
        ['Sí', 'No'],
        (etiqueta) => respondidas.filter((a) => a.valueBoolean === (etiqueta === 'Sí')).length,
      );
      break;
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      barras = conBarras(
        pregunta.options ?? [],
        (opcion) => respondidas.filter((a) => a.valueChoices?.includes(opcion)).length,
      );
      break;
    case 'SCALE': {
      const min = pregunta.scaleMin ?? 1;
      const max = pregunta.scaleMax ?? 5;
      const valores = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
      barras = conBarras(
        valores.map(String),
        (etiqueta) => respondidas.filter((a) => a.valueNumber === Number(etiqueta)).length,
      );
      const numeros = respondidas
        .map((a) => a.valueNumber)
        .filter((n): n is number => n !== undefined);
      promedio = numeros.length === 0 ? null : numeros.reduce((a, b) => a + b, 0) / numeros.length;
      break;
    }
    case 'TEXT':
      // Texto libre no se resume en barras: cada respuesta es distinta y
      // agruparlas no diría nada. La lista de respuestas de abajo ya las
      // muestra completas.
      break;
  }

  return {
    questionId: pregunta.id,
    questionText: pregunta.questionText,
    answerType: pregunta.answerType,
    totalRespondida: total,
    promedio,
    barras,
  };
}

/** Encierra en comillas sólo si hace falta, duplicando las internas (RFC 4180). */
export function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Nombre de archivo seguro a partir del título de la encuesta. */
export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'encuesta'
  );
}
