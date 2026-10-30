import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import { funcionesObligatoriasFaltantes } from '../../../../core/data-access/infrastructure/infrastructure.rules';
import type {
  InfrastructureCatalog,
  SiteCapacity,
  SiteLicense,
  SiteStructure,
  SiteSummary,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, mapData, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { CatalogoDeInfraestructuraStore } from '../infraestructura/catalogo-de-infraestructura.store';
import type { SitioElegible } from '../infraestructura/infraestructura-tab';
import { varianteDe } from '../infraestructura/infraestructura.presentacion';
import { CapacidadDialog } from './capacidad-dialog';
import { HabilitacionDialog } from './habilitacion-dialog';
import { RegulatorioDialog } from './regulatorio-dialog';

/** Lo que la pestaña necesita, pedido junto: estructura, habilitaciones y capacidad. */
interface Establecimiento {
  readonly estructura: SiteStructure;
  readonly licencias: readonly SiteLicense[];
  readonly capacidad: SiteCapacity;
}

/** Una fila de «declarada vs. real». */
export interface FilaDeCapacidad {
  readonly kindCode: string;
  readonly tipo: string;
  readonly declarada: number | null;
  readonly real: number;
  readonly diferencia: number | null;
  readonly resolucion: string | null;
}

type Dialogo = 'regulatorio' | 'habilitacion' | 'capacidad' | null;

/**
 * Pestaña **Establecimiento**: el `practice_site` como establecimiento regulado
 * de Bolivia (§2.3 del plan). Datos SNIS/SEDES, habilitaciones y capacidad
 * **declarada vs. real** con sus brechas.
 *
 * La capacidad real no la escribe nadie: la cuenta la API de los espacios
 * activos. La pantalla sólo pone las dos columnas lado a lado y dice cuánto
 * difieren, que es lo que una inspección del SEDES mira primero.
 */
@Component({
  selector: 'app-establecimiento-tab',
  imports: [
    Alert,
    AppButton,
    Badge,
    CapacidadDialog,
    DataTable,
    FactList,
    HabilitacionDialog,
    RegulatorioDialog,
    ViewStateHost,
  ],
  templateUrl: './establecimiento-tab.html',
  styleUrl: './establecimiento-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstablecimientoTab {
  private readonly client = inject(InfrastructureClient);
  private readonly catalogoStore = inject(CatalogoDeInfraestructuraStore);

  readonly sitios = input.required<readonly SitioElegible[]>();
  /** El establecimiento elegido (la consola lo resuelve desde la URL). */
  readonly sitioId = input<string | null>(null);
  readonly puedeEscribir = input(false);

  protected readonly dialogo = signal<Dialogo>(null);
  protected readonly varianteDe = varianteDe;

  private readonly celdaLicencia = viewChild.required<TemplateRef<{ $implicit: SiteLicense }>>('celdaLicencia');
  private readonly celdaVence = viewChild.required<TemplateRef<{ $implicit: SiteLicense }>>('celdaVence');
  private readonly celdaEstadoLicencia = viewChild.required<TemplateRef<{ $implicit: SiteLicense }>>('celdaEstadoLicencia');
  private readonly celdaBrecha = viewChild.required<TemplateRef<{ $implicit: FilaDeCapacidad }>>('celdaBrecha');

  private readonly sitioEfectivo = computed(() => {
    const pedido = this.sitioId();
    const sitios = this.sitios();
    return sitios.find((s) => s.id === pedido)?.id ?? sitios[0]?.id ?? null;
  });

  private readonly estadoInterno = signal<ViewState<Establecimiento>>(loading());
  protected readonly estado = this.estadoInterno.asReadonly();
  protected readonly catalogo = computed(() => dataOf(this.catalogoStore.estado()));
  protected readonly datos = computed(() => dataOf(this.estadoInterno()));
  protected readonly sitio = computed<SiteSummary | null>(() => this.datos()?.estructura.site ?? null);

  protected readonly hechosRegulatorios = computed<readonly Hecho[]>(() => {
    const s = this.sitio();
    if (s === null) return [];
    const r = s.regulatory;
    const o = (v: string | null | undefined) => v ?? 'Sin declarar';
    return [
      { etiqueta: 'Código SNIS', valor: o(r.snisCode) },
      { etiqueta: 'Subsector', valor: o(r.subsector?.display) },
      { etiqueta: 'Nivel de atención', valor: o(r.careLevel?.display) },
      { etiqueta: 'Tipología', valor: o(r.typology?.display) },
      { etiqueta: 'Ente gestor', valor: o(r.managingEntityName) },
      { etiqueta: 'Red de salud', valor: o(r.healthNetworkName) },
      { etiqueta: 'SEDES', valor: o(r.sedes?.display) },
      { etiqueta: 'Municipio', valor: o(r.municipalityName) },
      { etiqueta: 'Sucursal vinculada', valor: s.branchId === null ? 'Sin sucursal (consultorio propio)' : 'Sí' },
    ];
  });

  /** Lo que la tipología exige y el establecimiento todavía no tiene activo. */
  protected readonly obligatoriasFaltantes = computed(() => {
    const catalogo = this.catalogo();
    const datos = this.datos();
    if (catalogo === null || datos === null) return [];
    const nombres = new Map(catalogo.functions.map((f) => [f.code, f.display]));
    return funcionesObligatoriasFaltantes(catalogo, datos.estructura.site.regulatory.typology?.code, datos.estructura.spaces).map(
      (f) => nombres.get(f) ?? f,
    );
  });

  protected readonly licencias = computed<ViewState<readonly SiteLicense[]>>(() => {
    const estado = mapData(this.estadoInterno(), (d) => d.licencias);
    return estado.status === 'ready' && estado.data.length === 0
      ? empty({ label: 'Cargala con «Registrar habilitación»' }, 'No hay habilitaciones cargadas. Sin la de funcionamiento el establecimiento no puede atender.')
      : estado;
  });

  protected readonly filasDeCapacidad = computed<ViewState<readonly FilaDeCapacidad[]>>(() =>
    mapData(this.estadoInterno(), (d) => filasDeCapacidad(d.capacidad, this.catalogo())),
  );

  protected readonly brechas = computed(() => this.datos()?.capacidad.gaps.length ?? 0);

  protected readonly columnasDeLicencia = computed<readonly ColumnDef<SiteLicense>[]>(() => [
    { key: 'resolutionNumber', header: 'Habilitación', priority: 1, cell: this.celdaLicencia() },
    { key: 'issuedOn', header: 'Emitida', priority: 2 },
    { key: 'expiresOn', header: 'Vence', priority: 2, cell: this.celdaVence() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoLicencia() },
  ]);

  protected readonly columnasDeCapacidad = computed<readonly ColumnDef<FilaDeCapacidad>[]>(() => [
    { key: 'tipo', header: 'Capacidad', priority: 1 },
    { key: 'declarada', header: 'Declarada', priority: 1, align: 'end' },
    { key: 'real', header: 'Real (contada)', priority: 1, align: 'end' },
    { key: 'diferencia', header: 'Brecha', priority: 1, cell: this.celdaBrecha() },
  ]);

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  protected readonly porTipo = (fila: FilaDeCapacidad): string => fila.kindCode;

  constructor() {
    this.catalogoStore.asegurar();
    effect(() => {
      const sitio = this.sitioEfectivo();
      untracked(() => this.cargar(sitio));
    });
  }

  protected recargar(): void {
    this.cargar(this.sitioEfectivo());
  }

  protected abrir(dialogo: Dialogo): void {
    this.dialogo.set(dialogo);
  }

  /** Después de guardar se **relee** todo: lo que se ve sale de la API, no del formulario. */
  protected alGuardar(): void {
    this.dialogo.set(null);
    this.recargar();
  }

  protected nombreDeUnidad(id: string | null): string | null {
    if (id === null) return null;
    return this.datos()?.estructura.units.find((u) => u.id === id)?.name ?? null;
  }

  protected varianteDeBrecha(fila: FilaDeCapacidad): BadgeVariant {
    if (fila.diferencia === null) return 'info';
    if (fila.diferencia === 0) return 'success';
    return fila.diferencia < 0 ? 'error' : 'warning';
  }

  protected textoDeBrecha(fila: FilaDeCapacidad): string {
    if (fila.diferencia === null) return 'Sin declarar';
    if (fila.diferencia === 0) return 'Coincide';
    // Negativo: hay menos de lo habilitado. Positivo: más de lo habilitado.
    return fila.diferencia < 0 ? `Faltan ${Math.abs(fila.diferencia)}` : `Sobran ${fila.diferencia}`;
  }

  private cargar(siteId: string | null): void {
    if (siteId === null) {
      this.estadoInterno.set(empty({ label: 'Registrar una sede', route: '/administration/organizations' }, 'La organización no tiene ninguna sede.'));
      return;
    }
    this.estadoInterno.set(loading());
    forkJoin({
      estructura: this.client.getStructure(siteId),
      licencias: this.client.listLicenses(siteId),
      capacidad: this.client.getCapacity(siteId),
    })
      .pipe(
        map((d) => ready(d) as ViewState<Establecimiento>),
        catchError((error: unknown) => of(errorToViewState<Establecimiento>(error))),
      )
      .subscribe((estado) => this.estadoInterno.set(estado));
  }
}

/**
 * Arma «declarada vs. real» por tipo de capacidad.
 *
 * Se muestra un tipo si está declarado **o** si hay algo contado: un quirófano
 * que existe y no figura en la habilitación es justamente lo que hay que ver.
 */
export function filasDeCapacidad(capacidad: SiteCapacity, catalogo: InfrastructureCatalog | null): FilaDeCapacidad[] {
  const nombres = new Map((catalogo?.regulatory.capacityKind ?? []).map((k) => [k.code, k.display]));
  const orden = catalogo?.regulatory.capacityKind.map((k) => k.code) ?? [];
  const tipos = new Set([...capacidad.declared.map((d) => d.kindCode), ...capacidad.derived.filter((d) => d.quantity > 0).map((d) => d.kindCode)]);
  return [...tipos]
    .sort((a, b) => orden.indexOf(a) - orden.indexOf(b))
    .map((kindCode) => {
      const declarada = capacidad.declared.find((d) => d.kindCode === kindCode) ?? null;
      const real = capacidad.derived.find((d) => d.kindCode === kindCode)?.quantity ?? 0;
      return {
        kindCode,
        tipo: nombres.get(kindCode) ?? kindCode,
        declarada: declarada?.quantity ?? null,
        real,
        diferencia: declarada === null ? null : real - declarada.quantity,
        resolucion: declarada?.resolutionNumber ?? null,
      };
    });
}
