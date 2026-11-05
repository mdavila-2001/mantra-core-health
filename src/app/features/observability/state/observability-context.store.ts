import { computed, Injectable, signal } from '@angular/core';
import type { Params } from '@angular/router';

import type { ObsFreshness, ObsInterval, ObsWindowQuery } from '@core/data-access/observability/observability.types';
import type { ZonaHoraria } from '../sistema/obs-format';

export type RangoObs = 'hoy' | '24h' | '7d' | '30d';
export type PestanaSistema = 'resumen' | 'errores' | 'latencia' | 'sql' | 'endpoints' | 'no-medido';
export type EstadoFiltro = 'NEW' | 'SEEN' | 'RESOLVED' | 'IGNORED' | '';

export const RANGOS: readonly RangoObs[] = ['hoy', '24h', '7d', '30d'];
export const PESTANAS: readonly PestanaSistema[] = ['resumen', 'errores', 'latencia', 'sql', 'endpoints', 'no-medido'];
const ZONAS: readonly ZonaHoraria[] = ['America/La_Paz', 'UTC'];
const ESTADOS: readonly EstadoFiltro[] = ['NEW', 'SEEN', 'RESOLVED', 'IGNORED'];

const HORA = 3_600_000;
const DIA = 24 * HORA;

/** Intervalo de cada rango: la API admite minutos hasta 24 h, horas hasta 7 d y días hasta 92 d. */
const INTERVALO: Readonly<Record<RangoObs, ObsInterval>> = { hoy: 'hour', '24h': 'hour', '7d': 'day', '30d': 'day' };

/**
 * La ventana que pide cada rango. `hoy` omite `from`: la API arranca la ventana a las 00:00 de `to` en la zona
 * pedida (por eso «hoy» cambia de significado con la zona y la cabecera lo dice).
 */
export function consultaDeRango(rango: RangoObs, zona: ZonaHoraria, ahora: Date): ObsWindowQuery {
  const to = ahora.toISOString();
  const base = { to, tz: zona, interval: INTERVALO[rango] };
  switch (rango) {
    case 'hoy':
      return base;
    case '24h':
      return { ...base, from: new Date(ahora.getTime() - DIA).toISOString() };
    case '7d':
      return { ...base, from: new Date(ahora.getTime() - 7 * DIA).toISOString() };
    case '30d':
      return { ...base, from: new Date(ahora.getTime() - 30 * DIA).toISOString() };
  }
}

function uno<T extends string>(valor: unknown, validos: readonly T[], porDefecto: T): T {
  return typeof valor === 'string' && (validos as readonly string[]).includes(valor) ? (valor as T) : porDefecto;
}

/**
 * El contexto global del panel «Sistema»: rango, zona horaria, pestaña y filtros. Es la ÚNICA fuente de la
 * ventana que piden todos los widgets, y se sincroniza con la URL (`?rango=24h&tz=UTC&pestana=errores`) para
 * que un enlace o una captura reproduzca la misma vista. Ninguna pestaña tiene su propio rango.
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityContextStore {
  readonly rango = signal<RangoObs>('hoy');
  readonly zona = signal<ZonaHoraria>('America/La_Paz');
  readonly pestana = signal<PestanaSistema>('resumen');
  /** Filtros de la pestaña Errores. */
  readonly estado = signal<EstadoFiltro>('');
  readonly modulo = signal('');
  readonly codigo = signal('');
  /** Grupo de errores abierto en el detalle. */
  readonly grupo = signal('');
  /** Búsqueda por requestId. */
  readonly requestId = signal('');

  /** El instante «ahora» de esta carga: todos los widgets de una misma actualización usan la MISMA ventana. */
  readonly ahora = signal(new Date());
  /** Sube con cada «Actualizar»: los widgets repiden aunque el contexto no haya cambiado. */
  readonly version = signal(0);
  /** La frescura que reportó la última respuesta (la cabecera la muestra). */
  readonly frescura = signal<ObsFreshness | null>(null);

  readonly consulta = computed<ObsWindowQuery>(() => consultaDeRango(this.rango(), this.zona(), this.ahora()));

  actualizar(): void {
    this.ahora.set(new Date());
    this.version.update((v) => v + 1);
  }

  publicarFrescura(f: ObsFreshness): void {
    this.frescura.set(f);
  }

  /** Lee la URL. Un valor desconocido no rompe nada: cae al valor por omisión. */
  desdeParametros(p: Params): void {
    this.rango.set(uno(p['rango'], RANGOS, 'hoy'));
    this.zona.set(uno(p['tz'], ZONAS, 'America/La_Paz'));
    this.pestana.set(uno(p['pestana'], PESTANAS, 'resumen'));
    this.estado.set(uno(p['estado'], ESTADOS, ''));
    this.modulo.set(typeof p['modulo'] === 'string' ? p['modulo'].slice(0, 80) : '');
    this.codigo.set(typeof p['codigo'] === 'string' ? p['codigo'].slice(0, 60) : '');
    this.grupo.set(typeof p['grupo'] === 'string' && /^[0-9a-f-]{36}$/i.test(p['grupo']) ? p['grupo'] : '');
    this.requestId.set(typeof p['req'] === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(p['req']) ? p['req'] : '');
  }

  /** Lo que va a la URL: sólo lo que se aparta del valor por omisión, para que la dirección quede corta. */
  haciaParametros(): Params {
    const p: Params = {};
    if (this.rango() !== 'hoy') p['rango'] = this.rango();
    if (this.zona() !== 'America/La_Paz') p['tz'] = this.zona();
    if (this.pestana() !== 'resumen') p['pestana'] = this.pestana();
    if (this.estado() !== '') p['estado'] = this.estado();
    if (this.modulo() !== '') p['modulo'] = this.modulo();
    if (this.codigo() !== '') p['codigo'] = this.codigo();
    if (this.grupo() !== '') p['grupo'] = this.grupo();
    if (this.requestId() !== '') p['req'] = this.requestId();
    return p;
  }
}
