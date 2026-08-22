import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { ProceduresClient } from '../../core/data-access/procedures/procedures.client';
import type {
  CaseTeamMember,
  SurgicalCase,
  TeamParticipationResponse,
} from '../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record/clinical-record.routes';

/** Tope de filas de la agenda. Alcanza una pantalla sin paginar. */
const TOPE = 50;

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/**
 * Las tres respuestas negativas, con el rótulo que las ofrece.
 *
 * Se enumeran enteras y no se colapsan en «rechazar»: pedir una modificación
 * es seguir queriendo participar, e informar indisponibilidad no objeta la
 * intervención. Al responsable le cambia qué hacer con cada una.
 */
const RESPUESTAS: readonly SelectOption<TeamParticipationResponse>[] = [
  { value: 'DECLINE', label: 'Rechazar la participación' },
  { value: 'REQUEST_CHANGE', label: 'Pedir una modificación' },
  { value: 'UNAVAILABLE', label: 'Informar indisponibilidad' },
];

/**
 * **Intervenciones médicas** (M53) — la agenda quirúrgica y la aceptación del
 * equipo.
 *
 * ## Qué contesta esta pantalla y qué no
 *
 * Contesta dos preguntas del profesional: *qué hay programado* y *qué me toca
 * confirmar a mí*. La primera sale de `GET /procedure-cases`, acotado siempre
 * al tenant por el backend; la segunda, del equipo de cada caso.
 *
 * No contesta *qué se le hizo a esta persona*: ése es el histórico, vive en la
 * ficha del paciente y ya lo pinta `procedures-block`. Duplicarlo acá obligaría
 * a elegir un paciente antes de ver la agenda, que es lo contrario de lo que
 * hace falta.
 *
 * ## Por qué la aceptación es el centro y no un detalle
 *
 * Porque sin ella el circuito no cierra. `POST /procedure-cases/:id/confirm`
 * exige que **cada** integrante con rol clínico haya aceptado; mientras alguno
 * no lo haya hecho, la intervención no se confirma por mucho que todo lo demás
 * esté en regla. La pantalla existe, sobre todo, para que ese acto tenga dónde
 * ocurrir.
 *
 * Las cuatro respuestas de la especificación se ofrecen enteras —aceptar,
 * rechazar, pedir una modificación, informar indisponibilidad— y no reducidas a
 * un sí/no: quien pide un cambio sigue queriendo participar, y al responsable
 * le cambia la decisión.
 *
 * ## Sólo se responde por uno mismo
 *
 * Los botones aparecen únicamente en la fila cuyo `practitionerProfileId`
 * coincide con el perfil profesional de la sesión. No es una decoración de
 * permisos: el backend rechaza responder por otro, y ofrecer el botón para que
 * después falle sería prometer algo que no se puede hacer.
 *
 * Quien no tiene perfil profesional en su cuenta ve la agenda y no ve ninguna
 * acción, que es exactamente su situación.
 *
 * ## Los estados se traducen; los uuid no se muestran
 *
 * `statusConceptId` y `teamRoleConceptId` son catálogo. Se resuelven con
 * `TerminologyClient.readConceptLabels` y, si la terminología falla, la agenda
 * se muestra igual con guiones: perder los nombres es molesto, perder la lista
 * entera porque el catálogo no respondió sería peor.
 */
