import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  CarrierDetail,
  CarrierSummary,
} from '../../../core/data-access/insurance/insurance.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Card } from '../../../shared/components/molecules/card/card';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Catálogo de la aseguradora del tenant activo: productos, planes, coberturas y
 * red de prestadores.
 *
 * Carga en dos pasos por una razón de contrato, no de comodidad: el listado
 * (`GET /insurance-carriers`) dice **qué** aseguradora administra esta
 * organización, y sólo la ficha (`/:id`) trae el catálogo. Pedir la ficha
 * primero exigiría que la pantalla adivinara un identificador.
 *
 * Si la organización no tiene aseguradora —porque no es de tipo `PAYER`— la
 * pantalla lo dice y ofrece la salida, en vez de mostrar una tabla vacía que
 * parezca un catálogo sin cargar.
 */
@Component({
  selector: 'app-insurance-catalog',
  imports: [Card, Chip, DatePipe, PageHeader, StatusSeal, ViewStateHost],
  templateUrl: './insurance-catalog.html',
  styleUrl: './insurance-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceCatalog {
  private readonly insurance = inject(InsuranceClient);

  protected readonly state = signal<ViewState<CarrierDetail>>(loading());
  protected readonly carrier = computed(() => dataOf(this.state()));

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  /**
   * Cómo se lee el estado de verificación.
   *
   * Se traduce el código del catálogo, no el texto: el `display` puede cambiar
   * de redacción sin que cambie el significado. Un código desconocido cae en
   * `unknown` y se muestra con su etiqueta, que es lo que el sello hace en vez
   * de inventar un veredicto.
   */
  protected verificationVariant(code: string): StatusSealVariant {
    if (code === 'VERIFICATION_VERIFIED') return 'approved';
    if (code === 'VERIFICATION_PENDING') return 'pending';
    return 'unknown';
  }

  private load(): void {
    this.state.set(loading());
    this.insurance.listCarriers().subscribe({
      next: (directory) => {
        const first = directory.items[0];
        if (first === undefined) {
          this.state.set(
            empty(
              { label: 'Ver organizaciones', route: '/administration/organizations' },
              'Esta organización no tiene una aseguradora registrada. Se crea al dar de alta una organización de tipo aseguradora.',
            ),
          );
          return;
        }
        this.loadDetail(first);
      },
      error: (error: unknown) => this.state.set(errorToViewState<CarrierDetail>(error)),
    });
  }

  private loadDetail(carrier: CarrierSummary): void {
    this.insurance.getCarrier(carrier.id).subscribe({
      next: (detail) => this.state.set(ready(detail)),
      error: (error: unknown) => this.state.set(errorToViewState<CarrierDetail>(error)),
    });
  }
}
