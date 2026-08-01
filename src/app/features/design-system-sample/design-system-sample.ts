import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';

import type { ThemeMode } from '../../core/tokens/design-tokens.types';
import { ThemeService } from '../../core/tokens/theme.service';

import { Avatar } from '../../shared/components/atoms/avatar/avatar';
import { AVATAR_SIZES } from '../../shared/components/atoms/avatar/avatar.types';
import { AvatarGroupComponent } from '../../shared/components/atoms/avatar-group/avatar-group';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { BADGE_SIZES, BADGE_VARIANTS } from '../../shared/components/atoms/badge/badge.types';
import { AppButtonComponent } from '../../shared/components/atoms/button/app-button';
import { BUTTON_SIZES, BUTTON_VARIANTS } from '../../shared/components/atoms/button/button.types';

import { CheckboxComponent } from '../../shared/components/atoms/checkbox/checkbox';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { CHIP_VARIANTS } from '../../shared/components/atoms/chip/chip.types';
import { Divider } from '../../shared/components/atoms/divider/divider';
import { FileInputComponent } from '../../shared/components/atoms/file-input/file-input';
import { InputComponent } from '../../shared/components/atoms/input/input';
import type { SelectOption } from '../../shared/components/atoms/input/input.types';
import { Link } from '../../shared/components/atoms/link/link';
import { LINK_VARIANTS } from '../../shared/components/atoms/link/link.types';
import { Progress } from '../../shared/components/atoms/progress/progress';
import { PROGRESS_TONES } from '../../shared/components/atoms/progress/progress.types';
import { RadioComponent } from '../../shared/components/atoms/radio/radio';
import { RadioGroupComponent } from '../../shared/components/atoms/radio-group/radio-group';
import { SelectComponent } from '../../shared/components/atoms/select/select';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { Spinner } from '../../shared/components/atoms/spinner/spinner';
import { SPINNER_SIZES } from '../../shared/components/atoms/spinner/spinner.types';
import { SwitchComponent } from '../../shared/components/atoms/switch/switch';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import { TOOLTIP_POSITIONS } from '../../shared/components/atoms/tooltip/tooltip.types';

import { Accordion } from '../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { ALERT_TONES } from '../../shared/components/molecules/alert/alert.types';
import { Breadcrumb } from '../../shared/components/molecules/breadcrumb/breadcrumb';
import type { BreadcrumbItem } from '../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Card } from '../../shared/components/molecules/card/card';
import { CARD_VARIANTS } from '../../shared/components/molecules/card/card.types';
import { DatePickerComponent } from '../../shared/components/molecules/date-picker/date-picker';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormFieldComponent } from '../../shared/components/molecules/form-field/form-field';
import { Menu } from '../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../shared/components/molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../shared/components/molecules/menu/menu-trigger/menu-trigger';
import { Pagination } from '../../shared/components/molecules/pagination/pagination';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { Toast } from '../../shared/components/molecules/toast/toast';
import {
  TOAST_TYPES,
  type ToastMessage,
} from '../../shared/components/molecules/toast/toast.types';

import { DEMO_TOASTS, PERSISTENT_DEMO_TOAST } from '../../core/dev/toast-samples';

