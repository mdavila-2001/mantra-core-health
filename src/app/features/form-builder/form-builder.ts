import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { ChartTemplatesClient } from '../../core/data-access/chart-templates/chart-templates.client';
import type {
  ChartTemplate,
  ChartTemplateField,
} from '../../core/data-access/chart-templates/chart-templates.types';
import { FormsClient } from '../../core/data-access/forms/forms.client';
import type {
  ExtensionBudget,
  TechnicalDataType,
} from '../../core/data-access/forms/forms.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../shared/components/atoms/input/input';
import { Progress } from '../../shared/components/atoms/progress/progress';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../shared/forms/paginated/paginar-campos';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
  TipoDeControl,
} from '../../shared/forms/paginated/paginated-form.types';

/**
 * Los tipos de dato que este generador ofrece.
 *
 * Mismo subconjunto que el editor de plantillas del administrador, y por el
 * mismo motivo: `uuid`, `json`, `binary`, `reference` y `code` piden un dato
 * que esta pantalla no pide —un target de referencia, un archivo, un concepto
 * del catálogo—, así que ofrecerlos dejaría campos que el backend rechaza al
 * completarse. Estos seis son los que un campo propio usa en la práctica.
 */
const TIPOS_DE_DATO: readonly SelectOption<string>[] = [
  { value: 'string', label: 'Texto corto' },
  { value: 'text', label: 'Texto largo' },
  { value: 'integer', label: 'Número entero' },
  { value: 'decimal', label: 'Número decimal' },
  { value: 'boolean', label: 'Sí / No' },
  { value: 'date', label: 'Fecha' },
];

/** Cómo se dibuja cada tipo de dato cuando el formulario se sirve. */
const CONTROL_POR_TIPO: Readonly<Record<string, TipoDeControl>> = {
  string: 'text',
  text: 'textarea',
  integer: 'number',
  decimal: 'number',
  boolean: 'checkbox',
  date: 'date',
};

/**
 * **Formularios** — el generador con el que un doctor extiende un formulario
 * estándar con los campos de su consultorio.
 *
 * ## Qué es, y qué no
 *
 * No es un constructor de formularios en blanco. El catálogo de formularios
 * clínicos estándar por especialidad ya existe y está sembrado
 * (`chart.specialty_chart_templates`); lo que faltaba es que quien atiende
 * pueda **agregarle lo suyo** —«¿fuma?», «peso al ingreso»— sin pedirle a un
 * administrador que le arme una plantilla paralela. Los campos del estándar se
 * ven y no se tocan: son la parte que hace comparable una ficha entre
 * consultorios.
 *
 * ## Por qué hay un presupuesto a la vista
 *
 * La gobernanza de extensibilidad del backend (`extension_target_policies`)
 * declara cuántos campos propios admite el target. Se pregunta **antes** de
 * ofrecer el alta y se muestra siempre: sin eso la pantalla ofrece un botón y
 * el techo aparece como un error del servidor cuando la persona ya escribió el
 * campo. Un formulario que no admite extensión lo dice de entrada, en vez de
 * dejar probar.
 *
 * ## La vista previa no es un adorno
 *
 * Los campos que se agregan acá los sirve el mismo motor que sirve todo lo
 * demás: **de a una página, con tope de cuatro y barra de avance**. La vista
 * previa es ese motor, con los campos reales, así que el número de páginas que
 * muestra es el que va a ver el paciente. Es la única forma de que quien agrega
 * el quinto campo vea, en el momento, que acaba de abrir una página nueva.
 *
 * ## Dos llamadas, no una
 *
 * Declarar el campo (`POST /forms/field-definitions`) y colgarlo del formulario
 * (`POST /forms/assignments`) son dos permisos distintos del backend. Se hacen
 * en ese orden y se informan por separado: si la segunda falla, el campo quedó
 * declarado y sin colgar, y decir «no se pudo crear el campo» sería mentir.
 */
