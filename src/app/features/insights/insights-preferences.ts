import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';

import { ThemeService } from '../../core/tokens/theme.service';
import { InsightsWorkspaceClient } from '../../core/data-access/insights/insights-workspace.client';
import type { InsightsUserPreferences } from '../../core/data-access/insights/insights.types';

export type Density = InsightsUserPreferences['density'];
export type ThemeChoice = InsightsUserPreferences['theme'];

/**
 * Preferencias de interfaz del portal (densidad, tema, menú contraído). Persisten en el API
 * por usuario; si el API falla se aplican igual en esta sesión y se avisa. El tema «sistema»
 * se resuelve aquí con `prefers-color-scheme` sin tocar el `ThemeService` de la casa.
 */
@Injectable()
export class InsightsPreferences {
  private readonly client = inject(InsightsWorkspaceClient);
  private readonly theme = inject(ThemeService);
  private readonly document = inject(DOCUMENT);

  readonly density = signal<Density>('comfortable');
  readonly themeChoice = signal<ThemeChoice>('system');
  readonly navCollapsed = signal(false);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  private version: number | null = null;
  private inFlight = false;
  private dirty = false;

  readonly compact = computed(() => this.density() === 'compact');

  private touched = false;

  load(): void {
    this.client.getUserPreferences().subscribe({
      next: (r) => {
        this.version = r.data.rowVersion;
        if (this.touched) return;
        this.density.set(r.data.density);
        this.themeChoice.set(r.data.theme);
        this.navCollapsed.set(r.data.navCollapsed);
        this.version = r.data.rowVersion;
        this.applyTheme(r.data.theme);
      },
      error: () => this.error.set('No se pudieron leer sus preferencias; se usan las predeterminadas.'),
    });
  }

  setDensity(density: Density): void { this.touched = true; this.density.set(density); this.persist(); }
  setTheme(choice: ThemeChoice): void { this.touched = true; this.themeChoice.set(choice); this.applyTheme(choice); this.persist(); }
  setNavCollapsed(value: boolean): void { this.touched = true; this.navCollapsed.set(value); this.persist(); }

  private applyTheme(choice: ThemeChoice): void {
    const dark = choice === 'dark' || (choice === 'system' && (this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
    this.theme.setTheme(dark ? 'dark' : 'light');
  }

  /** Un guardado a la vez: si cambia otra preferencia mientras viaja una petición, se reenvía al volver (evita el 412). */
  private persist(retry = false): void {
    if (this.inFlight) { this.dirty = true; return; }
    this.inFlight = true;
    this.dirty = false;
    this.saving.set(true);
    this.error.set(null);
    this.client.putUserPreferences({ density: this.density(), theme: this.themeChoice(), navCollapsed: this.navCollapsed(), timezone: 'America/La_Paz' }, this.version).subscribe({
      next: (r) => { this.version = r.data.rowVersion; this.done(); },
      error: (e: unknown) => {
        if (e instanceof HttpErrorResponse && e.status === 412 && !retry) {
          // Otra pestaña guardó antes: se toma su versión y se reintenta una vez con lo que la persona acaba de elegir.
          this.client.getUserPreferences().subscribe({
            next: (r) => { this.version = r.data.rowVersion; this.inFlight = false; this.persist(true); },
            error: () => { this.error.set('No se pudo guardar la preferencia; vale solo en esta sesión.'); this.done(); },
          });
          return;
        }
        this.error.set('No se pudo guardar la preferencia; vale solo en esta sesión.');
        this.dirty = false;
        this.done();
      },
    });
  }

  private done(): void {
    this.inFlight = false;
    if (this.dirty) this.persist();
    else this.saving.set(false);
  }
}
