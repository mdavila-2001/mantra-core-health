import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type {
  MedicalGroup,
  MedicalGroupDecision,
  MedicalGroupMember,
} from '../../core/data-access/medical-groups/medical-groups.types';
import { MEDICAL_GROUP_LIMITS } from '../../core/data-access/medical-groups/medical-groups.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf } from '../../core/view-state/view-state';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FactList } from '../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../shared/components/molecules/fact-list/fact-list.types';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { DatePicker } from '../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  INVITATION_LABEL,
  INVITATION_TONE,
  statusLabel,
  statusTone,
} from './medical-group-labels';
import { MedicalGroupWriteError } from './medical-group-write-error';
import { MEDICAL_GROUPS_ROUTE, MEDICAL_GROUP_TAB_QUERY_PARAM } from './medical-groups.routes';
import { MedicalGroupsService } from './medical-groups.service';

/** Las pestañas de la ficha, en orden: el nombre es el que viaja en `?pestana=`. */
export const MEDICAL_GROUP_TABS_ORDER = ['resumen', 'equipo', 'horario', 'notas'] as const;

/**
 * **Ficha de un grupo médico** (FT-21) — UNA tarjeta con pestañas, centrada y a
 * lo ancho del área de contenido (`composition-rules.md` §5).
 *
 * - **Resumen**: el servicio, el paciente, la fecha, el lugar y los términos.
 * - **Equipo**: el roster con el pago acordado y la respuesta de cada cargo.
 *   Quien tiene una invitación sin responder la acepta o la rechaza acá.
 * - **Horario**: la fecha y, si hay, el cambio propuesto. Un integrante propone
 *   otra fecha; el creador acepta o rechaza la que le proponen.
 * - **Notas del ejercicio**: lo ocurrido en el procedimiento, desde que se
 *   realiza y hasta una semana después.
 *
 * Ningún control decide por la API: los botones se ofrecen según lo que la ficha
 * ya trae (`isClosed`, `canEditExerciseNotes`, `status`) y la API sigue siendo
 * quien acepta o rechaza cada escritura. Un rechazo se muestra tal cual llega.
 *
 * Como `app-tab` no dibuja el panel cerrado, lo que se escribe vive en señales
 * del componente y no en los controles de la pestaña.
 */
