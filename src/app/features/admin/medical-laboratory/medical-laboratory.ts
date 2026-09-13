import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { DiagnosticUnitsAdminClient } from '../../../core/data-access/diagnostic-units/diagnostic-units-admin.client';
import type {
  CreatePriceScheduleInput,
  CreateStudyOfferingInput,
  DiagnosticUnitAdminAccreditation,
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminEquipment,
  DiagnosticUnitAdminItem,
  DiagnosticUnitAdminPrice,
  DiagnosticUnitAdminSite,
  DiagnosticUnitAdminStaff,
  DiagnosticUnitAdminStudy,
} from '../../../core/data-access/diagnostic-units/diagnostic-units-admin.types';
import type { DiagnosticConcept } from '../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../core/data-access/system-context/system-context.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, hasData, loading, ready, stale } from '../../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { ServiceIcon } from '../../../shared/components/atoms/service-icon/service-icon';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Accordion } from '../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SectionHeading } from '../../../shared/components/molecules/section-heading/section-heading';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import type { TarifarioDeLaUnidad } from './medical-laboratory.types';
import { TarifariosRecordados } from './tarifarios-recordados';

/**
 * El mismo concepto, dicho de las dos maneras en que puede llegar.
 *
 * Un concepto tiene un solo uuid pero llegó a la base con **dos códigos**: el
 * paquete de datos guarda la clave con la que el modelo lo declara
 * (`diagnostic_units:PRICE_ACTIVE`) y la API declara el suyo
 * (`DU_PRICE_ACTIVE`). La ficha devuelve el que tenga la fila, así que
 * comparar contra uno solo deja fuera la mitad de los casos: los badges caen
 * todos al tono neutro y las acciones que dependen del estado aparecen sobre
 * lo que no corresponde. Se aceptan los dos hasta que se unifiquen aguas
 * arriba; el día que pase, esta tabla queda vacía y nada más cambia.
 */
const ALIAS_DEL_PAQUETE: Readonly<Record<string, string>> = {
  'diagnostic_units:UNIT_ACTIVE': 'DU_UNIT_ACTIVE',
  'diagnostic_units:UNIT_RETIRED': 'DU_UNIT_RETIRED',
  'diagnostic_units:VERIFICATION_VERIFIED': 'DU_VERIF_VERIFIED',
  'diagnostic_units:VERIFICATION_PENDING': 'DU_VERIF_PENDING',
  'diagnostic_units:SITE_ACTIVE': 'DU_SITE_ACTIVE',
  'diagnostic_units:OFFERING_ACTIVE': 'DU_OFFER_ACTIVE',
  'diagnostic_units:OFFERING_DRAFT': 'DU_OFFER_DRAFT',
  'diagnostic_units:OFFERING_RETIRED': 'DU_OFFER_RETIRED',
  'diagnostic_units:EQUIPMENT_OPERATIONAL': 'DU_EQ_OPERATIONAL',
  'diagnostic_units:EQUIPMENT_MAINTENANCE': 'DU_EQ_MAINTENANCE',
  'diagnostic_units:PRICE_ACTIVE': 'DU_PRICE_ACTIVE',
  'diagnostic_units:PRICE_SUPERSEDED': 'DU_PRICE_SUPERSEDED',
  'diagnostic_units:PRICE_RETIRED': 'DU_PRICE_RETIRED',
  'diagnostic_units:ASSIGNMENT_ACTIVE': 'DU_ASSIGN_ACTIVE',
};

/** El código de un concepto, dicho siempre como lo declara la API. */
function codigoEstable(concepto: DiagnosticConcept): string {
  return ALIAS_DEL_PAQUETE[concepto.code] ?? concepto.code;
}

/** Variante del badge por **código** de concepto; la etiqueta es presentación. */
const VARIANTE_POR_CODIGO: Readonly<Record<string, BadgeVariant>> = {
  DU_UNIT_ACTIVE: 'success',
  DU_UNIT_RETIRED: 'secondary',
  DU_VERIF_VERIFIED: 'success',
  DU_VERIF_PENDING: 'warning',
  DU_SITE_ACTIVE: 'success',
  DU_OFFER_ACTIVE: 'success',
  DU_OFFER_DRAFT: 'warning',
  DU_OFFER_RETIRED: 'secondary',
  DU_EQ_OPERATIONAL: 'success',
  DU_EQ_MAINTENANCE: 'warning',
  DU_PRICE_ACTIVE: 'success',
  DU_PRICE_SUPERSEDED: 'secondary',
  DU_PRICE_RETIRED: 'secondary',
  DU_ASSIGN_ACTIVE: 'success',
};

/** Días de aviso previo a un vencimiento o a una calibración. */
const AVISO_DIAS = 30;

/**
 * La columna que gobierna qué estudio se ofrece.
 *
 * El selector resuelve sus opciones por **binding de columna** y no por un
 * conjunto de valores elegido acá: `esquema.tabla.columna` es lo que publica el
 * catálogo, y es lo único que un formulario puede saber sin atarse al uuid de
 * un value set sembrado. Es el mismo campo que gobierna el pedido médico, y no
 * por casualidad: lo que un laboratorio ofrece y lo que un médico pide tienen
 * que salir del mismo catálogo o nunca van a cruzarse.
 */
const TARGET_ESTUDIO = 'clinical.service_requests.code_concept_id';

