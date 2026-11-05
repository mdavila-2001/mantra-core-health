import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell, IsolationCode } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiReason } from '../api-reason';
import { OpsCatalogStore } from '../ops-catalog.store';

const MISSING: Readonly<Record<string, string>> = {
  AIIR: 'no es un local de aislamiento respiratorio (AIIR)',
  NEGATIVE_PRESSURE: 'no tiene presión negativa',
  POSITIVE_PRESSURE: 'no tiene presión positiva',
  PROTECTIVE_ENV: 'no es un ambiente protector',
  HVAC_VALIDATION: 'la validación de climatización no está vigente',
};

/**
 * Aislamiento — `POST /care-spaces/:id/isolation` con `If-Match-Ops`.
 *
 * El aéreo sólo en un local AIIR apto (la API responde 422 con lo que falta);
 * en una habitación compartida la API bloquea las camas hermanas libres; al
 * levantarlo, la cama queda con limpieza terminal pendiente.
 */
@Component({
  selector: 'app-isolation-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, Input, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog heading="Aislamiento" [description]="'Cama ' + cell().code + '.'" [dismissible]="!sending()" (closed)="closed.emit()">
      @if (missing(); as faltan) {
        <app-alert tone="error" title="El local no es apto" data-testid="isolation-missing">
          <ul>
            @for (m of faltan; track m) {
              <li>{{ m }}</li>
            }
          </ul>
        </app-alert>
      } @else if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      <form class="isolation-dialog" id="isolation-dialog-form" (submit)="$event.preventDefault(); submit()">
        <app-form-field label="Precaución" [required]="true">
          <app-select [(value)]="code" [options]="options()" data-testid="isolation-code" />
        </app-form-field>
        @if (code() !== 'ISO_NONE') {
          <app-form-field label="Organismo" hint="Opcional; para cohortes hace falta el mismo organismo.">
            <app-input [(value)]="organism" data-testid="isolation-organism" />
          </app-form-field>
        }
        <app-form-field label="Motivo" [required]="true" [errorMessage]="tried() && !reason().trim() ? 'Indique el motivo.' : ''">
          <app-textarea [(value)]="reason" [rows]="3" data-testid="isolation-reason" />
        </app-form-field>
        @if (code() === 'ISO_NONE' && cell().isolation.code !== 'ISO_NONE') {
          <p class="isolation-dialog__note">Al levantar el aislamiento la cama queda con limpieza terminal pendiente y no se puede asignar hasta la inspección de supervisión.</p>
        }
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button type="submit" form="isolation-dialog-form" [disabled]="sending()" data-testid="isolation-submit">Guardar</button>
      </div>
    </app-content-dialog>
  `,
  styles: `
    .isolation-dialog { display: grid; gap: var(--sp-4); }
    .isolation-dialog__note { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IsolationDialog {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly catalog = inject(OpsCatalogStore);

  readonly cell = input.required<BedBoardCell>();
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly code = signal<IsolationCode | null>('ISO_CONTACT');
  protected readonly organism = signal<string | number | null>('');
  protected readonly reason = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly missing = signal<readonly string[] | null>(null);

  protected readonly options = computed<SelectOption<IsolationCode>[]>(() =>
    (this.catalog.catalog()?.isolation ?? []).map((c) => ({ value: c.code as IsolationCode, label: c.display })),
  );

  constructor() {
    this.catalog.ensure();
  }

  protected submit(): void {
    this.tried.set(true);
    const code = this.code();
    if (code === null || !this.reason().trim()) return;
    const organism = String(this.organism() ?? '').trim();
    this.sending.set(true);
    this.failure.set(null);
    this.missing.set(null);
    this.client
      .changeIsolation(this.cell().id, this.cell().opsVersion, { isolationCode: code, reasonText: this.reason().trim(), ...(organism ? { organismText: organism } : {}) })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.saved.emit(r.requestId ?? '');
        },
        error: (e: unknown) => {
          this.sending.set(false);
          const r = apiReason(e);
          if (r?.reason === 'ISOLATION_ROOM_NOT_CAPABLE') {
            this.missing.set(((r.details['missing'] as string[] | undefined) ?? []).map((m) => MISSING[m] ?? m));
            return;
          }
          this.failure.set(errorToViewState<never>(e));
        },
      });
  }
}
