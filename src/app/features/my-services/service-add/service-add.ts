import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { forkJoin, map } from 'rxjs';

import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ServiceCatalogItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { readApiError } from '../../../core/http/api-error';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { similarServices, significantWords } from './service-similarity';

/** Lo que admite la API para el precio: positivo, hasta dos decimales. */
const AMOUNT = /^\d+(\.\d{1,2})?$/;
/** Cuántos servicios del catálogo se leen para comparar. */
const CANDIDATES_LIMIT = 100;

type Step = 'form' | 'similar';

/**
 * «Agregar servicio adicional» (carril 23): un servicio propio, distinto de
 * los que trae la práctica.
 *
 * Antes de crear se compara el nombre con el catálogo de la práctica
 * (`service-similarity.ts`, determinista). Si hay parecidos se pregunta
 * «¿Quizás quiso decir…?»: elegir uno no crea nada; «Es un servicio
 * distinto» sigue con el alta. No se bloquea un servicio realmente distinto.
 *
 * El código interno se arma solo a partir del nombre: quien atiende no tiene
 * por qué inventar códigos, y la API exige uno único por práctica.
 */
@Component({
  selector: 'app-service-add',
  imports: [Alert, AppButton, ContentDialog, FormField, Input],
  templateUrl: './service-add.html',
  styleUrl: './service-add.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceAdd {
  private readonly catalog = inject(ServicesCatalogClient);

  readonly practiceId = input.required<string>();

  /** El servicio recién creado, para que la lista lo muestre sin recargar. */
  readonly created = output<ServiceCatalogItem>();
  /** Eligió uno que ya existía: la lista lo busca. */
  readonly chosen = output<ServiceCatalogItem>();
  readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly price = signal('');
  protected readonly step = signal<Step>('form');
  protected readonly suggestions = signal<
    readonly { readonly service: ServiceCatalogItem; readonly score: number }[]
  >([]);
  protected readonly working = signal(false);
  protected readonly error = signal<string | null>(null);

  protected text(value: string | number | null): string {
    return value === null ? '' : String(value);
  }

  /** Valida, busca parecidos y, si no hay, crea. */
  protected continueToCreate(): void {
    const name = this.name().trim();
    const price = this.price().trim();
    if (significantWords(name).length === 0) {
      this.error.set('Escriba el nombre del servicio.');
      return;
    }
    if (!AMOUNT.test(price)) {
      this.error.set('Escriba el precio: un importe positivo, con hasta dos decimales.');
      return;
    }
    this.error.set(null);
    this.working.set(true);

    // Dos lecturas del catálogo: la primera página y la búsqueda por la
    // palabra más larga del nombre, para no perder un parecido que quede
    // fuera de la primera página en un catálogo grande.
    const longest = [...significantWords(name)].sort((a, b) => b.length - a.length)[0]!;
    forkJoin([
      this.catalog.search(this.practiceId(), { limit: CANDIDATES_LIMIT }),
      this.catalog.search(this.practiceId(), { limit: CANDIDATES_LIMIT, query: longest }),
    ])
      .pipe(
        map(([page, byWord]) => {
          const byId = new Map([...page.items, ...byWord.items].map((item) => [item.id, item]));
          return similarServices(name, [...byId.values()]);
        }),
      )
      .subscribe({
        next: (matches) => {
          if (matches.length === 0) {
            this.create();
            return;
          }
          this.working.set(false);
          this.suggestions.set(matches);
          this.step.set('similar');
        },
        error: (error: unknown) => {
          this.working.set(false);
          this.error.set(serverMessage(error));
        },
      });
  }

  /** «Es un servicio distinto»: sigue con el alta pese a los parecidos. */
  protected createAnyway(): void {
    this.working.set(true);
    this.create();
  }

  protected backToForm(): void {
    this.step.set('form');
  }

  private create(): void {
    const name = this.name().trim();
    this.catalog
      .create({
        practiceId: this.practiceId(),
        code: codeFor(name),
        name,
        defaultPrice: this.price().trim(),
        isActive: true,
      })
      .subscribe({
        next: (created) => {
          this.working.set(false);
          this.created.emit(created);
        },
        error: (error: unknown) => {
          this.working.set(false);
          this.step.set('form');
          this.error.set(serverMessage(error));
        },
      });
  }
}

/**
 * Un código único y legible a partir del nombre: `PROPIO-CONTROL-PRENATAL-lx3k9a`.
 * El sufijo de tiempo evita chocar con otro servicio del mismo nombre.
 */
function codeFor(name: string): string {
  const slug = significantWords(name).join('-').toUpperCase().slice(0, 60);
  return `PROPIO-${slug}-${Date.now().toString(36)}`;
}

function serverMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = readApiError(error);
    if (body !== null && body.message !== '') return body.message;
  }
  return 'No pudimos crear el servicio. Pruebe de nuevo.';
}