/** Código estable de la oferta ya retirada: no se retira dos veces. */
const CODIGO_OFERTA_RETIRADA = 'DU_OFFER_RETIRED';
const CODIGO_OFERTA_BORRADOR = 'DU_OFFER_DRAFT';

/** Tarjetas que simula el esqueleto: una pantalla, no el catálogo entero. */
const TARJETAS_DEL_ESQUELETO = 6;

/** Largos que la API valida. Se copian para poder avisar antes de mandar. */
const LARGO_MAXIMO_DE_CODIGO = 60;
const LARGO_MAXIMO_DE_NOMBRE = 200;

/**
 * Consola del **administrador de organización de laboratorio médico** —
 * CARRIL 16.
 *
 * ## Qué resuelve, y por qué no alcanzaba el directorio
 *
 * `/laboratory-directory` es la vitrina: la usa el paciente del carril 11 para
 * elegir dónde hacerse un estudio, y por eso muestra **sólo** unidades activas
 * y verificadas, ofertas activas y precios de cronogramas públicos. Esa es
 * exactamente la información que un administrador no puede usar: la unidad que
 * todavía no publicó no aparece en ninguna pantalla, la oferta que retiró no se
 * puede reactivar porque no se puede encontrar, y el convenio con una
 * aseguradora no existe. Esta consola lee el mismo dominio **sin** esos
 * filtros, y agrega dos cosas que la vitrina no debe tener: el personal con sus
 * permisos de validación y firma, y las alertas de vencimiento y calibración.
 *
 * ## Maestro-detalle en una pantalla
 *
 * Un laboratorio no tiene decenas de unidades: tiene una o unas pocas. Una
 * pantalla de listado y otra de ficha obligarían a navegar de ida y vuelta para
 * comparar dos sedes del mismo tenant. La lista queda arriba como selector y la
 * ficha debajo, que es la misma forma que usa la consola de organización médica
 * del carril 13.
 *
 * ## Lo que además escribe
 *
 * Publicar la unidad, sumar y retirar estudios del catálogo, crear tarifarios y
 * poner precios. Es el mínimo para que un laboratorio recién dado de alta pueda
 * llegar por sí solo al directorio: sin ofertas no hay nada que reservar, sin
 * precios no hay «desde Bs …» en la vitrina, y sin publicar no lo ve nadie.
 *
 * **Nada se edita en su lugar**: la API no expone modificación de una oferta ni
 * de un precio. Un precio nuevo es una versión nueva y el anterior se cierra;
 * un estudio que ya no se hace se retira. Es append-only del lado del servidor
 * y la pantalla no finge lo contrario con un botón «editar» que después falle.
 */
