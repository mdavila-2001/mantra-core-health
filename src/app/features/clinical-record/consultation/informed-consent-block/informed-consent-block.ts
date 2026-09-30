import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { ConsentClient } from '../../../../core/data-access/consent/consent.client';
import type {
  MyTreatmentConsent,
  TreatmentDecision,
} from '../../../../core/data-access/consent/consent.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';

/** Las dos decisiones posibles del paciente, con las palabras de la consulta. */
const DECISIONES: readonly SelectOption<TreatmentDecision>[] = [
  { value: 'ACCEPTED', label: 'La persona acepta el tratamiento' },
  { value: 'DECLINED', label: 'La persona rechaza el tratamiento' },
];

/**
 * **Consentimiento informado del encuentro** (BR-20 · CL-77).
 *
 * Antes el consentimiento informado de un tratamiento era un formulario más de
 * `forms`, sin firma ni vínculo al procedimiento, y `consent.
 * treatment_informed_consents` —la tabla que el modelo declara para esto— quedaba
 * vacía. Este bloque lo registra donde el modelo lo espera:
 * `POST /consent/encounters/:encounterId/informed-consent`. El paciente y la
 * organización salen del **encuentro**, no de lo que se escriba acá, y el
 * paciente lo ve después en «Mi privacidad».
 *
 * Los valores ya capturados como formulario **no se reescriben**: lo nuevo va a
 * `consent` y lo viejo se lee como está.
 *
 * Sin encuentro en curso no hay a qué ligarlo, y el bloque lo dice.
 */
@Component({
  selector: 'app-informed-consent-block',
  imports: [Alert, AppInput, Card, DatePipe, FormActions, FormField, Select],
  templateUrl: './informed-consent-block.html',
  styleUrl: './informed-consent-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InformedConsentBlock {
  private readonly consent = inject(ConsentClient);
  private readonly toasts = inject(ToastService);

  /** El encuentro en curso. Sin él no se puede registrar. */
  readonly encounterId = input<string | null>(null);

  /** Se registró uno: la consulta puede releer lo que necesite. */
  readonly cambio = output<void>();

  protected readonly opciones = DECISIONES;
  protected readonly decision = signal<TreatmentDecision | null>(null);
  protected readonly versionDeInformacion = signal<string | number | null>('');

  protected readonly registrados = signal<readonly MyTreatmentConsent[]>([]);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly puedeRegistrar = computed(
    () => this.encounterId() !== null && this.decision() !== null && !this.guardando(),
  );

  constructor() {
    // Se relee cada vez que cambia el encuentro: lo que se muestra es lo que
    // el servidor tiene, no lo que se escribió en esta pantalla.
    effect(() => {
      const encuentro = this.encounterId();
      if (encuentro === null) {
        this.registrados.set([]);
        return;
      }
      this.consent.listEncounterInformedConsents(encuentro).subscribe({
        next: (items) => this.registrados.set(items),
        error: () => this.registrados.set([]),
      });
    });
  }

  protected decisionDe(decision: MyTreatmentConsent['decision']): string {
    return decision === 'ACCEPTED'
      ? 'Aceptó el tratamiento'
      : decision === 'DECLINED'
        ? 'Rechazó el tratamiento'
        : 'Sin decisión registrada';
  }

  protected registrar(): void {
    const encuentro = this.encounterId();
    const decision = this.decision();
    if (encuentro === null || decision === null || this.guardando()) {
      return;
    }
    const version = String(this.versionDeInformacion() ?? '').trim();

    this.guardando.set(true);
    this.error.set(null);
    this.consent
      .registerEncounterInformedConsent(encuentro, {
        decision,
        // El opcional sin escribir se omite: la API valida con `forbidNonWhitelisted`.
        ...(version === '' ? {} : { informationVersion: version }),
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.decision.set(null);
          this.versionDeInformacion.set('');
          this.toasts.success('Queda registrado y la persona lo ve en «Mi privacidad».', 'Consentimiento informado');
          this.consent.listEncounterInformedConsents(encuentro).subscribe({
            next: (items) => this.registrados.set(items),
          });
          this.cambio.emit();
        },
        error: (falla: unknown) => {
          this.guardando.set(false);
          const vista = errorToViewState<null>(falla);
          this.error.set(
            vista.status === 'forbidden'
              ? 'No tenés acceso para escribir en la historia de esta persona.'
              : vista.status === 'offline'
                ? 'No pudimos conectarnos. Revisá tu conexión y reintentá.'
                : 'No pudimos registrar el consentimiento informado. Probá de nuevo.',
          );
        },
      });
  }
}
