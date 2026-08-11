import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SystemContextClient } from './system-context.client';
import type { DynamicEnum } from './system-context.types';

/**
 * Las enumeraciones dinámicas son lo que permite que un campo `*_concept_id`
 * sea un selector en vez de un uuid tecleado a mano.
 *
 * Lo que estas pruebas fijan, y que un refactor rompería en silencio:
 *
 * 1. **Se memoiza por target.** El backend declara los uuid deterministas y
 *    manda `cacheToken` justamente para que cachear sea seguro; dos selectores
 *    en la misma pantalla no pueden costar dos peticiones.
 * 2. **Un fallo no se memoiza.** Un corte de red no puede dejar un campo
 *    marcado como «sin opciones» por el resto de la sesión.
 */

const GENERO = {
  code: 'administrative-gender',
  name: 'Género administrativo',
  description: 'Género con el que la persona consta a efectos administrativos.',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  versionId: 'v-1',
  cacheToken: '432b45ab670a6459',
  allowCustomValue: false,
  options: [
    {
      conceptId: 'c-male',
      code: 'GENDER_MALE',
      display: 'Administrative gender male',
      ordinal: 0,
      isDefault: false,
    },
  ],
};

const TARGET = 'profiles.persons.administrative_gender_concept_id';

describe('SystemContextClient', () => {
  let client: SystemContextClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(SystemContextClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el target como parámetro y devuelve sus opciones', () => {
    let enumeracion: DynamicEnum | undefined;
    client.dynamicEnum(TARGET).subscribe((e) => (enumeracion = e));

    const req = http.expectOne((r) => r.url === '/system-context/dynamic-enums');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('target')).toBe(TARGET);

    req.flush(GENERO);

    expect(enumeracion?.code).toBe('administrative-gender');
    expect(enumeracion?.options[0]?.code).toBe('GENDER_MALE');
  });

  /**
   * Es la razón de ser de la caché: una pantalla con género y sexo al nacer
   * pide dos targets, pero dos pantallas del mismo target no pueden costar dos
   * viajes.
   */
  it('memoiza por target: la segunda lectura no vuelve a pedir', () => {
    client.dynamicEnum(TARGET).subscribe();
    http.expectOne((r) => r.url === '/system-context/dynamic-enums').flush(GENERO);

    let segunda: DynamicEnum | undefined;
    client.dynamicEnum(TARGET).subscribe((e) => (segunda = e));

    // `http.verify()` del afterEach comprueba que no salió una segunda.
    expect(segunda?.code).toBe('administrative-gender');
  });

  it('dos targets distintos son dos lecturas distintas', () => {
    client.dynamicEnum(TARGET).subscribe();
    client.dynamicEnum('profiles.persons.sex_at_birth_concept_id').subscribe();

    const peticiones = http.match((r) => r.url === '/system-context/dynamic-enums');
    expect(peticiones.length).toBe(2);

    peticiones[0]?.flush(GENERO);
    peticiones[1]?.flush({ ...GENERO, code: 'sex-at-birth' });
  });

  /**
   * Sin esto, un corte de red durante el primer render dejaría el campo sin
   * opciones para siempre — y la persona no tendría forma de recuperarlo salvo
   * recargando la aplicación entera.
   */
  it('un fallo no queda memoizado: el siguiente intento vuelve a pedir', () => {
    let fallo: unknown;
    client.dynamicEnum(TARGET).subscribe({ error: (e: unknown) => (fallo = e) });

    http
      .expectOne((r) => r.url === '/system-context/dynamic-enums')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(fallo).toBeDefined();

    let segunda: DynamicEnum | undefined;
    client.dynamicEnum(TARGET).subscribe((e) => (segunda = e));

    http.expectOne((r) => r.url === '/system-context/dynamic-enums').flush(GENERO);
    expect(segunda?.code).toBe('administrative-gender');
  });

  it('`forget` obliga a releer un target', () => {
    client.dynamicEnum(TARGET).subscribe();
    http.expectOne((r) => r.url === '/system-context/dynamic-enums').flush(GENERO);

    client.forget(TARGET);
    client.dynamicEnum(TARGET).subscribe();

    http.expectOne((r) => r.url === '/system-context/dynamic-enums').flush(GENERO);
  });

  /**
   * Los opcionales llegan `null` del cable. Dejarlos así obligaría a comprobar
   * `null` y `undefined` en cada consumidor, y alguno comprobaría sólo uno.
   */
  it('normaliza a ausencia los opcionales que llegan nulos', () => {
    let enumeracion: DynamicEnum | undefined;
    client.dynamicEnum(TARGET).subscribe((e) => (enumeracion = e));

    http
      .expectOne((r) => r.url === '/system-context/dynamic-enums')
      .flush({ ...GENERO, description: null, versionId: null, cacheToken: null });

    expect(enumeracion).not.toHaveProperty('description');
    expect(enumeracion).not.toHaveProperty('cacheToken');
  });
});
