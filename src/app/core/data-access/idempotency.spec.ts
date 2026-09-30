import type { HttpHeaders } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';

import { IDEMPOTENCY_KEY_HEADER, sendIdempotent, SubmissionKeys } from './idempotency';

/** Fábrica de claves predecible: k-1, k-2, … */
function sequentialKeys(): SubmissionKeys {
  let n = 0;
  return new SubmissionKeys(() => `k-${++n}`);
}

describe('claves de idempotencia por intento de envío', () => {
  describe('SubmissionKeys', () => {
    // Correcto: el reintento del mismo envío (doble clic, timeout) lleva la
    // misma clave, que es lo que le permite al servidor no duplicar.
    it('los mismos datos reutilizan la clave', () => {
      const keys = sequentialKeys();

      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-1');
      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-1');
    });

    it('el orden de las claves del cuerpo no cuenta como cambio', () => {
      const keys = sequentialKeys();

      const first = keys.keyFor('walk-in', { a: 1, b: { c: 2, d: 3 } });
      const second = keys.keyFor('walk-in', { b: { d: 3, c: 2 }, a: 1 });

      expect(second).toBe(first);
    });

    // Límite: el usuario corrige el formulario. Con la clave vieja el servidor
    // respondería 422 (clave reciclada con otro cuerpo).
    it('datos distintos generan una clave nueva', () => {
      const keys = sequentialKeys();

      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-1');
      expect(keys.keyFor('walk-in', { a: 2 })).toBe('k-2');
      // Volver a los datos de antes también es un envío nuevo: sólo se
      // recuerda el último de cada operación.
      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-3');
    });

    it('cada operación lleva su propia clave', () => {
      const keys = sequentialKeys();

      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-1');
      expect(keys.keyFor('service-request', { a: 1 })).toBe('k-2');
      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-1');
    });

    it('cerrar el envío hace que el siguiente, aun con los mismos datos, sea nuevo', () => {
      const keys = sequentialKeys();
      const key = keys.keyFor('walk-in', { a: 1 });

      keys.settle('walk-in', key);

      expect(keys.keyFor('walk-in', { a: 1 })).toBe('k-2');
    });

    // Inválido: cerrar con una clave vieja no puede borrar la de un envío
    // posterior que todavía no terminó.
    it('cerrar con una clave que ya no es la vigente no toca la vigente', () => {
      const keys = sequentialKeys();
      const old = keys.keyFor('walk-in', { a: 1 });
      keys.keyFor('walk-in', { a: 2 });

      keys.settle('walk-in', old);

      expect(keys.keyFor('walk-in', { a: 2 })).toBe('k-2');
    });
  });

  describe('sendIdempotent', () => {
    it('adjunta la cabecera Idempotency-Key a la petición', () => {
      const keys = sequentialKeys();
      let sent: HttpHeaders | undefined;

      sendIdempotent(keys, 'walk-in', { a: 1 }, (headers) => {
        sent = headers;
        return of('ok');
      }).subscribe();

      expect(sent?.get(IDEMPOTENCY_KEY_HEADER)).toBe('k-1');
    });

    it('si falla, el reintento del mismo envío reutiliza la clave', () => {
      const keys = sequentialKeys();
      const sent: (string | null)[] = [];

      sendIdempotent(keys, 'walk-in', { a: 1 }, (headers) => {
        sent.push(headers.get(IDEMPOTENCY_KEY_HEADER));
        return throwError(() => new Error('timeout'));
      }).subscribe({ error: () => undefined });
      sendIdempotent(keys, 'walk-in', { a: 1 }, (headers) => {
        sent.push(headers.get(IDEMPOTENCY_KEY_HEADER));
        return of('ok');
      }).subscribe();

      expect(sent).toEqual(['k-1', 'k-1']);
    });

    it('si sale bien, el próximo envío lleva otra clave', () => {
      const keys = sequentialKeys();
      const sent: (string | null)[] = [];
      const send = (headers: HttpHeaders) => {
        sent.push(headers.get(IDEMPOTENCY_KEY_HEADER));
        return of('ok');
      };

      sendIdempotent(keys, 'walk-in', { a: 1 }, send).subscribe();
      sendIdempotent(keys, 'walk-in', { a: 1 }, send).subscribe();

      expect(sent).toEqual(['k-1', 'k-2']);
    });

    it('mientras la primera sigue en vuelo, un segundo envío igual lleva la misma clave', () => {
      const keys = sequentialKeys();
      const sent: (string | null)[] = [];
      const pending = new Subject<string>();

      sendIdempotent(keys, 'walk-in', { a: 1 }, (headers) => {
        sent.push(headers.get(IDEMPOTENCY_KEY_HEADER));
        return pending;
      }).subscribe();
      sendIdempotent(keys, 'walk-in', { a: 1 }, (headers) => {
        sent.push(headers.get(IDEMPOTENCY_KEY_HEADER));
        return of('ok');
      }).subscribe();

      expect(sent).toEqual(['k-1', 'k-1']);
    });
  });
});
