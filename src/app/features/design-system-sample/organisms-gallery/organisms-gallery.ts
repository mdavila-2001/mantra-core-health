import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import {
  empty,
  loading,
  ready,
  routeAuthPending,
  stale,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AuthLayout } from '../../../shared/components/organisms/auth-layout/auth-layout';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type {
  ColumnDef,
  CursorState,
  SortState,
} from '../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../shared/components/organisms/filter-bar/filter-bar';
import type { FilterDef } from '../../../shared/components/organisms/filter-bar/filter-bar';
import { AppMap } from '../../../shared/components/organisms/map/map';
import type { PinMapa } from '../../../shared/components/organisms/map/pin-mapa.types';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { Header } from '../../../shared/components/organisms/header/header';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import type { PageHeaderAction } from '../../../shared/components/organisms/page-header/page-header';
import { SideNav } from '../../../shared/components/organisms/side-nav/side-nav';
import type { NavSection } from '../../../shared/components/organisms/side-nav/side-nav.types';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { TenantSwitcher } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher';
import type { TenantOption } from '../../../shared/components/organisms/tenant-switcher/tenant-switcher.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { Input } from '../../../shared/components/atoms/input/input';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';

/** Fila de muestra del listado. */
interface PacienteDemo {
  readonly id: string;
  readonly apellido: string;
  readonly documento: string;
  readonly servicio: string;
  readonly obraSocial: string;
}

const PACIENTES: readonly PacienteDemo[] = [
  {
    id: 'p-1',
    apellido: 'Peña, Andrea',
    documento: '4821133',
    servicio: 'Cardiología',
    obraSocial: 'Caja Nacional',
  },
  {
    id: 'p-2',
    apellido: 'Salas, Bruno',
    documento: '7233901',
    servicio: 'Clínica médica',
    obraSocial: 'Particular',
  },
  {
    id: 'p-3',
    apellido: 'Ruiz, Carla',
    documento: '9110488',
    servicio: 'Pediatría',
    obraSocial: 'Caja Petrolera',
  },
];

/**
 * Los 12 organismos en un solo lugar. La vitrina es la superficie de
 * observación del sistema: si una pieza no se muestra acá, deja de mirarse.
 */
