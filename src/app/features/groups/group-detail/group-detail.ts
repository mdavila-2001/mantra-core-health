import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import type {
  GroupDetail as GroupDetailData,
  GroupMember,
  GroupWallItem,
} from '../../../core/data-access/community/community.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { GroupComposer } from '../group-composer/group-composer';
import { GroupPost } from '../group-post/group-post';

/** Cuántas publicaciones se piden por página. */
const PAGE_SIZE = 20;

/** Cuántos integrantes se muestran en el panel lateral. */
const MIEMBROS_VISIBLES = 20;

/**
 * El grupo por dentro: ficha, muro, integrantes y administración.
 *
 * ## Una sola llamada decide qué se ve
 *
 * `getGroup` trae `viewer`: si quien mira es integrante, si puede publicar y si
 * administra. Con eso la pantalla se pinta una vez y bien. Deducirlo del padrón
 * exigiría traerlo entero antes de saber si siquiera se puede leer el muro, y
 * haría parpadear el botón «unirse» delante de quien ya entró.
 *
 * ## El muro puede estar cerrado y el grupo existir igual
 *
 * En un grupo privado la ficha se ve —es lo que permite pedir el ingreso— pero
 * el muro responde 403. Eso no es un error de la pantalla: es la respuesta
 * correcta, y se muestra como «pedí entrar», no como «algo salió mal».
 *
 * ## Publicar recarga el muro, no lo parchea
 *
 * Una publicación nueva puede llegar con una respuesta ya escrita por otra
 * persona entre medio. Insertarla a mano en el árbol dejaría el hilo distinto
 * de lo que el servidor tiene; recargar la primera página cuesta una petición y
 * no miente.
 */