@Component({
  selector: 'app-medical-laboratory',
  imports: [
    Accordion,
    AccordionPanel,
    Alert,
    AppButton,
    Badge,
    Card,
    Checkbox,
    DataTable,
    DatePicker,
    FormActions,
    FormField,
    Input,
    PageHeader,
    SectionHeading,
    Select,
    ServiceIcon,
    Skeleton,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './medical-laboratory.html',
  // Las dos hojas compartidas van **primero** y la propia al final: Angular
  // concatena en este orden, y al revés `.rejilla` le ganaría por posición a
  // `.laboratorio__rejilla` —misma especificidad— y el ancho de columna de
  // esta pantalla no se aplicaría.
  styleUrls: [
    '../../../shared/styles/rejilla-de-tarjetas.css',
    '../../../shared/styles/tarjeta-de-servicio.css',
    './medical-laboratory.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalLaboratory {
  private readonly client = inject(DiagnosticUnitsAdminClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly navigation = inject(NavigationService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly recordados = inject(TarifariosRecordados);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaSede =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>>('celdaSede');
  private readonly celdaCapacidadesSede =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>
    >('celdaCapacidadesSede');
  private readonly celdaEstadoSede =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminSite }>>('celdaEstadoSede');

  private readonly celdaEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaEquipo');
  private readonly celdaSedeDelEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaSedeDelEquipo');
  private readonly celdaCalibracion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaCalibracion');
  private readonly celdaEstadoEquipo =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminEquipment }>
    >('celdaEstadoEquipo');

  private readonly celdaTarifario =
    viewChild.required<TemplateRef<{ $implicit: TarifarioDeLaUnidad }>>('celdaTarifario');
  private readonly celdaPreciosDelTarifario =
    viewChild.required<
      TemplateRef<{ $implicit: TarifarioDeLaUnidad }>
    >('celdaPreciosDelTarifario');

  private readonly celdaIntegrante =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>>('celdaIntegrante');
  private readonly celdaPermisos =
    viewChild.required<TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>>('celdaPermisos');
  private readonly celdaVigenciaIntegrante =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>
    >('celdaVigenciaIntegrante');
  private readonly celdaEstadoIntegrante =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminStaff }>
    >('celdaEstadoIntegrante');

  private readonly celdaAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaAcreditacion');
  private readonly celdaVigenciaAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaVigenciaAcreditacion');
  private readonly celdaEstadoAcreditacion =
    viewChild.required<
      TemplateRef<{ $implicit: DiagnosticUnitAdminAccreditation }>
    >('celdaEstadoAcreditacion');

  /** Las unidades del tenant, publicadas o no. */
  protected readonly unidades = signal<ViewState<readonly DiagnosticUnitAdminItem[]>>(loading());

  /**
   * Las unidades, como las pide `app-select`.
   *
   * El nombre lleva el código entre paréntesis porque dos sedes de un mismo
   * laboratorio se llaman casi igual —«Central» y «Central Norte»— y el código
   * es lo único que las separa sin ambigüedad.
   */
  protected readonly opcionesDeUnidad = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.unidades()) ?? []).map((unidad) => ({
      value: unidad.id,
      label: `${unidad.name} (${unidad.code})`,
    })),
  );

  /** La unidad elegida. Vacío mientras el listado no resolvió. */
  protected readonly unidadElegida = signal('');

  /** La ficha administrativa de la unidad elegida. */
  protected readonly ficha = signal<ViewState<DiagnosticUnitAdminDetail>>(loading());

  /** La cabecera, cuando la ficha cargó. `null` en cualquier otro estado. */
  protected readonly laboratorio = computed(() => {
    const estado = this.ficha();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** Nombre de cada sede por su id: las demás pestañas devuelven `siteId` crudo. */
  private readonly nombreDeSede = computed<ReadonlyMap<string, string>>(() => {
    const estado = this.ficha();
    if (estado.status !== 'ready') return new Map();
    return new Map(estado.data.sites.map((sede) => [sede.id, sede.name]));
  });

  protected readonly sedes = computed(() =>
    this.listaDe(
      (datos) => datos.sites,
      { label: 'Registrar una sucursal' },
      'Una sucursal es cada punto donde el laboratorio toma muestras o procesa estudios. Sin al menos una no hay dónde reservar ni dónde instalar equipos.',
    ),
  );

  protected readonly equipamiento = computed(() =>
    this.listaDe(
      (datos) => datos.equipment,
      { label: 'Registrar un equipo' },
      'Analizadores y equipos de imagen, con su ventana de calibración. Registrarlos es lo que permite avisar antes de que una calibración se venza.',
    ),
  );

  protected readonly estudios = computed(() =>
    this.listaDe(
      (datos) => datos.studies,
      { label: 'Publicar un estudio' },
      'El catálogo de análisis con su preparación, su tiempo de entrega y sus precios. Mientras esté vacío, no hay nada que un paciente pueda reservar.',
    ),
  );

  /**
   * Los estudios ya desenvueltos de su estado, para recorrerlos en la rejilla.
   *
   * `app-view-state-host` decide qué rama pintar; la lista es lo que va dentro
   * de la rama con datos, y en `stale` sigue habiendo qué mostrar.
   */
  protected readonly listaDeEstudios = computed<readonly DiagnosticUnitAdminStudy[]>(
    () => dataOf(this.estudios()) ?? [],
  );

  /** Huecos del esqueleto. Se calcula una vez: no depende de ningún dato. */
  protected readonly huecosDelEsqueleto = Array.from(
    { length: TARJETAS_DEL_ESQUELETO },
    (_, indice) => indice,
  );

  protected readonly personal = computed(() =>
    this.listaDe(
      (datos) => datos.staff,
      { label: 'Vincular a un profesional' },
      'Bioquímicos, patólogos y técnicos, con quién puede validar resultados y quién puede firmar informes. Sin nadie con permiso de validación, ningún resultado se puede dar por definitivo.',
    ),
  );

  protected readonly acreditaciones = computed(() =>
    this.listaDe(
      (datos) => datos.accreditations,
      { label: 'Cargar una acreditación' },
      'Licencias, registros sanitarios y acreditaciones con su vencimiento. Es el respaldo legal del laboratorio.',
    ),
  );

  /** Acreditaciones vencidas o por vencer dentro del mes. */
  protected readonly acreditacionesPorVencer = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.accreditations.filter(
      (doc) => doc.daysToExpiry !== null && doc.daysToExpiry <= AVISO_DIAS,
    );
  });

  /** Equipos con la calibración vencida o a punto de vencer. */
  protected readonly equiposPorCalibrar = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.equipment.filter(
      (item) => item.daysToCalibration !== null && item.daysToCalibration <= AVISO_DIAS,
    );
  });

  /** Personal habilitado para validar resultados: el permiso crítico del carril. */
  protected readonly validadores = computed(() => {
    const detalle = this.laboratorio();
    if (detalle === null) return [];
    return detalle.staff.filter((integrante) => integrante.mayValidateResults === true);
  });

  protected readonly columnasDeSede = computed<readonly ColumnDef<DiagnosticUnitAdminSite>[]>(
    () => [
      { key: 'name', header: 'Sucursal', priority: 1, cell: this.celdaSede() },
      { key: 'code', header: 'Código', priority: 1 },
      {
        key: 'sampleCollectionAvailable',
        header: 'Capacidades',
        priority: 2,
        cell: this.celdaCapacidadesSede(),
      },
      { key: 'status', header: 'Estado', priority: 1, cell: this.celdaEstadoSede() },
    ],
  );

  protected readonly columnasDeEquipo = computed<
    readonly ColumnDef<DiagnosticUnitAdminEquipment>[]
  >(() => [
    { key: 'type', header: 'Equipo', priority: 1, cell: this.celdaEquipo() },
    { key: 'siteId', header: 'Sucursal', priority: 2, cell: this.celdaSedeDelEquipo() },
    { key: 'daysToCalibration', header: 'Calibración', priority: 1, cell: this.celdaCalibracion() },
    { key: 'operationalStatus', header: 'Estado', priority: 1, cell: this.celdaEstadoEquipo() },
  ]);

  protected readonly columnasDeTarifario = computed<
    readonly ColumnDef<TarifarioDeLaUnidad>[]
  >(() => [
    { key: 'code', header: 'Tarifario', priority: 1, cell: this.celdaTarifario() },
    {
      key: 'cantidadDePrecios',
      header: 'Precios',
      priority: 1,
      align: 'end',
      cell: this.celdaPreciosDelTarifario(),
    },
  ]);

  protected readonly columnasDePersonal = computed<
    readonly ColumnDef<DiagnosticUnitAdminStaff>[]
  >(() => [
    { key: 'practitionerName', header: 'Profesional', priority: 1, cell: this.celdaIntegrante() },
    { key: 'mayValidateResults', header: 'Permisos', priority: 1, cell: this.celdaPermisos() },
    { key: 'validFrom', header: 'Vigencia', priority: 2, cell: this.celdaVigenciaIntegrante() },
    { key: 'status', header: 'Estado', priority: 2, cell: this.celdaEstadoIntegrante() },
  ]);

  protected readonly columnasDeAcreditacion = computed<
    readonly ColumnDef<DiagnosticUnitAdminAccreditation>[]
  >(() => [
    { key: 'type', header: 'Acreditación', priority: 1, cell: this.celdaAcreditacion() },
    { key: 'validTo', header: 'Vigencia', priority: 1, cell: this.celdaVigenciaAcreditacion() },
    {
      key: 'verificationStatus',
      header: 'Verificación',
      priority: 2,
      cell: this.celdaEstadoAcreditacion(),
    },
  ]);

  protected readonly porId = (row: { readonly id: string }): string => row.id;

  /* == Escrituras ==========================================================
     Todas terminan igual: recargar la ficha. Ninguna parchea la lista local
     con lo que devolvió el POST, porque la respuesta de escritura trae los
     estados como concept id crudo y no como concepto con etiqueta: pintarla
     mostraría un uuid donde antes decía «Vigente». Recargar cuesta una
     petición y deja la pantalla diciendo lo que el servidor tiene.
     ====================================================================== */

  /** Qué pestaña está abierta. Se escribe para poder llevar a otra. */
  protected readonly pestanaActiva = signal(0);

  /* -- Publicar la unidad --------------------------------------------------- */

  protected readonly publicando = signal(false);
  protected readonly errorAlPublicar = signal('');

  /* -- El catálogo de estudios --------------------------------------------- */

  private readonly estudiosDelCatalogo = signal<readonly DynamicEnumOption[]>([]);
  protected readonly catalogoCargando = signal(false);

  /**
   * El catálogo no respondió.
   *
   * Con el catálogo caído el formulario **no** se cae a un campo de texto: un
   * `*_concept_id` tecleado a mano es un dato inválido que la API rechaza, o
   * —peor— un uuid de otro conjunto que acepta.
   */
  protected readonly catalogoFallo = signal(false);

  protected readonly opcionesDeEstudio = computed<readonly SelectOption<string>[]>(() =>
    this.estudiosDelCatalogo().map((opcion) => ({
      value: opcion.conceptId,
      label: opcion.display,
    })),
  );

  /* -- Oferta de estudio nueva ---------------------------------------------- */

  protected readonly formularioDeOfertaAbierto = signal(false);
  protected readonly estudioElegido = signal<string | null>(null);
  protected readonly codigoDelEstudio = signal<string | number | null>('');
  protected readonly nombreVisible = signal<string | number | null>('');
  protected readonly sedeDeLaOferta = signal<string | null>(null);
  protected readonly requiereOrdenMedica = signal(false);
  protected readonly tomaADomicilio = signal(false);
  protected readonly instruccionesDePreparacion = signal('');
  protected readonly guardandoOferta = signal(false);
  protected readonly errorDeLaOferta = signal('');

  protected readonly ofertaEsValida = computed(
    () =>
      !this.catalogoFallo() &&
      this.estudioElegido() !== null &&
      textoValido(this.codigoDelEstudio(), LARGO_MAXIMO_DE_CODIGO) &&
      textoValido(this.nombreVisible(), LARGO_MAXIMO_DE_NOMBRE),
  );

  /** Cuál se está retirando, para deshabilitar sólo su botón. */
  protected readonly quitandoOferta = signal<string | null>(null);

  /* -- Tarifarios ----------------------------------------------------------- */

  /**
   * Los creados desde acá que la ficha todavía no puede traer.
   *
   * Están en un signal aparte y no en la ficha porque la API no tiene lectura
   * de tarifarios: hasta que uno tenga su primer precio, la ficha no lo
   * menciona. Lo que hay en el signal sale de {@link TarifariosRecordados},
   * que es quien los sostiene entre una carga de la pantalla y la siguiente.
   */
  private readonly tarifariosCreados = signal<readonly TarifarioDeLaUnidad[]>([]);

  protected readonly formularioDeTarifarioAbierto = signal(false);
  protected readonly codigoDelTarifario = signal<string | number | null>('');
  protected readonly sedeDelTarifario = signal<string | null>(null);
  protected readonly vigenteDesdeTarifario = signal<Date | null>(null);
  protected readonly vigenteHastaTarifario = signal<Date | null>(null);
  protected readonly visibleAlPublico = signal(false);
  protected readonly guardandoTarifario = signal(false);
  protected readonly errorDelTarifario = signal('');

  protected readonly tarifarioEsValido = computed(() =>
    textoValido(this.codigoDelTarifario(), LARGO_MAXIMO_DE_CODIGO),
  );

  /**
   * Los tarifarios que esta consola conoce: los deducidos de los precios de la
   * ficha, más los que se acaban de crear y todavía no tienen ninguno.
   */
  protected readonly tarifarios = computed<readonly TarifarioDeLaUnidad[]>(() => {
    const detalle = this.laboratorio();
    const porId = new Map<string, { code: string; esPublico: boolean; precios: number }>();

    for (const estudio of detalle?.studies ?? []) {
      for (const precio of estudio.prices) {
        const anterior = porId.get(precio.scheduleId);
        porId.set(precio.scheduleId, {
          code: precio.scheduleCode,
          esPublico: precio.schedulePublic,
          precios: (anterior?.precios ?? 0) + 1,
        });
      }
    }

    const deducidos = [...porId.entries()].map(([id, datos]) => ({
      id,
      code: datos.code,
      esPublico: datos.esPublico,
      cantidadDePrecios: datos.precios,
    }));

    // El creado que ya tiene precios sale de la ficha con su cuenta real: lo
    // recordado sólo cubre el hueco, no lo pisa.
    const nuevos = this.tarifariosCreados().filter((creado) => !porId.has(creado.id));

    return [...deducidos, ...nuevos].sort((uno, otro) => uno.code.localeCompare(otro.code, 'es'));
  });

  /** Las sucursales, para los campos que aceptan una. Vacío si no hay ninguna. */
  protected readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(
    () =>
      this.laboratorio()?.sites.map((sede) => ({ value: sede.id, label: sede.name })) ?? [],
  );

  protected readonly opcionesDeTarifario = computed<readonly SelectOption<string>[]>(() =>
    this.tarifarios().map((tarifario) => ({
      value: tarifario.id,
      label: tarifario.esPublico ? `${tarifario.code} (público)` : `${tarifario.code} (interno)`,
    })),
  );

  protected readonly listaDeTarifarios = computed<ViewState<readonly TarifarioDeLaUnidad[]>>(
    () => {
      const estado = this.ficha();
      if (!hasData(estado)) {
        return estado;
      }
      const filas = this.tarifarios();
      if (filas.length === 0) {
        return empty(
          { label: 'Crear un tarifario' },
          'Un tarifario agrupa los precios de un mismo acuerdo: el público que ve cualquier paciente, o el de un convenio. Sin ninguno no hay dónde cargar un precio. Acá ves los que ya tienen algún precio y los que creaste en esta pestaña: la plataforma todavía no devuelve la lista de tarifarios, así que uno recién creado y sin precios no se ve desde otra pestaña hasta que le cargues el primero.',
        );
      }
      return estado.status === 'stale' ? stale(filas, estado.asOf) : ready(filas);
    },
  );

  protected readonly hayTarifarios = computed(() => this.tarifarios().length > 0);

  constructor() {
    this.cargarUnidades();
    this.cargarCatalogoDeEstudios();
  }

  /**
   * `null` además de `''` porque el que emite es `app-select`, y un select se
   * puede vaciar: es la misma firma que `cambiarPractica()` en «Mis servicios».
   * Vaciarlo no cambia de unidad —no existe «ninguna unidad» que administrar—,
   * así que se ignora y la ficha en pantalla se queda donde estaba.
   */
  protected elegirUnidad(unitId: string | null): void {
    if (unitId === null || unitId === '' || unitId === this.unidadElegida()) return;
    this.unidadElegida.set(unitId);
    // Los tarifarios recordados y los formularios abiertos son de la unidad que
    // se deja atrás: arrastrarlos ofrecería cargar un precio en el tarifario de
    // otro laboratorio.
    this.olvidarLoDeLaUnidad();
    this.cargarFicha(unitId);
  }

  protected recargar(): void {
    const elegida = this.unidadElegida();
    if (elegida === '') {
      this.cargarUnidades();
      return;
    }
    this.cargarFicha(elegida);
  }

  protected etiquetaDe(concepto: DiagnosticConcept | null | undefined): string {
    return concepto?.display ?? '—';
  }

  /**
   * El importe de un precio, escrito como lo escribe «Mis servicios»:
   * `250.00 BOB`.
   *
   * La moneda va por su **código** y no por su `display`. El concepto trae las
   * dos grafías —`BOB` y «Boliviano»— y la tarjeta usaba la larga, así que la
   * misma cifra se leía «40.00 Boliviano» acá y «40.00 BOB» en la pantalla del
   * médico. El código es además lo que cabe al lado de un número sin robarle el
   * renglón.
   *
   * Se muestra `patientAmount` cuando lo hay: es lo que paga quien viene sin
   * convenio, que es la pregunta que se hace mirando el catálogo. `baseAmount`
   * es el respaldo cuando el tarifario no distingue.
   */
  protected importeDe(precio: DiagnosticUnitAdminPrice): string {
    const monto = precio.patientAmount ?? precio.baseAmount;
    const moneda = precio.currency?.code;
    return moneda === undefined ? monto : `${monto} ${moneda}`;
  }

  protected varianteDe(concepto: DiagnosticConcept | null | undefined): BadgeVariant {
    return (concepto && VARIANTE_POR_CODIGO[codigoEstable(concepto)]) ?? 'info';
  }

  protected sedeDe(siteId: string | null): string | null {
    return siteId === null ? null : (this.nombreDeSede().get(siteId) ?? null);
  }

  /**
   * Cómo se dice un plazo en días.
   *
   * En palabras y no en la cifra cruda: «-14» obliga a interpretar un signo, y
   * quien lee el aviso necesita saber si tiene que actuar hoy.
   */
  protected plazoEnPalabras(dias: number | null, vencidoLabel = 'vencido'): string {
    if (dias === null) return 'sin fecha declarada';
    if (dias < 0) return `${vencidoLabel} hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`;
    if (dias === 0) return 'vence hoy';
    return `en ${dias} día${dias === 1 ? '' : 's'}`;
  }

  protected varianteDePlazo(dias: number | null): BadgeVariant {
    if (dias === null) return 'info';
    if (dias < 0) return 'error';
    if (dias <= AVISO_DIAS) return 'warning';
    return 'success';
  }

  /* -- Publicar -------------------------------------------------------------- */

  /**
   * Verifica y publica la unidad.
   *
   * Se confirma antes porque publicar es un cambio hacia afuera: a partir de
   * ahí cualquier persona encuentra el laboratorio y ve sus precios públicos.
   * No es destructivo —se puede seguir editando— pero tampoco es un guardado
   * más, y quien lo aprieta tiene que saber qué queda a la vista.
   */
  protected async publicar(): Promise<void> {
    const detalle = this.laboratorio();
    if (detalle === null || this.publicando()) return;

    const confirmado = await this.dialogs.confirm({
      title: 'Publicar la unidad',
      message:
        'La unidad pasa a verse en el directorio público y en las búsquedas de «cerca de mí», con sus sucursales y los precios de sus tarifarios públicos.',
      confirmLabel: 'Publicar',
    });
    if (!confirmado) return;

    this.publicando.set(true);
    this.errorAlPublicar.set('');
    this.client.verifyAndPublish(detalle.id).subscribe({
      next: () => {
        this.publicando.set(false);
        this.toasts.success('La unidad ya se ve en el directorio.');
        this.cargarFicha(detalle.id);
      },
      error: (error: unknown) => {
        this.publicando.set(false);
        // El mensaje del servidor dice qué falta —una sucursal activa, por
        // ejemplo—; el nuestro sólo diría que no se pudo.
        this.errorAlPublicar.set(mensajeDeError(error, 'No pudimos publicar la unidad.'));
      },
    });
  }

  /* -- Ofertas de estudio ---------------------------------------------------- */

  protected alternarFormularioDeOferta(): void {
    const abriendo = !this.formularioDeOfertaAbierto();
    this.formularioDeOfertaAbierto.set(abriendo);
    if (abriendo) {
      this.limpiarFormularioDeOferta();
    }
  }

  /**
   * Al elegir el estudio se propone su nombre.
   *
   * Se propone y no se impone: el catálogo trae el término técnico en inglés, y
   * el nombre visible es lo que el paciente va a leer en el directorio.
   * Sobreescribir lo ya escrito perdería una edición hecha a propósito.
   */
  protected elegirEstudio(conceptId: string | null): void {
    this.estudioElegido.set(conceptId);
    if (conceptId === null || textoDe(this.nombreVisible()) !== '') return;
    const opcion = this.estudiosDelCatalogo().find((item) => item.conceptId === conceptId);
    if (opcion !== undefined) {
      this.nombreVisible.set(opcion.display);
    }
  }

  protected crearOferta(): void {
    const detalle = this.laboratorio();
    const estudio = this.estudioElegido();
    if (detalle === null || estudio === null || this.guardandoOferta()) return;
    if (!this.ofertaEsValida()) {
      this.errorDeLaOferta.set('Revisá el estudio, su código y su nombre visible.');
      return;
    }

    const sede = this.sedeDeLaOferta();
    const preparacion = this.instruccionesDePreparacion().trim();
    const cuerpo: CreateStudyOfferingInput = {
      studyCode: textoDe(this.codigoDelEstudio()),
      studyConceptId: estudio,
      displayName: textoDe(this.nombreVisible()),
      ...(sede === null ? {} : { diagnosticUnitSiteId: sede }),
      ...(preparacion === '' ? {} : { preparationInstructions: preparacion }),
      ...(this.requiereOrdenMedica() ? { requiresMedicalOrder: true } : {}),
      ...(this.tomaADomicilio() ? { homeCollectionEligible: true } : {}),
    };

    this.guardandoOferta.set(true);
    this.errorDeLaOferta.set('');
    this.client.createStudyOffering(detalle.id, cuerpo).subscribe({
      next: () => {
        this.guardandoOferta.set(false);
        this.formularioDeOfertaAbierto.set(false);
        this.limpiarFormularioDeOferta();
        this.toasts.success('El estudio ya está en el catálogo.');
        this.cargarFicha(detalle.id);
      },
      error: (error: unknown) => {
        this.guardandoOferta.set(false);
        this.errorDeLaOferta.set(mensajeDeError(error, 'No pudimos publicar el estudio.'));
      },
    });
  }

  /** Si la oferta todavía se puede retirar. La API rechaza retirar dos veces. */
  /**
   * Si el estudio se está ofreciendo hoy.
   *
   * Sólo lo que **no** está activo lleva distintivo en la tarjeta: un «Activo»
   * repetido en cada una compite con el precio y no informa nada.
   *
   * Se pregunta por lo excepcional —borrador y retirada— y no por
   * `DU_OFFER_ACTIVE`, que es la misma comparación que hace
   * {@link sePuedeQuitar}. El motivo es que el código del concepto **no es
   * estable**: llega con la clave del modelo, con la de la API o con la de la
   * maqueta (ver {@link ALIAS_DEL_PAQUETE}), y afirmando en positivo una
   * grafía que no esté en la tabla deja a TODAS las tarjetas con distintivo.
   * Preguntando en negativo, una grafía desconocida no inventa un aviso.
   */
  protected estaActivo(estudio: DiagnosticUnitAdminStudy): boolean {
    const codigo = codigoEstable(estudio.status);
    return codigo !== CODIGO_OFERTA_RETIRADA && codigo !== CODIGO_OFERTA_BORRADOR;
  }

  protected sePuedeQuitar(estudio: DiagnosticUnitAdminStudy): boolean {
    return codigoEstable(estudio.status) !== CODIGO_OFERTA_RETIRADA;
  }

  protected async quitarOferta(estudio: DiagnosticUnitAdminStudy): Promise<void> {
    const detalle = this.laboratorio();
    if (detalle === null || this.quitandoOferta() !== null) return;

    const confirmado = await this.dialogs.confirm({
      title: `Quitar ${estudio.name}`,
      message:
        'El estudio deja de ofrecerse y de aparecer en el directorio. Sus precios y las reservas ya hechas quedan como están.',
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmado) return;

    this.quitandoOferta.set(estudio.id);
    this.client.deleteStudyOffering(estudio.id).subscribe({
      next: () => {
        this.quitandoOferta.set(null);
        this.toasts.success('El estudio quedó fuera del catálogo.');
        this.cargarFicha(detalle.id);
      },
      error: (error: unknown) => {
        this.quitandoOferta.set(null);
        this.toasts.error(mensajeDeError(error, 'No pudimos quitar el estudio.'));
      },
    });
  }

  /* -- Tarifarios ------------------------------------------------------------ */

  protected alternarFormularioDeTarifario(): void {
    const abriendo = !this.formularioDeTarifarioAbierto();
    this.formularioDeTarifarioAbierto.set(abriendo);
    if (abriendo) {
      this.limpiarFormularioDeTarifario();
    }
  }

  protected crearTarifario(): void {
    const detalle = this.laboratorio();
    if (detalle === null || this.guardandoTarifario()) return;
    if (!this.tarifarioEsValido()) {
      this.errorDelTarifario.set('El código es obligatorio y no puede pasar de 60 caracteres.');
      return;
    }

    const sede = this.sedeDelTarifario();
    const desde = this.vigenteDesdeTarifario();
    const hasta = this.vigenteHastaTarifario();
    // Sin aseguradora: la API la recibe como `insurerTenantId`, y no hay
    // ninguna lectura que dé el identificador de una aseguradora. Un campo
    // donde va un uuid es un campo que nadie puede llenar.
    const cuerpo: CreatePriceScheduleInput = {
      code: textoDe(this.codigoDelTarifario()),
      ...(sede === null ? {} : { diagnosticUnitSiteId: sede }),
      ...(desde === null ? {} : { validFrom: desde.toISOString() }),
      ...(hasta === null ? {} : { validTo: hasta.toISOString() }),
      ...(this.visibleAlPublico() ? { publicVisibility: true } : {}),
    };
    const esPublico = this.visibleAlPublico();

    this.guardandoTarifario.set(true);
    this.errorDelTarifario.set('');
    this.client.createPriceSchedule(detalle.id, cuerpo).subscribe({
      next: (creado) => {
        this.guardandoTarifario.set(false);
        this.formularioDeTarifarioAbierto.set(false);
        this.limpiarFormularioDeTarifario();
        // La respuesta no devuelve la visibilidad: se recuerda la que se acaba
        // de mandar. Es lo único que se sabe de él hasta que tenga un precio.
        this.recordados.recordar(detalle.id, {
          id: creado.id,
          code: creado.code,
          esPublico,
          cantidadDePrecios: 0,
        });
        this.tarifariosCreados.set(this.recordados.deLaUnidad(detalle.id));
        this.toasts.success('El tarifario quedó creado.');
      },
      error: (error: unknown) => {
        this.guardandoTarifario.set(false);
        this.errorDelTarifario.set(mensajeDeError(error, 'No pudimos crear el tarifario.'));
      },
    });
  }

  /* -- Apoyos privados ------------------------------------------------------- */

  private cargarCatalogoDeEstudios(): void {
    this.catalogoCargando.set(true);
    this.systemContext.dynamicEnum(TARGET_ESTUDIO).subscribe({
      next: (enumeracion) => {
        this.catalogoCargando.set(false);
        this.estudiosDelCatalogo.set(enumeracion.options);
        // Un conjunto publicado pero vacío deja el formulario igual de
        // impotente que uno que no responde, y se dice lo mismo.
        this.catalogoFallo.set(enumeracion.options.length === 0);
      },
      error: () => {
        this.catalogoCargando.set(false);
        this.estudiosDelCatalogo.set([]);
        this.catalogoFallo.set(true);
      },
    });
  }

  private olvidarLoDeLaUnidad(): void {
    // Sólo lo que está en pantalla: lo recordado queda guardado por unidad, y
    // la ficha que se carga a continuación repone lo que le corresponde.
    this.tarifariosCreados.set([]);
    this.formularioDeOfertaAbierto.set(false);
    this.formularioDeTarifarioAbierto.set(false);
    this.errorAlPublicar.set('');
    this.limpiarFormularioDeOferta();
    this.limpiarFormularioDeTarifario();
  }

  private limpiarFormularioDeOferta(): void {
    this.estudioElegido.set(null);
    this.codigoDelEstudio.set('');
    this.nombreVisible.set('');
    this.sedeDeLaOferta.set(null);
    this.requiereOrdenMedica.set(false);
    this.tomaADomicilio.set(false);
    this.instruccionesDePreparacion.set('');
    this.errorDeLaOferta.set('');
  }

  private limpiarFormularioDeTarifario(): void {
    this.codigoDelTarifario.set('');
    this.sedeDelTarifario.set(null);
    this.vigenteDesdeTarifario.set(null);
    this.vigenteHastaTarifario.set(null);
    this.visibleAlPublico.set(false);
    this.errorDelTarifario.set('');
  }

  private cargarUnidades(): void {
    this.unidades.set(loading());
    this.client
      .list()
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        if (esFallo(resultado)) {
          this.unidades.set(
            errorToViewState<readonly DiagnosticUnitAdminItem[]>(resultado.error),
          );
          this.ficha.set(errorToViewState<DiagnosticUnitAdminDetail>(resultado.error));
          return;
        }

        if (resultado.items.length === 0) {
          const vacio = empty(
            { label: 'Dar de alta un laboratorio' },
            'Este tenant todavía no tiene ninguna unidad de laboratorio o imagen dada de alta.',
          );
          this.unidades.set(vacio);
          this.ficha.set(vacio);
          return;
        }

        this.unidades.set(ready(resultado.items));
        const primera = resultado.items[0];
        this.unidadElegida.set(primera.id);
        this.cargarFicha(primera.id);
      });
  }

  private cargarFicha(unitId: string): void {
    this.ficha.set(loading());
    // Antes de que responda: los que se crearon desde acá y todavía no tienen
    // ningún precio no viajan en la ficha, así que nadie más los va a traer.
    this.tarifariosCreados.set(this.recordados.deLaUnidad(unitId));
    this.client
      .getById(unitId)
      .pipe(catchError((error: unknown) => of({ error })))
      .subscribe((resultado) => {
        this.ficha.set(
          esFallo(resultado)
            ? errorToViewState<DiagnosticUnitAdminDetail>(resultado.error)
            : ready(resultado),
        );
      });
  }

  /**
   * El estado de una de las cinco listas.
   *
   * Todas salen de la misma respuesta y comparten carga y error: no tiene
   * sentido que una pestaña diga «cargando» mientras otra ya falló. Lo propio
   * de cada una es el vacío, que significa algo distinto en cada pestaña.
   */
  private listaDe<T>(
    seleccionar: (datos: DiagnosticUnitAdminDetail) => readonly T[],
    accion: ViewStateNextAction,
    mensaje: string,
  ): ViewState<readonly T[]> {
    const estado = this.ficha();
    if (!hasData(estado)) {
      return estado;
    }
    const filas = seleccionar(estado.data);
    if (filas.length === 0) {
      return empty(accion, mensaje);
    }
    return estado.status === 'stale' ? stale(filas, estado.asOf) : ready(filas);
  }
}

