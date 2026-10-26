import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, type TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RelationEvidence } from '../../molecules/relation-evidence/relation-evidence';
import type {
  RelationColumnFooterContext,
  RelationColumnView,
  RelationGroupsTone,
  RelationNavigation,
} from './relation-groups.types';

/**
 * Un bloque de relaciones del glosario: un título y sus columnas, cada vecino
 * con su evidencia (barra, frecuencia en palabras y sello de la fuente).
 *
 * Es la pieza única que comparten el mapa de relaciones, la ficha del término
 * y el comparador (TAREA-41 F5.5): los grupos y los sellos se ven igual en
 * las tres pantallas porque se pintan acá, no en copias.
 *
 * ```html
 * <app-relation-groups
 *   heading="Lo que se observa"
 *   headingId="ruta-zona-hallazgos"
 *   tone="findings"
 *   [columns]="columnas"
 *   navigation="select"
 *   (neighborSelected)="focusOn($event)"
 * />
 * ```
 *
 * El ancho de las columnas lo decide quien lo monta con la propiedad
 * `--relation-groups-columns` (por defecto, tantas como entren de 14 rem).
 */
@Component({
  selector: 'app-relation-groups',
  imports: [NgTemplateOutlet, RelationEvidence, RouterLink],
  templateUrl: './relation-groups.html',
  styleUrl: './relation-groups.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relation-groups',
    '[class.relation-groups--findings]': "tone() === 'findings'",
    '[class.relation-groups--next]': "tone() === 'next'",
    '[class.relation-groups--context]': "tone() === 'context'",
  },
})
export class RelationGroups {
  readonly heading = input.required<string>();
  /** Id del título; el de cada columna se arma como `<headingId>-<key>`. */
  readonly headingId = input.required<string>();
  /** Nivel del título del bloque (2 o 3); el de las columnas es el siguiente. */
  readonly headingLevel = input<2 | 3>(3);
  readonly columns = input.required<readonly RelationColumnView[]>();
  readonly tone = input<RelationGroupsTone>('context');
  readonly navigation = input<RelationNavigation>('link');
  /** Ruta de la ficha en modo `link`: se le agrega el `conceptId`. */
  readonly linkPrefix = input<string>('/glossary');
  /** En modo `select`, cómo empieza el nombre accesible del botón. */
  readonly selectLabelPrefix = input<string>('Ver el mapa de');
  /** Lo que dice una columna sin vecinos (el comparador las muestra igual). */
  readonly emptyColumnText = input<string>('Ningún término.');
  /** Pie opcional de cada columna (por ejemplo, «Ver todos»). */
  readonly columnFooter = input<TemplateRef<RelationColumnFooterContext> | null>(null);

  readonly neighborSelected = output<string>();
}
