import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { ClinicalClient } from '@core/data-access/clinical/clinical.client';
import type {
  ClinicalSummary,
  Encounter,
} from '@core/data-access/clinical/clinical.types';
import { CommunityClient } from '@core/data-access/community/community.client';
import { errorToViewState } from '@core/http/error-to-view-state';
import { loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';

/**
 * Cómo se escribe la fecha de cada atención en el selector.
 *
 * `Intl` y no `DatePipe`: el pipe imperativo exige que la locale esté
 * registrada en el inyector, y acá se usa fuera de una plantilla —en una
 * función pura— donde no hay inyector al que preguntárselo.
 */
const FORMATO_DE_FECHA = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' });

/** Marca del concepto de estado de un encuentro terminado. */
const ENCUENTRO_TERMINADO = 'ENC_FINISHED';

/** Las estrellas que se pueden poner, de mejor a peor. */
const PUNTAJES = [5, 4, 3, 2, 1] as const;

/** Qué significa cada puntaje, para que el número no vaya solo. */
const LEYENDA: Readonly<Record<number, string>> = {
  5: 'Excelente',
  4: 'Buena',
  3: 'Regular',
  2: 'Mala',
  1: 'Muy mala',
};

/**
 * Calificar **una atención recibida**, desde el portal del paciente (C.2).
 *
 * ## Por qué el formulario pregunta cuál atención
 *
 * Porque es el encuentro el que identifica lo que se califica, y de él deriva
 * el servidor a quién. La ficha pública se abre por slug y **no publica el id
 * de la vitrina** —un identificador interno regalado a un anónimo no se vuelve
 * a esconder—, así que el paciente no puede nombrar al profesional aunque lo
 * esté mirando. Nombra su atención, que sí es suya.
 *
 * ## Sólo se ofrecen las atenciones terminadas
 *
 * Una consulta en curso no se califica: el servidor la rechaza, y ofrecerla
 * sería invitar a un error que sólo se descubre al enviar. Si la lista queda
 * vacía, el diálogo lo dice en vez de mostrar un formulario que no puede
 * terminar.
 *
 * ## El anonimato es del autor, no del sistema
 *
 * La casilla decide si la opinión sale firmada con su nombre o como «Paciente
 * verificado». El servidor guarda esa decisión, y la lectura pública ni
 * siquiera pide el nombre de quien eligió el anonimato.
 */
@Component({
  selector: 'app-rate-encounter-dialog',
  imports: [
    Alert,
    AppButton,
    Checkbox,
    ContentDialog,
    FormField,
    Select,
    Textarea,
  ],
  templateUrl: './rate-encounter-dialog.html',
  styleUrl: './rate-encounter-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateEncounterDialog implements OnInit {
  private readonly clinical = inject(ClinicalClient);
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** A quién se está calificando, sólo para el texto del diálogo. */
  readonly professionalName = input.required<string>();

  /** Se cerró sin guardar. */
  readonly closed = output<void>();

  /** Se publicó la opinión. */
  readonly saved = output<void>();

  protected readonly atenciones = signal<readonly Encounter[]>([]);
  protected readonly cargandoAtenciones = signal(true);

  protected readonly encuentro = signal<string | null>(null);
  protected readonly puntaje = signal(5);
  protected readonly comentario = signal('');
  protected readonly anonimo = signal(true);

  protected readonly estado = signal<ViewState<null>>(ready(null));
  protected readonly puntajes = PUNTAJES;

  /** Las atenciones terminadas, como opciones del selector. */
  protected readonly opciones = computed<readonly SelectOption<string>[]>(() =>
    this.atenciones().map((atencion) => ({
      value: atencion.id,
      label: rotuloDeAtencion(atencion),
    })),
  );

  protected readonly enviando = computed(() => this.estado().status === 'loading');

  protected readonly puedeEnviar = computed(
    () => this.encuentro() !== null && !this.enviando(),
  );

  /**
   * El fallo del envío, en palabras.
   *
   * El 422 del servidor —«esa atención no fue con este profesional», «todavía
   * no terminó», «ya la calificaste»— se muestra **tal como viene**: es
   * específico y accionable, y reemplazarlo por un genérico le quitaría a la
   * persona la única pista de qué corregir.
   */
  protected readonly error = computed<string | null>(() => {
    const estado = this.estado();
    if (estado.status === 'validation') {
      return estado.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (estado.status === 'forbidden') {
      return estado.message ?? 'Tu cuenta no puede calificar atenciones.';
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return estado.message || 'No pudimos publicar tu opinión.';
    }
    return null;
  });

  ngOnInit(): void {
    const paciente = this.auth.patientProfileId();
    if (paciente === null) {
      this.cargandoAtenciones.set(false);
      return;
    }
    this.clinical.getSummary(paciente).subscribe({
      next: (resumen: ClinicalSummary) => {
        const terminadas = resumen.encounters.filter(estaTerminada);
        this.atenciones.set(terminadas);
        // Con una sola no hay nada que elegir: se elige sola.
        if (terminadas.length === 1) {
          this.encuentro.set(terminadas[0].id);
        }
        this.cargandoAtenciones.set(false);
      },
      error: () => {
        this.atenciones.set([]);
        this.cargandoAtenciones.set(false);
      },
    });
  }

  /** Publica la opinión. */
  protected enviar(): void {
    const encuentro = this.encuentro();
    if (encuentro === null || this.enviando()) {
      return;
    }
    const texto = this.comentario().trim();
    this.estado.set(loading());
    this.community
      .publishOwnReview({
        verifiedEncounterId: encuentro,
        overallRating: this.puntaje(),
        ...(texto === '' ? {} : { reviewText: texto }),
        displayMode: this.anonimo() ? 'ANONYMOUS' : 'REAL_NAME',
      })
      .subscribe({
        next: () => {
          this.estado.set(ready(null));
          this.toasts.success(
            'Ya figura entre las opiniones de este profesional.',
            'Gracias por calificar',
          );
          this.saved.emit();
        },
        error: (error: unknown) => {
          this.estado.set(errorToViewState<null>(error));
        },
      });
  }

  /** Qué dice cada estrella, para que el número no vaya solo. */
  protected leyenda(puntaje: number): string {
    return LEYENDA[puntaje] ?? '';
  }
}

/**
 * Cómo se nombra una atención en el selector.
 *
 * La fecha primero porque es por lo que alguien la reconoce; el motivo
 * después, y sólo si lo hay — «Consulta» a secas es mejor que un guion.
 *
 * @param atencion - El encuentro a rotular.
 * @returns El texto de la opción.
 */
function rotuloDeAtencion(atencion: Encounter): string {
  const fecha = atencion.startAt ? FORMATO_DE_FECHA.format(atencion.startAt) : null;
  const motivo = atencion.reasonText?.trim();
  return [fecha ?? 'Sin fecha', motivo || 'Consulta'].join(' · ');
}

/**
 * Si esa atención ya terminó.
 *
 * El estado llega como concepto y se compara por su **código**, no por un uuid
 * quemado acá: un identificador de base de datos escrito a mano en una
 * pantalla es un dato que nadie puede regenerar.
 *
 * @param atencion - El encuentro a evaluar.
 * @returns Si el encuentro está cerrado.
 */
function estaTerminada(atencion: Encounter): boolean {
  return atencion.statusConceptId.toUpperCase().includes(ENCUENTRO_TERMINADO);
}
