import { conceptoPorId } from '../fixtures/conceptos';
import { PACIENTES, PROFESIONALES, type ProfesionalSimulado } from '../fixtures/personas';
import { forbidden, type MockRequest, type MockRouter } from '../mock-router';
import { iso, isoDia, uuid } from '../mock-store';
import { nombreDeAseguradora, perteneceALaAseguradora } from './insurance.handlers';

/* ============================================================================
    Solicitudes recibidas por la aseguradora — `GET /insurance/received-claims`.

    La cara de quien paga del mismo `insurance_claims` que el prestador ve en
    «Solicitudes de seguro». La API todavía no la expone; el contrato está en
    `docs/contracts/insurer-received-claims.md` (repo del front).

    Nadie real aparece acá: los médicos son los escritos de la maqueta y los
    `DEMO` —nunca los de la red de una aseguradora ni los registrados, porque
    atribuirles una prestación sería afirmar algo sobre alguien que existe— y
    los pacientes son los escritos y los generados, no las personas de
    `USUARIO_PACIENTES_1.md`.
    ========================================================================== */

/** Cuántas solicitudes siembra el simulador: suficientes para paginar y filtrar. */
const SOLICITUDES_SEMBRADAS = 180;

/** Tope que declara el contrato: por encima, `truncated: true`. */
const TOPE_DE_SOLICITUDES = 500;

/** Pacientes escritos + los primeros generados; los registrados quedan fuera. */
const PACIENTES_ELEGIBLES = PACIENTES.slice(0, 60);

const BOB = { code: 'BOB', display: 'Boliviano' };
const money = (amount: string) => ({ amount, currency: BOB });

const SERVICIOS: readonly (readonly [code: string, display: string, precioBase: number])[] = [
  ['SVC_CONSULTA_ESPECIALIDAD', 'Consulta de especialidad', 250],
  ['SVC_CONSULTA_GENERAL', 'Consulta general', 150],
  ['SVC_ECOGRAFIA', 'Ecografía', 320],
  ['SVC_ECG', 'Electrocardiograma', 120],
  ['SVC_HEMOGRAMA', 'Hemograma completo', 80],
  ['SVC_PERFIL_LIPIDICO', 'Perfil lipídico', 90],
  ['SVC_RX_TORAX', 'Radiografía de tórax', 180],
  ['SVC_FISIOTERAPIA', 'Sesión de fisioterapia', 110],
  ['SVC_CIRUGIA_MENOR', 'Cirugía menor', 1200],
  ['SVC_INTERNACION_DIA', 'Internación (día)', 900],
];

/** Estado y qué fracción del monto aprueba (`null` = sin dictamen todavía). */
const ESTADOS: readonly (readonly [code: string, display: string, aprobado: number | null])[] = [
  ['SUBMITTED', 'Enviada', null],
  ['IN_REVIEW', 'En revisión', null],
  ['APPROVED', 'Aprobada', 0.8],
  ['PARTIAL', 'Aprobada parcialmente', 0.5],
  ['REJECTED', 'Rechazada', 0],
  ['PAID', 'Pagada', 0.8],
];

const PLANES = ['Plan Integral', 'Plan Familiar', 'Plan Oro'] as const;

/** Generador congruencial: la misma semilla da siempre la misma sala. */
function azar(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (Math.imul(estado, 1_664_525) + 1_013_904_223) >>> 0;
    return estado / 0x1_0000_0000;
  };
}

function elegir<T>(lista: readonly T[], r: () => number): T {
  return lista[Math.floor(r() * lista.length)]!;
}

function medicosElegibles(): readonly ProfesionalSimulado[] {
  return PROFESIONALES.filter((p) => p.origen === undefined || p.origen === 'DEMO');
}

function especialidadDe(medico: ProfesionalSimulado): string | null {
  const id = medico.especialidades[0];
  return id === undefined ? null : (conceptoPorId(id)?.display ?? null);
}

function sembrar() {
  const r = azar(20_260_927);
  const medicos = medicosElegibles();
  const aseguradora = nombreDeAseguradora(0);

  return Array.from({ length: SOLICITUDES_SEMBRADAS }, (_, i) => {
    const paciente = elegir(PACIENTES_ELEGIBLES, r);
    const medico = elegir(medicos, r);
    const [code, display, precioBase] = elegir(SERVICIOS, r);
    const adicionales = r() < 0.3 ? 1 + Math.floor(r() * 3) : 0;
    const monto = precioBase * (0.9 + r() * 0.4) + adicionales * 85;
    // Las recientes siguen abiertas; las viejas ya tienen dictamen o pago.
    const diasAtras = Math.floor(r() * 180);
    const estado =
      diasAtras < 7
        ? elegir(ESTADOS.slice(0, 2), r)
        : diasAtras < 30
          ? elegir(ESTADOS.slice(1, 5), r)
          : elegir(ESTADOS.slice(2), r);
    const [estadoCode, estadoDisplay, fraccion] = estado;
    const prestacionDiasAtras = diasAtras + Math.floor(r() * 10);

    return {
      id: uuid(`received-claim-${i}`),
      claimIdentifier: `CLM-2026-${String(1000 + i).padStart(4, '0')}`,
      patient: {
        id: paciente.id,
        displayName: paciente.displayName,
        patientCode: paciente.patientCode,
        memberIdentifier: `AF-${paciente.patientCode.slice(4)}`,
      },
      practitioner: {
        id: medico.id,
        displayName: medico.displayName,
        specialty: especialidadDe(medico),
      },
      providerName: medico.organizacion,
      service: { code, display },
      additionalServiceCount: adicionales,
      billedTotal: money(monto.toFixed(2)),
      approvedTotal: fraccion === null ? null : money((monto * fraccion).toFixed(2)),
      submittedAt: iso(-diasAtras, 8 + (i % 10), (i * 7) % 60),
      serviceDate: isoDia(-prestacionDiasAtras),
      policyIdentifier: `POL-${200300 + i * 13}`,
      planName: `${aseguradora} · ${elegir(PLANES, r)}`,
      status: { code: estadoCode, display: estadoDisplay },
    };
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** Se siembra una vez, al primer pedido: la lista es de sólo lectura. */
let sembradas: ReturnType<typeof sembrar> | null = null;

function puedeVer(request: MockRequest): boolean {
  return perteneceALaAseguradora(request) || (request.user?.roles.includes('SUPERADMIN') ?? false);
}

export function registerInsurerReceivedClaims(router: MockRouter): void {
  router.get('/insurance/received-claims', (request) => {
    if (!puedeVer(request)) return forbidden();
    sembradas ??= sembrar();
    return {
      items: sembradas.slice(0, TOPE_DE_SOLICITUDES),
      truncated: sembradas.length > TOPE_DE_SOLICITUDES,
    };
  });
}
