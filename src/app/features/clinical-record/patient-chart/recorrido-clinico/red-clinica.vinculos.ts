/* ============================================================================
    The links the clinical network **deduces**, and every link in words.
    ========================================================================== */

import { diaClinico } from './dia-clinico';
import type { MotivoDelVinculo, RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';

/**
 * The links the network **deduces**, always marked as such.
 *
 * - A study ordered in an encounter where a presumptive diagnosis was entered,
 *   without `reasonConditionId`: it was probably ordered to confirm it. Only if
 *   that encounter has **one** presumptive: with two, there is no way to know
 *   which and the network does not pick.
 * - An appointment with no stored link and an encounter on the same day: it is
 *   probably that appointment's encounter. Only if that day has **one**
 *   encounter, and only for appointments that were neither cancelled nor
 *   no-shows (the adapter decides that, since it knows the status: see
 *   `citaAtendible`).
 *
 * It never replaces a real link: if the study already has its diagnosis or the
 * appointment is already tied to an encounter, nothing is inferred.
 */
export function inferirVinculos(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
  citaAtendible: (id: string) => boolean = () => true,
): readonly VinculoDeLaRed[] {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const inferidos: VinculoDeLaRed[] = [];
  const conDiagnostico = new Set(
    vinculos.filter((v) => v.motivo === 'pedido-para').map((v) => v.hasta),
  );
  const presuntivosPorAtencion = new Map<string, string[]>();
  for (const r of registros) {
    if (r.clase === 'diagnostico' && r.certeza === 'presuntivo' && r.encuentroId !== undefined) {
      presuntivosPorAtencion.set(r.encuentroId, [...(presuntivosPorAtencion.get(r.encuentroId) ?? []), r.id]);
    }
  }
  for (const r of registros) {
    if (r.clase !== 'estudio' || conDiagnostico.has(r.id) || r.encuentroId === undefined) {
      continue;
    }
    const presuntivos = presuntivosPorAtencion.get(r.encuentroId) ?? [];
    if (presuntivos.length === 1) {
      inferidos.push({ desde: presuntivos[0], hasta: r.id, motivo: 'inferido-misma-atencion' });
    }
  }

  const citasAtadas = new Set<string>();
  for (const v of vinculos) {
    const a = porId.get(v.desde);
    const b = porId.get(v.hasta);
    if (a?.clase === 'cita' && b?.clase === 'atencion') citasAtadas.add(a.id);
    if (b?.clase === 'cita' && a?.clase === 'atencion' && v.motivo !== 'reconsulta-de') citasAtadas.add(b.id);
  }
  const atencionesPorDia = new Map<string, string[]>();
  for (const r of registros) {
    if (r.clase === 'atencion' && r.cuando !== null) {
      const dia = claveDelDia(r.cuando);
      atencionesPorDia.set(dia, [...(atencionesPorDia.get(dia) ?? []), r.id]);
    }
  }
  for (const r of registros) {
    if (r.clase !== 'cita' || r.cuando === null || citasAtadas.has(r.id) || !citaAtendible(r.id)) {
      continue;
    }
    const delDia = atencionesPorDia.get(claveDelDia(r.cuando)) ?? [];
    if (delDia.length === 1) {
      inferidos.push({ desde: r.id, hasta: delDia[0], motivo: 'inferido-mismo-dia' });
    }
  }
  return inferidos;
}

/** The clinical day key, `yyyy-mm-dd` (`dia-clinico.ts`: the same day as the guided tour). */
export const claveDelDia = diaClinico;

/**
 * A record's relations, in words: what replaces the lines in the accessible
 * name and in the vertical version. Inferred ones say so.
 */
export function relacionesDe(
  id: string,
  vinculos: readonly VinculoDeLaRed[],
  porId: ReadonlyMap<string, RegistroDeLaRed>,
): readonly string[] {
  const frases: string[] = [];
  const nombre = (otro: string): string => porId.get(otro)?.titulo ?? 'un registro';
  for (const v of vinculos) {
    if (v.hasta === id) {
      const origen = nombre(v.desde);
      const frase: Partial<Record<MotivoDelVinculo, string>> = {
        'registrado-en': `registrado en la atención ${origen}`,
        'indicado-para': `indicado para ${origen}`,
        'pedido-para': `pedido para ${origen}`,
        'resultado-de': `resultado del estudio ${origen}`,
        'reemplazado-por': `reemplaza al diagnóstico descartado ${origen}`,
        'receta-reemplazada': `reemplaza a la receta ${origen}`,
        evidencia: `decidido con la evidencia de ${origen}`,
        'plan-para': `plan para ${origen}`,
        'derivado-desde': `derivación desde la atención ${origen}`,
        'recibido-en': `atención de destino de la derivación ${origen}`,
        'reconsulta-de': `reconsulta de ${origen}`,
        'durante-internacion': `durante la internación ${origen}`,
        'inferido-misma-atencion': `vínculo inferido: pedido en la misma atención que el presuntivo ${origen}`,
        'inferido-mismo-dia': `vínculo inferido: atención del mismo día que la cita ${origen}`,
      };
      frases.push(frase[v.motivo] ?? '');
    }
    if (v.desde === id) {
      const destino = nombre(v.hasta);
      const frase: Partial<Record<MotivoDelVinculo, string>> = {
        'indicado-para': `tratado con ${destino}`,
        'pedido-para': `se pidió ${destino}`,
        'resultado-de': `con resultado ${destino}`,
        'reemplazado-por': `descartado y reemplazado por ${destino}`,
        'receta-reemplazada': `reemplazada por ${destino}`,
        'derivado-desde': `derivó: ${destino}`,
        'recibido-en': `recibida en la atención ${destino}`,
        'inferido-misma-atencion': `vínculo inferido: estudio ${destino} pedido en la misma atención`,
        'inferido-mismo-dia': `vínculo inferido: atendida el mismo día en ${destino}`,
      };
      frases.push(frase[v.motivo] ?? '');
    }
  }
  return frases.filter((f) => f !== '');
}
