import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type {
  ReceivedService,
  ReceivedServicesPage,
  ReceivedServiceType,
} from '../../../../core/data-access/received-services/received-services.types';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import type { HistoryService } from '../../../utils/clinical-pdf/history-received-services';
import { formatDate } from '../../../utils/pdf-export/pdf-format';
import type { Tone } from '../../tone/tone.types';

/* ============================================================================
    De lo que devolvió la API a lo que se lee en «Servicios recibidos».

    Funciones puras, sin TestBed, y sin un solo identificador: todo lo que sale
    de acá es texto ya resuelto. El único `id` que sobrevive es la clave de
    dibujo de la fila, y ninguna plantilla lo pinta.
    ========================================================================== */

/** Lo que se muestra cuando el registro no trae ese dato. */
export const NO_DATA = 'Sin registrar';

/** Lo que se muestra cuando el servicio no tiene cobro registrado. */
export const NO_CHARGE = 'Sin cobro registrado';

/** Lo que se muestra cuando el concepto del servicio no tiene etiqueta. */
export const UNNAMED_SERVICE = 'Servicio sin denominación';

const TYPE_LABEL: Readonly<Record<Exclude<ReceivedServiceType, 'OTHER'>, string>> = {
  INTERVENTION: 'Intervención médica',
  VACCINATION: 'Vacunación',
};

const TYPE_TONE: Readonly<Record<ReceivedServiceType, Tone>> = {
  INTERVENTION: 'primary',
  VACCINATION: 'info',
  OTHER: 'secondary',
};

/** Una fila de la tabla, toda en texto. */
export interface ReceivedServiceRow {
  readonly id: string;
  readonly typeLabel: string;
  readonly typeTone: Tone;
  readonly title: string;
  readonly performedAt: Date;
  readonly performer: string;
  readonly site: string;
  readonly status: string;
  /** Resultado y nota juntos; vacío si no hay ninguno. */
  readonly result: string;
  /** El costo ya formateado, o {@link NO_CHARGE}. Vacío si quien lee no ve importes. */
  readonly cost: string;
}

/** Los conceptos que hay que etiquetar para dibujar la página. */
export function conceptsOf(items: readonly ReceivedService[]): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    ids.add(item.serviceConceptId);
    ids.add(item.statusConceptId);
    // El tipo conocido se rotula solo; uno nuevo hay que preguntarlo.
    if (item.type === 'OTHER') ids.add(item.typeConceptId);
    if (item.outcomeConceptId !== undefined) ids.add(item.outcomeConceptId);
  }
  return [...ids];
}

/** Una página de la API como filas, en el mismo orden en que llegó (más reciente primero). */
export function receivedServiceRows(page: ReceivedServicesPage, labels: ConceptLabels): ReceivedServiceRow[] {
  const label = (conceptId: string | undefined): string | undefined => (conceptId === undefined ? undefined : labels.get(conceptId)?.display);
  return page.items.map((item) => ({
    id: item.id,
    typeLabel: item.type === 'OTHER' ? (label(item.typeConceptId) ?? 'Otro servicio') : TYPE_LABEL[item.type],
    typeTone: TYPE_TONE[item.type],
    title: label(item.serviceConceptId) ?? UNNAMED_SERVICE,
    performedAt: item.performedAt,
    performer: item.performerName ?? NO_DATA,
    site: item.practiceSiteName ?? NO_DATA,
    status: label(item.statusConceptId) ?? NO_DATA,
    result: [label(item.outcomeConceptId), item.resultText].filter((part): part is string => part !== undefined && part.trim() !== '').join(' · '),
    cost: page.costsVisible ? (item.cost === null ? NO_CHARGE : withDisplayCurrency(item.cost.amount, item.cost.currencyCode)) : '',
  }));
}

/** Las filas como las imprime el PDF de la historia: la misma redacción que la pantalla. */
export function historyServices(rows: readonly ReceivedServiceRow[]): HistoryService[] {
  return rows.map((row) => ({
    date: formatDate(row.performedAt),
    title: row.title,
    type: row.typeLabel,
    performer: row.performer,
    site: row.site,
    status: row.status,
    result: row.result,
    cost: row.cost,
  }));
}
