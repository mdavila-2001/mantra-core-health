import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { concatMap, of } from 'rxjs';

import { ChartTemplatesClient } from '../../core/data-access/chart-templates/chart-templates.client';
import type {
  ChartTemplate,
  ChartTemplateField,
  ChartTemplateProvenance,
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
import { familiaDe } from '../../shared/components/atoms/data-type-icon/data-type-icon';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import { Progress } from '../../shared/components/atoms/progress/progress';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import {
  aTipoDeCampo,
  FieldEditor,
  type CambiosDelCampo,
  type TipoDeCampo,
} from './field-editor/field-editor';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../shared/forms/paginated/paginar-campos';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
  TipoDeControl,
} from '../../shared/forms/paginated/paginated-form.types';

/**
 * Cómo se dibuja cada tipo de dato cuando el formulario se sirve.
 *
 * La clave es el tipo **ya normalizado** por `aTipoDeCampo`, no el `dataType`
 * crudo: los campos del estándar vienen en el vocabulario del seed clínico
 * (`NUMBER`, `TEXT`) y buscarlos así no acertaba ninguno, con lo que la presión
 * sistólica se servía como caja de texto libre y aceptaba letras.
 */
const CONTROL_POR_TIPO: Readonly<Record<TipoDeCampo, TipoDeControl>> = {
  string: 'text',
  text: 'textarea',
  integer: 'number',
  decimal: 'number',
  boolean: 'checkbox',
  date: 'date',
  // Los de elección no llegan acá: `aCampoDelMotor` los resuelve antes, porque
  // su control depende de cuántas opciones tienen y de si admiten varias.
  choice: 'radio',
  checkboxes: 'checkboxes',
};

/**
 * A partir de cuántas opciones un campo de una sola respuesta se despliega.
 *
 * Es la regla de siempre de las pantallas migradas —hasta cuatro se ven, más
 * de cuatro se despliegan—, la misma que documenta `CampoDeFormulario.options`.
 */
