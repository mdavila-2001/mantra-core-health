import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, TemplateRef, untracked, viewChild } from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import { CENSUS_FIELD_LABELS } from '../../../core/data-access/adt/adt.catalog';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState, readAdtError } from '../../../core/data-access/adt/adt.errors';
import { CENSUS_FIELDS, type CensusField, type CensusResponse, type CensusUnitView } from '../../../core/data-access/adt/adt.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AdtIssue } from '../shared/adt-issue';
import { antiguedadEnPalabras, fechaCorta, fechaYHora, minutosDesde, RUTAS, UMBRAL_DE_ATRASO_MIN } from '../shared/adt.view';
import { InpatientSites } from '../shared/inpatient-sites';
import { SiteSwitcher } from '../shared/site-switcher/site-switcher';
import { CensusAdjustDialog } from './census-adjust-dialog';

/** Una fila de la tabla de una unidad: un dato del censo, su snapshot y su valor ajustado. */
export interface FilaDeCenso {
  readonly unidadId: string;
  readonly campo: CensusField;
  readonly etiqueta: string;
  readonly snapshot: number;
  readonly ajustado: number;
  readonly ajustes: number;
}

/** Hoy en la zona de la sede (UTC−4), como `YYYY-MM-DD`. */
export function hoyEnLaSede(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
}

function aFecha(texto: string): Date {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a!, m! - 1, d!);
}

