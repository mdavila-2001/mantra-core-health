import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { CatalogFitClient } from '../../../../../core/data-access/admin-portal/catalog-fit.client';
import type {
  CatalogFit,
  FitCheckResult,
  FitDimensionScore,
  FitReport,
} from '../../../../../core/data-access/admin-portal/catalog-fit.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready, stale } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { SegmentedControl } from '../../../../../shared/components/molecules/segmented-control/segmented-control';
import type { Tone } from '../../../../../shared/components/tone/tone.types';
import type { SegmentedOption } from '../../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DrawerPanel } from '../../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  ageText,
  checkStatus,
  dateTime,
  dimensionHint,
  dimensionLabel,
  dimensionTone,
  entero,
  evidenceRows,
  filaDeComprobacion,
  filaDeHistorial,
  ordenarComprobaciones,
  ratioText,
  severity,
  trigger,
  verdict,
  DIMENSIONES,
  type FilaComprobacion,
  type FilaHistorial,
  type FiltroComprobaciones,
} from './catalog-fit-labels';

/** Cada cuánto se vuelve a pedir el resultado mientras una corrida está en vuelo. */
export const INTERVALO_DE_ESPERA_MS = 1_500;
/** Tope de esperas: una corrida que no termina no deja la pantalla pidiendo para siempre. */
export const MAXIMO_DE_ESPERAS = 40;

const OPCIONES_FILTRO: readonly SegmentedOption<FiltroComprobaciones>[] = [
  { value: 'fallan', label: 'Fallan' },
  { value: 'ciegas', label: 'Sin medir' },
  { value: 'todas', label: 'Todas' },
];

/** Un resultado del servidor, a la forma de estado que la pantalla sabe pintar (M34). */
export function estadoDe(respuesta: CatalogFit): ViewState<CatalogFit> {
  const informe = respuesta.report;
  if (informe === null) {
    // la primera corrida de todas está en vuelo: no hay nada que mostrar todavía, pero sí que esperar
    if (respuesta.running !== null) return loading();
    return empty(
      { label: 'Ejecutar la sonda' },
      respuesta.noResultReason === 'EXPIRADO'
        ? 'El último resultado venció y ninguna corrida lo renovó. Conviene revisar que el worker del catálogo esté vivo en «Instancias».'
        : 'La sonda todavía no corrió en este proceso de la API. El worker la ejecuta cada pocos minutos; también se puede pedir ahora.',
    );
  }
  return respuesta.state === 'ATRASADO'
    ? stale(respuesta, new Date(informe.evaluatedAt))
    : ready(respuesta);
}

/**
 * Sonda de catalogación: ¿sigue el catálogo ajustado a la realidad? Una tarjeta con tres pestañas:
 * el puntaje por dimensión (con su numerador y su denominador), los hallazgos de cada comprobación
 * (con id estable, severidad, evidencia y cómo corregirlo) y el historial de corridas.
 *
 * Todo lo decide el servidor: acá se pinta. `null` no es 0 —un puntaje sin base dice por qué no
 * hay número— y «Sin dato» o «No declarado» no se disfrazan de «Cumple».
 */
