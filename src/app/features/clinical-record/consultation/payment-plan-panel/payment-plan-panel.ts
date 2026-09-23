import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { QuotationsClient } from '../../../../core/data-access/quotations/quotations.client';
import type {
  Installment,
  PaymentFrequency,
  Quotation,
  QuotationListItem,
} from '../../../../core/data-access/quotations/quotations.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../shared/components/molecules/card/card';
import { QUOTATIONS_ROUTE } from '../../../quotations/quotations.routes';

/**
 * Los estados con los que un plan **corresponde** mostrarse en la consulta.
 * Uno aceptado es el que la persona está pagando; uno en borrador o enviado es
 * el que se le está proponiendo. Vencidos o rechazados ya no le dicen nada a
 * quien atiende. El estado es texto abierto (ver `QuotationStatus`): lo que no
 * esté acá, no se muestra.
 */
const ESTADOS_VIGENTES: Readonly<Record<string, { etiqueta: string; enCurso: boolean }>> = {
  ACCEPTED: { etiqueta: 'En curso', enCurso: true },
  SENT: { etiqueta: 'Propuesto', enCurso: false },
  DRAFT: { etiqueta: 'Borrador', enCurso: false },
};

/** Cuántos planes se leen en detalle. Una persona con más de tres a la vez es rarísima. */
const TOPE_DE_PLANES = 3;

const NOMBRE_DE_FRECUENCIA: Readonly<Record<PaymentFrequency, string>> = {
  WEEKLY: 'semanales',
  BIWEEKLY: 'quincenales',
  MONTHLY: 'mensuales',
};

const FORMATO_MONTO = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Un plan, ya listo para leer de un vistazo. */
export interface PlanEnConsulta {
  readonly id: string;
  readonly tratamiento: string;
  readonly estado: string;
  readonly enCurso: boolean;
  readonly total: string;
  readonly anticipo: string | null;
  readonly resumen: string;
  readonly cuotas: readonly CuotaEnConsulta[];
  readonly proxima: CuotaEnConsulta | null;
}

export interface CuotaEnConsulta {
  readonly numero: number;
  readonly vence: string;
  readonly monto: string;
  readonly vencida: boolean;
}

type Lectura =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly planes: readonly PlanEnConsulta[] };

function hoyIso(): string {
  const hoy = new Date();
  return [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, '0'),
    String(hoy.getDate()).padStart(2, '0'),
  ].join('-');
}

function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split('-').map(Number) as [number, number, number];
  const fecha = new Date(anio, mes - 1, dia);
  return Number.isNaN(fecha.getTime()) ? iso : FORMATO_FECHA.format(fecha);
}

/** ¿Corresponde mostrarlo? Vigente por estado, y si no está aceptado, todavía válido. */
function corresponde(item: QuotationListItem, hoy: string): boolean {
  const estado = ESTADOS_VIGENTES[item.status];
  if (estado === undefined) {
    return false;
  }
  return estado.enCurso || item.validUntil >= hoy;
}

function aPlan(cotizacion: Quotation, hoy: string): PlanEnConsulta {
  const estado = ESTADOS_VIGENTES[cotizacion.status] ?? {
    etiqueta: cotizacion.status,
    enCurso: false,
  };
  const cuotas = cotizacion.installments.map((cuota: Installment) => ({
    numero: cuota.installmentNumber,
    vence: fechaLegible(cuota.dueDate),
    monto: FORMATO_MONTO.format(cuota.amount),
    vencida: cuota.dueDate < hoy,
  }));
  const proximaIndice = cotizacion.installments.findIndex((cuota) => cuota.dueDate >= hoy);
  const cantidad = cotizacion.installments.length;
  const frecuencia = NOMBRE_DE_FRECUENCIA[cotizacion.paymentFrequency] ?? '';
  return {
    id: cotizacion.id,
    tratamiento: cotizacion.serviceNameSnapshot,
    estado: estado.etiqueta,
    enCurso: estado.enCurso,
    total: FORMATO_MONTO.format(cotizacion.offeredPrice),
    anticipo:
      cotizacion.downPaymentAmount > 0 ? FORMATO_MONTO.format(cotizacion.downPaymentAmount) : null,
    resumen:
      cantidad === 0
        ? 'Pago único, sin cuotas'
        : `${cantidad} ${cantidad === 1 ? 'cuota' : `cuotas ${frecuencia}`.trim()} sin interés`,
    cuotas,
    proxima: proximaIndice === -1 ? null : (cuotas[proximaIndice] ?? null),
  };
}

/**
 * **El plan de pago de la persona, a la vista al abrir la consulta.**
 *
 * Sólo aparece **si corresponde**: cuando la persona tiene un plan de pago por
 * un tratamiento en curso o propuesto. Sin plan no dibuja nada —ni un cartel
 * de «no tiene»—, porque la consulta es para atender y un bloque vacío es
 * ruido. Tampoco ocupa lugar mientras lee: la rejilla de abajo no salta.
 *
 * Lee de `quotations` (FT-24), que es donde vive el plan: el listado por
 * paciente para saber si hay alguno, y el detalle de los vigentes para las
 * cuotas. No escribe nada.
 */
@Component({
  selector: 'app-payment-plan-panel',
  imports: [AppButton, Badge, Card, RouterLink],
  templateUrl: './payment-plan-panel.html',
  styleUrl: './payment-plan-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPlanPanel {
  private readonly quotations = inject(QuotationsClient);

  readonly patientProfileId = input.required<string>();

  protected readonly rutaDeCotizaciones = QUOTATIONS_ROUTE;

  protected readonly lectura = signal<Lectura>({ status: 'loading' });

  protected readonly planes = computed(() => {
    const estado = this.lectura();
    return estado.status === 'ready' ? estado.planes : [];
  });

  protected readonly fallo = computed(() => this.lectura().status === 'error');

  constructor() {
    effect(() => {
      const paciente = this.patientProfileId();
      untracked(() => this.cargar(paciente));
    });
  }

  protected reintentar(): void {
    this.cargar(this.patientProfileId());
  }

  private cargar(patientProfileId: string): void {
    if (patientProfileId === '') {
      this.lectura.set({ status: 'ready', planes: [] });
      return;
    }
    this.lectura.set({ status: 'loading' });
    const hoy = hoyIso();

    this.quotations
      .listQuotationsByPatient(patientProfileId)
      .pipe(
        switchMap((items) => {
          const vigentes = items.filter((item) => corresponde(item, hoy)).slice(0, TOPE_DE_PLANES);
          return vigentes.length === 0
            ? of<readonly Quotation[]>([])
            : forkJoin(vigentes.map((item) => this.quotations.getQuotation(item.id)));
        }),
      )
      .subscribe({
        next: (cotizaciones) =>
          this.lectura.set({
            status: 'ready',
            // El que se está pagando, primero.
            planes: cotizaciones
              .map((cotizacion) => aPlan(cotizacion, hoy))
              .sort((a, b) => Number(b.enCurso) - Number(a.enCurso)),
          }),
        error: () => this.lectura.set({ status: 'error' }),
      });
  }
}
