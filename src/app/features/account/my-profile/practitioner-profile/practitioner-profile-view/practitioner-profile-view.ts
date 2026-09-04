import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';

import { FilesClient } from '@core/data-access/files/files.client';
import { ProfilesClient } from '@core/data-access/profiles/profiles.client';
import { CommunityClient } from '@core/data-access/community/community.client';
import { AuthService } from '@core/auth/auth.service';
import { RouterLink } from '@angular/router';

import { WorkHistory } from '../../work-history/work-history';
import { Avatar } from '../../../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { TabHelpBlock } from '../../../../../shared/components/molecules/tab-help-block/tab-help-block';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { StatusSeal } from '../../../../../shared/components/organisms/status-seal/status-seal';
import { TutorialTarget } from '../../../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import type { PerfilProfesionalVisible } from './practitioner-profile-view.types';

/** Índice de cada pestaña superior — nombrado para no repetir números mágicos. */
const TAB = { TRAYECTORIA: 0, CREDENCIALES: 1, PREVIEW: 2 } as const;

/** Una fila de la agrupación declarado/verificado de la pestaña Credenciales. */
interface FilaCredencial {
  readonly id: string;
  readonly categoria: string;
  readonly nombre: string;
  readonly detalle: string;
  readonly fuente?: string;
}

/**
 * **La vista del perfil profesional** — presentacional pura.
 *
 * ## Por qué existe (carriles R2-4 y 05)
 *
 * El perfil del doctor rebotó dos rondas seguidas («está pésimo»), y la guía de
 * profesionales (carril R2-1) necesita pintar el perfil de OTRO doctor. El dato
 * entra por `input()` ya resuelto (ver `practitioner-profile-view.types.ts`) y
 * esta vista no sabe de dónde salió: la usan el contenedor propio, el detalle
 * de la guía, y — carril 05 — ella misma en modo preview.
 *
 * ## La estructura de 3 pestañas superiores (carril 05)
 *
 * 1. **Trayectoria**: formación, experiencia histórica y actividad actual, en
 *    timeline vertical por fases.
 * 2. **Credenciales y verificaciones**: especialidades y matrículas, más una
 *    agrupación explícita declarado/verificado.
 * 3. **Vista previa del perfil público**: sólo cuando `esPropio()` — se
 *    reinstancia a **sí misma** con `esPropio=false`, alimentada por el mismo
 *    `perfil()` ya cargado. No es un mock aparte: es el mismo dibujo, en modo
 *    ajeno, que ve un paciente en `practitioner-detail.ts` — la única forma de
 *    que la vista previa no pueda divergir de lo que un paciente ve de verdad.
 *    `previewMode` corta la recursión: la instancia anidada no vuelve a ofrecer
 *    una pestaña Preview de sí misma.
 *
 * ## `esPropio`
 *
 * Con `true` (Mi perfil) aparecen las acciones de dueño y el formulario de
 * alta de trayectoria. Con `false` (la guía, o el propio Preview) no hay
 * botones ni tuteo: es la ficha de un colega.
 */
