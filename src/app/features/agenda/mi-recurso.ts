import { map, type Observable } from 'rxjs';

import type { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource } from '@core/data-access/scheduling/scheduling.types';

/**
 * El recurso de agenda de quien tiene la sesión, o `null` si no publicó ninguno.
 *
 * ## Por qué se busca por el perfil y no por el usuario
 *
 * Porque es **el mismo criterio con el que el backend decide si la agenda es
 * suya** (`assertRecursoDelActor`): el recurso apunta al perfil profesional en
 * `resourceRefId`. Preguntarlo de otra forma acá daría una respuesta que el
 * servidor después contradice.
 *
 * ## Por qué vive suelto y no dentro de una pantalla
 *
 * Lo necesitan «Mi agenda», «Consulta médica» y «Evoluciones», y las tres hacen
 * exactamente la misma pareja de llamadas. La tercera copia es donde una de las
 * tres se queda con el criterio viejo.
 */
export function miRecursoDeAgenda(
  scheduling: SchedulingClient,
  tenantId: string,
  practitionerProfileId: string,
): Observable<AgendaResource | null> {
  return scheduling
    .listResources({ tenantId })
    .pipe(map((pagina) => pagina.items.find((r) => r.resourceRefId === practitionerProfileId) ?? null));
}
