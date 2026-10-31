import { camposDeDetalle, resumenDeOrden } from './service-request-detail.mock';

/**
 * El detalle de lo pedido en `GET /diagnostic-results/me/orders`: muestra,
 * componentes, imagen y el resumen de una línea, por orden del paciente.
 *
 * Sale del mismo almacén que la bandeja del ejecutor y el alta de requisición,
 * así que lo que el médico marcó es lo que el paciente ve. Una orden sin
 * detalle guardado (sembrada) vuelve como «estudio completo, sin detalle»
 * (`componentsSpecified: false`), igual que la API.
 */
export function detalleDeOrdenPropia(orden: { readonly id: string; readonly codeConceptId: string }) {
  return {
    ...camposDeDetalle(orden.id, orden.codeConceptId),
    summary: resumenDeOrden(orden.id, orden.codeConceptId),
  };
}
