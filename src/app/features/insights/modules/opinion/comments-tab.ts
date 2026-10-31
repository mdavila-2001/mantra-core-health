import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Panel } from '../../components/panel';
import { commentRows, REVIEW_BELOW } from '../../domain/comments';
import { shortDate } from '../../domain/dates';
import { formatInt } from '../../domain/format';
import type { OpinionFilter } from '../../domain/opinion';
import { DEPARTMENTS, KIND_LABELS, SENTIMENT_LABELS, SOURCE_NAMES, type MentionKind, type Sentiment } from '../../domain/opinion.data';

const PAGE = 20;
const TONES: readonly Sentiment[] = ['positive', 'neutral', 'negative'];

/** Explorador de comentarios: filtra por sentimiento, tipo, departamento y texto; marca los de revisión humana. */
@Component({
  selector: 'app-ins-comments',
  imports: [Panel],
  templateUrl: './comments-tab.html',
  styleUrl: './comments-tab.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentsTab {
  readonly filter = input.required<OpinionFilter>();

  protected readonly sentiment = signal<Sentiment | 'all'>('all');
  protected readonly kind = signal<MentionKind | 'all'>('all');
  protected readonly department = signal<string>('all');
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);

  protected readonly tones = TONES;
  protected readonly kinds = Object.keys(KIND_LABELS) as MentionKind[];
  protected readonly departments = DEPARTMENTS;
  protected readonly kindLabels = KIND_LABELS;
  protected readonly sentimentLabels = SENTIMENT_LABELS;
  protected readonly sourceNames = SOURCE_NAMES;
  protected readonly threshold = REVIEW_BELOW;

  protected readonly rows = computed(() => commentRows(this.filter(), { sentiment: this.sentiment(), kind: this.kind(), department: this.department(), query: this.query() }));
  protected readonly visible = computed(() => this.rows().slice(0, this.shown()));
  protected readonly review = computed(() => this.rows().filter((r) => r.needsReview).length);

  protected readonly int = formatInt;
  protected readonly day = shortDate;
  protected setSentiment(e: Event): void { this.sentiment.set((e.target as HTMLSelectElement).value as Sentiment | 'all'); this.shown.set(PAGE); }
  protected setKind(e: Event): void { this.kind.set((e.target as HTMLSelectElement).value as MentionKind | 'all'); this.shown.set(PAGE); }
  protected setDepartment(e: Event): void { this.department.set((e.target as HTMLSelectElement).value); this.shown.set(PAGE); }
  protected search(e: Event): void { this.query.set((e.target as HTMLInputElement).value); this.shown.set(PAGE); }
  protected reset(): void { this.sentiment.set('all'); this.kind.set('all'); this.department.set('all'); this.query.set(''); this.shown.set(PAGE); }
  protected more(): void { this.shown.update((n) => n + PAGE); }
  protected deptName(id: string): string { return DEPARTMENTS.find((d) => d.id === id)?.label ?? id; }
}
