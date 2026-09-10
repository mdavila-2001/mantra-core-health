import {
  DOCUMENTOS_DE_EJEMPLO,
  EMPRESA_DE_EJEMPLO,
  GENTE_DE_EJEMPLO,
  NOTA_DE_DATOS_DE_EJEMPLO,
} from './pharmacy-profile.fixtures';
import { TIPOS_DE_SOCIEDAD } from './pharmacy-profile.types';
import { varianteDeVencimiento } from '../../../shared/utils/vencimiento/vencimiento';

/**
 * Lo que se le exige a un dato de ejemplo: que sea coherente consigo mismo, que
 * no dependa del reloj de quien mira y que no filtre nada técnico. Sin esto,
 * una maqueta se convierte en una pantalla que dice cosas distintas cada día.
 */
describe('datos de ejemplo de la ficha de la farmacia', () => {
  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const DIA = 24 * 60 * 60 * 1000;

  /** El «hoy» del que cuelgan las fechas, reconstruido desde el primer papel. */
  const HOY_DERIVADO =
    DOCUMENTOS_DE_EJEMPLO[0].venceEl.getTime() - DOCUMENTOS_DE_EJEMPLO[0].diasParaVencer * DIA;

  describe('la empresa', () => {
    it('el tipo de sociedad es uno de los ocho de la lista cerrada', () => {
      expect(TIPOS_DE_SOCIEDAD).toContain(EMPRESA_DE_EJEMPLO.tipoDeSociedad);
    });

    it('el NIT es texto: es un identificador, no una cifra que se sume', () => {
      expect(typeof EMPRESA_DE_EJEMPLO.nit).toBe('string');
    });

    it('la central tiene punto en el mapa, que es lo que el mapa dibuja', () => {
      expect(EMPRESA_DE_EJEMPLO.puntoCentral).not.toBeNull();
    });
  });

  describe('los documentos', () => {
    it('son los seis papeles que el registro pide', () => {
      expect(DOCUMENTOS_DE_EJEMPLO).toHaveLength(6);
    });

    it('cada vencimiento concuerda con los días declarados', () => {
      // El «hoy» de la maqueta se reconstruye desde el primer documento, así
      // que esto compara los seis contra la MISMA referencia: si alguno se
      // escribiera con otra fecha, acá se ve.
      for (const documento of DOCUMENTOS_DE_EJEMPLO) {
        expect(documento.venceEl.getTime(), documento.clave).toBe(
          HOY_DERIVADO + documento.diasParaVencer * DIA,
        );
      }
    });

    it('ninguno vence antes de emitirse', () => {
      for (const documento of DOCUMENTOS_DE_EJEMPLO) {
        expect(documento.emitidoEl.getTime(), documento.clave).toBeLessThan(
          documento.venceEl.getTime(),
        );
      }
    });

    it('el «hoy» del que cuelgan las fechas es fijo, no el reloj de quien mira', () => {
      // Si alguien cambiara la referencia por `new Date()`, la pantalla diría
      // cosas distintas cada día y esta aserción se caería el primero.
      expect(new Date(HOY_DERIVADO).toISOString()).toBe('2026-09-10T12:00:00.000Z');
    });

    it('cubren los tres plazos que la ficha tiene que saber decir', () => {
      const tonos = new Set(
        DOCUMENTOS_DE_EJEMPLO.map((documento) => varianteDeVencimiento(documento.diasParaVencer)),
      );
      expect(tonos).toEqual(new Set(['error', 'warning', 'success']));
    });

    it('cubren los tres estados de verificación, incluido el pendiente', () => {
      const estados = new Set(DOCUMENTOS_DE_EJEMPLO.map((documento) => documento.verificacion));
      expect(estados).toEqual(new Set(['VERIFICADO', 'PENDIENTE', 'VENCIDO']));
    });

    it('la clave de cada fila es legible, nunca un identificador técnico', () => {
      for (const documento of DOCUMENTOS_DE_EJEMPLO) {
        expect(documento.clave).not.toMatch(UUID);
      }
    });

    it('todos traen su archivo en PDF, que es lo que el registro pide', () => {
      for (const documento of DOCUMENTOS_DE_EJEMPLO) {
        expect(documento.archivo, documento.clave).toMatch(/\.pdf$/);
      }
    });
  });

  describe('la gente', () => {
    it('son los tres gerentes que el registro nombra, en su orden', () => {
      expect(GENTE_DE_EJEMPLO.gerentes.map((gerente) => gerente.cargo)).toEqual([
        'Gerente General',
        'Gerente Comercial',
        'Gerente Marketing',
      ]);
    });

    it('cada gerente trae nombre, celular y correo', () => {
      for (const gerente of GENTE_DE_EJEMPLO.gerentes) {
        expect(gerente.nombre.length, gerente.cargo).toBeGreaterThan(0);
        expect(gerente.celular, gerente.cargo).not.toBeNull();
        expect(gerente.correo, gerente.cargo).toContain('@');
      }
    });

    it('el representante legal no declara celular: el registro no se lo pide', () => {
      expect(GENTE_DE_EJEMPLO.representante.celular).toBeNull();
      expect(GENTE_DE_EJEMPLO.representante.correo).toContain('@');
    });

    it('los celulares son texto: un prefijo no sobrevive a un número', () => {
      for (const gerente of GENTE_DE_EJEMPLO.gerentes) {
        expect(typeof gerente.celular, gerente.cargo).toBe('string');
      }
    });
  });

  it('el cartel de maqueta existe y dice qué es', () => {
    expect(NOTA_DE_DATOS_DE_EJEMPLO).toBe('Datos de ejemplo');
  });
});
