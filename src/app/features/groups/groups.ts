import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CommunityClient } from '../../core/data-access/community/community.client';
import { PERFIL_PUBLICO_REQUERIDO } from '../../core/data-access/community/community.types';
import type {
  GroupListItem,
  OwnPublicProfile,
  Topic,
} from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Link } from '../../shared/components/atoms/link/link';
import { Input } from '../../shared/components/atoms/input/input';
import { Switch } from '../../shared/components/atoms/switch/switch';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';

/** Cuántos grupos se piden por página. */
const PAGE_SIZE = 20;

/**
 * El directorio de grupos de la organización.
 *
 * ## Por qué la organización es obligatoria y no un filtro más
 *
 * `community.groups` es de las pocas tablas del módulo con `tenant_id`, y el
 * contrato exige el parámetro. Sin organización elegida no hay listado que
 * pedir: quien pertenece a varias tiene que elegir primero, y adivinar por ella
 * mostraría los grupos de la organización equivocada.
 *
 * ## Los grupos secretos no están, y eso no es un error
 *
 * El backend los excluye del directorio por definición: existen para quien ya
 * fue invitado. Se llega a ellos por su dirección, no por esta lista.
 *
 * ## Crear un grupo pide lo mínimo
 *
 * Nombre, dirección y tema. La visibilidad se elige entre pública y privada —el
 * grupo secreto no se ofrece acá porque nace de una invitación, no de un
 * formulario público—. Todo lo demás (portada, descripción larga, roles) se
 * edita después, desde el grupo.
 */
