import type {
  OwnPractitionerProfile,
  PractitionerAffiliation,
} from '../../../core/data-access/profiles/profiles.types';
import type { InsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { sello } from '../my-profile/practitioner-profile/practitioner-seal';

/* ============================================================================
    «Mis verificaciones»: lo que hay que mostrar, armado sin DOM.

    Dos lecturas de los mismos datos:

    - la **hoja de ruta**: qué tramos de la verificación del profesional ya
      están, cuál le toca y cuál se trabó;
    - la **bandeja de solicitudes**: cada pedido que mandó —a una institución o
      a una aseguradora— contado como una conversación.

    Nada de esto decide nada: el estado de cada cosa lo dice la API (los
    conceptos de estado, el `statusKind` del vínculo, el `status` de la
    solicitud). Acá sólo se traduce a palabras y se ordena.
    ========================================================================== */

/** El estado de un tramo de la hoja de ruta. `not-started` es «no cargó nada». */
export type RoadmapState = StatusSealVariant | 'not-started';

/** Un tramo de la hoja de ruta. */
export interface RoadmapStep {
  readonly key: string;
  readonly title: string;
  readonly icon: NavIconName;
  readonly state: RoadmapState;
  /** El sello en palabras: el color nunca va solo. */
  readonly stateLabel: string;
  /** Qué hay detrás del estado, en una frase. */
  readonly detail: string;
  /** La salida, cuando el tramo depende de algo que la persona puede hacer. */
  readonly action?: { readonly label: string; readonly route: string };
  /** Los tramos que no impiden atender no frenan la hoja de ruta. */
  readonly optional: boolean;
}

const STATE_LABEL: Readonly<Record<RoadmapState, string>> = {
  approved: 'Verificado',
  pending: 'Pendiente',
  'in-review': 'En revisión',
  rejected: 'Rechazado',
  expired: 'Vencido',
  unknown: 'Sin dato',
  'not-started': 'Sin cargar',
};

/**
 * Junta los estados de varias filas en uno solo para el tramo.
 *
 * Un rechazo manda sobre todo —es lo que la persona tiene que mirar—; después
 * lo pendiente; y sólo si todo está verificado el tramo se da por verificado.
 */
export function combineStates(states: readonly StatusSealVariant[]): RoadmapState {
  if (states.length === 0) return 'not-started';
  if (states.includes('rejected')) return 'rejected';
  if (states.includes('expired')) return 'expired';
  if (states.every((s) => s === 'approved')) return 'approved';
  if (states.includes('pending')) return 'pending';
  if (states.includes('in-review')) return 'in-review';
  return 'unknown';
}

/**
 * Para los tramos de contrapartes independientes —instituciones,
 * aseguradoras— cada una decide por su lado: con una que confirmó, el médico
 * ya trabaja con sello y el tramo lo dice; un rechazo de otra no lo anula (lo
 * cuenta el detalle). Sólo si todas rechazaron, el tramo es un rechazo.
 */
export function combineIndependent(states: readonly StatusSealVariant[]): RoadmapState {
  if (states.length === 0) return 'not-started';
  if (states.includes('approved')) return 'approved';
  if (states.includes('pending')) return 'pending';
  if (states.includes('in-review')) return 'in-review';
  if (states.every((s) => s === 'rejected' || s === 'expired')) return 'rejected';
  return 'unknown';
}

/** «2 de 3 verificadas», o una frase para el vacío. */
function cuenta(
  states: readonly StatusSealVariant[],
  singular: string,
  plural: string,
  vacio: string,
) {
  if (states.length === 0) return vacio;
  const ok = states.filter((s) => s === 'approved').length;
  const rechazadas = states.filter((s) => s === 'rejected').length;
  const base = `${ok} de ${states.length} ${states.length === 1 ? singular : plural} con sello`;
  return rechazadas > 0 ? `${base} · ${rechazadas} rechazada${rechazadas === 1 ? '' : 's'}` : base;
}

/** El estado de un vínculo con institución, en el vocabulario del sello. */
export function affiliationState(a: PractitionerAffiliation): StatusSealVariant {
  switch (a.statusKind) {
    case 'aprobado':
      return 'approved';
    case 'pendiente':
      return 'pending';
    case 'rechazado':
    case 'revocado':
      return 'rejected';
    case 'declarado':
      // Declarado no es un trámite trabado: es que nadie puede confirmarlo.
      // Se cuenta como «sin sello», que es lo que es.
      return 'unknown';
    default:
      return 'unknown';
  }
}

/** El estado de una solicitud a aseguradora, en el vocabulario del sello. */
export function insurerState(r: InsurerRequest): StatusSealVariant {
  switch (r.status) {
    case 'APPROVED':
      return 'approved';
    case 'PENDING':
      return 'pending';
    case 'REJECTED':
      return 'rejected';
    default:
      return 'unknown';
  }
}

/** Los vínculos que son pedidos a una organización de la plataforma. */
export function institutionRequests(
  affiliations: readonly PractitionerAffiliation[],
): readonly PractitionerAffiliation[] {
  return affiliations.filter((a) => a.practiceSiteId !== null);
}

/**
 * La hoja de ruta del profesional, en el orden en que se recorre: primero lo
 * que lo habilita a atender, después dónde y con quién trabaja.
 */
export function buildRoadmap(
  perfil: OwnPractitionerProfile,
  etiquetas: ConceptLabels,
  insurerRequests: readonly InsurerRequest[] | null,
  ahora: Date = new Date(),
): readonly RoadmapStep[] {
  const perfilEstado = sello(etiquetas, perfil.verificationStatusConceptId);
  const matriculas = perfil.licenses.map((l) => sello(etiquetas, l.stateConceptId));
  // Del concepto de estado, como en «Mi perfil»: `verifiedAt` también se
  // escribe cuando se RECHAZA, así que leerlo daría «Verificado» a un título
  // rechazado. El vencimiento cambia el sello, no la decisión.
  const titulos = perfil.credentials.map((c): StatusSealVariant =>
    c.expiryDate !== undefined && c.expiryDate < ahora
      ? 'expired'
      : sello(etiquetas, c.stateConceptId),
  );
  const especialidades = perfil.specialties
    .filter((s) => s.validTo === undefined)
    .map((s) => sello(etiquetas, s.verificationStatusConceptId));
  // Sólo los que se pidieron y alguien puede confirmar: un declarado no
  // espera nada, y contarlo como pendiente sería prometer un sello que no
  // va a llegar.
  const instituciones = institutionRequests(perfil.affiliations)
    .filter((a) => a.statusKind !== 'declarado')
    .map(affiliationState);
  const seguros = latestPerCarrier(insurerRequests ?? [])
    .filter((r) => r.status !== 'WITHDRAWN')
    .map(insurerState);

  const paso = (p: Omit<RoadmapStep, 'stateLabel'>): RoadmapStep => ({
    ...p,
    stateLabel: STATE_LABEL[p.state],
  });

  return [
    paso({
      key: 'account',
      title: 'Su cuenta',
      icon: 'people',
      state: 'approved',
      detail: 'Creada. Entra con su correo personal y su contraseña.',
      optional: false,
    }),
    paso({
      key: 'profile',
      title: 'Verificación de su perfil profesional',
      icon: 'shield',
      state: perfilEstado,
      detail:
        perfilEstado === 'approved'
          ? 'AloVida comprobó su identidad profesional: su ficha lleva el sello.'
          : 'Un equipo de AloVida revisa sus datos y su matrícula antes de dar el sello.',
      ...(perfilEstado === 'approved'
        ? {}
        : { action: { label: 'Ver qué me falta', route: '/onboarding' } }),
      optional: false,
    }),
    paso({
      key: 'licenses',
      title: 'Matrícula, SEDES y colegio',
      icon: 'briefcase',
      state: combineStates(matriculas),
      detail: cuenta(
        matriculas,
        'habilitación',
        'habilitaciones',
        'Todavía no cargó su matrícula.',
      ),
      ...(combineStates(matriculas) === 'approved'
        ? {}
        : { action: { label: 'Revisar mis habilitaciones', route: '/my-account/edit' } }),
      optional: false,
    }),
    paso({
      key: 'credentials',
      title: 'Títulos',
      icon: 'teach',
      state: combineStates(titulos),
      detail: cuenta(
        titulos,
        'título',
        'títulos',
        'Opcional. Puede cargar sus diplomas desde su perfil.',
      ),
      ...(titulos.length === 0
        ? { action: { label: 'Cargar un título', route: '/my-account/edit' } }
        : {}),
      optional: true,
    }),
    paso({
      key: 'specialties',
      title: 'Especialidades',
      icon: 'directory',
      state: combineStates(especialidades),
      detail: cuenta(
        especialidades,
        'especialidad',
        'especialidades',
        'Opcional. Sin especialidad figura como medicina general.',
      ),
      optional: true,
    }),
    paso({
      key: 'institutions',
      title: 'Instituciones donde trabaja',
      icon: 'building',
      state: combineIndependent(instituciones),
      detail: cuenta(
        instituciones,
        'institución',
        'instituciones',
        'Opcional. Cada institución que elija confirma su vínculo con su sello oficial.',
      ),
      optional: true,
    }),
    paso({
      key: 'insurers',
      title: 'Seguros con los que trabaja',
      icon: 'heart',
      state: insurerRequests === null ? 'unknown' : combineIndependent(seguros),
      detail:
        insurerRequests === null
          ? 'No pudimos leer sus solicitudes a aseguradoras. Reintente en unos segundos.'
          : cuenta(
              seguros,
              'aseguradora',
              'aseguradoras',
              'Opcional. Pida trabajar con una aseguradora desde «Solicitudes enviadas».',
            ),
      optional: true,
    }),
  ];
}

/* ---- La bandeja ------------------------------------------------------------ */

/** Quién habla en una burbuja. `system` es la plataforma, no la otra parte. */
export type Speaker = 'me' | 'them' | 'system';

export interface ThreadMessage {
  readonly speaker: Speaker;
  readonly text: string;
  /** `null` cuando la API no dice cuándo pasó: no se inventa una hora. */
  readonly at: Date | null;
  /** Para las mías: enviada (una marca) o ya respondida (dos). */
  readonly ticks?: 'sent' | 'answered';
  /** El aviso trae el sello oficial o el rechazo. */
  readonly seal?: 'approved' | 'rejected';
}

export interface RequestThread {
  readonly id: string;
  readonly kind: 'institution' | 'insurer';
  readonly counterpart: string;
  readonly state: StatusSealVariant;
  readonly stateLabel: string;
  /** La última novedad, para ordenar la bandeja y mostrar la hora. */
  readonly lastAt: Date;
  /** La línea de vista previa, como en cualquier chat. */
  readonly preview: string;
  readonly messages: readonly ThreadMessage[];
  /** Lo que se puede hacer desde la conversación. */
  readonly canWithdraw: boolean;
  readonly canRequestAgain: boolean;
  /** La aseguradora del hilo, si lo es. */
  readonly carrierId?: string;
  /** La solicitud vigente del hilo (la última), la que se puede retirar. */
  readonly requestId?: string;
}

const THREAD_STATE_LABEL: Readonly<Record<StatusSealVariant, string>> = {
  approved: 'Confirmado',
  pending: 'Esperando respuesta',
  'in-review': 'En revisión',
  rejected: 'Rechazado',
  expired: 'Vencido',
  unknown: 'Sin sello',
};

/** El motivo que escribió la otra parte, en su voz; nada si no escribió. */
function conMotivo(texto: string | null, at: Date | null): ThreadMessage | null {
  const limpio = texto?.trim() ?? '';
  return limpio === '' ? null : { speaker: 'them', text: `«${limpio}»`, at };
}

/** Un vínculo con institución contado como conversación. */
export function institutionThread(a: PractitionerAffiliation): RequestThread {
  const state = affiliationState(a);
  const yo: ThreadMessage = {
    speaker: 'me',
    text: `Le pedí a ${a.organizationName} que confirme que trabajo ahí${
      a.roleTitle ? ` como ${a.roleTitle}` : ''
    }.`,
    at: a.createdAt,
    ticks: a.statusKind === 'pendiente' ? 'sent' : 'answered',
  };
  const respuesta: ThreadMessage = (() => {
    switch (a.statusKind) {
      case 'aprobado':
        return {
          speaker: 'system',
          text: `${a.organizationName} confirmó su vínculo: lleva su sello oficial y puede publicar su agenda ahí.`,
          at: null,
          seal: 'approved',
        } as const;
      case 'rechazado':
        return {
          speaker: 'system',
          text: `${a.organizationName} no aceptó el vínculo.`,
          at: null,
          seal: 'rejected',
        } as const;
      case 'revocado':
        return {
          speaker: 'system',
          text: `${a.organizationName} dio de baja el vínculo. Las citas que ya confirmó siguen en pie.`,
          at: null,
          seal: 'rejected',
        } as const;
      case 'declarado':
        return {
          speaker: 'system',
          text: 'Esta institución no tiene quién confirme vínculos: queda declarado por usted, sin sello.',
          at: null,
        } as const;
      default:
        return {
          speaker: 'system',
          text: `Esperando que ${a.organizationName} responda. Le avisamos cuando lo haga.`,
          at: null,
        } as const;
    }
  })();
  // Lo único que la institución escribió es su motivo: va en su voz, entre
  // comillas. Lo demás lo cuenta la plataforma, sin ponerlo en su boca.
  const suMotivo = conMotivo(a.decisionReasonText, null);
  return {
    id: `inst-${a.id}`,
    kind: 'institution',
    counterpart: a.organizationName,
    state,
    stateLabel: THREAD_STATE_LABEL[state],
    lastAt: a.createdAt,
    preview: suMotivo?.text ?? respuesta.text,
    messages: suMotivo ? [yo, respuesta, suMotivo] : [yo, respuesta],
    canWithdraw: false,
    canRequestAgain: false,
  };
}

/** La última solicitud de cada aseguradora: la que dice cómo está hoy. */
export function latestPerCarrier(requests: readonly InsurerRequest[]): readonly InsurerRequest[] {
  const ultima = new Map<string, InsurerRequest>();
  for (const r of requests) {
    const previa = ultima.get(r.carrierId);
    if (!previa || previa.createdAt < r.createdAt) ultima.set(r.carrierId, r);
  }
  return [...ultima.values()];
}

/** Lo que pasó con una solicitud, contado en mensajes. */
function intento(r: InsurerRequest, esLaUltima: boolean): ThreadMessage[] {
  const pedido: ThreadMessage = {
    speaker: 'me',
    text: `Le pedí a ${r.carrierName} trabajar como prestador de su red.`,
    at: r.createdAt,
    ticks: r.status === 'PENDING' || r.status === 'WITHDRAWN' ? 'sent' : 'answered',
  };
  switch (r.status) {
    case 'APPROVED':
      return [
        pedido,
        {
          speaker: 'system',
          text: `${r.carrierName} confirmó que trabaja con su red: su ficha lleva el sello oficial.`,
          at: r.decidedAt,
          seal: 'approved',
        },
      ];
    case 'REJECTED': {
      const suMotivo = conMotivo(r.decisionReasonText, r.decidedAt);
      return [
        pedido,
        {
          speaker: 'system',
          text: `${r.carrierName} no aceptó la solicitud.`,
          at: r.decidedAt,
          seal: 'rejected',
        },
        ...(suMotivo ? [suMotivo] : []),
      ];
    }
    case 'WITHDRAWN':
      return [pedido, { speaker: 'me', text: 'Retiré la solicitud.', at: r.decidedAt }];
    default:
      return esLaUltima
        ? [
            pedido,
            {
              speaker: 'system',
              text: `Esperando que ${r.carrierName} responda. Le avisamos cuando lo haga.`,
              at: null,
            },
          ]
        : [pedido];
  }
}

/**
 * Todas las solicitudes a una aseguradora, contadas como UNA conversación.
 *
 * Volver a pedir crea otra solicitud y la anterior queda en la API como
 * historia: el hilo las encadena de la más vieja a la más nueva, así que el
 * motivo de un rechazo sigue a la vista después de volver a pedir.
 */
export function insurerThread(requests: readonly InsurerRequest[]): RequestThread {
  const orden = [...requests].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const r = orden[orden.length - 1]!;
  const state = insurerState(r);
  const messages = orden.flatMap((x) => intento(x, x === r));
  const ultimo = messages[messages.length - 1]!;
  return {
    id: `ins-${r.carrierId}`,
    kind: 'insurer',
    counterpart: r.carrierName,
    state,
    stateLabel: r.status === 'WITHDRAWN' ? 'Retirada' : THREAD_STATE_LABEL[state],
    lastAt: r.decidedAt ?? r.createdAt,
    preview: ultimo.text,
    messages,
    canWithdraw: r.status === 'PENDING',
    canRequestAgain: r.status === 'REJECTED' || r.status === 'WITHDRAWN',
    carrierId: r.carrierId,
    requestId: r.id,
  };
}

/** Las solicitudes agrupadas por aseguradora, una conversación cada grupo. */
function porAseguradora(requests: readonly InsurerRequest[]): InsurerRequest[][] {
  const grupos = new Map<string, InsurerRequest[]>();
  for (const r of requests) grupos.set(r.carrierId, [...(grupos.get(r.carrierId) ?? []), r]);
  return [...grupos.values()];
}

/** La bandeja entera, de la novedad más reciente a la más vieja. */
export function buildThreads(
  affiliations: readonly PractitionerAffiliation[],
  insurerRequests: readonly InsurerRequest[],
): readonly RequestThread[] {
  return [
    ...institutionRequests(affiliations).map(institutionThread),
    ...porAseguradora(insurerRequests).map(insurerThread),
  ].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
