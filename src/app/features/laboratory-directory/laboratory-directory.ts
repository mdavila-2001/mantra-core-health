import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink, type Params } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap, tap } from 'rxjs';

import { DiagnosticUnitsClient } from '../../core/data-access/diagnostic-units/diagnostic-units.client';
import type {
  DiagnosticUnitSearchItem,
  DiagnosticUnitSearchQuery,
} from '../../core/data-access/diagnostic-units/diagnostic-units.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import type { SearchResultItem } from '../../shared/components/molecules/search-result/search-result.types';
import { DirectoryPage } from '../../shared/components/organisms/directory-page/directory-page';
import type {
  GrupoDeDirectorio,
  SustantivoDelDirectorio,
} from '../../shared/components/organisms/directory-page/directory-page.types';
import { SEARCH_PARAM, type FilterDef } from '../../shared/components/organisms/filter-bar/filter-bar';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../shared/components/atoms/nav-icon/nav-icon.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/**
 * Un tramo del directorio de laboratorios.
 *
 * Sigue siendo un alias del grupo genérico y no un tipo propio: las pruebas del
 * carril lo importan por nombre y el mapeo no cambió, sólo se mudó la forma.
 */
export type LaboratoryCategoryGroup = GrupoDeDirectorio;

/** Cómo se cuenta lo que este directorio lista. */
const SUSTANTIVO: SustantivoDelDirectorio = {
  singular: 'centro encontrado',
  plural: 'centros encontrados',
};

/**
 * Los filtros que la barra ofrece.
 *
 * Son selectores cerrados y no texto libre porque es lo que el organismo exige,
 * y porque un texto libre sobre «acepta órdenes externas» no puede resolverse a
 * nada. El término de búsqueda libre viaja aparte, bajo `q`, y el backend lo
 * aplica sobre el nombre y el código del centro.
 *
 * **Faltan tres de la especificación** —estudio, aseguradora y precio máximo— y
 * no por olvido: el endpoint los acepta, pero dibujarlos como selector exige un
 * catálogo de estudios y uno de aseguradoras que hoy no tienen lectura de
 * colección. Un campo de texto donde va un identificador sería pedirle a la
 * persona que escriba un uuid.
 */
const FILTROS: readonly FilterDef[] = [
  {
    key: 'kind',
    label: 'Tipo de centro',
    // Chips y no desplegable (A3 del plan de UX): son dos opciones, y
    // esconderlas detrás de un control que hay que abrir era la razón por la
    // que casi nadie acotaba el directorio.
    asChips: true,
    options: [
      { value: 'LABORATORY', label: 'Laboratorio clínico' },
      { value: 'IMAGING', label: 'Imagenología' },
    ],
  },
  {
    key: 'homeCollection',
    label: 'Toma a domicilio',
    // Las dos comodidades comparten renglón: son dos claves de la URL y una
    // sola pregunta de quien busca. Y van en forma **afirmativa** — «no toma a
    // domicilio» es un filtro que nadie pone a propósito, y ocupaba la mitad
    // del renglón.
    asChips: true,
    chipsGroup: 'Comodidades',
    options: [{ value: 'true', label: 'Toma a domicilio' }],
  },
  {
    key: 'walkIn',
    label: 'Atiende sin cita',
    asChips: true,
    chipsGroup: 'Comodidades',
    options: [{ value: 'true', label: 'Atiende sin cita' }],
  },
  {
    key: 'minRating',
    label: 'Calificación',
    options: [
      { value: '4.5', label: '4,5 o más' },
      { value: '4', label: '4 o más' },
      { value: '3', label: '3 o más' },
    ],
  },
];

/** Una categoría en la portada: su nombre, su ícono y cuántos centros tiene. */
export interface TarjetaDeCategoria {
  readonly codigo: string;
  readonly nombre: string;
  readonly cantidad: number;
  readonly icono: NavIconName;
}

/**
 * El ícono de cada categoría de centro.
 *
 * Sale del set del nav y **no** de uno nuevo, al revés que las especialidades:
 * acá son dos categorías y el set ya tiene los dos dibujos exactos —el matraz
 * para el laboratorio y la placa para la imagen—, con esos mismos significados.
 * `flask` es además el que el registro de secciones ya le da a este directorio,
 * así que el menú y la portada muestran la misma cosa, que es lo único que un
 * ícono aporta.
 *
 * El genérico es el estetoscopio: una categoría nueva del catálogo entra con un
 * dibujo honesto —«esto es un centro de salud»— en vez de dejar un hueco.
 */
const ICONO_POR_CATEGORIA: Readonly<Record<string, NavIconName>> = {
  DU_TYPE_LAB: 'flask',
  DU_TYPE_IMAGING: 'scan',
};

