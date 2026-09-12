import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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

  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(RELOJ_PLANTADO);
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    servicio = TestBed.inject(ChatAutoReply);
  });

  afterEach(() => {
    http.match(() => true).forEach((pedido) => pedido.flush(null));
    http.verify();
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

  /* --- El servidor manda (F4.7) -------------------------------------------- */

  describe('sincronización con el servidor', () => {
    it('sin perfil público no sube nada: queda sólo en este navegador', () => {
      servicio.guardar({ activa: true }, null);

      expect(servicio.enElServidor()).toBe(false);
      http.expectNone(() => true);
    });

    it('con perfil sube lo configurado', () => {
      servicio.guardar({ activa: true, minutosDeInactividad: 15 }, 'pp-1');

      const pedido = http.expectOne('/community/profiles/pp-1/auto-reply');
      expect(pedido.request.method).toBe('PUT');
      expect(pedido.request.body).toMatchObject({
        isActive: true,
        inactivityMinutes: 15,
      });
      pedido.flush({
        id: 'ar-1',
        publicProfileId: 'pp-1',
        isActive: true,
        inactivityMinutes: 15,
        bodyText: 'Vuelvo luego.',
        cooldownHours: 4,
        onlyOutsideBusinessHours: false,
        businessHoursFrom: null,
        businessHoursTo: null,
        updatedAt: '2026-09-11T10:00:00.000Z',
      });

      // Y ahora la pantalla puede prometer que contesta con la app cerrada.
      expect(servicio.enElServidor()).toBe(true);
    });

    it('lo del servidor gana sobre la copia local', () => {
      // Se configuró en otro dispositivo: lo que vale es eso.
      servicio.guardar({ minutosDeInactividad: 5 }, null);

      servicio.cargar('pp-1');
      http.expectOne('/community/profiles/pp-1/auto-reply').flush({
        id: 'ar-1',
        publicProfileId: 'pp-1',
        isActive: true,
        inactivityMinutes: 90,
        bodyText: 'Estoy en quirófano.',
        cooldownHours: 8,
        onlyOutsideBusinessHours: true,
        businessHoursFrom: '07:00:00',
        businessHoursTo: '15:00:00',
        updatedAt: '2026-09-11T10:00:00.000Z',
      });

      expect(servicio.configuracion().minutosDeInactividad).toBe(90);
      expect(servicio.configuracion().texto).toBe('Estoy en quirófano.');
      // Postgres devuelve `time` con segundos; la pantalla usa `HH:MM`.
      expect(servicio.configuracion().horarioDesde).toBe('07:00');
    });

    it('si el servidor no la tiene y acá sí, se sube en vez de perderse', () => {
      servicio.guardar({ activa: true, texto: 'De antes de la tabla.' }, null);

      servicio.cargar('pp-1');
      http.expectOne('/community/profiles/pp-1/auto-reply').flush(null);

      const subida = http.expectOne('/community/profiles/pp-1/auto-reply');
      expect(subida.request.method).toBe('PUT');
      expect(subida.request.body).toMatchObject({
        bodyText: 'De antes de la tabla.',
      });
      subida.flush({
        id: 'ar-1',
        publicProfileId: 'pp-1',
        isActive: true,
        inactivityMinutes: 30,
        bodyText: 'De antes de la tabla.',
        cooldownHours: 4,
        onlyOutsideBusinessHours: false,
        businessHoursFrom: null,
        businessHoursTo: null,
        updatedAt: '2026-09-11T10:00:00.000Z',
      });
    });

    it('si la lectura falla, lo local sigue valiendo y la pantalla no promete de más', () => {
      servicio.guardar({ activa: true }, null);

      servicio.cargar('pp-1');
      http
        .expectOne('/community/profiles/pp-1/auto-reply')
        .error(new ProgressEvent('error'));

      expect(servicio.configuracion().activa).toBe(true);
      expect(servicio.enElServidor()).toBe(false);
    });
  });

  it('un valor corrupto en el almacenamiento no deja a nadie sin chat', () => {
    localStorage.setItem('alovida.chat-respuesta-automatica', '{no es json');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const otro = TestBed.inject(ChatAutoReply);

    expect(otro.configuracion()).toEqual(CONFIGURACION_POR_DEFECTO);
  });
});
