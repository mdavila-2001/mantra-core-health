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
import { RouterLink } from '@angular/router';
import { FormControl, ReactiveFormsModule, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
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
import { Badge } from '../../../../shared/components/atoms/badge/badge';
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
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import {
  separarNombres,
  unirNombres,
} from '../../../../core/profesion/nombres-adicionales';
import { opcionesAutoridadReguladora } from '../../../../core/profesion/autoridades-reguladoras';
import {
  OPCIONES_TITULO_PROFESIONAL,
  esTituloDeLaLista,
} from '../../../../core/profesion/titulos-profesionales';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { WorkHistory } from '../work-history/work-history';
import { PESTANA_EDITOR, PESTANAS_DEL_EDITOR_MEDICO } from '../pestanas-del-perfil-medico';

/** El tipo de título (formación), del catálogo dinámico: los cinco `CREDENTIAL_TYPE_*`. */
const TARGET_CREDENCIAL = 'profiles.professional_credentials.credential_type_concept_id';

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Una fila de «Tu trayectoria cargada». */
interface FilaFormacion {
  readonly id: string;
  readonly tipo: string;
  readonly numero: string;
  readonly institucion: string;
  readonly emision: string;
  readonly estado: string;
}

/** Una fila de «Tus especialidades cargadas». */
interface FilaEspecialidad {
  readonly id: string;
  readonly especialidad: string;
  readonly rol: string;
  readonly desde: string;
  readonly estado: string;
  /** Con la que se presenta. Hay una sola. */
  readonly esPrincipal: boolean;
  /** Si todavía la ejerce. Una que dejó de ejercerse no puede ser la principal. */
  readonly vigente: boolean;
}

/** Una fila de «Tus matrículas cargadas». */
interface FilaMatricula {
  readonly id: string;
  readonly numero: string;
  readonly autoridad: string;
  readonly inscripcion: string;
  readonly estado: string;
}

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
    Badge,
    Card,
    ConceptSelect,
    DataTable,
    DatePicker,
    FormActions,
    FileInput,
    FormField,
    Input,
    LocationPicker,
    NavIcon,
    PageHeader,
    PhoneInput,
    ReactiveFormsModule,
    RouterLink,
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
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly catalogo = inject(MedicalSpecialtiesCatalog);
  private readonly terminologia = inject(TerminologyClient);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * La pestaña abierta. Es un `model` y no una señal propia por la misma razón
   * que en el editor del paciente: el lápiz de la ficha abre el formulario en la
   * pestaña que se estaba mirando, y para eso el índice tiene que poder venir de
   * afuera.
   */
  readonly pestana = model<number>(PESTANA_EDITOR.personales);
  protected readonly pestanas = PESTANAS_DEL_EDITOR_MEDICO;
  protected readonly pestanaEditor = PESTANA_EDITOR;

  /**
   * Si la pestaña abierta es de las que se corrigen.
   *
   * «Datos personales» y «Contacto» son un solo formulario repartido en dos
   * paneles y comparten el botón de guardar. «Trayectoria» y «Credenciales» no
   * corrigen nada: agregan, y cada bloque tiene su propio «Agregar». Mostrar ahí
   * «Guardar cambios» prometería guardar algo que ese botón no guarda.
   */
  protected readonly editandoPresentacion = computed(
    () =>
      this.pestana() === PESTANA_EDITOR.personales || this.pestana() === PESTANA_EDITOR.contacto,
  );

  private readonly municipios = inject(BoMunicipalitiesCatalog);

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
  /* Los cuatro contactos que el alta pide por separado. El de trabajo y el
     privado dejaron de ser el mismo dato, así que el perfil también los
     distingue: cada uno se guarda en su propia fila de puntos de contacto. */
  /* Los tres teléfonos son el campo del alta (`app-phone-input`): bandera y
     prefijo del país, y el número nacional. Es un `ControlValueAccessor`, por
     eso van en `FormControl` y no en señales; los controles viven en el
     componente, así que cambiar de pestaña no los pierde. */
  protected readonly celularPersonal = new FormControl('', {
    nonNullable: true,
    validators: [telefonoOpcional],
  });
  protected readonly celularTrabajo = new FormControl('', {
    nonNullable: true,
    validators: [telefonoOpcional],
  });
  protected readonly fijoTrabajo = new FormControl('', {
    nonNullable: true,
    validators: [telefonoOpcional],
  });
  /** El mismo texto que el alta pone bajo un teléfono incompleto. */
  protected readonly mensajeTelefonoIncompleto = 'El número está incompleto para el país elegido.';
  protected readonly correoPersonal = signal('');
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

  protected readonly idsGpsDomicilio: IdsDePrueba = {
    mapa: 'edicion-domicilio-mapa',
    confirmada: 'edicion-domicilio-confirmada',
    avisoGeocodificacion: 'edicion-domicilio-aviso-geo',
    quitar: 'edicion-domicilio-quitar-gps',
    sinConfirmar: 'edicion-domicilio-sin-confirmar',
    confirmar: 'edicion-domicilio-confirmar',
    usarUbicacion: 'edicion-domicilio-usar-ubicacion',
    marcarEnMapa: 'edicion-domicilio-marcar',
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
    this.especialidadesExtra.update((actuales) => [...actuales, '']);
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
   * que el editor se adapte al formulario del alta de médico, y ahí la
   * especialidad principal se elige en un select al registrarse y la
   * certificación de junta no se pregunta.
   *
   * Se siguen mandando —el contrato los declara— con el único valor que esta
   * pantalla puede afirmar con honestidad: una especialidad agregada después
   * del alta es **adicional**, no la principal, y nadie declaró una
   * certificación de junta.
   */
  private readonly ESPECIALIDAD_ADICIONAL = { isPrimary: false, boardCertified: false } as const;

  /** El diploma del título que se está agregando. Uno, opcional. */
  protected readonly archivoDeCredencial = signal<readonly File[]>([]);

  /** Los mismos formatos y el mismo tope que el alta de médico. */
  protected readonly formatosDeRespaldo = SUPPORT_FILE_FORMATS;
  protected readonly maxBytesDeRespaldo = MAX_ATTACHMENT_BYTES;
  protected readonly guardandoEspecialidad = signal(false);

  protected readonly puedeAgregarEspecialidad = computed(
    () => this.nuevaEspecialidad() !== null || this.especialidadesExtra().some((e) => e !== ''),
  );

  /* -- Nueva matrícula --------------------------------------------------------- */

  protected readonly nuevoNumeroDeMatricula = signal('');
  protected readonly nuevaAutoridad = signal('');

  /**
   * Las tres autoridades del alta: Ministerio de Salud, SEDES y el colegio de
   * la profesión, con el colegio resuelto por el título elegido arriba.
   */
  protected readonly opcionesAutoridad = computed(() =>
    opcionesAutoridadReguladora(this.titulo()),
  );
  protected readonly nuevaFechaInscripcion = signal<Date | null>(null);
  /** El carnet del colegio. Viaja como `fileId`, igual que el diploma. */
  protected readonly archivoDeMatricula = signal<readonly File[]>([]);
  protected readonly guardandoMatricula = signal(false);

  protected readonly puedeAgregarMatricula = computed(
    () => this.nuevoNumeroDeMatricula().trim() !== '',
  );

  /* -- Nueva formación ----------------------------------------------------
     Mismo criterio que especialidad y matrícula: se agrega, no se edita —
     declarar un título no es haberlo acreditado, y quien lo verifica es
     `SECURITY_ADMIN` sobre uno existente. El tipo sale del catálogo dinámico
     (los cinco `CREDENTIAL_TYPE_*`), igual que la jurisdicción de la
     matrícula de acá arriba. */

  protected readonly targetCredencial = TARGET_CREDENCIAL;
  protected readonly nuevoTipoCredencial = signal<string | null>(null);
  protected readonly nuevoNumeroCredencial = signal('');
  protected readonly nuevaInstitucionCredencial = signal('');
  protected readonly nuevaFechaEmisionCredencial = signal<Date | null>(null);
  protected readonly guardandoCredencial = signal(false);

  protected readonly puedeAgregarCredencial = computed(
    () => this.nuevoTipoCredencial() !== null && this.nuevoNumeroCredencial().trim() !== '',
  );

  /* -- Lo ya cargado, en tablas --------------------------------------------
     Pedido del propietario (13/09/2026): debajo de cada «Agregar», la tabla con
     lo que ya está cargado. Se leen del mismo perfil que siembra el formulario,
     así que la recarga que sigue a cada «Agregar» ya las pone al día. */

  /** Las etiquetas de los conceptos de las tres tablas. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly claveDeFila = (fila: { readonly id: string }): string => fila.id;

  protected readonly columnasFormacion: readonly ColumnDef<FilaFormacion>[] = [
    { key: 'tipo', header: 'Tipo', priority: 1 },
    { key: 'numero', header: 'Número / título', priority: 1 },
    { key: 'institucion', header: 'Institución', priority: 2 },
    { key: 'emision', header: 'Emisión', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1 },
  ];

  private readonly celdaRol =
    viewChild.required<TemplateRef<{ $implicit: FilaEspecialidad }>>('celdaRol');

  /**
   * La columna «Tipo» sube a prioridad 1 (13/09/2026).
   *
   * Deja de ser un rótulo y pasa a ser el lugar donde se **cambia** cuál es la
   * principal, y una acción que se pliega al detalle en el teléfono es una
   * acción que la mitad de la gente no encuentra. Las tres que quedan en el
   * teléfono son las mismas que ya muestra la tabla de matrículas.
   */
  protected readonly columnasEspecialidades = computed<readonly ColumnDef<FilaEspecialidad>[]>(
    () => [
      { key: 'especialidad', header: 'Especialidad', priority: 1 },
      { key: 'rol', header: 'Tipo', priority: 1, cell: this.celdaRol() },
      { key: 'desde', header: 'Desde', priority: 2 },
      { key: 'estado', header: 'Estado', priority: 1 },
    ],
  );

  /** Cuál especialidad se está marcando como principal, mientras viaja. */
  protected readonly marcandoPrincipal = signal<string | null>(null);

  protected readonly columnasMatriculas: readonly ColumnDef<FilaMatricula>[] = [
    { key: 'numero', header: 'Nº de matrícula', priority: 1 },
    { key: 'autoridad', header: 'Autoridad', priority: 1 },
    { key: 'inscripcion', header: 'Inscripción', priority: 2 },
    { key: 'estado', header: 'Estado', priority: 1 },
  ];

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
        institucion: credencial.issuingInstitutionText ?? '—',
        emision: fechaLegible(credencial.issueDate),
        estado:
          credencial.verifiedAt !== undefined
            ? 'Verificado'
            : this.etiqueta(credencial.stateConceptId, PENDIENTE_DE_VERIFICACION),
      }));
  });

  /** Las especialidades, la principal primero. */
  protected readonly filasEspecialidades = computed<readonly FilaEspecialidad[]>(() => {
    const perfil = this.datos();
    if (perfil === null) return [];
    const delCatalogo = new Map(this.especialidades().map((o) => [o.value, o.label]));
    return [...perfil.specialties]
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((especialidad) => ({
        id: especialidad.id,
        especialidad: this.etiqueta(
          especialidad.specialtyConceptId,
          delCatalogo.get(especialidad.specialtyConceptId) ?? 'Especialidad',
        ),
        rol: especialidad.isPrimary ? 'Principal' : 'Adicional',
        desde: fechaLegible(especialidad.validFrom),
        estado: especialidad.verified
          ? 'Verificada'
          : this.etiqueta(especialidad.verificationStatusConceptId, PENDIENTE_DE_VERIFICACION),
        esPrincipal: especialidad.isPrimary,
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
    }));
  });

  protected readonly estadoFormacion = computed(() => ready(this.filasFormacion()));
  protected readonly estadoEspecialidades = computed(() => ready(this.filasEspecialidades()));
  protected readonly estadoMatriculas = computed(() => ready(this.filasMatriculas()));

  /** La etiqueta de un concepto, o lo que se diga mientras no llegue. */
  private etiqueta(conceptId: string | undefined, porDefecto: string): string {
    if (conceptId === undefined) return porDefecto;
    return this.etiquetas().get(conceptId)?.display ?? porDefecto;
  }

  /**
   * Pide las etiquetas de lo que muestran las tablas. Un fallo no rompe nada:
   * las tablas siguen, con «Pendiente de verificación» en vez del estado.
   */
  private cargarEtiquetas(perfil: OwnPractitionerProfile): void {
    const ids = [
      ...perfil.specialties.flatMap((e) => [e.specialtyConceptId, e.verificationStatusConceptId]),
      ...perfil.credentials.flatMap((c) => [c.credentialTypeConceptId, c.stateConceptId]),
      ...perfil.licenses.map((m) => m.stateConceptId),
    ].filter((id): id is string => id !== undefined);
    this.terminologia
      .readConceptLabels(ids)
      .pipe(catchError(() => of<ConceptLabels>(new Map())))
      .subscribe((etiquetas) => this.etiquetas.set(etiquetas));
  }

  constructor() {
    this.cargar();
    this.cargarEspecialidades();
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
    this.celularTrabajo.reset(perfil.workMobilePhone ?? '');
    this.fijoTrabajo.reset(perfil.workLandline ?? '');
    this.correoPersonal.set(perfil.personalEmail ?? '');
    this.telemedicina.set(perfil.telehealthAvailable);
    // ALV-003: los dos campos que el contrato ya aceptaba y el formulario no
    // ofrecía. Se siembran desde el perfil, igual que el resto.
    this.fechaNacimiento.set(perfil.birthDate ?? null);
    this.municipioResidencia.set(perfil.residenceMunicipalityConceptId ?? null);
    // ALV-009: la calle, si la declaró.
    this.direccion.set(perfil.homeAddress?.lines ?? '');
    // Y su punto en el mapa. Las dos mitades tienen que estar: una latitud sin
    // longitud pondría el pin en el meridiano cero.
    const lat = perfil.homeAddress?.latitude;
    const lng = perfil.homeAddress?.longitude;
    this.gpsDomicilioGuardado.set(
      lat === undefined || lng === undefined ? null : { lat, lng },
    );
    this.gpsDomicilio.set(undefined);
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

  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
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

    // Un teléfono a medias no viaja: se marca, se lleva a la persona a
    // «Contacto» —puede estar mirando «Datos personales»— y se dice por qué.
    const telefonos = [this.celularPersonal, this.celularTrabajo, this.fijoTrabajo];
    if (telefonos.some((telefono) => telefono.invalid)) {
      telefonos.forEach((telefono) => telefono.markAsTouched());
      this.pestana.set(PESTANA_EDITOR.contacto);
      this.toasts.error('Hay un teléfono incompleto. Revisalo en «Contacto».', 'Perfil');
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
      workMobilePhone: string;
      workLandline: string;
      personalEmail: string;
      birthDate: string;
      residenceMunicipalityConceptId: string;
      homeAddressLines: string;
      homeLatitude: number | null;
      homeLongitude: number | null;
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
    if (this.celularTrabajo.value !== (original.workMobilePhone ?? '')) {
      cambios.workMobilePhone = this.celularTrabajo.value;
    }
    if (this.fijoTrabajo.value !== (original.workLandline ?? '')) {
      cambios.workLandline = this.fijoTrabajo.value;
    }
    if (this.correoPersonal() !== (original.personalEmail ?? '')) {
      cambios.personalEmail = this.correoPersonal();
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
      error: () => {
        this.guardandoPresentacion.set(false);
        this.toasts.error('No se pudo guardar el cambio. Probá de nuevo.', 'Perfil');
      },
    });
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
   */
  /**
   * Marca una especialidad ya cargada como la principal (UC-05-06·P).
   *
   * Es la vuelta de una función que se perdió sin querer: al adaptar este
   * editor al formulario del alta —pedido del propietario del 2026-09-10— se
   * quitaron los interruptores sueltos de «Agregar una especialidad», y con
   * ellos «Es mi especialidad principal». Desde entonces toda especialidad
   * cargada después del registro entraba como adicional y no había dónde
   * cambiarlo; quedó anotado en `docs/progress/BLOCKERS.md`.
   *
   * Vuelve **como gesto sobre una fila que ya existe**, no como casilla de un
   * formulario de alta: es lo que el propietario pidió sacar y lo que esto no
   * devuelve.
   *
   * @param fila - La especialidad que pasa a ser la principal.
   */
  protected marcarComoPrincipal(fila: FilaEspecialidad): void {
    if (fila.esPrincipal || !fila.vigente || this.marcandoPrincipal() !== null) {
      return;
    }

    this.marcandoPrincipal.set(fila.id);
    this.profiles.setOwnPrimarySpecialty(fila.id).subscribe({
      next: () => {
        this.marcandoPrincipal.set(null);
        this.toasts.success(
          `${fila.especialidad} es ahora tu especialidad principal.`,
          'Especialidades',
        );
        this.cargar();
      },
      error: () => {
        this.marcandoPrincipal.set(null);
        this.toasts.error(
          'No se pudo cambiar la especialidad principal. Probá de nuevo.',
          'Especialidades',
        );
      },
    });
  }

  protected agregarEspecialidad(): void {
    const profileId = this.profileId();
    const elegidas = this.especialidadesElegidas();
    if (profileId === null || elegidas.length === 0 || this.guardandoEspecialidad()) {
      return;
    }

    const varias = elegidas.length > 1;
    this.guardandoEspecialidad.set(true);
    forkJoin(
      elegidas.map((especialidad) =>
        this.profiles.addSpecialty(profileId, {
          specialtyConceptId: especialidad,
          isPrimary: this.ESPECIALIDAD_ADICIONAL.isPrimary,
          boardCertified: this.ESPECIALIDAD_ADICIONAL.boardCertified,
        }),
      ),
    ).subscribe({
      next: () => {
        this.guardandoEspecialidad.set(false);
        this.nuevaEspecialidad.set(null);
        this.especialidadesExtra.set([]);
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
   */
  protected agregarMatricula(): void {
    const profileId = this.profileId();
    const numero = this.nuevoNumeroDeMatricula().trim();
    if (profileId === null || numero === '' || this.guardandoMatricula()) {
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
          this.nuevoNumeroDeMatricula.set('');
          this.nuevaAutoridad.set('');
          this.nuevaFechaInscripcion.set(null);
          this.archivoDeMatricula.set([]);
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
   */
  protected agregarCredencial(): void {
    const tipo = this.nuevoTipoCredencial();
    const numero = this.nuevoNumeroCredencial().trim();
    if (tipo === null || numero === '' || this.guardandoCredencial()) {
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
        issuingInstitutionText: this.nuevaInstitucionCredencial().trim() || undefined,
        issueDate: fecha === null ? undefined : fechaIso(fecha),
        ...(fileId === undefined ? {} : { fileId }),
      })
      .subscribe({
        next: () => {
          this.guardandoCredencial.set(false);
          this.nuevoTipoCredencial.set(null);
          this.nuevoNumeroCredencial.set('');
          this.nuevaInstitucionCredencial.set('');
          this.nuevaFechaEmisionCredencial.set(null);
          this.archivoDeCredencial.set([]);
          this.toasts.success(
            'Se agregó el título. Queda pendiente de verificación.',
            'Formación',
          );
          this.cargar();
        },
        error: () => {
          this.guardandoCredencial.set(false);
          this.toasts.error('No se pudo agregar el título. Probá de nuevo.', 'Formación');
        },
      });
  }
}
