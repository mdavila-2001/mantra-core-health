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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  ErpConnection,
  ErpConnectionAccess,
  ErpConnectionMode,
  ErpConnectionResult,
  PharmacySystemCode,
  SaveErpConnection,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { integrationErrorMessage } from '../integration-error-message';

export const ERP_RESULT_TEXT: Readonly<Record<ErpConnectionResult, string>> = {
  OK: 'La conexión responde y acepta la clave.',
  UNREACHABLE: 'No responde. Revise la dirección o inténtelo más tarde.',
  AUTH_REJECTED: 'Clave rechazada. Revise la clave y el código de farmacia.',
};

/** Configuración de la conexión por farmacia; los vínculos y la sincronización conservan su panel. */
@Component({
  selector: 'app-pharmacy-erp-connection',
  imports: [ReactiveFormsModule, AppButton, Input, Select, Alert, FormField, ViewStateHost],
  templateUrl: './erp-connection.html',
  styleUrl: './erp-connection.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyErpConnection {
  readonly pharmacyId = input.required<string>();
  readonly saved = output<void>();
  readonly connectionLoaded = output<string | null>();
  private readonly client = inject(PharmacyIntegrationClient);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly state = signal<ViewState<ErpConnection>>(loading());
  protected readonly connection = computed(() => dataOf(this.state()));
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly messageTone = signal<'info' | 'error'>('info');
  protected readonly checkResult = signal<ErpConnectionResult | null>(null);
  private readonly revision = signal(0);
  private readonly testedRevision = signal<number | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    mode: ['MANUAL' as ErpConnectionMode],
    systemCode: ['ALOVIDA_STANDARD' as PharmacySystemCode],
    baseUrl: ['', Validators.maxLength(500)],
    pharmacyCode: ['', [Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9._-]*$/)]],
    apiKey: ['', [Validators.maxLength(500), Validators.pattern(/^$|^[\s\S]{4,500}$/)]],
    siteCodes: this.fb.array<ReturnType<PharmacyErpConnection['siteForm']>>([]),
  });
  protected readonly modes = [
    { value: 'MANUAL', label: 'Manual' },
    { value: 'CONNECTED', label: 'Conectada' },
  ];
  protected readonly systems = [
    { value: 'ALOVIDA_STANDARD', label: 'Estándar ALOVIDA' },
    { value: 'SIMULATED_CHAIN', label: 'Cadena simulada' },
  ];
  protected readonly resultText = ERP_RESULT_TEXT;

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.revision.update((value) => value + 1);
      this.checkResult.set(null);
      this.message.set(null);
      this.messageTone.set('info');
    });
    effect((cleanup) => {
      const pharmacyId = this.pharmacyId();
      const subscription = untracked(() => {
        this.state.set(loading());
        this.message.set(null);
        this.checkResult.set(null);
        this.testedRevision.set(null);
        this.form.controls.apiKey.reset('', { emitEvent: false });
        return this.client.readErpConnection(pharmacyId).subscribe({
          next: (connection) => this.populate(connection),
          error: (error: unknown) => this.state.set(errorToViewState(error)),
        });
      });
      cleanup(() => subscription.unsubscribe());
    });
  }

  protected reload(): void {
    const id = this.pharmacyId();
    this.state.set(loading());
    this.client
      .readErpConnection(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (connection) => {
          if (id === this.pharmacyId()) this.populate(connection);
        },
        error: (error: unknown) => {
          if (id === this.pharmacyId()) this.state.set(errorToViewState(error));
        },
      });
  }

  protected siteDescription(siteId: string): string {
    const site = this.connection()?.sites.find((item) => item.siteId === siteId);
    return site
      ? `${site.siteName} (${site.platformCode})`
      : 'Sucursal no disponible: vuelva a cargar';
  }

  protected testDraft(): void {
    const access = this.access();
    if (!access || this.busy()) return;
    const id = this.pharmacyId();
    const revision = this.revision();
    this.busy.set(true);
    this.client
      .testErpConnection(id, access)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ result }) => {
          if (id !== this.pharmacyId() || revision !== this.revision()) return;
          this.checkResult.set(result);
          this.testedRevision.set(result === 'OK' ? revision : null);
        },
        error: (error: unknown) => {
          if (id === this.pharmacyId() && revision === this.revision()) this.showError(error);
        },
      });
  }

  protected testSaved(): void {
    if (this.busy()) return;
    const id = this.pharmacyId();
    this.busy.set(true);
    this.client
      .testSavedErpConnection(id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: ({ result, connection }) => {
          if (id !== this.pharmacyId()) return;
          if (connection) this.state.set(ready(connection));
          this.checkResult.set(result);
        },
        error: (error: unknown) => {
          if (id === this.pharmacyId()) this.showError(error);
        },
      });
  }

  protected save(): void {
    if (this.busy()) return;
    const mode = this.form.controls.mode.value;
    const access = mode === 'CONNECTED' ? this.access() : null;
    if (mode === 'CONNECTED' && !access) return;
    if (mode === 'CONNECTED' && this.testedRevision() !== this.revision()) {
      this.message.set('Pruebe la conexión con estos datos antes de guardar.');
      return;
    }
    const draft: SaveErpConnection =
      mode === 'MANUAL'
        ? { mode }
        : {
            mode,
            ...access!,
            siteCodes: this.form.controls.siteCodes.getRawValue(),
          };
    const id = this.pharmacyId();
    this.busy.set(true);
    this.client
      .saveErpConnection(id, draft)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.busy.set(false)),
      )
      .subscribe({
        next: (connection) => {
          if (id !== this.pharmacyId()) return;
          this.populate(connection);
          this.message.set('Configuración guardada y leída del servidor.');
          this.saved.emit();
        },
        error: (error: unknown) => {
          if (id === this.pharmacyId()) this.showError(error);
        },
      });
  }

  private access(): ErpConnectionAccess | null {
    const { systemCode, baseUrl, pharmacyCode, apiKey } = this.form.getRawValue();
    this.form.markAllAsTouched();
    let validUrl: boolean;
    try {
      const url = new URL(baseUrl);
      validUrl =
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash;
    } catch {
      validUrl = false;
    }
    if (this.form.invalid || !validUrl || !pharmacyCode.trim()) {
      this.message.set(
        'Revise la dirección sin credenciales, consulta ni fragmento, el código y los campos de la conexión.',
      );
      return null;
    }
    return {
      systemCode,
      baseUrl: baseUrl.trim(),
      pharmacyCode: pharmacyCode.trim(),
      ...(apiKey === '' ? {} : { apiKey }),
    };
  }

  private siteForm(siteId: string, externalCode: string) {
    return this.fb.nonNullable.group({
      siteId: [siteId],
      externalCode: [
        externalCode,
        [Validators.required, Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9._-]+$/)],
      ],
    });
  }

  private populate(connection: ErpConnection): void {
    this.state.set(ready(connection));
    this.messageTone.set('info');
    this.form.controls.siteCodes.clear({ emitEvent: false });
    for (const site of connection.sites)
      this.form.controls.siteCodes.push(this.siteForm(site.siteId, site.externalCode), {
        emitEvent: false,
      });
    this.form.patchValue(
      {
        mode: connection.mode,
        systemCode: connection.systemCode ?? 'ALOVIDA_STANDARD',
        baseUrl: connection.baseUrl ?? '',
        pharmacyCode: connection.pharmacyCode ?? '',
        apiKey: '',
      },
      { emitEvent: false },
    );
    this.revision.update((value) => value + 1);
    this.testedRevision.set(null);
    this.connectionLoaded.emit(connection.integrationConnectionId);
  }

  private showError(error: unknown): void {
    this.messageTone.set('error');
    if (error instanceof HttpErrorResponse && [401, 403, 404].includes(error.status)) {
      this.form.controls.apiKey.reset('', { emitEvent: false });
      this.state.set(errorToViewState(error));
    }
    this.message.set(
      integrationErrorMessage(error, 'No se pudo completar la operación de conexión.'),
    );
    this.testedRevision.set(null);
  }
}
