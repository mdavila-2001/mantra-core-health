import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { SchedulingClient } from '../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  PublishedRule,
} from '../../core/data-access/scheduling/scheduling.types';
import { AuthService } from '../../core/auth/auth.service';
import { ScheduleGrid } from '../agenda/my-agenda/schedule-grid/schedule-grid';
import type { BloqueoDelMes } from '../agenda/my-agenda/month-view/month-view';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
import type {
  Practice,
  ServiceCatalogItem,
  ServiceCatalogPage,
  ServiceCatalogQuery,
} from '../../core/data-access/services-catalog/services-catalog.types';
import { Input } from '../../shared/components/atoms/input/input';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { readApiError } from '../../core/http/api-error';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf, empty, loading, mapData, ready } from '../../core/view-state/view-state';
import type {
  ViewState,
  ViewStateNextAction,
} from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { ServiceIcon } from '../../shared/components/atoms/service-icon/service-icon';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import {
  FilterBar,
  type FilterDef,
} from '../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { withDisplayCurrency } from '../../core/money/display-currency';

/**
 * Servicios por página. La grilla se arma en una, dos o tres columnas según el
 * ancho, y veinticuatro completa la última fila en las tres.
 */
const SERVICIOS_POR_PAGINA = 24;

/** Tarjetas que simula el esqueleto: una pantalla, no la página entera. */
const TARJETAS_DEL_ESQUELETO = 6;

/**
 * Un importe positivo con hasta dos decimales.
 *
 * Es el mismo patrón que valida el servidor. Se repite acá para avisar mientras
 * se escribe, **no** para decidir: la autoridad sigue siendo la API, que
 * responde 400 con `VALIDATION_FAILED` y cuyo mensaje se muestra tal cual.
 */
const IMPORTE = /^\d+(\.\d{1,2})?$/;

/**
 * Qué se ofrece cuando la práctica no tiene servicios.
 *
 * **No es un alta.** `POST /billing/service-catalog` exige `SECURITY_ADMIN` y
 * esta pantalla es de quien atiende: un botón que la API va a rechazar es peor
 * que ningún botón. Tampoco lleva `route` al catálogo de administración, que
 * declara ese mismo rol y rebotaría en el guard.
 */
const SIN_SERVICIOS: ViewStateNextAction = {
  label: 'El alta la hace una cuenta administradora desde el catálogo de servicios.',
};

/** Qué se ofrece cuando no hay ninguna práctica de la que colgar el catálogo. */
const SIN_PRACTICAS: ViewStateNextAction = {
  label: 'Pedile a tu organización que te asocie a una práctica.',
};

/** Hay prácticas, pero ninguna elegida: sin `practiceId` no hay qué pedir. */
const SIN_PRACTICA_ELEGIDA = empty(
  { label: 'Elegir una práctica' },
  'Elegí una práctica para ver su catálogo de servicios.',
);

/**
 * Los servicios de la práctica, vistos por quien atiende — `my-services`.
 *
 * ## Se lee, y el precio se edita
 *
 * El alta la sigue haciendo una cuenta administradora desde
 * `administration/services-catalog`: la lista de qué se ofrece queda fija. Lo
 * que es de quien atiende es **a cuánto lo ofrece**, y por eso el precio se
 * corrige acá con `PATCH /billing/service-catalog/:id` (FT-22-R05). El servidor
 * comprueba la vinculación con la práctica; un servicio ajeno responde 404.
 *
 * ## Lo que el esquema no tiene, la pantalla no promete
 *
 * `ServiceCatalogItem` son código, nombre, precio con su moneda y si está
 * activo. No hay imagen, ni descripción, ni términos y condiciones: la tarjeta
 * muestra lo que existe en vez de dejar huecos que sugieran un dato que nadie
 * cargó. Las tres cosas están pedidas y ninguna tiene columna todavía.
 *
 * ## Un precio en cero no es gratis
 *
 * Toda práctica nace con «Cita médica» en `0.00` porque nadie declaró un
 * arancel. La tarjeta dice **«Definí el precio»** en vez de mostrar un cero que
 * un paciente leería como que la consulta no se cobra.
 *
 * ## Todo cuelga de la práctica elegida
 *
 * Igual que el catálogo de administración y el mayor contable: ninguna lectura
 * responde sin `practiceId`, así que lo primero que se pide es `GET /practices`.
 * Con una sola práctica el selector no aparece — elegir entre una opción no es
 * elegir.
 *
 * ## El listado se apila, no se pagina
 *
 * Es una lista de consulta que se recorre de arriba abajo, no una tabla que se
 * audita página por página: cada «Cargar más» agrega al final, y el cursor de
 * la API —opaco— se reenvía tal cual. Cambiar de práctica descarta lo
 * acumulado, porque ese cursor sólo sabe seguir la lista de la que salió.
 */
