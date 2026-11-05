import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';

import type { ReplyTemplate, SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { appendDraft, applyTemplate, groupTemplates, onBehalfNotice, replyRule } from './conversation-model';

type Modo = 'REPLY' | 'NOTE';

const MODOS: readonly SegmentedOption<Modo>[] = [
  { value: 'REPLY', label: 'Responder', description: 'Responder al paciente' },
  { value: 'NOTE', label: 'Nota interna', description: 'Nota interna: solo la ve el equipo' },
];

/**
 * El compositor de la conversación: responder **como el doctor**, o dejar una
 * nota interna que el paciente nunca ve.
 *
 * - Arriba, **siempre**, el aviso de «Está respondiendo como Dr. X»: qué verá el
 *   paciente y que la autora queda registrada.
 * - El botón principal dice «Enviar como Dr. X». Si el mensaje del paciente es
 *   **clínico**, el principal pasa a ser «Derivar al doctor» y enviar no está
 *   disponible hasta que se derive: el equipo no responde contenido clínico.
 * - Si el paciente tiene correo, se puede mandar **también por correo**: le llega a nombre
 *   del doctor, y el compositor lo avisa antes de enviar. El correo solo sale al responder en
 *   nombre del doctor, nunca con una nota interna.
 * - Las plantillas se agrupan por categoría y completan el nombre del paciente
 *   y del doctor; se pueden editar antes de enviar.
 *
 * No habla con la API: avisa lo que se quiere hacer y su dueño lo ejecuta. El
 * borrador se conserva si falla, para no perder lo escrito.
 */
@Component({
  selector: 'app-reply-composer',
  imports: [Alert, AppButton, FormField, SegmentedControl, Switch, Textarea],
  templateUrl: './reply-composer.html',
  styleUrl: './reply-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplyComposer {
  readonly conversation = input.required<SupportConversation>();
  readonly templates = input.required<readonly ReplyTemplate[]>();
  /** Una petición en vuelo: frena los botones y se avisa en el principal. */
  readonly busy = input(false);
  /** Lo que salió mal en el último intento, dicho por la API. */
  readonly failure = input<string | null>(null);

  readonly send = output<string>();
  /** Responder **y** mandar el mismo texto por correo al paciente, a nombre del doctor. */
  readonly sendWithEmail = output<string>();
  readonly derive = output<void>();
  readonly note = output<string>();

  protected readonly modos = MODOS;
  protected readonly modo = signal<Modo>('REPLY');
  protected readonly borrador = signal('');
  protected readonly abiertas = signal(false);
  /** Si además del chat se manda por correo. Cada respuesta lo decide: no queda marcado para la siguiente. */
  protected readonly porCorreo = signal(false);

  private readonly idDeConversacion = computed(() => this.conversation().conversationId);
  protected readonly regla = computed(() => replyRule(this.conversation()));
  protected readonly aviso = computed(() => onBehalfNotice(this.conversation().practitionerName, this.conversation().replyDisclosure));
  protected readonly grupos = computed(() => groupTemplates(this.templates()));
  protected readonly enNota = computed(() => this.modo() === 'NOTE');
  protected readonly puedeDerivar = computed(() => {
    const c = this.conversation();
    return c.status === 'NEW' || (c.status === 'TAKEN' && c.assignedToMe);
  });
  /** El campo se bloquea solo al responder; la nota interna siempre se puede escribir. */
  protected readonly campoBloqueado = computed(() => !this.enNota() && !this.regla().canSend);
  protected readonly vacio = computed(() => this.borrador().trim() === '');
  protected readonly principalEsDerivar = computed(() => !this.enNota() && this.regla().primary === 'DERIVE');

  constructor() {
    // Cambiar de conversación empieza un borrador nuevo; recargar la misma, no.
    effect(() => {
      this.idDeConversacion();
      untracked(() => {
        this.borrador.set('');
        this.modo.set('REPLY');
        this.abiertas.set(false);
        this.porCorreo.set(false);
      });
    });
  }

  protected usarPlantilla(plantilla: ReplyTemplate): void {
    const c = this.conversation();
    const texto = applyTemplate(plantilla.bodyText, { patientLabel: c.patientLabel, doctorName: c.practitionerName });
    this.borrador.update((actual) => appendDraft(actual, texto));
    this.abiertas.set(false);
  }

  protected enviar(): void {
    const texto = this.borrador().trim();
    if (texto === '' || this.busy()) return;
    if (this.enNota()) this.note.emit(texto);
    else if (this.regla().canSend) (this.porCorreo() ? this.sendWithEmail : this.send).emit(texto);
  }

  protected derivar(): void {
    if (!this.busy()) this.derive.emit();
  }

  /** El que llama limpia el borrador al terminar bien. */
  clear(): void {
    this.borrador.set('');
    this.porCorreo.set(false);
  }
}
