/* ============================================================================
    La superficie pública del buscador, tal como la sirve la API.

    Estos tipos son la transcripción de `openapi/CONTRATO-PUBLICO.md` del
    backend, verificada contra la API viva el 2026-08-17. No son una
    interpretación: si alguno se separa del contrato, el que está mal es el de
    acá.

    ## Por qué no reusa los tipos de `community`

    `community.types.ts` describe la red social **con sesión**: sus perfiles
    traen `tenantId`, `targetTypeConceptId`, `avatarFileId`, `statusConceptId`.
    Esta superficie es anónima y **no tiene ninguno de esos campos** — el
    servidor los deja fuera a propósito, campo por campo, porque un uuid interno
    regalado a un visitante es un dato que no se puede volver a esconder.

    Compartir un tipo entre las dos superficies obligaría a declarar opcional
    todo lo interno, y entonces el tipo dejaría de decir cuál de las dos formas
    llegó. Peor: invitaría a pintar en una pantalla pública un campo que sólo
    existe con sesión, y a descubrirlo recién en producción con un `undefined`.
    ========================================================================== */

/** Los seis verticales del directorio. */
export const PUBLIC_RESULT_KINDS = [
  'PRACTITIONER',
  'ORGANIZATION',
  'PHARMACY',
  'DIAGNOSTIC_UNIT',
  'INSURER',
  'MEDICATION',
] as const;

/** Qué clase de sujeto es un resultado. */
export type PublicResultKind = (typeof PUBLIC_RESULT_KINDS)[number];

/**
 * La envoltura de página que devuelven las siete búsquedas y `nearby`.
 *
 * `items` nunca es `null`; vacío es `[]`.
 */
export interface PublicPage<T> {
  readonly items: readonly T[];
  /** `null` = no hay más. Es opaco: se guarda, no se construye ni se parsea. */
  readonly nextCursor: string | null;
  /**
   * Una **pista** del total, no el total.
   *
   * `null` cuando no se puede estimar barato. No sirve para paginar ni para
   * escribir «N resultados» sin el matiz de «aproximadamente».
   */
  readonly totalHint: number | null;
  /** Cuándo armó la API esta respuesta. No es cuándo se calculó el dato. */
  readonly generatedAt: Date;
}

/**
 * Una fila del buscador.
 *
 * Todo campo opcional llega como `null` explícito y se declara `| null`, no
 * `?:` — la convención de `wire.ts`, que existe porque `null` y `undefined` se
 * comportan distinto en las tres cosas que importan: `new Date(null)` es 1970,
 * `x !== undefined` es cierto para `null`, y `'k' in o` no coincide con el tipo.
 */
export interface PublicSearchResult {
  readonly kind: PublicResultKind;
  /** El que va en `/p/:slug`, `/o/:slug`… Es la identidad pública del sujeto. */
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly city: string | null;
  /**
   * URL ya resuelta, **nunca un id de archivo**.
   *
   * El cliente público no tiene sesión y por tanto no puede firmar una URL:
   * resolverla es responsabilidad del servidor. `null` significa sin foto, y la
   * pantalla degrada a iniciales — no a un roto.
   */
  readonly avatarUrl: string | null;
  /** Sólo la verificación **activa** cuenta. Pendiente es `false`. */
  readonly verified: boolean;
  /** 1..5 con una decimal, o `null` cuando todavía no hay reseñas. */
  readonly ratingAverage: number | null;
  /** `0` con `ratingAverage: null` es el estado normal, no un error. */
  readonly ratingCount: number;
  /**
   * La portada, ya resuelta a URL. `null` = sin portada.
   *
   * Es lo que convierte un listado de nombres en un directorio que se recorre
   * mirando. La tarjeta degrada a un fondo del tema cuando falta — nunca a un
   * hueco gris, que se lee como una imagen que no cargó.
   */
  readonly coverUrl: string | null;
  /** La calle, ya legible. Sale de la misma dirección de la que sale `city`. */
  readonly address: string | null;
  /** El punto de la dirección, o `null` si sólo hay texto. */
  readonly location: PublicLocation | null;
  /** Si el sujeto tiene agenda publicada: es lo que habilita «Pedir turno». */
  readonly hasPublishedAgenda: boolean;
  /**
   * Primer día con hueco (`YYYY-MM-DD`), o `null`.
   *
   * Truncado a día **a propósito**: la hora exacta cambia entre que se pinta y
   * se toca, y una tarjeta que promete «14:30» y no lo tiene es peor que una
   * que no promete nada.
   */
  readonly nextAvailableDate: string | null;
}

