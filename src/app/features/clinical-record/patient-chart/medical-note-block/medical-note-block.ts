import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartNotesClient } from '../../../../core/data-access/chart-notes/chart-notes.client';
import type { CreateClinicalNoteInput } from '../../../../core/data-access/chart-notes/chart-notes.types';
import type {
  ChartNote,
  MedicalNoteEntry,
} from '../../../../core/data-access/clinical/clinical.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Accordion } from '../../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';

/** Hasta cuántas filas admite una nota. Más que eso ya es un formulario. */
export const TOPE_DE_FILAS = 40;
const TOPE_DEL_ROTULO = 60;
const TOPE_DEL_VALOR = 500;

/** Una fila a medio escribir, tal como la sostiene el formulario. */
export interface FilaEnCurso {
  readonly clave: number;
  readonly rotulo: string;
  readonly valor: string;
}

/** Una nota ya guardada, lista para dibujarse. */
export interface NotaVisible {
  readonly id: string;
  readonly versionId: string | null;
  /** «Nota #a1b2»: cuatro caracteres distinguen dos notas del mismo día. */
  readonly rotulo: string;
  readonly cuando: Date;
  readonly firmada: boolean;
  readonly autor: string;
  readonly hechos: readonly Hecho[];
  readonly texto: string | null;
}