const OPCIONES_QUE_ENTRAN_A_LA_VISTA = 4;

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
    Card,
    EmptyState,
    FieldEditor,
    NavIcon,
    PageHeader,
    PaginatedForm,
    Progress,
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
        this.enPrevia.set(false);
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

  /**
   * De dónde salió el formulario abierto, si vino del catálogo sembrado.
   *
   * Se muestra junto al aviso de que no se puede modificar porque es la mitad
   * que lo explica: no es una regla del producto, es que el documento es de un
   * organismo y se usa bajo una licencia. Ausente en las plantillas que un
   * administrador armó a mano — ahí el aviso va solo.
   */
  protected readonly procedencia = computed<ChartTemplateProvenance | null>(
    () => this.abierta()?.provenance ?? null,
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

  /* -- Los campos propios: agregar, editar, quitar y reordenar --------------- */

  protected readonly creando = signal(false);
  protected readonly alta = signal<ViewState<null>>(ready(null));

  /**
   * Si la pantalla está mostrando la vista previa en vez del editor.
   *
   * Una a la vez y no las dos en paralelo: la previa al lado partía la pantalla
   * en dos columnas y dejaba el editor en media, que es donde se trabaja.
   */
  protected readonly enPrevia = signal(false);

  /** El campo con una petición en vuelo, para su botón. */
  protected readonly guardandoCampo = signal<string | null>(null);

  protected readonly puedeCrear = computed(
    () =>
      this.abierta() !== null &&
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

  /** Alterna entre el editor y la previa, plegando lo que estuviera abierto. */
  protected alternarPrevia(): void {
    this.enPrevia.update((activa) => !activa);
  }

  /**
   * Agrega un campo vacío **y lo abre**.
   *
   * Vacío y no con un formulario aparte que lo componga: es lo que hace un
   * editor —aparece la fila y se escribe encima— y lo que deja agregarlo sin
   * decidir de antemano su tipo. El nombre provisional lo pide el backend, que
   * no acepta uno vacío; se reemplaza en cuanto se escribe el de verdad.
   */
  protected agregarCampo(): void {
    const plantilla = this.abierta();
    if (plantilla === null || this.creando()) {
      return;
    }

    const name = 'Campo nuevo';
    const code = codigoDeCampo(plantilla.code, name);

    this.creando.set(true);
    this.alta.set(loading());

    this.forms.createFieldDefinition({ code, name, dataType: 'string' }).subscribe({
      next: (fieldId) => this.colgar(plantilla, fieldId),
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
  private colgar(plantilla: ChartTemplate, fieldId: string): void {
    this.forms
      .createAssignment({
        fieldId,
        targetResourceConceptId: plantilla.fieldTargetConceptId,
        ...(plantilla.sectionId === undefined
          ? {}
          : { sectionId: plantilla.sectionId }),
        required: false,
        ordinal: plantilla.fields.length,
      })
      .subscribe({
        next: () => {
          this.creando.set(false);
          this.alta.set(ready(null));
          this.recargarYAbrir(plantilla);
        },
        error: (error: unknown) => {
          this.creando.set(false);
          this.alta.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Guarda lo editado en un campo propio.
   *
   * **Dos llamadas y no una**, por lo mismo que el alta: el nombre y el tipo
   * viven en la definición —que es global— y lo obligatorio en la asignación,
   * que es de este formulario. El mismo campo puede ser obligatorio acá y
   * opcional en otro.
   *
   * Se saltea la que no cambió: pedir dos veces por un solo cambio duplica el
   * trabajo y la ventana en la que algo puede fallar a medias.
   */
  protected guardarCampo(campo: ChartTemplateField, cambios: CambiosDelCampo): void {
    const plantilla = this.abierta();
    if (plantilla === null || this.guardandoCampo() !== null) {
      return;
    }

    const opcionesGuardadas = campo.options ?? [];
    const opcionesNuevas = cambios.options ?? [];
    const cambiaronOpciones =
      opcionesNuevas.length !== opcionesGuardadas.length ||
      opcionesNuevas.some((opcion, i) => opcion !== opcionesGuardadas[i]);

    const cambioDefinicion =
      cambios.name !== campo.name ||
      cambios.dataType !== campo.dataType.toLowerCase() ||
      (cambios.multiple ?? false) !== (campo.multiple ?? false) ||
      cambiaronOpciones;
    const cambioAsignacion = cambios.required !== campo.required;

    // Nada que mandar: el editor se guarda solo y emite también cuando lo
    // tecleado terminó igual que lo que ya estaba.
    if (!cambioDefinicion && !cambioAsignacion) {
      return;
    }

    this.guardandoCampo.set(campo.assignmentId);

    const definicion = cambioDefinicion
      ? this.forms.updateFieldDefinition(campo.fieldId, {
          name: cambios.name,
          dataType: cambios.dataType as TechnicalDataType,
          // Las opciones sólo viajan en los de elección: mandar una lista vacía
          // al pasar a «Texto corto» sería pedirle al servidor que la guarde.
          ...(cambios.options === undefined
            ? {}
            : { options: cambios.options, multiple: cambios.multiple ?? false }),
        })
      : of(undefined);

    const asignacion = cambioAsignacion
      ? this.forms.updateAssignment(campo.assignmentId, { required: cambios.required })
      : of(undefined);

    // En serie y no en paralelo: son dos escrituras sobre el mismo campo, y
    // lanzarlas juntas deja la segunda pidiendo sobre un estado que la primera
    // todavía no confirmó.
    definicion.pipe(concatMap(() => asignacion)).subscribe({
      next: () => {
        this.guardandoCampo.set(null);
        this.toasts.success(`«${cambios.name}» quedó guardado.`, 'Campo actualizado');
        this.abrir(plantilla);
      },
      error: (error: unknown) => {
        this.guardandoCampo.set(null);
        this.alta.set(errorToViewState<null>(error));
      },
    });
  }

  /**
   * Quita un campo propio del formulario.
   *
   * Sin diálogo de confirmación: no borra nada del catálogo global —la
   * definición sigue existiendo— y volver a agregarlo cuesta menos que el
   * diálogo. Sobre un campo del estándar este botón no existe.
   */
  protected quitarCampo(campo: ChartTemplateField): void {
    const plantilla = this.abierta();
    if (plantilla === null) {
      return;
    }
    this.forms.deleteAssignment(campo.assignmentId).subscribe({
      next: () => {
        this.toasts.success(`«${campo.name}» ya no está en ${plantilla.name}.`, 'Campo quitado');
        this.abrir(plantilla);
      },
      error: (error: unknown) => this.alta.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Mueve un campo propio un lugar arriba o abajo.
   *
   * Se manda el orden entero y no «subí éste»: ver `reorderAssignments`. El
   * estado local se adelanta al servidor para que la fila se mueva en el acto
   * —esperar la ida y vuelta para ver el cambio hace que se pulse dos veces—.
   */
  protected moverCampo(indice: number, direccion: -1 | 1): void {
    this.reordenar(indice, indice + direccion);
  }

  /**
   * Lleva el campo de una posición a otra, venga de las flechas o del arrastre.
   *
   * Es el único camino: dos —uno por gesto— se separan en el primer arreglo, y
   * lo que hay que hacer es idéntico en los dos casos.
   */
  private reordenar(desde: number, hasta: number): void {
    const plantilla = this.abierta();
    if (plantilla === null) {
      return;
    }
    const propios = [...this.camposPropios()];
    if (hasta < 0 || hasta >= propios.length || desde < 0 || desde >= propios.length) {
      return;
    }

    const [movido] = propios.splice(desde, 1);
    propios.splice(hasta, 0, movido!);
    this.abierta.set({
      ...plantilla,
      fields: [...this.camposEstandar(), ...propios],
    });

    this.forms
      .reorderAssignments(
        plantilla.fieldTargetConceptId,
        propios.map((c) => c.assignmentId),
      )
      .subscribe({
        // Se recarga igual: el servidor fija el orden, y si se rechazó la
        // pantalla tiene que volver a la verdad.
        next: () => this.abrir(plantilla),
        error: (error: unknown) => {
          this.alta.set(errorToViewState<null>(error));
          this.abrir(plantilla);
        },
      });
  }

  /* -- Arrastrar para reordenar --------------------------------------------- */

  /**
   * El campo cuyo agarre está apretado, y por lo tanto el único `<li>` que es
   * `draggable`.
   *
   * Toda la lista arrastrable de entrada convertía cualquier intento de
   * seleccionar el texto del nombre en el comienzo de un arrastre. Con esto, el
   * arrastre empieza sólo desde los seis puntos.
   */
  protected readonly agarrado = signal<string | null>(null);

  /** El que se está arrastrando, para despegarlo del resto. */
  protected readonly arrastrando = signal<string | null>(null);

  /** Sobre cuál está el puntero: es donde va a caer. */
  protected readonly destino = signal<string | null>(null);

  protected agarrar(campo: ChartTemplateField, apretado: boolean): void {
    this.agarrado.set(apretado ? campo.assignmentId : null);
  }

  protected empezarArrastre(campo: ChartTemplateField, evento: DragEvent): void {
    this.arrastrando.set(campo.assignmentId);
    // Firefox no empieza el arrastre si no se escribe algo en el portapapeles.
    evento.dataTransfer?.setData('text/plain', campo.assignmentId);
    if (evento.dataTransfer !== null) {
      evento.dataTransfer.effectAllowed = 'move';
    }
  }

  /**
   * El puntero pasa por encima de otra tarjeta.
   *
   * `preventDefault` es lo que declara la zona como válida para soltar: sin él
   * el navegador rechaza el `drop` y el arrastre termina sin hacer nada.
   */
  protected arrastrarSobre(campo: ChartTemplateField, evento: DragEvent): void {
    if (this.arrastrando() === null) {
      return;
    }
    evento.preventDefault();
    if (evento.dataTransfer !== null) {
      evento.dataTransfer.dropEffect = 'move';
    }
    this.destino.set(campo.assignmentId);
  }

  /** Suelta el campo arrastrado en la posición de otro. */
  protected soltar(campo: ChartTemplateField, evento: DragEvent): void {
    evento.preventDefault();
    const arrastrado = this.arrastrando();
    this.terminarArrastre();
    if (arrastrado === null || arrastrado === campo.assignmentId) {
      return;
    }

    const propios = this.camposPropios();
    const desde = propios.findIndex((c) => c.assignmentId === arrastrado);
    const hasta = propios.findIndex((c) => c.assignmentId === campo.assignmentId);
    if (desde < 0 || hasta < 0) {
      return;
    }
    // Se reusa el mismo camino que las flechas: mismo adelanto local, misma
    // llamada, mismo recargado. Un segundo camino para el mismo movimiento se
    // separaría del primero en el primer arreglo.
    this.reordenar(desde, hasta);
  }

  protected terminarArrastre(): void {
    this.arrastrando.set(null);
    this.destino.set(null);
    this.agarrado.set(null);
  }

  /** Relee la plantilla y deja abierto el campo indicado. */
  private recargarYAbrir(plantilla: ChartTemplate): void {
    this.chartTemplates.getTemplate(plantilla.id).subscribe({
      next: (detalle) => {
        this.abierta.set(detalle);
        this.cargarPresupuesto(detalle);
      },
      error: (error: unknown) => this.alta.set(errorToViewState<null>(error)),
    });
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

    const campos: CampoDeFormulario[] = plantilla.fields.map(aCampoDelMotor);

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
            valorInicial(campo.control),
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

/**
 * De un campo de la plantilla a lo que el motor de formularios sabe pintar.
 *
 * Los de elección son el único caso con dos formas: con pocas opciones se
 * pintan a la vista —marcar es un clic— y con muchas se despliegan, porque
 * quince opciones a la vista empujan el resto de la página fuera de la
 * pantalla. Los de varias respuestas van siempre a la vista: un desplegable no
 * deja marcar más de una.
 */
function aCampoDelMotor(campo: ChartTemplateField): CampoDeFormulario {
  const opciones = campo.options ?? [];
  const esEleccion = familiaDeCampo(campo) !== null;

  if (esEleccion && opciones.length > 0) {
    const comoLista =
      (campo.multiple ?? false) || opciones.length <= OPCIONES_QUE_ENTRAN_A_LA_VISTA;
    return {
      key: campo.fieldId,
      label: campo.name,
      control: (campo.multiple ?? false) ? 'checkboxes' : comoLista ? 'radio' : 'select',
      required: campo.required,
      options: opciones.map((opcion) => ({ value: opcion, label: opcion })),
    };
  }

  return {
    key: campo.fieldId,
    label: campo.name,
    control: CONTROL_POR_TIPO[aTipoDeCampo(campo.dataType, campo.multiple ?? false)],
    required: campo.required,
  };
}

/**
 * Con qué nace el control de la vista previa, según lo que va a pintar.
 *
 * `checkboxes` guarda un array y no una cadena: arrancarlo en `''` deja al
 * motor leyendo `''.includes(...)`, que responde a cualquier subcadena y
 * dibujaría opciones marcadas que nadie marcó.
 */
function valorInicial(control: TipoDeControl): unknown {
  if (control === 'checkbox') return false;
  if (control === 'checkboxes') return [];
  return '';
}

/** `'eleccion'`, `'casillas'` o `null` si el campo no es de elección. */
function familiaDeCampo(campo: ChartTemplateField): 'eleccion' | 'casillas' | null {
  const familia = familiaDe(campo.dataType, campo.multiple ?? false);
  return familia === 'eleccion' || familia === 'casillas' ? familia : null;
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
