import {
  canRequestSensitiveData,
  dataOf,
  empty,
  forbidden,
  hasData,
  isEmpty,
  isForbidden,
  isLoading,
  isNotFound,
  isOffline,
  isReady,
  isRouteAuthPending,
  isStale,
  isUnexpectedError,
  isValidation,
  loading,
  m34CodeOf,
  mapData,
  notFound,
  offline,
  ready,
  routeAuthPending,
  stale,
  staleAgeMs,
  unexpectedError,
  validation,
} from './view-state';
import { M34_CODE_BY_STATUS, type M34Code, type ViewState } from './view-state.types';

/** Una acción cualquiera: los constructores que la exigen no la interpretan. */
const UNA_ACCION = { label: 'Cargar el primer estudio', route: '/estudios/nuevo' } as const;

describe('ViewState · los 9 estados del M34', () => {
  describe('estrechamiento por estado', () => {
    it('cada constructor produce su propio status y solo su guarda lo reconoce', () => {
      const estados: readonly ViewState<number>[] = [
        routeAuthPending(),
        loading(),
        empty(UNA_ACCION),
        ready(42),
        validation([{ message: 'Falta el documento' }]),
        forbidden(),
        notFound(),
        stale(42, new Date('2026-07-31T10:00:00Z')),
        offline(),
        unexpectedError('req-1'),
      ];

      const guardas = [
        isRouteAuthPending,
        isLoading,
        isEmpty,
        isReady,
        isValidation,
        isForbidden,
        isNotFound,
        isStale,
        isOffline,
        isUnexpectedError,
      ];

      // La diagonal: la guarda i reconoce el estado i y ninguno más.
      estados.forEach((estado, i) => {
        guardas.forEach((guarda, j) => {
          expect(guarda(estado)).toBe(i === j);
        });
      });
    });

    it('estrecha el tipo dentro de la guarda, sin conversiones', () => {
      const estado: ViewState<{ nombre: string }> = ready({ nombre: 'Ana' });

      if (isReady(estado)) {
        // Si el estrechamiento no funcionara, esto no compilaría.
        expect(estado.data.nombre).toBe('Ana');
      } else {
        throw new Error('ready() debería haber sido reconocido por isReady');
      }
    });

    it('los 10 status son distintos entre sí', () => {
      const status = [
        routeAuthPending(),
        loading(),
        empty(UNA_ACCION),
        ready(1),
        validation([]),
        forbidden(),
        notFound(),
        stale(1, new Date()),
        offline(),
        unexpectedError('req-1'),
      ].map((estado) => estado.status);

      expect(new Set(status).size).toBe(status.length);
    });
  });

  // -------------------------------------------------------------------------
  // Las tres reglas que el modelo marca como no cosméticas
  // -------------------------------------------------------------------------

  describe('regla S1 ≠ S2 · autorizar antes de pedir datos sensibles', () => {
    it('S1 y S2 no son el mismo estado', () => {
      expect(routeAuthPending().status).not.toBe(loading().status);
      expect(m34CodeOf(routeAuthPending())).toBe('S1');
      expect(m34CodeOf(loading())).toBe('S2');
    });

    it('solo S1 impide pedir datos sensibles', () => {
      expect(canRequestSensitiveData(routeAuthPending())).toBe(false);

      const yaAutorizados: readonly ViewState<number>[] = [
        loading(),
        empty(UNA_ACCION),
        ready(1),
        validation([]),
        forbidden(),
        notFound(),
        stale(1, new Date()),
        offline(),
        unexpectedError('req-1'),
      ];

      for (const estado of yaAutorizados) {
        expect(canRequestSensitiveData(estado)).toBe(true);
      }
    });

    it('S1 no transporta datos: no hay nada que pintar todavía', () => {
      expect(hasData(routeAuthPending())).toBe(false);
      expect(dataOf<number>(routeAuthPending())).toBeNull();
    });
  });

  describe('regla S5 ≠ S6 · prohibido vs. inexistente, sin filtrar existencia', () => {
    it('son estados distintos con códigos distintos', () => {
      expect(forbidden().status).not.toBe(notFound().status);
      expect(m34CodeOf(forbidden())).toBe('S5');
      expect(m34CodeOf(notFound())).toBe('S6');
    });

    it('S6 no tiene ningún canal por donde filtrar datos del recurso', () => {
      // Sin acción: el estado es literalmente solo su discriminante.
      expect(Object.keys(notFound())).toEqual(['status']);

      // Con acción: la única variación permitida, y no depende del recurso.
      expect(Object.keys(notFound(UNA_ACCION)).sort()).toEqual(['nextAction', 'status']);
    });

    it('S6 es idéntico se construya para un recurso inexistente o para uno oculto', () => {
      const inexistente = notFound();
      const ocultoPorPermiso = notFound();

      expect(inexistente).toEqual(ocultoPorPermiso);
    });

    it('S5 sí puede llevar una salida: distingue la puerta del muro', () => {
      const muro = forbidden({ message: 'No tenés permiso sobre esta sección' });
      const puerta = forbidden({
        message: 'Verificá tu identidad para continuar',
        nextAction: { label: 'Verificar identidad', route: '/identity/me' },
      });

      expect(muro.nextAction).toBeUndefined();
      expect(puerta.nextAction?.route).toBe('/identity/me');
    });
  });

  describe('regla S7 · el dato viejo expone su antigüedad', () => {
    it('S7 transporta datos y el momento al que corresponden', () => {
      const asOf = new Date('2026-07-31T10:00:00Z');
      const estado = stale({ camas: 12 }, asOf);

      expect(estado.data.camas).toBe(12);
      expect(estado.asOf).toBe(asOf);
    });

    it('calcula la antigüedad contra un ahora explícito', () => {
      const asOf = new Date('2026-07-31T10:00:00Z');
      const ahora = new Date('2026-07-31T10:05:00Z');

      expect(staleAgeMs(stale(1, asOf), ahora)).toBe(5 * 60 * 1000);
    });

    it('ready y stale se distinguen aunque ambos tengan datos', () => {
      expect(hasData(ready(1))).toBe(true);
      expect(hasData(stale(1, new Date()))).toBe(true);
      expect(m34CodeOf(stale(1, new Date()))).toBe('S7');
      expect(m34CodeOf(ready(1))).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Trazabilidad al modelo canónico
  // -------------------------------------------------------------------------

  describe('trazabilidad al M34', () => {
    it('cubre exactamente los 9 códigos literales del modelo, sin inventar ninguno', () => {
      const esperados: readonly M34Code[] = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];
      const declarados = Object.values(M34_CODE_BY_STATUS).filter(
        (codigo): codigo is M34Code => codigo !== null,
      );

      expect([...declarados].sort()).toEqual([...esperados].sort());
      expect(declarados.length).toBe(9);
    });

    it('solo el camino feliz queda fuera de la lista de los 9', () => {
      const sinCodigo = Object.entries(M34_CODE_BY_STATUS)
        .filter(([, codigo]) => codigo === null)
        .map(([status]) => status);

      expect(sinCodigo).toEqual(['ready']);
    });
  });

  // -------------------------------------------------------------------------
  // Consultas y transformación
  // -------------------------------------------------------------------------

  describe('dataOf y mapData', () => {
    it('dataOf devuelve los datos de ready y stale, y null en el resto', () => {
      expect(dataOf(ready(7))).toBe(7);
      expect(dataOf(stale(7, new Date()))).toBe(7);
      expect(dataOf<number>(loading())).toBeNull();
      expect(dataOf<number>(empty(UNA_ACCION))).toBeNull();
      expect(dataOf<number>(unexpectedError('req-1'))).toBeNull();
    });

    it('mapData transforma los datos conservando el estado', () => {
      const asOf = new Date('2026-07-31T10:00:00Z');
      const transformado = mapData(stale({ total: 3 }, asOf), (dato) => dato.total * 2);

      expect(transformado.status).toBe('stale');
      expect(dataOf(transformado)).toBe(6);
      if (isStale(transformado)) {
        expect(transformado.asOf).toBe(asOf);
      }
    });

    it('mapData deja intactos los estados sin datos y no ejecuta la transformación', () => {
      let veces = 0;
      const transformado = mapData<number, string>(offline(), (dato) => {
        veces += 1;
        return String(dato);
      });

      expect(transformado.status).toBe('offline');
      expect(veces).toBe(0);
    });
  });

  describe('constructores', () => {
    it('S3 exige una próxima acción y no inventa mensaje', () => {
      const sinMensaje = empty(UNA_ACCION);

      expect(sinMensaje.nextAction).toEqual(UNA_ACCION);
      expect('message' in sinMensaje).toBe(false);
    });

    it('S4 conserva los problemas y el tiempo de espera cuando lo hay', () => {
      const conflicto = validation([{ field: 'nationalId', message: 'Ya existe', code: 'DUP' }]);
      const limitado = validation([{ message: 'Demasiadas peticiones' }], 30);

      expect(conflicto.issues[0]?.field).toBe('nationalId');
      expect('retryAfterSeconds' in conflicto).toBe(false);
      expect(limitado.retryAfterSeconds).toBe(30);
    });

    it('S9 conserva el identificador de la petición', () => {
      expect(unexpectedError('req-abc-123').requestId).toBe('req-abc-123');
    });

    it('S8 registra el último intento solo si se le da', () => {
      expect('lastAttemptAt' in offline()).toBe(false);
      const intento = new Date('2026-07-31T10:00:00Z');
      expect(offline(intento).lastAttemptAt).toBe(intento);
    });
  });
});
