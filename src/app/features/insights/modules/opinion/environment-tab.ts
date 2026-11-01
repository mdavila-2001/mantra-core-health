import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Panel } from '../../components/panel';
import { shortDate } from '../../domain/dates';
import { ENVIRONMENT, EXPOSURE_LABELS, exposure, type EnvArea, type EnvKind } from '../../domain/environment';

const AREAS: readonly (EnvArea | 'all')[] = ['all', 'Salud', 'Economía'];
const KINDS: readonly (EnvKind | 'all')[] = ['all', 'Riesgo', 'Oportunidad', 'Vigilar'];
const QUESTIONS = ['¿Qué pasó?', '¿A quién toca?', '¿Cuánto importa?', '¿Qué efecto tiene en las campañas?', '¿Qué conviene hacer?', '¿Qué hay que seguir mirando?', '¿Qué no sabemos?'] as const;

/** Salud y economía: lo que pasa afuera, a qué campañas toca y qué conviene hacer. */
@Component({
  selector: 'app-ins-environment',
  imports: [Panel],
  templateUrl: './environment-tab.html',
  styleUrl: './environment-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvironmentTab {
  protected readonly area = signal<EnvArea | 'all'>('all');
  protected readonly kind = signal<EnvKind | 'all'>('all');
  protected readonly openId = signal<string | null>(null);

  protected readonly areas = AREAS;
  protected readonly kinds = KINDS;
  protected readonly questions = QUESTIONS;
  protected readonly labels = EXPOSURE_LABELS;
  protected readonly day = shortDate;

  protected readonly exposures = exposure();
  protected readonly items = computed(() => ENVIRONMENT.filter((i) => (this.area() === 'all' || i.area === this.area()) && (this.kind() === 'all' || i.kind === this.kind())).sort((a, b) => b.relevance - a.relevance));
  protected readonly opened = computed(() => ENVIRONMENT.find((i) => i.id === this.openId()) ?? null);

  protected setArea(e: Event): void { this.area.set((e.target as HTMLSelectElement).value as EnvArea | 'all'); }
  protected setKind(e: Event): void { this.kind.set((e.target as HTMLSelectElement).value as EnvKind | 'all'); }
  protected toggle(id: string): void { this.openId.update((c) => (c === id ? null : id)); }
  protected mark(r: number): string { return r === 3 ? '▲▲▲' : r === 2 ? '▲▲' : r === 1 ? '▲' : '—'; }
  protected answers(i: NonNullable<ReturnType<EnvironmentTab['opened']>>): string[] {
    const campaigns = Object.keys(i.effects).map((c) => `${c.toUpperCase()}: ${i.effects[c]![0] === 'r' ? 'riesgo' : 'oportunidad'} nivel ${i.effects[c]![1]}`).join('; ');
    return [`${i.title} (${shortDate(i.date)}). Elemento ilustrativo, sin fuente real.`, i.impact, `Relevancia ${i.relevance} de 100.`, campaigns, i.action, i.monitor, 'La fuente es de demostración: antes de decidir hay que confirmar el hecho con una fuente verificable.'];
  }
}
