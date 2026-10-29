import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';

import { SessionStore } from '../../../../../core/auth/session.store';
import { InfrastructureCatalogStore } from '../../../../../core/data-access/infrastructure/infrastructure-catalog.store';
import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import { missingRequiredFunctions } from '../../../../../core/data-access/infrastructure/infrastructure.logic';
import type {
  InfrastructureCatalog,
  SiteCapacity,
  SiteLicense,
  SiteStructure,
  SiteSummary,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { empty, loading, ready, routeAuthPending, stale } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import type { SiteChoice } from '../infrastructure-tab/infrastructure-tab';
import { antiguedadEnPalabras, fechaCorta, minutosDesde, permisosDe, UMBRAL_DE_ATRASO_MIN, varianteDeHabilitacion } from '../infrastructure.view';
import { CapacityFormDialog } from './capacity-form-dialog';
import { LicenseFormDialog } from './license-form-dialog';
import { RegulatoryFormDialog } from './regulatory-form-dialog';

interface FilaDeCapacidad {
  readonly kindCode: string;
  readonly etiqueta: string;
  readonly declarada: number | null;
  readonly corte: string | null;
  readonly resolucion: string | null;
  readonly real: number;
  readonly diferencia: number | null;
}

type Dialogo = 'regulatorio' | 'capacidad' | { readonly licencia: SiteLicense | null };

/** Días de aviso antes del vencimiento de una habilitación (sólo para decirlo; el estado lo calcula el servidor). */
const AVISO_DE_VENCIMIENTO_DIAS = 30;

/**
 * **Pestaña «Establecimiento»**: la sede como unidad regulada — datos del SNIS y
 * del SEDES, habilitaciones y capacidad declarada frente a la real.
 *
 * Una sola tarjeta con tres pestañas (regla del 09/09/2026), y cada sección con
 * **su propia lectura y sus nueve estados**: la estructura trae lo regulatorio,
 * las habilitaciones y la capacidad son rutas aparte, y una puede fallar sin
 * tumbar a las otras.
 *
 * ## Capacidad real vs. declarada
 *
 * La real **no se escribe nunca**: la API la cuenta del árbol (camas censables
 * activas, quirófanos activos…). La declarada se agrega con fecha de corte y
 * resolución. La diferencia se muestra tal cual — «declaró 10, hay 4» — y
 * ninguno de los dos lados se corrige en silencio.
 *
 * ## Quién edita
 *
 * Lo regulatorio es un acto de la organización ante el SEDES: la sucursal lo ve
 * pero no lo cambia (matriz de permisos §2). La interfaz lo refleja con
 * `SiteSummary.viewer`; la API responde 403 a quien lo intente igual.
 */
@Component({
  selector: 'app-establishment-tab',
  imports: [
    Alert,
    AppButton,
    Badge,
    CapacityFormDialog,
    Card,
    FormField,
    LicenseFormDialog,
    RegulatoryFormDialog,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './establishment-tab.html',
  styleUrl: './establishment-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablishmentTab {
  readonly sites = input.required<readonly SiteChoice[]>();

  private readonly client = inject(InfrastructureClient);
  private readonly catalogStore = inject(InfrastructureCatalogStore);
  private readonly session = inject(SessionStore);

  protected readonly siteId = signal('');
  protected readonly pestana = signal(0);
  protected readonly dialogo = signal<Dialogo | null>(null);

  // Cada sección con su propio estado.
  protected readonly estructura = signal<ViewState<{ structure: SiteStructure; catalog: InfrastructureCatalog }>>(routeAuthPending());
  protected readonly habilitaciones = signal<ViewState<readonly SiteLicense[]>>(routeAuthPending());
  protected readonly capacidad = signal<ViewState<SiteCapacity>>(routeAuthPending());

  private readonly datos = signal<{ structure: SiteStructure; catalog: InfrastructureCatalog } | null>(null);
  private readonly capacidadLeida = signal<SiteCapacity | null>(null);

  protected readonly opcionesDeSitio = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((s) => ({ value: s.id, label: `${s.name} (${s.code})` })),
  );

  protected readonly listaDeHabilitaciones = computed(() => {
    const h = this.habilitaciones();
    return h.status === 'ready' || h.status === 'stale' ? h.data : [];
  });

  protected readonly sitio = computed<SiteSummary | null>(() => this.datos()?.structure.site ?? null);
  protected readonly catalogo = computed(() => this.datos()?.catalog ?? null);
  protected readonly permisos = computed(() => permisosDe(this.sitio(), this.session.roles()));
  protected readonly unidades = computed(() => this.datos()?.structure.units ?? []);
  private readonly nombreDeUnidad = computed(() => new Map(this.unidades().map((u) => [u.id, u.name])));

  protected readonly fechaCorta = fechaCorta;
  protected readonly varianteDeHabilitacion = varianteDeHabilitacion;

  /** Tabla de capacidad: una fila por tipo que se declaró o que existe en el árbol. */
  protected readonly filasDeCapacidad = computed<readonly FilaDeCapacidad[]>(() => {
    const cap = this.capacidadLeida();
    const cat = this.catalogo();
    if (cap === null || cat === null) return [];
    const nombre = new Map(cat.regulatory.capacityKind.map((k) => [k.code, k.display]));
    const codigos = new Set([...cap.declared.map((d) => d.kindCode), ...cap.derived.filter((d) => d.quantity > 0).map((d) => d.kindCode)]);
    return [...codigos]
      .sort((a, b) => cat.regulatory.capacityKind.findIndex((k) => k.code === a) - cat.regulatory.capacityKind.findIndex((k) => k.code === b))
      .map((kindCode) => {
        const declarada = cap.declared.find((d) => d.kindCode === kindCode);
        const real = cap.derived.find((d) => d.kindCode === kindCode)?.quantity ?? 0;
        return {
          kindCode,
          etiqueta: nombre.get(kindCode) ?? kindCode,
          declarada: declarada?.quantity ?? null,
          corte: declarada?.asOf ?? null,
          resolucion: declarada?.resolutionNumber ?? null,
          real,
          diferencia: declarada === undefined ? null : real - declarada.quantity,
        };
      });
  });

  protected readonly faltantes = computed(() => {
    const d = this.datos();
    if (d === null) return [];
    const nombre = new Map(d.catalog.functions.map((f) => [f.code, f.display]));
    return missingRequiredFunctions(d.catalog, d.structure.site.regulatory.typology?.code ?? null, d.structure.spaces).map((c) => nombre.get(c) ?? c);
  });

  protected readonly capacidadAntiguedad = computed(() => {
    const a = this.capacidadLeida()?.asOf;
    return a === undefined ? '' : antiguedadEnPalabras(minutosDesde(a));
  });

  constructor() {
    effect(() => {
      const sitios = this.sites();
      const actual = untracked(() => this.siteId());
      if (sitios.length > 0 && !sitios.some((s) => s.id === actual)) untracked(() => this.elegirSitio(sitios[0].id));
    });
    effect(() => {
      const tenant = this.session.activeTenantId();
      const id = this.siteId();
      if (tenant !== null && id !== '' && untracked(() => this.estructura().status === 'route-auth-pending')) untracked(() => this.cargarTodo());
    });
  }

  protected elegirSitio(id: string): void {
    if (id === '' || id === this.siteId()) return;
    this.siteId.set(id);
    this.datos.set(null);
    this.cargarTodo();
  }

  protected cargarTodo(): void {
    this.cargarEstructura();
    this.cargarHabilitaciones();
    this.cargarCapacidad();
  }

  protected cargarEstructura(): void {
    if (this.siteId() === '' || this.session.activeTenantId() === null) return;
    this.estructura.set(loading());
    forkJoin({ structure: this.client.getStructure(this.siteId()), catalog: this.catalogStore.catalog() }).subscribe({
      next: (d) => {
        this.datos.set(d);
        this.estructura.set(ready(d));
      },
      error: (error: unknown) => {
        this.datos.set(null);
        this.estructura.set(infrastructureErrorToViewState(error));
      },
    });
  }

  protected cargarHabilitaciones(): void {
    if (this.siteId() === '' || this.session.activeTenantId() === null) return;
    this.habilitaciones.set(loading());
    this.client.listLicenses(this.siteId()).subscribe({
      next: (lista) => {
        this.habilitaciones.set(
          lista.length === 0
            ? empty({ label: this.permisos().canEditRegulatory ? 'Registrar la primera habilitación' : 'Pida a la organización que registre la habilitación' }, 'Este establecimiento no tiene habilitaciones registradas.')
            : ready(lista),
        );
      },
      error: (error: unknown) => this.habilitaciones.set(infrastructureErrorToViewState(error)),
    });
  }

  protected cargarCapacidad(): void {
    if (this.siteId() === '' || this.session.activeTenantId() === null) return;
    this.capacidad.set(loading());
    this.client.getCapacity(this.siteId()).subscribe({
      next: (cap) => {
        this.capacidadLeida.set(cap);
        if (cap.declared.length === 0) {
          this.capacidad.set(empty({ label: this.permisos().canEditRegulatory ? 'Declarar capacidad' : 'Pida a la organización que declare la capacidad' }, 'No se declaró capacidad ante la autoridad. La real se cuenta del árbol y se ve igual.'));
        } else if (cap.asOf !== undefined && minutosDesde(cap.asOf) >= UMBRAL_DE_ATRASO_MIN) {
          this.capacidad.set(stale(cap, new Date(cap.asOf)));
        } else {
          this.capacidad.set(ready(cap));
        }
      },
      error: (error: unknown) => this.capacidad.set(infrastructureErrorToViewState(error)),
    });
  }

  protected alGuardarRegulatorio(sitio: SiteSummary): void {
    const d = this.datos();
    this.dialogo.set(null);
    if (d !== null) {
      const nuevo = { ...d, structure: { ...d.structure, site: sitio } };
      this.datos.set(nuevo);
      this.estructura.set(ready(nuevo));
    }
    // Una tipología nueva cambia qué se exige: se vuelve a leer todo desde la API.
    this.cargarEstructura();
    this.cargarCapacidad();
  }

  protected alGuardarLicencia(): void {
    this.dialogo.set(null);
    this.cargarHabilitaciones();
  }

  protected alDeclarar(): void {
    this.dialogo.set(null);
    this.cargarCapacidad();
  }

  protected unidadDe(id: string | null): string {
    return id === null ? 'Todo el establecimiento' : (this.nombreDeUnidad().get(id) ?? 'Unidad');
  }

  /** «Vence en N días» sólo para las vigentes que se acercan; el estado «vencida» lo dice el servidor. */
  protected avisoDeVencimiento(l: SiteLicense): string | null {
    if (l.expiresOn === null || l.status.code !== 'LIC_VALID') return null;
    const dias = Math.ceil((new Date(`${l.expiresOn}T12:00:00`).getTime() - Date.now()) / 86_400_000);
    return dias >= 0 && dias <= AVISO_DE_VENCIMIENTO_DIAS ? `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}` : null;
  }

  protected editarLicencia(l: SiteLicense | null): void {
    this.dialogo.set({ licencia: l });
  }

  protected licenciaEnEdicion(): SiteLicense | null {
    const d = this.dialogo();
    return d !== null && typeof d === 'object' ? d.licencia : null;
  }

  protected esDialogoDeLicencia(): boolean {
    const d = this.dialogo();
    return d !== null && typeof d === 'object';
  }
}
