import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';

import type { ThemeMode } from '@core/tokens/design-tokens.types';
import { ThemeService } from '@core/tokens/theme.service';

import {
  Avatar,
  AVATAR_SIZES,
  AvatarGroupComponent,
  Badge,
  BADGE_SIZES,
  BADGE_VARIANTS,
  AppButtonComponent,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  CheckboxComponent,
  DatePickerComponent,
  FileInputComponent,
  FormFieldComponent,
  InputComponent,
  RadioComponent,
  RadioGroupComponent,
  SelectComponent,
  SwitchComponent,
  type SelectOption,
} from '@shared';

const DEMO_LOADING_MS = 1500;

@Component({
  selector: 'app-design-system-sample',
  standalone: true,
  imports: [
    Avatar,
    AvatarGroupComponent,
    Badge,
    AppButtonComponent,
    InputComponent,
    CheckboxComponent,
    RadioComponent,
    RadioGroupComponent,
    SwitchComponent,
    SelectComponent,
    FileInputComponent,
    FormFieldComponent,
    DatePickerComponent,
  ],
  templateUrl: './design-system-sample.html',
  styleUrl: './design-system-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemSample {
  private readonly themeService = inject(ThemeService);

  protected readonly variants = BUTTON_VARIANTS;
  protected readonly sizes = BUTTON_SIZES;

  protected readonly avatarSizes = AVATAR_SIZES;
  /** Nombres de muestra: cada uno cae en su tono por hash, no por elección. */
  protected readonly equipo = [
    'Andrea Peña',
    'Bruno Salas',
    'Carla Ruiz',
    'Diego Mamani',
  ] as const;

  protected readonly badgeVariants = BADGE_VARIANTS;
  protected readonly badgeSizes = BADGE_SIZES;

  protected readonly theme = this.themeService.currentTheme;
  protected readonly themeOptions: readonly { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: 'Claro' },
    { mode: 'dark', label: 'Oscuro' },
    { mode: 'system', label: 'Sistema' },
  ];

  protected readonly savingDemo = signal(false);
  protected readonly searchingDemo = signal(false);

  /* Señales para pruebas de controles de formulario */
  protected readonly textVal = signal('Juan Pérez');
  protected readonly emailVal = signal('usuario@redsat.salud.bo');
  protected readonly numVal = signal<number | null>(120.5);
  protected readonly passVal = signal('SecretPass123!');
  protected readonly searchVal = signal('Cardiología');
  protected readonly urlVal = signal('https://redsat.salud.bo');

  protected readonly checkboxVal = signal(true);
  protected readonly radioVal = signal('paciente');
  protected readonly switchVal = signal(true);
  protected readonly selectVal = signal('consulta');

  protected readonly dateOnlyVal = signal<Date | null>(new Date());
  protected readonly dateTimeVal = signal<Date | null>(new Date());
  protected readonly fileList = signal<readonly File[]>([]);

  protected readonly selectOptions: SelectOption<string>[] = [
    { value: 'consulta', label: 'Consulta General' },
    { value: 'emergencia', label: 'Emergencias Médicas' },
    { value: 'laboratorio', label: 'Examen de Laboratorio' },
    { value: 'pediatria', label: 'Atención Pediátrica' },
  ];

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
