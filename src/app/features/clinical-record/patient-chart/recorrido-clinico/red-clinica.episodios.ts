/* ============================================================================
    Grouping the network's records into episodes (ADR-0021; the rule is
    summarised in the header of `red-clinica.model.ts`).
    ========================================================================== */

import type { MotivoDelVinculo, RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';
import { antes, armarEpisodio, ID_SIN_DIAGNOSTICO, type RedPorEpisodios } from './red-clinica.episodio';

/** The links that pull the target into the source's episode, and in which direction. */
const HEREDA_DEL_ORIGEN: ReadonlySet<MotivoDelVinculo> = new Set<MotivoDelVinculo>([
  'indicado-para',
  'pedido-para',
  'resultado-de',
  'plan-para',
  'receta-reemplazada',
]);

/** Those that pull only if the target has no episode of its own; inferred ones last (ADR-0021). */
const HEREDA_SI_HUERFANO: ReadonlySet<MotivoDelVinculo> = new Set<MotivoDelVinculo>([
  'resultado-de',
  'inferido-misma-atencion',
  'registrado-en',
  'derivado-desde',
  'recibido-en',
  'reconsulta-de',
  'inferido-mismo-dia',
]);

/** Groups the records into episodes. See the rule in the ADR. */
export function agruparEnEpisodios(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
): RedPorEpisodios {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const validos = vinculos.filter(
    (v) => v.desde !== v.hasta && porId.has(v.desde) && porId.has(v.hasta),
  );
  const diagnosticos = registros.filter((r) => r.clase === 'diagnostico');

  /* 1 · The chains: union of diagnoses by concept and by replacement. */
  const padre = new Map<string, string>(diagnosticos.map((d) => [d.id, d.id]));
  const raiz = (id: string): string => {
    let actual = id;
    while (padre.get(actual) !== actual) {
      actual = padre.get(actual)!;
    }
    return actual;
  };
  const unir = (a: string, b: string): void => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) {
      // The root is the oldest: the episode id does not change when the
      // problem adds a new diagnosis.
      const [vieja, nueva] = antes(porId.get(ra)!, porId.get(rb)!) ? [ra, rb] : [rb, ra];
      padre.set(nueva, vieja);
    }
  };
  const porConcepto = new Map<string, string>();
  for (const d of diagnosticos) {
    if (d.concepto === undefined || d.concepto === '') continue;
    const otro = porConcepto.get(d.concepto);
    if (otro === undefined) porConcepto.set(d.concepto, d.id);
    else unir(otro, d.id);
  }
  for (const v of validos) {
    if (v.motivo === 'reemplazado-por' && padre.has(v.desde) && padre.has(v.hasta)) {
      unir(v.desde, v.hasta);
    }
  }

  /* 2 · Strong memberships, until nothing changes. */
  const de = new Map<string, Set<string>>();
  const agregar = (id: string, episodio: string): boolean => {
    const actual = de.get(id) ?? new Set<string>();
    if (actual.has(episodio)) return false;
    actual.add(episodio);
    de.set(id, actual);
    return true;
  };
  for (const d of diagnosticos) {
    agregar(d.id, `episodio:${raiz(d.id)}`);
  }
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const v of validos) {
      if (HEREDA_DEL_ORIGEN.has(v.motivo)) {
        for (const e of de.get(v.desde) ?? []) cambio = agregar(v.hasta, e) || cambio;
        // Replacing a prescription joins both: the new one keeps treating what
        // the old one did, and the old one treated what the new one treats.
        if (v.motivo === 'receta-reemplazada') {
          for (const e of de.get(v.hasta) ?? []) cambio = agregar(v.desde, e) || cambio;
        }
      }
      if (v.motivo === 'evidencia' && porId.get(v.desde)?.clase !== 'atencion') {
        for (const e of de.get(v.hasta) ?? []) cambio = agregar(v.desde, e) || cambio;
      }
    }
  }

  /* 3 · Encounters and the rest, alternating until nothing changes:
     an encounter that receives a referral can give its notes an episode. */
  const inicio = new Map<string, number>();
  const inicioDe = (episodio: string): number => {
    if (!inicio.has(episodio)) {
      const fechas = diagnosticos
        .filter((d) => `episodio:${raiz(d.id)}` === episodio)
        .map((d) => d.cuando?.getTime() ?? Number.POSITIVE_INFINITY);
      inicio.set(episodio, Math.min(...fechas));
    }
    return inicio.get(episodio)!;
  };
  const propio = new Map<string, string>();
  const elegirPropio = (id: string, peso: (e: string) => number): void => {
    const conjunto = de.get(id);
    if (conjunto === undefined || conjunto.size === 0) return;
    const ordenados = [...conjunto].sort(
      (a, b) => peso(b) - peso(a) || inicioDe(a) - inicioDe(b) || a.localeCompare(b),
    );
    propio.set(id, ordenados[0]);
  };

  const huerfanos = validos // Inferred last: they never replace a real link.
    .filter((v) => HEREDA_SI_HUERFANO.has(v.motivo))
    .sort((a, b) => Number(a.motivo.startsWith('inferido')) - Number(b.motivo.startsWith('inferido')));
  let vueltas = 0;
  cambio = true;
  while (cambio && vueltas++ < registros.length + 2) {
    cambio = false;
    // Encounters belong to the episodes of what was entered in them.
    const pesoPorAtencion = new Map<string, Map<string, number>>();
    for (const v of validos) {
      const atencion =
        (v.motivo === 'registrado-en' || v.motivo === 'derivado-desde') && porId.get(v.desde)?.clase === 'atencion'
          ? v.desde
          : v.motivo === 'evidencia' && porId.get(v.desde)?.clase === 'atencion'
            ? v.desde
            : null;
      if (atencion === null) continue;
      const otro = atencion === v.desde ? v.hasta : v.desde;
      const conjunto = de.get(otro);
      if (conjunto === undefined || conjunto.size === 0) continue;
      for (const e of conjunto) {
        cambio = agregar(atencion, e) || cambio;
        const pesos = pesoPorAtencion.get(atencion) ?? new Map<string, number>();
        pesos.set(e, (pesos.get(e) ?? 0) + 1);
        pesoPorAtencion.set(atencion, pesos);
      }
    }
    for (const r of registros) {
      if (r.clase === 'atencion') {
        const antes = propio.get(r.id);
        elegirPropio(r.id, (e) => pesoPorAtencion.get(r.id)?.get(e) ?? 0);
        cambio = cambio || antes !== propio.get(r.id);
      } else if (!propio.has(r.id)) {
        elegirPropio(r.id, () => 0);
        cambio = cambio || propio.has(r.id);
      }
    }
    // Orphans inherit their source's own episode.
    for (const v of huerfanos) {
      // In `inferido-mismo-dia` the source is the appointment and the target
      // the encounter: whichever has none inherits.
      const pares: [string, string][] =
        v.motivo === 'inferido-mismo-dia' ? [[v.hasta, v.desde], [v.desde, v.hasta]] : [[v.desde, v.hasta]];
      for (const [origen, destino] of pares) {
        const e = propio.get(origen);
        if (e !== undefined && (de.get(destino)?.size ?? 0) === 0) {
          agregar(destino, e);
          propio.set(destino, e);
          cambio = true;
        }
      }
    }
    // The admission goes to the episode of the first encounter inside it.
    for (const v of validos) {
      if (v.motivo !== 'durante-internacion') continue;
      const e = propio.get(v.hasta);
      if (e !== undefined && (de.get(v.desde)?.size ?? 0) === 0) {
        agregar(v.desde, e);
        propio.set(v.desde, e);
        cambio = true;
      }
    }
  }

  /* 4 · The episodes. */
  const episodioDe = new Map<string, string>();
  const pertenencias = new Map<string, readonly string[]>();
  for (const r of registros) {
    const e = propio.get(r.id) ?? ID_SIN_DIAGNOSTICO;
    episodioDe.set(r.id, e);
    const otros = [...(de.get(r.id) ?? [])].filter((x) => x !== e).sort((a, b) => inicioDe(a) - inicioDe(b));
    pertenencias.set(r.id, [e, ...otros]);
  }

  const ids = [...new Set(episodioDe.values())];
  const episodios = ids.map((id) => armarEpisodio(id, registros, porId, episodioDe, pertenencias, raiz));
  episodios.sort((a, b) => {
    if (a.clase !== b.clase) return a.clase === 'sin-diagnostico' ? 1 : -1;
    const ta = a.desde?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = b.desde?.getTime() ?? Number.POSITIVE_INFINITY;
    return ta - tb || a.id.localeCompare(b.id);
  });
  return { episodios, episodioDe, pertenencias };
}
