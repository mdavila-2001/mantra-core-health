import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { OpsConsoleClient } from '../../../core/data-access/admin-portal/platform.client';
import type {
  BackupPolicy,
  Deployment,
  Incident,
  Readiness,
  SloStatus,
} from '../../../core/data-access/admin-portal/platform.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conceptStatus, controlStatus, entero, porcentaje, readinessStatus } from '../platform/platform-labels';

/**
 * Consola de operación: preparación para producción con evidencia por control,
 * incidentes, despliegues, SLO y backups. El veredicto lo da el servidor y no
 * promedia: un control bloqueante en falla o sin evidencia impide «lista».
 */
@Component({
  selector: 'app-operations',
  imports: [DatePipe, AppButton, Badge, Alert, Card, Tabs, Tab, PageHeader, ViewStateHost],
  templateUrl: './operations.html',
  styleUrl: './operations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Operations {
  private readonly ops = inject(OpsConsoleClient);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly controlStatus = controlStatus;
  protected readonly readinessStatus = readinessStatus;
  protected readonly conceptStatus = conceptStatus;
  protected readonly porcentaje = porcentaje;
  protected readonly entero = entero;

  protected readonly pestana = signal(0);
  protected readonly preparacion = signal<ViewState<Readiness>>(loading());
  protected readonly incidentes = signal<ViewState<readonly Incident[]>>(loading());
  protected readonly despliegues = signal<ViewState<readonly Deployment[]>>(loading());
  protected readonly slos = signal<ViewState<readonly SloStatus[]>>(loading());
  protected readonly backups = signal<ViewState<readonly BackupPolicy[]>>(loading());

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.preparacion.set(loading());
    this.ops.readiness().subscribe({
      next: (r) => this.preparacion.set(ready(r)),
      error: (e: unknown) => this.preparacion.set(errorToViewState<Readiness>(e)),
    });
    this.ops.incidents().subscribe({
      next: (l) => this.incidentes.set(l.length ? ready(l) : empty({ label: 'Sin acción pendiente.' }, 'No hay incidentes registrados.')),
      error: (e: unknown) => this.incidentes.set(errorToViewState<readonly Incident[]>(e)),
    });
    this.ops.deployments().subscribe({
      next: (l) => this.despliegues.set(l.length ? ready(l) : empty({ label: 'Sin acción pendiente.' }, 'No hay despliegues registrados.')),
      error: (e: unknown) => this.despliegues.set(errorToViewState<readonly Deployment[]>(e)),
    });
    this.ops.slos().subscribe({
      next: (l) =>
        this.slos.set(l.length ? ready(l) : empty({ label: 'Definí SLO en la operación de plataforma.' }, 'No hay SLO activos: sin ellos la preparación queda sin evidencia.')),
      error: (e: unknown) => this.slos.set(errorToViewState<readonly SloStatus[]>(e)),
    });
    this.ops.backups().subscribe({
      next: (l) =>
        this.backups.set(l.length ? ready(l) : empty({ label: 'Definí una política de backup.' }, 'No hay políticas de backup activas.')),
      error: (e: unknown) => this.backups.set(errorToViewState<readonly BackupPolicy[]>(e)),
    });
  }

  protected listaDe<T>(estado: ViewState<readonly T[]>): readonly T[] {
    return estado.status === 'ready' ? estado.data : [];
  }

  protected horas(segundos: number | null): string {
    if (segundos === null) return '—';
    return segundos >= 3600 ? `${(segundos / 3600).toLocaleString('es-BO', { maximumFractionDigits: 1 })} h` : `${Math.round(segundos / 60)} min`;
  }
}
