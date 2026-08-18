import { ACTORES, DATOS, SERVICIOS } from '../contracts/actor.keys';
import type { JourneySpec } from '../contracts/journey.types';

/**
 * P6-E2E-001 · reportar, decidir, apelar y resolver.
 *
 * ## Lo que demuestra
 *
 * El ciclo completo de moderación con datos reales: alguien reporta, la entrada
 * **aparece en una cola que se puede leer**, un moderador decide con motivo, el
 * sancionado apela y el moderador cierra la apelación. Cada paso persiste.
 *
 * ## Por qué nada de esto está sembrado
 *
 * El catálogo lo prohíbe explícitamente: ni la decisión ni la apelación se
 * siembran, porque son justamente lo que el journey tiene que producir. Lo único
 * sembrado es la publicación reportable.
 *
 * ## Por qué el motivo lleva el runId
 *
 * Es lo que permite encontrar *esta* decisión entre las de corridas anteriores
 * sin depender del orden de la cola.
 */
export const p6CicloDeModeracion: JourneySpec = {
  id: 'P6-E2E-001',
  title: 'reporte real produce cola, decisión, apelación y resolución',
  tags: ['@critical', '@p6', '@moderation'],
  actors: [ACTORES.patientOne, ACTORES.adminSecurity],
  preconditions: [DATOS.postReportable],
  requiresLive: [SERVICIOS.api, SERVICIOS.front, SERVICIOS.postgres],
  steps: [
    { actor: ACTORES.patientOne, action: 'login' },
    {
      actor: ACTORES.patientOne,
      action: 'reportarPublicacion',
      target: DATOS.postReportable,
      note: 'Motivo con runId, para poder ubicar la entrada después.',
    },
    { actor: ACTORES.adminSecurity, action: 'login' },
    { actor: ACTORES.adminSecurity, action: 'abrirColaDeModeracion' },
    {
      assert: 'entradaEnColaParaElContenido',
      subject: DATOS.postReportable,
      note: 'Sin las lecturas de cola este paso era imposible: se podía decidir sobre un uuid conocido, no encontrarlo.',
    },
    {
      actor: ACTORES.adminSecurity,
      action: 'decidir',
      target: 'REMOVED con motivo único',
    },
    { actor: ACTORES.adminSecurity, action: 'recargarNavegador' },
    {
      assert: 'entradaResueltaPersiste',
      note: 'Recargar separa «cambió en pantalla» de «cambió en la base».',
    },
    {
      actor: ACTORES.patientOne,
      action: 'apelarDecision',
      note: 'Apela quien puede: el servidor comprueba que el perfil que apela sea suyo.',
    },
    { actor: ACTORES.adminSecurity, action: 'abrirApelaciones' },
    {
      assert: 'apelacionVisibleConSuDecision',
      note: 'La decisión impugnada viaja embebida: resolver sin leer qué se decidió es resolver a ciegas.',
    },
    { actor: ACTORES.adminSecurity, action: 'resolverApelacion', target: 'UPHELD' },
    { actor: ACTORES.adminSecurity, action: 'recargarNavegador' },
    {
      assert: 'apelacionResueltaPersiste',
      note: 'Y la entrada que la apelación re-encoló también quedó cerrada; si no, la cola crece con trabajo que nadie puede terminar.',
    },
  ],
};

/**
 * P6-E2E-002 · calificar una atención real y que el profesional conteste.
 *
 * ## Lo que demuestra
 *
 * Que la reseña **exige una atención terminada de verdad**, que aparece en el
 * perfil público sin filtrar identificadores clínicos, y que el profesional
 * puede responder.
 *
 * ## El paso 8 es el que importa
 *
 * Comprobar que la respuesta pública **no** contiene el `verifiedEncounterId` ni
 * el perfil del paciente no es una formalidad: ese identificador ata la reseña a
 * un encuentro clínico concreto, y publicarlo convertiría la ficha de un
 * profesional en la lista de quién se atendió con él y qué día.
 *
 * ## Los negativos van en el mismo journey
 *
 * `patient.two` no tuvo atención con `doctor.one`, y una cita futura no habilita
 * calificar. Los dos casos están acá y no en un archivo aparte porque son la
 * misma regla vista desde el otro lado — y un negativo que vive lejos del
 * positivo es un negativo que alguien deja de correr.
 */
export const p6ResenaVerificada: JourneySpec = {
  id: 'P6-E2E-002',
  title: 'atención terminada habilita reseña, y el profesional responde',
  tags: ['@critical', '@p6', '@moderation'],
  actors: [ACTORES.patientOne, ACTORES.patientTwo, ACTORES.doctorOne],
  preconditions: [
    DATOS.patient1Doctor1Completed,
    DATOS.patient1Doctor1Future,
    DATOS.patient2Doctor2Completed,
  ],
  requiresLive: [SERVICIOS.api, SERVICIOS.front, SERVICIOS.postgres],
  steps: [
    { actor: ACTORES.patientOne, action: 'login' },
    {
      actor: ACTORES.patientOne,
      action: 'abrirAtencionCompletada',
      target: DATOS.patient1Doctor1Completed,
    },
    {
      actor: ACTORES.patientOne,
      action: 'calificar',
      target: 'puntuación, dimensiones y comentario único con runId',
    },
    { assert: 'resenaAceptadaYVerificada' },
    { actor: 'anonimo', action: 'abrirPerfilPublicoDeDoctorOne' },
    { assert: 'resenaVisibleEnPerfilPublico' },
    { assert: 'promedioActualizado' },
    {
      assert: 'respuestaPublicaSinIdentificadoresClinicos',
      note: 'Ni verifiedEncounterId ni reviewerPatientProfileId. Se comprueba sobre el JSON de la respuesta, no sobre lo que pinta la pantalla.',
    },
    { actor: ACTORES.doctorOne, action: 'login' },
    { actor: ACTORES.doctorOne, action: 'responderResena', target: 'texto único con runId' },
    { actor: 'anonimo', action: 'recargarPerfilPublico' },
    { assert: 'respuestaDelProfesionalVisible' },
    {
      actor: ACTORES.patientTwo,
      action: 'intentarCalificar',
      target: ACTORES.doctorOne,
    },
    {
      assert: 'calificarRechazadoSinAtencion',
      subject: ACTORES.patientTwo,
      note: 'Rechazado por el servidor. Que el botón no esté no alcanza: el carril lo dice con todas las letras.',
    },
    {
      actor: ACTORES.patientOne,
      action: 'intentarCalificarCitaFutura',
      target: DATOS.patient1Doctor1Future,
    },
    { assert: 'calificarRechazadoPorAtencionNoTerminada' },
  ],
};

/** Los journeys del carril P6. */
export const P6_JOURNEYS = [p6CicloDeModeracion, p6ResenaVerificada] as const;
