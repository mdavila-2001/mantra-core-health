import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, viewChild } from '@angular/core';

import { InsightsPreferences, type Density, type ThemeChoice } from '../insights-preferences';

/** Ajustes del portal: densidad y tema. Se guardan en el API, por usuario. */
@Component({
  selector: 'app-ins-settings',
  templateUrl: './settings-drawer.html',
  styleUrl: './settings-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDrawer {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  protected readonly prefs = inject(InsightsPreferences);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly densities: readonly { value: Density; label: string }[] = [{ value: 'comfortable', label: 'Cómoda' }, { value: 'compact', label: 'Compacta' }];
  protected readonly themes: readonly { value: ThemeChoice; label: string }[] = [{ value: 'system', label: 'Según el sistema' }, { value: 'light', label: 'Claro' }, { value: 'dark', label: 'Oscuro' }];
  private readonly sync = effect(() => {
    const el = this.dialog()?.nativeElement;
    if (!el) return;
    if (this.open() && !el.open) el.showModal();
    if (!this.open() && el.open) el.close();
  });
}