/**
 * El texto con que se etiqueta el bloqueo que deja un servicio propio — C-12.
 *
 * ## Por qué `OTHER` y no un tipo propio
 *
 * «OTROS SERVICIOS» **no existe** en la lista cerrada de motivos de
 * `GET /scheduling/exception-types`: son siete —`ABSENCE`, `HOLIDAY`,
 * `VACATION`, `CONFERENCE`, `ERRAND`, `EXTRA`, `OTHER`— y ninguno es éste.
 * Ampliar el enum es una decisión de negocio (ambigüedad `Q-D6` del reparto),
 * no una decisión de esta pantalla, así que se usa la salida que el propio
 * contrato documenta: `OTHER` es el único que **exige texto**
 * (`requiresText: true`), y el texto es exactamente para esto.
 *
 * El día que negocio decida el tipo propio, lo que cambia es una constante.
 */
const MOTIVO_DE_OTROS_SERVICIOS = 'Otros servicios';

/** Los siete días, como los numera `PublishedRule.dayOfWeek` (0 = domingo). */
const DIAS_DE_LA_SEMANA: readonly SegmentedOption<string>[] = [
  { value: '1', label: 'Lun' },
  { value: '2', label: 'Mar' },
  { value: '3', label: 'Mié' },
  { value: '4', label: 'Jue' },
  { value: '5', label: 'Vie' },
  { value: '6', label: 'Sáb' },
  { value: '0', label: 'Dom' },
];

