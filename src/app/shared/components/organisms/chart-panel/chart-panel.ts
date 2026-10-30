import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { ECElementEvent } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';

import { ETIQUETA_DIMENSION } from '@core/data-access/reporting/reporting-labels';
import type { ChartSpec, FiltroActivo } from '@core/data-access/reporting/reporting.types';
import { nextControlId } from '@shared/forms/form-control.context';
import { AppButton } from '../../atoms/button/button';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';
import { ContentDialog } from '../content-dialog/content-dialog';
import { getContractViolations, hasData } from '@core/data-access/reporting/reporting-contract';
import { provideGraficos } from './chart-echarts.setup';
import { construirOpciones, clickedValue, type ModoGrafico } from './chart-option.builder';
import { tableToCsv, buildChartTable } from './chart-table';
import { leerTemaGraficos, type ChartTheme } from './chart-theme';

const MODOS: readonly SegmentedOption<ModoGrafico>[] = [
  { value: 'normal', label: 'Gráfico' },
  { value: 'velas', label: 'Velas' },
];

/**
 * El gráfico del portal de reportería, con la disciplina de ADR-0017:
 *
 * 1. **Título** (encabezado HTML).  2. **Gráfico** (Apache ECharts).
 * 3. **Leyenda** siempre.  4. **Tooltip** siempre.
 * 5. **Clic que filtra** (y su equivalente de teclado).
 * 6. **Cómo se calcula**.  7. **Velas**, cuando la serie las admite.
 *
 * Más lo que la skill de visualización exige: **tabla de respaldo** (tres tonos
 * de la paleta quedan bajo 3:1 de contraste), **ver en grande** y **CSV** — el
 * mismo menú que ya tiene AtlasDashboards. Si el `spec` no cumple el contrato,
 * el panel NO dibuja y lo dice: un gráfico que omite un punto sin motivo no sale.
 */
@Component({
  selector: 'app-chart-panel',
  imports: [NgxEchartsDirective, SegmentedControl, ContentDialog, AppButton, NavIcon],
  providers: [provideGraficos()],
  templateUrl: './chart-panel.html',
  styleUrl: './chart-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'gp-host', '(document:click)': 'cerrarMenuFuera($event)' },
})
export class ChartPanel {
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly spec = input.required<ChartSpec>();
  /** Valor ya filtrado de la dimensión de este gráfico, para resaltarlo. */
  readonly seleccion = input<string | null>(null);
  /** Dentro del diálogo «Ver en grande»: sin menú, más alto. */
  readonly grande = input(false);

  /** El gráfico NO decide si el filtro se activa o se quita: lo decide quien lo guarda. */
  readonly filtroCambia = output<FiltroActivo>();

  protected readonly ids = nextControlId('gp');
  protected readonly modos = MODOS;
  protected readonly modo = signal<ModoGrafico>('normal');
  protected readonly infoAbierta = signal(false);
  protected readonly menuAbierto = signal(false);
  protected readonly tablaAbierta = signal(false);
  protected readonly enGrande = signal(false);
  private readonly tema = signal<ChartTheme | null>(null);
  private readonly botonMenu = viewChild('botonMenu', { read: ElementRef<HTMLElement> });

