import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';

import { JsonPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import type { ThemeMode } from '../../core/tokens/design-tokens.types';
import { ThemeService } from '../../core/tokens/theme.service';

import { Avatar } from '../../shared/components/atoms/avatar/avatar';
import { AVATAR_SIZES } from '../../shared/components/atoms/avatar/avatar.types';
import { AvatarGroup } from '../../shared/components/atoms/avatar-group/avatar-group';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { BADGE_SIZES, BADGE_VARIANTS } from '../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../shared/components/atoms/button/button.types';

import { Checkbox } from '../../shared/components/atoms/checkbox/checkbox';
import { FileInput } from '../../shared/components/atoms/file-input/file-input';
import { Input } from '../../shared/components/atoms/input/input';
import type { SelectOption } from '../../shared/components/atoms/input/input.types';
import { Radio } from '../../shared/components/atoms/radio/radio';
import { RadioGroup } from '../../shared/components/atoms/radio-group/radio-group';
import { Select } from '../../shared/components/atoms/select/select';
import { Switch } from '../../shared/components/atoms/switch/switch';

import { DatePicker } from '../../shared/components/molecules/date-picker/date-picker';
import { FormField } from '../../shared/components/molecules/form-field/form-field';

import { ViewStateGallery } from './view-state-gallery/view-state-gallery';

const DEMO_LOADING_MS = 1500;

@Component({
  selector: 'app-design-system-sample',
  standalone: true,
  imports: [
    Avatar,
    AvatarGroup,
    Badge,
    AppButton,
    Input,
    Checkbox,
    Radio,
    RadioGroup,
    Switch,
    Select,
    FileInput,
    FormField,
    DatePicker,
    ViewStateGallery,
    ReactiveFormsModule,
    JsonPipe,
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

  /**
   * Formulario reactivo de prueba: demuestra que los átomos con
   * `ControlValueAccessor` se enchufan a un `FormGroup` como lo haría el control
   * nativo. Es la referencia viva de la decisión D1 del plan.
   */
  protected readonly demoForm = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    acepta: new FormControl(false, { nonNullable: true }),
    tipo: new FormControl<string | null>(null, { validators: [Validators.required] }),
  });

  protected rellenarDemoForm(): void {
    this.demoForm.setValue({
      nombre: 'Ana Paz',
      correo: 'ana.paz@redsat.salud.bo',
      acepta: true,
      tipo: 'consulta',
    });
  }

  protected alternarDemoForm(): void {
    if (this.demoForm.disabled) {
      this.demoForm.enable();
      return;
    }
    this.demoForm.disable();
  }

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
