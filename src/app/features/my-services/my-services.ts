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

import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ServiceCatalogItem,
  ServiceCatalogPage,
} from '../../core/data-access/services-catalog/services-catalog.types';
import { Input } from '../../shared/components/atoms/input/input';
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
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

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
 * responde 422 y cuyo mensaje se muestra tal cual.
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
@Component({
  selector: 'app-my-services',
  imports: [
    AppButton,
    Badge,
    Card,
    FormField,
    Input,
    PageHeader,
    Select,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './my-services.html',
  styleUrl: './my-services.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyServices {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly navigation = inject(NavigationService);
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

  /* ---- catálogo ------------------------------------------------------------*/

  private readonly catalogo = signal<ViewState<readonly ServiceCatalogItem[]>>(loading());
  private readonly cursorSiguiente = signal<string | null>(null);

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

  /** El importe con su unidad, cuando la API pudo resolverla. */
  protected precio(servicio: ServiceCatalogItem): string {
    return servicio.currencyCode === undefined
      ? servicio.defaultPrice
      : `${servicio.defaultPrice} ${servicio.currencyCode}`;
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
   * que manda es la del servidor**: si responde 422 se muestra su mensaje, y lo
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

    // Elegir otra práctica es otro catálogo: lo acumulado era de la anterior y
    // el cursor sólo sabe seguir aquella lista.
    effect(() => {
      this.practicaElegida();
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

    this.cargandoMas.set(true);
    this.catalog.search(practiceId, { limit: SERVICIOS_POR_PAGINA, cursor }).subscribe({
      next: (pagina) => {
        if (this.llegoTarde(practiceId)) {
          return;
        }
        this.cargandoMas.set(false);
        this.apilar(pagina);
      },
      error: (error: unknown) => {
        if (this.llegoTarde(practiceId)) {
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

    this.catalog.search(practiceId, { limit: SERVICIOS_POR_PAGINA }).subscribe({
      next: (pagina) => {
        if (this.llegoTarde(practiceId)) {
          return;
        }
        this.cursorSiguiente.set(pagina.nextCursor);
        this.catalogo.set(
          pagina.items.length > 0
            ? ready(pagina.items)
            : empty(SIN_SERVICIOS, 'Esta práctica todavía no tiene servicios en su catálogo.'),
        );
      },
      error: (error: unknown) => {
        if (this.llegoTarde(practiceId)) {
          return;
        }
        this.cursorSiguiente.set(null);
        this.catalogo.set(errorToViewState<readonly ServiceCatalogItem[]>(error));
      },
    });
  }

  /**
   * Si la respuesta que llegó es de una práctica que ya no es la elegida.
   *
   * Dos lecturas en vuelo terminan en el orden que quiera la red: sin esto, la
   * página lenta de la práctica anterior pisa a la que ya se está mirando y la
   * pantalla muestra servicios de otra práctica bajo su nombre.
   */
  private llegoTarde(practiceId: string): boolean {
    return this.practicaElegida() !== practiceId;
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
