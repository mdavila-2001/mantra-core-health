import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AnalyticsMoneyClient } from '../../../core/data-access/admin-portal/analytics-money.client';
import type { MoneyItem, MoneyReport } from '../../../core/data-access/admin-portal/analytics-money.types';
import type { TrafficEndpoint, TrafficEndpointsPage, TrafficOverview, TrafficQuery } from '../../../core/data-access/admin-portal/ops-traffic.types';
import { OpsTrafficClient } from '../../../core/data-access/admin-portal/ops-traffic.client';
import { WebAnalyticsClient } from '../../../core/data-access/admin-portal/platform.client';
import type { OnboardingFormType, OnboardingFunnelReport, OnboardingHeatmapReport } from '../../../core/onboarding/onboarding-draft.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import type { Tone } from '../../../shared/components/tone/tone.types';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, SortState } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { entero, porcentaje } from '../platform/platform-labels';
import { OTROS, funcionalidadDe, type Funcionalidad } from './measurement-groups';
import { agruparPorMoneda, formatearImporte, rotuloDeTipo } from './measurement-money';

type Rango = 'hoy' | '24h' | '7d';
type MetricaCalor = 'errors' | 'interactions' | 'abandonment';
type ClaveOrdenUso = 'label' | 'requests' | 'failed' | 'errorRate' | 'p95';

const MS_HORA = 3_600_000;
const MS_DIA = 24 * MS_HORA;
/** El máximo que acepta `GET /admin/ops/traffic/endpoints` (`limit` ≤ 200). */
const LIMITE_ENDPOINTS = 200;

/** Lo que los endpoints de una funcionalidad suman, con números crudos para ordenar. */
interface UsoDeFuncionalidad {
  readonly funcionalidad: Funcionalidad;
  readonly endpoints: number;
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
  /** El **peor** p95 de sus endpoints. Los percentiles no se promedian ni se suman. */
  readonly p95: number | null;
  readonly p95De: string | null;
}

/** Una fila de la tabla de uso, ya formateada: la tabla sólo la pinta. */
interface FilaUso {
  readonly id: string;
  readonly label: string;
  readonly endpoints: string;
  readonly requests: string;
  readonly failed: string;
  readonly errorRate: string;
  readonly p95: string;
  readonly p95De: string;
}

/** Una fila de la tabla de endpoints que cayeron en «Otros». */
interface FilaOtros {
  readonly id: string;
  readonly method: string;
  readonly route: string;
  readonly requests: string;
}

interface FilaDinero {
  readonly id: string;
  readonly modulo: string;
  readonly tipo: string;
  readonly operaciones: string;
  readonly importe: string;
}

interface TablaDeMoneda {
  readonly currency: string;
  readonly state: ViewState<readonly FilaDinero[]>;
}

interface CampoDeCalor {
  readonly clave: string;
  readonly etiqueta: string;
  readonly paso: number;
  readonly puntaje: number;
  readonly nivel: { readonly label: string; readonly tone: Tone };
  readonly valorMetrica: string;
  readonly detalle: string;
  readonly descripcion: string;
}

/** Nombre legible de cada limitación que declara el servidor (mismo vocabulario que Observabilidad). */
const NO_MEDIDO: Readonly<Record<string, string>> = {
  disabled: 'Medición apagada',
  rejectedBeforeApi: 'Rechazado antes de llegar a la API',
  lastMinuteNotFlushed: 'Último ciclo sin volcar',
  healthchecksExcluded: 'Sondas de salud, documentación y preflight',
  workersNotHttp: 'Workers y jobs',
  unmatchedAggregated: 'Rutas inexistentes (UNMATCHED)',
  percentilesEstimated: 'Percentiles estimados',
};

const NIVELES: Readonly<Record<string, { readonly label: string; readonly tone: Tone }>> = {
  low: { label: 'Baja fricción', tone: 'success' },
  medium: { label: 'Fricción moderada', tone: 'warning' },
  critical: { label: 'Punto crítico', tone: 'error' },
};

const METRICAS: Readonly<Record<MetricaCalor, string>> = {
  errors: 'errores de validación',
  interactions: 'interacciones',
  abandonment: 'abandonos en este campo',
};

