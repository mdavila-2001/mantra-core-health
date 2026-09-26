import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  InjectionToken,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, of, switchMap } from 'rxjs';
import type { WritableSignal } from '@angular/core';

import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { DiagnosisIaClient } from '../../../../core/data-access/triage-ia/diagnosis-ia.client';
import type {
  CategoriaDeOrdenIa,
  DiagnosticoTentativoIa,
  OrdenSugeridaIa,
  PruebaSugeridaIa,
  RespuestaDeFormulario,
  SugerenciaIa,
} from '../../../../core/data-access/triage-ia/diagnosis-ia.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { TARGET_CATEGORIA, TARGET_ESTUDIO } from '../analysis-order-block/analysis-order-block';
import { conceptIdPorCodigo } from '../demo-presets';
import { TARGET_DIAGNOSTICO } from '../diagnosis-block/diagnosis-block';

/**
 * Cuánto se espera después de la última respuesta antes de preguntarle a la
 * IA. Token para que las pruebas no tengan que esperar de verdad.
 */
export const ESPERA_DE_SUGERENCIAS_MS = new InjectionToken<number>('ESPERA_DE_SUGERENCIAS_MS', {
  providedIn: 'root',
  factory: () => 600,
});

/** La orden que quien atiende eligió pedir al cerrar la ficha. */
export interface OrdenDelCierre {
  readonly codeConceptId: string;
  readonly category: CategoriaDeOrdenIa;
  /** El concepto de la categoría, si el catálogo lo publica; es lo que el simulador guarda. */
  readonly categoryConceptId?: string;
}

/** Lo que el bloque emite cada vez que cambia una elección. Las dos son opcionales. */
export interface CierreDelFormulario {
  readonly diagnostico: string | null;
  readonly orden: OrdenDelCierre | null;
}

/** Los códigos con los que el catálogo nombra cada categoría de orden, en las dos convenciones vistas. */
const CODIGOS_DE_CATEGORIA: Readonly<Record<CategoriaDeOrdenIa, readonly string[]>> = {
  LAB: ['SRQ-LAB', 'SR_LAB'],
  IMAGING: ['SRQ-IMAGING', 'SR_IMAGING'],
  OTHER: ['SRQ-OTHER', 'SR_OTHER'],
};

const CATEGORIAS_EN_PALABRAS: Readonly<Record<CategoriaDeOrdenIa, string>> = {
  LAB: 'Laboratorio',
  IMAGING: 'Imagenología',
  OTHER: 'Otro',
};

/** Sin tildes, en minúscula y con un solo espacio: para comparar etiquetas, no para mostrarlas. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** `J18.9` → `J18`: la categoría de tres caracteres de ICD-10-CM. */
function categoriaIcd(codigo: string): string {
  return codigo.replace('.', '').slice(0, 3).toUpperCase();
}

/**
 * **Cierre del formulario** — D4 del Paquete 4.
 *
 * Con lo respondido en la ficha, le pide al servicio de IA diagnósticos
 * tentativos y análisis, y deja elegir —opcionalmente— un diagnóstico y una
 * orden que el bloque anfitrión registra al completar la ficha.
 *
 * ## La IA propone, el catálogo filtra, el médico decide
 *
 * Lo que sugiere el servicio son slugs de **su** glosario. Acá sólo se puede
 * elegir lo que existe en el catálogo de terminología de la plataforma: «Usar»
 * resuelve el ICD-10-CM (o el LOINC, o la etiqueta) contra las opciones del
 * selector y, si no hay correspondencia, lo dice y deja elegir a mano. Un
 * diagnóstico que no está en el catálogo no se inventa: no se registra.
 *
 * El `disclaimer` del servicio se muestra siempre que haya sugerencias, con
 * sus palabras: no es un diagnóstico, nace presuntivo y lo confirma o rechaza
 * el profesional.
 *
 * ## Sin servicio, el cierre sigue
 *
 * El cliente devuelve `null` ante cualquier fallo y el bloque lo dice; los dos
 * selectores quedan igual. La ficha se completa con o sin IA.
 *
 * ## Qué viaja al servicio
 *
 * Las preguntas de la ficha con sus respuestas en palabras. Nada más: ni el
 * nombre del paciente, ni identificadores, ni edad o sexo —esta pantalla no
 * los tiene a mano y el puntaje del servicio no depende de ellos.
 */
