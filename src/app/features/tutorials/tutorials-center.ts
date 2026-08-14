import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { NavigationService } from '../../core/navigation/navigation.service';
import { TutorialEngine } from '../../core/tutorials/tutorial.engine';
import { TutorialProgressStore } from '../../core/tutorials/tutorial-progress.store';
import { TutorialRegistry } from '../../core/tutorials/tutorial.registry';
import type { TutorialDefinition, TutorialStatus } from '../../core/tutorials/tutorial.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Chip } from '../../shared/components/atoms/chip/chip';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';

/** El valor del filtro que no filtra. */
const TODAS = '';

/** Cómo se lee cada estado, y con qué tono. */
const ESTADOS: Readonly<
  Record<TutorialStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'primary' }>
> = {
  completado: { label: 'Completado', tone: 'success' },
  'en-curso': { label: 'En curso', tone: 'info' },
  omitido: { label: 'A medias', tone: 'warning' },
  pendiente: { label: 'Pendiente', tone: 'primary' },
};

/** Un tutorial listo para pintar: con su estado, su avance y qué se le ofrece. */
export interface TutorialEnLista {
  readonly definicion: TutorialDefinition;
  readonly estado: TutorialStatus;
  readonly etiquetaDeEstado: string;
  readonly tono: 'success' | 'info' | 'warning' | 'primary';
  /** Qué dice el botón principal. Depende de cómo lo dejó, no del estado a secas. */
  readonly accion: 'Empezar' | 'Continuar' | 'Repetir';
  /** Si le faltan requisitos. No bloquea: avisa. */
  readonly faltanRequisitos: boolean;
  readonly requisitosPendientes: readonly string[];
}

/**
 * **Centro de tutoriales** — la pantalla desde la que se aprende a usar todo lo
 * demás.
 *
 * ## Por qué es una sección y no un menú de ayuda
 *
 * Un desplegable de ayuda es donde van a morir los tutoriales: se abre por
 * accidente, no se puede compartir por enlace y no tiene lugar para decir cuánto
 * llevás hecho. Como sección tiene URL propia, entra en el menú con los mismos
 * roles que el resto y puede mostrar el avance, que es lo que hace que alguien
 * vuelva.
 *
 * ## Los requisitos avisan, no bloquean
 *
 * Un tutorial con requisitos sin cumplir se puede empezar igual, con un aviso.
 * Bloquearlo convierte una ayuda en un trámite: quien ya sabe usar la
 * aplicación no debería tener que fingir que aprende para llegar al que le
 * interesa.
 *
 * ## Los problemas de configuración se muestran
 *
 * Si el registro encontró un id duplicado o un requisito que apunta a la nada,
 * aparece acá. Es la pantalla de quien escribe tutoriales tanto como la de quien
 * los hace, y un error que no se ve es un error que no se arregla.
 */
