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
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, of, type Observable } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { DiagnosticsLabClient } from '../../core/data-access/diagnostics/diagnostics-lab.client';
import {
  CONTAINER_TYPE_TARGET,
  SPECIMEN_TYPE_TARGET,
  type LabInboxItem,
  type LabInboxPage,
  type SpecimenDetail,
} from '../../core/data-access/diagnostics/diagnostics-lab.types';
import { SystemContextClient } from '../../core/data-access/system-context/system-context.client';
import type { DynamicEnum } from '../../core/data-access/system-context/system-context.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { readApiError } from '../../core/http/api-error';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, forbidden, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Input } from '../../shared/components/atoms/input/input';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Filas por página de la bandeja. La API acota a 100. */
const PAGE_SIZE = 25;

/** Lo que se muestra cuando un dato no está. */
const NO_DATA = '—';

/** Largo mínimo de una búsqueda por paciente (lo exige la API). */
const MIN_QUERY_LENGTH = 2;

/**
 * El estado «rechazado» del espécimen, por su código. La API guarda como
 * código la **clave** del concepto (`diagnostics:SPECIMEN_REJECTED`) y el
 * simulador el código corto (`SPEC_REJECTED`): se aceptan las dos formas en vez
 * de atar la pantalla a un uuid que cambia por entorno.
 */
function isRejectedCode(code: string | undefined): boolean {
  return code === 'SPEC_REJECTED' || code?.endsWith(':SPECIMEN_REJECTED') === true;
}

/** En qué punto de la recepción está una orden de la bandeja. */
type ReceptionStage = 'pending' | 'received' | 'rejected';

/** Rótulo y tono de cada etapa, tal como se pintan en la columna «Estado». */
const STAGE_BADGE: Readonly<Record<ReceptionStage, { label: string; variant: BadgeVariant }>> = {
  pending: { label: 'Sin muestra', variant: 'warning' },
  received: { label: 'Muestra recibida', variant: 'success' },
  rejected: { label: 'Rechazada', variant: 'error' },
};

/**
 * **Recepción de muestras** del laboratorio (M20).
 *
 * ## Qué es y dónde encaja
 *
 * La bandeja de las órdenes que otras organizaciones le dirigieron al
 * laboratorio del tenant activo (`performer_tenant_id`) y que todavía no tienen
 * acesión — `POST /diagnostics/service-requests/inbox`. Es el paso **anterior**
 * a «Laboratorio e imagen»: aquélla es la cola de órdenes de trabajo, que nacen
 * de acesionar; ésta es la puerta por donde entra la muestra.
 *
 * Dos actos la vacían, en orden:
 *
 * 1. **Recibir muestra**: alta del espécimen con su tipo, y de su contenedor
 *    (el tubo o frasco, con su etiqueta). La orden sigue en la bandeja, ahora
 *    como «Muestra recibida», porque todavía falta acesionarla.
 * 2. **Registrar accesión**: acesiona las muestras no rechazadas de la orden.
 *    La API firma la recepción en la cadena de custodia y la orden sale de la
 *    bandeja: desde ahí es trabajo del laboratorio.
 *
 * ## Por qué la búsqueda por paciente va en el cuerpo
 *
 * El contrato es un `POST` de lectura: el nombre o el código de historia
 * clínica es PHI, y en una URL terminaría en logs y en el historial. Esta
 * pantalla no pone nada del paciente en su propia ruta tampoco.
 *
 * ## Los catálogos
 *
 * El tipo de espécimen y el de contenedor salen de `dynamic-enums`
 * (`specimen-type`, `specimen-container-type`). El rótulo que la API publica
 * ahí es el técnico, en inglés; el castellano lo trae la terminología
 * (`readConceptLabels`, con designación `ES`), y si no llega se muestra el
 * técnico antes que un uuid.
 */
