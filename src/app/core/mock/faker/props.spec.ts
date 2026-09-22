import { generarEntrada, generarEntradas, valorParaEntrada, type EntradaAGenerar } from './props';

/**
 * El generador de valores del stock distingue «lo llené cumpliendo el tipo» de
 * «no sé llenarlo y puse algo para que monte». Lo segundo no acredita el
 * contrato del componente: el banco lo muestra como «sin verificar».
 */

const entrada = (nombre: string, tipo: string, requerido = false): EntradaAGenerar => ({ nombre, tipo, requerido });

describe('generarEntrada: la procedencia del valor', () => {
  it('una rama de la unión cumple el tipo', () => {
    const r = generarEntrada(entrada('size', "'sm' | 'md' | 'lg'"), 's');
    expect(['sm', 'md', 'lg']).toContain(r.valor);
    expect(r.procedencia).toBe('del-tipo');
    expect(r.motivo).toBeNull();
  });

  it('un texto elegido por el nombre vale si el tipo admite texto', () => {
    expect(generarEntrada(entrada('heading', 'string'), 's').procedencia).toBe('del-tipo');
    expect(generarEntrada(entrada('heading', 'string | null'), 's').procedencia).toBe('del-tipo');
  });

  it('el mismo texto NO vale si el tipo no lo admite: queda sin verificar y lo dice', () => {
    const r = generarEntrada(entrada('heading', 'SafeHtml'), 's');
    expect(r.procedencia).toBe('sin-verificar');
    expect(r.motivo).toContain('«SafeHtml»');
    expect(r.motivo).toContain('«heading»');
  });

  it('el `[]` de un arreglo de objetos desconocidos ya no se presenta como escenario', () => {
    const r = generarEntrada(entrada('coverages', 'readonly InsuranceCoverage[]', true), 's');
    expect(r.valor).toEqual([]);
    expect(r.procedencia).toBe('sin-verificar');
    expect(r.motivo).toBe('arreglo de «InsuranceCoverage»: no sé construir un elemento válido, se pasó [] (vacío)');
  });

  it("el `''` de una obligatoria de tipo desconocido tampoco", () => {
    const r = generarEntrada(entrada('row', 'PatientRow', true), 's');
    expect(r.valor).toBe('');
    expect(r.procedencia).toBe('sin-verificar');
    expect(r.motivo).toContain('obligatoria de tipo «PatientRow»');
  });

  it('una opcional que no sabe llenar queda por omisión: no se pasa nada', () => {
    const r = generarEntrada(entrada('row', 'PatientRow'), 's');
    expect(r.valor).toBeUndefined();
    expect(r.procedencia).toBe('por-omision');
  });

  it('un alias sin resolver con nombre de texto recibe texto, pero sin verificar', () => {
    const r = generarEntrada(entrada('value', 'BadgeValue'), 's');
    expect(typeof r.valor).toBe('string');
    expect(r.procedencia).toBe('sin-verificar');
  });

  it('una fecha declarada como `Date` recibe una fecha aunque el nombre no lo diga', () => {
    const r = generarEntrada(entrada('dia', 'Date', true), 's');
    expect(r.valor).toBeInstanceOf(Date);
    expect(r.procedencia).toBe('del-tipo');
  });

  it('`valorParaEntrada` sigue devolviendo sólo el valor, igual que antes', () => {
    const e = entrada('size', "'sm' | 'md' | 'lg'");
    expect(valorParaEntrada(e, 's')).toBe(generarEntrada(e, 's').valor);
  });
});

describe('generarEntradas: el componente entero', () => {
  it('junta valores, procedencias y lo que quedó sin verificar, nombrado', () => {
    const r = generarEntradas(
      [
        entrada('label', 'string', true),
        entrada('items', 'readonly MenuItem[]', true),
        entrada('extra', 'Foo'),
      ],
      'componente-0',
    );

    expect(Object.keys(r.valores)).toEqual(['label', 'items']);
    expect(r.procedencias['label']?.procedencia).toBe('del-tipo');
    expect(r.procedencias['extra']?.procedencia).toBe('por-omision');
    expect(r.sinVerificar).toEqual([
      { nombre: 'items', motivo: 'arreglo de «MenuItem»: no sé construir un elemento válido, se pasó [] (vacío)' },
    ]);
  });

  it('es determinista: la misma semilla da lo mismo', () => {
    const entradas = [entrada('heading', 'string'), entrada('count', 'number')];
    expect(generarEntradas(entradas, 'x').valores).toEqual(generarEntradas(entradas, 'x').valores);
  });
});
