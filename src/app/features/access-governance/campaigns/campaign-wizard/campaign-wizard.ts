import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  Injector,
  inject,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { of, switchMap, timer, type Subscription } from 'rxjs';

import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessReviewsClient } from '../../../../core/data-access/access-governance/access-reviews.client';
import {
  REVIEW_KINDS,
  REVIEW_KIND_LABELS,
  type CampaignPreview,
  type CampaignPreviewItem,
  type CampaignScopeKind,
  type ReviewKind,
} from '../../../../core/data-access/access-governance/access-reviews.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ROLE_TEMPLATE_CODES,
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportCatalog,
} from '../../../../core/data-access/support-access/support-access.types';
import type { AtomSensitivity } from '../../../../core/data-access/support-access/support-atoms';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready, validation } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../shared/components/molecules/radio-group/radio-group';
import { Stepper } from '../../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../../shared/components/molecules/stepper/stepper.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDay } from '../../../support-access/support-labels';
import {
  reviewerKindText,
  sensitivityRisk,
  sensitivityTone,
  uncertifiedActionText,
} from '../../review-labels';
import {
  buildDraft,
  emptyDraft,
  kindAllowsRevoke,
  REMINDER_CHOICES,
  scopeSummaryText,
  stepProblems,
  type DraftForm,
  type DraftProblem,
} from '../campaign-draft';

const LISTA = '/administration/access-governance/campaigns';
const PASOS = ['Qué revisar', 'Filtros y vista previa', 'Plazos', 'Revisar y lanzar'] as const;
const MAX_FILAS = 50;
/** Dónde está el control de cada campo con problema, para llevarle el foco. */
const CONTROL_DEL_CAMPO: Readonly<Record<string, string>> = {
  name: '[data-testid="campana-nombre"]',
  scope: '.lista',
  unusedDays: '[data-testid="filtro-sin-uso"]',
  dueDate: '[data-testid="campana-fecha"]',
  graceDays: '[data-testid="campana-gracia"]',
  uncertifiedAction: '[data-testid="campana-accion-escalar"]',
  escalateAfterDays: '[data-testid="campana-escalar"]',
};
const CAMPOS_DE_ALCANCE: readonly string[] = [
  'scopeKind',
  'doctorIds',
  'serviceIds',
  'locationIds',
  'templateCodes',
];

const OPCIONES_DE_ALCANCE: readonly SelectOption<CampaignScopeKind>[] = [
  {
    value: 'ORGANIZATION',
    label: 'Toda la organización',
    description: 'Todos los accesos de apoyo vigentes.',
  },
  {
    value: 'PRACTITIONER',
    label: 'Por doctor',
    description: 'Los accesos que dan acceso a la agenda de ciertos doctores.',
  },
  { value: 'SERVICE', label: 'Por servicio', description: 'Los accesos sobre ciertos servicios.' },
  {
    value: 'LOCATION',
    label: 'Por ubicación',
    description: 'Los accesos sobre ciertos pisos, consultorios o sedes.',
  },
  {
    value: 'TEMPLATE',
    label: 'Por rol',
    description: 'Los accesos de ciertos roles, por ejemplo caja o recepción.',
  },
];

const DESCRIPCION_DEL_TIPO: Readonly<Record<ReviewKind, string>> = {
  PERIODIC: 'La revisión de rutina de todos los accesos del alcance.',
  RECERTIFICATION: 'Reconfirmar que cada persona sigue ayudando a la organización.',
  MOVER: 'Para quien cambió de rol: solo se escala, nunca se quita sin que alguien lo vea.',
  TARGETED: 'Una revisión puntual sobre personas o accesos concretos.',
  REMEDIATION: 'Para corregir un hallazgo, como un conflicto de funciones.',
};

const OPCIONES_DE_TIPO: readonly SelectOption<ReviewKind>[] = REVIEW_KINDS.map((k) => ({
  value: k,
  label: REVIEW_KIND_LABELS[k],
  description: DESCRIPCION_DEL_TIPO[k],
}));

const OPCIONES_DE_SENSIBILIDAD: readonly SelectOption<AtomSensitivity | ''>[] = [
  { value: '', label: 'Cualquiera' },
  { value: 'MEDIUM', label: 'Media o más' },
  { value: 'HIGH', label: 'Alta o crítica' },
  { value: 'CRITICAL', label: 'Solo crítica' },
];

