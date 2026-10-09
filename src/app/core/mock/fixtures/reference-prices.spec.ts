import { FONASA_CONVERSION, FONASA_IMAGEN, FONASA_LABORATORIO } from './fonasa-tariffs.generated';
import { TARIFA_INLASA } from './inlasa';
import { PRUEBAS_DEL_CORPUS } from './bolivia-central-axis.generated';
import {
  TEST_EQUIVALENCE,
  EQUIVALENCE_IMAGE_FONASA,
  FEE_FONASA,
  imagePrice,
  testPrice,
} from './reference-prices';

describe('precios de referencia de laboratorio e imagen', () => {
  it('cada equivalencia apunta a una prueba del corpus y resuelve a un precio', () => {
    const pruebas = new Set(PRUEBAS_DEL_CORPUS.map((p) => p.id));
    for (const testId of Object.keys(TEST_EQUIVALENCE)) {
      expect(pruebas.has(testId), testId).toBe(true);
      expect(testPrice(testId)?.amount, testId).toMatch(/^\d+\.\d{2}$/);
    }
    expect(Object.keys(TEST_EQUIVALENCE).length).toBeGreaterThan(240);
  });

  it('INLASA va primero: el hemograma lleva su precio boliviano, no el de FONASA', () => {
    expect(testPrice('test_000001')).toEqual({ amount: '60.00', scheduleCode: TARIFA_INLASA });
  });

  it('FONASA se convierte con los tipos de cambio oficiales del 01/10/2026', () => {
    expect(FONASA_CONVERSION.clpPorUsd).toBe(972.6);
    expect(FONASA_CONVERSION.bobPorUsd).toBe(12);
    // Hemoglobina: 03-01-038, y la radiografía de tórax: 19 930 CLP → Bs 245,90.
    const hemoglobina = FONASA_LABORATORIO.find((p) => p.code === '03-01-038')!;
    expect(testPrice('test_000002')).toEqual({ amount: hemoglobina.priceBs, scheduleCode: FEE_FONASA });
    const torax = FONASA_IMAGEN.find((p) => p.code === '04-01-070')!;
    expect(torax.valueClp).toBe(19930);
    expect(torax.priceBs).toBe('245.90');
  });

  it('una prueba sin equivalente queda sin precio, no con uno adivinado', () => {
    // Calcio iónico: FONASA sólo tiene el calcio total, que es otra prueba.
    expect(testPrice('test_000099')).toBeNull();
  });

  it('los estudios de imagen con equivalente llevan precio; densitometría y ECG no', () => {
    for (const code of Object.keys(EQUIVALENCE_IMAGE_FONASA)) {
      expect(imagePrice(code)?.scheduleCode, code).toBe(FEE_FONASA);
    }
    expect(imagePrice('STUDY-DENSITOMETRIA')).toBeNull();
    expect(imagePrice('STUDY-ECG')).toBeNull();
  });
});