@Component({
  selector: 'app-tutorials-center',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    Chip,
    FormField,
    PageHeader,
    SearchField,
    Select,
    TutorialTarget,
  ],
  templateUrl: './tutorials-center.html',
  styleUrl: './tutorials-center.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TutorialsCenter {
  private readonly registry = inject(TutorialRegistry);
  private readonly progress = inject(TutorialProgressStore);
  private readonly engine = inject(TutorialEngine);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /* -- Filtros -------------------------------------------------------------
     En memoria y no en la URL, al revés que en la agenda o el buscador de
     pacientes: acá no hay nada que compartir por enlace —el resultado depende
     del avance de quien mira, que es distinto para cada persona— y una URL con
     filtros que a otro le muestran otra cosa se lee como un error. */

  protected readonly texto = signal('');
  protected readonly categoria = signal(TODAS);
  protected readonly estado = signal<TutorialStatus | ''>(TODAS);

  protected readonly problemas = this.registry.issues;

  /** Todos los que esta sesión puede hacer, ya con su estado resuelto. */
  private readonly disponibles = computed<readonly TutorialEnLista[]>(() => {
    const catalogo = this.registry.available();
    return catalogo.map((definicion) => {
      const estado = this.progress.statusOf(definicion);
      const cumplidos = this.progress.prerequisitesMet(definicion, catalogo);
      return {
        definicion,
        estado,
        etiquetaDeEstado: ESTADOS[estado].label,
        tono: ESTADOS[estado].tone,
        accion: accionDe(estado),
        faltanRequisitos: !cumplidos,
        requisitosPendientes: (definicion.prerequisites ?? [])
          .map((id) => catalogo.find((candidato) => candidato.id === id))
          .filter(
            (requisito): requisito is TutorialDefinition =>
              requisito !== undefined && this.progress.statusOf(requisito) !== 'completado',
          )
          .map((requisito) => requisito.title),
      };
    });
  });

  /** Lo que se ve, después de los filtros. */
  protected readonly lista = computed<readonly TutorialEnLista[]>(() => {
    const texto = this.texto().trim().toLowerCase();
    const categoria = this.categoria();
    const estado = this.estado();

    return this.disponibles().filter((fila) => {
      if (categoria !== TODAS && fila.definicion.category !== categoria) {
        return false;
      }
      if (estado !== TODAS && fila.estado !== estado) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      // Título y descripción: buscar sólo en el título deja fuera «cómo cambio
      // de organización», que es como la gente busca de verdad.
      return (
        fila.definicion.title.toLowerCase().includes(texto) ||
        fila.definicion.description.toLowerCase().includes(texto)
      );
    });
  });

  /**
   * Los recomendados: lo que conviene hacer ahora.
   *
   * Primero lo empezado a medias —terminar algo pendiente vale más que empezar
   * otra cosa— y después lo que ya tiene los requisitos cumplidos. Se muestran
   * tres: una lista de «recomendados» con diez elementos no recomienda nada.
   */
  protected readonly recomendados = computed<readonly TutorialEnLista[]>(() =>
    [...this.disponibles()]
      .filter((fila) => fila.estado !== 'completado' && !fila.faltanRequisitos)
      .sort((a, b) => prioridad(a.estado) - prioridad(b.estado))
      .slice(0, 3),
  );

  /** El avance general, de 0 a 100. */
  protected readonly avance = computed(() =>
    Math.round(this.progress.progressOver(this.registry.available()) * 100),
  );

  protected readonly completados = computed(
    () => this.disponibles().filter((fila) => fila.estado === 'completado').length,
  );

  protected readonly total = computed(() => this.disponibles().length);

  protected readonly opcionesDeCategoria = computed<readonly SelectOption<string>[]>(() => [
    { value: TODAS, label: 'Todas las categorías' },
    ...this.registry.categories().map((categoria) => ({ value: categoria, label: categoria })),
  ]);

  protected readonly opcionesDeEstado: readonly SelectOption<string>[] = [
    { value: TODAS, label: 'Cualquier estado' },
    { value: 'pendiente', label: 'Pendientes' },
    { value: 'en-curso', label: 'En curso' },
    { value: 'omitido', label: 'A medias' },
    { value: 'completado', label: 'Completados' },
  ];

  /* -- Acciones ------------------------------------------------------------ */

  /**
   * Abre un tutorial.
   *
   * «Continuar» retoma donde quedó; «Empezar» y «Repetir» van desde el
   * principio. Es la misma llamada con una bandera distinta, y por eso la
   * decisión vive acá y no en el motor: el motor no tiene por qué saber qué
   * decía el botón.
   */
  protected async abrir(fila: TutorialEnLista): Promise<void> {
    await this.engine.start(fila.definicion.id, fila.accion !== 'Continuar');
  }

  /** Vuelve un tutorial a cero sin borrar cuántas veces se completó. */
  protected reiniciar(fila: TutorialEnLista): void {
    this.progress.reset(fila.definicion.id);
  }

  protected buscar(texto: string): void {
    this.texto.set(texto);
  }

  protected elegirCategoria(valor: string | null): void {
    this.categoria.set(valor ?? TODAS);
  }

  protected elegirEstado(valor: string | null): void {
    this.estado.set((valor ?? TODAS) as TutorialStatus | '');
  }

  protected limpiarFiltros(): void {
    this.texto.set('');
    this.categoria.set(TODAS);
    this.estado.set(TODAS);
  }
}

/** Qué se le ofrece a alguien según cómo dejó el tutorial. */
function accionDe(estado: TutorialStatus): TutorialEnLista['accion'] {
  if (estado === 'completado') {
    return 'Repetir';
  }
  // `omitido` y `en-curso` ofrecen continuar: en los dos casos hay un paso
  // guardado, y mandarlo al principio le haría repetir lo que ya vio.
  return estado === 'pendiente' ? 'Empezar' : 'Continuar';
}

/** Orden de los recomendados: terminar lo empezado antes que empezar otra cosa. */
function prioridad(estado: TutorialStatus): number {
  switch (estado) {
    case 'en-curso':
      return 0;
    case 'omitido':
      return 1;
    default:
      return 2;
  }
}