@Component({
  selector: 'app-portal-catalog-fit-page',
  imports: [
    AppButton,
    Alert,
    Badge,
    Card,
    DataTable,
    DrawerPanel,
    MetricCard,
    PageHeader,
    SegmentedControl,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './catalog-fit-page.html',
  styleUrl: './catalog-fit-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFitPage {
  private readonly client = inject(CatalogFitClient);

  protected readonly estado = signal<ViewState<CatalogFit>>(loading());
  protected readonly solicitando = signal(false);
  /** Un fallo al pedir la corrida (403, 422…), con su texto; no tapa el resultado que ya había. */
  protected readonly falloAlEjecutar = signal<string | null>(null);
  protected readonly pestana = signal(0);
  protected readonly filtro = signal<FiltroComprobaciones>('fallan');
  protected readonly seleccionada = signal<string | null>(null);

  protected readonly opcionesFiltro = OPCIONES_FILTRO;
  protected readonly dimensiones = DIMENSIONES;

  protected readonly respuesta = computed<CatalogFit | null>(() => {
    const s = this.estado();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly informe = computed<FitReport | null>(() => this.respuesta()?.report ?? null);
  protected readonly enCurso = computed(
    () => this.respuesta()?.running != null || this.solicitando(),
  );

  /** La última corrida falló DESPUÉS del informe que se está mostrando: hay que decirlo. */
  protected readonly falloReciente = computed(() => {
    const r = this.respuesta();
    if (!r?.lastFailure?.finishedAt || !r.report) return null;
    return new Date(r.lastFailure.finishedAt) > new Date(r.report.evaluatedAt)
      ? r.lastFailure
      : null;
  });

  /** Cuántas comprobaciones fallan (y cuántas de severidad alta) y cuántas no pudieron medir. */
  protected readonly conteo = computed(() => {
    const checks = this.informe()?.checks ?? [];
    const fallan = checks.filter((c) => c.status === 'FALLA');
    return {
      total: checks.length,
      fallan: fallan.length,
      altas: fallan.filter((c) => c.severity === 'ALTA').length,
      ciegas: checks.filter((c) => c.status === 'SIN_DATO' || c.status === 'NO_DECLARADO').length,
    };
  });

  protected readonly filas = computed<readonly FilaComprobacion[]>(() =>
    ordenarComprobaciones(this.informe()?.checks ?? [], this.filtro()).map(filaDeComprobacion),
  );
  protected readonly estadoComprobaciones = computed<ViewState<readonly FilaComprobacion[]>>(() => {
    const filas = this.filas();
    if (filas.length > 0) return ready(filas);
    const f = this.filtro();
    return empty(
      { label: 'Ver todas las comprobaciones' },
      f === 'fallan'
        ? 'Ninguna comprobación falla en este resultado.'
        : f === 'ciegas'
          ? 'Todas las comprobaciones pudieron medir.'
          : 'Este resultado no trae comprobaciones.',
    );
  });
  protected readonly detalle = computed<FitCheckResult | null>(() => {
    const id = this.seleccionada();
    return id === null ? null : (this.informe()?.checks.find((c) => c.id === id) ?? null);
  });
  protected readonly evidencia = computed(() => evidenceRows(this.detalle()?.evidence ?? {}));

  protected readonly historial = computed<ViewState<readonly FilaHistorial[]>>(() => {
    const r = this.respuesta();
    if (!r) return loading();
    const filas = [...r.history].reverse().map(filaDeHistorial);
    return filas.length > 0
      ? ready(filas)
      : empty(
          { label: 'Ejecutar la sonda' },
          'Todavía no hay corridas en la memoria de la API. El historial se arma con cada corrida y se vacía al reiniciarla.',
        );
  });

  protected readonly rotuloVeredicto = verdict;
  protected readonly rotuloEstado = checkStatus;
  protected readonly rotuloSeveridad = severity;
  protected readonly etiquetaDimension = dimensionLabel;
  protected readonly texto = ratioText;
  protected readonly pista = dimensionHint;
  protected readonly cuando = dateTime;
  protected readonly antiguedad = ageText;
  protected readonly disparador = trigger;
  protected readonly cifra = entero;

  private readonly celdaId =
    viewChild.required<TemplateRef<{ $implicit: FilaComprobacion }>>('celdaId');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaComprobacion }>>('celdaEstado');
  private readonly celdaVeredicto =
    viewChild.required<TemplateRef<{ $implicit: FilaHistorial }>>('celdaVeredicto');
  private readonly celdaFecha =
    viewChild.required<TemplateRef<{ $implicit: FilaHistorial }>>('celdaFecha');
  private readonly celdaOrigen =
    viewChild.required<TemplateRef<{ $implicit: FilaHistorial }>>('celdaOrigen');

  protected readonly columnas = computed<readonly ColumnDef<FilaComprobacion>[]>(() => [
    { key: 'id', header: 'Comprobación', priority: 1, cell: this.celdaId() },
    { key: 'status', header: 'Estado y severidad si falla', priority: 1, cell: this.celdaEstado() },
    { key: 'base', header: 'Cumplen', priority: 2, align: 'end' },
    { key: 'hallazgos', header: 'Hallazgos', priority: 2, align: 'end' },
  ]);

  protected readonly columnasHistorial = computed<readonly ColumnDef<FilaHistorial>[]>(() => [
    { key: 'fecha', header: 'Evaluada', priority: 1, cell: this.celdaFecha() },
    { key: 'veredicto', header: 'Veredicto', priority: 1, cell: this.celdaVeredicto() },
    { key: 'origen', header: 'Origen', priority: 2, cell: this.celdaOrigen() },
    { key: 'dimensiones', header: 'Puntaje por dimensión', priority: 3 },
  ]);

  protected readonly porId = (fila: FilaComprobacion): string => fila.id;
  protected readonly nombreFila = (fila: FilaComprobacion): string => fila.id;
  protected readonly porCorrida = (fila: FilaHistorial): string => fila.id;
  protected readonly nombreCorrida = (fila: FilaHistorial): string =>
    dateTime(fila.entry.evaluatedAt);

  private carga: Subscription | null = null;
  private pedido: Subscription | null = null;
  private espera: ReturnType<typeof setTimeout> | null = null;
  private esperas = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.carga?.unsubscribe();
      this.pedido?.unsubscribe();
      this.cancelarEspera();
    });
    this.cargar();
  }

  protected cargar(): void {
    this.carga?.unsubscribe();
    this.cancelarEspera();
    this.esperas = 0;
    this.estado.set(loading());
    this.leer();
  }

  /** Lee el resultado; si hay una corrida en vuelo, vuelve a leer hasta que termine (con tope). */
  private leer(): void {
    this.carga?.unsubscribe();
    this.carga = this.client.latest().subscribe({
      next: (respuesta) => {
        this.estado.set(estadoDe(respuesta));
        if (respuesta.running !== null && this.esperas < MAXIMO_DE_ESPERAS) {
          this.esperas += 1;
          this.espera = setTimeout(() => this.leer(), INTERVALO_DE_ESPERA_MS);
        }
      },
      error: (e: unknown) => this.estado.set(errorToViewState<CatalogFit>(e)),
    });
  }

  private cancelarEspera(): void {
    if (this.espera !== null) clearTimeout(this.espera);
    this.espera = null;
  }

  protected ejecutar(): void {
    if (this.solicitando()) return;
    this.solicitando.set(true);
    this.falloAlEjecutar.set(null);
    this.pedido?.unsubscribe();
    this.pedido = this.client.run().subscribe({
      next: () => {
        this.solicitando.set(false);
        this.cancelarEspera();
        this.esperas = 0;
        this.leer();
      },
      error: (e: unknown) => {
        this.solicitando.set(false);
        const fallo = errorToViewState<CatalogFit>(e);
        this.falloAlEjecutar.set(
          fallo.status === 'forbidden'
            ? 'Su rol puede leer el resultado pero no pedir una corrida. Hace falta un rol de escritura del catálogo de datos.'
            : fallo.status === 'offline'
              ? 'No se pudo llegar a la API. Reintente en unos segundos: es seguro, la API no duplica la corrida.'
              : 'No se pudo pedir la corrida. Reintente; si se repite, comparta el código de soporte.',
        );
      },
    });
  }

  protected seleccionar(fila: FilaComprobacion): void {
    this.seleccionada.set(fila.id);
  }

  protected cerrarDetalle(): void {
    this.seleccionada.set(null);
  }

  /** El estado de una dimensión según sus comprobaciones (no un umbral del puntaje). */
  protected estadoDimension(
    d: FitDimensionScore,
    checks: readonly FitCheckResult[],
  ): { label: string; tone: Tone } {
    switch (dimensionTone(d, checks)) {
      case 'error':
        return { label: 'Falla grave', tone: 'error' };
      case 'warning':
        return { label: 'Con fallas', tone: 'warning' };
      case 'success':
        return { label: 'Sin fallas', tone: 'success' };
      default:
        return { label: d.status === 'NO_DECLARADO' ? 'No declarado' : 'Sin medir', tone: 'secondary' };
    }
  }

  protected cambiarFiltro(valor: FiltroComprobaciones): void {
    this.filtro.set(valor);
    this.seleccionada.set(null);
  }
}
