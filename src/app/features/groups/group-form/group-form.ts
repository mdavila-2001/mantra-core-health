import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import type { OwnPublicProfile, Topic } from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { MinShowcase } from '../../communities/minimal-showcase/minimal-showcase';

export interface GroupFormData {
  name: string;
  slug: string;
  description?: string;
  visibility: 'PUBLIC' | 'PRIVATE';
  topicId?: string;
  groupType: 'GENERAL' | 'SUPPORT';
}

export function deriveGroupSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

@Component({
  selector: 'app-group-form',
  imports: [AppButton, Card, FormField, Input, MinShowcase, Select],
  templateUrl: './group-form.html',
  styleUrl: './group-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupForm {
  readonly temas = input<readonly Topic[]>([]);
  readonly perfilListo = input<boolean>(false);
  readonly guardando = input<boolean>(false);

  readonly submitForm = output<GroupFormData>();
  readonly cancel = output<void>();
  readonly showcaseCreated = output<OwnPublicProfile>();

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly topicId = signal<string | null>(null);
  protected readonly groupType = signal<'GENERAL' | 'SUPPORT'>('GENERAL');
  protected readonly visibility = signal<'PUBLIC' | 'PRIVATE'>('PRIVATE');

  protected readonly slug = computed(() => deriveGroupSlug(this.name()));
  protected readonly canSubmit = computed(() => this.slug().length > 0 && !this.guardando());

  protected readonly topicOptions = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'General (sin tema específico)', description: 'Abierto a cualquier especialidad' },
    ...this.temas().map((t) => ({ value: t.id, label: t.name })),
  ]);

  protected readonly typeOptions: readonly SelectOption<'GENERAL' | 'SUPPORT'>[] = [
    { value: 'GENERAL', label: 'General', description: 'Comunidad para casos clínicos, guías y debate' },
    { value: 'SUPPORT', label: 'Apoyo', description: 'Grupo de acompañamiento y soporte mutuo' },
  ];

  protected readonly visibilityOptions = computed<readonly SelectOption<'PUBLIC' | 'PRIVATE'>[]>(() => {
    const listo = this.perfilListo();
    return [
      {
        value: 'PRIVATE',
        label: 'Privado',
        description: 'Ingreso por invitación o aprobación de quien administra',
      },
      {
        value: 'PUBLIC',
        label: 'Público',
        description: listo
          ? 'Visible en el directorio para toda la organización'
          : 'Requiere perfil público con foto y visibilidad pública',
        disabled: !listo,
      },
    ];
  });

  protected onSubmit(): void {
    if (!this.canSubmit()) return;
    this.submitForm.emit({
      name: this.name().trim(),
      slug: this.slug(),
      description: this.description().trim() || undefined,
      visibility: this.perfilListo() ? this.visibility() : 'PRIVATE',
      topicId: this.topicId() ?? undefined,
      groupType: this.groupType(),
    });
  }
}
