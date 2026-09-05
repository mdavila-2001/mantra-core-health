/* V65-02·L · Profesionales
   Portada de V65-buscador/publico/V65-02-profesionales-listado.html en la bóveda. El marcado lo
   genera scripts/port-vistas-alovida.mjs; la lógica va acá, no en el generador. */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PublicDirectoryClient } from '@core/data-access/public-directory/public-directory.client';
import { MedicalSpecialtiesCatalog } from '@core/data-access/terminology/medical-specialties.service';
import type { ValueSetOption } from '@core/data-access/terminology/terminology.types';
import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import { aTarjeta } from '../public-result.mapper';
import { BusquedaPublica } from '@core/data-access/public-directory/public-search.store';

import type { SearchResultItem } from '../../../../shared/components/molecules/search-result/search-result.types';
import { ResultCard } from '../../../../shared/components/molecules/result-card/result-card';

/**
 * El nombre del parámetro de URL del filtro por especialidad.
 *
 * En inglés como todo identificador nuevo (TAREA-29), y **el mismo** que espera
 * `GET /public/search/practitioners`: si acá dijera `especialidad` habría que
 * traducirlo en dos lugares, y el enlace pegado en un mensaje no coincidiría
 * con lo que documenta el contrato público.
 */
export const PARAMETRO_ESPECIALIDAD = 'specialty';

/** Un bloque del directorio: una especialidad y los profesionales que la ejercen. */
export interface GrupoDeEspecialidad {
  readonly especialidad: string;
  readonly tarjetas: readonly SearchResultItem[];
}

/**
 * La primera parte del titular es la especialidad; las siguientes pueden ser
 * subáreas u organizaciones (por ejemplo, «Cardióloga · Hospital del Norte»).
 */
export function especialidadVisible(headline: string | null): string {
  return headline?.split(/[·,|]/, 1)[0]?.trim() || 'Especialidad no informada';
}

/** Organiza la página actual por la especialidad principal visible de cada perfil. */
export function agruparPorEspecialidad(
  resultados: readonly PublicSearchResult[],
): readonly GrupoDeEspecialidad[] {
  const porEspecialidad = new Map<string, PublicSearchResult[]>();

  for (const resultado of resultados) {
    const especialidad = especialidadVisible(resultado.headline);
    const grupo = porEspecialidad.get(especialidad) ?? [];
    grupo.push(resultado);
    porEspecialidad.set(especialidad, grupo);
  }

  const ordenar = new Intl.Collator('es', { sensitivity: 'base' });
  return [...porEspecialidad.entries()]
    .sort(([izquierda], [derecha]) => ordenar.compare(izquierda, derecha))
    .map(([especialidad, profesionales]) => ({
      especialidad,
      tarjetas: profesionales
        .slice()
        .sort((izquierda, derecha) => ordenar.compare(izquierda.displayName, derecha.displayName))
        .map(aTarjeta),
    }));
}

/**
 * El listado de profesionales de la superficie pública.
 *
 * ## De dónde salen los datos
 *
 * De `GET /public/search/practitioners`, **sin sesión**. Hasta el commit que
 * escribió esta clase la pantalla pintaba `PROFESIONALES_DE_MUESTRA`, un
 * archivo de datos inventados, porque `community` no tenía un solo `@Public()`.
 * Ya tiene trece, así que la lista es real.
 *
 * ## Por qué la barra de filtros perdió seis controles
 *
 * La maqueta dibuja ocho: especialidad, ciudad, modalidad, organización,
 * disponibilidad, precio, calificación mínima e idioma. **La API implementa
 * dos**: el texto libre y `verified`. `city` y `specialty` figuran en
 * `CONTRATO-PUBLICO.md` §2 pero el controlador no los lee, y los otros cuatro
 * no existen en ninguna parte.
 *
 * Dejarlos dibujados habría sido peor que quitarlos: alguien filtra «Atiende
 * hoy», la lista no cambia y la pantalla le dice —sin decirlo— que todos
 * atienden hoy. Un filtro que no filtra no es un pendiente visual, es una
 * respuesta equivocada a una pregunta que la persona sí hizo. Los seis están
 * registrados en el reporte del carril con el dato que les falta a cada uno.
 */
