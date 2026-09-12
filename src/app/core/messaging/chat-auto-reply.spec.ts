import { TestBed } from '@angular/core/testing';

import {
  ChatAutoReply,
  CONFIGURACION_POR_DEFECTO,
  MINUTOS_MAXIMO,
} from './chat-auto-reply';

/**
 * Lo que estas pruebas fijan.
 *
 * La regla entera: **inactividad + descanso por persona + franja horaria**, y
 * que apagada no conteste nunca. Son las tres condiciones que el propietario
 * pidió configurables, y la única forma de saber que la combinación de las tres
 * se evalúa como corresponde es probarlas juntas.
 *
 * También que **sin actividad anotada no se supone ausencia**: la primera vez
 * que alguien abre la aplicación en un navegador no hay nada guardado, y
 * contestar solo ahí sería contestarle a quien está mirando la pantalla.
 */
describe('ChatAutoReply', () => {
  let servicio: ChatAutoReply;

  const AHORA = new Date('2026-09-11T20:00:00').getTime();
  const MINUTO = 60_000;
  const HORA = 3_600_000;

  /**
   * El instante en que se planta el reloj, y por qué tan temprano.
   *
   * `marcarActividad()` anota `Date.now()`, así que sin plantar el reloj las
   * pruebas de franja horaria dependían de **a qué hora del día se corrieran**:
   * la de «no contesta dentro del horario» sondea las 21:00 y pasaba sólo
   * mientras la máquina fuera antes de esa hora. Corrida a las 21:52 la
   * actividad quedaba *después* del sondeo, la resta daba negativo y el
   * servicio contestaba que no correspondía —por inactividad, no por la
   * franja—, que es la clase de rojo que aparece una vez y nadie sabe explicar.
   *
   * Las 07:00 dejan por delante todos los sondeos de este archivo —mediodía,
   * 21:00, 23:00 y la madrugada siguiente— sin tocar ninguna franja declarada.
   */
  const RELOJ_PLANTADO = new Date('2026-09-11T07:00:00');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(RELOJ_PLANTADO);
    localStorage.clear();
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(ChatAutoReply);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('arranca apagada: nadie recibe respuestas sin pedirlo', () => {
    expect(servicio.configuracion()).toEqual(CONFIGURACION_POR_DEFECTO);
    expect(servicio.configuracion().activa).toBe(false);
  });

  it('apagada no contesta, por más ausente que estés', () => {
    servicio.marcarActividad();
    expect(servicio.corresponde(AHORA + 10 * HORA, null)).toBe(false);
  });

  it('encendida contesta recién pasada la espera configurada', () => {
    servicio.guardar({ activa: true, minutosDeInactividad: 30 });
    servicio.marcarActividad();
    const desde = servicio.ultimaActividad()!;

    expect(servicio.corresponde(desde + 29 * MINUTO, null)).toBe(false);
    expect(servicio.corresponde(desde + 31 * MINUTO, null)).toBe(true);
  });

  it('sin actividad anotada no supone ausencia', () => {
    servicio.guardar({ activa: true, minutosDeInactividad: 1 });
    // Nada en el almacenamiento: es la primera vez que se abre acá.
    expect(servicio.ultimaActividad()).toBeNull();
    expect(servicio.corresponde(AHORA, null)).toBe(false);
  });

  it('no le repite a la misma persona antes del descanso', () => {
    servicio.guardar({ activa: true, minutosDeInactividad: 1, horasEntreAvisos: 4 });
    servicio.marcarActividad();
    const desde = servicio.ultimaActividad()!;
    const luego = desde + 60 * MINUTO;

    expect(servicio.corresponde(luego, null)).toBe(true);
    // Ya se le avisó hace una hora: todavía no.
    expect(servicio.corresponde(luego, luego - HORA)).toBe(false);
    // Pasadas las cuatro, sí.
    expect(servicio.corresponde(luego, luego - 5 * HORA)).toBe(true);
  });

  it('con la franja encendida no contesta dentro del horario de atención', () => {
    servicio.guardar({
      activa: true,
      minutosDeInactividad: 1,
      soloFueraDeHorario: true,
      horarioDesde: '08:00',
      horarioHasta: '18:00',
    });
    servicio.marcarActividad();

    const alMediodia = new Date('2026-09-11T12:00:00').getTime();
    const aLaNoche = new Date('2026-09-11T21:00:00').getTime();

    expect(servicio.corresponde(alMediodia, null)).toBe(false);
    expect(servicio.corresponde(aLaNoche, null)).toBe(true);
  });

  it('una franja que cruza la medianoche es la de quien atiende de noche', () => {
    servicio.guardar({
      activa: true,
      minutosDeInactividad: 1,
      soloFueraDeHorario: true,
      horarioDesde: '22:00',
      horarioHasta: '06:00',
    });
    servicio.marcarActividad();

    // 23:00 está dentro de la franja 22→06: no contesta.
    expect(servicio.corresponde(new Date('2026-09-11T23:00:00').getTime(), null)).toBe(
      false,
    );
    // 02:00 también está dentro, del otro lado de la medianoche.
    expect(servicio.corresponde(new Date('2026-09-12T02:00:00').getTime(), null)).toBe(
      false,
    );
    // 12:00 está fuera: contesta.
    expect(servicio.corresponde(new Date('2026-09-12T12:00:00').getTime(), null)).toBe(
      true,
    );
  });

  it('acota los valores fuera de rango en vez de aceptarlos', () => {
    servicio.guardar({ minutosDeInactividad: 0, horasEntreAvisos: 9999 });

    expect(servicio.configuracion().minutosDeInactividad).toBe(1);
    expect(servicio.configuracion().horasEntreAvisos).toBe(168);

    servicio.guardar({ minutosDeInactividad: 999_999 });
    expect(servicio.configuracion().minutosDeInactividad).toBe(MINUTOS_MAXIMO);
  });

  it('un texto vacío no puede dejar la respuesta encendida y muda', () => {
    servicio.guardar({ activa: true, texto: '   ' });

    expect(servicio.configuracion().activa).toBe(false);
    expect(servicio.configuracion().texto).not.toBe('');
  });

  it('lo guardado sobrevive a una sesión nueva', () => {
    servicio.guardar({ activa: true, minutosDeInactividad: 45, texto: 'Vuelvo a las 18.' });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const otro = TestBed.inject(ChatAutoReply);

    expect(otro.configuracion().minutosDeInactividad).toBe(45);
    expect(otro.configuracion().texto).toBe('Vuelvo a las 18.');
  });

  it('un valor corrupto en el almacenamiento no deja a nadie sin chat', () => {
    localStorage.setItem('alovida.chat-respuesta-automatica', '{no es json');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const otro = TestBed.inject(ChatAutoReply);

    expect(otro.configuracion()).toEqual(CONFIGURACION_POR_DEFECTO);
  });
});
