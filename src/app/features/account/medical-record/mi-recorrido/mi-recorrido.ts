import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AccordionPanel } from '../../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import type { Episodio, PasoNarrado, Recorrido } from './episodios';
import { fechaCorta, type RegistroConVinculos, type VinculoAusente } from './registro-con-vinculos';

/** A qué pestaña de «Por fecha» lleva el detalle de cada tipo de registro. */
export type SeccionDeDestino = 'atenciones' | 'diagnosticos' | 'recetas';

/** El recorrido guiado en curso: qué hilo y qué frase. */
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

/** Lo que se dice de un vínculo que no consta. Nunca se inventa el vínculo. */
const AUSENTE_EN_PALABRAS: Readonly<Record<VinculoAusente, string>> = {
  'estudio-sin-diagnostico': 'No consta para qué diagnóstico se pidió.',
  'descartado-sin-reemplazo': 'No consta qué diagnóstico quedó en su lugar.',
  'receta-sin-diagnostico': 'No consta para qué diagnóstico se indicó.',
};

/**
 * **Mi recorrido** — la historia del paciente contada por problema de salud.
 *
 * Presentacional: recibe el recorrido ya armado (`recorridoDelPaciente`) y
 * sólo maneja lo que es de la vista —qué está desplegado, en qué paso del
 * recorrido guiado se está, qué registro se mira en la hoja de detalle—. Lo
 * que descarga o navega lo hace la pantalla dueña, por las salidas.
 *
 * Tres niveles, los tres con `aria-expanded` porque son `app-accordion-panel`:
 * el hilo, cada atención del hilo, y el detalle de cada hecho (en un cajón).
 *
 * Sin alertas clínicas ni sugerencias: son herramientas del médico, y en el
 * portal del paciente se leerían como un diagnóstico que nadie hizo.
 */
@Component({
  selector: 'app-mi-recorrido',
  imports: [
    AccordionPanel,
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DrawerPanel,
    FactList,
    NgTemplateOutlet,
    RouterLink,
  ],
  templateUrl: './mi-recorrido.html',
  styleUrl: './mi-recorrido.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MiRecorrido {
  readonly recorrido = input.required<Recorrido>();
  /** Las órdenes y las citas todavía están llegando. */
  readonly cargando = input(false);
  /** Las órdenes y las citas no se pudieron leer. */
  readonly fallo = input(false);
  /** Por qué no llegaron las citas (y con ellas los controles), o `null`. */
  readonly citasSinCargar = input<string | null>(null);
  /** La receta que se está descargando ahora, si alguna. */
  readonly descargandoReceta = input<string | null>(null);

  readonly descargarReceta = output<string>();
  readonly irASeccion = output<SeccionDeDestino>();
  readonly reintentar = output<void>();

  /** «Estudio», «Receta»… — método y no índice: el contexto de la plantilla del hilo no está tipado. */
  protected tipoDe(registro: RegistroConVinculos): string {
    return TIPO_EN_PALABRAS[registro.tipo];
  }

  /** Los paneles abiertos, por clave. Plegado es el estado de partida. */
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());

  protected readonly guiado = signal<Guiado | null>(null);

  /** El registro que muestra la hoja de detalle. */
  protected readonly enDetalle = signal<RegistroConVinculos | null>(null);
  protected readonly detalleAbierto = signal(false);

  protected readonly vacio = computed(() => {
    const r = this.recorrido();
    return r.episodios.length === 0 && r.descartados.length === 0 && r.otras === null;
  });

  /** Todos los hilos, para encontrar el del paso guiado. */
  private readonly todos = computed<readonly Episodio[]>(() => {
    const r = this.recorrido();
    return [...r.episodios, ...r.descartados, ...(r.otras === null ? [] : [r.otras])];
  });

  /** El paso que se está narrando, con su hilo. */
  protected readonly pasoActual = computed<{ episodio: Episodio; paso: PasoNarrado; indice: number } | null>(
    () => {
      const guiado = this.guiado();
      if (guiado === null) return null;
      const episodio = this.todos().find((e) => e.id === guiado.episodioId);
      const paso = episodio?.pasos[guiado.indice];
      return episodio === undefined || paso === undefined ? null : { episodio, paso, indice: guiado.indice };
    },
  );

  /* ---- despliegue --------------------------------------------------------- */

  protected abierto(clave: string): boolean {
    return this.abiertos().has(clave);
  }

  protected alternar(clave: string, abierto: boolean): void {
    const siguiente = new Set(this.abiertos());
    if (abierto) siguiente.add(clave);
    else siguiente.delete(clave);
    this.abiertos.set(siguiente);
    // Plegar el hilo que se está narrando termina la narración: seguir
    // hablando de algo que no se ve confunde más de lo que ayuda.
    if (!abierto && this.guiado()?.episodioId === clave) this.guiado.set(null);
  }

  protected claveDeAtencion(episodio: Episodio, atencionId: string): string {
    return `${episodio.id}/${atencionId}`;
  }

  /* ---- recorrido guiado --------------------------------------------------- */

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

  /** Despliega la atención del paso para que lo narrado esté a la vista. */
  private mostrarPaso(episodio: Episodio, indice: number): void {
    const atencionId = episodio.pasos[indice]?.atencionId ?? null;
    const siguiente = new Set(this.abiertos());
    siguiente.add(episodio.id);
    if (atencionId !== null) siguiente.add(this.claveDeAtencion(episodio, atencionId));
    this.abiertos.set(siguiente);
  }

  /** El registro que se está narrando, para resaltarlo en el árbol. */
  protected esActual(registroId: string, episodio: Episodio): boolean {
    const actual = this.pasoActual();
    return actual !== null && actual.episodio.id === episodio.id && actual.paso.registroId === registroId;
  }

  /** Abre la hoja del registro que respalda la frase narrada. */
  protected verRegistroDelPaso(): void {
    const actual = this.pasoActual();
    if (actual === null) return;
    const registro = registrosDe(actual.episodio).find((r) => r.id === actual.paso.registroId);
    if (registro !== undefined) this.verDetalle(registro);
  }

  /* ---- hoja de detalle ---------------------------------------------------- */

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

  protected ausentesDe(registro: RegistroConVinculos): readonly string[] {
    return registro.ausentes.map((a) => AUSENTE_EN_PALABRAS[a]);
  }

  /** El rótulo corto de un hecho dentro de su atención. */
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

  /** El rótulo plegado de un hilo: el problema, su estado y desde cuándo. */
  protected encabezadoDe(episodio: Episodio): string {
    const desde = fechaCorta(episodio.desde ?? undefined);
    return [episodio.titulo, episodio.sello, desde === null ? null : `desde ${desde}`]
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
