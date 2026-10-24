import type {
  SimulatedCharge,
  SimulatedInvoice,
} from '../../core/data-access/billing-simulated/billing-simulated.types';
import { cobrosIniciales, EMISORES_SIMULADOS, PADRON_SIMULADO } from '../../core/mock/billing-sim/datos-simulados';
import { FacturacionSimulada } from '../../core/mock/billing-sim/facturacion-simulada';
import { SiatSimuladoAdapter } from '../../core/mock/siat-sim/siat-simulado.adapter';

/**
 * Datos de prueba de la pantalla, producidos por el **mismo motor** que
 * responde en la maqueta: si el contrato cambia, las pruebas de la pantalla lo
 * notan en vez de seguir pasando con un objeto escrito a mano.
 */
export const INSTANTE_DE_PRUEBA = new Date('2026-09-15T14:00:00.000Z');

export function motorDePrueba(): FacturacionSimulada {
  const reloj = () => INSTANTE_DE_PRUEBA;
  return new FacturacionSimulada({
    siat: new SiatSimuladoAdapter({ padron: PADRON_SIMULADO, reloj }),
    emisores: EMISORES_SIMULADOS,
    cobros: cobrosIniciales(),
    reloj,
  });
}

export function cobrosDePrueba(): readonly SimulatedCharge[] {
  return motorDePrueba().listarCobros();
}

export function facturaDePrueba(source: 'CONSULTATION' | 'PHARMACY' = 'PHARMACY'): SimulatedInvoice {
  const motor = motorDePrueba();
  const cobro = motor.listarCobros().find((c) => c.source === source && c.payment !== null)!;
  const r = motor.emitirFactura(
    cobro.id,
    { buyer: { name: cobro.suggestedBuyer.name, documentTypeCode: 1, documentNumber: cobro.suggestedBuyer.documentNumber || '1234567' } },
    'prueba',
  );
  if (!r.ok) throw new Error(`La factura de prueba no se emitió: ${r.error.message}`);
  return r.value;
}
