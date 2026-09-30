import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { BIRTH_SEX_OPTIONS } from '../../../../core/data-access/iam/birth-sex.options';
import type { BirthSexCode } from '../../../../core/data-access/iam/iam.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type {
  OwnPatientProfile,
  OwnPatientProfileChanges,
} from '../../../../core/data-access/profiles/profiles.types';
import { BoDepartmentsCatalog } from '../../../../core/data-access/terminology/bo-departments.service';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../../core/data-access/terminology/bo-municipalities.service';
import { BoOccupationsCatalog } from '../../../../core/data-access/terminology/bo-occupations.service';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import {
  AVISO_REESCRIBIR_DIRECCION,
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../../../auth/registro-compartido/ubicacion-picker/ubicacion-picker';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { PESTANA, PESTANAS_DEL_PERFIL } from '../pestanas-del-perfil';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import {
  PhoneInput,
  telefonoCompleto,
} from '../../../../shared/components/molecules/phone-input/phone-input';
import {
  nacionalDelNumero,
  paisDelNumero,
} from '../../../../shared/components/molecules/phone-input/phone-input.paises';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { TreeSelect } from '../../../../shared/components/organisms/tree-select/tree-select';
import type { TreeSelectGroup } from '../../../../shared/components/organisms/tree-select/tree-select.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/** A dónde se vuelve al cancelar o al terminar. */
const MI_PERFIL = '/my-account';

/** El rótulo con el que se agrupan los avisos de esta pantalla. */
const AMBITO = 'Mi perfil';

/** Nadie nació antes de 1900 y sigue usando la plataforma. El mismo tope del alta. */
const NACIMIENTO_MAS_ANTIGUO = new Date(1900, 0, 1);

/**
 * La ayuda del campo de ocupación, **la misma palabra por palabra que el alta**.
 *
 * No es celo de copista: el editor corrige lo que el alta declaró, y dos textos
 * distintos para el mismo dato hacen dudar de si se trata del mismo campo.
 */
const HINT_OCUPACION = 'En qué trabajás. Ayuda a tu médico con los riesgos propios de cada oficio.';

/** Lo que se muestra cuando la ocupación guardada es texto de antes del catálogo. */
function hintDeOcupacionHeredada(texto: string): string {
  return `Registrada como «${texto}». Elegí una opción del catálogo para reemplazarla.`;
}

/** Los cambios mientras se arman: el contrato que sale es de solo lectura. */
type CambiosEnCurso = {
  -readonly [K in keyof OwnPatientProfileChanges]: OwnPatientProfileChanges[K];
};

/** Si dos fechas son el mismo día, mirando los componentes locales. */
function mismoDia(una: Date, otra: Date): boolean {
  return (
    una.getFullYear() === otra.getFullYear() &&
    una.getMonth() === otra.getMonth() &&
    una.getDate() === otra.getDate()
  );
}

/**
 * **Editar tus datos** — lo que la persona declaró de sí misma al registrarse.
 *
 * ## Por qué existe
 *
 * El auto-registro escribía nombre, nacimiento, teléfono y domicilio una sola
 * vez y no había forma de volver a tocarlos: quien tipeó mal su apellido,
 * cambió de número o se mudó quedaba con el dato viejo para siempre. «Mi
 * perfil» sólo lo mostraba.
 *
 * ## Por qué es una pantalla aparte
 *
 * Mismo criterio que el editor del profesional: «Mi perfil» es de **lectura**
 * —lo que hay, con su estado de verificación—, y editar es otra intención.
 * Mezclarlas con un booleano `editando` termina en un formulario dibujado
 * encima de una ficha.
 *
 * ## El nombre va en cuatro partes
 *
 * `displayName` lo **compone el backend** y no es separable: para corregir un
 * apellido materno hay que tener el apellido materno. Por eso esta pantalla lee
 * `GET /profiles/patients/me` y no el resumen.
 *
 * ## Qué no se edita acá
 *
 * Documento, correo, contraseña, género administrativo, código de paciente y
 * estados. No es una omisión de la pantalla: el backend tampoco los acepta en
 * este `PATCH`, porque cada uno tiene su propio circuito o lo decide el
 * sistema.
 */