/**
 * El buscador de centros de diagnóstico, laboratorio e imagen.
 *
 * ## Por qué busca y no lista
 *
 * Antes pedía `GET /diagnostic-units`, que devuelve el directorio **de la
 * organización de la sesión** y sin filtros. Eso contesta «qué laboratorios
 * tiene mi institución», que es una pregunta del personal. La que trae acá a un
 * paciente es otra: «dónde me hago este estudio», entre todos los centros
 * publicados y acotando por lo que le importa. La contesta
 * `GET /diagnostic-units/search`, que no se acota al tenant y sí acepta filtros.
 *
 * ## La URL manda
 *
 * El filtrado vive en los query params, no en una copia local: recargar o
 * compartir el enlace reproduce exactamente la misma búsqueda, y el `back` del
 * navegador no deja la barra mostrando algo distinto de lo que se consultó. Lo
 * resuelve `FilterBar`; esta pantalla sólo reacciona a lo que emite.
 *
 * ## Sin reseñas no es cero
 *
 * Un centro recién publicado no tiene calificación, y eso no es una nota baja.
 * La tarjeta lo dice con palabras («sin calificaciones») en vez de mostrar un
 * cero que el centro no se ganó.
 */
@Component({
  selector: 'app-laboratory-directory',
  imports: [AppButtonLink, DirectoryPage, NavIcon, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './laboratory-directory.html',
  styleUrl: '../../shared/styles/rejilla-de-tarjetas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryDirectory {
  private readonly units = inject(DiagnosticUnitsClient);
  private readonly route = inject(ActivatedRoute);

  protected readonly filtros = FILTROS;
  protected readonly sustantivo = SUSTANTIVO;

  protected readonly state = signal<ViewState<readonly LaboratoryCategoryGroup[]>>(loading());
  protected readonly groups = computed(() => dataOf(this.state()) ?? []);

  /**
   * Todo lo que la URL trae como filtro, incluido `q`.
   *
   * ## Por qué se lee de la ruta y no de lo que emite la barra
   *
   * Porque `FilterBar` **sólo emite cuando alguien la toca**: su `emitCurrent`
   * cuelga de `applyParams`, que corre al tocar un chip o el buscador. Al
   * abrir la pantalla no emite nada.
   *
   * Mientras el único camino de entrada era «llegar y tocar» eso no se notaba.
   * Con la portada sí: una tarjeta navega a `?kind=IMAGING`, la lista se monta,
   * la barra lee la URL y pinta su chip encendido... y nadie le avisa a esta
   * clase, que se quedaba con la lectura sin filtrar del arranque. El resultado
   * era la pantalla mostrando los cuatro centros con «Tipo de centro:
   * Imagenología» marcado — o sea diciendo, sin decirlo, que los cuatro son de
   * imagen. Lo mismo le pasaba a cualquier enlace con `?minRating=4`.
   *
   * La URL ya era la fuente de verdad para la barra; ahora también lo es para
   * la lectura, que es lo que las deja imposibles de desincronizar.
   */
  private readonly parametros = toSignal(this.route.queryParams, {
    initialValue: {} as Params,
  });

  private readonly activos = computed<Readonly<Record<string, string>>>(() => {
    const params = this.parametros();
    const activos: Record<string, string> = {};
    for (const clave of [SEARCH_PARAM, ...FILTROS.map((filtro) => filtro.key)]) {
      const valor: unknown = params[clave];
      if (typeof valor === 'string' && valor !== '') {
        activos[clave] = valor;
      }
    }
    return activos;
  });

  /**
   * Sin categoría elegida se muestra la portada.
   *
   * El mismo trato que la portada de especialidades del directorio de médicos,
   * y por el mismo motivo: la categoría se elige **antes** que el centro. Nadie
   * busca «un centro»; se busca dónde hacerse un análisis o dónde hacerse una
   * placa, y son dos recorridos que no se mezclan.
   *
   * Que lo decida la URL es lo que hace de «los laboratorios clínicos» un
   * enlace que se puede pegar en un mensaje, y lo que deja que el «atrás» del
   * navegador devuelva a la portada en vez de sacar de la pantalla.
   */
  protected readonly enPortada = computed(() => (this.activos()['kind'] ?? '') === '');

  /**
   * Las tarjetas de la portada: las categorías que **tienen** centros.
   *
   * Salen de los grupos ya cargados y no de una lista escrita acá ni de una
   * segunda petición: `groupUnits` ya agrupa por `type.code` y cuenta. Una
   * tarjeta que promete y abre vacía es peor que no estar, así que una
   * categoría del catálogo sin centros publicados no se dibuja.
   */
  protected readonly categorias = computed<readonly TarjetaDeCategoria[]>(() =>
    this.groups().map((grupo) => ({
      codigo: grupo.id,
      nombre: grupo.nombre,
      cantidad: grupo.resultados.length,
      icono: ICONO_POR_CATEGORIA[grupo.id] ?? 'stethoscope',
    })),
  );

  /** Cuántos centros hay en total, para el subtítulo de la portada. */
  protected readonly totalDeCentros = computed(() =>
    this.groups().reduce((suma, grupo) => suma + grupo.resultados.length, 0),
  );

  /**
   * El valor de `kind` con el que se abre cada categoría.
   *
   * La portada agrupa por el **código del concepto** (`DU_TYPE_LAB`) y el
   * filtro del contrato viaja con **otro** vocabulario (`LABORATORY`). Sin esta
   * traducción la tarjeta navegaría a un `?kind=DU_TYPE_LAB` que `aConsulta`
   * descarta —sólo reconoce dos valores—, y la categoría se abriría sin filtrar:
   * la pantalla mostraría los cuatro centros diciendo, sin decirlo, que todos
   * son laboratorios.
   */
  protected filtroDe(codigo: string): string {
    return codigo === 'DU_TYPE_IMAGING' ? 'IMAGING' : 'LABORATORY';
  }

  /**
   * Las lecturas en vuelo, encauzadas por `switchMap`.
   *
   * ## Por qué no alcanza con `subscribe` suelto
   *
   * Porque esta pantalla puede pedir **dos veces casi a la vez**: el
   * constructor pide sin filtrar —lo que la portada necesita para contar— y,
   * si la URL ya traía `?kind=`, la barra de filtros emite en cuanto la lista
   * se monta y pide otra vez, ya acotada. Son dos peticiones concurrentes sin
   * relación de orden, y con `subscribe` gana la que responde última: entrar
   * por un enlace a «imagenología» mostraba los cuatro centros con el chip de
   * imagenología encendido, o sea la pantalla diciendo —sin decirlo— que los
   * cuatro son de imagen.
   *
   * `switchMap` cancela la anterior en vuelo, así que la última pedida es
   * siempre la que queda en pantalla. Es el mismo remedio, por el mismo
   * motivo, que documenta `BusquedaPublica` para el buscador público.
   */
  private readonly peticiones = new Subject<void>();

  constructor() {
    this.peticiones
      .pipe(
        tap(() => this.state.set(loading())),
        switchMap(() =>
          this.units.search(aConsulta(this.activos())).pipe(
            map((pagina) =>
              pagina.items.length === 0
                ? empty(
                    { label: 'Volver al panel', route: '/dashboard' },
                    hayFiltros(this.activos())
                      ? 'Ningún centro verificado coincide con esa búsqueda. Probá quitando algún filtro.'
                      : 'Todavía no hay centros verificados publicados.',
                  )
                : ready(groupUnits(pagina.items)),
            ),
            // El error se convierte en valor para que el flujo siga vivo: un
            // `error` que sube mata la suscripción y «Reintentar» dejaría de
            // pedir sin decir por qué.
            catchError((error: unknown) =>
              of(errorToViewState<readonly LaboratoryCategoryGroup[]>(error)),
            ),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((estado) => this.state.set(estado));

    // La lectura la dispara el cambio de la dirección —incluido el primero, que
    // `queryParams` emite de forma síncrona al suscribirse—, así que no hace
    // falta pedir aparte al arrancar. Tocar un chip navega, y navegar pide.
    effect(() => {
      this.activos();
      this.load();
    });
  }

  protected retry(): void {
    this.load();
  }

  private load(): void {
    this.peticiones.next();
  }
}

/** ¿Quedó algún filtro puesto? Decide qué texto muestra el vacío. */
function hayFiltros(activos: Readonly<Record<string, string>>): boolean {
  return Object.values(activos).some((valor) => valor !== '');
}

/**
 * Los filtros de la barra como consulta del buscador.
 *
 * Las claves coinciden con las del contrato a propósito —`kind`, `walkIn`,
 * `homeCollection`, `minRating`, `q`— así que la traducción es sólo de tipo: el
 * organismo entrega texto y el cliente pide booleanos y números. Una clave que
 * no se reconoce se descarta en vez de viajar: el backend valida con
 * `forbidNonWhitelisted` y la rechazaría con un 400.
 */
export function aConsulta(
  activos: Readonly<Record<string, string>>,
): DiagnosticUnitSearchQuery {
  const consulta: {
    -readonly [K in keyof DiagnosticUnitSearchQuery]: DiagnosticUnitSearchQuery[K];
  } = {};
  if (activos['q'] !== undefined && activos['q'] !== '') {
    consulta.q = activos['q'];
  }
  if (activos['kind'] === 'LABORATORY' || activos['kind'] === 'IMAGING') {
    consulta.kind = activos['kind'];
  }
  for (const clave of ['homeCollection', 'walkIn'] as const) {
    const valor = activos[clave];
    if (valor === 'true' || valor === 'false') {
      consulta[clave] = valor === 'true';
    }
  }
  const nota = Number(activos['minRating']);
  if (activos['minRating'] !== undefined && activos['minRating'] !== '' && !Number.isNaN(nota)) {
    consulta.minRating = nota;
  }
  return consulta;
}

export function groupUnits(
  units: readonly DiagnosticUnitSearchItem[],
): readonly LaboratoryCategoryGroup[] {
  const groups = new Map<string, DiagnosticUnitSearchItem[]>();
  for (const unit of units) {
    const current = groups.get(unit.type.code) ?? [];
    current.push(unit);
    groups.set(unit.type.code, current);
  }
  return [...groups.entries()]
    .map(([code, rows]) => ({
      id: code,
      nombre: categoryName(code, rows[0]?.type.display ?? 'Otra categoría'),
      resultados: rows.map(toSearchResult).sort((a, b) => a.title.localeCompare(b.title, 'es')),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function categoryName(code: string, fallback: string): string {
  if (code === 'DU_TYPE_LAB') return 'Laboratorio clínico';
  if (code === 'DU_TYPE_IMAGING') return 'Imagenología diagnóstica';
  return fallback;
}

function toSearchResult(unit: DiagnosticUnitSearchItem): SearchResultItem {
  const seals = [];
  if (unit.walkInAvailable) seals.push({ label: 'Atención sin cita', tone: 'ok' as const });
  if (unit.homeCollectionAvailable) {
    seals.push({ label: 'Toma a domicilio', tone: 'info' as const });
  }
  if (unit.acceptsExternalOrders) {
    seals.push({ label: 'Recibe órdenes externas', tone: 'neutro' as const });
  }
  const desde = precioDesde(unit.minAmount);
  return {
    id: unit.id,
    title: unit.name,
    link: `/laboratory-directory/${unit.id}`,
    figureText: initials(unit.name),
    // La categoría como subtítulo y no como insignia: desde que la portada
    // obliga a elegirla antes de entrar, todas las tarjetas de la lista son de
    // la misma, así que la insignia repetía en cada una la categoría que se
    // acababa de elegir. Como subtítulo ocupa el renglón que le corresponde
    // —qué es este centro— y no le roba el primero al nombre.
    subtitle: categoryName(unit.type.code, unit.type.display),
    meta: [
      { text: `Código ${unit.code}` },
      // Segundo y no último: la tarjeta dibuja dos líneas de contexto, y el
      // precio de entrada es lo que quien busca dónde hacerse un estudio compara.
      ...(desde === null ? [] : [{ text: desde }]),
      { text: `${unit.siteCount} ${unit.siteCount === 1 ? 'sede' : 'sedes'}` },
      { text: `${unit.studyCount} ${unit.studyCount === 1 ? 'estudio' : 'estudios'}` },
      { text: `${unit.equipmentCount} ${unit.equipmentCount === 1 ? 'equipo' : 'equipos'}` },
      { text: calificacion(unit) },
    ],
    seals,
  };
}

/**
 * Cómo se dice el precio de entrada.
 *
 * «Desde» y no el importe a secas: `minAmount` es el **menor** de la tarifa
 * pública del centro, y decirlo sin esa palabra prometería que cualquier
 * estudio cuesta eso.
 *
 * Sin importe no se dice nada, ni «consultar» ni «Bs 0»: un centro que no
 * publicó tarifa no es un centro gratis, y rellenar el hueco con una frase
 * amable haría que dos situaciones distintas se vean iguales.
 *
 * La moneda va literal porque la búsqueda **no la devuelve** —`minAmount` viaja
 * como número suelto—, y el directorio hoy es de un solo país. El día que la
 * respuesta traiga su concepto de moneda, se lee de ahí.
 */
function precioDesde(minAmount: number | null): string | null {
  if (minAmount === null) {
    return null;
  }
  // Sin decimales cuando no los hay: «Bs 120,00» en una línea de contexto pesa
  // más de lo que informa.
  const decimales = Number.isInteger(minAmount) ? 0 : 2;
  const cifra = minAmount.toLocaleString('es-BO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  return `desde Bs ${cifra}`;
}

/**
 * Cómo se dice la calificación.
 *
 * «Sin calificaciones» y no «0»: un centro recién publicado no tiene una nota
 * mala, tiene ninguna, y mostrarlo como cero lo castigaría por ser nuevo.
 */
function calificacion(unit: DiagnosticUnitSearchItem): string {
  if (unit.rating === null || unit.ratingCount === 0) {
    return 'Sin calificaciones';
  }
  const nota = unit.rating.toFixed(1).replace('.', ',');
  return `${nota} · ${unit.ratingCount} ${unit.ratingCount === 1 ? 'reseña' : 'reseñas'}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /\p{L}/u.test(part))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
