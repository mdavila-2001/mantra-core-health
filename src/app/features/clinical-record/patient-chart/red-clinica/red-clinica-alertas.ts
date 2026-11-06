/* ============================================================================
    Support alerts: what was left open in the patient's history.

    User's decision (06/11/2026): **alerts yes, diagnosis suggestions no**.
    Each alert points at a verifiable fact in the records —a presumptive nobody
    resolved, a study without a result, an unanswered referral, something that
    repeats, an out-of-range value— and never concludes what the patient has.
    The wording is careful about that: «sin resolver», «se repite», «fuera del
    rango informado»; never «posible», «compatible con» nor «descartar».

    Pure functions over the `core/data-access` types as they arrive from the
    API. What the API does not say plainly (the catalogue codes) is resolved
    with `codigoDe`, as in `diagnosis-block`. The strip 1 links
    (`reasonConditionId`, `targetEncounterId`, `replacedByConditionId`) are
    optional in the contract: when absent, the alerts work with what there is.
    The contract lives in `red-clinica-alertas.types.ts`; the pending-work
    rules, in `red-clinica-alertas.pendientes.ts`.
    ========================================================================== */

import type { Condition, Encounter } from '../../../../core/data-access/clinical/clinical.types';
import { fecha, type PrioridadDeAlerta } from './red-clinica-alertas.plazos';
import { normalizarTexto } from './red-clinica-filtro';
import { esCritico, estaFueraDeRango, textoDelRango, textoDelValor } from './red-clinica-valores';
import type { ValorDeResultado } from './red-clinica.types';
import { TIPOS_DE_ALERTA, UMBRALES_POR_OMISION, type AlertaDeApoyo, type EntradaDeAlertas } from './red-clinica-alertas.types';
import { derivacionesAbiertas, estudiosSinResultado, presuntivosSinResolver } from './red-clinica-alertas.pendientes';

export type { PrioridadDeAlerta } from './red-clinica-alertas.plazos';
export { antiguedad, diasEntre } from './red-clinica-alertas.plazos';

/** The same diagnosis (same concept) recorded more than once. */
export function diagnosticosRepetidos(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const minimo = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.repeticiones;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const porConcepto = new Map<string, Condition[]>();
  for (const c of entrada.diagnosticos ?? []) {
    const lista = porConcepto.get(c.codeConceptId) ?? [];
    lista.push(c);
    porConcepto.set(c.codeConceptId, lista);
  }
  return [...porConcepto.entries()]
    .filter(([, lista]) => lista.length >= minimo)
    .map(([concepto, lista]) => {
      const ordenadas = [...lista].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const nombre = entrada.etiquetaDe?.(concepto) ?? 'Un diagnóstico';
      const primera = ordenadas[0].createdAt;
      const ultima = ordenadas[ordenadas.length - 1].createdAt;
      const ids = ordenadas.map((c) => idDeNodo('diagnostico', c.id));
      return {
        id: `diagnostico-repetido:${concepto}`,
        tipo: 'diagnostico-repetido' as const,
        prioridad: 'baja' as const,
        titulo: `Diagnóstico registrado ${lista.length} veces: ${nombre}`,
        detalle: `Entre el ${fecha(primera)} y el ${fecha(ultima)}. Conviene revisar si es el mismo episodio o uno nuevo.`,
        nodoId: ids[ids.length - 1],
        nodoIds: ids,
      };
    });
}

