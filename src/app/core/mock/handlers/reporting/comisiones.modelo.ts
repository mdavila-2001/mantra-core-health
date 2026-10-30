import type { ContextoReporte } from '../../../data-access/reporting/reporting.types';
import { convertir, daysInPeriod, factorContexto, redondear } from './reporting-dataset.util';

/* ============================================================================
    Modelo contable de la pestaña «Comisiones y actores» (datos de EJEMPLO).

    Todo se calcula en CÉNTIMOS ENTEROS de la moneda del contexto (regla 91.1.1:
    nada de decimales binarios para dinero) y de ahí se derivan las demás cifras,
    de modo que los invariantes se cumplen exactos, no «casi»:
      · devengada = liquidada + pendiente (cada actor y en el total),
      · la suma por actor = el total,
      · lo retenido sale de lo pendiente, nunca se suma aparte.

    Las tasas de abajo son de EJEMPLO. No se infieren tasas ni topes reales
    (regla 97.5.4): son números para que la maqueta tenga forma.
    ========================================================================== */

export const MOTIVO_SIN_ESQUEMA = 'Esquema de comisión sin definir (decisión de negocio pendiente)';

export interface ActorDef {
  readonly nombre: string;
  /** Parte del volumen transaccionado que llega por este canal (suman 1). */
  readonly parteVolumen: number;
  /** Tasa de comisión sobre ese volumen. `null` = el negocio no la definió. */
  readonly tasa: number | null;
  /** Fracción de lo devengado que ya se liquidó. */
  readonly fraccionLiquidada: number;
  readonly clientesBase: number;
  /** La Plataforma retiene su parte al cobrar: no se le paga a nadie. */
  readonly interno: boolean;
}

/** Orden fijo: el color y la posición siguen a la entidad, no al ranking. */
export const ACTORES: readonly ActorDef[] = [
  { nombre: 'Visitador médico', parteVolumen: 0.12, tasa: null, fraccionLiquidada: 0, clientesBase: 48, interno: false },
  { nombre: 'Corredor de seguros', parteVolumen: 0.18, tasa: 0.024, fraccionLiquidada: 0.78, clientesBase: 36, interno: false },
  { nombre: 'Referidor', parteVolumen: 0.14, tasa: 0.015, fraccionLiquidada: 0.84, clientesBase: 212, interno: false },
  { nombre: 'Organización afiliada', parteVolumen: 0.21, tasa: 0.032, fraccionLiquidada: 0.81, clientesBase: 19, interno: false },
  { nombre: 'Plataforma', parteVolumen: 0.35, tasa: 0.021, fraccionLiquidada: 1, clientesBase: 340, interno: true },
];

/** Volumen transaccionado por día en la maqueta, en BOB (EJEMPLO). */
const VOLUMEN_DIARIO_BOB = 80_000;
/** Fees brutos cobrados sobre el volumen (EJEMPLO). */
const TASA_FEES = 0.062;
/** Costo del gateway sobre el volumen (EJEMPLO). */
const TASA_GATEWAY = 0.018;
const PARTE_RETENIDA = 0.18;
const PARTE_CONTRACARGO = 0.012;
const TASA_DESCUADRE = 0.0086;

/** Reparte un total entero de céntimos según pesos; el residuo va al último (nunca se pierde). */
export function repartir(totalC: number, pesos: readonly number[]): number[] {
  const suma = pesos.reduce((a, b) => a + b, 0);
  const partes = pesos.map((p) => Math.floor((totalC * p) / suma));
  const resto = totalC - partes.reduce((a, b) => a + b, 0);
  partes[partes.length - 1] = partes[partes.length - 1]! + resto;
  return partes;
}

export function aMonto(centimos: number | null): number | null {
  return centimos === null ? null : centimos / 100;
}

export interface FilaActor {
  readonly actor: ActorDef;
  readonly volumenC: number;
  readonly devengadaC: number | null;
  readonly liquidadaC: number | null;
  readonly pendienteC: number | null;
  readonly retenidoC: number | null;
  readonly contracargosC: number | null;
  readonly clientes: number;
}

export interface Payouts {
  readonly emitidos: number;
  readonly enProceso: number;
  readonly fallidos: number;
}

/** Lo que ve el resto del tablero: todo el universo, o el actor elegido por el filtro. */
export interface Alcance {
  readonly volumenC: number;
  readonly volumenBob: number;
  readonly feesC: number;
  readonly gatewayC: number;
  readonly comisionesC: number | null;
  readonly ingresoNetoC: number | null;
  readonly devengadaC: number | null;
  readonly liquidadaC: number | null;
  readonly pendienteC: number | null;
  readonly retenidoC: number | null;
  readonly payouts: Payouts | null;
  readonly descuadres: number;
  readonly descuadreC: number;
}

