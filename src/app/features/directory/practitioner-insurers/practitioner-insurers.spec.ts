import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { PractitionerInsuranceCarrier } from '../../../core/data-access/insurance/insurance.types';
import { PractitionerInsurers } from './practitioner-insurers';

/**
 * Con qué seguros trabaja el profesional, en su ficha.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Pide los seguros del perfil de la ficha**, con el id escapado.
 * 2. **Cada aseguradora con sus planes**, como lista con nombre accesible: el
 *    paciente busca el plan que dice su carnet.
 * 3. **Vacío dice «sin seguros informados»**, nunca «no acepta seguros»: eso
 *    no lo afirmó nadie.
 * 4. **Un fallo no tumba nada**: la sección ofrece reintentar y el reintento
 *    vuelve a pedir.
 * 5. **Al cambiar de ficha no quedan los seguros de otro**: la respuesta tardía
 *    del profesional anterior se descarta.
 */
describe('PractitionerInsurers', () => {
  let fixture: ComponentFixture<PractitionerInsurers>;
  let http: HttpTestingController;

  const PROFILE = 'hp-1';

  const ALIANZA: PractitionerInsuranceCarrier = {
    carrierId: 'car-alianza',
    carrierName: 'Alianza Seguros',
    networks: [
      { id: 'net-gold', name: 'AFI GOLD' },
      { id: 'net-oasis', name: 'OASIS' },
    ],
  };

  const NACIONAL: PractitionerInsuranceCarrier = {
    carrierId: 'car-nacional',
    carrierName: 'Nacional Seguros',
    networks: [{ id: 'net-flex', name: 'SALUD FLEXIBLE' }],
  };

  async function mount(profileId = PROFILE): Promise<void> {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PractitionerInsurers);
    fixture.componentRef.setInput('practitionerProfileId', profileId);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function urlOf(profileId: string): string {
    return `/practitioners/${encodeURIComponent(profileId)}/insurance-carriers`;
  }

  async function respond(items: readonly PractitionerInsuranceCarrier[], profileId = PROFILE) {
    http.expectOne(urlOf(profileId)).flush({ items });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function text(): string {
    return host().textContent ?? '';
  }

  afterEach(() => http.verify());

  it('pide los seguros del perfil de la ficha, con el id escapado', async () => {
    await mount('hp/1 ?');

    await respond([], 'hp/1 ?');
  });

  it('mientras carga muestra el título y el esqueleto, sin lista', async () => {
    await mount();

    expect(text()).toContain('Seguros con los que trabaja');
    expect(host().querySelector('app-skeleton')).not.toBeNull();
    expect(host().querySelector('[data-testid="practitioner-insurer"]')).toBeNull();

    await respond([]);
  });

  it('lista cada aseguradora con sus planes', async () => {
    await mount();
    await respond([ALIANZA, NACIONAL]);

    const rows = host().querySelectorAll('[data-testid="practitioner-insurer"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Alianza Seguros');
    expect(rows[0].textContent).toContain('AFI GOLD');
    expect(rows[0].textContent).toContain('OASIS');
    expect(rows[1].textContent).toContain('Nacional Seguros');
    expect(rows[1].textContent).toContain('SALUD FLEXIBLE');
    expect(rows[0].querySelectorAll('app-chip')).toHaveLength(2);
  });

  it('las listas tienen nombre accesible', async () => {
    await mount();
    await respond([ALIANZA]);

    const list = host().querySelector('ul.insurers__list');
    const title = host().querySelector('h2');
    expect(title?.id).toBeTruthy();
    expect(list?.getAttribute('aria-labelledby')).toBe(title?.id);
    expect(host().querySelector('ul.insurers__plans')?.getAttribute('aria-label')).toBe(
      'Planes de Alianza Seguros',
    );
  });

  it('dice la procedencia del dato', async () => {
    await mount();
    await respond([ALIANZA]);

    expect(text()).toContain('Según la red médica que publica cada aseguradora');
  });

  it('una aseguradora sin planes publicados lo dice, en vez de dejar el hueco', async () => {
    await mount();
    await respond([{ ...ALIANZA, networks: [] }]);

    const row = host().querySelector('[data-testid="practitioner-insurer"]');
    expect(row?.textContent).toContain('Alianza Seguros');
    expect(row?.textContent).toContain('no detalla en qué planes');
    expect(row?.querySelector('app-chip')).toBeNull();
  });

  it('sin convenios dice «sin seguros informados», nunca que no acepta seguros', async () => {
    await mount();
    await respond([]);

    expect(text()).toContain('Sin seguros informados');
    expect(text()).toContain('Preguntá en el consultorio');
    expect(text().toLowerCase()).not.toContain('no acepta');
    expect(host().querySelector('[data-testid="practitioner-insurer"]')).toBeNull();
  });

  it('un fallo ofrece reintentar, y el reintento vuelve a pedir', async () => {
    await mount();
    http
      .expectOne(urlOf(PROFILE))
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();

    const retry = Array.from(host().querySelectorAll('button')).find((b) =>
      /reintentar/i.test(b.textContent ?? ''),
    );
    expect(retry).toBeDefined();
    expect(host().querySelector('[data-testid="practitioner-insurer"]')).toBeNull();

    retry!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await respond([NACIONAL]);

    expect(host().querySelectorAll('[data-testid="practitioner-insurer"]')).toHaveLength(1);
    expect(text()).toContain('Nacional Seguros');
  });

  it('al cambiar de ficha descarta la respuesta tardía del profesional anterior', async () => {
    await mount('hp-a');
    const stale = http.expectOne(urlOf('hp-a'));

    fixture.componentRef.setInput('practitionerProfileId', 'hp-b');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(stale.cancelled).toBe(true);
    await respond([NACIONAL], 'hp-b');

    expect(text()).toContain('Nacional Seguros');
    expect(text()).not.toContain('Alianza Seguros');
  });

  it('sin id todavía no pide nada', async () => {
    await mount('');

    http.expectNone(() => true);
  });
});
