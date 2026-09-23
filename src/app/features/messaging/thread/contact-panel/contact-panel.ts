import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';

import { CommunityClient } from '../../../../core/data-access/community/community.client';
import { publicProfileLink } from '../../../../core/data-access/community/public-profile-url';
import type { PublicProfileDetail } from '../../../../core/data-access/community/community.types';
import { Avatar } from '../../../../shared/components/atoms/avatar/avatar';

/**
 * «Ver perfil» del chat: quién es la persona del otro lado, sin salir del hilo.
 *
 * ## Por qué un panel y no una navegación
 *
 * Porque el destino no existía. El menú navegaba a `/public-profile/<id>`, una
 * ruta que **no está declarada**, así que «Ver perfil» caía en el 404 desde
 * los dos lugares que lo ofrecen. Y arreglar el enlace no alcanzaba: las
 * fichas públicas viven en `/p|o|f|l|s/:slug` —por slug, no por id— y **un
 * paciente no tiene ficha**, con lo cual un médico mirando a su paciente
 * seguiría sin tener a dónde ir.
 *
 * El panel contesta la pregunta que se hace quien abre ese menú —quién es,
 * qué hace, está verificado— para todos los casos, y deja el salto a la ficha
 * pública como lo que es: una salida más, cuando la hay.
 *
 * ## Qué se pide y qué se recibe
 *
 * Sólo `GET /community/profiles/:id`, y una vez por perfil abierto. El nombre
 * y el avatar llegan por input desde el hilo, que ya los tiene resueltos de la
 * bandeja: pedirlos otra vez dejaría el encabezado en blanco un instante
 * cuando ya se sabían.
 */
@Component({
  selector: 'app-contact-panel',
  imports: [Avatar, RouterLink],
  templateUrl: './contact-panel.html',
  styleUrl: './contact-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPanel {
  private readonly community = inject(CommunityClient);

  private readonly hoja = viewChild<ElementRef<HTMLElement>>('hoja');

  /** De quién es el perfil que se está mirando. */
  readonly profileId = input.required<string>();

  /** El nombre que ya sabe la bandeja, para no abrir el panel en blanco. */
  readonly displayName = input('');

  /** Su avatar ya resuelto, o `null`. */
  readonly avatarUrl = input<string | null>(null);

  readonly closed = output<void>();

  protected readonly profile = signal<PublicProfileDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  /** El nombre de la ficha si ya llegó; si no, el que trajo la bandeja. */
  protected readonly name = computed(
    () => this.profile()?.displayName ?? this.displayName(),
  );

  /**
   * `true` si el perfil tiene un sello vigente.
   *
   * Se mira `badges` y no `verificationStatusConceptId` porque el estado es un
   * uuid de terminología que el cliente no puede interpretar; un sello, en
   * cambio, o está o no está.
   */
  protected readonly verified = computed(
    () => (this.profile()?.badges.length ?? 0) > 0,
  );

  /** A dónde lleva «Ver ficha pública», o `null` si esta ficha no se publica. */
  protected readonly publicLink = computed(() => {
    const ficha = this.profile();
    return ficha === null ? null : publicProfileLink(ficha.kind, ficha.slug);
  });

  constructor() {
    // Por `effect` y no en el constructor: el panel se reusa al pasar de una
    // conversación a otra con el panel abierto, y ahí el input cambia sin que
    // se construya nada.
    effect(() => this.read(this.profileId()));

    // El foco entra al panel y vuelve de donde vino.
    //
    // Sin esto Escape no cerraba: el `(keydown.escape)` vive en el contenedor y
    // el foco seguía en el botón del menú, así que la tecla nunca llegaba acá.
    // Es lo que pide la regla de modales del proyecto —foco inicial, Escape y
    // restauración—, y se midió con el navegador, no leyendo el código.
    const volverA = inject(DOCUMENT).activeElement;
    afterNextRender(() => this.hoja()?.nativeElement.focus());
    inject(DestroyRef).onDestroy(() => {
      if (volverA instanceof HTMLElement && volverA.isConnected) {
        volverA.focus();
      }
    });
  }

  private read(profileId: string): void {
    this.profile.set(null);
    this.failed.set(false);
    this.loading.set(true);
    this.community.readProfile(profileId).subscribe({
      next: (ficha) => {
        this.profile.set(ficha);
        this.loading.set(false);
      },
      error: () => {
        // Sin ficha el panel no queda vacío: el nombre y el avatar de la
        // bandeja siguen ahí, que es más de lo que había antes de abrirlo.
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  /** Cierra sólo si el clic cayó en el velo, no dentro de la hoja. */
  protected closeIfBackdrop(evento: Event): void {
    if (evento.target === evento.currentTarget) {
      this.close();
    }
  }
}
