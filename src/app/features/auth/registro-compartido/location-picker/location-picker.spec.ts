import { Component } from '@angular/core';
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

/** El mismo control con un glifo proyectado, como lo monta el alta. */
@Component({
  imports: [LocationPicker],
  template: `
    <app-location-picker [ramas]="ramas">
      <span slot="icon-start" data-testid="glifo">✳</span>
    </app-location-picker>
  `,
})
class HostConGlifo {
  readonly ramas = RAMAS;
}

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

  it('en sólo lectura muestra lo guardado y no deja cambiarlo', () => {
    fixture.componentRef.setInput('readonly', true);
    component.value.set('mun-scz');
    fixture.detectChanges();

    const select = html.querySelector<HTMLSelectElement>('select');
    expect(select?.disabled).toBe(true);
    expect(select?.value).not.toBe('');
    expect(html.querySelector('app-department-map')?.hasAttribute('inert')).toBe(true);

    pulsarDepartamento('CB');
    expect(component.value()).toBe('mun-scz');
    expect(opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

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

  describe('la explicación y el glifo del municipio', () => {
    /** Los hijos con etiqueta del marco del desplegable, en orden. */
    function marcoDelSelect(elemento: HTMLElement): string[] {
      const marco = elemento.querySelector('.select-wrapper');
      return [...(marco?.children ?? [])].map((hijo) =>
        [hijo.tagName.toLowerCase(), ...hijo.classList].join('.'),
      );
    }

    it('la explicación llega al campo, que es quien la muestra al apuntarlo', () => {
      fixture.componentRef.setInput(
        'municipalityDescription',
        'La ciudad donde vivís, para asignarte los centros que te quedan cerca.',
      );
      pulsarDepartamento('CB');

      expect(html.querySelector('.form-field-description')?.textContent?.trim()).toBe(
        'La ciudad donde vivís, para asignarte los centros que te quedan cerca.',
      );
    });

    it('sin explicación no aparece ningún globo', () => {
      pulsarDepartamento('CB');

      expect(html.querySelector('.form-field-description')).toBeNull();
    });

    it('el glifo que le proyecten va DENTRO del desplegable', () => {
      // Sin reconfigurar el módulo —ya hay un componente creado—: el host es
      // standalone y trae sus propias dependencias.
      const conGlifo = TestBed.createComponent(HostConGlifo);
      conGlifo.detectChanges();
      const suHtml = conGlifo.nativeElement as HTMLElement;
      suHtml
        .querySelector('[data-testid="location-mapa-CB"]')
        ?.dispatchEvent(new MouseEvent('click'));
      conGlifo.detectChanges();

      const glifo = suHtml.querySelector('[data-testid="glifo"]');
      const desplegable = suHtml.querySelector('select');

      expect(glifo).not.toBeNull();
      expect(desplegable?.parentElement?.contains(glifo!)).toBe(true);
      expect(desplegable?.previousElementSibling).toBe(glifo);
    });

    it('sin glifo proyectado el desplegable queda como estaba', () => {
      pulsarDepartamento('CB');

      expect(marcoDelSelect(html)).toEqual(['select.native-select', 'span.select-arrow']);
    });
  });
});
