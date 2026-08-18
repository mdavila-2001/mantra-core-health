import { ACTORES, DATOS, SERVICIOS } from '../contracts/actor.keys';
import type { JourneySpec } from '../contracts/journey.types';

/**
 * P3-E2E-001 · publicar y que lo vea quien sigue.
 *
 * ## Lo que demuestra
 *
 * Que una publicación creada **durante la prueba** llega al muro de un seguidor
 * por el camino real —fan-out del worker incluido— y sigue ahí después de
 * recargar el navegador.
 *
 * ## Por qué la publicación no está sembrada
 *
 * Porque sembrarla probaría que el muro sabe leer una fila, que es otra cosa.
 * El texto lleva el `runId` de la corrida: así dos ejecuciones simultáneas no se
 * pisan y la aserción apunta a *esta* publicación y no a una de ayer.
 *
 * ## Por qué el paso 10 no sobra
 *
 * `patient.two` no sigue a `doctor.one`. Si la publicación con visibilidad
 * `FOLLOWERS` le apareciera igual, el journey «feliz» seguiría pasando y la
 * regla de visibilidad estaría rota. El negativo es parte del mismo recorrido, y
 * no un test aparte que alguien puede olvidarse de correr.
 */
export const p3PublicarYVerEnMuro: JourneySpec = {
  id: 'P3-E2E-001',
  title: 'publicación con visibilidad FOLLOWERS llega al muro de quien sigue',
  tags: ['@critical', '@p3', '@community'],
  actors: [ACTORES.doctorOne, ACTORES.patientOne, ACTORES.patientTwo],
  preconditions: [
    DATOS.followPatient1Doctor1,
    DATOS.noFollowPatient2Doctor1,
    DATOS.postsHistoricos,
  ],
  requiresLive: [
    SERVICIOS.api,
    SERVICIOS.front,
    SERVICIOS.postgres,
    // Sin el worker el muro del seguidor queda vacío y el fallo acusa a la UI.
    SERVICIOS.workerCommunity,
  ],
  steps: [
    { actor: ACTORES.doctorOne, action: 'login' },
    { actor: ACTORES.doctorOne, action: 'abrirMuro' },
    {
      actor: ACTORES.doctorOne,
      action: 'publicar',
      target: 'texto único con runId, visibilidad FOLLOWERS',
    },
    {
      assert: 'publicacionVisibleEnMuroPropio',
      note: 'El autor la ve aunque sea FOLLOWERS: nadie se sigue a sí mismo, así que esto sólo pasa si la identidad del lector se resuelve bien.',
    },
    { actor: ACTORES.patientOne, action: 'login' },
    { actor: ACTORES.patientOne, action: 'abrirMuro' },
    {
      assert: 'publicacionVisibleEnMuroDelSeguidor',
      note: 'Se espera por condición, con tope; el fan-out tarda lo que tarda y un sleep fijo esconde el problema.',
    },
    { actor: ACTORES.patientOne, action: 'recargarNavegador' },
    {
      assert: 'publicacionSiguePresente',
      note: 'Recargar es lo que separa «se pintó» de «se guardó».',
    },
    { actor: ACTORES.patientTwo, action: 'login' },
    { actor: ACTORES.patientTwo, action: 'abrirMuro' },
    {
      assert: 'publicacionNoVisibleParaQuienNoSigue',
      subject: ACTORES.patientTwo,
      note: 'La visibilidad FOLLOWERS la evalúa el servidor. Si acá aparece, la regla no existe aunque el CSS la esconda.',
    },
  ],
};

/**
 * P3-E2E-002 · comentar y reaccionar, y que quede.
 *
 * ## Lo que demuestra
 *
 * Que el comentario y la reacción de otra persona se persisten y **siguen ahí
 * tras recargar**, con sus contadores. Es el journey que fija el hueco que este
 * carril cerró: antes el contador subía con el gesto y volvía a cero al
 * recargar, porque la lectura no traía los recuentos.
 *
 * ## Sobre la notificación del paso final
 *
 * El carril la pide «si ese evento forma parte del contrato real». Hoy
 * `social_notifications` existe y el worker no la emite en este flujo, así que
 * la aserción está declarada como **condicional** y el adaptador la omite
 * mientras el contrato no la produzca. Afirmarla sin que exista haría fallar el
 * journey por algo que nadie prometió.
 */
export const p3InteraccionPersistida: JourneySpec = {
  id: 'P3-E2E-002',
  title: 'comentario y reacción de un tercero persisten tras recargar',
  tags: ['@critical', '@p3', '@community'],
  actors: [ACTORES.doctorOne, ACTORES.patientOne],
  preconditions: [DATOS.followPatient1Doctor1],
  requiresLive: [
    SERVICIOS.api,
    SERVICIOS.front,
    SERVICIOS.postgres,
    SERVICIOS.workerCommunity,
  ],
  steps: [
    { actor: ACTORES.doctorOne, action: 'login' },
    {
      actor: ACTORES.doctorOne,
      action: 'publicar',
      target: 'texto único con runId, visibilidad PUBLIC',
    },
    { actor: ACTORES.patientOne, action: 'login' },
    { actor: ACTORES.patientOne, action: 'abrirMuro' },
    { actor: ACTORES.patientOne, action: 'reaccionar', target: 'LIKE' },
    { actor: ACTORES.patientOne, action: 'comentar', target: 'texto único con runId' },
    { assert: 'contadorDeReaccionesEnUno' },
    { assert: 'contadorDeComentariosEnUno' },
    { actor: ACTORES.patientOne, action: 'recargarNavegador' },
    {
      assert: 'reaccionPropiaSigueMarcada',
      note: 'Lo que el carril llama «refresh conserva»: el estado propio sale de la lectura, no del gesto.',
    },
    { assert: 'contadorDeReaccionesEnUno' },
    { assert: 'comentarioSigueEnElHilo' },
    {
      assert: 'notificacionSocialAlAutor',
      note: 'CONDICIONAL: sólo se comprueba si el contrato real emite la notificación social en este flujo. Hoy no la emite y el adaptador la omite.',
    },
  ],
};

/** Los journeys del carril P3. */
export const P3_JOURNEYS = [p3PublicarYVerEnMuro, p3InteraccionPersistida] as const;
