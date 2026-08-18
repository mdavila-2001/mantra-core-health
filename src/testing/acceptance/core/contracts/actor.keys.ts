/**
 * Las claves de actor del catálogo de semillas (`SEED-CATALOG-PABLO.yaml`).
 *
 * Se declaran como constantes y no como cadenas sueltas porque un journey que
 * escribe `'patient.uno'` en vez de `'patient.one'` no falla al compilar: falla
 * en la corrida, con un mensaje sobre un login que no anduvo, y se pierde media
 * hora buscando el problema en la aplicación.
 *
 * **Las credenciales no están acá.** Viajan por variables de entorno
 * (`E2E_*_EMAIL` / `E2E_*_PASSWORD`) porque el contrato de semillas exige
 * autenticación real: una clave escrita en el repositorio termina siendo la de
 * un ambiente que no es el de pruebas.
 */
export const ACTORES = {
  /** Moderación: lee la cola, decide y resuelve apelaciones. */
  adminSecurity: 'admin.security',
  /** Profesional con vitrina publicada; autor del muro en P3 y calificado en P6. */
  doctorOne: 'doctor.one',
  /** Segundo profesional, para los negativos de aislamiento. */
  doctorTwo: 'doctor.two',
  /** Paciente con atención terminada con doctor.one; sigue su vitrina. */
  patientOne: 'patient.one',
  /** Paciente **sin** relación con doctor.one y que **no** lo sigue. */
  patientTwo: 'patient.two',
} as const;

/** Una clave de actor del catálogo. */
export type ActorKey = (typeof ACTORES)[keyof typeof ACTORES];

/**
 * Las claves de datos sembrados que los journeys pueden exigir.
 *
 * Igual que arriba: son las del catálogo, no inventadas acá.
 */
export const DATOS = {
  /** Cita COMPLETED + encounter CLOSED entre patient.one y doctor.one. */
  patient1Doctor1Completed: 'patient1-doctor1-completed',
  /** Cita CONFIRMED a futuro: sirve para el negativo de reseña. */
  patient1Doctor1Future: 'patient1-doctor1-future',
  /** Cita COMPLETED entre patient.two y doctor.two, para aislar. */
  patient2Doctor2Completed: 'patient2-doctor2-completed',
  /** patient.one sigue a doctor.one. */
  followPatient1Doctor1: 'community.follows.patient1-doctor1',
  /** patient.two **no** sigue a doctor.one. */
  noFollowPatient2Doctor1: 'community.non-follows.patient2-doctor1',
  /** Publicaciones históricas, para que el paginado tenga qué paginar. */
  postsHistoricos: 'community.posts.minimum',
  /** Una publicación reportable, para abrir la cola de moderación. */
  postReportable: 'community.posts.reportable',
} as const;

/**
 * Servicios que un journey puede exigir vivos.
 *
 * `workerCommunity` no es decorativo: el muro del seguidor se llena por el
 * fan-out, así que sin ese worker el journey P3-E2E-001 falla por una razón que
 * no es la que está probando.
 */
export const SERVICIOS = {
  api: 'api',
  front: 'front',
  postgres: 'postgres',
  redis: 'redis',
  workerCommunity: 'worker-community',
} as const;
