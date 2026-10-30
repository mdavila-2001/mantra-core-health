import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { CarrierCatalogEntry } from '../../../core/data-access/insurance/insurance.types';
import { PractitionerInsurerRequestsClient } from '../../../core/data-access/insurance/practitioner-insurer-requests.client';
import type { InsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPractitionerProfile } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { RequestInbox } from './request-inbox/request-inbox';
import { conceptosDe } from '../my-profile/practitioner-profile/practitioner-seal';
import {
  buildRoadmap,
  buildThreads,
  type RequestThread,
  type RoadmapStep,
} from './my-verifications.model';

/** Lo que la pantalla necesita leído, todo junto. */
interface Datos {
  readonly perfil: OwnPractitionerProfile;
  readonly etiquetas: ConceptLabels;
  /** No se pudieron leer los estados: los sellos dicen «Sin dato» y se avisa. */
  readonly etiquetasFallidas: boolean;
  /** `null` si la lectura falló: la hoja de ruta lo dice en vez de esconderlo. */
  readonly seguros: readonly InsurerRequest[] | null;
  /** `null` si no se pudo leer: el campo para pedir otra lo explica. */
  readonly catalogo: readonly CarrierCatalogEntry[] | null;
}

const PESTANAS = ['Hoja de ruta', 'Solicitudes enviadas'] as const;
const PESTANA = { ruta: 0, bandeja: 1 } as const;

/**
 * «Mis verificaciones» del profesional (propietario, 28/10/2026: «falta un
 * lugar visual donde se pueda ver mis verificaciones y el proceso tipo road
 * map… y una bandeja de solicitudes enviadas tipo mensajería chat»).
 *
 * UNA tarjeta con dos pestañas, centrada y a lo ancho (regla del cliente,
 * `composition-rules.md` §5):
 *
 * - **Hoja de ruta**: los tramos de su verificación —perfil, matrícula,
 *   títulos, especialidades, instituciones, seguros— con un sello por tramo.
 * - **Solicitudes enviadas**: cada pedido que mandó a una institución o a una
 *   aseguradora, contado como una conversación: lo que pidió, cuándo, y qué le
 *   respondieron con su motivo. Desde ahí retira o vuelve a pedir, y pide a una
 *   aseguradora nueva.
 *
 * No calcula ningún estado: lo dice la API. Sólo lo traduce y lo ordena
 * (`my-verifications.model.ts`).
 */
