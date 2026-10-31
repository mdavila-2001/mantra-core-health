import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { INSIGHTS_BASE } from '../insights-nav';

const KEY = 'insights.views';

interface SavedView {
  readonly name: string;
  readonly url: string;
}

function read(): SavedView[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is SavedView => typeof v?.name === 'string' && typeof v?.url === 'string' && v.url.startsWith(INSIGHTS_BASE))
      : [];
  } catch {
    return [];
  }
}

function write(views: readonly SavedView[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(views));
  } catch {
    /* sin almacenamiento disponible: la vista guardada es una conveniencia */
  }
}

/**
 * Vistas guardadas: recuerdan módulo + filtros (que viven en la URL). Se guardan
 * en este navegador; no son un permiso ni un dato compartido. Solo se aceptan
 * direcciones de AloVida Insights, para que un valor manipulado no redirija fuera.
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly open = signal(false);
  protected readonly views = signal<readonly SavedView[]>(read());
  protected readonly draft = signal('');

  protected save(): void {
    const name = this.draft().trim().slice(0, 60);
    if (!name) return;
    const next = [...this.views().filter((v) => v.name !== name), { name, url: this.router.url }];
    this.views.set(next);
    write(next);
    this.draft.set('');
  }

  protected go(view: SavedView): void {
    this.open.set(false);
    void this.router.navigateByUrl(view.url);
  }

  protected remove(name: string): void {
    const next = this.views().filter((v) => v.name !== name);
    this.views.set(next);
    write(next);
  }

  protected type(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
