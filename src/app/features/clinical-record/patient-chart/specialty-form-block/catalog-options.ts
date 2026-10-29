import { isPlatformBrowser } from '@angular/common';
import { effect, inject, PLATFORM_ID, signal, untracked, type Signal } from '@angular/core';

import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/** Plantillas cuyos campos pueden apuntar a un conjunto de valores (`valueSetId`). */
type TemplatesWithFields = readonly {
  readonly fields: readonly { readonly valueSetId?: string }[];
}[];

/**
 * Las opciones de los campos de catálogo de una ficha: los que traen
 * `valueSetId` y se dibujan como desplegable, no como texto libre.
 *
 * El backend ya publica `valueSetId` en cada campo (`TemplateFieldInputDto`,
 * `ChartTemplateFieldDto`) y ya sirve sus opciones
 * (`GET /terminology/value-sets/:id/$expand`). Lo tecleado a mano no era
 * comparable entre dos respuestas de la misma pregunta («Fumador» contra
 * «fumador» contra «SI»). `valueSetId` manda sobre el `dataType`: conviven,
 * porque pertenecer a un catálogo no es un tipo de dato.
 *
 * Se crea como inicializador de campo de un componente, para tener contexto de
 * inyección.
 */
export class CatalogOptions {
  private readonly terminology = inject(TerminologyClient);
  /** Sin SSR: durante el prerender no hay API a la que preguntar. */
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly optionsByValueSet = signal<ReadonlyMap<string, readonly SelectOption<string>[]>>(
    new Map(),
  );
  private readonly loadingIds = signal<ReadonlySet<string>>(new Set());
  private readonly failedIds = signal<ReadonlySet<string>>(new Set());

  /**
   * `conceptId → display`, para el modo lectura: éste conoce el `conceptId`
   * que se guardó y tiene que resolverlo a lo que una persona lee. Se completa
   * con la misma lectura que llena las opciones, no con una segunda llamada.
   */
  readonly labelByConceptId = signal<ReadonlyMap<string, string>>(new Map());

  /**
   * Pide las opciones de TODOS los campos de catálogo de TODAS las plantillas en
   * cuanto están, no sólo de la elegida: el modo lectura puede mostrar la
   * respuesta de otra plantilla, y pedirlas recién ahí demoraría la etiqueta
   * detrás de un segundo viaje. Una sola petición por `valueSetId`.
   */
  watch(templates: Signal<TemplatesWithFields>): void {
    effect(() => {
      const ids = new Set<string>();
      for (const template of templates()) {
        for (const field of template.fields) {
          if (field.valueSetId !== undefined) ids.add(field.valueSetId);
        }
      }
      untracked(() => ids.forEach((id) => this.ensure(id)));
    });
  }

  /** Las opciones del conjunto, o vacío mientras no llegaron. */
  optionsOf(valueSetId: string): readonly SelectOption<string>[] {
    return this.optionsByValueSet().get(valueSetId) ?? [];
  }

  isLoading(valueSetId: string): boolean {
    return this.loadingIds().has(valueSetId);
  }

  placeholderOf(valueSetId: string): string {
    if (this.failedIds().has(valueSetId)) return 'No pudimos traer las opciones';
    return this.isLoading(valueSetId) ? 'Cargando opciones…' : 'Seleccionar opción';
  }

  private ensure(valueSetId: string): void {
    if (!this.isBrowser || this.optionsByValueSet().has(valueSetId) || this.isLoading(valueSetId)) {
      return;
    }
    this.loadingIds.update((ids) => new Set(ids).add(valueSetId));
    this.terminology.readAllOptions(valueSetId).subscribe({
      next: (options) => {
        const selectable = options.filter((option) => option.selectable !== false);
        this.optionsByValueSet.update((map) =>
          new Map(map).set(
            valueSetId,
            selectable.map((option) => ({ value: option.conceptId, label: option.display })),
          ),
        );
        this.labelByConceptId.update((map) => {
          const next = new Map(map);
          for (const option of options) next.set(option.conceptId, option.display);
          return next;
        });
        this.finish(valueSetId);
      },
      error: () => {
        this.failedIds.update((ids) => new Set(ids).add(valueSetId));
        this.finish(valueSetId);
      },
    });
  }

  private finish(valueSetId: string): void {
    this.loadingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(valueSetId);
      return next;
    });
  }
}
