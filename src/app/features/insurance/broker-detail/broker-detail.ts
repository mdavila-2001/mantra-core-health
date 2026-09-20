import { DatePipe, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  BrokerClient,
  BrokerProfile,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Card } from '../../../shared/components/molecules/card/card';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Lo que la pantalla necesita: el perfil y la cartera, que son dos lecturas. */
interface FilaDeCliente {
  readonly id: string;
  readonly tipo: string;
  readonly colectivo: string;
  readonly desde: string;
  readonly hasta: string;
  readonly estado: string;
}

export interface BrokerDossier {
  readonly profile: BrokerProfile;
  readonly clients: readonly BrokerClient[];
}

/** Una fila de la cartera tal como la pinta `app-data-table`. */
interface FilaDeCliente {
  readonly id: string;
  readonly tipo: string;
  readonly colectivo: string;
  readonly desde: string;
  readonly hasta: string;
  readonly estado: string;
}

/**
 * Perfil de un corredor: credenciales, historial de vinculaciones y cartera.
 *
 * ## Lo que esta pantalla no muestra, y por qué
 *
 * La cartera dice **a quién** atiende el corredor —la relación comercial y una
 * referencia al perfil del asegurado— y nada de su historia clínica. No es una
 * omisión de la interfaz: la API tampoco lo sirve por esa ruta. La
 * especificación es explícita en que el broker sólo accede a lo necesario para
 * gestionar su atención, sin acceso general al historial médico.
 *
 * El histórico de vinculaciones sí se muestra completo, incluidas las
 * terminadas: conservarlo es un requisito, y es lo que permite ver que alguien
 * representó a una aseguradora sin sugerir que la representa todavía.
 */
@Component({
  selector: 'app-broker-detail',
  imports: [Card, Chip, DataTable, DatePipe, PageHeader, StatusSeal, ViewStateHost],
  templateUrl: './broker-detail.html',
  styleUrl: './broker-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrokerDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly insurance = inject(InsuranceClient);
  private readonly locale = inject(LOCALE_ID);

  protected readonly state = signal<ViewState<BrokerDossier>>(loading());
  protected readonly dossier = computed(() => dataOf(this.state()));
  protected readonly title = computed(() => this.dossier()?.profile.legalName ?? 'Corredor');

  /**
   * La cartera en la tabla del sistema (refactor UX). Era una `<table>` a mano
   * que a 390 px estiraba su tarjeta más allá del borde de la pantalla.
   */
  protected readonly cartera = computed<ViewState<readonly FilaDeCliente[]>>(() => {
    const dossier = this.dossier();
    if (dossier === null) return loading();
    return ready(
      dossier.clients.map((cliente) => ({
        id: cliente.id,
        tipo: cliente.clientType.display,
        colectivo: cliente.employerGroupId ? 'Empresa afiliada' : 'Individual',
        desde: cliente.effectiveFrom ? this.fechaLarga(cliente.effectiveFrom) : '—',
        hasta: cliente.effectiveTo ? this.fechaLarga(cliente.effectiveTo) : 'Sin fin',
        estado: cliente.status.display,
      })),
    );
  });

  protected readonly columnasDeCartera: readonly ColumnDef<FilaDeCliente>[] = [
    { key: 'tipo', header: 'Tipo de cliente', priority: 1 },
    { key: 'colectivo', header: 'Colectivo', priority: 1 },
    { key: 'desde', header: 'Desde', priority: 2 },
    { key: 'hasta', header: 'Hasta', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1 },
  ];

  protected readonly porId = (fila: FilaDeCliente): string => fila.id;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeCliente = (fila: FilaDeCliente): string =>
    `${fila.tipo} desde ${fila.desde}`;

  private fechaLarga(fecha: Date): string {
    return formatDate(fecha, 'longDate', this.locale);
  }

  private brokerId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.brokerId = params.get('brokerId');
      this.load();
    });
  }

  protected retry(): void {
    this.load();
  }

  /** Traduce el código del catálogo, no su redacción. */
  protected verificationVariant(code: string): StatusSealVariant {
    if (code === 'VERIFICATION_VERIFIED') return 'approved';
    if (code === 'VERIFICATION_PENDING') return 'pending';
    return 'unknown';
  }

  private load(): void {
    if (!this.brokerId) {
      this.state.set(notFound({ label: 'Volver a brokers', route: '/administration/brokers' }));
      return;
    }
    this.state.set(loading());
    // Las dos lecturas van juntas porque la pantalla las muestra juntas, pero
    // siguen siendo endpoints separados: ver un perfil desde otra pantalla no
    // arrastra la cartera.
    forkJoin({
      profile: this.insurance.getBroker(this.brokerId),
      portfolio: this.insurance.listBrokerClients(this.brokerId),
    }).subscribe({
      next: ({ profile, portfolio }) =>
        this.state.set(ready({ profile, clients: portfolio.items })),
      error: (error: unknown) => this.state.set(errorToViewState<BrokerDossier>(error)),
    });
  }
}
