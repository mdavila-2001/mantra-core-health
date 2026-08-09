import { TestBed } from '@angular/core/testing';

import { ErrorReporter } from './error-reporter';

/**
 * Lo que estas pruebas protegen no es el formato del identificador: es **qué
 * NO viaja**.
 *
 * El día que este servicio tenga destino remoto, la regla de privacidad tiene
 * que estar fijada de antes: en un sistema de salud, hasta la sección visitada
 * es información de salud, y una traza puede arrastrar valores interpolados en
 * plantillas.
 */
describe('ErrorReporter', () => {
  let reporter: ErrorReporter;
  let consola: ReturnType<typeof vi.spyOn>;

  const contexto = { version: '1.2.3', commit: 'abc1234', route: '/panel' };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    reporter = TestBed.inject(ErrorReporter);
    consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consola.mockRestore();
  });

  it('devuelve un identificador que se puede dictar por teléfono', () => {
    const id = reporter.report(new Error('roto'), contexto);

    // Lleva el commit: un código sin versión no dice contra qué código comparar.
    expect(id).toBe('E-abc1234-001');
  });

  it('numera los fallos de la sesión', () => {
    reporter.report(new Error('uno'), contexto);
    expect(reporter.report(new Error('dos'), contexto)).toBe('E-abc1234-002');
  });

  it('expone el último para que la pantalla de recuperación lo muestre', () => {
    reporter.report(new Error('roto'), contexto);

    expect(reporter.ultimo()?.id).toBe('E-abc1234-001');
    expect(reporter.ultimo()?.message).toBe('roto');
  });

  it('NO registra la traza: puede arrastrar valores interpolados en plantillas', () => {
    const error = new Error('roto');
    error.stack = 'Error: roto\n    at DatosPaciente (dni 12345678)';

    reporter.report(error, contexto);

    const registrado = reporter.ultimo();
    expect(registrado?.message).toBe('roto');
    expect(JSON.stringify(registrado)).not.toContain('12345678');
  });

  it('registra solo versión, commit y ruta como contexto', () => {
    reporter.report(new Error('roto'), contexto);

    expect(reporter.ultimo()?.context).toEqual(contexto);
  });

  describe('errores que no son `Error` — todos son legales en JavaScript', () => {
    it('una cadena lanzada', () => {
      reporter.report('algo falló', contexto);
      expect(reporter.ultimo()?.message).toBe('algo falló');
    });

    it('un objeto cualquiera', () => {
      reporter.report({ codigo: 500 }, contexto);
      expect(reporter.ultimo()?.message).toBe('Error sin mensaje');
    });

    it('un `Error` sin mensaje cae en su nombre', () => {
      reporter.report(new TypeError(''), contexto);
      expect(reporter.ultimo()?.message).toBe('TypeError');
    });

    it('`null`', () => {
      reporter.report(null, contexto);
      expect(reporter.ultimo()?.message).toBe('Error sin mensaje');
    });
  });

  it('acota el historial: es un registro para reportar, no un archivo', () => {
    for (let i = 0; i < 25; i += 1) {
      reporter.report(new Error(`e${i}`), contexto);
    }

    expect(reporter.historial()).toHaveLength(20);
    expect(reporter.historial().at(-1)?.message).toBe('e24');
  });

  it('deja rastro en consola aunque no haya destino remoto', () => {
    // Un fallo sin rastro es indistinguible de un fallo que no ocurrió.
    reporter.report(new Error('roto'), contexto);

    expect(consola).toHaveBeenCalled();
  });
});
