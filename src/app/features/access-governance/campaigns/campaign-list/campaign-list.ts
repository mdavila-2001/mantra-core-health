import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, from, map, mergeMap, of, toArray, type Observable } from 'rxjs';

import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import type {
  Campaign,
  CampaignResults,
  CampaignStatus,
} from '../../../../core/data-access/access-governance/access-reviews.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, hasData, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Progress } from '../../../../shared/components/atoms/progress/progress';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDay } from '../../../support-access/support-labels';
import {
  campaignStatusText,
  campaignStatusTone,
  dueCounter,
  scopeKindText,
} from '../../review-labels';
import { REVIEW_KIND_LABELS } from '../../../../core/data-access/access-governance/access-reviews.types';

/** Una campaña con su avance (que sale de sus resultados; `null` si no se pudo leer o no corresponde). */
export interface CampaignRow {
  readonly campaign: Campaign;
  readonly progress: Pick<CampaignResults, 'coveragePercent' | 'pending' | 'total'> | null;
}

type Filtro = 'ALL' | CampaignStatus;

/** Cuántos «resultados de campaña» se piden a la vez para pintar el avance del listado (la API aún no trae conteos). */
export const CAMPAIGN_RESULTS_CONCURRENCY = 4;

const ORDEN: Readonly<Record<CampaignStatus, number>> = {
  OPEN: 0,
  DRAFT: 1,
  CLOSED: 2,
  CANCELLED: 3,
};
const NUEVA = '/administration/access-governance/campaigns/new';

/**
 * **Campañas de certificación** (CONTRATO-GOBIERNO §6.2 y §9.3): estado, avance y vencimiento de cada campaña.
 *
 * La lista sale de `GET /org/access-reviews/campaigns`; el avance de cada campaña abierta o cerrada, de sus resultados
 * (la lista no trae conteos). Si los resultados de una campaña no llegan, su avance queda en «—» y el resto sigue. Si al
 * volver a leer falla, se conserva lo que había y se dice desde cuándo (S7). Nada acá autoriza: la API decide.
 */
