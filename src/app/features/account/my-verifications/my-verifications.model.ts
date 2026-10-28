import type {
  OwnPractitionerProfile,
  PractitionerAffiliation,
} from '../../../core/data-access/profiles/profiles.types';
import type { InsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import type { NavIconName } from '../../../shared/components/atoms/nav-icon/nav-icon.types';
import { sello } from '../my-profile/practitioner-profile/practitioner-profile';

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
): readonly RoadmapStep[] {
  const perfilEstado = sello(etiquetas, perfil.verificationStatusConceptId);
  const matriculas = perfil.licenses.map((l) => sello(etiquetas, l.stateConceptId));
  const titulos = perfil.credentials.map((c): StatusSealVariant =>
    c.verifiedAt === undefined ? 'pending' : 'approved',
  );
  const especialidades = perfil.specialties
    .filter((s) => s.validTo === undefined)
    .map((s): StatusSealVariant => (s.verified ? 'approved' : 'pending'));
  // Sólo los que se pidieron y alguien puede confirmar: un declarado no
  // espera nada, y contarlo como pendiente sería prometer un sello que no
  // va a llegar.
  const instituciones = institutionRequests(perfil.affiliations)
    .filter((a) => a.statusKind !== 'declarado')
    .map(affiliationState);
  const seguros = (insurerRequests ?? []).filter((r) => r.status !== 'WITHDRAWN').map(insurerState);

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
      state: combineStates(instituciones),
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
      state: insurerRequests === null ? 'unknown' : combineStates(seguros),
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

/**
 * La misma hoja de ruta en el indicador de avance: hecho, el que toca, lo que
 * viene. El primer tramo obligatorio sin verificar es el actual; si están
 * todos, el primero opcional que espere algo.
 */
export function roadmapStepper(steps: readonly RoadmapStep[]): readonly StepperStep[] {
  const abierto = (s: RoadmapStep) => s.state !== 'approved' && s.state !== 'not-started';
  const actual =
    steps.find((s) => !s.optional && s.state !== 'approved') ?? steps.find((s) => abierto(s));
  return steps.map((s) => ({
    label: s.title,
    icon: s.icon,
    status: s.state === 'approved' ? 'complete' : s === actual ? 'current' : 'upcoming',
  }));
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
  /** La burbuja que trae el sello oficial. */
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
  /** La solicitud a aseguradora detrás del hilo, si lo es. */
  readonly carrierId?: string;
}

const THREAD_STATE_LABEL: Readonly<Record<StatusSealVariant, string>> = {
  approved: 'Confirmado',
  pending: 'Esperando respuesta',
  'in-review': 'En revisión',
  rejected: 'Rechazado',
  expired: 'Vencido',
  unknown: 'Sin sello',
};

function motivo(texto: string | null): string {
  return texto === null || texto.trim() === '' ? '' : ` Motivo: «${texto.trim()}».`;
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
          speaker: 'them',
          text: 'Confirmamos su vínculo. Desde ahora lleva nuestro sello oficial y puede publicar su agenda con nosotros.',
          at: null,
          seal: 'approved',
        } as const;
      case 'rechazado':
        return {
          speaker: 'them',
          text: `No aceptamos el vínculo.${motivo(a.decisionReasonText)}`,
          at: null,
          seal: 'rejected',
        } as const;
      case 'revocado':
        return {
          speaker: 'them',
          text: `Dimos de baja el vínculo. Las citas que ya confirmó siguen en pie.${motivo(a.decisionReasonText)}`,
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
  return {
    id: `inst-${a.id}`,
    kind: 'institution',
    counterpart: a.organizationName,
    state,
    stateLabel: THREAD_STATE_LABEL[state],
    lastAt: a.createdAt,
    preview: respuesta.text,
    messages: [yo, respuesta],
    canWithdraw: false,
    canRequestAgain: false,
  };
}

/** Una solicitud a aseguradora contada como conversación. */
export function insurerThread(r: InsurerRequest): RequestThread {
  const state = insurerState(r);
  const messages: ThreadMessage[] = [
    {
      speaker: 'me',
      text: `Le pedí a ${r.carrierName} trabajar como prestador de su red.`,
      at: r.createdAt,
      ticks: r.status === 'PENDING' || r.status === 'WITHDRAWN' ? 'sent' : 'answered',
    },
  ];
  switch (r.status) {
    case 'APPROVED':
      messages.push({
        speaker: 'them',
        text: 'Confirmamos que trabaja con nosotros. Su ficha lleva nuestro sello oficial.',
        at: r.decidedAt,
        seal: 'approved',
      });
      break;
    case 'REJECTED':
      messages.push({
        speaker: 'them',
        text: `No aceptamos la solicitud.${motivo(r.decisionReasonText)}`,
        at: r.decidedAt,
        seal: 'rejected',
      });
      break;
    case 'WITHDRAWN':
      messages.push({ speaker: 'me', text: 'Retiré la solicitud.', at: null });
      break;
    default:
      messages.push({
        speaker: 'system',
        text: `Esperando que ${r.carrierName} responda. Le avisamos cuando lo haga.`,
        at: null,
      });
  }
  const ultimo = messages[messages.length - 1]!;
  return {
    id: `ins-${r.id}`,
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
  };
}

/** La bandeja entera, de la novedad más reciente a la más vieja. */
export function buildThreads(
  affiliations: readonly PractitionerAffiliation[],
  insurerRequests: readonly InsurerRequest[],
): readonly RequestThread[] {
  return [
    ...institutionRequests(affiliations).map(institutionThread),
    ...insurerRequests.map(insurerThread),
  ].sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
}
