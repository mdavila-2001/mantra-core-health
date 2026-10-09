import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { forcedRealApi } from '../mock/api-mode';
import { errorToViewState } from '../http/error-to-view-state';
import {
  droppedSimulatorExtensions,
  simulatorOnly,
  unavailableInApiError,
  unavailableMessageOf,
  withSimulatorExtensions,
} from './simulator-only';

/**
 * Informe B de deriva de contratos (2026-10-08): lo «sólo simulador» deja de
 * ser un comentario. Contra la maqueta llega; contra la API real no sale, y
 * el error nombra lo que falta en vez de un 404 o un 400 genérico.
 */
describe('simulator-only', () => {
  // En esta rama la maqueta viene apagada por defecto: se enciende para el
  // archivo, y «contra la API real» la vuelve a cortar con `forcedRealApi`.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));
  afterEach(() => forcedRealApi.set(false));

  it('con la maqueta encendida (si no, el resto no prueba nada)', () => {
    expect(environment.mockBackend).toBe(true);
  });

  describe('contra la maqueta', () => {
    it('simulatorOnly deja salir la petición', async () => {
      await expect(firstValueFrom(simulatorOnly('X', '/x', () => of('ok')))).resolves.toBe('ok');
    });

    it('las extensiones viajan y no se avisa nada', () => {
      const body = { name: 'Centro', description: 'Planta baja' };
      expect(withSimulatorExtensions(body, ['description'])).toEqual(body);
      expect(droppedSimulatorExtensions(body, ['description'])).toEqual([]);
    });
  });

  describe('contra la API real', () => {
    beforeEach(() => forcedRealApi.set(true));

    it('simulatorOnly no arma la petición y el error dice qué no está', async () => {
      let llamada = false;
      const error = await firstValueFrom(
        simulatorOnly(
          'Importar servicios del laboratorio',
          '/diagnostics/lab/services/import',
          () => {
            llamada = true;
            return of('nunca');
          },
        ),
      ).catch((e: unknown) => e);
      expect(llamada).toBe(false);
      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(unavailableMessageOf(error)).toBe(
        'Importar servicios del laboratorio: todavía no está disponible. El servidor aún no ofrece esta función.',
      );
    });

    it('quita las extensiones del cuerpo y nombra las que tenían dato', () => {
      const body = { code: 'S1', name: 'Centro', description: 'Planta baja', locationUrl: '' };
      expect(withSimulatorExtensions(body, ['description', 'locationUrl'])).toEqual({
        code: 'S1',
        name: 'Centro',
      });
      expect(droppedSimulatorExtensions(body, ['description', 'locationUrl'])).toEqual([
        'description',
      ]);
    });
  });

  it('el error local llega a la pantalla con su motivo, por el camino de siempre', () => {
    const estado = errorToViewState(
      unavailableInApiError('Buscar personas registradas', '/iam/users/search'),
    );
    expect(estado.status).toBe('validation');
    expect(estado.status === 'validation' ? estado.issues[0]?.message : '').toContain(
      'Buscar personas registradas: todavía no está disponible',
    );
  });

  it('un error del servidor no se confunde con uno local', () => {
    const delServidor = new HttpErrorResponse({
      status: 404,
      error: { code: 'NOT_FOUND', message: 'No encontrado' },
    });
    expect(unavailableMessageOf(delServidor)).toBeNull();
    expect(unavailableMessageOf(new Error('x'))).toBeNull();
  });
});
