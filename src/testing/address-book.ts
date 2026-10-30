import type { Provider } from '@angular/core';
import { of } from 'rxjs';

import { PatientAddressBookClient } from '../app/core/data-access/profiles/patient-address-book.client';
import { BoMunicipalitiesCatalog } from '../app/core/data-access/terminology/bo-municipalities.service';

/**
 * «Mis direcciones» respondiendo en el acto, para las pruebas de «Mi perfil».
 *
 * La pestaña tiene sus propias pruebas (`address-book.spec.ts`). Las de la
 * ficha que recorren todas las pestañas la abren, y sin esto su libreta y su
 * catálogo de ciudades quedarían como peticiones sin responder.
 *
 * @param conCatalogo - `false` para las pruebas que afirman las lecturas del
 *   catálogo de municipios real (las hace también la ficha de residencia).
 */
export function libretaInmediata(conCatalogo = true): Provider[] {
  return [
    { provide: PatientAddressBookClient, useValue: { list: () => of([]) } },
    ...(conCatalogo ? [{ provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } }] : []),
  ];
}
