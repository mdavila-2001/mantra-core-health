import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { InsightsWorkspaceClient } from '../../../core/data-access/insights/insights-workspace.client';
import type { InsightsSavedView } from '../../../core/data-access/insights/insights.types';
import { INSIGHTS_BASE } from '../insights-nav';

/**
 * Vistas guardadas: recuerdan módulo + filtros (que viven en la URL). Se guardan en el API,
 * por usuario, y no son un permiso. Solo se aceptan direcciones de AloVida Insights, para que
 * un valor manipulado no redirija fuera.
 */
@Component({
  selector: 'app-ins-saved-views',
  templateUrl: './saved-views.html',
  styleUrl: './saved-views.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(keydown.escape)': 'open.set(false)' },
})
export class SavedViews {
  private readonly router = inject(Router);
  private readonly client = inject(InsightsWorkspaceClient);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly views = signal<readonly InsightsSavedView[]>([]);
  protected readonly draft = signal('');
  protected readonly error = signal<string | null>(null);
  private loaded = false;

  protected toggle(): void {
    this.open.set(!this.open());
    if (this.open() && !this.loaded) this.load();
  }

  private load(): void {
    this.client.listSavedViews().subscribe({
      next: (r) => { this.loaded = true; this.views.set(r.data.filter((v) => v.url.startsWith(INSIGHTS_BASE))); },
      error: () => this.error.set('No se pudieron leer las vistas guardadas.'),
    });
  }

  protected save(): void {
    const name = this.draft().trim().slice(0, 60);
    if (!name) return;
    const id = crypto.randomUUID();
    this.error.set(null);
    this.client.putSavedView(id, { name, url: this.router.url }).subscribe({
      next: (r) => { this.views.set([...this.views().filter((v) => v.id !== r.data.id), r.data]); this.draft.set(''); },
      error: (e: { status?: number }) => this.error.set(e.status === 409 ? 'Ya tiene una vista con ese nombre.' : 'No se pudo guardar la vista.'),
    });
  }

  protected go(view: InsightsSavedView): void {
    this.open.set(false);
    void this.router.navigateByUrl(view.url);
  }

  protected remove(view: InsightsSavedView): void {
    this.client.deleteSavedView(view.id).subscribe({
      next: () => this.views.set(this.views().filter((v) => v.id !== view.id)),
      error: () => this.error.set('No se pudo eliminar la vista.'),
    });
  }

  protected type(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
