import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  signal,
  untracked,
} from '@angular/core';
import { formatDate } from '@angular/common';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { PharmacyIntegrationClient } from '../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  IntegrationConnection,
  IntegrationConnectionList,
} from '../../../core/data-access/pharmacy/pharmacy-integration.types';
import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { PharmacyScope, providePharmacyScope } from '../pharmacy-scope';
import { INTEGRATION_ERROR_TEXT, integrationErrorMessage } from './integration-error-message';
import { IntegrationMappings } from './integration-mappings/integration-mappings';
import { IntegrationSync } from './integration-sync/integration-sync';
import { IntegrationSystem } from './integration-system/integration-system';

/** Valor del desplegable de sucursal que no manda ninguna: la conexión vale para todas. */
export const ALL_SITES = 'ALL';

/** Conexión activa sin sistema con quién sincronizar (FAR-C9 · C9-4). */
export const MISSING_SYSTEM_TEXT =
  'Falta cargar el sistema de la farmacia, abajo: sin él, la conexión no tiene con quién sincronizar. Mientras tanto, lleve las existencias en «Inventario».';

/** El texto del botón que conecta, también la próxima acción del estado vacío. */
export const CONNECT_LABEL = 'Conectar el sistema de la farmacia';

/**
 * **Integración** con el sistema de la farmacia (FAR-07), sexta pestaña del
 * catálogo.
 *
 * - Sin conexión: el estado vacío ofrece «Conectar el sistema de la farmacia»,
 *   que da de alta una conexión por lotes (`BATCH`) con consulta de stock, para
 *   una sucursal o para todas.
 * - Con conexión: sus datos, la sincronización ({@link IntegrationSync}) y los
 *   productos vinculados ({@link IntegrationMappings}).
 *
 * Lo que se ve sale siempre de la API releída después de cada alta: un aviso
 * de éxito no prueba nada. La API decide qué farmacia y qué conexión se pueden
 * tocar; acá no se oculta nada por seguridad.
 */
