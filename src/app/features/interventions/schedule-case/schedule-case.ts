import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { leerErrorDeInfraestructura } from '../../../core/data-access/infrastructure/infrastructure.rules';
import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import { canScheduleCases, reservedWindow } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { SurgicalCaseType } from '../../../core/data-access/procedures/procedures.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, forbidden, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { localDay, timeOf, toIso } from '../interventions.presentation';
import { caseRoute, INTERVENTIONS_ROUTE } from '../interventions.routes';

const CASE_TYPES: readonly SegmentedOption<SurgicalCaseType>[] = [
  { value: 'ELECTIVE', label: 'Electiva' },
  { value: 'URGENT', label: 'Urgente' },
  { value: 'EMERGENCY', label: 'Emergencia' },
];

/**
 * **Programar una intervención** — `POST /procedure-cases` con ventana reservada (F4).
 *
 * Una tarjeta a lo ancho (regla 6). Antes de enviar muestra la ventana que la
 * API va a reservar —inicio menos preparación, fin más limpieza— con los
 * minutos de la sala elegida. La API decide: un 409
 * `OPERATING_ROOM_SLOT_CONFLICT` trae la próxima ventana libre y se ofrece
 * usarla; un 409 `OR_BLOCK_OWNED_BY_OTHER` nombra al dueño del bloque.
 */
