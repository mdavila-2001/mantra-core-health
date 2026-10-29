import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { SessionStore } from '../../../core/auth/session.store';
import {
  ADMISSION_SOURCES,
  ISOLATION_PRECAUTIONS,
  LEVELS_OF_CARE,
} from '../../../core/data-access/adt/adt.catalog';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState, readAdtError } from '../../../core/data-access/adt/adt.errors';
import { buildOverride, cellsOfBoard } from '../../../core/data-access/adt/adt.logic';
import type {
  AdmissionRequest,
  AdtViewer,
  BedBoard,
  BedBoardCell,
  BedCompatibility,
  BedMode,
} from '../../../core/data-access/adt/adt.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { forbidden, loading, ready, routeAuthPending } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { AdtIssue } from '../shared/adt-issue';
import { bedPathText } from '../../../core/data-access/adt/adt.logic';
import { RUTAS } from '../shared/adt.view';
import { BedPicker } from '../shared/bed-picker/bed-picker';
import { CompatPanel } from '../shared/compat-panel/compat-panel';
import { InpatientSites } from '../shared/inpatient-sites';
import { SiteSwitcher } from '../shared/site-switcher/site-switcher';

interface Contexto {
  readonly board: BedBoard;
  readonly viewer: AdtViewer;
}

type ModoDeCama = BedMode | 'NONE';

const MODOS: readonly SegmentedOption<ModoDeCama>[] = [
  { value: 'ASSIGN', label: 'Ocupar ahora' },
  { value: 'RESERVE', label: 'Reservar' },
  { value: 'NONE', label: 'Sin cama por ahora' },
];

const CON_PRECAUCION = ['ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'];

/**
 * **Ingreso de un paciente** — `/inpatient/admissions/new`.
 *
 * Una tarjeta ancha con el recorrido en cuatro pasos (regla del 09/09/2026):
 * **Paciente · Datos de ingreso · Cama · Confirmar**. Se puede ingresar sin cama:
 * la internación queda «pendiente de cama» y se asigna después desde el tablero.
 *
 * ## La cama
 *
 * El paso Cama ofrece las camas asignables del tablero de F2 (`BedPicker`, que el
 * plano interactivo sustituirá) y, al elegir una, pide la compatibilidad **con la
 * persona**: bloqueantes en rojo sin salida, forzables en ámbar con «Forzar con
 * justificación» (20 caracteres como mínimo; deja un incidente de ubicación). Esa
 * vista previa usa un endpoint propuesto (DESVÍO F3-A); si la API no lo tiene, el
 * paso lo dice y la decisión llega al confirmar, con los errores del propio
 * `POST /clinical/admissions`, que es la autoridad en cualquier caso.
 *
 * ## Lo que la pantalla no decide
 *
 * Nada de lo que muestra autoriza: si la API contesta 403 (Limpieza, facturación,
 * un administrador de estructura) la pantalla pasa a S5; si dos personas eligen
 * la misma cama, la segunda ve 409 y vuelve a elegir con el tablero fresco.
 */
