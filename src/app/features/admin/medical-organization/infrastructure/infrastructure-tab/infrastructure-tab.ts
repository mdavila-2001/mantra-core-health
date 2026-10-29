import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { InfrastructureCatalogStore } from '../../../../../core/data-access/infrastructure/infrastructure-catalog.store';
import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import {
  allowedChildForms,
  missingRequiredFunctions,
} from '../../../../../core/data-access/infrastructure/infrastructure.logic';
import type {
  CareSpaceDetail,
  CareSpaceNode,
  InfrastructureCatalog,
  SiteStructure,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tree } from '../../../../../shared/components/organisms/tree/tree';
import { treeAncestorIds } from '../../../../../shared/components/organisms/tree/tree.logic';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { BulkCreateDialog } from '../bulk-create-dialog/bulk-create-dialog';
import { CsvImportDialog } from '../csv-import-dialog/csv-import-dialog';
import {
  antiguedadEnPalabras,
  arbolDeEspacios,
  detalleANodo,
  minutosDesde,
  permisosDe,
  rutaDeEspacio,
  UMBRAL_DE_ATRASO_MIN,
  varianteDeEstado,
} from '../infrastructure.view';
import { SpaceFormDialog } from '../space-form-dialog/space-form-dialog';

/** El establecimiento que la consola ofrece elegir (lo que necesita de la sede, nada más). */
export interface SiteChoice {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

interface Vista {
  readonly structure: SiteStructure;
  readonly catalog: InfrastructureCatalog;
}

type Dialogo =
  | { readonly tipo: 'crear'; readonly parent: CareSpaceNode | null }
  | { readonly tipo: 'varios'; readonly parent: CareSpaceNode }
  | { readonly tipo: 'csv' };

/**
 * **Pestaña «Infraestructura»** de la consola de organización médica: el árbol
 * físico del establecimiento (edificio → piso → sala → habitación → cama), con
 * un panel de detalle al lado, y las altas — una, varias por patrón o por CSV.
 *
 * ## Los nueve estados
 *
 * S1 mientras no hay sesión con organización activa; S2 cargando; S3 un
 * establecimiento sin espacios, con «Agregar el primer edificio» / «Importar
 * CSV» (o, a quien no puede escribir, a quién pedirlo); S4 los rechazos de las
 * altas (en cada diálogo); S5 si la API niega la lectura; S6 un establecimiento
 * de otro tenant o inexistente, sin datos; S7 si la lectura tiene más de
 * {@link UMBRAL_DE_ATRASO_MIN} min, con «Actualizar»; S8 sin conexión; S9 error
 * con código de soporte.
 *
 * ## Qué puede hacer quien mira
 *
 * Los botones de escritura salen de `SiteSummary.viewer`: reflejan, no
 * autorizan. Sin permiso el árbol se ve completo y las acciones no están; si de
 * todas formas llegara una escritura, la API responde 403 y el diálogo lo dice.
 *
 * ## Lo que se ve tras crear
 *
 * El nodo nuevo se inserta **desde la respuesta** de la API, sin releer todo el
 * árbol, y queda elegido. La prueba de que persistió es recargar: la estructura
 * sale de la API, no de lo que esta pantalla recuerda. La importación por CSV sí
 * relee, porque su respuesta trae la cuenta y no los nodos.
 */
@Component({
  selector: 'app-infrastructure-tab',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    BulkCreateDialog,
    Card,
    CsvImportDialog,
    FormField,
    RouterLink,
    Select,
    SpaceFormDialog,
    Switch,
    Tree,
    ViewStateHost,
  ],
  templateUrl: './infrastructure-tab.html',
  styleUrl: './infrastructure-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfrastructureTab {
  /** Los establecimientos de la organización elegida. */
  readonly sites = input.required<readonly SiteChoice[]>();

  private readonly client = inject(InfrastructureClient);
  private readonly catalogStore = inject(InfrastructureCatalogStore);
  private readonly session = inject(SessionStore);

  protected readonly siteId = signal('');
  protected readonly state = signal<ViewState<Vista>>(routeAuthPending());
  /** Lo último que se leyó bien: los diálogos lo necesitan aunque el estado sea S3. */
  protected readonly vista = signal<Vista | null>(null);

  protected readonly selectedId = signal<string | null>(null);
  protected readonly expandedIds = signal<readonly string[]>([]);
  protected readonly mostrarClausurados = signal(false);
  protected readonly dialogo = signal<Dialogo | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly rutaDeEspacio = rutaDeEspacio;
  protected readonly varianteDeEstado = varianteDeEstado;

  protected readonly opcionesDeSitio = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
  );