@Component({
  selector: 'app-my-services',
  imports: [
    AppButton,
    Badge,
    Alert,
    ContentDialog,
    ScheduleGrid,
    SegmentedControl,
    FilterBar,
    FormField,
    Input,
    PageHeader,
    Select,
    ServiceIcon,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './my-services.html',
  // Las hojas compartidas van **primero**: Angular concatena los estilos en
  // este orden, y lo de abajo son los ajustes de esta pantalla sobre esa base.
  // Al revés, `.rejilla` pisaría a `.mis-servicios__rejilla` —misma
  // especificidad, gana la última— y el ancho de columna de acá no se aplicaría.
  styleUrls: [
    '../../shared/styles/rejilla-de-tarjetas.css',
    '../../shared/styles/tarjeta-de-servicio.css',
    './my-services.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyServices {
  /* -- Programar el horario de un servicio propio (C-12) -------------------- */

  /** El servicio cuyo horario se está programando, o `null`. */
  protected readonly programando = signal<ServiceCatalogItem | null>(null);

  /** La agenda del profesional: es sobre ella que se bloquea el rato. */
  private readonly recursoPropio = signal<AgendaResource | null>(null);

  /** El horario publicado, para dibujar la MISMA grilla que «Mis horarios». */
  protected readonly reglasDelHorario = signal<readonly PublishedRule[]>([]);

  /** Lo ya bloqueado de la semana, para que la grilla lo pinte igual que allá. */
  protected readonly bloqueosDeLaSemana = signal<readonly BloqueoDelMes[]>([]);

  protected readonly diasDeLaSemana = DIAS_DE_LA_SEMANA;
  protected readonly diaElegido = signal('1');
  protected readonly desdeElegido = signal('14:00');
  protected readonly hastaElegido = signal('16:00');
  protected readonly guardandoHorario = signal(false);
  protected readonly errorDelHorario = signal<string | null>(null);

  /** Sin agenda propia no hay dónde bloquear: se dice, no se ofrece a medias. */
  protected readonly sinAgendaPropia = computed(() => this.recursoPropio() === null);

  /**
   * Abre la programación del horario de un servicio.
   *
   * **Recicla las vistas del horario, no crea unas nuevas** (C-12 lo pide con
   * esas palabras): el modal monta `app-schedule-grid` —el mismo organismo que
   * dibuja «Mis horarios de atención»— con las reglas publicadas y los bloqueos
   * ya creados, para que el rato del servicio se elija mirando el horario real
   * y no una grilla inventada al lado.
   */
  protected programarHorario(servicio: ServiceCatalogItem): void {
    this.errorDelHorario.set(null);
    this.programando.set(servicio);
    this.leerAgendaDelProfesional();
  }

  /**
   * Las horas del rango, desde el campo de texto.
   *
   * `app-input` emite `string | number | null` —sirve también para campos
   * numéricos—, y acá siempre es texto: se normaliza en un solo lugar en vez de
   * castear en la plantilla, donde el error no se ve.
   */
  protected fijarDesde(valor: string | number | null): void {
    this.desdeElegido.set(valor === null ? '' : String(valor));
  }

  protected fijarHasta(valor: string | number | null): void {
    this.hastaElegido.set(valor === null ? '' : String(valor));
  }

  protected cerrarProgramacion(): void {
    this.programando.set(null);
  }

  /**
   * Guarda el rato del servicio como una **excepción de disponibilidad** sobre
   * la agenda del profesional.
   *
   * Es lo que produce el bloqueo que el pedido exige: el mismo mecanismo con
   * que se bloquea un día, aplicado a un rato. No es una agenda propia del
   * servicio —eso sería un segundo calendario que nadie cruza con el clínico—,
   * y el supuesto está declarado como `Q-P5`.
   */
  protected guardarHorarioDelServicio(): void {
    const servicio = this.programando();
    const recurso = this.recursoPropio();
    if (servicio === null || recurso === null || this.guardandoHorario()) return;

    const rango = this.rangoElegido();
    if (rango === null) {
      this.errorDelHorario.set('El horario tiene que empezar antes de terminar.');
      return;
    }

    this.guardandoHorario.set(true);
    this.errorDelHorario.set(null);
    this.scheduling
      .createException(recurso.id, {
        exceptionType: 'OTHER',
        startAt: rango.desde.toISOString(),
        endAt: rango.hasta.toISOString(),
        reason: `${MOTIVO_DE_OTROS_SERVICIOS} · ${servicio.name}`,
      })
      .subscribe({
        next: (creada) => {
          this.guardandoHorario.set(false);
          this.programando.set(null);
          this.toasts.success(
            creada.blockedSlots === 0
              ? `Ese rato queda bloqueado en tu agenda como «${MOTIVO_DE_OTROS_SERVICIOS}».`
              : `Ese rato queda bloqueado como «${MOTIVO_DE_OTROS_SERVICIOS}» y dejaron de ofrecerse ${creada.blockedSlots} turnos.`,
            servicio.name,
          );
        },
        error: (error: unknown) => {
          this.guardandoHorario.set(false);
          this.errorDelHorario.set(
            (error instanceof HttpErrorResponse ? readApiError(error)?.message : null) ??
              'No se pudo bloquear ese rato. Probá de nuevo.',
          );
        },
      });
  }

  /** El rato elegido, sobre la próxima fecha de ese día de la semana. */
  private rangoElegido(): { desde: Date; hasta: Date } | null {
    const dia = Number(this.diaElegido());
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    // El próximo día de la semana elegido, hoy incluido: programar «los martes»
    // desde un martes tiene que empezar hoy, no dentro de siete días.
    base.setDate(base.getDate() + ((dia - base.getDay() + 7) % 7));

    const desde = this.conHora(base, this.desdeElegido());
    const hasta = this.conHora(base, this.hastaElegido());
    if (desde === null || hasta === null || desde.getTime() >= hasta.getTime()) return null;
    return { desde, hasta };
  }

  private conHora(dia: Date, hhmm: string): Date | null {
    const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
    if (match === null) return null;
    const fecha = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
    fecha.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return fecha;
  }

  /** La agenda del profesional y su horario, para la grilla reciclada. */
  private leerAgendaDelProfesional(): void {
    const tenantId = this.auth.activeTenantId();
    const perfil = this.auth.practitionerProfileId();
    if (tenantId === null || perfil === null) {
      this.recursoPropio.set(null);
      return;
    }
    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        const propio = pagina.items.find((r) => r.resourceRefId === perfil) ?? null;
        this.recursoPropio.set(propio);
        if (propio === null) return;
        this.scheduling.listTemplates(propio.id).subscribe({
          next: (plantillas) =>
            this.reglasDelHorario.set(
              plantillas.items.find((t) => !t.retired)?.rules ?? [],
            ),
          error: () => this.reglasDelHorario.set([]),
        });
        const lunes = new Date();
        lunes.setHours(0, 0, 0, 0);
        lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
        const siguiente = new Date(lunes);
        siguiente.setDate(siguiente.getDate() + 7);
        this.scheduling.listExceptions(propio.id, { from: lunes, to: siguiente }).subscribe({
          next: (pagina2) =>
            this.bloqueosDeLaSemana.set(
              pagina2.items
                .filter((e) => e.isAvailable !== true)
                .map((e) => ({
                  id: e.id,
                  desde: new Date(e.startAt),
                  hasta: new Date(e.endAt),
                  motivo: e.reason ?? null,
                })),
            ),
          error: () => this.bloqueosDeLaSemana.set([]),
        });
      },
      error: () => this.recursoPropio.set(null),
    });
  }

  private readonly catalog = inject(ServicesCatalogClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** Huecos del esqueleto. Se calcula una vez: no depende de ningún dato. */
  protected readonly huecosDelEsqueleto = Array.from(
    { length: TARJETAS_DEL_ESQUELETO },
    (_, indice) => indice,
  );

  /* ---- práctica ----------------------------------------------------------- */

  private readonly practicas = signal<ViewState<readonly Practice[]>>(loading());

  private readonly listaDePracticas = computed<readonly Practice[] | undefined>(() => {
    const estado = this.practicas();
    return estado.status === 'ready' ? estado.data : undefined;
  });

  protected readonly opcionesDePractica = computed<readonly SelectOption<string>[]>(() =>
    (this.listaDePracticas() ?? []).map((practica) => ({
      value: practica.id,
      label: practica.name,
    })),
  );

  /**
   * `linkedSignal`: al llegar el listado se preselecciona la primera práctica
   * sin pisar la elección de quien ya tocó el selector.
   */
  protected readonly practicaElegida = linkedSignal<readonly Practice[] | undefined, string | null>({
    source: this.listaDePracticas,
    computation: (lista, previo) => previo?.value ?? lista?.[0]?.id ?? null,
  });

  /** Con una sola práctica no hay nada que elegir, y el selector sobra. */
  protected readonly hayQueElegirPractica = computed(() => this.opcionesDePractica().length > 1);

  /* ---- buscador y filtros --------------------------------------------------

     El catálogo de una práctica grande son cientos de servicios apilados de a
     veinticuatro: sin buscador, encontrar «Holter» es apretar «Cargar más»
     hasta que aparezca. Los dos criterios los resuelve **el servidor** —`q` e
     `isActive` ya existen en `GET /billing/service-catalog`—, así que filtrar
     no es esconder tarjetas ya traídas: es pedir otra lista, y el conteo y el
     «Cargar más» siguen diciendo la verdad.

     El estado vive en la URL, que es la disciplina de `app-filter-bar` en
     todos los listados: recargar o compartir el enlace reproduce lo mismo. Se
     lee de `queryParams` y no del `filtersChanged` de la barra porque ésta
     sólo avisa cuando ella misma cambia algo, y así un enlace que ya trae
     `?q=` entra filtrado. */

  private readonly criterios = toSignal(
    this.route.queryParams.pipe(map((params) => params as Record<string, string>)),
    { initialValue: {} as Record<string, string> },
  );

  protected readonly filtros: readonly FilterDef[] = [
    {
      key: 'estado',
      label: 'Estado',
      options: [
        { value: 'activos', label: 'Activos' },
        { value: 'inactivos', label: 'Inactivos' },
      ],
    },
  ];

  /** El texto buscado. Vacío es «sin filtro», no «buscar nada». */
  private readonly texto = computed(() => this.criterios()['q'] ?? '');

  /** `undefined` = los dos estados, que es lo que pide la pantalla sin filtro. */
  private readonly soloActivos = computed<boolean | undefined>(() => {
    const estado = this.criterios()['estado'] ?? '';
    if (estado === 'activos') return true;
    if (estado === 'inactivos') return false;
    return undefined;
  });

  /** Si hay algo puesto: lo vacío del filtro no es lo vacío del catálogo. */
  protected readonly hayCriterios = computed(
    () => this.texto() !== '' || this.soloActivos() !== undefined,
  );

  /* ---- catálogo ------------------------------------------------------------*/

  private readonly catalogo = signal<ViewState<readonly ServiceCatalogItem[]>>(loading());
  private readonly cursorSiguiente = signal<string | null>(null);

  /**
   * Qué lectura es la que vale. No es reactivo: es un sello.
   *
   * Con el buscador, dos lecturas de la **misma** práctica pueden estar en
   * vuelo a la vez —«hol» y «holter»— y terminan en el orden que quiera la
   * red. Comparar sólo la práctica ya no alcanza: sin este sello, la respuesta
   * de «hol» pisa a la de «holter» y la pantalla muestra resultados que no
   * corresponden a lo que quedó escrito.
   */
  private lectura = 0;

  protected readonly cargandoMas = signal(false);

  /**
   * El estado de la pantalla entera.
   *
   * Las prácticas mandan mientras no estén resueltas: sin ellas no hay catálogo
   * que pedir, así que su carga, su 403 y su fallo **son** los de la pantalla —
   * mostrarlos como «catálogo vacío» sería inventar un dato que nadie leyó.
   */
  protected readonly estado = computed<ViewState<readonly ServiceCatalogItem[]>>(() => {
    const practicas = this.practicas();
    if (practicas.status !== 'ready') {
      return mapData<readonly Practice[], readonly ServiceCatalogItem[]>(practicas, () => []);
    }

    if (practicas.data.length === 0) {
      return empty(
        SIN_PRACTICAS,
        'Tu organización todavía no tiene prácticas, así que no hay catálogo de servicios que mostrar.',
      );
    }

    return this.catalogo();
  });

  protected readonly servicios = computed<readonly ServiceCatalogItem[]>(
    () => dataOf(this.estado()) ?? [],
  );

  /** Hay otra página, y algo a lo que apilarla. */
  protected readonly hayMas = computed(
    () => this.cursorSiguiente() !== null && this.estado().status === 'ready',
  );

  /* ---- edición del precio (FT-22-R05) --------------------------------------*/

  /**
   * Qué servicio está en edición, y qué se guarda.
   *
   * Por id y no un booleano por tarjeta: se edita **uno** por vez. Abrir el
   * segundo cierra el primero sin guardarlo, que es lo que espera cualquiera
   * que haya dejado un campo abierto y se haya ido a otro.
   */
  protected readonly enEdicion = signal<string | null>(null);
  protected readonly borrador = signal('');
  protected readonly guardando = signal<string | null>(null);
  protected readonly errorDelPrecio = signal<string | null>(null);

  /** Un precio en cero es «sin definir»: la tarjeta lo dice con palabras. */
  protected sinPrecio(servicio: ServiceCatalogItem): boolean {
    return Number(servicio.defaultPrice) === 0;
  }

  /** El importe con la moneda visible («Bs»): ver `display-currency.ts`. */
  protected precio(servicio: ServiceCatalogItem): string {
    return withDisplayCurrency(servicio.defaultPrice, servicio.currencyCode);
  }

  protected editar(servicio: ServiceCatalogItem): void {
    this.enEdicion.set(servicio.id);
    // El cero no se siembra: quien nunca puso precio empieza con el campo
    // vacío, no borrando un valor que no eligió.
    this.borrador.set(this.sinPrecio(servicio) ? '' : servicio.defaultPrice);
    this.errorDelPrecio.set(null);
  }

  protected cancelar(): void {
    this.enEdicion.set(null);
    this.borrador.set('');
    this.errorDelPrecio.set(null);
  }

  protected escribirPrecio(valor: string | number | null): void {
    this.borrador.set(valor === null ? '' : String(valor));
    if (this.errorDelPrecio() !== null) {
      this.errorDelPrecio.set(null);
    }
  }

  /**
   * Guarda el precio de una tarjeta.
   *
   * El aviso de formato se da acá para no gastar un viaje, pero **la validación
   * que manda es la del servidor**: si lo rechaza se muestra su mensaje, y lo
   * escrito se conserva para poder corregirlo (AC-22-6).
   */
  protected guardarPrecio(servicio: ServiceCatalogItem): void {
    if (this.guardando() !== null) return;

    const escrito = this.borrador().trim();
    if (!IMPORTE.test(escrito)) {
      this.errorDelPrecio.set('Escribí un importe positivo con hasta dos decimales.');
      return;
    }

    this.guardando.set(servicio.id);
    this.errorDelPrecio.set(null);
    this.catalog.update(servicio.id, { defaultPrice: escrito }).subscribe({
      next: (actualizado) => {
        this.guardando.set(null);
        this.enEdicion.set(null);
        this.borrador.set('');
        // Se muestra lo que devolvió la API y no lo que se escribió: es la
        // única forma de que la tarjeta diga lo que quedó guardado —con su
        // moneda, que el servidor puede haber fijado en esta misma edición—.
        this.reemplazar(actualizado);
        this.toasts.success('Guardamos el precio.', servicio.name);
      },
      error: (error: unknown) => {
        this.guardando.set(null);
        this.errorDelPrecio.set(mensajeDelServidor(error));
      },
    });
  }

  /** Cambia una tarjeta de la lista sin recargar la página entera. */
  private reemplazar(servicio: ServiceCatalogItem): void {
    const visibles = dataOf(this.catalogo());
    if (visibles === null) return;
    this.catalogo.set(
      ready(visibles.map((actual) => (actual.id === servicio.id ? servicio : actual))),
    );
  }

  constructor() {
    this.cargarPracticas();

    // Elegir otra práctica, escribir en el buscador o tocar el filtro son, los
    // tres, otra lista: se vuelve a la primera página y lo acumulado se
    // descarta, porque el cursor sólo sabe seguir la lista de la que salió.
    effect(() => {
      this.practicaElegida();
      this.texto();
      this.soloActivos();
      untracked(() => this.cargarPrimeraPagina());
    });
  }

  protected cambiarPractica(practiceId: string | null): void {
    this.practicaElegida.set(practiceId);
  }

  /** S8 y S9: reintentar por donde falló, que puede ser la lista de prácticas. */
  protected recargar(): void {
    if (this.practicas().status === 'ready') {
      this.cargarPrimeraPagina();
      return;
    }
    this.cargarPracticas();
  }

  protected cargarMas(): void {
    const practiceId = this.practicaElegida();
    const cursor = this.cursorSiguiente();
    if (practiceId === null || cursor === null || this.cargandoMas()) {
      return;
    }

    const lectura = this.lectura;
    this.cargandoMas.set(true);
    this.catalog.search(practiceId, { ...this.consulta(), cursor }).subscribe({
      next: (pagina) => {
        if (this.llegoTarde(practiceId, lectura)) {
          return;
        }
        this.cargandoMas.set(false);
        this.apilar(pagina);
      },
      error: (error: unknown) => {
        if (this.llegoTarde(practiceId, lectura)) {
          return;
        }
        this.cargandoMas.set(false);
        // Lo acumulado se descarta a propósito: el reintento vuelve a la
        // primera página, y mezclar dos lecturas con cursores de momentos
        // distintos mostraría una lista que la API nunca devolvió.
        this.cursorSiguiente.set(null);
        this.catalogo.set(errorToViewState<readonly ServiceCatalogItem[]>(error));
      },
    });
  }

  private cargarPracticas(): void {
    this.practicas.set(loading());
    this.catalog.listPractices().subscribe({
      next: (practicas) => this.practicas.set(ready(practicas)),
      error: (error: unknown) => this.practicas.set(errorToViewState<readonly Practice[]>(error)),
    });
  }

  private cargarPrimeraPagina(): void {
    const lectura = ++this.lectura;
    this.cursorSiguiente.set(null);
    // Una página en vuelo de la práctica anterior ya no cuenta: su respuesta se
    // descarta, y el botón no puede quedarse cargando por ella.
    this.cargandoMas.set(false);

    const practiceId = this.practicaElegida();
    if (practiceId === null) {
      // Mientras las prácticas viajan, `estado()` proyecta esa lectura y esto no
      // se ve. Se pone igual porque si alguien vacía el selector con la lista ya
      // resuelta, un esqueleto eterno sería el único cartel de la pantalla.
      this.catalogo.set(SIN_PRACTICA_ELEGIDA);
      return;
    }

    this.catalogo.set(loading());

    this.catalog.search(practiceId, this.consulta()).subscribe({
      next: (pagina) => {
        if (this.llegoTarde(practiceId, lectura)) {
          return;
        }
        this.cursorSiguiente.set(pagina.nextCursor);
        this.catalogo.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : this.vacio(),
        );
      },
      error: (error: unknown) => {
        if (this.llegoTarde(practiceId, lectura)) {
          return;
        }
        this.cursorSiguiente.set(null);
        this.catalogo.set(errorToViewState<readonly ServiceCatalogItem[]>(error));
      },
    });
  }

  /** Los parámetros de la lectura: el tope de página más lo que se filtró. */
  private consulta(): ServiceCatalogQuery {
    const texto = this.texto();
    const activos = this.soloActivos();
    return {
      limit: SERVICIOS_POR_PAGINA,
      ...(texto === '' ? {} : { query: texto }),
      ...(activos === undefined ? {} : { isActive: activos }),
    };
  }

  /**
   * Qué decir cuando no vino nada.
   *
   * Con un filtro puesto, «esta práctica todavía no tiene servicios» es falso
   * —los tiene, ninguno coincide— y manda a pedirle un alta a una cuenta
   * administradora que no hace falta.
   */
  private vacio(): ViewState<readonly ServiceCatalogItem[]> {
    return this.hayCriterios()
      ? empty(
          { label: 'Probá con otra palabra o quitá el filtro.' },
          'Ningún servicio de esta práctica coincide con lo que buscaste.',
        )
      : empty(SIN_SERVICIOS, 'Esta práctica todavía no tiene servicios en su catálogo.');
  }

  /**
   * Si la respuesta que llegó es de una práctica que ya no es la elegida.
   *
   * Dos lecturas en vuelo terminan en el orden que quiera la red: sin esto, la
   * página lenta de la práctica anterior pisa a la que ya se está mirando y la
   * pantalla muestra servicios de otra práctica bajo su nombre.
   */
  private llegoTarde(practiceId: string, lectura: number): boolean {
    return this.practicaElegida() !== practiceId || this.lectura !== lectura;
  }

  private apilar(pagina: ServiceCatalogPage): void {
    this.cursorSiguiente.set(pagina.nextCursor);
    const yaVisibles = dataOf(this.catalogo()) ?? [];
    this.catalogo.set(ready([...yaVisibles, ...pagina.items]));
  }
}

/**
 * Qué decir cuando el guardado falla.
 *
 * El mensaje del servidor manda cuando lo hay: es el que sabe **qué** rechazó
 * —el formato del importe, un servicio que no es de esta práctica— y el nuestro
 * sólo sabría que no se pudo.
 */
function mensajeDelServidor(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo = readApiError(error);
    if (cuerpo !== null && cuerpo.message !== '') {
      return cuerpo.message;
    }
  }
  return 'No pudimos guardar el precio. Probá de nuevo.';
}
