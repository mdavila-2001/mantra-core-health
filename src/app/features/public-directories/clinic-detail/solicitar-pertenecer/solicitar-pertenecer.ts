import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import { SessionStore } from '@core/auth/session.store';
import { PracticeSitesClient } from '@core/data-access/practice-sites/practice-sites.client';
import { ROLE_ASSIGNMENT_STATUS } from '@core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment } from '@core/data-access/practice-sites/practice-sites.types';
import { ServicesCatalogClient } from '@core/data-access/services-catalog/services-catalog.client';
import type { Practice } from '@core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '@core/http/error-to-view-state';
import { loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AnnounceOnAppear } from '@shared/a11y/announce-on-appear';
import { AppButton } from '@shared/components/atoms/button/button';
import { Alert } from '@shared/components/molecules/alert/alert';
import { Card } from '@shared/components/molecules/card/card';
import { LoadingState } from '@shared/components/molecules/loading-state/loading-state';
import { errorMessageOf } from '@shared/forms/form-support';

/** Lo que hace falta saber para decidir qué ofrecer: quién es la organización y qué vínculo ya hay. */
interface Contexto {
  /** `null` si no se pudo identificar la organización entre las que lista la API. */
  readonly practiceId: string | null;
  /** El vínculo vigente (pendiente, activo o suspendido) con esta organización, si lo hay. */
  readonly vinculo: MyRoleAssignment | null;
}

const ESTADOS_QUE_BLOQUEAN: readonly string[] = [
  ROLE_ASSIGNMENT_STATUS.PENDING,
  ROLE_ASSIGNMENT_STATUS.ACTIVE,
  ROLE_ASSIGNMENT_STATUS.SUSPENDED,
];

/** Compara nombres sin que la tilde, la mayúscula ni un espacio de más los distingan. */
function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * **«Solicitar pertenecer a esta organización»**, en la ficha del directorio.
 *
 * Sólo se dibuja para un profesional (el token trae su `practitionerProfileId`).
 * Ocultarlo no es seguridad: la autoridad es la API, que rechaza la solicitud
 * de quien no corresponde. Es un atajo para no tener que ir a «Mis
 * vinculaciones» y elegir de nuevo la misma organización de una lista.
 *
 * ## No es otro flujo
 *
 * Llama al mismo `selfRequestAffiliation` que «Pedir una vinculación» en
 * `MembershipsTab`: queda **pendiente hasta que la organización la apruebe**.
 *
 * ## Cómo se sabe cuál es la organización
 *
 * La ficha pública se identifica por `slug` y la solicitud por `practiceId`, y
 * la ficha no trae el segundo. Se busca por nombre entre las organizaciones que
 * lista `GET /practices`; si no hay una sola coincidencia, no se ofrece pedir
 * a ciegas y se manda a «Mis vinculaciones».
 */
@Component({
  selector: 'app-solicitar-pertenecer',
  imports: [Alert, AnnounceOnAppear, AppButton, Card, LoadingState],
  templateUrl: './solicitar-pertenecer.html',
  styleUrl: './solicitar-pertenecer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitarPertenecer {
  private readonly sesion = inject(SessionStore);
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly catalogo = inject(ServicesCatalogClient);
  private readonly destroyRef = inject(DestroyRef);

  /** El nombre de la organización de la ficha. */
  readonly nombre = input.required<string>();

  /** El identificador de la organización, si la ficha lo trae: gana sobre el nombre. */
  readonly practiceId = input<string | null | undefined>(null);

  protected readonly estadoActivo = ROLE_ASSIGNMENT_STATUS.ACTIVE;
  protected readonly estadoPendiente = ROLE_ASSIGNMENT_STATUS.PENDING;

  protected readonly esProfesional = computed(() => this.sesion.practitionerProfileId() !== null);

  protected readonly lectura = signal<ViewState<Contexto>>(loading());
  protected readonly envio = signal<ViewState<null>>(ready(null));
  protected readonly enviada = signal(false);

  protected readonly enviando = computed(() => this.envio().status === 'loading');
  protected readonly errorDeEnvio = computed(() =>
    errorMessageOf(this.envio(), 'No tiene permiso para solicitar esta vinculación.'),
  );
  protected readonly contexto = computed(() => {
    const estado = this.lectura();
    return estado.status === 'ready' ? estado.data : null;
  });
  protected readonly errorDeLectura = computed(() =>
    this.lectura().status === 'loading' || this.lectura().status === 'ready'
      ? null
      : 'No pudimos comprobar su vínculo con esta organización.',
  );

  constructor() {
    effect(() => {
      if (!this.esProfesional()) return;
      this.nombre();
      untracked(() => this.cargar());
    });
  }

  protected cargar(): void {
    this.lectura.set(loading());
    forkJoin({
      practicas: this.catalogo.listPractices(),
      vinculos: this.practiceSites.listMyRoleAssignments(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ practicas, vinculos }) => {
          const id = this.resolverId(practicas);
          const vinculo =
            id === null
              ? null
              : (vinculos.find(
                  (v) => v.practiceId === id && ESTADOS_QUE_BLOQUEAN.includes(v.status),
                ) ?? null);
          this.lectura.set(ready({ practiceId: id, vinculo }));
        },
        error: (error: unknown) => this.lectura.set(errorToViewState<Contexto>(error)),
      });
  }

  protected solicitar(): void {
    const id = this.contexto()?.practiceId ?? null;
    if (id === null || this.enviando()) return;
    this.envio.set(loading());
    this.enviada.set(false);
    this.practiceSites
      .selfRequestAffiliation(id, {})
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.envio.set(ready(null));
          this.enviada.set(true);
          this.cargar();
        },
        error: (error: unknown) => this.envio.set(errorToViewState<null>(error)),
      });
  }

  /** Por el identificador de la ficha; si no viene, por nombre y sólo si es inequívoco. */
  private resolverId(practicas: readonly Practice[]): string | null {
    const declarado = this.practiceId();
    if (declarado) return declarado;
    const buscado = normalizar(this.nombre());
    const coinciden = practicas.filter((p) => normalizar(p.name) === buscado);
    return coinciden.length === 1 ? coinciden[0].id : null;
  }
}
