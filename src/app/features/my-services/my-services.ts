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
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import { SchedulingClient } from '../../core/data-access/scheduling/scheduling.client';
import type {
  ModalidadDeAtencion,
  ServiceOffering,
} from '../../core/data-access/scheduling/scheduling.types';
import { AuthService } from '../../core/auth/auth.service';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
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
import { Switch } from '../../shared/components/atoms/switch/switch';
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
  label: 'Pedile a su organización que le asocie a una práctica.',
};

/** Hay prácticas, pero ninguna elegida: sin `practiceId` no hay qué pedir. */
const SIN_PRACTICA_ELEGIDA = empty(
  { label: 'Elegir una práctica' },
  'Elija una práctica para ver su catálogo de servicios.',
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
 * Lo que se acepta al declarar cuánto dura un servicio. Los mismos topes del
 * contrato (`MAX_SERVICE_DURATION_MINUTES` y `MAX_SERVICE_BUFFER_MINUTES` de la
 * API): se repiten acá para avisar mientras se escribe, **no** para decidir — la
 * autoridad es el servidor.
 */
const MAX_DURACION_MINUTOS = 720;
const MAX_COLCHON_MINUTOS = 240;

/** Cómo se atiende un servicio. «Sin declarar» no viaja: ausente ≡ lo de siempre. */
const MODALIDADES: readonly SelectOption<string>[] = [
  { value: '', label: 'Sin declarar' },
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'TELECONSULTA', label: 'Teleconsulta' },
  { value: 'DOMICILIO', label: 'A domicilio' },
];

/** Un entero no negativo escrito en un campo, o `null` si no lo es. */
function entero(texto: string): number | null {
  const limpio = texto.trim();
  return /^\d+$/.test(limpio) ? Number(limpio) : null;
}

