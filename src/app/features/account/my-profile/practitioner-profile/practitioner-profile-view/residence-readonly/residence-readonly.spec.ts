import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { BoMunicipalitiesCatalog, type RamaDepartamento } from '../../../../../../core/data-access/terminology/bo-municipalities.service';
import type { PuntoGeo } from '../../../../../../shared/components/organisms/map/map-pin.types';
import { LocationPicker } from '../../../../../auth/shared-registration/location-picker/location-picker';
import { ResidenceReadonly } from './residence-readonly';

/**
 * La residencia en la vista del perfil: el mismo selector de ubicación del
 * alta, en sólo lectura, con el municipio guardado y el punto del mapa. Si el
 * catálogo de municipios no carga, no se pinta un selector vacío.
 */

@Component({ selector: 'app-location-picker', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class SelectorDoble {
  readonly ramas = input<readonly RamaDepartamento[]>([]);
  readonly readonly = input(false);
  readonly testId = input('');
  readonly value = input<string | null>(null);
  readonly punto = input<PuntoGeo | null>(null);
  readonly mapLabel = input('');
  readonly municipalityLabel = input('');
  readonly municipalityHint = input('');
}

const RAMAS = [{ departamento: { id: 'SCZ' }, municipios: [] }] as unknown as readonly RamaDepartamento[];

describe('ResidenceReadonly', () => {
  function pintar(listar: () => ReturnType<BoMunicipalitiesCatalog['listar']>) {
    TestBed.configureTestingModule({ providers: [{ provide: BoMunicipalitiesCatalog, useValue: { listar } }] });
    TestBed.overrideComponent(ResidenceReadonly, { remove: { imports: [LocationPicker] }, add: { imports: [SelectorDoble] } });
    const fixture = TestBed.createComponent(ResidenceReadonly);
    fixture.componentRef.setInput('municipioId', 'mun-70101');
    fixture.componentRef.setInput('punto', { lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    return fixture;
  }

  it('monta el selector en sólo lectura con el municipio, el punto y cómo cambiarlo', () => {
    const fixture = pintar(() => of(RAMAS));
    const selector = fixture.debugElement.query((d) => d.componentInstance instanceof SelectorDoble).componentInstance as SelectorDoble;
    expect(selector.readonly()).toBe(true);
    expect(selector.value()).toBe('mun-70101');
    expect(selector.punto()).toEqual({ lat: -17.78, lng: -63.18 });
    expect(selector.ramas()).toBe(RAMAS);
    expect(selector.municipalityHint()).toContain('Editar perfil');
  });

  it('si el catálogo no carga, no pinta un selector vacío', () => {
    const fixture = pintar(() => throwError(() => new Error('caído')));
    expect((fixture.nativeElement as HTMLElement).querySelector('app-location-picker')).toBeNull();
  });
});
