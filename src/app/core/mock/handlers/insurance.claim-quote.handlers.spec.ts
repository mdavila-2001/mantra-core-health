import { HttpHeaders } from '@angular/common/http';

import { isMockReply, type MockMethod, type MockReply, type MockRouter } from '../mock-router';
import { IDS } from '../mock-session';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import {
  APROBACION_DE_PRUEBA,
  cotizarLinea,
  PENDIENTE_DE_PRUEBA,
  quitarReclamoDeLaMaqueta,
  totalesDeLaCotizacion,
} from './insurance.handlers';

/**
 * Cotización previa del cobro (REQ-16-026). Dos capas: la regla pura contra
 * los ejemplos fijados por el propietario (REQ-16-035.1), y las rutas contra
 * el router completo con la cobertura de la persona de ejemplo.
 */

type PlanDePrueba = Parameters<typeof cotizarLinea>[1];

/** Un plan con los beneficios que cada caso necesita, con la forma del catálogo. */
function planDePrueba(
  beneficios: readonly {
    readonly categoria: string;
    readonly cobertura: string;
    readonly copago: string | null;
    readonly autorizacion?: boolean;
  }[],
): PlanDePrueba {
  return {
    benefits: beneficios.map((b) => ({
      category: { code: b.categoria, display: b.categoria },
      coveragePercent: b.cobertura,
      copayAmount: b.copago,
      deductibleAmount: null,
      requiresPriorAuthorization: b.autorizacion ?? false,
      effectiveTo: null,
    })),
  } as unknown as PlanDePrueba;
}

/** Concepto de consulta del nomenclador («General», categoría de consulta). */
const CONSULTA = uuid('nomenclador-SCZ25-A-0002');
/** Concepto de internación del nomenclador («Riesgo quirúrgico…», categoría de internación). */
const INTERNACION = uuid('nomenclador-SCZ25-C-0002');

function linea(billedAmount: string, serviceConceptId = CONSULTA) {
  return { lineSequence: 1, serviceConceptId, billedAmount };
}

describe('cotización del cobro, regla pura (REQ-16-035.1)', () => {
  it('500 Bs con copago 50 y cobertura 80 % reparte 140.00 al paciente y 360.00 a la aseguradora', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '80', copago: '50.00' }]);
    const r = cotizarLinea(linea('500.00'), plan, undefined);
    expect(r.patientAmount).toBe('140.00');
    expect(r.insurerAmount).toBe('360.00');
    expect(r.copayAmount).toBe('50.00');
  });

  it('cobertura 100 % sin copago deja todo a la aseguradora', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '100', copago: '0.00' }]);
    const r = cotizarLinea(linea('500.00'), plan, undefined);
    expect(r.patientAmount).toBe('0.00');
    expect(r.insurerAmount).toBe('500.00');
  });

  it('un copago mayor que el monto no deja nada que cubrir: la persona paga el monto y la aseguradora 0.00', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '80', copago: '30.00' }]);
    const r = cotizarLinea(linea('20.00'), plan, undefined);
    expect(r.copayAmount).toBe('20.00');
    expect(r.patientAmount).toBe('20.00');
    expect(r.insurerAmount).toBe('0.00');
  });

  it('con centavos, el centavo que sobra va a la aseguradora: 100.01 al 80 % reparte 20.00 y 80.01', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '80', copago: '0.00' }]);
    const r = cotizarLinea(linea('100.01'), plan, undefined);
    expect(r.patientAmount).toBe('20.00');
    expect(r.insurerAmount).toBe('80.01');
  });

  it('paciente más aseguradora siempre suma el monto, en un barrido de casos', () => {
    const montos = ['0.01', '1.99', '33.33', '99.99', '500.00', '1234.56'];
    const porcentajes = ['0', '33', '50', '72.5', '80', '100'];
    const copagos = ['0.00', '0.01', '50.00'];
    for (const monto of montos) {
      for (const cobertura of porcentajes) {
        for (const copago of copagos) {
          const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura, copago }]);
          const r = cotizarLinea(linea(monto), plan, undefined);
          const suma = Number(r.patientAmount) * 100 + Number(r.insurerAmount) * 100;
          expect(Math.round(suma)).toBe(Math.round(Number(monto) * 100));
          expect(Number(r.patientAmount)).toBeGreaterThanOrEqual(0);
          expect(Number(r.insurerAmount)).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('un servicio sin beneficio vigente no tiene reparto y bloquea el cobro', () => {
    const plan = planDePrueba([{ categoria: 'PHARMACY', cobertura: '60', copago: null }]);
    const r = cotizarLinea(linea('500.00'), plan, undefined);
    expect(r.covered).toBe(false);
    expect(r.reason).toBe('SERVICE_NOT_COVERED');
    expect(r.patientAmount).toBeNull();
  });

  it('la aprobación previa exigida y ausente bloquea con MISSING y deja el reparto a la vista', () => {
    const plan = planDePrueba([
      { categoria: 'HOSPITALIZATION', cobertura: '90', copago: '0.00', autorizacion: true },
    ]);
    const r = cotizarLinea(linea('500.00', INTERNACION), plan, undefined);
    expect(r.priorAuthorizationStatus).toBe('MISSING');
    expect(r.reason).toBe('PRIOR_AUTHORIZATION_REQUIRED');
    expect(r.patientAmount).toBe('50.00');
  });

  it('la aprobación de la maqueta cubre el cobro; otro id no corresponde', () => {
    const plan = planDePrueba([
      { categoria: 'HOSPITALIZATION', cobertura: '90', copago: '0.00', autorizacion: true },
    ]);
    const aprobada = APROBACION_DE_PRUEBA;
    const pendiente = PENDIENTE_DE_PRUEBA;
    expect(cotizarLinea(linea('500.00', INTERNACION), plan, aprobada).priorAuthorizationStatus).toBe('APPROVED');
    expect(cotizarLinea(linea('500.00', INTERNACION), plan, aprobada).reason).toBeNull();
    expect(cotizarLinea(linea('500.00', INTERNACION), plan, pendiente).priorAuthorizationStatus).toBe('PENDING');
    expect(cotizarLinea(linea('500.00', INTERNACION), plan, uuid('otra')).priorAuthorizationStatus).toBe('MISMATCH');
  });

  it('un servicio que no exige aprobación previa queda NOT_REQUIRED aunque no llegue ningún id', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '80', copago: '0.00' }]);
    const r = cotizarLinea(linea('100.00'), plan, undefined);
    expect(r.priorAuthorizationStatus).toBe('NOT_REQUIRED');
    expect(r.reason).toBeNull();
  });

  it('los totales suman en centavos y quedan nulos si una línea no tiene reparto', () => {
    const plan = planDePrueba([{ categoria: 'CONSULTATION', cobertura: '80', copago: '50.00' }]);
    const ok = cotizarLinea(linea('500.00'), plan, undefined);
    const total = totalesDeLaCotizacion([ok, { ...ok, lineSequence: 2 }]);
    expect(total.totalBilledAmount).toBe('1000.00');
    expect(total.totalPatientAmount).toBe('280.00');
    expect(total.totalInsurerAmount).toBe('720.00');
    const sinReparto = { ...ok, patientAmount: null, insurerAmount: null };
    expect(totalesDeLaCotizacion([ok, sinReparto]).totalPatientAmount).toBeNull();
  });
});

