import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { MedicalGroupsClient } from '../../../core/data-access/medical-groups/medical-groups.client';
import {
  MEDICAL_GROUP_TABS,
  type MedicalGroupListItem,
  type MedicalGroupTab,
} from '../../../core/data-access/medical-groups/medical-groups.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { DATE_TIME_FORMAT, GROUP_STATUS_LABEL } from '../medical-groups.labels';
import {
  MEDICAL_GROUP_NEW_ROUTE,
  MEDICAL_GROUPS_ROUTE,
  medicalGroupRoute,
} from '../medical-groups.routes';

/** Las dos direcciones que el paginador de la tabla puede pedir. */
const NEXT = 'next';
const PREV = 'prev';

/** El texto de cada vacío: qué significa que la pestaña no tenga nada. */
const EMPTY_TEXT: Readonly<Record<MedicalGroupTab, string>> = {
  historico: 'Todavía no creó ni integró ningún grupo médico.',
  enviadas: 'No tiene invitaciones enviadas esperando respuesta.',
  recibidas: 'No tiene invitaciones por responder.',
};

/**
 * **Grupos médicos** (FT-21, carril 21) — el listado, en tres pestañas.
 *
 * Las pestañas son las tres lecturas que la API sabe hacer (`?tab=`):
 * - **Histórico** (por defecto): los grupos que creó y los que integra.
 * - **Solicitudes enviadas**: los que creó y todavía esperan respuesta de alguien.
 * - **Solicitudes recibidas**: las invitaciones que tiene que responder.
 *
 * La pestaña viaja en la URL (`?tab=`) para que recargar o compartir el enlace
 * deje a la persona donde estaba. Cada pestaña se lee la primera vez que se
 * abre, no al entrar: quien sólo mira el histórico no paga las otras dos.
 */
