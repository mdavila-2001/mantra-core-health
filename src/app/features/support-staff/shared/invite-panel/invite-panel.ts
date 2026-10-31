import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { SupportStaffClient } from '../../../../core/data-access/support-staff/support-staff.client';
import type { SupportCatalog, SupportLinksCreated } from '../../../../core/data-access/support-staff/support-staff.types';
import { soloLetrasYNumeros } from '../../../../shared/forms/input-filters';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { supportFailureMessage } from '../support-failure';
import {
  EMPTY_SELECTION,
  isEmptySelection,
  SupportTargetPicker,
  targetsOf,
  type TargetSelection,
} from '../target-picker/target-picker';

/** El mismo patrón que el documento del alta (`IDENTITY_DOCUMENT_PATTERN`): letras y números. */
const DOCUMENTO = /^[A-Za-z0-9]{4,20}$/;

/**
 * **El hospital invita a su secretaria**: su documento y con qué doctores y en qué
 * pisos va a trabajar (`POST /org/team/invitations`). Cada doctor y cada piso es
 * un vínculo que nace pendiente: la secretaria lo acepta en «Mi trabajo de
 * apoyo», y hasta entonces no ve nada.
 */
@Component({
  selector: 'app-support-invite-panel',
  imports: [Alert, AnnounceOnAppear, AppButton, AppInput, FormField, SupportTargetPicker],
  template: `
    <div class="invite">
      <p class="invite__intro">
        Escriba el documento de su secretaria —tiene que haber creado su cuenta de personal de apoyo— y elija
        con qué doctores y en qué pisos va a trabajar. Ella acepta cada uno.
      </p>
      <app-form-field label="Documento de la secretaria" [required]="true" class="invite__field">
        <app-input
          testId="apoyo-invitar-documento"
          placeholder="1234567"
          autocomplete="off"
          [inputFilter]="soloAlfanumerico"
          [value]="nationalId()"
          [hasError]="documentoInvalido()"
          (valueChange)="nationalId.set(($event ?? '').toString())"
        />
      </app-form-field>
      <app-support-target-picker
        [catalog]="catalog()"
        [selection]="selection()"
        (selectionChange)="selection.set($event)"
        [disabled]="sending()"
      />
      <div class="invite__acciones">
        <button
          app-button
          type="button"
          [isLoading]="sending()"
          [disabled]="!canSend()"
          data-testid="apoyo-invitar-enviar"
          (clicked)="send()"
        >
          Enviar invitación
        </button>
      </div>
      @if (error(); as mensaje) {
        <app-alert appAnuncio tone="error" data-testid="apoyo-invitar-error">{{ mensaje }}</app-alert>
      }
      @if (sent(); as invitacion) {
        <app-alert appAnuncio tone="success" data-testid="apoyo-invitar-ok">
          Invitación enviada: {{ invitacion.items.length }} {{ invitacion.items.length === 1 ? 'vínculo espera' : 'vínculos esperan' }}
          que la secretaria acepte.
        </app-alert>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .invite {
      display: grid;
      gap: var(--sp-4);
    }
    .invite__intro {
      margin: 0;
      color: var(--text-secondary);
    }
    .invite__field {
      max-inline-size: 100%;
    }
    .invite__acciones {
      display: flex;
      justify-content: flex-end;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportInvitePanel {
  private readonly client = inject(SupportStaffClient);

  readonly catalog = input.required<SupportCatalog>();
  readonly invited = output<SupportLinksCreated>();

  protected readonly soloAlfanumerico = soloLetrasYNumeros;
  protected readonly nationalId = signal('');
  protected readonly selection = signal<TargetSelection>(EMPTY_SELECTION);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sent = signal<SupportLinksCreated | null>(null);

  protected readonly documentoInvalido = computed(() => {
    const valor = this.nationalId().trim();
    return valor !== '' && !DOCUMENTO.test(valor);
  });
  protected readonly canSend = computed(
    () => DOCUMENTO.test(this.nationalId().trim()) && !isEmptySelection(this.selection()) && !this.sending(),
  );

  protected send(): void {
    if (!this.canSend()) return;
    this.sending.set(true);
    this.error.set(null);
    this.sent.set(null);
    this.client
      .inviteToOrganization({ nationalId: this.nationalId().trim(), items: targetsOf(this.selection()) })
      .subscribe({
        next: (created) => {
          this.sending.set(false);
          this.sent.set(created);
          this.nationalId.set('');
          this.selection.set(EMPTY_SELECTION);
          this.invited.emit(created);
        },
        error: (failure: unknown) => {
          this.sending.set(false);
          this.error.set(supportFailureMessage(failure));
        },
      });
  }
}
