import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, TemplateRef, untracked, viewChild } from '@angular/core';

import { ObservabilityClient } from '@core/data-access/observability/observability.client';
import type { ErrorGroupsPage, ErrorGroupState, ObsWindowQuery, RequestTrace } from '@core/data-access/observability/observability.types';
import { NO_DATA } from '@core/data-access/reporting/reporting-format';
import { dataOf, empty, isReady } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { DataTable } from '@shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '@shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';
import { type EstadoFiltro, ObservabilityContextStore } from '../state/observability-context.store';
import { atrasoDeFrescura, WidgetState } from '../state/widget-state';
import { ObsErrorDetalle } from './error-detalle';
import { ESTADO_GRUPO, filaDeGrupo, type FilaGrupo } from './error-rows';
import { fechaHoraCompleta } from './obs-format';

const ESTADOS: readonly SelectOption<EstadoFiltro>[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'NEW', label: 'Nuevo' },
  { value: 'SEEN', label: 'Visto' },
  { value: 'RESOLVED', label: 'Resuelto' },
  { value: 'IGNORED', label: 'Ignorado' },
];

/**
 * Errores: los grupos (misma huella = mismo problema), el detalle de uno con sus eventos y `requestId`, la
 * búsqueda de una petición por su `requestId` y el cambio de estado con motivo.
 */
@Component({
  selector: 'app-obs-tab-errores',
  imports: [ViewStateHost, DataTable, Select, Input, FormField, AppButton, ObsErrorDetalle],
  templateUrl: './tab-errores.html',
  styleUrls: ['./tab-layout.css', './tab-errores.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObsTabErrores {
  private readonly api = inject(ObservabilityClient);
  protected readonly store = inject(ObservabilityContextStore);

  protected readonly estados = ESTADOS;
  protected readonly grupos = new WidgetState<ErrorGroupsPage>();
  protected readonly traza = new WidgetState<RequestTrace>();
  protected readonly busqueda = signal('');
  protected readonly zona = this.store.zona;

  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: FilaGrupo }>>('celdaEstado');
  private readonly celdaRequest = viewChild.required<TemplateRef<{ $implicit: FilaGrupo }>>('celdaRequest');

  protected readonly filas = computed<ViewState<readonly FilaGrupo[]>>(() => {
    const s = this.grupos.state();
    if (s.status === 'ready' || s.status === 'stale') {
      const zona = this.store.zona();
      return { ...s, data: s.data.items.map((g) => filaDeGrupo(g, zona)) };
    }
    return s as ViewState<readonly FilaGrupo[]>;
  });

  protected readonly columnas = computed<readonly ColumnDef<FilaGrupo>[]>(() => [
    { key: 'titulo', header: 'Error', priority: 1 },
    { key: 'codigo', header: 'Código', priority: 1 },
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'modulo', header: 'Módulo', priority: 2 },
    { key: 'ocurrencias', header: 'Ocurrencias', priority: 1, align: 'end' },
    { key: 'ultimas24h', header: '24 h', priority: 2, align: 'end' },
    { key: 'ultimo', header: 'Último visto', priority: 2 },
    { key: 'requestId', header: 'Último requestId', priority: 3, cell: this.celdaRequest() },
  ]);

  protected readonly porId = (f: FilaGrupo): string => f.id;
  protected readonly nombreDeFila = (f: FilaGrupo): string => f.titulo;
  protected readonly estadoInfo = (e: ErrorGroupState) => ESTADO_GRUPO[e];
  protected readonly traceFecha = (iso: string | null): string => fechaHoraCompleta(iso, this.store.zona());
  protected readonly sinDato = NO_DATA;

  constructor() {
    effect(() => {
      const q = this.store.consulta();
      this.store.version();
      const filtros = { estado: this.store.estado(), modulo: this.store.modulo(), codigo: this.store.codigo() };
      untracked(() => this.cargar(q, filtros));
    });
    effect(() => {
      const id = this.store.requestId();
      untracked(() => {
        this.busqueda.set(id);
        if (id === '') this.traza.reiniciar();
        else this.buscar(id);
      });
    });
  }

  protected cargar(q: ObsWindowQuery, f: { estado: EstadoFiltro; modulo: string; codigo: string }): void {
    this.grupos.cargar(
      this.api.errorGroups({
        ...q,
        interval: undefined,
        limit: 50,
        ...(f.estado === '' ? {} : { state: f.estado }),
        ...(f.modulo === '' ? {} : { module: f.modulo }),
        ...(f.codigo === '' ? {} : { code: f.codigo }),
      }),
      {
        alRecibir: (p) => this.store.publicarFrescura(p.freshness),
        vacio: (p) => {
          if (p.items.length > 0) return null;
          const filtrado = f.estado !== '' || f.modulo !== '' || f.codigo !== '';
          return filtrado
            ? empty({ label: 'Quite un filtro para ver más grupos.' }, 'Ningún grupo de errores coincide con los filtros.')
            : empty({ label: 'Amplíe el rango de tiempo.' }, 'No hay errores agrupados en esta ventana: el sistema no registró fallos.');
        },
        atrasado: (p) => atrasoDeFrescura(p.freshness),
      },
    );
  }

  protected recargar(): void {
    this.cargar(this.store.consulta(), { estado: this.store.estado(), modulo: this.store.modulo(), codigo: this.store.codigo() });
  }

  protected abrir(fila: FilaGrupo): void {
    this.store.grupo.set(fila.id);
  }

  protected buscarPorEntrada(): void {
    this.store.requestId.set(this.busqueda().trim());
  }

  private buscar(id: string): void {
    this.traza.cargar(this.api.request(id));
  }

  protected limpiarBusqueda(): void {
    this.busqueda.set('');
    this.store.requestId.set('');
  }

  protected rutaGrupo(id: string): void {
    this.store.grupo.set(id);
  }

  protected readonly nota = computed(() => dataOf(this.grupos.state())?.note ?? '');
  protected readonly trazaDatos = computed(() => dataOf(this.traza.state()));
  protected readonly trazaListo = computed(() => isReady(this.traza.state()));

  protected cambiarEstado(v: EstadoFiltro | null): void {
    this.store.estado.set(v ?? '');
  }

  protected copiar(texto: string): void {
    void navigator.clipboard?.writeText(texto);
  }

  protected grupoEstadoTexto(e: ErrorGroupState): string {
    return ESTADO_GRUPO[e].texto;
  }
}
