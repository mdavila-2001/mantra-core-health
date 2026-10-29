import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState } from '../../../core/data-access/adt/adt.errors';
import { RULE_LABELS } from '../../../core/data-access/adt/adt.catalog';
import type { PlacementIncident, StayMovement, StayView } from '../../../core/data-access/adt/adt.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AdtIssue } from '../shared/adt-issue';
import { BedActions } from '../bed-actions/bed-actions';
import { type BedActionDone } from '../bed-actions/bed-action-dialog';
import { InpatientSites } from '../shared/inpatient-sites';
import {
  antiguedadEnPalabras,
  fechaYHora,
  minutosDesde,
  RUTAS,
  sexoEnPalabras,
  textoDeCama,
  UMBRAL_DE_ATRASO_MIN,
  varianteDeAislamiento,
  varianteDeNivel,
} from '../shared/adt.view';

export const PESTANAS_DE_LA_ESTANCIA = ['Cama actual', 'Movimientos', 'Compatibilidad e incidentes', 'Egreso'] as const;

/**
 * **Ficha de internación** — `/inpatient/stays/:encounterId`.
 *
 * Una tarjeta ancha con pestañas (regla del 09/09/2026): **Cama actual ·
 * Movimientos · Compatibilidad e incidentes · Egreso**. Arriba de las pestañas,
 * dentro de la misma tarjeta, las acciones de cama (`app-bed-actions`): una sola
 * implementación de asignar, reservar, trasladar, intercambiar, dar de alta y
 * cancelar, la misma que el panel del tablero.
 *
 * ## De dónde sale cada dato
 *
 * Todo de `GET /clinical/encounters/:id/stay`: el encuentro, sus `movements[]`
 * (todas las filas de `encounter_locations`, incluidas las reservas y las
 * canceladas) y los incidentes. Cada acción recarga la ficha entera: lo que se
 * ve es lo que el servidor tiene, no lo que la pantalla supone.
 *
 * Los permisos solo reflejan (`viewer`). Sin permiso para ver pacientes la
 * API contesta 403 y la ficha pasa a S5; un encuentro de otro tenant es 404 y
 * pasa a S6 sin revelar nada.
 */
