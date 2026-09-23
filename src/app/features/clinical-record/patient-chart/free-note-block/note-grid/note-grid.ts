import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../../core/data-access/clinical/clinical.client';
import type {
  Encounter,
  Observation,
} from '../../../../../core/data-access/clinical/clinical.types';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../../core/data-access/terminology/terminology.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Spinner } from '../../../../../shared/components/atoms/spinner/spinner';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { TARGET_MEDICION } from '../../observation-block/observation-block';

/** Una columna de la cuadrícula: un concepto de terminología y su nombre. */
export interface ColumnaDeCuadricula {
  readonly conceptId: string;
  readonly nombre: string;
}

/** Una fila: lo registrado en **una** sesión, con su celda por columna. */
export interface FilaDeCuadricula {
  readonly encounterId: string;
  readonly fecha: Date | null;
  readonly motivo: string;
  readonly esLaDeAhora: boolean;
  readonly celdas: ReadonlyMap<string, string>;
}

/**
 * Cuántas sesiones se dibujan. Más que esto deja de ser una cuadrícula y pasa a
 * ser un informe, que es otra pantalla — ver `Q-M2` del plan.
 */
const TOPE_DE_FILAS = 12;

/** Lo que se muestra en una celda sin dato. No es `0` ni cadena vacía. */
const CELDA_VACIA = '—';

/**
 * **La cuadrícula de la consulta** — corrección **C-14**.
 *
 * ```html
 * <app-note-grid [patientProfileId]="id" [encounterId]="enc" (guardada)="recargar()" />
 * ```
 *
 * ## Qué pidió el cliente, textual
 *
 * > «…que tenga la vista de cuadrilla tipo excel que le permita seleccionar el
 * > nombre del header y poner filas, estas filas se deben cargar para la
 * > siguiente sesiones, y solo se puede registrar una fila por sesion si quiere
 * > mas debe decirle que por motivos de integridad de los datos solo se permite
 * > máximo una fila.»
 *
 * ## Dónde se guarda, y por qué ahí
 *
 * En `clinical.observations`, **una observación por celda llena**, todas con el
 * mismo `encounterId`. Es decir: **la fila no es un registro, es un grupo**. Las
 * tres piezas del pedido salen del contrato que ya existía:
 *
 * | Pieza del pedido | Campo |
 * |---|---|
 * | «seleccionar el nombre del header» | `codeConceptId`, elegido de terminología |
 * | «una fila por sesión» | `encounterId` — las observaciones que lo comparten **son** la fila |
 * | «se deben cargar para la siguiente sesiones» | `GET /clinical/patients/:id/summary` |
 *
 * ## Por qué NO se usan los `components` de la observación
 *
 * El contrato de escritura admite `components[]` —N celdas nombradas dentro de
 * **un** registro, que a primera vista es exactamente una fila—. No se usan:
 * `interface Observation`, que es lo que devuelve la lectura, **no los trae**, y
 * el backend simulado los descarta y sólo devuelve `componentIds` inventados al
 * vuelo. Guardar ahí sería escribir algo que la pantalla no puede releer nunca,
 * que es la misma mentira que el bloque de internación se prohíbe por escrito.
 *
 * ## Las columnas no se guardan en ningún lado, y es a propósito
 *
 * Son la unión de los `codeConceptId` que esa persona ya tiene medidos. Una
 * columna nueva existe desde que se la usa por primera vez y sobrevive porque
 * sobreviven sus observaciones. No hace falta inventar un catálogo de columnas
 * ni una tabla de definición.
 *
 * ## Pide sus propios datos
 *
 * En vez de recibir el expediente por `input`. El bloque que la contiene se
 * monta en **tres** pantallas y dos no son de este carril; darle entradas nuevas
 * obligaría a tocarlas. El costo es un `GET` extra al abrir la casilla.
 *
 * ## La fila de la sesión es de la sesión entera
 *
 * Si quien atiende ya registró una medición desde la casilla «Observación», esa
 * medición **es** la fila de hoy y la cuadrícula la muestra. No se marca de
 * ninguna forma especial lo que se escribió desde acá: hacerlo exigiría un
 * concepto de categoría que el catálogo no tiene, y acuñarlo sería inventar un
 * valor de catálogo.
 */