describe('cotización del cobro, rutas', () => {
  let router: MockRouter;
  const creados: string[] = [];

  beforeEach(() => {
    sessionStorage.clear();
    router = crearRouterSimulado();
  });

  afterEach(() => {
    // El envío agrega un reclamo a la maqueta compartida: se quita para el resto de los archivos.
    for (const id of creados) quitarReclamoDeLaMaqueta(id);
    creados.length = 0;
    sessionStorage.clear();
  });

  function llamar(method: MockMethod, path: string, body: unknown = null): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: null,
    });
    return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
  }

  function coberturaDePrueba() {
    const r = llamar('GET', `/patient-coverages/by-patient/${IDS.paciente.patientProfileId}`);
    expect(r.status).toBe(200);
    const items = (r.body as { items: { id: string; insuranceCarrierId: string; validityStatus: string }[] }).items;
    expect(items).toHaveLength(1);
    expect(items[0]!.validityStatus).toBe('CURRENT');
    return items[0]!;
  }

  it('la cobertura de la persona de ejemplo viene con su aseguradora y vigencia', () => {
    const cobertura = coberturaDePrueba();
    expect(cobertura.id.startsWith('coverage-')).toBe(true);
    expect(cobertura.insuranceCarrierId).toBe(uuid('carrier-andina'));
  });

  it('una persona sin id de perfil conocido responde 404', () => {
    expect(llamar('GET', '/patient-coverages/by-patient/no-existe').status).toBe(404);
  });

  it('cotizar un servicio de internación sin aprobación responde 200 con canSubmit en falso', () => {
    const cobertura = coberturaDePrueba();
    const r = llamar('POST', '/insurance-claims/quote', {
      insuranceCarrierId: cobertura.insuranceCarrierId,
      patientCoverageId: cobertura.id,
      lines: [linea('500.00', INTERNACION)],
    });
    expect(r.status).toBe(200);
    const cuerpo = r.body as { canSubmit: boolean; lines: { priorAuthorizationStatus: string }[] };
    expect(cuerpo.canSubmit).toBe(false);
    expect(cuerpo.lines[0]!.priorAuthorizationStatus).toBe('MISSING');
  });

  it('con la aprobación de la maqueta la misma cotización se puede enviar', () => {
    const cobertura = coberturaDePrueba();
    const r = llamar('POST', '/insurance-claims/quote', {
      insuranceCarrierId: cobertura.insuranceCarrierId,
      patientCoverageId: cobertura.id,
      priorAuthorizationRequestId: APROBACION_DE_PRUEBA,
      lines: [linea('500.00', INTERNACION)],
    });
    expect((r.body as { canSubmit: boolean }).canSubmit).toBe(true);
  });

  it('una aseguradora que no corresponde a la cobertura responde 422', () => {
    const cobertura = coberturaDePrueba();
    const r = llamar('POST', '/insurance-claims/quote', {
      insuranceCarrierId: uuid('otra-aseguradora'),
      patientCoverageId: cobertura.id,
      lines: [linea('500.00')],
    });
    expect(r.status).toBe(422);
  });

  it('una cobertura desconocida responde 404', () => {
    const cobertura = coberturaDePrueba();
    const r = llamar('POST', '/insurance-claims/quote', {
      insuranceCarrierId: cobertura.insuranceCarrierId,
      patientCoverageId: 'coverage-inexistente',
      lines: [linea('500.00')],
    });
    expect(r.status).toBe(404);
  });

  it('el envío del cobro acepta solo las claves de CreateClaimDto y responde 201', () => {
    const cobertura = coberturaDePrueba();
    const r = llamar('POST', '/insurance-claims', {
      insuranceCarrierId: cobertura.insuranceCarrierId,
      patientCoverageId: cobertura.id,
      billingProviderEntityId: uuid('practica-ejemplo'),
      claimIdentifier: 'COB-PRUEBA01',
      lines: [{ lineSequence: 1, serviceConceptId: CONSULTA, billedAmount: '500.00' }],
    });
    expect(r.status).toBe(201);
    expect((r.body as { id: string; status: string }).status).toBe('SUBMITTED');
    creados.push((r.body as { id: string }).id);
  });
});
