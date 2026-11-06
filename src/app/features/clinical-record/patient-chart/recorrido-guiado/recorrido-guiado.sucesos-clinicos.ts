/* ============================================================================
    Plantillas de lo clínico: internación, atención, diagnóstico y su
    verificación, órdenes, informes y recetas. Cada frase lleva sus fuentes.
    ========================================================================== */

import type {
  CareEpisode,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../../core/data-access/diagnostics/diagnostics.types';

import {
  enAtencion,
  fechaDeAtencion,
  frase,
  porId,
  type Indices,
  type Nombres,
  type Suceso,
} from './recorrido-guiado.sucesos';
import { diaUtc, fechaCorta, fechaValida, libre, minusculaInicial, vinculo } from './recorrido-guiado.texto';
import type { FraseDelPaso } from './recorrido-guiado.types';

export function sucesosDeInternaciones(lista: readonly CareEpisode[], n: Nombres): Suceso[] {
  return lista.flatMap((e) => {
    const inicio = fechaValida(e.startAt) ?? fechaValida(e.createdAt);
    const tipo = n.concepto(e.typeConceptId);
    const sucesos: Suceso[] = [
      {
        clase: 'internacion',
        fecha: inicio,
        titulo: 'Ingreso a internación',
        enfocar: [e.id],
        frase: () =>
          frase(`Ingresó a internación${tipo === undefined ? '' : ` (${minusculaInicial(tipo)})`}.`, [e.id]),
      },
    ];
    const fin = fechaValida(e.endAt);
    if (fin !== null) {
      sucesos.push({
        clase: 'alta',
        fecha: fin,
        titulo: 'Alta de internación',
        enfocar: [e.id],
        frase: () =>
          frase(
            inicio === null
              ? 'Recibió el alta de la internación.'
              : `Recibió el alta de la internación iniciada el ${fechaCorta(inicio)}.`,
            [e.id],
          ),
      });
    }
    return sucesos;
  });
}

export function sucesosDeAtenciones(lista: readonly Encounter[], idx: Indices, n: Nombres): Suceso[] {
  return lista.map((a) => {
    const servicio = n.servicio(a);
    const clase = n.concepto(a.classConceptId);
    const motivo = libre(a.reasonText);
    const profesional = n.profesional(a.primaryPractitionerId);
    const internacion = a.episodeId === undefined ? undefined : idx.internaciones.get(a.episodeId);
    return {
      clase: 'atencion',
      fecha: fechaValida(a.startAt),
      atencionId: a.id,
      titulo: servicio === undefined ? 'Atención' : `Consulta en ${servicio}`,
      enfocar: [a.id],
      frase: () => {
        let texto =
          servicio === undefined
            ? `Tuvo una atención${clase === undefined ? '' : ` (${minusculaInicial(clase)})`}`
            : `Consultó en ${servicio}`;
        if (profesional !== undefined) texto += ` con ${profesional}`;
        if (motivo !== undefined) texto += ` por ${minusculaInicial(motivo)}`;
        if (internacion !== undefined) texto += ', durante la internación';
        texto += motivo === undefined ? '. No se registró el motivo.' : '.';
        const fuentes = internacion === undefined ? [a.id] : [a.id, internacion.id];
        return frase(texto, fuentes);
      },
    };
  });
}

export function sucesosDeDiagnosticos(lista: readonly Condition[], idx: Indices, n: Nombres): Suceso[] {
  return lista.flatMap((c) => {
    const nombre = n.diagnostico(c);
    const veredicto = n.veredicto(c);
    const decididoEl = fechaValida(c.verification?.decidedAt);
    const alta = enAtencion(idx, c.encounterId, fechaValida(c.createdAt));
    // Sin instante de decisión, el veredicto del catálogo se lee como del alta.
    const mismoDia =
      veredicto !== null &&
      (decididoEl === null || (alta.fecha !== null && diaUtc(decididoEl) === diaUtc(alta.fecha)));

    const sucesos: Suceso[] = [];
    if (!mismoDia) {
      sucesos.push({
        clase: 'diagnostico',
        ...alta,
        titulo: `Se planteó ${nombre}`,
        enfocar: [c.id],
        frase: () => frase(`Se planteó ${nombre} como diagnóstico presuntivo.`, [c.id]),
      });
    }
    if (veredicto !== null) {
      const lugar = mismoDia ? alta : lugarDeDecision(c, decididoEl ?? alta.fecha, idx);
      sucesos.push({
        clase: 'decision',
        ...lugar,
        titulo: veredicto === 'CONFIRMED' ? `Se confirmó ${nombre}` : `Se descartó ${nombre}`,
        enfocar: [c.id, ...idsDeEvidencia(c)],
        frase: () => fraseDeDecision(c, veredicto, mismoDia, idx, n),
      });
    }
    return sucesos;
  });
}

/** La decisión va a su día; se ata a la atención de la evidencia sólo si es ese mismo día. */
export function lugarDeDecision(
  c: Condition,
  fecha: Date | null,
  idx: Indices,
): { atencionId?: string; fecha: Date | null } {
  const atencionId = c.verification?.basedOn?.encounterId;
  const deLaAtencion = fechaDeAtencion(idx, atencionId);
  if (atencionId !== undefined && fecha !== null && deLaAtencion !== null && diaUtc(deLaAtencion) === diaUtc(fecha)) {
    return { atencionId, fecha };
  }
  return { fecha };
}

export function idsDeEvidencia(c: Condition): string[] {
  const reemplazo = c.replacedByConditionId;
  const b = c.verification?.basedOn;
  return [b?.serviceRequestId, b?.diagnosticReportId, reemplazo].filter(
    (id): id is string => id !== undefined && id.length > 0,
  );
}

export function fraseDeDecision(
  c: Condition,
  veredicto: 'CONFIRMED' | 'REFUTED',
  mismoDia: boolean,
  idx: Indices,
  n: Nombres,
): FraseDelPaso {
  const nombre = n.diagnostico(c);
  const fuentes = [c.id];
  const motivo = libre(c.verification?.reasonText);
  const base = textoDeEvidencia(c, idx, n, fuentes);
  const partes: string[] = [];

  if (veredicto === 'CONFIRMED') {
    partes.push(
      `${mismoDia ? `Se diagnosticó ${nombre} y quedó confirmado` : `Se confirmó ${nombre}`}${base}${
        motivo === undefined ? '' : `: ${motivo}`
      }.`,
    );
    return frase(partes.join(' '), fuentes);
  }

  partes.push(
    `${mismoDia ? `Se consideró ${nombre} y se descartó` : `Se descartó ${nombre}`}${base}${
      motivo === undefined ? '' : `: ${motivo}`
    }.`,
  );
  if (motivo === undefined) partes.push('No se registró el motivo del descarte.');

  const reemplazoId = c.replacedByConditionId;
  if (reemplazoId !== undefined && reemplazoId !== c.id) {
    const reemplazo = idx.diagnosticos.get(reemplazoId);
    if (reemplazo === undefined) {
      partes.push('En su lugar se registró otro diagnóstico, que no está en esta lectura.');
    } else {
      fuentes.push(reemplazo.id);
      const suyo = n.veredicto(reemplazo);
      const nombreReemplazo = n.diagnostico(reemplazo);
      partes.push(
        suyo === 'CONFIRMED'
          ? `En su lugar se confirmó ${nombreReemplazo}.`
          : suyo === 'REFUTED'
            ? `En su lugar se planteó ${nombreReemplazo}, que después también se descartó.`
            : `En su lugar se planteó ${nombreReemplazo}, todavía en estudio.`,
      );
    }
  }
  return frase(partes.join(' '), fuentes);
}

/** « con base en el resultado de tomografía de cráneo», o vacío. Agrega sus fuentes. */
export function textoDeEvidencia(c: Condition, idx: Indices, n: Nombres, fuentes: string[]): string {
  const b = c.verification?.basedOn;
  if (b === null || b === undefined) return '';
  const informe = b.diagnosticReportId === undefined ? undefined : idx.informes.get(b.diagnosticReportId);
  const orden =
    b.serviceRequestId === undefined
      ? informe?.serviceRequestId === undefined
        ? undefined
        : idx.ordenes.get(informe.serviceRequestId)
      : idx.ordenes.get(b.serviceRequestId);
  if (orden !== undefined || informe !== undefined) {
    if (orden !== undefined) fuentes.push(orden.id);
    if (informe !== undefined) fuentes.push(informe.id);
    return ` con base en el resultado de ${n.estudio(orden?.codeConceptId ?? informe?.codeConceptId)}`;
  }
  if (b.encounterId !== undefined && idx.atenciones.has(b.encounterId)) {
    const fecha = fechaDeAtencion(idx, b.encounterId);
    fuentes.push(b.encounterId);
    return fecha === null ? ' con base en una atención' : ` con base en la atención del ${fechaCorta(fecha)}`;
  }
  if (b.noteId !== undefined) return ' con base en una nota clínica';
  if (b.kind === 'ANALYSIS') return ' con base en un análisis que no está en esta lectura';
  return '';
}

/** Para qué se pidió el estudio, según el estado del diagnóstico **en el momento del pedido**. */
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
    : { texto: `en relación con ${nombre}, ya descartado`, dx: dx.id };
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
            : `, pedida${pedida === null ? '' : ` el ${fechaCorta(pedida)}`}${
                proposito === null ? '' : ` ${proposito.texto}`
              }`;
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

export function sucesosDeRecetas(lista: readonly MedicationRequest[], idx: Indices, n: Nombres): Suceso[] {
  // A quién reemplaza cada receta: el vínculo puede venir de cualquiera de los dos lados.
  const reemplazaA = new Map<string, MedicationRequest>();
  const porIdReceta = porId(lista);
  for (const r of lista) {
    const nueva = vinculo(r, 'replacedByRequestId');
    if (nueva !== undefined && nueva !== r.id) reemplazaA.set(nueva, r);
  }
  for (const r of lista) {
    const vieja = vinculo(r, 'replacesRequestId');
    const anterior = vieja === undefined ? undefined : porIdReceta.get(vieja);
    if (anterior !== undefined && anterior.id !== r.id && !reemplazaA.has(r.id)) reemplazaA.set(r.id, anterior);
  }

  return lista.map((r) => {
    const medicamento = n.medicamento(r.medicationConceptId);
    const lugar = enAtencion(idx, r.encounterId, fechaValida(r.issuedAt ?? r.signedAt ?? r.createdAt));
    const dx = r.indicationConditionId === undefined ? undefined : idx.diagnosticos.get(r.indicationConditionId);
    const anterior = reemplazaA.get(r.id);
    return {
      clase: 'receta',
      ...lugar,
      titulo: `Receta de ${medicamento}`,
      enfocar: [r.id, ...(dx === undefined ? [] : [dx.id]), ...(anterior === undefined ? [] : [anterior.id])],
      frase: (ctx) => {
        const dosis = [libre(r.doseText), libre(r.frequencyText)].filter((p): p is string => p !== undefined);
        const detalle = dosis.length === 0 ? '' : ` (${dosis.join(', ')})`;
        const fuentes = [r.id];
        let inferida = false;
        let para: string;
        if (dx !== undefined) {
          fuentes.push(dx.id);
          para = ` para tratar ${n.diagnostico(dx)}`;
        } else if (r.indicationConditionId !== undefined) {
          para = ' para un diagnóstico que no está en esta lectura';
        } else if (libre(r.indicationText) !== undefined) {
          para = ` con la indicación «${libre(r.indicationText)}»`;
        } else if (lugar.atencionId !== undefined && ctx.atencionesConDiagnostico.has(lugar.atencionId)) {
          fuentes.push(lugar.atencionId);
          inferida = true;
          para = ' en la misma atención; la receta no indica para qué diagnóstico';
        } else {
          para = '. No se registró la indicación';
        }
        let texto = `Se indicó ${medicamento}${detalle}${para}.`;
        if (anterior !== undefined) {
          fuentes.push(anterior.id);
          const desde = fechaValida(anterior.issuedAt ?? anterior.signedAt ?? anterior.createdAt);
          texto += ` Reemplaza a ${n.medicamento(anterior.medicationConceptId)}${
            desde === null ? '' : `, indicado el ${fechaCorta(desde)}`
          }.`;
        }
        return frase(texto, fuentes, inferida);
      },
    };
  });
}
