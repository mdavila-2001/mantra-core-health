import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, concatMap, from, map, of, toArray } from 'rxjs';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabService,
  LabServiceChanges,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Filas por página. */
const PAGE_SIZE = 10;
/** El mismo tope que el catálogo de la farmacia: atrapa un cero de más. */
const PRICE_MAX = 1_000_000;

/** Lo que la persona escribió en una fila, todavía como texto. */
interface PriceEdit {
  readonly price: string;
  readonly discount: string;
}

/** Un servicio que no se pudo guardar, con su motivo. */
interface PriceRejection {
  readonly name: string;
  readonly reason: string;
}

/**
 * **Precios** del laboratorio: el precio de lista de cada servicio y el
 * descuento para usuarios de AloVida, editables en la tabla y guardados junto
 * con «Guardar cambios».
 *
 * Son los precios que ven los pacientes en la plataforma. La columna «Precio
 * AloVida» se recalcula mientras se escribe, con la misma cuenta del servidor
 * (precio menos el descuento, a dos decimales), para que se vea qué va a
 * pagar el paciente antes de guardar.
 *
 * Guardar manda **sólo** las filas que cambiaron, una por una y en serie, con
 * `PATCH /diagnostics/lab/services/:id` (P52, sólo simulador). Una que falla no
 * frena a las demás: al final se dice cuáles no entraron y por qué. Los
 * retirados no aparecen.
 */
