import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SurveysClient } from '../../core/data-access/surveys/surveys.client';
import type {
  SurveyStatus,
  SurveySummary,
} from '../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Input as AppInput } from '../../shared/components/atoms/input/input';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { encuestaRoute } from './questionnaires.routes';

/** Largo máximo del título, el mismo que valida el backend. */
const MAX_TITULO = 200;

/** Largo máximo de la consigna, el mismo que valida el backend. */
const MAX_CONSIGNA = 2000;

/** Plazo de respuesta por defecto, en días. Coincide con el del backend. */
const PLAZO_POR_DEFECTO = 30;

/** Cómo se pinta cada estado de la encuesta. */
const PRESENTACION: Readonly<
  Record<SurveyStatus, { readonly palabra: string; readonly tono: BadgeVariant }>
> = {
  DRAFT: { palabra: 'Borrador', tono: 'warning' },
  ACTIVE: { palabra: 'Activa', tono: 'success' },
  INACTIVE: { palabra: 'Desactivada', tono: 'secondary' },
};

/** Una encuesta del profesional, lista para mostrarse. */
interface EncuestaVisible extends SurveySummary {
  readonly palabra: string;
  readonly tono: BadgeVariant;
  readonly ruta: string;
}

/**
 * «Encuestas»: las que el profesional crea para sus pacientes.
 *
 * ## Por qué crear la encuesta no pide las preguntas
 *
 * El alta pide lo mínimo —título, consigna y plazo— y deja el cuestionario para
 * la ficha. Componer preguntas es un trabajo iterativo: se agregan, se releen,
 * se reordenan mentalmente antes de publicar. Meterlo en el mismo formulario
 * que el alta obligaría a tenerlo resuelto de antemano o a descartar el
 * borrador entero si algo no cerraba.
 *
 * Es también lo que hace el backend: `POST /surveys/templates` crea la
 * plantilla **y** su versión 1 en borrador, lista para recibir preguntas.
 */
@Component({
  selector: 'app-surveys-home',
  imports: [
    AppButton,
    AppButtonLink,
    AppInput,
    Badge,
    Card,
    FormField,
    NavIcon,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    Skeleton,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './questionnaires.html',
  styleUrl: './questionnaires.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveysHome {
  private readonly surveys = inject(SurveysClient);
  private readonly toast = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly estado = signal<ViewState<readonly EncuestaVisible[]>>(loading());
  protected readonly vista = this.estado.asReadonly();

  protected readonly creando = signal(false);
  protected readonly formularioAbierto = signal(false);

  protected readonly formulario = new FormGroup({
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_TITULO)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_CONSIGNA)],
    }),
    responseWindowDays: new FormControl(PLAZO_POR_DEFECTO, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(365)],
    }),
  });

  constructor() {
    this.cargar();
  }

  /** Trae las encuestas del profesional de la sesión. */
  protected cargar(): void {
    this.estado.set(loading());
    this.surveys.listSurveys().subscribe({
      next: (encuestas) => {
        if (encuestas.length === 0) {
          this.estado.set(
            empty(
              { label: 'Crear una encuesta' },
              'Todavía no creaste ninguna encuesta. Una encuesta se le ofrece al paciente cuando cerrás una consulta que la tenga asociada.',
            ),
          );
          return;
        }
        this.estado.set(ready(encuestas.map((encuesta) => this.aVisible(encuesta))));
      },
      error: (error: unknown) => this.estado.set(errorToViewState(error)),
    });
  }

  /** Abre o cierra el formulario de alta. */
  protected alternarFormulario(): void {
    this.formularioAbierto.update((abierto) => !abierto);
  }

  /** Crea la encuesta con su versión 1 en borrador. */
  protected crear(): void {
    if (this.formulario.invalid || this.creando()) {
      this.formulario.markAllAsTouched();
      return;
    }

    const { title, description, responseWindowDays } = this.formulario.getRawValue();
    this.creando.set(true);
    this.surveys
      .createSurvey({
        title: title.trim(),
        // Vacío se omite en vez de mandarse como cadena vacía: el backend valida
        // con `forbidNonWhitelisted` y una consigna en blanco no es una consigna.
        ...(description.trim() === '' ? {} : { description: description.trim() }),
        responseWindowDays,
      })
      .subscribe({
        next: () => {
          this.creando.set(false);
          this.formulario.reset({ responseWindowDays: PLAZO_POR_DEFECTO });
          this.formularioAbierto.set(false);
          this.toast.success('Encuesta creada. Agregale preguntas y publicala.');
          this.cargar();
        },
        error: (error: unknown) => {
          this.creando.set(false);
          this.estado.set(errorToViewState(error));
        },
      });
  }

  /** Proyecta el contrato de la API a lo que la plantilla necesita. */
  private aVisible(encuesta: SurveySummary): EncuestaVisible {
    const presentacion = PRESENTACION[encuesta.status];
    return {
      ...encuesta,
      palabra: presentacion.palabra,
      tono: presentacion.tono,
      ruta: encuestaRoute(encuesta.id),
    };
  }
}
