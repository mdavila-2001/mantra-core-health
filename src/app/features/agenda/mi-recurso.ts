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
  return misRecursosDeAgenda(scheduling, tenantId, practitionerProfileId).pipe(
    map((recursos) => recursos[0] ?? null),
  );
}

/**
 * **Todas** las agendas de quien tiene la sesión, no la primera.
 *
 * ## Por qué hizo falta
 *
 * `miRecursoDeAgenda` resolvía con `.find(...)`, que devuelve **una** y descarta
 * el resto. Un profesional que atiende en dos sedes tiene dos recursos, y el
 * segundo era invisible en todo el producto: no se podía elegir dónde publicar
 * un horario, y la pregunta «¿en qué consultorio?» no existía en ninguna
 * pantalla.
 *
 * No es hipotético: en la base de desarrollo hay un profesional con **tres**
 * agendas, y hasta hoy sólo se veía una.
 *
 * ## Qué NO cambia
 *
 * `miRecursoDeAgenda` sigue devolviendo la primera y sigue siendo lo que usan
 * «Consulta médica» y «Evoluciones». Esas dos también tendrían que preguntar
 * cuál, pero cambiarlas acá sería tocar tres pantallas en un arreglo que se
 * pidió para una. Queda dicho para no perderlo.
 *
 * El orden es el que devuelve la API, y es estable: sin un criterio explícito,
 * «la primera» al menos no cambia entre dos cargas.
 */
export function misRecursosDeAgenda(
  scheduling: SchedulingClient,
  tenantId: string,
  practitionerProfileId: string,
): Observable<readonly AgendaResource[]> {
  return scheduling
    .listResources({ tenantId })
    .pipe(map((pagina) => pagina.items.filter((r) => r.resourceRefId === practitionerProfileId)));
}
