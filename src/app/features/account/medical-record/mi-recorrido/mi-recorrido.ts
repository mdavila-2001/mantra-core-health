import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { failureOf, isLoading } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AccordionPanel } from '../../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import type { Episodio, Recorrido } from './episodios';
import type { PasoNarrado } from './narracion';
import { fechaCorta } from './redaccion';
import { type RegistroConVinculos } from './registro-con-vinculos.types';
import { MiRecorridoDetalle } from './detalle/mi-recorrido-detalle';
import { RecorridoFalta } from './falta/recorrido-falta';

/** Which «Por fecha» tab each record type's detail leads to. */
export type SeccionDeDestino = 'atenciones' | 'diagnosticos' | 'recetas';

/** The guided tour in progress: which thread and which sentence. */
interface Guiado {
  readonly episodioId: string;
  readonly indice: number;
}

const TIPO_EN_PALABRAS: Readonly<Record<RegistroConVinculos['tipo'], string>> = {
  atencion: 'Consulta',
  diagnostico: 'Diagnóstico',
  estudio: 'Estudio',
  receta: 'Receta',
  control: 'Control',
};

/**
 * **Mi recorrido** — the patient's history told by health problem.
 *
 * Presentational: it receives the tour already built (`recorridoDelPaciente`)
 * and only handles what belongs to the view —what is expanded, which step of
 * the guided tour it is on, which record the detail sheet shows—. Downloading
 * or navigating is done by the owner screen, through the outputs.
 *
 * Three levels, all three with `aria-expanded` since they are
 * `app-accordion-panel`: the thread, each of its encounters, and each fact's
 * detail (in a drawer, `detalle/`).
 *
 * No clinical alerts nor suggestions: they are the doctor's tools, and in the
 * patient portal they would read as a diagnosis nobody made.
 */
