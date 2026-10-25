import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, EMPTY, expand, forkJoin, map, of, reduce, switchMap, tap, type Observable } from 'rxjs';

import { SessionStore } from '../../core/auth/session.store';
import { MedicalGroupsClient } from '../../core/data-access/medical-groups/medical-groups.client';
import type {
  MedicalGroup,
  MedicalGroupConditionOption,
  MedicalGroupDecision,
  MedicalGroupListItem,
  MedicalGroupMember,
  MedicalGroupTab,
  NewMedicalGroup,
} from '../../core/data-access/medical-groups/medical-groups.types';
import { ProfilesClient } from '../../core/data-access/profiles/profiles.client';
import type {
  PatientListItem,
  PractitionerListItem,
} from '../../core/data-access/profiles/profiles.types';
import { ServicesCatalogClient } from '../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ServiceCatalogItem,
} from '../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready, stale } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { MEDICAL_GROUP_NEW_ROUTE, MEDICAL_GROUPS_ROUTE } from './medical-groups.routes';

/** Cuántas filas trae cada página del listado. */
const PAGE_SIZE = 20;

/** Cuántos servicios se piden por práctica al resolver el nombre de uno. */
const SERVICES_PER_PRACTICE = 100;

/** Cuántos profesionales trae cada página del directorio y cuántas páginas se recorren. */
const DIRECTORY_PAGE_SIZE = 50;
const DIRECTORY_MAX_PAGES = 10;

/** Cuántas coincidencias se ofrecen al buscar un servicio o un paciente. */
const SEARCH_LIMIT = 10;

/** Un profesional que se puede invitar al grupo. */
export interface DirectoryPractitioner {
  readonly profileId: string;
  readonly name: string;
  readonly title: string | null;
}

/** Lo que el listado tiene hasta ahora, con el cursor de la página que sigue. */
export interface MedicalGroupListing {
  readonly items: readonly MedicalGroupListItem[];
  readonly nextCursor: string | null;
}

/**
 * Estado de los grupos médicos con señales.
 *
 * Una sola instancia (`providedIn: 'root'`) y sin store externo: el listado de
 * la pestaña abierta, la ficha abierta, los nombres ya resueltos y el estado de
 * la escritura en curso. Las pantallas leen las señales y llaman a los métodos;
 * ninguna habla con el cliente.
 *
 * ## Qué manda la API y qué se resuelve acá
 *
 * La API devuelve **identificadores** (servicio, paciente, profesionales), no
 * nombres. Los nombres se piden aparte, de a uno, a los clientes que ya existen
 * (`ProfilesClient`, `ServicesCatalogClient`) y se guardan en {@link labels}.
 * Si una consulta falla, la pantalla muestra el rótulo genérico de
 * {@link labelOf}: un nombre que no llegó no puede tumbar la ficha.
 *
 * ## Estados M34
 *
 * Listado y ficha son `ViewState`: S2 mientras cargan, S3 vacío con la acción
 * de crear, S4/S5/S6/S8/S9 por `errorToViewState`, y S7 cuando una recarga
 * falla y todavía hay datos viejos que mostrar.
 */
