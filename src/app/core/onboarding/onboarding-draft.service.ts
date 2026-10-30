import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, concatMap, debounceTime, EMPTY, Subject, tap } from 'rxjs';

import { OnboardingDraftClient } from './onboarding-draft.client';
import type {
  OnboardingDraft,
  OnboardingEventType,
  OnboardingFormType,
  OnboardingTelemetryEvent,
} from './onboarding-draft.types';

const STORAGE_PREFIX = 'alovida.onboarding.draft.';
const DRAFT_ID_PREFIX = 'alovida.onboarding.draft_id.';
const DRAFT_SECRET_PREFIX = 'alovida.onboarding.draft_secret.';

/**
 * Lo que nunca viaja en un borrador: las contraseñas, y las imágenes en base64
 * (foto, firma, sello). Una sola foto supera el tope de 64 KiB del servidor y
 * cada guardado terminaba en 413; además llenaba el `localStorage`.
 */
function sinDatosPesadosNiSecretos(
  datos: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (datos === undefined) return undefined;
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(datos)) {
    if (clave === 'password' || clave === 'confirmPassword') continue;
    if (/base64$/i.test(clave)) continue;
    limpio[clave] = valor;
  }
  return limpio;
}

function generarUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'draft-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

@Injectable({
  providedIn: 'root',
})
export class OnboardingDraftService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly client = inject(OnboardingDraftClient);

  private readonly saveSubject = new Subject<OnboardingDraft>();
  private readonly deleteSubject = new Subject<{
    formType: OnboardingFormType;
    draftId: string;
    secret: string | null;
  }>();
  private readonly telemetryQueue: OnboardingTelemetryEvent[] = [];
  private readonly telemetrySubject = new Subject<void>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // En serie (`concatMap`): el primer PUT crea el borrador y devuelve su
      // secreto; si el segundo saliera antes de guardarlo, iría sin secreto
      // sobre un id ya tomado y la API respondería 404.
      this.saveSubject
        .pipe(
          debounceTime(400),
          concatMap((draft) => {
            // Un guardado que quedó en cola cuando el borrador ya se descartó
            // (el alta terminó en esos 400 ms) iría sin secreto sobre un id
            // tomado: 404 y un error en la consola. Ya no hay nada que guardar.
            if (!this.sigueVigente(draft)) return EMPTY;
            const secret = this.readSecret(draft.formType);
            return this.client.saveDraft(draft, secret).pipe(
              tap((res) => {
                if (res.draftSecret) this.writeSecret(draft.formType, res.draftSecret);
              }),
              catchError((error: unknown) => {
                // 404: el borrador remoto venció o el id quedó huérfano (sin
                // secreto). Se empieza otro: el local sigue intacto y el
                // próximo guardado lo vuelve a crear en el servidor.
                if (error instanceof HttpErrorResponse && error.status === 404) {
                  this.rotateRemoteDraft(draft.formType);
                }
                // El resto falla en silencio: el borrador local ya está guardado.
                return EMPTY;
              }),
            );
          }),
        )
        .subscribe();

      this.deleteSubject
        .pipe(
          debounceTime(400),
          concatMap(({ formType, draftId, secret }) =>
            this.client.deleteDraft(formType, draftId, secret).pipe(catchError(() => EMPTY)),
          ),
        )
        .subscribe();

      this.telemetrySubject.pipe(debounceTime(800)).subscribe(() => {
        this.flushTelemetry();
      });

      window.addEventListener('beforeunload', () => {
        this.flushTelemetry();
      });
    }
  }

  /**
   * Obtiene o genera el identificador único del borrador en el navegador actual.
   */
  getOrCreateDraftId(formType: OnboardingFormType): string {
    if (!isPlatformBrowser(this.platformId)) {
      return generarUuid();
    }
    try {
      const key = `${DRAFT_ID_PREFIX}${formType}`;
      let id = localStorage.getItem(key);
      if (!id) {
        id = generarUuid();
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return generarUuid();
    }
  }

  /**
   * Detecta si existe un borrador guardado localmente para el tipo de formulario indicado.
   */
  detectDraft(formType: OnboardingFormType): OnboardingDraft | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const key = `${STORAGE_PREFIX}${formType}`;
      const serializado = localStorage.getItem(key);
      if (!serializado) return null;
      const draft = JSON.parse(serializado) as OnboardingDraft;
      if (!draft || draft.formType !== formType || typeof draft.stepIndex !== 'number') {
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }

  /**
   * Guarda el avance actual del formulario tanto en almacenamiento local como en el backend.
   */
  saveProgress(
    formType: OnboardingFormType,
    stepIndex: number,
    stepKey: string,
    stepTitle: string,
    formData: Record<string, unknown>,
    extraData?: Record<string, unknown>,
    totalSteps = 1,
  ): OnboardingDraft {
    const draftId = this.getOrCreateDraftId(formType);
    const now = new Date().toISOString();
    const percentComplete = Math.min(
      100,
      Math.round(((stepIndex + 1) / Math.max(1, totalSteps)) * 100),
    );

    // Sin contraseñas en claro ni imágenes en base64 (ver `sinDatosPesadosNiSecretos`).
    const datosSeguros = sinDatosPesadosNiSecretos(formData) ?? {};

    const draft: OnboardingDraft = {
      draftId,
      formType,
      stepIndex,
      stepKey,
      stepTitle,
      data: datosSeguros,
      extraData: sinDatosPesadosNiSecretos(extraData),
      createdAt: now,
      updatedAt: now,
      percentComplete,
    };

    if (isPlatformBrowser(this.platformId)) {
      try {
        const key = `${STORAGE_PREFIX}${formType}`;
        localStorage.setItem(key, JSON.stringify(draft));
        this.saveSubject.next(draft);
      } catch {
        // Ignorar fallo de cuota en localStorage
      }
    }

    return draft;
  }

  /** Si el borrador sigue siendo el de la sesión (no se descartó ni se reemplazó). */
  private sigueVigente(draft: OnboardingDraft): boolean {
    try {
      return localStorage.getItem(`${DRAFT_ID_PREFIX}${draft.formType}`) === draft.draftId;
    } catch {
      return true;
    }
  }

  /**
   * Descarta y elimina el borrador guardado al completar el registro o por decisión del usuario.
   */
  clearDraft(formType: OnboardingFormType, options?: { immediate?: boolean }): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const draftKey = `${STORAGE_PREFIX}${formType}`;
      const idKey = `${DRAFT_ID_PREFIX}${formType}`;
      const secretKey = `${DRAFT_SECRET_PREFIX}${formType}`;
      const draftId = localStorage.getItem(idKey);
      const secret = localStorage.getItem(secretKey);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(idKey);
      localStorage.removeItem(secretKey);

      // Sin secreto no hay borrador remoto que sea nuestro: la API respondería 404.
      if (draftId && secret) {
        if (options?.immediate) {
          this.client.deleteDraft(formType, draftId, secret).subscribe({
            error: () => undefined,
          });
        } else {
          this.deleteSubject.next({ formType, draftId, secret });
        }
      }
    } catch {
      // Ignorar
    }
  }

  /**
   * Registra un evento de telemetría para análisis de deserción y mapa de calor.
   */
  trackEvent(
    eventType: OnboardingEventType,
    formType: OnboardingFormType,
    stepIndex: number,
    options?: {
      readonly stepKey?: string;
      readonly fieldKey?: string;
      readonly interactionType?: 'focus' | 'blur' | 'change' | 'error';
      readonly errorCategory?: string;
      readonly durationMs?: number;
    },
  ): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // El id de telemetría es otro, efímero y en memoria: nunca el `draftId`,
    // que es la llave con la que se lee y se borra el borrador del servidor.
    const event: OnboardingTelemetryEvent = {
      eventType,
      formType,
      draftId: this.telemetrySessionId(formType),
      stepIndex,
      stepKey: options?.stepKey,
      fieldKey: options?.fieldKey,
      interactionType: options?.interactionType,
      errorCategory: options?.errorCategory,
      durationMs: options?.durationMs,
      timestamp: new Date().toISOString(),
    };

    this.telemetryQueue.push(event);
    this.telemetrySubject.next();
  }

  /** El secreto que la API entregó al crear el borrador remoto, si lo hay. */
  private readSecret(formType: OnboardingFormType): string | null {
    try {
      return localStorage.getItem(`${DRAFT_SECRET_PREFIX}${formType}`);
    } catch {
      return null;
    }
  }

  private writeSecret(formType: OnboardingFormType, secret: string): void {
    try {
      localStorage.setItem(`${DRAFT_SECRET_PREFIX}${formType}`, secret);
    } catch {
      // Sin almacenamiento no hay borrador remoto que retomar.
    }
  }

  /** Nuevo id y sin secreto: el próximo guardado crea otro borrador remoto. */
  private rotateRemoteDraft(formType: OnboardingFormType): void {
    try {
      localStorage.setItem(`${DRAFT_ID_PREFIX}${formType}`, generarUuid());
      localStorage.removeItem(`${DRAFT_SECRET_PREFIX}${formType}`);
    } catch {
      // Ignorar
    }
  }

  private readonly telemetrySessions = new Map<OnboardingFormType, string>();

  /** Id aleatorio por pestaña y formulario, sin relación con el `draftId`. */
  private telemetrySessionId(formType: OnboardingFormType): string {
    let id = this.telemetrySessions.get(formType);
    if (!id) {
      id = `t-${generarUuid()}`;
      this.telemetrySessions.set(formType, id);
    }
    return id;
  }

  private flushTelemetry(): void {
    if (this.telemetryQueue.length === 0) return;
    const batch = [...this.telemetryQueue];
    this.telemetryQueue.length = 0;

    this.client.recordEvents(batch).subscribe({
      error: () => {
        // Falla silenciosa: mejor esfuerzo
      },
    });
  }
}
