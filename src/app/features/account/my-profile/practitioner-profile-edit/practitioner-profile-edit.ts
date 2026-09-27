import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  model,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormControl,
  ReactiveFormsModule,
  type AbstractControl,
  type ValidationErrors,
} from '@angular/forms';
import { catchError, forkJoin, of, type Observable } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { FileDownloader } from '../../../../core/data-access/files/file-downloader';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { BIRTH_SEX_OPTIONS } from '../../../../core/data-access/iam/birth-sex.options';
import type { BirthSexCode } from '../../../../core/data-access/iam/iam.types';
import { BoDepartmentsCatalog } from '../../../../core/data-access/terminology/bo-departments.service';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { LocationPicker } from '../../../auth/registro-compartido/location-picker/location-picker';
import {
  MAX_ATTACHMENT_BYTES,
  SUPPORT_FILE_FORMATS,
} from '../../../auth/registro-compartido/credenciales-del-medico';
import { MedicalSpecialtiesCatalog } from '../../../../core/data-access/terminology/medical-specialties.service';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { OwnPractitionerProfile } from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { Card } from '../../../../shared/components/molecules/card/card';
import {
  PhoneInput,
  telefonoCompleto,
} from '../../../../shared/components/molecules/phone-input/phone-input';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FileInput } from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Pagination } from '../../../../shared/components/molecules/pagination/pagination';
import { RowActions } from '../../../../shared/components/molecules/row-actions/row-actions';
import type { RowAction } from '../../../../shared/components/molecules/row-actions/row-actions.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { separarNombres, unirNombres } from '../../../../core/profesion/nombres-adicionales';
import { opcionesAutoridadReguladora } from '../../../../core/profesion/autoridades-reguladoras';
import {
  INSTITUCION_FUERA_DE_CATALOGO,
  esInstitucionDelCatalogo,
} from '../../../../core/profesion/instituciones-educativas';
import {
  OPCIONES_TITULO_PROFESIONAL,
  esTituloDeLaLista,
} from '../../../../core/profesion/titulos-profesionales';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import {
  FilterBar,
  SEARCH_PARAM,
  type FilterDef,
} from '../../../../shared/components/organisms/filter-bar/filter-bar';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PESTANA_EDITOR, PESTANAS_DEL_EDITOR_MEDICO } from '../pestanas-del-perfil-medico';
import { WorkHistory } from '../work-history/work-history';
import {
  OPCIONES_DE_ESTADO,
  OPCIONES_DE_ESTADO_DE_ESPECIALIDAD,
  coincideConElConcepto,
  coincideConElEstado,
  coincideConLaBusqueda,
  estadosPresentes,
  filasDeLaPagina,
  institucionConCodigo,
  matriculaPendiente,
  OPCIONES_DE_INSTITUCION_CON_SIGLA,
} from './practitioner-profile-edit.logic';

/** El tipo de título (formación), del catálogo dinámico: los cinco `CREDENTIAL_TYPE_*`. */
const TARGET_CREDENCIAL = 'profiles.professional_credentials.credential_type_concept_id';

/** Una especialidad principal y hasta tres adicionales por profesional. */
const MAX_SPECIALTIES_PER_PRACTITIONER = 4;

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Una fila de «Tus títulos cargados». */
interface FilaFormacion {
  readonly id: string;
  readonly tipo: string;
  readonly numero: string;
  readonly institucion: string;
  readonly emision: string;
  readonly estado: string;
  /** El diploma, si se adjuntó. Sin él no hay nada que descargar. */
  readonly fileId?: string;
  /**
   * Si el trámite sigue abierto. Un título ya verificado o rechazado es un
   * hecho de quien lo revisó: se ve y se descarga, pero no se corrige ni se
   * retira — el servidor responde `422` y ofrecerlo sería prometer de más.
   */
  readonly pendiente: boolean;
}

/** Una fila de «Tus especialidades cargadas». */
interface FilaEspecialidad {
  readonly id: string;
  readonly especialidad: string;
  readonly desde: string;
  readonly estado: string;
  /** Si todavía no se verificó: la especialidad sí trae ese sí/no (`verified`). */
  readonly pendiente: boolean;
  /** Si todavía la ejerce (sin fecha de fin). Sólo éstas cuentan para el tope de cuatro. */
  readonly vigente: boolean;
}

/** Una fila de «Tus matrículas cargadas». */
interface FilaMatricula {
  readonly id: string;
  readonly numero: string;
  readonly autoridad: string;
  readonly inscripcion: string;
  readonly estado: string;
  /** El concepto detrás de `estado`: es lo que filtra el «Estado» de la barra. */
  readonly estadoConceptId: string;
  /** El carnet del colegio, si se adjuntó. */
  readonly fileId?: string;
  /** Si todavía se puede corregir: lo dice el código de su estado (`matriculaPendiente`). */
  readonly pendiente: boolean;
}

/** Cuál de las tres tablas se está editando en el diálogo. */
type RecursoEditable = 'formacion' | 'especialidad' | 'matricula';

/** Lo que el diálogo de edición está corrigiendo ahora mismo. */
interface EdicionEnCurso {
  readonly recurso: RecursoEditable;
  readonly id: string;
  /** Cómo se llama lo que se está corrigiendo, para el encabezado y el aviso. */
  readonly nombre: string;
  /** Si ya tiene el diploma o el respaldo adjunto: el selector ofrece reemplazarlo. */
  readonly archivoActual: boolean;
}

/** El bloque de cada recurso, para el título de sus avisos. */
const BLOQUE_DE_RECURSO: Readonly<Record<RecursoEditable, string>> = {
  formacion: 'Formación',
  especialidad: 'Especialidades',
  matricula: 'Matrículas',
};

/** Lo que dice la columna «Estado» mientras el concepto no tiene etiqueta. */
const PENDIENTE_DE_VERIFICACION = 'Pendiente de verificación';

const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

/**
 * Una fecha del perfil como la lee una persona, o una raya.
 *
 * Acepta también la cadena ISO: el simulador y el cliente no convierten todas
 * las fechas anidadas, y una tabla no puede romperse por eso.
 */
function fechaLegible(fecha: Date | string | undefined): string {
  if (fecha === undefined) return '—';
  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(valor.getTime()) ? '—' : FORMATO_DE_FECHA.format(valor);
}

/** Para ordenar por fecha: sin fecha va al final. */
function marcaDeTiempo(fecha: Date | string | undefined): number {
  if (fecha === undefined) return 0;
  const valor = fecha instanceof Date ? fecha.getTime() : new Date(fecha).getTime();
  return Number.isNaN(valor) ? 0 : valor;
}

/** Un teléfono vacío es válido (en el editor los tres son opcionales); uno a medias, no. */
function telefonoOpcional(control: AbstractControl): ValidationErrors | null {
  return control.value === '' ? null : telefonoCompleto(control);
}

/**
 * Lo mínimo para que el correo de trabajo llegue al servidor: algo, una @ y un
 * dominio con punto. `Validators.email` deja pasar `ana@clinica`, que el
 * `@IsEmail` del API rechaza.
 */
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * El correo de trabajo guardado. Un perfil anterior a los contactos separados
 * no trae `workEmail`: ahí el de trabajo era el único correo, `email`.
 */
function correoDeTrabajoDe(perfil: OwnPractitionerProfile): string {
  return perfil.workEmail ?? perfil.email ?? '';
}

/**
 * **Configurar el perfil profesional** — título, biografía, disponibilidad,
 * especialidades y matrículas.
 *
 * ## Por qué es una pantalla aparte y no un modo de edición del perfil
 *
 * El perfil (`practitioner-profile`) es de **lectura**: una trayectoria que se
 * muestra tal como quedó. Editar es otra intención — hay que decidir qué
 * cambiar, ver el resultado antes de guardarlo, y no perder de vista lo que
 * todavía no se guardó. Mezclar las dos en un solo componente con un booleano
 * `editando` es la forma clásica de terminar con un formulario que se dibuja
 * encima de sí mismo.
 *
 * ## Tres formularios independientes, no uno
 *
 * **Presentación** (título, biografía, disponibilidad) se **edita**: es un
 * `PATCH` sobre el mismo registro. **Especialidad** y **matrícula** sólo se
 * **agregan**: no hay edición porque una especialidad verificada es un hecho
 * comprobado contra una credencial, y una matrícula es una autorización de un
 * tercero. Permitir «corregir» cualquiera de las dos sin pasar de nuevo por la
 * verificación vaciaría de sentido el propio verbo «verificar». Por eso son tres
 * envíos separados y no un único `guardar()`: cada uno tiene su propio
 * significado y su propio momento.
 */
/**
 * La clave de la búsqueda de la tabla de títulos en la URL. Propia y no `q`:
 * en Trayectoria la barra convive con la del historial laboral
 * (`app-work-history`), que usa `q`, y con una sola clave lo que se busca en
 * una tabla filtraría también la otra.
 */
const CLAVE_BUSQUEDA_TITULO = 'qTitulos';

/**
 * La clave de la búsqueda de la tabla de matrículas en la URL. Propia por lo
 * mismo que la de títulos: en Credenciales la tabla convive con la de
 * especialidades.
 */
const CLAVE_BUSQUEDA_MATRICULA = 'qMatriculas';

/** La clave de la búsqueda de la tabla de especialidades en la URL. */
const CLAVE_BUSQUEDA_ESPECIALIDAD = 'qEspecialidades';

/**
 * La clave del filtro «Estado» de la tabla de títulos en la URL. Propia y no
 * `estado` a secas: la URL es una sola para todo el editor y la comparten las
 * barras de sus tablas.
 */
const CLAVE_ESTADO_TITULO = 'estadoTitulo';

/** Las claves del filtro «Estado» de especialidades y matrículas, propias por lo mismo. */
const CLAVE_ESTADO_ESPECIALIDAD = 'estadoEspecialidad';
const CLAVE_ESTADO_MATRICULA = 'estadoMatricula';

/**
 * Filas por página de las tres tablas. El paginador trae veinte por omisión
 * (`pagination.types.ts`); acá son diez, como en el historial laboral de la
 * misma pestaña.
 */
const FILAS_POR_PAGINA = 10;

/**
 * Las claves que escriben en la URL las barras de las tablas del editor.
 * Incluye `q`, la que usan por omisión las barras de `app-work-history`
 * («Dónde atiendo» y el historial laboral).
 */
const CLAVES_DE_LAS_BARRAS: readonly string[] = [
  SEARCH_PARAM,
  CLAVE_BUSQUEDA_TITULO,
  CLAVE_ESTADO_TITULO,
  CLAVE_BUSQUEDA_ESPECIALIDAD,
  CLAVE_ESTADO_ESPECIALIDAD,
  CLAVE_BUSQUEDA_MATRICULA,
  CLAVE_ESTADO_MATRICULA,
];

/**
 * La fecha como `YYYY-MM-DD` con componentes **locales** — el mismo espejo de
 * `maybeDateOnly` que usa el historial laboral. `toISOString()` pasaría por
 * UTC y en Bolivia devolvería el día anterior.
 */
