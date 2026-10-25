import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  type OnInit,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  MEDICAL_GROUP_AMOUNT_PATTERN,
  MEDICAL_GROUP_LIMITS,
  type NewMedicalGroup,
  type NewMedicalGroupMember,
} from '../../core/data-access/medical-groups/medical-groups.types';
import type { Practice } from '../../core/data-access/services-catalog/services-catalog.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf } from '../../core/view-state/view-state';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Input } from '../../shared/components/atoms/input/input';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { DatePicker } from '../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { MedicalGroupWriteError } from './medical-group-write-error';
import { MEDICAL_GROUPS_ROUTE, medicalGroupRoute } from './medical-groups.routes';
import { MedicalGroupsService } from './medical-groups.service';

/** Un cargo en edición: lo que se escribe, antes de validarlo. */
interface MemberDraft {
  readonly key: number;
  readonly practitionerProfileId: string | null;
  readonly roleTitle: string;
  readonly amount: string;
  readonly terms: string;
}

/**
 * **Nuevo grupo médico** (FT-21) — UNA tarjeta con pestañas, centrada y a lo
 * ancho del área de contenido (`composition-rules.md` §5).
 *
 * - **Servicio y paciente**: el servicio del catálogo de una práctica propia
 *   (obligatorio), y opcionalmente el paciente y uno de sus diagnósticos. El
 *   más reciente viene preseleccionado, como pide la API.
 * - **Fecha y lugar**: cuándo y dónde, con las notas y los adicionales de los
 *   términos del servicio.
 * - **Equipo**: un renglón por cargo, con el profesional, la función y el pago
 *   acordado. Quien crea el grupo no se agrega: la API lo suma como aceptado.
 *
 * Las reglas que se comprueban acá son las del DTO (largos, importe con hasta
 * dos decimales, campos obligatorios) y sólo sirven para no mandar lo que se
 * sabe que se rechaza. La API valida igual, y su rechazo se muestra tal cual.
 * Como `app-tab` no dibuja el panel cerrado, todo vive en señales.
 */