@Component({
  selector: 'app-note-grid',
  imports: [Alert, AppButton, ConceptSelect, DatePipe, FormField, Input, Spinner],
  templateUrl: './note-grid.html',
  styleUrl: './note-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoteGrid {
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** De quién es la historia. */
  readonly patientProfileId = input.required<string>();

  /** La consulta en curso, o `null` si se abrió desde el expediente. */
  readonly encounterId = input<string | null>(null);

  /** Se emite cuando la fila quedó guardada, para que el anfitrión relea. */
  readonly guardada = output<void>();

  /** El campo de terminología del que salen los nombres de cabecera. */
  protected readonly targetMedicion = TARGET_MEDICION;

  protected readonly cargando = signal(true);
  protected readonly falloAlCargar = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorAlGuardar = signal<string | null>(null);

  private readonly observaciones = signal<readonly Observation[]>([]);
  private readonly encuentros = signal<readonly Encounter[]>([]);
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /** Columnas agregadas en esta sesión que todavía no tienen ninguna medición. */
  private readonly columnasNuevas = signal<readonly string[]>([]);

  /** Lo tecleado, por `conceptId` de columna. */
  private readonly valores = signal<ReadonlyMap<string, string>>(new Map());

  /** La columna que el selector tiene elegida, antes de agregarla. */
  protected readonly columnaElegida = signal<string | null>(null);

  protected readonly organizacion = this.auth.activeTenantId;

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  constructor() {
    effect(() => {
      const paciente = this.patientProfileId();
      if (paciente !== '') {
        this.releer(paciente);
      }
    });
  }

  /* -- Lo que se dibuja ---------------------------------------------------- */

  /**
   * Las columnas, en orden alfabético por nombre con el `conceptId` de
   * desempate.
   *
   * Alfabético y no «por orden de aparición» porque la cuadrícula se relee en
   * cada sesión: un orden que dependa de qué se midió primero cambiaría de
   * lugar las columnas entre una consulta y la siguiente.
   */
  protected readonly columnas = computed<readonly ColumnaDeCuadricula[]>(() => {
    const ids = new Set<string>([
      ...this.observaciones().map((obs) => obs.codeConceptId),
      ...this.columnasNuevas(),
    ]);
    return [...ids]
      .map((conceptId) => ({ conceptId, nombre: this.nombreDe(conceptId) }))
      .sort(
        (a, b) =>
          a.nombre.localeCompare(b.nombre, 'es') || a.conceptId.localeCompare(b.conceptId),
      );
  });

  /**
   * Las filas ya registradas, de la más reciente a la más vieja.
   *
   * El desempate por `encounterId` no es decorativo: dos encuentros del mismo
   * día sin hora los dejaría en orden indefinido, y la cuadrícula cambiaría sola
   * entre dos lecturas de los mismos datos.
   */
  protected readonly filas = computed<readonly FilaDeCuadricula[]>(() => {
    const porEncuentro = new Map<string, Map<string, string>>();
    for (const obs of this.observaciones()) {
      if (obs.encounterId === undefined) continue;
      const celdas = porEncuentro.get(obs.encounterId) ?? new Map<string, string>();
      celdas.set(obs.codeConceptId, this.valorDe(obs));
      porEncuentro.set(obs.encounterId, celdas);
    }

    const encuentros = new Map(this.encuentros().map((enc) => [enc.id, enc]));
    const actual = this.encounterId();

    return [...porEncuentro.entries()]
      .map(([encounterId, celdas]) => {
        const encuentro = encuentros.get(encounterId);
        return {
          encounterId,
          fecha: encuentro?.startAt ?? null,
          motivo: encuentro?.reasonText ?? 'Consulta',
          esLaDeAhora: encounterId === actual,
          celdas,
        };
      })
      .sort((a, b) => {
        const fechaA = a.fecha?.getTime() ?? 0;
        const fechaB = b.fecha?.getTime() ?? 0;
        return fechaB - fechaA || a.encounterId.localeCompare(b.encounterId);
      });
  });

  /** Las que entran en pantalla. */
  protected readonly filasVisibles = computed(() => this.filas().slice(0, TOPE_DE_FILAS));

  /** Cuántas sesiones quedaron fuera por el tope. */
  protected readonly filasOcultas = computed(() =>
    Math.max(0, this.filas().length - TOPE_DE_FILAS),
  );

  /** La fila de esta sesión, si ya existe. Es la que activa la restricción. */
  protected readonly filaDeEstaSesion = computed<FilaDeCuadricula | null>(() => {
    const actual = this.encounterId();
    if (actual === null) return null;
    return this.filas().find((fila) => fila.encounterId === actual) ?? null;
  });

  /**
   * La restricción del pedido: una fila por sesión.
   *
   * Se evalúa sobre lo que el servidor devolvió, no sobre lo que escribimos:
   * una fila que existe porque la pintamos nosotros no frenaría nada.
   */
  protected readonly yaTieneFila = computed(() => this.filaDeEstaSesion() !== null);

  protected readonly puedeCargarFila = computed(
    () => this.hayEncuentro() && !this.sinOrganizacion() && !this.yaTieneFila(),
  );

  /** Sin una sola celda con algo, no hay fila que registrar. */
  protected readonly filaVacia = computed(() =>
    this.columnas().every((columna) => (this.valores().get(columna.conceptId) ?? '').trim() === ''),
  );

  protected readonly puedeGuardar = computed(
    () => this.puedeCargarFila() && !this.filaVacia() && !this.guardando(),
  );

  /** Ni columnas ni filas: el vacío de verdad, que tiene que orientar. */
  protected readonly vacio = computed(
    () => !this.cargando() && this.columnas().length === 0 && this.filas().length === 0,
  );

  /* -- Editar -------------------------------------------------------------- */

  protected valorDeColumna(conceptId: string): string {
    return this.valores().get(conceptId) ?? '';
  }

  protected escribir(conceptId: string, valor: string): void {
    const copia = new Map(this.valores());
    copia.set(conceptId, valor);
    this.valores.set(copia);
  }

  /**
   * Suma una columna a la cuadrícula.
   *
   * No escribe nada: una columna sin valor no es una medición, y guardarla
   * vacía dejaría una observación sin dato en la historia clínica.
   */
  protected agregarColumna(): void {
    const conceptId = this.columnaElegida();
    if (conceptId === null || conceptId === '') return;
    if (!this.columnas().some((columna) => columna.conceptId === conceptId)) {
      this.columnasNuevas.set([...this.columnasNuevas(), conceptId]);
    }
    this.columnaElegida.set(null);
  }

  protected celdaDe(fila: FilaDeCuadricula, conceptId: string): string {
    return fila.celdas.get(conceptId) ?? CELDA_VACIA;
  }

  /* -- Guardar ------------------------------------------------------------- */

  /**
   * Registra la fila de esta sesión: una observación por celda llena.
   *
   * Se mandan **en paralelo y se espera a todas**: si una falla, la fila quedó a
   * medias y hay que decirlo, no dar por buena la parte que entró.
   */
  protected guardar(): void {
    const custodianTenantId = this.organizacion();
    const encounterId = this.encounterId();
    const patientProfileId = this.patientProfileId();
    if (!this.puedeGuardar() || custodianTenantId === null || encounterId === null) {
      return;
    }

    const celdas = this.columnas()
      .map((columna) => ({
        codeConceptId: columna.conceptId,
        valor: (this.valores().get(columna.conceptId) ?? '').trim(),
      }))
      .filter((celda) => celda.valor !== '');

    this.guardando.set(true);
    this.errorAlGuardar.set(null);

    forkJoin(
      celdas.map((celda) => {
        const numero = Number(celda.valor.replace(',', '.'));
        const esNumero = celda.valor !== '' && Number.isFinite(numero);
        return this.clinical.createObservation({
          custodianTenantId,
          patientProfileId,
          codeConceptId: celda.codeConceptId,
          encounterId,
          // Las familias de valor del contrato son excluyentes, y se elige la
          // misma que la casilla «Observación»: gana el número cuando lo hay.
          ...(esNumero ? { quantityValue: numero } : { valueText: celda.valor }),
        });
      }),
    ).subscribe({
      next: () => {
        this.guardando.set(false);
        this.valores.set(new Map());
        this.columnasNuevas.set([]);
        this.toasts.success(
          'Queda como la fila de esta consulta y se va a ver en las próximas.',
          'Fila registrada',
        );
        this.releer(patientProfileId);
        this.guardada.emit();
      },
      error: () => {
        this.guardando.set(false);
        this.errorAlGuardar.set(
          'No pudimos registrar la fila. Lo que escribiste sigue acá: probá de nuevo.',
        );
      },
    });
  }

  protected reintentar(): void {
    this.releer(this.patientProfileId());
  }

  /* -- Leer ---------------------------------------------------------------- */

  /**
   * Relee el expediente y traduce los conceptos de las columnas.
   *
   * Las etiquetas van en la misma tubería que el resumen y no en una petición
   * aparte: con dos, la cuadrícula se dibujaría un instante con uuids por
   * cabecera.
   */
  private releer(patientProfileId: string): void {
    this.cargando.set(true);
    this.falloAlCargar.set(false);

    this.clinical
      .getSummary(patientProfileId)
      .pipe(
        switchMap((resumen) => {
          const ids = [...new Set(resumen.observations.map((obs) => obs.codeConceptId))];
          if (ids.length === 0) {
            return of({ resumen, etiquetas: new Map() as ConceptLabels });
          }
          return this.terminology.readConceptLabels(ids).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => ({ resumen, etiquetas })),
          );
        }),
      )
      .subscribe({
        next: ({ resumen, etiquetas }) => {
          this.observaciones.set(resumen.observations);
          this.encuentros.set(resumen.encounters);
          this.etiquetas.set(etiquetas);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.falloAlCargar.set(true);
        },
      });
  }

  /**
   * El nombre de una columna. **Nunca el uuid**: un encabezado que dice
   * `a3f1…` no es una cabecera, es una fuga del identificador a la pantalla.
   */
  private nombreDe(conceptId: string): string {
    return this.etiquetas().get(conceptId)?.display ?? 'Medición sin nombre';
  }

  /** El valor de una observación, por la primera familia presente. */
  private valorDe(observacion: Observation): string {
    const valor =
      observacion.quantityValue ?? observacion.valueDecimal ?? observacion.valueText ?? '';
    if (valor !== '') {
      return String(valor);
    }
    if (observacion.valueBoolean !== undefined) {
      return observacion.valueBoolean ? 'Sí' : 'No';
    }
    return CELDA_VACIA;
  }
}
