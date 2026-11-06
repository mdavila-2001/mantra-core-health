/* ============================================================================
    La red clínica por episodios: qué le pasó a la persona, problema por
    problema.

    Funciones puras y sin Angular. Reciben los registros del expediente ya
    traducidos a una forma propia ({@link RegistroDeLaRed}) y sus vínculos, y
    deciden a qué episodio pertenece cada uno. La geometría vive aparte
    (`red-clinica.geometria.ts`) y el paso desde los tipos del contrato, en
    `red-clinica.adaptador.ts`.

    La regla completa está en `docs/adr/ADR-0021-red-clinica-por-episodios.md`.
    Resumida:

    1. Un **episodio** es un problema clínico: una cadena de diagnósticos
       vinculados (el mismo concepto registrado otra vez, o un descartado y el
       que lo reemplazó) más todo lo que cuelga de ellos.
    2. Los vínculos **fuertes** (receta → diagnóstico, estudio → diagnóstico,
       resultado → estudio, receta → receta que la reemplazó, plan →
       diagnóstico, evidencia de una confirmación) arrastran al registro al
       episodio de su diagnóstico.
    3. Una **atención** pertenece a todos los episodios cuyos registros se
       asentaron en ella; se dibuja una sola vez, en el que tiene más registros
       suyos (empate: el que empezó antes) y conecta con los demás.
    4. Lo que sólo cuelga de una atención (observaciones, notas, derivaciones,
       reconsultas…) va al episodio donde se dibuja esa atención.
    5. Lo que no cuelga de ningún diagnóstico va al hilo «Sin diagnóstico
       asociado».
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { diaClinico } from './dia-clinico';

/** Las clases de registro de la red, en el orden en que se apilan en una celda. */
export const CLASES_DE_LA_RED = [
  'atencion',
  'cita',
  'internacion',
  'diagnostico',
  'estudio',
  'resultado',
  'procedimiento',
  'medicacion',
  'derivacion',
  'plan',
  'observacion',
  'nota',
  'documento',
] as const;

export type ClaseDeLaRed = (typeof CLASES_DE_LA_RED)[number];

/**
 * Las clases de **detalle** (nivel 3): con el episodio desplegado se agrupan
 * tras un «+N» por momento. Lo demás es nivel 2 y se ve al desplegar.
 */
export const CLASES_DE_DETALLE: ReadonlySet<ClaseDeLaRed> = new Set<ClaseDeLaRed>([
  'plan',
  'observacion',
  'nota',
  'documento',
]);

export interface AspectoDeLaClase {
  readonly singular: string;
  readonly plural: string;
  readonly tono: Tone | 'neutral';
  readonly icono: NavIconName;
}

