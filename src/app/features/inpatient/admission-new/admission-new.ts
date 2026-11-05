import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { AdmissionSourceCode, AttendingPractitioner, LevelOfCareCode, PlacementOverride } from '../../../core/data-access/adt/adt.types';
import { ruleLabel } from '../../../core/data-access/adt/bed-compatibility';
import { opsLabel } from '../../../core/data-access/infrastructure-ops/ops-labels';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { forbidden, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { Card } from '../../../shared/components/molecules/card/card';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiReason } from '../api-reason';
import { violationsOf } from '../bed-actions/placement-override';
import { InpatientAccessStore } from '../inpatient-access.store';
import { BED_BOARD_ROUTE, stayRoute } from '../inpatient-presentation';
import { BedPicker, type BedMode } from './bed-picker';

const opts = (codes: readonly string[]) => codes.map((value) => ({ value, label: opsLabel(value) }));
const LEVELS = opts(['LOC_CARE_GENERAL', 'LOC_CARE_INTERMEDIATE', 'LOC_CARE_ICU', 'LOC_CARE_NEONATAL_ICU']);
const SOURCES = opts(['ADM_SRC_EMERGENCY', 'ADM_SRC_OUTPATIENT', 'ADM_SRC_REFERRAL', 'ADM_SRC_BIRTH', 'ADM_SRC_TRANSFER_IN']);
const ISOLATIONS = [
  { value: 'ISO_NONE', label: 'Sin precaución' },
  { value: 'ISO_CONTACT', label: 'Contacto' },
  { value: 'ISO_DROPLET', label: 'Gotas' },
  { value: 'ISO_AIRBORNE', label: 'Aérea (sólo en AIIR)' },
  { value: 'ISO_PROTECTIVE', label: 'Ambiente protector' },
];

/** `?mode` de la URL: sólo los tres modos conocidos; cualquier otro valor es «asignar» (LOW). */
export function bedModeOf(value: string | null): BedMode {
  return value === 'RESERVE' || value === 'NONE' || value === 'ASSIGN' ? value : 'ASSIGN';
}

/**
 * **Nuevo ingreso** — `/inpatient/admissions/new` (F3.4).
 *
 * Una tarjeta ancha con `PaginatedForm` y su stepper: Paciente · Datos de
 * ingreso · Cama · Confirmar. Se puede ingresar sin cama. Al confirmar se va
 * a la ficha de la internación, que se lee de la API (no de esta respuesta).
 */