function aTexto(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/**
 * **Censo diario** — `/inpatient/census`.
 *
 * Un día, un establecimiento, una tabla por unidad. El día **abierto** muestra
 * una *vista previa calculada* (no se guarda; cambia con cada movimiento); al
 * cerrarlo se congela en un snapshot **inmutable**. Una corrección posterior
 * es un *ajuste* con motivo, autor y código de soporte: el número original no
 * se reescribe nunca en pantalla, se muestra «original → ajustado».
 *
 * Quién puede cerrar o ajustar lo declara la API (`viewer`); la pantalla solo
 * refleja. Cerrar un día que no terminó, o uno ya cerrado, lo rechaza el
 * servidor (422 `CENSUS_DATE_NOT_ENDED`, 409 `CENSUS_ALREADY_CLOSED`) y acá se
 * dice con sus palabras.
 */
@Component({
  selector: 'app-census',
  imports: [Alert, AdtIssue, AppButton, Card, CensusAdjustDialog, DataTable, DatePicker, PageHeader, RouterLink, SiteSwitcher, StatusSeal, ViewStateHost],
  templateUrl: './census.html',
  styleUrl: './census.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Census {
  private readonly client = inject(AdtClient);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);
  protected readonly sites = inject(InpatientSites);
  private readonly consulta = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly fecha = signal<string>(hoyEnLaSede());
  protected readonly fechaDeCalendario = computed(() => aFecha(this.fecha()));
  protected readonly state = signal<ViewState<CensusResponse>>(routeAuthPending());
  protected readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly unidades = computed(() => this.datos()?.units ?? []);
  protected readonly viewer = computed(() => this.datos()?.viewer ?? null);
  protected readonly abiertas = computed(() => this.unidades().filter((u) => u.day.status === 'OPEN'));

  protected readonly problema = signal<ViewState<unknown> | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly cerrando = signal(false);
  protected readonly ajustando = signal<{ unidad: CensusUnitView; fila: FilaDeCenso } | null>(null);

  private readonly celdaDato = viewChild.required<TemplateRef<{ $implicit: FilaDeCenso }>>('celdaDato');
  private readonly celdaSnapshot = viewChild.required<TemplateRef<{ $implicit: FilaDeCenso }>>('celdaSnapshot');
  private readonly celdaAjustado = viewChild.required<TemplateRef<{ $implicit: FilaDeCenso }>>('celdaAjustado');
  private readonly celdaAjustar = viewChild.required<TemplateRef<{ $implicit: FilaDeCenso }>>('celdaAjustar');

  protected readonly columnasCerrado = computed<readonly ColumnDef<FilaDeCenso>[]>(() => [
    { key: 'dato', header: 'Dato', priority: 1, cell: this.celdaDato() },
    { key: 'snapshot', header: 'Snapshot', priority: 1, align: 'end', cell: this.celdaSnapshot() },
    { key: 'ajustado', header: 'Con ajustes', priority: 1, align: 'end', cell: this.celdaAjustado() },
    ...(this.viewer()?.canAdjustCensus === true ? [{ key: 'ajustar', header: 'Acciones', priority: 1, accion: true, cell: this.celdaAjustar() } satisfies ColumnDef<FilaDeCenso>] : []),
  ]);

  protected readonly columnasAbierto = computed<readonly ColumnDef<FilaDeCenso>[]>(() => [
    { key: 'dato', header: 'Dato', priority: 1, cell: this.celdaDato() },
    { key: 'snapshot', header: 'Vista previa', priority: 1, align: 'end', cell: this.celdaSnapshot() },
  ]);

  protected readonly porCampo = (f: FilaDeCenso): string => `${f.unidadId}:${f.campo}`;
  protected readonly unidadDe = (id: string): CensusUnitView | undefined => this.unidades().find((u) => u.day.unit.id === id);
  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaYHora = fechaYHora;
  protected readonly etiquetaDe = (c: string): string => CENSUS_FIELD_LABELS[c as CensusField] ?? c;

  protected readonly breadcrumbs = [{ label: 'Internación' }, { label: 'Censo diario' }];
  protected readonly rutaIndicadores = RUTAS.indicadores;

  protected readonly antiguedad = computed(() => {
    const d = this.datos();
    return d === null ? '' : antiguedadEnPalabras(minutosDesde(d.asOf));
  });

  constructor() {
    this.sites.load();
    // `?date=AAAA-MM-DD`: el enlace «Cerrar censo del 27/10» de los indicadores cae acá.
    effect(() => {
      const d = this.consulta().get('date');
      if (d !== null && /^\d{4}-\d{2}-\d{2}$/.test(d)) untracked(() => this.fecha.set(d));
    });
    effect(() => {
      const s = this.sites.state();
      const id = this.sites.siteId();
      const fecha = this.fecha();
      untracked(() => {
        if (s.status === 'ready' && id !== '' && fecha !== '') this.cargar();
        else if (s.status !== 'ready') this.state.set(s as ViewState<CensusResponse>);
      });
    });
  }

  protected cargar(): void {
    const siteId = this.sites.siteId();
    if (siteId === '') return;
    if (this.session.activeTenantId() === null) {
      this.state.set(routeAuthPending());
      return;
    }
    if (this.datos() === null) this.state.set(loading());
    this.client.getCensus(siteId, this.fecha()).subscribe({
      next: (c) => {
        if (c.units.length === 0) {
          this.state.set(empty({ label: 'Crear camas en la estructura', route: '/administration/medical-organization' }, 'Este establecimiento no tiene camas censables: sin ellas no hay censo que calcular.'));
        } else {
          this.state.set(minutosDesde(c.asOf) >= UMBRAL_DE_ATRASO_MIN ? stale(c, new Date(c.asOf)) : ready(c));
        }
      },
      error: (e: unknown) => this.state.set(adtErrorToViewState<CensusResponse>(e)),
    });
  }

  protected cambiarFecha(d: Date | null): void {
    if (d === null) return;
    this.aviso.set(null);
    this.problema.set(null);
    this.fecha.set(aTexto(d));
  }

  protected irAAyer(): void {
    const d = aFecha(hoyEnLaSede());
    d.setDate(d.getDate() - 1);
    this.cambiarFecha(d);
  }

  protected irAHoy(): void {
    this.cambiarFecha(aFecha(hoyEnLaSede()));
  }

  protected filas(u: CensusUnitView): ViewState<readonly FilaDeCenso[]> {
    const totales = u.adjustedTotals;
    return ready(
      CENSUS_FIELDS.map((campo) => {
        const snap = this.valorDe(u, campo);
        return { unidadId: u.day.unit.id, campo, etiqueta: CENSUS_FIELD_LABELS[campo], snapshot: snap, ajustado: totales?.[campo] ?? snap, ajustes: u.adjustments.filter((a) => a.fieldCode === campo).length };
      }),
    );
  }

  private valorDe(u: CensusUnitView, campo: CensusField): number {
    const d = u.day;
    const mapa: Readonly<Record<CensusField, number>> = {
      beds_censable: d.bedsCensable,
      beds_available: d.bedsAvailable,
      beds_blocked: d.bedsBlocked,
      patients_at_cutoff: d.patientsAtCutoff,
      admissions: d.admissions,
      discharges: d.discharges,
      deaths: d.deaths,
      transfers_in: d.transfersIn,
      transfers_out: d.transfersOut,
      same_day_stays: d.sameDayStays,
      patient_days: d.patientDays,
      discharge_stay_days: d.dischargeStayDays,
    };
    return mapa[campo];
  }

  protected async cerrar(): Promise<void> {
    const unidades = this.abiertas();
    if (unidades.length === 0 || this.cerrando()) return;
    const ok = await this.dialogs.confirm({
      title: `Cerrar el censo del ${fechaCorta(this.fecha())}`,
      message: `Se congela el snapshot de ${unidades.map((u) => u.day.unit.name).join(', ')}. Un censo cerrado no se edita: si hay un error, se corrige con un ajuste auditado.`,
      confirmLabel: 'Cerrar el censo',
      destructive: true,
    });
    if (!ok) return;
    this.cerrando.set(true);
    this.problema.set(null);
    this.aviso.set(null);
    this.client.closeCensus(this.sites.siteId(), this.fecha()).subscribe({
      next: (r) => {
        this.cerrando.set(false);
        this.aviso.set(`Se cerró el censo del ${fechaCorta(this.fecha())} (${r.closed.map((d) => d.unit.name).join(', ')}). Ya es inmutable.`);
        this.cargar();
      },
      error: (e: unknown) => {
        this.cerrando.set(false);
        const estado = adtErrorToViewState<unknown>(e);
        if (estado.status === 'forbidden') {
          this.problema.set({ status: 'validation', issues: [{ message: 'Su asignación no permite cerrar el censo. La decisión es del servidor.' }], ...(estado.requestId === undefined ? {} : { requestId: estado.requestId }) });
        } else {
          this.problema.set(estado);
        }
        // Si ya estaba cerrado por otra persona, se vuelve a leer para mostrarlo.
        if (readAdtError(e)?.reason === 'CENSUS_ALREADY_CLOSED') this.cargar();
      },
    });
  }

  protected abrirAjuste(unidad: CensusUnitView, fila: FilaDeCenso): void {
    this.ajustando.set({ unidad, fila });
  }

  protected alAjustar(): void {
    this.ajustando.set(null);
    this.aviso.set('Ajuste registrado. El snapshot no cambió: el original sigue visible junto al valor ajustado.');
    this.cargar();
  }

  protected reintentar(): void {
    this.sites.load(true);
    this.cargar();
  }
}