@Component({
  selector: 'app-admission-new',
  imports: [Alert, AdtIssue, BedPicker, CompatPanel, CustomField, PageHeader, PaginatedForm, ReferenceCombobox, RouterLink, SegmentedControl, SiteSwitcher, ViewStateHost],
  templateUrl: './admission-new.html',
  styleUrl: './admission-new.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionNew {
  private readonly client = inject(AdtClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionStore);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly sites = inject(InpatientSites);

  protected readonly state = signal<ViewState<Contexto>>(routeAuthPending());
  protected readonly contexto = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : null;
  });
  protected readonly cells = computed(() => {
    const c = this.contexto();
    return c === null ? [] : cellsOfBoard(c.board);
  });

  // ─ el formulario
  protected readonly form = new FormGroup({
    patient: new FormControl<string | null>(null, { validators: [Validators.required] }),
    attending: new FormControl<string | null>(null, { validators: [Validators.required] }),
    source: new FormControl<string>('ADM_SRC_EMERGENCY', { nonNullable: true, validators: [Validators.required] }),
    expectedDischargeAt: new FormControl<Date | null>(null),
    level: new FormControl<string>('LOC_CARE_GENERAL', { nonNullable: true, validators: [Validators.required] }),
    isolation: new FormControl<string>('ISO_NONE', { nonNullable: true }),
    organism: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(120)] }),
    reason: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(500)] }),
    bed: new FormControl<string | null>(null),
    confirm: new FormControl<boolean>(true, { nonNullable: true }),
  });

  // ─ paciente
  protected readonly paciente = signal<ReferenceOption | null>(null);
  protected readonly candidatos = signal<readonly ReferenceOption[]>([]);
  protected readonly buscando = signal(false);
  protected readonly errorDeBusqueda = signal(false);

  // ─ profesionales
  private readonly profesionales = signal<readonly SelectOption<string>[]>([]);

  // ─ cama
  protected readonly modos = MODOS;
  protected readonly modo = signal<ModoDeCama>('ASSIGN');
  protected readonly camaElegida = signal<BedBoardCell | null>(null);
  protected readonly compat = signal<BedCompatibility | null>(null);
  protected readonly comprobando = signal(false);
  protected readonly sinVistaPrevia = signal(false);
  protected readonly justificacion = signal<string | null>(null);
  private consulta = 0;

  // ─ envío
  protected readonly enviando = signal(false);
  protected readonly problema = signal<ViewState<unknown> | null>(null);

  protected readonly breadcrumbs = [{ label: 'Internación' }, { label: 'Nuevo ingreso' }];

  private readonly parametros = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  protected readonly paginas = computed(() =>
    paginateFields([
      {
        titulo: 'Paciente',
        hint: 'A quién se interna, quién lo atiende y de dónde viene.',
        campos: [
          { key: 'patient', label: 'Paciente', control: 'custom' as const, required: true, testId: 'ingreso-paciente' },
          {
            key: 'attending',
            label: 'Profesional tratante',
            control: 'select' as const,
            required: true,
            searchable: true,
            options: this.profesionales(),
            testId: 'ingreso-tratante',
            mensajeDeError: 'Elija quién atiende la internación.',
          },
          { key: 'source', label: 'Procedencia', control: 'select' as const, required: true, options: ADMISSION_SOURCES.map((c) => ({ value: c.code, label: c.display })), testId: 'ingreso-procedencia' },
          { key: 'expectedDischargeAt', label: 'Alta prevista', control: 'date' as const, hint: 'Opcional. Ayuda a planificar las camas.', minDate: new Date(), testId: 'ingreso-alta-prevista' },
        ],
      },
      {
        titulo: 'Datos de ingreso',
        hint: 'Con qué nivel de cuidado ingresa y por qué. El aislamiento limita en qué cama puede ir.',
        campos: [
          { key: 'level', label: 'Nivel de cuidado', control: 'select' as const, required: true, options: LEVELS_OF_CARE.map((c) => ({ value: c.code, label: c.display })), testId: 'ingreso-nivel' },
          { key: 'isolation', label: 'Precaución de aislamiento', control: 'select' as const, options: ISOLATION_PRECAUTIONS.map((c) => ({ value: c.code, label: c.display })), testId: 'ingreso-aislamiento' },
          { key: 'organism', label: 'Organismo', control: 'text' as const, hint: 'Si se conoce. Sirve para formar cohortes.', showWhen: { key: 'isolation', equals: CON_PRECAUCION }, testId: 'ingreso-organismo' },
          { key: 'reason', label: 'Motivo del ingreso', control: 'textarea' as const, required: true, testId: 'ingreso-motivo', mensajeDeError: 'Escriba el motivo del ingreso (hasta 500 caracteres).' },
        ],
      },
      {
        titulo: 'Cama',
        hint: 'Elija una cama asignable o ingrese sin cama: queda pendiente y se asigna después.',
        campos: [{ key: 'bed', label: 'Cama', control: 'custom' as const, testId: 'ingreso-cama' }],
      },
      {
        titulo: 'Confirmar',
        hint: 'Revise antes de registrar. Un ingreso registrado no se borra: se egresa.',
        campos: [{ key: 'confirm', label: 'Resumen', control: 'custom' as const, testId: 'ingreso-resumen' }],
      },
    ]),
  );

  protected readonly puedeForzar = computed(() => this.contexto()?.viewer.canOverride === true);
  protected readonly sedeNombre = computed(() => this.sites.site()?.name ?? '');

  constructor() {
    this.sites.load();
    effect(() => {
      const s = this.sites.state();
      const id = this.sites.siteId();
      untracked(() => {
        if (s.status === 'ready' && id !== '') this.cargar();
        else if (s.status !== 'ready') this.state.set(s as ViewState<Contexto>);
      });
    });
    effect(() => {
      const id = this.parametros().get('patient');
      if (id !== null && untracked(() => this.form.controls.patient.value) !== id) untracked(() => this.cargarPaciente(id));
    });
    this.profiles
      .listPractitioners({ limit: 50 })
      .pipe(catchError(() => of(null)))
      .subscribe((pagina) => {
        const opciones = (pagina?.items ?? []).map((p) => ({ value: p.profileId, label: p.displayName ?? p.practitionerCode }));
        this.profesionales.set(opciones);
        const propio = this.auth.practitionerProfileId();
        if (propio !== null && this.form.controls.attending.value === null && opciones.some((o) => o.value === propio)) this.form.controls.attending.setValue(propio);
      });
  }

  protected cargar(): void {
    const siteId = this.sites.siteId();
    if (siteId === '') return;
    if (this.session.activeTenantId() === null) {
      this.state.set(routeAuthPending());
      return;
    }
    this.state.set(loading());
    this.client.getBedBoard(siteId).subscribe({
      next: (board) => {
        const viewer: AdtViewer = board.viewer ?? { canOperateBeds: true, canOverride: false, canReviewIncidents: false, canCloseCensus: false, canAdjustCensus: false };
        // Solo refleja: sin permiso para operar camas no hay nada que hacer aquí (S5).
        this.state.set(
          viewer.canOperateBeds
            ? ready({ board, viewer })
            : forbidden({ message: 'Su rol puede ver el tablero de camas, pero no ingresar pacientes. Ingresan Enfermería y Admisión.', nextAction: { label: 'Volver al panel', route: '/dashboard' } }),
        );
      },
      error: (e: unknown) => this.state.set(adtErrorToViewState<Contexto>(e)),
    });
  }

  // ─ paciente

  private cargarPaciente(id: string): void {
    this.form.controls.patient.setValue(id);
    this.profiles.getPatient(id).pipe(catchError(() => of(null))).subscribe((p) => {
      this.paciente.set({ value: id, label: p?.displayName ?? 'Paciente', hint: p?.patientCode });
    });
  }

  protected buscarPaciente(texto: string): void {
    if (texto === '') {
      this.candidatos.set([]);
      return;
    }
    this.buscando.set(true);
    this.errorDeBusqueda.set(false);
    this.profiles.searchPatients({ query: texto, limit: 8 }).subscribe({
      next: (pagina) => {
        this.candidatos.set(
          pagina.items.map((p) => ({
            value: p.profileId,
            label: p.displayName ?? `Sin nombre · ${p.patientCode}`,
            hint: p.birthDate === undefined ? p.patientCode : `${p.patientCode} · nació el ${p.birthDate.toLocaleDateString('es-419')}`,
          })),
        );
        this.buscando.set(false);
      },
      error: () => {
        this.candidatos.set([]);
        this.buscando.set(false);
        this.errorDeBusqueda.set(true);
      },
    });
  }

  protected elegirPaciente(opcion: ReferenceOption | null): void {
    this.paciente.set(opcion);
    this.form.controls.patient.setValue(opcion?.value ?? null);
    this.form.controls.patient.markAsTouched();
    this.reiniciarCompat();
  }

  // ─ cama

  protected cambiarModo(modo: ModoDeCama): void {
    this.modo.set(modo);
    if (modo === 'NONE') this.quitarCama();
  }

  protected elegirCama(cell: BedBoardCell): void {
    this.camaElegida.set(cell);
    this.form.controls.bed.setValue(cell.id);
    this.reiniciarCompat();
    this.comprobar(cell);
  }

  protected quitarCama(): void {
    this.camaElegida.set(null);
    this.form.controls.bed.setValue(null);
    this.reiniciarCompat();
  }

  private reiniciarCompat(): void {
    this.compat.set(null);
    this.justificacion.set(null);
    this.sinVistaPrevia.set(false);
    this.comprobando.set(false);
    this.consulta += 1;
  }

  private comprobar(cell: BedBoardCell): void {
    const paciente = this.form.controls.patient.value;
    if (paciente === null) {
      this.sinVistaPrevia.set(true);
      return;
    }
    const mia = ++this.consulta;
    this.comprobando.set(true);
    const aislamiento = this.form.controls.isolation.value;
    this.client
      .checkAdmissionCompatibility({
        patientProfileId: paciente,
        careSpaceId: cell.id,
        levelOfCareCode: this.form.controls.level.value,
        ...(aislamiento === 'ISO_NONE' ? {} : { isolationPrecautionCode: aislamiento }),
        ...(this.form.controls.organism.value.trim() === '' ? {} : { isolationOrganismText: this.form.controls.organism.value.trim() }),
      })
      .subscribe({
        next: (r) => {
          if (mia !== this.consulta) return;
          this.comprobando.set(false);
          this.compat.set(r);
        },
        error: (e: unknown) => {
          if (mia !== this.consulta) return;
          this.comprobando.set(false);
          const d = readAdtError(e);
          // 404/405/501: la API aún no ofrece la vista previa (DESVÍO F3-A). Cualquier otro
          // fallo (403, sin red) se dirá igual al confirmar, con su código de soporte.
          this.sinVistaPrevia.set(d === null ? true : [404, 405, 501].includes(d.status) || d.status === 403);
        },
      });
  }

  protected async forzar(): Promise<void> {
    const texto = await this.dialogs.confirmWithReason(
      {
        title: 'Forzar la compatibilidad',
        message: 'La cama no cumple las reglas de compatibilidad. Si la fuerza, queda un incidente de ubicación abierto que supervisión debe revisar.',
        confirmLabel: 'Forzar y registrar incidente',
      },
      { label: 'Justificación clínica', hint: 'Al menos 20 caracteres, sin contar los espacios de los bordes.', minLength: 20, maxLength: 500 },
    );
    if (texto !== null) this.justificacion.set(texto);
  }

  // ─ resumen y envío

  protected readonly resumen = computed(() => {
    const f = this.form.getRawValue();
    const nivel = LEVELS_OF_CARE.find((c) => c.code === f.level)?.display ?? f.level;
    const cama = this.camaElegida();
    return [
      { rotulo: 'Paciente', valor: this.paciente()?.label ?? '—' },
      { rotulo: 'Procedencia', valor: ADMISSION_SOURCES.find((c) => c.code === f.source)?.display ?? f.source },
      { rotulo: 'Nivel de cuidado', valor: nivel },
      { rotulo: 'Aislamiento', valor: ISOLATION_PRECAUTIONS.find((c) => c.code === f.isolation)?.display ?? f.isolation },
      { rotulo: 'Motivo', valor: f.reason },
      {
        rotulo: 'Cama',
        valor: cama === null || this.modo() === 'NONE' ? 'Sin cama: queda pendiente de cama' : `${cama.code} · ${bedPathText(cama.path)} (${this.modo() === 'ASSIGN' ? 'ocupar ahora' : 'reservar'})`,
      },
    ];
  });

  protected submit(): void {
    if (this.enviando() || this.form.invalid) return;
    const f = this.form.getRawValue();
    const siteId = this.sites.siteId();
    const cama = this.modo() === 'NONE' ? null : this.camaElegida();
    const violaciones = this.compat()?.violations ?? [];
    const justificacion = this.justificacion();
    const body: AdmissionRequest = {
      patientProfileId: f.patient!,
      practiceSiteId: siteId,
      attendingPractitionerId: f.attending!,
      levelOfCareCode: f.level,
      admissionSourceCode: f.source,
      reasonText: f.reason.trim(),
      openEpisode: true,
      ...(f.isolation === 'ISO_NONE' ? {} : { isolationPrecautionCode: f.isolation }),
      ...(f.organism.trim() === '' ? {} : { isolationOrganismText: f.organism.trim() }),
      ...(f.expectedDischargeAt === null ? {} : { expectedDischargeAt: f.expectedDischargeAt.toISOString() }),
      ...(cama === null ? {} : { bed: { careSpaceId: cama.id, mode: this.modo() as BedMode } }),
      ...(cama !== null && justificacion !== null ? { override: buildOverride(violaciones, justificacion) } : {}),
    };
    this.enviando.set(true);
    this.problema.set(null);
    this.client.admit(body).subscribe({
      next: (r) => {
        this.enviando.set(false);
        void this.router.navigate([RUTAS.estancia(r.encounterId)], { queryParams: { nuevo: '1' } });
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        const estado = adtErrorToViewState<unknown>(e);
        if (estado.status === 'forbidden') {
          this.state.set(forbidden({ message: 'Su asignación no permite ingresar pacientes en este establecimiento. La decisión es del servidor.', nextAction: { label: 'Volver al panel', route: '/dashboard' }, ...(estado.requestId === undefined ? {} : { requestId: estado.requestId }) }));
          return;
        }
        this.problema.set(estado.status === 'not-found' ? errorToViewState<unknown>(e) : estado);
        const d = readAdtError(e);
        // La cama cambió bajo los pies: se vuelve a pedir el tablero y se pide elegir de nuevo.
        if (d?.reason === 'BED_NOT_ASSIGNABLE' || d?.reason === 'BED_DOUBLE_OCCUPANCY') {
          this.quitarCama();
          this.cargarSinReemplazar();
        }
      },
    });
  }

  /** Refresca el tablero sin pasar por S2: lo escrito en el formulario se conserva. */
  private cargarSinReemplazar(): void {
    const siteId = this.sites.siteId();
    this.client.getBedBoard(siteId).subscribe({
      next: (board) => {
        const c = this.contexto();
        if (c !== null) this.state.set(ready({ board, viewer: board.viewer ?? c.viewer }));
      },
      error: () => undefined,
    });
  }

  protected cancelar(): void {
    void this.router.navigate(['/dashboard']);
  }

  protected reintentar(): void {
    this.sites.load(true);
    this.cargar();
  }
}
