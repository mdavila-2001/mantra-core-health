import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState } from '../../../core/data-access/adt/adt.errors';
import type { IndicatorsByUnit, InpatientIndicators } from '../../../core/data-access/adt/adt.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Select } from '../../../shared/components/atoms/select/select';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { antiguedadEnPalabras, fechaCorta, fechaYHora, minutosDesde, RUTAS, UMBRAL_DE_ATRASO_MIN } from '../shared/adt.view';
import { InpatientSites } from '../shared/inpatient-sites';
import { SiteSwitcher } from '../shared/site-switcher/site-switcher';
import { hoyEnLaSede } from '../census/census';

const TODAS = '__todas__';
/** Pasado este desvío, la prueba cruzada se avisa (no bloquea): `procesos/12` pide marcarla, no esconderla. */
const DESVIO_AVISADO_PCT = 5;

function sumarDias(texto: string, dias: number): string {
  const [a, m, d] = texto.split('-').map(Number);
  const f = new Date(Date.UTC(a!, m! - 1, d!));
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

function aFecha(texto: string): Date {
  const [a, m, d] = texto.split('-').map(Number);
  return new Date(a!, m! - 1, d!);
}

function aTexto(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

const NUMERO = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/**
 * **Indicadores de camas (OPS)** — `/inpatient/indicators`.
 *
 * Ocupación, promedio de estancia, giro de cama e intervalo de sustitución, más
 * la rotación de cama (cuánto tarda una cama en volver a estar disponible tras
 * un egreso). **Se calculan en el servidor solo con días cerrados y sus
 * ajustes**; esta pantalla no recalcula nada, y dice con todas las letras qué
 * días faltan («Cerrar censo del 27/10») porque un promedio con huecos engaña.
 *
 * Cada cifra trae su fórmula, y el momento del cálculo se muestra siempre (S7
 * obligatorio de `procesos/12`). La prueba cruzada (ocupación recalculada
 * desde el promedio de estancia y el giro) se avisa si se desvía; no bloquea.
 */
@Component({
  selector: 'app-indicators',
  imports: [Alert, Card, DatePicker, MetricCard, PageHeader, RouterLink, Select, SiteSwitcher, ViewStateHost],
  templateUrl: './indicators.html',
  styleUrl: './indicators.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Indicators {
  private readonly client = inject(AdtClient);
  private readonly session = inject(SessionStore);
  protected readonly sites = inject(InpatientSites);

  private readonly ayer = sumarDias(hoyEnLaSede(), -1);
  protected readonly hasta = signal(this.ayer);
  protected readonly desde = signal(sumarDias(this.ayer, -6));
  protected readonly unidad = signal<string>(TODAS);
  /** Las unidades que ya se vieron (la lista no cambia al filtrar por una). */
  private readonly unidadesVistas = signal<readonly IndicatorsByUnit['unit'][]>([]);

  protected readonly state = signal<ViewState<InpatientIndicators>>(routeAuthPending());
  protected readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });

  protected readonly opcionesDeUnidad = computed<readonly SelectOption<string>[]>(() => [
    { value: TODAS, label: 'Todas las unidades' },
    ...this.unidadesVistas().map((u) => ({ value: u.id, label: u.name })),
  ]);

  protected readonly desdeFecha = computed(() => aFecha(this.desde()));
  protected readonly hastaFecha = computed(() => aFecha(this.hasta()));
  protected readonly breadcrumbs = [{ label: 'Internación' }, { label: 'Indicadores de camas' }];
  protected readonly rutaCenso = RUTAS.censo;

  protected readonly fechaCorta = fechaCorta;
  protected readonly fechaYHora = fechaYHora;

  protected readonly antiguedad = computed(() => {
    const d = this.datos();
    return d === null ? '' : antiguedadEnPalabras(minutosDesde(d.asOf));
  });

  protected readonly desvio = computed(() => this.datos()?.crossCheck.deltaPct ?? null);
  protected readonly cruzadaFalla = computed(() => {
    const d = this.desvio();
    return d !== null && Math.abs(d) >= DESVIO_AVISADO_PCT;
  });
  protected readonly parcial = computed(() => (this.datos()?.coverage.daysMissing.length ?? 0) > 0);

  constructor() {
    this.sites.load();
    effect(() => {
      const s = this.sites.state();
      const id = this.sites.siteId();
      this.desde();
      this.hasta();
      this.unidad();
      untracked(() => {
        if (s.status === 'ready' && id !== '') this.cargar();
        else if (s.status !== 'ready') this.state.set(s as ViewState<InpatientIndicators>);
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
    const unitId = this.unidad() === TODAS ? undefined : this.unidad();
    this.client.getIndicators(siteId, this.desde(), this.hasta(), unitId).subscribe({
      next: (i) => {
        if (unitId === undefined && i.byUnit !== undefined) this.unidadesVistas.set(i.byUnit.map((u) => u.unit));
        if (i.coverage.daysClosed === 0) {
          this.state.set(
            empty(
              { label: 'Cerrar el censo de un día', route: RUTAS.censo },
              'Los indicadores aparecen tras el primer cierre de censo. Ningún día del período está cerrado: sin cierre no hay denominadores.',
            ),
          );
          return;
        }
        this.state.set(minutosDesde(i.asOf) >= UMBRAL_DE_ATRASO_MIN ? stale(i, new Date(i.asOf)) : ready(i));
      },
      error: (e: unknown) => this.state.set(adtErrorToViewState<InpatientIndicators>(e)),
    });
  }

  protected cambiarDesde(d: Date | null): void {
    if (d !== null) this.desde.set(aTexto(d));
  }

  protected cambiarHasta(d: Date | null): void {
    if (d !== null) this.hasta.set(aTexto(d));
  }

  protected cambiarUnidad(v: string | null): void {
    this.unidad.set(v ?? TODAS);
  }

  protected n(v: number | null, sufijo = ''): string {
    return v === null ? '—' : `${NUMERO.format(v)}${sufijo}`;
  }

  protected min(v: number | null): string {
    return v === null ? '—' : `${NUMERO.format(v)} min`;
  }

  protected rutaDeCierre(fecha: string): { readonly date: string } {
    return { date: fecha };
  }

  protected reintentar(): void {
    this.sites.load(true);
    this.cargar();
  }
}