@Component({
  selector: 'app-schedule-case',
  imports: [Alert, AppButton, Card, FormField, Input, PageHeader, ReferenceCombobox, SegmentedControl, Select, Textarea, ViewStateHost],
  templateUrl: './schedule-case.html',
  styleUrl: './schedule-case.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleCase {
  private readonly operatingRooms = inject(OperatingRoomsClient);
  private readonly procedures = inject(ProceduresClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly specialtiesCatalog = inject(MedicalSpecialtiesCatalog);
  private readonly siteContext = inject(SiteContextStore);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly caseTypes = CASE_TYPES;
  protected readonly timeOf = timeOf;

  protected readonly rooms = signal<ViewState<readonly OperatingRoomSummary[]>>(loading());
  protected readonly specialties = signal<readonly SelectOption<string>[]>([]);
  protected readonly patientOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly searchingPatients = signal(false);

  protected readonly roomId = signal<string | null>(null);
  protected readonly patient = signal<ReferenceOption | null>(null);
  protected readonly surgeonId = signal<string | null>(null);
  protected readonly specialtyId = signal<string | null>(null);
  protected readonly caseType = signal<SurgicalCaseType>('ELECTIVE');
  protected readonly urgencyReason = signal('');
  protected readonly day = signal(localDay(new Date(Date.now() + 7 * 86_400_000)));
  protected readonly startTime = signal('08:00');
  protected readonly durationMinutes = signal<number>(120);

  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly nextFree = signal<string | null>(null);

  private readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);
  protected readonly allowed = computed(() => canScheduleCases(this.session.roles()));

  protected readonly page = computed<ViewState<readonly OperatingRoomSummary[]>>(() => {
    if (!this.allowed()) return forbidden({ message: 'Su rol no programa intervenciones: lo hacen la jefatura de quirófano, la programación quirúrgica y los cirujanos.' });
    const ctx = this.siteContext.state();
    return ctx.status === 'ready' || ctx.status === 'stale' ? this.rooms() : mapData(ctx, () => [] as readonly OperatingRoomSummary[]);
  });

  protected readonly roomOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.rooms()) ?? []).map((r) => ({ value: r.careSpace.id, label: `${r.careSpace.code} · ${r.careSpace.name}`, description: `${r.careSpace.path} · +${r.prepMinutes} prep / +${r.cleanupMinutes} limpieza` })),
  );

  protected readonly surgeonOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.siteContext.state())?.staff ?? []).map((s) => ({ value: s.practitionerProfileId, label: s.practitionerName ?? 'Profesional sin nombre', description: s.specialty?.display })),
  );

  private readonly room = computed(() => (dataOf(this.rooms()) ?? []).find((r) => r.careSpace.id === this.roomId()) ?? null);

  private readonly startIso = computed(() => {
    try {
      return /^\d{4}-\d{2}-\d{2}$/.test(this.day()) && /^\d{2}:\d{2}$/.test(this.startTime()) ? toIso(this.day(), this.startTime()) : null;
    } catch {
      return null;
    }
  });

  private readonly endIso = computed(() => {
    const start = this.startIso();
    const minutes = Number(this.durationMinutes());
    return start === null || !(minutes > 0) ? null : new Date(Date.parse(start) + minutes * 60_000).toISOString();
  });

  /** La ventana que la API va a reservar, para verla antes de enviar. */
  protected readonly preview = computed(() => {
    const room = this.room();
    const start = this.startIso();
    const end = this.endIso();
    return room === null || start === null || end === null ? null : { ...reservedWindow(start, end, room.prepMinutes, room.cleanupMinutes), prep: room.prepMinutes, cleanup: room.cleanupMinutes, start, end };
  });

  protected readonly valid = computed(
    () => this.room() !== null && this.patient() !== null && this.surgeonId() !== null && this.preview() !== null && (this.caseType() === 'ELECTIVE' || this.urgencyReason().trim().length > 0),
  );

  constructor() {
    this.siteContext.ensure();
    const q = this.route.snapshot.queryParamMap;
    if (q.get('room')) this.roomId.set(q.get('room'));
    if (q.get('day')) this.day.set(q.get('day')!);
    if (q.get('time')) this.startTime.set(q.get('time')!);
    effect(() => {
      const siteId = this.siteId();
      if (siteId === null) return;
      untracked(() =>
        this.operatingRooms.listOperatingRooms(siteId).subscribe({
          next: (rooms) => this.rooms.set(ready(rooms)),
          error: (error: unknown) => this.rooms.set(errorToViewState<readonly OperatingRoomSummary[]>(error)),
        }),
      );
    });
    this.specialtiesCatalog.listar().subscribe({
      next: (list) => this.specialties.set(list.filter((s) => s.selectable !== false).map((s) => ({ value: s.conceptId, label: s.display }))),
      error: () => this.specialties.set([]),
    });
  }

  protected searchPatients(text: string): void {
    if (text.trim() === '') {
      this.patientOptions.set([]);
      return;
    }
    this.searchingPatients.set(true);
    this.profiles.searchPatients({ query: text, limit: 10 }).subscribe({
      next: (page) => {
        this.patientOptions.set(page.items.map((p) => ({ value: p.profileId, label: p.displayName ?? p.patientCode, hint: p.patientCode })));
        this.searchingPatients.set(false);
      },
      error: () => {
        this.patientOptions.set([]);
        this.searchingPatients.set(false);
      },
    });
  }

  protected useNextFree(): void {
    const next = this.nextFree();
    if (next === null) return;
    const d = new Date(next);
    this.day.set(localDay(d));
    this.startTime.set(timeOf(d));
    this.nextFree.set(null);
    this.failure.set(null);
  }

  protected submit(): void {
    const room = this.room();
    const preview = this.preview();
    const patient = this.patient();
    const surgeon = this.surgeonId();
    const tenant = this.session.activeTenantId();
    if (!this.valid() || room === null || preview === null || patient === null || surgeon === null || tenant === null || this.sending()) return;
    this.sending.set(true);
    this.failure.set(null);
    this.nextFree.set(null);
    const specialty = this.specialtyId();
    this.procedures
      .scheduleCase({
        custodianTenantId: tenant,
        patientProfileId: patient.value,
        caseType: this.caseType(),
        priority: this.caseType() === 'ELECTIVE' ? 'ROUTINE' : this.caseType() === 'URGENT' ? 'URGENT' : 'STAT',
        primarySurgeonProfileId: surgeon,
        ...(this.siteId() === null ? {} : { practiceSiteId: this.siteId()! }),
        operatingRoomId: room.careSpace.id,
        scheduledStartAt: preview.start,
        scheduledEndAt: preview.end,
        ...(specialty === null ? {} : { surgicalSpecialtyConceptId: specialty }),
        ...(this.caseType() === 'ELECTIVE' ? {} : { urgencyReasonText: this.urgencyReason().trim() }),
      })
      .subscribe({
        next: (created) => {
          this.sending.set(false);
          void this.router.navigateByUrl(caseRoute(created.id));
        },
        error: (error: unknown) => {
          this.sending.set(false);
          const read = leerErrorDeInfraestructura(error);
          const next = read?.details['nextAvailableStartAt'];
          this.nextFree.set(read?.reason === 'OPERATING_ROOM_SLOT_CONFLICT' && typeof next === 'string' ? next : null);
          this.failure.set(errorToViewState<never>(error));
        },
      });
  }

  protected cancel(): void {
    void this.router.navigateByUrl(INTERVENTIONS_ROUTE);
  }
}
