import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { etiquetaDeMultiplicador } from '../../loyalty/punto-motivo';
import type {
  EstadoDePromocionRecibida,
  MotivoDePromocion,
  PromocionRecibida,
} from '../promotions.fixtures';

/** Cómo se dibuja: la tarjeta de la lista o la notificación compacta. */
export type VarianteDeTarjeta = 'completa' | 'compacta';

const ETIQUETA_DE_ESTADO: Readonly<Record<EstadoDePromocionRecibida, string>> = {
  nueva: 'Nueva',
  vista: 'Vista',
  vencida: 'Vencida',
};

const TONO_DE_ESTADO: Readonly<Record<EstadoDePromocionRecibida, BadgeVariant>> = {
  nueva: 'success',
  vista: 'info',
  vencida: 'secondary',
};

const ETIQUETA_DE_MOTIVO: Readonly<Record<MotivoDePromocion, string>> = {
  'lote-proximo-a-vencer': 'Lote próximo a vencer',
};

/**
 * **La tarjeta de una promoción recibida** (T-E7): qué farmacia, qué
 * medicamento, cuánto menos, hasta cuándo, y el enlace al detalle público.
 *
 * Presentacional: no carga nada ni decide el estado; lo recibe.
 *
 * El chip de puntos usa `etiquetaDeMultiplicador` de «Mis puntos» (T-E6), para
 * que «x2» se diga en un solo lugar.
 *
 * No muestra ningún dato de salud de quien la recibe: la tarjeta habla de la
 * campaña, no de la persona.
 */
@Component({
  selector: 'app-promotion-card',
  imports: [AppButtonLink, Badge, Card, DatePipe, Link, RouterLink],
  templateUrl: './promotion-card.html',
  styleUrl: './promotion-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromotionCard {
  readonly promocion = input.required<PromocionRecibida>();
  readonly variante = input<VarianteDeTarjeta>('completa');

  /** El destino del CTA: el detalle público de la campaña. */
  protected readonly ruta = computed(() => ['/promotions', this.promocion().campaignId]);

  protected readonly etiquetaDeEstado = computed(() => ETIQUETA_DE_ESTADO[this.promocion().estado]);
  protected readonly tonoDeEstado = computed(() => TONO_DE_ESTADO[this.promocion().estado]);

  protected readonly etiquetaDeMotivo = computed(() => {
    const motivo = this.promocion().motivo;
    return motivo === null ? null : ETIQUETA_DE_MOTIVO[motivo];
  });

  /** «Puntos x2», o `null` si la promoción no multiplica puntos. */
  protected readonly etiquetaDePuntos = computed(() => {
    const factor = this.promocion().factorDePuntos;
    return factor === null ? null : `Puntos ${etiquetaDeMultiplicador(factor)}`;
  });

  protected readonly vencida = computed(() => this.promocion().estado === 'vencida');
}
