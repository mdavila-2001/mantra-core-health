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
import type { GlossaryTermDetail } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

/**
 * La ficha de un término del glosario.
 *
 * ## Por qué es una ruta y no un panel
 *
 * Un término se comparte. «Mirá qué quiere decir esto» es un enlace, y un panel
 * no tiene enlace. Cuelga de `/glossary` como ruta hija (`glossary/:conceptId`),
 * así que el rastro de migas y la sección marcada en el menú siguen diciendo
 * «Glosario» sin tocar `navigation.map.ts`.
 *
 * ## Qué muestra que la entrada de la lista no puede
 *
 * En la lista, la definición vive apretada al lado de las demás. Acá se lee
 * entera, con **todas** sus etiquetas y con sus otras denominaciones —incluido
 * el nombre original en inglés, que es justo lo que alguien puede necesitar para
 * buscar el término en la literatura—.
 *
 * Todo eso sale de **una sola llamada** (`GET /terminology/concepts/:id`). La
 * alternativa era `$lookup`, que se resuelve por `(sistema, código)` y habría
 * exigido dos lecturas previas sólo para poder preguntar.
 */
@Component({
  selector: 'app-glossary-term',
  imports: [Card, Chip, PageHeader, RouterLink, ViewStateHost],
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