@Component({
  selector: 'app-mi-recorrido',
  imports: [
    AccordionPanel,
    AppButton,
    DrawerPanel,
    NgTemplateOutlet,
    MiRecorridoDetalle,
    RecorridoFalta,
  ],
  templateUrl: './mi-recorrido.html',
  styleUrl: './mi-recorrido.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiRecorrido {
  readonly recorrido = input.required<Recorrido>();
  /** The lazy read of orders and appointments (M34), or `null` while nobody asked for it. */
  readonly detalle = input<ViewState<unknown> | null>(null);
  /** The failed read of the appointments (and with them the follow-ups), as M34 says it, or `null`. */
  readonly citasSinCargar = input<ViewState<unknown> | null>(null);
  /** The prescription being downloaded now, if any. */
  readonly descargandoReceta = input<string | null>(null);

  readonly descargarReceta = output<string>();
  readonly irASeccion = output<SeccionDeDestino>();
  readonly reintentar = output<void>();

  /** «Estudio», «Receta»… — a method and not an index: the thread template's context is untyped. */
  protected tipoDe(registro: RegistroConVinculos): string {
    return TIPO_EN_PALABRAS[registro.tipo];
  }

  /** The open panels, by key. Folded is the starting state. */
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());

  protected readonly guiado = signal<Guiado | null>(null);

  /** The record the detail sheet shows. */
  protected readonly enDetalle = signal<RegistroConVinculos | null>(null);
  protected readonly detalleAbierto = signal(false);

  protected readonly cargando = computed(() => {
    const estado = this.detalle();
    return estado !== null && isLoading(estado);
  });

  /** The read failed: `falta/` tells S5 from S9 (no retry on a wall, request id on a fault). */
  protected readonly faltaDelDetalle = computed(() => failureOf(this.detalle()));
  protected readonly faltaDeLasCitas = computed(() => failureOf(this.citasSinCargar()));

  protected readonly vacio = computed(() => {
    const r = this.recorrido();
    return r.episodios.length === 0 && r.descartados.length === 0 && r.otras === null;
  });

  /** Every thread, to find the guided step's one. */
  private readonly todos = computed<readonly Episodio[]>(() => {
    const r = this.recorrido();
    return [...r.episodios, ...r.descartados, ...(r.otras === null ? [] : [r.otras])];
  });

  /** The step being narrated, with its thread. */
  protected readonly pasoActual = computed<{ episodio: Episodio; paso: PasoNarrado; indice: number } | null>(
    () => {
      const guiado = this.guiado();
      if (guiado === null) return null;
      const episodio = this.todos().find((e) => e.id === guiado.episodioId);
      const paso = episodio?.pasos[guiado.indice];
      return episodio === undefined || paso === undefined ? null : { episodio, paso, indice: guiado.indice };
    },
  );

  /* ---- expansion ----------------------------------------------------------- */

  protected abierto(clave: string): boolean {
    return this.abiertos().has(clave);
  }

  protected alternar(clave: string, abierto: boolean): void {
    const siguiente = new Set(this.abiertos());
    if (abierto) siguiente.add(clave);
    else siguiente.delete(clave);
    this.abiertos.set(siguiente);
    // Folding the thread being narrated ends the narration: going on about
    // something not in view confuses more than it helps.
    if (!abierto && this.guiado()?.episodioId === clave) this.guiado.set(null);
  }

  protected claveDeAtencion(episodio: Episodio, atencionId: string): string {
    return `${episodio.id}/${atencionId}`;
  }

  /* ---- guided tour --------------------------------------------------------- */

  protected empezarGuiado(episodio: Episodio): void {
    if (episodio.pasos.length === 0) return;
    this.guiado.set({ episodioId: episodio.id, indice: 0 });
    this.mostrarPaso(episodio, 0);
  }

  protected moverGuiado(delta: 1 | -1): void {
    const actual = this.pasoActual();
    if (actual === null) return;
    const indice = actual.indice + delta;
    if (indice < 0 || indice >= actual.episodio.pasos.length) return;
    this.guiado.set({ episodioId: actual.episodio.id, indice });
    this.mostrarPaso(actual.episodio, indice);
  }

  protected terminarGuiado(): void {
    this.guiado.set(null);
  }

  /** Expands the step's encounter so what is narrated is in view. */
  private mostrarPaso(episodio: Episodio, indice: number): void {
    const atencionId = episodio.pasos[indice]?.atencionId ?? null;
    const siguiente = new Set(this.abiertos());
    siguiente.add(episodio.id);
    if (atencionId !== null) siguiente.add(this.claveDeAtencion(episodio, atencionId));
    this.abiertos.set(siguiente);
  }

  /** The record being narrated, to highlight it in the tree. */
  protected esActual(registroId: string, episodio: Episodio): boolean {
    const actual = this.pasoActual();
    return actual !== null && actual.episodio.id === episodio.id && actual.paso.registroId === registroId;
  }

  /** Opens the sheet of the record backing the narrated sentence. */
  protected verRegistroDelPaso(): void {
    const actual = this.pasoActual();
    if (actual === null) return;
    const registro = registrosDe(actual.episodio).find((r) => r.id === actual.paso.registroId);
    if (registro !== undefined) this.verDetalle(registro);
  }

  /* ---- detail sheet -------------------------------------------------------- */

  protected verDetalle(registro: RegistroConVinculos): void {
    this.enDetalle.set(registro);
    this.detalleAbierto.set(true);
  }

  protected cerrarDetalle(): void {
    this.detalleAbierto.set(false);
  }

  protected subtituloDe(registro: RegistroConVinculos): string {
    const fecha = fechaCorta(registro.cuando ?? undefined);
    return fecha === null ? TIPO_EN_PALABRAS[registro.tipo] : `${TIPO_EN_PALABRAS[registro.tipo]} · ${fecha}`;
  }

  /** A fact's short label inside its encounter. */
  protected resumenDe(registro: RegistroConVinculos): string {
    switch (registro.tipo) {
      case 'diagnostico':
        return `${registro.nombre} · ${palabraDelEstado(registro)}`;
      case 'estudio':
        return registro.conResultado ? `${registro.nombre} · resultado disponible` : registro.nombre;
      case 'control': {
        const fecha = fechaCorta(registro.cuando ?? undefined);
        return fecha === null ? 'Control' : `Control del ${fecha}`;
      }
      default:
        return registro.nombre;
    }
  }

  /**
   * A thread's folded label: the problem, its status and its span. The span,
   * not only the start: the threads are ordered by its end, and «desde» alone
   * made that order look random. Both come from the first read (`lapsoDe`),
   * so they do not jump when the studies arrive.
   */
  protected encabezadoDe(episodio: Episodio): string {
    const desde = fechaCorta(episodio.desde ?? undefined);
    const hasta = fechaCorta(episodio.hasta ?? undefined);
    const lapso = desde === null ? null : hasta === null || hasta === desde ? desde : `${desde} – ${hasta}`;
    return [episodio.titulo, episodio.sello, lapso]
      .filter((parte) => parte !== null)
      .join(' · ');
  }

  protected encabezadoDeAtencion(registro: RegistroConVinculos): string {
    const fecha = fechaCorta(registro.cuando ?? undefined);
    return fecha === null ? registro.nombre : `${fecha} · ${registro.nombre}`;
  }

  protected irAlRegistro(registro: RegistroConVinculos): void {
    const destino: SeccionDeDestino =
      registro.tipo === 'diagnostico' ? 'diagnosticos' : registro.tipo === 'receta' ? 'recetas' : 'atenciones';
    this.detalleAbierto.set(false);
    this.irASeccion.emit(destino);
  }
}

function palabraDelEstado(registro: RegistroConVinculos): string {
  switch (registro.estado) {
    case 'confirmado':
      return 'se confirmó';
    case 'descartado':
      return 'se descartó';
    case 'resuelto':
      return 'resuelto';
    default:
      return 'en estudio';
  }
}

function registrosDe(episodio: Episodio): readonly RegistroConVinculos[] {
  return [
    ...episodio.atenciones.flatMap((a) => [a.registro, ...a.hechos.map((h) => h.registro)]),
    ...episodio.descartados,
    ...episodio.sueltos.map((h) => h.registro),
  ];
}