function soloFecha(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

@Component({
  selector: 'app-practitioner-profile-edit',
  imports: [
    AppButton,
    Card,
    ConceptSelect,
    ContentDialog,
    DataTable,
    DatePicker,
    FilterBar,
    FormActions,
    FileInput,
    FormField,
    Input,
    LocationPicker,
    NavIcon,
    PageHeader,
    Pagination,
    PhoneInput,
    ReactiveFormsModule,
    RouterLink,
    RowActions,
    Select,
    Switch,
    Tab,
    Tabs,
    Textarea,
    Tooltip,
    UbicacionPicker,
    ViewStateHost,
    WorkHistory,
  ],
  templateUrl: './practitioner-profile-edit.html',
  styleUrl: './practitioner-profile-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileEdit {
  private readonly profiles = inject(ProfilesClient);
  private readonly files = inject(FilesClient);
  private readonly descargas = inject(FileDownloader);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly catalogo = inject(MedicalSpecialtiesCatalog);
  private readonly terminologia = inject(TerminologyClient);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * La pestaña abierta. Es un `model` y no una señal propia por la misma razón
   * que en el editor del paciente: el lápiz de la ficha abre el formulario en la
   * pestaña que se estaba mirando, y para eso el índice tiene que poder venir de
   * afuera.
   *
   * **Y hasta el 21/09/2026 no venía.** El párrafo de arriba describía la
   * intención, pero nadie le pasaba el índice: el lápiz apuntaba a
   * `/my-account/edit` a secas y desde «Credenciales» se entraba a editar en
   * «Datos personales». Ahora la ficha manda `?pestana=` y acá se lee del
   * parámetro. Se lee **una sola vez, del snapshot**: si se leyera en vivo, un
   * cambio de pestaña de la persona quedaría peleando con el de la URL.
   *
   * El valor se acota al rango: un `?pestana=99` escrito a mano no puede dejar
   * el editor sin ningún panel abierto.
   */
  readonly pestana = model<number>(PESTANA_EDITOR.personales);
  protected readonly pestanas = PESTANAS_DEL_EDITOR_MEDICO;
  protected readonly pestanaEditor = PESTANA_EDITOR;

  /**
   * Si la pestaña abierta es de las que se corrigen.
   *
   * «Datos personales», «Contacto» y «Facturación» son un solo formulario
   * repartido en tres paneles y comparten el botón de guardar: los tres viajan
   * en el mismo `PATCH /profiles/practitioners/me`. «Trayectoria» y
   * «Credenciales» no corrigen nada: agregan, y cada bloque tiene su propio
   * «Agregar». Mostrar ahí «Guardar cambios» prometería guardar algo que ese
   * botón no guarda.
   */
  protected readonly editandoPresentacion = computed(
    () =>
      this.pestana() === PESTANA_EDITOR.personales ||
      this.pestana() === PESTANA_EDITOR.contacto ||
      this.pestana() === PESTANA_EDITOR.facturacion,
  );

  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly departamentos = inject(BoDepartmentsCatalog);

  /* -- P28 (ID-13): lo que del documento SÍ se corrige --------------------
     El sexo al nacer y el departamento que emitió el documento. El número del
     documento sigue de solo lectura: tiene su propio circuito de verificación
     y la API no lo acepta en este `PATCH`. */
  protected readonly opcionesSexoAlNacer = BIRTH_SEX_OPTIONS;
  protected readonly sexoAlNacer = signal<BirthSexCode | null>(null);
  protected readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  protected readonly departamentoEmisor = signal<string | null>(null);

  /* -- ALV-003: los dos datos del contrato que no tenían control ---------- */

  /** Fecha de nacimiento: se ve en la ficha, ahora también se edita. */
  protected readonly fechaNacimiento = signal<Date | null>(null);
  /** Localidad de residencia (concept id de `VS_BO_MUNICIPALITY`). */
  protected readonly municipioResidencia = signal<string | null>(null);
  /** El árbol de departamentos y municipios, para el picker de residencia. */
  protected readonly ramasMunicipios = signal<readonly RamaDepartamento[]>([]);
  protected readonly catalogoMunicipiosCaido = signal(false);

  protected readonly perfil = signal<ViewState<OwnPractitionerProfile>>(loading());

  private readonly datos = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' ? estado.data : null;
  });

  protected readonly profileId = computed(() => this.datos()?.profileId ?? null);

  /* -- Presentación: título, biografía, disponibilidad --------------------- */

  protected readonly titulo = signal('');
  protected readonly bio = signal('');
  /* «Acepto pacientes nuevos» ya no se pregunta (propietario, 13/09/2026):
     siempre está habilitado. Ver `guardarPresentacion`. */
  protected readonly telemedicina = signal(false);

  /* -- Los datos personales, que hasta ahora no se podían corregir ---------
     Se declaran al registrarse y despues no habia forma de tocarlos: quien se
     equivocaba en su apellido lo arrastraba. Mismo alcance que ya tiene el
     paciente. El documento y el correo NO estan: el primero es un identificador
     oficial con su circuito, el segundo es la credencial de acceso. */
  protected readonly nombre = signal('');
  protected readonly segundoNombre = signal('');
  /**
   * El tercer nombre, y las casillas que se agreguen después.
   *
   * El alta de médico pregunta tres y deja sumar las que hagan falta —hay
   * gente con cuatro y con cinco—; el editor ofrecía **una sola**. Quien se
   * había registrado con tres nombres, al corregir cualquier otra cosa acá,
   * mandaba de vuelta sólo el segundo y **perdía el resto sin enterarse**.
   *
   * Los tres controles son el mismo dato: `middleName` guarda todo lo que no
   * es el primer nombre, separado por espacios. Ver `nombres-adicionales`.
   */
  protected readonly tercerNombre = signal('');
  protected readonly nombresExtra = signal<readonly string[]>([]);
  protected readonly apellidoPaterno = signal('');
  protected readonly apellidoMaterno = signal('');
  /* Los contactos personales que el alta pide. Los del trabajo (celular, fijo
     y correo) salieron de esta pantalla el 23/09/2026 a pedido del médico
     (D-03): no se editan ni viajan en el PATCH, así que lo guardado queda. */
  /* El teléfono es el campo del alta (`app-phone-input`): bandera y prefijo
     del país, y el número nacional. Es un `ControlValueAccessor`, por eso va
     en `FormControl` y no en una señal; el control vive en el componente, así
     que cambiar de pestaña no lo pierde. */
  protected readonly celularPersonal = new FormControl('', {
    nonNullable: true,
    validators: [telefonoOpcional],
  });
  /** El mismo texto que el alta pone bajo un teléfono incompleto. */
  protected readonly mensajeTelefonoIncompleto = 'El número está incompleto para el país elegido.';
  protected readonly correoPersonal = signal('');
  protected readonly correoTrabajo = signal('');
  /**
   * Por qué no se guardó el correo de trabajo. Es obligatorio desde el alta,
   * así que a diferencia de los otros contactos no se puede vaciar.
   */
  protected readonly errorCorreoTrabajo = signal('');

  /* -- Facturación: a nombre de quién salen los comprobantes que emite ------
     El alta de médico no los pregunta, así que acá es donde se cargan por
     primera vez. Mismo par y mismo contrato que el editor del paciente. */

  /** El NIT. Vaciarlo lo BORRA: es la única forma de sacar uno mal cargado. */
  protected readonly nit = signal('');
  /** A nombre de quién sale el comprobante. */
  protected readonly razonSocial = signal('');
  /**
   * La calle, ALV-009.
   *
   * Va con el resto de «Presentación» y no en un formulario aparte: es el
   * mismo criterio que el municipio de arriba, un dato que se corrige, no
   * que se agrega de nuevo cada vez. Antes pegaba un `POST /common/addresses`
   * suelto con dueño `USER` que ninguna lectura buscaba —«guardar y
   * recargar» seguía sin mostrarla—; ahora es `homeAddressLines` del mismo
   * `PATCH`, y el backend la lee de vuelta en el resumen.
   */
  protected readonly direccion = signal('');
  /** Dirección laboral, separada del domicilio personal. */
  protected readonly direccionTrabajo = signal('');

  /**
   * El punto del domicilio en el mapa — lo que el alta ya preguntaba
   * (`gpsDomicilio`) y el editor no dejaba tocar.
   *
   * El contrato de `PATCH /profiles/practitioners/me` **ya aceptaba**
   * `homeLatitude`/`homeLongitude`: lo que faltaba era la pantalla. Mismos tres
   * estados que en el editor del paciente: sin tocar no viaja, quitado viaja
   * como par de `null`, movido viaja como par.
   */
  protected readonly gpsDomicilio = signal<Coordenadas | null | undefined>(undefined);
  protected readonly gpsDomicilioGuardado = signal<Coordenadas | null>(null);
  /** El GPS laboral se guarda por separado del punto del domicilio. */
  protected readonly gpsTrabajo = signal<Coordenadas | null | undefined>(undefined);
  protected readonly gpsTrabajoGuardado = signal<Coordenadas | null>(null);

  /**
   * El punto con el que abre el mapa: lo último que la persona dejó, o lo guardado.
   *
   * «Contacto» se dibuja sólo mientras está abierta (ver la plantilla), así que
   * el selector se vuelve a crear cada vez que se vuelve a la pestaña. Sembrarlo
   * siempre con lo guardado desharía un pin movido y confirmado antes de irse.
   */
  protected readonly gpsDomicilioInicial = computed(() => {
    const elegido = this.gpsDomicilio();
    return elegido === undefined ? this.gpsDomicilioGuardado() : elegido;
  });

  protected readonly gpsTrabajoInicial = computed(() => {
    const elegido = this.gpsTrabajo();
    return elegido === undefined ? this.gpsTrabajoGuardado() : elegido;
  });

  protected readonly idsGpsDomicilio: IdsDePrueba = {
    mapa: 'edicion-domicilio-mapa',
    confirmada: 'edicion-domicilio-confirmada',
    avisoGeocodificacion: 'edicion-domicilio-aviso-geo',
    quitar: 'edicion-domicilio-quitar-gps',
    confirmar: 'edicion-domicilio-confirmar',
    usarUbicacion: 'edicion-domicilio-usar-ubicacion',
    marcarEnMapa: 'edicion-domicilio-marcar',
  };

  protected readonly idsGpsTrabajo: IdsDePrueba = {
    mapa: 'edicion-trabajo-mapa',
    confirmada: 'edicion-trabajo-confirmada',
    avisoGeocodificacion: 'edicion-trabajo-aviso-geo',
    quitar: 'edicion-trabajo-quitar-gps',
    confirmar: 'edicion-trabajo-confirmar',
    usarUbicacion: 'edicion-trabajo-usar-ubicacion',
    marcarEnMapa: 'edicion-trabajo-marcar',
  };

  /** Las doce opciones del alta, compartidas: ver `titulos-profesionales`. */
  protected readonly titulosProfesionales = OPCIONES_TITULO_PROFESIONAL;

  /**
   * Si el título guardado no está en la lista cerrada.
   *
   * Los perfiles anteriores a la lista tienen textos escritos a mano («Médica
   * cardióloga»). No se borran ni se corrigen solos: se muestran, se avisa, y
   * la persona elige de la lista cuando quiera. Pisar el dato al abrir la
   * pantalla sería cambiar el perfil sin que nadie lo pidiera.
   */
  protected readonly tituloFueraDeLista = computed(
    () => this.titulo() !== '' && !esTituloDeLaLista(this.titulo()),
  );
  protected readonly guardandoPresentacion = signal(false);

  protected readonly bioLargoMaximo = 4000;

  /**
   * Si un teléfono se tiene que ver en rojo: incompleto y ya tocado.
   *
   * @param control - Uno de los tres teléfonos.
   */
  protected enRojo(control: FormControl<string>): boolean {
    return control.invalid && (control.dirty || control.touched);
  }

  /** Suma una casilla vacía de nombre, como en el alta. */
  protected agregarNombre(): void {
    this.nombresExtra.update((actuales) => [...actuales, '']);
  }

  /**
   * Quita una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   */
  protected quitarNombre(indice: number): void {
    this.nombresExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  /**
   * Escribe en una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   * @param valor - Lo que se escribió.
   */
  protected escribirNombreExtra(indice: number, valor: string | number | null): void {
    const texto = valor === null ? '' : String(valor);
    this.nombresExtra.update((actuales) =>
      actuales.map((nombre, i) => (i === indice ? texto : nombre)),
    );
  }

  /** Los nombres adicionales tal como los guarda el contrato: una sola cadena. */
  private nombresAdicionales(): string {
    return unirNombres([this.segundoNombre(), this.tercerNombre(), ...this.nombresExtra()]);
  }

  /* -- Nueva especialidad ---------------------------------------------------- */

  /**
   * Las especialidades elegibles (TJ-3 · F-19).
   *
   * Salen de `VS_MEDICAL_SPECIALTY` —las 36 del modelo, en castellano— y no del
   * `app-concept-select` por campo destino, que resuelve a un conjunto de la
   * API con una sola opción en inglés. Ver `MedicalSpecialtiesCatalog`.
   */
  protected readonly especialidades = signal<readonly SelectOption<string>[]>([]);

  /** El catálogo no se pudo leer: se lo dice, no se ofrece un desplegable vacío. */
  protected readonly catalogoCaido = signal(false);

  protected readonly nuevaEspecialidad = signal<string | null>(null);

  /**
   * Las especialidades que se agregan además de la primera, en casillas
   * sumables — las mismas del alta de médico.
   *
   * El editor ofrecía **una** por envío: un médico con tres especialidades
   * tenía que elegir, guardar, esperar la recarga y volver a empezar, tres
   * veces. El alta nunca lo pidió así, y ésta es la misma pantalla del mismo
   * dato. La cadena vacía es «esta casilla todavía no eligió nada».
   */
  protected readonly especialidadesExtra = signal<readonly string[]>([]);

  /** Suma una casilla vacía de especialidad. */
  protected agregarCasillaDeEspecialidad(): void {
    if (!this.canAddAnotherSpecialty()) return;
    this.especialidadesExtra.update((actuales) => [...actuales, '']);
  }

  /** No ofrece más casillas que el cupo de especialidades que todavía queda. */
  protected canAddAnotherSpecialty(): boolean {
    const activas = this.filasEspecialidades().filter((fila) => fila.vigente).length;
    return activas + 1 + this.especialidadesExtra().length < MAX_SPECIALTIES_PER_PRACTITIONER;
  }

  /** Muestra el formulario mientras el profesional tenga cupo disponible. */
  protected canDeclareSpecialty(): boolean {
    return (
      this.filasEspecialidades().filter((fila) => fila.vigente).length <
      MAX_SPECIALTIES_PER_PRACTITIONER
    );
  }

  /**
   * Quita una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   */
  protected quitarCasillaDeEspecialidad(indice: number): void {
    this.especialidadesExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  /**
   * Elige la especialidad de una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   * @param valor - El uuid elegido, o `null` si se volvió al vacío.
   */
  protected elegirEspecialidadExtra(indice: number, valor: string | null): void {
    const elegida = valor ?? '';
    this.especialidadesExtra.update((actuales) =>
      actuales.map((especialidad, i) => (i === indice ? elegida : especialidad)),
    );
  }

  /**
   * Las elegidas, en orden y sin repetidas.
   *
   * Mismo criterio que el alta (`especialidadesElegidas`): elegir dos veces la
   * misma declara una, no dos filas iguales pendientes de verificación.
   */
  protected especialidadesElegidas(): readonly string[] {
    const elegidas = [this.nuevaEspecialidad() ?? '', ...this.especialidadesExtra()].filter(
      (valor) => valor !== '',
    );
    return [...new Set(elegidas)];
  }
  /**
   * Los dos datos que el alta **no** pregunta.
   *
   * Eran dos interruptores en esta pantalla; el propietario pidió el 2026-09-10
   * que el editor se adapte al formulario del alta de médico, y el alta no
   * pregunta la certificación de junta ni —desde el 23/09/2026 (D-01)— cuál
   * es la especialidad principal.
   *
   * Se siguen mandando —el contrato los declara— con el único valor que esta
   * pantalla puede afirmar con honestidad: agregar una especialidad no cambia
   * cuál guarda el backend como principal, y nadie declaró una certificación
   * de junta. Desde el 23/09/2026 ninguna pantalla distingue la principal
   * (D-01): el dato queda sólo en el contrato.
   */
  private readonly ESPECIALIDAD_ADICIONAL = { isPrimary: false, boardCertified: false } as const;

  /** El diploma del título que se está agregando. Uno, opcional. */
  protected readonly archivoDeCredencial = signal<readonly File[]>([]);

  /** Los mismos formatos y el mismo tope que el alta de médico. */
  protected readonly formatosDeRespaldo = SUPPORT_FILE_FORMATS;
  protected readonly maxBytesDeRespaldo = MAX_ATTACHMENT_BYTES;
  protected readonly guardandoEspecialidad = signal(false);

  protected readonly puedeAgregarEspecialidad = computed(() => {
    const elegidas = this.especialidadesElegidas().length;
    const activas = this.filasEspecialidades().filter((fila) => fila.vigente).length;
    return elegidas > 0 && activas + elegidas <= MAX_SPECIALTIES_PER_PRACTITIONER;
  });

  /**
   * El título que respalda lo que se agrega, o `null` si no se eligió. Viaja
   * como `supportingCredentialId`, que es el único camino que el contrato
   * admite para respaldar una especialidad.
   *
   * Vale para todas las especialidades de un mismo envío. Y sólo en el alta:
   * ni la lectura ni la corrección traen el vínculo, así que después no se
   * muestra ni se corrige.
   */
  protected readonly tituloDeRespaldo = signal<string | null>(null);

  /**
   * Los títulos que pueden respaldar una especialidad: sólo los ya
   * verificados. La API rechaza uno pendiente («La credencial de soporte no
   * está verificada»), así que ofrecerlo sería prometer un envío que falla.
   */
  protected readonly opcionesDeRespaldo = computed<readonly SelectOption<string>[]>(() =>
    this.filasFormacion()
      .filter((fila) => !fila.pendiente)
      .map((fila) => ({
        value: fila.id,
        label:
          fila.institucion === '—'
            ? `${fila.tipo} · ${fila.numero}`
            : `${fila.tipo} · ${fila.numero} · ${fila.institucion}`,
      })),
  );

  /* -- El alta de especialidades, en un modal (D-04, 23/09/2026) -----------
     Como el del título y el de la matrícula: se abre desde «Agregar
     especialidad», en la barra de su tabla, con las casillas sumables
     adentro; confirma antes de guardar y pregunta antes de tirar lo elegido. */

  /** Si el modal del alta está abierto. Se monta con `@if`: existir es estar abierto. */
  protected readonly altaDeEspecialidadAbierta = signal(false);

  private readonly dialogoAltaDeEspecialidad = viewChild<ContentDialog>(
    'dialogoAltaDeEspecialidad',
  );

  /** Si hay algo elegido en el alta: es lo que se pierde al cerrarla sin guardar. */
  protected readonly hayDatosEnAltaDeEspecialidad = computed(
    () => this.puedeAgregarEspecialidad() || this.tituloDeRespaldo() !== null,
  );

  /** La guarda del modal: sin nada elegido cierra; con algo, pregunta si se descarta. */
  protected readonly guardaDeAltaDeEspecialidad = (): boolean | Promise<boolean> =>
    !this.hayDatosEnAltaDeEspecialidad() || this.dialogs.confirmarDescarte();

  /* -- Nueva matrícula --------------------------------------------------------- */

  protected readonly nuevoNumeroDeMatricula = signal('');
  protected readonly nuevaAutoridad = signal('');

  /**
   * Las tres autoridades del alta: Ministerio de Salud, SEDES y el colegio de
   * la profesión, con el colegio resuelto por el título elegido arriba.
   */
  protected readonly opcionesAutoridad = computed(() => opcionesAutoridadReguladora(this.titulo()));
  protected readonly nuevaFechaInscripcion = signal<Date | null>(null);
  /** El carnet del colegio. Viaja como `fileId`, igual que el diploma. */
  protected readonly archivoDeMatricula = signal<readonly File[]>([]);
  protected readonly guardandoMatricula = signal(false);

  protected readonly puedeAgregarMatricula = computed(
    () => this.nuevoNumeroDeMatricula().trim() !== '',
  );

  /* -- El alta de la matrícula, en un modal (D-04, 23/09/2026) -------------
     Como el del título: se abre desde «Agregar matrícula», en la barra de su
     tabla, confirma antes de guardar y pregunta antes de tirar lo escrito. */

  /** Si el modal del alta está abierto. Se monta con `@if`: existir es estar abierto. */
  protected readonly altaDeMatriculaAbierta = signal(false);

  private readonly dialogoAltaDeMatricula = viewChild<ContentDialog>('dialogoAltaDeMatricula');

  /** Si hay algo escrito en el alta: es lo que se pierde al cerrarla sin guardar. */
  protected readonly hayDatosEnAltaDeMatricula = computed(
    () =>
      this.nuevoNumeroDeMatricula().trim() !== '' ||
      this.nuevaAutoridad() !== '' ||
      this.nuevaFechaInscripcion() !== null ||
      this.archivoDeMatricula().length > 0,
  );

  /** La guarda del modal: sin nada escrito cierra; con algo, pregunta si se descarta. */
  protected readonly guardaDeAltaDeMatricula = (): boolean | Promise<boolean> =>
    !this.hayDatosEnAltaDeMatricula() || this.dialogs.confirmarDescarte();

  /* -- Nueva formación ----------------------------------------------------
     Mismo criterio que especialidad y matrícula: se agrega, no se edita —
     declarar un título no es haberlo acreditado, y quien lo verifica es
     `SECURITY_ADMIN` sobre uno existente. El tipo sale del catálogo dinámico
     (los cinco `CREDENTIAL_TYPE_*`), igual que la jurisdicción de la
     matrícula de acá arriba. */

  protected readonly targetCredencial = TARGET_CREDENCIAL;
  protected readonly nuevoTipoCredencial = signal<string | null>(null);
  protected readonly nuevoNumeroCredencial = signal('');
  /* -- Institución, como lista y no como texto ---------------------------
     Pedido del propietario (13/09/2026). El catálogo y el porqué de la salida
     a mano viven en `core/profesion/instituciones-educativas.ts`; acá sólo se
     decide cuál de los dos campos responde. */

  /** Con la sigla adelante, para que se lea aunque el desplegable cerrado recorte el nombre. */
  protected readonly opcionesInstitucion = OPCIONES_DE_INSTITUCION_CON_SIGLA;

  /** Lo elegido en el desplegable. `null` mientras no se eligió nada. */
  protected readonly institucionElegida = signal<string | null>(null);

  /** Lo escrito a mano, cuando la institución no está en el catálogo. */
  protected readonly institucionEscrita = signal('');

  /** Si hay que mostrar el campo escrito a mano. */
  protected readonly institucionFueraDeCatalogo = computed(
    () => this.institucionElegida() === INSTITUCION_FUERA_DE_CATALOGO,
  );

  /**
   * La institución que viaja en el alta del título.
   *
   * Del desplegable sale el **nombre**, no un id: el contrato sigue recibiendo
   * `issuingInstitutionText`, así que lo que se manda es exactamente lo que se
   * mandaba cuando el campo era libre.
   */
  protected readonly institucionDeclarada = computed(() => {
    const elegida = this.institucionElegida();
    if (elegida === null) {
      return '';
    }
    return elegida === INSTITUCION_FUERA_DE_CATALOGO ? this.institucionEscrita().trim() : elegida;
  });

  /** Si la institución se eligió del catálogo, para el aviso de la ficha vieja. */
  protected readonly esInstitucionDelCatalogo = esInstitucionDelCatalogo;
  protected readonly nuevaFechaEmisionCredencial = signal<Date | null>(null);
  protected readonly guardandoCredencial = signal(false);

  protected readonly puedeAgregarCredencial = computed(
    () => this.nuevoTipoCredencial() !== null && this.nuevoNumeroCredencial().trim() !== '',
  );

  /* -- El alta del título, en un modal (D-04, 23/09/2026) -----------------
     El formulario ya no está en línea sobre la tabla: se abre desde «Agregar
     título», en la barra, dentro de un `app-content-dialog`. Los campos son los
     mismos y viajan igual; lo nuevo es la confirmación antes de guardar y la
     pregunta antes de tirar lo escrito. */

  /** Si el modal del alta está abierto. Se monta con `@if`: existir es estar abierto. */
  protected readonly altaDeTituloAbierta = signal(false);

  private readonly dialogoAltaDeTitulo = viewChild<ContentDialog>('dialogoAltaDeTitulo');

  /** Si hay algo escrito en el alta: es lo que se pierde al cerrarla sin guardar. */
  protected readonly hayDatosEnAltaDeTitulo = computed(
    () =>
      this.nuevoTipoCredencial() !== null ||
      this.nuevoNumeroCredencial().trim() !== '' ||
      this.institucionElegida() !== null ||
      this.nuevaFechaEmisionCredencial() !== null ||
      this.archivoDeCredencial().length > 0,
  );

  /**
   * Lo que el modal consulta antes de cerrarse, sea por «Cancelar», por la cruz,
   * por `Escape` o por el fondo. Sin nada escrito cierra; con algo, pregunta si
   * se descarta. Guardar cierra saltándola: lo guardado no se descarta.
   */
  protected readonly guardaDeAltaDeTitulo = (): boolean | Promise<boolean> =>
    !this.hayDatosEnAltaDeTitulo() || this.dialogs.confirmarDescarte();

  /* -- Lo ya cargado, en tablas --------------------------------------------
     Pedido del propietario (13/09/2026): debajo de cada «Agregar», la tabla con
     lo que ya está cargado. Se leen del mismo perfil que siembra el formulario,
     así que la recarga que sigue a cada «Agregar» ya las pone al día. */

  /** Las etiquetas de los conceptos de las tres tablas. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly claveDeFila = (fila: { readonly id: string }): string => fila.id;

  /* -- La columna de acciones ---------------------------------------------
     «Que en la tabla se pueda eliminar registros, editar registros o descargar
     elementos, esto debe aparecer como botones de acciones» (propietario,
     13/09/2026). Va en **prioridad 1** en las tres tablas: una acción que se
     pliega al detalle en el teléfono es una acción que la mitad de la gente no
     encuentra.

     Las columnas pasan de arreglo a `computed` porque la plantilla de celda
     llega por `viewChild`, que es una señal: leída en un campo inicializado una
     sola vez, el `TemplateRef` todavía no existe y la celda queda vacía. */

  private readonly celdaAccionesFormacion =
    viewChild.required<TemplateRef<{ $implicit: FilaFormacion }>>('celdaAccionesFormacion');

  /* -- El estado en la fila, en el teléfono --------------------------------
     Por debajo de 780 px las columnas de prioridad 2 pasan al detalle, «Estado»
     incluida, y la fila de algo pendiente se veía igual a la de algo
     verificado. El identificador lleva el estado debajo en esos anchos (ver la
     plantilla); desde 780 px lo dice su columna. */

  private readonly celdaNumeroFormacion =
    viewChild.required<TemplateRef<{ $implicit: FilaFormacion }>>('celdaNumeroFormacion');

  private readonly celdaEspecialidad =
    viewChild.required<TemplateRef<{ $implicit: FilaEspecialidad }>>('celdaEspecialidad');

  private readonly celdaNumeroMatricula =
    viewChild.required<TemplateRef<{ $implicit: FilaMatricula }>>('celdaNumeroMatricula');

  /**
   * Desde 780 px las seis columnas van en la fila, como pide D-09. Más angosto,
   * la fila lleva el número, con su estado debajo, y las acciones; el resto pasa
   * al detalle (prioridad 2), que se abre con ▼; es lo que hace el historial laboral de la
   * misma pestaña. Medido a 375 (H4.S3.M4): con el tipo y el estado también en
   * la fila, la tabla medía 411 px en 301 y se desplazaba a lo ancho.
   */
  protected readonly columnasFormacion = computed<readonly ColumnDef<FilaFormacion>[]>(() => [
    { key: 'tipo', header: 'Tipo', priority: 2 },
    { key: 'numero', header: 'Número / título', priority: 1, cell: this.celdaNumeroFormacion() },
    { key: 'institucion', header: 'Institución', priority: 2 },
    { key: 'emision', header: 'Emisión', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 2 },
    {
      key: 'acciones',
      header: 'Acciones',
      priority: 1,
      align: 'end',
      cell: this.celdaAccionesFormacion(),
    },
  ]);

  /**
   * Sin columna «Tipo» desde el 23/09/2026: decía «Principal» o «Adicional» y
   * ofrecía «Marcar como principal», y el médico pidió que todas las
   * especialidades se vieran iguales (D-01). En el teléfono la fila lleva la
   * especialidad y las acciones, y la fecha y el estado pasan al detalle, como
   * en las otras dos tablas: con el estado en la fila, a 375 medía 350 px en 301
   * (H4.S3.M4).
   */
  protected readonly columnasEspecialidades = computed<readonly ColumnDef<FilaEspecialidad>[]>(
    () => [
      { key: 'especialidad', header: 'Especialidad', priority: 1, cell: this.celdaEspecialidad() },
      { key: 'desde', header: 'Desde', priority: 2 },
      { key: 'estado', header: 'Estado', priority: 2 },
      {
        key: 'acciones',
        header: 'Acciones',
        priority: 1,
        align: 'end',
        cell: this.celdaAccionesEspecialidad(),
      },
    ],
  );

  private readonly celdaAccionesEspecialidad = viewChild.required<
    TemplateRef<{ $implicit: FilaEspecialidad }>
  >('celdaAccionesEspecialidad');

  private readonly celdaAccionesMatricula =
    viewChild.required<TemplateRef<{ $implicit: FilaMatricula }>>('celdaAccionesMatricula');

  /**
   * Mismo criterio que la de títulos: en el teléfono, el número y las acciones;
   * autoridad, inscripción y estado van al detalle. Con la autoridad y el estado
   * en la fila, a 375 la tabla medía 425 px en 301 (H4.S3.M4).
   */
  protected readonly columnasMatriculas = computed<readonly ColumnDef<FilaMatricula>[]>(() => [
    { key: 'numero', header: 'Nº de matrícula', priority: 1, cell: this.celdaNumeroMatricula() },
    { key: 'autoridad', header: 'Autoridad', priority: 2 },
    { key: 'inscripcion', header: 'Inscripción', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 2 },
    {
      key: 'acciones',
      header: 'Acciones',
      priority: 1,
      align: 'end',
      cell: this.celdaAccionesMatricula(),
    },
  ]);

  /** Los títulos, del más reciente al más antiguo, como en la ficha. */
  protected readonly filasFormacion = computed<readonly FilaFormacion[]>(() => {
    const perfil = this.datos();
    if (perfil === null) return [];
    return [...perfil.credentials]
      .sort((a, b) => marcaDeTiempo(b.issueDate) - marcaDeTiempo(a.issueDate))
      .map((credencial) => ({
        id: credencial.id,
        tipo: this.etiqueta(credencial.credentialTypeConceptId, 'Título'),
        numero: credencial.number,
        institucion: institucionConCodigo(credencial.issuingInstitutionText ?? '—'),
        emision: fechaLegible(credencial.issueDate),
        estado:
          credencial.verifiedAt !== undefined
            ? 'Verificado'
            : this.etiqueta(credencial.stateConceptId, PENDIENTE_DE_VERIFICACION),
        ...(credencial.fileId === undefined ? {} : { fileId: credencial.fileId }),
        pendiente: credencial.verifiedAt === undefined,
      }));
  });

  /**
   * Las especialidades, en el orden en que llegan: ninguna se adelanta por
   * ser la principal (D-01, 23/09/2026).
   */
  protected readonly filasEspecialidades = computed<readonly FilaEspecialidad[]>(() => {
    const perfil = this.datos();
    if (perfil === null) return [];
    const delCatalogo = new Map(this.especialidades().map((o) => [o.value, o.label]));
    return perfil.specialties.map((especialidad) => ({
      id: especialidad.id,
      especialidad: this.etiqueta(
        especialidad.specialtyConceptId,
        delCatalogo.get(especialidad.specialtyConceptId) ?? 'Especialidad',
      ),
      desde: fechaLegible(especialidad.validFrom),
      estado: especialidad.verified
        ? 'Verificada'
        : this.etiqueta(especialidad.verificationStatusConceptId, PENDIENTE_DE_VERIFICACION),
      pendiente: !especialidad.verified,
      vigente: especialidad.validTo === undefined,
    }));
  });

  protected readonly filasMatriculas = computed<readonly FilaMatricula[]>(() => {
    const perfil = this.datos();
    if (perfil === null) return [];
    return perfil.licenses.map((matricula) => ({
      id: matricula.id,
      numero: matricula.licenseNumber,
      autoridad: matricula.regulatoryAuthority ?? '—',
      inscripcion: fechaLegible(matricula.validFrom),
      estado: this.etiqueta(matricula.stateConceptId, PENDIENTE_DE_VERIFICACION),
      estadoConceptId: matricula.stateConceptId,
      ...(matricula.fileId === undefined ? {} : { fileId: matricula.fileId }),
      pendiente: matriculaPendiente(this.etiquetas().get(matricula.stateConceptId)?.code),
    }));
  });

  /* -- La barra de la tabla de títulos (D-10, ADR-0015 regla 5) ------------
     Buscador por tipo, número e institución, sin distinguir tildes ni
     mayúsculas, y filtro por estado. `app-filter-bar` guarda lo elegido en la
     URL y avisa sólo cuando cambia: lo buscado arranca con lo que la URL ya
     traiga, que es lo que la barra muestra al dibujarse. */

  protected readonly claveBusquedaTitulo = CLAVE_BUSQUEDA_TITULO;

  protected readonly filtrosFormacion: readonly FilterDef[] = [
    { key: CLAVE_ESTADO_TITULO, label: 'Estado', options: OPCIONES_DE_ESTADO },
  ];

  private readonly busquedaFormacion = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_BUSQUEDA_TITULO) ?? '',
  );

  private readonly estadoFormacionElegido = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_ESTADO_TITULO),
  );

  /** Los títulos que pasan la búsqueda y el filtro, en el mismo orden. */
  protected readonly filasFormacionVisibles = computed(() =>
    this.filasFormacion().filter(
      (fila) =>
        coincideConLaBusqueda(this.busquedaFormacion(), [
          fila.tipo,
          fila.numero,
          fila.institucion,
        ]) && coincideConElEstado(this.estadoFormacionElegido(), fila.pendiente),
    ),
  );

  /* -- La paginación de las tres tablas (H4.S3) -------------------------
     En cliente, como el historial laboral: la lectura trae el perfil entero,
     y pedir una página por vez sería una petición por tecla para una lista
     que ya está en memoria (ADR-0015, «Paginación»). Buscar o filtrar
     vuelve a la primera página. */

  protected readonly paginaFormacion = signal(1);
  protected readonly tamanoPaginaFormacion = signal(FILAS_POR_PAGINA);
  protected readonly paginaEspecialidades = signal(1);
  protected readonly tamanoPaginaEspecialidades = signal(FILAS_POR_PAGINA);
  protected readonly paginaMatriculas = signal(1);
  protected readonly tamanoPaginaMatriculas = signal(FILAS_POR_PAGINA);

  protected readonly estadoFormacion = computed(() =>
    ready(
      filasDeLaPagina(
        this.filasFormacionVisibles(),
        this.paginaFormacion(),
        this.tamanoPaginaFormacion(),
      ),
    ),
  );
  protected readonly estadoEspecialidades = computed(() =>
    ready(
      filasDeLaPagina(
        this.filasEspecialidadesVisibles(),
        this.paginaEspecialidades(),
        this.tamanoPaginaEspecialidades(),
      ),
    ),
  );
  protected readonly estadoMatriculas = computed(() =>
    ready(
      filasDeLaPagina(
        this.filasMatriculasVisibles(),
        this.paginaMatriculas(),
        this.tamanoPaginaMatriculas(),
      ),
    ),
  );

  /* -- La barra de la tabla de matrículas (D-10, ADR-0015 regla 5) ---------
     Busca por número y autoridad. Arranca con lo que la URL ya traiga, igual
     que la de títulos. */

  /* -- La barra de la tabla de especialidades (D-10, ADR-0015 regla 5) -----
     Busca por el nombre de la especialidad y filtra por estado, cada uno con
     su clave en la URL. La especialidad trae un sí/no de verificada, como el
     título, así que el filtro es el mismo. */

  protected readonly claveBusquedaEspecialidad = CLAVE_BUSQUEDA_ESPECIALIDAD;

  private readonly busquedaEspecialidades = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_BUSQUEDA_ESPECIALIDAD) ?? '',
  );

  protected readonly filtrosEspecialidades: readonly FilterDef[] = [
    {
      key: CLAVE_ESTADO_ESPECIALIDAD,
      label: 'Estado',
      options: OPCIONES_DE_ESTADO_DE_ESPECIALIDAD,
    },
  ];

  private readonly estadoEspecialidadElegido = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_ESTADO_ESPECIALIDAD),
  );

  /** Las especialidades que pasan la búsqueda y el filtro, en el mismo orden. */
  protected readonly filasEspecialidadesVisibles = computed(() =>
    this.filasEspecialidades().filter(
      (fila) =>
        coincideConLaBusqueda(this.busquedaEspecialidades(), [fila.especialidad]) &&
        coincideConElEstado(this.estadoEspecialidadElegido(), fila.pendiente),
    ),
  );

  protected readonly claveBusquedaMatricula = CLAVE_BUSQUEDA_MATRICULA;

  private readonly busquedaMatriculas = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_BUSQUEDA_MATRICULA) ?? '',
  );

  /**
   * El filtro «Estado» de las matrículas ofrece los estados que traen.
   *
   * La matrícula no tiene un sí/no de verificada como el título: sólo su
   * `stateConceptId`, del value set del modelo. Traducirlo a «pendiente» o
   * «verificada» sería inventar una equivalencia que el contrato no declara,
   * así que se filtra por el concepto, con la etiqueta que muestra la tabla.
   * Sin matrículas no hay opciones, y la barra dibuja el filtro deshabilitado.
   */
  protected readonly filtrosMatriculas = computed<readonly FilterDef[]>(() => [
    {
      key: CLAVE_ESTADO_MATRICULA,
      label: 'Estado',
      options: estadosPresentes(this.filasMatriculas()),
    },
  ]);

  private readonly estadoMatriculaElegido = signal(
    this.ruta.snapshot.queryParamMap.get(CLAVE_ESTADO_MATRICULA),
  );

  /** Las matrículas que pasan la búsqueda y el filtro, en el mismo orden. */
  protected readonly filasMatriculasVisibles = computed(() =>
    this.filasMatriculas().filter(
      (fila) =>
        coincideConLaBusqueda(this.busquedaMatriculas(), [fila.numero, fila.autoridad]) &&
        coincideConElConcepto(this.estadoMatriculaElegido(), fila.estadoConceptId),
    ),
  );

  /** La etiqueta de un concepto, o lo que se diga mientras no llegue. */
  private etiqueta(conceptId: string | undefined, porDefecto: string): string {
    if (conceptId === undefined) return porDefecto;
    return this.etiquetas().get(conceptId)?.display ?? porDefecto;
  }

  /**
   * Los datos del alta que el editor **muestra y no deja tocar**.
   *
   * El doctor pidió que editar muestre todos los campos (C-05). Éstos no se
   * pueden escribir —el contrato de corrección del perfil no los acepta—, pero
   * eso no es razón para que no aparezcan: quien entra a corregir su documento
   * hoy no encuentra ni el dato ni el motivo.
   *
   * Se dibujan como renglones de ficha y **no como campos deshabilitados**: un
   * control apagado invita a buscar cómo encenderlo, y acá no hay forma.
   *
   * `undefined` en los tres cuando el perfil todavía no cargó; vacío cuando la
   * persona no lo tiene, que es distinto y se dice distinto.
   */
  protected readonly soloLectura = computed(() => {
    const perfil = this.datos();
    if (perfil === null) return null;
    return {
      documento: perfil.nationalId ?? '',
      departamento: this.etiqueta(perfil.issuerAdministrativeAreaConceptId, ''),
    };
  });

  /**
   * Pide las etiquetas de lo que muestran las tablas. Un fallo no rompe nada:
   * las tablas siguen, con «Pendiente de verificación» en vez del estado.
   */
  private cargarEtiquetas(perfil: OwnPractitionerProfile): void {
    const ids = [
      ...perfil.specialties.flatMap((e) => [e.specialtyConceptId, e.verificationStatusConceptId]),
      ...perfil.credentials.flatMap((c) => [c.credentialTypeConceptId, c.stateConceptId]),
      ...perfil.licenses.map((m) => m.stateConceptId),
      // El departamento que emitió el documento: se muestra al lado del número
      // y sin su etiqueta el renglón diría un uuid.
      perfil.issuerAdministrativeAreaConceptId,
    ].filter((id): id is string => id !== undefined);
    this.terminologia
      .readConceptLabels(ids)
      .pipe(catchError(() => of<ConceptLabels>(new Map())))
      .subscribe((etiquetas) => this.etiquetas.set(etiquetas));
  }

  constructor() {
    this.abrirEnLaPestanaPedida();
    this.cargar();
    this.cargarEspecialidades();
  }

  /**
   * Abre el editor en la pestaña que traiga `?pestana=`, si es una que existe.
   *
   * Del snapshot y no del observable: es la pestaña con la que se ENTRA, no una
   * que la URL siga mandando después. Sin número, número ilegible o número
   * fuera de rango, queda la primera — que es lo que pasaba siempre hasta que
   * el lápiz empezó a decir de dónde venía.
   */
  private abrirEnLaPestanaPedida(): void {
    const pedida = Number(this.ruta.snapshot.queryParamMap.get('pestana'));
    if (Number.isInteger(pedida) && pedida >= 0 && pedida < PESTANAS_DEL_EDITOR_MEDICO.length) {
      this.pestana.set(pedida);
    }
  }

  /**
   * Trae el catálogo de especialidades.
   *
   * Un fallo no rompe la pantalla: el resto —título, biografía, matrículas—
   * sigue siendo editable, y el bloque de especialidad dice qué pasó y ofrece
   * reintentar. Perder el catálogo no es perder el perfil.
   */
  protected cargarEspecialidades(): void {
    this.catalogo.listar().subscribe({
      next: (opciones) => {
        this.catalogoCaido.set(false);
        this.especialidades.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.especialidades.set([]);
        this.catalogoCaido.set(true);
      },
    });
  }

  /**
   * Reintenta la lectura del catálogo.
   *
   * Olvida lo cacheado antes de pedir: `shareReplay` guarda también el error,
   * así que sin esto el botón «Reintentar» repetiría el mismo fallo sin llegar
   * a tocar la red.
   */
  protected reintentarEspecialidades(): void {
    this.catalogo.olvidar();
    this.cargarEspecialidades();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
        this.cargarEtiquetas(perfil);
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPractitionerProfile>(error)),
    });
  }

  /**
   * Llena el formulario con lo que ya hay guardado.
   *
   * Sólo al cargar, no en cada cambio del perfil: si un `computed` volviera a
   * sembrar el formulario cada vez que `perfil` cambia, escribir en un campo
   * mientras la pantalla revalida perdería lo que la persona acaba de teclear.
   */
  private sembrarFormulario(perfil: OwnPractitionerProfile): void {
    this.titulo.set(perfil.professionalTitle ?? '');
    this.bio.set(perfil.professionalBio ?? '');
    this.nombre.set(perfil.name ?? '');
    // `middleName` trae TODOS los nombres que no son el primero, separados por
    // espacio: se reparten en las mismas casillas que el alta ofrece.
    const adicionales = separarNombres(perfil.middleName);
    this.segundoNombre.set(adicionales.segundo);
    this.tercerNombre.set(adicionales.tercero);
    this.nombresExtra.set(adicionales.extra);
    this.apellidoPaterno.set(perfil.lastName ?? '');
    this.apellidoMaterno.set(perfil.motherLastName ?? '');
    this.celularPersonal.reset(perfil.mobilePhone ?? '');
    this.correoPersonal.set(perfil.personalEmail ?? '');
    this.correoTrabajo.set(correoDeTrabajoDe(perfil));
    this.errorCorreoTrabajo.set('');
    this.nit.set(perfil.taxId ?? '');
    this.razonSocial.set(perfil.taxHolderName ?? '');
    this.telemedicina.set(perfil.telehealthAvailable);
    // ALV-003: los dos campos que el contrato ya aceptaba y el formulario no
    // ofrecía. Se siembran desde el perfil, igual que el resto.
    this.fechaNacimiento.set(perfil.birthDate ?? null);
    this.municipioResidencia.set(perfil.residenceMunicipalityConceptId ?? null);
    this.sexoAlNacer.set(perfil.sexAtBirth ?? null);
    this.departamentoEmisor.set(perfil.issuerAdministrativeAreaConceptId ?? null);
    if (this.opcionesDepartamento().length === 0) {
      this.cargarDepartamentos();
    }
    // ALV-009: la calle, si la declaró.
    this.direccion.set(perfil.homeAddress?.lines ?? '');
    // Y su punto en el mapa. Las dos mitades tienen que estar: una latitud sin
    // longitud pondría el pin en el meridiano cero.
    const lat = perfil.homeAddress?.latitude;
    const lng = perfil.homeAddress?.longitude;
    this.gpsDomicilioGuardado.set(lat === undefined || lng === undefined ? null : { lat, lng });
    this.gpsDomicilio.set(undefined);
    this.direccionTrabajo.set(perfil.workAddress?.lines ?? '');
    const latTrabajo = perfil.workAddress?.latitude;
    const lngTrabajo = perfil.workAddress?.longitude;
    this.gpsTrabajoGuardado.set(
      latTrabajo === undefined || lngTrabajo === undefined
        ? null
        : { lat: latTrabajo, lng: lngTrabajo },
    );
    this.gpsTrabajo.set(undefined);
    if (this.ramasMunicipios().length === 0 && !this.catalogoMunicipiosCaido()) {
      this.cargarMunicipios();
    }
  }

  /**
   * Trae el árbol de municipios para «dónde vivís». Mismo criterio que el
   * alta ante un fallo: el campo es opcional y el resto del formulario sigue.
   */
  protected cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.ramasMunicipios.set(ramas);
      },
      error: () => {
        this.ramasMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  /** Trae los departamentos para «departamento que emitió tu documento». Un fallo no rompe el resto. */
  protected cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) =>
        this.opcionesDepartamento.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        ),
      error: () => this.opcionesDepartamento.set([]),
    });
  }

  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
  }

  /**
   * Cancela la edición de Datos personales, Contacto y Facturación.
   *
   * No navega a ningún lado: es un formulario repartido en tres pestañas de
   * la MISMA pantalla, y «cancelar» yéndose obligaría a volver a entrar para
   * seguir mirando el resto del perfil. Vuelve a sembrar los tres paneles con
   * lo último que el servidor confirmó —la misma función que ya usa un
   * guardado exitoso—, así que descarta lo tipeado sin tocar la red.
   *
   * Nada mientras hay un guardado en curso: cancelar a mitad de un `PATCH`
   * dejaría el formulario mostrando un valor que la respuesta, todavía en
   * vuelo, podría pisar igual.
   */
  protected cancelarEdicion(): void {
    const original = this.datos();
    if (original === null || this.guardandoPresentacion()) {
      return;
    }
    this.erroresDelServidor.set(new Map());
    this.sembrarFormulario(original);
    this.toasts.success('Descartamos los cambios sin guardar.', 'Edición cancelada');
  }

  /**
   * Guarda la presentación.
   *
   * Sólo se manda lo que cambió respecto de lo cargado: mandar los cuatro
   * campos siempre funcionaría igual —es un `PATCH` idempotente— pero mandar
   * sólo el cambio dice, en la petición misma, qué fue lo que la persona quiso
   * tocar, y eso es lo que el registro de auditoría del backend termina
   * mostrando.
   */
  protected guardarPresentacion(): void {
    const original = this.datos();
    if (original === null || this.guardandoPresentacion()) {
      return;
    }

    // Cada intento de guardar empieza limpio. Los rechazos del anterior hablan
    // de valores que la persona pudo cambiar —o devolver a lo guardado—: si
    // este intento no llega al servidor, nadie los confirma, y dejarlos
    // pintados es señalar en rojo un campo que ya está bien. Si siguen
    // valiendo, el próximo envío los trae de vuelta.
    this.erroresDelServidor.set(new Map());

    // Un teléfono a medias no viaja: se marca, se lleva a la persona a
    // «Contacto» —puede estar mirando «Datos personales»— y se dice por qué.
    const telefonos = [this.celularPersonal];
    if (telefonos.some((telefono) => telefono.invalid)) {
      telefonos.forEach((telefono) => telefono.markAsTouched());
      this.pestana.set(PESTANA_EDITOR.contacto);
      this.toasts.error('Hay un teléfono incompleto. Revisalo en «Contacto».', 'Perfil');
      return;
    }

    // El correo de trabajo, igual: uno vacío o mal escrito no viaja.
    const correoTrabajo = this.correoTrabajo().trim();
    const correoTrabajoCambio = correoTrabajo !== correoDeTrabajoDe(original);
    this.errorCorreoTrabajo.set(
      !correoTrabajoCambio
        ? ''
        : correoTrabajo === ''
          ? 'Escribí tu correo de trabajo.'
          : PATRON_CORREO.test(correoTrabajo)
            ? ''
            : 'Revisá el correo: le falta algo, como la @ o el dominio.',
    );
    if (this.errorCorreoTrabajo()) {
      this.pestana.set(PESTANA_EDITOR.contacto);
      this.toasts.error('El correo de trabajo no es válido. Revisalo en «Contacto».', 'Perfil');
      return;
    }

    const cambios: Partial<{
      professionalTitle: string;
      professionalBio: string;
      acceptsNewPatients: boolean;
      telehealthAvailable: boolean;
      name: string;
      middleName: string;
      lastName: string;
      motherLastName: string;
      mobilePhone: string;
      personalEmail: string;
      workEmail: string;
      birthDate: string;
      sexAtBirth: BirthSexCode;
      issuerAdministrativeAreaConceptId: string;
      residenceMunicipalityConceptId: string;
      homeAddressLines: string;
      homeLatitude: number | null;
      homeLongitude: number | null;
      workAddressLines: string;
      workLatitude: number | null;
      workLongitude: number | null;
      taxId: string;
      taxHolderName: string;
    }> = {};
    // ALV-003/009: los dos campos nuevos viajan sólo si cambiaron, como el
    // resto. La fecha se compara por día local (`toISOString` la pasaría por
    // UTC y correría un día al oeste de Greenwich).
    const fechaOriginal = original.birthDate ? soloFecha(original.birthDate) : '';
    const fechaEditada = this.fechaNacimiento();
    const fechaNueva = fechaEditada === null ? '' : soloFecha(fechaEditada);
    if (fechaNueva !== '' && fechaNueva !== fechaOriginal) {
      cambios.birthDate = fechaNueva;
    }
    // P28: sólo viajan si cambiaron, y nunca vacíos (la API no los acepta vacíos).
    const sexo = this.sexoAlNacer();
    if (sexo !== null && sexo !== original.sexAtBirth) {
      cambios.sexAtBirth = sexo;
    }
    const departamento = this.departamentoEmisor();
    if (
      departamento !== null &&
      departamento !== (original.issuerAdministrativeAreaConceptId ?? null)
    ) {
      cambios.issuerAdministrativeAreaConceptId = departamento;
    }
    const municipio = this.municipioResidencia();
    if (municipio !== null && municipio !== (original.residenceMunicipalityConceptId ?? null)) {
      cambios.residenceMunicipalityConceptId = municipio;
    }
    if (this.direccion() !== (original.homeAddress?.lines ?? '')) {
      cambios.homeAddressLines = this.direccion();
    }
    // El punto, con los mismos tres estados que en el editor del paciente:
    // `undefined` no viaja, `null` quita y un par mueve. Mandar el punto actual
    // «por las dudas» convertiría cada guardado en una reescritura del mapa.
    const gps = this.gpsDomicilio();
    if (gps === null) {
      cambios.homeLatitude = null;
      cambios.homeLongitude = null;
    } else if (gps !== undefined) {
      cambios.homeLatitude = gps.lat;
      cambios.homeLongitude = gps.lng;
    }
    if (this.direccionTrabajo() !== (original.workAddress?.lines ?? '')) {
      cambios.workAddressLines = this.direccionTrabajo();
    }
    const gpsTrabajo = this.gpsTrabajo();
    if (gpsTrabajo === null) {
      cambios.workLatitude = null;
      cambios.workLongitude = null;
    } else if (gpsTrabajo !== undefined) {
      cambios.workLatitude = gpsTrabajo.lat;
      cambios.workLongitude = gpsTrabajo.lng;
    }
    if (this.titulo() !== (original.professionalTitle ?? '')) {
      cambios.professionalTitle = this.titulo();
    }
    if (this.bio() !== (original.professionalBio ?? '')) {
      cambios.professionalBio = this.bio();
    }
    // «Acepto pacientes nuevos» siempre está habilitado: un perfil que lo tenía
    // apagado se corrige en el primer guardado, sin preguntar.
    if (!original.acceptsNewPatients) {
      cambios.acceptsNewPatients = true;
    }
    if (this.telemedicina() !== original.telehealthAvailable) {
      cambios.telehealthAvailable = this.telemedicina();
    }
    // Los personales viajan igual que los otros: sólo si cambiaron. Una cadena
    // vacía SÍ viaja —es cómo se borra un segundo nombre— y por eso se compara
    // contra el original en vez de descartar los vacíos.
    if (this.nombre() !== (original.name ?? '')) cambios.name = this.nombre();
    // Los tres controles de nombre son un solo campo del contrato: viaja la
    // cadena entera, y por eso se compara la cadena entera. Vacía SÍ viaja —es
    // cómo se borra un segundo nombre que no se lleva—.
    if (this.nombresAdicionales() !== (original.middleName ?? '')) {
      cambios.middleName = this.nombresAdicionales();
    }
    if (this.apellidoPaterno() !== (original.lastName ?? '')) {
      cambios.lastName = this.apellidoPaterno();
    }
    if (this.apellidoMaterno() !== (original.motherLastName ?? '')) {
      cambios.motherLastName = this.apellidoMaterno();
    }
    if (this.celularPersonal.value !== (original.mobilePhone ?? '')) {
      cambios.mobilePhone = this.celularPersonal.value;
    }
    if (this.correoPersonal() !== (original.personalEmail ?? '')) {
      cambios.personalEmail = this.correoPersonal();
    }
    if (correoTrabajoCambio) {
      cambios.workEmail = correoTrabajo;
    }
    // Facturación. Se comparan contra el original y no se descartan los
    // vacíos: `''` es cómo se saca un NIT cargado mal, igual que en el editor
    // del paciente.
    if (this.nit() !== (original.taxId ?? '')) {
      cambios.taxId = this.nit();
    }
    if (this.razonSocial() !== (original.taxHolderName ?? '')) {
      cambios.taxHolderName = this.razonSocial();
    }

    if (Object.keys(cambios).length === 0) {
      this.toasts.success('No había ningún cambio para guardar.', 'Perfil');
      return;
    }

    this.guardandoPresentacion.set(true);
    this.profiles.updateOwnPractitionerProfile(cambios).subscribe({
      next: (perfil) => {
        this.guardandoPresentacion.set(false);
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
        this.toasts.success('Tu perfil quedó actualizado.', 'Perfil');
      },
      error: (error: unknown) => {
        this.guardandoPresentacion.set(false);
        this.anclarErroresDelServidor(error);
      },
    });
  }

  /**
   * Los rechazos del servidor, por campo.
   *
   * Hasta el 21/09/2026 un `PATCH` rechazado mostraba **sólo** «No se pudo
   * guardar el cambio. Probá de nuevo.»: el detalle que el servidor manda
   * —`details.violations`, que `errorToViewState` ya desarma en problemas con
   * su campo— se descartaba entero. Con quince campos en un solo formulario,
   * eso deja a la persona probando de nuevo lo mismo sin saber cuál está mal.
   *
   * La clave es el nombre del campo **del contrato** (`taxId`,
   * `personalEmail`), no el del control: es lo que devuelve el servidor y lo
   * que la plantilla pide con {@link errorDelServidor}.
   */
  private readonly erroresDelServidor = signal<ReadonlyMap<string, string>>(new Map());

  /** El mensaje que el servidor dio para ese campo, o vacío. */
  protected errorDelServidor(campo: string): string {
    return this.erroresDelServidor().get(campo) ?? '';
  }

  /**
   * Reparte el rechazo entre los campos que nombra, y avisa una sola vez.
   *
   * Lo que no se puede anclar a un campo —un conflicto, un 500, un problema de
   * red— sigue saliendo por el aviso general, que es donde se puede leer sin
   * tener que buscar en siete pestañas. Y se avisa **igual** aunque el detalle
   * sí tenga campo, porque el campo puede estar en una pestaña cerrada: sin el
   * aviso, guardar parecería no haber hecho nada.
   */
  private anclarErroresDelServidor(error: unknown): void {
    const estado = errorToViewState<unknown>(error);
    const problemas = estado.status === 'validation' ? estado.issues : [];
    const porCampo = new Map<string, string>();
    for (const problema of problemas) {
      if (problema.field !== undefined && !porCampo.has(problema.field)) {
        porCampo.set(problema.field, problema.message);
      }
    }
    this.erroresDelServidor.set(porCampo);

    if (porCampo.size > 0) {
      this.toasts.error('Revisá los campos marcados y volvé a guardar.', 'Perfil');
      return;
    }
    const sueltos = problemas.map((problema) => problema.message).join(' ');
    this.toasts.error(sueltos || 'No se pudo guardar el cambio. Probá de nuevo.', 'Perfil');
  }

  /**
   * Agrega TODAS las especialidades elegidas, no una.
   *
   * Un envío por especialidad —el contrato es `POST .../specialties`, de a
   * una— pero un solo gesto de la persona: las peticiones salen juntas y la
   * pantalla espera a que terminen todas antes de recargar el perfil, para no
   * pintar una lista a medio llenar.
   *
   * Si alguna falla se avisa y **no** se limpia el formulario: lo elegido
   * sigue ahí para reintentar. La recarga corre igual, así que las que sí
   * entraron aparecen en el perfil y no se agregan dos veces.
   *
   * Antes de enviar se pregunta «¿Confirmás estos datos?», como en el alta del
   * título. Si no se confirma no viaja nada y el modal sigue abierto.
   */
  protected async agregarEspecialidad(): Promise<void> {
    const profileId = this.profileId();
    const elegidas = this.especialidadesElegidas();
    if (
      profileId === null ||
      elegidas.length === 0 ||
      !this.puedeAgregarEspecialidad() ||
      this.guardandoEspecialidad()
    ) {
      return;
    }

    const varias = elegidas.length > 1;
    const confirmado = await this.dialogs.confirmarCambios({
      title: '¿Confirmás estos datos?',
      message: varias
        ? `Se agregan ${elegidas.length} especialidades y quedan pendientes de verificación.`
        : 'La especialidad se agrega y queda pendiente de verificación.',
    });
    if (!confirmado) {
      return;
    }

    const respaldo = this.tituloDeRespaldo();
    this.guardandoEspecialidad.set(true);
    forkJoin(
      elegidas.map((especialidad) =>
        this.profiles.addSpecialty(profileId, {
          specialtyConceptId: especialidad,
          isPrimary: this.ESPECIALIDAD_ADICIONAL.isPrimary,
          boardCertified: this.ESPECIALIDAD_ADICIONAL.boardCertified,
          ...(respaldo === null ? {} : { supportingCredentialId: respaldo }),
        }),
      ),
    ).subscribe({
      next: () => {
        this.guardandoEspecialidad.set(false);
        // Cerrar saltando la guarda: lo que se acaba de guardar no se descarta.
        this.dialogoAltaDeEspecialidad()?.close(true);
        this.cerrarAltaDeEspecialidad();
        this.toasts.success(
          varias
            ? `Se agregaron ${elegidas.length} especialidades. Quedan pendientes de verificación.`
            : 'Se agregó la especialidad. Queda pendiente de verificación.',
          'Especialidades',
        );
        this.cargar();
      },
      error: () => {
        this.guardandoEspecialidad.set(false);
        this.toasts.error(
          varias
            ? 'No se pudieron agregar todas las especialidades. Revisá cuáles quedaron y probá de nuevo.'
            : 'No se pudo agregar la especialidad. Probá de nuevo.',
          'Especialidades',
        );
        this.cargar();
      },
    });
  }

  /**
   * Agrega una matrícula, con su respaldo si lo hay.
   *
   * **Dos pasos, no uno**, igual que el título: el archivo se sube primero con
   * `FilesClient.upload` y su identificador viaja como `fileId`. Hasta el
   * 13/09/2026 el contrato no tenía ese campo —`NewJurisdictionAuthorization`
   * no lo declaraba— así que este formulario aceptaba el PDF, lo mostraba con
   * su nombre y su peso, y lo **tiraba en silencio** al guardar: el defecto que
   * el bloqueo de `docs/progress/BLOCKERS.md` describía. Ya no.
   *
   * Si la subida falla **no se crea la matrícula**: una matrícula sin el carnet
   * que la persona creyó haber adjuntado es peor que un error, porque nadie se
   * entera hasta que se la rechazan.
   *
   * Antes de enviar se pregunta «¿Confirmás estos datos?», como en el alta del
   * título. Si no se confirma no viaja nada y el modal sigue abierto, con lo
   * escrito intacto.
   */
  protected async agregarMatricula(): Promise<void> {
    const profileId = this.profileId();
    const numero = this.nuevoNumeroDeMatricula().trim();
    if (profileId === null || numero === '' || this.guardandoMatricula()) {
      return;
    }

    const confirmado = await this.dialogs.confirmarCambios({
      title: '¿Confirmás estos datos?',
      message: 'La matrícula se agrega a tus credenciales y queda pendiente de verificación.',
    });
    if (!confirmado) {
      return;
    }

    this.guardandoMatricula.set(true);
    const archivo = this.archivoDeMatricula()[0];
    if (archivo === undefined) {
      this.crearMatricula(profileId, numero, undefined);
      return;
    }

    // `DOCUMENT`/`PHI`: es documentación de una persona identificable, el mismo
    // par con el que sube su diploma el título de acá abajo.
    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.crearMatricula(profileId, numero, id),
      error: () => {
        this.guardandoMatricula.set(false);
        this.toasts.error(
          'No pudimos subir el respaldo, así que no se agregó la matrícula. Probá de nuevo.',
          'Matrículas',
        );
      },
    });
  }

  /** El alta de la matrícula en sí, con el respaldo ya subido si lo había. */
  private crearMatricula(profileId: string, numero: string, fileId: string | undefined): void {
    const fechaInscripcion = this.nuevaFechaInscripcion();
    this.profiles
      .addJurisdictionAuthorization(profileId, {
        licenseNumber: numero,
        regulatoryAuthority: this.nuevaAutoridad().trim() || undefined,
        validFrom: fechaInscripcion === null ? undefined : fechaIso(fechaInscripcion),
        ...(fileId === undefined ? {} : { fileId }),
      })
      .subscribe({
        next: () => {
          this.guardandoMatricula.set(false);
          // Cerrar saltando la guarda: lo que se acaba de guardar no se descarta.
          this.dialogoAltaDeMatricula()?.close(true);
          this.cerrarAltaDeMatricula();
          this.toasts.success(
            'Se agregó la matrícula. Queda pendiente de verificación.',
            'Matrículas',
          );
          this.cargar();
        },
        error: () => {
          this.guardandoMatricula.set(false);
          this.toasts.error('No se pudo agregar la matrícula. Probá de nuevo.', 'Matrículas');
        },
      });
  }

  /**
   * Agrega un título propio, con su diploma si lo hay.
   *
   * Nace pendiente de verificación, como la especialidad y la matrícula:
   * declarar un título no es haberlo acreditado.
   *
   * **Dos pasos, no uno** (propietario, 2026-09-10: «poder agregar las
   * matrículas y adjuntos en base a su módulo de creación de médico»). El
   * archivo se sube primero con `FilesClient.upload` y su identificador viaja
   * como `fileId` del título — la misma cadena que ya usa la verificación de
   * identidad, y el mismo motivo por el que están separados en el backend: el
   * mismo archivo puede colgarse de más de un recurso.
   *
   * Si la subida falla **no se crea el título**: un título sin el diploma que
   * la persona creyó haber adjuntado es peor que un error, porque nadie se
   * entera hasta que lo rechazan.
   *
   * Antes de enviar se pregunta «¿Confirmás estos datos?» (D-04, H3.S1.M4). El
   * ADR-0015 exime el alta de esa pregunta; el encargo de esta pantalla la
   * pide. Si no se confirma no viaja nada y el modal sigue abierto, con lo
   * escrito intacto.
   */
  protected async agregarCredencial(): Promise<void> {
    const tipo = this.nuevoTipoCredencial();
    const numero = this.nuevoNumeroCredencial().trim();
    if (tipo === null || numero === '' || this.guardandoCredencial()) {
      return;
    }

    const confirmado = await this.dialogs.confirmarCambios({
      title: '¿Confirmás estos datos?',
      message: 'El título se agrega a tus credenciales y queda pendiente de verificación.',
    });
    if (!confirmado) {
      return;
    }

    this.guardandoCredencial.set(true);
    const archivo = this.archivoDeCredencial()[0];
    if (archivo === undefined) {
      this.crearCredencial(tipo, numero, undefined);
      return;
    }

    // `DOCUMENT`/`PHI`: es documentación de una persona identificable, el mismo
    // par con el que sube su evidencia la verificación de identidad.
    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.crearCredencial(tipo, numero, id),
      error: () => {
        this.guardandoCredencial.set(false);
        this.toasts.error(
          'No pudimos subir el diploma, así que no se agregó el título. Probá de nuevo.',
          'Formación',
        );
      },
    });
  }

  /** El alta del título en sí, con el diploma ya subido si lo había. */
  private crearCredencial(tipo: string, numero: string, fileId: string | undefined): void {
    const fecha = this.nuevaFechaEmisionCredencial();
    this.profiles
      .addOwnCredential({
        credentialTypeConceptId: tipo,
        number: numero,
        issuingInstitutionText: this.institucionDeclarada() || undefined,
        issueDate: fecha === null ? undefined : fechaIso(fecha),
        ...(fileId === undefined ? {} : { fileId }),
      })
      .subscribe({
        next: () => {
          this.guardandoCredencial.set(false);
          // Cerrar saltando la guarda: lo que se acaba de guardar no se descarta.
          // Sin modal a la vista (las pruebas sin plantilla) se desmonta igual.
          this.dialogoAltaDeTitulo()?.close(true);
          this.cerrarAltaDeTitulo();
          this.toasts.success('Se agregó el título. Queda pendiente de verificación.', 'Formación');
          this.cargar();
        },
        error: () => {
          this.guardandoCredencial.set(false);
          this.toasts.error('No se pudo agregar el título. Probá de nuevo.', 'Formación');
        },
      });
  }

  protected abrirAltaDeTitulo(): void {
    this.altaDeTituloAbierta.set(true);
  }

  /** «Cancelar» cierra por el mismo camino que `Escape`: la guarda decide. */
  protected pedirCierreDeAltaDeTitulo(): void {
    this.dialogoAltaDeTitulo()?.close();
  }

  /** El modal ya se cerró: se desmonta y el próximo alta empieza en blanco. */
  protected cerrarAltaDeTitulo(): void {
    this.altaDeTituloAbierta.set(false);
    this.nuevoTipoCredencial.set(null);
    this.nuevoNumeroCredencial.set('');
    this.institucionElegida.set(null);
    this.institucionEscrita.set('');
    this.nuevaFechaEmisionCredencial.set(null);
    this.archivoDeCredencial.set([]);
  }

  protected abrirAltaDeEspecialidad(): void {
    // Con cuatro vigentes no hay cupo: el botón se apaga y esto lo sostiene.
    if (!this.canDeclareSpecialty()) return;
    this.altaDeEspecialidadAbierta.set(true);
  }

  /** «Cancelar» cierra por el mismo camino que `Escape`: la guarda decide. */
  protected pedirCierreDeAltaDeEspecialidad(): void {
    this.dialogoAltaDeEspecialidad()?.close();
  }

  /** El modal ya se cerró: se desmonta y el próximo alta empieza en blanco. */
  protected cerrarAltaDeEspecialidad(): void {
    this.altaDeEspecialidadAbierta.set(false);
    this.nuevaEspecialidad.set(null);
    this.especialidadesExtra.set([]);
    this.tituloDeRespaldo.set(null);
  }

  /** Lo que la barra de la tabla de especialidades dejó escrito. */
  protected onFiltrosEspecialidades(activos: Readonly<Record<string, string>>): void {
    const busqueda = activos[CLAVE_BUSQUEDA_ESPECIALIDAD] ?? '';
    const estado = activos[CLAVE_ESTADO_ESPECIALIDAD] ?? null;
    if (busqueda !== this.busquedaEspecialidades() || estado !== this.estadoEspecialidadElegido()) {
      this.paginaEspecialidades.set(1);
    }
    this.busquedaEspecialidades.set(busqueda);
    this.estadoEspecialidadElegido.set(estado);
  }

  protected abrirAltaDeMatricula(): void {
    this.altaDeMatriculaAbierta.set(true);
  }

  /** «Cancelar» cierra por el mismo camino que `Escape`: la guarda decide. */
  protected pedirCierreDeAltaDeMatricula(): void {
    this.dialogoAltaDeMatricula()?.close();
  }

  /** El modal ya se cerró: se desmonta y el próximo alta empieza en blanco. */
  protected cerrarAltaDeMatricula(): void {
    this.altaDeMatriculaAbierta.set(false);
    this.nuevoNumeroDeMatricula.set('');
    this.nuevaAutoridad.set('');
    this.nuevaFechaInscripcion.set(null);
    this.archivoDeMatricula.set([]);
  }

  /** Lo que la barra de la tabla de matrículas dejó escrito. */
  protected onFiltrosMatriculas(activos: Readonly<Record<string, string>>): void {
    const busqueda = activos[CLAVE_BUSQUEDA_MATRICULA] ?? '';
    const estado = activos[CLAVE_ESTADO_MATRICULA] ?? null;
    if (busqueda !== this.busquedaMatriculas() || estado !== this.estadoMatriculaElegido()) {
      this.paginaMatriculas.set(1);
    }
    this.busquedaMatriculas.set(busqueda);
    this.estadoMatriculaElegido.set(estado);
  }

  /** Lo que la barra de la tabla de títulos dejó elegido. */
  protected onFiltrosFormacion(activos: Readonly<Record<string, string>>): void {
    const busqueda = activos[CLAVE_BUSQUEDA_TITULO] ?? '';
    const estado = activos[CLAVE_ESTADO_TITULO] ?? null;
    if (busqueda !== this.busquedaFormacion() || estado !== this.estadoFormacionElegido()) {
      this.paginaFormacion.set(1);
    }
    this.busquedaFormacion.set(busqueda);
    this.estadoFormacionElegido.set(estado);
  }

  /**
   * Al cambiar de pestaña, la búsqueda de la tabla que se deja no sigue a la
   * que se abre. La barra guarda lo buscado en la URL, que es una sola para
   * todo el editor: sin esto, «umsa» escrito en Trayectoria seguiría filtrando
   * —y apareciendo en el buscador— al pasar a otra pestaña.
   */
  protected olvidarBusquedaDeLasTablas(): void {
    this.busquedaFormacion.set('');
    this.estadoFormacionElegido.set(null);
    this.busquedaEspecialidades.set('');
    this.estadoEspecialidadElegido.set(null);
    this.busquedaMatriculas.set('');
    this.estadoMatriculaElegido.set(null);
    this.paginaFormacion.set(1);
    this.paginaEspecialidades.set(1);
    this.paginaMatriculas.set(1);
    const url = this.router.parseUrl(this.router.url);
    const presentes = CLAVES_DE_LAS_BARRAS.filter((clave) => clave in url.queryParams);
    if (presentes.length === 0) {
      return;
    }
    for (const clave of presentes) {
      delete url.queryParams[clave];
    }
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }

  /* ======================================================================
      Las acciones de las tres tablas (propietario, 13/09/2026)

      Eliminar, editar y descargar, como botones sobre la fila. Lo que había
      era una tabla de sólo lectura: para corregir el número de un título mal
      tecleado no quedaba otra que cargarlo de nuevo y convivir con los dos.

      **De las cinco operaciones, sólo el retiro del título existe en la API.**
      Las otras cuatro las atiende el simulador de la rama `mockup`, que es el
      backend de esta rama (`mockBackend: true` fijo). El hueco del servidor
      está anotado en `docs/progress/BLOCKERS.md`: acá no se esconde, y el
      cliente ya pide la ruta REST que le corresponde a cada recurso, así que
      publicarlas del otro lado no obliga a tocar esta pantalla.
     ====================================================================== */

  /** Qué fila está bajando su archivo, para apagar sólo ese botón. */
  protected readonly descargando = signal<string | null>(null);

  /** Qué fila se está retirando. */
  protected readonly retirando = signal<string | null>(null);

  /* -- Las acciones de cada fila, con `app-row-actions` (H4.S3.M7) -------
     ADR-0012 §2: hasta dos acciones van en la fila, con su texto; con tres
     o más, la fila muestra un solo disparador y las acciones viven en un
     desplegable. Lo decide `app-row-actions` por cuántas son, no esta
     pantalla. Un título pendiente con diploma tiene tres (editar, descargar
     y retirar); una especialidad pendiente, dos. Lo ya revisado de las tres
     tablas no se edita ni se retira: se ve y, si tiene archivo, se descarga
     (títulos desde el corte; especialidades y matrículas desde el 24/09/2026).
     La descarga y el retiro en curso apagan su acción y lo dicen en el
     texto, como lo hacía el botón. */

  /** Lo que se le puede hacer a un título. Lo verificado ya no se edita ni se retira. */
  protected accionesDeFormacion(fila: FilaFormacion): readonly RowAction[] {
    const acciones: RowAction[] = [];
    if (fila.pendiente) {
      acciones.push({ code: 'editar', label: 'Editar', icon: 'edit' });
    }
    if (fila.fileId !== undefined) {
      acciones.push(this.accionDeDescarga(fila.id));
    }
    if (fila.pendiente) {
      acciones.push(this.accionDeRetiro(fila.id));
    }
    return acciones;
  }

  /** Lo que se le puede hacer a una especialidad. Verificada, ya no se edita ni se retira. */
  protected accionesDeEspecialidad(fila: FilaEspecialidad): readonly RowAction[] {
    if (!fila.pendiente) return [];
    return [{ code: 'editar', label: 'Editar', icon: 'edit' }, this.accionDeRetiro(fila.id)];
  }

  /** Lo que se le puede hacer a una matrícula. Fuera de «pendiente», sólo bajar el carnet. */
  protected accionesDeMatricula(fila: FilaMatricula): readonly RowAction[] {
    const acciones: RowAction[] = [];
    if (fila.pendiente) {
      acciones.push({ code: 'editar', label: 'Editar', icon: 'edit' });
    }
    if (fila.fileId !== undefined) {
      acciones.push(this.accionDeDescarga(fila.id));
    }
    if (fila.pendiente) {
      acciones.push(this.accionDeRetiro(fila.id));
    }
    return acciones;
  }

  /** Despacha la acción que eligió la fila de un título. */
  protected ejecutarAccionDeFormacion(code: string, fila: FilaFormacion): void {
    if (code === 'editar') {
      this.editarFormacion(fila);
    } else if (code === 'descargar') {
      this.descargarDiploma(fila);
    } else if (code === 'retirar') {
      this.retirarFormacion(fila);
    }
  }

  protected ejecutarAccionDeEspecialidad(code: string, fila: FilaEspecialidad): void {
    if (code === 'editar') {
      this.editarEspecialidad(fila);
    } else if (code === 'retirar') {
      this.retirarEspecialidad(fila);
    }
  }

  protected ejecutarAccionDeMatricula(code: string, fila: FilaMatricula): void {
    if (code === 'editar') {
      this.editarMatricula(fila);
    } else if (code === 'descargar') {
      this.descargarCarnet(fila);
    } else if (code === 'retirar') {
      this.retirarMatricula(fila);
    }
  }

  /** Una descarga a la vez: mientras baja un archivo, las demás se apagan. */
  private accionDeDescarga(id: string): RowAction {
    return {
      code: 'descargar',
      label: this.descargando() === id ? 'Descargando…' : 'Descargar',
      icon: 'download',
      disabled: this.descargando() !== null,
    };
  }

  /** Retirar no se deshace: tinta de error, y un retiro a la vez. */
  private accionDeRetiro(id: string): RowAction {
    return {
      code: 'retirar',
      label: this.retirando() === id ? 'Retirando…' : 'Retirar',
      icon: 'remove',
      destructive: true,
      disabled: this.retirando() !== null,
    };
  }

  /** Lo que el diálogo está corrigiendo, o `null` si está cerrado. */
  protected readonly edicion = signal<EdicionEnCurso | null>(null);
  protected readonly guardandoEdicion = signal(false);

  /* Los campos del diálogo. Uno por dato y no un formulario reactivo, por lo
     mismo que el resto de la pantalla: los valores viven en señales para que
     cambiar de pestaña no pierda lo tecleado. */

  protected readonly edicionTipo = signal<string | null>(null);
  protected readonly edicionNumero = signal('');
  protected readonly edicionInstitucionElegida = signal<string | null>(null);
  protected readonly edicionInstitucionEscrita = signal('');
  protected readonly edicionEmision = signal<Date | null>(null);
  protected readonly edicionEspecialidad = signal<string | null>(null);
  protected readonly edicionAutoridad = signal('');
  protected readonly edicionInscripcion = signal<Date | null>(null);

  protected readonly edicionInstitucionFueraDeCatalogo = computed(
    () => this.edicionInstitucionElegida() === INSTITUCION_FUERA_DE_CATALOGO,
  );

  /** La institución que viaja en el `PATCH`. Mismo criterio que en el alta. */
  private readonly edicionInstitucionDeclarada = computed(() => {
    const elegida = this.edicionInstitucionElegida();
    if (elegida === null) {
      return '';
    }
    return elegida === INSTITUCION_FUERA_DE_CATALOGO
      ? this.edicionInstitucionEscrita().trim()
      : elegida;
  });

  /**
   * El diploma o el respaldo que reemplaza al que está cargado (D-08). Uno,
   * opcional: sin elegir nada, el archivo que había queda como estaba.
   */
  protected readonly archivoDeEdicion = signal<readonly File[]>([]);

  /**
   * Todo lo que el diálogo puede cambiar, en una cadena comparable. Se toma al
   * abrir (`edicionOriginal`) y se compara con la de ahora: así «Guardar» sabe
   * si hay algo que guardar sin un `effect` que lo vigile. Los textos van sin
   * espacios de los costados, porque así viajan: un espacio de más no es un cambio.
   */
  private readonly huellaDeEdicion = computed(() => {
    const emision = this.edicionEmision();
    const inscripcion = this.edicionInscripcion();
    return JSON.stringify([
      this.edicionTipo(),
      this.edicionNumero().trim(),
      this.edicionInstitucionDeclarada(),
      emision === null ? null : fechaIso(emision),
      this.edicionEspecialidad(),
      this.edicionAutoridad().trim(),
      inscripcion === null ? null : fechaIso(inscripcion),
    ]);
  });

  /** La huella de lo que la fila tenía al abrir el diálogo. */
  private readonly edicionOriginal = signal('');

  /** Si algo difiere de lo que había, o se eligió un archivo nuevo. */
  protected readonly hayCambiosEnEdicion = computed(
    () => this.huellaDeEdicion() !== this.edicionOriginal() || this.archivoDeEdicion().length > 0,
  );

  private readonly dialogoEdicion = viewChild<ContentDialog>('dialogoEdicion');

  /**
   * Lo que el diálogo consulta antes de cerrarse por «Cancelar», la cruz,
   * `Escape` o el fondo (D-08). Mientras guarda no se cierra; sin cambios cierra
   * directo; con cambios pregunta si se descartan.
   */
  protected readonly guardaDeEdicion = (): boolean | Promise<boolean> => {
    if (this.guardandoEdicion()) {
      return false;
    }
    return !this.hayCambiosEnEdicion() || this.dialogs.confirmarDescarte();
  };

  /**
   * Si lo que hay en el diálogo se puede guardar.
   *
   * Se exige lo mismo que el alta de cada recurso: un `PATCH` que vaciara el
   * número de un título dejaría una fila que la de alta nunca habría dejado
   * crear. Y, desde el 23/09/2026 (D-08, Q-I1), que algo haya cambiado: guardar
   * lo mismo que ya estaba es un trámite sin efecto.
   */
  protected readonly puedeGuardarEdicion = computed(() => {
    const enCurso = this.edicion();
    if (enCurso === null || this.guardandoEdicion() || !this.hayCambiosEnEdicion()) {
      return false;
    }
    switch (enCurso.recurso) {
      case 'formacion':
        return this.edicionTipo() !== null && this.edicionNumero().trim() !== '';
      case 'especialidad':
        return this.edicionEspecialidad() !== null;
      case 'matricula':
        return this.edicionNumero().trim() !== '';
    }
  });

  /* ---- Descargar ---------------------------------------------------------- */

  /**
   * Baja el diploma de un título o el carnet de una matrícula.
   *
   * Por `contentDataUrl` y no por `downloadUrl`: la CSP del servidor deja
   * `connect-src` en `'self'`, y la URL firmada apunta a `file://local/<sha>`,
   * que el navegador no abre. Es el mismo camino que usa la descarga de
   * evidencia de los casos de verificación.
   */
  private descargarArchivo(fileId: string, filaId: string, nombre: string, bloque: string): void {
    if (this.descargando() !== null) {
      return;
    }
    this.descargando.set(filaId);
    this.files.contentDataUrl(fileId).subscribe({
      next: (dataUrl) => {
        this.descargas.trigger(dataUrl, nombre);
        this.descargando.set(null);
      },
      error: () => {
        this.descargando.set(null);
        this.toasts.error('No pudimos traer el archivo. Probá de nuevo en un momento.', bloque);
      },
    });
  }

  protected descargarDiploma(fila: FilaFormacion): void {
    if (fila.fileId === undefined) {
      return;
    }
    this.descargarArchivo(fila.fileId, fila.id, `diploma-${fila.numero}`, 'Formación');
  }

  protected descargarCarnet(fila: FilaMatricula): void {
    if (fila.fileId === undefined) {
      return;
    }
    this.descargarArchivo(fila.fileId, fila.id, `matricula-${fila.numero}`, 'Matrículas');
  }

  /* ---- Eliminar ----------------------------------------------------------- */

  /**
   * Retira una fila, con confirmación.
   *
   * Con confirmación siempre, y no sólo en la de formación: las tres borran un
   * dato que la persona cargó y que no se recupera desde la pantalla. El
   * diálogo dice **qué** se retira, no «¿estás seguro?»: lo que hace falta
   * comprobar es que la fila señalada es la que se quiso señalar.
   */
  private async retirarFila(
    filaId: string,
    nombre: string,
    bloque: string,
    titulo: string,
    retiro: Observable<void>,
  ): Promise<void> {
    if (this.retirando() !== null) {
      return;
    }
    const confirmado = await this.dialogs.confirm({
      title: titulo,
      message: `¿Retirar «${nombre}»? No se puede deshacer desde acá.`,
      confirmLabel: 'Retirar',
      cancelLabel: 'Cancelar',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.retirando.set(filaId);
    retiro.subscribe({
      next: () => {
        this.retirando.set(null);
        this.toasts.success(`Se retiró «${nombre}».`, bloque);
        this.cargar();
      },
      error: () => {
        this.retirando.set(null);
        this.toasts.error('No se pudo retirar. Probá de nuevo.', bloque);
      },
    });
  }

  protected retirarFormacion(fila: FilaFormacion): void {
    void this.retirarFila(
      fila.id,
      `${fila.tipo} · ${fila.numero}`,
      'Formación',
      'Retirar este título',
      this.profiles.removeOwnCredential(fila.id),
    );
  }

  protected retirarEspecialidad(fila: FilaEspecialidad): void {
    void this.retirarFila(
      fila.id,
      fila.especialidad,
      'Especialidades',
      'Retirar esta especialidad',
      this.profiles.removeOwnSpecialty(fila.id),
    );
  }

  protected retirarMatricula(fila: FilaMatricula): void {
    void this.retirarFila(
      fila.id,
      fila.numero,
      'Matrículas',
      'Retirar esta matrícula',
      this.profiles.removeOwnLicense(fila.id),
    );
  }

  /* ---- Editar ------------------------------------------------------------- */

  /**
   * Abre el diálogo con lo que la fila tiene hoy.
   *
   * Los valores salen del **perfil crudo** y no de la fila de la tabla: la
   * fila lleva las etiquetas ya resueltas y las fechas ya formateadas, y
   * devolvérselas a los controles mandaría al servidor «Título de médico» donde
   * espera un uuid de concepto.
   */
  protected editarFormacion(fila: FilaFormacion): void {
    const credencial = this.datos()?.credentials.find((c) => c.id === fila.id);
    if (credencial === undefined) {
      return;
    }
    this.edicionTipo.set(credencial.credentialTypeConceptId);
    this.edicionNumero.set(credencial.number);
    const institucion = credencial.issuingInstitutionText ?? '';
    const delCatalogo = institucion !== '' && esInstitucionDelCatalogo(institucion);
    this.edicionInstitucionElegida.set(
      institucion === '' ? null : delCatalogo ? institucion : INSTITUCION_FUERA_DE_CATALOGO,
    );
    this.edicionInstitucionEscrita.set(delCatalogo ? '' : institucion);
    this.edicionEmision.set(credencial.issueDate ?? null);
    this.abrirEdicion({
      recurso: 'formacion',
      id: fila.id,
      nombre: fila.tipo,
      archivoActual: credencial.fileId !== undefined,
    });
  }

  protected editarEspecialidad(fila: FilaEspecialidad): void {
    const especialidad = this.datos()?.specialties.find((e) => e.id === fila.id);
    if (especialidad === undefined) {
      return;
    }
    this.edicionEspecialidad.set(especialidad.specialtyConceptId);
    this.abrirEdicion({
      recurso: 'especialidad',
      id: fila.id,
      nombre: fila.especialidad,
      archivoActual: false,
    });
  }

  protected editarMatricula(fila: FilaMatricula): void {
    const matricula = this.datos()?.licenses.find((m) => m.id === fila.id);
    if (matricula === undefined) {
      return;
    }
    this.edicionNumero.set(matricula.licenseNumber);
    this.edicionAutoridad.set(matricula.regulatoryAuthority ?? '');
    this.edicionInscripcion.set(matricula.validFrom ?? null);
    this.abrirEdicion({
      recurso: 'matricula',
      id: fila.id,
      nombre: fila.numero,
      archivoActual: matricula.fileId !== undefined,
    });
  }

  /**
   * Abre el diálogo con los campos ya sembrados, y guarda la huella de lo que
   * había: es contra ella que «Guardar» decide si hay cambios.
   */
  private abrirEdicion(enCurso: EdicionEnCurso): void {
    this.archivoDeEdicion.set([]);
    this.edicionOriginal.set(this.huellaDeEdicion());
    this.edicion.set(enCurso);
  }

  /** «Cancelar» cierra por el mismo camino que `Escape`: la guarda decide. */
  protected pedirCierreDeEdicion(): void {
    this.dialogoEdicion()?.close();
  }

  /** El diálogo ya se cerró: se desmonta y el archivo elegido se suelta. */
  protected cerrarEdicion(): void {
    this.edicion.set(null);
    this.archivoDeEdicion.set([]);
  }

  /**
   * Manda la corrección del recurso que esté abierto.
   *
   * Los tres `PATCH` son **parciales**: lo que no cambió viaja igual, pero un
   * campo vaciado a propósito —una institución que se borra— tiene que llegar
   * como cadena vacía y no desaparecer del cuerpo, porque `stripUndefined` sólo
   * quita los `undefined`.
   *
   * Antes de enviar se pregunta «¿Confirmás estos cambios?» (D-08); si no se
   * confirma, el diálogo sigue abierto con lo escrito. Con un archivo nuevo, se
   * sube primero y su identificador viaja como `fileId`, igual que en el alta:
   * si la subida falla no se corrige nada, porque una corrección sin el
   * documento que la persona creyó reemplazar es peor que un error.
   */
  protected async guardarEdicion(): Promise<void> {
    const enCurso = this.edicion();
    if (enCurso === null || !this.puedeGuardarEdicion()) {
      return;
    }
    if (!(await this.dialogs.confirmarCambios())) {
      return;
    }
    this.guardandoEdicion.set(true);

    const archivo = this.archivoDeEdicion()[0];
    if (archivo === undefined) {
      this.enviarEdicion(enCurso, undefined);
      return;
    }
    this.files.upload(archivo, 'DOCUMENT', 'PHI').subscribe({
      next: ({ id }) => this.enviarEdicion(enCurso, id),
      error: () => {
        this.guardandoEdicion.set(false);
        this.toasts.error(
          'No pudimos subir el archivo, así que no se guardaron los cambios. Probá de nuevo.',
          BLOQUE_DE_RECURSO[enCurso.recurso],
        );
      },
    });
  }

  /** La corrección en sí, con el archivo nuevo ya subido si lo había. */
  private enviarEdicion(enCurso: EdicionEnCurso, fileId: string | undefined): void {
    const bloque = BLOQUE_DE_RECURSO[enCurso.recurso];
    this.peticionDeEdicion(enCurso, fileId).subscribe({
      next: () => {
        this.guardandoEdicion.set(false);
        // Cerrar saltando la guarda: lo que se acaba de guardar no se descarta.
        this.dialogoEdicion()?.close(true);
        this.cerrarEdicion();
        this.toasts.success('Se guardaron los cambios.', bloque);
        this.cargar();
      },
      error: () => {
        this.guardandoEdicion.set(false);
        this.toasts.error('No se pudieron guardar los cambios. Probá de nuevo.', bloque);
      },
    });
  }

  /**
   * Qué se manda según el recurso abierto. El `fileId` sólo existe para el
   * título y la matrícula: la especialidad no tiene archivo en el contrato
   * (HALL-E7).
   */
  private peticionDeEdicion(enCurso: EdicionEnCurso, fileId: string | undefined): Observable<void> {
    const archivo = fileId === undefined ? {} : { fileId };
    switch (enCurso.recurso) {
      case 'formacion': {
        const emision = this.edicionEmision();
        return this.profiles.updateOwnCredential(enCurso.id, {
          credentialTypeConceptId: this.edicionTipo() ?? undefined,
          number: this.edicionNumero().trim(),
          issuingInstitutionText: this.edicionInstitucionDeclarada(),
          issueDate: emision === null ? undefined : fechaIso(emision),
          ...archivo,
        });
      }
      case 'especialidad':
        return this.profiles.updateOwnSpecialty(enCurso.id, {
          specialtyConceptId: this.edicionEspecialidad() ?? undefined,
        });
      case 'matricula': {
        const inscripcion = this.edicionInscripcion();
        return this.profiles.updateOwnLicense(enCurso.id, {
          licenseNumber: this.edicionNumero().trim(),
          regulatoryAuthority: this.edicionAutoridad().trim(),
          validFrom: inscripcion === null ? undefined : fechaIso(inscripcion),
          ...archivo,
        });
      }
    }
  }
}
