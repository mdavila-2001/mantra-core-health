import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, filter, forkJoin, map, of, switchMap } from 'rxjs';

import { EquipmentLocationClient } from '../../../../core/data-access/diagnostic-units/equipment-location.client';
import { aeTitleProblem, type LocatedEquipment, type MwlStation } from '../../../../core/data-access/diagnostic-units/equipment-location.types';
import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceNode, InfrastructureCatalog } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, loading, ready, routeAuthPending } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

const TABS = ['general', 'location', 'schedule'] as const;
const NO_ROOM = '';

/** Las salas que pueden alojar este equipo: perfil `hostsEquipment` (imagen: sala de imagenología). */
export function hostRoomsFor(equipment: LocatedEquipment, spaces: readonly CareSpaceNode[], catalog: InfrastructureCatalog): readonly CareSpaceNode[] {
  const hosts = new Set(catalog.functions.filter((f) => f.hostsEquipment).map((f) => f.code));
  return spaces.filter(
    (s) => s.status.code === 'SPACE_ACTIVE' && hosts.has(s.function.code) && (equipment.modality === null || s.function.code === 'SPACE_FN_IMAGING_ROOM'),
  );
}

/**
 * **Ficha del equipo** — sala, DICOM y agenda (F5a).
 *
 * Una tarjeta con tres pestañas (regla 6): General · Ubicación y DICOM ·
 * Agenda. La sala se elige entre los espacios **de la misma sede** que pueden
 * alojar el equipo (perfil `hostsEquipment`; los de imagen, sala de
 * imagenología); el AE Title se valida con la regla DICOM antes de enviar.
 * La API decide: 422 `EQUIPMENT_SPACE_SITE_MISMATCH` / `SPACE_CANNOT_HOST_EQUIPMENT`
 * / `AE_TITLE_INVALID`, 409 `AE_TITLE_TAKEN`.
 *
 * ## Formas de la API
 *
 * `GET /diagnostic-equipment/:id` (forma `LocatedEquipment`), `POST …/resource`
 * (`{equipmentId, resourceId}`) y `GET …/mwl-station` (F5a). El `PATCH`
 * devuelve un DTO plano (`EquipmentResponseDto`), así que después de guardar
 * se **relee** el equipo. Si la estación MWL no se puede leer, se dice con su
 * estado (S5/S9), no se esconde el bloque.
 *
 * Sin compuerta por rol: desde `e46739aaa` el `PATCH` lo autoriza el
 * evaluador de §0.3 (Admin de organización o sucursal todo; Mantenimiento sólo
 * el estado). La API responde 403 y se pinta en el aviso.
 */
@Component({
  selector: 'app-equipment-detail',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, FactList, FormField, Input, PageHeader, RouterLink, Select, Tab, Tabs, ViewStateHost],
  templateUrl: './equipment-detail.html',
  styleUrl: './equipment-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EquipmentDetail {
  private readonly client = inject(EquipmentLocationClient);
  private readonly infrastructure = inject(InfrastructureClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  private readonly id = computed(() => this.params().get('id') ?? '');
  private readonly reloads = signal(0);
  protected readonly mwl = signal<ViewState<MwlStation>>(loading());
  protected readonly tab = linkedSignal<number>(() => Math.max(0, TABS.indexOf(this.query().get('tab') as (typeof TABS)[number])));

  protected readonly state = signal<ViewState<LocatedEquipment>>(routeAuthPending());
  protected readonly rooms = signal<readonly CareSpaceNode[]>([]);
  protected readonly saving = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly saved = signal(false);

  protected readonly roomChoice = signal<string>(NO_ROOM);
  protected readonly aeTitle = signal('');
  protected readonly stationName = signal('');

  protected readonly equipment = computed(() => dataOf(this.state()));
  protected readonly mwlData = computed(() => dataOf(this.mwl()));
  protected readonly aeProblem = computed(() => aeTitleProblem(this.aeTitle()));

  protected readonly roomOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: NO_ROOM, label: 'Sin sala asignada' },
    ...this.rooms().map((r) => ({ value: r.id, label: `${r.code} · ${r.name}`, description: r.function.display })),
  ]);

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const e = this.equipment();
    if (e === null) return [];
    return [
      { etiqueta: 'Equipo', valor: e.type.display },
      { etiqueta: 'Fabricante y modelo', valor: [e.manufacturer, e.model].filter(Boolean).join(' · ') || null },
      { etiqueta: 'Número de serie', valor: e.serialNumber },
      { etiqueta: 'Modalidad DICOM', valor: e.modality === null ? null : `${e.modality.code} · ${e.modality.display}` },
      { etiqueta: 'Estado operativo', valor: e.operationalStatus.display, tono: e.operationalStatus.code === 'DU_EQ_OPERATIONAL' ? 'ok' : 'aviso' },
      { etiqueta: 'Sucursal', valor: e.diagnosticUnitSiteName },
      { etiqueta: 'Sala', valor: e.careSpace?.path ?? 'Sin sala asignada', tono: e.careSpace === null ? 'aviso' : 'ok' },
      { etiqueta: 'AE Title', valor: e.aeTitle },
    ];
  });

  constructor() {
    // Una lectura por clave (equipo, reintento); `switchMap` cancela la anterior.
    toObservable(computed(() => ({ id: this.id(), n: this.reloads() })))
      .pipe(
        filter((k) => k.id !== ''),
        switchMap(({ id }) =>
          this.client.get(id).pipe(
            map((e) => ready(e) as ViewState<LocatedEquipment>),
            catchError((error: unknown) => of(errorToViewState<LocatedEquipment>(error))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => {
        this.state.set(s);
        const e = dataOf(s);
        if (e !== null) this.apply(e);
      });
  }

  protected createResource(): void {
    const e = this.equipment();
    if (e === null || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.client.createResource(e.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  protected changeTab(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { tab: TABS[index] ?? null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected reload(): void {
    if (this.state().status !== 'ready') this.state.set(loading());
    this.reloads.update((n) => n + 1);
  }

  protected save(): void {
    const e = this.equipment();
    if (e === null || this.aeProblem() !== null || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.saved.set(false);
    this.client
      .update(e.id, { careSpaceId: this.roomChoice() === NO_ROOM ? null : this.roomChoice(), aeTitle: this.aeTitle().trim() === '' ? null : this.aeTitle(), stationName: this.stationName().trim() === '' ? null : this.stationName().trim() })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.set(true);
          // El PATCH devuelve un DTO plano: lo que se pinta sale de releer.
          this.reload();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.failure.set(errorToViewState<never>(error));
        },
      });
  }

  private apply(e: LocatedEquipment): void {
    this.roomChoice.set(e.careSpace?.id ?? NO_ROOM);
    this.aeTitle.set(e.aeTitle ?? '');
    this.stationName.set(e.stationName ?? '');
    this.mwl.set(loading());
    this.client.getMwlStation(e.id).subscribe({
      next: (m) => this.mwl.set(ready(m)),
      error: (error: unknown) => this.mwl.set(errorToViewState<MwlStation>(error)),
    });
    forkJoin({ structure: this.infrastructure.getStructure(e.siteId), catalog: this.infrastructure.getCatalog() })
      .pipe(catchError(() => of(null)))
      .subscribe((r) => this.rooms.set(r === null ? [] : hostRoomsFor(e, r.structure.spaces, r.catalog)));
  }
}