/** Cómo se presenta cada clase. El tono nunca va solo: lleva ícono y nombre. */
export const ASPECTO_DE_LA_CLASE: Readonly<Record<ClaseDeLaRed, AspectoDeLaClase>> = {
  atencion: { singular: 'Atención', plural: 'Atenciones', tono: 'primary', icono: 'stethoscope' },
  cita: { singular: 'Cita', plural: 'Citas', tono: 'primary', icono: 'calendar' },
  internacion: { singular: 'Internación', plural: 'Internaciones', tono: 'warning', icono: 'hospital' },
  diagnostico: { singular: 'Diagnóstico', plural: 'Diagnósticos', tono: 'error', icono: 'heart' },
  estudio: { singular: 'Estudio pedido', plural: 'Estudios', tono: 'info', icono: 'scan' },
  resultado: { singular: 'Resultado', plural: 'Resultados', tono: 'info', icono: 'results' },
  procedimiento: { singular: 'Procedimiento', plural: 'Procedimientos', tono: 'secondary', icono: 'scalpel' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', tono: 'success', icono: 'pill' },
  derivacion: { singular: 'Derivación', plural: 'Derivaciones', tono: 'secondary', icono: 'share' },
  plan: { singular: 'Plan de cuidados', plural: 'Planes de cuidados', tono: 'secondary', icono: 'clipboard' },
  observacion: { singular: 'Observación', plural: 'Observaciones', tono: 'info', icono: 'flask' },
  nota: { singular: 'Nota clínica', plural: 'Notas', tono: 'neutral', icono: 'note' },
  documento: { singular: 'Documento', plural: 'Documentos', tono: 'neutral', icono: 'folder' },
};

/** La certeza de un diagnóstico, como la decide C3. */
export type CertezaDiagnostica = 'presuntivo' | 'confirmado' | 'descartado' | 'historico';

/** Un registro del expediente, listo para la red. El `id` es el del registro real. */
export interface RegistroDeLaRed {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly titulo: string;
  readonly detalle: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  readonly cuando: Date | null;
  /**
   * La atención en cuya columna va. Es la del contrato (`encounterId`,
   * `sourceEncounterId`) y, para una cita, la atención del mismo día que se
   * le infiere: ubicar no es afirmar —la línea que las une va marcada como
   * inferida—.
   */
  readonly encuentroId?: string;
  /** Sólo diagnósticos. */
  readonly certeza?: CertezaDiagnostica;
  /**
   * Sólo diagnósticos: el concepto. Dos diagnósticos del mismo concepto son el
   * mismo problema registrado dos veces.
   */
  readonly concepto?: string;
}

/**
 * Por qué dos registros están unidos. Cada uno nombra un campo del contrato
 * (ver `CONTRATO-RED-CLINICA.md`), salvo los dos `inferido-*`, que la red
 * deduce y dibuja distinto.
 */
export type MotivoDelVinculo =
  /** atención → registro (`encounterId`). */
  | 'registrado-en'
  /** diagnóstico → receta (`indicationConditionId`). */
  | 'indicado-para'
  /** diagnóstico → estudio (`reasonConditionId`). */
  | 'pedido-para'
  /** estudio → resultado (`serviceRequestId` del informe). */
  | 'resultado-de'
  /** descartado → el que lo reemplazó (`replacedByConditionId`). */
  | 'reemplazado-por'
  /** receta → la que la reemplazó (`replacedByRequestId`). */
  | 'receta-reemplazada'
  /** evidencia → diagnóstico (`verification.basedOn`). */
  | 'evidencia'
  /** diagnóstico → plan (`conditionId` del plan). */
  | 'plan-para'
  /** atención → derivación (`sourceEncounterId`). */
  | 'derivado-desde'
  /** derivación → atención del destino (`targetEncounterId`). */
  | 'recibido-en'
  /** cita o atención de origen → reconsulta (`followUpOf`). */
  | 'reconsulta-de'
  /** internación → atención dentro de ella (`episodeId` de la atención). */
  | 'durante-internacion'
  /** presuntivo → estudio pedido en la misma atención, sin `reasonConditionId`. */
  | 'inferido-misma-atencion'
  /** cita → atención del mismo día, sin vínculo guardado. */
  | 'inferido-mismo-dia';

export interface VinculoDeLaRed {
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDelVinculo;
}

/** Lo que dice cada motivo, en la leyenda y en los nombres accesibles. */
export const NOMBRE_DEL_MOTIVO: Readonly<Record<MotivoDelVinculo, string>> = {
  'registrado-en': 'Se registró en esa atención',
  'indicado-para': 'Se indicó para ese diagnóstico',
  'pedido-para': 'Se pidió para ese diagnóstico',
  'resultado-de': 'Resultado del estudio',
  'reemplazado-por': 'Descartado y reemplazado por',
  'receta-reemplazada': 'Receta reemplazada por',
  evidencia: 'Evidencia de la decisión',
  'plan-para': 'Plan para ese diagnóstico',
  'derivado-desde': 'Derivación desde esa atención',
  'recibido-en': 'Recibido por el destino en esa atención',
  'reconsulta-de': 'Reconsulta de',
  'durante-internacion': 'Atención durante la internación',
  'inferido-misma-atencion': 'Inferido: pedido en la misma atención que el presuntivo',
  'inferido-mismo-dia': 'Inferido: cita y atención del mismo día',
};

export function esInferido(motivo: MotivoDelVinculo): boolean {
  return motivo.startsWith('inferido-');
}

/* -- Vínculos inferidos ---------------------------------------------------- */

/**
 * Los vínculos que la red **deduce**, siempre marcados como tales.
 *
 * - Un estudio pedido en una atención donde se registró un diagnóstico
 *   presuntivo, sin `reasonConditionId`: probablemente se pidió para
 *   confirmarlo. Sólo si en esa atención hay **un** presuntivo: con dos, no
 *   hay cómo saber cuál y la red no elige.
 * - Una cita sin vínculo guardado y una atención el mismo día: probablemente
 *   es la atención de esa cita. Sólo si ese día hay **una** atención, y sólo
 *   para citas que no se cancelaron ni se ausentaron (eso lo decide el
 *   adaptador, que conoce el estado: ver `citaAtendible`).
 *
 * Nunca reemplaza a un vínculo real: si el estudio ya tiene su diagnóstico o
 * la cita ya está atada a una atención, no se infiere nada.
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

/** La clave del día clínico, `aaaa-mm-dd` (`dia-clinico.ts`: the same day as the guided tour). */
export const claveDelDia = diaClinico;

/* -- Episodios ------------------------------------------------------------- */

export const ID_SIN_DIAGNOSTICO = 'episodio:sin-diagnostico';

/** Un hito de la franja-resumen: lo que se ve con el episodio plegado. */
export interface HitoDelEpisodio {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly cuando: Date | null;
  readonly titulo: string;
  /** Qué clase de hito: decide la forma del marcador. */
  readonly tipo: 'presuntivo' | 'confirmado' | 'descartado' | 'historico' | 'derivacion' | 'internacion' | 'procedimiento' | 'momento';
}

export interface EpisodioClinico {
  readonly id: string;
  readonly clase: 'problema' | 'sin-diagnostico';
  readonly nombre: string;
  readonly estado: string;
  readonly tonoDelEstado?: Tone;
  /** Los diagnósticos de la cadena, en orden cronológico. */
  readonly diagnosticos: readonly string[];
  /** Los registros que se dibujan en este episodio. */
  readonly miembros: readonly string[];
  /**
   * Los que se dibujan en otro episodio pero también pertenecen a este —una
   * atención compartida—: el resumen los cuenta y la red los une.
   */
  readonly compartidos: readonly string[];
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly conteos: Readonly<Partial<Record<ClaseDeLaRed, number>>>;
  readonly descartados: number;
  readonly hitos: readonly HitoDelEpisodio[];
}

export interface RedPorEpisodios {
  readonly episodios: readonly EpisodioClinico[];
  /** El episodio donde se dibuja cada registro. */
  readonly episodioDe: ReadonlyMap<string, string>;
  /** Todos los episodios a los que pertenece cada registro (el propio primero). */
  readonly pertenencias: ReadonlyMap<string, readonly string[]>;
}

/** Los vínculos que arrastran al destino al episodio del origen, y en qué sentido. */
const HEREDA_DEL_ORIGEN: ReadonlySet<MotivoDelVinculo> = new Set<MotivoDelVinculo>([
  'indicado-para',
  'pedido-para',
  'resultado-de',
  'plan-para',
  'receta-reemplazada',
]);

/** Los que arrastran sólo si el destino no tiene episodio propio; los inferidos, últimos (ADR-0021). */
const HEREDA_SI_HUERFANO: ReadonlySet<MotivoDelVinculo> = new Set<MotivoDelVinculo>([
  'resultado-de',
  'inferido-misma-atencion',
  'registrado-en',
  'derivado-desde',
  'recibido-en',
  'reconsulta-de',
  'inferido-mismo-dia',
]);

/**
 * Agrupa los registros en episodios. Ver la regla en la cabecera del archivo
 * y en el ADR.
 */
export function agruparEnEpisodios(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
): RedPorEpisodios {
  const porId = new Map(registros.map((r) => [r.id, r]));
  const validos = vinculos.filter(
    (v) => v.desde !== v.hasta && porId.has(v.desde) && porId.has(v.hasta),
  );
  const diagnosticos = registros.filter((r) => r.clase === 'diagnostico');

  /* 1 · Las cadenas: unión de diagnósticos por concepto y por reemplazo. */
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
      // La raíz es la más antigua: el id del episodio no cambia cuando el
      // problema suma un diagnóstico nuevo.
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

  /* 2 · Pertenencias fuertes, hasta que no cambie nada. */
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
        // El reemplazo de una receta une a las dos: la nueva sigue tratando
        // lo mismo que la vieja, y la vieja trataba lo que trata la nueva.
        if (v.motivo === 'receta-reemplazada') {
          for (const e of de.get(v.hasta) ?? []) cambio = agregar(v.desde, e) || cambio;
        }
      }
      if (v.motivo === 'evidencia' && porId.get(v.desde)?.clase !== 'atencion') {
        for (const e of de.get(v.hasta) ?? []) cambio = agregar(v.desde, e) || cambio;
      }
    }
  }

  /* 3 · Las atenciones y el resto, alternando hasta que no cambie nada:
     una atención que recibe una derivación puede darle episodio a sus notas. */
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
    // Las atenciones pertenecen a los episodios de lo que se registró en ellas.
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
    // Los huérfanos heredan el episodio propio de su origen.
    for (const v of huerfanos) {
      // En `inferido-mismo-dia` el origen es la cita y el destino la
      // atención: hereda la que no tenga.
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
    // La internación, al episodio de la primera atención que la tenga.
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

  /* 4 · Los episodios. */
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

function antes(a: RegistroDeLaRed, b: RegistroDeLaRed): boolean {
  const ta = a.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.cuando?.getTime() ?? Number.POSITIVE_INFINITY;
  return ta < tb || (ta === tb && a.id < b.id);
}

const ESTADO_DE_LA_CERTEZA: Readonly<Record<CertezaDiagnostica, { estado: string; tono: Tone }>> = {
  presuntivo: { estado: 'En estudio', tono: 'warning' },
  confirmado: { estado: 'Confirmado', tono: 'success' },
  descartado: { estado: 'Descartado', tono: 'error' },
  historico: { estado: 'Histórico', tono: 'secondary' },
};

function armarEpisodio(
  id: string,
  registros: readonly RegistroDeLaRed[],
  porId: ReadonlyMap<string, RegistroDeLaRed>,
  episodioDe: ReadonlyMap<string, string>,
  pertenencias: ReadonlyMap<string, readonly string[]>,
  raiz: (id: string) => string,
): EpisodioClinico {
  const miembros = registros.filter((r) => episodioDe.get(r.id) === id);
  const compartidos = registros.filter(
    (r) => episodioDe.get(r.id) !== id && (pertenencias.get(r.id) ?? []).includes(id),
  );
  const cadena = registros
    .filter((r) => r.clase === 'diagnostico' && id === `episodio:${raiz(r.id)}`)
    .sort((a, b) => (antes(a, b) ? -1 : 1));
  const fechas = [...miembros, ...compartidos]
    .map((r) => r.cuando)
    .filter((f): f is Date => f !== null)
    .map((f) => f.getTime());
  const conteos: Partial<Record<ClaseDeLaRed, number>> = {};
  for (const r of [...miembros, ...compartidos]) {
    conteos[r.clase] = (conteos[r.clase] ?? 0) + 1;
  }
  const hitos: HitoDelEpisodio[] = [];
  for (const r of [...miembros, ...compartidos]) {
    const tipo: HitoDelEpisodio['tipo'] | null =
      r.clase === 'diagnostico'
        ? (r.certeza ?? 'confirmado')
        : r.clase === 'derivacion' || r.clase === 'internacion' || r.clase === 'procedimiento'
          ? r.clase
          : r.clase === 'atencion' || r.clase === 'cita'
            ? 'momento'
            : null;
    if (tipo !== null) {
      hitos.push({ id: r.id, clase: r.clase, cuando: r.cuando, titulo: r.titulo, tipo });
    }
  }
  hitos.sort((a, b) => (a.cuando?.getTime() ?? Infinity) - (b.cuando?.getTime() ?? Infinity));

  if (id === ID_SIN_DIAGNOSTICO) {
    return {
      id,
      clase: 'sin-diagnostico',
      nombre: 'Atenciones sin diagnóstico asociado',
      estado: '',
      diagnosticos: [],
      miembros: miembros.map((r) => r.id),
      compartidos: compartidos.map((r) => r.id),
      desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
      hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
      conteos,
      descartados: 0,
      hitos,
    };
  }
  // El nombre: el diagnóstico vigente más reciente; si todos se descartaron,
  // el último descartado, y el estado lo dice.
  const vigentes = cadena.filter((d) => d.certeza !== 'descartado');
  const cabeza = (vigentes.length > 0 ? vigentes : cadena).at(-1) ?? porId.get(id.slice('episodio:'.length));
  const certeza = cabeza?.certeza ?? 'confirmado';
  return {
    id,
    clase: 'problema',
    nombre: cabeza?.titulo ?? 'Problema clínico',
    estado: cabeza?.estado || ESTADO_DE_LA_CERTEZA[certeza].estado,
    tonoDelEstado: cabeza?.tonoDelEstado ?? ESTADO_DE_LA_CERTEZA[certeza].tono,
    diagnosticos: cadena.map((d) => d.id),
    miembros: miembros.map((r) => r.id),
    compartidos: compartidos.map((r) => r.id),
    desde: fechas.length === 0 ? null : new Date(Math.min(...fechas)),
    hasta: fechas.length === 0 ? null : new Date(Math.max(...fechas)),
    conteos,
    descartados: cadena.filter((d) => d.certeza === 'descartado').length,
    hitos,
  };
}

/* -- Lo que dice cada vínculo, en texto ---------------------------------- */

/**
 * Las relaciones de un registro, en palabras: lo que reemplaza a las líneas
 * en el nombre accesible y en la versión vertical. Los inferidos lo dicen.
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