@Component({
  selector: 'app-stay',
  imports: [Alert, AdtIssue, AppButton, Badge, BedActions, Card, DataTable, PageHeader, RouterLink, Tab, Tabs, ViewStateHost],
  templateUrl: './stay.html',
  styleUrl: './stay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stay {
  private readonly client = inject(AdtClient);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  protected readonly sites = inject(InpatientSites);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly id = computed(() => this.params().get('encounterId') ?? '');
  protected readonly esNuevo = computed(() => this.query().get('nuevo') === '1');

  protected readonly pestanas = PESTANAS_DE_LA_ESTANCIA;
  protected readonly pestana = signal(0);

  protected readonly state = signal<ViewState<StayView>>(routeAuthPending());
  protected readonly ficha = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly encuentro = computed(() => this.ficha()?.encounter ?? null);
  protected readonly siteId = computed(() => this.encuentro()?.siteId ?? this.sites.siteId());
  protected readonly enCurso = computed(() => this.encuentro()?.status.code === 'IN_PROGRESS');
  protected readonly puedeRevisar = computed(() => this.ficha()?.viewer?.canReviewIncidents === true);

  protected readonly acciones = viewChild(BedActions);
  protected readonly accionAbierta = signal<BedActionDone | null>(null);
  protected readonly problema = signal<ViewState<unknown> | null>(null);
  protected readonly revisando = signal<string | null>(null);

  protected readonly movimientos = computed<ViewState<readonly StayMovement[]>>(() => {
    const f = this.ficha();
    if (f === null) return loading();
    if (f.movements.length === 0) {
      return empty({ label: 'Asignar una cama desde las acciones' }, 'Esta internación todavía no tiene movimientos: está pendiente de cama.');
    }
    return ready(f.movements);
  });

  private readonly celdaMovimiento = viewChild.required<TemplateRef<{ $implicit: StayMovement }>>('celdaMovimiento');
  private readonly celdaCama = viewChild.required<TemplateRef<{ $implicit: StayMovement }>>('celdaCama');
  private readonly celdaDesde = viewChild.required<TemplateRef<{ $implicit: StayMovement }>>('celdaDesde');
  private readonly celdaHasta = viewChild.required<TemplateRef<{ $implicit: StayMovement }>>('celdaHasta');
  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: StayMovement }>>('celdaEstado');

  protected readonly columnas = computed<readonly ColumnDef<StayMovement>[]>(() => [
    { key: 'movimiento', header: 'Movimiento', priority: 1, cell: this.celdaMovimiento() },
    { key: 'cama', header: 'Cama', priority: 1, cell: this.celdaCama() },
    { key: 'desde', header: 'Desde', priority: 2, cell: this.celdaDesde() },
    { key: 'hasta', header: 'Hasta', priority: 2, cell: this.celdaHasta() },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
  ]);

  protected readonly porMovimiento = (m: StayMovement): string => m.id;
  protected readonly fechaYHora = fechaYHora;
  protected readonly textoDeCama = textoDeCama;
  protected readonly sexo = sexoEnPalabras;
  protected readonly nivel = varianteDeNivel;
  protected readonly aislamiento = varianteDeAislamiento;
  protected readonly regla = (r: keyof typeof RULE_LABELS): string => RULE_LABELS[r];
  protected readonly rutaCenso = RUTAS.censo;
  protected readonly rutaIngreso = RUTAS.ingreso;

  protected readonly breadcrumbs = computed(() => [
    { label: 'Internación' },
    { label: 'Censo', routerLink: RUTAS.censo },
    { label: this.encuentro()?.patient.name ?? 'Ficha de internación' },
  ]);

  protected readonly antiguedad = computed(() => {
    const f = this.ficha();
    return f === null ? '' : antiguedadEnPalabras(minutosDesde(f.asOf));
  });

  constructor() {
    this.sites.load();
    effect(() => {
      const id = this.id();
      const tenant = this.session.activeTenantId();
      untracked(() => (tenant === null ? this.state.set(routeAuthPending()) : id !== '' && this.cargar()));
    });
  }

  protected cargar(): void {
    const id = this.id();
    if (id === '') return;
    if (this.session.activeTenantId() === null) {
      this.state.set(routeAuthPending());
      return;
    }
    if (this.ficha() === null) this.state.set(loading());
    this.client.getStay(id).subscribe({
      next: (f) => this.state.set(minutosDesde(f.asOf) >= UMBRAL_DE_ATRASO_MIN ? stale(f, new Date(f.asOf)) : ready(f)),
      error: (e: unknown) => this.state.set(adtErrorToViewState<StayView>(e)),
    });
  }

  protected alCambiar(r: BedActionDone): void {
    this.accionAbierta.set(r);
    this.cargar();
  }

  protected abrirEgreso(): void {
    this.acciones()?.abrir('discharge');
  }

  protected async revisar(incidente: PlacementIncident, estado: 'REVIEWED' | 'CLOSED'): Promise<void> {
    const nota = await this.dialogs.confirmWithReason(
      {
        title: estado === 'REVIEWED' ? 'Marcar el incidente como revisado' : 'Cerrar el incidente',
        message: `Cama ${incidente.bed.code}: ${incidente.violations.map((v) => this.regla(v.rule)).join(', ')}. Queda registrado quién lo revisó y cuándo.`,
        confirmLabel: estado === 'REVIEWED' ? 'Marcar como revisado' : 'Cerrar incidente',
      },
      { label: 'Nota de revisión', hint: 'Qué se verificó.', minLength: 10, maxLength: 500 },
    );
    if (nota === null) return;
    this.revisando.set(incidente.id);
    this.problema.set(null);
    this.client.reviewIncident(incidente.id, { status: estado, reviewNote: nota }).subscribe({
      next: () => {
        this.revisando.set(null);
        this.cargar();
      },
      error: (e: unknown) => {
        this.revisando.set(null);
        this.problema.set(adtErrorToViewState<unknown>(e));
      },
    });
  }

  protected varianteDeIncidente(code: string): 'error' | 'warning' | 'success' {
    return code === 'PLC_INC_OPEN' ? 'error' : code === 'PLC_INC_REVIEWED' ? 'warning' : 'success';
  }

  protected varianteDeMovimiento(code: string): 'success' | 'primary' | 'secondary' | 'info' {
    return code === 'LOCATION_ACTIVE' ? 'success' : code === 'LOCATION_RESERVED' ? 'info' : code === 'LOCATION_COMPLETED' ? 'primary' : 'secondary';
  }
}
