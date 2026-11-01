import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { DiscoveryReport } from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import {
  PIECE_KINDS,
  PIECE_STATES,
} from '../../../../../core/data-access/admin-portal/runtime-pieces.types';
import {
  CLAVES_URL,
  ESTADOS_DE_PIEZA,
  TIPOS_DE_PIEZA,
  causaDePieza,
  consultaDe,
  fallaDeDescubrimiento,
  hayFiltros,
  paginaDe,
  pestanaDe,
  textoDeCadencia,
  textoDeInforme,
  textoDeLatido,
  textoDeNoMedido,
  type ValoresUrl,
} from './runtime-pieces-labels';

const valores = (over: Partial<ValoresUrl> = {}): ValoresUrl => ({
  ...(Object.fromEntries(CLAVES_URL.map((k) => [k, ''])) as unknown as ValoresUrl),
  ...over,
});

const informe = (over: Partial<DiscoveryReport> = {}): DiscoveryReport => ({
  dryRun: false,
  discoveredAt: '2026-10-31',
  scanned: 10,
  created: 0,
  updated: 0,
  unchanged: 10,
  orphans: 0,
  conflicts: 0,
  createdIds: [],
  updatedIds: [],
  orphanIds: [],
  conflictIds: [],
  warnings: [],
  ...over,
});

describe('etiquetas de las piezas en ejecución (funciones puras)', () => {
  it('cada estado y cada tipo del contrato tiene su texto, y los estados no se distinguen sólo por color', () => {
    for (const estado of PIECE_STATES) {
      expect(ESTADOS_DE_PIEZA[estado].texto.length).toBeGreaterThan(0);
      expect(ESTADOS_DE_PIEZA[estado].ayuda.length).toBeGreaterThan(0);
    }
    const textos = PIECE_STATES.map((e) => ESTADOS_DE_PIEZA[e].texto);
    expect(new Set(textos).size).toBe(PIECE_STATES.length);
    for (const tipo of PIECE_KINDS) expect(TIPOS_DE_PIEZA[tipo]).toBeTruthy();
  });

  it('«no medible» no es rojo ni verde: no afirma ni niega la vida', () => {
    expect(ESTADOS_DE_PIEZA.NO_MEDIBLE.tono).toBe('info');
    expect(ESTADOS_DE_PIEZA.VIVA.tono).toBe('success');
    expect(ESTADOS_DE_PIEZA.SIN_LATIDO.tono).toBe('error');
  });

  it('las causas propias de las piezas y las de la sonda se dicen en lenguaje llano; una desconocida se muestra tal cual', () => {
    expect(causaDePieza('NOT_IN_REGISTRY')).toContain('registro');
    expect(causaDePieza('HEARTBEAT_EXPIRED')).toContain('caída');
    expect(causaDePieza('NO_HEARTBEAT_MECHANISM')).toContain('latido');
    expect(causaDePieza('CAUSA_NUEVA' as never)).toBe('CAUSA_NUEVA');
  });

  it('la cadencia se dice en palabras y lo que no se resolvió se declara, no se inventa', () => {
    expect(textoDeCadencia(null)).toBe('Sin cadencia propia');
    expect(textoDeCadencia({ type: 'interval', intervalMs: 500, cron: null, raw: 'X' })).toBe(
      'cada 500 ms',
    );
    expect(textoDeCadencia({ type: 'interval', intervalMs: 5000, cron: null, raw: 'X' })).toBe(
      'cada 5 s',
    );
    expect(textoDeCadencia({ type: 'interval', intervalMs: 90_000, cron: null, raw: 'X' })).toBe(
      'cada 1.5 min',
    );
    expect(textoDeCadencia({ type: 'interval', intervalMs: 3_600_000, cron: null, raw: 'X' })).toBe(
      'cada 1 h',
    );
    expect(textoDeCadencia({ type: 'timeout', intervalMs: 2000, cron: null, raw: 'X' })).toBe(
      'una vez a los 2 s',
    );
    expect(textoDeCadencia({ type: 'cron', intervalMs: null, cron: '0 * * * *', raw: 'e' })).toBe(
      'cron 0 * * * *',
    );
    expect(
      textoDeCadencia({ type: 'cron', intervalMs: null, cron: null, raw: 'expression' }),
    ).toContain('sin resolver');
    expect(
      textoDeCadencia({ type: 'interval', intervalMs: null, cron: null, raw: 'this.env.x * 1000' }),
    ).toContain('no resuelta');
  });

  it('el latido dice de dónde sale', () => {
    expect(textoDeLatido('PROCESS', 'worker-messaging')).toBe('Latido propio (worker-messaging)');
    expect(textoDeLatido('INHERITED', 'worker-billing')).toBe(
      'Hereda el del proceso (worker-billing)',
    );
    expect(textoDeLatido('NONE', null)).toBe('Sin latido');
  });

  it('de lo que no se mide se muestra el texto, sin el código', () => {
    expect(textoDeNoMedido('REPLICAS: varias réplicas no se distinguen')).toBe(
      'varias réplicas no se distinguen',
    );
    expect(textoDeNoMedido('sin código delante')).toBe('sin código delante');
    expect(textoDeNoMedido('Hola: mundo')).toBe('Hola: mundo');
  });
});

