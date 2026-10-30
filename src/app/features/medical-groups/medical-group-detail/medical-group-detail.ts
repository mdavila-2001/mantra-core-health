import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { MedicalGroupsClient } from '../../../core/data-access/medical-groups/medical-groups.client';
import type {
  MedicalGroup,
  MedicalGroupDecision,
  MedicalGroupMember,
} from '../../../core/data-access/medical-groups/medical-groups.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  DATE_TIME_FORMAT,
  formatAmount,
  GROUP_STATUS_LABEL,
  INVITATION_STATUS_LABEL,
} from '../medical-groups.labels';

/**
 * **Consulta de un grupo médico** (FT-21, carril 21) — el mismo formulario del
 * alta, lleno y sin editar, en UNA tarjeta centrada con pestañas (Resumen,
 * Equipo, Horario y Notas del ejercicio; `composition-rules.md` §5). El estado
 * y lo que pide una respuesta van arriba de las pestañas, a la vista desde
 * cualquiera de ellas.
 *
 * Las acciones aparecen sólo cuando la API las aceptaría, leyendo lo que ella
 * misma devuelve (`status`, `isRealized`, `canEditExerciseNotes`, `isClosed` y
 * la invitación propia). Ocultarlas no es la autorización: la API vuelve a
 * validar cada una y responde 404/412 si no corresponde.
 *
 * - Invitado con la invitación sin responder: **aceptar o rechazar** su cargo.
 * - Grupo programado y todavía no realizado: **solicitar cambio de horario**,
 *   que abre un modal con la fecha propuesta. Si la propone el creador, se
 *   reprograma directo; si la propone otro, queda pendiente del creador.
 * - Creador con un cambio propuesto por otro: **aceptar o rechazar** el cambio.
 * - Realizado y dentro de la semana: **cargar las notas del procedimiento**.
 *   Pasada la semana el expediente queda cerrado e inmutable.
 */
