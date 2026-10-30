import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { formatearFrescura } from '@core/data-access/reporting/reporting-format';
import { ETIQUETA_VERTICAL } from '@core/data-access/reporting/reporting-labels';
import type { ReporteCatalogo } from '@core/data-access/reporting/reporting.types';
import { nextControlId } from '@shared/forms/form-control.context';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Badge } from '@shared/components/atoms/badge/badge';

/**
 * Tarjeta de un reporte en el grid de inicio.
 *
 * Todo lo que importa para decidir si abrirlo está a la vista y en texto:
 * qué es, de qué vertical, quién responde por él, si está certificado o aún
 * en diseño, y qué tan fresco está. Las insignias llevan palabra —el color
 * solo refuerza—. Un reporte cuya ruta no empieza por `/reporting` es una
 * pantalla que ya existía en el portal de administración: se marca como tal
 * para que quien la abra no espere el aspecto ni los filtros de este portal.
 */
@Component({
  selector: 'app-report-card',
  imports: [RouterLink, AppButtonLink, Badge],
  templateUrl: './report-card.html',
  styleUrl: './report-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCard {
  readonly report = input.required<ReporteCatalogo>();
  readonly favorite = input(false);

  /** La tarjeta no guarda nada: avisa y quien la contiene decide. */
  readonly favoriteToggled = output<ReporteCatalogo>();
  readonly opened = output<ReporteCatalogo>();

  protected readonly ids = nextControlId('rc');
  protected readonly verticalLabel = computed(() => ETIQUETA_VERTICAL[this.report().vertical]);
  protected readonly existingScreen = computed(() => !this.report().ruta.startsWith('/reporting'));
  protected readonly freshness = computed(() => {
    const text = formatearFrescura(this.report().frescuraMin);
    return text.startsWith('actualizado') ? 'Actualizado ahora' : `Actualizado ${text}`;
  });
}