@Component({
  selector: 'app-medical-group-detail',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DatePicker,
    DatePipe,
    FactList,
    FormField,
    MedicalGroupWriteError,
    PageHeader,
    RouterLink,
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
  private readonly service = inject(MedicalGroupsService);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly listRoute = MEDICAL_GROUPS_ROUTE;
  protected readonly invitationLabel = INVITATION_LABEL;
  protected readonly invitationTone = INVITATION_TONE;
  protected readonly statusLabel = statusLabel;
  protected readonly statusTone = statusTone;
  protected readonly notesLimit = MEDICAL_GROUP_LIMITS.exerciseNotesText;

  protected readonly state = this.service.detail;
  protected readonly saving = this.service.saving;
  protected readonly writeError = this.service.writeError;
  protected readonly group = computed(() => dataOf(this.state()));

  protected readonly tabIndex = signal(0);
  /** Qué respondió la persona, para decirlo con palabras debajo de la acción. */
  protected readonly notice = signal<string | null>(null);

  private groupId = '';

  /* ---- quién es quién ------------------------------------------------------- */

  private readonly myProfileId = this.service.myProfileId;

  protected readonly isCreator = computed(() => {
    const group = this.group();
    return group !== null && group.requestingPractitionerId === this.myProfileId();
  });

  protected readonly myMember = computed<MedicalGroupMember | null>(() => {
    const mine = this.myProfileId();
    return this.group()?.members.find((member) => member.practitionerProfileId === mine) ?? null;
  });

  /** Puede escribir quien creó el grupo o aceptó su cargo; la API lo vuelve a comprobar. */
  private readonly isActiveMember = computed(
    () => this.isCreator() || this.myMember()?.invitationStatus === 'ACCEPTED',
  );

  /* ---- invitación ------------------------------------------------------------ */

  protected readonly canRespond = computed(() => {
    const group = this.group();
    return group !== null && !group.isClosed && this.myMember()?.invitationStatus === 'PENDING';
  });
  protected readonly confirmingReject = signal(false);

  /* ---- horario --------------------------------------------------------------- */

  protected readonly proposedDate = signal<Date | null>(null);
  protected readonly minProposal = new Date();

  protected readonly canPropose = computed(() => {
    const group = this.group();
    return (
      group !== null &&
      group.status === 'SCHEDULED' &&
      !group.isClosed &&
      !group.isRealized &&
      this.isActiveMember()
    );
  });

  protected readonly canResolveProposal = computed(() => {
    const group = this.group();
    return (
      group !== null &&
      group.status === 'RESCHEDULE_PENDING' &&
      group.proposedRescheduleAt !== undefined &&
      this.isCreator()
    );
  });

  /* ---- notas ----------------------------------------------------------------- */

  protected readonly notesDraft = signal('');
  private notesEdited = false;

  protected readonly canEditNotes = computed(
    () => (this.group()?.canEditExerciseNotes ?? false) && this.isActiveMember(),
  );

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const group = this.group();
    if (group === null) return [];
    return [
      { etiqueta: 'Servicio', valor: this.label(group.serviceCatalogId, 'Servicio del catálogo'), icono: 'tag' },
      {
        etiqueta: 'Paciente',
        valor:
          group.patientProfileId === undefined
            ? 'Sin paciente asociado'
            : this.label(group.patientProfileId, 'Paciente'),
        icono: 'people',
      },
      {
        etiqueta: 'Diagnóstico',
        valor: group.conditionId === undefined ? null : this.label(group.conditionId, 'Diagnóstico del paciente'),
        icono: 'stethoscope',
      },
      { etiqueta: 'Lugar', valor: group.locationText, icono: 'pin' },
      {
        etiqueta: 'Organiza',
        valor: this.label(group.requestingPractitionerId, 'Profesional'),
        icono: 'briefcase',
      },
      { etiqueta: 'Estado', valor: statusLabel(group.status), icono: 'flag' },
    ];
  });

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      this.groupId = params.get('groupId') ?? '';
      this.notesEdited = false;
      this.notice.set(null);
      this.service.clearWriteError();
      this.service.loadDetail(this.groupId);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((params) => {
      const index = MEDICAL_GROUP_TABS_ORDER.indexOf(
        (params.get(MEDICAL_GROUP_TAB_QUERY_PARAM) ?? 'resumen') as (typeof MEDICAL_GROUP_TABS_ORDER)[number],
      );
      this.tabIndex.set(Math.max(index, 0));
    });
  }

  protected label(id: string, fallback: string): string {
    return this.service.labelOf(id, fallback);
  }

  protected memberName(member: MedicalGroupMember): string {
    return this.label(member.practitionerProfileId, 'Profesional invitado');
  }

  protected changeTab(index: number): void {
    this.tabIndex.set(index);
    this.notice.set(null);
    this.service.clearWriteError();
  }

  protected reload(): void {
    this.service.loadDetail(this.groupId);
  }

  /* ---- acciones --------------------------------------------------------------- */

  protected respond(decision: MedicalGroupDecision): void {
    const member = this.myMember();
    if (member === null) return;
    this.service.respondToInvitation(this.groupId, member, decision).subscribe(() => {
      this.confirmingReject.set(false);
      this.notice.set(
        decision === 'ACCEPTED' ? 'Aceptó su cargo en el grupo.' : 'Rechazó su cargo en el grupo.',
      );
    });
  }

  protected propose(): void {
    const date = this.proposedDate();
    if (date === null) return;
    this.service.requestReschedule(this.groupId, date.toISOString()).subscribe(() => {
      this.proposedDate.set(null);
      this.notice.set(
        this.isCreator()
          ? 'La nueva fecha quedó aplicada.'
          : 'Su propuesta quedó enviada: el creador del grupo tiene que resolverla.',
      );
    });
  }

  protected resolveProposal(decision: MedicalGroupDecision): void {
    this.service.respondToReschedule(this.groupId, decision).subscribe(() => {
      this.notice.set(
        decision === 'ACCEPTED' ? 'Aceptó el nuevo horario.' : 'Rechazó el nuevo horario: sigue la fecha anterior.',
      );
    });
  }

  protected editNotes(text: string): void {
    this.notesEdited = true;
    this.notesDraft.set(text);
  }

  /** El borrador es lo escrito; si no se tocó nada, lo guardado en la ficha. */
  protected notesValue(group: MedicalGroup): string {
    return this.notesEdited ? this.notesDraft() : (group.exerciseNotesText ?? '');
  }

  protected saveNotes(group: MedicalGroup): void {
    const text = this.notesValue(group);
    this.service.saveExerciseNotes(this.groupId, text).subscribe(() => {
      this.notesEdited = false;
      this.notice.set('Las notas del ejercicio quedaron guardadas.');
    });
  }
}
