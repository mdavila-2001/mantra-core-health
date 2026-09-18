import { imagenesDeVitrina, SEMILLAS_DE_VITRINA } from './bolivia-eje-central';
import { SEMILLAS_DE_INSTITUCIONES } from './instituciones';
import { ESPECIALIDAD, ESTADO } from './conceptos';
import { MEDICA, PACIENTE, PACIENTES, PROFESIONALES, type ProfesionalSimulado } from './personas';
import { TENANT_CLINICA, TENANT_FARMACIA, TENANT_HOSPITAL, TENANT_LABORATORIO, TENANT_PLATAFORMA } from '../mock-session';
import { avatarSvg, Coleccion, imagenSvg, iso, portadaSvg, uuid } from '../mock-store';

/* ============================================================================
    La red social: vitrinas públicas (personas y organizaciones), publicaciones,
    comentarios, reacciones, reseñas, grupos, temas y mensajería directa.
    ========================================================================== */

export type ClaseDeVitrina = 'PRACTITIONER' | 'ORGANIZATION' | 'PHARMACY' | 'DIAGNOSTIC_UNIT' | 'INSURER' | 'PATIENT';

export interface VitrinaSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly targetId: string;
  readonly kind: ClaseDeVitrina;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string;
  readonly biography: string;
  readonly avatarUrl: string;
  readonly coverUrl: string;
  readonly avatarFileId: string;
  readonly coverFileId: string;
  readonly verified: boolean;
  readonly acceptsReviews: boolean;
  readonly visibility: 'PUBLIC' | 'PRIVATE';
  readonly city: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  readonly specialties: readonly string[];
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly hasPublishedAgenda: boolean;
  readonly seguidores: number;
}

export const TIPO_VITRINA = {
  PRACTITIONER: uuid('concept-profile-target-practitioner'),
  ORGANIZATION: uuid('concept-profile-target-organization'),
  PHARMACY: uuid('concept-profile-target-pharmacy'),
  DIAGNOSTIC_UNIT: uuid('concept-profile-target-diagnostic-unit'),
  INSURER: uuid('concept-profile-target-insurer'),
  PATIENT: uuid('concept-profile-target-patient'),
} as const;

export const CONCEPTO = {
  postText: uuid('concept-post-type-text'),
  postArticle: uuid('concept-post-type-article'),
  postPoll: uuid('concept-post-type-poll'),
  visibilityPublic: uuid('concept-visibility-public'),
  visibilityFollowers: uuid('concept-visibility-followers'),
  reaction: {
    LIKE: uuid('concept-reaction-like'),
    LOVE: uuid('concept-reaction-love'),
    INSIGHTFUL: uuid('concept-reaction-insightful'),
    CELEBRATE: uuid('concept-reaction-celebrate'),
    SUPPORT: uuid('concept-reaction-support'),
  },
  mediaImage: uuid('concept-media-role-image'),
  followProfile: uuid('concept-followable-profile'),
  followTopic: uuid('concept-followable-topic'),
  bookmarkPost: uuid('concept-bookmarkable-post'),
  feedPost: uuid('concept-feed-item-post'),
  feedOriginFollow: uuid('concept-feed-origin-follow'),
  feedOriginRecommended: uuid('concept-feed-origin-recommended'),
  sourcePost: uuid('concept-source-post'),
  sourceComment: uuid('concept-source-comment'),
  sourceReview: uuid('concept-source-review'),
  notifReaction: uuid('concept-notif-reaction'),
  notifComment: uuid('concept-notif-comment'),
  notifFollow: uuid('concept-notif-follow'),
  notifMention: uuid('concept-notif-mention'),
  reviewDisplayReal: uuid('concept-review-display-real'),
  reviewDisplayAnon: uuid('concept-review-display-anonymous'),
  reviewDim: {
    COMMUNICATION: uuid('concept-review-dim-communication'),
    PUNCTUALITY: uuid('concept-review-dim-punctuality'),
    CLEANLINESS: uuid('concept-review-dim-cleanliness'),
    OUTCOME: uuid('concept-review-dim-outcome'),
  },
  groupPublic: uuid('concept-group-visibility-public'),
  groupPrivate: uuid('concept-group-visibility-private'),
  groupGeneral: uuid('concept-group-type-general'),
  groupSupport: uuid('concept-group-type-support'),
  memberRole: { MEMBER: uuid('concept-member-role-member'), MODERATOR: uuid('concept-member-role-moderator'), ADMIN: uuid('concept-member-role-admin') },
  joinStatus: { ACTIVE: uuid('concept-join-active'), PENDING: uuid('concept-join-pending'), REJECTED: uuid('concept-join-rejected'), LEFT: uuid('concept-join-left') },
  conversationDirect: uuid('concept-conversation-direct'),
  conversationGroup: uuid('concept-conversation-group'),
  messageText: uuid('concept-message-content-text'),
  /** Un mensaje que lleva adjunto: foto, documento o nota de voz. */
  messageMedia: uuid('concept-message-content-media'),
  badgeVerified: uuid('concept-badge-verified-practitioner'),
  badgeMethod: uuid('concept-badge-method-registry'),
  prestigeLevel: uuid('concept-prestige-level-gold'),
  moderation: {
    contentPost: uuid('concept-moderable-post'),
    contentComment: uuid('concept-moderable-comment'),
    contentReview: uuid('concept-moderable-review'),
    sourceReport: uuid('concept-moderation-source-report'),
    sourceAuto: uuid('concept-moderation-source-auto'),
    priorityHigh: uuid('concept-priority-high'),
    priorityNormal: uuid('concept-priority-normal'),
    queued: uuid('concept-moderation-queued'),
    inReview: uuid('concept-moderation-in-review'),
    resolved: uuid('concept-moderation-resolved'),
    reasonSpam: uuid('concept-report-reason-spam'),
    reasonMisinfo: uuid('concept-report-reason-misinformation'),
    reasonPhi: uuid('concept-report-reason-phi'),
    decisionRemoved: uuid('concept-decision-removed'),
    decisionDismissed: uuid('concept-decision-dismissed'),
    decisionWarned: uuid('concept-decision-warned'),
    policy: uuid('concept-policy-community-guidelines'),
    actionHide: uuid('concept-action-hide'),
    appealOpen: uuid('concept-appeal-open'),
    appealUpheld: uuid('concept-appeal-upheld'),
    appealOverturned: uuid('concept-appeal-overturned'),
  },
} as const;

function vitrinaDeProfesional(p: ProfesionalSimulado): VitrinaSimulada {
  return {
    id: uuid(`public-profile-${p.id}`),
    tenantId: p.tenantId,
    targetId: p.id,
    kind: 'PRACTITIONER',
    slug: p.slug,
    displayName: p.displayName,
    headline: p.especialidades.length === 0 ? p.professionalTitle : `${p.professionalTitle} · ${p.organizacion}`,
    biography: p.professionalBio,
    avatarUrl: avatarSvg(p.displayName, ['#1f6f8b', '#0f766e', '#7c3aed', '#b45309', '#be123c'][PROFESIONALES.indexOf(p) % 5]),
    coverUrl: portadaSvg(),
    avatarFileId: p.photoFileId,
    coverFileId: uuid(`cover-${p.id}`),
    verified: p.verified,
    acceptsReviews: true,
    visibility: 'PUBLIC',
    city: p.ciudad,
    address: p.direccion,
    lat: p.lat,
    lng: p.lng,
    specialties: p.especialidades,
    ratingAverage: p.ratingCount === 0 ? null : p.ratingAverage,
    ratingCount: p.ratingCount,
    hasPublishedAgenda: p.especialidades.length > 0 && p.origen === undefined,
    // Un médico real de la red no tiene seguidores en una red que no usa.
    seguidores: p.origen === undefined ? 40 + PROFESIONALES.indexOf(p) * 37 : 0,
  };
}

