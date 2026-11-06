/* ============================================================================
    Clinical templates: admission, encounter, diagnosis and its verification,
    and prescriptions (orders and reports live in
    `recorrido-guiado.sucesos-de-estudios.ts`). Each sentence carries its
    sources.
    ========================================================================== */

import type {
  CareEpisode,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';

import {
  enAtencion,
  fechaDeAtencion,
  frase,
  type Indices,
  type Nombres,
  type Suceso,
} from './recorrido-guiado.sucesos';
import { diaClinico, fechaCorta, fechaValida, libre, minusculaInicial } from './recorrido-guiado.texto';
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
      (decididoEl === null || (alta.fecha !== null && diaClinico(decididoEl) === diaClinico(alta.fecha)));

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
  if (atencionId !== undefined && fecha !== null && deLaAtencion !== null && diaClinico(deLaAtencion) === diaClinico(fecha)) {
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
      `${mismoDia ? `Se registró ${nombre} como diagnóstico confirmado` : `Se confirmó ${nombre}`}${base}${
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

export function sucesosDeRecetas(lista: readonly MedicationRequest[], idx: Indices, n: Nombres): Suceso[] {
  // A quién reemplaza cada receta. El resumen publica sólo el lado de la vieja
  // (`replacedByRequestId`); el inverso se deduce de la lista.
  const reemplazaA = new Map<string, MedicationRequest>();
  for (const r of lista) {
    const nueva = r.replacedByRequestId;
    if (nueva !== undefined && nueva !== '' && nueva !== r.id) reemplazaA.set(nueva, r);
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
          texto += ` Reemplaza a la receta de ${n.medicamento(anterior.medicationConceptId)}${
            desde === null ? '' : ` del ${fechaCorta(desde)}`
          }.`;
        }
        return frase(texto, fuentes, inferida);
      },
    };
  });
}