  protected readonly permisos = computed(() => permisosDe(this.vista()?.structure.site ?? null, this.session.roles()));
  protected readonly puedeEscribir = computed(() => this.permisos().canWriteStructure);

  protected readonly nodos = computed(() =>
    arbolDeEspacios(this.vista()?.structure.spaces ?? [], this.mostrarClausurados()),
  );

  protected readonly seleccionado = computed<CareSpaceNode | null>(() => {
    const id = this.selectedId();
    return id === null ? null : (this.vista()?.structure.spaces.find((s) => s.id === id) ?? null);
  });

  private readonly unidades = computed(() => new Map((this.vista()?.structure.units ?? []).map((u) => [u.id, u.name])));

  protected readonly unidadDelSeleccionado = computed(() => {
    const s = this.seleccionado();
    return s?.clinicalUnitId == null ? null : (this.unidades().get(s.clinicalUnitId) ?? null);
  });

  protected readonly puedeAgregarDentro = computed(() => {
    const s = this.seleccionado();
    const v = this.vista();
    if (s === null || v === null || !this.puedeEscribir()) return false;
    return s.status.code !== 'SPACE_RETIRED' && allowedChildForms(v.catalog, s.form.code).length > 0;
  });

  protected readonly puedeAgregarVarios = computed(() => {
    const s = this.seleccionado();
    const v = this.vista();
    if (s === null || v === null || !this.puedeEscribir() || s.status.code === 'SPACE_RETIRED') return false;
    return allowedChildForms(v.catalog, s.form.code).includes('LOC_FORM_BED');
  });

  /** Cifras del establecimiento, contadas del árbol (no escritas). */
  protected readonly resumen = computed(() => {
    const espacios = (this.vista()?.structure.spaces ?? []).filter((s) => s.status.code !== 'SPACE_RETIRED');
    const activos = espacios.filter((s) => s.status.code === 'SPACE_ACTIVE');
    const cuenta = (fn: string): number => activos.filter((s) => s.function.code === `SPACE_FN_${fn}`).length;
    return {
      espacios: espacios.length,
      planificados: espacios.filter((s) => s.status.code === 'SPACE_PLANNED').length,
      camas: activos.filter((s) => s.form.code === 'LOC_FORM_BED').length,
      quirofanos: cuenta('OPERATING_ROOM'),
      consultorios: cuenta('CONSULTING_ROOM'),
    };
  });

  protected readonly faltantes = computed(() => {
    const v = this.vista();
    if (v === null) return [];
    const nombre = new Map(v.catalog.functions.map((f) => [f.code, f.display]));
    return missingRequiredFunctions(v.catalog, v.structure.site.regulatory.typology?.code ?? null, v.structure.spaces).map(
      (c) => nombre.get(c) ?? c,
    );
  });

  protected readonly codigosUsados = computed(() => new Set((this.vista()?.structure.spaces ?? []).map((s) => s.code)));

  constructor() {
    // Con un solo establecimiento no hay nada que elegir; con varios, el primero.
    effect(() => {
      const sitios = this.sites();
      const actual = untracked(() => this.siteId());
      if (sitios.length > 0 && !sitios.some((s) => s.id === actual)) {
        untracked(() => this.elegirSitio(sitios[0].id));
      }
    });
  }

  protected readonly _alTenantListo = effect(() => {
    const tenant = this.session.activeTenantId();
    const id = this.siteId();
    if (tenant !== null && id !== '' && untracked(() => this.state().status === 'route-auth-pending')) {
      untracked(() => this.cargar());
    }
  });

  protected elegirSitio(id: string): void {
    if (id === '' || id === this.siteId()) return;
    this.siteId.set(id);
    this.selectedId.set(null);
    this.expandedIds.set([]);
    this.vista.set(null);
    this.aviso.set(null);
    this.cargar();
  }