@Component({
  selector: 'app-lab-reception',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    ContentDialog,
    DataTable,
    DatePipe,
    FormField,
    Input,
    PageHeader,
    SearchField,
    Select,
  ],
  templateUrl: './lab-reception.html',
  styleUrl: './lab-reception.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabReception {
  private readonly lab = inject(DiagnosticsLabClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly patientCell =
    viewChild.required<TemplateRef<{ $implicit: LabInboxItem }>>('patientCell');
  private readonly studyCell =
    viewChild.required<TemplateRef<{ $implicit: LabInboxItem }>>('studyCell');
  private readonly requestedCell =
    viewChild.required<TemplateRef<{ $implicit: LabInboxItem }>>('requestedCell');
  private readonly stageCell =
    viewChild.required<TemplateRef<{ $implicit: LabInboxItem }>>('stageCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: LabInboxItem }>>('actionsCell');

  /* ---- la bandeja ---------------------------------------------------------- */

  protected readonly inbox = signal<ViewState<readonly LabInboxItem[]>>(loading());
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);
  protected readonly patientQuery = signal('');

  /** Etiquetas en castellano de todos los conceptos que la pantalla muestra. */
  private readonly labels = signal<ConceptLabels>(new Map());

  protected readonly columns = computed<readonly ColumnDef<LabInboxItem>[]>(() => [
    { key: 'patient', header: 'Paciente', priority: 1, cell: this.patientCell() },
    { key: 'study', header: 'Estudio', priority: 1, cell: this.studyCell() },
    { key: 'requestedAt', header: 'Pedida', priority: 2, cell: this.requestedCell() },
    { key: 'stage', header: 'Estado', priority: 1, cell: this.stageCell() },
    { key: 'actions', header: 'Acciones', priority: 1, sticky: 'end', cell: this.actionsCell() },
  ]);

  protected readonly trackByOrder = (row: LabInboxItem): string => row.serviceRequestId;
  protected readonly rowName = (row: LabInboxItem): string =>
    `la orden de ${this.patientName(row)}`;

  /** La orden cuya cadena de custodia se está mirando, si hay una. */
  protected readonly custodyOrderId = signal<string | null>(null);
  protected readonly custodyOrder = computed(() => {
    const id = this.custodyOrderId();
    const state = this.inbox();
    if (id === null || state.status !== 'ready') return null;
    return state.data.find((row) => row.serviceRequestId === id) ?? null;
  });

  /* ---- catálogos ----------------------------------------------------------- */

  protected readonly specimenTypeOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly containerTypeOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly catalogsLoading = signal(false);
  protected readonly catalogsError = signal<string | null>(null);

  /* ---- «Recibir muestra» --------------------------------------------------- */

  protected readonly receiveOrder = signal<LabInboxItem | null>(null);
  protected readonly specimenType = signal<string | null>(null);
  protected readonly containerType = signal<string | null>(null);
  protected readonly containerLabel = signal<string | number | null>('');
  protected readonly receiveSubmitted = signal(false);
  protected readonly receiving = signal(false);
  protected readonly receiveError = signal<string | null>(null);

  protected readonly specimenTypeError = computed(() =>
    this.receiveSubmitted() && this.specimenType() === null ? 'Elegí el tipo de muestra.' : '',
  );
  protected readonly containerTypeError = computed(() =>
    this.receiveSubmitted() && this.containerType() === null ? 'Elegí el contenedor.' : '',
  );
  protected readonly containerLabelError = computed(() =>
    this.receiveSubmitted() && labelText(this.containerLabel()) === ''
      ? 'Escribí la etiqueta del tubo o frasco.'
      : '',
  );

  /* ---- «Registrar accesión» ------------------------------------------------ */

  protected readonly accessionOrder = signal<LabInboxItem | null>(null);
  protected readonly accessioning = signal(false);
  protected readonly accessionError = signal<string | null>(null);

  constructor() {
    effect(() => {
      untracked(() => this.load());
    });
  }

  /* ---- lectura para la plantilla ------------------------------------------- */

  protected label(conceptId: string | null | undefined): string {
    if (conceptId === null || conceptId === undefined) return NO_DATA;
    return this.labels().get(conceptId)?.display ?? NO_DATA;
  }

  protected patientName(row: LabInboxItem): string {
    return row.patientDisplayName ?? 'paciente sin nombre registrado';
  }

  protected stageOf(row: LabInboxItem): ReceptionStage {
    if (this.acceptedSpecimens(row).length > 0) return 'received';
    return row.specimens.length > 0 ? 'rejected' : 'pending';
  }

  protected stageBadge(row: LabInboxItem): { label: string; variant: BadgeVariant } {
    return STAGE_BADGE[this.stageOf(row)];
  }

  /** Las muestras que se pueden acesionar: las no rechazadas. */
  protected acceptedSpecimens(row: LabInboxItem): readonly SpecimenDetail[] {
    return row.specimens.filter((s) => !this.isRejected(s));
  }

  protected isRejected(specimen: SpecimenDetail): boolean {
    return isRejectedCode(this.labels().get(specimen.statusConceptId)?.code);
  }

  /* ---- la bandeja ---------------------------------------------------------- */

  protected reload(): void {
    this.load();
  }

  protected search(text: string): void {
    const query = text.trim();
    // Una letra suelta no es una búsqueda (la API responde 400): se espera a la
    // segunda. Vaciar el campo sí vuelve a la bandeja entera.
    if (query.length > 0 && query.length < MIN_QUERY_LENGTH) return;
    if (query === this.patientQuery()) return;
    this.patientQuery.set(query);
    this.load();
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (cursor === null || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.loadMoreError.set(null);
    this.fetchPage(cursor).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        const state = this.inbox();
        const current = state.status === 'ready' ? state.data : [];
        this.nextCursor.set(page.nextCursor);
        this.inbox.set(ready([...current, ...page.items]));
      },
      error: () => {
        this.loadingMore.set(false);
        this.loadMoreError.set('No pudimos traer más órdenes. Probá de nuevo.');
      },
    });
  }

  protected toggleCustody(row: LabInboxItem): void {
    this.custodyOrderId.update((id) => (id === row.serviceRequestId ? null : row.serviceRequestId));
  }

  private load(): void {
    this.inbox.set(loading());
    this.nextCursor.set(null);
    this.loadMoreError.set(null);
    this.custodyOrderId.set(null);

    this.fetchPage(undefined).subscribe({
      next: (page) => {
        this.nextCursor.set(page.nextCursor);
        if (page.items.length === 0 && page.nextCursor === null) {
          this.inbox.set(this.emptyState());
          return;
        }
        this.inbox.set(ready(page.items));
      },
      error: (error: unknown) => this.inbox.set(this.errorState(error)),
    });
  }

  /** Una página de la bandeja, con las etiquetas de sus conceptos ya pedidas. */
  private fetchPage(cursor: string | undefined): Observable<LabInboxPage> {
    const query = this.patientQuery();
    return this.lab
      .listInbox({
        limit: PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
        ...(query === '' ? {} : { patientQuery: query }),
      })
      .pipe(switchMap((page) => this.withLabels(conceptsOf(page.items)).pipe(map(() => page))));
  }

  /**
   * Pide las etiquetas que falten y las suma a las que ya hay. Si la
   * terminología falla, la bandeja se muestra igual con guiones: perder los
   * nombres es molesto, perder la lista entera sería peor.
   */
  private withLabels(conceptIds: readonly string[]): Observable<void> {
    const known = this.labels();
    const missing = conceptIds.filter((id) => !known.has(id));
    return this.terminology.readConceptLabels(missing).pipe(
      catchError(() => of(new Map() as ConceptLabels)),
      map((found) => {
        if (found.size === 0) return;
        this.labels.update((current) => new Map([...current, ...found]));
      }),
    );
  }

  private emptyState(): ViewState<readonly LabInboxItem[]> {
    if (this.patientQuery() !== '') {
      return empty(
        { label: 'Probá con otro nombre o con el código de historia clínica' },
        `Ninguna orden pendiente coincide con «${this.patientQuery()}».`,
      );
    }
    return empty(
      { label: 'Las órdenes nuevas aparecen acá solas al actualizar' },
      'No hay órdenes esperando muestra. Cuando una organización derive un análisis a este ' +
        'laboratorio, lo vas a ver en esta bandeja.',
    );
  }

  private errorState(error: unknown): ViewState<readonly LabInboxItem[]> {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return forbidden({
        message:
          'Esta bandeja es del personal del laboratorio. Si trabajás en uno, elegí su ' +
          'organización en el selector de arriba.',
      });
    }
    return errorToViewState<readonly LabInboxItem[]>(error);
  }

  /* ---- «Recibir muestra» --------------------------------------------------- */

  protected openReceive(row: LabInboxItem): void {
    this.receiveOrder.set(row);
    this.specimenType.set(null);
    this.containerType.set(null);
    this.containerLabel.set('');
    this.receiveSubmitted.set(false);
    this.receiveError.set(null);
    this.loadCatalogs();
  }

  protected closeReceive(): void {
    if (this.receiving()) return;
    this.receiveOrder.set(null);
  }

  protected submitReceive(): void {
    const row = this.receiveOrder();
    this.receiveSubmitted.set(true);
    const specimenTypeConceptId = this.specimenType();
    const containerTypeConceptId = this.containerType();
    const containerIdentifier = labelText(this.containerLabel());
    if (
      row === null ||
      specimenTypeConceptId === null ||
      containerTypeConceptId === null ||
      containerIdentifier === ''
    ) {
      return;
    }
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null) {
      this.receiveError.set('Elegí la organización del laboratorio antes de recibir la muestra.');
      return;
    }

    this.receiving.set(true);
    this.receiveError.set(null);
    this.lab
      .createSpecimen({
        patientProfileId: row.patientProfileId,
        custodianTenantId: tenantId,
        specimenTypeConceptId,
        serviceRequestId: row.serviceRequestId,
      })
      .pipe(
        switchMap((specimen) =>
          this.lab
            .createContainer(specimen.id, { containerIdentifier, containerTypeConceptId })
            .pipe(switchMap(() => this.lab.getSpecimen(specimen.id))),
        ),
        switchMap((detail) => this.withLabels(conceptsOfSpecimen(detail)).pipe(map(() => detail))),
      )
      .subscribe({
        next: (detail) => {
          this.receiving.set(false);
          this.replaceRow(row.serviceRequestId, (current) => ({
            ...current,
            specimens: [...current.specimens, detail],
          }));
          this.receiveOrder.set(null);
          this.toasts.success(
            `Recibiste la muestra de ${this.patientName(row)}. Falta registrar la accesión.`,
          );
        },
        error: (error: unknown) => {
          this.receiving.set(false);
          const reason = catalogReason(error);
          if (reason !== null) {
            // El catálogo de la pantalla quedó viejo respecto del de la API:
            // se olvida lo memoizado y se vuelve a pedir para que la próxima
            // elección sea válida.
            this.systemContext.forget(SPECIMEN_TYPE_TARGET);
            this.systemContext.forget(CONTAINER_TYPE_TARGET);
            this.specimenTypeOptions.set([]);
            this.containerTypeOptions.set([]);
            this.loadCatalogs();
            if (reason === CONTAINER_TYPE_NOT_IN_CATALOG) {
              // El espécimen ya se dio de alta; lo que faltó es el contenedor.
              // Se relee la bandeja para que la fila muestre lo que quedó.
              this.load();
            }
          }
          this.receiveError.set(
            reason === SPECIMEN_TYPE_NOT_IN_CATALOG
              ? 'Ese tipo de muestra ya no está en el catálogo. Actualizamos la lista: elegí otro.'
              : reason === CONTAINER_TYPE_NOT_IN_CATALOG
                ? 'La muestra quedó registrada, pero ese tipo de contenedor ya no está en el catálogo. Actualizamos la lista: elegí otro contenedor.'
                : (apiMessage(error) ??
                  'No pudimos registrar la muestra. Revisá los datos y probá de nuevo.'),
          );
        },
      });
  }

  private loadCatalogs(): void {
    if (this.specimenTypeOptions().length > 0 && this.containerTypeOptions().length > 0) return;
    this.catalogsLoading.set(true);
    this.catalogsError.set(null);
    forkJoin({
      specimen: this.systemContext.dynamicEnum(SPECIMEN_TYPE_TARGET),
      container: this.systemContext.dynamicEnum(CONTAINER_TYPE_TARGET),
    })
      .pipe(
        switchMap((catalogs) =>
          this.withLabels([
            ...catalogs.specimen.options.map((o) => o.conceptId),
            ...catalogs.container.options.map((o) => o.conceptId),
          ]).pipe(map(() => catalogs)),
        ),
      )
      .subscribe({
        next: ({ specimen, container }) => {
          this.catalogsLoading.set(false);
          this.specimenTypeOptions.set(this.optionsOf(specimen));
          this.containerTypeOptions.set(this.optionsOf(container));
          if (specimen.options.length === 0 || container.options.length === 0) {
            this.catalogsError.set(
              'Los catálogos de muestras todavía no están publicados. Avisá a quien administra la plataforma.',
            );
          }
        },
        error: () => {
          this.catalogsLoading.set(false);
          this.catalogsError.set('No pudimos cargar los tipos de muestra y de contenedor.');
        },
      });
  }

  private optionsOf(catalog: DynamicEnum): readonly SelectOption<string>[] {
    const labels = this.labels();
    return catalog.options.map((option) => ({
      value: option.conceptId,
      label: labels.get(option.conceptId)?.display ?? option.display,
    }));
  }

  protected retryCatalogs(): void {
    this.specimenTypeOptions.set([]);
    this.containerTypeOptions.set([]);
    this.loadCatalogs();
  }

  /* ---- «Registrar accesión» ------------------------------------------------ */

  protected openAccession(row: LabInboxItem): void {
    if (this.acceptedSpecimens(row).length === 0) return;
    this.accessionOrder.set(row);
    this.accessionError.set(null);
  }

  protected closeAccession(): void {
    if (this.accessioning()) return;
    this.accessionOrder.set(null);
  }

  protected submitAccession(): void {
    const row = this.accessionOrder();
    if (row === null) return;
    const specimenIds = this.acceptedSpecimens(row).map((s) => s.id);
    if (specimenIds.length === 0) return;

    this.accessioning.set(true);
    this.accessionError.set(null);
    this.lab
      .accession({
        patientProfileId: row.patientProfileId,
        specimenIds,
        serviceRequestId: row.serviceRequestId,
      })
      .pipe(
        // El número de acesión lo genera el servidor y la respuesta del alta no
        // lo trae: se lee el detalle para poder decirlo. Si esa lectura falla,
        // la acesión igual quedó hecha.
        switchMap((created) =>
          this.lab.getAccession(created.id).pipe(
            map((detail) => detail.accessionNumber),
            catchError(() => of(null)),
          ),
        ),
      )
      .subscribe({
        next: (accessionNumber) => {
          this.accessioning.set(false);
          this.accessionOrder.set(null);
          this.removeRow(row.serviceRequestId);
          this.toasts.success(
            accessionNumber === null
              ? `Registraste la accesión de ${this.patientName(row)}.`
              : `Registraste la accesión ${accessionNumber} de ${this.patientName(row)}.`,
            'La orden pasó a la cola del laboratorio',
          );
        },
        error: (error: unknown) => {
          this.accessioning.set(false);
          this.accessionError.set(
            apiMessage(error) ?? 'No pudimos registrar la accesión. Probá de nuevo.',
          );
        },
      });
  }

  /* ---- apoyo --------------------------------------------------------------- */

  private replaceRow(id: string, change: (row: LabInboxItem) => LabInboxItem): void {
    const state = this.inbox();
    if (state.status !== 'ready') return;
    this.inbox.set(
      ready(state.data.map((row) => (row.serviceRequestId === id ? change(row) : row))),
    );
  }

  private removeRow(id: string): void {
    const state = this.inbox();
    if (state.status !== 'ready') return;
    const rest = state.data.filter((row) => row.serviceRequestId !== id);
    if (this.custodyOrderId() === id) this.custodyOrderId.set(null);
    this.inbox.set(rest.length === 0 && this.nextCursor() === null ? this.emptyState() : ready(rest));
  }
}