@Component({
  selector: 'app-medical-group-form',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    DatePicker,
    FormField,
    Input,
    MedicalGroupWriteError,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
    Tab,
    Tabs,
    Textarea,
  ],
  templateUrl: './medical-group-form.html',
  styleUrl: './medical-group-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupForm implements OnInit {
  private readonly service = inject(MedicalGroupsService);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly listRoute = MEDICAL_GROUPS_ROUTE;
  protected readonly limits = MEDICAL_GROUP_LIMITS;
  protected readonly saving = this.service.saving;
  protected readonly writeError = this.service.writeError;
  protected readonly tabIndex = signal(0);

  /* ---- servicio y paciente -------------------------------------------------- */

  protected readonly practices = signal<readonly Practice[]>([]);
  protected readonly practiceId = signal<string | null>(null);
  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    this.practices().map((practice) => ({ value: practice.id, label: practice.name })),
  );

  protected readonly serviceOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly serviceSelected = signal<ReferenceOption | null>(null);
  protected readonly serviceId = signal<string | null>(null);
  protected readonly searchingService = signal(false);

  protected readonly patientOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly patientSelected = signal<ReferenceOption | null>(null);
  protected readonly patientId = signal<string | null>(null);
  protected readonly searchingPatient = signal(false);

  protected readonly conditions = this.service.conditions;
  protected readonly conditionId = signal<string | null>(null);
  protected readonly conditionOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.conditions() ?? { status: 'loading' }) ?? []).map((condition) => ({
      value: condition.id,
      label: `${condition.code} · ${condition.display}`,
    })),
  );

  /* ---- fecha y lugar -------------------------------------------------------- */

  protected readonly scheduledAt = signal<Date | null>(null);
  protected readonly minDate = new Date();
  protected readonly location = signal('');
  protected readonly notes = signal('');
  protected readonly terms = signal('');

  /* ---- equipo --------------------------------------------------------------- */

  protected readonly members = signal<readonly MemberDraft[]>([]);
  private nextKey = 1;
  protected readonly directory = this.service.directory;
  private readonly directoryQuery = signal('');
  protected readonly directoryOptions = computed<readonly ReferenceOption[]>(() => {
    const people = dataOf(this.directory()) ?? [];
    const wanted = normalize(this.directoryQuery());
    return people
      .filter((person) => wanted === '' || normalize(`${person.name} ${person.title ?? ''}`).includes(wanted))
      .slice(0, 8)
      .map((person) => ({ value: person.profileId, label: personLabel(person.name, person.title) }));
  });

  /* ---- validación ------------------------------------------------------------ */

  /** Lo que falta o está mal, en palabras; vacío cuando se puede crear. */
  protected readonly problems = computed<readonly string[]>(() => {
    const found: string[] = [];
    if (this.serviceId() === null) found.push('Elija el servicio del grupo.');
    if (this.scheduledAt() === null) found.push('Indique la fecha y hora de realización.');
    if (this.location().trim() === '') found.push('Indique el lugar de realización.');
    if (this.location().trim().length > MEDICAL_GROUP_LIMITS.locationText) {
      found.push(`El lugar admite hasta ${MEDICAL_GROUP_LIMITS.locationText} caracteres.`);
    }
    this.members().forEach((member, index) => {
      const n = index + 1;
      if (member.practitionerProfileId === null) found.push(`Cargo ${n}: elija al profesional.`);
      if (member.roleTitle.trim() === '') found.push(`Cargo ${n}: escriba la función.`);
      if (member.roleTitle.trim().length > MEDICAL_GROUP_LIMITS.roleTitle) {
        found.push(`Cargo ${n}: la función admite hasta ${MEDICAL_GROUP_LIMITS.roleTitle} caracteres.`);
      }
      if (!MEDICAL_GROUP_AMOUNT_PATTERN.test(member.amount.trim())) {
        found.push(`Cargo ${n}: el pago debe ser un número sin signo y con hasta dos decimales.`);
      }
    });
    return found;
  });

  protected readonly canSubmit = computed(() => this.problems().length === 0 && !this.saving());

  constructor() {
    // El diagnóstico más reciente viene elegido (AC-21-07), pero sólo si la
    // persona todavía no eligió otro.
    effect(() => {
      const options = dataOf(this.conditions() ?? { status: 'loading' });
      untracked(() => {
        if (options !== null && this.conditionId() === null) {
          this.conditionId.set(options.find((option) => option.isMostRecent)?.id ?? null);
        }
      });
    });
  }

  ngOnInit(): void {
    this.service.clearWriteError();
    this.service.loadConditions(null);
    this.service.loadDirectory();
    this.service.listPractices().subscribe({
      next: (practices) => {
        this.practices.set(practices);
        if (practices.length === 1) {
          this.practiceId.set(practices[0]?.id ?? null);
        }
      },
    });
  }

  /* ---- servicio -------------------------------------------------------------- */

  protected choosePractice(id: string | null): void {
    this.practiceId.set(id);
    this.serviceId.set(null);
    this.serviceSelected.set(null);
    this.serviceOptions.set([]);
  }

  protected searchService(query: string): void {
    const practice = this.practiceId();
    if (practice === null) return;
    this.searchingService.set(true);
    this.service.searchServices(practice, query).subscribe({
      next: (items) => {
        this.searchingService.set(false);
        this.serviceOptions.set(
          items.map((item) => ({ value: item.id, label: `${item.name} (${item.code})` })),
        );
      },
      error: () => {
        this.searchingService.set(false);
        this.serviceOptions.set([]);
      },
    });
  }

  protected chooseService(option: ReferenceOption | null): void {
    this.serviceSelected.set(option);
    this.serviceId.set(option?.value ?? null);
  }

  /* ---- paciente --------------------------------------------------------------- */

  protected searchPatient(query: string): void {
    this.searchingPatient.set(true);
    this.service.searchPatients(query).subscribe({
      next: (items) => {
        this.searchingPatient.set(false);
        this.patientOptions.set(
          items.map((item) => ({
            value: item.profileId,
            label: `${item.displayName ?? 'Sin nombre'} (${item.patientCode})`,
          })),
        );
      },
      error: () => {
        this.searchingPatient.set(false);
        this.patientOptions.set([]);
      },
    });
  }

  protected choosePatient(option: ReferenceOption | null): void {
    this.patientSelected.set(option);
    this.patientId.set(option?.value ?? null);
    this.conditionId.set(null);
    this.service.loadConditions(option?.value ?? null);
  }

  /* ---- equipo ----------------------------------------------------------------- */

  protected addMember(): void {
    this.members.update((all) => [
      ...all,
      { key: this.nextKey++, practitionerProfileId: null, roleTitle: '', amount: '', terms: '' },
    ]);
  }

  protected removeMember(key: number): void {
    this.members.update((all) => all.filter((member) => member.key !== key));
  }

  protected patchMember(key: number, change: Partial<Omit<MemberDraft, 'key'>>): void {
    this.members.update((all) =>
      all.map((member) => (member.key === key ? { ...member, ...change } : member)),
    );
  }

  protected searchPractitioner(query: string): void {
    this.directoryQuery.set(query);
  }

  /** La opción elegida de un cargo, para que el combobox muestre su nombre. */
  protected memberSelected(member: MemberDraft): ReferenceOption | null {
    const id = member.practitionerProfileId;
    if (id === null) return null;
    const person = (dataOf(this.directory()) ?? []).find((row) => row.profileId === id);
    return person === undefined ? null : { value: id, label: personLabel(person.name, person.title) };
  }

  protected reloadDirectory(): void {
    this.service.loadDirectory();
  }

  /* ---- envío ------------------------------------------------------------------ */

  protected submit(): void {
    const serviceCatalogId = this.serviceId();
    const when = this.scheduledAt();
    if (!this.canSubmit() || serviceCatalogId === null || when === null) return;

    const patientProfileId = this.patientId();
    const conditionId = patientProfileId === null ? null : this.conditionId();
    const notesText = this.notes().trim();
    const additionalTermsText = this.terms().trim();

    const body: NewMedicalGroup = {
      serviceCatalogId,
      scheduledAt: when.toISOString(),
      locationText: this.location().trim(),
      members: this.members().map<NewMedicalGroupMember>((member) => ({
        practitionerProfileId: member.practitionerProfileId ?? '',
        roleTitle: member.roleTitle.trim(),
        agreedPaymentAmount: member.amount.trim(),
        ...(member.terms.trim() === '' ? {} : { additionalTermsText: member.terms.trim() }),
      })),
      ...(patientProfileId === null ? {} : { patientProfileId }),
      ...(conditionId === null ? {} : { conditionId }),
      ...(notesText === '' ? {} : { notesText }),
      ...(additionalTermsText === '' ? {} : { additionalTermsText }),
    };

    this.service.create(body).subscribe((group) => {
      void this.router.navigate([medicalGroupRoute(group.id)]);
    });
  }
}

function personLabel(name: string, title: string | null): string {
  return title === null ? name : `${name} · ${title}`;
}

/** Sin tildes ni mayúsculas: «lucia» encuentra a «Lucía». */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
