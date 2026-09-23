import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Un banner de la columna izquierda: quién lo paga, qué dice y adónde lleva. */
export interface BannerPublicitario {
  readonly id: string;
  /**
   * Quién paga el hueco, escrito en la propia tarjeta.
   *
   * El pie del marco público lo promete: «Cuando una ficha está paga, dice
   * "Espacio pagado" en la propia tarjeta». Un banner sin rótulo se leería como
   * una recomendación de AloVida, que es exactamente lo que el pie dice que no
   * pasa.
   */
  readonly rotulo: 'Espacio pagado' | 'AloVida';
  readonly titulo: string;
  readonly texto: string;
  readonly accion: string;
  readonly enlace: readonly string[];
  /** El tono del arte, mientras no haya imagen del anunciante. */
  readonly tono: 'petroleo' | 'aguamarina';
}

/**
 * Los banners que se ven hoy.
 *
 * No hay API de anuncios todavía: la lista vive acá y son dos —uno pago y uno
 * de la casa— para que el hueco tenga su forma real y no sea un rectángulo
 * gris que diga «publicidad». Cuando exista el catálogo de campañas (la ruta
 * `promotions/:campaignId` ya está declarada), esto pasa a leerlo y la lista
 * desaparece.
 */
export const BANNERS: readonly BannerPublicitario[] = [
  {
    id: 'clinica-los-olivos',
    rotulo: 'Espacio pagado',
    titulo: 'Clínica Los Olivos',
    texto: 'Urgencias 24 horas, 18 especialidades y convenio con las principales aseguradoras.',
    accion: 'Ver la clínica',
    enlace: ['/o', 'clinica-los-olivos'],
    tono: 'petroleo',
  },
  {
    id: 'alovida-vitrina',
    rotulo: 'AloVida',
    titulo: '¿Sos profesional de la salud?',
    texto: 'Creá tu vitrina pública y publicá para tus pacientes desde el primer día.',
    accion: 'Crear mi cuenta',
    enlace: ['/auth', 'register'],
    tono: 'aguamarina',
  },
];

/**
 * La columna de banners de la red social (la izquierda, debajo de las
 * tendencias).
 *
 * Cada banner es una tarjeta con la misma anatomía —rótulo de quién paga, arte,
 * título, texto y una sola acción— para que dos anunciantes distintos se vean
 * como parte de la misma página y no como dos widgets pegados.
 */
@Component({
  selector: 'app-feed-banner',
  imports: [RouterLink],
  templateUrl: './feed-banner.html',
  styleUrl: './feed-banner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedBanner {
  protected readonly banners = BANNERS;
}