/** Una publicación en la ficha pública. */
export interface PublicPostSummary {
  readonly id: string;
  readonly bodyText: string;
  readonly publishedAt: Date;
  /** Vacío, nunca `null`. */
  readonly mediaUrls: readonly string[];
  readonly reactionCount: number;
  readonly commentCount: number;
}

/**
 * Una publicación del feed de la portada, con su autor adentro.
 *
 * Extiende la de la ficha porque **es la misma publicación**; lo que agrega es
 * de quién es. En la ficha el autor es la página entera y repetirlo sería
 * ruido; en un feed mezclado es lo único que distingue una tarjeta de otra.
 */
export interface PublicFeedPost extends PublicPostSummary {
  readonly authorSlug: string;
  readonly authorDisplayName: string;
  readonly authorHeadline: string | null;
  readonly authorAvatarUrl: string | null;
  /** El vertical del autor, para armar el prefijo de su ficha. */
  readonly authorKind: PublicResultKind;
}

/* ============================================================================
    Las lecturas sociales de la superficie pública (TAREA 01 §5.1).
    ========================================================================== */

/**
 * Una persona, vista desde afuera: los mismos cinco campos con los que el feed
 * presenta al autor de una publicación, ni uno más.
 *
 * No hay `profileId` ni `userId` **a propósito**: esto es una red social
 * médica, y quién reaccionó a la publicación de un especialista es dato
 * personal. El servidor no los sirve; el tipo lo refleja para que no se los
 * espere.
 */
export interface PublicSocialActor {
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly avatarUrl: string | null;
  readonly kind: PublicResultKind;
}

/** Los códigos de reacción que sirve la API. Nunca el uuid del concepto. */
export type PublicReactionCode = 'LIKE' | 'LOVE' | 'INSIGHTFUL' | 'CELEBRATE' | 'SUPPORT';

/** Quién reaccionó a una publicación, y con qué. */
export interface PublicPostReaction extends PublicSocialActor {
  /** `null` cuando la fila guarda un concepto que el módulo todavía no nombra. */
  readonly reactionType: PublicReactionCode | null;
}

/** Un comentario del hilo público, con su autor adentro. */
export interface PublicComment {
  readonly id: string;
  readonly bodyText: string;
  readonly createdAt: Date;
  /** Cuántas respuestas cuelgan de él. 0, nunca `null`. */
  readonly replyCount: number;
  readonly author: PublicSocialActor;
  /** Imágenes, stickers y GIFs adjuntos (REQ-01-011). */
  readonly media: readonly PublicCommentMedia[];
}

/**
 * Un adjunto de comentario público. Ya viene resuelto a URL servida por la
 * API — nunca el `fileId` interno (ver `PublicCommentMediaDto` del backend).
 */
export interface PublicCommentMedia {
  readonly url: string;
  readonly kind: 'IMAGE' | 'STICKER' | 'GIF';
  readonly altText: string | null;
}

/** Un punto geográfico del directorio. */
export interface PublicLocation {
  readonly lat: number;
  readonly lng: number;
}

/** Un vínculo laboral de la trayectoria pública de un profesional. */
export interface PublicAffiliation {
  readonly organizationName: string;
  readonly roleTitle: string;
  readonly departmentText: string | null;
  /** Fecha ISO (`YYYY-MM-DD`). */
  readonly startDate: string;
  /** Fecha ISO, o `null` si sigue vigente. */
  readonly endDate: string | null;
}

/**
 * La ficha pública que sirve `/p/:slug` y sus cuatro hermanas.
 *
 * Lo que este tipo **no** tiene, y no va a tener: `tenantId`, `targetId`,
 * ningún `*ConceptId`, ningún `*FileId`, `createdByUserId`, `updatedByUserId`,
 * `rowVersion`. La lista blanca vive en el servidor y hay una prueba que falla
 * si aparece una clave de más; este tipo es su espejo del lado del cliente.
 */
export interface PublicProfileDetail {
  readonly kind: Exclude<PublicResultKind, 'MEDICATION'>;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly biography: string | null;
  readonly avatarUrl: string | null;
  readonly coverUrl: string | null;
  readonly verified: boolean;
  readonly city: string | null;
  readonly address: string | null;
  readonly location: PublicLocation | null;
  readonly specialties: readonly string[];
  /** Trayectoria laboral, de la más reciente a la más antigua. Vacía fuera de un profesional. */
  readonly trajectory: readonly PublicAffiliation[];

