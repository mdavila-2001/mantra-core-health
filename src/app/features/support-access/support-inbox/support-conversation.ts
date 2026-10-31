import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';

import { AccessChallengeCancelledError, withAccessChallenge, type ChallengeRequestOptions } from '../../../core/access-challenge/access-challenge';
import { CommunityClient } from '../../../core/data-access/community/community.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { ConversationAssignmentStatus, ReplyTemplate, SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { conversationActions, needsDerivation } from './conversation-model';
import { ConversationTimeline } from './conversation-timeline';
import { failureMessage } from './failure-message';
import { ownerText, slaOf, statusText, type SlaState } from './inbox-model';
import { ReplyComposer } from './reply-composer';

type Accion = 'take' | 'release' | 'assign' | 'derive' | 'resolve' | 'reopen' | 'send' | 'note' | 'access';

/**
 * Por qué un correo pedido no salió. `skippedReason` ya es una frase de la API («La cuenta del paciente
 * no tiene un correo verificado con credencial activa»): se muestra tal cual, sin traducir códigos
 * que la API no emite. La respuesta por el chat salió igual.
 */
export function emailSkippedText(skippedReason: string | undefined): string {
  const motivo = (skippedReason ?? '').trim().replace(/[.\s]+$/, '');
  return motivo === '' ? 'El correo no se envió; la respuesta salió por el chat.' : `El correo no se envió: ${motivo}. La respuesta salió por el chat.`;
}

/** El texto con que se avisa que a la conversación ya no se llega (404 uniforme). */
const CONVERSACION_AUSENTE = 'Esta conversación ya no está en su bandeja: puede que ya no tenga acceso a las conversaciones de este doctor o que haya cambiado quién las atiende. Vuelva a la bandeja.';

/**
 * Una **conversación** de la bandeja: lo que escribió el paciente, lo que se
 * respondió en nombre del doctor (con la autora real), las notas internas y lo
 * que se puede hacer con ella.
 *
 * Cada acción se pide a la API y **se vuelve a leer la conversación**: lo que
 * se ve es lo que quedó guardado, no lo que se tocó. Si otra persona ya la
 * tomó, la API responde 409 y la pantalla lo dice con el nombre de quien la
 * tiene; la regla no está solo acá.
 *
 * El motivo de consulta es lo único clínico que se ve. Para más hay que pedir
 * al doctor un acceso temporal, paciente por paciente (caso 10): lo decide él.
 */