@Component({
  selector: 'app-alovida-buscar-profesionales-listado',
  imports: [RouterLink, ResultCard],
  templateUrl: './profesionales-listado.html',
  styleUrl: './profesionales-listado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscarProfesionalesListado {
  private readonly directorio = inject(PublicDirectoryClient);
  private readonly catalogo = inject(MedicalSpecialtiesCatalog);
  private readonly destroyRef = inject(DestroyRef);

  /** Sólo verificados. Omitido trae todos, con los verificados primero (D7). */
  protected readonly soloVerificados = signal(false);

  /**
   * El filtro por especialidad viaja en la URL (AC-02-7), así que el store lo
   * declara como parámetro propio y lo compone con `q` en la misma lectura.
   */
  protected readonly busqueda: BusquedaPublica = new BusquedaPublica(
    // La especialidad llega por parámetro y NO se lee del store: la primera
    // lectura ocurre dentro del constructor del store, cuando este campo
    // todavía no existe. Ver `LecturaDeBusqueda`.
    (filtros, parametros) => {
      const especialidad = parametros[PARAMETRO_ESPECIALIDAD] ?? '';
      return this.directorio.searchPractitioners({
        ...filtros,
        ...(especialidad === '' ? {} : { specialty: especialidad }),
        ...(this.soloVerificados() ? { verified: true } : {}),
      });
    },
    [PARAMETRO_ESPECIALIDAD],
  );

  /* ---- el catálogo de especialidades (AC-02-7, AC-02-13) ------------------ */

  /**
   * Las 36 de `VS_MEDICAL_SPECIALTY`, servidas por `terminology`.
   *
   * **Nunca una lista escrita en el componente.** Es la misma fuente que usan
   * el alta de profesional y la edición de perfil, y es lo que hace que el uuid
   * que viaja al servidor pertenezca al conjunto que el servidor valida.
   *
   * Ojo con lo que NO es: el agrupamiento visual de la pantalla sale de partir
   * el titular del perfil por `·`, que es texto libre. El filtro no usa ese
   * texto — usa el concepto. Los dos conviven hasta que el directorio proyecte
   * la especialidad como concepto, que es la deriva anotada en la ficha.
   */
  protected readonly especialidades = signal<readonly ValueSetOption[]>([]);

  /** El catálogo no cargó: se lo dice y se ofrece reintentar (AC-02-9). */
  protected readonly catalogoCaido = signal(false);

  protected readonly especialidadElegida: Signal<string> = computed(() =>
    this.busqueda.parametro(PARAMETRO_ESPECIALIDAD),
  );

  constructor() {
    this.leerCatalogo();
  }

  /**
   * Un catálogo caído **no bloquea el directorio**: la lista se sigue viendo
   * sin filtro, y el desplegable se reemplaza por su aviso con «Reintentar».
   * Es el patrón que ya usa `campoDepartamentoEmisor` en el alta.
   */
  protected leerCatalogo(): void {
    this.catalogoCaido.set(false);
    this.catalogo.olvidar();
    this.catalogo
      .listar()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opciones) => this.especialidades.set(opciones),
        error: () => this.catalogoCaido.set(true),
      });
  }

  /** Elegir una especialidad la lleva a la URL; la lectura la dispara ese cambio. */
  protected alElegirEspecialidad(conceptId: string): void {
    this.busqueda.filtrarPor(PARAMETRO_ESPECIALIDAD, conceptId);
  }

  /** La página actual, organizada en bloques simples por especialidad. */
  protected readonly gruposPorEspecialidad = computed(() =>
    agruparPorEspecialidad(this.busqueda.resultados()),
  );

  /** Escribir lleva el texto a `?q=`; el cambio de la URL dispara la lectura. */
  protected alEscribir(valor: string): void {
    this.busqueda.escribir(valor);
  }

  /** Conmutar «sólo verificados» también vuelve a la primera página. */
  protected alConmutarVerificados(valor: boolean): void {
    this.soloVerificados.set(valor);
    this.busqueda.buscar();
  }
}
