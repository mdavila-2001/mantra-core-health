import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import {
  NotificationActionRunner,
  provideNotificationActionHandlers,
  type NotificationActionHandler,
} from './notification-actions';

/**
 * El mecanismo, sin ningún dominio: qué se puede ejecutar y qué pasa cuando
 * no hay quién lo ejecute.
 */
describe('NotificationActionRunner', () => {
  const ejecutadas: string[] = [];

  const manejador = (destinationType: string, key: string): NotificationActionHandler => ({
    destinationType,
    key,
    run: (destino) => {
      ejecutadas.push(`${destinationType}:${key}:${destino.id}`);
      return of({ message: `hecho ${key}` });
    },
  });

  function crear(...fabricas: (() => readonly NotificationActionHandler[])[]): NotificationActionRunner {
    TestBed.configureTestingModule({
      providers: fabricas.map((f) => provideNotificationActionHandlers(f)),
    });
    return TestBed.inject(NotificationActionRunner);
  }

  beforeEach(() => {
    ejecutadas.length = 0;
  });

  it('ejecuta el manejador que coincide en tipo de destino y clave, con el id del destino', async () => {
    const runner = crear(() => [manejador('X', 'OK'), manejador('X', 'NO')]);

    const resultado = await firstValueFrom(runner.ejecutar({ type: 'X', id: '42' }, 'NO'));

    expect(resultado.message).toBe('hecho NO');
    expect(ejecutadas).toEqual(['X:NO:42']);
  });

  it('junta los manejadores de varios proveedores', () => {
    const runner = crear(
      () => [manejador('A', 'OK')],
      () => [manejador('B', 'OK')],
    );

    expect(runner.puedeEjecutar({ type: 'A', id: '1' }, 'OK')).toBe(true);
    expect(runner.puedeEjecutar({ type: 'B', id: '1' }, 'OK')).toBe(true);
  });

  it('la misma clave en otro tipo de destino no es la misma acción', () => {
    const runner = crear(() => [manejador('A', 'OK')]);

    expect(runner.puedeEjecutar({ type: 'B', id: '1' }, 'OK')).toBe(false);
  });

  it('sin destino o sin manejador no se puede ejecutar', () => {
    const runner = crear(() => [manejador('A', 'OK')]);

    expect(runner.puedeEjecutar(undefined, 'OK')).toBe(false);
    expect(runner.puedeEjecutar({ type: 'A', id: '1' }, 'OTRA')).toBe(false);
  });

  it('sin ningún manejador registrado no falla al crearse', () => {
    TestBed.configureTestingModule({});
    const runner = TestBed.inject(NotificationActionRunner);

    expect(runner.puedeEjecutar({ type: 'A', id: '1' }, 'OK')).toBe(false);
  });

  it('ejecutar lo que no tiene manejador es un error visible, no un silencio', async () => {
    const runner = crear(() => [manejador('A', 'OK')]);

    await expect(firstValueFrom(runner.ejecutar({ type: 'A', id: '1' }, 'OTRA'))).rejects.toThrow(
      /No hay manejador/,
    );
    expect(ejecutadas).toEqual([]);
  });
});
