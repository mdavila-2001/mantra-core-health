import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  LOCALE_ID,
  output,
  signal,
  untracked,
} from '@angular/core';
import { formatDate } from '@angular/common';
import type { Subscription } from 'rxjs';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';

import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  ExternalSystemFormat,
  IntegrationConnection,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';

import { integrationErrorMessage } from '../integration-error-message';

/** Cómo se nombra cada formato en la pestaña. */
export const FORMAT_LABEL: Readonly<Record<ExternalSystemFormat, string>> = {
  ALOVIDA_STANDARD: 'Estándar ALOVIDA',
  SIMULATED_CHAIN: 'Cadena simulada (pruebas)',
};

/** Qué tiene que escribir la farmacia en «Dirección», según el formato. */
export const FORMAT_HINT: Readonly<Record<ExternalSystemFormat, string>> = {
  ALOVIDA_STANDARD:
    'La dirección base que publica su sistema según el Estándar ALOVIDA, por ejemplo https://api.sufarmacia.bo/alovida-standard.',
  SIMULATED_CHAIN: 'La dirección del simulador de cadena, por ejemplo http://simulador:4100/simulated-chain/api/v2.',
};

/** Lo que se ve del lado del sistema si la farmacia no cargó el suyo. */
export const SERVER_SYSTEM_TEXT =
  'Esta conexión usa hoy el sistema que configura la plataforma. Cargue el de su farmacia para sincronizar con sus propias existencias.';

/**
 * El sistema no respondió al guardar. No es el texto de la sincronización
 * («pruebe en unos minutos»): al configurar, lo más probable es que la
 * dirección, el código o la clave no sean los de su sistema.
 */
export const SAVE_UNAVAILABLE_TEXT =
  'Su sistema no respondió con esa dirección, ese código y esa clave. Revíselos y vuelva a probar: no se guardó nada.';

/** «Probar conexión» respondió bien. */
export const PROBE_OK_TEXT = 'El sistema de la farmacia respondió y aceptó la clave.';

/** Sin sistema propio ni del servidor: no hay con quién sincronizar (el aviso de arriba ya lo dice). */
export const NO_SYSTEM_TEXT = 'Cargue el sistema de su farmacia para poder sincronizar.';

/**
 * El **sistema de la farmacia** de una conexión (FAR-C9 · C9-4): dónde está,
 * en qué formato habla, con qué código la conoce y con qué clave.
 *
 * - Sin sistema propio: el formulario. «Guardar y probar» manda la clave solo
 *   en el cuerpo; la API la prueba antes de guardar y, si no responde, no
 *   queda nada.
 * - Con sistema: sus datos (nunca la clave, que la API no devuelve), «Probar
 *   conexión», «Cambiar» (pide la clave otra vez: la API no deja mover la
 *   dirección conservando la clave) y «Quitar», con confirmación.
 *
 * Después de guardar o quitar avisa con {@link changed} y la pestaña relee la
 * conexión: lo que se ve es lo que dice la API, no el aviso.
 */
