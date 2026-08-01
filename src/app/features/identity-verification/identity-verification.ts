import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { FilesClient } from '../../core/data-access/files/files.client';
import { IdentityClient } from '../../core/data-access/identity/identity.client';
import type { VerificationCase } from '../../core/data-access/identity/identity.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../shared/a11y/announce-on-appear';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FileInput } from '../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Lo máximo que admite una evidencia. Un documento no pesa más que esto. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Verificación de identidad del titular.
 *
 * Es la pantalla a la que apunta el estado **S5 «con acción»**: cuando la API
 * responde `IDENTITY_VERIFICATION_REQUIRED`, `errorToViewState` ofrece
 * «Verificar identidad» y esta ruta es su destino. Antes ese destino era
 * `/identity/me` —la ruta **de la API**, no del router—, así que la puerta no
 * llevaba a ninguna parte.
 *
 * ## El flujo, en dos peticiones
 *
 * ```text
 * FilesClient.upload(evidencia, 'DOCUMENT', 'PHI')  →  { id }
 *       ↓
 * IdentityClient.requestPatientIdentityVerification({ evidenceFileId: id })
 *       ↓  caseId
 * IdentityClient.getVerificationCase(caseId)        →  estado del caso
 * ```
 *
 * Las tres operaciones ya existían, probadas y sin consumidor. Esto es la
 * interfaz que les faltaba.
 *
 * ## `PHI` no es opcional acá
 *
 * La evidencia es un documento de identidad: se sube con sensibilidad `PHI`,
 * que cambia cómo se guarda y quién puede descargarla. El parámetro es
 * obligatorio en `FilesClient.upload` justamente para que esta decisión se tome
 * en cada llamada en vez de heredarse de un valor por defecto.
 *
 * ## Nadie puede verificar a otro
 *
 * Ninguna ruta de `identity` recibe a quién se verifica: el backend lo resuelve
 * del usuario autenticado. Por eso esta pantalla no tiene selector de persona,
 * y no es un olvido.
 */
@Component({
  selector: 'app-identity-verification',
  imports: [AnnounceOnAppear, AppButton, Alert, Card, FileInput, FormField, PageHeader],
  templateUrl: './identity-verification.html',
  styleUrl: './identity-verification.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityVerification {
  private readonly files = inject(FilesClient);
  private readonly identity = inject(IdentityClient);

  protected readonly maxBytes = MAX_BYTES;

  /** La evidencia elegida. Una sola: el backend espera un archivo. */
  protected readonly evidencia = signal<readonly File[]>([]);

  /** Motivo del último archivo rechazado por los límites del componente. */
  protected readonly rechazo = signal<string | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));

  /** El caso abierto, cuando el envío salió bien. */
  protected readonly caso = signal<VerificationCase | null>(null);

  protected readonly enviando = computed(() => this.state().status === 'loading');
  protected readonly puedeEnviar = computed(
    () => this.evidencia().length === 1 && !this.enviando(),
  );

  protected readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'No podés iniciar esta verificación.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /**
   * Traduce el rechazo del componente a algo que la persona pueda accionar.
   *
   * `app-file-input` avisa **qué** rechazó y por qué, y deja el mensaje a la
   * pantalla: el componente no sabe qué límite es razonable en este contexto.
   */
  protected alRechazar(rechazados: readonly { file: File; reason: string }[]): void {
    const primero = rechazados[0];
    if (primero === undefined) {
      return;
    }

    this.rechazo.set(
      primero.reason === 'tamaño'
        ? `«${primero.file.name}» pesa más de 10 MB. Probá con una foto más liviana.`
        : primero.reason === 'tipo'
          ? `«${primero.file.name}» no es una imagen ni un PDF.`
          : `No pudimos usar «${primero.file.name}».`,
    );
  }

  /**
   * Sube la evidencia y abre el caso.
   *
   * Las dos peticiones van encadenadas porque la segunda necesita el
   * identificador de la primera. Un fallo en cualquiera de las dos se traduce
   * con el mapeo compartido: esta pantalla no escribe una línea sobre errores
   * de HTTP.
   */
  protected enviar(): void {
    const archivo = this.evidencia()[0];
    if (archivo === undefined || this.enviando()) {
      return;
    }

    this.rechazo.set(null);
    this.state.set(loading());

    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.abrirCaso(id),
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private abrirCaso(evidenceFileId: string): void {
    this.identity.requestPatientIdentityVerification({ evidenceFileId }).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.caso.set({ id: resultado.caseId, status: resultado.status });
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /** Vuelve a consultar el caso, para ver si la autoridad ya se expidió. */
  protected actualizarCaso(): void {
    const abierto = this.caso();
    if (abierto === null || this.enviando()) {
      return;
    }

    this.state.set(loading());

    this.identity.getVerificationCase(abierto.id).subscribe({
      next: (caso) => {
        this.state.set(ready(null));
        this.caso.set(caso);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }
}
