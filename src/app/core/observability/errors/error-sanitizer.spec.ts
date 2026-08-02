import { redact, sanitizeError, typeOf } from './error-sanitizer';

/**
 * La regla que estas pruebas fijan: **de un error salen dos cosas, la clase y
 * un mensaje saneado**. Nunca la traza de pila, nunca el objeto original.
 *
 * Es la misma que `ErrorReporter` ya protegía —«no se registra el `stack`:
 * puede contener valores interpolados en plantillas»— aplicada al camino nuevo.
 * Sin esto, la telemetría sería la puerta trasera de esa decisión.
 */
describe('sanitizeError', () => {
  it('NO devuelve la traza de pila', () => {
    const error = new Error('roto');
    error.stack = 'Error: roto\n    at DatosPaciente (dni 12345678)';

    const saneado = sanitizeError(error);

    expect(JSON.stringify(saneado)).not.toContain('12345678');
    expect(JSON.stringify(saneado)).not.toContain('at DatosPaciente');
  });

  it('conserva la clase, que es lo que agrupa en Jaeger', () => {
    class ChunkLoadError extends Error {
      override readonly name = 'ChunkLoadError';
    }

    expect(sanitizeError(new ChunkLoadError('no bajó')).type).toBe('ChunkLoadError');
  });

  it('no serializa un objeto suelto: volcaría el cuerpo de la respuesta', () => {
    const saneado = sanitizeError({ mensaje: 'el correo ana@ejemplo.com ya existe' });

    expect(saneado.type).toBe('Object');
    expect(saneado.message).toBe('sin mensaje');
  });

  it('tolera lo que no es un Error, porque en JavaScript se puede lanzar todo', () => {
    expect(sanitizeError('texto suelto').message).toBe('texto suelto');
    expect(typeOf(null)).toBe('null');
    expect(typeOf([1, 2])).toBe('Array');
    expect(typeOf(42)).toBe('number');
  });
});

describe('redact', () => {
  it('tapa un JWT pegado en el mensaje', () => {
    const tapado = redact('falló con eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.firma');

    expect(tapado).toContain('«token»');
    expect(tapado).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('tapa un correo', () => {
    expect(redact('el usuario ana.perez@clinica.example no existe')).toBe(
      'el usuario «correo» no existe',
    );
  });

  it('borra el query string entero: es donde viajan los tokens de un solo uso', () => {
    expect(redact('404 en /auth/verificar?token=abc123')).toBe('404 en /auth/verificar');
  });

  it('sustituye los UUID para que el mismo fallo agrupe', () => {
    const uno = redact('no se encontró 3f2504e0-4f89-11d3-9a0c-0305e82c3301');
    const otro = redact('no se encontró 7b1e4a02-1234-11d3-9a0c-0305e82c3399');

    // Que los dos den lo mismo es justo lo que hace posible deduplicar.
    expect(uno).toBe(otro);
    expect(uno).toBe('no se encontró «id»');
  });

  it('tapa cadenas hexadecimales largas: hashes y tokens de recuperación', () => {
    expect(redact('token 0123456789abcdef0123456789abcdef inválido')).toBe('token «id» inválido');
  });

  it('recorta lo que se pase de largo', () => {
    const largo = redact('x'.repeat(500));

    expect(largo.length).toBeLessThanOrEqual(201);
    expect(largo.endsWith('…')).toBe(true);
  });
});
