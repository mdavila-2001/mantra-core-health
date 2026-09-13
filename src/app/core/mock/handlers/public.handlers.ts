import { comentarios, CONCEPTO, publicaciones, resenas, vitrinaPorSlug, vitrinas, type VitrinaSimulada } from '../fixtures/comunidad';
import { MEDICAMENTO, displayDe } from '../fixtures/conceptos';
import { afiliaciones, PROFESIONALES, profesionalPorId } from '../fixtures/personas';
import { sedesDe, serviciosPublicadosDe } from './practice.handlers';
import { notFound, type MockRouter } from '../mock-router';
import { ahora, contiene, iso, isoDia, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    La cara pública, sin sesión: el muro, el buscador, las fichas por slug,
    «cerca de mí», el directorio proyectado y la vitrina de medicamentos.
    ========================================================================== */

type ClasePublica = 'PRACTITIONER' | 'ORGANIZATION' | 'PHARMACY' | 'DIAGNOSTIC_UNIT' | 'INSURER';

function resultado(v: VitrinaSimulada) {
  return {
    kind: v.kind as ClasePublica,
    slug: v.slug,
    displayName: v.displayName,
    headline: v.headline,
    city: v.city,
    avatarUrl: v.avatarUrl,
    verified: v.verified,
    ratingAverage: v.ratingAverage,
    ratingCount: v.ratingCount,
    coverUrl: v.coverUrl,
    address: v.address === '' ? null : v.address,
    location: { lat: v.lat, lng: v.lng },
    hasPublishedAgenda: v.hasPublishedAgenda,
    nextAvailableDate: v.hasPublishedAgenda ? isoDia(1 + (v.seguidores % 5)) : null,
  };
}

function actor(v: VitrinaSimulada) {
  return { slug: v.slug, displayName: v.displayName, headline: v.headline, avatarUrl: v.avatarUrl, kind: (v.kind === 'PATIENT' ? 'PRACTITIONER' : v.kind) as ClasePublica };
}

function resumenDePost(p: (typeof publicaciones extends { todos(): (infer T)[] } ? T : never)) {
  return {
    id: p.id,
    bodyText: p.bodyText,
    publishedAt: p.publishedAt,
    mediaUrls: p.mediaUrls,
    reactionCount: Object.values(p.reacciones).reduce((s, n) => s + n, 0),
    commentCount: comentarios.filtrar((c) => c.postId === p.id).length,
  };
}

function paginaPublica<T>(items: readonly T[], query: URLSearchParams, limite = 20) {
  const pagina = paginar(items, query, limite);
  return { items: pagina.items, nextCursor: pagina.nextCursor, totalHint: pagina.count, generatedAt: ahora() };
}

function publicas(): VitrinaSimulada[] {
  return vitrinas.filtrar((v) => v.kind !== 'PATIENT' && v.visibility === 'PUBLIC');
}

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const GRUPOS_TERAPEUTICOS = ['Cardiovascular', 'Antidiabéticos', 'Antibióticos', 'Analgésicos', 'Digestivo', 'Respiratorio', 'Hormonas', 'Sistema nervioso', 'Antialérgicos', 'Suplementos'];

const MEDICAMENTOS_VITRINA = Object.entries(MEDICAMENTO).map(([code, conceptId], i) => {
  const display = displayDe(conceptId);
  const generico = display.split(' ')[0]!;
  const grupo = GRUPOS_TERAPEUTICOS[[0, 0, 1, 0, 2, 3, 3, 4, 5, 6, 7, 8, 9, 2, 1][i] ?? 0]!;
  const precio = 8 + i * 4.5;
  return {
    conceptId,
    atcCode: `${['C09', 'C09', 'A10', 'C10', 'J01', 'M01', 'N02', 'A02', 'R03', 'H03', 'N06', 'R06', 'B03', 'J01', 'A10'][i]}${String(i).padStart(2, '0')}`,
    genericName: generico,
    therapeuticGroup: grupo,
    brands: [`${generico} Bagó`, `${generico} Inti`, ...(i % 2 === 0 ? [`${generico} Genérico`] : [])],
    presentations: [display.replace(`${generico} `, '')],
    requiresPrescription: ![5, 6, 11, 12].includes(i),
    priceFrom: precio.toFixed(2),
    priceTo: (precio * 1.6).toFixed(2),
    currency: 'BOB',
    pharmacyCount: 3 + (i % 4),
    nearestKm: 0.8 + (i % 5) * 0.7,
    code,
  };
});

/* ---- el catálogo que publica una farmacia -------------------------------- */

/** Un entero estable por slug: la misma góndola en cada recarga. */
function semillaDeFarmacia(slug: string): number {
  return parseInt(uuid(`gondola-${slug}`).slice(0, 8), 16);
}

/**
 * Qué medicamentos tiene una farmacia, con su marca y su precio.
 *
 * Sale de la misma vitrina que ya alimenta «dónde comprar mi receta»
 * (`MEDICAMENTOS_VITRINA`), acotada y ordenada por el slug: dos farmacias no
 * tienen el mismo surtido ni el mismo precio, y una que las tuviera todas al
 * mismo importe no se parece a ninguna farmacia.
 *
 * El precio se mueve dentro de la banda que el propio medicamento declara
 * (`priceFrom`..`priceTo`) — no es un número suelto — y el agotado se rotula
 * en vez de esconderse: quien busca un remedio necesita saber que ahí no está.
 */
function productosDeFarmacia(slug: string) {
  const base = semillaDeFarmacia(slug);
  const cuantos = 8 + (base % 6);
  return Array.from({ length: cuantos }, (_, i) => {
    const m = MEDICAMENTOS_VITRINA[(base + i * 7) % MEDICAMENTOS_VITRINA.length]!;
    const desde = Number(m.priceFrom);
    const hasta = Number(m.priceTo);
    const paso = (base + i * 13) % 5;
    return {
      id: uuid(`public-product-${slug}-${m.code}`),
      genericName: m.genericName,
      brandName: m.brands[(base + i) % m.brands.length]!,
      presentation: m.presentations[0] ?? null,
      therapeuticGroup: m.therapeuticGroup,
      price: (desde + ((hasta - desde) * paso) / 4).toFixed(2),
      currency: m.currency,
      inStock: (base + i) % 7 !== 0,
      requiresPrescription: m.requiresPrescription,
    };
  });
}

export function registrarPublico(router: MockRouter): void {
  router.get('/public/posts', ({ query }) => {
    const items = publicaciones
      .todos()
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((p) => {
        const autor = vitrinas.get(p.authorPublicProfileId)!;
        return {
          ...resumenDePost(p),
          authorSlug: autor.slug,
          authorDisplayName: autor.displayName,
          authorHeadline: autor.headline,
          authorAvatarUrl: autor.avatarUrl,
          authorKind: actor(autor).kind,
        };
      });
    return paginaPublica(items, query, 10);
  });

  const buscar = (clases: readonly ClasePublica[] | null) => ({ query }: { query: URLSearchParams }) => {
    const q = texto(query, 'q');
    const city = texto(query, 'city');
    const specialty = texto(query, 'specialty');
    const verified = query.get('verified') === 'true';
    const items = publicas()
      .filter((v) => clases === null || clases.includes(v.kind as ClasePublica))
      .filter((v) => contiene(v.displayName, q) || contiene(v.headline, q) || v.specialties.some((s) => contiene(displayDe(s), q)))
      .filter((v) => contiene(v.city, city))
      .filter((v) => specialty === null || v.specialties.includes(specialty) || v.specialties.some((s) => contiene(displayDe(s), specialty)))
      .filter((v) => !verified || v.verified)
      .map(resultado);
    return paginaPublica(items, query);
  };

  router.get('/public/search', buscar(null));
  router.get('/public/search/practitioners', buscar(['PRACTITIONER']));
  router.get('/public/search/organizations', buscar(['ORGANIZATION']));
  router.get('/public/search/diagnostic-units', buscar(['DIAGNOSTIC_UNIT']));
  router.get('/public/search/insurers', buscar(['INSURER']));
  router.get('/public/search/pharmacies', buscar(['PHARMACY']));
  router.get('/public/search/medications', ({ query }) => {
    const q = texto(query, 'q');
    const items = MEDICAMENTOS_VITRINA.filter((m) => contiene(m.genericName, q) || contiene(m.therapeuticGroup, q)).map((m) => ({
      kind: 'MEDICATION' as const,
      slug: m.code.toLowerCase(),
      displayName: `${m.genericName} · ${m.presentations[0]}`,
      headline: m.therapeuticGroup,
      city: null,
      avatarUrl: null,
      verified: true,
      ratingAverage: null,
      ratingCount: 0,
      coverUrl: null,
      address: null,
      location: null,
      hasPublishedAgenda: false,
      nextAvailableDate: null,
    }));
    return paginaPublica(items, query);
  });

  router.get('/public/nearby', ({ query }) => {
    const lat = Number(query.get('lat') ?? -17.78);
    const lng = Number(query.get('lng') ?? -63.18);
    const radio = Number(query.get('radiusKm') ?? 10);
    const kind = texto(query, 'kind') as ClasePublica | null;
    const limit = Number(query.get('limit') ?? 20) || 20;
    const items = publicas()
      .filter((v) => kind === null || v.kind === kind)
      .map((v) => ({ ...resultado(v), distanceKm: distanciaKm(lat, lng, v.lat, v.lng), location: { lat: v.lat, lng: v.lng } }))
      .filter((v) => v.distanceKm <= radio)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
    return { items, nextCursor: null, totalHint: items.length, generatedAt: ahora() };
  });

  router.get('/public/profiles/:prefix/:slug', ({ params }) => {
    const v = vitrinaPorSlug(params['slug']!);
    if (v === undefined || v.kind === 'PATIENT') return notFound('Ficha no encontrada');
    const profesional = v.kind === 'PRACTITIONER' ? profesionalPorId(v.targetId) : undefined;
    return {
      kind: v.kind as ClasePublica,
      slug: v.slug,
      displayName: v.displayName,
      headline: v.headline,
      biography: v.biography,
      avatarUrl: v.avatarUrl,
      coverUrl: v.coverUrl,
      verified: v.verified,
      city: v.city,
      address: v.address === '' ? null : v.address,
      location: { lat: v.lat, lng: v.lng },
      specialties: v.specialties.map(displayDe),
      trajectory:
        profesional === undefined
          ? []
          : afiliaciones
              .filtrar((a) => a.practitionerProfileId === profesional.id)
              .map((a) => ({ organizationName: a.organizationName, roleTitle: a.roleTitle ?? 'Profesional', departmentText: null, startDate: a.startDate, endDate: a.endDate })),
      // Los lugares donde atiende (P16). `city`/`address` de arriba siguen
      // siendo el respaldo: una ficha sin sedes se sigue leyendo como antes.
      practiceSites:
        profesional === undefined
          ? []
          : sedesDe(profesional.id).map((sede) => ({
              id: sede.id,
              name: sede.name,
              addressText: sede.addressText,
              location:
                sede.latitude === null || sede.longitude === null
                  ? null
                  : { lat: sede.latitude, lng: sede.longitude },
              isOwn: sede.esPropio,
            })),
      ratingAverage: v.ratingAverage,
      ratingCount: v.ratingCount,
      acceptsReviews: v.acceptsReviews,
      posts: publicaciones
        .filtrar((p) => p.authorPublicProfileId === v.id)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .map(resumenDePost),
      updatedAt: iso(-1),
    };
  });

  /* ---- las opiniones de una ficha, con quién las dio ----------------------
     Contrato del simulador: la API real todavía no lo publica (ver
     «Opiniones públicas de una ficha» en PENDIENTES-BACKEND.md). Cuelga de
     `/public/profiles/:prefijo/:slug/…` por lo mismo que los servicios. */

  router.get('/public/profiles/:prefix/:slug/reviews', ({ params, query }) => {
    const v = vitrinaPorSlug(params['slug']!);
    if (v === undefined || v.kind === 'PATIENT') return notFound('Ficha no encontrada');
    const items = resenas
      .filtrar((r) => r.targetPublicProfileId === v.id)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((r) => {
        const anonima = r.reviewerDisplayModeConceptId === CONCEPTO.reviewDisplayAnon;
        const conFicha = vitrinas.get(r.reviewerProfileId);
        const publica = conFicha !== undefined && conFicha.kind !== 'PATIENT' && conFicha.visibility === 'PUBLIC';
        const respuesta = r.responses[0];
        return {
          id: r.id,
          rating: r.overallRating,
          text: r.reviewText === '' ? null : r.reviewText,
          publishedAt: r.publishedAt,
          reviewer: anonima
            ? { displayName: 'Paciente verificado', headline: 'Eligió no mostrar su nombre', avatarUrl: null, slug: null, kind: null }
            : {
                displayName: r.reviewerDisplayName ?? conFicha?.displayName ?? 'Paciente',
                headline: publica ? conFicha.headline : 'Paciente',
                avatarUrl: r.reviewerAvatarUrl ?? conFicha?.avatarUrl ?? null,
                slug: publica ? conFicha.slug : null,
                kind: publica ? (conFicha.kind as ClasePublica) : null,
              },
          response: respuesta === undefined ? null : { text: respuesta.responseText, publishedAt: respuesta.publishedAt },
        };
      });
    return paginaPublica(items, query, 20);
  });

  /* ---- lo que cada ficha OFRECE (P30 y P31 de PENDIENTES-BACKEND.md) ------
     Las dos cuelgan de `/public/profiles/:prefijo/:slug/…` y no de `/o/:slug/…`
     por lo mismo que la ficha: `/o` es también una ruta del router, y el proxy
     de desarrollo enruta comparando el comienzo de la ruta. */

  router.get('/public/profiles/o/:slug/services', ({ params, query }) => {
    const v = vitrinaPorSlug(params['slug']!);
    if (v === undefined || v.kind !== 'ORGANIZATION') return notFound('Ficha no encontrada');
    return paginaPublica(serviciosPublicadosDe(v.slug), query, 50);
  });

  router.get('/public/profiles/f/:slug/products', ({ params, query }) => {
    const v = vitrinaPorSlug(params['slug']!);
    if (v === undefined || v.kind !== 'PHARMACY') return notFound('Ficha no encontrada');
    return paginaPublica(productosDeFarmacia(v.slug), query, 50);
  });

  const reaccionesDe = ({ params, query }: { params: Readonly<Record<string, string>>; query: URLSearchParams }) => {
    const p = publicaciones.get(params['id']!);
    if (p === undefined) return notFound();
    const actores = publicas().slice(0, 8);
    const items = Object.entries(p.reacciones).flatMap(([tipo, n]) => actores.slice(0, Math.min(n, 3)).map((v) => ({ ...actor(v), reactionType: tipo as keyof typeof CONCEPTO.reaction })));
    return paginaPublica(items, query);
  };
  router.get('/public/posts/:id/reactions', reaccionesDe);

  const comentariosDe = ({ params, query }: { params: Readonly<Record<string, string>>; query: URLSearchParams }) => {
    const padre = params['commentId'] ?? null;
    const items = comentarios
      .filtrar((c) => c.postId === params['id'] && c.parentCommentId === padre)
      .map((c) => {
        const autor = vitrinas.get(c.authorProfileId);
        return {
          id: c.id,
          bodyText: c.bodyText,
          createdAt: c.createdAt,
          replyCount: comentarios.filtrar((r) => r.parentCommentId === c.id).length,
          author: autor === undefined ? { slug: 'anonimo', displayName: 'Usuario', headline: null, avatarUrl: null, kind: 'PRACTITIONER' as const } : actor(autor),
          media: c.mediaUrl === undefined ? [] : [{ url: c.mediaUrl, kind: 'IMAGE' as const, altText: null }],
        };
      });
    return paginaPublica(items, query);
  };
  router.get('/public/posts/:id/comments', comentariosDe);
  router.get('/public/posts/:id/comments/:commentId/replies', comentariosDe);

  router.get('/public/directory', ({ query }) => {
    const city = texto(query, 'city');
    const specialty = texto(query, 'specialty');
    const records = PROFESIONALES.filter((p) => p.especialidades.length > 0)
      .filter((p) => contiene(p.ciudad, city))
      .filter((p) => specialty === null || p.especialidades.some((s) => contiene(displayDe(s), specialty)))
      .map((p) => ({
        practitionerProfileId: p.id,
        displayName: p.displayName,
        professionalTitle: p.professionalTitle,
        specialties: p.especialidades.map(displayDe),
        city: p.ciudad,
        organization: p.organizacion,
        verified: p.verified,
        acceptsNewPatients: p.acceptsNewPatients,
        telehealthAvailable: p.telehealthAvailable,
        slug: p.slug,
      }));
    return { slug: 'directory', records, refreshedAt: iso(0, 6), generatedAt: ahora() };
  });

  router.get('/public/medications', ({ query }) => {
    const q = texto(query, 'q');
    const group = texto(query, 'group');
    const limit = Number(query.get('limit') ?? 50) || 50;
    const items = MEDICAMENTOS_VITRINA.filter((m) => contiene(m.genericName, q) || m.brands.some((b) => contiene(b, q)))
      .filter((m) => group === null || m.therapeuticGroup === group)
      .slice(0, limit)
      .map(({ code: _c, ...m }) => m);
    return { items, total: items.length, groups: [...new Set(MEDICAMENTOS_VITRINA.map((m) => m.therapeuticGroup))], generatedAt: ahora() };
  });

  router.get('/public/medications/:id/availability', ({ params, query }) => {
    const m = MEDICAMENTOS_VITRINA.find((x) => x.conceptId === params['id']);
    if (m === undefined) return notFound('Medicamento no encontrado');
    const lat = Number(query.get('lat') ?? -17.78);
    const lng = Number(query.get('lng') ?? -63.18);
    const farmacias = vitrinas.filtrar((v) => v.kind === 'PHARMACY');
    const { code: _c, ...medication } = m;
    return {
      medication,
      offers: farmacias.map((f, i) => ({
        pharmacySlug: f.slug,
        pharmacyName: f.displayName,
        addressText: f.address,
        city: f.city,
        latitude: f.lat,
        longitude: f.lng,
        distanceKm: distanciaKm(lat, lng, f.lat, f.lng),
        brandName: m.brands[i % m.brands.length]!,
        presentation: m.presentations[0]!,
        price: (Number(m.priceFrom) * (1 + i * 0.2)).toFixed(2),
        currency: 'BOB',
        inStock: i !== 2,
        homeDelivery: i === 0,
        pickup: true,
        requiresPrescription: m.requiresPrescription,
      })),
      generatedAt: ahora(),
    };
  });

  void uuid;
}
