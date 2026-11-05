import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';

import { CenterScheduleClient } from '../../../core/data-access/diagnostic-units/center-schedule.client';
import type { CenterScheduleView } from '../../../core/data-access/diagnostic-units/center-schedule.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { EquipmentTab } from './equipment-tab/equipment-tab';
import { OccupancyTab } from './occupancy-tab/occupancy-tab';
import { ScheduleTab } from './schedule-tab/schedule-tab';

/* ============================================================================
    «Horarios y equipos» of a diagnostic center.

    Every device that gives appointments is a production line: it attends in
    its own hours or in the inherited ones, and what the patient sees is the
    sum of the operational devices of each modality. The page loads the center
    once and every tab hands back the view the server answers after a change:

      - «Horarios»: the general schedule, the one of modalities without
        devices and the study exceptions;
      - «Equipos»: register from the catalog, status, own hours and removal;
      - «Ocupación»: the day of each device.
    ========================================================================== */

@Component({
  selector: 'app-center-schedule',
  imports: [PageHeader, ViewStateHost, Card, Tabs, Tab, ScheduleTab, EquipmentTab, OccupancyTab],
  templateUrl: './center-schedule.html',
  styleUrl: './center-schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CenterSchedulePage implements OnInit {
  private readonly client = inject(CenterScheduleClient);
  private readonly navigation = inject(NavigationService);

  protected readonly state = signal<ViewState<CenterScheduleView>>(loading());
  protected readonly tab = signal(0);

  protected readonly center = computed<CenterScheduleView | null>(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  /** The Glossary belongs to whoever attends; without it, the data map reads without links. */
  protected readonly linkGlossary = computed(() => this.navigation.visibleSections().some((s) => s.path === 'glossary'));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.client.getMySchedule().subscribe({
      next: (view) => this.state.set(ready(view)),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  protected apply(view: CenterScheduleView): void {
    this.state.set(ready(view));
  }
}