@Component({
  selector: 'app-laboratory-prices',
  imports: [Alert, AppButton, Badge, Card, DataTable, Input, PageHeader, SearchField],
  templateUrl: './laboratory-prices.html',
  styleUrl: './laboratory-prices.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryPrices {
  private readonly lab = inject(LabPortalClient);
  private readonly toasts = inject(ToastService);

  protected readonly services = signal<ViewState<readonly LabService[]>>(loading());
  /** Lo escrito y sin guardar, por servicio. */
  protected readonly edits = signal<Readonly<Record<string, PriceEdit>>>({});
  protected readonly term = signal('');
  protected readonly errors = signal<readonly string[]>([]);
  protected readonly rejected = signal<readonly PriceRejection[]>([]);
  protected readonly saving = signal(false);
  protected readonly offset = signal(0);

  protected readonly dirtyCount = computed(() => Object.keys(this.edits()).length);

  private readonly visible = computed<ViewState<readonly LabService[]>>(() => {
    const state = this.services();
    if (state.status !== 'ready') {
      return state;
    }
    const term = this.term().trim().toLocaleLowerCase('es');
    const list = state.data.filter(
      (service) =>
        term === '' ||
        [service.name, service.code, service.categoryName].some((text) =>
          (text ?? '').toLocaleLowerCase('es').includes(term),
        ),
    );
    return list.length > 0
      ? ready(list)
      : empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`);
  });

  protected readonly pageRows = computed<ViewState<readonly LabService[]>>(() =>
    mapData(this.visible(), (list) => list.slice(this.offset(), this.offset() + PAGE_SIZE)),
  );

  protected readonly cursor = computed<CursorState>(() => {
    const total = dataOf(this.visible())?.length ?? 0;
    return {
      prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
      nextCursor: this.offset() + PAGE_SIZE < total ? String(this.offset() + PAGE_SIZE) : null,
    };
  });

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: LabService }>>('nameCell');
  private readonly priceCell = viewChild.required<TemplateRef<{ $implicit: LabService }>>('priceCell');
  private readonly discountCell =
    viewChild.required<TemplateRef<{ $implicit: LabService }>>('discountCell');
  private readonly alovidaCell =
    viewChild.required<TemplateRef<{ $implicit: LabService }>>('alovidaCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: LabService }>>('statusCell');

  protected readonly columns = computed<readonly ColumnDef<LabService>[]>(() => [
    { key: 'name', header: 'Servicio', priority: 1, cell: this.nameCell() },
    { key: 'price', header: 'Precio de lista (Bs)', priority: 1, cell: this.priceCell() },
    { key: 'discount', header: 'Descuento AloVida (%)', priority: 2, cell: this.discountCell() },
    { key: 'alovida', header: 'Precio AloVida', priority: 2, cell: this.alovidaCell() },
    { key: 'status', header: 'En la vitrina', priority: 3, cell: this.statusCell() },
  ]);

  protected readonly rowId = (service: LabService): string => service.id;
  protected readonly rowLabel = (service: LabService): string => service.name;

  constructor() {
    this.reload();
  }

  protected reload(): void {
    this.services.set(loading());
    this.offset.set(0);
    this.lab.listServices().subscribe({
      next: (page) => {
        const alive = page.items.filter((service) => service.status !== 'WITHDRAWN');
        this.services.set(
          alive.length > 0
            ? ready(alive)
            : empty(
                { label: 'Cargue sus servicios en el catálogo del laboratorio' },
                'Todavía no hay servicios a los que ponerles precio.',
              ),
        );
      },
      error: (error: unknown) => this.services.set(errorToViewState<readonly LabService[]>(error)),
    });
  }

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }

  protected search(term: string): void {
    this.term.set(term);
    this.offset.set(0);
  }

  /* ─── Lo escrito ──────────────────────────────────────────────────────── */

  protected priceOf(service: LabService): string {
    return this.edits()[service.id]?.price ?? service.price;
  }

  protected discountOf(service: LabService): string {
    return this.edits()[service.id]?.discount ?? discountText(service);
  }

  protected setPrice(service: LabService, value: string | number | null): void {
    this.edit(service, { price: value === null ? '' : String(value), discount: this.discountOf(service) });
  }

  protected setDiscount(service: LabService, value: string | number | null): void {
    this.edit(service, { price: this.priceOf(service), discount: value === null ? '' : String(value) });
  }

  private edit(service: LabService, edit: PriceEdit): void {
    const unchanged =
      parseAmount(edit.price) === Number(service.price) &&
      parseDiscount(edit.discount) === (service.alovidaDiscountPercent ?? null);
    this.edits.update((current) => {
      const next = { ...current };
      // Volver al valor de origen deja la fila como no editada.
      if (unchanged) {
        delete next[service.id];
      } else {
        next[service.id] = edit;
      }
      return next;
    });
  }

  protected isEdited(service: LabService): boolean {
    return this.edits()[service.id] !== undefined;
  }

  /** Lo que pagaría un usuario de AloVida con lo escrito, o `null` si no se puede calcular. */
  protected alovidaPriceOf(service: LabService): string | null {
    const edit = this.edits()[service.id];
    if (edit === undefined) {
      return withDisplayCurrency(service.alovidaPrice);
    }
    const price = parseAmount(edit.price);
    const discount = parseDiscount(edit.discount);
    if (price === 'invalid' || discount === 'invalid') {
      return null;
    }
    return withDisplayCurrency(((price * (100 - (discount ?? 0))) / 100).toFixed(2));
  }

  protected discard(): void {
    this.edits.set({});
    this.errors.set([]);
  }

  /* ─── Guardar ─────────────────────────────────────────────────────────── */

  protected save(): void {
    if (this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const changes: { service: LabService; changes: LabServiceChanges }[] = [];
    const problems: string[] = [];
    for (const service of dataOf(this.services()) ?? []) {
      const edit = this.edits()[service.id];
      if (edit === undefined) {
        continue;
      }
      const price = parseAmount(edit.price);
      const discount = parseDiscount(edit.discount);
      if (price === 'invalid') {
        problems.push(
          `«${service.name}»: el precio va en bolivianos, de 0 a ${PRICE_MAX.toLocaleString('es-BO')}, con hasta dos decimales.`,
        );
        continue;
      }
      if (discount === 'invalid') {
        problems.push(`«${service.name}»: el descuento es un número de 0 a 100, o vacío si no hay.`);
        continue;
      }
      changes.push({
        service,
        changes: { price: price.toFixed(2), alovidaDiscountPercent: discount },
      });
    }
    this.errors.set(problems);
    this.rejected.set([]);
    if (problems.length > 0) {
      return;
    }
    this.saving.set(true);
    from(changes)
      .pipe(
        concatMap(({ service, changes: body }) =>
          this.lab.updateService(service.id, body).pipe(
            map(() => null),
            catchError((error: unknown) => of({ name: service.name, reason: reasonOf(error) })),
          ),
        ),
        toArray(),
      )
      .subscribe((results) => {
        this.saving.set(false);
        const rejected = results.filter((result): result is PriceRejection => result !== null);
        const saved = results.length - rejected.length;
        if (saved > 0) {
          this.toasts.success(
            saved === 1 ? 'Guardó el precio de 1 servicio.' : `Guardó el precio de ${saved} servicios.`,
          );
        }
        this.rejected.set(rejected);
        this.edits.set({});
        // La prueba es la tabla releída de la API.
        this.reload();
      });
  }
}

function discountText(service: LabService): string {
  return service.alovidaDiscountPercent === null ? '' : String(service.alovidaDiscountPercent);
}

/** Un monto en bolivianos de 0 a {@link PRICE_MAX}, con punto o coma y hasta dos decimales. */
function parseAmount(text: string): number | 'invalid' {
  const clean = text.trim().replace(/^bs\.?\s*/i, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= PRICE_MAX ? value : 'invalid';
}

/** Un porcentaje de 0 a 100; vacío es «sin descuento» (`null`). */
function parseDiscount(text: string): number | null | 'invalid' {
  const clean = text.trim().replace(/%$/, '').trim();
  if (clean === '') {
    return null;
  }
  if (!/^\d+([.,]\d{1,2})?$/.test(clean)) {
    return 'invalid';
  }
  const value = Number(clean.replace(',', '.'));
  return value <= 100 ? value : 'invalid';
}

/** El motivo de la API para un servicio rechazado, o uno genérico. */
function reasonOf(error: unknown): string {
  const state = errorToViewState<never>(error);
  if (state.status === 'validation') {
    const messages = state.issues.map((issue) => issue.message).filter((m) => m !== '');
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return 'message' in state && typeof state.message === 'string' && state.message !== ''
    ? state.message
    : 'No se pudo guardar el precio.';
}
