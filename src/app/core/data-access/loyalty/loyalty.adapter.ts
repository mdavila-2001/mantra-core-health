/**
 * Traducción del cable al dominio de la billetera de puntos.
 *
 * Vive aparte del cliente por la misma razón que en pedidos de farmacia: si el
 * backend renombra un campo, el cambio se agota acá y ninguna pantalla se
 * entera. **No inventa nada**: lo que la API no manda, no se rellena.
 */

import {
  DIRECCIONES_DE_PUNTOS,
  MOTIVOS_DE_PUNTOS,
  NOMBRE_PROGRAMA_PUNTOS,
  type Canje,
  type DireccionDePuntos,
  type Membresia,
  type MotivoDePuntos,
  type MovimientoDePuntos,
  type NivelDeMembresia,
  type PaginaDeMovimientos,
} from './loyalty.types';
import type {
  LoyaltyMembershipDto,
  LoyaltyTierDto,
  MyLoyaltyResponseDto,
  PointsLedgerEntryDto,
  PointsLedgerPageDto,
  PointsLedgerResponseDto,
} from './loyalty.dto';

/** Cómo se llaman las unidades cuando el programa no lo dice. */
const UNIDAD_POR_DEFECTO = 'puntos';

const ES_DIRECCION = new Set<string>(DIRECCIONES_DE_PUNTOS);
const ES_MOTIVO = new Set<string>(MOTIVOS_DE_PUNTOS);

/**
 * La membresía del titular, o `null` si no está inscrito.
 *
 * `enrolled: false` no es un error ni un vacío inventado: es la respuesta real
 * de quien todavía no tiene programa.
 */
export function membresiaDesdeDto(dto: MyLoyaltyResponseDto): Membresia | null {
  if (!dto.enrolled || !dto.membership) {
    return null;
  }
  return membresia(dto.membership);
}

function membresia(dto: LoyaltyMembershipDto): Membresia {
  return {
    id: dto.membershipId,
    // El nombre del programa manda cuando llega; el rótulo del front es el
    // respaldo mientras el programa no lo declare.
    programa: dto.programName === '' ? NOMBRE_PROGRAMA_PUNTOS : dto.programName,
    unidad: dto.pointsCurrencyName ?? UNIDAD_POR_DEFECTO,
    saldo: dto.pointsBalance,
    puntosDePorVida: dto.lifetimePoints,
    nivel: dto.tier ? nivel(dto.tier) : null,
    inscritaEl: dto.enrolledAt ? new Date(dto.enrolledAt) : null,
    activa: dto.active,
  };
}

function nivel(dto: LoyaltyTierDto): NivelDeMembresia {
  return {
    codigo: dto.code,
    nombre: dto.name,
    multiplicador: dto.multiplier ?? null,
    puntosMinimos: dto.minPoints,
  };
}

/** Una página del ledger, con su cursor opaco tal cual vino. */
export function paginaDesdeDto(dto: PointsLedgerPageDto): PaginaDeMovimientos {
  return {
    movimientos: dto.entries.map(movimiento),
    nextCursor: dto.nextCursor ?? null,
  };
}

function movimiento(dto: PointsLedgerEntryDto): MovimientoDePuntos {
  return {
    id: dto.entryId,
    direccion: esDireccion(dto.direction) ? dto.direction : null,
    puntos: dto.points,
    motivo: esMotivo(dto.reason) ? dto.reason : null,
    saldoDespues: dto.balanceAfter ?? null,
    // La lectura no publica un detalle por movimiento: la pantalla cae en la
    // etiqueta del motivo. Inventar una frase acá sería inventar un dato.
    detalle: null,
    ocurrioEl: new Date(dto.occurredAt),
    venceEl: dto.expiresAt ? new Date(dto.expiresAt) : null,
  };
}

/** El canje, tal como lo devuelve el endpoint real. */
export function canjeDesdeDto(dto: PointsLedgerResponseDto): Canje {
  return {
    id: dto.ledgerEntryId,
    puntos: dto.points,
    saldoDespues: dto.balanceAfter,
    puntosDePorVida: dto.lifetimePoints,
    duplicado: dto.duplicate,
  };
}

function esDireccion(valor: string | undefined): valor is DireccionDePuntos {
  return valor !== undefined && ES_DIRECCION.has(valor);
}

function esMotivo(valor: string | undefined): valor is MotivoDePuntos {
  return valor !== undefined && ES_MOTIVO.has(valor);
}
