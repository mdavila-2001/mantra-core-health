import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';

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
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../../shared/components/molecules/card/card';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Cuántos campos del esquema se muestran antes de resumir el resto. */
const CAMPOS_EN_EL_VISTAZO = 6;

/** Una especialidad del catálogo, con los formularios que trae. */
export interface GrupoDeEspecialidad {
  /** Concept id de la especialidad; agrupa y ordena. */
  readonly conceptId: string;
  /** Etiqueta en castellano, o el propio id si terminología no la conoce. */
  readonly titulo: string;
  /** Los formularios de esa especialidad, por nombre. */
  readonly formularios: readonly ChartTemplate[];
}

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
 */
@Component({
  selector: 'app-forms-catalog',
  imports: [AppButton, Card, Chip, Link, Skeleton, ViewStateHost],
  templateUrl: './forms-catalog.html',
  styleUrl: './forms-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormsCatalog {
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly toasts = inject(ToastService);

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

  constructor() {
    this.cargar();
  }

  /**
   * El catálogo agrupado: una especialidad, sus formularios adentro.
   *
   * Se ordena por la etiqueta y no por el id porque el id es un uuid y no dice
   * nada; mientras las etiquetas no hayan llegado, el orden es el del id, que
   * al menos es estable y no salta cuando resuelven.
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
    return [...porEspecialidad.entries()]
      .map(([conceptId, formularios]) => ({
        conceptId,
        titulo: etiquetas.get(conceptId)?.display ?? conceptId,
        formularios: [...formularios].sort((a, b) => a.name.localeCompare(b.name, 'es')),
      }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
  });

  /** Cuántos formularios hay en total, para el encabezado. */
  protected readonly total = computed(() =>
    this.grupos().reduce((suma, grupo) => suma + grupo.formularios.length, 0),
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