@Component({
  selector: 'app-form-conclusion-block',
  imports: [Alert, AppButton, Badge, Card, ConceptSelect, FormField, Select],
  templateUrl: './form-conclusion-block.html',
  styleUrl: './form-conclusion-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormConclusionBlock {
  private readonly ia = inject(DiagnosisIaClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly toasts = inject(ToastService);
  private readonly espera = inject(ESPERA_DE_SUGERENCIAS_MS);

  /** Las preguntas de la ficha con lo que se respondió, en palabras. */
  readonly respuestas = input<readonly RespuestaDeFormulario[]>([]);

  /** Cómo se llama la ficha, para decir de qué se está hablando. */
  readonly nombreDeFicha = input<string>('');

  /** Cada vez que cambia una elección. El anfitrión guarda la última. */
  readonly cierre = output<CierreDelFormulario>();

  protected readonly targetDiagnostico = TARGET_DIAGNOSTICO;
  protected readonly targetEstudio = TARGET_ESTUDIO;

  protected readonly categorias: readonly SelectOption<CategoriaDeOrdenIa | null>[] = [
    { value: null, label: 'Sin categoría' },
    { value: 'LAB', label: CATEGORIAS_EN_PALABRAS.LAB },
    { value: 'IMAGING', label: CATEGORIAS_EN_PALABRAS.IMAGING },
    { value: 'OTHER', label: CATEGORIAS_EN_PALABRAS.OTHER },
  ];

  /* -- La consulta a la IA -------------------------------------------------- */

  protected readonly consultando = signal(false);
  protected readonly sugerencia = signal<SugerenciaIa | null>(null);
  /** El servicio no respondió (o respondió otra cosa) la última vez. */
  protected readonly sinServicio = signal(false);
  /** Se preguntó al menos una vez con respuestas. */
  private readonly preguntado = signal(false);

  protected readonly hayRespuestas = computed(() =>
    this.respuestas().some((respuesta) => respuesta.answer.trim() !== ''),
  );

  protected readonly tentativos = computed<readonly DiagnosticoTentativoIa[]>(
    () => this.sugerencia()?.tentativeDiagnoses ?? [],
  );

  protected readonly ordenesSugeridas = computed<readonly OrdenSugeridaIa[]>(
    () => this.sugerencia()?.suggestedOrders ?? [],
  );

  /** Se preguntó, el servicio respondió, y no tenía nada que sugerir. */
  protected readonly sinSugerencias = computed(
    () =>
      this.preguntado() &&
      !this.consultando() &&
      !this.sinServicio() &&
      this.sugerencia() !== null &&
      this.tentativos().length === 0,
  );

  /* -- Lo elegido ----------------------------------------------------------- */

  protected readonly diagnostico = signal<string | null>(null);
  protected readonly categoriaDeOrden = signal<CategoriaDeOrdenIa | null>(null);
  protected readonly estudio = signal<string | null>(null);

  /** Hay un estudio elegido pero no su categoría: sin ella la orden no se pide. */
  protected readonly ordenIncompleta = computed(
    () => this.estudio() !== null && this.categoriaDeOrden() === null,
  );

  readonly tieneCambiosPendientes = computed(
    () => this.diagnostico() !== null || this.estudio() !== null,
  );

  /* -- Los catálogos, para resolver «Usar» ---------------------------------- */

  private readonly opcionesDiagnostico = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesEstudio = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesCategoria = signal<readonly DynamicEnumOption[]>([]);

  constructor() {
    // Cargarlas no cuesta peticiones extra: el cliente memoiza por target, así
    // que cada una es la misma petición que ya hace el selector correspondiente.
    this.cargarOpciones(TARGET_DIAGNOSTICO, this.opcionesDiagnostico);
    this.cargarOpciones(TARGET_ESTUDIO, this.opcionesEstudio);
    this.cargarOpciones(TARGET_CATEGORIA, this.opcionesCategoria);

    // Se pregunta cuando quien atiende deja de escribir, y una consulta nueva
    // cancela la anterior: la sugerencia que se muestra es siempre la de las
    // últimas respuestas.
    toObservable(this.respuestas)
      .pipe(
        debounceTime(this.espera),
        switchMap((respuestas) => {
          const conTexto = respuestas.filter((respuesta) => respuesta.answer.trim() !== '');
          if (conTexto.length === 0) {
            return of<SugerenciaIa | null | undefined>(undefined);
          }
          this.consultando.set(true);
          this.preguntado.set(true);
          return this.ia.sugerir({ answers: conTexto });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => {
        this.consultando.set(false);
        if (resultado === undefined) {
          // Sin respuestas no hay nada que preguntar ni nada viejo que mostrar.
          this.sugerencia.set(null);
          this.sinServicio.set(false);
          return;
        }
        this.sinServicio.set(resultado === null);
        this.sugerencia.set(resultado);
      });
  }

  private cargarOpciones(
    target: string,
    destino: WritableSignal<readonly DynamicEnumOption[]>,
  ): void {
    this.systemContext.dynamicEnum(target).subscribe({
      next: (enumeracion) => destino.set(enumeracion.options),
      error: () => destino.set([]),
    });
  }

  /* -- Elegir a mano -------------------------------------------------------- */

  protected elegirDiagnostico(conceptId: string | null): void {
    this.diagnostico.set(conceptId);
    this.emitir();
  }

  protected elegirCategoria(categoria: CategoriaDeOrdenIa | null): void {
    this.categoriaDeOrden.set(categoria);
    this.emitir();
  }

  protected elegirEstudio(conceptId: string | null): void {
    this.estudio.set(conceptId);
    this.emitir();
  }

  /* -- Usar una sugerencia -------------------------------------------------- */

  /**
   * Lleva un tentativo al selector de diagnóstico.
   *
   * Por código ICD-10-CM exacto primero (`J18.9`); si el catálogo no lo tiene,
   * por su categoría de tres caracteres (`J18`, o cualquier `J18.x`). Si nada
   * resuelve, se avisa y se deja elegir a mano: nunca se cae a «la primera
   * opción» —un diagnóstico equivocado en una historia clínica es peor que el
   * campo vacío.
   */
  protected usarTentativo(tentativo: DiagnosticoTentativoIa): void {
    const conceptId = this.conceptoDelDiagnostico(tentativo.code);
    if (conceptId === null) {
      this.toasts.warning(
        `«${tentativo.label}»${tentativo.code === null ? '' : ` (${tentativo.code})`} no está en el catálogo de diagnósticos. Elegilo a mano.`,
        'Sin correspondencia en el catálogo',
      );
      return;
    }
    this.diagnostico.set(conceptId);
    this.emitir();
  }

  /**
   * Lleva un análisis sugerido al selector de orden, con su categoría.
   *
   * Por LOINC exacto si el catálogo lo usa; si no, por etiqueta normalizada
   * («Radiografía de tórax»). Igual que el diagnóstico: sin correspondencia se
   * avisa y no se elige nada.
   */
  protected usarOrden(orden: PruebaSugeridaIa): void {
    const conceptId = this.conceptoDelEstudio(orden);
    if (conceptId === null) {
      this.toasts.warning(
        `«${orden.label}» no está en el catálogo de estudios. Elegilo a mano.`,
        'Sin correspondencia en el catálogo',
      );
      return;
    }
    this.categoriaDeOrden.set(orden.category);
    this.estudio.set(conceptId);
    this.emitir();
  }

  private conceptoDelDiagnostico(codigo: string | null): string | null {
    if (codigo === null) return null;
    const opciones = this.opcionesDiagnostico();
    const exacto = conceptIdPorCodigo(opciones, codigo);
    if (exacto !== null) return exacto;
    const categoria = categoriaIcd(codigo);
    return opciones.find((opcion) => categoriaIcd(opcion.code) === categoria)?.conceptId ?? null;
  }

  private conceptoDelEstudio(prueba: PruebaSugeridaIa): string | null {
    const opciones = this.opcionesEstudio();
    const porCodigo = prueba.code === null ? null : conceptIdPorCodigo(opciones, prueba.code);
    if (porCodigo !== null) return porCodigo;
    const etiqueta = normalizar(prueba.label);
    return opciones.find((opcion) => normalizar(opcion.display) === etiqueta)?.conceptId ?? null;
  }

  /** El concepto de una categoría de orden, si el catálogo publica su código. */
  private conceptoDeCategoria(categoria: CategoriaDeOrdenIa): string | undefined {
    for (const codigo of CODIGOS_DE_CATEGORIA[categoria]) {
      const conceptId = conceptIdPorCodigo(this.opcionesCategoria(), codigo);
      if (conceptId !== null) return conceptId;
    }
    return undefined;
  }

  private emitir(): void {
    const estudio = this.estudio();
    const categoria = this.categoriaDeOrden();
    const categoryConceptId = categoria === null ? undefined : this.conceptoDeCategoria(categoria);
    this.cierre.emit({
      diagnostico: this.diagnostico(),
      orden:
        estudio === null || categoria === null
          ? null
          : {
              codeConceptId: estudio,
              category: categoria,
              ...(categoryConceptId === undefined ? {} : { categoryConceptId }),
            },
    });
  }

  /* -- Cómo se lee ---------------------------------------------------------- */

  protected porcentaje(score: number): string {
    return `${Math.round(score * 100)} %`;
  }

  protected categoriaEnPalabras(categoria: CategoriaDeOrdenIa): string {
    return CATEGORIAS_EN_PALABRAS[categoria];
  }

  protected etiquetasDe(pruebas: readonly PruebaSugeridaIa[]): string {
    return pruebas.map((prueba) => prueba.label).join(', ');
  }
}