@Component({
  selector: 'app-my-verifications',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AppButtonLink,
    Card,
    EmptyState,
    FormField,
    NavIcon,
    PageHeader,
    RequestInbox,
    RouterLink,
    Select,
    StatusSeal,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './my-verifications.html',
  styleUrl: './my-verifications.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyVerifications {
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly insurerRequests = inject(PractitionerInsurerRequestsClient);
  private readonly insurance = inject(InsuranceClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly pestanas = PESTANAS;

  protected readonly state = signal<ViewState<Datos>>(loading());

  protected readonly pestana = signal<number>(
    this.route.snapshot.queryParamMap.get('tab') === 'requests' ? PESTANA.bandeja : PESTANA.ruta,
  );

  private readonly datos = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly pasos = computed<readonly RoadmapStep[]>(() => {
    const d = this.datos();
    return d === null ? [] : buildRoadmap(d.perfil, d.etiquetas, d.seguros);
  });

  protected readonly verificados = computed(
    () => this.pasos().filter((p) => p.state === 'approved').length,
  );

  protected readonly hilos = computed<readonly RequestThread[]>(() => {
    const d = this.datos();
    return d === null ? [] : buildThreads(d.perfil.affiliations, d.seguros ?? []);
  });

  /** La conversación abierta en la bandeja (`app-request-inbox`). */
  protected readonly hiloElegidoId = signal<string | null>(null);

  protected readonly pendientes = computed(
    () => this.hilos().filter((h) => h.state === 'pending').length,
  );

  /* ---- Pedir a otra aseguradora ------------------------------------------ */

  /** Las del catálogo que todavía no se pidieron (o se pueden volver a pedir). */
  protected readonly aseguradorasDisponibles = computed<readonly SelectOption<string>[]>(() => {
    const d = this.datos();
    if (d === null) return [];
    const vivas = new Set(
      (d.seguros ?? [])
        .filter((r) => r.status === 'PENDING' || r.status === 'APPROVED')
        .map((r) => r.carrierId),
    );
    return (d.catalogo ?? [])
      .filter((c) => !vivas.has(c.id))
      .map((c) => ({ value: c.id, label: c.isPublic ? `${c.name} (seguro público)` : c.name }));
  });

  /** Por qué no se puede pedir otra, si no se puede; `null` si se puede. */
  protected readonly sinAseguradoras = computed<string | null>(() => {
    const d = this.datos();
    if (d === null) return null;
    if (d.catalogo === null) {
      return 'No pudimos cargar la lista de aseguradoras. Vuelva a cargar la página en unos segundos.';
    }
    if (d.seguros === null)
      return 'No pudimos leer sus solicitudes: reintente antes de pedir otra.';
    return this.aseguradorasDisponibles().length === 0
      ? 'Ya pidió trabajar con todas las aseguradoras de AloVida.'
      : null;
  });

  /** Falló la lectura de las solicitudes a aseguradoras (no es que no haya). */
  protected readonly segurosIlegibles = computed(() => this.datos()?.seguros === null);

  /** Falló la lectura de los estados del catálogo: se avisa, no se calla. */
  protected readonly etiquetasIlegibles = computed(() => this.datos()?.etiquetasFallidas === true);

  protected readonly aseguradoraNueva = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly avisoDeEnvio = signal<{
    tono: 'success' | 'warning' | 'error';
    texto: string;
  } | null>(null);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.pestana.set(params.get('tab') === 'requests' ? PESTANA.bandeja : PESTANA.ruta);
    });
    this.cargar();
  }

  protected cargar(): void {
    this.state.set(loading());
    this.leer().subscribe({
      next: (datos) => this.state.set(ready(datos)),
      error: (error: unknown) => this.state.set(errorToViewState<Datos>(error)),
    });
  }

  /**
   * El perfil es lo único sin lo cual no hay pantalla. Las etiquetas, las
   * solicitudes a aseguradoras y el catálogo degradan: la hoja de ruta dice
   * «sin dato» donde no pudo leer, en vez de caerse entera.
   */
  private leer(): Observable<Datos> {
    return this.profiles.getOwnPractitionerProfile().pipe(
      switchMap((perfil) =>
        forkJoin({
          etiquetas: this.terminology
            .readConceptLabels(conceptosDe(perfil))
            .pipe(catchError(() => of<ConceptLabels | null>(null))),
          seguros: this.insurerRequests
            .listMine()
            .pipe(catchError(() => of<readonly InsurerRequest[] | null>(null))),
          catalogo: this.insurance
            .listCarrierCatalog()
            .pipe(catchError(() => of<readonly CarrierCatalogEntry[] | null>(null))),
        }).pipe(
          map(({ etiquetas, ...resto }) => ({
            perfil,
            ...resto,
            etiquetas: etiquetas ?? new Map(),
            etiquetasFallidas: etiquetas === null,
          })),
        ),
      ),
    );
  }

  protected elegirPestana(indice: number): void {
    this.pestana.set(indice);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: indice === PESTANA.bandeja ? 'requests' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected irABandeja(): void {
    this.elegirPestana(PESTANA.bandeja);
  }

  /* ---- Acciones: cada una relee de la API, nunca supone el resultado ------ */

  protected pedirAseguradora(): void {
    const id = this.aseguradoraNueva();
    if (id === null || this.enviando()) return;
    this.pedir([id], 'Solicitud enviada. La aseguradora la va a confirmar o rechazar.');
  }

  protected volverAPedir(hilo: RequestThread): void {
    if (hilo.carrierId === undefined || this.enviando()) return;
    this.pedir([hilo.carrierId], `Volvimos a enviar su solicitud a ${hilo.counterpart}.`);
  }

  protected retirar(hilo: RequestThread): void {
    if (hilo.requestId === undefined || this.enviando()) return;
    this.enviando.set(true);
    this.avisoDeEnvio.set(null);
    this.insurerRequests.withdraw(hilo.requestId).subscribe({
      next: () =>
        this.releerSeguros(
          { tono: 'success', texto: `Retiró su solicitud a ${hilo.counterpart}.` },
          hilo.id,
        ),
      error: (error: unknown) => this.fallo(error, 'retirar', hilo.id),
    });
  }

  private pedir(carrierIds: readonly string[], exito: string): void {
    this.enviando.set(true);
    this.avisoDeEnvio.set(null);
    const abrir = `ins-${carrierIds[0]}`;
    this.insurerRequests.request(carrierIds).subscribe({
      next: () => {
        this.aseguradoraNueva.set(null);
        this.releerSeguros({ tono: 'success', texto: exito }, abrir);
      },
      error: (error: unknown) => this.fallo(error, 'pedir', abrir),
    });
  }

  /**
   * Después de escribir se vuelve a leer de la API —no se arma la fila en el
   * cliente—: lo que se ve es lo que quedó guardado. Si la escritura salió y la
   * relectura no, se dice eso: el cambio está hecho, lo que falta es verlo.
   */
  private releerSeguros(
    aviso: { tono: 'success' | 'warning' | 'error'; texto: string },
    abrir: string | null,
  ): void {
    this.insurerRequests.listMine().subscribe({
      next: (seguros) => {
        this.state.update((s) => (s.status === 'ready' ? ready({ ...s.data, seguros }) : s));
        if (abrir !== null) this.hiloElegidoId.set(abrir);
        this.enviando.set(false);
        this.avisoDeEnvio.set(aviso);
      },
      error: () => {
        this.enviando.set(false);
        this.avisoDeEnvio.set(
          aviso.tono === 'success'
            ? {
                tono: 'warning',
                texto: `${aviso.texto} No pudimos mostrar el estado actualizado: recargue la página para verlo.`,
              }
            : aviso,
        );
      },
    });
  }

  /**
   * La escritura no se hizo. Cada respuesta dice algo distinto y se lo dice
   * con sus palabras; las que avisan que lo que se ve está viejo (409, 422)
   * releen. El 422 significa cosas distintas según la operación: al retirar,
   * que la aseguradora ya respondió; al pedir, que esa aseguradora ya no
   * recibe solicitudes (no existe o dejó de estar activa).
   */
  private fallo(error: unknown, operacion: 'pedir' | 'retirar', abrir: string | null): void {
    const estado = error instanceof HttpErrorResponse ? error.status : 0;
    if (estado === 409) {
      // Ya estaba viva: lo elegido deja de ofrecerse, y no queda elegido.
      this.aseguradoraNueva.set(null);
      this.releerSeguros(
        { tono: 'warning', texto: 'Ya tiene una solicitud viva con esa aseguradora.' },
        abrir,
      );
      return;
    }
    if (estado === 422) {
      this.aseguradoraNueva.set(null);
      this.releerSeguros(
        {
          tono: 'warning',
          texto:
            operacion === 'retirar'
              ? 'La aseguradora ya respondió esa solicitud: le mostramos su respuesta.'
              : 'Esa aseguradora no está recibiendo solicitudes en este momento.',
        },
        abrir,
      );
      return;
    }
    this.enviando.set(false);
    this.avisoDeEnvio.set({
      tono: 'error',
      texto:
        estado === 0
          ? 'No pudimos enviar el cambio. Revise su conexión y vuelva a intentarlo.'
          : `No pudimos completar el cambio (error ${estado}). Vuelva a intentarlo en unos minutos.`,
    });
  }
}
