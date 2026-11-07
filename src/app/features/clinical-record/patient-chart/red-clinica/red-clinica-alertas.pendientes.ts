/* ============================================================================
    Support alerts for what is still pending: unresolved presumptives, studies
    without a released result and open referrals.
    ========================================================================== */

import {
  CODIGO_ACTIVA,
  CODIGO_CONFIRMADO,
  CODIGO_DESCARTADO,
  diagnosisStateOf,
  type ResolverCodigo,
} from '../../../../shared/clinical/diagnosis-state';
import { antiguedad, diasEntre, fecha, prioridadPorPlazo } from './red-clinica-alertas.plazos';
import { UMBRALES_POR_OMISION, type AlertaDeApoyo, type EntradaDeAlertas } from './red-clinica-alertas.types';

const sinCodigo: ResolverCodigo = () => undefined;

/**
 * Unresolved presumptives: the condition is neither confirmed nor ruled out
 * (by catalogue **or** by the C3 decision) and was not resolved.
 */
export function presuntivosSinResolver(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const codigo = entrada.codigoDe ?? sinCodigo;
  const umbral = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.presuntivoDias;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  return (entrada.diagnosticos ?? [])
    .filter((c) => {
      if (c.verification?.outcome !== undefined) return false;
      if (c.resolvedAt !== undefined) return false;
      if (c.replacedByConditionId !== undefined) return false;
      const estado = diagnosisStateOf(
        {
          ...c,
          verificationStatusConceptId: codigo(c.verificationStatusConceptId),
          clinicalStatusConceptId: codigo(c.clinicalStatusConceptId),
        },
        { confirmed: CODIGO_CONFIRMADO, refuted: CODIGO_DESCARTADO, active: CODIGO_ACTIVA },
        entrada.ahora,
      );
      return estado === 'IN_STUDY';
    })
    .map((c) => {
      const dias = diasEntre(c.createdAt, entrada.ahora);
      const nombre = entrada.etiquetaDe?.(c.codeConceptId) ?? 'Diagnóstico presuntivo';
      const nodo = idDeNodo('diagnostico', c.id);
      const estudios = (entrada.ordenes ?? []).filter(
        (o) => o.reasonConditionId === c.id,
      );
      const conEstudios =
        estudios.length > 0
          ? ` ${estudios.length} ${estudios.length === 1 ? 'estudio pedido' : 'estudios pedidos'} para resolverlo.`
          : entrada.leidas?.ordenes === false ? '' : ' Sin estudios pedidos para confirmarlo o descartarlo.';
      return {
        id: `presuntivo-sin-resolver:${c.id}`,
        tipo: 'presuntivo-sin-resolver' as const,
        prioridad: prioridadPorPlazo(dias, umbral),
        titulo: `Presuntivo sin resolver: ${nombre}`,
        detalle: `Registrado ${antiguedad(dias)} (${fecha(c.createdAt)}), sigue sin confirmarse ni descartarse.${conEstudios}`,
        nodoId: nodo,
        nodoIds: [nodo, ...estudios.map((o) => idDeNodo('estudio', o.id))],
        dias,
      };
    });
}

const ESTADO_DE_ORDEN_CERRADA = /CANCEL|REVOK|ENTERED_IN_ERROR|ERROR|ANULAD/;

/**
 * Ordered studies without a **released** result. An order satisfied by a
 * previous report (deduplication) does not count, nor a cancelled or voided one.
 */
