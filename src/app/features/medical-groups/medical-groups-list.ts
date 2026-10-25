import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  type OnInit,
  signal,
  viewChild,
} from '@angular/core';
import type { TemplateRef } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import type {
  MedicalGroupListItem,
  MedicalGroupTab,
} from '../../core/data-access/medical-groups/medical-groups.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { mapData } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { LIST_TABS, statusLabel, statusTone } from './medical-group-labels';
import {
  MEDICAL_GROUP_NEW_ROUTE,
  MEDICAL_GROUP_TAB_QUERY_PARAM,
  medicalGroupRoute,
} from './medical-groups.routes';
import { MedicalGroupsService } from './medical-groups.service';

/**
 * **Grupos médicos** (FT-21) — los equipos que armó o a los que lo invitaron.
 *
 * Las tres pestañas son el mismo listado de la API con otro `tab`
 * (`histórico`, `enviadas`, `recibidas`): una sola tabla, una sola lectura por
 * vez. Abrir una fila lleva a la ficha; en «recibidas» el botón lleva directo a
 * la pestaña donde se responde la invitación.
 */
@Component({
  selector: 'app-medical-groups-list',
  imports: [
    AppButton,
    AppButtonLink,
    Badge,
    DataTable,
    DatePipe,
    NgTemplateOutlet,
    PageHeader,
    RouterLink,
    Tab,
    Tabs,
  ],
  templateUrl: './medical-groups-list.html',
  styleUrl: './medical-groups-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupsList implements OnInit {
  private readonly service = inject(MedicalGroupsService);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly newRoute = MEDICAL_GROUP_NEW_ROUTE;
  protected readonly tabs = LIST_TABS;
  protected readonly statusLabel = statusLabel;
  protected readonly statusTone = statusTone;

  protected readonly selectedIndex = signal(0);
  protected readonly loadingMore = this.service.loadingMore;
  protected readonly activeTab = computed<MedicalGroupTab>(
    () => LIST_TABS[this.selectedIndex()]?.id ?? 'historico',
  );

  private readonly actionCell = viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('actionCell');
  private readonly statusCell = viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('statusCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('dateCell');
  private readonly serviceCell = viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('serviceCell');
  private readonly roleCell = viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('roleCell');

  protected readonly rows = computed<ViewState<readonly MedicalGroupListItem[]>>(() =>
    mapData(this.service.listing(), (listing) => listing.items),
  );

  protected readonly hasMore = computed(() => {
    const state = this.service.listing();
    return state.status === 'ready' && state.data.nextCursor !== null;
  });

  protected readonly columns = computed<readonly ColumnDef<MedicalGroupListItem>[]>(() => [
    { key: 'scheduledAt', header: 'Fecha y hora', priority: 1, cell: this.dateCell() },
    { key: 'service', header: 'Servicio', priority: 1, cell: this.serviceCell() },
    { key: 'locationText', header: 'Lugar', priority: 2 },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'role', header: 'Su lugar', priority: 2, cell: this.roleCell() },
    { key: 'pendingMembersCount', header: 'Sin responder', priority: 2, align: 'end' },
    { key: 'action', header: '', priority: 1, accion: true, cell: this.actionCell() },
  ]);

  protected readonly trackBy = (row: MedicalGroupListItem): string => row.id;
  protected readonly rowLabel = (row: MedicalGroupListItem): string =>
    `Grupo médico del ${row.scheduledAt}`;

  ngOnInit(): void {
    this.service.loadList(this.activeTab());
  }

  protected changeTab(index: number): void {
    this.selectedIndex.set(index);
    this.service.loadList(this.activeTab());
  }

  protected reload(): void {
    this.service.loadList(this.activeTab());
  }

  protected loadMore(): void {
    this.service.loadMore();
  }

  protected serviceName(row: MedicalGroupListItem): string {
    return this.service.labelOf(row.serviceCatalogId, 'Servicio del catálogo');
  }

  protected open(row: MedicalGroupListItem): void {
    void this.router.navigate([medicalGroupRoute(row.id)]);
  }

  /** En «recibidas» la acción lleva a la pestaña donde se responde. */
  protected actionLabel(row: MedicalGroupListItem): string {
    return !row.isCreator && row.status === 'PENDING_TEAM' ? 'Responder' : 'Abrir';
  }

  protected actionQuery(row: MedicalGroupListItem): Record<string, string> {
    return !row.isCreator && row.status === 'PENDING_TEAM'
      ? { [MEDICAL_GROUP_TAB_QUERY_PARAM]: 'equipo' }
      : {};
  }

  protected route(row: MedicalGroupListItem): string {
    return medicalGroupRoute(row.id);
  }
}
