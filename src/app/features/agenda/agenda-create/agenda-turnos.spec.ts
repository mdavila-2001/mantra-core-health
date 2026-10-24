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
    expect(r.porDia[0].turnos[0]).toEqual({ desde: '09:00', hasta: '09:30', minutos: 30 });
    expect(r.porDia[0].turnos[7]).toEqual({ desde: '12:30', hasta: '13:00', minutos: 30 });
  });

  /*
   * Redondeo hacia adelante (propietario, 04/10/2026): «los slots tienen que
   * permitir completar el slot por más que se pase de la hora máxima, para no
   * perjudicar al doctor porque cada hora cuesta dinero». Misma regla que
   * `generate-slots` en la API.
   */
  it('completa el último turno aunque pase la hora de fin, igual que el backend', () => {
    // 420 minutos / 90 = 4,67: antes salían 4 y se perdía la última hora.
    // Ahora el quinto empieza 15:00 —dentro de la franja— y se completa.
    const r = calcularTurnos([franja('09:00', '16:00', 90)]);

    expect(r.total).toBe(5);
    expect(r.porDia[0].turnos[4]).toEqual({ desde: '15:00', hasta: '16:30', minutos: 90 });
    expect(r.porDia[0].resto).toBe(0);
    expect(r.porDia[0].restoDesde).toBeNull();
  });

  it('el turno completado no pisa la franja siguiente del día (el tope)', () => {
    // Mañana 08:00–10:00 de 45' con la tarde desde las 10:00: el tercero
    // (09:30–10:15) pisaría la tarde, así que no sale.
    const r = calcularTurnos([{ ...franja('08:00', '10:00', 45), tope: '10:00' }]);

    expect(r.total).toBe(2);
    expect(r.porDia[0].turnos.map((t) => t.hasta)).toEqual(['08:45', '09:30']);
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

  it('una franja más corta que la duración da un turno, completo', () => {
    const r = calcularTurnos([franja('09:00', '09:20', 30)]);

    expect(r.total).toBe(1);
    expect(r.porDia[0].turnos[0]).toEqual({ desde: '09:00', hasta: '09:30', minutos: 30 });
    expect(r.porDia[0].resto).toBe(0);
  });

  it('sin franjas el total es cero', () => {
    expect(calcularTurnos([])).toEqual({ porDia: [], total: 0 });
  });

  it('acepta la hora con segundos, como la manda el contrato', () => {
    expect(calcularTurnos([franja('09:00:00', '11:00:00', 60)]).total).toBe(2);
  });

  /**
   * El receso — AG-4.
   *
   * El respiro entre consultas entra en la misma aritmética: el paso es
   * `duración + receso`, cada turno sigue midiendo su duración real, y el
   * último no necesita respiro después. La igualdad que gobierna: receso 0 (o
   * ausente) tiene que dar EXACTAMENTE lo de hoy, byte a byte.
   */
  describe('con receso', () => {
    function conReceso(desde: string, hasta: string, duracion: number, receso: number) {
      return { dia: 'lunes', desde, hasta, duracion, receso };
    }

    it('receso 0 ≡ receso ausente ≡ hoy', () => {
      const hoy = calcularTurnos([franja('09:00', '16:00', 90)]);
      const cero = calcularTurnos([conReceso('09:00', '16:00', 90, 0)]);

      expect(cero).toEqual(hoy);
    });

    it('el paso es duración + receso y los turnos miden su duración real', () => {
      // El caso del prompt: 9:00–12:00, consulta 20, respiro 10 → seis turnos
      // que empiezan cada media hora pero duran veinte minutos.
      const r = calcularTurnos([conReceso('09:00', '12:00', 20, 10)]);

      expect(r.total).toBe(6);
      expect(r.porDia[0].turnos[0]).toEqual({ desde: '09:00', hasta: '09:20', minutos: 20 });
      expect(r.porDia[0].turnos[1]).toEqual({ desde: '09:30', hasta: '09:50', minutos: 20 });
      expect(r.porDia[0].turnos[5]).toEqual({ desde: '11:30', hasta: '11:50', minutos: 20 });
    });

    it('todo turno que empieza dentro de la franja se completa, con respiro o sin él', () => {
      // 9:00–10:00, consulta 30, respiro 15: el segundo empieza 9:45 —dentro—
      // y se completa hasta 10:15. El tercero empezaría 10:30: ya fuera.
      expect(calcularTurnos([conReceso('09:00', '10:00', 30, 15)]).total).toBe(2);
      expect(calcularTurnos([conReceso('09:00', '10:15', 30, 15)]).total).toBe(2);
    });

    it('con receso, una franja corta igual da su turno completo', () => {
      const r = calcularTurnos([conReceso('09:00', '09:20', 30, 10)]);

      expect(r.total).toBe(1);
      expect(r.porDia[0].resto).toBe(0);
    });

    it('el resto se mide desde el fin del último turno, no desde su respiro', () => {
      // 9:00–11:00, consulta 45, respiro 15: entran 9:00–9:45 y 10:00–10:45.
      // Sobra desde las 10:45 —el fin de la consulta—, quince minutos.
      const r = calcularTurnos([conReceso('09:00', '11:00', 45, 15)]);

      expect(r.total).toBe(2);
      expect(r.porDia[0].resto).toBe(15);
      expect(r.porDia[0].restoDesde).toBe('10:45');
    });

    it('un receso negativo se trata como 0, no revienta ni superpone turnos', () => {
      // Alcanzable mientras se tipea. Con receso negativo el paso sería menor
      // que la duración y los turnos se pisarían entre sí.
      const conNegativo = calcularTurnos([conReceso('09:00', '13:00', 30, -10)]);
      const sinReceso = calcularTurnos([franja('09:00', '13:00', 30)]);

      expect(conNegativo).toEqual(sinReceso);
    });
  });
});
