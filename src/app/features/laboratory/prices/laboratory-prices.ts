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
import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../core/money/display-currency';
import { dataOf, empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
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
import { changesOf, discountText, type PriceEdit, parseAmount, parseDiscount, reasonOf } from './laboratory-prices.rules';
import { LabServicesImport } from './services-import/lab-services-import';

/** Filas por página. */
const PAGE_SIZE = 10;

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
 *
 * «Importar análisis (CSV)» carga o actualiza el catálogo entero desde la
 * planilla del laboratorio (registro de procesos 4.2), con
 * `POST /diagnostics/lab/services/import`; ver `services-import/`.
 */
@Component({
  selector: 'app-laboratory-prices',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    DataTable,
    Input,
    LabServicesImport,
    PageHeader,
    SearchField,
    Switch,
  ],
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
  /** El diálogo «Importar análisis (CSV)». */
  protected readonly importOpen = signal(false);

  /** The service whose «Disponible hoy» switch is saving. */
  protected readonly togglingId = signal<string | null>(null);
  /** What the switches show while their PATCH is in flight; removing the entry reverts a failed one. */
  private readonly pendingAvailability = signal<Readonly<Record<string, boolean>>>({});

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
  private readonly availableCell =
    viewChild.required<TemplateRef<{ $implicit: LabService }>>('availableCell');

  protected readonly columns = computed<readonly ColumnDef<LabService>[]>(() => [
    { key: 'name', header: 'Servicio', priority: 1, cell: this.nameCell() },
    { key: 'price', header: 'Precio de lista (Bs)', priority: 1, cell: this.priceCell() },
    { key: 'discount', header: 'Descuento AloVida (%)', priority: 2, cell: this.discountCell() },
    { key: 'alovida', header: 'Precio AloVida', priority: 2, cell: this.alovidaCell() },
    { key: 'status', header: 'En la vitrina', priority: 3, cell: this.statusCell() },
    { key: 'available', header: 'Disponible hoy', priority: 2, cell: this.availableCell() },
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

  /**
   * Al cerrar la importación se relee la lista si la API llegó a cargar algo:
   * los análisis nuevos aparecen con su precio. Lo escrito y sin guardar se
   * conserva, porque la relectura no lo toca.
   */
  protected importClosed(imported: boolean): void {
    this.importOpen.set(false);
    if (imported) {
      this.reload();
    }
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

  /**
   * «Disponible hoy» saves on its own, with its PATCH: it is not a price, so it
   * does not wait for «Guardar cambios» and does not touch what was typed.
   */
  protected toggleAvailable(service: LabService, available: boolean): void {
    this.togglingId.set(service.id);
    this.rejected.set([]);
    this.setPending(service.id, available);
    this.lab.updateService(service.id, { available }).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.services.update((state) =>
          mapData(state, (list) => list.map((row) => (row.id === updated.id ? updated : row))),
        );
        this.setPending(service.id, null);
        this.toasts.success(
          available ? `«${service.name}» vuelve a estar disponible hoy.` : `«${service.name}» no se ofrece hoy.`,
        );
      },
      error: (error: unknown) => {
        this.togglingId.set(null);
        this.setPending(service.id, null);
        this.rejected.set([{ name: service.name, reason: reasonOf(error) }]);
      },
    });
  }

  protected availableOf(service: LabService): boolean {
    return this.pendingAvailability()[service.id] ?? service.available;
  }

  private setPending(id: string, value: boolean | null): void {
    this.pendingAvailability.update(({ [id]: _old, ...rest }) => (value === null ? rest : { ...rest, [id]: value }));
  }

  /* ─── Guardar ─────────────────────────────────────────────────────────── */

  protected save(): void {
    if (this.saving() || this.dirtyCount() === 0) {
      return;
    }
    const { changes, problems } = changesOf(dataOf(this.services()) ?? [], this.edits());
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