@Component({
  selector: 'app-interventions',
  imports: [Alert, AppButton, Card, DataTable, DatePipe, PageHeader, Select, Textarea],
  templateUrl: './interventions.html',
  styleUrl: './interventions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Interventions {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly respuestas = RESPUESTAS;

  /** El perfil profesional de la sesión, o `null` si la cuenta no tiene uno. */
  protected readonly miPerfil = this.auth.practitionerProfileId;

  private readonly celdaCaso =
    viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaCaso');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaEstado');
  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaCuando');

  protected readonly agenda = signal<ViewState<readonly SurgicalCase[]>>(loading());

  /** El caso abierto, o `null` si no se abrió ninguno. */
  protected readonly casoAbierto = signal<SurgicalCase | null>(null);
  protected readonly equipo = signal<ViewState<readonly CaseTeamMember[]>>(loading());

  /** El integrante cuya respuesta negativa se está redactando. */
  protected readonly respondiendo = signal<CaseTeamMember | null>(null);
  protected readonly respuestaElegida = signal<TeamParticipationResponse>('DECLINE');
  protected readonly motivo = signal('');

  /** El acto en curso, para no dejar apretar dos veces el mismo botón. */
  protected readonly enviando = signal(false);

  /** El problema del último acto, ya traducido. Se limpia al reintentar. */
  protected readonly problema = signal<string | null>(null);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly cargando = computed(() => this.agenda().status === 'loading');

  protected readonly columnas = computed<readonly ColumnDef<SurgicalCase>[]>(() => [
    { key: 'caseNumber', header: 'Intervención', priority: 1, cell: this.celdaCaso() },
    { key: 'statusConceptId', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'scheduledStartAt', header: 'Programada', priority: 2, cell: this.celdaCuando() },
  ]);

  protected readonly porCaso = (fila: SurgicalCase): string => fila.id;
  protected readonly porIntegrante = (fila: CaseTeamMember): string => fila.id;

  /** El motivo no puede ir vacío: el backend lo exige y la pantalla también. */
  protected readonly motivoValido = computed(() => this.motivo().trim().length > 0);

  constructor() {
    effect(() => {
      untracked(() => this.cargar());
    });
  }

  /** La etiqueta de un concepto, o el guion si el catálogo no la tiene. */
  protected etiquetaDe(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /** ¿Es esta fila del equipo la de quien está mirando? */
  protected esMio(integrante: CaseTeamMember): boolean {
    const perfil = this.miPerfil();
    return perfil !== null && perfil === integrante.practitionerProfileId;
  }

  protected recargar(): void {
    this.cargar();
  }

  protected abrir(caso: SurgicalCase): void {
    this.casoAbierto.set(caso);
    this.cancelarRespuesta();
    this.cargarEquipo(caso.id);
  }

  protected cerrar(): void {
    this.casoAbierto.set(null);
    this.cancelarRespuesta();
  }

  protected aceptar(integrante: CaseTeamMember): void {
    const caso = this.casoAbierto();
    if (caso === null || this.enviando()) return;

    this.enviando.set(true);
    this.problema.set(null);
    this.procedures.acceptTeamMember(caso.id, integrante.id).subscribe({
      next: () => {
        this.enviando.set(false);
        this.cargarEquipo(caso.id);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.problema.set(mensajeDe(error));
      },
    });
  }

  protected empezarRespuesta(integrante: CaseTeamMember): void {
    this.respondiendo.set(integrante);
    this.respuestaElegida.set('DECLINE');
    this.motivo.set('');
    this.problema.set(null);
  }

  protected cancelarRespuesta(): void {
    this.respondiendo.set(null);
    this.motivo.set('');
  }

  /** El `null` del select vuelve al rechazo: es la respuesta por omisión. */
  protected elegirRespuesta(value: TeamParticipationResponse | null): void {
    this.respuestaElegida.set(value ?? 'DECLINE');
  }

  protected escribirMotivo(value: string): void {
    this.motivo.set(value);
  }

  protected enviarRespuesta(): void {
    const caso = this.casoAbierto();
    const integrante = this.respondiendo();
    if (caso === null || integrante === null || !this.motivoValido() || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.problema.set(null);
    this.procedures
      .respondTeamMember(caso.id, integrante.id, {
        response: this.respuestaElegida(),
        reasonText: this.motivo().trim(),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.cancelarRespuesta();
          this.cargarEquipo(caso.id);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.problema.set(mensajeDe(error));
        },
      });
  }

  private cargar(): void {
    this.agenda.set(loading());

    this.procedures
      .listAgenda({ limit: TOPE })
      .pipe(
        switchMap((pagina) =>
          forkJoin({
            pagina: of(pagina),
            etiquetas: this.terminology
              .readConceptLabels(pagina.items.map((caso) => caso.statusConceptId))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ pagina, etiquetas }) => {
          this.fusionarEtiquetas(etiquetas);

          if (pagina.items.length === 0) {
            // La salida no es «programar una intervención»: el alta nace de una
            // indicación clínica y de un quirófano disponible, no de esta
            // pantalla. Lo que sí puede hacer quien llegó hasta acá es mirar la
            // ficha de la persona que va a operar.
            this.agenda.set(
              empty(
                { label: 'Ir al archivo clínico', route: CLINICAL_RECORD_ROUTE },
                'No hay intervenciones programadas en la organización.',
              ),
            );
            return;
          }

          this.agenda.set(ready(pagina.items));
        },
        error: (error: unknown) =>
          this.agenda.set(errorToViewState<readonly SurgicalCase[]>(error)),
      });
  }

  private cargarEquipo(caseId: string): void {
    this.equipo.set(loading());

    this.procedures
      .listTeamMembers(caseId)
      .pipe(
        switchMap((integrantes) =>
          forkJoin({
            integrantes: of(integrantes),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDelEquipo(integrantes))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ integrantes, etiquetas }) => {
          this.fusionarEtiquetas(etiquetas);

          if (integrantes.length === 0) {
            // No debería pasar —programar el caso siembra al cirujano
            // principal—, pero un equipo vacío es un caso que nadie puede
            // confirmar, y decirlo es más útil que una tabla en blanco.
            this.equipo.set(
              empty(
                { label: 'Volver a la agenda' },
                'La intervención no tiene integrantes asignados.',
              ),
            );
            return;
          }

          this.equipo.set(ready(integrantes));
        },
        error: (error: unknown) =>
          this.equipo.set(errorToViewState<readonly CaseTeamMember[]>(error)),
      });
  }

  /**
   * Suma etiquetas sin perder las que ya había.
   *
   * La agenda y el equipo se leen por separado y traducen conceptos distintos.
   * Reemplazar el mapa en la segunda lectura dejaría la tabla de arriba sin sus
   * estados justo al abrir un caso.
   */
  private fusionarEtiquetas(nuevas: ConceptLabels): void {
    this.etiquetas.update((previas) => new Map([...previas, ...nuevas]));
  }
}

/** Los conceptos que la tabla del equipo necesita traducir. */
function conceptosDelEquipo(integrantes: readonly CaseTeamMember[]): readonly string[] {
  const ids: string[] = [];
  for (const integrante of integrantes) {
    ids.push(integrante.teamRoleConceptId, integrante.statusConceptId);
  }
  return ids;
}

/**
 * El error de un acto puntual, en una frase.
 *
 * No usa `errorToViewState` a propósito: aquélla decide qué **pantalla** se
 * pinta, y acá la pantalla ya está pintada —lo que falló es un botón—. El caso
 * que importa es el 422 de CAN-INT-002 (credencial no vigente), que no es un
 * fallo sino una precondición y tiene que leerse como tal.
 */
function mensajeDe(error: unknown): string {
  const estado = (error as { status?: number } | null)?.status;
  if (estado === 422) {
    return (
      'No se pudo registrar: el integrante no tiene una credencial profesional ' +
      'vigente, o la intervención ya no admite este acto.'
    );
  }
  if (estado === 403) {
    return 'Sólo el propio integrante puede responder a su participación.';
  }
  return 'No pudimos registrar la respuesta. Volvé a intentarlo.';
}
