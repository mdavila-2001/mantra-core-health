import { crearBorradorAislado, hayCambioGuardable } from './form-draft';

/**
 * El caso que motivó el arreglo: un editor que se guarda solo y relee la
 * plantilla tras cada guardado no puede resetear su borrador cuando lo que
 * vuelve es justo lo que él mismo mandó — o la tercera letra de una opción
 * borraría las dos primeras.
 */
describe('el borrador aislado', () => {
  it('no reconoce nada como propio antes de la primera emisión', () => {
    const borrador = crearBorradorAislado();
    expect(borrador.esLoPropio('cualquier-firma')).toBe(false);
  });

  it('tras emitir, un retorno idéntico se reconoce como lo propio', () => {
    const borrador = crearBorradorAislado();
    borrador.registrarEmision('firma-a');
    expect(borrador.esLoPropio('firma-a')).toBe(true);
  });

  it('un retorno distinto no se reconoce como lo propio', () => {
    const borrador = crearBorradorAislado();
    borrador.registrarEmision('firma-a');
    expect(borrador.esLoPropio('firma-b')).toBe(false);
  });

  it('la última emisión reemplaza a la anterior', () => {
    const borrador = crearBorradorAislado();
    borrador.registrarEmision('firma-a');
    borrador.registrarEmision('firma-b');
    expect(borrador.esLoPropio('firma-a')).toBe(false);
    expect(borrador.esLoPropio('firma-b')).toBe(true);
  });
});

describe('si hay algo que valga la pena mandar', () => {
  it('no hay nada que mandar cuando la firma de los cambios es la actual', () => {
    expect(hayCambioGuardable('firma-a', 'firma-a')).toBe(false);
  });

  it('hay algo que mandar cuando la firma de los cambios difiere de la actual', () => {
    expect(hayCambioGuardable('firma-a', 'firma-b')).toBe(true);
  });
});