@Injectable({ providedIn: 'root' })
export class MedicalGroupsService {
  private readonly client = inject(MedicalGroupsClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly session = inject(SessionStore);

  /* ---- listado ------------------------------------------------------------ */

  readonly tab = signal<MedicalGroupTab>('historico');
  readonly listing = signal<ViewState<MedicalGroupListing>>(loading());
  readonly loadingMore = signal(false);
  private listingLoadedAt: Date | null = null;

  /** El perfil profesional de quien entró, o `null` si la cuenta no atiende. */
  readonly myProfileId = computed(() => this.session.practitionerProfileId());

  /** Carga la primera página de una pestaña. */
  loadList(tab: MedicalGroupTab): void {
    const previous = this.listing();
    const sameTab = this.tab() === tab;
    this.tab.set(tab);
    if (!sameTab || previous.status !== 'ready') {
      this.listing.set(loading());
    }
    this.client.list(tab, { limit: PAGE_SIZE }).subscribe({
      next: (page) => {
        this.listingLoadedAt = new Date();
        this.listing.set(
          page.items.length > 0
            ? ready({ items: page.items, nextCursor: page.nextCursor ?? null })
            : empty(
                { label: 'Crear grupo médico', route: MEDICAL_GROUP_NEW_ROUTE },
                EMPTY_LISTING_MESSAGE[tab],
              ),
        );
        this.resolveListLabels(page.items);
      },
      error: (error: unknown) => this.listing.set(this.failed(error, previous, this.listingLoadedAt)),
    });
  }

  /** Trae la página siguiente y la agrega al final. */
  loadMore(): void {
    const current = this.listing();
    if (current.status !== 'ready' || current.data.nextCursor === null || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.client.list(this.tab(), { cursor: current.data.nextCursor, limit: PAGE_SIZE }).subscribe({
      next: (page) => {
        this.loadingMore.set(false);
        this.listing.set(
          ready({
            items: [...current.data.items, ...page.items],
            nextCursor: page.nextCursor ?? null,
          }),
        );
        this.resolveListLabels(page.items);
      },
      error: () => this.loadingMore.set(false),
    });
  }

  /* ---- ficha -------------------------------------------------------------- */

  readonly detail = signal<ViewState<MedicalGroup>>(loading());
  private detailLoadedAt: Date | null = null;

  /** Carga la ficha de un grupo y resuelve los nombres que muestra. */
  loadDetail(groupId: string): void {
    const previous = this.detail();
    const same = previous.status === 'ready' && previous.data.id === groupId;
    if (!same) {
      this.detail.set(loading());
    }
    this.client.get(groupId).subscribe({
      next: (group) => this.showGroup(group),
      error: (error: unknown) =>
        this.detail.set(this.failed(error, same ? previous : loading(), this.detailLoadedAt)),
    });
  }

  private showGroup(group: MedicalGroup): void {
    this.detailLoadedAt = new Date();
    this.detail.set(ready(group));
    this.resolveGroupLabels(group);
  }

  /* ---- nombres ------------------------------------------------------------ */

  private readonly labelMap = signal<ReadonlyMap<string, string>>(new Map());
  private readonly pendingLabels = new Set<string>();

  /** Los nombres ya resueltos, por identificador. */
  readonly labels = this.labelMap.asReadonly();

  /** El nombre de un id si ya llegó, o el rótulo genérico que se le pasa. */
  labelOf(id: string | undefined, fallback: string): string {
    return id === undefined ? fallback : (this.labelMap().get(id) ?? fallback);
  }

  private setLabel(id: string, label: string): void {
    this.pendingLabels.delete(id);
    this.labelMap.update((current) => new Map(current).set(id, label));
  }

  private resolveListLabels(items: readonly MedicalGroupListItem[]): void {
    this.resolveServices(items.map((item) => item.serviceCatalogId));
    items.forEach((item) => item.patientProfileId !== undefined && this.resolvePatient(item.patientProfileId));
  }

  private resolveGroupLabels(group: MedicalGroup): void {
    this.resolveServices([group.serviceCatalogId]);
    if (group.patientProfileId !== undefined) {
      this.resolvePatient(group.patientProfileId);
      if (group.conditionId !== undefined) {
        this.resolveCondition(group.patientProfileId, group.conditionId);
      }
    }
    [group.requestingPractitionerId, ...group.members.map((m) => m.practitionerProfileId)].forEach(
      (id) => this.resolvePractitioner(id),
    );
  }

  private shouldResolve(id: string): boolean {
    if (this.labelMap().has(id) || this.pendingLabels.has(id)) {
      return false;
    }
    this.pendingLabels.add(id);
    return true;
  }

  private resolvePatient(id: string): void {
    if (!this.shouldResolve(id)) return;
    this.profiles.getPatient(id).subscribe({
      next: (patient) => this.setLabel(id, patient.displayName ?? patient.patientCode),
      error: () => this.pendingLabels.delete(id),
    });
  }

  /** El diagnóstico sólo se lee por paciente: se busca en su lista por identificador. */
  private resolveCondition(patientProfileId: string, conditionId: string): void {
    if (!this.shouldResolve(conditionId)) return;
    this.client.listPatientConditions(patientProfileId).subscribe({
      next: (rows) => {
        const found = rows.find((row) => row.id === conditionId);
        if (found === undefined) {
          this.pendingLabels.delete(conditionId);
        } else {
          this.setLabel(conditionId, `${found.code} · ${found.display}`);
        }
      },
      error: () => this.pendingLabels.delete(conditionId),
    });
  }

  private resolvePractitioner(id: string): void {
    if (!this.shouldResolve(id)) return;
    this.profiles.getPractitionerProfile(id).subscribe({
      next: (practitioner) =>
        this.setLabel(id, practitioner.displayName ?? practitioner.practitionerCode),
      error: () => this.pendingLabels.delete(id),
    });
  }

  /**
   * El catálogo no tiene lectura por identificador: se recorren las prácticas
   * propias y se busca el servicio en cada una. Un servicio de otra práctica no
   * aparece y la pantalla se queda con el rótulo genérico.
   */
  private resolveServices(ids: readonly string[]): void {
    const wanted = ids.filter((id) => this.shouldResolve(id));
    if (wanted.length === 0) return;
    this.catalog
      .listPractices()
      .pipe(
        switchMap((practices) =>
          practices.length === 0
            ? of([])
            : forkJoin(
                practices.map((practice) =>
                  this.catalog.search(practice.id, { limit: SERVICES_PER_PRACTICE }),
                ),
              ),
        ),
        catchError(() => {
          wanted.forEach((id) => this.pendingLabels.delete(id));
          return EMPTY;
        }),
      )
      .subscribe((pages) => {
        const services = pages.flatMap((page) => page.items);
        for (const id of wanted) {
          const found = services.find((service) => service.id === id);
          if (found === undefined) {
            this.pendingLabels.delete(id);
          } else {
            this.setLabel(id, found.name);
          }
        }
      });
  }

  /* ---- diagnósticos del paciente (alta) ---------------------------------- */

  readonly conditions = signal<ViewState<readonly MedicalGroupConditionOption[]> | null>(null);

  /** Pide los diagnósticos del paciente elegido; `null` borra el selector. */
  loadConditions(patientProfileId: string | null): void {
    if (patientProfileId === null) {
      this.conditions.set(null);
      return;
    }
    this.conditions.set(loading());
    this.client.listPatientConditions(patientProfileId).subscribe({
      next: (rows) =>
        this.conditions.set(
          rows.length > 0
            ? ready(rows)
            : empty(
                { label: 'Seguir sin diagnóstico' },
                'Este paciente no tiene diagnósticos registrados.',
              ),
        ),
      error: (error: unknown) => this.conditions.set(errorToViewState(error)),
    });
  }

  /* ---- lo que el alta necesita buscar ------------------------------------- */

  /** Las prácticas propias: el servicio del grupo tiene que ser de una de ellas. */
  listPractices(): Observable<readonly Practice[]> {
    return this.catalog.listPractices();
  }

  /** Servicios activos de una práctica que coinciden con lo escrito. */
  searchServices(practiceId: string, query: string): Observable<readonly ServiceCatalogItem[]> {
    return this.catalog
      .search(practiceId, { query, isActive: true, limit: SEARCH_LIMIT })
      .pipe(map((page) => page.items));
  }

  /** Pacientes que coinciden con lo escrito. */
  searchPatients(query: string): Observable<readonly PatientListItem[]> {
    return this.profiles
      .searchPatients({ query, limit: SEARCH_LIMIT })
      .pipe(map((page) => page.items));
  }

  /** El directorio de profesionales invitables; el directorio no busca por nombre, se filtra acá. */
  readonly directory = signal<ViewState<readonly DirectoryPractitioner[]>>(loading());

  /** Recorre las páginas del directorio, sin repetidos y sin quien está creando el grupo. */
  loadDirectory(): void {
    this.directory.set(loading());
    const me = this.myProfileId();
    this.profiles
      .listPractitioners({ limit: DIRECTORY_PAGE_SIZE })
      .pipe(
        expand((page, index) =>
          page.nextCursor === null || index + 1 >= DIRECTORY_MAX_PAGES
            ? EMPTY
            : this.profiles.listPractitioners({
                limit: DIRECTORY_PAGE_SIZE,
                cursor: page.nextCursor,
              }),
        ),
        reduce(
          (all: readonly PractitionerListItem[], page) => [...all, ...page.items],
          [] as readonly PractitionerListItem[],
        ),
      )
      .subscribe({
        next: (rows) => {
          const seen = new Set<string>();
          const people = rows
            .filter((row) => row.profileId !== me && !seen.has(row.profileId) && seen.add(row.profileId))
            .map<DirectoryPractitioner>((row) => ({
              profileId: row.profileId,
              name: row.displayName?.trim() || row.practitionerCode,
              title: row.professionalTitle?.trim() || null,
            }))
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
          this.directory.set(
            people.length > 0
              ? ready(people)
              : empty({ label: 'Volver al listado', route: MEDICAL_GROUPS_ROUTE }, 'No hay otros profesionales para invitar.'),
          );
        },
        error: (error: unknown) => this.directory.set(errorToViewState(error)),
      });
  }

  /* ---- escrituras --------------------------------------------------------- */

  /** Hay una escritura en vuelo: las pantallas desactivan sus botones. */
  readonly saving = signal(false);

  /** El fallo de la última escritura (S4 con los motivos, S5, S9…), o `null`. */
  readonly writeError = signal<ViewState<never> | null>(null);

  /** Crea el grupo. Emite la ficha creada; ante un fallo, deja el motivo en {@link writeError}. */
  create(group: NewMedicalGroup): Observable<MedicalGroup> {
    return this.write(this.client.create(group));
  }

  /** El invitado acepta o rechaza su cargo. */
  respondToInvitation(
    groupId: string,
    member: MedicalGroupMember,
    decision: MedicalGroupDecision,
  ): Observable<MedicalGroup> {
    return this.write(this.client.respondToInvitation(groupId, member.id, decision));
  }

  /** Propone otra fecha (ISO 8601). */
  requestReschedule(groupId: string, proposedAt: string): Observable<MedicalGroup> {
    return this.write(this.client.requestReschedule(groupId, proposedAt));
  }

  /** El creador resuelve la fecha propuesta. */
  respondToReschedule(groupId: string, decision: MedicalGroupDecision): Observable<MedicalGroup> {
    return this.write(this.client.respondToReschedule(groupId, decision));
  }

  /** Guarda las notas del procedimiento. */
  saveExerciseNotes(groupId: string, notesText: string): Observable<MedicalGroup> {
    return this.write(this.client.updateExerciseNotes(groupId, notesText));
  }

  /** Descarta el fallo mostrado (al cambiar de pestaña o de pantalla). */
  clearWriteError(): void {
    this.writeError.set(null);
  }

  /**
   * Toda escritura devuelve el grupo ya actualizado: ese es el dato que se
   * muestra, sin pedirlo otra vez, y por eso la ficha abierta se reemplaza acá.
   * Un fallo no tumba la pantalla: queda en {@link writeError} y el flujo del
   * llamador termina sin emitir.
   */
  private write(request: Observable<MedicalGroup>): Observable<MedicalGroup> {
    this.saving.set(true);
    this.writeError.set(null);
    return request.pipe(
      tap((group) => {
        this.saving.set(false);
        const current = this.detail();
        if (current.status === 'ready' && current.data.id === group.id) {
          this.showGroup(group);
        }
      }),
      catchError((error: unknown) => {
        this.saving.set(false);
        this.writeError.set(errorToViewState<never>(error));
        return EMPTY;
      }),
    );
  }

  /**
   * Un fallo de lectura: si ya había datos, se conservan y se marcan con su
   * antigüedad (S7) en vez de borrarlos; si no, el estado que corresponda.
   */
  private failed<T>(
    error: unknown,
    previous: ViewState<T>,
    loadedAt: Date | null,
  ): ViewState<T> {
    const data = dataOf(previous);
    if (data !== null && loadedAt !== null) {
      return stale(data, loadedAt);
    }
    return errorToViewState<T>(error);
  }
}

const EMPTY_LISTING_MESSAGE: Readonly<Record<MedicalGroupTab, string>> = {
  historico: 'Todavía no participó en ningún grupo médico.',
  enviadas: 'No tiene solicitudes enviadas: ningún grupo suyo espera respuestas.',
  recibidas: 'No tiene invitaciones a un grupo médico por responder.',
};
