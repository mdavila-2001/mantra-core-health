import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { concat, map, type Observable, toArray } from 'rxjs';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabOrder,
  LabOrderAction,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { RowActions } from '../../../shared/components/molecules/row-actions/row-actions';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

import { formatBytes } from '../file-size';
import { filesFromInput } from '../results/picked-files';
import { ResultUploadQueue, type UploadItem } from '../results/result-upload-queue';
import {
  actionsOf,
  disabledAll,
  ORDER_STATUS_BADGE,
  ORDER_TAB_LABELS,
  ORDER_TABS,
  orderTabIndexOf,
  orderTabKeyOf,
  ordersOfTab,
  type OrderActionCode,
} from './laboratory-orders.logic';

/**
 * **Órdenes** del laboratorio y del centro de imagenología, en una sola
 * pantalla.
 *
 * Reemplaza a «Recepción de muestras», «Cola de trabajo» y «Resultados»: el
 * camino de una orden es `Borrador → Recibida → Procesada → Subidos`, con
 * `Cancelada` y `Rechazada` como salidas, y cada paso es una acción del menú de
 * tres puntos de su fila — **Recibir**, **Marcar como procesada**, **Subir
 * resultados** y **Descargar**, y nada más.
 *
 * ## Una tarjeta con pestañas, a lo ancho
 *
 * Es la regla de la casa para fichas y listados (`composition-rules.md` §5):
 * cada pestaña es un estado, la elegida vive en `?estado=` y se escribe con
 * `replaceUrl` para no llenar el historial.
 *
 * ## La pantalla no decide
 *
 * Qué acción está habilitada sale de {@link actionsOf}, que es presentación: la
 * API (hoy el simulador, P52) revalida el paso y responde 409 si el estado ya no
 * lo admite. Después de cada acción se vuelve a pedir la lista: lo que se ve es
 * lo que el servidor tiene, no lo que la pantalla supone.
 *
 * ## Subir y descargar
 *
 * La subida reusa {@link ResultUploadQueue} (por partes, sin tope de tamaño,
 * con pausa y reintento). La descarga baja todos los archivos subidos de la
 * orden, uno tras otro.
 */