export function estudiosSinResultado(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  if (entrada.leidas?.informes === false) return []; // Reports cut or unread: the result may exist.
  const codigo = entrada.codigoDe ?? sinCodigo;
  const umbral = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.estudioDias;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const liberadas = new Set(
    (entrada.informes ?? [])
      .filter((i) => i.currentReleasedVersionId !== undefined && i.serviceRequestId !== undefined)
      .map((i) => i.serviceRequestId as string),
  );
  return (entrada.ordenes ?? [])
    .filter((o) => !liberadas.has(o.id))
    .filter((o) => o.previousDiagnosticReportId === undefined)
    .filter((o) => !ESTADO_DE_ORDEN_CERRADA.test(codigo(o.statusConceptId) ?? ''))
    .map((o) => {
      const dias = diasEntre(o.createdAt, entrada.ahora);
      const nombre = entrada.etiquetaDe?.(o.codeConceptId) ?? 'Estudio';
      const nodo = idDeNodo('estudio', o.id);
      const motivo = o.reasonConditionId;
      const borrador = (entrada.informes ?? []).some(
        (i) => i.serviceRequestId === o.id && i.currentVersionId !== undefined,
      );
      return {
        id: `estudio-sin-resultado:${o.id}`,
        tipo: 'estudio-sin-resultado' as const,
        prioridad: prioridadPorPlazo(dias, umbral),
        titulo: `Estudio sin resultado liberado: ${nombre}`,
        detalle:
          `Pedido ${antiguedad(dias)} (${fecha(o.createdAt)}).` +
          (borrador ? ' Hay un informe en redacción, todavía no validado.' : ' Aún no hay informe.'),
        nodoId: nodo,
        nodoIds: motivo === undefined ? [nodo] : [nodo, idDeNodo('diagnostico', motivo)],
        dias,
      };
    });
}

/** Referrals without an answer from the destination, and accepted ones without counter-referral. */
export function derivacionesAbiertas(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const umbrales = { ...UMBRALES_POR_OMISION, ...entrada.umbrales };
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const alertas: AlertaDeApoyo[] = [];
  for (const r of entrada.derivaciones ?? []) {
    const destino = r.targetDisplayName ?? r.targetTenantName ?? r.targetExternalName ?? 'el destino';
    const nodo = idDeNodo('derivacion', r.id);
    const estado = r.status;
    if (estado === 'CANCELLED' || estado === 'REJECTED') continue;

    const sinRespuesta =
      estado === 'PENDING' || (estado === undefined && r.respondedAt === undefined);
    if (sinRespuesta) {
      const dias = diasEntre(r.createdAt, entrada.ahora);
      alertas.push({
        id: `derivacion-sin-respuesta:${r.id}`,
        tipo: 'derivacion-sin-respuesta',
        prioridad: prioridadPorPlazo(dias, umbrales.derivacionDias),
        titulo: `Derivación sin respuesta de ${destino}`,
        detalle: `Enviada ${antiguedad(dias)} (${fecha(r.createdAt)}); el destino no la aceptó ni la rechazó.`,
        nodoId: nodo,
        nodoIds: [nodo],
        dias,
      });
      continue;
    }

    if (r.counterReferralText !== undefined && r.counterReferralText.trim() !== '') continue;
    const llegada = r.transfer?.arrivedAt;
    // It only exists after ACCEPT: the destination writes it on accepting or on recording the arrival.
    const atencionDestino = r.targetEncounterId;
    const desde = llegada ?? r.respondedAt;
    // Without an arrival or a dated answer there is nothing to count from: no warning.
    if (desde === undefined) continue;
    const dias = diasEntre(desde, entrada.ahora);
    if (dias < umbrales.contrarreferenciaDias) continue;
    const ids = [nodo];
    if (atencionDestino !== undefined) ids.push(idDeNodo('atencion', atencionDestino));
    alertas.push({
      id: `derivacion-sin-contrarreferencia:${r.id}`,
      tipo: 'derivacion-sin-contrarreferencia',
      prioridad: prioridadPorPlazo(dias, umbrales.contrarreferenciaDias * 2),
      titulo: `Derivación sin contrarreferencia de ${destino}`,
      detalle:
        (llegada !== undefined
          ? `El paciente llegó ${antiguedad(dias)} (${fecha(llegada)})`
          : `Aceptada ${antiguedad(dias)} (${fecha(desde)})`) +
        '; el destino todavía no devolvió su informe.',
      nodoId: nodo,
      nodoIds: ids,
      dias,
    });
  }
  return alertas;
}
