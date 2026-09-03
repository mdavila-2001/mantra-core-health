import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { LocationPicker } from './location-picker';

/**
 * Dos departamentos con sus municipios, como los entrega
 * `BoMunicipalitiesCatalog`: el `conceptId` es lo único que viaja al backend.
 */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'dep-CB',
    sigla: 'CB',
    nombre: 'Cochabamba',
    municipios: [
      { conceptId: 'mun-sacaba', nombre: 'Sacaba', ine: '030301' },
      { conceptId: 'mun-quillacollo', nombre: 'Quillacollo', ine: '030401' },
    ],
  },
  {
    conceptId: 'dep-SC',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'mun-scz', nombre: 'Santa Cruz de la Sierra', ine: '070101' },
      { conceptId: 'mun-warnes', nombre: 'Warnes', ine: '070201' },
    ],
  },
];

describe('LocationPicker', () => {
  let fixture: ComponentFixture<LocationPicker>;
  let component: LocationPicker;
  let html: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LocationPicker] });
    fixture = TestBed.createComponent(LocationPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ramas', RAMAS);
    fixture.detectChanges();
    html = fixture.nativeElement as HTMLElement;
  });

  function pulsarDepartamento(sigla: string): void {
    const forma = html.querySelector(`[data-testid="location-mapa-${sigla}"]`);
    forma?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();
  }

  function opcionesDeCiudad(): readonly string[] {
    return [...html.querySelectorAll('option')]
      .map((opcion) => opcion.textContent?.trim() ?? '')
      .filter((texto) => texto !== '' && texto !== 'Elegí tu ciudad o municipio');
  }

  it('mientras no hay departamento no ofrece ciudades: dice qué falta', () => {
    expect(html.querySelector('[data-testid="location-pendiente"]')?.textContent).toContain(
      'Elegí primero tu departamento',
    );
    expect(html.querySelector('app-select')).toBeNull();
  });

  /**
   * AC-03-7, que es la razón de que el mapa exista: el select ofrece **sólo**
   * los municipios del departamento elegido. La alternativa era una lista plana
   * de ~340, donde además siete nombres se repiten entre departamentos.
   */
  it('el departamento elegido acota el select de ciudad', () => {
    pulsarDepartamento('CB');
    expect(opcionesDeCiudad()).toEqual(['Sacaba', 'Quillacollo']);

    pulsarDepartamento('SC');
    expect(opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  /**
   * Un select con un valor que no está entre sus opciones muestra un hueco que
   * miente: parece que no se eligió nada cuando hay un municipio de otro
   * departamento a punto de viajar.
   */
  it('cambiar de departamento suelta el municipio que dejó de pertenecerle', () => {
    pulsarDepartamento('CB');
    component.value.set('mun-sacaba');
    fixture.detectChanges();

    pulsarDepartamento('SC');

    expect(component.value()).toBeNull();
    expect(opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  /**
   * Al volver a esta página con un municipio ya elegido, el mapa tiene que
   * mostrarlo marcado aunque nadie haya vuelto a tocarlo: el municipio manda
   * sobre lo pulsado.
   */
  it('con municipio elegido, el mapa muestra su departamento marcado', () => {
    component.value.set('mun-warnes');
    fixture.detectChanges();

    expect(
      html.querySelector('[data-testid="location-mapa-SC"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  /** El departamento no viaja: el código INE del municipio ya lo lleva adentro. */
  it('lo que sale es el municipio, y sólo el municipio', () => {
    pulsarDepartamento('CB');
    expect(component.value()).toBeNull();

    component.value.set('mun-sacaba');
    expect(component.value()).toBe('mun-sacaba');
  });

  it('marca el municipio como obligatorio cuando quien lo monta lo pide', () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('errorMessage', 'Elegí tu ciudad o municipio.');
    pulsarDepartamento('CB');

    expect(html.textContent).toContain('Elegí tu ciudad o municipio.');
  });

  /** Sin catálogo no hay mapa ni select: quien lo monta muestra su «Reintentar». */
  it('sin ramas no dibuja el mapa', () => {
    fixture.componentRef.setInput('ramas', []);
    fixture.detectChanges();

    expect(html.querySelector('svg')).toBeNull();
  });
});