const DEMO_LOADING_MS = 1500;
const DEMO_UPLOAD_TICK_MS = 220;
const DEMO_UPLOAD_STEP = 12;

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
    Toast,
    Textarea,
    Spinner,
    Tooltip,
    Chip,
    Divider,
    Link,
    Skeleton,
    Progress,
    Card,
    SearchField,
    Alert,
    Menu,
    MenuItem,
    MenuTrigger,
    Tabs,
    Tab,
    Pagination,
    Breadcrumb,
    EmptyState,
    Accordion,
    AccordionPanel,
  ],
  templateUrl: './design-system-sample.html',
  styleUrl: './design-system-sample.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignSystemSample {
  private readonly themeService = inject(ThemeService);
  private readonly dialogs = inject(DialogService);

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

  protected readonly spinnerSizes = SPINNER_SIZES;
  protected readonly cardVariants = CARD_VARIANTS;
  protected readonly alertTones = ALERT_TONES;
  protected readonly tooltipPositions = TOOLTIP_POSITIONS;
  protected readonly chipVariants = CHIP_VARIANTS;
  protected readonly linkVariants = LINK_VARIANTS;
  protected readonly progressTones = PROGRESS_TONES;

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

  protected readonly evolucionVal = signal(
    'Paciente refiere dolor torácico opresivo de 2 horas de evolución.',
  );
  protected readonly notaBreveVal = signal('');
  protected readonly indicacionesVal = signal('');

  /** Filtros de un listado: quitarlos saca el chip de la barra, como en producción. */
  protected readonly filtrosActivos = signal<readonly string[]>([
    'Cardiología',
    'Turno mañana',
    'Con obra social',
  ]);
  protected readonly soloUrgencias = signal(true);

  /** Progreso de una subida simulada, para ver la barra moverse de verdad. */
  protected readonly subidaProgreso = signal(0);

  /* ---- moléculas --------------------------------------------------------- */

  protected readonly filtroPacientes = signal('');
  protected readonly buscandoPacientes = signal(false);
  protected readonly ultimaBusqueda = signal('—');

  protected readonly avisoVisible = signal(true);

  protected readonly seccionFicha = signal(0);
  protected readonly paginaActual = signal(1);
  protected readonly tamanoPagina = signal(20);

  protected readonly ultimaAccion = signal('—');
  protected readonly ultimaConfirmacion = signal('—');

  /** Ruta larga: se colapsa sola y el «…» abre el menú con los ocultos. */
  protected readonly rutaLarga: readonly BreadcrumbItem[] = [
    { label: 'Red SALUD', routerLink: '/' },
    { label: 'La Paz', routerLink: '/design-system' },
    { label: 'Hospital Central', routerLink: '/design-system' },
    { label: 'Cardiología', routerLink: '/design-system' },
    { label: 'Juan Pérez', routerLink: '/design-system' },
    { label: 'Episodio 2026-07-31' },
  ];

  protected readonly rutaCorta: readonly BreadcrumbItem[] = [
    { label: 'Red SALUD', routerLink: '/' },
    { label: 'Hospital Central', routerLink: '/design-system' },
    { label: 'Juan Pérez' },
  ];

  protected readonly dateOnlyVal = signal<Date | null>(new Date());
  protected readonly dateTimeVal = signal<Date | null>(new Date());
  protected readonly fileList = signal<readonly File[]>([]);

  protected readonly selectOptions: SelectOption<string>[] = [
    { value: 'consulta', label: 'Consulta General' },
    { value: 'emergencia', label: 'Emergencias Médicas' },
    { value: 'laboratorio', label: 'Examen de Laboratorio' },
    { value: 'pediatria', label: 'Atención Pediátrica' },
  ];

  /* ---- Avisos (Toast) ---------------------------------------------------
     La cola vive acá, no en un servicio: los dos componentes son
     presentacionales. Quien monta el contenedor es dueño de agregar, vencer
     por tiempo y quitar. */

  /** Los cuatro tonos más el aviso fijo, quietos: la galería es apariencia. */
  protected readonly toastSamples: readonly ToastMessage[] = [
    ...TOAST_TYPES.map((type) => ({ id: `muestra-${type}`, ...DEMO_TOASTS[type] })),
    { id: 'muestra-fijo', ...PERSISTENT_DEMO_TOAST },
  ];

  /** La data cruda de cada muestra, no solo el dibujo. */
  protected readonly toastSamplesJson = JSON.stringify(this.toastSamples, null, 2);

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

  protected quitarFiltro(filtro: string): void {
    this.filtrosActivos.update((filtros) => filtros.filter((activo) => activo !== filtro));
  }

  protected reponerFiltros(): void {
    this.filtrosActivos.set(['Cardiología', 'Turno mañana', 'Con obra social']);
  }

  /**
   * Simula una búsqueda real: el spinner aparece mientras «viaja» la consulta.
   * Es la única forma de ver el debounce funcionando en la vitrina.
   */
  protected buscarPacientes(termino: string): void {
    this.ultimaBusqueda.set(termino === '' ? '(vacío)' : termino);
    this.buscandoPacientes.set(true);
    setTimeout(() => this.buscandoPacientes.set(false), DEMO_LOADING_MS);
  }

  protected registrarAccion(accion: string): void {
    this.ultimaAccion.set(accion);
  }

  protected async confirmarAnulacion(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Anular la orden de laboratorio',
      message:
        'La orden queda anulada y el laboratorio deja de verla. Esta acción no se puede deshacer.',
      confirmLabel: 'Anular orden',
      destructive: true,
    });
    this.ultimaConfirmacion.set(confirmado ? 'Confirmó la anulación' : 'Canceló');
  }

  protected async confirmarGuardado(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Guardar la evolución',
      message: 'La evolución queda registrada en la historia clínica del paciente.',
      confirmLabel: 'Guardar',
    });
    this.ultimaConfirmacion.set(confirmado ? 'Confirmó el guardado' : 'Canceló');
  }

  /** Sube de a saltos hasta el 100 % y vuelve a empezar: la barra se ve avanzar. */
  protected simulateUpload(): void {
    this.subidaProgreso.set(0);
    const paso = (): void => {
      this.subidaProgreso.update((valor) => Math.min(100, valor + DEMO_UPLOAD_STEP));
      if (this.subidaProgreso() < 100) {
        setTimeout(paso, DEMO_UPLOAD_TICK_MS);
      }
    };
    setTimeout(paso, DEMO_UPLOAD_TICK_MS);
  }
}
