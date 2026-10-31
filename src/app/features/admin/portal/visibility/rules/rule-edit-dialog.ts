import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import { UiVisibilityAdminClient } from '../../../../../core/data-access/ui-visibility/ui-visibility-admin.client';
import type {
  UiRuleEffect,
  UiRuleUpdate,
  UiVisibilityRule,
} from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Select } from '../../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import {
  dayToIso,
  effectLabel,
  isVersionMismatch,
  isoToDay,
  subjectTypeLabel,
  validityText,
  visibilityFailure,
  visibilityFieldErrors,
} from '../visibility-labels';
import { EFFECT_OPTIONS, REASON_MAX, REASON_MIN } from './rule-form-panel';

/**
 * Cambia una regla (`PATCH …/rules/:id` con `If-Match: <versión>`). Qué elemento y a quién se
 * aplica no se cambia: eso es otra regla (terminar ésta y crear la nueva).
 *
 * **Conflicto (409 `UI_RULE_VERSION_MISMATCH`)**: otra persona la cambió mientras se editaba. Lo
 * escrito NO se pierde: el diálogo trae la versión vigente, muestra qué dice ahora y deja
 * «Guardar sobre la versión actual», que reenvía lo escrito con la versión nueva.
 */
@Component({
  selector: 'app-visibility-rule-edit-dialog',
  imports: [AppButton, Input, Select, Textarea, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      heading="Editar la regla"
      [description]="elementLabel() + ' · ' + subject()"
      [dismissible]="!saving()"
      (closed)="closed.emit()"
    >
      @if (conflict(); as current) {
        <app-alert tone="warning" title="La regla cambió mientras la editaba" data-testid="rule-conflict">
          Ahora está en la versión {{ current.version }}: {{ effectText(current) }}, {{ validity(current) }}. Motivo:
          «{{ current.reason }}». Lo que usted escribió sigue abajo; si guarda, reemplaza esa versión.
          <button alert-actions app-button size="sm" variant="secondary" data-testid="rule-conflict-adopt" (clicked)="adopt(current)">
            Guardar sobre la versión actual
          </button>
        </app-alert>
      }
      @if (error(); as message) {
        <app-alert tone="error" data-testid="rule-edit-error">{{ message }}</app-alert>
      }
      <form class="vis__form" novalidate (submit)="$event.preventDefault(); save()">
        <app-form-field label="Qué hace" [required]="true" [errorMessage]="problem('effect')">
          <app-select ariaLabel="Qué hace" [options]="effects" [(value)]="effect" />
        </app-form-field>
        <div class="vis__pair">
          <app-form-field label="Desde" [errorMessage]="problem('validFrom')" hint="Opcional. Desde el comienzo de ese día.">
            <app-input type="date" ariaLabel="Desde" testId="rule-edit-from" [(value)]="validFrom" />
          </app-form-field>
          <app-form-field label="Hasta" [errorMessage]="problem('validTo')" hint="Opcional. Hasta el final de ese día.">
            <app-input type="date" ariaLabel="Hasta" testId="rule-edit-to" [(value)]="validTo" />
          </app-form-field>
        </div>
        <app-form-field
          label="Motivo"
          [required]="true"
          [errorMessage]="problem('reason')"
          [hint]="'De ' + min + ' a ' + max + ' caracteres. El motivo anterior queda en la auditoría.'"
        >
          <app-textarea [rows]="3" [maxLength]="max" [(value)]="reason" />
        </app-form-field>
      </form>
      <div dialog-actions class="vis__actions">
        <button app-button variant="ghost" [disabled]="saving()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button variant="primary" data-testid="rule-edit-save" [isLoading]="saving()" [disabled]="saving()" (clicked)="save()">
          Guardar cambios
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: '../visibility-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleEditDialog {
  private readonly client = inject(UiVisibilityAdminClient);

  readonly rule = input.required<UiVisibilityRule>();
  /** La ruta legible del elemento; el diálogo no conoce el catálogo. */
  readonly elementLabel = input<string>('');
  readonly saved = output<UiVisibilityRule>();
  readonly closed = output<void>();

  protected readonly effects = EFFECT_OPTIONS;
  protected readonly min = REASON_MIN;
  protected readonly max = REASON_MAX;
  protected readonly effect = signal<string | null>('HIDE');
  protected readonly validFrom = signal<string | number | null>('');
  protected readonly validTo = signal<string | number | null>('');
  protected readonly reason = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly conflict = signal<UiVisibilityRule | null>(null);
  /** La versión que se manda en `If-Match`: la que se vio al abrir, o la vigente tras un conflicto. */
  private readonly baseVersion = signal(0);
  private readonly submitted = signal(false);
  private readonly server = signal<Readonly<Record<string, string>>>({});

  protected readonly subject = computed(() => {
    const r = this.rule();
    return `${subjectTypeLabel(r.subjectType).label}: ${r.subjectLabel ?? r.subjectId ?? 'todos'}`;
  });
  protected readonly effectText = (r: UiVisibilityRule): string => effectLabel(r.effect).label;
  protected readonly validity = validityText;

  private readonly local = computed<Readonly<Record<string, string>>>(() => {
    const out: Record<string, string> = {};
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    if (from !== '' && dayToIso(from, 'start') === null) out['validFrom'] = 'La fecha no es válida.';
    if (to !== '' && dayToIso(to, 'end') === null) out['validTo'] = 'La fecha no es válida.';
    if (from !== '' && to !== '' && out['validFrom'] === undefined && out['validTo'] === undefined && to < from) {
      out['validTo'] = 'El fin tiene que ser el mismo día del inicio o posterior.';
    }
    const reason = this.reason().trim();
    if (reason.length < REASON_MIN) out['reason'] = `Escriba el motivo (al menos ${REASON_MIN} caracteres).`;
    else if (reason.length > REASON_MAX) out['reason'] = `Hasta ${REASON_MAX} caracteres.`;
    return out;
  });

  private subscription: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.subscription?.unsubscribe());
    // El diálogo se monta con la regla ya elegida: se vuelca una sola vez.
    effect(() => {
      const r = this.rule();
      untracked(() => {
        this.effect.set(r.effect);
        this.validFrom.set(isoToDay(r.validFrom));
        this.validTo.set(isoToDay(r.validTo));
        this.reason.set(r.reason);
        this.baseVersion.set(r.version);
      });
    });
  }

  protected problem(field: string): string {
    return this.server()[field] ?? (this.submitted() ? (this.local()[field] ?? '') : '');
  }

  /** Adopta la versión vigente como base y conserva todo lo escrito. */
  protected adopt(current: UiVisibilityRule): void {
    this.baseVersion.set(current.version);
    this.conflict.set(null);
    this.error.set(null);
  }

  protected save(): void {
    if (this.saving()) return;
    this.submitted.set(true);
    this.server.set({});
    this.error.set(null);
    if (Object.keys(this.local()).length > 0) return;
    const original = this.rule();
    const from = String(this.validFrom() ?? '');
    const to = String(this.validTo() ?? '');
    // Sólo viaja lo que cambió: el PATCH es parcial y un campo igual es ruido en la auditoría.
    const update: UiRuleUpdate = {
      ...(this.effect() !== original.effect ? { effect: this.effect() as UiRuleEffect } : {}),
      ...(from !== isoToDay(original.validFrom) ? { validFrom: from === '' ? null : dayToIso(from, 'start') } : {}),
      ...(to !== isoToDay(original.validTo) ? { validTo: to === '' ? null : dayToIso(to, 'end') } : {}),
      ...(this.reason().trim() !== original.reason ? { reason: this.reason().trim() } : {}),
    };
    if (Object.keys(update).length === 0) {
      this.error.set('No hay cambios para guardar.');
      return;
    }
    this.saving.set(true);
    this.subscription = this.client.updateRule(original.id, update, this.baseVersion()).subscribe({
      next: (rule) => {
        this.saving.set(false);
        this.saved.emit(rule);
      },
      // Lo escrito se conserva: el diálogo sigue abierto con los mismos valores.
      error: (e: unknown) => {
        this.saving.set(false);
        this.server.set(visibilityFieldErrors(e));
        this.error.set(visibilityFailure(e, 'No se pudo guardar la regla. Lo que escribió sigue acá.'));
        if (isVersionMismatch(e)) this.loadCurrent();
      },
    });
  }

  /** Trae la versión vigente para mostrar qué cambió y poder reenviar sobre ella. */
  private loadCurrent(): void {
    const r = this.rule();
    this.subscription = this.client.listRules({ elementKey: r.elementKey, subjectType: r.subjectType }).subscribe({
      next: (page) => {
        const current = page.items.find((x) => x.id === r.id);
        if (current !== undefined) {
          this.conflict.set(current);
          this.error.set(null);
        }
      },
      error: () => undefined, // el aviso del 409 ya está en pantalla
    });
  }
}