@Component({
  selector: 'app-group-detail',
  imports: [
    Alert,
    AppButton,
    Card,
    EmptyState,
    GroupComposer,
    GroupPost,
    PageHeader,
  ],
  templateUrl: './group-detail.html',
  styleUrl: './group-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetail {
  private readonly community = inject(CommunityClient);
  private readonly route = inject(ActivatedRoute);

  /**
   * El grupo, tomado de la ruta.
   *
   * Del snapshot y no de un `input`: el router de esta aplicacion no tiene
   * `withComponentInputBinding`, asi que un input de ruta llegaria vacio. Es
   * la misma lectura que hace la ficha de una encuesta.
   */
  private readonly groupIdRuta = this.route.snapshot.paramMap.get('groupId') ?? '';

  protected readonly grupo = signal<GroupDetailData | null>(null);
  protected readonly publicaciones = signal<readonly GroupWallItem[]>([]);
  protected readonly integrantes = signal<readonly GroupMember[]>([]);
  protected readonly pendientes = signal<readonly GroupMember[]>([]);

  protected readonly cargando = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly aviso = signal('');
  protected readonly cursor = signal<string | null>(null);
  protected readonly muroCerrado = signal(false);
  protected readonly noExiste = signal(false);

  /** Qué publicación tiene abierta su caja de respuesta. */
  protected readonly respondiendoA = signal<string | null>(null);

  protected readonly hayMas = computed(() => this.cursor() !== null);

  protected readonly puedePublicar = computed(
    () => this.grupo()?.viewer.canPost === true,
  );

  protected readonly administra = computed(
    () => this.grupo()?.viewer.canAdminister === true,
  );

  /** Si la persona ya pidió entrar y su alta está esperando aprobación. */
  protected readonly esperandoAprobacion = computed(() => {
    const viewer = this.grupo()?.viewer;
    return (
      viewer !== undefined && !viewer.isMember && viewer.membershipId !== null
    );
  });

  protected readonly puedeUnirse = computed(() => {
    const viewer = this.grupo()?.viewer;
    return viewer !== undefined && !viewer.isMember && viewer.membershipId === null;
  });

  constructor() {
    this.cargarFicha();
  }

  /** Se une al grupo. En uno privado el alta queda esperando aprobación. */
  protected unirse(): void {
    const perfil = this.grupo()?.viewer.membershipId;
    if (perfil !== null && perfil !== undefined) {
      return;
    }

    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        if (propio === null) {
          this.error.set(
            'Para unirte a un grupo necesitás perfil público. Se crea desde «Mi perfil».',
          );
          return;
        }
        this.community.joinGroup(this.groupIdRuta, propio.id).subscribe({
          next: () => {
            this.aviso.set('Listo. Si el grupo es privado, tu ingreso queda en revisión.');
            this.cargarFicha();
          },
          error: () => this.error.set('No pudimos unirte al grupo. Reintentá.'),
        });
      },
      error: () => this.error.set('No pudimos saber si tenés perfil público.'),
    });
  }

  /** Deja el grupo. */
  protected salir(): void {
    const perfilPropio = this.integranteQueSoy();
    if (perfilPropio === null) {
      return;
    }

    this.community.leaveGroup(this.groupIdRuta, perfilPropio).subscribe({
      next: () => {
        this.aviso.set('Saliste del grupo.');
        this.cargarFicha();
      },
      error: () => this.error.set('No pudimos darte de baja. Reintentá.'),
    });
  }

  /** Publica en el muro, o responde si hay una respuesta abierta. */
  protected publicar(bodyText: string): void {
    const grupo = this.grupo();
    if (grupo === null) {
      return;
    }

    this.community.getOwnProfile().subscribe({
      next: (propio) => {
        if (propio === null) {
          this.error.set('Necesitás perfil público para publicar.');
          return;
        }

        const padre = this.respondiendoA();
        this.enviando.set(true);
        this.community
          .publishGroupPost(this.groupIdRuta, {
            authorProfileId: propio.id,
            bodyText,
            ...(padre === null ? {} : { parentCommentId: padre }),
          })
          .subscribe({
            next: () => {
              this.enviando.set(false);
              this.respondiendoA.set(null);
              this.recargarMuro();
            },
            error: () => {
              this.enviando.set(false);
              this.error.set('No pudimos publicar. Reintentá.');
            },
          });
      },
      error: () => this.error.set('No pudimos saber si tenés perfil público.'),
    });
  }

  /** Abre o cierra la caja de respuesta de una publicación. */
  protected alternarRespuesta(postId: string): void {
    this.respondiendoA.update((actual) => (actual === postId ? null : postId));
  }

  /** Aprueba un alta pendiente. */
  protected aprobar(member: GroupMember): void {
    this.resolverAlta(member, 'APPROVE');
  }

  /** Rechaza un alta pendiente. */
  protected rechazar(member: GroupMember): void {
    this.resolverAlta(member, 'REJECT');
  }

  /** Da de baja a un integrante. */
  protected expulsar(member: GroupMember): void {
    this.community
      .leaveGroup(this.groupIdRuta, member.memberProfileId)
      .subscribe({
        next: () => this.cargarFicha(),
        error: () => this.error.set('No pudimos dar de baja a esa persona.'),
      });
  }

  /** Trae la página siguiente del muro. */
  protected verMas(): void {
    if (this.hayMas() && !this.cargando()) {
      this.cargarMuro();
    }
  }

  /** El identificador acortado de un integrante. La lectura no trae nombres. */
  protected etiqueta(member: GroupMember): string {
    return `Perfil ${member.memberProfileId.slice(0, 8)}`;
  }

  // --- Apoyo ---

  private resolverAlta(
    member: GroupMember,
    decision: 'APPROVE' | 'REJECT',
  ): void {
    this.community
      .updateGroupMember(this.groupIdRuta, member.id, { decision })
      .subscribe({
        next: () => this.cargarFicha(),
        error: () => this.error.set('No pudimos resolver la solicitud.'),
      });
  }

  /** El perfil con el que la persona es integrante, si lo es. */
  private integranteQueSoy(): string | null {
    const membershipId = this.grupo()?.viewer.membershipId;
    if (membershipId === null || membershipId === undefined) {
      return null;
    }
    const propio = this.integrantes().find((m) => m.id === membershipId);
    return propio?.memberProfileId ?? null;
  }

  private cargarFicha(): void {
    this.error.set('');
    this.community.getGroup(this.groupIdRuta).subscribe({
      next: (ficha) => {
        this.grupo.set(ficha);
        this.recargarMuro();
        this.cargarIntegrantes();
      },
      error: (fallo: { status?: number }) => {
        // 404 en un grupo secreto no significa «se rompió»: significa que para
        // quien mira ese grupo no existe, y decir otra cosa lo delataría.
        this.noExiste.set(fallo.status === 404);
        this.error.set(
          fallo.status === 404 ? '' : 'No pudimos cargar el grupo. Reintentá.',
        );
      },
    });
  }

  private recargarMuro(): void {
    this.publicaciones.set([]);
    this.cursor.set(null);
    this.muroCerrado.set(false);
    this.cargarMuro();
  }

  private cargarMuro(): void {
    if (this.cargando()) {
      return;
    }
    this.cargando.set(true);

    const cursorActual = this.cursor();
    this.community
      .listGroupWall(this.groupIdRuta, {
        limit: PAGE_SIZE,
        ...(cursorActual === null ? {} : { cursor: cursorActual }),
      })
      .subscribe({
        next: (pagina) => {
          this.publicaciones.update((previas) => [...previas, ...pagina.items]);
          this.cursor.set(pagina.nextCursor);
          this.cargando.set(false);
        },
        error: (fallo: { status?: number }) => {
          this.cargando.set(false);
          // 403 es la respuesta correcta de un grupo privado a quien no entró.
          this.muroCerrado.set(fallo.status === 403);
          if (fallo.status !== 403) {
            this.error.set('No pudimos cargar el muro. Reintentá.');
          }
        },
      });
  }

  private cargarIntegrantes(): void {
    this.community
      .listGroupMembers(this.groupIdRuta, {
        limit: MIEMBROS_VISIBLES,
        joinStatus: 'ACTIVE',
      })
      .subscribe({
        next: (pagina) => this.integrantes.set(pagina.items),
        // El padrón cerrado no rompe la pantalla: el muro es lo principal.
        error: () => this.integrantes.set([]),
      });

    if (!this.administra()) {
      this.pendientes.set([]);
      return;
    }

    this.community
      .listGroupMembers(this.groupIdRuta, {
        limit: MIEMBROS_VISIBLES,
        joinStatus: 'PENDING',
      })
      .subscribe({
        next: (pagina) => this.pendientes.set(pagina.items),
        error: () => this.pendientes.set([]),
      });
  }
}
