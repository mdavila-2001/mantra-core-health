import { buildInfo } from '../../../environments/env.generated';

import { Coleccion } from './mock-store';

/* ============================================================================
    Lo guardado en la pestaña no puede sobrevivir a un despliegue.

    El defecto que esto evita ya ocurrió, y es de los que no se ven. La maqueta
    guarda sus tablas en `sessionStorage` y **lo guardado gana sobre el
    fixture**, para que un registro creado en pantalla no desaparezca con F5.
    El precio es que, cuando el fixture cambia, quien tenga la pestaña abierta
    de antes sigue viendo lo viejo en cada recarga.

    Pasó al traer los laboratorios y las farmacias reales de Bolivia: el
    despliegue estaba bien, las pruebas de navegador pasaban —cada una abre una
    pestaña limpia— y la persona que lo tenía abierto seguía viendo los ocho
    inventados. Desde el navegador es indistinguible de un despliegue que no
    llegó.

    La solución es el sello: lo guardado lleva el commit del build, y si no
    coincide se descarta.
    ========================================================================== */

interface Fila {
  readonly id: string;
  readonly nombre: string;
}

const CLAVE = 'mock.prueba.persistencia';

const FIXTURE: readonly Fila[] = [{ id: '1', nombre: 'del fixture nuevo' }];

describe('lo que la maqueta guarda entre recargas', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('se recupera dentro de la misma versión, que es para lo que existe', () => {
    const primera = new Coleccion<Fila>(FIXTURE, CLAVE);
    primera.agregar({ id: '2', nombre: 'escrito en pantalla' });

    const tras_recargar = new Coleccion<Fila>(FIXTURE, CLAVE);

    expect(tras_recargar.get('2')?.nombre).toBe('escrito en pantalla');
  });

  it('se descarta cuando el build cambió, y manda el fixture nuevo', () => {
    // Lo que dejaría una pestaña abierta antes del despliegue.
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ build: 'otro-commit', filas: [{ id: '9', nombre: 'del build viejo' }] }),
    );

    const tras_desplegar = new Coleccion<Fila>(FIXTURE, CLAVE);

    expect(tras_desplegar.get('9')).toBeUndefined();
    expect(tras_desplegar.get('1')?.nombre).toBe('del fixture nuevo');
  });

  it('descarta también el formato viejo, el de antes del sello', () => {
    // Un array pelado: así se guardaba antes, y es de otra versión por
    // definición. Si se aceptara, el defecto volvería para quien venga de ahí.
    sessionStorage.setItem(CLAVE, JSON.stringify([{ id: '9', nombre: 'formato viejo' }]));

    const coleccion = new Coleccion<Fila>(FIXTURE, CLAVE);

    expect(coleccion.get('9')).toBeUndefined();
    expect(coleccion.get('1')).toBeDefined();
  });

  it('sella con el commit de este build, no con cualquier cosa', () => {
    const coleccion = new Coleccion<Fila>(FIXTURE, CLAVE);
    coleccion.agregar({ id: '3', nombre: 'nueva' });

    const guardado = JSON.parse(sessionStorage.getItem(CLAVE) ?? '{}') as { build?: string };

    expect(guardado.build).toBe(buildInfo.commit);
  });

  it('aguanta un almacenamiento con basura sin romper la pantalla', () => {
    sessionStorage.setItem(CLAVE, 'esto no es json');

    const coleccion = new Coleccion<Fila>(FIXTURE, CLAVE);

    expect(coleccion.get('1')).toBeDefined();
  });

  it('`persistirEn` respeta el sello igual que el constructor', () => {
    // Los fixtures declaran la colección y le agregan la persistencia al pie
    // del archivo; ese camino tiene que descartar lo viejo igual que el otro.
    sessionStorage.setItem(
      CLAVE,
      JSON.stringify({ build: 'otro-commit', filas: [{ id: '9', nombre: 'del build viejo' }] }),
    );

    const coleccion = new Coleccion<Fila>(FIXTURE).persistirEn(CLAVE);

    expect(coleccion.get('9')).toBeUndefined();
    expect(coleccion.get('1')).toBeDefined();
  });
});