/** The same reason for consultation (normalised text) in several encounters. */
export function motivosRepetidos(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const minimo = { ...UMBRALES_POR_OMISION, ...entrada.umbrales }.repeticiones;
  const idDeNodo = entrada.idDeNodo ?? ((_t, id) => id);
  const porMotivo = new Map<string, { texto: string; atenciones: Encounter[] }>();
  for (const e of entrada.atenciones ?? []) {
    const texto = e.reasonText?.trim();
    if (!texto) continue;
    const clave = normalizarTexto(texto).replace(/\s+/g, ' ').replace(/[.,;:]+$/, '');
    const grupo = porMotivo.get(clave) ?? { texto, atenciones: [] };
    grupo.atenciones.push(e);
    porMotivo.set(clave, grupo);
  }
  return [...porMotivo.entries()]
    .filter(([, g]) => g.atenciones.length >= minimo)
    .map(([clave, g]) => {
      const fechas = g.atenciones
        .map((e) => e.startAt)
        .filter((d): d is Date => d !== undefined)
        .sort((a, b) => a.getTime() - b.getTime());
      const ordenadas = [...g.atenciones].sort(
        (a, b) => (a.startAt?.getTime() ?? 0) - (b.startAt?.getTime() ?? 0),
      );
      const ids = ordenadas.map((e) => idDeNodo('atencion', e.id));
      const rango =
        fechas.length >= 2
          ? `Entre el ${fecha(fechas[0])} y el ${fecha(fechas[fechas.length - 1])}.`
          : 'En atenciones distintas.';
      return {
        id: `motivo-repetido:${clave}`,
        tipo: 'motivo-repetido' as const,
        prioridad: 'baja' as const,
        titulo: `Motivo de consulta repetido ${g.atenciones.length} veces: «${g.texto}»`,
        detalle: `${rango} Puede valer la pena mirar las atenciones juntas.`,
        nodoId: ids[ids.length - 1],
        nodoIds: ids,
      };
    });
}

/** Released result values outside the reported range (or critical). */
export function resultadosFueraDeRango(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const alertas: AlertaDeApoyo[] = [];
  for (const r of entrada.resultados ?? []) {
    const fuera = r.valores.filter(estaFueraDeRango);
    if (fuera.length === 0) continue;
    const criticos = fuera.filter(esCritico);
    const describir = (v: ValorDeResultado) =>
      `${v.nombre} ${textoDelValor(v)} (referencia ${textoDelRango(v.rango, v.unidad)})`;
    const lista = fuera.slice(0, 3).map(describir).join('; ');
    const resto = fuera.length > 3 ? `; y ${fuera.length - 3} más` : '';
    const critico = criticos.length > 0;
    alertas.push({
      id: `${critico ? 'resultado-critico' : 'resultado-fuera-de-rango'}:${r.nodoId}`,
      tipo: critico ? 'resultado-critico' : 'resultado-fuera-de-rango',
      prioridad: critico ? 'alta' : 'media',
      titulo: critico
        ? `Valor crítico informado en ${r.estudio}`
        : `${fuera.length} ${fuera.length === 1 ? 'valor fuera' : 'valores fuera'} del rango de referencia en ${r.estudio}`,
      detalle: `${lista}${resto}.`,
      nodoId: r.nodoId,
      nodoIds: [r.nodoId],
    });
  }
  return alertas;
}

const PESO_DE_PRIORIDAD: Readonly<Record<PrioridadDeAlerta, number>> = { alta: 0, media: 1, baja: 2 };

/**
 * Every alert, from most to least urgent: by priority, then by the order of
 * `TIPOS_DE_ALERTA`, then by age (the oldest first).
 */
export function alertasDeApoyo(entrada: EntradaDeAlertas): readonly AlertaDeApoyo[] {
  const todas = [
    ...resultadosFueraDeRango(entrada),
    ...presuntivosSinResolver(entrada),
    ...estudiosSinResultado(entrada),
    ...derivacionesAbiertas(entrada),
    ...diagnosticosRepetidos(entrada),
    ...motivosRepetidos(entrada),
  ];
  return todas.sort(
    (a, b) =>
      PESO_DE_PRIORIDAD[a.prioridad] - PESO_DE_PRIORIDAD[b.prioridad] ||
      TIPOS_DE_ALERTA.indexOf(a.tipo) - TIPOS_DE_ALERTA.indexOf(b.tipo) ||
      (b.dias ?? 0) - (a.dias ?? 0),
  );
}

/** The node ids a set of alerts highlights. */
export function nodosAlertados(alertas: readonly AlertaDeApoyo[]): ReadonlySet<string> {
  return new Set(alertas.flatMap((a) => a.nodoIds));
}
