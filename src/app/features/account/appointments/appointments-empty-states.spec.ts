import {
  VACIO_ELEGIR_AGENDA,
  VACIO_ELEGIR_LABORATORIO,
  VACIO_SIN_CITAS,
  VACIO_SIN_HORARIOS,
  vacioSinHorariosDeServicio,
} from './appointments-empty-states';

describe('appointments-empty-states', () => {
  const todos = [
    VACIO_ELEGIR_AGENDA,
    VACIO_ELEGIR_LABORATORIO,
    VACIO_SIN_CITAS,
    VACIO_SIN_HORARIOS,
    vacioSinHorariosDeServicio('Ecocardiograma Doppler'),
  ];

  it('todo vacío es S3, con próxima acción, mensaje y título propios', () => {
    for (const vacio of todos) {
      expect(vacio.status).toBe('empty');
      expect(vacio.nextAction.label).not.toBe('');
      expect(vacio.message).toBeTruthy();
      expect(vacio.title).toBeTruthy();
    }
  });

  it('cada título nombra una situación distinta', () => {
    const titulos = todos.map((vacio) => vacio.title);

    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it('los vacíos de elegir agenda no mandan a otra ruta: el control ya está en la vista', () => {
    expect(VACIO_ELEGIR_AGENDA.nextAction.route).toBeUndefined();
    expect(VACIO_ELEGIR_LABORATORIO.nextAction).toEqual(VACIO_ELEGIR_AGENDA.nextAction);
  });

  it('el vacío del servicio lo nombra', () => {
    const vacio = vacioSinHorariosDeServicio('Ecocardiograma Doppler');

    expect(vacio.message).toContain('Ecocardiograma Doppler');
  });
});