@Component({
  selector: 'app-medical-group-list',
  imports: [Alert, AppButton, AppButtonLink, Badge, DataTable, PageHeader, RouterLink, Tab, Tabs],
  templateUrl: './medical-group-list.html',
  styleUrl: './medical-group-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupList {
  private readonly groups = inject(MedicalGroupsClient);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly newGroupRoute = MEDICAL_GROUP_NEW_ROUTE;
  protected readonly tabs = MEDICAL_GROUP_TABS;

  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('statusCell');
  private readonly dateCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('dateCell');
  private readonly serviceCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('serviceCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupListItem }>>('actionsCell');

  /** La pestaña abierta: la de la URL, o el histórico. */
  protected readonly selectedIndex = signal(this.indexFromUrl());

  /** El estado de cada pestaña, con el cursor que la trajo. */
  protected readonly pages = signal<
    Readonly<Record<MedicalGroupTab, ViewState<readonly MedicalGroupListItem[]> | null>>
  >({ historico: null, enviadas: null, recibidas: null });
  /**
   * Por pestaña, la pila de cursores que trajo cada página visitada (la
   * primera es `null`) y el cursor de la siguiente. La API sólo avanza; volver
   * es releer el cursor anterior de la pila.
   */
  private readonly trails = signal<
    Readonly<
      Record<
        MedicalGroupTab,
        { readonly trail: readonly (string | null)[]; readonly next: string | null }
      >
    >
  >({
    historico: { trail: [null], next: null },
    enviadas: { trail: [null], next: null },
    recibidas: { trail: [null], next: null },
  });

  protected readonly columns = computed<readonly ColumnDef<MedicalGroupListItem>[]>(() => [
    { key: 'serviceName', header: 'Servicio', priority: 1, cell: this.serviceCell() },
    { key: 'scheduledAt', header: 'Fecha y hora', priority: 1, cell: this.dateCell() },
    { key: 'locationText', header: 'Lugar', priority: 2 },
    { key: 'status', header: 'Estado', priority: 1, cell: this.statusCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, align: 'end', cell: this.actionsCell() },
  ]);

  protected readonly byId = (row: MedicalGroupListItem): string => row.id;
  protected readonly rowName = (row: MedicalGroupListItem): string =>
    row.serviceName ?? 'Grupo médico';
  protected statusOf(
    group: MedicalGroupListItem,
  ): (typeof GROUP_STATUS_LABEL)[MedicalGroupListItem['status']] {
    return GROUP_STATUS_LABEL[group.status];
  }
  protected readonly format = (date: Date): string => DATE_TIME_FORMAT.format(date);
  protected readonly detailRoute = medicalGroupRoute;

  constructor() {
    // Al abrir una pestaña por primera vez, se lee; y la URL acompaña.
    effect(() => {
      const tab = this.tabs[this.selectedIndex()] ?? 'historico';
      untracked(() => {
        if (this.pages()[tab] === null) this.load(tab);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { tab: tab === 'historico' ? null : tab },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      });
    });
  }

  protected stateOf(tab: MedicalGroupTab): ViewState<readonly MedicalGroupListItem[]> {
    return this.pages()[tab] ?? loading();
  }

  protected cursorOf(tab: MedicalGroupTab): {
    prevCursor: string | null;
    nextCursor: string | null;
  } {
    const { trail, next } = this.trails()[tab];
    return { prevCursor: trail.length > 1 ? PREV : null, nextCursor: next === null ? null : NEXT };
  }

  protected goToCursor(tab: MedicalGroupTab, direction: string): void {
    const { trail, next } = this.trails()[tab];
    const moved = direction === NEXT && next !== null ? [...trail, next] : trail.slice(0, -1);
    this.load(tab, moved.length > 0 ? moved : [null]);
  }

  protected retry(tab: MedicalGroupTab): void {
    this.load(tab, this.trails()[tab].trail);
  }

  /**
   * Eliminar se ofrece al creador mientras el grupo no se realizó ni se cerró.
   * La API vuelve a validarlo: acá sólo se decide qué mostrar.
   */
  protected canDelete(group: MedicalGroupListItem): boolean {
    return group.isCreator && group.status !== 'CLOSED' && group.scheduledAt.getTime() > Date.now();
  }

  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected async remove(group: MedicalGroupListItem): Promise<void> {
    if (this.deleting()) return;
    const confirmed = await this.dialogs.confirm({
      title: '¿Eliminar el grupo médico?',
      message: `Se elimina «${group.serviceName ?? 'Grupo médico'}» del ${DATE_TIME_FORMAT.format(group.scheduledAt)} y todo su equipo. No se puede deshacer.`,
      confirmLabel: 'Eliminar grupo',
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.groups.remove(group.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toasts.success('El grupo médico quedó eliminado.');
        // El grupo pudo estar en las tres pestañas: se vuelven a leer al abrirlas.
        const current = this.tabs[this.selectedIndex()] ?? 'historico';
        this.pages.set({ historico: null, enviadas: null, recibidas: null });
        this.load(current);
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.deleteError.set(
          error instanceof HttpErrorResponse && (readApiError(error)?.message ?? '') !== ''
            ? readApiError(error)!.message
            : 'No pudimos eliminar el grupo. Pruebe de nuevo.',
        );
      },
    });
  }

  protected open(row: MedicalGroupListItem): void {
    void this.router.navigateByUrl(medicalGroupRoute(row.id));
  }

  private load(tab: MedicalGroupTab, trail: readonly (string | null)[] = [null]): void {
    this.setPage(tab, loading());
    this.groups.list(tab, trail.at(-1) ?? undefined).subscribe({
      next: (page) => {
        this.trails.update((all) => ({ ...all, [tab]: { trail, next: page.nextCursor } }));
        this.setPage(
          tab,
          page.items.length > 0
            ? ready(page.items)
            : empty(
                tab === 'historico'
                  ? { label: 'Crear grupo médico', route: MEDICAL_GROUP_NEW_ROUTE }
                  : { label: 'Ver el histórico', route: MEDICAL_GROUPS_ROUTE },
                EMPTY_TEXT[tab],
              ),
        );
      },
      error: (error: unknown) =>
        this.setPage(tab, errorToViewState<readonly MedicalGroupListItem[]>(error)),
    });
  }

  private setPage(tab: MedicalGroupTab, state: ViewState<readonly MedicalGroupListItem[]>): void {
    this.pages.update((all) => ({ ...all, [tab]: state }));
  }

  private indexFromUrl(): number {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    const index = MEDICAL_GROUP_TABS.indexOf(tab as MedicalGroupTab);
    return index < 0 ? 0 : index;
  }
}
