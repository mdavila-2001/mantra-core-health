import type { ResponseVisible } from '../specialty-form-block/form-reading';
import {
  motivosDeLaRespuesta,
  resumenDelPresuntivo,
  TOPE_DEL_CAMPO,
  TOPE_DEL_RESUMEN,
  TOPE_DEL_VALOR,
} from './presuntivo-del-formulario';

const respuesta = (etiqueta: string, texto: string, masked = false): ResponseVisible => ({
  id: `${etiqueta}-${texto}`,
  etiqueta,
  texto,
  masked,
});

/**
 * Lo que se trae de un formulario ya llenado tiene que **entrar** en los topes
 * de la nota de la API (campo 60, valor 500, sin duplicados) y no copiar nunca
 * lo que el formulario protege.
 */
describe('motivosDeLaRespuesta', () => {
  it('copia etiqueta y texto, en orden, recortando espacios', () => {
    const { entradas, protegidas, recortadas } = motivosDeLaRespuesta([
      respuesta('  Motivo ', '  Tos  '),
      respuesta('Dolor', 'Torácico'),
    ]);

    expect(entradas).toEqual([
      { label: 'Motivo', value: 'Tos' },
      { label: 'Dolor', value: 'Torácico' },
    ]);
    expect(protegidas).toBe(0);
    expect(recortadas).toBe(0);
  });

  it('NUNCA copia una respuesta protegida, ni siquiera con texto', () => {
    const { entradas, protegidas } = motivosDeLaRespuesta([
      respuesta('Antecedente', 'dato que no debe viajar', true),
      respuesta('Motivo', 'Tos'),
    ]);

    expect(entradas).toEqual([{ label: 'Motivo', value: 'Tos' }]);
    expect(JSON.stringify(entradas)).not.toContain('no debe viajar');
    expect(protegidas).toBe(1);
  });

  it('omite las vacías: la API rechaza una fila sin valor', () => {
    expect(motivosDeLaRespuesta([respuesta('A', ''), respuesta('B', '   ')]).entradas).toEqual([]);
  });

  it('corta el valor al tope y lo cuenta; el que justo entra no se toca', () => {
    const justo = 'x'.repeat(TOPE_DEL_VALOR);
    const largo = 'y'.repeat(TOPE_DEL_VALOR + 1);
    const { entradas, recortadas } = motivosDeLaRespuesta([
      respuesta('Justo', justo),
      respuesta('Largo', largo),
    ]);

    expect(entradas[0]?.value).toBe(justo);
    expect(entradas[1]?.value).toHaveLength(TOPE_DEL_VALOR);
    expect(entradas[1]?.value.endsWith('…')).toBe(true);
    expect(recortadas).toBe(1);
  });

  it('corta el campo al tope', () => {
    const { entradas } = motivosDeLaRespuesta([respuesta('c'.repeat(TOPE_DEL_CAMPO + 20), 'v')]);

    expect(entradas[0]?.label).toHaveLength(TOPE_DEL_CAMPO);
  });

  it('dos preguntas con el mismo nombre no son el mismo campo: la segunda sale «(2)», sin tildes ni mayúsculas que las confundan', () => {
    const { entradas } = motivosDeLaRespuesta([
      respuesta('Presión arterial', '120/80'),
      respuesta('PRESION ARTERIAL', '130/85'),
      respuesta('presión arterial', '110/70'),
    ]);

    expect(entradas.map((e) => e.label)).toEqual([
      'Presión arterial',
      'PRESION ARTERIAL (2)',
      'presión arterial (3)',
    ]);
  });

  it('el sufijo de un nombre largo sigue entrando en el tope del campo', () => {
    const largo = 'n'.repeat(TOPE_DEL_CAMPO + 5);
    const { entradas } = motivosDeLaRespuesta([respuesta(largo, 'a'), respuesta(largo, 'b')]);

    expect(entradas).toHaveLength(2);
    expect(entradas[1]?.label.length).toBeLessThanOrEqual(TOPE_DEL_CAMPO);
    expect(entradas[1]?.label.endsWith(' (2)')).toBe(true);
    expect(entradas[0]?.label).not.toBe(entradas[1]?.label);
  });

  it('una etiqueta vacía no deja una fila sin campo', () => {
    expect(motivosDeLaRespuesta([respuesta('   ', 'v')]).entradas[0]?.label).toBe(
      'Campo del formulario',
    );
  });
});

describe('resumenDelPresuntivo', () => {
  const origen = { id: 'i-1', nombre: 'Ficha base', fecha: '30 oct, 10:30' };

  it('sin nada que decir no manda `noteText`', () => {
    expect(resumenDelPresuntivo('  ', null, [])).toBeUndefined();
  });

  it('une hallazgos, formulario de origen y motivos, en ese orden', () => {
    expect(
      resumenDelPresuntivo('Cuadro febril', origen, [
        { label: 'Fiebre', value: '39 °C' },
        { label: 'Tos', value: 'Productiva' },
      ]),
    ).toBe(
      'Cuadro febril\nDel formulario «Ficha base» (30 oct, 10:30).\nMotivos: Fiebre: 39 °C; Tos: Productiva',
    );
  });

  it('sin fecha no deja paréntesis vacíos', () => {
    expect(resumenDelPresuntivo('', { ...origen, fecha: '' }, [])).toBe(
      'Del formulario «Ficha base».',
    );
  });

  it('se acota: el detalle vive en la nota estructurada', () => {
    const texto = resumenDelPresuntivo('h'.repeat(TOPE_DEL_RESUMEN + 50), null, []);

    expect(texto).toHaveLength(TOPE_DEL_RESUMEN);
    expect(texto?.endsWith('…')).toBe(true);
  });
});
