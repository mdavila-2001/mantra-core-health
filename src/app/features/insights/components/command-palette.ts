import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { buildAlerts } from '../domain/alerts';
import { CAMPAIGNS } from '../domain/campaigns.data';
import { METRIC_CATALOG } from '../domain/metric-catalog';
import { INSIGHTS_BASE, INSIGHTS_MODULES } from '../insights-nav';

interface Entry {
  readonly kind: 'Módulo' | 'Campaña' | 'Alerta' | 'Métrica';
  readonly label: string;
  readonly hint: string;
  readonly url: string;
}

const MAX = 12;

/** Paleta de comandos (Ctrl/⌘ K): salta a un módulo, una campaña, una alerta o una métrica. */
@Component({
  selector: 'app-ins-palette',
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandPalette {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  private readonly router = inject(Router);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly query = signal('');
  protected readonly active = signal(0);

  /** El catálogo y las alertas se leen al abrir: al crearse el marco todavía no estaban cargados. */
  private readonly stamp = signal(0);
  private readonly entries = computed<Entry[]>(() => (this.stamp() >= 0 ? this.build() : []));

  private build(): Entry[] {
    return [
    ...INSIGHTS_MODULES.map((m) => ({ kind: 'Módulo' as const, label: m.label, hint: m.question, url: `${INSIGHTS_BASE}/${m.path}` })),
    ...CAMPAIGNS.map((c) => ({ kind: 'Campaña' as const, label: c.name, hint: 'Resumen de campañas', url: `${INSIGHTS_BASE}/campaigns?c=${c.id}` })),
    ...buildAlerts().map((a) => ({ kind: 'Alerta' as const, label: a.title, hint: a.what, url: `${INSIGHTS_BASE}/alerts` })),
    ...Object.values(METRIC_CATALOG).map((m) => ({ kind: 'Métrica' as const, label: m.label, hint: m.definition, url: `${INSIGHTS_BASE}/campaigns?m=${m.id}` })),
    ];
  }

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.entries();
    return (q ? all.filter((e) => `${e.label} ${e.hint}`.toLowerCase().includes(q)) : all).slice(0, MAX);
  });

  private readonly sync = effect(() => {
    const dialogEl = this.dialog()?.nativeElement;
    if (!dialogEl) return;
    if (this.open() && !dialogEl.open) {
      this.query.set('');
      this.active.set(0);
      this.stamp.update((n) => n + 1);
      dialogEl.showModal();
      queueMicrotask(() => this.field()?.nativeElement.focus());
    }
    if (!this.open() && dialogEl.open) dialogEl.close();
  });

  protected type(e: Event): void { this.query.set((e.target as HTMLInputElement).value); this.active.set(0); }
  protected key(e: KeyboardEvent): void {
    const n = this.results().length;
    if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set(n ? (this.active() + 1) % n : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(n ? (this.active() - 1 + n) % n : 0); }
    else if (e.key === 'Enter') { const r = this.results()[this.active()]; if (r) { e.preventDefault(); this.go(r); } }
  }
  protected go(entry: Entry): void { this.closed.emit(); void this.router.navigateByUrl(entry.url); }
}