  protected readonly violaciones = computed(() => getContractViolations(this.spec()));
  protected readonly modoEfectivo = computed<ModoGrafico>(() =>
    this.spec().velas === null ? 'normal' : this.modo(),
  );
  protected readonly hayDatos = computed(() =>
    this.modoEfectivo() === 'velas' ? (this.spec().velas?.velas.length ?? 0) > 0 : hasData(this.spec().datos),
  );
  protected readonly opciones = computed(() => {
    const tema = this.tema();
    if (tema === null || this.violaciones().length > 0 || !this.hayDatos()) {
      return null;
    }
    return construirOpciones({
      spec: this.spec(),
      tema,
      modo: this.modoEfectivo(),
      seleccion: this.seleccion(),
    });
  });
  protected readonly tabla = computed(() => buildChartTable(this.spec(), this.modoEfectivo()));
  protected readonly alto = computed(() => (this.grande() ? 520 : (this.spec().alto ?? 300)));
  protected readonly etiquetaFiltro = computed(() => {
    const f = this.spec().filtro;
    return f === null ? null : ETIQUETA_DIMENSION[f.dimension];
  });
  /** Elementos que se pueden filtrar, para el camino de teclado. */
  protected readonly elementosFiltrables = computed<readonly string[]>(() => {
    const spec = this.spec();
    if (spec.filtro === null || this.modoEfectivo() === 'velas') {
      return [];
    }
    const d = spec.datos;
    switch (d.tipo) {
      case 'cartesiano':
        return spec.filtro.valorDe === 'serie' ? d.series.map((s) => s.nombre) : d.categorias;
      case 'partes':
        return d.partes.map((p) => p.nombre);
      case 'cascada':
        return d.pasos.map((p) => p.nombre);
      case 'mapa-calor':
        return d.filas;
      case 'medidor':
        return [];
    }
  });

  constructor() {
    afterNextRender(() => {
      this.tema.set(leerTemaGraficos());
      const ventana = this.documento.defaultView;
      if (ventana === null) {
        return;
      }
      // ECharts mide el texto al dibujar: si la fuente web llega después, leyendas y ejes quedan
      // calculados con la de respaldo (se pisan o se cortan). Al terminar de cargar se reconstruye.
      void ventana.document.fonts?.ready.then(() => this.tema.set(leerTemaGraficos()));
      // El tema cambia por el atributo `data-theme` o por la preferencia del sistema.
      const releer = () => this.tema.set(leerTemaGraficos());
      const observador = new MutationObserver(releer);
      observador.observe(this.documento.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
      const media = ventana.matchMedia('(prefers-color-scheme: dark)');
      media.addEventListener('change', releer);
      this.destroyRef.onDestroy(() => {
        observador.disconnect();
        media.removeEventListener('change', releer);
      });
    });
  }

  protected alClic(evento: ECElementEvent): void {
    const spec = this.spec();
    if (spec.filtro === null || this.modoEfectivo() === 'velas') {
      return;
    }
    const valor = clickedValue(spec.datos, evento as { name?: string; value?: unknown; seriesName?: string }, spec.filtro);
    if (valor !== null) {
      this.filtroCambia.emit({ dimension: spec.filtro.dimension, valor });
    }
  }

  protected filtrarPorTeclado(valor: string): void {
    const f = this.spec().filtro;
    if (f !== null) {
      this.filtroCambia.emit({ dimension: f.dimension, valor });
    }
  }

  protected exportarCsv(): void {
    const blob = new Blob([tableToCsv(this.tabla())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = this.documento.createElement('a');
    a.href = url;
    a.download = `${this.spec().id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.menuAbierto.set(false);
  }

  protected elegir(accion: 'grande' | 'csv' | 'tabla'): void {
    if (accion === 'csv') {
      this.exportarCsv();
      return;
    }
    this.menuAbierto.set(false);
    this.botonMenu()?.nativeElement.focus();
    if (accion === 'grande') {
      this.enGrande.set(true);
    } else {
      this.tablaAbierta.update((v) => !v);
    }
  }

  protected tecladoMenu(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.menuAbierto.set(false);
      this.botonMenu()?.nativeElement.focus();
      return;
    }
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') {
      return;
    }
    evento.preventDefault();
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const i = items.indexOf(this.documento.activeElement as HTMLElement);
    const sig = evento.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[sig]?.focus();
  }

  protected alternarMenu(): void {
    const abrir = !this.menuAbierto();
    this.menuAbierto.set(abrir);
    if (abrir) {
      queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    }
  }

  protected cerrarMenuFuera(evento: Event): void {
    if (this.menuAbierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.menuAbierto.set(false);
    }
  }
}