/** Una rama que se resolvió con fallo en vez de con datos. */
interface Fallo {
  readonly error: unknown;
}

function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}

/* ---- conversiones de formulario -------------------------------------------
   Los campos de texto y de número comparten tipo con el átomo que los dibuja
   (`string | number | null`), así que la conversión a lo que la API espera se
   hace una vez acá y no en cada envío.
   -------------------------------------------------------------------------- */

/** Lo escrito, sin espacios de sobra. */
function textoDe(valor: string | number | null): string {
  return valor === null ? '' : String(valor).trim();
}

/** Hay texto y entra en el largo que la API valida. */
function textoValido(valor: string | number | null, largoMaximo: number): boolean {
  const texto = textoDe(valor);
  return texto !== '' && texto.length <= largoMaximo;
}

/**
 * Qué decirle a la persona cuando la escritura falla.
 *
 * El mensaje del servidor manda cuando lo hay: es el que sabe **qué** falta
 * —una sucursal activa, un código repetido— y el nuestro sólo sabría que no se
 * pudo. Se ramifica por la forma del cuerpo y no por el código de estado, que
 * en esta API no siempre es el que uno esperaría para una precondición.
 */
function mensajeDeError(error: unknown, respaldo: string): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = readApiError(error);
    if (cuerpo !== null && cuerpo.message !== '') {
      return cuerpo.message;
    }
  }
  return respaldo;
}