@Component({
  selector: 'app-organisms-gallery',
  imports: [
    AppButton,
    AppMap,
    AuthLayout,
    DataTable,
    FilterBar,
    FormActions,
    FormField,
    FormSection,
    Header,
    Input,
    PageHeader,
    SideNav,
    StatusSeal,
    TenantSwitcher,
    ViewStateHost,
  ],
  templateUrl: './organisms-gallery.html',
  styleUrl: './organisms-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganismsGallery {
  /* ---- view-state-host --------------------------------------------------- */

  private readonly estados: readonly ViewState<readonly string[]>[] = [
    routeAuthPending(),
    loading(),
    empty({ label: 'Registrar el primer paciente', route: '/design-system' }, 'Todavía no cargaste pacientes.'),
    ready(['Peña, Andrea', 'Salas, Bruno']),
    stale(['Peña, Andrea'], new Date(2026, 6, 31, 9, 30)),
  ];

  protected readonly estadoIndice = signal(0);
  protected readonly estadoActual = computed(() => this.estados[this.estadoIndice()]);
  protected readonly ultimoEventoEstado = signal('—');

  /* ---- shell: header y nav sueltos --------------------------------------- */

  protected readonly usuarioDemo = { displayName: 'Andrea Peña', roles: ['Médica'] };

  protected readonly tenantsDemo: readonly TenantOption[] = [
    { id: 'hosp-central', name: 'Hospital Central', role: 'Médica' },
    { id: 'clinica-sur', name: 'Clínica Sur', role: 'Interconsultora' },
  ];
  protected readonly tenantActivo = signal<string | null>('hosp-central');

  protected readonly seccionesNav: readonly NavSection[] = [
    {
      label: 'Atención',
      items: [
        { label: 'Inicio', route: '/', icon: 'home' },
        { label: 'Pacientes', route: '/design-system', icon: 'patients', badge: 3 },
        { label: 'Agenda', route: '/design-system', icon: 'calendar' },
      ],
    },
    {
      label: 'Administración',
      items: [{ label: 'Facturación', route: '/design-system', icon: 'billing', disabled: true }],
    },
  ];
  protected readonly navColapsado = signal(false);

  /* ---- page-header -------------------------------------------------------- */

  protected readonly accionesPagina: readonly PageHeaderAction[] = [
    { code: 'print', label: 'Imprimir' },
    { code: 'export', label: 'Exportar' },
    { code: 'audit', label: 'Ver auditoría' },
  ];
  protected readonly ultimaAccionPagina = signal('—');

  /* ---- formularios -------------------------------------------------------- */

  protected readonly seccionPlegable = signal(true);
  protected readonly campoInvalido = signal(false);
  protected readonly guardando = signal(false);
  protected readonly ultimoEnvio = signal('—');

  /* ---- data-table y filter-bar -------------------------------------------- */

  protected readonly columnas: readonly ColumnDef<PacienteDemo>[] = [
    { key: 'apellido', header: 'Paciente', priority: 1, sortable: true },
    { key: 'documento', header: 'Documento', priority: 1, align: 'end' },
    { key: 'servicio', header: 'Servicio', priority: 2, sortable: true },
    { key: 'obraSocial', header: 'Obra social', priority: 3 },
  ];

  protected readonly porId = (row: PacienteDemo): string => row.id;

  protected readonly listado = signal<ViewState<readonly PacienteDemo[]>>(ready(PACIENTES));
  protected readonly orden = signal<SortState | null>(null);
  protected readonly cursor = signal<CursorState>({ nextCursor: 'cur-2' });
  protected readonly ultimoCursor = signal('—');
  protected readonly seleccionados = signal(0);

  protected readonly filtrosDemo: readonly FilterDef[] = [
    {
      key: 'servicio',
      label: 'Servicio',
      options: [
        { value: 'card', label: 'Cardiología' },
        { value: 'clin', label: 'Clínica médica' },
        { value: 'pedi', label: 'Pediatría' },
      ],
    },
    {
      key: 'diagnostico',
      label: 'Diagnóstico',
      options: [],
      unavailableReason: 'El catálogo MeSH no está disponible en la vitrina.',
    },
  ];
  protected readonly ultimosFiltros = signal('—');

  /* ---- mapa ---------------------------------------------------------------- */

  // Los ids son los códigos que la pantalla real pinta en las tarjetas (A/B/C):
  // en el mapa jamás viaja un uuid.
  protected readonly pinesDemo: readonly PinMapa[] = [
    {
      id: 'A',
      codigo: 'A',
      lat: -17.7837,
      lng: -63.1812,
      titulo: 'Farmacia Central · Sucursal 24 de Septiembre',
      subtitulo: 'a 0,4 km en línea recta',
      estado: { etiqueta: 'Tiene todo', tono: 'success' },
      ctaEtiqueta: 'Ver en la lista',
    },
    {
      id: 'B',
      codigo: 'B',
      lat: -17.771,
      lng: -63.195,
      titulo: 'Farmacia del Sur · Sucursal Equipetrol',
      subtitulo: 'a 2,1 km en línea recta',
      estado: { etiqueta: 'Le falta algo', tono: 'warning' },
      ctaEtiqueta: 'Ver en la lista',
    },
    {
      id: 'C',
      codigo: 'C',
      lat: -17.832,
      lng: -63.123,
      titulo: 'Farmacia Vida · Sucursal Plan 3000',
      subtitulo: 'a 8,7 km en línea recta',
      estado: { etiqueta: 'Tiene todo', tono: 'success' },
      ctaEtiqueta: 'Ver en la lista',
    },
  ];

  protected readonly pinSeleccionado = signal<string | null>(null);
  protected readonly ultimoPinElegido = signal('—');

  /* ---- acciones ----------------------------------------------------------- */

  protected siguienteEstado(): void {
    this.estadoIndice.update((indice) => (indice + 1) % this.estados.length);
  }

  protected nombreEstado(): string {
    return this.estadoActual().status;
  }

  protected registrarEventoEstado(evento: string): void {
    this.ultimoEventoEstado.set(evento);
  }

  protected cambiarTenant(id: string): void {
    this.tenantActivo.set(id);
  }

  protected alternarNav(): void {
    this.navColapsado.update((colapsado) => !colapsado);
  }

  protected registrarAccionPagina(code: string): void {
    this.ultimaAccionPagina.set(code);
  }

  protected registrarEnvio(etiqueta: string): void {
    this.ultimoEnvio.set(etiqueta);
    this.guardando.set(true);
    setTimeout(() => this.guardando.set(false), 1200);
  }

  protected ordenar(sort: SortState): void {
    this.orden.set(sort);
  }

  protected moverCursor(cursor: string): void {
    this.ultimoCursor.set(cursor);
    this.cursor.set(cursor === 'cur-2' ? { prevCursor: 'cur-1' } : { nextCursor: 'cur-2' });
  }

  protected registrarSeleccion(filas: readonly PacienteDemo[]): void {
    this.seleccionados.set(filas.length);
  }

  protected registrarPinElegido(id: string): void {
    this.ultimoPinElegido.set(id);
  }

  protected registrarFiltros(filtros: Readonly<Record<string, string>>): void {
    const entradas = Object.entries(filtros);
    this.ultimosFiltros.set(
      entradas.length === 0 ? '(sin filtros)' : entradas.map(([k, v]) => `${k}=${v}`).join(' · '),
    );
  }
}