/** «Presión Arterial» y «presion arterial» son el mismo campo. */
function normalizado(rotulo: string): string {
  return rotulo.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function filaVacia(clave: number): FilaEnCurso {
  return { clave, rotulo: '', valor: '' };
}

/**
 * **Nota médica** — la tabla campo/valor que la médica escribe en cada cita.
 *
 * ## Lo que pidió el propietario
 *
 * Literal: «en cada cita es posible realizar una observación, en la cual el
 * doctor escribe lo que se observa y cada observación tiene su respectivo ID …
 * es una tabla de valores donde los campos son más dinámicos y laxos …
 * llamadas notas médicas». No es un formulario con campos fijos ni una hoja
 * en blanco: es una lista de filas «campo: valor» que la médica arma como
 * quiere —«Presión arterial: 120/80», «Dolor: región lumbar, 6/10»— más un
 * texto libre si algo no entra en una fila.
 *
 * ## Una fila vacía al abrir, y Enter agrega la siguiente
 *
 * La primera fila está desde el principio porque la nota **es** sus filas:
 * abrir con un botón «Agregar fila» y nada más sería pedirle a la médica que
 * declare que va a escribir antes de escribir. Enter en el valor agrega una
 * fila y enfoca su campo: se dicta de corrido, sin soltar el teclado.
 *
 * ## Validación en vivo, no al guardar
 *
 * Un campo sin valor, un valor sin campo o dos filas con el mismo campo se
 * marcan debajo de la fila mientras se escribe. Guardar sólo se habilita
 * cuando no queda ningún problema y hay al menos una fila o un texto: la
 * misma regla que aplica el servidor, para que un 422 sea la excepción y no
 * la forma corriente de enterarse.
 *
 * ## El encuentro manda
 *
 * En la consulta la nota se escribe contra el encuentro en curso. Sin
 * encuentro abierto el formulario avisa y no guarda: una nota suelta, sin la
 * consulta a la que pertenece, es exactamente lo que el expediente no puede
 * tener.
 *
 * ## Firmar cierra la edición
 *
 * Una nota firmada deja de editarse desde acá: corregirla es una enmienda con
 * motivo (`amendmentReasonText`), que esta pantalla no ofrece todavía.
 */
@Component({
  selector: 'app-medical-note-block',
  imports: [
    Accordion,
    AccordionPanel,
    Alert,
    AppButton,
    AppInput,
    Badge,
    Card,
    DatePipe,
    FactList,
    FormActions,
    FormField,
    NgTemplateOutlet,
    Textarea,
    ViewStateHost,
  ],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => MedicalNoteBlock) }],
  templateUrl: './medical-note-block.html',
  styleUrl: './medical-note-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalNoteBlock implements DraftBlock {
  private readonly notes = inject(ChartNotesClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso. Sin él la nota no se guarda. */
  readonly encounterId = input<string | null>(null);

  /** Las citas del paciente. Se reciben por contrato del C0; la nota va al encuentro. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** Se emite cuando una nota quedó guardada. */
  readonly guardada = output<void>();

  protected readonly tope = TOPE_DE_FILAS;

  /* -- El formulario -------------------------------------------------------- */

  private proximaClave = 1;

  protected readonly filas = signal<readonly FilaEnCurso[]>([filaVacia(0)]);

  protected readonly textoLibre = signal('');

  protected readonly guardando = signal(false);

  /** El resultado de la última escritura. */
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  protected readonly hayEncuentro = computed(() => this.encounterId() !== null);

  /** Las filas donde alguien escribió algo: las vacías no cuentan ni se mandan. */
  protected readonly filasConContenido = computed(() =>
    this.filas().filter((fila) => fila.rotulo.trim() !== '' || fila.valor.trim() !== ''),
  );

  /**
   * El problema de cada fila con contenido, o `null` si está bien. Las filas
   * vacías no tienen problema: todavía no son nada.
   */
  protected readonly problemas = computed<ReadonlyMap<number, string | null>>(() => {
    const vistos = new Set<string>();
    const problemas = new Map<number, string | null>();
    for (const fila of this.filas()) {
      const rotulo = fila.rotulo.trim();
      const valor = fila.valor.trim();
      if (rotulo === '' && valor === '') {
        problemas.set(fila.clave, null);
        continue;
      }
      let problema: string | null = null;
      const clave = normalizado(rotulo);
      if (rotulo === '') {
        problema = 'Falta el campo.';
      } else if (rotulo.length > TOPE_DEL_ROTULO) {
        problema = `El campo admite hasta ${TOPE_DEL_ROTULO} caracteres.`;
      } else if (vistos.has(clave)) {
        problema = 'Ese campo ya está en otra fila.';
      } else if (valor === '') {
        problema = 'Falta el valor.';
      } else if (valor.length > TOPE_DEL_VALOR) {
        problema = `El valor admite hasta ${TOPE_DEL_VALOR} caracteres.`;
      }
      if (clave !== '') {
        vistos.add(clave);
      }
      problemas.set(fila.clave, problema);
    }
    return problemas;
  });

  protected readonly hayProblemas = computed(() =>
    Array.from(this.problemas().values()).some((problema) => problema !== null),
  );

  /** Lo que viaja: las filas con contenido, recortadas. */
  protected readonly entradas = computed<readonly MedicalNoteEntry[]>(() =>
    this.filasConContenido().map((fila) => ({
      label: fila.rotulo.trim(),
      value: fila.valor.trim(),
    })),
  );

  protected readonly pasaElTope = computed(() => this.filasConContenido().length > TOPE_DE_FILAS);

  protected readonly puedeGuardar = computed(
    () =>
      this.hayEncuentro() &&
      !this.guardando() &&
      !this.hayProblemas() &&
      !this.pasaElTope() &&
      this.auth.practitionerProfileId() !== null &&
      (this.entradas().length > 0 || this.textoLibre().trim() !== ''),
  );

  /** Contrato de `DraftBlock`: hay algo escrito que se perdería al cerrar. */
  readonly tieneCambiosPendientes = computed(
    () => this.filasConContenido().length > 0 || this.textoLibre().trim() !== '',
  );

  protected readonly errorDeLaNota = computed(() =>
    mensajeDeEscritura(this.resultado(), {
      accion: 'escribir la nota',
      sinPermiso: 'Tu rol no permite escribir notas médicas.',
    }),
  );

  /* -- Lo ya escrito --------------------------------------------------------- */

  /** Las notas de la persona. Vacío es un estado con su próxima acción, no una lista sin filas. */
  protected readonly notas = signal<ViewState<readonly ChartNote[]>>(loading());

  /** La nota que se está firmando, o `null`. */
  protected readonly firmando = signal<string | null>(null);

  private readonly notasVisibles = computed<readonly NotaVisible[]>(() => {
    const estado = this.notas();
    if (estado.status !== 'ready') {
      return [];
    }
    return estado.data.map((nota) => this.notaVisible(nota));
  });

  private readonly encuentroDe = computed(() => {
    const estado = this.notas();
    if (estado.status !== 'ready') {
      return new Map<string, string | undefined>();
    }
    return new Map(estado.data.map((nota) => [nota.noteId, nota.encounterId]));
  });

  /** Las de esta consulta, arriba y abiertas. */
  protected readonly deEstaConsulta = computed(() => {
    const encuentro = this.encounterId();
    if (encuentro === null) {
      return [];
    }
    return this.notasVisibles().filter((nota) => this.encuentroDe().get(nota.id) === encuentro);
  });

  /** Las de antes, plegadas: se consultan, no se leen de corrido. */
  protected readonly anteriores = computed(() => {
    const encuentro = this.encounterId();
    return this.notasVisibles().filter(
      (nota) => encuentro === null || this.encuentroDe().get(nota.id) !== encuentro,
    );
  });

  constructor() {
    effect(() => {
      this.patientProfileId();
      untracked(() => this.cargar());
    });
  }

  /* -- Filas ---------------------------------------------------------------- */

  protected problemaDe(clave: number): string {
    return this.problemas().get(clave) ?? '';
  }

  protected agregarFila(): void {
    if (this.filas().length >= TOPE_DE_FILAS) {
      return;
    }
    const clave = this.proximaClave++;
    this.filas.update((filas) => [...filas, filaVacia(clave)]);
    this.enfocarElCampoDe(clave);
  }

  /**
   * Quita la fila. Si era la única, queda una vacía en su lugar: la nota
   * nunca se muestra sin ninguna fila donde escribir.
   */
  protected quitarFila(clave: number): void {
    this.filas.update((filas) => {
      const restantes = filas.filter((fila) => fila.clave !== clave);
      return restantes.length === 0 ? [filaVacia(this.proximaClave++)] : restantes;
    });
  }

  protected fijarRotulo(clave: number, valor: string | number | null): void {
    const rotulo = valor === null ? '' : String(valor);
    this.filas.update((filas) =>
      filas.map((fila) => (fila.clave === clave ? { ...fila, rotulo } : fila)),
    );
  }

  protected fijarValor(clave: number, valor: string): void {
    this.filas.update((filas) =>
      filas.map((fila) => (fila.clave === clave ? { ...fila, valor } : fila)),
    );
  }

  /** Enter en el valor agrega la fila siguiente; Shift+Enter deja el salto de línea. */
  protected enterEnElValor(event: Event): void {
    if (!(event instanceof KeyboardEvent) || event.shiftKey || event.isComposing) {
      return;
    }
    event.preventDefault();
    this.agregarFila();
  }

  private enfocarElCampoDe(clave: number): void {
    this.changeDetector.detectChanges();
    this.host.nativeElement
      .querySelector<HTMLInputElement>(`[data-fila="${clave}"] input`)
      ?.focus();
  }

  /* -- Guardar y firmar ----------------------------------------------------- */

  protected guardar(): void {
    const encuentro = this.encounterId();
    const autor = this.auth.practitionerProfileId();
    if (!this.puedeGuardar() || encuentro === null || autor === null) {
      return;
    }
    const entradas = this.entradas();
    const texto = this.textoLibre().trim();
    const input: CreateClinicalNoteInput = {
      patientProfileId: this.patientProfileId(),
      authorProfileId: autor,
      encounterId: encuentro,
      ...(entradas.length === 0 ? {} : { entries: entradas }),
      ...(texto === '' ? {} : { subjectiveText: texto }),
    };

    this.guardando.set(true);
    this.resultado.set(loading());
    this.notes.createNote(input).subscribe({
      next: () => {
        this.guardando.set(false);
        this.resultado.set(ready(null));
        this.filas.set([filaVacia(this.proximaClave++)]);
        this.textoLibre.set('');
        this.toasts.success('La nota quedó guardada en esta consulta.');
        this.guardada.emit();
        this.cargar();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.resultado.set(errorToViewState(error));
      },
    });
  }

  protected firmar(nota: NotaVisible): void {
    if (nota.versionId === null || this.firmando() !== null) {
      return;
    }
    this.firmando.set(nota.id);
    this.resultado.set(ready(null));
    this.notes.signVersion(nota.id, nota.versionId).subscribe({
      next: () => {
        this.firmando.set(null);
        this.toasts.success(`${nota.rotulo} quedó firmada.`);
        this.guardada.emit();
        this.cargar();
      },
      error: (error: unknown) => {
        this.firmando.set(null);
        this.resultado.set(errorToViewState(error));
      },
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /* -- Lectura -------------------------------------------------------------- */

  private cargar(): void {
    this.notas.set(loading());
    this.notes.listNotes({ patientProfileId: this.patientProfileId(), limit: 50 }).subscribe({
      next: (page) => {
        this.notas.set(
          page.items.length === 0
            ? empty(
                { label: 'Escribí la primera nota' },
                'Todavía no hay ninguna nota de esta persona.',
              )
            : ready(page.items),
        );
      },
      error: (error: unknown) => this.notas.set(errorToViewState(error)),
    });
  }

  private notaVisible(nota: ChartNote): NotaVisible {
    const entradas = nota.entries ?? [];
    const propio = this.auth.practitionerProfileId();
    // Las notas de antes de C1 no tienen filas y traen sus apartados: se
    // muestran como filas para que la lista sea una sola cosa.
    const apartados: Hecho[] =
      entradas.length > 0
        ? []
        : [
            { etiqueta: 'Motivo de consulta', valor: nota.chiefComplaintText || null },
            { etiqueta: 'Subjetivo', valor: nota.subjectiveText || null },
            { etiqueta: 'Objetivo', valor: nota.objectiveText || null },
            { etiqueta: 'Evaluación', valor: nota.assessmentText || null },
            { etiqueta: 'Plan', valor: nota.planText || null },
          ];
    return {
      id: nota.noteId,
      versionId: nota.currentVersionId ?? null,
      rotulo: `Nota #${nota.noteId.replace(/-/g, '').slice(-4)}`,
      cuando: nota.signedAt ?? nota.createdAt,
      firmada: nota.signedAt !== undefined,
      autor:
        nota.authorProfileId === undefined
          ? 'Sin autor'
          : nota.authorProfileId === propio
            ? 'Vos'
            : 'Otro profesional',
      hechos: [
        ...entradas.map((fila) => ({ etiqueta: fila.label, valor: fila.value })),
        ...apartados,
      ],
      texto: entradas.length > 0 && nota.subjectiveText ? nota.subjectiveText : null,
    };
  }
}