@Component({
  selector: 'app-support-conversation',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    ConversationTimeline,
    FormField,
    ReplyComposer,
    RouterLink,
    Select,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './support-conversation.html',
  styleUrl: './support-conversation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportConversationView {
  private readonly support = inject(SupportAccessClient);
  private readonly community = inject(CommunityClient);
  private readonly toasts = inject(ToastService);

  readonly conversationId = input.required<string>();
  /** La organización (tenant) de la bandeja: la API aísla por ella. */
  readonly org = input.required<string>();
  readonly now = input<Date>(new Date());

  /** Algo cambió (tomada, derivada, respondida…): la lista debe volver a leerse. */
  readonly changed = output<void>();
  /** En pantallas angostas, volver a la lista. */
  readonly closed = output<void>();

  private readonly compositor = viewChild(ReplyComposer);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  /** Al abrir una conversación el foco pasa a su título: en pantallas angostas la lista deja de verse. */
  private foco = false;

  protected readonly state = signal<ViewState<SupportConversation>>(loading());
  protected readonly templates = signal<readonly ReplyTemplate[]>([]);
  protected readonly busy = signal<Accion | null>(null);
  protected readonly actionFailure = signal<string | null>(null);
  protected readonly composerFailure = signal<string | null>(null);
  protected readonly announcement = signal('');
  protected readonly assignTo = signal<string | null>(null);
  protected readonly askingAccess = signal(false);
  protected readonly accessReason = signal('');

  protected readonly conversation = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly actions = computed(() => {
    const c = this.conversation();
    return c === null ? null : conversationActions(c);
  });
  protected readonly needsDerivation = computed(() => {
    const c = this.conversation();
    return c !== null && needsDerivation(c);
  });
  protected readonly assignOptions = computed<readonly SelectOption<string>[]>(() =>
    (this.conversation()?.assignableTo ?? []).map((p) => ({ value: p.userId, label: p.name })),
  );
  protected readonly sla = computed<SlaState>(() => {
    const c = this.conversation();
    return c === null ? { kind: 'none' } : slaOf(c, this.now());
  });

  protected readonly owner = ownerText;
  protected readonly status = statusText;

  constructor() {
    effect(() => {
      this.conversationId();
      this.org();
      untracked(() => {
        this.actionFailure.set(null);
        this.composerFailure.set(null);
        this.askingAccess.set(false);
        this.assignTo.set(null);
        this.load(false);
      });
    });
    afterRenderEffect(() => {
      const titulo = this.titulo();
      if (titulo === undefined || !this.foco) return;
      this.foco = false;
      titulo.nativeElement.focus({ preventScroll: true });
    });
    effect(() => {
      const org = this.org();
      untracked(() =>
        this.support.listReplyTemplates(org).subscribe({
          next: ({ items }) => this.templates.set(items),
          // Sin plantillas se puede responder igual: no es motivo para tapar la conversación.
          error: () => this.templates.set([]),
        }),
      );
    });
  }

  /** `silent`: releer sin tapar lo que ya se ve con el esqueleto de carga. */
  protected load(silent: boolean): void {
    if (!silent) {
      this.state.set(loading());
      this.foco = true;
    }
    this.support.getSupportConversation(this.conversationId(), this.org()).subscribe({
      next: (conversation) => this.state.set(ready(conversation)),
      error: (failure: unknown) => this.state.set(errorToViewState<SupportConversation>(failure)),
    });
  }

  /**
   * Lo que la API puede pedir antes de dejar hacer algo (motivo, segundo paso, aprobación) se resuelve en un diálogo y se
   * **reintenta la misma petición**. Si la persona lo cierra, no se hizo nada: no es un error.
   */
  private challenge(c: SupportConversation, atom: string, actionLabel: string): ChallengeRequestOptions {
    return { context: withAccessChallenge({ actionLabel, approval: { tenantId: c.organizationId, atom } }) };
  }

  private cancelled(failure: unknown, queHacia: string): string | null {
    return failure instanceof AccessChallengeCancelledError ? `No se ${queHacia}: usted canceló el paso adicional que se pedía.` : null;
  }

  /* ---- asignación -------------------------------------------------------------- */

  private change(c: SupportConversation, status: ConversationAssignmentStatus, accion: Accion, done: string, assignedUserId?: string): void {
    if (this.busy() !== null) return;
    this.busy.set(accion);
    this.actionFailure.set(null);
    this.support
      .assignConversation(
        c.conversationId,
        { practitionerProfileId: c.practitionerProfileId, status, ...(assignedUserId === undefined ? {} : { assignedUserId }) },
        this.challenge(c, 'messages.conversation.assign', done),
      )
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.announcement.set(done);
          this.toasts.success(done);
          this.load(true);
          this.changed.emit();
        },
        error: (failure: unknown) => {
          this.busy.set(null);
          this.actionFailure.set(this.cancelled(failure, 'cambió la conversación') ?? failureMessage(failure));
          // Si otra persona se adelantó, lo que se ve ya no es verdad: releer.
          this.load(true);
          this.changed.emit();
        },
      });
  }

  protected take(c: SupportConversation): void {
    this.change(c, 'TAKEN', 'take', 'Conversación tomada.');
  }

  protected release(c: SupportConversation): void {
    this.change(c, 'NEW', 'release', 'Conversación liberada.');
  }

  protected assign(c: SupportConversation): void {
    const destino = this.assignTo();
    if (destino === null) return;
    this.change(c, 'TAKEN', 'assign', 'Conversación asignada.', destino);
  }

  protected derive(c: SupportConversation): void {
    this.change(c, 'WAITING_DOCTOR', 'derive', `Derivada a ${c.practitionerName}: queda esperando su respuesta.`);
  }

  protected resolve(c: SupportConversation): void {
    this.change(c, 'RESOLVED', 'resolve', 'Conversación resuelta.');
  }

  protected reopen(c: SupportConversation): void {
    this.change(c, 'TAKEN', 'reopen', 'Conversación reabierta.');
  }

  /* ---- responder y anotar ---------------------------------------------------------- */

  protected reply(c: SupportConversation, text: string, porCorreo = false): void {
    if (this.busy() !== null) return;
    this.busy.set('send');
    this.composerFailure.set(null);
    // El remitente es el doctor: el paciente lo ve a él. Los dos campos llevan su perfil **público**
    // (`doctorPublicProfileId`), no el profesional: con el profesional la API rechaza el envío
    // porque quien manda no es participante de la conversación. `onBehalfOfProfileId` es lo que la
    // API comprueba (permiso, aceptación del doctor) y lo que guarda a la autora real.
    this.community
      .sendMessage(c.conversationId, {
        senderProfileId: c.doctorPublicProfileId,
        bodyText: text,
        onBehalfOfProfileId: c.doctorPublicProfileId,
        ...(porCorreo ? { channels: ['CHAT', 'EMAIL'] as const } : {}),
      }, this.challenge(c, 'messages.conversation.reply_on_behalf', `Responder a ${c.patientLabel} como ${c.practitionerName}`))
      .subscribe({
        next: (enviado) => {
          this.busy.set(null);
          this.compositor()?.clear();
          const correo = enviado.email === undefined ? '' : enviado.email.queued ? ' El correo quedó en cola.' : ` ${emailSkippedText(enviado.email.skippedReason)}`;
          this.announcement.set(`Respuesta enviada como ${c.practitionerName}.${correo}`);
          this.toasts.success(`Enviada como ${c.practitionerName}.${correo}`, 'Respuesta enviada');
          this.load(true);
          this.changed.emit();
        },
        error: (failure: unknown) => {
          this.busy.set(null);
          // 404 `CONVERSATION_NOT_FOUND`: la API repite la lectura de la bandeja al responder. Si ya no
          // aparece en ella, lo que se ve dejó de ser verdad: se explica, se relee y la lista se actualiza.
          const ausente = failure instanceof HttpErrorResponse && failure.status === 404;
          const cancelado = this.cancelled(failure, 'envió la respuesta');
          this.composerFailure.set(cancelado !== null ? `${cancelado} Lo escrito sigue acá.` : ausente ? CONVERSACION_AUSENTE : failureMessage(failure, 'No pudimos enviar la respuesta. Lo escrito sigue acá.'));
          if (ausente) this.toasts.error(CONVERSACION_AUSENTE, 'La conversación ya no está');
          this.load(true);
          if (ausente) this.changed.emit();
        },
      });
  }

  protected addNote(c: SupportConversation, text: string): void {
    if (this.busy() !== null) return;
    this.busy.set('note');
    this.composerFailure.set(null);
    this.support.addInternalNote(c.conversationId, { bodyText: text }, this.challenge(c, 'messages.note.create_internal', 'Guardar una nota interna')).subscribe({
      next: () => {
        this.busy.set(null);
        this.compositor()?.clear();
        this.announcement.set('Nota interna guardada.');
        this.load(true);
      },
      error: (failure: unknown) => {
        this.busy.set(null);
        const cancelado = this.cancelled(failure, 'guardó la nota');
        this.composerFailure.set(cancelado !== null ? `${cancelado} Lo escrito sigue acá.` : failureMessage(failure, 'No pudimos guardar la nota. Lo escrito sigue acá.'));
      },
    });
  }

  /* ---- acceso clínico temporal (caso 10) ---------------------------------------------- */

  protected requestAccess(c: SupportConversation): void {
    const contexto = c.patientContext;
    const motivo = this.accessReason().trim();
    // La API pide el paciente: sin ficha de paciente no hay a quién pedirle el acceso (la pantalla no ofrece el botón).
    if (this.busy() !== null || contexto.patientProfileId === undefined || motivo.length < 5) return;
    this.busy.set('access');
    this.actionFailure.set(null);
    this.support
      .requestClinicalAccess({ tenantId: c.organizationId, practitionerProfileId: c.practitionerProfileId, patientProfileId: contexto.patientProfileId, reasonText: motivo })
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.askingAccess.set(false);
          this.accessReason.set('');
          this.announcement.set(`Pedido enviado a ${c.practitionerName}: él decide.`);
          this.toasts.success(`${c.practitionerName} decide si lo autoriza.`, 'Pedido enviado');
          this.load(true);
        },
        error: (failure: unknown) => {
          this.busy.set(null);
          this.actionFailure.set(failureMessage(failure));
        },
      });
  }
}