function organizacion(clave: string, datos: { kind: Exclude<ClaseDeVitrina, 'PRACTITIONER' | 'PATIENT'>; tenantId: string; name: string; headline: string; bio: string; city: string; address: string; lat: number; lng: number; rating?: number; color: string; agenda?: boolean }): VitrinaSimulada {
  return {
    id: uuid(`public-profile-${clave}`),
    tenantId: datos.tenantId,
    targetId: datos.tenantId,
    kind: datos.kind,
    slug: clave,
    displayName: datos.name,
    headline: datos.headline,
    biography: datos.bio,
    avatarUrl: avatarSvg(datos.name, datos.color),
    coverUrl: portadaSvg(datos.color),
    avatarFileId: uuid(`avatar-${clave}`),
    coverFileId: uuid(`cover-${clave}`),
    verified: true,
    acceptsReviews: true,
    visibility: 'PUBLIC',
    city: datos.city,
    address: datos.address,
    lat: datos.lat,
    lng: datos.lng,
    specialties: [],
    ratingAverage: datos.rating ?? 4.4,
    ratingCount: 60,
    hasPublishedAgenda: datos.agenda ?? false,
    seguidores: 300,
  };
}

export const VITRINAS: readonly VitrinaSimulada[] = [
  ...PROFESIONALES.map(vitrinaDeProfesional),
  organizacion('clinica-los-olivos', { kind: 'ORGANIZATION', tenantId: TENANT_CLINICA, name: 'Clínica Los Olivos', headline: 'Clínica privada · 24 horas', bio: 'Clínica de segundo nivel con urgencias 24 horas, internación, quirófanos y consultorios de 18 especialidades. Convenios con las principales aseguradoras.', city: 'Santa Cruz de la Sierra', address: 'Av. Banzer, 3.º anillo', lat: -17.7712, lng: -63.1955, rating: 4.6, color: '#0f766e', agenda: true }),
  organizacion('hospital-san-lucas', { kind: 'ORGANIZATION', tenantId: TENANT_HOSPITAL, name: 'Hospital San Lucas', headline: 'Hospital de tercer nivel', bio: 'Hospital universitario con maternidad, unidad de terapia intensiva y cirugía cardiovascular.', city: 'Santa Cruz de la Sierra', address: 'Av. San Martín N.º 1400', lat: -17.7620, lng: -63.1900, rating: 4.3, color: '#7c3aed', agenda: true }),
  organizacion('clinica-foianini', { kind: 'ORGANIZATION', tenantId: uuid('tenant-foianini'), name: 'Clínica Foianini', headline: 'Clínica privada', bio: 'Atención ambulatoria e internación con más de 40 años de trayectoria.', city: 'Santa Cruz de la Sierra', address: 'Av. Irala N.º 468', lat: -17.7900, lng: -63.1780, rating: 4.5, color: '#b45309' }),
  organizacion('hospital-japones', { kind: 'ORGANIZATION', tenantId: uuid('tenant-japones'), name: 'Hospital Japonés', headline: 'Hospital público de tercer nivel', bio: 'Hospital de referencia departamental.', city: 'Santa Cruz de la Sierra', address: 'Av. Japón, 3.º anillo', lat: -17.7550, lng: -63.1600, rating: 3.9, color: '#be123c' }),
  organizacion('farmacia-vida', { kind: 'PHARMACY', tenantId: TENANT_FARMACIA, name: 'Farmacia Vida', headline: 'Farmacia · entrega a domicilio', bio: 'Medicamentos genéricos y de marca, entrega en menos de una hora en toda la ciudad.', city: 'Santa Cruz de la Sierra', address: 'Av. Alemana N.º 2100', lat: -17.7690, lng: -63.1650, rating: 4.7, color: '#16a34a' }),
  organizacion('farmacia-chavez', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-chavez'), name: 'Farmacias Chávez · Sucursal Cañoto', headline: 'Farmacia · cadena, 24 horas', bio: 'Cadena de farmacias con atención 24 horas.', city: 'Santa Cruz de la Sierra', address: 'Av. Cañoto esq. Landívar', lat: -17.7830, lng: -63.1870, rating: 4.2, color: '#0891b2' }),
  organizacion('farmacia-central-lp', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-lp'), name: 'Farmacia Central', headline: 'Farmacia · de turno permanente', bio: 'Farmacia de turno permanente en el centro paceño.', city: 'La Paz', address: 'Av. 16 de Julio N.º 1600', lat: -16.4990, lng: -68.1330, rating: 4.1, color: '#0891b2' }),
  /* Clínicas y farmacias del resto del país. No son relleno: el directorio de
     clínicas y el de farmacias ofrecen el mapa de Bolivia como filtro, y con
     todo publicado en Santa Cruz ese mapa tendría ocho departamentos que no
     llevan a ninguna parte — un control que se ve entero y sirve para un
     noveno. Son las ciudades capitales que el catálogo de municipios ya trae,
     con coordenadas reales. */
  organizacion('clinica-belga-cbba', { kind: 'ORGANIZATION', tenantId: uuid('tenant-belga'), name: 'Clínica Belga', headline: 'Clínica privada · 24 horas', bio: 'Internación, quirófanos y consulta externa en el centro cochabambino.', city: 'Cochabamba', address: 'Antezana N.º 455', lat: -17.3935, lng: -66.1570, rating: 4.4, color: '#0f766e', agenda: true }),
  organizacion('hospital-viedma-cbba', { kind: 'ORGANIZATION', tenantId: uuid('tenant-viedma'), name: 'Hospital Viedma', headline: 'Hospital público de tercer nivel', bio: 'Hospital de referencia departamental de Cochabamba.', city: 'Cochabamba', address: 'Av. Aniceto Arce s/n', lat: -17.3990, lng: -66.1480, rating: 3.8, color: '#be123c' }),
  organizacion('hospital-obrero-lp', { kind: 'ORGANIZATION', tenantId: uuid('tenant-obrero-lp'), name: 'Hospital Obrero N.º 1', headline: 'Hospital de la Caja Nacional de Salud', bio: 'Atención de segundo y tercer nivel para asegurados de la Caja Nacional.', city: 'La Paz', address: 'Av. Brasil s/n, Miraflores', lat: -16.4980, lng: -68.1230, rating: 3.9, color: '#7c3aed' }),
  organizacion('clinica-del-sur-lp', { kind: 'ORGANIZATION', tenantId: uuid('tenant-del-sur'), name: 'Clínica del Sur', headline: 'Clínica privada', bio: 'Consulta externa, internación y diagnóstico por imágenes en la zona sur.', city: 'La Paz', address: 'Av. Hernando Siles N.º 3539', lat: -16.5320, lng: -68.0850, rating: 4.5, color: '#0f766e', agenda: true }),
  organizacion('hospital-elalto-norte', { kind: 'ORGANIZATION', tenantId: uuid('tenant-elalto-norte'), name: 'Hospital Municipal El Alto Norte', headline: 'Hospital público de segundo nivel', bio: 'Urgencias, maternidad y consulta externa.', city: 'El Alto', address: 'Av. Juan Pablo II, Villa Adela', lat: -16.5080, lng: -68.1900, rating: 3.7, color: '#be123c' }),
  organizacion('hospital-santa-barbara-sre', { kind: 'ORGANIZATION', tenantId: uuid('tenant-santa-barbara'), name: 'Hospital Santa Bárbara', headline: 'Hospital público de tercer nivel', bio: 'Hospital de referencia de Chuquisaca, con maternidad y terapia intensiva.', city: 'Sucre', address: 'Calle Ayacucho s/n', lat: -19.0430, lng: -65.2590, rating: 4.0, color: '#7c3aed' }),
  organizacion('clinica-los-alamos-tja', { kind: 'ORGANIZATION', tenantId: uuid('tenant-los-alamos'), name: 'Clínica Los Álamos', headline: 'Clínica privada', bio: 'Consulta externa e internación en el centro de Tarija.', city: 'Tarija', address: 'Av. Las Américas N.º 120', lat: -21.5350, lng: -64.7290, rating: 4.3, color: '#0f766e' }),
  organizacion('hospital-general-oru', { kind: 'ORGANIZATION', tenantId: uuid('tenant-general-oru'), name: 'Hospital General de Oruro', headline: 'Hospital público de segundo nivel', bio: 'Urgencias y consulta externa para el departamento de Oruro.', city: 'Oruro', address: 'Calle San Felipe s/n', lat: -17.9700, lng: -67.1120, rating: 3.6, color: '#be123c' }),
  organizacion('hospital-daniel-bracamonte-pts', { kind: 'ORGANIZATION', tenantId: uuid('tenant-bracamonte'), name: 'Hospital Daniel Bracamonte', headline: 'Hospital público de tercer nivel', bio: 'Hospital de referencia departamental de Potosí.', city: 'Potosí', address: 'Av. Cívica s/n', lat: -19.5750, lng: -65.7550, rating: 3.7, color: '#7c3aed' }),
  organizacion('hospital-german-busch-tri', { kind: 'ORGANIZATION', tenantId: uuid('tenant-german-busch'), name: 'Hospital Germán Busch', headline: 'Hospital público de segundo nivel', bio: 'Hospital de referencia del Beni, en Trinidad.', city: 'Trinidad', address: 'Av. 6 de Agosto s/n', lat: -14.8350, lng: -64.9010, rating: 3.5, color: '#be123c' }),
  organizacion('hospital-roberto-galindo-cob', { kind: 'ORGANIZATION', tenantId: uuid('tenant-roberto-galindo'), name: 'Hospital Roberto Galindo Terán', headline: 'Hospital público de segundo nivel', bio: 'Hospital de referencia de Pando, en Cobija.', city: 'Cobija', address: 'Av. 9 de Febrero s/n', lat: -11.0270, lng: -68.7690, rating: 3.6, color: '#7c3aed' }),
  organizacion('farmacia-bolivia-cbba', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-cbba'), name: 'Farmacia Bolivia', headline: 'Farmacia · entrega a domicilio', bio: 'Medicamentos de marca y genéricos con reparto en la ciudad.', city: 'Cochabamba', address: 'Av. Heroínas N.º 380', lat: -17.3900, lng: -66.1560, rating: 4.3, color: '#16a34a' }),
  organizacion('farmacia-san-roque-sre', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-sre'), name: 'Farmacia San Roque', headline: 'Farmacia de barrio · atención de turno', bio: 'Farmacia de barrio con atención de turno.', city: 'Sucre', address: 'Calle Junín N.º 415', lat: -19.0480, lng: -65.2600, rating: 4.0, color: '#0891b2' }),
  organizacion('farmacia-del-valle-tja', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-tja'), name: 'Farmacia del Valle', headline: 'Farmacia · entrega a domicilio', bio: 'Reparto en Tarija y alrededores.', city: 'Tarija', address: 'Calle Colón N.º 640', lat: -21.5320, lng: -64.7320, rating: 4.2, color: '#16a34a' }),
  organizacion('farmacia-el-alto-sur', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-ea'), name: 'Farmacia El Alto Sur', headline: 'Farmacia · 24 horas', bio: 'Atención permanente sobre la avenida principal.', city: 'El Alto', address: 'Av. 6 de Marzo N.º 220', lat: -16.5150, lng: -68.1720, rating: 3.9, color: '#0891b2' }),
  organizacion('farmacia-potosi-centro', { kind: 'PHARMACY', tenantId: uuid('tenant-farmacia-pts'), name: 'Farmacia Potosí Centro', headline: 'Farmacia · centro histórico', bio: 'Farmacia del centro histórico, frente a la plaza.', city: 'Potosí', address: 'Calle Bolívar N.º 812', lat: -19.5830, lng: -65.7530, rating: 3.8, color: '#0891b2' }),
  organizacion('laboratorio-central', { kind: 'DIAGNOSTIC_UNIT', tenantId: TENANT_LABORATORIO, name: 'Laboratorio Central', headline: 'Laboratorio clínico · resultados en línea', bio: 'Análisis clínicos con resultados el mismo día y toma de muestras a domicilio.', city: 'Santa Cruz de la Sierra', address: 'Calle Sucre N.º 210', lat: -17.7840, lng: -63.1815, rating: 4.8, color: '#4f46e5' }),
  organizacion('centro-imagen-sur', { kind: 'DIAGNOSTIC_UNIT', tenantId: uuid('tenant-imagen-sur'), name: 'Centro de Imagen Sur', headline: 'Resonancia, tomografía y ecografía', bio: 'Centro de diagnóstico por imágenes con equipos de última generación.', city: 'Santa Cruz de la Sierra', address: 'Av. Cristo Redentor, km 4', lat: -17.7400, lng: -63.1750, rating: 4.4, color: '#4f46e5' }),
  organizacion('seguros-andina', { kind: 'INSURER', tenantId: uuid('tenant-seguros-andina'), name: 'Seguros Andina', headline: 'Seguro de salud familiar', bio: 'Planes de salud individuales y familiares con red de más de 200 prestadores.', city: 'La Paz', address: 'Av. Arce N.º 2500', lat: -16.5060, lng: -68.1280, rating: 4.0, color: '#ca8a04' }),
  organizacion('la-vitalicia', { kind: 'INSURER', tenantId: uuid('tenant-vitalicia'), name: 'La Vitalicia', headline: 'Seguros de salud y vida', bio: 'Cobertura nacional e internacional.', city: 'Santa Cruz de la Sierra', address: 'Av. San Martín, Equipetrol', lat: -17.7590, lng: -63.1960, rating: 4.2, color: '#ca8a04' }),
  {
    id: uuid(`public-profile-${PACIENTE.id}`),
    tenantId: TENANT_PLATAFORMA,
    targetId: PACIENTE.id,
    kind: 'PATIENT',
    slug: 'ana-perez',
    displayName: PACIENTE.displayName,
    headline: 'Paciente',
    biography: '',
    avatarUrl: avatarSvg(PACIENTE.displayName, '#db2777'),
    coverUrl: imagenSvg('AloVida'),
    avatarFileId: uuid(`avatar-${PACIENTE.id}`),
    coverFileId: uuid(`cover-${PACIENTE.id}`),
    verified: false,
    acceptsReviews: false,
    visibility: 'PRIVATE',
    city: 'Santa Cruz de la Sierra',
    address: '',
    lat: -17.78,
    lng: -63.18,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    hasPublishedAgenda: false,
    seguidores: 3,
  },
  ...PACIENTES.slice(1, 5).map((p, i) => ({
    id: uuid(`public-profile-${p.id}`),
    tenantId: TENANT_PLATAFORMA,
    targetId: p.id,
    kind: 'PATIENT' as const,
    slug: `paciente-${i + 2}`,
    displayName: p.displayName,
    headline: 'Paciente',
    biography: '',
    avatarUrl: avatarSvg(p.displayName, '#64748b'),
    coverUrl: imagenSvg('AloVida'),
    avatarFileId: uuid(`avatar-${p.id}`),
    coverFileId: uuid(`cover-${p.id}`),
    verified: false,
    acceptsReviews: false,
    visibility: 'PRIVATE' as const,
    city: 'Santa Cruz de la Sierra',
    address: '',
    lat: -17.78,
    lng: -63.18,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    hasPublishedAgenda: false,
    seguidores: 0,
  })),

  /* Los 10 laboratorios y las 50 sucursales de farmacia del corpus «Bolivia
     Salud · Eje Central» (ver `bolivia-eje-central.ts`). Existen, tienen
     dirección y horario publicados, y su ficha cita la fuente.

     Van **sin opiniones ni puntuación**: son negocios reales con nombre y
     apellido, y fabricarles una nota media sería una afirmación sobre alguien
     que existe. `ratingAverage: null` es lo que las pantallas ya saben dibujar
     como «todavía sin opiniones».

     `acceptsReviews` sí queda abierto: que nadie haya opinado no significa que
     no se pueda. */
  ...[...SEMILLAS_DE_VITRINA, ...SEMILLAS_DE_INSTITUCIONES].map((semilla) => ({
    id: uuid(`public-profile-${semilla.clave}`),
    tenantId: semilla.tenantId,
    targetId: semilla.targetId,
    kind: semilla.kind,
    slug: semilla.slug,
    displayName: semilla.displayName,
    headline: semilla.headline,
    biography: semilla.biography,
    ...imagenesDeVitrina(semilla),
    avatarFileId: uuid(`avatar-${semilla.clave}`),
    coverFileId: uuid(`cover-${semilla.clave}`),
    verified: semilla.verified,
    acceptsReviews: true,
    visibility: 'PUBLIC' as const,
    city: semilla.city,
    address: semilla.address,
    lat: semilla.lat,
    lng: semilla.lng,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    hasPublishedAgenda: false,
    seguidores: 0,
  })),
];

export const vitrinas = new Coleccion<VitrinaSimulada>(VITRINAS);

export function vitrinaDe(targetOUserId: string): VitrinaSimulada | undefined {
  return vitrinas.todos().find((v) => v.targetId === targetOUserId || v.id === targetOUserId);
}

export function vitrinaPorSlug(slug: string): VitrinaSimulada | undefined {
  return vitrinas.todos().find((v) => v.slug === slug);
}

export const VITRINA_MEDICA = vitrinaDe(MEDICA.id)!;
export const VITRINA_PACIENTE = vitrinaDe(PACIENTE.id)!;

/* ---- publicaciones ------------------------------------------------------- */

export interface PublicacionSimulada {
  readonly id: string;
  readonly authorPublicProfileId: string;
  readonly postTypeConceptId: string;
  readonly bodyText: string;
  readonly visibilityConceptId: string;
  readonly commentsEnabled: boolean;
  readonly publishedAt: string;
  readonly editedAt: string | null;
  readonly mediaUrls: readonly string[];
  readonly hashtags: readonly string[];
  readonly reacciones: Record<'LIKE' | 'LOVE' | 'INSIGHTFUL' | 'CELEBRATE' | 'SUPPORT', number>;
  readonly reaccionDelActor: Record<string, 'LIKE' | 'LOVE' | 'INSIGHTFUL' | 'CELEBRATE' | 'SUPPORT'>;
  readonly pollId?: string;
}

const TEXTOS: readonly (readonly [autor: number, texto: string, tags: readonly string[], imagen?: string])[] = [
  [0, '¿Sabías que la hipertensión no suele dar síntomas? Por eso se la llama «el asesino silencioso». Medite la presión al menos una vez al año, y si tenés antecedentes familiares, cada seis meses. #prevención #hipertensión', ['prevencion', 'hipertension'], 'Controlá tu presión'],
  [0, 'Hoy en la clínica atendimos a una paciente de 42 años con dolor de pecho que resultó ser una angina. Llegó a tiempo porque su hija insistió. Escuchen a sus hijas. 💙', ['cardiologia'], undefined],
  [1, 'Calendario de vacunas 2026 actualizado: la vacuna contra la influenza ya está disponible en los centros de salud para niños desde los 6 meses. No la posterguen. #vacunas #pediatría', ['vacunas', 'pediatria'], 'Vacunas 2026'],
  [2, 'Control prenatal: la primera consulta debería ser antes de la semana 12. Detectar a tiempo la anemia o la presión alta cambia el resultado del embarazo. #embarazo', ['embarazo'], undefined],
  [3, 'Con el sol de Santa Cruz, el protector solar no es opcional. Factor 50, cada 2 horas, aunque esté nublado. Los lunares que cambian de forma o color merecen una consulta. #dermatología', ['dermatologia'], 'Protector solar'],
  [4, 'Volvió el fútbol de fin de semana y con él las lesiones de rodilla. Calentar 10 minutos antes reduce las lesiones de ligamento a la mitad. #traumatología', ['traumatologia'], undefined],
  [6, 'La ansiedad no es debilidad. Es una respuesta del cuerpo que, cuando se desregula, se trata. Hablar con un profesional es el primer paso, no el último. #saludmental', ['saludmental'], 'Salud mental'],
  [9, 'Diabetes tipo 2: el 80 % de los casos se puede prevenir con alimentación y actividad física. La glucemia en ayunas por encima de 100 ya es una señal. #diabetes', ['diabetes'], undefined],
  [11, 'Esta semana abrimos turnos de teleconsulta por las tardes para quienes no pueden acercarse al consultorio. Reservá desde tu cuenta. #teleconsulta', ['teleconsulta'], undefined],
  [12, 'Receta de la semana: ensalada de quinua con verduras. 15 minutos, alto en fibra y proteína, ideal para quienes controlan el azúcar. #nutrición', ['nutricion'], 'Quinua con verduras'],
  [0, 'Artículo: «Insuficiencia cardíaca en la mujer: por qué se diagnostica tarde». Un resumen de la evidencia reciente y lo que vemos en el consultorio. #artículomédico #cardiología', ['articulomedico', 'cardiologia'], 'Artículo médico'],
  [5, 'Migraña: llevar un diario de crisis ayuda a encontrar los desencadenantes. Café, falta de sueño y ayuno prolongado son los más frecuentes. #neurología', ['neurologia'], undefined],
  [10, 'Reflujo nocturno: elevar la cabecera de la cama 15 cm y cenar tres horas antes de acostarse alivia más que muchos medicamentos. #gastroenterología', ['gastroenterologia'], undefined],
  [7, 'Chequeo visual anual después de los 40: el glaucoma no duele y roba visión sin aviso. #oftalmología', ['oftalmologia'], undefined],
  [0, '¿Qué preferís para tu control cardiológico?', ['encuesta'], undefined],
];

export const publicaciones = new Coleccion<PublicacionSimulada>(
  TEXTOS.map(([autor, texto, tags, imagen], i) => {
    const vitrina = vitrinaDe(PROFESIONALES[autor]!.id)!;
    return {
      id: uuid(`post-${i}`),
      authorPublicProfileId: vitrina.id,
      postTypeConceptId: tags.includes('articulomedico') ? CONCEPTO.postArticle : tags.includes('encuesta') ? CONCEPTO.postPoll : CONCEPTO.postText,
      bodyText: texto,
      visibilityConceptId: CONCEPTO.visibilityPublic,
      commentsEnabled: true,
      publishedAt: iso(-i * 2 - 1, 10 + (i % 8)),
      editedAt: i === 1 ? iso(-2, 12) : null,
      mediaUrls: imagen === undefined ? [] : [imagenSvg(imagen, '#e8f1f5', '#1f6f8b')],
      hashtags: tags,
      reacciones: { LIKE: 12 + i * 3, LOVE: 4 + (i % 5), INSIGHTFUL: 2 + (i % 3), CELEBRATE: i % 2, SUPPORT: 1 },
      reaccionDelActor: i % 3 === 0 ? { [VITRINA_PACIENTE.id]: 'LIKE' } : {},
      ...(tags.includes('encuesta') ? { pollId: uuid('poll-1') } : {}),
    };
  }),
);

export interface ComentarioSimulado {
  readonly id: string;
  readonly postId: string;
  readonly authorProfileId: string;
  readonly bodyText: string;
  readonly parentCommentId: string | null;
  readonly createdAt: string;
  readonly mediaUrl?: string;
}

const COMENTARIOS_BASE = [
  'Excelente explicación, doctora. Gracias por compartir.',
  '¿Esto aplica también para adultos mayores?',
  'Muy útil, lo comparto con mi familia.',
  'Tuve exactamente este problema el mes pasado. Confirmo que hay que consultar temprano.',
  '¿Atiende por teleconsulta?',
  'Gracias, me sirvió mucho la información.',
];

export const comentarios = new Coleccion<ComentarioSimulado>(
  publicaciones.todos().flatMap((post, i) => {
    const cantidad = (i % 4) + 1;
    const raiz = Array.from({ length: cantidad }, (_, k) => ({
      id: uuid(`comment-${post.id}-${k}`),
      postId: post.id,
      authorProfileId: k === 0 ? VITRINA_PACIENTE.id : VITRINAS[(i + k + 1) % PROFESIONALES.length]!.id,
      bodyText: COMENTARIOS_BASE[(i + k) % COMENTARIOS_BASE.length]!,
      parentCommentId: null,
      createdAt: iso(-i * 2, 12 + k),
      ...(k === 1 && i % 5 === 0 ? { mediaUrl: imagenSvg('🙌', '#fef3c7', '#b45309') } : {}),
    }));
    const respuesta = raiz[0] === undefined
      ? []
      : [{ id: uuid(`reply-${post.id}`), postId: post.id, authorProfileId: post.authorPublicProfileId, bodyText: 'Sí, y con más razón. Ante la duda, consulten.', parentCommentId: raiz[0].id, createdAt: iso(-i * 2, 14) }];
    return [...raiz, ...respuesta];
  }),
);

/* ---- reseñas ------------------------------------------------------------- */

export interface ResenaSimulada {
  readonly id: string;
  readonly targetPublicProfileId: string;
  readonly reviewerProfileId: string;
  /** El nombre con el que se muestra quien opinó, cuando no tiene ficha propia. */
  readonly reviewerDisplayName?: string;
  readonly reviewerAvatarUrl?: string;
  readonly overallRating: number;
  readonly reviewText: string;
  readonly reviewerDisplayModeConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly publishedAt: string;
  readonly dimensionScores: readonly { dimensionConceptId: string; score: number }[];
  readonly responses: readonly { id: string; responderPublicProfileId: string; responseText: string; publishedAt: string }[];
}

const RESENAS_TEXTO = [
  [5, 'Excelente profesional. Explica todo con calma y responde cada pregunta. Volvería sin dudar.'],
  [4, 'Muy buena atención, aunque tuve que esperar 20 minutos más de la hora.'],
  [5, 'Me diagnosticó algo que otros dos médicos habían pasado por alto. Agradecida.'],
  [3, 'La consulta fue correcta pero muy corta.'],
  [5, 'Atención cálida y profesional. El consultorio impecable.'],
  [4, 'Buen trato y buena explicación del tratamiento.'],
] as const;

/**
 * Quiénes opinan en las fichas: pacientes sin ficha pública propia. Se arman de
 * dos listas para que haya muchas personas distintas y ninguna ficha repita
 * nombre entre sus opiniones.
 */
const NOMBRES_QUE_OPINAN = ['Carla', 'Diego', 'Mariela', 'Rodrigo', 'Lucía', 'Fernando', 'Gabriela', 'Óscar', 'Paola', 'Javier', 'Daniela', 'Marco', 'Verónica', 'Luis', 'Silvia', 'Andrés', 'Natalia', 'Hugo', 'Camila', 'Ramiro'];
const APELLIDOS_QUE_OPINAN = ['Justiniano', 'Vargas', 'Suárez', 'Quiroga', 'Mamani', 'Céspedes', 'Arteaga', 'Gutiérrez', 'Rivero', 'Chávez', 'Paz', 'Moreno', 'Añez', 'Flores', 'Saucedo', 'Terrazas', 'Roca', 'Aguilera', 'Montaño', 'Salvatierra', 'Heredia'];
const COLORES_QUE_OPINAN = ['#1f6f8b', '#0f766e', '#7c3aed', '#b45309', '#be123c', '#4f46e5', '#0891b2'];

/** Los desvíos que reparten las estrellas alrededor del promedio de la ficha. */
const DESVIOS = [0.3, -0.7, 0.1, -0.3, 0.4, -1.2, 0.2, 0, -0.4, 0.5];

/**
 * Una opinión por cada calificación que declara la ficha (`ratingCount`): el
 * «(8)» de la cabecera y la lista del modal tienen que decir lo mismo. Un tercio
 * son sólo estrellas, sin texto — también es alguien que calificó.
 *
 * Todas con el nombre visible: el cliente pidió que en la ficha pública se vea
 * **quién** opinó. El modo anónimo sigue existiendo en el contrato para quien lo
 * elija al publicar (ver `POST /community/profiles/:id/reviews`).
 */
export const resenas = new Coleccion<ResenaSimulada>(
  VITRINAS.filter((v) => v.kind !== 'PATIENT' && v.ratingCount > 0).flatMap((v, i) =>
    Array.from({ length: v.ratingCount }, (_, k) => {
      const promedio = v.ratingAverage ?? 4.5;
      const rating = Math.min(5, Math.max(1, Math.round(promedio + DESVIOS[(i + k) % DESVIOS.length]!)));
      const texto = RESENAS_TEXTO.find(([estrellas]) => estrellas === rating)?.[1] ?? RESENAS_TEXTO[(i + k) % RESENAS_TEXTO.length]![1];
      const nombre =
        k === 0
          ? VITRINA_PACIENTE.displayName
          : `${NOMBRES_QUE_OPINAN[(k * 7 + i) % NOMBRES_QUE_OPINAN.length]} ${APELLIDOS_QUE_OPINAN[(k * 3 + i * 5) % APELLIDOS_QUE_OPINAN.length]}`;
      const id = `review-${v.id}-${k}`;
      return {
        id: k < 4 ? uuid(id) : id,
        targetPublicProfileId: v.id,
        reviewerProfileId: k === 0 ? VITRINA_PACIENTE.id : `reviewer-${i}-${k}`,
        reviewerDisplayName: nombre,
        reviewerAvatarUrl: k === 0 ? VITRINA_PACIENTE.avatarUrl : avatarSvg(nombre, COLORES_QUE_OPINAN[k % COLORES_QUE_OPINAN.length]!),
        overallRating: rating,
        reviewText: k % 3 === 2 ? '' : texto,
        reviewerDisplayModeConceptId: CONCEPTO.reviewDisplayReal,
        verificationStatusConceptId: ESTADO['ST-VERIFIED']!,
        publishedAt: iso(-k * 6 - 3, 8 + (k % 10)),
        dimensionScores: [
          { dimensionConceptId: CONCEPTO.reviewDim.COMMUNICATION, score: rating },
          { dimensionConceptId: CONCEPTO.reviewDim.PUNCTUALITY, score: Math.max(1, rating - 1) },
          { dimensionConceptId: CONCEPTO.reviewDim.CLEANLINESS, score: 5 },
          { dimensionConceptId: CONCEPTO.reviewDim.OUTCOME, score: rating },
        ],
        responses: k === 0 ? [{ id: uuid(`review-response-${v.id}`), responderPublicProfileId: v.id, responseText: '¡Muchas gracias por la confianza! Nos vemos en el próximo control.', publishedAt: iso(-2, 9) }] : [],
      };
    }),
  ),
);

/* ---- grupos y temas ------------------------------------------------------- */

export const TEMAS = [
  { id: uuid('topic-cardio'), code: 'CARDIO', name: 'Cardiología', specialtyConceptId: ESPECIALIDAD['CARDIOLOGIA']! },
  { id: uuid('topic-pedia'), code: 'PEDIA', name: 'Pediatría', specialtyConceptId: ESPECIALIDAD['PEDIATRIA']! },
  { id: uuid('topic-diabetes'), code: 'DIABETES', name: 'Diabetes' },
  { id: uuid('topic-saludmental'), code: 'MENTAL', name: 'Salud mental', specialtyConceptId: ESPECIALIDAD['PSIQUIATRIA']! },
  { id: uuid('topic-nutricion'), code: 'NUTRI', name: 'Nutrición', specialtyConceptId: ESPECIALIDAD['NUTRICION']! },
  { id: uuid('topic-embarazo'), code: 'EMBARAZO', name: 'Embarazo y maternidad', specialtyConceptId: ESPECIALIDAD['GINECOLOGIA_OBSTETRICIA']! },
];

export interface GrupoSimulado {
  readonly id: string;
  readonly tenantId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly visibilityConceptId: string;
  readonly groupTypeConceptId: string;
  readonly topicId?: string;
  readonly ownerProfileId: string;
  readonly coverFileId: string;
  readonly memberCount: number;
  readonly postCount: number;
  readonly pendingCount: number;
  readonly statusConceptId: string;
}

export const grupos = new Coleccion<GrupoSimulado>([
  { id: uuid('group-cardio'), tenantId: TENANT_PLATAFORMA, slug: 'cardiologos-bolivia', name: 'Cardiólogos de Bolivia', description: 'Espacio de discusión de casos y guías clínicas entre cardiólogos.', visibilityConceptId: CONCEPTO.groupPrivate, groupTypeConceptId: CONCEPTO.groupGeneral, topicId: TEMAS[0]!.id, ownerProfileId: VITRINA_MEDICA.id, coverFileId: uuid('cover-group-cardio'), memberCount: 48, postCount: 120, pendingCount: 2, statusConceptId: ESTADO['ST-ACTIVE']! },
  { id: uuid('group-diabetes'), tenantId: TENANT_PLATAFORMA, slug: 'viviendo-con-diabetes', name: 'Viviendo con diabetes', description: 'Grupo de apoyo para pacientes y familiares. Recetas, dudas y experiencias.', visibilityConceptId: CONCEPTO.groupPublic, groupTypeConceptId: CONCEPTO.groupSupport, topicId: TEMAS[2]!.id, ownerProfileId: vitrinaDe(PROFESIONALES[9]!.id)!.id, coverFileId: uuid('cover-group-diabetes'), memberCount: 312, postCount: 890, pendingCount: 0, statusConceptId: ESTADO['ST-ACTIVE']! },
  { id: uuid('group-mamas'), tenantId: TENANT_PLATAFORMA, slug: 'mamas-primerizas-scz', name: 'Mamás primerizas · Santa Cruz', description: 'Preguntas, consejos y encuentros para mamás de bebés de 0 a 2 años.', visibilityConceptId: CONCEPTO.groupPublic, groupTypeConceptId: CONCEPTO.groupSupport, topicId: TEMAS[5]!.id, ownerProfileId: vitrinaDe(PROFESIONALES[2]!.id)!.id, coverFileId: uuid('cover-group-mamas'), memberCount: 540, postCount: 2100, pendingCount: 0, statusConceptId: ESTADO['ST-ACTIVE']! },
  { id: uuid('group-saludmental'), tenantId: TENANT_PLATAFORMA, slug: 'hablemos-de-ansiedad', name: 'Hablemos de ansiedad', description: 'Grupo moderado por profesionales de salud mental.', visibilityConceptId: CONCEPTO.groupPrivate, groupTypeConceptId: CONCEPTO.groupSupport, topicId: TEMAS[3]!.id, ownerProfileId: vitrinaDe(PROFESIONALES[6]!.id)!.id, coverFileId: uuid('cover-group-mental'), memberCount: 96, postCount: 430, pendingCount: 5, statusConceptId: ESTADO['ST-ACTIVE']! },
  { id: uuid('group-nutri'), tenantId: TENANT_PLATAFORMA, slug: 'comer-bien-sin-culpa', name: 'Comer bien sin culpa', description: 'Nutrición realista para el día a día.', visibilityConceptId: CONCEPTO.groupPublic, groupTypeConceptId: CONCEPTO.groupGeneral, topicId: TEMAS[4]!.id, ownerProfileId: vitrinaDe(PROFESIONALES[12]!.id)!.id, coverFileId: uuid('cover-group-nutri'), memberCount: 205, postCount: 310, pendingCount: 0, statusConceptId: ESTADO['ST-ACTIVE']! },
]);

export const miembrosDeGrupo = new Coleccion<{ id: string; groupId: string; memberProfileId: string; memberRoleConceptId: string; joinStatusConceptId: string; joinedAt: string | null; invitedByProfileId: string | null }>(
  grupos.todos().flatMap((g, i) => [
    { id: uuid(`member-${g.id}-owner`), groupId: g.id, memberProfileId: g.ownerProfileId, memberRoleConceptId: CONCEPTO.memberRole.ADMIN, joinStatusConceptId: CONCEPTO.joinStatus.ACTIVE, joinedAt: iso(-300), invitedByProfileId: null },
    ...(i !== 0 ? [{ id: uuid(`member-${g.id}-medica`), groupId: g.id, memberProfileId: VITRINA_MEDICA.id, memberRoleConceptId: i === 1 ? CONCEPTO.memberRole.MODERATOR : CONCEPTO.memberRole.MEMBER, joinStatusConceptId: CONCEPTO.joinStatus.ACTIVE, joinedAt: iso(-200 + i * 10), invitedByProfileId: null }] : []),
    ...(i === 1 || i === 2 ? [{ id: uuid(`member-${g.id}-paciente`), groupId: g.id, memberProfileId: VITRINA_PACIENTE.id, memberRoleConceptId: CONCEPTO.memberRole.MEMBER, joinStatusConceptId: CONCEPTO.joinStatus.ACTIVE, joinedAt: iso(-90), invitedByProfileId: null }] : []),
    ...(i === 3 ? [{ id: uuid(`member-${g.id}-paciente-pend`), groupId: g.id, memberProfileId: VITRINA_PACIENTE.id, memberRoleConceptId: CONCEPTO.memberRole.MEMBER, joinStatusConceptId: CONCEPTO.joinStatus.PENDING, joinedAt: null, invitedByProfileId: null }] : []),
    ...Array.from({ length: 3 }, (_, k) => ({ id: uuid(`member-${g.id}-${k}`), groupId: g.id, memberProfileId: VITRINAS[(i + k + 1) % PROFESIONALES.length]!.id, memberRoleConceptId: CONCEPTO.memberRole.MEMBER, joinStatusConceptId: CONCEPTO.joinStatus.ACTIVE, joinedAt: iso(-100 - k * 12), invitedByProfileId: null })),
  ]),
);

export const muroDeGrupo = new Coleccion<{ id: string; groupId: string; authorProfileId: string; bodyText: string; parentCommentId: string | null; createdAt: string }>(
  grupos.todos().flatMap((g, i) => [
    { id: uuid(`wall-${g.id}-0`), groupId: g.id, authorProfileId: g.ownerProfileId, bodyText: `Bienvenidos al grupo «${g.name}». Reglas: respeto, nada de publicidad y ninguna consulta personal por acá — para eso está la mensajería.`, parentCommentId: null, createdAt: iso(-60 - i, 9) },
    { id: uuid(`wall-${g.id}-1`), groupId: g.id, authorProfileId: VITRINAS[(i + 2) % PROFESIONALES.length]!.id, bodyText: '¿Alguien tiene experiencia con el nuevo protocolo de seguimiento? Me interesa comparar resultados.', parentCommentId: null, createdAt: iso(-6 - i, 15) },
    { id: uuid(`wall-${g.id}-1-r`), groupId: g.id, authorProfileId: g.ownerProfileId, bodyText: 'Sí, lo aplicamos desde marzo. Te escribo por privado con los datos.', parentCommentId: uuid(`wall-${g.id}-1`), createdAt: iso(-5 - i, 10) },
    { id: uuid(`wall-${g.id}-2`), groupId: g.id, authorProfileId: VITRINA_PACIENTE.id, bodyText: 'Gracias por este espacio, me ayudó mucho leer las experiencias de los demás.', parentCommentId: null, createdAt: iso(-1, 20) },
  ]),
);

/* ---- mensajería directa ---------------------------------------------------- */

export interface ConversacionSimulada {
  readonly id: string;
  readonly conversationTypeConceptId: string;
  readonly groupId: string | null;
  readonly participantes: readonly string[];
  readonly noLeidosPor: Record<string, number>;
}

export interface MensajeSimulado {
  readonly id: string;
  readonly conversationId: string;
  readonly senderProfileId: string;
  readonly replyToMessageId: string | null;
  readonly contentTypeConceptId: string;
  readonly bodyText: string;
  readonly attachmentFileId: string | null;
  readonly isEdited: boolean;
  readonly sentAt: string;
}

export const SOPORTE_ID = uuid('public-profile-support-admin');

export const conversaciones = new Coleccion<ConversacionSimulada>([
  { id: uuid('conv-medica-paciente'), conversationTypeConceptId: CONCEPTO.conversationDirect, groupId: null, participantes: [VITRINA_MEDICA.id, VITRINA_PACIENTE.id], noLeidosPor: { [VITRINA_MEDICA.id]: 0, [VITRINA_PACIENTE.id]: 1 } },
  { id: uuid('conv-medica-pediatra'), conversationTypeConceptId: CONCEPTO.conversationDirect, groupId: null, participantes: [VITRINA_MEDICA.id, vitrinaDe(PROFESIONALES[1]!.id)!.id], noLeidosPor: { [VITRINA_MEDICA.id]: 0 } },
  { id: uuid('conv-medica-endocrino'), conversationTypeConceptId: CONCEPTO.conversationDirect, groupId: null, participantes: [VITRINA_MEDICA.id, vitrinaDe(PROFESIONALES[9]!.id)!.id], noLeidosPor: { [VITRINA_MEDICA.id]: 2 } },
  { id: uuid('conv-paciente-soporte'), conversationTypeConceptId: CONCEPTO.conversationDirect, groupId: null, participantes: [VITRINA_PACIENTE.id, SOPORTE_ID], noLeidosPor: { [VITRINA_PACIENTE.id]: 1 } },
  { id: uuid('conv-paciente-dermatologo'), conversationTypeConceptId: CONCEPTO.conversationDirect, groupId: null, participantes: [VITRINA_PACIENTE.id, vitrinaDe(PROFESIONALES[3]!.id)!.id], noLeidosPor: { [VITRINA_PACIENTE.id]: 0 } },
  // Un grupo: es lo que hace ver el nombre de quien habla arriba de cada
  // burbuja, el subtítulo con los participantes y «Nombre:» en la bandeja.
  { id: uuid('conv-equipo-cardio'), conversationTypeConceptId: CONCEPTO.conversationGroup, groupId: uuid('group-cardio'), participantes: [VITRINA_MEDICA.id, vitrinaDe(PROFESIONALES[1]!.id)!.id, vitrinaDe(PROFESIONALES[9]!.id)!.id], noLeidosPor: { [VITRINA_MEDICA.id]: 2 } },
]);

function mensaje(conv: string, sender: string, texto: string, dias: number, hora: number, minutos = 0, extra: Partial<MensajeSimulado> = {}): MensajeSimulado {
  return {
    id: uuid(`msg-${conv}-${dias}-${hora}-${minutos}`),
    conversationId: conv,
    senderProfileId: sender,
    replyToMessageId: null,
    contentTypeConceptId: CONCEPTO.messageText,
    bodyText: texto,
    attachmentFileId: null,
    isEdited: false,
    sentAt: iso(dias, hora, minutos),
    ...extra,
  };
}

const C1 = uuid('conv-medica-paciente');
const C2 = uuid('conv-medica-pediatra');
const C3 = uuid('conv-medica-endocrino');
const C4 = uuid('conv-paciente-soporte');
const C5 = uuid('conv-paciente-dermatologo');
const C6 = uuid('conv-equipo-cardio');
const PEDIATRA_V = vitrinaDe(PROFESIONALES[1]!.id)!.id;
const ENDO_V = vitrinaDe(PROFESIONALES[9]!.id)!.id;
const DERMA_V = vitrinaDe(PROFESIONALES[3]!.id)!.id;

export const mensajes = new Coleccion<MensajeSimulado>([
  mensaje(C1, VITRINA_PACIENTE.id, 'Hola doctora, buenas tardes. Quería consultarle si puedo tomar el enalapril junto con el ibuprofeno que me dieron para la espalda.', -3, 16, 5),
  mensaje(C1, VITRINA_MEDICA.id, 'Hola Ana. Mejor evitar el ibuprofeno por más de 2 o 3 días mientras tomás enalapril: puede subir la presión y afectar el riñón. Para el dolor usá paracetamol.', -3, 17, 40),
  mensaje(C1, VITRINA_PACIENTE.id, 'Perfecto, gracias. Entonces cambio a paracetamol.', -3, 17, 55),
  mensaje(C1, VITRINA_MEDICA.id, 'Sí. Y si el dolor sigue más de una semana, avisame y lo vemos en consulta.', -3, 18, 2),
  mensaje(C1, VITRINA_PACIENTE.id, 'Doctora, ya me llegaron los resultados del laboratorio. ¿Se los mando por acá o los llevo a la consulta del jueves?', 0, 9, 12),
  // Una respuesta con cita, para que la burbuja con el bloque citado se vea sin tener que provocarla.
  mensaje(C1, VITRINA_MEDICA.id, 'Mandámelos por acá así los miro antes del jueves. Si preferís, subilos a tu historia clínica desde https://alovida.bo/mi-historia y los veo ahí.', 0, 9, 30, { replyToMessageId: uuid(`msg-${C1}-0-9-12`) }),
  mensaje(C2, PEDIATRA_V, 'Vale, te derivo a la mamá de un paciente de 14 años con soplo. ¿Tenés turno esta semana?', -7, 11),
  mensaje(C2, VITRINA_MEDICA.id, 'Sí, decile que reserve el jueves a la tarde. Pasame el nombre y lo priorizo.', -7, 11, 30),
  mensaje(C2, PEDIATRA_V, 'Gracias. Es Martín Rocha Antelo.', -7, 11, 32),
  mensaje(C3, ENDO_V, 'Hola Vale, ¿viste el caso de la paciente con hipotiroidismo y arritmia? Quiero coordinar el ajuste de levotiroxina.', -1, 8, 45),
  mensaje(C3, ENDO_V, 'Le pedí un Holter, cuando lo tengas lo vemos juntas.', -1, 8, 47),
  mensaje(C4, SOPORTE_ID, 'Tu solicitud de cita con la Dra. Valeria Rojas Mendoza fue aceptada para el jueves a las 09:30. Podés ver el detalle en «Mis citas».', -2, 10),
  mensaje(C5, VITRINA_PACIENTE.id, 'Doctor, le mando la foto del lunar que le comenté.', -12, 19, 0, { attachmentFileId: uuid('file-lunar') }),
  mensaje(C5, DERMA_V, 'Recibido. Por la foto no parece nada preocupante, pero quiero verlo con el dermatoscopio. Reservá un turno cuando puedas.', -12, 20, 15),
  mensaje(C5, VITRINA_PACIENTE.id, 'Listo, reservé para el mes que viene. ¡Gracias!', -11, 8, 30),
  // El grupo: tres voces, un documento, una foto y dos citas.
  mensaje(C6, ENDO_V, 'Colegas, les comparto la guía actualizada de anticoagulación en fibrilación auricular. Cambió el umbral de CHA2DS2-VASc para iniciar.', -2, 8, 10, { contentTypeConceptId: CONCEPTO.messageMedia, attachmentFileId: uuid('file-guia-anticoagulacion') }),
  mensaje(C6, PEDIATRA_V, '¡Gracias! ¿Aplica también para adolescentes con cardiopatía congénita?', -2, 8, 40, { replyToMessageId: uuid(`msg-${C6}--2-8-10`) }),
  mensaje(C6, VITRINA_MEDICA.id, 'Para mayores de 15 sí, con ajuste por peso. Menores los vemos caso por caso.', -2, 9, 5),
  mensaje(C6, ENDO_V, 'Les paso el Holter de la paciente con hipotiroidismo que les comenté.', 0, 8, 20, { contentTypeConceptId: CONCEPTO.messageMedia, attachmentFileId: uuid('file-holter') }),
  mensaje(C6, PEDIATRA_V, 'Yo veo extrasístoles aisladas nada más. ¿Vos, Vale?', 0, 8, 35, { replyToMessageId: uuid(`msg-${C6}-0-8-20`) }),
]);

/* ---- encuestas de publicación ---------------------------------------------- */

export const encuestaDePublicacion = {
  id: uuid('poll-1'),
  postId: uuid('post-14'),
  question: '¿Qué preferís para tu control cardiológico?',
  allowsMultiple: false,
  closesAt: iso(10),
  statusConceptId: ESTADO['ST-ACTIVE']!,
  options: [
    { id: uuid('poll-1-a'), label: 'Presencial en la clínica', ordinal: 1, voteCount: 42 },
    { id: uuid('poll-1-b'), label: 'Teleconsulta', ordinal: 2, voteCount: 27 },
    { id: uuid('poll-1-c'), label: 'Depende del motivo', ordinal: 3, voteCount: 31 },
  ],
  totalVotes: 100,
};

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
vitrinas.persistirEn('mock.comunidad.vitrinas');
publicaciones.persistirEn('mock.comunidad.publicaciones');
comentarios.persistirEn('mock.comunidad.comentarios');
resenas.persistirEn('mock.comunidad.resenas');
grupos.persistirEn('mock.comunidad.grupos');
miembrosDeGrupo.persistirEn('mock.comunidad.miembrosDeGrupo');
muroDeGrupo.persistirEn('mock.comunidad.muroDeGrupo');
conversaciones.persistirEn('mock.comunidad.conversaciones');
mensajes.persistirEn('mock.comunidad.mensajes');
