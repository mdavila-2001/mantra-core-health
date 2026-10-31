import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { MedicalGroupsClient } from '../../../core/data-access/medical-groups/medical-groups.client';
import type {
  MedicalGroup,
  MedicalGroupDecision,
  MedicalGroupMember,
  NewMedicalGroupMember,
  UpdateMedicalGroupMember,
} from '../../../core/data-access/medical-groups/medical-groups.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type {
  Hecho,
  HechoTono,
} from '../../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  DATE_TIME_FORMAT,
  formatAmount,
  GROUP_STATUS_LABEL,
  INVITATION_STATUS_LABEL,
} from '../medical-groups.labels';
import { MEDICAL_GROUPS_ROUTE } from '../medical-groups.routes';

/** Lo que acepta la API en `agreedPaymentAmount`: positivo, hasta dos decimales. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;
/** Una semana después de la cita el expediente se cierra. */
const CLOSE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
 * - Creador, con el grupo sin realizar: **editar** el lugar y las notas,
 *   **eliminar** el grupo, y en Equipo **agregar, modificar y quitar** cargos.
 *   Cambiar el cargo o el pago de alguien vuelve a pedirle respuesta.
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
    DataTable,
    DatePicker,
    FactList,
    FormField,
    Input,
    PageHeader,
    Select,
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
  private readonly router = inject(Router);

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

  /* ---- permisos de gestión ---------------------------------------------------- */

  /**
   * El creador puede editar, eliminar y cambiar el equipo mientras el grupo no
   * se realizó ni se cerró. La API vuelve a validarlo: esto sólo decide qué se ofrece.
   */
  protected readonly canManage = computed(() => {
    const group = this.group();
    return group !== null && this.isCreator() && !group.isRealized && !group.isClosed;
  });

  /* ---- equipo como tabla ------------------------------------------------------ */

  private readonly roleCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupMember }>>('roleCell');
  private readonly personCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupMember }>>('personCell');
  private readonly paymentCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupMember }>>('paymentCell');
  private readonly invitationCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupMember }>>('invitationCell');
  private readonly memberActionsCell =
    viewChild.required<TemplateRef<{ $implicit: MedicalGroupMember }>>('memberActionsCell');

  protected readonly teamState = computed<ViewState<readonly MedicalGroupMember[]>>(() =>
    ready(this.group()?.members ?? []),
  );

  protected readonly teamColumns = computed<readonly ColumnDef<MedicalGroupMember>[]>(() => [
    { key: 'roleTitle', header: 'Cargo', priority: 1, cell: this.roleCell() },
    { key: 'practitionerName', header: 'Profesional', priority: 1, cell: this.personCell() },
    {
      key: 'agreedPaymentAmount',
      header: 'Pago acordado',
      priority: 1,
      align: 'end',
      cell: this.paymentCell(),
    },
    { key: 'invitationStatus', header: 'Estado', priority: 1, cell: this.invitationCell() },
    ...(this.canManage()
      ? [
          {
            key: 'acciones',
            header: 'Acciones',
            priority: 1,
            align: 'end' as const,
            cell: this.memberActionsCell(),
          },
        ]
      : []),
  ]);

  protected readonly memberId = (member: MedicalGroupMember): string => member.id;
  protected readonly memberLabel = (member: MedicalGroupMember): string =>
    `${member.roleTitle}, ${member.practitionerName ?? 'profesional sin nombre cargado'}`;

  protected readonly totalPayment = computed(() => {
    const total = (this.group()?.members ?? []).reduce(
      (sum, member) => sum + (Number(member.agreedPaymentAmount) || 0),
      0,
    );
    return formatAmount(total.toFixed(2));
  });

  /* ---- alta y edición de un cargo --------------------------------------------- */

  protected readonly memberDialogOpen = signal(false);
  /** `null` al agregar; el cargo, al modificar. */
  protected readonly editingMember = signal<MedicalGroupMember | null>(null);
  protected readonly memberPractitioner = signal<string | null>(null);
  protected readonly memberRole = signal('');
  protected readonly memberAmount = signal('');
  protected readonly memberTerms = signal('');
  protected readonly colleagues = signal<ViewState<readonly SelectOption<string>[]> | null>(null);

  protected readonly colleagueOptions = computed<readonly SelectOption<string>[]>(() => {
    const state = this.colleagues();
    if (state?.status !== 'ready') return [];
    const taken = new Set((this.group()?.members ?? []).map((m) => m.practitionerProfileId));
    return state.data.filter((option) => !taken.has(option.value));
  });

  protected readonly colleaguesPlaceholder = computed(() => {
    const state = this.colleagues();
    if (state === null || state.status === 'loading') return 'Cargando colegas…';
    if (state.status !== 'ready') return 'No pudimos traer a los colegas';
    return this.colleagueOptions().length === 0
      ? 'No quedan colegas por invitar'
      : 'Elija un colega';
  });

  protected readonly amountProblem = computed(() => {
    const amount = this.memberAmount().trim();
    return amount === '' || AMOUNT_PATTERN.test(amount)
      ? ''
      : 'Ingrese un monto positivo, con hasta dos decimales.';
  });

  protected readonly canSaveMember = computed(
    () =>
      (this.editingMember() !== null || this.memberPractitioner() !== null) &&
      this.memberRole().trim() !== '' &&
      AMOUNT_PATTERN.test(this.memberAmount().trim()),
  );

  protected text(value: string | number | null): string {
    return value === null ? '' : String(value);
  }

  protected openAddMember(): void {
    const group = this.group();
    if (group === null) return;
    this.editingMember.set(null);
    this.memberPractitioner.set(null);
    this.memberRole.set('');
    this.memberAmount.set('');
    this.memberTerms.set('');
    this.actionError.set(null);
    this.memberDialogOpen.set(true);
    this.colleagues.set(loading());
    this.groups.listEligibleMembers(group.serviceCatalogId).subscribe({
      next: (members) =>
        this.colleagues.set(
          ready(
            members.map((member) => ({
              value: member.practitionerProfileId,
              label: member.name ?? 'Profesional sin nombre cargado',
            })),
          ),
        ),
      error: (error: unknown) =>
        this.colleagues.set(errorToViewState<readonly SelectOption<string>[]>(error)),
    });
  }

  protected openEditMember(member: MedicalGroupMember): void {
    this.editingMember.set(member);
    this.memberRole.set(member.roleTitle);
    this.memberAmount.set(member.agreedPaymentAmount);
    this.memberTerms.set(member.additionalTermsText ?? '');
    this.actionError.set(null);
    this.memberDialogOpen.set(true);
  }

  protected saveMember(): void {
    const group = this.group();
    if (group === null || !this.canSaveMember()) return;
    const role = this.memberRole().trim();
    const amount = this.memberAmount().trim();
    const terms = this.memberTerms().trim();
    const editing = this.editingMember();
    this.memberDialogOpen.set(false);
    if (editing === null) {
      const member: NewMedicalGroupMember = {
        practitionerProfileId: this.memberPractitioner()!,
        roleTitle: role,
        agreedPaymentAmount: amount,
        ...(terms === '' ? {} : { additionalTermsText: terms }),
      };
      this.run(
        this.groups.addMember(group.id, member),
        'Sumó el cargo. La invitación queda sin responder.',
      );
      return;
    }
    const changes: UpdateMedicalGroupMember = {
      roleTitle: role,
      agreedPaymentAmount: amount,
      additionalTermsText: terms,
    };
    this.run(
      this.groups.updateMember(group.id, editing.id, changes),
      'Guardó el cargo. Le volvimos a pedir respuesta al profesional.',
    );
  }

  protected async removeMember(member: MedicalGroupMember): Promise<void> {
    const group = this.group();
    if (group === null) return;
    const confirmed = await this.dialogs.confirm({
      title: '¿Quitar este cargo del equipo?',
      message: `«${member.roleTitle}» (${member.practitionerName ?? 'profesional sin nombre cargado'}) deja de formar parte del grupo y su pago acordado se descarta.`,
      confirmLabel: 'Quitar del equipo',
      destructive: true,
    });
    if (!confirmed) return;
    this.run(this.groups.removeMember(group.id, member.id), 'Quitó el cargo del equipo.');
  }

  /* ---- editar y eliminar el grupo ---------------------------------------------- */

  protected readonly groupDialogOpen = signal(false);
  protected readonly locationDraft = signal('');
  protected readonly notesDraftText = signal('');

  protected readonly canSaveGroup = computed(() => this.locationDraft().trim() !== '');

  protected openEditGroup(): void {
    const group = this.group();
    if (group === null) return;
    this.locationDraft.set(group.locationText);
    this.notesDraftText.set(group.notesText ?? '');
    this.actionError.set(null);
    this.groupDialogOpen.set(true);
  }

  protected saveGroup(): void {
    const group = this.group();
    if (group === null || !this.canSaveGroup()) return;
    this.groupDialogOpen.set(false);
    this.run(
      this.groups.update(group.id, {
        locationText: this.locationDraft().trim(),
        notesText: this.notesDraftText().trim(),
      }),
      'Los datos del grupo quedaron guardados.',
    );
  }

  protected async deleteGroup(): Promise<void> {
    const group = this.group();
    if (group === null || this.working()) return;
    const confirmed = await this.dialogs.confirm({
      title: '¿Eliminar el grupo médico?',
      message:
        'Se elimina el grupo y todo su equipo. Las personas invitadas dejan de verlo. No se puede deshacer.',
      confirmLabel: 'Eliminar grupo',
      destructive: true,
    });
    if (!confirmed) return;
    this.working.set(true);
    this.actionError.set(null);
    this.groups.remove(group.id).subscribe({
      next: () => {
        this.working.set(false);
        this.toasts.success('El grupo médico quedó eliminado.');
        void this.router.navigateByUrl(MEDICAL_GROUPS_ROUTE);
      },
      error: (error: unknown) => {
        this.working.set(false);
        this.actionError.set(serverMessage(error));
      },
    });
  }

  /* ---- horario ------------------------------------------------------------------ */

  protected readonly schedule = computed<readonly Hecho[]>(() => {
    const group = this.group();
    if (group === null) return [];
    const status = this.statusLabel[group.status];
    const tone: Record<string, HechoTono> = {
      success: 'ok',
      warning: 'aviso',
      error: 'error',
    };
    return [
      { etiqueta: 'Fecha y hora', valor: DATE_TIME_FORMAT.format(group.scheduledAt) },
      { etiqueta: 'Lugar', valor: group.locationText },
      {
        etiqueta: 'Estado de la cita',
        valor: group.isRealized ? `${status.label} · ya se realizó` : status.label,
        tono: tone[status.variant] ?? 'neutro',
      },
      {
        etiqueta: group.isClosed ? 'Expediente cerrado desde' : 'El expediente se cierra',
        valor: DATE_TIME_FORMAT.format(new Date(group.scheduledAt.getTime() + CLOSE_WINDOW_MS)),
      },
    ];
  });

  /** Quién propuso el cambio de horario pendiente, si su nombre está cargado. */
  protected readonly proposerName = computed<string | null>(() => {
    const group = this.group();
    if (group?.proposedByPractitionerId === undefined) return null;
    return (
      group.members.find((m) => m.practitionerProfileId === group.proposedByPractitionerId)
        ?.practitionerName ?? null
    );
  });

  /** Por qué no se ofrece pedir el cambio de horario, dicho una vez y en claro. */
  protected readonly rescheduleBlocked = computed<string | null>(() => {
    const group = this.group();
    if (group === null || this.canRequestReschedule()) return null;
    if (group.isClosed) return 'El expediente está cerrado: el horario ya no se puede cambiar.';
    if (group.isRealized) return 'El grupo ya se realizó: el horario ya no se puede cambiar.';
    // Con un cambio propuesto, la pestaña ya dice quién lo resuelve.
    if (group.status === 'RESCHEDULE_PENDING') return null;
    if (group.status === 'PENDING_TEAM') {
      return 'El horario se puede cambiar cuando todo el equipo haya respondido la invitación.';
    }
    return 'Sólo quienes integran el equipo pueden pedir un cambio de horario.';
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
