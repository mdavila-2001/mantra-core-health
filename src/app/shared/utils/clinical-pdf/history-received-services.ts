import type { PdfBlock } from '../pdf-export/pdf-export';

/* ============================================================================
    «Servicios recibidos» en el papel de la historia.

    Las intervenciones médicas realizadas y las vacunas, con lo mismo que la
    pantalla dice y en las mismas palabras: ningún campo es un uuid ni una fecha
    ISO, y el papel no reordena nada (la pantalla ya trae el más reciente
    primero). La consulta no entra acá —vive en «Atenciones»— ni el laboratorio
    y la imagenología —viven en «Órdenes de estudio» y «Resultados»—.
    ========================================================================== */

/** Un servicio, tal como lo imprime la historia. Todo en palabras. */
export interface HistoryService {
  /** «12/08/2026». */
  readonly date: string;
  /** «Infiltración articular». */
  readonly title: string;
  /** «Intervención médica» o «Vacunación». */
  readonly type: string;
  /** «Dra. Ana Rojas» o «Sin registrar». */
  readonly performer: string;
  /** «Clínica Los Olivos» o «Sin registrar». */
  readonly site: string;
  /** «Realizada». */
  readonly status: string;
  /** Resultado y nota; vacío si no hay. */
  readonly result: string;
  /** «350.00 Bs» o «Sin cobro registrado»; vacío si quien descarga no ve importes. */
  readonly cost: string;
}

const NONE = '—';

/**
 * La sección «Servicios recibidos». Siempre se imprime el encabezado: un papel
 * sin la sección deja a quien lo lee sin saber si no hubo servicios o si el
 * sistema no los trajo, y en un documento clínico eso no es lo mismo.
 */
export function servicesBlocks(services: readonly HistoryService[]): readonly PdfBlock[] {
  const blocks: PdfBlock[] = [{ kind: 'heading', text: 'Servicios recibidos', level: 2 }];
  if (services.length === 0) {
    blocks.push({ kind: 'paragraph', text: 'Sin servicios recibidos.' });
    return blocks;
  }

  // Sin importes para quien no los ve: una columna de «—» se leería como «sin cobro».
  const withCost = services.some((service) => service.cost !== '');
  const header = ['Fecha', 'Servicio', 'Profesional y sede', 'Estado', 'Resultado', ...(withCost ? ['Costo'] : [])];
  blocks.push({ kind: 'row', text: 'Servicios recibidos', cells: header, header: true });
  for (const service of services) {
    const performer = `${service.performer} · ${service.site}`;
    const result = service.result === '' ? NONE : service.result;
    blocks.push({
      kind: 'row',
      text: `${service.date} — ${service.title} (${service.type}) — ${performer}`,
      cells: [
        service.date,
        `${service.title} (${service.type})`,
        performer,
        service.status,
        result,
        ...(withCost ? [service.cost] : []),
      ],
    });
  }
  return blocks;
}