@Component({
  selector: 'app-integration-system',
  imports: [Alert, AppButton, FactList, FormField, Input, Select],
  templateUrl: './integration-system.html',
  styleUrl: './integration-system.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationSystem {
  readonly pharmacyId = input.required<string>();
  readonly connection = input.required<IntegrationConnection>();

  /** Se guardó o se quitó el sistema: la pestaña relee la conexión. */
  readonly changed = output<void>();

  private readonly integration = inject(PharmacyIntegrationClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly formatOptions: readonly SelectOption<ExternalSystemFormat>[] = (
    Object.keys(FORMAT_LABEL) as ExternalSystemFormat[]
  ).map((value) => ({ value, label: FORMAT_LABEL[value] }));

  /** «Cambiar» abierto sobre un sistema ya guardado. */
  protected readonly editing = signal(false);
  protected readonly format = signal<ExternalSystemFormat>('ALOVIDA_STANDARD');
  protected readonly baseUrl = signal('');
  protected readonly pharmacyCode = signal('');
  protected readonly apiKey = signal('');
  /** El formulario se intentó mandar: recién ahí se marcan los campos vacíos. */
  protected readonly submitted = signal(false);

  protected readonly saving = signal(false);
  protected readonly probing = signal(false);
  protected readonly removing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly probeOk = signal<string | null>(null);

  /** La petición en vuelo, para cortarla si la persona cambia de conexión. */
  private inFlight: Subscription | null = null;

  protected readonly system = computed(() => this.connection().system ?? null);
  protected readonly showForm = computed(() => this.system() === null || this.editing());
  protected readonly formatHint = computed(() => FORMAT_HINT[this.format()]);
  protected readonly serverText = computed(() =>
    this.connection().providerConfigured ? SERVER_SYSTEM_TEXT : NO_SYSTEM_TEXT,
  );

  protected readonly missing = computed(() => ({
    baseUrl: this.baseUrl().trim() === '',
    pharmacyCode: this.pharmacyCode().trim() === '',
    apiKey: this.apiKey() === '',
  }));

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const system = this.system();
    if (system === null) {
      return [];
    }
    return [
      { etiqueta: 'Formato', valor: FORMAT_LABEL[system.format] },
      { etiqueta: 'Dirección', valor: system.baseUrl },
      { etiqueta: 'Código de la farmacia', valor: system.externalPharmacyCode },
      {
        etiqueta: 'Clave',
        valor: system.apiKeyConfigured ? 'Guardada' : 'Falta',
        tono: system.apiKeyConfigured ? 'ok' : 'aviso',
      },
      { etiqueta: 'Configurado el', valor: formatDate(system.configuredAt, 'd MMM y, HH:mm', this.locale) },
    ];
  });

  constructor() {
    // Otra conexión u otra farmacia: se corta lo que estuviera en vuelo (su
    // respuesta hablaría de la anterior), se cierra lo abierto y no queda nada
    // escrito. Por la clave y no por el objeto, como Sincronización y Vínculos:
    // releer la misma conexión no borra lo que la persona está escribiendo.
    const key = computed(() => `${this.pharmacyId()}|${this.connection().id}`);
    effect(() => {
      key();
      untracked(() => {
        this.cancelInFlight();
        this.editing.set(false);
        this.resetForm();
        this.error.set(null);
        this.probeOk.set(null);
      });
    });
    inject(DestroyRef).onDestroy(() => this.cancelInFlight());
  }

  /** El valor de un campo de texto: `app-input` puede emitir número o nulo. */
  protected textOf(value: string | number | null): string {
    return value === null ? '' : String(value);
  }

  protected chooseFormat(value: ExternalSystemFormat | null): void {
    if (value !== null) {
      this.format.set(value);
    }
  }

  protected startEdit(): void {
    const system = this.system();
    this.resetForm();
    if (system !== null) {
      this.format.set(system.format);
      this.baseUrl.set(system.baseUrl);
      this.pharmacyCode.set(system.externalPharmacyCode);
    }
    this.error.set(null);
    this.probeOk.set(null);
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    this.editing.set(false);
    this.resetForm();
    this.error.set(null);
  }

  /** «Guardar y probar»: la API prueba antes de guardar; lo que se ve después es la conexión releída. */
  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.submitted.set(true);
    const missing = this.missing();
    if (missing.baseUrl || missing.pharmacyCode || missing.apiKey) {
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.probeOk.set(null);
    this.inFlight = this.integration
      .saveSystem(this.pharmacyId(), this.connection().id, {
        format: this.format(),
        baseUrl: this.baseUrl(),
        externalPharmacyCode: this.pharmacyCode(),
        apiKey: this.apiKey(),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editing.set(false);
          this.resetForm();
          this.toasts.success('El sistema de la farmacia respondió y quedó guardado.');
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          // La clave no se borra: la persona corrige la dirección sin volver a escribirla.
          this.error.set(
            integrationErrorMessage(error, 'No se pudo guardar el sistema de la farmacia.', {
              PHARMACY_INTEGRATION_UNAVAILABLE: SAVE_UNAVAILABLE_TEXT,
            }),
          );
        },
      });
  }

  protected probe(): void {
    if (this.probing()) {
      return;
    }
    this.probing.set(true);
    this.error.set(null);
    this.probeOk.set(null);
    // «Probar» solo se ofrece con sistema propio: lo que responde es el de la farmacia.
    this.inFlight = this.integration.probeSystem(this.pharmacyId(), this.connection().id).subscribe({
      next: () => {
        this.probing.set(false);
        this.probeOk.set(PROBE_OK_TEXT);
      },
      error: (error: unknown) => {
        this.probing.set(false);
        this.error.set(integrationErrorMessage(error, 'No se pudo probar el sistema de la farmacia.'));
      },
    });
  }

  protected async remove(): Promise<void> {
    if (this.removing()) {
      return;
    }
    // La conexión de la que se habla en el diálogo: si cambió mientras estaba abierto, no se quita nada.
    const key = `${this.pharmacyId()}|${this.connection().id}`;
    const confirmed = await this.dialogs.confirm({
      title: 'Quitar el sistema de la farmacia',
      message:
        'La conexión deja de sincronizar con este sistema y la clave guardada se borra. Los vínculos y las existencias que ya se sincronizaron se conservan.',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmed || key !== `${this.pharmacyId()}|${this.connection().id}`) {
      return;
    }
    this.removing.set(true);
    this.error.set(null);
    this.probeOk.set(null);
    this.inFlight = this.integration.removeSystem(this.pharmacyId(), this.connection().id).subscribe({
      next: () => {
        this.removing.set(false);
        this.toasts.success('Quitó el sistema de la farmacia.');
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.removing.set(false);
        this.error.set(integrationErrorMessage(error, 'No se pudo quitar el sistema de la farmacia.'));
      },
    });
  }

  private cancelInFlight(): void {
    this.inFlight?.unsubscribe();
    this.inFlight = null;
    this.saving.set(false);
    this.probing.set(false);
    this.removing.set(false);
  }

  private resetForm(): void {
    this.format.set('ALOVIDA_STANDARD');
    this.baseUrl.set('');
    this.pharmacyCode.set('');
    this.apiKey.set('');
    this.submitted.set(false);
  }
}
