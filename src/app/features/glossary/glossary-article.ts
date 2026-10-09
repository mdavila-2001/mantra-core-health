import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type { GlossaryArticle } from '../../core/data-access/terminology/glossary-article.types';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { FactList } from '../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../shared/components/molecules/fact-list/fact-list.types';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import {
  enlaceSeguro,
  enlaceWeb,
  fechaLegible,
  fuentesDeLosDatos,
  imagenesVisibles,
  nombreDeFuente,
  seccionesPintables,
} from './glossary-article.logic';

/**
 * El artículo enciclopédico de un término (TAREA-41 §12, F9).
 *
 * Muestra **sólo** lo que el artículo trae: cada sección con su texto literal
 * y su cita («Fuente: … · licencia · consultado …»), las imágenes con autor y
 * licencia, los datos estructurados y las referencias. Una sección que no
 * existe no se dibuja ni se rellena (§12.2.2). Nada se redacta acá.
 *
 * Un índice lateral —fila desplazable en el teléfono, columna fija desde
 * escritorio— lleva a cada sección moviendo el foco a su título.
 */
@Component({
  selector: 'app-glossary-article',
  imports: [Alert, ContentDialog, FactList],
  templateUrl: './glossary-article.html',
  styleUrl: './glossary-article.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryArticleView {
  readonly articulo = input.required<GlossaryArticle>();
  /** Nombre del término, para el título del modal de imagen. */
  readonly termino = input.required<string>();
  /** Otros nombres del término, si los tiene. */
  readonly sinonimos = input<readonly string[]>([]);

  protected readonly secciones = computed(() => seccionesPintables(this.articulo()));
  protected readonly imagenes = computed(() => imagenesVisibles(this.articulo().images));
  protected readonly hechos = computed<readonly Hecho[]>(() =>
    this.articulo().facts.map((dato) => ({ etiqueta: dato.label, valor: dato.value })),
  );
  protected readonly fuentesDeDatos = computed(() => fuentesDeLosDatos(this.articulo().facts));
  protected readonly referencias = computed(() =>
    this.articulo().references.filter((ref) => enlaceSeguro(ref.url) !== null),
  );

  /** Posición de la imagen ampliada, o `null` si el modal está cerrado. */
  protected readonly ampliada = signal<number | null>(null);
  protected readonly imagenAmpliada = computed(() => {
    const i = this.ampliada();
    return i === null ? null : (this.imagenes()[i] ?? null);
  });

  protected readonly fechaLegible = fechaLegible;
  protected readonly nombreDeFuente = nombreDeFuente;
  protected readonly enlaceSeguro = enlaceSeguro;
  protected readonly enlaceWeb = enlaceWeb;

  /** Lleva a una sección: la desplaza a la vista y le da el foco a su título. */
  protected irA(ancla: string): void {
    if (typeof document === 'undefined') return;
    const titulo = document.getElementById(ancla);
    if (titulo === null) return;
    const reducido =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    titulo.scrollIntoView({ behavior: reducido ? 'auto' : 'smooth', block: 'start' });
    titulo.focus({ preventScroll: true });
  }
}
