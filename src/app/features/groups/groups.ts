import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { CommunityClient } from '../../core/data-access/community/community.client';
import type {
  GroupListItem,
  Topic,
} from '../../core/data-access/community/community.types';
import { AppButton } from '../../shared/components/atoms/button/button';
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
  protected readonly vacio = computed(
    () => this.cargoAlgunaVez() && this.grupos().length === 0,
  );

  // --- Alta ---

  protected readonly creando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly privado = signal(false);

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

  protected readonly puedeCrear = computed(
    () => this.slug().length > 0 && !this.guardando(),
  );

  constructor() {
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
        ...(this.descripcion().trim() === ''
          ? {}
          : { description: this.descripcion().trim() }),
        visibility: this.privado() ? 'PRIVATE' : 'PUBLIC',
        ...(this.temaElegido() === null
          ? {}
          : { topicId: this.temaElegido() as string }),
      })
      .subscribe({
        next: ({ id }) => {
          this.guardando.set(false);
          this.creando.set(false);
          this.nombre.set('');
          this.descripcion.set('');
          void this.router.navigate(['/groups', id]);
        },
        error: (fallo: { status?: number }) => {
          this.guardando.set(false);
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
