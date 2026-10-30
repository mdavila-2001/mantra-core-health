import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ReportingClient } from '@core/data-access/reporting/reporting.client';
import { VERTICALES } from '@core/data-access/reporting/reporting-labels';
import type {
  ContextoReporte,
  PestanaReporte,
  VerticalReporte,
} from '@core/data-access/reporting/reporting.types';

/** Cuánto vive una pestaña en memoria: lo bastante para varias preguntas seguidas. */
const VIGENCIA_MS = 60_000;
const MAX_ENTRADAS = 28;

export interface PestanasConsultadas {
  readonly pestanas: readonly PestanaReporte[];
  /** Pestañas que fallaron mientras otras sí respondieron. */
  readonly faltantes: readonly VerticalReporte[];
}

/**
 * Pide al reporte los mismos datos que usan las pestañas, con el contexto
 * actual, y los guarda en memoria por (pestaña, contexto) para no repetir
 * peticiones entre preguntas. Un fallo no se guarda: reintentar vuelve a pedir.
 */
@Injectable({ providedIn: 'root' })
export class ReportAssistantData {
  private readonly cliente = inject(ReportingClient);
  private readonly memoria = new Map<string, { readonly en: number; readonly promesa: Promise<PestanaReporte> }>();

  pestana(vertical: VerticalReporte, contexto: ContextoReporte): Promise<PestanaReporte> {
    const clave = `${vertical}|${JSON.stringify(contexto)}`;
    const guardada = this.memoria.get(clave);
    if (guardada !== undefined && Date.now() - guardada.en < VIGENCIA_MS) {
      return guardada.promesa;
    }
    const promesa = firstValueFrom(this.cliente.pestana(vertical, contexto));
    this.memoria.set(clave, { en: Date.now(), promesa });
    promesa.catch(() => this.memoria.delete(clave));
    while (this.memoria.size > MAX_ENTRADAS) {
      const masVieja = this.memoria.keys().next().value;
      if (masVieja === undefined) {
        break;
      }
      this.memoria.delete(masVieja);
    }
    return promesa;
  }

  /**
   * Las siete pestañas. Si solo algunas fallan se contesta con las que
   * llegaron y se avisa cuáles faltan; si fallan todas se relanza el primer
   * error para que la pantalla lo traduzca (permiso, conexión, inesperado).
   */
  async todas(contexto: ContextoReporte): Promise<PestanasConsultadas> {
    const resultados = await Promise.allSettled(VERTICALES.map((v) => this.pestana(v, contexto)));
    const pestanas: PestanaReporte[] = [];
    const faltantes: VerticalReporte[] = [];
    const errores: unknown[] = [];
    resultados.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        pestanas.push(r.value);
      } else {
        faltantes.push(VERTICALES[i]);
        errores.push(r.reason);
      }
    });
    if (pestanas.length === 0) {
      throw errores[0];
    }
    return { pestanas, faltantes };
  }

  limpiar(): void {
    this.memoria.clear();
  }
}