  /**
   * Los lugares donde atiende, con el propio primero.
   *
   * Es lo que pedía P16 de `PENDIENTES-BACKEND.md`, con las palabras del
   * cliente: «en el perfil público del profesional falta los lugares donde
   * atiende». `city` y `address` son **una** dirección y siguen sirviendo de
   * respaldo; esto son las sedes, que es lo que hay que poder mirar antes de
   * elegir a quién consultar.
   *
   * Vacía fuera de un profesional y en las fichas que todavía no cargaron
   * ninguna — la pantalla cae al respaldo, que es el comportamiento que ya
   * tenía.
   */
  readonly practiceSites: readonly PublicPracticeSite[];
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
  readonly acceptsReviews: boolean;
  /** Sólo las publicaciones `PUBLIC`, máximo 20. */
  readonly posts: readonly PublicPostSummary[];
  /** Alimenta el `<lastmod>` del sitemap y el `og:updated_time`. */
  readonly updatedAt: Date;
}

/**
 * Un lugar donde alguien atiende, tal como lo muestra su ficha pública.
 *
 * Más angosto que el `PracticeSite` de `practice-sites.types.ts` a propósito:
 * aquél es la sede con la que trabaja quien la administra —código, zona
 * horaria, estado— y esto es lo que un paciente necesita para decidir si le
 * queda cerca. La ficha es anónima; no se publica de una sede más de lo que
 * hace falta para ir.
 */
export interface PublicPracticeSite {
  readonly id: string;
  readonly name: string;
  /** Dirección en una línea, o `null` si la sede no cargó ninguna. */
  readonly addressText: string | null;
  /** Punto en el mapa, si la sede lo tiene. Sin él no hay pin que dibujar. */
  readonly location: PublicLocation | null;
  /**
   * Si es el consultorio propio del profesional, y no una sede de una
   * organización a la que está vinculado.
   *
   * La ficha lo distingue porque no es lo mismo para quien elige: en el propio
   * atiende él y punto; en el de una clínica hay una organización de por medio
   * —con su recepción, su cobro y sus horarios—. Es también el único que puede
   * existir sin que nadie lo haya aceptado, que es lo que lo hace el primero
   * que un profesional recién registrado tiene para ofrecer.
   */
  readonly isOwn: boolean;
}

/** Un resultado de «lo más cercano», con su distancia. */
export interface PublicNearbyResult extends PublicSearchResult {
  /**
   * Distancia **en línea recta**, con una decimal. No es distancia de
   * recorrido, y el rótulo en pantalla tiene que decir lo mismo que el campo.
   */
  readonly distanceKm: number;
  readonly location: PublicLocation;
}

/** Los filtros comunes a las siete búsquedas. */
export interface PublicSearchQuery {
  /** Texto libre; el servidor lo recorta a 120 caracteres. */
  readonly q?: string;
  readonly city?: string;
  /** Copiado de un `nextCursor` anterior. Nunca construido acá. */
  readonly cursor?: string;
  /** El servidor lo **recorta** a `[1, 50]`; fuera de rango no da error. */
  readonly limit?: number;
}

/** Los filtros propios del vertical de profesionales. */
export interface PublicPractitionerQuery extends PublicSearchQuery {
  readonly specialty?: string;
  /** `true` = sólo verificados. Omitido = todos, verificados primero. */
  readonly verified?: boolean;
}

/** El punto y el radio de «lo más cercano». */
export interface PublicNearbyQuery {
  /** `[-90, 90]`. Obligatoria: sin ella la API devuelve 400, no vacío. */
  readonly lat: number;
  /** `[-180, 180]`. Obligatoria. */
  readonly lng: number;
  /** Por omisión 5, recortado a `[1, 50]`. */
  readonly radiusKm?: number;
  readonly kind?: PublicResultKind;
  readonly limit?: number;
}

/**
 * Los cinco prefijos de ruta corta y el tipo que cada uno promete.
 *
 * El prefijo **no es decorativo**: `/p/` promete un profesional, y pedir por
 * ahí el slug de una farmacia da 404 en vez de redirigir, porque servirla ahí
 * rompería el JSON-LD de la página, que declara `Physician`.
 */
export const PUBLIC_PROFILE_PREFIX: Readonly<
  Record<Exclude<PublicResultKind, 'MEDICATION'>, string>
> = {
  PRACTITIONER: 'p',
  ORGANIZATION: 'o',
  PHARMACY: 'f',
  DIAGNOSTIC_UNIT: 'l',
  INSURER: 's',
};
