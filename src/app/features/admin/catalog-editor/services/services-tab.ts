import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild, type OnInit, type TemplateRef } from '@angular/core';

import { CatalogEditorClient } from '../../../../core/data-access/admin-portal/catalog-editor.client';
import type { AdminServiceItem, ServiceScopes } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import { SearchField } from '../../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PaginadorDeCursor } from '../catalog-editor-pager';
import { fallosDeCatalogo, fechaCorta, rotuloDeTipoDeOrganizacion } from '../catalog-editor-support';
import { ServiceDialog } from './service-dialog';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

interface FilaServicio {
  readonly id: string;
  readonly item: AdminServiceItem;
  readonly code: string;
  readonly name: string;
  readonly practice: string;
  readonly price: string;
  readonly status: string;
  readonly version: string;
  readonly updated: string;
}

const TAMANO_DE_PAGINA = 20;

/**
 * Pestaña «Servicios»: el catálogo de servicios de facturación, por tipo de
 * organización dueña (el «tipo de usuario» de este catálogo). Alta, edición con
 * versión optimista y desactivación reversible; nada se borra.
 *
 * Cada pedido va a la API (`/admin/catalogs/services`) y la lista se vuelve a
 * leer tras cada cambio: lo que se ve es lo que quedó persistido.
 */
