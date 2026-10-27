import { Component, getDebugNode } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { Select } from '../../../../shared/components/atoms/select/select';
import { selectHasValue, selectOptionLabels, selectTrigger } from '../../../../../testing/select';

import type { PuntoGeo } from '@shared/components/organisms/map/map-pin.types';
import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import {
  CARGADOR_DE_PROVINCIAS,
  type ProvinciasDeBolivia,
} from '../../../../shared/components/organisms/map/provinces';
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

  async function opcionesDeCiudad(): Promise<readonly string[]> {
    const desplegable = html.querySelector('app-select');
    if (desplegable === null) {
      return [];
    }
    return (await selectOptionLabels(fixture, desplegable)).filter(
      (texto) => texto !== '' && texto !== 'Elija su ciudad o municipio',
    );
  }

  /**
   * Las opciones que carga el desplegable aunque esté deshabilitado: así
   * cerrado no se abre, y su lista sólo existe en las `options` que recibe.
   */
  function opcionesCargadasDeCiudad(): readonly string[] {
    const desplegable = html.querySelector('app-select');
    const select = desplegable ? (getDebugNode(desplegable)?.componentInstance as Select<string>) : null;
    return (select?.options() ?? []).map((opcion) => opcion.label);
  }

  it('en sólo lectura muestra lo guardado y no deja cambiarlo', () => {
    fixture.componentRef.setInput('readonly', true);
    component.value.set('mun-scz');
    fixture.detectChanges();

    const select = html.querySelector<HTMLElement>('app-select');
    expect(select).not.toBeNull();
    expect(selectTrigger(select!).disabled).toBe(true);
    expect(selectHasValue(select!)).toBe(true);
    expect(html.querySelector('app-department-map')?.hasAttribute('inert')).toBe(true);

    pulsarDepartamento('CB');
    expect(component.value()).toBe('mun-scz');
    expect(opcionesCargadasDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  it('mientras no hay departamento no ofrece ciudades: dice qué falta', () => {
    expect(html.querySelector('[data-testid="location-pendiente"]')?.textContent).toContain(
      'Elija primero su departamento',
    );
    expect(html.querySelector('app-select')).toBeNull();
  });

  /**
   * AC-03-7, que es la razón de que el mapa exista: el select ofrece **sólo**
   * los municipios del departamento elegido. La alternativa era una lista plana
   * de ~340, donde además siete nombres se repiten entre departamentos.
   */
  it('el departamento elegido acota el select de ciudad', async () => {
    pulsarDepartamento('CB');
    expect(await opcionesDeCiudad()).toEqual(['Sacaba', 'Quillacollo']);

    pulsarDepartamento('SC');
    expect(await opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  /**
   * Un select con un valor que no está entre sus opciones muestra un hueco que
   * miente: parece que no se eligió nada cuando hay un municipio de otro
   * departamento a punto de viajar.
   */
  it('cambiar de departamento suelta el municipio que dejó de pertenecerle', async () => {
    pulsarDepartamento('CB');
    component.value.set('mun-sacaba');
    fixture.detectChanges();

    pulsarDepartamento('SC');

    expect(component.value()).toBeNull();
    expect(await opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
  });

  /**
   * Al volver a esta página con un municipio ya elegido, el mapa tiene que
   * mostrarlo marcado aunque nadie haya vuelto a tocarlo: el municipio manda
   * sobre lo pulsado.
   */
  it('con municipio elegido, el mapa muestra su departamento marcado', async () => {
    component.value.set('mun-warnes');
    fixture.detectChanges();

    expect(
      html.querySelector('[data-testid="location-mapa-SC"]')?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(await opcionesDeCiudad()).toEqual(['Santa Cruz de la Sierra', 'Warnes']);
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
    fixture.componentRef.setInput('errorMessage', 'Elija su ciudad o municipio.');
    pulsarDepartamento('CB');

    expect(html.textContent).toContain('Elija su ciudad o municipio.');
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
        'La ciudad donde vive, para asignarle los centros que le quedan cerca.',
      );
      pulsarDepartamento('CB');

      expect(html.querySelector('.form-field-description')?.textContent?.trim()).toBe(
        'La ciudad donde vive, para asignarle los centros que le quedan cerca.',
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
      const desplegable = suHtml.querySelector('.select-trigger');

      expect(glifo).not.toBeNull();
      expect(desplegable?.parentElement?.contains(glifo!)).toBe(true);
      expect(desplegable?.previousElementSibling).toBe(glifo);
    });

    it('sin glifo proyectado el desplegable queda como estaba', () => {
      pulsarDepartamento('CB');

      expect(marcoDelSelect(html)).toEqual(['button.select-trigger', 'span.select-arrow']);
    });
  });

  /**
   * La ficha llena: pedido del cliente —elegir la ubicación con el mapa y que
   * el resto del domicilio aparezca ya completo—. Departamento y municipio
   * salen del catálogo; la provincia, del dibujo.
   */
  describe('ficha de la ubicación elegida', () => {
    /** Una «provincia» que cubre todo el país: basta para probar que se deduce. */
    const TODO_BOLIVIA: ProvinciasDeBolivia = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { nombre: 'Provincia de prueba', departamento: 'Cochabamba', rotulo: [-66, -17] },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-70, -23],
                [-57, -23],
                [-57, -9],
                [-70, -9],
                [-70, -23],
              ],
            ],
          },
        },
      ],
    };

    /** Un municipio que el catálogo oficial no conoce: obliga a deducir del dibujo. */
    const RAMAS_CON_DESCONOCIDO: readonly RamaDepartamento[] = RAMAS.map((rama) =>
      rama.sigla === 'SC'
        ? {
            ...rama,
            municipios: [
              ...rama.municipios,
              { conceptId: 'mun-desconocido', nombre: 'Pueblo de prueba', ine: 'SC-PDP' },
            ],
          }
        : rama,
    );

    function montar(provincias: ProvinciasDeBolivia | null, punto: PuntoGeo | null = null): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [LocationPicker],
        providers: [{ provide: CARGADOR_DE_PROVINCIAS, useValue: () => Promise.resolve(provincias) }],
      });
      fixture = TestBed.createComponent(LocationPicker);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('ramas', RAMAS_CON_DESCONOCIDO);
      fixture.componentRef.setInput('ficha', true);
      // Un punto con el que el control NACE no elige municipio: sólo sirve de dato.
      fixture.componentRef.setInput('punto', punto);
      fixture.detectChanges();
      html = fixture.nativeElement as HTMLElement;
    }

    const valoresDeLaFicha = (): readonly string[] =>
      Array.from(
        html.querySelectorAll<HTMLInputElement>('[data-testid="location-ficha"] input'),
      ).map((campo) => campo.value);

    it('sin localidad no dibuja la ficha', () => {
      montar(TODO_BOLIVIA);
      expect(html.querySelector('[data-testid="location-ficha"]')).toBeNull();
    });

    it('con la localidad elegida la ficha sale llena: departamento, provincia y municipio', async () => {
      montar(TODO_BOLIVIA);
      pulsarDepartamento('SC');
      expect(html.querySelector('[data-testid="location-ficha"]')).toBeNull();
      component.value.set('mun-warnes');
      await vi.waitFor(() => {
        fixture.detectChanges();
        // La provincia oficial, del código del INE (0702 = Warnes), no del dibujo.
        expect(valoresDeLaFicha()).toEqual(['Santa Cruz', 'Warnes', 'Warnes']);
      });
    });

    it('la provincia sale del catálogo aunque el archivo de provincias no baje', async () => {
      montar(null);
      pulsarDepartamento('SC');
      component.value.set('mun-scz');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(valoresDeLaFicha()).toEqual([
          'Santa Cruz',
          'Andrés Ibáñez',
          'Santa Cruz de la Sierra',
        ]);
      });
    });

    it('un municipio fuera del catálogo se deduce del dibujo', async () => {
      montar(TODO_BOLIVIA, { lat: -17.5, lng: -63.1 });
      pulsarDepartamento('SC');
      component.value.set('mun-desconocido');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(valoresDeLaFicha()).toEqual(['Santa Cruz', 'Provincia de prueba', 'Pueblo de prueba']);
      });
    });

    it('si la provincia no se pudo deducir lo dice en vez de inventarla', async () => {
      montar(null);
      pulsarDepartamento('SC');
      component.value.set('mun-desconocido');

      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(valoresDeLaFicha()).toEqual(['Santa Cruz', 'No disponible', 'Pueblo de prueba']);
      });
    });

    it('sin pedirla (`ficha` apagada) no dibuja nada, ni en sólo lectura', () => {
      fixture.componentRef.setInput('readonly', true);
      component.value.set('mun-scz');
      fixture.detectChanges();
      expect(html.querySelector('[data-testid="location-ficha"]')).toBeNull();
    });
  });

  /* ---- El punto GPS elige el municipio (pedido del cliente del 26/10/2026) ---- */

  /** Espera la geometría (import diferido) y la ronda de señales que dispara. */
  async function esperarGeometria(): Promise<void> {
    await import('@shared/components/organisms/department-map/bolivia-municipalities.geometry');
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('un punto GPS en la plaza de Santa Cruz elige Santa Cruz de la Sierra y su departamento', async () => {
    const emitidos: (string | null)[] = [];
    component.value.subscribe((v) => emitidos.push(v));

    fixture.componentRef.setInput('punto', { lat: -17.7833, lng: -63.1821 });
    fixture.detectChanges();
    await esperarGeometria();

    expect(component.value()).toBe('mun-scz');
    expect(emitidos).toEqual(['mun-scz']);
    const elegido = html.querySelector('[data-testid="location-mapa-elegido"]')?.textContent ?? '';
    expect(elegido).toContain('Santa Cruz');
    expect(elegido).toContain('Municipio:');
    expect(elegido).toContain('Santa Cruz de la Sierra');
  });

  it('corregir el municipio a mano después del GPS no se pisa cuando el punto no cambia', async () => {
    fixture.componentRef.setInput('punto', { lat: -17.7833, lng: -63.1821 });
    fixture.detectChanges();
    await esperarGeometria();

    component.value.set('mun-warnes');
    fixture.componentRef.setInput('ramas', [...RAMAS]);
    fixture.detectChanges();
    await esperarGeometria();

    expect(component.value()).toBe('mun-warnes');
  });

  it('el punto con el que nace el selector no pisa la localidad ya elegida (borrador, editar)', async () => {
    const otro = TestBed.createComponent(LocationPicker);
    otro.componentRef.setInput('ramas', RAMAS);
    otro.componentRef.setInput('value', 'mun-warnes');
    otro.componentRef.setInput('punto', { lat: -17.7833, lng: -63.1821 });
    otro.detectChanges();
    await import('@shared/components/organisms/department-map/bolivia-municipalities.geometry');
    await new Promise((r) => setTimeout(r));
    otro.detectChanges();

    expect(otro.componentInstance.value()).toBe('mun-warnes');
  });

  it('avisa qué municipio eligió el punto, antes de elegirlo', async () => {
    const avisados: string[] = [];
    component.municipioPorPunto.subscribe((id) => avisados.push(id));
    fixture.componentRef.setInput('punto', { lat: -17.7833, lng: -63.1821 });
    fixture.detectChanges();
    await esperarGeometria();

    expect(avisados).toEqual(['mun-scz']);
  });

  it('un punto fuera de todo municipio no elige nada', async () => {
    fixture.componentRef.setInput('punto', { lat: -12.0464, lng: -77.0428 });
    fixture.detectChanges();
    await esperarGeometria();

    expect(component.value()).toBeNull();
  });

  it('en sólo lectura el punto no cambia la localidad', async () => {
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('punto', { lat: -17.7833, lng: -63.1821 });
    fixture.detectChanges();
    await esperarGeometria();

    expect(component.value()).toBeNull();
  });
});