@Component({
  selector: 'app-campaign-list',
  imports: [
    AppButtonLink,
    Badge,
    Card,
    DataTable,
    PageHeader,
    Progress,
    RouterLink,
    SegmentedControl,
    ViewStateHost,
  ],
  templateUrl: './campaign-list.html',
  styleUrl: './campaign-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignList implements OnInit {
  private readonly client = inject(AccessReviewsClient);
  private readonly route = inject(ActivatedRoute);

  protected readonly nueva = NUEVA;
  protected readonly state = signal<ViewState<readonly CampaignRow[]>>(loading());
  protected readonly filtro = signal<Filtro>('ALL');
  private cargadoEn = new Date();

  private readonly nombreCell =
    viewChild.required<TemplateRef<{ $implicit: CampaignRow }>>('nombreCell');
  private readonly estadoCell =
    viewChild.required<TemplateRef<{ $implicit: CampaignRow }>>('estadoCell');
  private readonly avanceCell =
    viewChild.required<TemplateRef<{ $implicit: CampaignRow }>>('avanceCell');
  private readonly venceCell =
    viewChild.required<TemplateRef<{ $implicit: CampaignRow }>>('venceCell');
  private readonly accionesCell =
    viewChild.required<TemplateRef<{ $implicit: CampaignRow }>>('accionesCell');

  private readonly todas = computed<readonly CampaignRow[]>(() => {
    const s = this.state();
    return hasData(s) ? s.data : [];
  });

  protected readonly hayDatos = computed(() => hasData(this.state()));

  protected readonly filtros = computed<readonly SegmentedOption<Filtro>[]>(() => {
    const filas = this.todas();
    const de = (estado: CampaignStatus): number =>
      filas.filter((f) => f.campaign.status === estado).length;
    return [
      { value: 'ALL', label: `Todas (${filas.length})` },
      { value: 'OPEN', label: `Abiertas (${de('OPEN')})` },
      { value: 'DRAFT', label: `Borradores (${de('DRAFT')})` },
      { value: 'CLOSED', label: `Cerradas (${de('CLOSED')})` },
      { value: 'CANCELLED', label: `Canceladas (${de('CANCELLED')})` },
    ];
  });

  /** Lo que muestra la tabla según el filtro. */
  protected readonly visibles = computed<ViewState<readonly CampaignRow[]>>(() => {
    const filtro = this.filtro();
    const filas =
      filtro === 'ALL' ? this.todas() : this.todas().filter((f) => f.campaign.status === filtro);
    return filas.length === 0
      ? empty(
          { label: 'Cambie el filtro para ver otras campañas' },
          'Ninguna campaña coincide con ese filtro.',
        )
      : ready(filas);
  });

  protected readonly columnas = computed<readonly ColumnDef<CampaignRow>[]>(() => [
    { key: 'nombre', header: 'Campaña', priority: 1, cell: this.nombreCell() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.estadoCell() },
    { key: 'avance', header: 'Avance', priority: 1, cell: this.avanceCell() },
    { key: 'vence', header: 'Vencimiento', priority: 2, cell: this.venceCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, cell: this.accionesCell() },
  ]);

  protected readonly rowId = (fila: CampaignRow): string => fila.campaign.id;
  protected readonly rowLabel = (fila: CampaignRow): string => `Campaña ${fila.campaign.name}`;
  protected readonly estadoTexto = (f: CampaignRow): string =>
    campaignStatusText(f.campaign.status);
  protected readonly estadoTono = (f: CampaignRow) => campaignStatusTone(f.campaign.status);
  protected readonly tipo = (f: CampaignRow): string => REVIEW_KIND_LABELS[f.campaign.kind];
  protected readonly alcance = (f: CampaignRow): string => scopeKindText(f.campaign.scope.kind);

  protected readonly cuentaAtras = (
    f: CampaignRow,
  ): { readonly text: string; readonly overdue: boolean } => {
    const c = f.campaign;
    if (c.status === 'CLOSED')
      return { text: `Cerrada el ${formatDay(c.closedAt)}`, overdue: false };
    if (c.status === 'CANCELLED')
      return { text: `Cancelada el ${formatDay(c.cancelledAt)}`, overdue: false };
    return dueCounter(c.dueAt);
  };
  protected readonly fechaLimite = (f: CampaignRow): string => formatDay(f.campaign.dueAt);

  ngOnInit(): void {
    // El tablero enlaza con `?status=overdue` («Certificaciones vencidas»): lo vencido es lo que sigue abierto, así que se filtra por abiertas.
    const pedido = this.route.snapshot.queryParamMap.get('status');
    if (pedido === 'overdue') this.filtro.set('OPEN');
    else if (
      pedido === 'DRAFT' ||
      pedido === 'OPEN' ||
      pedido === 'CLOSED' ||
      pedido === 'CANCELLED'
    )
      this.filtro.set(pedido);
    this.cargar();
  }

  protected cargar(): void {
    const previo = this.state();
    const datosPrevios = hasData(previo) ? previo.data : null;
    if (datosPrevios === null) this.state.set(loading());
    this.client
      .listCampaigns()
      .pipe(map((respuesta) => respuesta.items))
      .subscribe({
        next: (campanias) => this.conAvance(campanias),
        error: (failure: unknown) =>
          this.state.set(
            datosPrevios === null
              ? errorToViewState<readonly CampaignRow[]>(failure)
              : stale(datosPrevios, this.cargadoEn),
          ),
      });
  }

  /** Pide los resultados de cada campaña que ya salió del borrador; una que falla no tira abajo a las demás. */
  private conAvance(campanias: readonly Campaign[]): void {
    const ordenadas = [...campanias].sort(
      (a, b) => ORDEN[a.status] - ORDEN[b.status] || b.dueAt.localeCompare(a.dueAt),
    );
    const pedido = (campaign: Campaign): Observable<CampaignRow> =>
      campaign.status === 'OPEN' || campaign.status === 'CLOSED'
        ? this.client.getCampaignResults(campaign.id).pipe(
            map((r): CampaignRow['progress'] => ({
              coveragePercent: r.coveragePercent,
              pending: r.pending,
              total: r.total,
            })),
            catchError(() => of(null)),
            map((progress): CampaignRow => ({ campaign, progress })),
          )
        : of<CampaignRow>({ campaign, progress: null });
    // El listado de la API no trae conteos: el avance de cada campaña es una petición propia (N+1). Hasta que los traiga se
    // piden de a pocas, no todas juntas, y las filas vuelven a su orden (mergeMap termina en el orden en que responden).
    const orden = new Map(ordenadas.map((c, i) => [c.id, i]));
    from(ordenadas)
      .pipe(
        mergeMap(pedido, CAMPAIGN_RESULTS_CONCURRENCY),
        toArray(),
        map((filas) =>
          [...filas].sort((a, b) => orden.get(a.campaign.id)! - orden.get(b.campaign.id)!),
        ),
      )
      .subscribe((filas) => {
        this.cargadoEn = new Date();
        this.state.set(
          filas.length === 0
            ? empty(
                { label: 'Crear la primera campaña', route: NUEVA },
                'Aún no hay campañas de certificación. Cree una para que cada acceso lo reconfirme quien corresponde.',
              )
            : ready(filas),
        );
      });
  }
}
