import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { INFRA_INTEGRATION_FLAGS } from '../../../../../core/data-access/infra-flags';
import { CollectionPointSelect } from './collection-point-select';

/** H6: el punto de toma no viaja mientras la API no acepte la clave, y se ata a la sede del ejecutante. */
describe('CollectionPointSelect', () => {
  let http: HttpTestingController;

  function create(collectionPoints: boolean, siteId: string | null) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: INFRA_INTEGRATION_FLAGS, useValue: { collectionPoints, consultingRoomTemplates: false } }],
    });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CollectionPointSelect);
    fixture.componentRef.setInput('siteId', siteId);
    fixture.detectChanges();
    TestBed.tick();
    return fixture;
  }

  afterEach(() => http.verify());

  it('con la bandera apagada no pide puntos ni suma nada al cuerpo de la orden', () => {
    const f = create(false, 's-1');
    http.expectNone('/sites/s-1/sample-collection-points');
    expect(f.componentInstance.fields()).toEqual({});
    expect(f.nativeElement.querySelector('[data-testid=order-collection-point]')).toBeNull();
  });

  it('encendida pero sin sede del ejecutante, no ofrece nada (un punto de otra sede daría 422)', () => {
    const f = create(true, null);
    http.expectNone(() => true);
    expect(f.componentInstance.fields()).toEqual({});
  });

  it('encendida y con la sede del ejecutante, lista los puntos de esa sede', () => {
    const f = create(true, 's-2');
    http.expectOne('/sites/s-2/sample-collection-points').flush([{ careSpace: { id: 'tm-1', code: 'LAB-TM1', name: 'Toma 1', path: '' }, unit: null, hours: null }]);
    f.detectChanges();
    expect(f.nativeElement.querySelector('[data-testid=order-collection-point]')).not.toBeNull();
    expect(f.componentInstance.fields()).toEqual({});
  });
});
