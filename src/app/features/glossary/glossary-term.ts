import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryRelation,
  GlossaryRelationType,
  GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { drugFactsFrom, type GlossaryDrugFacts } from './glossary-drug-facts';
import { GlossaryCategoryIcon } from './glossary-category-icon';

/**
 * Rótulo en castellano de cada tipo de relación clínica, en el orden en que se
 * agrupan en la ficha. `RELATED_TERM` va último: es el «ver también» genérico,
 * y las relaciones con significado clínico concreto —enfermedad, procedimiento,
 * tratamiento, anatomía, prueba diagnóstica— importan más para entender el
 * término.
 */
const RELATION_GROUPS: readonly { readonly type: GlossaryRelationType; readonly label: string }[] =
  [
    { type: 'DISEASE', label: 'Enfermedades relacionadas' },
    { type: 'PROCEDURE', label: 'Procedimientos relacionados' },
    { type: 'TREATMENT', label: 'Tratamientos relacionados' },
    { type: 'ANATOMY', label: 'Anatomía relacionada' },
    { type: 'DIAGNOSTIC_TEST', label: 'Pruebas diagnósticas relacionadas' },
    { type: 'RELATED_TERM', label: 'También se relaciona con' },
  ];

/** Un grupo de relaciones ya resuelto contra la ficha, listo para pintarse. */
export interface GrupoDeRelaciones {
  readonly label: string;
  readonly relaciones: readonly GlossaryRelation[];
}

/**
 * La ficha de un término del glosario.
 *
 * ## Por qué es una ruta y no un panel
 *
 * Un término se comparte. «Mirá qué quiere decir esto» es un enlace, y un panel
 * no tiene enlace. Cuelga de `/glossary` como ruta hija (`glossary/:conceptId`),
 * así que el rastro de migas y la sección marcada en el menú siguen diciendo
 * «Glosario» sin tocar `navigation.map.ts`. La reconstrucción del glosario
 * (carril 03) no toca este esquema de ruteo — sigue siendo `conceptId`, no
 * `slug`: cambiarlo habría roto cualquier enlace ya compartido, y no es lo que
 * el cliente pidió corregir.
 *
 * ## Qué trae la reconstrucción
 *
 * - **Definición clínica extendida** (`clinicalDefinition`) y **explicación en
 *   lenguaje llano** (`plainSummary`), como dos textos distintos y no uno solo:
 *   son la diferencia entre lo que necesita quien atiende y lo que necesita
 *   quien pregunta qué le dijeron.
 * - **Categoría** (una sola, enlazada de vuelta a la grilla) y **etiquetas
 *   clínicas** (0..N, informativas — ya no son un filtro navegable, ver
 *   `glossary.ts`).
 * - **Relaciones clínicas tipadas**: enfermedad, procedimiento, tratamiento,
 *   anatomía, prueba diagnóstica y «ver también», cada una enlazando a la
 *   ficha del término relacionado por su propio `conceptId`.
 * - **Imagen médica**, si el término la tiene — hoy **ninguno** la tiene: el
 *   backend documenta la decisión explícita de no sembrar imágenes sin una
 *   política de licencias verificada. Por eso el ícono de la categoría hace de
 *   marcador visual permanente, no un relleno temporal.
 *
 * Todo eso sale de **una sola llamada** (`GET /terminology/concepts/:id`). La
 * alternativa era `$lookup`, que se resuelve por `(sistema, código)` y habría
 * exigido dos lecturas previas sólo para poder preguntar.
 */
@Component({
  selector: 'app-glossary-term',
  imports: [Card, Chip, GlossaryCategoryIcon, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './glossary-term.html',
  styleUrl: './glossary-term.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryTerm {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly termino = signal<ViewState<GlossaryTermDetail>>(loading());

  private readonly conceptId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('conceptId') ?? '')),
    { initialValue: '' },
  );

  /** El término ya leído, o `null` mientras no lo esté. */
  protected readonly ficha = computed<GlossaryTermDetail | null>(() => {
    const estado = this.termino();
    return estado.status === 'ready' ? estado.data : null;
  });

  /**
   * El título de la pantalla.
   *
   * Mientras carga dice «Término», no el uuid de la ruta: un identificador en el
   * encabezado no le dice nada a quien vino a entender una palabra.
   */
  protected readonly titulo = computed(() => this.ficha()?.display ?? 'Término');

  /**
   * El código del término, **sólo si sirve para algo fuera de este sistema**.
   *
   * Un código como `I10` o `N02BE01` es útil: identifica el término en CIE-10 o
   * en la clasificación ATC y con él se lo busca en la literatura. Pero los
   * conceptos que siembra la propia plataforma guardan como código su **clave
   * interna** —`clinical:CONDITION_SEVERITY_SEVERE`—, porque
   * `catalog_concepts` exige unicidad por versión y varios módulos declaran
   * códigos genéricos que coinciden. Esa clave no le sirve a nadie en consulta:
   * es configuración, del mismo orden que el uuid que esta pantalla ya decidió
   * no mostrar.
   *
   * El prefijo de módulo (`modulo:CLAVE`) es lo que las distingue, y lo pone
   * `defineModuleConcepts` sin excepción. Verificado contra la API viva: los
   * conceptos internos vuelven con dos puntos, los importados de un catálogo
   * externo no.
   */
  protected readonly codigoPublicable = computed<string | null>(() => {
    const code = this.ficha()?.code;
    if (code === undefined || code === '') return null;
    return code.includes(':') ? null : code;
  });

  /**
   * Las relaciones de la ficha, agrupadas por tipo y en el orden clínico de
   * {@link RELATION_GROUPS}. Los grupos sin ninguna relación no se muestran:
   * un encabezado «Anatomía relacionada» seguido de nada no informa, confunde.
   */
  protected readonly gruposDeRelaciones = computed<readonly GrupoDeRelaciones[]>(() => {
    const relaciones = this.ficha()?.relations ?? [];
    return RELATION_GROUPS.map(({ type, label }) => ({
      label,
      relaciones: relaciones.filter((relacion) => relacion.type === type),
    })).filter((grupo) => grupo.relaciones.length > 0);
  });

  /**
   * Ficha de medicamento (TAREA-25), o `null` si no hay ninguno de los cuatro
   * datos. `null` es el estado normal hoy: la base no tiene ninguna fila del
   * `code_system` `ndc` (los importadores existen y no corrieron acá), así
   * que el bloque se omite entero — es el criterio de AC-25-6/AC-25-8, no una
   * falla de la pantalla.
   */
  protected readonly medicamento = computed<GlossaryDrugFacts | null>(() => {
    const termino = this.ficha();
    return termino === null ? null : drugFactsFrom(termino);
  });

  constructor() {
    effect(() => {
      const id = this.conceptId();
      untracked(() => this.cargar(id));
    });
  }

  protected recargar(): void {
    this.cargar(this.conceptId());
  }

  private cargar(conceptId: string): void {
    if (conceptId === '') return;

    this.termino.set(loading());

    this.terminology.readGlossaryTerm(conceptId).subscribe({
      next: (ficha) => this.termino.set(ready(ficha)),
      error: (error: unknown) => {
        // Un término que no existe es 404 del backend y se traduce a S6, que no
        // filtra existencia. Acá eso es sobre todo higiene: el catálogo no tiene
        // datos de paciente, pero la regla del proyecto vale igual.
        this.termino.set(errorToViewState<GlossaryTermDetail>(error));
      },
    });
  }
}