/** El texto de la etiqueta, sin espacios de sobra. */
function labelText(value: string | number | null): string {
  return value === null ? '' : String(value).trim();
}

/** Motivos estables del 422 de la API cuando un tipo no es de su catálogo. */
const SPECIMEN_TYPE_NOT_IN_CATALOG = 'SPECIMEN_TYPE_NOT_IN_CATALOG';
const CONTAINER_TYPE_NOT_IN_CATALOG = 'CONTAINER_TYPE_NOT_IN_CATALOG';

/**
 * El motivo de catálogo del error, si es uno de los dos que la API declara
 * (`PRECONDITION_FAILED` con `details.reason`). Se ramifica por código, nunca
 * por el texto del mensaje.
 */
function catalogReason(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  const reason = body?.code === 'PRECONDITION_FAILED' ? body.details?.['reason'] : undefined;
  return reason === SPECIMEN_TYPE_NOT_IN_CATALOG || reason === CONTAINER_TYPE_NOT_IN_CATALOG
    ? reason
    : null;
}

/** El mensaje que la API explica, si vino uno legible. */
function apiMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  return body !== null && body.message !== '' ? body.message : null;
}

/** Los conceptos de una página que la pantalla traduce. */
function conceptsOf(items: readonly LabInboxItem[]): readonly string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.priorityConceptId !== null) ids.push(item.priorityConceptId);
    for (const specimen of item.specimens) ids.push(...conceptsOfSpecimen(specimen));
  }
  return ids;
}

/** Los conceptos de un espécimen: tipo, estado, contenedores y custodia. */
function conceptsOfSpecimen(specimen: SpecimenDetail): readonly string[] {
  return [
    specimen.specimenTypeConceptId,
    specimen.statusConceptId,
    ...specimen.containers.flatMap((c) => [c.containerTypeConceptId, c.statusConceptId]),
    ...specimen.custodyEvents.map((e) => e.custodyEventTypeConceptId),
  ];
}
