import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { CommunityClient } from '../../../../core/data-access/community/community.client';
import type { OwnPublicProfile } from '../../../../core/data-access/community/community.types';
import { FilesClient } from '../../../../core/data-access/files/files.client';
import type { PublicProfileDetail } from '../../../../core/data-access/public-directory/public-directory.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PublicProfileCard } from '../../../public-profile/public-profile-card/public-profile-card';

/** Sólo minúsculas, números y guiones — la misma regla que el backend valida. */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * **Vitrina pública** — la configuras y ves acá mismo cómo queda.
 *
 * ## Por qué edición y vista previa viven en la misma pantalla
 *
 * Separarlas en dos pantallas —una para escribir el slug y la biografía, otra
 * para verlas— obliga a ir y volver para confirmar cada cambio. Acá el
 * formulario y la tarjeta de «así te ven» están una al lado de la otra: se
 * escribe de un lado y el resultado se lee del otro, en la misma pantalla,
 * antes de guardar.
 *
 * ## `PUT` idempotente: no hay «crear» separado de «editar»
 *
 * `CommunityClient.upsertOwnProfile` crea la vitrina si no existía y la
 * actualiza si ya existía — la misma llamada, el mismo formulario. La pantalla
 * no necesita preguntarse cuál de las dos cosas está pasando: sólo manda lo que
 * el formulario dice.
 *
 * ## Quién puede tener vitrina
 *
 * Cualquier sesión con perfil profesional. `getOwnProfile` resuelve el sujeto
 * por el mismo criterio que el backend: el perfil profesional si lo hay, la
 * cuenta si no.
 */
