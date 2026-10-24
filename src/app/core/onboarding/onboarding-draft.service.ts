import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { debounceTime, Subject } from 'rxjs';

import { OnboardingDraftClient } from './onboarding-draft.client';
import type {
  OnboardingDraft,
  OnboardingEventType,
  OnboardingFormType,
  OnboardingTelemetryEvent,
} from './onboarding-draft.types';

const STORAGE_PREFIX = 'alovida.onboarding.draft.';
const DRAFT_ID_PREFIX = 'alovida.onboarding.draft_id.';

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
  private readonly deleteSubject = new Subject<{ formType: OnboardingFormType; draftId: string }>();
  private readonly telemetryQueue: OnboardingTelemetryEvent[] = [];
  private readonly telemetrySubject = new Subject<void>();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.saveSubject.pipe(debounceTime(400)).subscribe((draft) => {
        this.client.saveDraft(draft).subscribe({
          error: () => {
            // Error silencioso: el borrador local ya está guardado de manera resiliente
          },
        });
      });

      this.deleteSubject.pipe(debounceTime(400)).subscribe(({ formType, draftId }) => {
        this.client.deleteDraft(formType, draftId).subscribe({
          error: () => {
            // Error silencioso al limpiar remoto
          },
        });
      });

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
    const percentComplete = Math.min(100, Math.round(((stepIndex + 1) / Math.max(1, totalSteps)) * 100));

    // Excluir contraseñas en claro del borrador serializado
    const datosSeguros = { ...formData };
    delete datosSeguros['password'];
    delete datosSeguros['confirmPassword'];

    const draft: OnboardingDraft = {
      draftId,
      formType,
      stepIndex,
      stepKey,
      stepTitle,
      data: datosSeguros,
      extraData,
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

  /**
   * Descarta y elimina el borrador guardado al completar el registro o por decisión del usuario.
   */
  clearDraft(formType: OnboardingFormType, options?: { immediate?: boolean }): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const draftKey = `${STORAGE_PREFIX}${formType}`;
      const idKey = `${DRAFT_ID_PREFIX}${formType}`;
      const draftId = localStorage.getItem(idKey);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(idKey);

      if (draftId) {
        if (options?.immediate) {
          this.client.deleteDraft(formType, draftId).subscribe({
            error: () => undefined,
          });
        } else {
          this.deleteSubject.next({ formType, draftId });
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
