import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Injector,
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

import { formatearFecha } from '@core/data-access/reporting/reporting-format';
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
  host: { class: 'gp-host' },
})
export class ChartPanel {
  private readonly documento = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
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
        this.documento.removeEventListener('click', this.cerrarMenuFuera);
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

  /** Las fechas ISO de la primera columna se leen «6 oct 2026»; el CSV conserva el ISO. */
  protected fecha(celda: string): string {
    return formatearFecha(celda, true);
  }

  /** «Sin filtro por clic: Es una serie…» se lee mal con mayúscula tras los dos puntos. */
  protected minusculaInicial(texto: string): string {
    return texto.charAt(0).toLowerCase() + texto.slice(1);
  }

  protected exportarCsv(): void {
    const blob = new Blob([tableToCsv(this.tabla(), this.spec().unidad)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = this.documento.createElement('a');
    a.href = url;
    a.download = `${this.spec().id}.csv`;
    a.click();
    // Revocar al instante cancela la descarga en algunos navegadores (Safari): se le da tiempo de empezar.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.cerrarMenu(true);
  }

  protected elegir(accion: 'grande' | 'csv' | 'tabla'): void {
    if (accion === 'csv') {
      this.exportarCsv();
      return;
    }
    this.cerrarMenu(true);
    if (accion === 'grande') {
      this.enGrande.set(true);
    } else {
      this.tablaAbierta.update((v) => !v);
    }
  }

  protected tecladoMenu(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.cerrarMenu(true);
      return;
    }
    if (evento.key === 'Tab') {
      // Tab saca el foco del menú: se cierra, sin devolver el foco (seguiría a donde iba la persona).
      this.cerrarMenu(false);
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(evento.key)) {
      return;
    }
    evento.preventDefault();
    const items = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    if (items.length === 0) {
      return;
    }
    const i = items.indexOf(this.documento.activeElement as HTMLElement);
    // Con el foco en el contenedor (`i === -1`) la flecha hacia arriba va a la última opción, no a la penúltima.
    const ultimo = items.length - 1;
    let siguiente: number;
    if (evento.key === 'Home') {
      siguiente = 0;
    } else if (evento.key === 'End' || (evento.key === 'ArrowUp' && i === -1)) {
      siguiente = ultimo;
    } else if (evento.key === 'ArrowDown') {
      siguiente = (i + 1) % items.length;
    } else {
      siguiente = (i - 1 + items.length) % items.length;
    }
    items[siguiente]?.focus();
  }

  protected alternarMenu(): void {
    if (this.menuAbierto()) {
      this.cerrarMenu(false);
      return;
    }
    this.menuAbierto.set(true);
    // Solo mientras el menú está abierto se escucha el clic en el resto de la app: con decenas de paneles
    // por dashboard, un oyente permanente en cada uno revisaría todos los clics para nada.
    this.documento.addEventListener('click', this.cerrarMenuFuera);
    // Sin zone.js el menú se dibuja después de esta línea, no antes: el foco espera al render.
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('[role="menuitem"]')?.focus(), {
      injector: this.injector,
    });
  }

  private cerrarMenu(devolverFoco: boolean): void {
    this.menuAbierto.set(false);
    this.documento.removeEventListener('click', this.cerrarMenuFuera);
    if (devolverFoco) {
      this.botonMenu()?.nativeElement.focus();
    }
  }

  private readonly cerrarMenuFuera = (evento: Event): void => {
    if (this.menuAbierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.cerrarMenu(false);
    }
  };
}