/** Lo que el asistente ofrece como objetivos: sale de `GET /org/support-catalog`. */
type Catalogo = Pick<SupportCatalog, 'doctors' | 'services' | 'locations'>;

/** Una fila de la vista previa, con el nombre de la persona si se pudo leer. */
interface FilaPrevia {
  readonly id: string;
  readonly persona: string;
  readonly item: CampaignPreviewItem;
}

/**
 * **Asistente de campañas** (CONTRATO-GOBIERNO §6.2 y §9.3), cuatro pasos: 1 qué revisar, 2 filtros y **vista previa de
 * ítems y revisores**, 3 plazos y qué pasa con lo no certificado, 4 revisar y lanzar.
 *
 * Nada se crea hasta el paso 4. La vista previa sale de `POST …/campaigns/preview` (sin efectos) y se vuelve a pedir al
 * cambiar un filtro; cada paso valida antes de avanzar y la API repite cada regla. «Crear y lanzar» crea la campaña y la
 * lanza; si el lanzamiento falla, la campaña queda como borrador y se ofrece abrirla. Todo se dice en lenguaje simple.
 */
@Component({
  selector: 'app-campaign-wizard',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    Checkbox,
    DataTable,
    FormField,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    RouterLink,
    Select,
    Stepper,
    Switch,
    ViewStateHost,
  ],
  templateUrl: './campaign-wizard.html',
  styleUrl: './campaign-wizard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignWizard implements OnInit {
  private readonly reviews = inject(AccessReviewsClient);
  private readonly support = inject(SupportAccessClient);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly lista = LISTA;
  protected readonly opcionesDeAlcance = OPCIONES_DE_ALCANCE;
  protected readonly opcionesDeTipo = OPCIONES_DE_TIPO;
  protected readonly opcionesDeSensibilidad = OPCIONES_DE_SENSIBILIDAD;
  protected readonly recordatoriosPosibles = REMINDER_CHOICES;
  protected readonly roles = SUPPORT_ROLE_TEMPLATE_CODES.map((code) => ({
    code,
    label: SUPPORT_ROLE_TEMPLATE_LABELS[code],
  }));

  protected readonly catalogo = signal<ViewState<Catalogo>>(loading());
  protected readonly form = signal<DraftForm>(emptyDraft());
  protected readonly paso = signal<1 | 2 | 3 | 4>(1);
  protected readonly problemas = signal<readonly DraftProblem[]>([]);
  protected readonly vistaPrevia = signal<ViewState<CampaignPreview>>(loading());
  protected readonly trabajando = signal(false);
  protected readonly error = signal<string | null>(null);
  /** La campaña ya creada cuando el lanzamiento falló: se ofrece abrirla. */
  protected readonly borradorCreado = signal<string | null>(null);
  private readonly nombres = signal<ReadonlyMap<string, string>>(new Map());
  private pedidoPrevio: Subscription | null = null;

  private readonly personaCell =
    viewChild.required<TemplateRef<{ $implicit: FilaPrevia }>>('personaCell');
  private readonly revisorCell =
    viewChild.required<TemplateRef<{ $implicit: FilaPrevia }>>('revisorCell');
  private readonly riesgoCell =
    viewChild.required<TemplateRef<{ $implicit: FilaPrevia }>>('riesgoCell');

  protected readonly tituloDelPaso = computed(() => PASOS[this.paso() - 1]!);
  protected readonly pasosVisibles = computed<readonly StepperStep[]>(() =>
    PASOS.map((label, i) => ({
      label,
      status: i + 1 < this.paso() ? 'complete' : i + 1 === this.paso() ? 'current' : 'upcoming',
    })),
  );
  /**
   * `true` cuando la API rechazó quitar por vencimiento (403 `ADMIN_CEILING_EXCEEDED`, `breach: AUTO_REVOKE`): quien arma la
   * campaña no tiene «quitar permisos» (un delegado). Desde ahí no se ofrece más esa opción.
   */
  protected readonly sinPermisoParaQuitar = signal(false);
  protected readonly permiteRevocar = computed(
    () => kindAllowsRevoke(this.form().kind) && !this.sinPermisoParaQuitar(),
  );
  protected readonly descripcionDelTipo = computed(() => DESCRIPCION_DEL_TIPO[this.form().kind]);

  protected readonly previa = computed(() => {
    const s = this.vistaPrevia();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly sinRevisor = computed(() => this.previa()?.withoutReviewer ?? 0);
  protected readonly revisores = computed(() =>
    Object.entries(this.previa()?.byReviewerKind ?? {}).map(([kind, n]) => ({
      kind,
      texto: reviewerKindText(kind),
      n,
    })),
  );
  protected readonly filas = computed<ViewState<readonly FilaPrevia[]>>(() => {
    const p = this.previa();
    if (p === null) return loading();
    return ready(
      p.items.slice(0, MAX_FILAS).map((item, i) => ({
        id: `${item.engagementId}-${item.grantId ?? i}`,
        persona: this.nombres().get(item.subjectUserId) ?? 'Persona sin nombre',
        item,
      })),
    );
  });
  protected readonly recortada = computed(() =>
    Math.max(0, (this.previa()?.items.length ?? 0) - MAX_FILAS),
  );
  protected readonly puedeSeguirDelPaso2 = computed(() => this.vistaPrevia().status === 'ready');

  protected readonly columnas = computed<readonly ColumnDef<FilaPrevia>[]>(() => [
    { key: 'persona', header: 'Persona', priority: 1, cell: this.personaCell() },
    { key: 'revisor', header: 'Quién revisa', priority: 2, cell: this.revisorCell() },
    { key: 'riesgo', header: 'Riesgo', priority: 1, cell: this.riesgoCell() },
  ]);
  protected readonly rowId = (f: FilaPrevia): string => f.id;
  protected readonly rowLabel = (f: FilaPrevia): string => `Acceso de ${f.persona}`;
  protected readonly revisorTexto = (f: FilaPrevia): string =>
    reviewerKindText(f.item.reviewerKind);
  protected readonly riesgoTexto = (f: FilaPrevia): string =>
    sensitivityRisk(f.item.maxSensitivity);
  protected readonly riesgoTono = (f: FilaPrevia) => sensitivityTone(f.item.maxSensitivity);

  /* ---- el resumen del paso 4 --------------------------------------------------------------------------------------- */

  protected readonly resumen = computed(() => {
    const f = this.form();
    const c = this.catalogo();
    const datos = c.status === 'ready' ? c.data : { doctors: [], services: [], locations: [] };
    const filtros = [
      f.minSensitivity === ''
        ? null
        : `riesgo ${OPCIONES_DE_SENSIBILIDAD.find((o) => o.value === f.minSensitivity)?.label.toLowerCase()}`,
      f.unusedDays === null ? null : `sin uso en ${f.unusedDays} días`,
      f.onlyAboveCeiling ? 'solo lo que pasa el techo' : null,
      f.onlySodFindings ? 'solo con conflictos de funciones' : null,
      f.includeSuspended ? 'incluye personas suspendidas' : null,
    ].filter((p): p is string => p !== null);
    const p = this.previa();
    return {
      nombre: f.name.trim(),
      tipo: REVIEW_KIND_LABELS[f.kind],
      alcance: scopeSummaryText(f, datos),
      filtros: filtros.length === 0 ? 'Todos los accesos del alcance' : filtros.join(' · '),
      items:
        p === null
          ? 'No se pudo calcular'
          : `${p.total === 1 ? '1 acceso' : `${p.total} accesos`} por revisar${p.withoutReviewer > 0 ? `, ${p.withoutReviewer} sin revisor elegible` : ''}`,
      fecha: formatDay(buildDraft(f).dueAt),
      plazos: `${f.graceDays} días de gracia · recordatorios ${f.reminderDays.length === 0 ? 'ninguno' : [...f.reminderDays].sort((a, b) => b - a).join(', ') + ' días antes'} · se escala a los ${f.escalateAfterDays} días`,
      noCertificado: uncertifiedActionText(f.uncertifiedAction),
    };
  });

  ngOnInit(): void {
    this.cargarCatalogo();
    this.support.listEngagements().subscribe({
      next: ({ items }) => this.nombres.set(new Map(items.map((e) => [e.userId, e.personName]))),
      // Sin nombres la vista previa sigue sirviendo: dice «Persona sin nombre».
      error: () => undefined,
    });
    this.destroyRef.onDestroy(() => this.pedidoPrevio?.unsubscribe());
  }

  protected cargarCatalogo(): void {
    this.catalogo.set(loading());
    this.support.getCatalog().subscribe({
      next: (c) =>
        this.catalogo.set(
          ready({ doctors: c.doctors, services: c.services, locations: c.locations }),
        ),
      error: (failure: unknown) => this.catalogo.set(errorToViewState<Catalogo>(failure)),
    });
  }

  /* ---- el formulario -------------------------------------------------------------------------------------------------- */

  protected cambiar(cambio: Partial<DraftForm>): void {
    this.form.update((f) => ({ ...f, ...cambio }));
    // Un error se va en cuanto se toca lo que lo causó.
    this.problemas.update((p) =>
      p.filter(
        (x) =>
          !(x.field in cambio) &&
          !(x.field === 'scope' && CAMPOS_DE_ALCANCE.some((k) => k in cambio)),
      ),
    );
  }

  protected cambiarTipo(tipo: ReviewKind | null): void {
    if (tipo === null) return;
    this.cambiar({
      kind: tipo,
      ...(kindAllowsRevoke(tipo) ? {} : { uncertifiedAction: 'UNCERTIFIED_ESCALATE' as const }),
    });
  }

  protected cambiarAlcance(kind: CampaignScopeKind | null): void {
    if (kind !== null) this.cambiar({ scopeKind: kind });
  }

  protected cambiarSensibilidad(valor: AtomSensitivity | '' | null): void {
    this.cambiar({ minSensitivity: valor ?? '' });
    this.pedirVistaPrevia(0);
  }

  protected cambiarSinUso(valor: string | number | null): void {
    const n = valor === null || valor === '' ? null : Number(valor);
    this.cambiar({ unusedDays: n === null || Number.isNaN(n) ? null : n });
    this.pedirVistaPrevia(400);
  }

  protected alternarFiltro(
    clave: 'onlyAboveCeiling' | 'onlySodFindings' | 'includeSuspended',
    valor: boolean,
  ): void {
    this.cambiar({ [clave]: valor });
    this.pedirVistaPrevia(0);
  }

  protected cambiarNumero(
    clave: 'graceDays' | 'escalateAfterDays',
    valor: string | number | null,
  ): void {
    const n = valor === null || valor === '' ? Number.NaN : Number(valor);
    this.cambiar({ [clave]: n } as Partial<DraftForm>);
  }

  protected marcado(lista: readonly string[], id: string): boolean {
    return lista.includes(id);
  }

  protected alternar(
    clave: 'doctorIds' | 'serviceIds' | 'locationIds' | 'templateCodes',
    id: string,
    marcar: boolean,
  ): void {
    const actual = this.form()[clave];
    this.cambiar({
      [clave]: marcar
        ? actual.includes(id)
          ? actual
          : [...actual, id]
        : actual.filter((x) => x !== id),
    } as Partial<DraftForm>);
  }

  protected alternarRecordatorio(dias: number, marcar: boolean): void {
    const actual = this.form().reminderDays;
    this.cambiar({
      reminderDays: marcar
        ? [...actual.filter((d) => d !== dias), dias].sort((a, b) => b - a)
        : actual.filter((d) => d !== dias),
    });
  }

  protected cambiarAccion(valor: 'UNCERTIFIED_REVOKE' | 'UNCERTIFIED_ESCALATE' | null): void {
    if (valor !== null) this.cambiar({ uncertifiedAction: valor });
  }

  protected mensaje(campo: string): string {
    return this.problemas().find((p) => p.field === campo)?.message ?? '';
  }

  /* ---- los pasos ----------------------------------------------------------------------------------------------------------- */

  protected siguiente(): void {
    const actual = this.paso();
    if (actual === 4) return;
    const problemas = stepProblems(actual as 1 | 2 | 3, this.form());
    this.problemas.set(problemas);
    if (problemas.length > 0) {
      this.enfocar(CONTROL_DEL_CAMPO[problemas[0]!.field] ?? '.seccion__titulo');
      return;
    }
    if (actual === 2 && !this.puedeSeguirDelPaso2()) return;
    const proximo = (actual + 1) as 1 | 2 | 3 | 4;
    this.paso.set(proximo);
    this.error.set(null);
    this.enfocar('.seccion__titulo');
    if (proximo === 2) this.pedirVistaPrevia(0);
  }

  protected atras(): void {
    const actual = this.paso();
    if (actual === 1) return;
    this.problemas.set([]);
    this.error.set(null);
    this.paso.set((actual - 1) as 1 | 2 | 3);
    this.enfocar('.seccion__titulo');
  }

  /** Lleva el foco a lo que la persona necesita ver al cambiar de paso o al fallar una validación. */
  private enfocar(selector: string): void {
    afterNextRender(
      () => {
        const el = this.host.nativeElement.querySelector<HTMLElement>(selector);
        const control = el?.matches('input,textarea,button,h2')
          ? el
          : el?.querySelector<HTMLElement>('input,textarea,button');
        control?.focus();
      },
      { injector: this.injector },
    );
  }

  /** La vista previa se vuelve a pedir al cambiar un filtro; la petición anterior se cancela. */
  protected pedirVistaPrevia(esperaMs: number): void {
    if (this.paso() !== 2 && esperaMs !== 0) return;
    this.pedidoPrevio?.unsubscribe();
    this.vistaPrevia.set(loading());
    const form = this.form();
    this.pedidoPrevio = (esperaMs === 0 ? of(0) : timer(esperaMs))
      .pipe(switchMap(() => this.reviews.previewCampaign(buildDraft(form))))
      .subscribe({
        next: (p) =>
          this.vistaPrevia.set(
            p.total === 0
              ? validation([
                  {
                    message:
                      'Con ese alcance y esos filtros no hay nada que revisar. Cambie el alcance o afloje los filtros.',
                    code: 'REVIEW_SCOPE_EMPTY',
                  },
                ])
              : ready(p),
          ),
        error: (failure: unknown) => {
          const f = accessFailureOf(failure);
          this.vistaPrevia.set(
            f?.reason === 'REVIEW_SCOPE_EMPTY'
              ? validation([{ message: f.message, code: f.reason }], undefined, f.requestId)
              : errorToViewState<CampaignPreview>(failure),
          );
        },
      });
  }

  /* ---- crear ------------------------------------------------------------------------------------------------------------------ */

  protected crear(lanzar: boolean): void {
    if (this.trabajando()) return;
    this.trabajando.set(true);
    this.error.set(null);
    this.borradorCreado.set(null);
    this.reviews.createCampaign(buildDraft(this.form())).subscribe({
      next: (creada) => {
        // La API y el simulador contestan solo `{ id }`; el detalle se pide con `getCampaign`.
        const id = creada.id;
        if (!lanzar) {
          this.irA(id);
          return;
        }
        this.reviews.launchCampaign(id).subscribe({
          next: () => this.irA(id),
          error: (failure: unknown) => {
            this.trabajando.set(false);
            this.borradorCreado.set(id);
            this.error.set(
              `La campaña se creó como borrador, pero no se pudo lanzar. ${this.texto(failure)} Ábrala para lanzarla de nuevo.`,
            );
          },
        });
      },
      error: (failure: unknown) => {
        this.trabajando.set(false);
        const f = accessFailureOf(failure);
        if (f?.reason === 'ADMIN_CEILING_EXCEEDED' && f.details?.['breach'] === 'AUTO_REVOKE') {
          this.rechazoPorQuitar();
          return;
        }
        this.error.set(this.texto(failure));
      },
    });
  }

  /**
   * Quitar por vencimiento es quitar (N-9): quien no tiene «quitar permisos» no lo obtiene por la puerta de las campañas.
   * Se vuelve al paso donde se elige, con el mensaje junto a ese campo, la acción queda en «escalar» y no se ofrece más «quitar».
   */
  private rechazoPorQuitar(): void {
    this.sinPermisoParaQuitar.set(true);
    this.form.update((f) => ({ ...f, uncertifiedAction: 'UNCERTIFIED_ESCALATE' }));
    this.error.set(null);
    this.problemas.set([
      {
        field: 'uncertifiedAction',
        message:
          'Su perfil no le permite quitar permisos, así que la campaña no puede quitar lo que nadie certifique a tiempo. Quedó en «escalar»: se escala y la campaña se cierra a mano. Si quiere que se quite solo, pídaselo a un administrador de seguridad.',
      },
    ]);
    this.paso.set(3);
    this.enfocar('[data-testid="campana-accion-escalar"]');
  }

  private irA(id: string): void {
    this.trabajando.set(false);
    void this.router.navigate([LISTA, id]);
  }

  private texto(failure: unknown): string {
    const f = accessFailureOf(failure);
    return f === null
      ? 'No pudimos completar la operación. Intente de nuevo.'
      : `${f.message}${f.requestId === undefined ? '' : ` Código de soporte: ${f.requestId}.`}`;
  }
}
