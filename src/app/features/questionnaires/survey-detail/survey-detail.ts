import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';

import { SurveysClient } from '../../../core/data-access/surveys/surveys.client';
import type {
  AnswerType,
  SurveyDetail,
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

  protected readonly guardandoPregunta = signal(false);
  protected readonly publicando = signal(false);
  protected readonly asignando = signal(false);

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
}
