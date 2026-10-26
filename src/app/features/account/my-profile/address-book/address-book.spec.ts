import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { API_BASE_URL } from '../../../../core/data-access/api';
import type { PatientAddress } from '../../../../core/data-access/profiles/patient-address-book.client';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../../core/data-access/terminology/bo-municipalities.service';
import { CARGADOR_DE_PROVINCIAS } from '../../../../shared/components/organisms/map/provinces';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { AddressBook } from './address-book';

const LIBRETA = '/profiles/patients/me/addresses';

const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'dep-SC',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [{ conceptId: 'mun-scz', nombre: 'Santa Cruz de la Sierra', ine: '070101' }],
  },
];

const CASA: PatientAddress = {
  id: 'casa',
  kind: 'HOME',
  label: 'Casa',
  lines: 'Av. Banzer 3er anillo',
  city: 'Santa Cruz de la Sierra',
  municipalityConceptId: 'mun-scz',
  latitude: -17.78,
  longitude: -63.18,
  isPreferred: true,
};

const MAMA: PatientAddress = {
  id: 'mama',
  kind: 'SAVED',
  label: 'Casa de mi mamá',
  lines: 'Calle Sucre 12',
  municipalityConceptId: 'mun-scz',
  isPreferred: false,
};

describe('AddressBook («Mis direcciones»)', () => {
  let fixture: ComponentFixture<AddressBook>;
  let http: HttpTestingController;
  let html: HTMLElement;
  let confirma: boolean;

  beforeEach(() => {
    confirma = true;
    TestBed.configureTestingModule({
      imports: [AddressBook],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of(RAMAS) } },
        { provide: CARGADOR_DE_PROVINCIAS, useValue: () => Promise.resolve(null) },
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirma) } },
      ],
    });
    fixture = TestBed.createComponent(AddressBook);
    http = TestBed.inject(HttpTestingController);
    html = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function responderLibreta(lista: readonly PatientAddress[]): void {
    http.expectOne({ method: 'GET', url: LIBRETA }).flush(lista);
    fixture.detectChanges();
  }

  function boton(texto: string): HTMLButtonElement {
    const b = [...html.querySelectorAll<HTMLButtonElement>('button')].find((x) =>
      x.textContent?.includes(texto),
    );
    expect(b, `no hay botón «${texto}»`).toBeDefined();
    return b!;
  }

  it('muestra la libreta con la preferida dicha en palabras, y el domicilio sin «Quitar»', () => {
    responderLibreta([CASA, MAMA]);

    const casa = html.querySelector('[data-testid="libreta-item-HOME"]')!;
    expect(casa.textContent).toContain('Casa (domicilio)');
    expect(casa.textContent).toContain('Preferida');
    expect(casa.textContent).not.toContain('Quitar');
    expect(casa.textContent).toContain('Av. Banzer 3er anillo, Santa Cruz de la Sierra');
    const mama = html.querySelector('[data-testid="libreta-item-SAVED"]')!;
    expect(mama.textContent).toContain('Casa de mi mamá');
    expect(mama.textContent).toContain('Sin punto en el mapa.');
    // Sin ciudad declarada no se inventa una.
    expect(mama.textContent).toContain('Calle Sucre 12');
    expect(mama.textContent).toContain('Quitar');
  });

  it('«Usar primero» la marca en la API y pinta la libreta que vuelve', () => {
    responderLibreta([CASA, MAMA]);

    boton('Usar primero').click();
    const req = http.expectOne({ method: 'PUT', url: `${LIBRETA}/mama/preferred` });
    req.flush([{ ...MAMA, isPreferred: true }, { ...CASA, isPreferred: false }]);
    fixture.detectChanges();

    const items = html.querySelectorAll('.libreta__item');
    expect(items[0]?.textContent).toContain('Casa de mi mamá');
    expect(items[0]?.textContent).toContain('Preferida');
  });

  it('agregar: el punto pide la calle, y se guarda con nombre, localidad, calle y punto', () => {
    responderLibreta([CASA]);
    boton('Agregar dirección').click();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      fijarPunto(p: { lat: number; lng: number }): void;
      nombre: { set(v: string): void };
      municipio: { set(v: string): void };
    };
    componente.nombre.set('Oficina');
    componente.municipio.set('mun-scz');
    componente.fijarPunto({ lat: -17.7833, lng: -63.1821 });
    const calle = http.expectOne({ method: 'POST', url: '/public/geo/reverse' });
    expect(calle.request.body).toEqual({ latitude: -17.7833, longitude: -63.1821 });
    calle.flush({ found: true, line: 'Calle 24 de Septiembre, Bartos', attribution: 'OSM' });
    fixture.detectChanges();
    expect(html.querySelector('[data-testid="libreta-aviso-calle"]')?.textContent).toContain(
      'OpenStreetMap',
    );

    boton('Guardar dirección').click();
    const req = http.expectOne({ method: 'POST', url: LIBRETA });
    expect(req.request.body).toEqual({
      municipalityConceptId: 'mun-scz',
      lines: 'Calle 24 de Septiembre, Bartos',
      latitude: -17.7833,
      longitude: -63.1821,
      label: 'Oficina',
      isPreferred: false,
    });
    req.flush([CASA, { ...MAMA, id: 'ofi', label: 'Oficina' }]);
    fixture.detectChanges();

    expect(html.querySelector('[data-testid="libreta-formulario"]')).toBeNull();
    expect(html.textContent).toContain('Oficina');
  });

  it('sin nombre ni localidad no sale nada, y cada campo dice qué falta', () => {
    responderLibreta([CASA]);
    boton('Agregar dirección').click();
    fixture.detectChanges();

    boton('Guardar dirección').click();
    fixture.detectChanges();

    http.expectNone({ method: 'POST', url: LIBRETA });
    expect(html.textContent).toContain('Póngale un nombre');
    expect(html.textContent).toContain('Elija el departamento y la ciudad.');
  });

  it('si la API rechaza, el formulario sigue abierto con lo escrito y dice por qué', () => {
    responderLibreta([CASA]);
    boton('Agregar dirección').click();
    const componente = fixture.componentInstance as unknown as {
      nombre: { set(v: string): void; (): string };
      municipio: { set(v: string): void };
    };
    componente.nombre.set('Oficina');
    componente.municipio.set('mun-scz');
    fixture.detectChanges();

    boton('Guardar dirección').click();
    http
      .expectOne({ method: 'POST', url: LIBRETA })
      .flush(
        { code: 'PRECONDITION_FAILED', message: 'Puede guardar hasta 10 direcciones además de su domicilio.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(html.querySelector('[data-testid="libreta-formulario"]')).not.toBeNull();
    expect(componente.nombre()).toBe('Oficina');
    expect(html.querySelector('[data-testid="libreta-error"]')).not.toBeNull();
  });

  it('no repite la ciudad cuando la calle ya la nombra', () => {
    responderLibreta([{ ...CASA, lines: 'Calle Libertad N.º 45, Santa Cruz de la Sierra' }]);

    const texto = html.querySelector('[data-testid="libreta-item-HOME"]')?.textContent ?? '';
    expect(texto.match(/Santa Cruz de la Sierra/g)).toHaveLength(1);
  });

  it('quitar pide confirmación; si se cancela, no se borra nada', async () => {
    responderLibreta([CASA, MAMA]);
    confirma = false;

    boton('Quitar').click();
    await fixture.whenStable();

    http.expectNone({ method: 'DELETE', url: `${LIBRETA}/mama` });
  });

  it('quitar una guardada (confirmado) la saca de la lista que devuelve la API', async () => {
    responderLibreta([CASA, MAMA]);

    boton('Quitar').click();
    await fixture.whenStable();
    http.expectOne({ method: 'DELETE', url: `${LIBRETA}/mama` }).flush([CASA]);
    fixture.detectChanges();

    expect(html.textContent).not.toContain('Casa de mi mamá');
  });
});