/**
 * Medición por funcionalidad: cuánto se usa cada herramienta de la app, cuánto
 * dinero mueve y dónde se atasca la gente. No mide funcionalidades médicas: mide
 * el uso del producto.
 *
 * - **Uso**: los endpoints que mide la API (`/admin/ops/traffic/endpoints`) se
 *   agrupan por funcionalidad con la tabla declarada de `measurement-groups.ts`.
 * - **Dinero**: `/admin/analytics/money`. Una moneda por tabla, el importe como
 *   cadena, y lo que no se mide dicho como «sin medir», nunca como cero.
 * - **Mapa de calor**: el de fricción en los formularios de alta
 *   (`/admin/analytics/onboarding/*`).
 *
 * Regla de honestidad: cada bloque se pide por su cuenta —que uno falle o no
 * tenga permiso no apaga a los otros— y lo que no se pudo medir no se dibuja
 * como cero.
 */
@Component({
  selector: 'app-measurement',
  imports: [DatePipe, AppButton, Badge, Select, Alert, Card, MetricCard, SegmentedControl, Tabs, Tab, DataTable, PageHeader, ViewStateHost],
  templateUrl: './measurement.html',
  styleUrl: './measurement.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Measurement {
  private readonly traffic = inject(OpsTrafficClient);
  private readonly moneyClient = inject(AnalyticsMoneyClient);
  private readonly analytics = inject(WebAnalyticsClient);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly entero = entero;
  protected readonly porcentaje = porcentaje;
  protected readonly formatearImporte = formatearImporte;
  protected readonly noMedido = (metric: string): string => NO_MEDIDO[metric] ?? metric;

  protected readonly pestana = signal(0);
  protected readonly rango = signal<Rango>('hoy');
  protected readonly opcionesRango = [
    { value: 'hoy' as const, label: 'Hoy' },
    { value: '24h' as const, label: '24 h' },
    { value: '7d' as const, label: '7 días' },
  ];

  /* -- Uso --------------------------------------------------------------- */
  protected readonly resumen = signal<ViewState<TrafficOverview>>(loading());
  protected readonly endpoints = signal<ViewState<TrafficEndpointsPage>>(loading());
  protected readonly ordenUso = signal<SortState>({ key: 'requests', direction: 'desc' });

  /** Apagada la medición, el uso dice por qué y no pinta ceros. */
  protected readonly estadoUso = computed<ViewState<TrafficEndpointsPage>>(() => {
    const resumen = this.resumen();
    if (resumen.status === 'ready' && resumen.data.notMeasured.some((n) => n.metric === 'disabled')) {
      return empty(
        { label: 'Pida a quien opera la API que encienda OBSERVABILITY_HTTP_SLI_ENABLED.' },
        'La medición de peticiones está apagada: no hay uso que mostrar.',
      );
    }
    const estado = this.endpoints();
    if (estado.status === 'ready' && estado.data.items.length === 0) {
      return empty({ label: 'Pruebe con una ventana más amplia.' }, 'Ninguna funcionalidad recibió peticiones en esta ventana.');
    }
    return estado;
  });

  protected readonly usoAgrupado = computed<readonly UsoDeFuncionalidad[]>(() => {
    const estado = this.endpoints();
    return estado.status === 'ready' ? agruparUso(estado.data.items) : [];
  });

  protected readonly filasUso = computed<ViewState<readonly FilaUso[]>>(() => {
    const estado = this.estadoUso();
    if (estado.status !== 'ready') return mapData(estado, () => [] as readonly FilaUso[]);
    return ready(ordenarUso(this.usoAgrupado(), this.ordenUso()).map((u) => this.filaUso(u)));
  });

  protected readonly totalesUso = computed(() => {
    const filas = this.usoAgrupado();
    const requests = filas.reduce((s, f) => s + f.requests, 0);
    const fallidas = filas.reduce((s, f) => s + f.failed4xx + f.failed5xx, 0);
    return {
      funcionalidades: filas.length,
      requests,
      fallidas,
      tasa: requests === 0 ? null : fallidas / requests,
    };
  });

  /** Los endpoints que ninguna regla reclamó: se listan para poder ubicarlos en la tabla. */
  protected readonly filasOtros = computed<ViewState<readonly FilaOtros[]>>(() => {
    const estado = this.endpoints();
    if (estado.status !== 'ready') return mapData(estado, () => [] as readonly FilaOtros[]);
    return ready(
      estado.data.items
        .filter((e) => funcionalidadDe(e.route) === OTROS)
        .map((e) => ({ id: `${e.method} ${e.route}`, method: e.method, route: e.route, requests: entero(e.requests) })),
    );
  });

  protected readonly columnasUso: readonly ColumnDef<FilaUso>[] = [
    { key: 'label', header: 'Funcionalidad', priority: 1, sortable: true },
    { key: 'requests', header: 'Solicitudes', priority: 1, align: 'end', sortable: true },
    { key: 'failed', header: 'Fallidas (4xx · 5xx)', priority: 2, align: 'end', sortable: true },
    { key: 'errorRate', header: 'Tasa de error', priority: 2, align: 'end', sortable: true },
    { key: 'p95', header: 'Peor p95', priority: 2, align: 'end', sortable: true },
    { key: 'p95De', header: 'Endpoint más lento', priority: 3 },
    { key: 'endpoints', header: 'Endpoints', priority: 3, align: 'end' },
  ];
  protected readonly columnasOtros: readonly ColumnDef<FilaOtros>[] = [
    { key: 'method', header: 'Método', priority: 1 },
    { key: 'route', header: 'Ruta (plantilla)', priority: 1 },
    { key: 'requests', header: 'Solicitudes', priority: 1, align: 'end' },
  ];
  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly nombreDeFilaUso = (fila: FilaUso): string => fila.label;
  protected readonly nombreDeFilaOtros = (fila: FilaOtros): string => `${fila.method} ${fila.route}`;
  protected readonly nombreDeFilaDinero = (fila: FilaDinero): string => `${fila.modulo}, ${fila.tipo}`;

  /* -- Dinero ------------------------------------------------------------ */
  protected readonly dinero = signal<ViewState<MoneyReport>>(loading());

  protected readonly tablasDeDinero = computed<readonly TablaDeMoneda[]>(() => {
    const estado = this.dinero();
    if (estado.status !== 'ready') return [];
    return agruparPorMoneda(estado.data.items).map((grupo) => ({
      currency: grupo.currency,
      state: ready(grupo.items.map((item) => this.filaDinero(item))),
    }));
  });

  protected readonly columnasDinero = (moneda: string): readonly ColumnDef<FilaDinero>[] => [
    { key: 'modulo', header: 'Funcionalidad', priority: 1 },
    { key: 'tipo', header: 'Tipo de importe', priority: 1 },
    { key: 'operaciones', header: 'Operaciones', priority: 2, align: 'end' },
    { key: 'importe', header: `Importe (${moneda})`, priority: 1, align: 'end' },
  ];

  /* -- Mapa de calor ----------------------------------------------------- */
  protected readonly tipoAlta = signal<OnboardingFormType>('patient');
  protected readonly metricaCalor = signal<MetricaCalor>('errors');
  protected readonly opcionesTipoAlta: readonly { value: OnboardingFormType; label: string }[] = [
    { value: 'patient', label: 'Paciente' },
    { value: 'practitioner', label: 'Médico' },
    { value: 'organization', label: 'Aseguradora' },
    { value: 'laboratory', label: 'Laboratorio' },
    { value: 'imaging-center', label: 'Imagenología' },
    { value: 'pharmacy', label: 'Farmacia' },
  ];
  protected readonly opcionesMetricaCalor = [
    { value: 'errors' as const, label: 'Errores' },
    { value: 'interactions' as const, label: 'Interacciones' },
    { value: 'abandonment' as const, label: 'Abandonos' },
  ];
  protected readonly mapaCalor = signal<ViewState<OnboardingHeatmapReport>>(loading());
  protected readonly embudo = signal<ViewState<OnboardingFunnelReport>>(loading());

  /** Sin campos medidos el mapa lo dice, no dibuja una grilla vacía. */
  protected readonly estadoCalor = computed<ViewState<OnboardingHeatmapReport>>(() => {
    const estado = this.mapaCalor();
    if (estado.status === 'ready' && estado.data.fields.length === 0) {
      return empty({ label: 'Pruebe con otro tipo de alta o una ventana más amplia.' }, 'Todavía no hay interacciones medidas en este formulario.');
    }
    return estado;
  });

  protected readonly camposDeCalor = computed<readonly CampoDeCalor[]>(() => {
    const estado = this.mapaCalor();
    if (estado.status !== 'ready') return [];
    const metrica = estado.data.metric;
    return estado.data.fields.map((campo) => {
      const nivel = NIVELES[campo.thermalLevel] ?? { label: campo.thermalLevel, tone: 'secondary' as Tone };
      const valor = metrica === 'errors' ? campo.errorCount : metrica === 'abandonment' ? campo.abandonmentCount : campo.interactionCount;
      const valorMetrica = `${entero(valor)} ${METRICAS[metrica]}`;
      const detalle = `${entero(campo.interactionCount)} interacciones · ${entero(campo.errorCount)} errores · ${entero(campo.abandonmentCount)} abandonos · ${(campo.averageTimeMs / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} s en el campo`;
      return {
        clave: campo.fieldKey,
        etiqueta: campo.fieldLabel,
        paso: campo.stepNumber,
        puntaje: campo.thermalScore,
        nivel,
        valorMetrica,
        detalle,
        descripcion: `${campo.fieldLabel}, paso ${campo.stepNumber}: intensidad ${campo.thermalScore} de 100, ${nivel.label.toLowerCase()}. ${valorMetrica}.`,
      };
    });
  });

  /** Texto equivalente del mapa para quien no ve los colores: cuántos campos y cuál es el más caliente. */
  protected readonly resumenDelMapa = computed(() => {
    const campos = this.camposDeCalor();
    if (campos.length === 0) return 'Sin campos medidos.';
    const maximo = campos.reduce((a, b) => (b.puntaje > a.puntaje ? b : a));
    const criticos = campos.filter((c) => c.nivel.label === NIVELES['critical']!.label).length;
    return `${campos.length} campos medidos, ${criticos} en punto crítico. El más caliente: ${maximo.etiqueta}, con intensidad ${maximo.puntaje} de 100.`;
  });

  constructor() {
    // La portada enlaza a una pestaña concreta: `?pestana=1` abre «Dinero».
    const pedida = Number(this.route.snapshot.queryParamMap.get('pestana'));
    if (Number.isInteger(pedida) && pedida >= 0 && pedida <= 3) this.pestana.set(pedida);
    this.cargar();
  }

  protected cargar(): void {
    this.cargarUso();
    this.cargarDinero();
    this.cargarCalor();
  }

  protected cambiarRango(r: Rango): void {
    this.rango.set(r);
    this.cargar();
  }

  protected ordenar(sort: SortState): void {
    this.ordenUso.set(sort);
  }

  protected cambiarTipoAlta(tipo: OnboardingFormType | null): void {
    if (tipo === null) return;
    this.tipoAlta.set(tipo);
    this.cargarCalor();
  }

  protected cambiarMetrica(metrica: MetricaCalor | null): void {
    if (metrica === null) return;
    this.metricaCalor.set(metrica);
    this.cargarCalor();
  }

  protected cargarUso(): void {
    const w = this.ventana();
    this.resumen.set(loading());
    this.endpoints.set(loading());
    this.traffic.traffic(w).subscribe({
      next: (r) => this.resumen.set(ready(r)),
      error: (e: unknown) => this.resumen.set(errorToViewState<TrafficOverview>(e)),
    });
    this.traffic.endpoints({ to: w.to, ...(w.from ? { from: w.from } : {}), sort: 'requests', limit: LIMITE_ENDPOINTS }).subscribe({
      next: (r) => this.endpoints.set(ready(r)),
      error: (e: unknown) => this.endpoints.set(errorToViewState<TrafficEndpointsPage>(e)),
    });
  }

  protected cargarDinero(): void {
    const { from, to } = this.ventanaConDesde();
    this.dinero.set(loading());
    this.moneyClient.money({ from, to }).subscribe({
      next: (r) => this.dinero.set(ready(r)),
      error: (e: unknown) => this.dinero.set(errorToViewState<MoneyReport>(e)),
    });
  }

  protected cargarCalor(): void {
    // El mapa de calor acepta 24h, 7d y 30d: «Hoy» y «24 h» miden las últimas 24 h.
    const rango = this.rango() === '7d' ? '7d' : '24h';
    this.mapaCalor.set(loading());
    this.embudo.set(loading());
    this.analytics.onboardingHeatmap(this.tipoAlta(), this.metricaCalor(), rango).subscribe({
      next: (r) => this.mapaCalor.set(ready(r)),
      error: (e: unknown) => this.mapaCalor.set(errorToViewState<OnboardingHeatmapReport>(e)),
    });
    this.analytics.onboardingFunnel(this.tipoAlta(), rango).subscribe({
      next: (r) => this.embudo.set(ready(r)),
      error: (e: unknown) => this.embudo.set(errorToViewState<OnboardingFunnelReport>(e)),
    });
  }

  /** `hoy` omite `from`: la API de tráfico arranca la ventana a las 00:00 UTC del día de `to`. */
  private ventana(): TrafficQuery {
    const to = new Date();
    switch (this.rango()) {
      case '24h':
        return { from: new Date(to.getTime() - MS_DIA).toISOString(), to: to.toISOString(), interval: 'hour' };
      case '7d':
        return { from: new Date(to.getTime() - 7 * MS_DIA).toISOString(), to: to.toISOString(), interval: 'day' };
      default:
        return { to: to.toISOString(), interval: 'hour' };
    }
  }

  /** Ventana con `from` siempre explícito (el contrato del dinero no declara un valor por omisión). */
  private ventanaConDesde(): { readonly from: string; readonly to: string } {
    const w = this.ventana();
    if (w.from) return { from: w.from, to: w.to! };
    const ahora = new Date(w.to!);
    const medianoche = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
    return { from: new Date(medianoche < ahora.getTime() ? medianoche : medianoche - MS_DIA).toISOString(), to: w.to! };
  }

  protected milis(valor: number | null): string {
    return valor === null ? '—' : `${valor.toLocaleString('es-BO', { maximumFractionDigits: 1 })} ms`;
  }

  protected ancho(puntaje: number): string {
    return `${Math.max(0, Math.min(100, Math.round(puntaje)))}%`;
  }

  private filaUso(u: UsoDeFuncionalidad): FilaUso {
    const fallidas = u.failed4xx + u.failed5xx;
    return {
      id: u.funcionalidad.id,
      label: u.funcionalidad.label,
      endpoints: entero(u.endpoints),
      requests: entero(u.requests),
      failed: fallidas === 0 ? '0' : `${entero(fallidas)} (${entero(u.failed4xx)} · ${entero(u.failed5xx)})`,
      errorRate: u.requests === 0 ? '—' : porcentaje(fallidas / u.requests),
      p95: this.milis(u.p95),
      p95De: u.p95De ?? '—',
    };
  }

  private filaDinero(item: MoneyItem): FilaDinero {
    return {
      id: `${item.module}|${item.kind}|${item.currency}`,
      modulo: item.moduleLabel,
      tipo: rotuloDeTipo(item.kind),
      operaciones: entero(item.operations),
      importe: formatearImporte(item.amount),
    };
  }
}

/**
 * Suma los endpoints de cada funcionalidad. Solicitudes y fallos se suman; el p95
 * **no**: se toma el peor de los endpoints, porque un percentil no se puede
 * promediar ni sumar sin la distribución que lo originó.
 */
function agruparUso(endpoints: readonly TrafficEndpoint[]): readonly UsoDeFuncionalidad[] {
  const porId = new Map<string, UsoDeFuncionalidad>();
  for (const e of endpoints) {
    const funcionalidad = funcionalidadDe(e.route);
    const previo = porId.get(funcionalidad.id);
    const masLento = e.latencyMs.p95 !== null && (previo?.p95 === undefined || previo.p95 === null || e.latencyMs.p95 > previo.p95);
    porId.set(funcionalidad.id, {
      funcionalidad,
      endpoints: (previo?.endpoints ?? 0) + 1,
      requests: (previo?.requests ?? 0) + e.requests,
      failed4xx: (previo?.failed4xx ?? 0) + e.failed4xx,
      failed5xx: (previo?.failed5xx ?? 0) + e.failed5xx,
      p95: masLento ? e.latencyMs.p95 : (previo?.p95 ?? null),
      p95De: masLento ? `${e.method} ${e.route}` : (previo?.p95De ?? null),
    });
  }
  return [...porId.values()];
}

function ordenarUso(filas: readonly UsoDeFuncionalidad[], orden: SortState): readonly UsoDeFuncionalidad[] {
  const clave = (u: UsoDeFuncionalidad): number | string => {
    switch (orden.key as ClaveOrdenUso) {
      case 'label':
        return u.funcionalidad.label;
      case 'failed':
        return u.failed4xx + u.failed5xx;
      case 'errorRate':
        return u.requests === 0 ? -1 : (u.failed4xx + u.failed5xx) / u.requests;
      case 'p95':
        return u.p95 ?? -1;
      default:
        return u.requests;
    }
  };
  const signo = orden.direction === 'asc' ? 1 : -1;
  return [...filas].sort((a, b) => {
    const ka = clave(a);
    const kb = clave(b);
    const comparado = typeof ka === 'string' && typeof kb === 'string' ? ka.localeCompare(kb, 'es') : Number(ka) - Number(kb);
    // Desempate estable por nombre: dos recorridos dan el mismo orden.
    return signo * comparado || a.funcionalidad.label.localeCompare(b.funcionalidad.label, 'es');
  });
}