@Component({
  selector: 'app-groups',
  imports: [
    Alert,
    AppButton,
    Card,
    EmptyState,
    FormField,
    Input,
    PageHeader,
    Link,
    RouterLink,
    SearchField,
    Switch,
  ],
  templateUrl: './groups.html',
  styleUrl: './groups.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Groups {
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly grupos = signal<readonly GroupListItem[]>([]);
  protected readonly temas = signal<readonly Topic[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargoAlgunaVez = signal(false);

  protected readonly busqueda = signal('');
  protected readonly temaElegido = signal<string | null>(null);

  /** La organización activa. `null` mientras la persona no eligió. */
  protected readonly tenantId = this.auth.activeTenantId;

  protected readonly hayMas = computed(() => this.cursor() !== null);
  protected readonly vacio = computed(() => this.cargoAlgunaVez() && this.grupos().length === 0);

  // --- Alta ---

  protected readonly creando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly privado = signal(false);

  /* -- TP-3 · regla 06: el perfil público con el que se crea ---------------- */

  /**
   * La vitrina propia, o `null` si todavía no la configuró.
   *
   * Se pide al abrir la pantalla y no al enviar: la idea es que la opción
   * «público» ya llegue deshabilitada con su explicación, no que la persona
   * llene el formulario entero y recién ahí se entere.
   */
  private readonly perfilPropio = signal<OwnPublicProfile | null | undefined>(undefined);

  /**
   * Si el perfil público está completo para presentar un grupo público.
   *
   * Las mismas tres condiciones que comprueba el servidor —nombre visible, foto
   * y visibilidad pública—, y a propósito duplicadas: acá deciden qué se
   * ofrece, allá deciden qué se permite. La que manda sigue siendo la del
   * servidor; ésta sólo evita que la pantalla prometa algo que va a fallar.
   *
   * Mientras el perfil no cargó se asume que sí: bloquear la opción por una
   * lectura que todavía no volvió sería castigar a quien tiene la conexión
   * lenta.
   */
  protected readonly perfilListoParaPublico = computed(() => {
    const perfil = this.perfilPropio();
    if (perfil === undefined) return true;
    if (perfil === null) return false;
    return (
      perfil.displayName.trim() !== '' &&
      perfil.avatarFileId !== undefined &&
      perfil.visibility === 'PUBLIC'
    );
  });

  /**
   * La dirección del grupo sale del nombre.
   *
   * Pedirla aparte obligaría a explicar qué es un slug a quien sólo quiere
   * abrir un grupo de cardiología. Se deriva y se muestra, así que sigue siendo
   * visible antes de crear.
   */
  protected readonly slug = computed(() =>
    this.nombre()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120),
  );

  /**
   * El servidor rechazó por perfil incompleto.
   *
   * Se guarda aparte del `error` de texto porque no se muestra igual: los
   * demás errores son una frase, éste es una frase **con una salida** —el
   * enlace a configurar el perfil—, que es lo único que resuelve el caso.
   */
  protected readonly perfilIncompleto = signal(false);

  protected readonly puedeCrear = computed(() => this.slug().length > 0 && !this.guardando());

  constructor() {
    // Sin vitrina propia se puede seguir: lo único que cambia es que la opción
    // «público» queda deshabilitada con su explicación.
    this.community.getOwnProfile().subscribe({
      next: (perfil) => this.perfilPropio.set(perfil),
      error: () => this.perfilPropio.set(null),
    });

    this.community.listTopics().subscribe({
      next: (pagina) => this.temas.set(pagina.items),
      // Sin temas se puede seguir: el filtro desaparece, el directorio no.
      error: () => this.temas.set([]),
    });
    this.cargar();
  }

  /** Aplica un texto de búsqueda y vuelve a la primera página. */
  protected buscar(texto: string): void {
    this.busqueda.set(texto);
    this.recargar();
  }

  /** Alterna el tema por el que se filtra. Volver a tocarlo lo quita. */
  protected filtrarPorTema(topicId: string): void {
    this.temaElegido.update((actual) => (actual === topicId ? null : topicId));
    this.recargar();
  }

  /** Trae la primera página, descartando lo que hubiera. */
  protected recargar(): void {
    this.grupos.set([]);
    this.cursor.set(null);
    this.cargoAlgunaVez.set(false);
    this.cargar();
  }

  /** Trae la página siguiente y la agrega al final. */
  protected verMas(): void {
    if (this.hayMas() && !this.cargando()) {
      this.cargar();
    }
  }

  /** Abre o cierra el formulario de alta. */
  protected alternarAlta(): void {
    this.creando.update((abierto) => !abierto);
  }

  /** Crea el grupo y lleva a su pantalla, que es donde sigue el trabajo. */
  protected crear(): void {
    if (!this.puedeCrear()) {
      return;
    }

    this.guardando.set(true);
    this.error.set('');

    this.community
      .createGroup({
        slug: this.slug(),
        name: this.nombre().trim(),
        ...(this.descripcion().trim() === '' ? {} : { description: this.descripcion().trim() }),
        // Con el perfil incompleto la única opción disponible es privado, y
        // el interruptor ya está forzado: esto es la red por si el estado
        // cambia entre que se abrió el formulario y se envió.
        visibility: this.privado() || !this.perfilListoParaPublico() ? 'PRIVATE' : 'PUBLIC',
        ...(this.temaElegido() === null ? {} : { topicId: this.temaElegido() as string }),
      })
      .subscribe({
        next: ({ id }) => {
          this.guardando.set(false);
          this.creando.set(false);
          this.nombre.set('');
          this.descripcion.set('');
          void this.router.navigate(['/groups', id]);
        },
        error: (fallo: { status?: number; error?: { code?: string } }) => {
          this.guardando.set(false);

          // El servidor manda `PUBLIC_PROFILE_REQUIRED` justamente para que la
          // pantalla pueda ofrecer la salida en vez de repetir su texto. Sin
          // esto, quien no tiene el perfil configurado leía «no pudimos crear
          // el grupo, reintentá» y reintentaba para siempre.
          if (fallo.error?.code === PERFIL_PUBLICO_REQUERIDO) {
            this.perfilIncompleto.set(true);
            this.error.set('');
            return;
          }

          this.error.set(
            fallo.status === 409
              ? 'Ya hay un grupo con esa dirección. Cambiá el nombre.'
              : 'No pudimos crear el grupo. Reintentá.',
          );
        },
      });
  }

  private cargar(): void {
    const tenantId = this.tenantId();
    if (tenantId === null || this.cargando()) {
      return;
    }

    this.cargando.set(true);
    this.error.set('');

    const cursorActual = this.cursor();
    const tema = this.temaElegido();
    const texto = this.busqueda().trim();

    this.community
      .listGroups({
        tenantId,
        limit: PAGE_SIZE,
        ...(cursorActual === null ? {} : { cursor: cursorActual }),
        ...(tema === null ? {} : { topicId: tema }),
        ...(texto === '' ? {} : { q: texto }),
      })
      .subscribe({
        next: (pagina) => {
          this.grupos.update((previos) => [...previos, ...pagina.items]);
          this.cursor.set(pagina.nextCursor);
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
        },
        error: () => {
          this.cargando.set(false);
          this.cargoAlgunaVez.set(true);
          this.error.set('No pudimos cargar los grupos. Reintentá.');
        },
      });
  }
}
