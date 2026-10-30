import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, concatMap, from, map, of, toArray } from 'rxjs';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, CursorState } from '../../../../shared/components/organisms/data-table/data-table.types';

import { PharmacySiteStockClient } from '../../../../core/data-access/pharmacy/pharmacy-site-stock.client';
import type { SiteAvailabilityDraft, SiteStock } from '../../../../core/data-access/pharmacy/pharmacy-site-stock.types';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { describeApiFailure } from '../../../../core/http/api-failure';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';

import {
  availabilityDraft,
  initialEdit,
  isChanged,
  isLedgerSite,
  matchesTerm,
  siteStockRows,
  type SiteStockEdit,
  type SiteStockRow,
} from './site-stock-rows';

/** Filas por página: las mismas que la tabla de «Todas». */
const PAGE_SIZE = 10;

/** Lo que dejó el `PUT` de una fila: `null` si se guardó. */
interface RowOutcome {
  readonly productId: string;
  readonly problem: string | null;
}

/**
 * **Stock de una sucursal** (FAR-06): «Lo tengo / No lo tengo» y la cantidad
 * de cada producto publicado en esa sede.
 *
 * - Guardar manda **un `PUT` por fila cambiada, en serie**: una fila rechazada
 *   (un 422 con su motivo) queda marcada y las demás se guardan igual.
 * - Al terminar relee `GET /pharmacy-inventory/sites/:siteId/stock`: lo que se
 *   ve es lo que quedó en la API, no lo que se mandó.
 * - Una sede en modo catálogo pasa a llevar su propio stock con el primer
 *   guardado; la API la inicializa con lo declarado, sin rebotes.
 */
