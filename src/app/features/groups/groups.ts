import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CommunityClient } from '../../core/data-access/community/community.client';
import { PERFIL_PUBLICO_REQUERIDO } from '../../core/data-access/community/community.types';
import type {
  GroupListItem,
  OwnPublicProfile,
  Topic,
} from '../../core/data-access/community/community.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready, unexpectedError } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { MinShowcase } from '../communities/minimal-showcase/minimal-showcase';
import { GroupForm, deriveGroupSlug, type GroupFormData } from './group-form/group-form';

const PAGE_SIZE = 20;

@Component({
  selector: 'app-groups',
  imports: [
    Alert,
    AppButton,
    Badge,
    DataTable,
    EmptyState,
    GroupForm,
    MinShowcase,
    PageHeader,
    RouterLink,
    SearchField,
    Tab,
    Tabs,
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups {
  readonly embedded = input(false);
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly tenantId = this.auth.activeTenantId;
  protected readonly grupos = signal<readonly GroupListItem[]>([]);
  protected readonly temas = signal<readonly Topic[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargoAlgunaVez = signal(false);
  protected readonly busqueda = signal('');
  protected readonly temaElegido = signal<string | null>(null);
  protected readonly selectedIndex = signal(0);
  protected readonly creando = signal(false);
  protected readonly guardando = signal(false);

  /** Campos mantenidos para compatibilidad con pruebas unitarias. */
  protected readonly nombre = signal('');
  protected readonly slug = computed(() => deriveGroupSlug(this.nombre()));

  protected readonly perfilPropio = signal<OwnPublicProfile | null | undefined>(undefined);
  protected readonly perfilIncompleto = signal(false);

  protected readonly perfilListoParaPublico = computed(() => {
    const p = this.perfilPropio();
    return !!p && p.displayName.trim() !== '' && !!p.avatarFileId && p.visibility === 'PUBLIC';
  });

  private readonly groupNameCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('groupNameCell');
  private readonly topicCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('topicCell');
  private readonly typeCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('typeCell');
  private readonly visibilityCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('visibilityCell');
  private readonly membersCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('membersCell');
  private readonly actionsCell = viewChild.required<TemplateRef<{ $implicit: GroupListItem }>>('actionsCell');

  protected readonly columnsHistorico = computed<readonly ColumnDef<GroupListItem>[]>(() => [
    { key: 'name', header: 'Grupo', priority: 1, cell: this.groupNameCell() },
    { key: 'topic', header: 'Tema', priority: 2, cell: this.topicCell() },
    { key: 'groupType', header: 'Tipo', priority: 3, cell: this.typeCell() },
    { key: 'visibility', header: 'Visibilidad', priority: 2, cell: this.visibilityCell() },
    { key: 'memberCount', header: 'Integrantes', priority: 2, cell: this.membersCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, align: 'end', cell: this.actionsCell() },
  ]);

  protected readonly columnsEnviadas = computed<readonly ColumnDef<GroupListItem>[]>(() => [
    { key: 'name', header: 'Grupo solicitado', priority: 1, cell: this.groupNameCell() },
    { key: 'topic', header: 'Tema', priority: 2, cell: this.topicCell() },
    { key: 'visibility', header: 'Visibilidad', priority: 2, cell: this.visibilityCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, align: 'end', cell: this.actionsCell() },
  ]);

  protected readonly columnsRecibidas = computed<readonly ColumnDef<GroupListItem>[]>(() => [
    { key: 'name', header: 'Grupo que administra', priority: 1, cell: this.groupNameCell() },
    { key: 'memberCount', header: 'Integrantes', priority: 2, cell: this.membersCell() },
    { key: 'acciones', header: 'Acciones', priority: 1, align: 'end', cell: this.actionsCell() },
  ]);

  protected readonly stateOfHistorico = computed<ViewState<readonly GroupListItem[]>>(() => {
    if (this.cargando() && this.grupos().length === 0) return loading();
    if (this.error()) return unexpectedError(this.error());
    if (this.grupos().length === 0 && this.cargoAlgunaVez()) {
      return empty({ label: 'Crear grupo', route: '/groups' }, 'No hay grupos que coincidan');
    }
    return ready(this.grupos());
  });

  protected readonly stateOfEnviadas = computed<ViewState<readonly GroupListItem[]>>(() =>
    empty({ label: 'Ver histórico', route: '/groups' }, 'No tiene solicitudes enviadas esperando respuesta.'),
  );

  protected readonly stateOfRecibidas = computed<ViewState<readonly GroupListItem[]>>(() => {
    const miPerfil = this.perfilPropio()?.id;
    const administrados = miPerfil ? this.grupos().filter((g) => g.ownerProfileId === miPerfil) : [];
    return administrados.length === 0
      ? empty({ label: 'Ver histórico', route: '/groups' }, 'No tiene solicitudes por responder.')
      : ready(administrados);
  });

  protected readonly trackById = (item: GroupListItem): string => item.id;

  constructor() {
    this.community.getOwnProfile().subscribe({
      next: (perfil) => this.perfilPropio.set(perfil),
      error: () => this.perfilPropio.set(null),
    });
    this.community.listTopics().subscribe({
      next: (pagina) => this.temas.set(pagina.items),
      error: () => this.temas.set([]),
    });
    this.cargar();
  }

  protected temaNombre(topicId?: string): string {
    return topicId ? (this.temas().find((t) => t.id === topicId)?.name ?? 'General') : 'General';
  }

  protected cursorOfHistorico(): { prevCursor: string | null; nextCursor: string | null } {
    return { prevCursor: null, nextCursor: this.cursor() };
  }

  protected cambiarCursor(direction: string): void {
    if (direction === 'next' && this.cursor() !== null) this.cargar();
  }

  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.recargar();
  }

  protected filtrarPorTema(topicId: string): void {
    this.temaElegido.update((actual) => (actual === topicId ? null : topicId));
    this.recargar();
  }

  protected recargar(): void {
    this.grupos.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.cargar();
  }

  protected alternarAlta(): void {
    this.creando.update((abierto) => !abierto);
  }

  protected alCrearLaVitrina(perfil: OwnPublicProfile): void {
    this.perfilPropio.set(perfil);
    this.perfilIncompleto.set(false);
  }

  protected abrirGrupo(grupo: GroupListItem): void {
    void this.router.navigate(['/groups', grupo.id]);
  }

  protected crear(datos?: GroupFormData): void {
    const info: GroupFormData = datos ?? {
      name: this.nombre().trim(),
      slug: this.slug(),
      visibility: this.perfilListoParaPublico() ? 'PUBLIC' : 'PRIVATE',
      groupType: 'GENERAL',
    };
    if (info.slug.length === 0 || this.guardando()) return;
    this.guardando.set(true);
    this.error.set('');

    const enviar = () => {
      this.community.createGroup({
        slug: info.slug,
        name: info.name,
        ...(info.description ? { description: info.description } : {}),
        visibility: info.visibility,
        ...(info.topicId ? { topicId: info.topicId } : {}),
        groupType: info.groupType,
      }).subscribe({
        next: ({ id }) => {
          this.guardando.set(false);
          this.creando.set(false);
          this.nombre.set('');
          this.toasts.success('Grupo creado correctamente');
          void this.router.navigate(['/groups', id]);
        },
        error: (fallo: {
          status?: number;
          error?: { code?: string; details?: { code?: string }; reason?: string; message?: string };
        }) => {
          this.guardando.set(false);
          const errCode = fallo.error?.details?.code ?? fallo.error?.code;
          const errReason = fallo.error?.reason;
          if (
            errCode === PERFIL_PUBLICO_REQUERIDO ||
            errReason === 'OWNER_PUBLIC_PROFILE_REQUIRED' ||
            errReason === 'PUBLIC_GROUP_OWNER_PROFILE_INCOMPLETE' ||
            fallo.status === 422
          ) {
            this.perfilIncompleto.set(true);
            this.error.set(fallo.error?.message ?? 'Para crear un grupo público necesita su perfil público configurado con foto.');
            return;
          }
          this.error.set(fallo.status === 409 ? 'Ya hay un grupo con esa dirección. Cambie el nombre.' : 'No pudimos crear el grupo. Reintente.');
        },
      });
    };

    const tenant = this.tenantId();
    if (this.perfilPropio() === null && tenant !== null) {
      const nombreTitular = this.auth.displayName() || info.name;
      this.community.upsertOwnProfile({
        tenantId: tenant,
        slug: deriveGroupSlug(nombreTitular) || 'perfil',
        displayName: nombreTitular,
        visibility: 'PUBLIC',
      }).subscribe({
        next: (p) => {
          this.perfilPropio.set(p);
          enviar();
        },
        error: () => enviar(),
      });
    } else {
      enviar();
    }
  }

  private cargar(): void {
    const tenantId = this.tenantId();
    if (tenantId === null || this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.community.listGroups({
      tenantId,
      limit: PAGE_SIZE,
      ...(this.cursor() ? { cursor: this.cursor()! } : {}),
      ...(this.temaElegido() ? { topicId: this.temaElegido()! } : {}),
      ...(this.busqueda().trim() ? { q: this.busqueda().trim() } : {}),
    }).subscribe({
      next: (pagina) => {
        this.grupos.update((prev) => [...prev, ...pagina.items]);
        this.cursor.set(pagina.nextCursor);
        this.cargando.set(false);
        this.cargoAlgunaVez.set(true);
      },
      error: () => {
        this.cargando.set(false);
        this.cargoAlgunaVez.set(true);
        this.error.set('No pudimos cargar los grupos. Reintente.');
      },
    });
  }
}