export interface ModeloComisiones {
  readonly dias: number;
  readonly factor: number;
  readonly filas: readonly FilaActor[];
  readonly seleccion: FilaActor | null;
  readonly alcance: Alcance;
  /** Suma de los actores externos con esquema definido (lo que la UI llama «total»). */
  readonly externosC: number;
}

function sumaONulo(filas: readonly FilaActor[], campo: (f: FilaActor) => number | null): number | null {
  let total = 0;
  for (const f of filas) {
    const v = campo(f);
    if (v === null) {
      return null;
    }
    total += v;
  }
  return total;
}

export function construirModelo(ctx: ContextoReporte): ModeloComisiones {
  const dias = daysInPeriod(ctx.periodo);
  // El filtro `actor` no escala magnitudes: ELIGE al actor. Los demás filtros sí las escalan.
  const factor = factorContexto({ ...ctx, filtros: ctx.filtros.filter((f) => f.dimension !== 'actor') });
  const volumenBob = VOLUMEN_DIARIO_BOB * dias * factor;
  const cent = (bob: number): number => Math.round(convertir(bob, ctx.moneda) * 100);

  const filas: FilaActor[] = ACTORES.map((actor) => {
    const volBob = volumenBob * actor.parteVolumen;
    const clientes = Math.max(1, Math.round(actor.clientesBase * factor));
    if (actor.tasa === null) {
      return { actor, volumenC: cent(volBob), devengadaC: null, liquidadaC: null, pendienteC: null, retenidoC: null, contracargosC: null, clientes };
    }
    const comisionBob = volBob * actor.tasa;
    const liquidadaC = cent(comisionBob * actor.fraccionLiquidada);
    const pendienteC = cent(comisionBob * (1 - actor.fraccionLiquidada));
    const devengadaC = liquidadaC + pendienteC;
    return {
      actor,
      volumenC: cent(volBob),
      devengadaC,
      liquidadaC,
      pendienteC,
      retenidoC: Math.round(pendienteC * PARTE_RETENIDA),
      contracargosC: Math.round(devengadaC * PARTE_CONTRACARGO),
      clientes,
    };
  });

  const filtroActor = [...ctx.filtros].reverse().find((f) => f.dimension === 'actor');
  const seleccion = filas.find((f) => f.actor.nombre === filtroActor?.valor) ?? null;
  const externos = filas.filter((f) => !f.actor.interno && f.devengadaC !== null);
  const universo = seleccion === null ? externos : [seleccion];

  const volumenAlcanceBob = seleccion === null ? volumenBob : volumenBob * seleccion.actor.parteVolumen;
  const devengadaC = sumaONulo(universo, (f) => f.devengadaC);
  // En el canal directo (Plataforma) no hay comisión a terceros que restar del ingreso.
  const comisionesC = seleccion?.actor.interno === true ? 0 : devengadaC;
  const feesC = cent(volumenAlcanceBob * TASA_FEES);
  const gatewayC = cent(volumenAlcanceBob * TASA_GATEWAY);

  // Payouts: sólo los actores a los que se les paga; reparte según su peso en lo devengado.
  const totalExternos = externos.reduce((a, f) => a + (f.devengadaC ?? 0), 0);
  const peso = seleccion === null ? 1 : seleccion.actor.interno || seleccion.devengadaC === null ? null : seleccion.devengadaC / totalExternos;
  const payouts: Payouts | null =
    peso === null
      ? null
      : {
          emitidos: Math.round(3.4 * dias * factor * peso),
          enProceso: Math.round(0.7 * dias * factor * peso),
          fallidos: Math.round(0.22 * dias * factor * peso),
        };

  const descuadres = Math.round(0.55 * dias * factor * (seleccion?.actor.parteVolumen ?? 1));
  const alcance: Alcance = {
    volumenC: cent(volumenAlcanceBob),
    volumenBob: volumenAlcanceBob,
    feesC,
    gatewayC,
    comisionesC,
    ingresoNetoC: comisionesC === null ? null : feesC - gatewayC - comisionesC,
    devengadaC,
    liquidadaC: sumaONulo(universo, (f) => f.liquidadaC),
    pendienteC: sumaONulo(universo, (f) => f.pendienteC),
    retenidoC: sumaONulo(universo, (f) => f.retenidoC),
    payouts,
    descuadres,
    descuadreC: descuadres === 0 ? 0 : cent(volumenAlcanceBob * TASA_DESCUADRE),
  };

  return { dias, factor, filas, seleccion, alcance, externosC: totalExternos };
}

/** Porcentaje con 2 decimales, o `null` si el denominador no existe. */
export function porcentaje(numerador: number | null, denominador: number | null): number | null {
  if (numerador === null || denominador === null || denominador <= 0) {
    return null;
  }
  return redondear((numerador / denominador) * 100, 2);
}