@Component({
  selector: 'app-catalog-services-tab',
  imports: [AppButton, Badge, Alert, RowActions, SearchField, SegmentedControl, DataTable, ViewStateHost, ServiceDialog],
  templateUrl: './services-tab.html',
  styleUrl: '../catalog-editor-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesTab implements OnInit {
  private readonly client = inject(CatalogEditorClient);
  protected readonly paginador = new PaginadorDeCursor();

  protected readonly alcance = signal<ViewState<ServiceScopes>>(loading());
  protected readonly tipo = signal<string | null>(null);
  protected readonly filtroEstado = signal<FiltroEstado>('todos');
  protected readonly busqueda = signal('');
  protected readonly lista = signal<ViewState<readonly FilaServicio[]>>(loading());
  protected readonly dialogo = signal<{ readonly servicio: AdminServiceItem | null } | null>(null);
  protected readonly enCurso = signal<string | null>(null);
  protected readonly aviso = signal<{ readonly tono: 'success' | 'error' | 'warning'; readonly texto: string } | null>(null);

  protected readonly opcionesEstado = [
    { value: 'todos' as const, label: 'Todos' },
    { value: 'activos' as const, label: 'Activos' },
    { value: 'inactivos' as const, label: 'Desactivados' },
  ];

  protected readonly opcionesTipo = computed(() => {
    const estado = this.alcance();
    return estado.status === 'ready' ? estado.data.types.map((t) => ({ value: t.conceptId, label: rotuloDeTipoDeOrganizacion(t.code, t.display) })) : [];
  });

  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: FilaServicio }>>('celdaEstado');
  private readonly celdaAcciones = viewChild.required<TemplateRef<{ $implicit: FilaServicio }>>('celdaAcciones');

  protected readonly columnas = computed<readonly ColumnDef<FilaServicio>[]>(() => [
    { key: 'code', header: 'Código', priority: 1 },
    { key: 'name', header: 'Servicio', priority: 1 },
    { key: 'practice', header: 'Práctica', priority: 2 },
    { key: 'price', header: 'Precio', priority: 1, align: 'end' },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'version', header: 'Versión', priority: 3, align: 'end' },
    { key: 'updated', header: 'Actualizado', priority: 3 },
    { key: 'acciones', header: 'Acciones', priority: 1, accion: true, sticky: 'end', cell: this.celdaAcciones() },
  ]);
  protected readonly porId = (fila: FilaServicio): string => fila.id;
  protected readonly nombreDeFila = (fila: FilaServicio): string => `${fila.code}, ${fila.name}`;

  ngOnInit(): void {
    this.cargarAlcance();
  }

  protected cargarAlcance(): void {
    this.alcance.set(loading());
    this.client.serviceScopes().subscribe({
      next: (alcance) => {
        if (alcance.types.length === 0) {
          this.alcance.set(empty({ label: 'Registre una práctica para poder cargar su catálogo.' }, 'La organización todavía no tiene prácticas con catálogo de servicios.'));
          return;
        }
        this.alcance.set(ready(alcance));
        this.tipo.set(alcance.types[0]!.conceptId);
        this.recargar();
      },
      error: (error: unknown) => this.alcance.set(errorToViewState<ServiceScopes>(error)),
    });
  }

  protected elegirTipo(conceptId: string): void {
    this.tipo.set(conceptId);
    this.recargar();
  }

  protected elegirEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.recargar();
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.recargar();
  }

  /** Vuelve a la primera página con los filtros vigentes. */
  protected recargar(): void {
    this.paginador.reiniciar();
    this.cargar(undefined);
  }

  protected mover(cursor: string): void {
    this.cargar(this.paginador.mover(cursor));
  }

  protected cargar(cursor: string | undefined): void {
    const tipo = this.tipo();
    if (tipo === null) return;
    const estado = this.filtroEstado();
    this.lista.set(loading());
    this.client
      .listServices({
        practiceTypeConceptId: tipo,
        ...(estado === 'todos' ? {} : { isActive: estado === 'activos' }),
        q: this.busqueda().trim(),
        limit: TAMANO_DE_PAGINA,
        ...(cursor === undefined ? {} : { cursor }),
      })
      .subscribe({
        next: (pagina) => {
          this.paginador.recibir(pagina.nextCursor);
          this.lista.set(
            pagina.items.length === 0
              ? empty(
                  { label: 'Use «Nuevo servicio» para cargar el primero, o cambie el filtro.' },
                  'No hay servicios con estos filtros en este tipo de organización.',
                )
              : ready(pagina.items.map((s) => this.aFila(s))),
          );
        },
        error: (error: unknown) => this.lista.set(errorToViewState<readonly FilaServicio[]>(error)),
      });
  }

  protected accionesDe(fila: FilaServicio): readonly RowAction[] {
    const ocupado = this.enCurso() !== null;
    return [
      { code: 'edit', label: 'Editar', icon: 'edit', disabled: ocupado },
      fila.item.isActive
        ? { code: 'deactivate', label: 'Desactivar', icon: 'eye-off', disabled: ocupado }
        : { code: 'reactivate', label: 'Reactivar', icon: 'refresh', disabled: ocupado },
    ];
  }

  protected ejecutar(fila: FilaServicio, accion: string): void {
    if (accion === 'edit') {
      this.dialogo.set({ servicio: fila.item });
      return;
    }
    if (this.enCurso() !== null) return;
    this.enCurso.set(fila.id);
    this.aviso.set(null);
    const peticion =
      accion === 'deactivate'
        ? this.client.deactivateService(fila.id, fila.item.rowVersion)
        : this.client.reactivateService(fila.id, fila.item.rowVersion);
    peticion.subscribe({
      next: (servicio) => {
        this.enCurso.set(null);
        this.aviso.set({
          tono: 'success',
          texto: `«${servicio.name}» ${servicio.isActive ? 'quedó activo' : 'quedó desactivado'} (versión ${servicio.rowVersion}).`,
        });
        this.cargar(this.paginador.actual());
      },
      error: (error: unknown) => {
        const fallo = fallosDeCatalogo(error, 'No se pudo cambiar el estado del servicio.');
        this.enCurso.set(null);
        this.aviso.set({ tono: fallo.conflictoDeVersion ? 'warning' : 'error', texto: fallo.general ?? 'No se pudo cambiar el estado.' });
        if (fallo.conflictoDeVersion) this.cargar(this.paginador.actual());
      },
    });
  }

  protected abrirAlta(): void {
    this.dialogo.set({ servicio: null });
  }

  protected cerrarDialogo(): void {
    this.dialogo.set(null);
  }

  protected guardado(servicio: AdminServiceItem): void {
    const alta = this.dialogo()?.servicio === null;
    this.dialogo.set(null);
    this.aviso.set({
      tono: 'success',
      texto: alta ? `«${servicio.name}» quedó creado.` : `«${servicio.name}» quedó guardado (versión ${servicio.rowVersion}).`,
    });
    this.cargar(alta ? undefined : this.paginador.actual());
  }

  protected recargarTras409(): void {
    this.dialogo.set(null);
    this.cargar(this.paginador.actual());
  }

  private aFila(s: AdminServiceItem): FilaServicio {
    const alcance = this.alcance();
    const practica = alcance.status === 'ready' ? alcance.data.practices.find((p) => p.id === s.practiceId) : undefined;
    return {
      id: s.id,
      item: s,
      code: s.code,
      name: s.name,
      practice: practica?.name ?? s.practiceId,
      price: withDisplayCurrency(s.defaultPrice, s.currencyCode),
      status: s.isActive ? 'Activo' : 'Desactivado',
      version: String(s.rowVersion),
      updated: fechaCorta(s.updatedAt),
    };
  }
}