@Component({
  selector: 'app-medical-group-detail',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    ContentDialog,
    DatePicker,
    FactList,
    FormField,
    PageHeader,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './medical-group-detail.html',
  styleUrl: './medical-group-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupDetail {
  private readonly groups = inject(MedicalGroupsClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  private readonly route = inject(ActivatedRoute);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly statusLabel = GROUP_STATUS_LABEL;
  protected readonly invitationLabel = INVITATION_STATUS_LABEL;
  protected readonly formatAmount = formatAmount;

  /** La pestaña a la vista. Como `app-tab` no dibuja el cerrado, el estado vive acá. */
  protected readonly tab = signal(0);

  private readonly reloads = signal(0);
  protected readonly state = signal<ViewState<MedicalGroup>>(loading());

  constructor() {
    // Por `paramMap` y no por `snapshot`: al ir de un grupo a otro el
    // componente se reusa y el id cambia debajo.
    combineLatest([this.route.paramMap, toObservable(this.reloads)])
      .pipe(
        map(([params]) => params.get('id') ?? ''),
        switchMap((id) =>
          this.groups.get(id).pipe(
            map((group) => ready(group)),
            catchError((error: unknown) => of(errorToViewState<MedicalGroup>(error))),
            startWith<ViewState<MedicalGroup>>(loading()),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected readonly group = computed(() => {
    const state = this.state();
    return state.status === 'ready' || state.status === 'stale' ? state.data : null;
  });

  private readonly me = computed(() => this.auth.practitionerProfileId());

  protected readonly isCreator = computed(
    () => this.group()?.requestingPractitionerId === this.me(),
  );

  /** Mi lugar en el equipo, si lo tengo. */
  protected readonly myMembership = computed<MedicalGroupMember | null>(
    () => this.group()?.members.find((m) => m.practitionerProfileId === this.me()) ?? null,
  );

  protected readonly canAnswerInvitation = computed(
    () => this.myMembership()?.invitationStatus === 'PENDING' && !this.isCreator(),
  );

  private readonly inTeam = computed(
    () => this.isCreator() || this.myMembership()?.invitationStatus === 'ACCEPTED',
  );

  /** AC: en solicitudes aceptadas pero no realizadas, SOLICITAR CAMBIO DE HORARIO. */
  protected readonly canRequestReschedule = computed(() => {
    const group = this.group();
    return group !== null && this.inTeam() && group.status === 'SCHEDULED' && !group.isRealized;
  });

  /** El creador resuelve el cambio que propuso otro integrante. */
  protected readonly canAnswerReschedule = computed(() => {
    const group = this.group();
    return (
      group !== null &&
      this.isCreator() &&
      group.status === 'RESCHEDULE_PENDING' &&
      group.proposedByPractitionerId !== this.me()
    );
  });

  protected readonly canEditNotes = computed(
    () => (this.group()?.canEditExerciseNotes ?? false) && this.inTeam(),
  );

  protected readonly summary = computed<readonly Hecho[]>(() => {
    const group = this.group();
    if (group === null) return [];
    return [
      { etiqueta: 'Servicio de salud', valor: group.serviceName ?? 'Servicio sin nombre' },
      { etiqueta: 'Fecha y hora', valor: DATE_TIME_FORMAT.format(group.scheduledAt) },
      { etiqueta: 'Lugar', valor: group.locationText },
      {
        etiqueta: 'Paciente',
        valor:
          (group.patientProfileId ?? null) === null
            ? 'Sin paciente asociado'
            : (group.patientName ?? 'Se muestra cuando acepte la invitación'),
      },
      {
        etiqueta: 'Diagnóstico',
        valor:
          (group.conditionId ?? null) === null
            ? 'Sin diagnóstico asociado'
            : 'Registrado en el grupo',
      },
      { etiqueta: 'Notas adicionales', valor: group.notesText ?? null },
    ];
  });

  protected format(date: Date): string {
    return DATE_TIME_FORMAT.format(date);
  }

  protected retry(): void {
    this.reloads.update((n) => n + 1);
  }

  /* ---- invitación ------------------------------------------------------------ */

  protected readonly working = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected async answerInvitation(decision: MedicalGroupDecision): Promise<void> {
    const group = this.group();
    const membership = this.myMembership();
    if (group === null || membership === null) return;
    if (decision === 'REJECTED') {
      const confirmed = await this.dialogs.confirm({
        title: '¿Rechazar la invitación?',
        message: `Deja el cargo «${membership.roleTitle}» libre. Quien creó el grupo va a tener que invitar a otra persona.`,
        confirmLabel: 'Rechazar',
        destructive: true,
      });
      if (!confirmed) return;
    }
    this.run(
      this.groups.respondToInvitation(group.id, membership.id, decision),
      decision === 'ACCEPTED' ? 'Aceptó la invitación.' : 'Rechazó la invitación.',
    );
  }

  /* ---- cambio de horario ----------------------------------------------------- */

  protected readonly rescheduleOpen = signal(false);
  protected readonly proposedAt = signal<Date | null>(null);
  protected readonly now = new Date();

  /**
   * Abre vacío a propósito: precargado con la fecha vigente, «Proponer» quedaba
   * habilitado sin elegir nada y mandaba un cambio igual al horario actual.
   */
  protected openReschedule(): void {
    this.proposedAt.set(null);
    this.rescheduleOpen.set(true);
  }

  /** Proponer exige una fecha elegida y distinta de la vigente. */
  protected readonly canSendReschedule = computed(() => {
    const proposed = this.proposedAt();
    const current = this.group()?.scheduledAt;
    return proposed !== null && proposed.getTime() !== current?.getTime();
  });

  protected sendReschedule(): void {
    const group = this.group();
    const proposed = this.proposedAt();
    if (group === null || proposed === null) return;
    this.rescheduleOpen.set(false);
    this.run(
      this.groups.requestReschedule(group.id, proposed),
      this.isCreator()
        ? 'El grupo quedó reprogramado.'
        : 'Propuso el cambio de horario. Queda pendiente de quien creó el grupo.',
    );
  }

  protected answerReschedule(decision: MedicalGroupDecision): void {
    const group = this.group();
    if (group === null) return;
    this.run(
      this.groups.respondToReschedule(group.id, decision),
      decision === 'ACCEPTED' ? 'Aceptó el nuevo horario.' : 'Mantuvo el horario original.',
    );
  }

  /* ---- notas del ejercicio --------------------------------------------------- */

  protected readonly notesDraft = signal<string | null>(null);
  protected readonly notesValue = computed(
    () => this.notesDraft() ?? this.group()?.exerciseNotesText ?? '',
  );

  protected saveNotes(): void {
    const group = this.group();
    if (group === null) return;
    const text = this.notesValue().trim();
    if (text === '') {
      this.actionError.set('Escriba las notas del procedimiento antes de guardarlas.');
      return;
    }
    this.run(this.groups.updateExerciseNotes(group.id, text), 'Las notas quedaron guardadas.', () =>
      this.notesDraft.set(null),
    );
  }

  /** Una acción: la API devuelve el grupo actualizado, que reemplaza al que se veía. */
  private run(
    request: ReturnType<MedicalGroupsClient['get']>,
    success: string,
    after?: () => void,
  ): void {
    if (this.working()) return;
    this.working.set(true);
    this.actionError.set(null);
    request.subscribe({
      next: (group) => {
        this.working.set(false);
        this.state.set(ready(group));
        after?.();
        this.toasts.success(success);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.actionError.set(serverMessage(error));
      },
    });
  }
}

function serverMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = readApiError(error);
    if (body !== null && body.message !== '') return body.message;
  }
  return 'No pudimos guardar el cambio. Pruebe de nuevo.';
}
