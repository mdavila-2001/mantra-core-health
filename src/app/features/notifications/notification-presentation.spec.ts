import type { InAppNotification } from '../../core/data-access/notifications/notifications.types';
import {
  agruparPorDia,
  horaRelativa,
  iconoDeCategoria,
  nombreDeCategoria,
} from './notification-presentation';

/* ============================================================================
    Lo que estas tres funciones prometen, y por lo tanto lo que se prueba:

    1. Que cada familia de aviso tiene su dibujo y su nombre, y que una
       categoría que el backend agregue mañana no deja la fila coja.
    2. Que «hace cuánto» dice la verdad en los bordes: el minuto, la hora, el
       día, la semana y el reloj adelantado.
    3. Que «Hoy» y «Ayer» se calculan por día calendario y no por horas
       transcurridas, y que agrupar NO reordena.
    ========================================================================== */

function aviso(id: string, availableAt: Date, extra: Partial<InAppNotification> = {}) {
  return {
    id,
    availableAt,
    unread: false,
    subject: `Aviso ${id}`,
    ...extra,
  } as InAppNotification;
}

describe('iconoDeCategoria', () => {
  it.each([
    ['CLINICAL', 'stethoscope'],
    ['SCHEDULING', 'calendar'],
    ['MESSAGES', 'chat'],
    ['SOCIAL', 'people'],
  ])('%s se dibuja con %s', (categoria, icono) => {
    expect(iconoDeCategoria(categoria)).toBe(icono);
  });

  it('una categoría que todavía no existe entra con la campana, no con un hueco', () => {
    // El contrato del backend puede crecer; una fila sin dibujo se ve rota.
    expect(iconoDeCategoria('BILLING')).toBe('bell');
    expect(iconoDeCategoria(undefined)).toBe('bell');
  });
});

describe('nombreDeCategoria', () => {
  it('nombra las cuatro familias en castellano', () => {
    expect(nombreDeCategoria('CLINICAL')).toBe('Clínico');
    expect(nombreDeCategoria('SCHEDULING')).toBe('Turnos');
    expect(nombreDeCategoria('MESSAGES')).toBe('Mensajes');
    expect(nombreDeCategoria('SOCIAL')).toBe('Red');
  });

  it('lo desconocido se llama «Aviso», no se deja vacío', () => {
    expect(nombreDeCategoria('LO_QUE_SEA')).toBe('Aviso');
  });
});

describe('horaRelativa', () => {
  const ahora = new Date('2026-09-10T12:00:00');

  it('menos de un minuto es «recién»', () => {
    expect(horaRelativa(new Date('2026-09-10T11:59:30'), ahora)).toBe('recién');
  });

  it('cuenta minutos hasta la hora', () => {
    expect(horaRelativa(new Date('2026-09-10T11:45:00'), ahora)).toBe('hace 15 min');
    expect(horaRelativa(new Date('2026-09-10T11:01:00'), ahora)).toBe('hace 59 min');
  });

  it('cuenta horas hasta el día', () => {
    expect(horaRelativa(new Date('2026-09-10T09:00:00'), ahora)).toBe('hace 3 h');
    expect(horaRelativa(new Date('2026-09-09T12:30:00'), ahora)).toBe('hace 23 h');
  });

  it('un día es «ayer», y después cuenta días hasta la semana', () => {
    expect(horaRelativa(new Date('2026-09-09T11:00:00'), ahora)).toBe('ayer');
    expect(horaRelativa(new Date('2026-09-06T12:00:00'), ahora)).toBe('hace 4 días');
  });

  it('pasada la semana vuelve a la fecha: «hace 34 días» obliga a hacer la cuenta', () => {
    expect(horaRelativa(new Date('2026-08-01T12:00:00'), ahora)).not.toContain('hace');
  });

  it('el reloj adelantado no produce «hace -3 minutos»', () => {
    // El reloj del navegador desfasado del servidor es normal, no una rareza.
    expect(horaRelativa(new Date('2026-09-10T12:05:00'), ahora)).toBe('recién');
  });
});

describe('agruparPorDia', () => {
  const ahora = new Date('2026-09-10T12:00:00');

  it('separa hoy, ayer y las fechas anteriores', () => {
    const grupos = agruparPorDia(
      [
        aviso('a', new Date('2026-09-10T09:00:00')),
        aviso('b', new Date('2026-09-09T20:00:00')),
        aviso('c', new Date('2026-09-02T10:00:00')),
      ],
      ahora,
    );

    expect(grupos.map((g) => g.etiqueta)).toEqual(['Hoy', 'Ayer', '2 de septiembre']);
    expect(grupos.map((g) => g.avisos.length)).toEqual([1, 1, 1]);
  });

  it('lo de las 23:00 visto a las 00:30 es de AYER, aunque haga hora y media', () => {
    // Por día calendario y no por horas transcurridas: decir «hoy» acá es lo
    // que hace dudar de si un aviso es nuevo.
    const medianoche = new Date('2026-09-10T00:30:00');
    const grupos = agruparPorDia([aviso('a', new Date('2026-09-09T23:00:00'))], medianoche);

    expect(grupos[0]!.etiqueta).toBe('Ayer');
  });

  it('no reordena: el orden lo pone el backend y la bandeja se pagina con cursor', () => {
    const grupos = agruparPorDia(
      [
        aviso('primero', new Date('2026-09-10T08:00:00')),
        aviso('segundo', new Date('2026-09-10T11:00:00')),
      ],
      ahora,
    );

    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.avisos.map((a) => a.id)).toEqual(['primero', 'segundo']);
  });

  it('los avisos del mismo día caen en un solo grupo, no en uno por aviso', () => {
    const grupos = agruparPorDia(
      [
        aviso('a', new Date('2026-09-10T09:00:00')),
        aviso('b', new Date('2026-09-10T10:00:00')),
        aviso('c', new Date('2026-09-09T10:00:00')),
      ],
      ahora,
    );

    expect(grupos).toHaveLength(2);
    expect(grupos[0]!.avisos).toHaveLength(2);
  });

  it('una bandeja vacía no inventa grupos', () => {
    expect(agruparPorDia([], ahora)).toEqual([]);
  });

  it('el año se escribe sólo cuando no es el corriente', () => {
    const grupos = agruparPorDia([aviso('viejo', new Date('2025-12-20T10:00:00'))], ahora);

    expect(grupos[0]!.etiqueta).toContain('2025');
  });
});
