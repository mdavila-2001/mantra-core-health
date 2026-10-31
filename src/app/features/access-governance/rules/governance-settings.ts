import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AccessChallengeCancelledError } from '../../../core/access-challenge/access-challenge';
import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import type {
  GovernanceSettings,
  GovernanceSettingsChange,
  GovernanceSettingsResponse,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { AccessChallengeService } from '../access-challenge/access-challenge.service';

/** Un ajuste numérico: su clave, cómo se llama y qué hace, en palabras. */
interface Campo {
  readonly key: keyof GovernanceSettings;
  readonly label: string;
  readonly hint: string;
  /** Si puede quedar vacío (= no aplica). */
  readonly nullable?: boolean;
}

export const NUMERIC_SETTINGS: readonly Campo[] = [
  {
    key: 'inactivityDays',
    label: 'Días sin entrar para marcar a una persona como inactiva',
    hint: 'Aparece en el tablero. Por ejemplo, 45.',
  },
  {
    key: 'unusedDays',
    label: 'Días sin usar un permiso para considerarlo sin uso',
    hint: 'Lo verá quien revise los accesos. Por ejemplo, 60.',
  },
  {
    key: 'autoSuspendInactiveDays',
    label: 'Días de inactividad para suspender automáticamente',
    hint: 'Déjelo vacío para no suspender a nadie por sí solo.',
    nullable: true,
  },
  {
    key: 'maxSodExceptionDays',
    label: 'Días máximos de una excepción de separación de funciones',
    hint: 'Ninguna excepción puede durar más. Por ejemplo, 90.',
  },
  {
    key: 'creepThreshold',
    label: 'Puntaje de privilegios que enciende una alerta',
    hint: 'Cuando el puntaje de una persona sube más que esto, se avisa.',
  },
  {
    key: 'fourEyesActionTtlMinutes',
    label: 'Minutos que vale una aprobación de acción',
    hint: 'Después de aprobada, la acción se puede hacer una vez en ese tiempo. Por ejemplo, 60.',
  },
  {
    key: 'suspensionReviewAfterDays',
    label: 'Días de suspensión antes de revisar a la persona',
    hint: 'Una suspensión larga pasa a revisión. Por ejemplo, 60.',
  },
];

const CADENCIAS = [
  { value: 6, label: 'Cada 6 meses' },
  { value: 12, label: 'Cada 12 meses' },
] as const;

/**
 * **Ajustes de gobierno** (`practice_settings['support.governance']`, CONTRATO-GOBIERNO §6): son datos, no código. Cada ajuste
 * dice qué hace; solo se envía lo que cambió, y guardar pide el segundo paso. La API valida (`GOVERNANCE_SETTINGS_INVALID`).
 */
@Component({
  selector: 'app-governance-settings',
  imports: [Alert, AppButton, FormField, Input, Select, Switch],
  templateUrl: './governance-settings.html',
  styleUrl: './governance-settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GovernanceSettingsPanel {
  private readonly client = inject(AccessGovernanceClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly toasts = inject(ToastService);

  /** Lo que la API tiene guardado. */
  readonly response = input.required<GovernanceSettingsResponse>();
  /** Se guardó: lo nuevo que contestó la API. */
  readonly saved = output<GovernanceSettingsResponse>();

  protected readonly campos = NUMERIC_SETTINGS;
  protected readonly cadencias = CADENCIAS;
  protected readonly borrador = signal<Readonly<Record<string, string>>>({});
  protected readonly obligatorio = signal(false);
  protected readonly desde = signal('');
  protected readonly cadencia = signal<6 | 12>(6);
  protected readonly intento = signal(false);
  protected readonly guardando = signal(false);
  protected readonly fallo = signal<string | null>(null);
  protected readonly camposConError = signal<readonly string[]>([]);
  protected readonly anuncio = signal('');

  protected readonly valores = computed(() => this.response().settings);

  constructor() {
    // Cuando llega lo guardado (al abrir o después de guardar) el borrador vuelve a ser igual a ello.
    effect(() => this.reiniciar(this.response().settings));
  }

  private reiniciar(s: GovernanceSettings): void {
    this.obligatorio.set(s.onboardingRequired);
    this.desde.set(s.onboardingRequiredSince ?? '');
    this.cadencia.set(s.reviewCadenceMonths);
    this.borrador.set(
      Object.fromEntries(
        NUMERIC_SETTINGS.map((c) => [c.key, s[c.key] === null ? '' : String(s[c.key])]),
      ),
    );
    this.camposConError.set([]);
    this.fallo.set(null);
  }

  protected valorDe(key: string): string {
    return this.borrador()[key] ?? '';
  }

  protected escribir(key: string, valor: string | number | null): void {
    this.borrador.update((b) => ({ ...b, [key]: `${valor ?? ''}` }));
  }

  /** Lo que cambió respecto de lo guardado, listo para enviar; o los problemas de lo escrito. */
  private readonly analisis = computed<{
    readonly cambios: GovernanceSettingsChange;
    readonly problemas: readonly { readonly key: string; readonly texto: string }[];
  }>(() => {
    const guardado = this.valores();
    const cambios: Record<string, unknown> = {};
    const problemas: { key: string; texto: string }[] = [];
    for (const c of NUMERIC_SETTINGS) {
      const crudo = this.valorDe(c.key).trim();
      const antes = guardado[c.key];
      if (crudo === '') {
        if (c.nullable === true) {
          if (antes !== null) cambios[c.key] = null;
        } else {
          problemas.push({ key: c.key, texto: 'Escriba un número desde 1.' });
        }
        continue;
      }
      const n = Number(crudo);
      if (!Number.isInteger(n) || n < 1) {
        problemas.push({ key: c.key, texto: 'Escriba un número entero desde 1.' });
        continue;
      }
      if (n !== antes) cambios[c.key] = n;
    }
    if (this.obligatorio() !== guardado.onboardingRequired)
      cambios['onboardingRequired'] = this.obligatorio();
    const desde = this.desde().trim();
    if (desde !== (guardado.onboardingRequiredSince ?? ''))
      cambios['onboardingRequiredSince'] = desde === '' ? null : desde;
    if (this.cadencia() !== guardado.reviewCadenceMonths)
      cambios['reviewCadenceMonths'] = this.cadencia();
    return { cambios: cambios as GovernanceSettingsChange, problemas };
  });

  protected readonly hayCambios = computed(() => Object.keys(this.analisis().cambios).length > 0);
  protected readonly cuantosCambios = computed(() => Object.keys(this.analisis().cambios).length);
  protected readonly problemas = computed(() => this.analisis().problemas);
  /** Hay algo escrito que difiere de lo guardado o que no es válido: se puede enviar (para ver qué falta) o descartar. */
  protected readonly hayAlgoEscrito = computed(
    () => this.hayCambios() || this.problemas().length > 0,
  );

  protected errorDe(key: string): string {
    if (this.camposConError().includes(key)) return 'La API no aceptó este valor.';
    return this.intento() ? (this.problemas().find((p) => p.key === key)?.texto ?? '') : '';
  }

  protected descartar(): void {
    this.reiniciar(this.valores());
    this.intento.set(false);
  }

  protected guardar(): void {
    this.intento.set(true);
    if (this.guardando() || this.problemas().length > 0 || !this.hayCambios()) return;
    const cambios = this.analisis().cambios;
    this.guardando.set(true);
    this.fallo.set(null);
    this.camposConError.set([]);
    this.challenges
      .run(() => this.client.putSettings(cambios), {
        actionLabel: 'Guardar los ajustes de gobierno de accesos',
      })
      .subscribe({
        next: (respuesta) => {
          this.guardando.set(false);
          this.intento.set(false);
          this.toasts.success('Ajustes guardados.');
          this.anuncio.set('Ajustes guardados.');
          this.saved.emit(respuesta);
        },
        error: (failure: unknown) => {
          this.guardando.set(false);
          if (failure instanceof AccessChallengeCancelledError) return;
          const f = accessFailureOf(failure);
          const campos = f?.details?.['fields'];
          if (Array.isArray(campos))
            this.camposConError.set(campos.filter((c): c is string => typeof c === 'string'));
          this.fallo.set(f?.message ?? 'No pudimos guardar los ajustes. Intente de nuevo.');
        },
      });
  }
}
