import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { TarifarioDeLaUnidad } from './medical-laboratory.types';
import { TarifariosRecordados } from './tarifarios-recordados';

/**
 * La memoria de los tarifarios recién creados.
 *
 * Lo que estas pruebas fijan es que rellena un hueco de lectura **sin volverse
 * indispensable**: sin almacenamiento, con almacenamiento ilegible o pintando
 * en el servidor, la pantalla tiene que seguir funcionando como antes.
 *
 * jsdom corre con origen opaco y `sessionStorage` no está disponible como
 * global: se inyecta uno falso —el mismo doble que usan `theme.service.spec` y
 * `alarma-de-pedidos.spec`—, que además vuelve determinista lo que se espeja.
 */
const CLAVE = 'alovida.tarifarios-recordados';

const PUBLICO: TarifarioDeLaUnidad = {
  id: 'sch-1',
  code: 'PUBLICO',
  esPublico: true,
  cantidadDePrecios: 0,
};

const CONVENIO: TarifarioDeLaUnidad = {
  id: 'sch-2',
  code: 'CONVENIO-A',
  esPublico: false,
  cantidadDePrecios: 0,
};

function almacenFalso(inicial: Record<string, string> = {}): Storage {
  const datos = new Map<string, string>(Object.entries(inicial));
  return {
    get length() {
      return datos.size;
    },
    clear: () => datos.clear(),
    getItem: (clave: string) => datos.get(clave) ?? null,
    key: (indice: number) => [...datos.keys()][indice] ?? null,
    removeItem: (clave: string) => void datos.delete(clave),
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
  };
}

describe('TarifariosRecordados', () => {
  let original: PropertyDescriptor | undefined;

  /** Pone un almacenamiento —o uno que revienta— en lugar del de jsdom. */
  function conAlmacenamiento(descriptor: PropertyDescriptor): void {
    Object.defineProperty(window, 'sessionStorage', { ...descriptor, configurable: true });
  }

  /** Una instancia nueva, como la que hay tras recargar la página. */
  function servicio(plataforma: 'browser' | 'server' = 'browser'): TarifariosRecordados {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: plataforma === 'server' ? [{ provide: PLATFORM_ID, useValue: 'server' }] : [],
    });
    return TestBed.inject(TarifariosRecordados);
  }

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    conAlmacenamiento({ value: almacenFalso() });
  });

  afterEach(() => {
    if (original !== undefined) {
      Object.defineProperty(window, 'sessionStorage', original);
    }
  });

  it('devuelve lo recordado para cada unidad, sin mezclarlas', () => {
    const recordados = servicio();

    recordados.recordar('unit-1', PUBLICO);
    recordados.recordar('unit-2', CONVENIO);

    expect(recordados.deLaUnidad('unit-1')).toEqual([PUBLICO]);
    expect(recordados.deLaUnidad('unit-2')).toEqual([CONVENIO]);
    // Una unidad sin nada recordado no es un error: es lo normal.
    expect(recordados.deLaUnidad('unit-3')).toEqual([]);
  });

  it('no repite el mismo tarifario recordado dos veces', () => {
    const recordados = servicio();

    recordados.recordar('unit-1', PUBLICO);
    recordados.recordar('unit-1', { ...PUBLICO, cantidadDePrecios: 1 });

    // Es el mismo tarifario del servidor: la pantalla lo pinta una vez.
    expect(recordados.deLaUnidad('unit-1')).toEqual([{ ...PUBLICO, cantidadDePrecios: 1 }]);
  });

  it('sobrevive a la recarga de la pantalla', () => {
    servicio().recordar('unit-1', PUBLICO);

    // El defecto que esto impide: el tarifario quedaba creado en el servidor,
    // invisible acá y con su código ocupado.
    expect(servicio().deLaUnidad('unit-1')).toEqual([PUBLICO]);
  });

  it('sigue funcionando en memoria cuando no hay almacenamiento', () => {
    conAlmacenamiento({
      get: () => {
        throw new Error('el origen no tiene almacenamiento');
      },
    });
    const recordados = servicio();

    recordados.recordar('unit-1', PUBLICO);

    // Se pierde al recargar, que es exactamente lo que pasaba antes: no hay
    // nada roto que mostrarle a nadie.
    expect(recordados.deLaUnidad('unit-1')).toEqual([PUBLICO]);
  });

  it('descarta lo espejado que ya no se puede leer', () => {
    conAlmacenamiento({ value: almacenFalso({ [CLAVE]: '{esto no es json' }) });
    const recordados = servicio();

    expect(recordados.deLaUnidad('unit-1')).toEqual([]);
    // Y la pantalla puede seguir usándolo: lo ilegible se descarta, no bloquea.
    recordados.recordar('unit-1', PUBLICO);
    expect(recordados.deLaUnidad('unit-1')).toEqual([PUBLICO]);
  });

  it('descarta lo espejado que ya no tiene la forma de un tarifario', () => {
    conAlmacenamiento({
      value: almacenFalso({ [CLAVE]: '{"unit-1":[{"id":7}],"unit-2":"nada"}' }),
    });

    // Lo pudo dejar una versión anterior de la pantalla: se descarta en vez de
    // llegar a la tabla como un tarifario a medio hacer.
    expect(servicio().deLaUnidad('unit-1')).toEqual([]);
    expect(servicio().deLaUnidad('unit-2')).toEqual([]);
  });

  it('en el servidor ni siquiera pregunta por el almacenamiento', () => {
    let accesos = 0;
    conAlmacenamiento({
      get: () => {
        accesos += 1;
        return almacenFalso();
      },
    });
    const recordados = servicio('server');

    recordados.recordar('unit-1', PUBLICO);

    // No alcanza con que el `try` lo atrape: bajo SSR no se toca, y por eso se
    // cuenta el acceso en vez de esperar a que reviente.
    expect(accesos).toBe(0);
    expect(recordados.deLaUnidad('unit-1')).toEqual([PUBLICO]);
  });
});
