import { calcularTurnos } from './agenda-turnos';

/**
 * La aritmética de la vista previa — MAC-3.
 *
 * El caso que gobierna todo el archivo es el del **resto**: verificado contra
 * la API viva el 20/08, una franja de 9:00 a 16:00 con turnos de 90 minutos
 * genera **cuatro** cupos y deja libre de 15:00 a 16:00. Si esta función
 * redondeara para arriba, la pantalla prometería un turno que después no
 * existe.
 */
describe('calcularTurnos', () => {
  function franja(desde: string, hasta: string, duracion: number, dia = 'lunes') {
    return { dia, desde, hasta, duracion };
  }

  it('divide una franja exacta sin dejar resto', () => {
    const r = calcularTurnos([franja('09:00', '13:00', 30)]);

    expect(r.total).toBe(8);
    expect(r.porDia[0].resto).toBe(0);
    expect(r.porDia[0].restoDesde).toBeNull();
    expect(r.porDia[0].turnos[0]).toEqual({ desde: '09:00', hasta: '09:30' });
    expect(r.porDia[0].turnos[7]).toEqual({ desde: '12:30', hasta: '13:00' });
  });

  it('trunca cuando el último turno no entra, igual que el backend', () => {
    // 420 minutos / 90 = 4,67. El backend emite CUATRO, no cinco: verificado
    // contra la API viva, el último va de 13:30 a 15:00.
    const r = calcularTurnos([franja('09:00', '16:00', 90)]);

    expect(r.total).toBe(4);
    expect(r.porDia[0].turnos[3]).toEqual({ desde: '13:30', hasta: '15:00' });
    expect(r.porDia[0].resto).toBe(60);
    expect(r.porDia[0].restoDesde).toBe('15:00');
  });

  it('suma los días y los conserva por separado', () => {
    const r = calcularTurnos([
      franja('09:00', '13:00', 30, 'lunes'),
      franja('14:00', '18:00', 60, 'jueves'),
    ]);

    expect(r.total).toBe(12);
    expect(r.porDia.map((d) => [d.dia, d.turnos.length])).toEqual([
      ['lunes', 8],
      ['jueves', 4],
    ]);
  });

  it('una franja al revés no produce turnos ni revienta', () => {
    // Alcanzable mientras se escribe la hora: el formulario ya la marca
    // inválida, la vista previa sólo tiene que no mentir ni romperse.
    const r = calcularTurnos([franja('18:00', '09:00', 30)]);

    expect(r.total).toBe(0);
    expect(r.porDia[0].turnos).toEqual([]);
  });

  it('una hora ilegible no produce turnos', () => {
    expect(calcularTurnos([franja('', '13:00', 30)]).total).toBe(0);
    expect(calcularTurnos([franja('99:99', '13:00', 30)]).total).toBe(0);
  });

  it('una duración de cero o negativa no divide por cero', () => {
    expect(calcularTurnos([franja('09:00', '13:00', 0)]).total).toBe(0);
    expect(calcularTurnos([franja('09:00', '13:00', -30)]).total).toBe(0);
  });

  it('una franja más corta que la duración da cero turnos y el resto entero', () => {
    const r = calcularTurnos([franja('09:00', '09:20', 30)]);

    expect(r.total).toBe(0);
    expect(r.porDia[0].resto).toBe(20);
    expect(r.porDia[0].restoDesde).toBe('09:00');
  });

  it('sin franjas el total es cero', () => {
    expect(calcularTurnos([])).toEqual({ porDia: [], total: 0 });
  });

  it('acepta la hora con segundos, como la manda el contrato', () => {
    expect(calcularTurnos([franja('09:00:00', '11:00:00', 60)]).total).toBe(2);
  });
});