@Component({
  selector: 'app-pharmacy-integration',
  imports: [
    Alert,
    AppButton,
    FactList,
    FormField,
    IntegrationMappings,
    IntegrationSync,
    IntegrationSystem,
    Select,
    ViewStateHost,
  ],
  providers: [providePharmacyScope()],
  templateUrl: './pharmacy-integration.html',
  styleUrl: './pharmacy-integration.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyIntegration {
  protected readonly scope = inject(PharmacyScope);
  private readonly integration = inject(PharmacyIntegrationClient);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly toasts = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly connections = signal<ViewState<IntegrationConnectionList>>(loading());
  /** La conexión elegida cuando hay más de una. */
  protected readonly chosenId = signal<string | null>(null);

  protected readonly siteOptions = signal<readonly SelectOption<string>[]>([
    { value: ALL_SITES, label: 'Todas las sucursales' },
  ]);
  protected readonly siteId = signal<string>(ALL_SITES);
  protected readonly connecting = signal(false);
  protected readonly connectError = signal<string | null>(null);

  protected readonly connectLabel = CONNECT_LABEL;
  protected readonly notConfiguredText = INTEGRATION_ERROR_TEXT.PHARMACY_INTEGRATION_NOT_CONFIGURED;
  /**
   * Con la conexión ya dada de alta, el aviso dice qué falta y dónde: lo que no
   * hay es el sistema con quién sincronizar. (Si además está inactiva, el
   * estado de arriba lo muestra.)
   */
  protected readonly missingSystemText = MISSING_SYSTEM_TEXT;
  protected readonly inactiveText = INTEGRATION_ERROR_TEXT.PHARMACY_INTEGRATION_CONNECTION_INACTIVE;

  /**
   * Si la API sabe dónde está el sistema de la farmacia; `true` mientras no se
   * sabe. Señal propia y no derivada de `connections`: sin conexiones el estado
   * es S2 y no trae datos, pero el aviso tiene que verse antes de conectar.
   */
  protected readonly providerConfigured = signal(true);

  private readonly items = computed(() => dataOf(this.connections())?.items ?? []);

  protected readonly connectionOptions = computed<readonly SelectOption<string>[]>(() =>
    this.items().map((item) => ({
      value: item.id,
      label: `${item.siteName ?? 'Todas las sucursales'} · ${item.status === 'ACTIVE' ? 'activa' : 'inactiva'}`,
    })),
  );

  /** La conexión que se muestra: la elegida, si no la primera activa, si no la primera. */
  protected readonly connection = computed<IntegrationConnection | null>(() => {
    const items = this.items();
    return (
      items.find((item) => item.id === this.chosenId()) ??
      items.find((item) => item.status === 'ACTIVE') ??
      items[0] ??
      null
    );
  });

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const connection = this.connection();
    if (connection === null) {
      return [];
    }
    const active = connection.status === 'ACTIVE';
    return [
      { etiqueta: 'Sucursal', valor: connection.siteName ?? 'Todas las sucursales activas' },
      { etiqueta: 'Modo', valor: connection.integrationMode === 'BATCH' ? 'Por lotes' : 'En tiempo real' },
      { etiqueta: 'Consulta de stock', valor: connection.supportsStockQuery ? 'Sí' : 'No' },
      { etiqueta: 'Estado', valor: active ? 'Activa' : 'Inactiva', tono: active ? 'ok' : 'aviso' },
      { etiqueta: 'Conectada el', valor: formatDate(connection.createdAt, 'd MMM y, HH:mm', this.locale) },
    ];
  });

  constructor() {
    effect(() => {
      const pharmacyId = this.scope.pharmacyId();
      if (pharmacyId !== null) {
        untracked(() => {
          this.chosenId.set(null);
          this.connectError.set(null);
          this.reload();
          this.loadSites(pharmacyId);
        });
      }
    });
  }

  protected reload(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null) {
      return;
    }
    this.connections.set(loading());
    this.integration.listConnections(pharmacyId).subscribe({
      next: (list) => {
        this.providerConfigured.set(list.providerConfigured);
        this.connections.set(
          list.items.length > 0
            ? ready(list)
            : empty({ label: CONNECT_LABEL }, 'Su farmacia todavía no está conectada con su sistema.'),
        );
      },
      error: (error: unknown) => this.connections.set(errorToViewState<IntegrationConnectionList>(error)),
    });
  }

  protected chooseConnection(id: string | null): void {
    this.chosenId.set(id);
  }

  protected chooseSite(id: string | null): void {
    this.siteId.set(id ?? ALL_SITES);
  }

  /** Alta de la conexión por lotes con consulta de stock; lo que se ve es la lista releída. */
  protected connect(): void {
    const pharmacyId = this.scope.pharmacyId();
    if (pharmacyId === null || this.connecting()) {
      return;
    }
    const siteId = this.siteId();
    this.connecting.set(true);
    this.connectError.set(null);
    this.integration
      .createConnection(pharmacyId, {
        integrationMode: 'BATCH',
        supportsStockQuery: true,
        ...(siteId === ALL_SITES ? {} : { pharmacySiteId: siteId }),
      })
      .subscribe({
        next: (created) => {
          this.connecting.set(false);
          this.chosenId.set(created.id);
          this.toasts.success('La farmacia quedó conectada con su sistema.');
          this.reload();
        },
        error: (error: unknown) => {
          this.connecting.set(false);
          this.connectError.set(integrationErrorMessage(error, 'No se pudo conectar el sistema de la farmacia.'));
        },
      });
  }

  /**
   * Las sucursales de la farmacia, para atar la conexión a una. Si no se pueden
   * leer, queda «Todas las sucursales», que es lo que hace la API sin sucursal.
   */
  private loadSites(pharmacyId: string): void {
    this.siteId.set(ALL_SITES);
    this.pharmacy.getOpeningHours(pharmacyId).subscribe({
      next: (hours) =>
        this.siteOptions.set([
          { value: ALL_SITES, label: 'Todas las sucursales' },
          ...hours.sites.map((site) => ({ value: site.siteId, label: site.siteName })),
        ]),
      error: () => this.siteOptions.set([{ value: ALL_SITES, label: 'Todas las sucursales' }]),
    });
  }
}
