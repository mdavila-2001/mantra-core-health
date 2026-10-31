import { type DelegateReplyDisclosure } from '../../../core/data-access/support-access/support-access.types';
import { REPLY_TEMPLATE_CATEGORIES, REPLY_TEMPLATE_CATEGORY_LABELS, type ReplyTemplate, type ReplyTemplateCategory, type SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';

/**
 * Las reglas de la **conversación** de la bandeja, sin pantalla: qué dice el
 * aviso de «respondes como», si se puede enviar, cuál es el botón principal,
 * qué acciones hay y cómo se completa una plantilla.
 *
 * Nada de esto autoriza: la API repite cada regla en la petición (403, 409,
 * 422). Acá solo se evita ofrecer lo que ya se sabe que va a fallar, y se dice
 * por qué.
 */

/** Lo mínimo de la conversación que estas reglas miran. */
type Estado = Pick<SupportConversation, 'status' | 'isClinical' | 'assignedToMe' | 'assignedToName' | 'assignableTo'>;

/* ---- el aviso permanente -------------------------------------------------------- */

/**
 * El aviso fijo de arriba del compositor: en nombre de quién se responde, qué ve
 * el paciente y que la autora queda registrada. Lo que ve el paciente depende
 * de la configuración del **doctor**, no de quien responde.
 */
export function onBehalfNotice(doctorName: string, disclosure: DelegateReplyDisclosure): string {
  const lo_que_ve_el_paciente =
    disclosure === 'SHOW'
      ? 'El paciente verá «respondido por su equipo».'
      : 'El paciente no verá que respondió su equipo, así lo configuró el doctor.';
  return `Está respondiendo como ${doctorName}. ${lo_que_ve_el_paciente} Su nombre queda registrado como autora.`;
}

/* ---- qué se puede hacer ---------------------------------------------------------- */

/** Por qué no se puede enviar ahora, o `null` si se puede. */
export type SendBlock = 'OWNED_BY_OTHER' | 'CLINICAL';

export interface ReplyRule {
  readonly canSend: boolean;
  readonly block: SendBlock | null;
  /** La frase que explica el bloqueo, para quien no puede enviar. */
  readonly reason: string | null;
  /** El botón principal: enviar, o derivar cuando el mensaje es clínico. */
  readonly primary: 'SEND' | 'DERIVE';
}

/** Hay un mensaje clínico del paciente que todavía no está en manos del doctor. */
export function needsDerivation(c: Pick<SupportConversation, 'status' | 'isClinical'>): boolean {
  return c.isClinical && c.status !== 'WAITING_DOCTOR';
}

export function replyRule(c: Estado): ReplyRule {
  const primary: ReplyRule['primary'] = needsDerivation(c) ? 'DERIVE' : 'SEND';
  // Ya no hay un estado «sin permiso de responder»: la API solo muestra la conversación a quien puede
  // responder por el doctor (`replyAllowed` es siempre verdadero), y a los demás les dice 404.
  const tieneOtra = c.status !== 'NEW' && c.status !== 'RESOLVED' && !c.assignedToMe;
  if (tieneOtra) {
    return { canSend: false, block: 'OWNED_BY_OTHER', reason: `${c.assignedToName ?? 'Otra persona del equipo'} tiene esta conversación. Solo quien la tiene responde.`, primary };
  }
  if (needsDerivation(c)) {
    return {
      canSend: false,
      block: 'CLINICAL',
      reason: 'El mensaje del paciente es clínico. Solo el doctor puede responder su contenido: derívelo.',
      primary,
    };
  }
  return { canSend: true, block: null, reason: null, primary };
}

export interface ConversationActions {
  readonly take: boolean;
  readonly assign: boolean;
  readonly release: boolean;
  readonly derive: boolean;
  readonly resolve: boolean;
  readonly reopen: boolean;
}

/** Las acciones sobre la conversación que tienen sentido en su estado y según quién la tiene. */
export function conversationActions(c: Estado): ConversationActions {
  const libre = c.status === 'NEW';
  const mia = c.assignedToMe && (c.status === 'TAKEN' || c.status === 'WAITING_DOCTOR');
  return {
    take: libre,
    assign: (libre || mia) && c.assignableTo.length > 1,
    release: c.status === 'TAKEN' && c.assignedToMe,
    derive: (libre || (c.status === 'TAKEN' && c.assignedToMe)),
    resolve: mia,
    reopen: c.status === 'RESOLVED',
  };
}

/* ---- plantillas -------------------------------------------------------------------- */

export interface TemplateGroup {
  readonly category: ReplyTemplateCategory;
  readonly label: string;
  readonly items: readonly ReplyTemplate[];
}

/** Las plantillas por categoría, en el orden fijo de las categorías y sin grupos vacíos. */
export function groupTemplates(templates: readonly ReplyTemplate[]): readonly TemplateGroup[] {
  return REPLY_TEMPLATE_CATEGORIES.map((category) => ({
    category,
    label: REPLY_TEMPLATE_CATEGORY_LABELS[category],
    items: templates.filter((t) => t.category === category),
  })).filter((g) => g.items.length > 0);
}

/** El primer nombre de un rótulo de paciente («Ana Lucía Pérez» → «Ana»). Tolera un rótulo con el documento detrás de un «·». */
export function patientFirstName(patientLabel: string): string {
  const nombre = patientLabel.split('·')[0]!.trim().split(/\s+/)[0] ?? '';
  return nombre === '' ? 'paciente' : nombre;
}

/** Completa `{paciente}` y `{doctor}` en una plantilla. Lo desconocido queda como está. */
export function applyTemplate(body: string, values: { readonly patientLabel: string; readonly doctorName: string }): string {
  return body.replaceAll('{paciente}', patientFirstName(values.patientLabel)).replaceAll('{doctor}', values.doctorName);
}

/** Agrega una plantilla al texto que ya hay, en una línea aparte si hacía falta. */
export function appendDraft(current: string, addition: string): string {
  const base = current.trimEnd();
  return base === '' ? addition : `${base}\n${addition}`;
}