describe('la consulta que sale de la URL', () => {
  it('por omisión pide la primera página, sin filtros', () => {
    expect(consultaDe(valores())).toEqual({ page: 1, pageSize: 10 });
  });

  it('manda lo válido y descarta lo que la API rechazaría con 400', () => {
    const q = consultaDe(
      valores({
        state: 'SIN_LATIDO',
        kind: 'NADA',
        host: ' worker-a ',
        q: '  outbox ',
        withFindings: 'true',
        page: '3',
      }),
    );
    expect(q).toEqual({
      page: 3,
      pageSize: 10,
      state: 'SIN_LATIDO',
      host: 'worker-a',
      q: 'outbox',
      withFindings: true,
    });
    expect('kind' in q).toBe(false);
  });

  it('un texto de más de 100 caracteres no se manda, y withFindings sólo vale «true»', () => {
    const q = consultaDe(
      valores({ q: 'x'.repeat(101), host: 'y'.repeat(101), withFindings: 'si' }),
    );
    expect(q).toEqual({ page: 1, pageSize: 10 });
  });

  it.each([
    ['0', 1],
    ['-2', 1],
    ['1.5', 1],
    ['abc', 1],
    ['', 1],
    ['7', 7],
  ])('la página «%s» es %s', (texto, esperada) => {
    expect(paginaDe({ page: texto })).toBe(esperada);
  });

  it('la pestaña inválida cae en «piezas»; la página y la pestaña no son filtros', () => {
    expect(pestanaDe({ vista: 'hallazgos' })).toBe('hallazgos');
    expect(pestanaDe({ vista: 'otra' })).toBe('piezas');
    expect(hayFiltros(valores({ vista: 'hallazgos', page: '2' }))).toBe(false);
    expect(hayFiltros(valores({ q: 'x' }))).toBe(true);
  });
});

describe('el resultado de descubrir', () => {
  it('una simulación dice que no escribió nada', () => {
    const texto = textoDeInforme(informe({ dryRun: true, created: 2, unchanged: 8 }));
    expect(texto).toContain('Simulación, no se escribió nada');
    expect(texto).toContain('2 piezas');
  });

  it('una segunda corrida sin cambios lo dice: repetirlo no modifica nada', () => {
    const texto = textoDeInforme(informe());
    expect(texto).toContain('Se registraron 0 piezas');
    expect(texto).toContain('Repetirlo sin cambios en el código no modifica nada.');
  });

  it('lo huérfano se informa y se aclara que no se borra; lo escrito a mano no se toca', () => {
    const texto = textoDeInforme(informe({ created: 1, orphans: 2, conflicts: 1 }));
    expect(texto).not.toContain('Repetirlo sin cambios');
    expect(texto).toContain('2 piezas registradas ya no existen');
    expect(texto).toContain('no se borran');
    expect(texto).toContain('1 fila escrita a mano no se tocó');
  });

  const falla = (status: number, reason?: string) =>
    new HttpErrorResponse({ status, error: reason ? { reason } : null });

  it.each([
    [falla(403), 'no registrarlas'],
    [falla(409, 'RUNTIME_PIECES_SOURCE_UNAVAILABLE'), 'no trae el código fuente'],
    [falla(422, 'RUNTIME_PIECES_CONCEPTS_MISSING'), 'seed de terminología'],
    [falla(0), 'No se pudo llegar a la API'],
    [falla(500), 'No se pudo completar el descubrimiento'],
    [new Error('x'), 'No se pudo completar el descubrimiento'],
  ])('la falla %# se explica sin el cuerpo crudo del servidor', (error, texto) => {
    const mensaje = fallaDeDescubrimiento(error);
    expect(mensaje).toContain(texto);
    expect(mensaje).not.toContain('RUNTIME_PIECES');
  });
});
