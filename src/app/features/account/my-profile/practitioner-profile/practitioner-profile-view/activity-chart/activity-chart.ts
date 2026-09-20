import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { PuntoDeSerie } from '../practitioner-profile-view.types';

/**
 * **Las consultas mes a mes**, en barras.
 *
 * ## Por qué un gráfico y no cuatro números más
 *
 * Un total acumulado —«312 encuentros»— no distingue una práctica que crece de
 * una que se apagó hace medio año. La serie es lo único que contesta esa
 * pregunta, y es lo que el cliente pidió el 19/09/2026 al rechazar los cuatro
 * contadores sueltos.
 *
 * ## Barras de CSS, no SVG
 *
 * El alto de cada barra es un porcentaje del máximo, resuelto en la hoja de
 * estilos. No hace falta medir nada, así que se dibuja igual bajo SSR —un
 * lienzo que necesita layout real llega gris al HTML del servidor— y se
 * adapta al ancho sin recalcular un `viewBox`.
 *
 * ## La tabla no es un extra
 *
 * Las barras son `aria-hidden`: un color y un alto no se leen en voz alta. El
 * dato de verdad viaja en una `<table>` oculta a la vista pero no al lector de
 * pantalla, con los mismos doce valores. Es el mismo contenido, dos formas.
 */
@Component({
  selector: 'app-activity-chart',
  imports: [],
  templateUrl: './activity-chart.html',
  styleUrl: './activity-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityChart {
  /** Los meses, del más viejo al más nuevo. */
  readonly puntos = input.required<readonly PuntoDeSerie[]>();

  /** El mes más alto de la serie; de él cuelgan todas las alturas. */
  private readonly maximo = computed(() =>
    this.puntos().reduce((alto, punto) => Math.max(alto, punto.valor), 0),
  );

  protected readonly total = computed(() =>
    this.puntos().reduce((suma, punto) => suma + punto.valor, 0),
  );

  protected readonly promedio = computed(() => {
    const meses = this.puntos().length;
    return meses === 0 ? 0 : Math.round(this.total() / meses);
  });

  /** El mes más alto, para decirlo en palabras además de dibujarlo. */
  protected readonly mejorMes = computed(() =>
    this.puntos().reduce<PuntoDeSerie | null>(
      (mejor, punto) => (mejor === null || punto.valor > mejor.valor ? punto : mejor),
      null,
    ),
  );

  /**
   * Cada mes con su alto en porcentaje.
   *
   * Un mes en cero se queda en 0 y no en un mínimo visible: una barra que se
   * ve cuando no hubo ninguna consulta dice lo contrario de lo que pasó. El
   * rótulo de abajo sigue estando, así que el mes no desaparece.
   */
  protected readonly barras = computed(() => {
    const maximo = this.maximo();
    return this.puntos().map((punto) => ({
      ...punto,
      alto: maximo === 0 ? 0 : Math.round((punto.valor / maximo) * 100),
      // Sólo el más alto lleva su cifra encima: doce números sobre doce
      // barras vuelven a ser la tabla que el gráfico vino a reemplazar.
      destacado: maximo > 0 && punto.valor === maximo,
    }));
  });
}