@Component({
  selector: 'app-my-services',
  imports: [
    AppButton,
    Badge,
    Alert,
    ContentDialog,
    FilterBar,
    FormField,
    Input,
    PageHeader,
    Select,
    ServiceIcon,
    Switch,
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
  /* -- Cómo ofrezco cada servicio (v4.2.40) --------------------------------

     El catálogo es POR PRÁCTICA y fija nombre y precio; lo que cada profesional
     declara es cuánto tarda **él**. Eso reemplaza al «Programar horario» (C-12),
     que sólo bloqueaba la agenda con el motivo «Otros servicios»: un servicio
     que el paciente no puede reservar no se ofrece, se esconde. Ahora el médico
     dice mínimo y máximo, y el horario donde se atiende lo marca cada franja de
     «Mis horarios» (consultas, servicios o ambos). */

  /** Las ofertas del profesional, por servicio del catálogo. */
  private readonly ofertas = signal<ReadonlyMap<string, ServiceOffering>>(new Map());

  /** El servicio cuya oferta se está declarando, o `null`. */
  protected readonly ofreciendo = signal<ServiceCatalogItem | null>(null);

  protected readonly minimo = signal('');
  protected readonly maximo = signal('');
  protected readonly preparacion = signal('');
  protected readonly limpieza = signal('');
  protected readonly reservable = signal(true);
  protected readonly requiereAprobacion = signal(false);
  protected readonly modalidad = signal('');
  protected readonly guardandoOferta = signal(false);
  protected readonly errorDeLaOferta = signal<string | null>(null);

  protected readonly modalidades = MODALIDADES;

  /** La oferta declarada de un servicio, si la hay. */
  protected ofertaDe(servicio: ServiceCatalogItem): ServiceOffering | undefined {
    return this.ofertas().get(servicio.id);
  }

  /** «30–45 min», o «20 min» cuando el mínimo y el máximo coinciden. */
  protected duracionDe(oferta: ServiceOffering): string {
    return oferta.minDurationMinutes === oferta.maxDurationMinutes
      ? `${oferta.maxDurationMinutes} min`
      : `${oferta.minDurationMinutes}–${oferta.maxDurationMinutes} min`;
  }

  /** Abre el diálogo con lo ya declarado, o en blanco si todavía no. */
  protected abrirOferta(servicio: ServiceCatalogItem): void {
    const oferta = this.ofertaDe(servicio);
    this.errorDeLaOferta.set(null);
    this.minimo.set(oferta === undefined ? '' : String(oferta.minDurationMinutes));
    this.maximo.set(oferta === undefined ? '' : String(oferta.maxDurationMinutes));
    this.preparacion.set(oferta === undefined || oferta.prepMinutes === 0 ? '' : String(oferta.prepMinutes));
    this.limpieza.set(oferta === undefined || oferta.cleanupMinutes === 0 ? '' : String(oferta.cleanupMinutes));
    this.reservable.set(oferta?.isPatientBookable ?? true);
    this.requiereAprobacion.set(oferta?.requiresApproval ?? false);
    this.modalidad.set(oferta?.channel ?? '');
    this.ofreciendo.set(servicio);
  }

  protected cerrarOferta(): void {
    this.ofreciendo.set(null);
  }

  /** `app-input` emite `string | number | null`; acá siempre es texto. */
  protected escribir(campo: WritableSignal<string>, valor: string | number | null): void {
    campo.set(valor === null ? '' : String(valor));
  }

  protected fijarModalidad(valor: string | null): void {
    this.modalidad.set(valor ?? '');
  }

  /**
   * Guarda cómo se ofrece el servicio: crea la oferta o edita la que ya había.
   *
   * La validación de acá avisa mientras se escribe; **decide el servidor**, y su
   * mensaje se muestra tal cual cuando rechaza.
   */
  protected guardarOferta(): void {
    const servicio = this.ofreciendo();
    if (servicio === null || this.guardandoOferta()) return;

    const min = entero(this.minimo());
    const max = entero(this.maximo());
    if (min === null || max === null || min < 1 || max < 1) {
      this.errorDeLaOferta.set('Escriba cuántos minutos dura como mínimo y como máximo.');
      return;
    }
    if (min > max) {
      this.errorDeLaOferta.set('El mínimo no puede ser mayor que el máximo.');
      return;
    }
    if (max > MAX_DURACION_MINUTOS) {
      this.errorDeLaOferta.set(`Un servicio no puede reservar más de ${MAX_DURACION_MINUTOS} minutos.`);
      return;
    }
    const prep = this.preparacion().trim() === '' ? 0 : entero(this.preparacion());
    const limpieza = this.limpieza().trim() === '' ? 0 : entero(this.limpieza());
    if (prep === null || limpieza === null || prep > MAX_COLCHON_MINUTOS || limpieza > MAX_COLCHON_MINUTOS) {
      this.errorDeLaOferta.set(`La preparación y la limpieza van de 0 a ${MAX_COLCHON_MINUTOS} minutos.`);
      return;
    }

    const canal = this.modalidad() === '' ? undefined : (this.modalidad() as ModalidadDeAtencion);
    const existente = this.ofertaDe(servicio);
    this.guardandoOferta.set(true);
    this.errorDeLaOferta.set(null);

    const peticion =
      existente === undefined
        ? this.scheduling.createServiceOffering({
            serviceCatalogId: servicio.id,
            minDurationMinutes: min,
            maxDurationMinutes: max,
            prepMinutes: prep,
            cleanupMinutes: limpieza,
            isPatientBookable: this.reservable(),
            requiresApproval: this.requiereAprobacion(),
            ...(canal === undefined ? {} : { channel: canal }),
          })
        : this.scheduling.updateServiceOffering(existente.id, {
            minDurationMinutes: min,
            maxDurationMinutes: max,
            prepMinutes: prep,
            cleanupMinutes: limpieza,
            isPatientBookable: this.reservable(),
            requiresApproval: this.requiereAprobacion(),
            ...(canal === undefined ? {} : { channel: canal }),
          });

    peticion.subscribe({
      next: (guardada) => {
        this.guardandoOferta.set(false);
        this.ofreciendo.set(null);
        this.ofertas.update((actuales) => new Map(actuales).set(servicio.id, guardada));
        this.toasts.success(
          this.reservable()
            ? `Los pacientes ya pueden pedirlo: dura ${this.duracionDe(guardada)}.`
            : 'Quedó guardado, pero los pacientes todavía no pueden pedirlo.',
          servicio.name,
        );
      },
      error: (error: unknown) => {
        this.guardandoOferta.set(false);
        this.errorDeLaOferta.set(
          (error instanceof HttpErrorResponse ? readApiError(error)?.message : null) ??
            'No se pudo guardar. Pruebe de nuevo.',
        );
      },
    });
  }

  /** Las ofertas del profesional que mira, para decir en cada tarjeta cuánto dura. */
  private leerOfertas(): void {
    if (this.auth.practitionerProfileId() === null) return;
    this.scheduling.listServiceOfferings().subscribe({
      next: (lista) => this.ofertas.set(new Map(lista.map((oferta) => [oferta.serviceCatalogId, oferta]))),
      // Sin ofertas la pantalla sigue siendo el catálogo: no es motivo para romperla.
      error: () => this.ofertas.set(new Map()),
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
        'Su organización todavía no tiene prácticas, así que no hay catálogo de servicios que mostrar.',
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
      this.errorDelPrecio.set('Escriba un importe positivo con hasta dos decimales.');
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
    this.leerOfertas();

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
          { label: 'Pruebe con otra palabra o quite el filtro.' },
          'Ningún servicio de esta práctica coincide con lo que buscó.',
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
  return 'No pudimos guardar el precio. Pruebe de nuevo.';
}