  protected cargar(): void {
    const id = this.siteId();
    if (id === '') return;
    // S1 sólo mientras la sesión no tiene organización activa: antes de eso no
    // se pide ningún dato del establecimiento.
    if (this.session.activeTenantId() === null) {
      this.state.set(routeAuthPending());
      return;
    }
    this.state.set(loading());
    forkJoin({ structure: this.client.getStructure(id), catalog: this.catalogStore.catalog() }).subscribe({
      next: (v) => {
        this.vista.set(v);
        this.state.set(this.estadoDe(v));
        // La primera vez se abren los dos primeros niveles: el árbol no llega cerrado.
        if (this.expandedIds().length === 0) {
          this.expandedIds.set(v.structure.spaces.filter((s) => s.parentId === null && s.childCount > 0).map((s) => s.id));
        }
      },
      error: (error: unknown) => {
        this.vista.set(null);
        this.state.set(infrastructureErrorToViewState<Vista>(error));
      },
    });
  }

  private estadoDe(v: Vista): ViewState<Vista> {
    if (v.structure.spaces.length === 0) {
      return empty(
        { label: this.permisosDeVista(v).canWriteStructure ? 'Agregar el primer edificio' : 'Pida a un administrador del establecimiento que cargue la estructura' },
        'Este establecimiento todavía no tiene espacios. El árbol se arma de arriba hacia abajo: edificio, piso, sala, habitación, cama.',
      );
    }
    const minutos = minutosDesde(v.structure.asOf);
    return minutos >= UMBRAL_DE_ATRASO_MIN ? stale(v, new Date(v.structure.asOf)) : ready(v);
  }

  private permisosDeVista(v: Vista) {
    return permisosDe(v.structure.site, this.session.roles());
  }

  protected readonly antiguedad = computed(() => {
    const v = this.vista();
    return v === null ? '' : antiguedadEnPalabras(minutosDesde(v.structure.asOf));
  });

  // ─ acciones

  protected abrirAlta(parent: CareSpaceNode | null): void {
    this.dialogo.set({ tipo: 'crear', parent });
  }

  protected abrirAltaEnSeleccion(): void {
    const s = this.seleccionado();
    if (s !== null) this.abrirAlta(s);
  }

  protected abrirVarios(): void {
    const s = this.seleccionado();
    if (s !== null) this.dialogo.set({ tipo: 'varios', parent: s });
  }

  protected cerrarDialogo(): void {
    this.dialogo.set(null);
  }

  /** Inserta lo creado desde la respuesta de la API y elige el último. */
  protected alCrear(creados: readonly CareSpaceDetail[]): void {
    const v = this.vista();
    if (v === null || creados.length === 0) return;
    const nuevos = creados.map(detalleANodo);
    const padres = new Set(nuevos.map((n) => n.parentId).filter((p): p is string => p !== null));
    const spaces = [
      ...v.structure.spaces.map((s) => (padres.has(s.id) ? { ...s, childCount: s.childCount + nuevos.filter((n) => n.parentId === s.id).length } : s)),
      ...nuevos,
    ];
    const siguiente: Vista = { ...v, structure: { ...v.structure, spaces } };
    this.vista.set(siguiente);
    this.state.set(this.estadoDe(siguiente));
    const objetivo = nuevos[nuevos.length - 1];
    const arbol = arbolDeEspacios(spaces, true);
    this.expandedIds.set([...new Set([...this.expandedIds(), ...treeAncestorIds(arbol, objetivo.id)])]);
    this.selectedId.set(objetivo.id);
    this.dialogo.set(null);
    this.aviso.set(
      nuevos.length === 1
        ? `Se creó «${objetivo.name}» (${objetivo.code}).`
        : `Se crearon ${nuevos.length} espacios (${nuevos[0].code} … ${objetivo.code}).`,
    );
  }

  protected alImportar(cantidad: number): void {
    this.dialogo.set(null);
    this.aviso.set(`Se importaron ${cantidad} ${cantidad === 1 ? 'espacio' : 'espacios'}.`);
    this.cargar();
  }

  protected alElegirNodo(id: string | null): void {
    this.selectedId.set(id);
  }

  protected formaDeLaSeleccion = computed(() => this.seleccionado()?.form.display ?? '');
}
