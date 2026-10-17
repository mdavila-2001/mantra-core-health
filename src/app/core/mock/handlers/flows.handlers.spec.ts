import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarFlujos } from './flows.handlers';
import type { FlowDetail, FlowsPage } from '../../data-access/admin-portal/flows.types';

describe('catálogo de flujos demo: mismas reglas que /admin/qa/flows*', () => {
  const router = new MockRouter();
  registrarFlujos(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(path: string, query: Record<string, string> = {}) {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }

  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const lista = (query: Record<string, string> = {}) => cuerpo<FlowsPage>(pedir('/admin/qa/flows', query));
  const detalle = (id: string) => cuerpo<FlowDetail>(pedir(`/admin/qa/flows/${id}`));

  it('la lista trae el resumen de cada flujo y los módulos disponibles', () => {
    const pagina = lista();
    expect(pagina.items.map((f) => f.id)).toEqual(['1.3', '2.7']);
    expect(pagina.modules).toEqual(['1 · Paciente', '2 · Médico']);
    // El resumen no arrastra el árbol.
    expect(Object.keys(pagina.items[0]!)).not.toContain('nodes');
  });

  it('filtra por módulo, texto y cobertura como la API', () => {
    expect(lista({ module: '2 · Médico' }).items.map((f) => f.id)).toEqual(['2.7']);
    expect(lista({ search: 'AGENDAR' }).items.map((f) => f.id)).toEqual(['1.3']);
    expect(lista({ coverage: 'SEEDED' }).items.map((f) => f.id)).toEqual(['1.3']);
    expect(lista({ coverage: 'NOT_SEEDED' }).items.map((f) => f.id)).toEqual(['2.7']);
    expect(lista({ coverage: 'RAN' }).items.map((f) => f.id)).toEqual(['1.3']);
    expect(lista({ coverage: 'NEVER_RAN' }).items.map((f) => f.id)).toEqual(['2.7']);
  });

  it('una cobertura desconocida es 400 y un flujo inexistente 404', () => {
    expect(estado(pedir('/admin/qa/flows', { coverage: 'NOPE' }))).toBe(400);
    expect(estado(pedir('/admin/qa/flows/9.9'))).toBe(404);
  });

  it.each(['1.3', '2.7'])('el árbol del flujo %s es coherente: raíz sin padre, padres y destinos que existen', (id) => {
    const f = detalle(id);
    const ids = new Set(f.nodes.map((n) => n.id));
    expect(f.nodes.find((n) => n.id === f.root)!.parentId).toBeNull();
    for (const n of f.nodes) {
      if (n.id !== f.root) expect(ids.has(n.parentId!)).toBe(true);
      for (const b of n.branches) {
        for (const destino of [b.next, b.loopsTo]) if (destino) expect(ids.has(destino)).toBe(true);
        // Una rama sin caso dice por qué; una con caso no trae razón.
        expect(Boolean(b.qaCase) !== Boolean(b.reason)).toBe(true);
      }
    }
  });

  it('el resumen coincide con el detalle: contrato, casos y conteos', () => {
    for (const resumen of lista().items) {
      const f = detalle(resumen.id);
      expect(f.counts).toEqual(resumen.counts);
      expect(f.contract).toEqual(resumen.contract);
      expect(f.qa).toEqual(resumen.qa);
      const casos = f.nodes.flatMap((n) => n.branches).filter((b) => b.qaCase).length;
      expect(casos).toBe(f.counts.withCase);
      expect(f.contract.declared + f.contract.missing).toBe(f.contract.endpoints);
    }
  });

  it('el flujo 2.7 tiene las dos simulaciones (sin seguro y con seguro) y pasos sin endpoint', () => {
    const f = detalle('2.7');
    const decision = f.nodes.find((n) => n.id === 'decidir-seguro')!;
    expect(decision.kind).toBe('DECISION');
    expect(decision.branches.map((b) => b.next)).toEqual(['qr-monto-total', 'qr-coaseguro']);
    expect(f.nodes.filter((n) => n.gap !== null)).toHaveLength(2);
    expect(f.qa.seeded).toBe(false);
  });

  it('la maqueta cubre los estados: contrato ausente, rama fallida y rama que pasó', () => {
    const f = detalle('1.3');
    expect(f.nodes.some((n) => n.endpoint?.contract === 'MISSING')).toBe(true);
    const veredictos = f.nodes.flatMap((n) => n.branches.map((b) => b.qaCase?.lastResult?.status));
    expect(veredictos).toContain('RESULT_PASSED');
    expect(veredictos).toContain('RESULT_FAILED');
  });

  it('nunca expone cuerpos ni cabeceras de los casos', () => {
    const texto = JSON.stringify([detalle('1.3'), detalle('2.7')]);
    expect(texto).not.toMatch(/"headers"|"body"|x-tenant-id|authorization/i);
  });
});