@Component({
  selector: 'app-admission-new',
  imports: [BedPicker, Card, CustomField, FactList, PageHeader, PaginatedForm, ReferenceCombobox, ViewStateHost],
  templateUrl: './admission-new.html',
  styleUrl: './admission-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionNew {
  private readonly adt = inject(AdtClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly access = inject(InpatientAccessStore);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly site = computed(() => this.access.pickSite(this.query().get('site'), 'f3.adt.place'));
  protected readonly siteId = computed(() => this.site()?.siteId ?? null);

  protected readonly gate = computed<ViewState<string>>(() => {
    const a = this.access.state();
    if (a.status !== 'ready') return a as ViewState<string>;
    const s = this.site();
    return s === null
      ? forbidden({ message: 'Ingresar pacientes es tarea de enfermería o admisión. Su rol en este establecimiento no lo permite.', nextAction: { label: 'Volver al tablero', route: BED_BOARD_ROUTE } })
      : ready(s.siteId);
  });

  protected readonly bedMode = signal<BedMode>(bedModeOf(this.route.snapshot.queryParamMap.get('mode')));
  protected readonly bedId = signal<string | null>(this.route.snapshot.queryParamMap.get('bed') || null);
  protected readonly override = signal<PlacementOverride | null>(null);
  protected readonly bedCode = signal<string | null>(null);
  private readonly bedOk = signal(false);

  readonly form = new FormGroup({
    patient: new FormControl<ReferenceOption | null>(null, { validators: [Validators.required] }),
    attending: new FormControl<string | null>(null),
    isolation: new FormControl<string>('ISO_NONE', { nonNullable: true }),
    organism: new FormControl<string>('', { nonNullable: true }),
    level: new FormControl<string | null>('LOC_CARE_GENERAL', { validators: [Validators.required] }),
    source: new FormControl<string | null>(null, { validators: [Validators.required] }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    expectedDischarge: new FormControl<Date | null>(null),
    bed: new FormControl<string | null>(null, { validators: [(c: AbstractControl): ValidationErrors | null => this.bedValidator(c)] }),
    summary: new FormControl<null>(null),
  });

  private readonly values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly patientId = computed(() => this.values().patient?.value ?? null);
  protected readonly level = computed(() => (this.values().level ?? null) as LevelOfCareCode | null);
  protected readonly isolation = computed(() => this.values().isolation ?? null);
  protected readonly organism = computed(() => this.values().organism?.trim() || null);

  protected readonly candidates = signal<readonly ReferenceOption[]>([]);
  protected readonly searching = signal(false);
  private readonly attendings = signal<readonly AttendingPractitioner[]>([]);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly pages = computed<readonly PaginaDeFormulario[]>(() => [
    {
      titulo: 'Paciente',
      clave: 'patient',
      icon: 'patients',
      disposicion: 'dos-columnas',
      campos: [
        { key: 'patient', label: 'Paciente', hint: 'Busque por nombre, código o documento.', control: 'custom', required: true, mensajeDeError: 'Elija a quién se interna.' },
        { key: 'attending', label: 'Profesional a cargo', hint: 'Opcional: se puede indicar después.', control: 'select', options: this.attendings().map((p) => ({ value: p.practitionerProfileId, label: p.specialty ? `${p.displayName} · ${p.specialty.display}` : p.displayName })) },
        { key: 'isolation', label: 'Precaución de aislamiento', control: 'select', options: ISOLATIONS },
        { key: 'organism', label: 'Organismo', hint: 'Para cohortes hace falta el mismo organismo.', control: 'text', showWhen: { key: 'isolation', equals: ['ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'] } },
      ],
    },
    {
      titulo: 'Datos de ingreso',
      clave: 'data',
      icon: 'clipboard',
      disposicion: 'dos-columnas',
      campos: [
        { key: 'level', label: 'Nivel de cuidado', control: 'select', required: true, options: LEVELS, mensajeDeError: 'Elija el nivel de cuidado.' },
        { key: 'source', label: 'Origen del ingreso', control: 'select', required: true, options: SOURCES, mensajeDeError: 'Elija de dónde viene.' },
        { key: 'reason', label: 'Motivo de internación', control: 'textarea', required: true, mensajeDeError: 'Escriba el motivo.' },
        { key: 'expectedDischarge', label: 'Alta prevista', hint: 'Opcional.', control: 'datetime' },
      ],
    },
    {
      titulo: 'Cama',
      clave: 'bed',
      icon: 'hospital',
      sinPartir: true,
      campos: [{ key: 'bed', label: 'Cama', hint: 'Sólo aparecen camas asignables: libres, disponibles e inspeccionadas.', control: 'custom', mensajeDeError: 'Elija una cama compatible, fuerce con justificación o ingrese sin cama.' }],
    },
    {
      titulo: 'Confirmar',
      clave: 'confirm',
      icon: 'flag',
      campos: [{ key: 'summary', label: 'Resumen', control: 'custom' }],
    },
  ]);

  protected readonly summary = computed<readonly Hecho[]>(() => {
    const v = this.values();
    const o = this.override();
    return [
      { etiqueta: 'Paciente', valor: v.patient?.label ?? null },
      { etiqueta: 'Profesional a cargo', valor: this.attendings().find((p) => p.practitionerProfileId === v.attending)?.displayName ?? null },
      { etiqueta: 'Nivel de cuidado', valor: LEVELS.find((l) => l.value === v.level)?.label ?? null },
      { etiqueta: 'Origen', valor: SOURCES.find((s) => s.value === v.source)?.label ?? null },
      { etiqueta: 'Precaución', valor: ISOLATIONS.find((i) => i.value === v.isolation)?.label ?? null },
      { etiqueta: 'Motivo', valor: v.reason || null },
      { etiqueta: 'Cama', valor: this.bedMode() === 'NONE' ? 'Pendiente de cama' : `${this.bedMode() === 'RESERVE' ? 'Reserva' : 'Asignación'} · ${this.bedCode() ?? 'sin elegir'}` },
      { etiqueta: 'Forzado', valor: o === null ? null : `${o.ruleCodes.map((r) => ruleLabel(r)).join(', ')} — «${o.justification}»`, tono: o === null ? 'neutro' : 'aviso' },
    ];
  });

  constructor() {
    this.access.ensure();
    effect(() => {
      const id = this.siteId();
      if (id === null) return;
      untracked(() => this.adt.listAttendingPractitioners(id).subscribe({ next: (l) => this.attendings.set(l), error: () => this.attendings.set([]) }));
    });
    const requested = this.route.snapshot.queryParamMap.get('patient');
    if (requested) {
      this.profiles.getPatient(requested).subscribe({
        next: (p) => this.form.controls.patient.setValue({ value: p.profileId, label: p.displayName ?? p.patientCode, hint: p.patientCode }),
        error: () => undefined,
      });
    }
    effect(() => {
      this.bedOk();
      this.bedMode();
      this.bedId();
      untracked(() => {
        this.form.controls.bed.setValue(this.bedMode() === 'NONE' ? null : this.bedId(), { emitEvent: false });
        this.form.controls.bed.updateValueAndValidity({ emitEvent: false });
      });
    });
  }

  private bedValidator(_c: AbstractControl): ValidationErrors | null {
    return this.bedOk() ? null : { bed: true };
  }

  protected setBedValidity(ok: boolean): void {
    this.bedOk.set(ok);
  }

  protected search(text: string): void {
    this.searching.set(true);
    this.profiles.searchPatients({ query: text, limit: 8 }).subscribe({
      next: (p) => {
        this.searching.set(false);
        this.candidates.set(p.items.map((x) => ({ value: x.profileId, label: x.displayName ?? x.patientCode, hint: [x.patientCode, x.nationalId].filter(Boolean).join(' · ') })));
      },
      error: () => {
        this.searching.set(false);
        this.candidates.set([]);
      },
    });
  }

  protected submit(): void {
    const v = this.form.getRawValue();
    const site = this.siteId();
    if (site === null || v.patient === null || v.level === null || v.source === null) return;
    const bed = this.bedMode() === 'NONE' || this.bedId() === null ? undefined : { careSpaceId: this.bedId()!, mode: this.bedMode() as 'ASSIGN' | 'RESERVE' };
    const o = this.override();
    this.sending.set(true);
    this.failure.set(null);
    this.adt
      .admit({
        patientProfileId: v.patient.value,
        practiceSiteId: site,
        openEpisode: true,
        ...(v.attending ? { attendingPractitionerId: v.attending } : {}),
        levelOfCareCode: v.level as LevelOfCareCode,
        admissionSourceCode: v.source as AdmissionSourceCode,
        reasonText: v.reason.trim(),
        ...(v.isolation !== 'ISO_NONE' ? { isolationPrecautionCode: v.isolation } : {}),
        ...(v.organism.trim() ? { isolationOrganismText: v.organism.trim() } : {}),
        ...(v.expectedDischarge ? { expectedDischargeAt: v.expectedDischarge.toISOString() } : {}),
        ...(bed ? { bed } : {}),
        ...(o !== null && bed ? { override: o } : {}),
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          if (r.encounterId) void this.router.navigateByUrl(stayRoute(r.encounterId));
        },
        error: (e: unknown) => {
          this.sending.set(false);
          const r = apiReason(e);
          const v2 = violationsOf(r?.details ?? {});
          const state = errorToViewState<never>(e);
          this.failure.set(
            state.status === 'validation' && v2.length > 0
              ? { ...state, issues: v2.map((x) => ({ field: ruleLabel(x.rule), message: x.detail, code: x.rule })) }
              : state,
          );
        },
      });
  }

  protected cancel(): void {
    void this.router.navigate([BED_BOARD_ROUTE], { queryParams: { site: this.siteId() } });
  }
}
