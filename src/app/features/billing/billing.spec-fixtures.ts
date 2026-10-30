import type {
  SimulatedCharge,
  SimulatedInvoice,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import { initialCharges, SIMULATED_ISSUERS, SIMULATED_REGISTRY } from '../../core/mock/billing-sim/simulated-data';
import { SimulatedInvoicing } from '../../core/mock/billing-sim/simulated-invoicing';
import { SiatSimulatedAdapter } from '../../core/mock/siat-sim/siat-simulated.adapter';

/**
 * Datos de prueba de la pantalla, producidos por el **mismo motor** que
 * responde en la maqueta: si el contrato cambia, las pruebas de la pantalla lo
 * notan en vez de seguir pasando con un objeto escrito a mano.
 */
export const INSTANTE_DE_PRUEBA = new Date('2026-09-15T14:00:00.000Z');

export function motorDePrueba(): SimulatedInvoicing {
  const reloj = () => INSTANTE_DE_PRUEBA;
  return new SimulatedInvoicing({
    siat: new SiatSimulatedAdapter({ padron: SIMULATED_REGISTRY, reloj }),
    emisores: SIMULATED_ISSUERS,
    cobros: initialCharges(),
    reloj,
  });
}

export function cobrosDePrueba(): readonly SimulatedCharge[] {
  return motorDePrueba().listCharges();
}

export function facturaDePrueba(source: 'CONSULTATION' | 'PHARMACY' = 'PHARMACY'): SimulatedInvoice {
  const motor = motorDePrueba();
  const cobro = motor.listCharges().find((c) => c.source === source && c.payment !== null)!;
  const r = motor.issueInvoice(
    cobro.id,
    { buyer: { name: cobro.suggestedBuyer.name, documentTypeCode: 1, documentNumber: cobro.suggestedBuyer.documentNumber || '1234567' } },
    'prueba',
  );
  if (!r.ok) throw new Error(`La factura de prueba no se emitió: ${r.error.message}`);
  return r.value;
}
