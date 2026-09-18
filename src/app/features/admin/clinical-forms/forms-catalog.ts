import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { ChartTemplatesClient } from '../../../core/data-access/chart-templates/chart-templates.client';
import type { ChartTemplate } from '../../../core/data-access/chart-templates/chart-templates.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Link } from '../../../shared/components/atoms/link/link';
import { Card } from '../../../shared/components/molecules/card/card';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { SEARCH_PARAM } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { SpecialtyBrowser } from '../../../shared/components/organisms/specialty-browser/specialty-browser';
import type { SpecialtyGroup } from '../../../shared/components/organisms/specialty-browser/specialty-browser.types';

/** Cuántos campos del esquema se muestran antes de resumir el resto. */
const CAMPOS_EN_EL_VISTAZO = 6;

/** Una especialidad del catálogo, con los formularios que trae. */
type GrupoDeEspecialidad = SpecialtyGroup<ChartTemplate>;

/** El título de un grupo cuya especialidad no tiene nombre en terminología. */
const SIN_NOMBRE_DE_ESPECIALIDAD = 'Especialidad sin nombre en el catálogo';

/**
 * El catálogo navegable de formularios clínicos estándar — carril R2-5, punto 5
 * del reclamo.
 *
 * ## Qué resuelve, y qué no
 *
 * El punto 5 rebotó porque la ronda anterior entregó el **motor** (armá tu
 * plantilla campo por campo) cuando lo que se pidió fue **contenido**: los
 * formularios estándar por especialidad, ya cargados y catalogados. El motor
 * está bien hecho y sigue entero — la pantalla de armado no se tocó. Esto es la
 * vitrina de lo que ahora hay adentro: agrupado por especialidad, con el origen
 * de cada formulario a la vista y un vistazo de su esquema.
 *
 * ## Las dos acciones son el motor de Carril 2, ahora con algo que duplicar
 *
 * - **Usar tal cual** asigna la plantilla (`POST /charts/templates/:id/assignments`,
 *   UC-15-12), que es el endpoint que existía desde antes de este carril y que
 *   hasta hoy no tenía ninguna plantilla que asignar.
 * - **Duplicar para adaptar** no llama a nada: emite el formulario hacia arriba
 *   y la pantalla de armado se precarga con sus campos. Adaptar y guardar es el
 *   alta de siempre. Duplicar del lado del servidor sería un endpoint nuevo para
 *   algo que el motor ya sabe hacer.
 *
 * ## Por qué pide el listado por su cuenta
 *
 * `ClinicalForms` lista **filtrado** por la especialidad que el admin eligió
 * arriba; el catálogo tiene que mostrarlas todas para poder agrupar. Son dos
 * lecturas con distinto propósito sobre el mismo endpoint, no una duplicada.
 *
 * ## Buscar es acotar lo que ya tiene, no volver a pedir
 *
 * La anatomía —buscador arriba, grilla agrupada abajo— la pone
 * `app-specialty-browser`, y el catálogo aporta sus grupos y la tarjeta. El
 * término se lee de la URL, que es donde la barra de filtros guarda su estado:
 * así un enlace compartido con `?q=` abre el catálogo ya acotado, y el botón
 * «atrás» del navegador deshace la búsqueda. El filtrado es **en memoria**
 * sobre las plantillas que ya llegaron: pedirlas de nuevo por cada letra sería
 * una lectura por tecla para acotar algo que ya está en la pantalla.
 */
