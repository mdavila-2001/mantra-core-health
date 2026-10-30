import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';

import type {
  CreateInformedConsentInput,
  InformedConsent,
  InformedConsentTargetType,
} from '../../../../core/data-access/informed-consents/informed-consents.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { InformedConsentPanel } from './informed-consent-panel';
import { TARGET_NAME } from './informed-consent.texts';

/**
 * El panel de consentimiento dentro del modal del sistema, para abrirlo desde
 * la acción «Consentimiento informado» de un ítem (receta, orden, cirugía,
 * plan, derivación).
 *
 * Es modal por la regla de la casa (composition-rules §6): una acción de
 * fila que pide datos no se despliega dentro de la fila. Con algo escrito,
 * cerrar pregunta antes de descartarlo.
 *
 * Se apila sin problema sobre otro `app-content-dialog` (el alta del
 * expediente): son `<dialog>` nativos con `showModal()`.
 */
@Component({
  selector: 'app-informed-consent-dialog',
  imports: [ContentDialog, InformedConsentPanel],
  template: `
    <app-content-dialog
      #dialogo
      [heading]="titulo()"
      description="Lo que se le explicó, quién decide y qué decidió."
      size="xl"
      closeLabel="Cerrar"
      data-testid="consent-dialog"
      [dismissible]="!(panel()?.tieneCambiosPendientes() ?? false)"
      (dismissAttempt)="pedirDescarte()"
      (closed)="closed.emit()"
    >
      <app-informed-consent-panel
        [patientProfileId]="patientProfileId()"
        [encounterId]="encounterId()"
        [targetType]="targetType()"
        [targetId]="targetId()"
        [targetLabel]="targetLabel()"
        [defaults]="defaults()"
        (consentChanged)="consentChanged.emit($event)"
      />
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformedConsentDialog {
  private readonly dialogs = inject(DialogService);

  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  readonly targetType = input.required<InformedConsentTargetType>();
  readonly targetId = input.required<string>();
  readonly targetLabel = input.required<string>();
  readonly defaults = input<Partial<CreateInformedConsentInput>>({});

  readonly consentChanged = output<InformedConsent | null>();
  readonly closed = output<void>();

  protected readonly panel = viewChild(InformedConsentPanel);
  private readonly dialogo = viewChild<ContentDialog>('dialogo');

  protected readonly titulo = computed(
    () => `Consentimiento informado · ${TARGET_NAME[this.targetType()]}`,
  );

  protected async pedirDescarte(): Promise<void> {
    if (await this.dialogs.confirmarDescarte()) this.dialogo()?.close(true);
  }
}
