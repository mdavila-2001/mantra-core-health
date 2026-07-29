import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';

import { ThemeService } from '../../core/tokens/theme.service';
import { AppButtonComponent } from '../../shared/components/atoms/button/app-button.component';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../shared/components/atoms/button/button.types';
import type { ThemeMode } from '../../core/tokens/design-tokens.types';

/** Cuánto dura la carga simulada del sandbox de estados. */
const DEMO_LOADING_MS = 1500;

/**
 * Vitrina de Diseño: acá se expone cada pieza de shared/components
 * (atoms → molecules → organisms) a medida que existe, montada sobre los
 * tokens reales — es la superficie de observación del sistema (y la primera
 * UI del ThemeService).
 */
@Component({
  selector: 'app-design-system-sample',
  imports: [AppButtonComponent],
  templateUrl: './design-system-sample.html',
  styleUrl: './design-system-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemSample {
  private readonly themeService = inject(ThemeService);

  protected readonly variants = BUTTON_VARIANTS;
  protected readonly sizes = BUTTON_SIZES;

  protected readonly theme = this.themeService.currentTheme;
  protected readonly themeOptions: readonly { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Claro' },
    { mode: 'dark', label: 'Oscuro' },
    { mode: 'system', label: 'Sistema' },
  ];

  protected readonly savingDemo = signal(false);
  protected readonly searchingDemo = signal(false);

  protected setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
  }

  protected simulateSave(): void {
    this.runDemoLoading(this.savingDemo);
  }

  protected simulateSearch(): void {
    this.runDemoLoading(this.searchingDemo);
  }

  private runDemoLoading(flag: WritableSignal<boolean>): void {
    flag.set(true);
    setTimeout(() => flag.set(false), DEMO_LOADING_MS);
  }
}