@Component({
  selector: 'app-forms-catalog',
  imports: [AppButton, Card, Chip, Link, SpecialtyBrowser],
  templateUrl: './forms-catalog.html',
  styleUrl: './forms-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class FormsCatalog {
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * El admin quiere partir de este formulario y adaptarlo. Lo emite en vez de
   * duplicarlo acá: quien sabe precargar el editor es la pantalla que lo
   * contiene.
   */
  readonly duplicar = output<ChartTemplate>();

  protected readonly catalogo = signal<ViewState<readonly ChartTemplate[]>>(loading());

  /** Etiquetas de especialidad, por concept id. Vacío hasta que resuelvan. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** Qué plantilla se está asignando ahora mismo, para deshabilitar su botón. */
  protected readonly asignando = signal<string | null>(null);

  protected readonly camposEnElVistazo = CAMPOS_EN_EL_VISTAZO;

  /** Lo que la barra de filtros dejó en la URL. Ella es la fuente de verdad. */
  private readonly params = toSignal(
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)),
    { initialValue: {} as Record<string, string> },
  );

  /** El término tecleado, ya comparable. Vacío ⇒ el catálogo entero. */
  private readonly busqueda = computed(() => normalizar(this.params()[SEARCH_PARAM] ?? ''));
  /** Con una búsqueda puesta, los grupos que quedaron se muestran abiertos. */
  protected readonly hayBusqueda = computed(() => this.busqueda() !== '');

  constructor() {
    this.cargar();
  }

  /**
   * El catálogo agrupado: una especialidad, sus formularios adentro.
   *
   * Se ordena por la etiqueta y no por el id porque el id es un uuid y no dice
   * nada; mientras las etiquetas no hayan llegado, el orden es el del id, que
   * al menos es estable y no salta cuando resuelven.
   *
   * Una especialidad que se queda sin formularios tras la búsqueda **no deja
   * su encabezado suelto**: se cae entera, porque un rótulo sobre una grilla
   * vacía se lee como un error de carga.
   */
  protected readonly grupos = computed<readonly GrupoDeEspecialidad[]>(() => {
    const state = this.catalogo();
    if (state.status !== 'ready') return [];

    const porEspecialidad = new Map<string, ChartTemplate[]>();
    for (const plantilla of state.data) {
      const grupo = porEspecialidad.get(plantilla.specialtyConceptId);
      if (grupo) {
        grupo.push(plantilla);
      } else {
        porEspecialidad.set(plantilla.specialtyConceptId, [plantilla]);
      }
    }

    const etiquetas = this.etiquetas();
    const busqueda = this.busqueda();
    return [...porEspecialidad.entries()]
      .map(([conceptId, formularios]) => {
        // Nunca el uuid: si terminología no trae el nombre, se dice que falta.
        // El identificador llegaba como título de grupo (barrido del refactor UX).
        const label = etiquetas.get(conceptId)?.display ?? SIN_NOMBRE_DE_ESPECIALIDAD;
        return {
          conceptId,
          label,
          items: formularios
            .filter((plantilla) => coincide(plantilla, label, busqueda))
            .sort((a, b) => a.name.localeCompare(b.name, 'es')),
        };
      })
      .filter((grupo) => grupo.items.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  /** Cuántos formularios hay en total, para el encabezado. */
  protected readonly total = computed(() =>
    this.grupos().reduce((suma, grupo) => suma + grupo.items.length, 0),
  );

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.catalogo.set(loading());
    this.chartTemplates.listTemplates().subscribe({
      next: (lista) => {
        this.catalogo.set(ready(lista));
        this.resolverEtiquetas(lista);
      },
      error: (error: unknown) =>
        this.catalogo.set(errorToViewState<readonly ChartTemplate[]>(error)),
    });
  }

  /**
   * Traduce los concept id de especialidad a su nombre en castellano.
   *
   * Un fallo acá no rompe el catálogo: se queda con el id como título, que es
   * feo pero legible, en vez de dejar la pantalla en error por una lectura de
   * metadatos.
   */
  private resolverEtiquetas(plantillas: readonly ChartTemplate[]): void {
    const ids = plantillas.map((plantilla) => plantilla.specialtyConceptId);
    if (ids.length === 0) return;
    this.terminology.readConceptLabels(ids).subscribe({
      next: (labels) => this.etiquetas.set(labels),
      error: () => this.etiquetas.set(new Map()),
    });
  }

  /** Los primeros campos del esquema, para el vistazo. */
  protected vistazo(plantilla: ChartTemplate): readonly string[] {
    return plantilla.fields.slice(0, CAMPOS_EN_EL_VISTAZO).map((campo) => campo.name);
  }

  /** Cuántos campos quedan fuera del vistazo. */
  protected restantes(plantilla: ChartTemplate): number {
    return Math.max(0, plantilla.fields.length - CAMPOS_EN_EL_VISTAZO);
  }

  /** Usar la plantilla tal cual: la asigna como predeterminada. */
  protected usar(plantilla: ChartTemplate): void {
    this.asignando.set(plantilla.id);
    this.chartTemplates.assignTemplate(plantilla.id, { isDefault: true }).subscribe({
      next: () => {
        this.asignando.set(null);
        this.toasts.success(
          `«${plantilla.name}» queda disponible para completar en el encuentro.`,
          'Plantilla en uso',
        );
      },
      error: (error: unknown) => {
        this.asignando.set(null);
        this.toasts.error(mensajeDeError(error), 'No se pudo usar la plantilla');
      },
    });
  }

  /** Duplicar para adaptar: lo resuelve la pantalla de armado. */
  protected adaptar(plantilla: ChartTemplate): void {
    this.duplicar.emit(plantilla);
    this.toasts.info(
      'Cargamos sus campos arriba, en «Nueva plantilla». Cambiá lo que quieras y guardá.',
      `«${plantilla.name}» lista para adaptar`,
    );
  }
}

/**
 * Texto comparable: sin mayúsculas ni tildes.
 *
 * Sin esto, «cardiologia» no encuentra «Cardiología» y media especialidad queda
 * inalcanzable para quien no pone el acento —que es casi todo el mundo—.
 */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Si la plantilla casa con lo que se buscó.
 *
 * Se mira el nombre, el código y el rótulo de la especialidad: los tres están
 * **a la vista** en la pantalla. Buscar sobre un dato que no se ve devuelve
 * resultados que parecen no tener nada que ver con lo que se escribió.
 */
function coincide(plantilla: ChartTemplate, especialidad: string, busqueda: string): boolean {
  if (!busqueda) {
    return true;
  }
  return (
    normalizar(plantilla.name).includes(busqueda) ||
    normalizar(plantilla.code).includes(busqueda) ||
    normalizar(especialidad).includes(busqueda)
  );
}

/** Traduce el fallo de la asignación a una frase, sin exponer el objeto crudo. */
function mensajeDeError(error: unknown): string {
  const state = errorToViewState<null>(error);
  if (state.status === 'forbidden') {
    return state.message ?? 'Tu rol no permite asignar plantillas.';
  }
  if (state.status === 'offline') {
    return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
  }
  if (state.status === 'validation') {
    return state.issues.map((issue) => issue.message).join(' ') || 'La asignación fue rechazada.';
  }
  if (state.status === 'error') {
    return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
  }
  return 'Ocurrió un error inesperado.';
}