@Component({
  selector: 'app-patient-profile-edit',
  imports: [
    Alert,
    AnnounceOnAppear,
    ReferenceCombobox,
    UbicacionPicker,
    AppButton,
    BackLink,
    Card,
    DatePicker,
    FormActions,
    FormField,
    Input,
    NavIcon,
    NgTemplateOutlet,
    PageHeader,
    PhoneInput,
    ReactiveFormsModule,
    Select,
    Tab,
    Tabs,
    Tooltip,
    TreeSelect,
    ViewStateHost,
  ],
  templateUrl: './patient-profile-edit.html',
  styleUrl: './patient-profile-edit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientProfileEdit {
  private readonly profiles = inject(ProfilesClient);
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  private readonly departamentos = inject(BoDepartmentsCatalog);

  /* -- ID-22: el departamento que emitió el documento se corrige ----------
     El número no (es el usuario de acceso y tiene su circuito). */
  protected readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  protected readonly departamentoEmisor = signal<string | null>(null);

  private cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) =>
        this.opcionesDepartamento.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        ),
      error: () => this.opcionesDepartamento.set([]),
    });
  }
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  /** El mismo destino que al cancelar: se vuelve al perfil del que se vino. */
  protected readonly rutaDeMiPerfil = MI_PERFIL;

  /* ---- FT-11 · el mismo editor, dentro del perfil ------------------------- */

  /**
   * El editor vive **dentro** de «Mi perfil» en vez de en su propia pantalla.
   *
   * ## Por qué existe este interruptor
   *
   * El pedido del cliente es que el perfil entre en sólo lectura y que «Editar»
   * habilite los campos ahí mismo, sin cambiar de pantalla. Eso podría haberse
   * resuelto copiando el formulario dentro del perfil, y sería el mismo
   * formulario en dos lugares: dos validaciones que se separan en el primer
   * retoque que sólo se haga en uno.
   *
   * Así que el formulario sigue siendo **uno solo** y lo que cambia es su marco.
   * Embebido no dibuja su propio encabezado de página —ya hay uno arriba— y no
   * navega al terminar: avisa a quien lo contiene, que vuelve a sólo lectura.
   *
   * La ruta `/my-account/profile/edit` sigue existiendo y funcionando: es un
   * enlace que puede estar en un correo o en un favorito, y romperlo para
   * estrenar el modo embebido sería cambiar un problema por otro.
   */
  readonly embebido = input(false, { transform: booleanAttribute });

  /**
   * El editor terminó: se guardó o se canceló.
   *
   * Sólo tiene sentido embebido; en su propia pantalla el componente navega.
   */
  readonly cerrado = output<void>();

  /**
   * Las pestañas del formulario y cuál está abierta.
   *
   * Son las de la ficha de lectura, en el mismo orden (`PESTANAS_DEL_PERFIL`).
   * Es un `model` y no una señal propia para que «Mi perfil» la comparta:
   * el lápiz abre el formulario en la pestaña que se estaba mirando, y al
   * guardar o cancelar la ficha vuelve a esa misma.
   */
  readonly pestana = model<number>(PESTANA.personales);
  protected readonly pestanas = PESTANAS_DEL_PERFIL;

  protected readonly perfil = signal<ViewState<OwnPatientProfile>>(loading());

  protected readonly datos = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' ? estado.data : null;
  });

  /* -- Un signal por campo, sembrado desde la respuesta -------------------- */

  protected readonly nombre = signal('');
  protected readonly segundoNombre = signal('');
  protected readonly tercerNombre = signal('');
  /**
   * Los nombres que se agregaron después del tercero.
   *
   * Mismo criterio que el alta: hay gente con cuatro y cinco nombres, y una
   * casilla fija por cada uno sería un formulario largo para todos por lo que
   * necesitan pocos. Existen **sólo en la pantalla**; al guardar, éstos y el
   * segundo y el tercero vuelven a una sola cadena, que es lo único que la base
   * tiene para los nombres que no son el primero — ver {@link nombresAdicionales}.
   */
  protected readonly nombresExtra = signal<readonly string[]>([]);
  protected readonly apellidoPaterno = signal('');
  protected readonly apellidoMaterno = signal('');
  protected readonly fechaNacimiento = signal<Date | null>(null);
  protected readonly sexoAlNacer = signal<BirthSexCode | null>(null);

  /** La ocupación es un concepto de `VS_BO_OCCUPATION`, no un texto: ver `cargarOcupaciones`. */
  protected readonly ocupacionConceptId = signal<string | null>(null);

  protected readonly municipio = signal<string | null>(null);

  /**
   * NIT, domicilio y dirección de trabajo.
   *
   * Los tres se podían declarar al registrarse y esta pantalla no los ofrecía:
   * la ficha los mostraba y no había forma de corregirlos. Van como texto porque
   * eso es lo que guarda el modelo — una dirección boliviana real («Av.
   * Prolongación Beni #5100, esq. 6to anillo») no entra en un catálogo. El
   * municipio sigue saliendo del árbol, aparte.
   */
  protected readonly nit = signal('');
  protected readonly razonSocial = signal('');

  /**
   * El correo, **sólo para mostrar**.
   *
   * No aparecía en el editor, y no verlo se lee como que la app lo perdió. Se
   * muestra deshabilitado y con el motivo a la vista, que es distinto de
   * esconderlo: para 59 de las cuentas de hoy el correo ES el usuario con el
   * que entran, y cambiarlo sin verificar la dirección nueva las dejaría
   * entrando con la anterior —o fuera de su cuenta por un tipeo—.
   *
   * El cambio de verdad necesita verificar el correo nuevo ANTES de soltar el
   * viejo. El modelo ya tiene `iam.email_verifications` para eso; el flujo está
   * pendiente.
   */
  protected readonly correo = signal('');
  protected readonly domicilio = signal('');
  protected readonly direccionTrabajo = signal('');

  /**
   * El punto en el mapa de cada dirección — lo que el alta ya preguntaba y el
   * perfil no dejaba tocar.
   *
   * Es el patrón de una app de pedidos, y a propósito: se pide la ubicación al
   * navegador o se marca el pin a mano sobre el mapa, y se confirma mirándolo.
   * El mismo bloque que usa el registro (`app-ubicacion-picker`), no una copia:
   * la dirección se escribe igual en los dos lados y ninguno adivina la calle a
   * partir del punto —eso necesita un geocodificador que la política de
   * seguridad del servidor no permite—.
   *
   * `undefined` es «no lo toqué» y `null` es «lo quité»: son dos cosas
   * distintas al armar el cuerpo del PATCH, y confundirlas borraría la
   * ubicación de quien sólo vino a cambiar el teléfono.
   */
  protected readonly gpsDomicilio = signal<Coordenadas | null | undefined>(undefined);
  protected readonly gpsTrabajo = signal<Coordenadas | null | undefined>(undefined);

  /**
   * Si el mapa vació la dirección escrita y todavía nadie la reescribió (D-06).
   *
   * Un toque sobre el mapa deja el campo en blanco —el punto nuevo ya no es
   * la calle que estaba escrita— y lo dice al lado del campo. El aviso
   * acompaña al campo vacío, no a la persona: en cuanto vuelve a escribir, se
   * va solo.
   */
  private readonly domicilioVaciadoPorElMapa = signal(false);
  private readonly trabajoVaciadoPorElMapa = signal(false);
  protected readonly domicilioPorReescribir = computed(
    () => this.domicilioVaciadoPorElMapa() && this.domicilio().trim() === '',
  );
  protected readonly trabajoPorReescribir = computed(
    () => this.trabajoVaciadoPorElMapa() && this.direccionTrabajo().trim() === '',
  );
  protected readonly avisoReescribir = AVISO_REESCRIBIR_DIRECCION;

  /** Tocaron el mapa del domicilio: la dirección escrita ya no vale (D-06). */
  protected vaciarDomicilioPorElMapa(): void {
    this.domicilio.set('');
    this.domicilioVaciadoPorElMapa.set(true);
  }

  /** Lo mismo, para el trabajo. */
  protected vaciarTrabajoPorElMapa(): void {
    this.direccionTrabajo.set('');
    this.trabajoVaciadoPorElMapa.set(true);
  }

  /** El punto guardado que el selector muestra al abrir. */
  protected readonly gpsDomicilioGuardado = signal<Coordenadas | null>(null);
  protected readonly gpsTrabajoGuardado = signal<Coordenadas | null>(null);

  /**
   * Los identificadores de prueba de cada mapa.
   *
   * Se pasan explícitos, como en el alta: el componente no los deriva de un
   * prefijo porque los que ya existen no son uniformes, y renombrarlos rompería
   * recorridos que hoy funcionan.
   */
  protected readonly idsGpsDomicilio: IdsDePrueba = {
    mapa: 'perfil-domicilio-mapa',
    confirmada: 'perfil-domicilio-confirmada',
    avisoGeocodificacion: 'perfil-domicilio-aviso-geo',
    quitar: 'perfil-domicilio-quitar-gps',
    confirmar: 'perfil-domicilio-confirmar',
    usarUbicacion: 'perfil-domicilio-usar-ubicacion',
    marcarEnMapa: 'perfil-domicilio-marcar',
  };

  protected readonly idsGpsTrabajo: IdsDePrueba = {
    mapa: 'perfil-trabajo-mapa',
    confirmada: 'perfil-trabajo-confirmada',
    avisoGeocodificacion: 'perfil-trabajo-aviso-geo',
    quitar: 'perfil-trabajo-quitar-gps',
    confirmar: 'perfil-trabajo-confirmar',
    usarUbicacion: 'perfil-trabajo-usar-ubicacion',
    marcarEnMapa: 'perfil-trabajo-marcar',
  };

  /**
   * El teléfono va en un control reactivo y no en una señal como el resto.
   *
   * No es una inconsistencia: `app-phone-input` es un `ControlValueAccessor`
   * —compone el prefijo del país con el número nacional— y sólo habla ese
   * idioma. El validador es el suyo, el mismo que usa el alta, porque el largo
   * del número lo sabe el país y eso vive dentro del campo.
   */
  protected readonly telefonoControl = new FormControl('', {
    nonNullable: true,
    validators: [telefonoCompleto],
  });

  /** Espejo del control, para el diff y para el resto de la pantalla. */
  protected readonly telefono = signal('');

  protected readonly guardando = signal(false);

  /* -- Catálogo de municipios ---------------------------------------------- */

  protected readonly arbolMunicipios = signal<readonly TreeSelectGroup<string>[]>([]);

  /** El catálogo no se pudo leer: se lo dice, no se deja un selector mudo. */
  protected readonly catalogoMunicipiosCaido = signal(false);

  /* -- Catálogo de ocupaciones --------------------------------------------- */

  protected readonly opcionesOcupacion = signal<readonly SelectOption<string>[]>([]);

  /** Lo tecleado en la lupa de ocupaciones. */
  protected readonly busquedaOcupacion = signal('');

  /**
   * Las ocupaciones que se ofrecen para lo que se escribió.
   *
   * El registro de procesos pide «una lupa de buscar» para las ocupaciones
   * (PACIENTE §1.4.2), y el alta ya la tenía: este editor había quedado con un
   * `<select>` nativo, que con el catálogo entero es una tira sin filtro que no
   * se recorre. Mismo control y mismo criterio que el alta.
   *
   * El filtrado es **en memoria** y no otra consulta: el catálogo entero ya
   * llegó, y volver a la red por cada tecla sería pagar dos veces por la misma
   * lista.
   */
  protected readonly ocupacionesFiltradas = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaOcupacion().trim().toLowerCase();
    const todas = this.opcionesOcupacion();
    const elegidas = busqueda
      ? todas.filter((o) => o.label.toLowerCase().includes(busqueda))
      : todas;
    return elegidas.map((o) => ({ value: o.value, label: o.label }));
  });

  /** La ocupación elegida, para que el combobox la muestre al abrir. */
  protected readonly ocupacionElegida = computed<ReferenceOption | null>(() => {
    const id = this.ocupacionConceptId();
    if (!id) return null;
    const opcion = this.opcionesOcupacion().find((o) => o.value === id);
    return opcion ? { value: opcion.value, label: opcion.label } : null;
  });

  /**
   * Guarda la ocupación elegida.
   *
   * @param opcion - La elegida, o `null` si la limpió — que acá SÍ significa
   *   quitarla: es el único concepto de esta pantalla que se puede vaciar.
   */
  protected elegirOcupacion(opcion: ReferenceOption | null): void {
    this.ocupacionConceptId.set(opcion?.value ?? null);
  }

  /** Ver `catalogoMunicipiosCaido`: mismo criterio y mismo aviso con reintento. */
  protected readonly catalogoOcupacionesCaido = signal(false);

  /**
   * La ayuda del campo de ocupación.
   *
   * Cuando el perfil trae texto libre y ningún concepto —lo escribió un alta
   * anterior al catálogo— la ayuda lo dice: si no, el desplegable aparecería
   * vacío y la persona leería que no declaró ocupación cuando sí lo hizo. El
   * texto heredado **reemplaza** a la ayuda de siempre en vez de sumarse: dos
   * párrafos debajo de un desplegable compiten entre sí.
   */
  protected readonly hintOcupacion = computed(() => {
    const heredada = this.ocupacionHeredada();
    return heredada === null ? HINT_OCUPACION : hintDeOcupacionHeredada(heredada);
  });

  /** El texto libre que sigue guardado porque nadie eligió un concepto todavía. */
  private readonly ocupacionHeredada = computed(() => {
    const perfil = this.datos();
    if (perfil === null || perfil.occupationConceptId !== undefined) {
      return null;
    }
    const texto = perfil.occupationFreeText?.trim() ?? '';
    return texto === '' ? null : texto;
  });

  /* -- Validación mínima, la misma que admite el backend ------------------- */

  protected readonly nombreVacio = computed(() => this.nombre().trim() === '');
  protected readonly apellidoVacio = computed(() => this.apellidoPaterno().trim() === '');

  /**
   * El teléfono sólo se valida cuando hay algo escrito: vaciarlo es quedarse
   * sin teléfono, y el backend lo admite explícitamente. Lo decide el validador
   * del propio campo —`telefonoCompleto`, que ya deja pasar la cadena vacía—,
   * así que acá sólo se espeja su veredicto en una señal para que la plantilla
   * y `puedeGuardar` reaccionen.
   */
  protected readonly telefonoMalEscrito = signal(false);

  /**
   * El sexo pasó a obligatorio (antes «Género (opcional)»): es un dato
   * clínico —dosis, valores de referencia, tamizajes—, no una cortesía.
   * Un valor heredado fuera de la lista vigente (`Intersexual`, `Prefiero no
   * decirlo`) también cuenta como vacío: hay que elegir una de las dos
   * opciones actuales para poder guardar.
   */
  protected readonly sexoVacio = computed(() => this.sexoAlNacer() === null);

  protected readonly puedeGuardar = computed(
    () =>
      !this.nombreVacio() &&
      !this.apellidoVacio() &&
      !this.telefonoMalEscrito() &&
      !this.sexoVacio(),
  );

  /* -- Constantes de la plantilla ------------------------------------------ */

  protected readonly opcionesSexoAlNacer = BIRTH_SEX_OPTIONS;
  protected readonly nacimientoMasAntiguo = NACIMIENTO_MAS_ANTIGUO;

  constructor() {
    // El control es la fuente del teléfono; la señal es su espejo. Se suscribe
    // antes de cargar para que la siembra y lo que se teclee después pasen por
    // el mismo sitio.
    this.telefonoControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => this.espejarTelefono(valor));

    this.cargar();
    this.cargarMunicipios();
    this.cargarDepartamentos();
    this.cargarOcupaciones();
  }

  /** Lleva a las señales lo que el control tiene y lo que su validador dice. */
  private espejarTelefono(valor: string): void {
    this.telefono.set(valor);
    this.telefonoMalEscrito.set(this.telefonoControl.invalid);
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.profiles.getOwnPatientProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPatientProfile>(error)),
    });
  }

  /**
   * Llena el formulario con lo que ya hay guardado.
   *
   * Sólo al cargar y al guardar, nunca en un `computed`: sembrar en cada cambio
   * del perfil borraría lo que la persona acaba de teclear si la pantalla
   * revalida mientras escribe.
   */
  private sembrarFormulario(perfil: OwnPatientProfile): void {
    this.nombre.set(perfil.name ?? '');
    this.repartirNombresAdicionales(perfil.middleName ?? '');
    this.apellidoPaterno.set(perfil.lastName ?? '');
    this.apellidoMaterno.set(perfil.motherLastName ?? '');
    this.fechaNacimiento.set(perfil.birthDate ?? null);
    this.sexoAlNacer.set(perfil.sexAtBirth ?? null);
    this.ocupacionConceptId.set(perfil.occupationConceptId ?? null);
    this.municipio.set(perfil.residenceMunicipalityConceptId ?? null);
    this.departamentoEmisor.set(perfil.issuerAdministrativeAreaConceptId ?? null);
    this.nit.set(perfil.taxId ?? '');
    this.razonSocial.set(perfil.taxHolderName ?? '');
    this.correo.set(perfil.email ?? '');
    this.domicilio.set(perfil.homeAddress?.lines ?? '');
    this.direccionTrabajo.set(perfil.workAddress?.lines ?? '');
    this.gpsDomicilioGuardado.set(puntoDe(perfil.homeAddress));
    this.gpsTrabajoGuardado.set(puntoDe(perfil.workAddress));
    // Se reinician las intenciones: lo que la persona tocó en una visita
    // anterior no puede seguir contando como cambio pendiente al releer.
    this.gpsDomicilio.set(undefined);
    this.gpsTrabajo.set(undefined);
    this.domicilioVaciadoPorElMapa.set(false);
    this.trabajoVaciadoPorElMapa.set(false);

    // Sin `emitEvent`: sembrar no es teclear, y el control ya queda validado.
    // El espejo se actualiza a mano, que es lo que ese evento haría. Se siembra
    // la forma canónica y no el dato crudo: ver `telefonoCanonico`.
    const telefono = telefonoCanonico(perfil.phone);
    this.telefonoControl.setValue(telefono, { emitEvent: false });
    this.espejarTelefono(telefono);
  }

  /**
   * Trae el árbol de municipios, para «dónde vivís».
   *
   * Un fallo no rompe la pantalla: el domicilio es un campo opcional y el resto
   * de los datos se sigue pudiendo corregir. El bloque dice qué pasó y ofrece
   * reintentar, que es lo que el alta ya hacía.
   */
  protected cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.arbolMunicipios.set(ramas.map((rama) => this.aGrupo(rama)));
      },
      error: () => {
        this.arbolMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  /**
   * Reintenta la lectura del catálogo.
   *
   * Olvida lo cacheado antes de pedir: la lectura se comparte con
   * `shareReplay`, que guarda también el error, así que sin esto «Reintentar»
   * repetiría el mismo fallo sin llegar a tocar la red.
   */
  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
  }

  /**
   * Trae el catálogo de ocupaciones, para «¿en qué trabajás?».
   *
   * Mismo criterio que los municipios ante un fallo: el campo es opcional, así
   * que la pantalla sigue en pie y el bloque dice qué pasó con su «Reintentar».
   *
   * Bajo SSR el catálogo devuelve la lista vacía sin tocar la red —no hay API a
   * la que preguntar durante el prerender— y eso **no es un fallo**: el
   * desplegable se dibuja con su marcador y se llena al hidratar.
   */
  protected cargarOcupaciones(): void {
    this.ocupaciones.listar().subscribe({
      next: (opciones) => {
        this.catalogoOcupacionesCaido.set(false);
        this.opcionesOcupacion.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.opcionesOcupacion.set([]);
        this.catalogoOcupacionesCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo de ocupaciones. Ver `reintentarMunicipios`. */
  protected reintentarOcupaciones(): void {
    this.ocupaciones.olvidar();
    this.cargarOcupaciones();
  }

  private aGrupo(rama: RamaDepartamento): TreeSelectGroup<string> {
    return {
      label: rama.nombre,
      items: rama.municipios.map((municipio) => ({
        value: municipio.conceptId,
        label: municipio.nombre,
      })),
    };
  }

  /**
   * Guarda lo que cambió.
   *
   * Sólo viaja el cambio, campo por campo contra lo que se cargó: mandar todo
   * siempre funcionaría —es un `PATCH` idempotente— pero entonces el registro
   * de auditoría del backend diría que la persona reescribió su ficha entera
   * cada vez que corrigió una letra.
   */
  protected guardar(): void {
    const original = this.datos();
    if (original === null || this.guardando() || !this.puedeGuardar()) {
      return;
    }

    const cambios = this.cambiosContra(original);
    if (Object.keys(cambios).length === 0) {
      this.toasts.info('No había ningún cambio para guardar.', AMBITO);
      return;
    }

    this.guardando.set(true);
    this.profiles.updateOwnPatientProfile(cambios).subscribe({
      next: (perfil) => {
        this.guardando.set(false);
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
        this.toasts.success('Tus datos quedaron actualizados.', AMBITO);
        // FT-11-R05 · embebido, guardar devuelve el perfil a sólo lectura: es
        // la señal de que terminó. En su propia pantalla se queda, que es lo
        // que hacía y lo que espera quien llegó por la ruta directa.
        if (this.embebido()) {
          this.cerrado.emit();
        }
      },
      error: () => {
        this.guardando.set(false);
        this.toasts.error('No pudimos guardar los cambios. Probá de nuevo.', AMBITO);
      },
    });
  }

  /**
   * FT-11-R06 · Cancelar **restaura**: nada de lo tipeado se manda.
   *
   * Embebido no navega —no hay a dónde ir, el perfil está debajo— y el
   * formulario se destruye con sus signals, así que la próxima vez que se
   * abra vuelve a sembrarse desde el servidor. Eso es lo que hace que cancelar
   * restaure de verdad y no sólo esconda lo escrito.
   */
  protected cancelar(): void {
    if (this.embebido()) {
      this.cerrado.emit();
      return;
    }
    void this.router.navigate([MI_PERFIL]);
  }

  /**
   * El cambio de cada campo respecto de lo cargado.
   *
   * **Vaciar un texto es un cambio, no un campo sin tocar.** El segundo nombre
   * y el apellido materno se vacían cuando la persona descubre que no lleva
   * ninguno, el teléfono cuando deja de tenerlo y la ocupación cuando vuelve a
   * «Sin especificar»: el backend los borra con `''` y lo declara en su
   * contrato.
   *
   * TODO(API): la fecha de nacimiento, el sexo al nacer y el municipio **no se
   * pueden borrar**. Sus validadores son `@IsISO8601`, `@IsIn` y `@IsUUID`, y
   * ninguno admite la cadena vacía: un valor declarado se puede cambiar por
   * otro, no quitar. Mientras siga así, dejarlos en blanco no manda nada en vez
   * de provocar un `400` que la persona leería como un fallo del producto.
   */
  /**
   * Qué pestaña tiene un campo que impide guardar, cuando no es la abierta.
   *
   * Con el formulario repartido en pestañas, «Guardar» apagado por un nombre
   * vacío en «Datos personales» mientras se mira «Contacto» es un botón que
   * parece roto. La nota dice adónde ir. Es `null` cuando lo que falta está a
   * la vista: ahí el campo ya lo dice con su propio error.
   */
  protected readonly pendienteEnOtraPestana = computed<string | null>(() => {
    const abierta = this.pestana();
    if (
      abierta !== PESTANA.personales &&
      (this.nombreVacio() || this.apellidoVacio() || this.sexoVacio())
    ) {
      return `Falta completar «${PESTANAS_DEL_PERFIL[PESTANA.personales]}».`;
    }
    if (abierta !== PESTANA.contacto && this.telefonoMalEscrito()) {
      return `Revisá el teléfono en «${PESTANAS_DEL_PERFIL[PESTANA.contacto]}».`;
    }
    return null;
  });

  /* -- Los nombres que no son el primero ----------------------------------
     Se guardan en UNA columna, separados por espacio (así los escribe el alta).
     Acá se reparten en casillas para poder corregir uno sin reescribir todos, y
     se vuelven a unir al guardar. */

  /**
   * Reparte en casillas lo que hay guardado como un solo texto.
   *
   * Es la inversa exacta de {@link nombresAdicionales}: la primera palabra al
   * segundo nombre, la siguiente al tercero, y las que sobren a una casilla
   * cada una. Sin esto, alguien con cuatro nombres abría el editor y veía los
   * tres apretados dentro de «Segundo nombre», que es lo que pasaba hasta hoy.
   *
   * @param guardado - El valor de `middleName` tal como vino del backend.
   */
  private repartirNombresAdicionales(guardado: string): void {
    const partes = guardado.split(/\s+/).filter((parte) => parte !== '');
    this.segundoNombre.set(partes[0] ?? '');
    this.tercerNombre.set(partes[1] ?? '');
    this.nombresExtra.set(partes.slice(2));
  }

  /**
   * Las casillas de nombre en una sola cadena, como las guarda la base.
   *
   * Mismo criterio que el alta: separadas por espacio y sin las vacías, así
   * quitar una casilla del medio no deja un espacio doble.
   */
  private nombresAdicionales(): string {
    return [this.segundoNombre(), this.tercerNombre(), ...this.nombresExtra()]
      .map((nombre) => nombre.trim())
      .filter((nombre) => nombre !== '')
      .join(' ');
  }

  /** Suma una casilla vacía de nombre. */
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

  private cambiosContra(original: OwnPatientProfile): OwnPatientProfileChanges {
    const cambios: CambiosEnCurso = {};

    const nombre = textoCambiado(this.nombre(), original.name);
    if (nombre !== undefined) {
      cambios.name = nombre;
    }
    // Las casillas de nombre vuelven a ser una sola cadena antes de compararse:
    // la base tiene una columna, no una por nombre. Quitar la última casilla es
    // un cambio como cualquier otro, y por eso se compara el resultado y no las
    // casillas una por una.
    const nombresAdicionales = textoCambiado(this.nombresAdicionales(), original.middleName);
    if (nombresAdicionales !== undefined) {
      cambios.middleName = nombresAdicionales;
    }
    const apellidoPaterno = textoCambiado(this.apellidoPaterno(), original.lastName);
    if (apellidoPaterno !== undefined) {
      cambios.lastName = apellidoPaterno;
    }
    const apellidoMaterno = textoCambiado(this.apellidoMaterno(), original.motherLastName);
    if (apellidoMaterno !== undefined) {
      cambios.motherLastName = apellidoMaterno;
    }
    // Se compara contra la forma canónica de lo guardado, no contra el dato
    // crudo: si no, un teléfono heredado en otro formato viajaría «cambiado»
    // sin que nadie lo tocara. Ver `telefonoCanonico`.
    const telefono = textoCambiado(this.telefono(), telefonoCanonico(original.phone));
    if (telefono !== undefined) {
      cambios.phone = telefono;
    }

    const fecha = this.fechaNacimiento();
    const fechaGuardada = original.birthDate;
    if (fecha !== null && (fechaGuardada === undefined || !mismoDia(fecha, fechaGuardada))) {
      cambios.birthDate = fecha;
    }

    const sexo = this.sexoAlNacer();
    if (sexo !== null && sexo !== original.sexAtBirth) {
      cambios.sexAtBirth = sexo;
    }

    const departamento = this.departamentoEmisor();
    if (departamento !== null && departamento !== original.issuerAdministrativeAreaConceptId) {
      cambios.issuerAdministrativeAreaConceptId = departamento;
    }

    const municipio = this.municipio();
    if (municipio !== null && municipio !== original.residenceMunicipalityConceptId) {
      cambios.residenceMunicipalityConceptId = municipio;
    }

    // `textoCambiado` devuelve `''` cuando se vació y `undefined` cuando no se
    // tocó, que es justo la distinción que el backend necesita: `''` quita el
    // dato y ausente no lo toca.
    const nit = textoCambiado(this.nit(), original.taxId);
    if (nit !== undefined) {
      cambios.taxId = nit;
    }
    const razonSocial = textoCambiado(this.razonSocial(), original.taxHolderName);
    if (razonSocial !== undefined) {
      cambios.taxHolderName = razonSocial;
    }
    const domicilio = textoCambiado(this.domicilio(), original.homeAddress?.lines);
    if (domicilio !== undefined) {
      cambios.homeAddressLines = domicilio;
    }
    const trabajo = textoCambiado(this.direccionTrabajo(), original.workAddress?.lines);
    if (trabajo !== undefined) {
      cambios.workAddressLines = trabajo;
    }

    // El punto de cada dirección, con la misma regla de tres estados que el
    // texto: sin tocar no viaja, quitado viaja como `null` en los dos extremos,
    // y movido viaja como par. Nunca media coordenada.
    Object.assign(cambios, coordenadasCambiadas('home', this.gpsDomicilio()));
    Object.assign(cambios, coordenadasCambiadas('work', this.gpsTrabajo()));

    // La ocupación **sí se puede borrar**: es el único concepto de esta pantalla
    // cuyo validador admite la cadena vacía, así que volver a «Sin especificar»
    // la vacía en vez de no mandar nada. El texto libre de las altas viejas no
    // viaja: quien no toca el desplegable lo conserva tal cual.
    const ocupacion = this.ocupacionConceptId();
    if (ocupacion !== (original.occupationConceptId ?? null)) {
      cambios.occupationConceptId = ocupacion ?? '';
    }

    return cambios;
  }
}

/**
 * Un teléfono guardado, en la forma que `app-phone-input` compone.
 *
 * ## Qué problema resuelve
 *
 * En la base conviven al menos tres formas del mismo número, porque el
 * `@Matches` del backend las acepta todas y el alta anterior a este campo dejaba
 * escribir a mano: `+591 70012345` (la que compone el campo hoy),
 * `+591 700 22222` y `70012345` a secas. El campo las pinta todas igual —deriva
 * el país y el número nacional— pero `telefonoCompleto` sólo acepta la primera,
 * así que sembrar el control con el dato crudo dejaba el editor **abierto en
 * inválido**: mensaje de número incompleto, `aria-invalid` y «Guardar cambios»
 * deshabilitado, con lo cual no se podía corregir ni el nombre. Observado con
 * un perfil cuyo teléfono estaba guardado como `70012345`.
 *
 * Sembrar la forma canónica hace que el control tenga **exactamente el valor que
 * la persona ve**, que es la única manera de que su validez signifique algo.
 *
 * ## Lo que no hace
 *
 * No normaliza el dato guardado por su cuenta: un teléfono heredado que nadie
 * toca **no viaja** en el `PATCH` (ver `cambiosContra`). Reescribirlo en
 * silencio cerraría el contacto vigente y abriría otro sin que la persona
 * hiciera nada, que es una decisión suya y no de una pantalla que se abrió.
 *
 * El precio: un número heredado con más dígitos de los que su país admite se ve
 * recortado en el campo, igual que se vería al teclearlo. Sigue guardado entero
 * mientras no se toque, y se pierde sólo si la persona escribe encima — que es
 * cuando decidió cambiarlo.
 *
 * @param guardado - El teléfono tal como vino de la API.
 * @returns `''` si no hay dígitos; si no, `+<prefijo> <número nacional>`.
 */
function telefonoCanonico(guardado: string | undefined): string {
  const crudo = guardado ?? '';
  if (!/[0-9]/.test(crudo)) {
    return '';
  }
  const pais = paisDelNumero(crudo);
  return `${pais.prefijo} ${nacionalDelNumero(crudo, pais)}`;
}

/**
 * El valor a mandar de un campo de texto, o `undefined` si no cambió.
 *
 * Devuelve `''` cuando la persona lo vació teniendo algo: es el cambio que
 * borra el dato, y confundirlo con «no lo tocó» dejaría el apellido materno de
 * quien no lleva ninguno pegado para siempre.
 */
function textoCambiado(actual: string, guardado: string | undefined): string | undefined {
  const limpio = actual.trim();
  return limpio === (guardado ?? '') ? undefined : limpio;
}

/**
 * El punto de una dirección, tal como sale del perfil leído.
 *
 * Las dos mitades tienen que estar: una dirección con latitud y sin longitud no
 * ubica nada, y sembrar el mapa con eso pondría el pin en el meridiano cero.
 */
function puntoDe(
  direccion: { latitude?: number; longitude?: number } | undefined,
): Coordenadas | null {
  if (direccion?.latitude === undefined || direccion.longitude === undefined) {
    return null;
  }
  return { lat: direccion.latitude, lng: direccion.longitude };
}

/**
 * Traduce la intención sobre el mapa a las claves del cuerpo del PATCH.
 *
 * `undefined` —no se tocó— no produce ninguna clave: mandar el punto actual
 * «por las dudas» convertiría cualquier guardado en una reescritura de la
 * ubicación, y bastaría un error de redondeo del servidor para moverla sola.
 */
function coordenadasCambiadas(
  cual: 'home' | 'work',
  intencion: Coordenadas | null | undefined,
): Record<string, number | null> {
  if (intencion === undefined) return {};
  if (intencion === null) {
    return { [`${cual}Latitude`]: null, [`${cual}Longitude`]: null };
  }
  return { [`${cual}Latitude`]: intencion.lat, [`${cual}Longitude`]: intencion.lng };
}