@Component({
  selector: 'app-public-profile-preview',
  imports: [
    Alert,
    Card,
    FormActions,
    FormField,
    Input,
    PageHeader,
    PublicProfileCard,
    RouterLink,
    Switch,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './public-profile-preview.html',
  styleUrl: './public-profile-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfilePreview {
  private readonly community = inject(CommunityClient);
  private readonly files = inject(FilesClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * `null` es un estado **listo**, no una carga: significa «esta sesión
   * todavía no tiene vitrina», que es el punto de partida de cualquiera.
   */
  protected readonly perfil = signal<ViewState<OwnPublicProfile | null>>(loading());

  protected readonly tieneVitrina = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' && estado.data !== null;
  });

  /* -- El formulario --------------------------------------------------------- */

  protected readonly slug = signal('');
  protected readonly displayName = signal('');
  protected readonly headline = signal('');
  protected readonly biography = signal('');
  protected readonly acceptsReviews = signal(true);
  protected readonly guardando = signal(false);

  /* -- El avatar de la vitrina ------------------------------------------- */

  /** Mientras la foto viaja. Bloquea el control para no subir dos veces. */
  protected readonly subiendoFoto = signal(false);
  /** Qué salió mal, si salió mal. Vacío es que no pasó nada. */
  protected readonly errorDeFoto = signal('');
  /**
   * La foto recién subida, servida por la API.
   *
   * Se guarda la ruta del servidor y no un `blob:` local, misma razón que en
   * la foto profesional: la CSP de la aplicación bloquea `blob:` en
   * `img-src`, así que un preview instantáneo con `URL.createObjectURL`
   * parece un error de consola aunque la subida haya funcionado.
   */
  protected readonly fotoRecien = signal<string | null>(null);

  /* -- La portada de la vitrina ------------------------------------------- */

  /** Mientras la portada viaja. Bloquea el control para no subir dos veces. */
  protected readonly subiendoPortada = signal(false);
  /** Qué salió mal, si salió mal. Vacío es que no pasó nada. */
  protected readonly errorDePortada = signal('');
  /** Igual que {@link fotoRecien}: ruta del servidor, nunca `blob:`. */
  protected readonly portadaRecien = signal<string | null>(null);

  protected readonly slugValido = computed(() => SLUG_VALIDO.test(this.slug()));

  protected readonly puedeGuardar = computed(
    () => this.slugValido() && this.displayName().trim() !== '',
  );

  /** El enlace que se copia y se pega, tal como va a quedar. */
  protected readonly enlace = computed(() => `alovida.app/p/${this.slug().trim() || 'tu-slug'}`);

  /**
   * Cómo se ve la ficha pública mientras se edita, sin guardar todavía.
   *
   * ## Por qué arma un `PublicProfileDetail` completo
   *
   * B1 del plan de UX del 22/08/2026. Acá se dibujaba a mano una tarjetita con
   * avatar, nombre, titular y biografía, mientras `/p/:slug` mostraba una
   * página con insignia de tipo, sello de verificación, ciudad,
   * especialidades, calificación, opiniones y publicaciones. El cliente lo
   * dijo textual: «el perfil público debe ser el mismo que se ve el preview,
   * si no no tiene ningún sentido tener preview».
   *
   * Ahora las dos pantallas instancian **el mismo componente**, así que el
   * preview tiene que hablar su idioma: el de la respuesta pública real.
   *
   * ## Lo que se rellena con lo que la vitrina todavía no sabe
   *
   * `verified`, `city`, `specialties`, `ratingAverage` y `posts` **no los
   * decide este formulario**: los pone la plataforma o salen de otras
   * pantallas. Van en su estado vacío honesto —sin verificar, sin calificar,
   * sin publicaciones—, que es como se ve una vitrina recién creada. Inventar
   * un sello de verificado en el preview sería peor que no tener preview.
   */
  protected readonly vistaPrevia = computed<PublicProfileDetail>(() => {
    const guardado = this.perfil();
    const publicado = guardado.status === 'ready' ? guardado.data : null;
    const vacio = (texto: string): string | null => (texto.trim() === '' ? null : texto.trim());

    return {
      kind: 'PRACTITIONER',
      slug: this.slug().trim() || 'tu-slug',
      displayName: this.displayName().trim() || 'Tu nombre',
      headline: vacio(this.headline()),
      biography: vacio(this.biography()),
      avatarUrl: this.fotoRecien() ?? this.avatarUrlDe(publicado),
      coverUrl: this.portadaRecien() ?? this.coverUrlDe(publicado),
      verified: publicado?.verificationStatusConceptId !== undefined,
      city: null,
      address: null,
      location: null,
      specialties: [],
      trajectory: [],
      ratingAverage: null,
      ratingCount: 0,
      acceptsReviews: this.acceptsReviews(),
      posts: [],
      updatedAt: new Date(0),
    };
  });

  /** Si la vitrina todavía no tiene foto. Ver el aviso de la plantilla (B4). */
  protected readonly sinFoto = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' && estado.data?.avatarFileId == null;
  });

  /** Si la vitrina todavía no tiene portada. Mismo criterio que {@link sinFoto}. */
  protected readonly sinPortada = computed(() => {
    const estado = this.perfil();
    return estado.status === 'ready' && estado.data?.coverFileId == null;
  });

  /** La URL servida por la API para el avatar ya guardado, o `null`. */
  private avatarUrlDe(perfil: OwnPublicProfile | null): string | null {
    return perfil?.avatarFileId == null ? null : `/public/media/${perfil.avatarFileId}`;
  }

  /** La URL servida por la API para la portada ya guardada, o `null`. */
  private coverUrlDe(perfil: OwnPublicProfile | null): string | null {
    return perfil?.coverFileId == null ? null : `/public/media/${perfil.coverFileId}`;
  }

  constructor() {
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.perfil.set(loading());
    this.community.getOwnProfile().subscribe({
      next: (perfil) => {
        this.sembrarFormulario(perfil);
        this.perfil.set(ready(perfil));
      },
      error: (error: unknown) => this.perfil.set(errorToViewState<OwnPublicProfile | null>(error)),
    });
  }

  private sembrarFormulario(perfil: OwnPublicProfile | null): void {
    this.slug.set(perfil?.slug ?? '');
    this.displayName.set(perfil?.displayName ?? this.auth.displayName() ?? '');
    this.headline.set(perfil?.headline ?? '');
    this.biography.set(perfil?.biography ?? '');
    this.acceptsReviews.set(perfil?.acceptsReviews ?? true);
  }

  protected guardar(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null || !this.puedeGuardar() || this.guardando()) {
      return;
    }

    this.guardando.set(true);
    this.community
      .upsertOwnProfile({
        tenantId,
        slug: this.slug().trim(),
        displayName: this.displayName().trim(),
        headline: this.headline().trim() || undefined,
        biography: this.biography().trim() || undefined,
        acceptsReviews: this.acceptsReviews(),
      })
      .subscribe({
        next: (perfil) => {
          this.guardando.set(false);
          this.sembrarFormulario(perfil);
          this.perfil.set(ready(perfil));
          this.toasts.success('Tu vitrina pública quedó guardada.', 'Perfil público');
        },
        error: (error: unknown) => {
          this.guardando.set(false);
          const esConflicto = error instanceof HttpErrorResponse && error.status === 409;
          this.toasts.error(
            esConflicto
              ? 'Ese enlace ya lo usa otra persona. Probá con otro.'
              : 'No se pudo guardar. Probá de nuevo.',
            'Perfil público',
          );
        },
      });
  }

  /**
   * Sube la foto elegida y la cuelga de la vitrina ya guardada.
   *
   * Exige `tieneVitrina()`: `PUT /community/profiles/me` es completo y pide
   * `slug`/`displayName`/`tenantId` — sin una vitrina previa esos campos
   * todavía no tienen un valor guardado del que partir, y adivinarlos acá
   * sería pisar lo que la persona no terminó de escribir en el formulario.
   */
  protected alElegirFoto(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // El input se limpia siempre: sin esto, elegir el mismo archivo dos veces
    // seguidas no dispara `change` y parece que el botón dejó de andar.
    entrada.value = '';
    const tenantId = this.auth.activeTenantId();
    if (!archivo || this.subiendoFoto() || !this.tieneVitrina() || tenantId === null) {
      return;
    }

    this.subiendoFoto.set(true);
    this.errorDeFoto.set('');

    this.files
      .upload(archivo, 'IMAGE', 'NORMAL')
      .pipe(
        switchMap((subido) =>
          this.community.upsertOwnProfile({
            tenantId,
            slug: this.slug().trim(),
            displayName: this.displayName().trim(),
            headline: this.headline().trim() || undefined,
            biography: this.biography().trim() || undefined,
            acceptsReviews: this.acceptsReviews(),
            avatarFileId: subido.id,
          }),
        ),
      )
      .subscribe({
        next: (perfil) => {
          this.subiendoFoto.set(false);
          this.sembrarFormulario(perfil);
          this.perfil.set(ready(perfil));
          this.fotoRecien.set(this.avatarUrlDe(perfil));
          this.toasts.success('Tu foto quedó guardada.', 'Perfil público');
        },
        error: () => {
          this.subiendoFoto.set(false);
          this.errorDeFoto.set('No pudimos subir la foto. Probá con otra imagen.');
        },
      });
  }

  /**
   * Sube la portada elegida y la cuelga de la vitrina ya guardada.
   *
   * Espejo de {@link alElegirFoto}: mismo `PUT` completo, misma exigencia de
   * {@link tieneVitrina} por la misma razón (el `PUT` pide `slug`/
   * `displayName`/`tenantId`, que sin vitrina previa no tienen de dónde salir).
   */
  protected alElegirPortada(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    const tenantId = this.auth.activeTenantId();
    if (!archivo || this.subiendoPortada() || !this.tieneVitrina() || tenantId === null) {
      return;
    }

    this.subiendoPortada.set(true);
    this.errorDePortada.set('');

    this.files
      .upload(archivo, 'IMAGE', 'NORMAL')
      .pipe(
        switchMap((subido) =>
          this.community.upsertOwnProfile({
            tenantId,
            slug: this.slug().trim(),
            displayName: this.displayName().trim(),
            headline: this.headline().trim() || undefined,
            biography: this.biography().trim() || undefined,
            acceptsReviews: this.acceptsReviews(),
            coverFileId: subido.id,
          }),
        ),
      )
      .subscribe({
        next: (perfil) => {
          this.subiendoPortada.set(false);
          this.sembrarFormulario(perfil);
          this.perfil.set(ready(perfil));
          this.portadaRecien.set(this.coverUrlDe(perfil));
          this.toasts.success('Tu portada quedó guardada.', 'Perfil público');
        },
        error: () => {
          this.subiendoPortada.set(false);
          this.errorDePortada.set('No pudimos subir la portada. Probá con otra imagen.');
        },
      });
  }

  /**
   * Quita la portada de la vitrina.
   *
   * `coverFileId: null` la borra; el archivo no se toca — mismo criterio que
   * quitar la foto profesional en `practitioner-profile-view`. Idempotente.
   */
  protected quitarPortada(): void {
    const tenantId = this.auth.activeTenantId();
    if (tenantId === null || !this.tieneVitrina() || this.subiendoPortada()) {
      return;
    }

    this.subiendoPortada.set(true);
    this.errorDePortada.set('');

    this.community
      .upsertOwnProfile({
        tenantId,
        slug: this.slug().trim(),
        displayName: this.displayName().trim(),
        headline: this.headline().trim() || undefined,
        biography: this.biography().trim() || undefined,
        acceptsReviews: this.acceptsReviews(),
        coverFileId: null,
      })
      .subscribe({
        next: (perfil) => {
          this.subiendoPortada.set(false);
          this.sembrarFormulario(perfil);
          this.perfil.set(ready(perfil));
          this.portadaRecien.set(null);
          this.toasts.success('Quitamos tu portada.', 'Perfil público');
        },
        error: () => {
          this.subiendoPortada.set(false);
          this.errorDePortada.set('No pudimos quitar la portada. Probá de nuevo.');
        },
      });
  }
}
