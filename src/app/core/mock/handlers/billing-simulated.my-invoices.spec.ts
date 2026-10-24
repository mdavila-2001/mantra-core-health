import { HttpHeaders } from '@angular/common/http';

import type {
  MyInvoicesPage,
  SimulatedChargesPage,
  SimulatedInvoice,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { MockRouter, isMockReply, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarFacturacionSimulada } from './billing-simulated.handlers';

/**
 * «Mis facturas» (30/09/2026): cada cuenta ve las facturas de su lado —el
 * paciente, las que le emitieron; quien factura, las que emitió— y nada más.
 * Con las facturas de la demo sembradas, sin persistencia.
 */
describe('Mis facturas en la facturación simulada', () => {
  let router: MockRouter;
  const admin = buscarUsuario('admin')!;
  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;
  const farmacia = buscarUsuario('farmacia')!;
  const laboratorio = buscarUsuario('laboratorio')!;

  beforeEach(() => {
    router = new MockRouter();
    registrarFacturacionSimulada(router, {
      activa: () => true,
      reloj: () => new Date('2026-09-15T14:00:00.000Z'),
      persistir: false,
      sembrarFacturas: true,
    });
  });

  function llamar(path: string, user: MockUser | null): MockReply {
    const match = router.match('GET', path.split('?')[0]!);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const resultado = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
  }

  function misFacturas(user: MockUser): MyInvoicesPage {
    return llamar('/billing/simulated/my-invoices', user).body as MyInvoicesPage;
  }

  it('siembra facturas: la paciente de la demo tiene las suyas, de su lado', () => {
    const pagina = misFacturas(paciente);
    expect(pagina.view).toBe('RECEIVED');
    expect(pagina.count).toBeGreaterThan(0);
    expect(pagina.items.every((i) => i.patientName === pagina.items[0]!.patientName)).toBe(true);
  });

  it('el paciente sólo ve las facturas emitidas a su perfil', () => {
    const cobros = (llamar('/billing/simulated/charges', admin).body as SimulatedChargesPage).items;
    const suyos = new Set(cobros.filter((c) => c.patientProfileId === paciente.patientProfileId).map((c) => c.id));
    for (const item of misFacturas(paciente).items) {
      expect(suyos.has(item.chargeId)).toBe(true);
    }
  });

  it('facturación ve todas las emitidas; la médica, sólo las de sus consultas', () => {
    const todas = misFacturas(admin);
    const deLaMedica = misFacturas(medica);
    expect(todas.view).toBe('ISSUED');
    expect(deLaMedica.view).toBe('ISSUED');
    expect(deLaMedica.count).toBeLessThanOrEqual(todas.count);
    expect(deLaMedica.items.every((i) => i.source === 'CONSULTATION')).toBe(true);
  });

  it('la farmacia ve sólo las de sus pedidos; el laboratorio, ninguna todavía', () => {
    expect(misFacturas(farmacia).items.every((i) => i.source === 'PHARMACY')).toBe(true);
    const lab = misFacturas(laboratorio);
    expect(lab.view).toBe('ISSUED');
    expect(lab.count).toBe(0);
  });

  it('el detalle respeta el alcance: 404 fuera de él', () => {
    const ajena = misFacturas(admin).items.find(
      (i) => !misFacturas(paciente).items.some((p) => p.invoice.id === i.invoice.id),
    )!;
    expect(llamar(`/billing/simulated/my-invoices/${ajena.invoice.id}`, paciente).status).toBe(404);

    const propia = misFacturas(paciente).items[0]!;
    const detalle = llamar(`/billing/simulated/my-invoices/${propia.invoice.id}`, paciente);
    expect(detalle.status).toBe(200);
    expect((detalle.body as SimulatedInvoice).id).toBe(propia.invoice.id);
  });

  it('sin sesión, 401', () => {
    expect(llamar('/billing/simulated/my-invoices', null).status).toBe(401);
  });
});
