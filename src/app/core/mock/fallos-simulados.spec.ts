import { cuerpoDelFallo, falloPara } from './fallos-simulados';

/**
 * El simulador de fallos del backend de maqueta.
 *
 * Existe para que los estados de error de una pantalla se puedan **mirar** y no
 * sólo probar: la maqueta intercepta dentro de Angular, así que sin esto no hay
 * manera de provocar un 403 ni una petición que no llega. Lo que se fija acá es
 * lo que lo vuelve seguro: apagado por omisión, tolerante a basura, y con los
 * códigos del contrato en el cuerpo —que es por donde `errorToViewState` mapea—.
 */
describe('fallos simulados del backend de maqueta', () => {
  afterEach(() => sessionStorage.removeItem('mock:fallos'));

  function declarar(valor: unknown): void {
    sessionStorage.setItem('mock:fallos', typeof valor === 'string' ? valor : JSON.stringify(valor));
  }

  it('sin nada declarado, ninguna petición falla', () => {
    expect(falloPara('POST', '/clinical/allergy-intolerances')).toBeNull();
  });

  it('casa por subcadena de la ruta', () => {
    declarar([{ patron: '/clinical/allergy-intolerances', modo: 'red' }]);
    expect(falloPara('POST', '/clinical/allergy-intolerances')?.modo).toBe('red');
    expect(falloPara('POST', '/clinical/conditions')).toBeNull();
  });

  /**
   * Lo corriente: hacer fallar el alta sin tumbar la lectura que pinta la
   * pantalla donde vive el formulario.
   */
  it('puede limitarse a un método', () => {
    declarar([{ patron: '/clinical/patients', modo: 'error', metodos: ['post'] }]);
    expect(falloPara('POST', '/clinical/patients/p-1/summary')?.modo).toBe('error');
    expect(falloPara('GET', '/clinical/patients/p-1/summary')).toBeNull();
  });

  /**
   * Una herramienta de desarrollo que tumba la aplicación al escribirse mal es
   * peor que no tenerla.
   */
  it('la basura se lee como «sin fallos»', () => {
    declarar('esto no es json');
    expect(falloPara('POST', '/clinical/allergy-intolerances')).toBeNull();

    declarar({ patron: '/clinical', modo: 'red' });
    expect(falloPara('POST', '/clinical/allergy-intolerances')).toBeNull();

    declarar([{ patron: '/clinical', modo: 'inventado' }, { patron: '', modo: 'red' }, null, 7]);
    expect(falloPara('POST', '/clinical/allergy-intolerances')).toBeNull();
  });

  /**
   * S9 exige el identificador de petición. Sin `correlationId` —o con un código
   * que `API_ERROR_CODES` no declara, que hace que el cuerpo entero se
   * descarte— el aviso sale con «sin-id» y el simulador enseña a leer mal el
   * error de verdad.
   */
  it('todos los cuerpos llevan identificador de petición', () => {
    for (const modo of ['forbidden', 'not-found', 'conflict', 'error'] as const) {
      const { body } = cuerpoDelFallo({ patron: '/x', modo }, '/x');
      expect((body as { correlationId?: string }).correlationId).toBe('mock-fallo');
    }
  });

  /**
   * `errorToViewState` mapea por el código del contrato y no por el estado
   * HTTP —dos códigos distintos comparten el 403—, así que un cuerpo sin `code`
   * caería en «error inesperado» y no en el estado que se quería mirar.
   */
  it('el cuerpo lleva el código del contrato, no sólo el estado HTTP', () => {
    const permiso = cuerpoDelFallo({ patron: '/x', modo: 'forbidden' }, '/x');
    expect(permiso.status).toBe(403);
    expect((permiso.body as { code: string }).code).toBe('FORBIDDEN');

    const ausente = cuerpoDelFallo({ patron: '/x', modo: 'not-found' }, '/x');
    expect(ausente.status).toBe(404);
    expect((ausente.body as { code: string }).code).toBe('NOT_FOUND');

    const conflicto = cuerpoDelFallo({ patron: '/x', modo: 'conflict' }, '/x');
    expect(conflicto.status).toBe(409);
    expect((conflicto.body as { code: string }).code).toBe('CONFLICT');

    const inesperado = cuerpoDelFallo({ patron: '/x', modo: 'error' }, '/x');
    expect(inesperado.status).toBe(500);
    expect((inesperado.body as { code: string }).code).toBe('INTERNAL');
  });
});
