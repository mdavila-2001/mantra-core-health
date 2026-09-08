import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, Validators, type ValidatorFn } from '@angular/forms';
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
  UpdateFieldDefinitionInput,
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
import { validadorDeSeleccion } from '../../shared/forms/paginated/validadores-de-seleccion';

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
 *
 * ## Guardar no relee, y nada se pierde por escribir rápido
 *
 * Cada cambio de una tarjeta se aplica **primero en la pantalla** y después se
 * manda. Antes se releía la plantilla entera tras cada guardado, y como el
 * editor se reseteaba con lo que volvía, escribir una opción de tres letras
 * con la pausa de guardado en el medio borraba las dos primeras. Y si había un
 * guardado en vuelo, el cambio siguiente se descartaba en silencio: elegir
 * «Opción múltiple» y escribir sus opciones era, literalmente, imposible.
 *
 * Ahora la tarjeta manda, la pantalla aplica y encola: un cambio que llega
 * mientras el anterior viaja espera su turno y sale cuando aquél vuelve. Sólo
 * un error relee del servidor, porque ahí la pantalla ya no sabe qué quedó.
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
        this.enviados.clear();
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
    this.enviados.clear();
    this.pendientes.clear();
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

  /** Los campos con una petición en vuelo, para su acuse de «Guardando…». */
  protected readonly guardandoCampos = signal<ReadonlySet<string>>(new Set());

  /**
   * El cambio que llegó mientras el anterior viajaba, por campo.
   *
   * Uno solo y no una lista: si mientras viaja el primero llegan tres más, lo
   * que hay que mandar es el último, que ya incluye a los otros dos —cada
   * emisión trae el campo entero—.
   */
  private readonly pendientes = new Map<string, CambiosDelCampo>();

  /**
   * Lo último que se le mandó al servidor de cada campo.
   *
   * Es contra lo que se compara el cambio siguiente: el campo abierto ya tiene
   * aplicado lo que está viajando, así que compararlo con él diría «nada
   * cambió» y el pendiente no saldría nunca. Se vacía al releer: ahí la verdad
   * vuelve a ser la del servidor.
   */
  private readonly enviados = new Map<string, ChartTemplateField>();

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
    this.declararYColgar(plantilla, {
      code: codigoDeCampo(plantilla.code, 'Pregunta'),
      name: 'Pregunta sin título',
      dataType: 'string',
    });
  }

  /**
   * Duplica un campo propio: la misma pregunta, con todo lo que trae, debajo.
   *
   * Es el botón de copiar de cualquier editor de formularios, y lo que evita
   * escribir cinco veces las mismas cuatro opciones para cinco preguntas
   * parecidas. Se declara una definición **nueva** y no se cuelga dos veces
   * la misma: son dos preguntas que van a divergir, y una definición
   * compartida haría que corregir una corrigiera la otra.
   */
  protected duplicarCampo(campo: ChartTemplateField): void {
    const plantilla = this.abierta();
    if (plantilla === null || this.creando()) {
      return;
    }
    const esEleccion = familiaDeCampo(campo) !== null;
    this.declararYColgar(
      plantilla,
      {
        code: codigoDeCampo(plantilla.code, campo.name),
        name: `${campo.name} (copia)`,
        dataType: campo.dataType.toLowerCase() as TechnicalDataType,
        ...(campo.description === undefined ? {} : { description: campo.description }),
        ...(esEleccion
          ? {
              options: campo.options ?? [],
              multiple: campo.multiple ?? false,
              allowOther: campo.allowOther ?? false,
              ...(campo.cardinalityMin === undefined ? {} : { cardinalityMin: campo.cardinalityMin }),
              ...(campo.cardinalityMax === undefined ? {} : { cardinalityMax: campo.cardinalityMax }),
            }
          : {}),
      },
      campo.required,
    );
  }

  /** La mitad común del alta y del duplicado: declarar, y después colgar. */
  private declararYColgar(
    plantilla: ChartTemplate,
    definicion: Parameters<FormsClient['createFieldDefinition']>[0],
    required = false,
  ): void {
    this.creando.set(true);
    this.alta.set(loading());

    this.forms.createFieldDefinition(definicion).subscribe({
      next: (fieldId) => this.colgar(plantilla, fieldId, required),
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
  private colgar(plantilla: ChartTemplate, fieldId: string, required: boolean): void {
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
   * **Primero la pantalla, después el servidor.** Los cambios se aplican al
   * campo abierto en el acto —la vista previa y la cabecera los muestran sin
   * esperar— y se mandan. Si ya hay uno de este campo en vuelo, el nuevo
   * queda pendiente y sale cuando aquél vuelva; el anterior en espera se
   * descarta porque el nuevo lo contiene.
   *
   * **Dos llamadas y no una**, por lo mismo que el alta: el nombre y el tipo
   * viven en la definición —que es global— y lo obligatorio en la asignación,
   * que es de este formulario. El mismo campo puede ser obligatorio acá y
   * opcional en otro. Se saltea la que no cambió.
   */
  protected guardarCampo(campo: ChartTemplateField, cambios: CambiosDelCampo): void {
    const plantilla = this.abierta();
    if (plantilla === null) {
      return;
    }

    // Contra qué se compara: lo último mandado si hay, y si no el campo tal
    // como lo tiene el editor, que es lo último que el servidor confirmó.
    const base = this.enviados.get(campo.assignmentId) ?? campo;
    this.aplicarLocalmente(campo.assignmentId, cambios);

    if (this.guardandoCampos().has(campo.assignmentId)) {
      this.pendientes.set(campo.assignmentId, cambios);
      return;
    }
    this.mandar(base, cambios);
  }

  private mandar(campo: ChartTemplateField, cambios: CambiosDelCampo): void {
    const cambioDefinicion = definicionCambio(campo, cambios);
    const cambioAsignacion = cambios.required !== campo.required;

    if (!cambioDefinicion && !cambioAsignacion) {
      this.mandarPendiente(campo.assignmentId);
      return;
    }

    this.enviados.set(campo.assignmentId, conCambios(campo, cambios));
    this.guardandoCampos.update((en) => new Set(en).add(campo.assignmentId));

    const definicion = cambioDefinicion
      ? this.forms.updateFieldDefinition(campo.fieldId, aCuerpoDeDefinicion(cambios))
      : of(undefined);

    const asignacion = cambioAsignacion
      ? this.forms.updateAssignment(campo.assignmentId, { required: cambios.required })
      : of(undefined);

    // En serie y no en paralelo: son dos escrituras sobre el mismo campo, y
    // lanzarlas juntas deja la segunda pidiendo sobre un estado que la primera
    // todavía no confirmó.
    definicion.pipe(concatMap(() => asignacion)).subscribe({
      next: () => {
        this.terminarGuardado(campo.assignmentId);
        this.mandarPendiente(campo.assignmentId);
      },
      error: (error: unknown) => {
        this.terminarGuardado(campo.assignmentId);
        this.pendientes.delete(campo.assignmentId);
        this.enviados.delete(campo.assignmentId);
        this.alta.set(errorToViewState<null>(error));
        // Sólo acá se relee: la pantalla ya no sabe qué quedó guardado.
        const plantilla = this.abierta();
        if (plantilla !== null) this.recargarYAbrir(plantilla);
      },
    });
  }

  private terminarGuardado(assignmentId: string): void {
    this.guardandoCampos.update((en) => {
      const copia = new Set(en);
      copia.delete(assignmentId);
      return copia;
    });
  }

  /** Si quedó un cambio esperando, sale ahora, contra lo último que se aplicó. */
  private mandarPendiente(assignmentId: string): void {
    const pendiente = this.pendientes.get(assignmentId);
    if (pendiente === undefined) {
      return;
    }
    this.pendientes.delete(assignmentId);
    const base = this.enviados.get(assignmentId);
    if (base !== undefined) {
      this.mandar(base, pendiente);
    }
  }

  /** Escribe los cambios en el campo abierto, sin esperar al servidor. */
  private aplicarLocalmente(assignmentId: string, cambios: CambiosDelCampo): void {
    this.abierta.update((plantilla) => {
      if (plantilla === null) return plantilla;
      return {
        ...plantilla,
        fields: plantilla.fields.map((f) =>
          f.assignmentId !== assignmentId ? f : conCambios(f, cambios),
        ),
      };
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
        this.recargarYAbrir(plantilla);
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
        // Se relee igual: el servidor fija el orden, y si se rechazó la
        // pantalla tiene que volver a la verdad.
        next: () => this.recargarYAbrir(plantilla),
        error: (error: unknown) => {
          this.alta.set(errorToViewState<null>(error));
          this.recargarYAbrir(plantilla);
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

  /**
   * Relee la plantilla sin salir de la vista en la que se está.
   *
   * No pasa por `abrir`: aquél apaga la vista previa y borra el error, que son
   * cosas de **entrar** a un formulario, no de refrescarlo. Releer tras quitar
   * un campo desde la previa tiene que dejar la previa puesta.
   */
  private recargarYAbrir(plantilla: ChartTemplate): void {
    this.chartTemplates.getTemplate(plantilla.id).subscribe({
      next: (detalle) => {
        this.abierta.set(detalle);
        this.enviados.clear();
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

  /**
   * El grupo que la vista previa necesita: se mira, no se envía a ningún lado.
   *
   * Lleva los validadores de verdad —obligatorio, y los topes de un campo de
   * varias— porque es lo que hace que la previa **responda** igual que el
   * formulario servido: marcar tres donde se pedían dos tiene que decirlo acá,
   * no cuando el paciente lo vea.
   */
  protected readonly formularioDeMuestra = computed<FormGroup>(() => {
    const plantilla = this.abierta();
    const topes = new Map(
      (plantilla?.fields ?? []).map((campo) => [
        campo.fieldId,
        { min: campo.cardinalityMin, max: campo.cardinalityMax, multiple: campo.multiple ?? false },
      ]),
    );

    const grupo = new FormGroup({});
    for (const pagina of this.paginas()) {
      for (const campo of pagina.campos) {
        const validadores: ValidatorFn[] = [];
        if (campo.required === true) validadores.push(Validators.required);
        const tope = topes.get(campo.key);
        if (
          campo.control === 'checkboxes' &&
          tope !== undefined &&
          (tope.min !== undefined || tope.max !== undefined)
        ) {
          validadores.push(validadorDeSeleccion(tope.min, tope.max));
        }
        grupo.addControl(
          campo.key,
          new FormControl<unknown>(valorInicial(campo.control), validadores),
        );
      }
    }
    return grupo;
  });

  protected readonly porCampo = (campo: ChartTemplateField): string =>
    campo.assignmentId;

  protected readonly porPlantilla = (plantilla: ChartTemplate): string =>
    plantilla.id;

  /** Si este campo tiene una petición en vuelo. */
  protected estaGuardando(campo: ChartTemplateField): boolean {
    return this.guardandoCampos().has(campo.assignmentId);
  }

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
 * deja marcar más de una. Y los que ofrecen «Otro» también, por lo mismo: un
 * desplegable no tiene dónde escribir.
 */
function aCampoDelMotor(campo: ChartTemplateField): CampoDeFormulario {
  const opciones = campo.options ?? [];
  const esEleccion = familiaDeCampo(campo) !== null;
  const ayuda = campo.description === undefined || campo.description === ''
    ? {}
    : { hint: campo.description };

  if (esEleccion && opciones.length > 0) {
    const multiple = campo.multiple ?? false;
    const otro = campo.allowOther ?? false;
    const comoLista = multiple || otro || opciones.length <= OPCIONES_QUE_ENTRAN_A_LA_VISTA;
    return {
      key: campo.fieldId,
      label: campo.name,
      control: multiple ? 'checkboxes' : comoLista ? 'radio' : 'select',
      required: campo.required,
      options: opciones.map((opcion) => ({ value: opcion, label: opcion })),
      ...(otro ? { otro: true } : {}),
      ...ayuda,
    };
  }

  return {
    key: campo.fieldId,
    label: campo.name,
    control: CONTROL_POR_TIPO[aTipoDeCampo(campo.dataType, campo.multiple ?? false)],
    required: campo.required,
    ...ayuda,
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

/** Si algo de la **definición** —lo global— cambió respecto del campo. */
function definicionCambio(campo: ChartTemplateField, cambios: CambiosDelCampo): boolean {
  const opcionesGuardadas = campo.options ?? [];
  const opcionesNuevas = cambios.options ?? [];
  const cambiaronOpciones =
    opcionesNuevas.length !== opcionesGuardadas.length ||
    opcionesNuevas.some((opcion, i) => opcion !== opcionesGuardadas[i]);

  return (
    cambios.name !== campo.name ||
    cambios.dataType !== campo.dataType.toLowerCase() ||
    (cambios.description ?? null) !== (campo.description ?? null) ||
    (cambios.multiple ?? false) !== (campo.multiple ?? false) ||
    (cambios.allowOther ?? false) !== (campo.allowOther ?? false) ||
    (cambios.cardinalityMin ?? null) !== (campo.cardinalityMin ?? null) ||
    (cambios.cardinalityMax ?? null) !== (campo.cardinalityMax ?? null) ||
    cambiaronOpciones
  );
}

/** Lo que viaja en el `PATCH` de la definición. */
function aCuerpoDeDefinicion(cambios: CambiosDelCampo): UpdateFieldDefinitionInput {
  return {
    name: cambios.name,
    dataType: cambios.dataType as TechnicalDataType,
    description: cambios.description,
    // Las opciones sólo viajan en los de elección: mandar una lista vacía al
    // pasar a «Respuesta corta» sería pedirle al servidor que la guarde.
    ...(cambios.options === undefined
      ? {}
      : {
          options: cambios.options,
          multiple: cambios.multiple ?? false,
          allowOther: cambios.allowOther ?? false,
          cardinalityMin: cambios.cardinalityMin ?? null,
          cardinalityMax: cambios.cardinalityMax ?? null,
        }),
  };
}

/** El campo con los cambios puestos, tal como va a quedar en el servidor. */
function conCambios(campo: ChartTemplateField, cambios: CambiosDelCampo): ChartTemplateField {
  const {
    description: _d,
    options: _o,
    multiple: _m,
    allowOther: _a,
    cardinalityMin: _min,
    cardinalityMax: _max,
    ...base
  } = campo;
  return {
    ...base,
    name: cambios.name,
    dataType: cambios.dataType,
    required: cambios.required,
    ...(cambios.description === null ? {} : { description: cambios.description }),
    ...(cambios.options === undefined
      ? {}
      : {
          options: cambios.options,
          multiple: cambios.multiple ?? false,
          allowOther: cambios.allowOther ?? false,
          ...(cambios.cardinalityMin == null ? {} : { cardinalityMin: cambios.cardinalityMin }),
          ...(cambios.cardinalityMax == null ? {} : { cardinalityMax: cambios.cardinalityMax }),
        }),
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
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${codigoDePlantilla}.${raiz || 'CAMPO'}_${Date.now().toString(36).toUpperCase()}`;
}
