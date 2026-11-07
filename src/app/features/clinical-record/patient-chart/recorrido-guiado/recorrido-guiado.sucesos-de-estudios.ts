/* ============================================================================
    Templates of the studies: orders and their reports, each sentence with its
    sources (the rest of the clinical ones live in
    `recorrido-guiado.sucesos-clinicos.ts`).
    ========================================================================== */

import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';

import { enAtencion, frase, type Indices, type Nombres, type Suceso } from './recorrido-guiado.sucesos';
import { fechaCorta, fechaValida } from './recorrido-guiado.texto';

/** What the study was ordered for, by the diagnosis' status **at the time of the order**. */
export function propositoDeOrden(o: DiagnosticOrder, idx: Indices, n: Nombres): { texto: string; dx?: string } | null {
  const razonId = o.reasonConditionId;
  if (razonId === undefined) return null;
  const dx = idx.diagnosticos.get(razonId);
  if (dx === undefined) return { texto: 'para estudiar un diagnóstico que no está en esta lectura' };
  const nombre = n.diagnostico(dx);
  const veredicto = n.veredicto(dx);
  const decidido = fechaValida(dx.verification?.decidedAt);
  const pedida = fechaValida(o.createdAt);
  const yaDecidido =
    veredicto !== null && (decidido === null || (pedida !== null && decidido.getTime() <= pedida.getTime()));
  if (!yaDecidido) return { texto: `para confirmar o descartar ${nombre}`, dx: dx.id };
  return veredicto === 'CONFIRMED'
    ? { texto: `para el seguimiento de ${nombre}`, dx: dx.id }
    : { texto: `en relación con ${nombre} (diagnóstico ya descartado)`, dx: dx.id };
}

export function sucesosDeOrdenes(lista: readonly DiagnosticOrder[], idx: Indices, n: Nombres): Suceso[] {
  return lista.map((o) => {
    const estudio = n.estudio(o.codeConceptId);
    const lugar = enAtencion(idx, o.encounterId, fechaValida(o.createdAt));
    const proposito = propositoDeOrden(o, idx, n);
    return {
      clase: 'orden',
      ...lugar,
      titulo: `Pedido de ${estudio}`,
      enfocar: proposito?.dx === undefined ? [o.id] : [o.id, proposito.dx],
      frase: (ctx) => {
        if (proposito !== null) {
          return frase(
            `Se pidió ${estudio} ${proposito.texto}.`,
            proposito.dx === undefined ? [o.id] : [o.id, proposito.dx],
          );
        }
        if (lugar.atencionId !== undefined && ctx.atencionesConDiagnostico.has(lugar.atencionId)) {
          return frase(
            `En la misma atención se pidió ${estudio}; la orden no indica para qué diagnóstico.`,
            [o.id, lugar.atencionId],
            true,
          );
        }
        return frase(`Se pidió ${estudio}. No se registró para qué diagnóstico.`, [o.id]);
      },
    };
  });
}

export function sucesosDeInformes(lista: readonly DiagnosticReport[], idx: Indices, n: Nombres): Suceso[] {
  return lista.map((r) => {
    const orden = r.serviceRequestId === undefined ? undefined : idx.ordenes.get(r.serviceRequestId);
    const estudio = n.estudio(orden?.codeConceptId ?? r.codeConceptId);
    const liberado = r.currentReleasedVersionId !== undefined;
    const lugar = enAtencion(idx, r.encounterId, fechaValida(r.createdAt));
    const fuentes = orden === undefined ? [r.id] : [r.id, orden.id];
    return {
      clase: 'resultado',
      ...lugar,
      titulo: `Resultado de ${estudio}`,
      enfocar: fuentes,
      frase: () => {
        const pedida = fechaValida(orden?.createdAt);
        const proposito = orden === undefined ? null : propositoDeOrden(orden, idx, n);
        const origen =
          orden === undefined
            ? ''
            : ` (orden${pedida === null ? '' : ` del ${fechaCorta(pedida)}`}${
                proposito === null ? '' : `, ${proposito.texto}`
              })`;
        return frase(
          liberado
            ? `Se registró el informe de ${estudio}${origen}, con resultado liberado.`
            : `Se abrió el informe de ${estudio}${origen}; todavía no tiene un resultado liberado.`,
          proposito?.dx === undefined ? fuentes : [...fuentes, proposito.dx],
        );
      },
    };
  });
}
