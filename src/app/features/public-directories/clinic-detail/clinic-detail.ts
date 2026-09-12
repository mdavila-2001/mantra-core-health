import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { PublicCatalogClient } from '@core/data-access/public-catalog/public-catalog.client';
import type { PublicOfferedService } from '@core/data-access/public-catalog/public-catalog.types';
import type { PublicPage } from '@core/data-access/public-directory/public-directory.types';
import { Badge } from '@shared/components/atoms/badge/badge';
import { ServiceIcon } from '@shared/components/atoms/service-icon/service-icon';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';
import { Card } from '@shared/components/molecules/card/card';
import { FactList } from '@shared/components/molecules/fact-list/fact-list';
import { SectionHeading } from '@shared/components/molecules/section-heading/section-heading';
import { PageHeader } from '@shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { PublicCatalogDetail } from '../public-catalog-detail';

/**
 * **La ficha de una clínica**, dentro del panel.
 *
 * Es el destino del clic en «Directorio de clínicas». Antes ese clic abría
 * `/o/:slug`, la ficha anónima bajo el marco de la red social, y sacaba de la
 * aplicación a quien había entrado por su propio menú.
 *
 * Lo que muestra es lo que hacía falta para decidir a dónde derivar: dónde
 * queda, si está verificada y **qué servicios ofrece con su precio de
 * referencia**. La rejilla es la misma de «Mis servicios» —el cliente pidió
 * expresamente que se vieran igual— **sin la edición del precio**: este
 * catálogo es de la clínica, no de quien lo mira.
 */
@Component({
  selector: 'app-clinic-detail',
  imports: [
    Badge,
    Card,
    FactList,
    PageHeader,
    SectionHeading,
    ServiceIcon,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './clinic-detail.html',
  styleUrls: ['../../../shared/styles/rejilla-de-tarjetas.css', '../catalogo-publico.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClinicDetail extends PublicCatalogDetail<PublicOfferedService> {
  private readonly catalogo = inject(PublicCatalogClient);

  protected readonly kind = 'ORGANIZATION' as const;
  protected readonly rutaDelDirectorio = '/clinics-directory';
  protected readonly rotuloDelDirectorio = 'Directorio de clínicas';

  protected leerCatalogo(slug: string): Observable<PublicPage<PublicOfferedService>> {
    return this.catalogo.organizationServices(slug);
  }
}
