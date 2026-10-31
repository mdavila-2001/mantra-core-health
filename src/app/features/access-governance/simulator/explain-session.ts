import { computed, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  ExplainAccessResponse,
  ExplainAssume,
} from '../../../core/data-access/access-governance/access-explain.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready, stale } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { QuestionValue } from './explain-question/explain-question';
import { NO_ASSUMPTIONS, type AssumeChoices } from './explain-text';

/** Cómo se arma la petición de explicar: cada pantalla (administración, persona, doctor) pone la suya. */
export type ExplainRunner = (
  question: QuestionValue,
  assume: ExplainAssume | undefined,
) => Observable<ExplainAccessResponse>;

/** Contenido de un `QuestionValue` para los cuerpos de `explain` (lo que no se eligió, no viaja). */
export function questionBody(
  question: QuestionValue,
  assume?: ExplainAssume,
): {
  readonly action: never;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly patientProfileId?: string;
  readonly appointmentStartAt?: string;
  readonly at?: string;
  readonly assume?: ExplainAssume;
} {
  return {
    action: question.action as never,
    ...(question.practitionerRoleAssignmentId === undefined
      ? {}
      : { practitionerRoleAssignmentId: question.practitionerRoleAssignmentId }),
    ...(question.healthcareServiceId === undefined
      ? {}
      : { healthcareServiceId: question.healthcareServiceId }),
    ...(question.careSpaceId === undefined ? {} : { careSpaceId: question.careSpaceId }),
    ...(question.patientProfileId === undefined
      ? {}
      : { patientProfileId: question.patientProfileId }),
    ...(question.appointmentStartAt === undefined
      ? {}
      : { appointmentStartAt: question.appointmentStartAt }),
    ...(question.at === undefined ? {} : { at: question.at }),
    ...(assume === undefined ? {} : { assume }),
  };
}

/**
 * **La sesión de una explicación**: la pregunta, su estado (S2/S4/S5/S6/S7/S9), el resultado y los supuestos de «¿y si…?».
 * La comparten el simulador, «Mis accesos» y «Mi equipo»; cada uno le pasa cómo se arma su petición.
 *
 * Un resultado nuevo se pide sin supuestos; «¿y si…?» repite la misma pregunta con otros; si se toca un campo después de
 * ver un resultado, este pasa a S7 con la hora a la que se calculó.
 */
export class ExplainSession {
  readonly state = signal<ViewState<ExplainAccessResponse> | null>(null);
  readonly busy = signal(false);
  readonly assumed = signal<ExplainAssume | undefined>(undefined);
  readonly choices = signal<AssumeChoices>(NO_ASSUMPTIONS);
  readonly forceFull = signal(false);
  readonly current = computed(() => {
    const s = this.state();
    return s !== null && (s.status === 'ready' || s.status === 'stale') ? s.data : null;
  });
  private question: QuestionValue | null = null;

  constructor(private readonly run: ExplainRunner) {}

  /** Una pregunta nueva: arranca sin supuestos. */
  askFresh(question: QuestionValue): void {
    this.choices.set(NO_ASSUMPTIONS);
    this.forceFull.set(false);
    this.ask(question, undefined);
  }

  /** «¿Y si…?»: la misma pregunta con otros supuestos. */
  reask(assume: ExplainAssume | undefined): void {
    if (this.question !== null) this.ask(this.question, assume);
  }

  /** Reintentar (S9) o actualizar (S7) con lo que ya se había preguntado. */
  repeat(): void {
    this.reask(this.assumed());
  }

  /** Se tocó un campo después de ver un resultado: ese resultado es de la consulta anterior. */
  markStale(): void {
    const data = this.current();
    if (data !== null && this.state()?.status === 'ready')
      this.state.set(stale(data, new Date(data.evaluatedAt)));
  }

  /** La pregunta con la que se pidió el resultado que se ve (para acciones que la repiten, como aceptar un compromiso). */
  lastQuestion(): QuestionValue | null {
    return this.question;
  }

  private ask(question: QuestionValue, assume: ExplainAssume | undefined): void {
    this.question = question;
    this.assumed.set(assume);
    if (this.current() === null) this.state.set(loading());
    this.busy.set(true);
    this.run(question, assume).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.state.set(ready(response));
      },
      error: (failure: unknown) => {
        this.busy.set(false);
        this.state.set(errorToViewState<ExplainAccessResponse>(failure));
      },
    });
  }
}
