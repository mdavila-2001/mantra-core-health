import { ChangeDetectionStrategy, Component, computed, inject, input, model, signal } from '@angular/core';

import { CommunityTopicsClient } from '../../../../core/data-access/community/community-topics.client';
import type { Topic } from '../../../../core/data-access/community/community.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { TreeSelect } from '../../../../shared/components/organisms/tree-select/tree-select';
import type { TreeSelectGroup } from '../../../../shared/components/organisms/tree-select/tree-select.types';

/** Sentinel values of the tree: no specific topic, and «create my own». */
export const GENERAL_TOPIC = '';
export const NEW_TOPIC = '__nuevo__';
const OWN_TOPICS_CODE = 'CAT_TEMAS_PROPIOS';

/** Builds the categorized tree: General, each category with its topics, and own topics. */
export function topicGroups(temas: readonly Topic[]): TreeSelectGroup<string>[] {
  const parents = temas.filter((t) => !t.parentTopicId && t.code !== OWN_TOPICS_CODE && temas.some((c) => c.parentTopicId === t.id));
  const own = temas.find((t) => t.code === OWN_TOPICS_CODE);
  const childrenOf = (id: string | undefined) =>
    temas.filter((t) => id !== undefined && t.parentTopicId === id).map((t) => ({ value: t.id, label: t.name }));
  // Loose topics (no category, or an unknown parent) still show up, under «Otros temas».
  const hasChildren = (id: string) => temas.some((t) => t.parentTopicId === id);
  const orphans = temas
    .filter((t) => (t.parentTopicId ? !temas.some((p) => p.id === t.parentTopicId) : !hasChildren(t.id) && t.code !== OWN_TOPICS_CODE))
    .map((t) => ({ value: t.id, label: t.name }));
  return [
    { label: 'General', items: [{ value: GENERAL_TOPIC, label: 'Sin tema específico', hint: 'Abierto a cualquier especialidad' }] },
    ...parents.map((p) => ({ label: p.name, items: childrenOf(p.id) })).filter((g) => g.items.length > 0),
    ...(orphans.length > 0 ? [{ label: 'Otros temas', items: orphans }] : []),
    {
      label: 'Temas propios',
      items: [...childrenOf(own?.id), { value: NEW_TOPIC, label: 'Crear un tema propio…' }],
    },
  ];
}

@Component({
  selector: 'app-group-topic-picker',
  imports: [AppButton, FormField, Input, TreeSelect],
  templateUrl: './topic-picker.html',
  styleUrl: './topic-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupTopicPicker {
  private readonly client = inject(CommunityTopicsClient);

  readonly temas = input<readonly Topic[]>([]);
  readonly value = model<string | null>(null);

  private readonly created = signal<readonly Topic[]>([]);
  protected readonly creating = signal(false);
  protected readonly saving = signal(false);
  protected readonly newName = signal<string | number | null>('');
  protected readonly error = signal('');

  protected readonly groups = computed(() => {
    const known = new Set(this.temas().map((t) => t.id));
    return topicGroups([...this.temas(), ...this.created().filter((t) => !known.has(t.id))]);
  });
  protected readonly choice = computed(() => (this.creating() ? NEW_TOPIC : (this.value() ?? GENERAL_TOPIC)));
  protected readonly canCreate = computed(() => String(this.newName() ?? '').trim().length >= 3 && !this.saving());

  protected choose(next: string | null): void {
    if (next === null) return;
    this.creating.set(next === NEW_TOPIC);
    this.error.set('');
    if (next !== NEW_TOPIC) this.value.set(next === GENERAL_TOPIC ? null : next);
  }

  protected cancelCreate(): void {
    this.creating.set(false);
    this.newName.set('');
    this.error.set('');
  }

  protected create(): void {
    if (!this.canCreate()) return;
    this.saving.set(true);
    this.error.set('');
    this.client.createTopic(String(this.newName()).trim()).subscribe({
      next: (topic) => {
        this.created.update((list) => [...list, topic]);
        this.value.set(topic.id);
        this.saving.set(false);
        this.cancelCreate();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo crear el tema. Intente de nuevo.');
      },
    });
  }
}

/** Same tree for filtering a list: «Todos los temas» first, no «create» entry. */
export function topicFilterGroups(temas: readonly Topic[]): TreeSelectGroup<string>[] {
  const [, ...rest] = topicGroups(temas);
  const groups = rest.map((g) => ({ ...g, items: g.items.filter((i) => i.value !== NEW_TOPIC) }));
  return [{ label: 'Sin filtro', items: [{ value: GENERAL_TOPIC, label: 'Todos los temas' }] }, ...groups.filter((g) => g.items.length > 0)];
}