@Component({
  selector: 'app-practitioner-profile-view',
  imports: [
    Avatar,
    Badge,
    AppButton,
    AppButtonLink,
    Card,
    Chip,
    DatePipe,
    RouterLink,
    StatusSeal,
    Tabs,
    Tab,
    TabHelpBlock,
    TutorialTarget,
    WorkHistory,
    // Auto-referencia deliberada (carril 05): la pestaña Preview se pinta
    // reinstanciando este mismo componente en modo ajeno — ver `previewMode`.
    PractitionerProfileView,
  ],
  templateUrl: './practitioner-profile-view.html',
  styleUrl: './practitioner-profile-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PractitionerProfileView {
  /** El perfil, ya resuelto por el contenedor. */
  readonly perfil = input.required<PerfilProfesionalVisible>();

  /** Si es el perfil de quien mira: habilita las acciones de dueño. */
  readonly esPropio = input(false);

  /**
   * `true` cuando esta instancia ES la vista previa embebida de otra. Corta la
   * recursión: sin esto, la pestaña Preview de la pestaña Preview... — y
   * suprime cualquier acción de escritura, aunque `esPropio` llegara en `true`
   * por error del llamador.
   */
  readonly previewMode = input(false);

  /* --- La foto de perfil (P17) ------------------------------------------ */

  private readonly archivos = inject(FilesClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly community = inject(CommunityClient);
  private readonly auth = inject(AuthService);

  /** Mientras la foto viaja. Bloquea el control para no subir dos veces. */
  protected readonly subiendoFoto = signal(false);

  /** Qué salió mal, si salió mal. Vacío es que no pasó nada. */
  protected readonly errorDeFoto = signal('');

  /**
   * La foto recién subida, servida por la API.
   *
   * El perfil llega por `input()` desde quien lo leyó, así que este componente
   * no puede refrescarlo por su cuenta y necesita recordar la foto nueva.
   *
   * **Se guarda la ruta del servidor, no un `blob:`.** Se probó con
   * `URL.createObjectURL(archivo)` —instantáneo, sin ida y vuelta— y la propia
   * CSP de la aplicación lo bloquea: `img-src` declara `'self' data:` y una
   * `blob:` no entra. La imagen quedaba invisible y en consola aparecía una
   * violación de CSP, que es el peor de los dos mundos: parece que la subida
   * falló cuando en realidad había funcionado. La ruta de la API es
   * `same-origin`, se ve, y además prueba que la foto quedó guardada.
   */
  protected readonly fotoRecien = signal<string | null>(null);

  protected readonly fotoVisible = computed(() => this.fotoRecien() ?? this.perfil().fotoUrl);

  /**
   * Sube la foto elegida y la fija como foto del perfil profesional.
   *
   * **Son dos llamadas y no una, a propósito.** `POST /common/files/upload`
   * recibe los bytes por `multipart`; `PUT /profiles/practitioners/:id/photo`
   * es un JSON idempotente que recibe el **id** del archivo. Mezclarlos
   * obligaría al perfil a hablar dos idiomas y a reenviar la foto entera cada
   * vez que alguien corrige otro dato.
   *
   * **Una subida pinta ambas.** `health_practitioner_profiles.photo_file_id`
   * (arriba) y `community.public_profiles.avatar_file_id` (la vitrina
   * pública) son columnas independientes que nada sincroniza del lado del
   * servidor. Ver {@link propagarAVitrina}.
   */
  protected alElegirFoto(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    // El input se limpia siempre: sin esto, elegir el mismo archivo dos veces
    // seguidas no dispara `change` y parece que el botón dejó de andar.
    entrada.value = '';
    if (!archivo || this.subiendoFoto()) {
      return;
    }

    const profileId = this.auth.practitionerProfileId();
    if (profileId === null) {
      // Antes se salía en silencio: se elegía una foto, no pasaba nada, y no
      // había forma de saber que el problema no era la imagen. Pasa de verdad
      // —una cuenta cuya persona no tiene perfil profesional no lleva el claim
      // `hpid`—, así que se dice, y se dice lo que la persona puede hacer.
      this.errorDeFoto.set(
        'Tu cuenta todavía no está asociada a un perfil profesional, así que no hay ' +
          'dónde guardar la foto. Escribinos para que la vinculemos.',
      );
      return;
    }

    this.subiendoFoto.set(true);
    this.errorDeFoto.set('');

    this.archivos
      .upload(archivo, 'IMAGE', 'NORMAL')
      .pipe(
        switchMap((subido) => this.profiles.setPractitionerPhoto(profileId, subido.id)),
        switchMap((guardado) =>
          this.propagarAVitrina(guardado.photoFileId).pipe(map(() => guardado)),
        ),
        switchMap((guardado) =>
          this.archivos
            .downloadUrl(guardado.photoFileId ?? '')
            .pipe(map((descarga) => descarga.url)),
        ),
      )
      .subscribe({
        next: (fotoUrl) => {
          this.subiendoFoto.set(false);
          this.fotoRecien.set(fotoUrl);
        },
        error: () => {
          this.subiendoFoto.set(false);
          this.errorDeFoto.set('No pudimos subir la foto. Probá con otra imagen.');
        },
      });
  }

  /**
   * Repite la foto recién fijada en la vitrina pública, si el titular ya
   * tiene una.
   *
   * **Sin vitrina no se crea una implícita.** El `PUT /community/profiles/me`
   * exige `tenantId`, `slug` y `displayName`: adivinarlos acá sería
   * inventarle a alguien una dirección pública que nunca pidió. Quien no
   * tiene vitrina sigue viendo su foto en «Mi perfil» — sólo no se propaga a
   * ningún lado más.
   *
   * **Se manda el objeto completo leído del servidor.** El `PUT` es completo
   * (no un `PATCH`): mandar sólo `{ avatarFileId }` borraría `visibility` y
   * cualquier otro campo que la persona haya declarado en otra pantalla.
   *
   * **Best-effort.** Un fallo acá no debe tumbar la foto profesional, que ya
   * quedó guardada en el paso anterior — se traga el error y se sigue.
   *
   * @param fileId - El id del archivo recién fijado como foto profesional.
   * @returns Un observable que siempre completa, nunca falla.
   */
  private propagarAVitrina(fileId: string | undefined): Observable<unknown> {
    if (!fileId) {
      return of(undefined);
    }
    return this.community.getOwnProfile().pipe(
      switchMap((vitrina) => {
        if (!vitrina) {
          return of(undefined);
        }
        return this.community.upsertOwnProfile({
          tenantId: vitrina.tenantId,
          slug: vitrina.slug,
          displayName: vitrina.displayName,
          headline: vitrina.headline,
          biography: vitrina.biography,
          acceptsReviews: vitrina.acceptsReviews,
          avatarFileId: fileId,
        });
      }),
      catchError(() => of(undefined)),
    );
  }

  /** Alguien agregó un vínculo laboral desde el formulario embebido: el contenedor debe releer el perfil. */
  readonly trayectoriaCambio = output<void>();

  protected readonly pestanaSeleccionada = signal<number>(TAB.TRAYECTORIA);
  protected readonly TAB = TAB;

  /** Especialidades, formación y matrículas agrupadas en declarado vs. verificado. */
  protected readonly credenciales = computed<{
    readonly declarados: readonly FilaCredencial[];
    readonly verificados: readonly FilaCredencial[];
  }>(() => {
    const perfil = this.perfil();
    const declarados: FilaCredencial[] = [];
    const verificados: FilaCredencial[] = [];

    for (const estudio of perfil.formacion) {
      const fila: FilaCredencial = {
        id: estudio.id,
        categoria: 'Formación',
        nombre: estudio.tipo,
        detalle: estudio.institucion || estudio.estado,
        fuente: estudio.fuenteVerificacion,
      };
      // La fuente de verificación es la señal más directa: el backend la exige
      // sólo al verificar, así que su presencia ES el hecho de haber pasado de
      // declarado a verificado — más confiable que inferirlo del sello, que
      // también puede decir «vencida» sin hablar de si se verificó.
      (estudio.fuenteVerificacion !== undefined ? verificados : declarados).push(fila);
    }
    for (const especialidad of perfil.especialidades) {
      const fila: FilaCredencial = {
        id: especialidad.id,
        categoria: 'Especialidad',
        nombre: especialidad.nombre,
        detalle: especialidad.estado,
      };
      (especialidad.sello === 'approved' ? verificados : declarados).push(fila);
    }
    for (const matricula of perfil.matriculas) {
      const fila: FilaCredencial = {
        id: matricula.id,
        categoria: 'Matrícula',
        nombre: matricula.jurisdiccion,
        detalle: matricula.estado,
      };
      (matricula.sello === 'approved' ? verificados : declarados).push(fila);
    }

    return { declarados, verificados };
  });

  protected verPreview(): void {
    this.pestanaSeleccionada.set(TAB.PREVIEW);
  }
}
