import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, type OnInit } from '@angular/core';
import { forkJoin, type Observable } from 'rxjs';

import { SupportStaffClient } from '../../../core/data-access/support-staff/support-staff.client';
import {
  awaitingText,
  targetLabel,
  type SupportCatalog,
  type SupportLink,
} from '../../../core/data-access/support-staff/support-staff.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { SupportInvitePanel } from '../shared/invite-panel/invite-panel';
import { supportFailureMessage } from '../shared/support-failure';

/** Lo que la pantalla lee del hospital activo. */
export interface SupportStaffAdminData {
  readonly requests: readonly SupportLink[];
  readonly engagements: readonly SupportLink[];
  readonly catalog: SupportCatalog;
}

/** Una secretaria del hospital, con sus vínculos activos y pendientes. */
export interface TeamMember {
  readonly userId: string;
  readonly personName: string;
  readonly active: readonly SupportLink[];
  readonly pending: readonly SupportLink[];
}

/** Agrupa los vínculos del hospital por secretaria, en orden alfabético. */
export function teamOf(links: readonly SupportLink[]): readonly TeamMember[] {
  const porPersona = new Map<string, SupportLink[]>();
  for (const link of links) {
    if (link.status !== 'ACTIVE' && link.status !== 'PENDING') continue;
    porPersona.set(link.userId, [...(porPersona.get(link.userId) ?? []), link]);
  }
  return [...porPersona.entries()]
    .map(([userId, propios]) => ({
      userId,
      personName: propios.find((l) => l.personName !== null)?.personName ?? 'Persona de apoyo',
      active: propios.filter((l) => l.status === 'ACTIVE'),
      pending: propios.filter((l) => l.status === 'PENDING'),
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName, 'es'));
}

/**
 * **Personal de apoyo** del hospital (`/administration/support-staff`).
 *
 * La mitad del hospital en la solicitud y aceptación de una secretaria:
 *
 * - **Solicitudes**: lo que una secretaria pidió —un doctor, un piso— y espera
 *   que el hospital acepte o rechace. Un pedido a un doctor también lo puede
 *   decidir el doctor.
 * - **Equipo**: las secretarias del hospital con sus doctores y pisos, y lo que
 *   todavía espera; terminar un vínculo.
 * - **Invitar**: por documento, con los doctores y pisos que le tocan. Ella acepta.
 *
 * La API exige administrar el hospital activo y decide cada operación; esta
 * pantalla no autoriza nada.
 */
@Component({
  selector: 'app-support-staff-admin',
  imports: [Alert, AnnounceOnAppear, AppButton, Badge, Card, DatePipe, PageHeader, SupportInvitePanel, Tab, Tabs, ViewStateHost],
  templateUrl: './support-staff-admin.html',
  styleUrl: './support-staff-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportStaffAdmin implements OnInit {
  private readonly client = inject(SupportStaffClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tab = signal(0);
  protected readonly state = signal<ViewState<SupportStaffAdminData>>(loading());
  protected readonly data = computed(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : null;
  });
  protected readonly team = computed(() => teamOf(this.data()?.engagements ?? []));
  protected readonly busyId = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly targetLabel = targetLabel;
  protected readonly awaitingText = awaitingText;

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.state.set(loading());
    forkJoin({
      requests: this.client.listRequests('PENDING'),
      engagements: this.client.listEngagements(),
      catalog: this.client.getOrgCatalog(),
    }).subscribe({
      next: (data) => this.state.set(ready(data)),
      error: (failure: unknown) => this.state.set(errorToViewState<SupportStaffAdminData>(failure)),
    });
  }

  protected approve(link: SupportLink): void {
    this.act(
      link,
      this.client.decide(link.id, { decision: 'APPROVED' }),
      `Aceptó: ${link.personName ?? 'la secretaria'} ya trabaja con ${targetLabel(link)}.`,
    );
  }

  protected reject(link: SupportLink): void {
    this.act(link, this.client.decide(link.id, { decision: 'REJECTED' }), 'Rechazó la solicitud.');
  }

  protected end(link: SupportLink): void {
    this.act(link, this.client.endEngagement(link.id), `Terminó el vínculo con ${targetLabel(link)}.`);
  }

  protected invited(): void {
    this.notice.set(null);
    this.reload();
  }

  private act(link: SupportLink, operation: Observable<SupportLink>, ok: string): void {
    if (this.busyId() !== null) return;
    this.busyId.set(link.id);
    this.error.set(null);
    this.notice.set(null);
    operation.subscribe({
      next: () => {
        this.busyId.set(null);
        this.notice.set(ok);
        this.reload();
      },
      error: (failure: unknown) => {
        this.busyId.set(null);
        this.error.set(supportFailureMessage(failure));
      },
    });
  }
}
