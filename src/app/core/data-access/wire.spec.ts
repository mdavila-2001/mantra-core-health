import { maybeDate, maybeDateOnly, sinNulos } from './wire';

/**
 * Estas funciones existen porque el mismo defecto apareció en dos clientes, y
 * lo que fijan es la **forma real** del servidor —verificada contra la API viva
 * el 2026-08-08—, no la que uno supondría leyendo los DTOs.
 */
describe('conversión del transporte', () => {
  describe('sinNulos', () => {
    it('quita la clave, no la deja en undefined', () => {
      const limpio = sinNulos<{ a: string; b?: string }>({ a: 'hola', b: null });

      // `'b' in objeto` tiene que decir lo mismo que el tipo: si es opcional y
      // no vino, no está.
      expect('b' in limpio).toBe(false);
      expect(limpio.a).toBe('hola');
    });

    it('conserva los valores falsos que sí son datos', () => {
      const limpio = sinNulos<{ cero: number; vacio: string; no: boolean }>({
        cero: 0,
        vacio: '',
        no: false,
      });

      // Filtrar por «falsy» habría borrado los tres. Solo `null` es ausencia.
      expect(limpio).toEqual({ cero: 0, vacio: '', no: false });
    });

    it('deja pasar los arrays sin tocarlos', () => {
      const limpio = sinNulos<{ items: readonly string[] }>({ items: [] });

      expect(limpio.items).toEqual([]);
    });
  });

  describe('maybeDate', () => {
    /**
     * El motivo de existir: `new Date(null)` es 1970-01-01, no `Invalid Date`.
     * Con `=== undefined` una fecha ausente se convertía en el 1 de enero
     * de 1970 — y peor, en un valor **verdadero** que las plantillas pintaban.
     */
    it('un `null` es ausencia, no 1970', () => {
      expect(maybeDate(null)).toBeUndefined();
    });

    it('un ausente también', () => {
      expect(maybeDate(undefined)).toBeUndefined();
      expect(maybeDate()).toBeUndefined();
    });

    it('un instante conserva su hora: ahí el momento ES el dato', () => {
      expect(maybeDate('2026-01-02T10:30:00.000Z')?.toISOString()).toBe(
        '2026-01-02T10:30:00.000Z',
      );
    });
  });

  describe('maybeDateOnly', () => {
    /**
     * El servidor serializa un `format: 'date'` como instante en medianoche
     * UTC. Pintado en hora local, al oeste de Greenwich retrocede un día:
     * verificado desde `America/La_Paz` (UTC−4), `1985-03-14` se veía como
     * 13/03/1985.
     */
    it('una fecha en UTC no retrocede un día', () => {
      const fecha = maybeDateOnly('1985-03-14T00:00:00.000Z');

      // Se comprueban los componentes **locales**, que es lo que se pinta.
      expect(fecha?.getFullYear()).toBe(1985);
      expect(fecha?.getMonth()).toBe(2);
      expect(fecha?.getDate()).toBe(14);
    });

    it('acepta la forma sin hora, que es la que el contrato declara', () => {
      expect(maybeDateOnly('1985-03-14')?.getDate()).toBe(14);
    });

    it('un `null` es ausencia', () => {
      expect(maybeDateOnly(null)).toBeUndefined();
    });

    it('un texto que no es una fecha no produce una fecha inválida', () => {
      // Devolver `undefined` deja distinguir «no hay dato» de «hay uno roto»;
      // una `Invalid Date` se cuela en las plantillas como valor verdadero.
      expect(maybeDateOnly('no-es-una-fecha')).toBeUndefined();
    });
  });
});
