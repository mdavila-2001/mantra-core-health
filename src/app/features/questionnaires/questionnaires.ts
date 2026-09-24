import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { SurveysClient } from '../../core/data-access/surveys/surveys.client';
import type {
  SurveyStatus,
  SurveySummary,
} from '../../core/data-access/surveys/surveys.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
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
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
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

/** Los diacríticos que deja sueltos `normalize('NFD')`. */
const DIACRITICOS = /[̀-ͯ]/g;

/** Cómo se pinta cada estado de la encuesta. */
const PRESENTACION: Readonly<
  Record<SurveyStatus, { readonly palabra: string; readonly tono: BadgeVariant }>
> = {
  DRAFT: { palabra: 'Borrador', tono: 'warning' },
  ACTIVE: { palabra: 'Activa', tono: 'success' },
  INACTIVE: { palabra: 'Desactivada', tono: 'secondary' },
};

/**
 * Qué grupo de estados se está mirando. `TODAS` no es un `SurveyStatus`: es la
 * ausencia de filtro, y tenerlo en la misma unión evita un `null` que después
 * hay que comprobar en cada lado.
 */
export type FiltroEstado = 'TODAS' | SurveyStatus;

/** El orden en que se ofrecen los grupos, de lo más general a lo más acotado. */
const GRUPOS: readonly FiltroEstado[] = ['TODAS', 'DRAFT', 'ACTIVE', 'INACTIVE'];

/** El rótulo de cada grupo, sin el recuento —que se calcula al vuelo—. */
const ROTULO_GRUPO: Readonly<Record<FiltroEstado, string>> = {
  TODAS: 'Todas',
  DRAFT: 'Borradores',
  ACTIVE: 'Activas',
  INACTIVE: 'Desactivadas',
};

/**
 * Texto comparable: sin mayúsculas, sin acentos y sin espacios de más.
 *
 * Buscar «satisfaccion» tiene que encontrar «Satisfacción»: quien escribe en el
 * buscador de un listado no está transcribiendo el título, está recordándolo.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Una encuesta del profesional, lista para mostrarse. */
interface EncuestaVisible extends SurveySummary {
  readonly palabra: string;
  readonly tono: BadgeVariant;
  readonly ruta: string;
  /** Título y consigna ya normalizados: se calcula una vez, no por tecla. */
  readonly buscable: string;
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
 *
 * ## Por qué el buscador y el filtro son de cliente
 *
 * `GET /surveys/templates` devuelve **todas** las encuestas del profesional en
 * una sola respuesta: no hay `?q=` ni `?status=` en el contrato. Filtrar contra
 * lo ya cargado no es una simplificación, es lo único honesto — pedirle al
 * servidor un parámetro que no declara devolvería la lista entera y la pantalla
 * afirmaría haber filtrado.
 *
 * ## Tres vacíos que no son el mismo (M34)
 *
 * - **S2** mientras la lista viaja: esqueleto con la forma de las filas.
 * - **S3** cuando el profesional todavía no creó ninguna encuesta: hay una
 *   próxima acción, que es crearla.
 * - **«Sin resultados»** cuando hay encuestas y el filtro no encontró ninguna:
 *   no es un vacío del dominio sino de la consulta, la salida es aflojar el
 *   filtro y **los controles tienen que seguir a la vista**. Colapsarlo en S3
 *   le diría a alguien que tiene doce encuestas que no tiene ninguna.
 */
@Component({
  selector: 'app-surveys-home',
  imports: [
    AppButton,
    AppButtonLink,
    AppInput,
    Badge,
    Card,
    EmptyState,
    FormField,
    NavIcon,
    PageHeader,
    ReactiveFormsModule,
    RouterLink,
    SearchField,
    SegmentedControl,
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

  /** Lo tipeado en el buscador, tal cual. La normalización va en la comparación. */
  protected readonly busqueda = signal('');

  /** El grupo de estados elegido. */
  protected readonly filtroEstado = signal<FiltroEstado>('TODAS');

  /** Lo que trajo la API, o nada si el estado no transporta datos. */
  protected readonly cargadas = computed<readonly EncuestaVisible[]>(
    () => dataOf(this.vista()) ?? [],
  );

  /** Cuántas encuestas hay en cada grupo. Es lo que se pinta en cada opción. */
  protected readonly recuentos = computed<Readonly<Record<FiltroEstado, number>>>(() => {
    const todas = this.cargadas();
    return {
      TODAS: todas.length,
      DRAFT: todas.filter((encuesta) => encuesta.status === 'DRAFT').length,
      ACTIVE: todas.filter((encuesta) => encuesta.status === 'ACTIVE').length,
      INACTIVE: todas.filter((encuesta) => encuesta.status === 'INACTIVE').length,
    };
  });

  /**
   * Las opciones del filtro, con el recuento en el rótulo.
   *
   * El recuento va **dentro** del control y no en un texto aparte porque es la
   * información que hace elegible la opción: «Borradores (0)» dice de antemano
   * que tocarla no va a mostrar nada.
   */
  protected readonly opcionesEstado = computed<readonly SegmentedOption<FiltroEstado>[]>(() => {
    const recuentos = this.recuentos();
    return GRUPOS.map((grupo) => ({
      value: grupo,
      label: `${ROTULO_GRUPO[grupo]} (${recuentos[grupo]})`,
      description: `${ROTULO_GRUPO[grupo]}: ${recuentos[grupo]}`,
    }));
  });

  /** Lo que sobrevive al buscador y al filtro. */
  protected readonly visibles = computed<readonly EncuestaVisible[]>(() => {
    const termino = normalizar(this.busqueda());
    const grupo = this.filtroEstado();
    return this.cargadas().filter(
      (encuesta) =>
        (grupo === 'TODAS' || encuesta.status === grupo) &&
        (termino === '' || encuesta.buscable.includes(termino)),
    );
  });

  /** Hay algún criterio puesto; sin ninguno, «sin resultados» sería imposible. */
  protected readonly hayFiltro = computed(
    () => normalizar(this.busqueda()) !== '' || this.filtroEstado() !== 'TODAS',
  );

  /**
   * La explicación del S3, ya desenvuelta del estado.
   *
   * Se calcula acá y no en la plantilla porque el vacío se proyecta al
   * anfitrión **sin** un bloque de control alrededor —un `@if` envolviendo un
   * nodo proyectado lo manda al slot por defecto—, así que la plantilla no
   * tiene dónde estrechar el tipo.
   */
  protected readonly mensajeVacio = computed(() => {
    const estado = this.vista();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  /** Hay encuestas, pero ninguna pasa el filtro. NO es el vacío del dominio. */
  protected readonly sinResultados = computed(
    () => this.cargadas().length > 0 && this.visibles().length === 0,
  );

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

  /** Elige el grupo de estados que se está mirando. */
  protected elegirEstado(grupo: FiltroEstado): void {
    this.filtroEstado.set(grupo);
  }

  /** Devuelve el listado a «todas, sin texto»: la salida del «sin resultados». */
  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.filtroEstado.set('TODAS');
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
          // Si el filtro quedara puesto, la encuesta recién creada —siempre un
          // borrador— podría no entrar en el grupo visible y el alta parecería
          // no haber hecho nada.
          this.limpiarFiltros();
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
      buscable: normalizar(`${encuesta.title} ${encuesta.description ?? ''}`),
    };
  }
}
