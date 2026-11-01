import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { computed, DOCUMENT, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { SessionStore } from '../../auth/session.store';
import { TelemetryConsentClient } from '../../data-access/telemetry/telemetry-consent.client';
import { VERSION_CONSENTIMIENTO_UX, UX_ANALYTICS_CONFIG } from '../ux/ux-analytics.config';
import { isPrivacySignalActive } from './privacy-signal';

/**
 * Lo que la API sabe de la decisión de esta persona para el propósito de los
 * mapas de calor. `desconocida` es «todavía no lo sé» (sin sesión, cargando o la
 * consulta falló) y se trata igual que `ninguna`: nunca clics.
 */
export type DecisionUx = 'desconocida' | 'ninguna' | 'otorgada' | 'retirada';

/**
 * Qué puede emitir el SDK ahora mismo:
 *
 * - `completo`: consentimiento otorgado. Vistas, clics, foco y abandono contra
 *   el esquema que lo exige (la API sigue verificándolo: no es el navegador
 *   quien autoriza).
 * - `anonimo`: decisión ausente. **Solo vistas de página**, contra el esquema
 *   del propósito agregado, sin identidad, sin sesión y sin propiedades.
 * - `ninguno`: captura apagada, DNT/GPC o consentimiento retirado. Nada.
 */
export type ModoUx = 'completo' | 'anonimo' | 'ninguno';

const CLAVE_AVISO = 'mch.ux.aviso';

/**
 * Consentimiento de la captura de interacciones.
 *
 * ## Por qué vive aparte del SDK
 *
 * El SDK mide; esto decide si puede. Separarlos permite que el aviso, el panel
 * de «Mi privacidad» y el SDK lean la misma verdad (un signal) sin que el SDK
 * dependa de ninguna pantalla.
 *
 * ## Reglas
 *
 * - **DNT o Global Privacy Control activos → `ninguno`**, siempre, sin
 *   preguntar. Es la señal de la persona y gana a cualquier consentimiento.
 * - Decisión ausente → `anonimo` (vistas agregadas); nunca clics.
 * - Retiro → `ninguno` de inmediato; el SDK vacía lo que tenía en cola.
 * - La autoridad es la API: `GET /telemetry/tracking-consents/me` decide el
 *   estado, y el aviso «ya se mostró» es solo una comodidad local.
 */
@Injectable({
  providedIn: 'root',
})
export class UxConsent {
  private readonly config = inject(UX_ANALYTICS_CONFIG);
  private readonly client = inject(TelemetryConsentClient);
  private readonly session = inject(SessionStore);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** DNT o GPC: se lee una vez; cambiarlos exige recargar, como en cualquier sitio. */
  readonly bloqueadaPorPrivacidad = this.isBrowser && isPrivacySignalActive(this.document.defaultView);

  readonly decision = signal<DecisionUx>('desconocida');
  /** El consentimiento vigente, el que se pasa a retirar. */
  private readonly consentId = signal<string | null>(null);
  readonly ocupado = signal(false);
  /** Mensaje para la persona si otorgar o retirar falló; `null` si todo bien. */
  readonly error = signal<string | null>(null);
  /** El aviso se descartó en este navegador para esta persona. */
  private readonly avisoDescartado = signal(false);

  readonly modo = computed<ModoUx>(() => {
    if (!this.config.active || this.bloqueadaPorPrivacidad) {
      return 'ninguno';
    }
    switch (this.decision()) {
      case 'otorgada':
        return 'completo';
      case 'retirada':
        return 'ninguno';
      default:
        return 'anonimo';
    }
  });

  /** ¿La captura existe para esta persona? Habilita el panel de «Mi privacidad». */
  readonly disponible = computed(
    () => this.config.active && !this.bloqueadaPorPrivacidad && this.session.isAuthenticated(),
  );

  /**
   * El aviso de una sola vez: hay sesión, la captura existe, la API dice que
   * nunca decidió y no lo descartó antes.
   */
  readonly avisoVisible = computed(
    () => this.disponible() && this.decision() === 'ninguna' && !this.avisoDescartado(),
  );

  private loadedUser: string | null = null;
  private loadedTenant: string | null = null;

  constructor() {
    effect(() => {
      const userId = this.session.userId();
      const tenantId = this.session.activeTenantId();
      const disponible = this.disponible();
      const userChanged = userId !== this.loadedUser;
      // La API pide organización para consultar el consentimiento (403 TENANT_AMBIGUOUS sin ella): quien elige
      // organización DESPUÉS de iniciar sesión tiene que volver a consultar al elegirla, o el aviso nunca llega.
      const tenantChanged = tenantId !== this.loadedTenant;
      if (!userChanged && !tenantChanged) {
        return;
      }
      this.loadedUser = userId;
      this.loadedTenant = tenantId;
      if (userChanged) {
        this.decision.set('desconocida');
        this.consentId.set(null);
        this.error.set(null);
        this.avisoDescartado.set(userId !== null && this.leerAviso(userId));
      }
      if (userId !== null && disponible) {
        this.refrescar();
      }
    });
  }

  /** Relee la decisión vigente desde la API. */
  refrescar(): void {
    if (!this.disponible()) {
      return;
    }
    const userId = this.session.userId();
    this.client.getMine(this.config.consentPurposeDefinitionId).subscribe({
      next: (estado) => {
        if (userId !== this.session.userId()) {
          return;
        }
        this.consentId.set(estado.consentId ?? null);
        this.decision.set(
          estado.status === 'GRANTED' ? 'otorgada' : estado.status === 'WITHDRAWN' ? 'retirada' : 'ninguna',
        );
      },
      // Sin saberlo se queda en `desconocida`: solo vistas anónimas, ni aviso ni clics.
      error: () => undefined,
    });
  }

  /** Otorga el consentimiento (`POST /telemetry/tracking-consents`). */
  otorgar(): void {
    if (this.ocupado() || !this.disponible()) {
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    this.client.grant(this.config.consentPurposeDefinitionId, VERSION_CONSENTIMIENTO_UX).subscribe({
      next: (consentimiento) => {
        this.ocupado.set(false);
        this.consentId.set(consentimiento.id);
        this.decision.set('otorgada');
        this.descartarAviso();
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.error.set(errorMessage(error, 'No pudimos registrar su decisión. Pruebe de nuevo.'));
      },
    });
  }

  /** Retira el consentimiento vigente (`POST …/:id/withdraw`). */
  retirar(): void {
    const id = this.consentId();
    if (this.ocupado() || id === null) {
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    this.client.withdraw(id).subscribe({
      next: () => {
        this.ocupado.set(false);
        this.consentId.set(null);
        this.decision.set('retirada');
      },
      error: (error: unknown) => {
        this.ocupado.set(false);
        this.error.set(errorMessage(error, 'No pudimos retirar su consentimiento. Pruebe de nuevo.'));
      },
    });
  }

  /**
   * «Ahora no» o decisión tomada: el aviso no vuelve a salir en este navegador.
   * Sin consentimiento la captura sigue siendo solo de vistas anónimas.
   */
  descartarAviso(): void {
    this.avisoDescartado.set(true);
    const userId = this.session.userId();
    if (userId === null) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(`${CLAVE_AVISO}.${userId}`, '1');
    } catch {
      // Almacenamiento bloqueado: el aviso no vuelve a salir hasta recargar.
    }
  }

  private leerAviso(userId: string): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(`${CLAVE_AVISO}.${userId}`) === '1';
    } catch {
      return false;
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 0) {
    return 'No pudimos conectarnos. Revise su conexión y pruebe de nuevo.';
  }
  return fallback;
}