@Component({
  selector: 'app-laboratory-orders',
  imports: [
    Alert,
    Badge,
    Card,
    DataTable,
    DatePipe,
    NgTemplateOutlet,
    PageHeader,
    RowActions,
    SearchField,
    Tab,
    Tabs,
  ],
  providers: [ResultUploadQueue],
  templateUrl: './laboratory-orders.html',
  styleUrl: './laboratory-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryOrders {
  private readonly lab = inject(LabPortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  protected readonly queue = inject(ResultUploadQueue);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly patientCell =
    viewChild.required<TemplateRef<{ $implicit: LabOrder }>>('patientCell');
  private readonly studyCell =
    viewChild.required<TemplateRef<{ $implicit: LabOrder }>>('studyCell');
  private readonly requestedCell =
    viewChild.required<TemplateRef<{ $implicit: LabOrder }>>('requestedCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: LabOrder }>>('statusCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: LabOrder }>>('actionsCell');

  protected readonly tabs = ORDER_TABS;
  protected readonly labels = ORDER_TAB_LABELS;
  protected readonly formatBytes = formatBytes;
  protected readonly actionsOf = actionsOf;
  protected readonly disabledAll = disabledAll;

  protected readonly selected = signal(
    orderTabIndexOf(this.route.snapshot.queryParamMap.get('estado')),
  );
  protected readonly search = signal('');

  /** Todas las órdenes, tal como las tiene el servidor. */
  private readonly orders = signal<ViewState<readonly LabOrder[]>>(loading());

  /** La orden con una acción en vuelo: sus botones esperan, no se puede mandar dos veces. */
  protected readonly busyOrderId = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  private uploadOrderId: string | null = null;

  /** Cuántas órdenes tiene cada pestaña, para el rótulo. */
  protected readonly counts = computed(() => {
    const state = this.orders();
    const all = state.status === 'ready' ? state.data : [];
    return ORDER_TABS.map((tab) => ordersOfTab(all, tab).length);
  });

  /** Lo que ve la tabla de la pestaña elegida, ya con la búsqueda aplicada. */
  protected readonly table = computed<ViewState<readonly LabOrder[]>>(() => {
    const state = this.orders();
    if (state.status !== 'ready') return state;
    const tab = orderTabKeyOf(this.selected());
    const query = this.search().trim().toLocaleLowerCase('es');
    const rows = ordersOfTab(state.data, tab).filter(
      (order) =>
        query === '' ||
        order.patientName.toLocaleLowerCase('es').includes(query) ||
        order.studyName.toLocaleLowerCase('es').includes(query),
    );
    if (rows.length > 0) return ready(rows);
    return query !== ''
      ? empty({ label: 'Ver todas las órdenes' }, 'Ninguna orden coincide con la búsqueda.')
      : empty(
          { label: 'Ver todas las órdenes' },
          tab === 'all'
            ? 'Todavía no le derivaron ninguna orden.'
            : `No hay órdenes en «${ORDER_TAB_LABELS[tab]}».`,
        );
  });

  protected readonly columns = computed<readonly ColumnDef<LabOrder>[]>(() => [
    { key: 'patient', header: 'Paciente', priority: 1, cell: this.patientCell() },
    { key: 'study', header: 'Estudio', priority: 1, cell: this.studyCell() },
    { key: 'requestedAt', header: 'Pedida', priority: 1, cell: this.requestedCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    {
      key: 'actions',
      header: 'Acciones',
      priority: 1,
      sticky: 'end',
      accion: true,
      cell: this.actionsCell(),
    },
  ]);

  protected readonly trackByOrder = (order: LabOrder): string => order.orderId;
  protected readonly rowName = (order: LabOrder): string => `la orden de ${order.patientName}`;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.selected.set(orderTabIndexOf(params.get('estado')));
    });
    this.load();

    // Cuando un archivo termina de subir, la orden pasa a «Subidos»: se relee.
    let seen = 0;
    effect(() => {
      const finished = this.queue.finishedCount();
      if (finished !== seen) {
        seen = finished;
        this.load();
      }
    });
  }

  protected statusBadge(order: LabOrder) {
    return ORDER_STATUS_BADGE[order.status];
  }

  /** Cuánto de un archivo ya salió, de 0 a 100. */
  protected percentOf(item: UploadItem): number {
    return item.file.size === 0 ? 100 : Math.floor((item.sentBytes / item.file.size) * 100);
  }

  /** A qué orden va un archivo de la cola, en palabras: «Paciente · Estudio». */
  protected uploadTargetLabel(orderId: string | null): string {
    const state = this.orders();
    if (orderId === null || state.status !== 'ready') return '';
    const order = state.data.find((o) => o.orderId === orderId);
    return order === undefined ? '' : `${order.patientName} · ${order.studyName}`;
  }

  protected reload(): void {
    this.orders.set(loading());
    this.load();
  }

  private load(): void {
    this.lab.listOrders().subscribe({
      next: (page) => this.orders.set(ready(page.items)),
      error: (error: unknown) => this.orders.set(errorToViewState<readonly LabOrder[]>(error)),
    });
  }

  protected select(index: number): void {
    this.selected.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { estado: orderTabKeyOf(index) },
      replaceUrl: true,
    });
  }

  protected run(code: string, order: LabOrder): void {
    if (this.busyOrderId() !== null) return;
    this.actionError.set(null);
    switch (code as OrderActionCode) {
      case 'receive':
        return this.transition(order, 'RECEIVE', 'Orden recibida.');
      case 'process':
        return this.transition(order, 'PROCESS', 'Orden marcada como procesada.');
      case 'upload':
        this.uploadOrderId = order.orderId;
        this.fileInput()?.nativeElement.click();
        return;
      case 'download':
        return this.download(order);
    }
  }

  private transition(order: LabOrder, action: LabOrderAction, done: string): void {
    this.busyOrderId.set(order.orderId);
    this.lab.transitionOrder(order.orderId, action).subscribe({
      next: () => {
        this.busyOrderId.set(null);
        this.toasts.success(done);
        this.load();
      },
      error: (error: unknown) => {
        this.busyOrderId.set(null);
        this.actionError.set(messageOf(error, 'No pudimos cambiar el estado de la orden.'));
        // Un 409 quiere decir que el estado cambió por otro lado: se relee.
        this.load();
      },
    });
  }

  protected onFilesChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = filesFromInput(input);
    const orderId = this.uploadOrderId;
    input.value = '';
    if (picked.length === 0 || orderId === null) return;
    this.queue.add(picked, { orderId, note: null, notify: true });
  }

  private download(order: LabOrder): void {
    if (order.files.length === 0) return;
    this.busyOrderId.set(order.orderId);
    concat(...order.files.map((file) => this.fetchAndSave(file.id, file.fileName)))
      .pipe(toArray())
      .subscribe({
        next: () => this.busyOrderId.set(null),
        error: (error: unknown) => {
          this.busyOrderId.set(null);
          this.actionError.set(messageOf(error, 'No pudimos descargar los resultados.'));
        },
      });
  }

  /** Pide los bytes del archivo y lo baja con su nombre. */
  private fetchAndSave(id: string, fileName: string): Observable<void> {
    return this.lab.resultContent(id).pipe(
      map((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }),
    );
  }
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = readApiError(error)?.message;
    if (message !== undefined && message !== '') return message;
  }
  return fallback;
}
