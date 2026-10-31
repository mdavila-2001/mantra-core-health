import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { PIECE_KINDS, PIECE_STATES } from '../../data-access/admin-portal/runtime-pieces.types';
import type {
  DiscoveryReport,
  RuntimePieceDetail,
  RuntimePiecesPage,
} from '../../data-access/admin-portal/runtime-pieces.types';
import { MockRouter, isMockReply, type MockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { piezasVivasSimuladas, registrarPiezasVivas } from './runtime-pieces.handlers';

describe('piezas en ejecución simuladas: mismo contrato que /admin/ops/runtime-pieces', () => {
  const admin = buscarUsuario('superadmin')!;

  function nuevoRouter() {
    const router = new MockRouter();
    registrarPiezasVivas(router);
    function pedir<T>(method: 'GET' | 'POST', ruta: string, body: unknown = null): T | MockReply {
      const [path, consulta = ''] = ruta.split('?');
      const match = router.match(method, path);
      if (match === null) throw new Error(`No existe ${method} ${path}`);
      return match.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(consulta),
        body,
        headers: new HttpHeaders(),
        user: admin,
      } satisfies MockRequest) as T | MockReply;
    }
    return { pedir };
  }

  const lista = (r: unknown) => r as RuntimePiecesPage;

  it('cubre los seis estados y los ocho tipos, y los contadores cierran con el total', () => {
    const { pedir } = nuevoRouter();
    const r = lista(pedir('GET', '/admin/ops/runtime-pieces?pageSize=100'));
    for (const estado of PIECE_STATES) expect(r.data.some((p) => p.state === estado)).toBe(true);
    for (const tipo of PIECE_KINDS) expect(r.data.some((p) => p.kind === tipo)).toBe(true);
    expect(Object.values(r.summary.byState).reduce((a, b) => a + b, 0)).toBe(r.summary.total);
    expect(Object.values(r.summary.byKind).reduce((a, b) => a + b, 0)).toBe(r.summary.total);
    expect(r.summary.total).toBe(r.meta.total);
  });

  it('dice de dónde salió el código que se leyó: en una imagen sólo hay manifiesto, con su fecha', () => {
    const ahora = Date.UTC(2026, 9, 31, 12, 0, 0);
    const r = piezasVivasSimuladas(new URLSearchParams(), undefined, ahora);
    expect(r.scan).toMatchObject({
      available: true,
      source: 'manifest',
      generatedAt: '2026-10-30T05:00:00.000Z',
    });
  });

  it('está marcado como simulado y declara lo que no mide', () => {
    const r = lista(nuevoRouter().pedir('GET', '/admin/ops/runtime-pieces?pageSize=100'));
    expect(r.data.every((p) => p.causeDetail.startsWith('Simulado:'))).toBe(true);
    expect(r.notMeasured.some((n) => n.startsWith('TICK_INDIVIDUAL'))).toBe(true);
  });

  it('filtra por estado, tipo, anfitrión, módulo, texto y hallazgos, y pagina', () => {
    const { pedir } = nuevoRouter();
    expect(
      lista(pedir('GET', '/admin/ops/runtime-pieces?state=HUERFANA')).data.map((p) => p.id),
    ).toEqual(['rtp.job.community.old-ranking']);
    expect(
      lista(pedir('GET', '/admin/ops/runtime-pieces?kind=PROCESO&pageSize=100')).data.every(
        (p) => p.kind === 'PROCESO',
      ),
    ).toBe(true);
    expect(
      lista(pedir('GET', '/admin/ops/runtime-pieces?host=worker-billing&pageSize=100')).data.every(
        (p) => p.hosts.includes('worker-billing'),
      ),
    ).toBe(true);
    expect(lista(pedir('GET', '/admin/ops/runtime-pieces?q=OUTBOX')).data).toHaveLength(2);
    const conHallazgos = lista(
      pedir('GET', '/admin/ops/runtime-pieces?withFindings=true&pageSize=100'),
    );
    expect(conHallazgos.data.length).toBeGreaterThan(0);
    expect(conHallazgos.data.length).toBeLessThan(conHallazgos.summary.total);
    const pagina2 = lista(pedir('GET', '/admin/ops/runtime-pieces?page=2&pageSize=10'));
    expect(pagina2.meta).toMatchObject({ page: 2, pageSize: 10 });
    expect(pagina2.data.length).toBe(pagina2.meta.total - 10);
  });

  it('las instancias dicen cuántas piezas aloja cada una y sus fechas salen del reloj', () => {
    const ahora = Date.UTC(2026, 9, 31, 12, 0, 0);
    const r = piezasVivasSimuladas(new URLSearchParams(), undefined, ahora);
    expect(r.evaluatedAt).toBe('2026-10-31T12:00:00.000Z');
    const mensajeria = r.instances.find((i) => i.id === 'worker-messaging')!;
    expect(mensajeria.pieceCount).toBeGreaterThan(1);
    expect(new Date(mensajeria.lastHeartbeatAt!).getTime()).toBe(ahora - 5000);
    expect(r.instances.map((i) => i.state)).toEqual(
      expect.arrayContaining(['VIVA', 'DEGRADADA', 'CAIDA', 'SIN_DATO']),
    );
    expect(r.instances.find((i) => i.id === 'worker-files')!.lastHeartbeatAt).toBeNull();
  });

  it('la ficha de una pieza trae sus hallazgos; una inexistente es 404', () => {
    const { pedir } = nuevoRouter();
    const ficha = pedir<RuntimePieceDetail>(
      'GET',
      '/admin/ops/runtime-pieces/rtp.proceso.worker-billing',
    );
    expect(isMockReply(ficha)).toBe(false);
    expect((ficha as RuntimePieceDetail).findings.map((f) => f.rule)).toEqual([
      'SIN_LATIDO_REQUERIDA',
    ]);
    const falta = pedir('GET', '/admin/ops/runtime-pieces/rtp.no.existe') as MockReply;
    expect(isMockReply(falta)).toBe(true);
    expect(falta.status).toBe(404);
  });

  describe('descubrir', () => {
    it('es idempotente: la primera corrida registra lo que falta, la segunda no cambia nada', () => {
      const { pedir } = nuevoRouter();
      const antes = lista(pedir('GET', '/admin/ops/runtime-pieces?pageSize=100'));
      expect(antes.summary.byState.NO_REGISTRADA).toBe(1);

      const primera = pedir<DiscoveryReport>('POST', '/admin/ops/runtime-pieces/discover', {
        dryRun: false,
      }) as DiscoveryReport;
      expect(primera).toMatchObject({ dryRun: false, created: 1, updated: 0, orphans: 1 });
      expect(primera.created + primera.unchanged).toBe(primera.scanned);
      const despues = lista(pedir('GET', '/admin/ops/runtime-pieces?pageSize=100'));
      expect(despues.summary.byState.NO_REGISTRADA).toBe(0);
      expect(despues.findings.some((f) => f.rule === 'NO_REGISTRADA')).toBe(false);

      const segunda = pedir<DiscoveryReport>('POST', '/admin/ops/runtime-pieces/discover', {
        dryRun: false,
      }) as DiscoveryReport;
      expect(segunda).toMatchObject({
        created: 0,
        updated: 0,
        unchanged: segunda.scanned,
        createdIds: [],
      });
      expect(
        JSON.stringify(lista(pedir('GET', '/admin/ops/runtime-pieces?pageSize=100')).data),
      ).toBe(JSON.stringify(despues.data));
    });

    it('dryRun calcula el efecto y no escribe', () => {
      const { pedir } = nuevoRouter();
      const simulacion = pedir<DiscoveryReport>('POST', '/admin/ops/runtime-pieces/discover', {
        dryRun: true,
      }) as DiscoveryReport;
      expect(simulacion).toMatchObject({ dryRun: true, created: 1 });
      expect(
        lista(pedir('GET', '/admin/ops/runtime-pieces?pageSize=100')).summary.byState.NO_REGISTRADA,
      ).toBe(1);
    });

    it('lo huérfano se informa y no se borra', () => {
      const { pedir } = nuevoRouter();
      const informe = pedir<DiscoveryReport>('POST', '/admin/ops/runtime-pieces/discover', {
        dryRun: false,
      }) as DiscoveryReport;
      expect(informe.orphanIds).toEqual(['rtp.job.community.old-ranking']);
      expect(lista(pedir('GET', '/admin/ops/runtime-pieces?state=HUERFANA')).data).toHaveLength(1);
    });

    it('un campo no declarado se rechaza, como hace la API', () => {
      const { pedir } = nuevoRouter();
      const respuesta = pedir('POST', '/admin/ops/runtime-pieces/discover', {
        dryRun: false,
        tenantId: 'otro',
      }) as MockReply;
      expect(isMockReply(respuesta)).toBe(true);
      expect(respuesta.status).toBe(422);
    });

    it('cada router arma su propio estado: una prueba no pisa a la otra', () => {
      const uno = nuevoRouter();
      const dos = nuevoRouter();
      uno.pedir('POST', '/admin/ops/runtime-pieces/discover', { dryRun: false });
      expect(
        lista(dos.pedir('GET', '/admin/ops/runtime-pieces?pageSize=100')).summary.byState
          .NO_REGISTRADA,
      ).toBe(1);
    });
  });
});
