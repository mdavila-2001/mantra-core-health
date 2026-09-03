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
 * ## Es una lectura, y nada más
 *
 * El catálogo (`billing.service_catalog`) lo mantiene una cuenta administradora
 * desde `administration/services-catalog`. Acá no hay alta, ni edición de
 * precio, ni búsqueda: quien atiende viene a saber **qué ofrece su práctica y a
 * cuánto está la referencia** antes de cotizar. `GET /billing/service-catalog`
 * no exige rol justamente por eso.
 *
 * ## Lo que el esquema no tiene, la pantalla no promete
 *
 * `ServiceCatalogItem` son código, nombre, precio de referencia y si está
 * activo. No hay imagen, ni descripción, ni términos y condiciones: la tarjeta
 * muestra lo que existe en vez de dejar huecos que sugieran un dato que nadie
 * cargó.
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
  imports: [AppButton, Badge, Card, FormField, PageHeader, Select, Skeleton, ViewStateHost],
  templateUrl: './my-services.html',
  styleUrl: './my-services.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyServices {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly navigation = inject(NavigationService);

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

  /**
   * Qué lectura del catálogo es la vigente. Cada primera página abre una nueva
   * y jubila a la anterior con todo lo que tuviera en vuelo.
   */
  private generacionDeLectura = 0;

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

    // No abre lectura nueva: se apila sobre la vigente, y sólo sobre ésa.
    const generacion = this.generacionDeLectura;

    this.cargandoMas.set(true);
    this.catalog.search(practiceId, { limit: SERVICIOS_POR_PAGINA, cursor }).subscribe({
      next: (pagina) => {
        if (this.llegoTarde(generacion)) {
          return;
        }
        this.cargandoMas.set(false);
        this.apilar(pagina);
      },
      error: (error: unknown) => {
        if (this.llegoTarde(generacion)) {
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
    // Antes que nada, y también cuando no haya práctica: vaciar el selector
    // jubila igual lo que esté en vuelo.
    const generacion = ++this.generacionDeLectura;

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
        if (this.llegoTarde(generacion)) {
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
        if (this.llegoTarde(generacion)) {
          return;
        }
        this.cursorSiguiente.set(null);
        this.catalogo.set(errorToViewState<readonly ServiceCatalogItem[]>(error));
      },
    });
  }

  /**
   * Si la respuesta que llegó es de una lectura que ya quedó atrás.
   *
   * Dos lecturas en vuelo terminan en el orden que quiera la red, y comparar
   * por práctica no alcanzaba: volver a la misma —pr1, pr2, pr1— readmitía las
   * respuestas de la visita anterior, que pasaban la guarda porque la práctica
   * volvía a coincidir. Lo grave era una página apilada de aquella visita: al
   * volver ya no tiene sobre qué apilarse, y se sumaba a la lectura nueva
   * dejando la lista mezclada bajo un cursor que no le corresponde.
   */
  private llegoTarde(generacion: number): boolean {
    return this.generacionDeLectura !== generacion;
  }

  private apilar(pagina: ServiceCatalogPage): void {
    this.cursorSiguiente.set(pagina.nextCursor);
    const yaVisibles = dataOf(this.catalogo()) ?? [];
    this.catalogo.set(ready([...yaVisibles, ...pagina.items]));
  }
}
