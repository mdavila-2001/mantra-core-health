import { HttpHeaders } from '@angular/common/http';

import { MEDICA, PACIENTE } from '../fixtures/people';
import { MockRouter, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_LABORATORIO, type MockUser } from '../mock-session';
import { alcanceDeMisSolicitudes, registerInsurerReceivedClaims } from './insurer-received-claims.handlers';

interface MiSolicitud {
  readonly id: string;
  readonly claimIdentifier: string;
  readonly patientName: string | null;
  readonly practitioner: { readonly displayName: string };
  readonly service: { readonly code: string };
  readonly decision: { readonly outcome: string; readonly reason: string | null; readonly decidedAt: string } | null;
  readonly [campo: string]: unknown;
}

interface MisSolicitudes {
  readonly view: string;
  readonly items: readonly MiSolicitud[];
  readonly truncated: boolean;
}

const LABORATORIO = new Set(['SVC_HEMOGRAMA', 'SVC_PERFIL_LIPIDICO']);
const IMAGEN = new Set(['SVC_ECOGRAFIA', 'SVC_RX_TORAX']);

describe('«Mis solicitudes»: GET /insurance/my-claims', () => {
  let router: MockRouter;

  beforeEach(() => {
    router = new MockRouter();
    registerInsurerReceivedClaims(router, { persistir: false });
  });

  function call(method: 'GET' | 'POST', path: string, user: MockUser | null, body: unknown = null): unknown {
    const match = router.match(method, path)!;
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    });
  }

  function mias(key: string): MisSolicitudes {
    return call('GET', '/insurance/my-claims', buscarUsuario(key)!) as MisSolicitudes;
  }

  it('sin sesión responde 401', () => {
    expect((call('GET', '/insurance/my-claims', null) as MockReply).status).toBe(401);
  });

  it('la paciente ve sólo las suyas, sin su propio nombre repetido', () => {
    const body = mias('paciente');
    expect(body.view).toBe('PATIENT');
    expect(body.items.length).toBeGreaterThan(0);
    const todas = call('GET', '/insurance/received-claims', buscarUsuario('aseguradora')!) as {
      items: readonly { id: string; patient: { id: string } }[];
    };
    const suyas = new Set(todas.items.filter((s) => s.patient.id === PACIENTE.id).map((s) => s.id));
    expect(body.items.map((s) => s.id).sort()).toEqual([...suyas].sort());
    for (const s of body.items) expect(s.patientName).toBeNull();
  });

  it('la médica ve las atenciones que presentó, con el nombre del paciente', () => {
    const body = mias('medica');
    expect(body.view).toBe('PRACTITIONER');
    expect(body.items.length).toBeGreaterThan(0);
    for (const s of body.items) {
      expect(s.practitioner.displayName).toBe(MEDICA.displayName);
      expect(s.patientName).not.toBeNull();
    }
  });

  it('el laboratorio ve sólo los análisis clínicos', () => {
    const body = mias('laboratorio');
    expect(body.view).toBe('LABORATORY');
    expect(body.items.length).toBeGreaterThan(0);
    for (const s of body.items) expect(LABORATORIO.has(s.service.code)).toBe(true);
  });

  it('un centro de imagenología ve sólo los estudios de imagen', () => {
    const centro = { ...buscarUsuario('laboratorio')!, tenants: ['tenant-imagen'] };
    const alcance = alcanceDeMisSolicitudes(centro, null, { 'tenant-imagen': 'IMAGING' });
    expect(alcance.vista).toBe('IMAGING');
    const todas = call('GET', '/insurance/received-claims', buscarUsuario('aseguradora')!) as {
      items: readonly Parameters<typeof alcance.incluye>[0][];
    };
    const vistas = todas.items.filter(alcance.incluye);
    expect(vistas.length).toBeGreaterThan(0);
    for (const s of vistas) expect(IMAGEN.has(s.service.code)).toBe(true);
  });

  it('un tenant ajeno en la cabecera no le abre a nadie la vista de un centro', () => {
    const intruso = buscarUsuario('paciente')!;
    expect(alcanceDeMisSolicitudes(intruso, TENANT_LABORATORIO).vista).toBe('PATIENT');
  });

  it('la aseguradora y la farmacia no presentan solicitudes: lista vacía, no 403', () => {
    for (const key of ['aseguradora', 'farmacia']) {
      const body = mias(key);
      expect(body.view).toBe('NONE');
      expect(body.items).toEqual([]);
    }
  });

  it('no expone la factura, los renglones ni quién de la aseguradora firmó', () => {
    for (const key of ['paciente', 'medica', 'laboratorio']) {
      for (const s of mias(key).items) {
        expect(s['invoice']).toBeUndefined();
        expect(s['lines']).toBeUndefined();
        expect(s['policyIdentifier']).toBeUndefined();
        expect(s.decision === null ? undefined : (s.decision as Record<string, unknown>)['decidedBy']).toBeUndefined();
      }
    }
  });

  it('lo que dictamina la aseguradora aparece en la próxima lectura de la paciente y de la médica', () => {
    const aseguradora = buscarUsuario('aseguradora')!;
    const abierta = mias('paciente').items.find((s) => s.decision === null)
      ?? mias('medica').items.find((s) => s.decision === null);
    expect(abierta).toBeDefined();

    call('POST', `/insurance/received-claims/${abierta!.id}/decision`, aseguradora, {
      outcome: 'REJECTED',
      reason: 'El plan no cubre este servicio.',
    });

    const despues = [...mias('paciente').items, ...mias('medica').items].find((s) => s.id === abierta!.id)!;
    expect(despues.decision).toEqual(
      expect.objectContaining({ outcome: 'REJECTED', reason: 'El plan no cubre este servicio.' }),
    );
  });
});