@Component({
  selector: 'app-site-stock-panel',
  imports: [AppButton, Badge, DataTable, Input, SearchField, Switch],
  templateUrl: './site-stock-panel.html',
  styleUrl: './site-stock-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteStockPanel {
  readonly pharmacyId = input.required<string>();
  readonly siteId = input.required<string>();
  readonly siteName = input.required<string>();
  /** El catálogo vivo de la farmacia, tal como lo leyó la pestaña. */
  readonly products = input.required<ViewState<readonly PharmacyProduct[]>>();

  /** Cada lectura del stock dice si la sede tiene stock propio de algún producto. */
  readonly modeRead = output<{ readonly siteId: string; readonly ledger: boolean }>();
  /** Reintentar cuando lo que falló es la lectura del catálogo. */
  readonly catalogRetry = output<void>();

  private readonly client = inject(PharmacySiteStockClient);
  private readonly toasts = inject(ToastService);

  protected readonly stock = signal<ViewState<SiteStock>>(loading());
  /** Lo elegido y sin guardar, por producto. */
  protected readonly edits = signal<Readonly<Record<string, SiteStockEdit>>>({});
  /** Por qué no se guardó una fila, por producto. */
  protected readonly rowErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly saving = signal(false);
  protected readonly term = signal('');
  protected readonly offset = signal(0);

  /** `null` mientras no se sabe; si no, si la sede tiene stock propio de algún producto. */
  protected readonly ledger = computed(() => {
    const stock = dataOf(this.stock());
    return stock === null ? null : isLedgerSite(stock);
  });

  private readonly rows = computed<readonly SiteStockRow[]>(() => {
    const products = dataOf(this.products());
    const stock = dataOf(this.stock());
    return products === null || stock === null ? [] : siteStockRows(products, stock);
  });

  protected readonly dirtyCount = computed(
    () => this.rows().filter((row) => this.isEdited(row)).length,
  );

  private readonly visible = computed<ViewState<readonly SiteStockRow[]>>(() => {
    const products = this.products();
    if (products.status !== 'ready' && products.status !== 'stale') {
      return products as ViewState<readonly SiteStockRow[]>;
    }
    const stock = this.stock();
    if (stock.status !== 'ready' && stock.status !== 'stale') {
      return stock as ViewState<readonly SiteStockRow[]>;
    }
    const list = this.rows().filter((row) => matchesTerm(row, this.term()));
    if (list.length > 0) {
      return ready(list);
    }
    return this.term().trim() !== ''
      ? empty({ label: 'Pruebe con otra palabra' }, `Nada coincide con «${this.term().trim()}».`)
      : empty({ label: 'Publique productos en «Productos»' }, 'Ningún producto publicado para ofrecer en esta sucursal.');
  });

  protected readonly pageRows = computed<ViewState<readonly SiteStockRow[]>>(() => {
    const state = this.visible();
    return state.status === 'ready' ? ready(state.data.slice(this.offset(), this.offset() + PAGE_SIZE)) : state;
  });

  protected readonly cursor = computed<CursorState>(() => {
    const total = dataOf(this.visible())?.length ?? 0;
    return {
      prevCursor: this.offset() > 0 ? String(Math.max(0, this.offset() - PAGE_SIZE)) : null,
      nextCursor: this.offset() + PAGE_SIZE < total ? String(this.offset() + PAGE_SIZE) : null,
    };
  });

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: SiteStockRow }>>('nameCell');
  private readonly hasCell = viewChild.required<TemplateRef<{ $implicit: SiteStockRow }>>('hasCell');
  private readonly quantityCell = viewChild.required<TemplateRef<{ $implicit: SiteStockRow }>>('quantityCell');

  protected readonly columns = computed<readonly ColumnDef<SiteStockRow>[]>(() => [
    { key: 'name', header: 'Producto', priority: 1, cell: this.nameCell() },
    { key: 'has', header: 'En la sucursal', priority: 1, cell: this.hasCell() },
    { key: 'quantity', header: 'Cantidad', priority: 1, cell: this.quantityCell() },
  ]);

  protected readonly rowId = (row: SiteStockRow): string => row.productId;
  protected readonly rowLabel = (row: SiteStockRow): string => row.name;

  constructor() {
    effect(() => {
      const siteId = this.siteId();
      untracked(() => {
        this.edits.set({});
        this.rowErrors.set({});
        this.term.set('');
        this.offset.set(0);
        this.load(siteId);
      });
    });
  }

  protected reload(): void {
    if (this.products().status !== 'ready' && this.products().status !== 'stale') {
      this.catalogRetry.emit();
      return;
    }
    this.load(this.siteId());
  }

  private load(siteId: string): void {
    this.stock.set(loading());
    this.client.getSiteStock(siteId).subscribe({
      next: (stock) => {
        if (siteId !== this.siteId()) {
          return;
        }
        this.stock.set(ready(stock));
        this.modeRead.emit({ siteId, ledger: isLedgerSite(stock) });
      },
      error: (error: unknown) => {
        if (siteId === this.siteId()) {
          this.stock.set(errorToViewState<SiteStock>(error));
        }
      },
    });
  }

  protected search(term: string): void {
    this.term.set(term);
    this.offset.set(0);
  }

  protected goToCursor(cursor: string): void {
    this.offset.set(Math.max(0, Number(cursor) || 0));
  }

  /* ─── Lo elegido ──────────────────────────────────────────────────────── */

  protected editOf(row: SiteStockRow): SiteStockEdit {
    return this.edits()[row.productId] ?? initialEdit(row);
  }

  protected isEdited(row: SiteStockRow): boolean {
    const edit = this.edits()[row.productId];
    return edit !== undefined && isChanged(row, edit);
  }

  protected setAvailable(row: SiteStockRow, available: boolean): void {
    this.write(row, { ...this.editOf(row), available });
  }

  protected setQuantity(row: SiteStockRow, value: string | number | null): void {
    this.write(row, { ...this.editOf(row), quantity: value === null ? '' : String(value) });
  }

  private write(row: SiteStockRow, edit: SiteStockEdit): void {
    this.edits.update((current) => {
      const next = { ...current };
      // Volver a lo guardado deja la fila como no editada.
      if (isChanged(row, edit)) {
        next[row.productId] = edit;
      } else {
        delete next[row.productId];
      }
      return next;
    });
  }

  protected discard(): void {
    this.edits.set({});
    this.rowErrors.set({});
  }

  /* ─── Guardar ─────────────────────────────────────────────────────────── */

  protected save(): void {
    if (this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const pharmacyId = this.pharmacyId();
    const siteId = this.siteId();
    const pending: { readonly productId: string; readonly draft: SiteAvailabilityDraft }[] = [];
    const problems: Record<string, string> = {};
    for (const row of this.rows()) {
      const edit = this.edits()[row.productId];
      if (edit === undefined || !isChanged(row, edit)) {
        continue;
      }
      const result = availabilityDraft(edit);
      if ('problem' in result) {
        problems[row.productId] = result.problem;
      } else {
        pending.push({ productId: row.productId, draft: result.draft });
      }
    }
    this.rowErrors.set(problems);
    if (pending.length === 0) {
      return;
    }
    this.saving.set(true);
    // En serie: la primera escritura de una sede la inicializa entera, y las
    // demás no tienen que competir con ella por el candado de la sede.
    from(pending)
      .pipe(
        concatMap(({ productId, draft }) =>
          this.client.setSiteAvailability(pharmacyId, siteId, productId, draft).pipe(
            map((): RowOutcome => ({ productId, problem: null })),
            catchError((error: unknown) =>
              of<RowOutcome>({
                productId,
                problem: describeApiFailure(error, 'No se pudo guardar este producto en la sucursal.'),
              }),
            ),
          ),
        ),
        toArray(),
      )
      .subscribe((outcomes) => this.settle(siteId, outcomes));
  }

  private settle(siteId: string, outcomes: readonly RowOutcome[]): void {
    this.saving.set(false);
    if (siteId !== this.siteId()) {
      return;
    }
    const failed = outcomes.filter((outcome) => outcome.problem !== null);
    const saved = outcomes.length - failed.length;
    this.edits.update((current) => {
      const next = { ...current };
      for (const outcome of outcomes) {
        if (outcome.problem === null) {
          delete next[outcome.productId];
        }
      }
      return next;
    });
    this.rowErrors.update((current) => ({
      ...current,
      ...Object.fromEntries(failed.map((outcome) => [outcome.productId, outcome.problem ?? ''])),
    }));
    const place = `en ${this.siteName()}`;
    const savedText = saved === 1 ? `Guardó 1 producto ${place}.` : `Guardó ${saved} productos ${place}.`;
    if (failed.length === 0) {
      this.toasts.success(savedText);
    } else {
      const failedText = failed.length === 1 ? '1 no se pudo guardar' : `${failed.length} no se pudieron guardar`;
      this.toasts.warning(`${saved > 0 ? savedText + ' ' : ''}${failedText}: el motivo está en su fila.`);
    }
    // La prueba es el stock releído de la API.
    this.load(siteId);
  }
}