@Component({
  selector: 'app-form-builder',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    Checkbox,
    EmptyState,
    FormField,
    Input,
    PageHeader,
    PaginatedForm,
    Progress,
    Select,
  ],
  templateUrl: './form-builder.html',
  styleUrl: './form-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormBuilder {
  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly forms = inject(FormsClient);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tiposDeDato = TIPOS_DE_DATO;

  /* -- Los formularios estándar que se pueden extender ---------------------- */

  protected readonly plantillas =
    signal<ViewState<readonly ChartTemplate[]>>(loading());

  /** La plantilla abierta, con su esquema ya resuelto. */
  protected readonly abierta = signal<ChartTemplate | null>(null);
  protected readonly cargandoPlantilla = signal(false);

  protected readonly presupuesto = signal<ExtensionBudget | null>(null);

  constructor() {
    this.cargarPlantillas();
  }

  /**
   * Las plantillas ya leídas, o `null` mientras no haya lista.
   *
   * La plantilla del componente narra tres casos —cargando, vacío, lista— y
   * mirar el discriminante desde el HTML obliga a un `$any` para que el
   * compilador de plantillas acepte `.data`. Se estrecha acá, donde el tipo se
   * conserva.
   */
  protected readonly listado = computed<readonly ChartTemplate[] | null>(() => {
    const state = this.plantillas();
    return state.status === 'ready' ? state.data : null;
  });

  protected readonly cargandoListado = computed(
    () => this.plantillas().status === 'loading',
  );

  protected recargar(): void {
    this.cargarPlantillas();
  }

  private cargarPlantillas(): void {
    this.plantillas.set(loading());
    this.chartTemplates.listTemplates().subscribe({
      next: (lista) => this.plantillas.set(ready(lista)),
      error: (error: unknown) =>
        this.plantillas.set(errorToViewState<readonly ChartTemplate[]>(error)),
    });
  }

  protected abrir(plantilla: ChartTemplate): void {
    this.cargandoPlantilla.set(true);
    this.presupuesto.set(null);
    this.alta.set(ready(null));
    this.chartTemplates.getTemplate(plantilla.id).subscribe({
      next: (detalle) => {
        this.abierta.set(detalle);
        this.cargandoPlantilla.set(false);
        this.limpiarCampoNuevo();
        this.cargarPresupuesto(detalle);
      },
      error: (error: unknown) => {
        this.cargandoPlantilla.set(false);
        this.alta.set(errorToViewState<null>(error));
      },
    });
  }

  protected cerrar(): void {
    this.abierta.set(null);
    this.presupuesto.set(null);
  }

  private cargarPresupuesto(plantilla: ChartTemplate): void {
    this.forms.getExtensionBudget(plantilla.fieldTargetConceptId).subscribe({
      next: (budget) => this.presupuesto.set(budget),
      // Un presupuesto que no se pudo leer se muestra como desconocido, no como
      // cero: bloquear el alta por un fallo de lectura sería inventar una regla.
      error: () => this.presupuesto.set(null),
    });
  }

  /* -- Los campos, separados por quién los puso ----------------------------- */

  protected readonly camposEstandar = computed<readonly ChartTemplateField[]>(
    () => (this.abierta()?.fields ?? []).filter((campo) => !campo.own),
  );

  protected readonly camposPropios = computed<readonly ChartTemplateField[]>(
    () => (this.abierta()?.fields ?? []).filter((campo) => campo.own),
  );

  /* -- El presupuesto, en palabras ------------------------------------------ */

  /** Si la política deja colgar campos propios. Sin presupuesto leído, se deja probar. */
  protected readonly admiteCamposPropios = computed(() => {
    const budget = this.presupuesto();
    return budget === null || budget.allowTenantFields;
  });

  protected readonly quedanCampos = computed(() => {
    const budget = this.presupuesto();
    if (budget === null || budget.remaining === undefined) {
      return true;
    }
    return budget.remaining > 0;
  });

  /** «3 de 12 campos propios», o el consumo a secas cuando no hay tope. */
  protected readonly presupuestoEnPalabras = computed<string | null>(() => {
    const budget = this.presupuesto();
    if (budget === null) {
      return null;
    }
    if (budget.maximumFields === undefined) {
      return `${budget.used} campo(s) propio(s), sin tope declarado`;
    }
    return `${budget.used} de ${budget.maximumFields} campos propios`;
  });

  /** Cuánto del presupuesto está consumido, en porcentaje, para la barra. */
  protected readonly presupuestoConsumido = computed<number | null>(() => {
    const budget = this.presupuesto();
    if (budget?.maximumFields === undefined || budget.maximumFields === 0) {
      return null;
    }
    return Math.min(100, Math.round((budget.used / budget.maximumFields) * 100));
  });

  /* -- Alta de un campo propio ---------------------------------------------- */

  protected readonly nombreDelCampo = signal('');
  protected readonly tipoDelCampo = signal<string>('string');
  protected readonly obligatorio = signal(false);
  protected readonly creando = signal(false);
  protected readonly alta = signal<ViewState<null>>(ready(null));

  protected readonly comoTexto = (valor: string | number | null): string =>
    valor === null ? '' : String(valor);

  protected readonly puedeCrear = computed(
    () =>
      this.abierta() !== null &&
      this.nombreDelCampo().trim() !== '' &&
      this.admiteCamposPropios() &&
      this.quedanCampos() &&
      !this.creando(),
  );

  protected readonly errorDelAlta = computed<string | null>(() => {
    const state = this.alta();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return (
        state.message ??
        'Tu organización no puede agregar campos a este formulario.'
      );
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected agregarCampo(): void {
    const plantilla = this.abierta();
    const name = this.nombreDelCampo().trim();
    if (plantilla === null || name === '' || this.creando()) {
      return;
    }

    const dataType = this.tipoDelCampo() as TechnicalDataType;
    const required = this.obligatorio();
    const code = codigoDeCampo(plantilla.code, name);

    this.creando.set(true);
    this.alta.set(loading());

    this.forms.createFieldDefinition({ code, name, dataType }).subscribe({
      next: (fieldId) => this.colgar(plantilla, fieldId, required, name),
      error: (error: unknown) => {
        this.creando.set(false);
        this.alta.set(errorToViewState<null>(error));
      },
    });
  }

  /**
   * La segunda mitad del alta: colgar el campo ya declarado.
   *
   * Se informa aparte a propósito. Un fallo acá deja un campo declarado en el
   * catálogo global y sin asignar a ningún formulario: no es «no se pudo crear
   * el campo», es «se creó y no se pudo colgar», y son dos cosas distintas para
   * quien tiene que volver a intentarlo.
   */
  private colgar(
    plantilla: ChartTemplate,
    fieldId: string,
    required: boolean,
    name: string,
  ): void {
    this.forms
      .createAssignment({
        fieldId,
        targetResourceConceptId: plantilla.fieldTargetConceptId,
        ...(plantilla.sectionId === undefined
          ? {}
          : { sectionId: plantilla.sectionId }),
        required,
        ordinal: plantilla.fields.length,
      })
      .subscribe({
        next: () => {
          this.creando.set(false);
          this.alta.set(ready(null));
          this.toasts.success(
            `«${name}» ya forma parte de ${plantilla.name}.`,
            'Campo agregado',
          );
          this.limpiarCampoNuevo();
          this.abrir(plantilla);
        },
        error: (error: unknown) => {
          this.creando.set(false);
          this.alta.set(errorToViewState<null>(error));
        },
      });
  }

  private limpiarCampoNuevo(): void {
    this.nombreDelCampo.set('');
    this.tipoDelCampo.set('string');
    this.obligatorio.set(false);
  }

  /* -- La vista previa, con el motor de verdad ------------------------------ */

  /**
   * Las páginas tal como el motor las va a servir, con el campo que se está
   * escribiendo ya incluido.
   *
   * Incluirlo antes de guardarlo es lo que convierte la vista previa en una
   * respuesta y no en un resumen: se ve que el quinto campo abre una página
   * nueva **mientras** se decide agregarlo.
   */
  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const plantilla = this.abierta();
    if (plantilla === null) {
      return [];
    }

    const campos: CampoDeFormulario[] = plantilla.fields.map((campo) =>
      aCampoDelMotor(campo.fieldId, campo.name, campo.dataType, campo.required),
    );

    const enCurso = this.nombreDelCampo().trim();
    if (enCurso !== '') {
      campos.push(
        aCampoDelMotor(
          BORRADOR,
          enCurso,
          this.tipoDelCampo(),
          this.obligatorio(),
        ),
      );
    }

    return paginarCampos(campos, { tituloPorDefecto: plantilla.name });
  });

  /** El grupo que la vista previa necesita: se mira, no se envía a ningún lado. */
  protected readonly formularioDeMuestra = computed<FormGroup>(() => {
    const grupo = new FormGroup({});
    for (const pagina of this.paginas()) {
      for (const campo of pagina.campos) {
        grupo.addControl(
          campo.key,
          new FormControl<unknown>(
            campo.control === 'checkbox' ? false : '',
            campo.required === true ? [Validators.required] : [],
          ),
        );
      }
    }
    return grupo;
  });

  protected readonly porCampo = (campo: ChartTemplateField): string =>
    campo.assignmentId;

  protected readonly porPlantilla = (plantilla: ChartTemplate): string =>
    plantilla.id;

  /** El código pelado de un campo, sin el prefijo de su plantilla. */
  protected codigoVisible(campo: ChartTemplateField, plantilla: ChartTemplate): string {
    const prefijo = `${plantilla.code}.`;
    return campo.code.startsWith(prefijo)
      ? campo.code.slice(prefijo.length)
      : campo.code;
  }
}

/** La `key` del campo que todavía no existe, en la vista previa. */
const BORRADOR = '__borrador__';

/** De un campo de la plantilla a lo que el motor de formularios sabe pintar. */
function aCampoDelMotor(
  key: string,
  label: string,
  dataType: string,
  required: boolean,
): CampoDeFormulario {
  return {
    key,
    label,
    control: CONTROL_POR_TIPO[dataType] ?? 'text',
    required,
  };
}

/**
 * El código único del campo, derivado de su nombre.
 *
 * `forms.dynamic_field_definitions` es una **tabla global**: dos consultorios
 * que agreguen «Fuma» a formularios distintos chocarían por el código. Se
 * prefija con el de la plantilla —igual que hace el seed del catálogo— y se
 * sufija con el instante, que es lo que distingue el «Fuma» de una organización
 * del de otra sobre el mismo formulario. Nada de esto se muestra: lo que se
 * dibuja es el nombre.
 */
function codigoDeCampo(codigoDePlantilla: string, nombre: string): string {
  const raiz = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${codigoDePlantilla}.${raiz || 'CAMPO'}_${Date.now().toString(36).toUpperCase()}`;
}
