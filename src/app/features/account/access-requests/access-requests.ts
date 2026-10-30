import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthzClient } from '../../../core/data-access/authz/authz.client';
import type { CareRelationship } from '../../../core/data-access/authz/authz.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { describeApiFailure } from '../../../core/http/api-failure';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Una solicitud pendiente, con lo elegido en pantalla para decidirla. */
interface SolicitudEnPantalla {
  readonly solicitud: CareRelationship;
  /** Quién pide, resuelto desde su ficha; el id crudo si la ficha no se puede leer. */
  readonly profesional: string;
  elegidas: ReadonlySet<string>;
  decidiendo: boolean;
}

/**
 * **Mis solicitudes de vínculo** (FT-07-R05/R06) — a dónde lleva el aviso
 * "un profesional pide ver tu historia clínica".
 *
 * Sin entrada de menú a propósito: se llega por el enlace de la notificación,
 * como `/my-account/identity/cases`. El paciente elige QUÉ especialidades
 * autoriza — aceptar no es todo o nada (FT-07-R06). Las especialidades salen
 * del catálogo entero porque el pedido no las trae: las decide quien autoriza,
 * no quien pide.
 */
@Component({
  selector: 'app-access-requests',
  imports: [Alert, AppButton, Card, Checkbox, DatePipe, EmptyState, PageHeader],
  templateUrl: './access-requests.html',
  styleUrl: './access-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequests {
  private readonly authz = inject(AuthzClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly specialties = inject(MedicalSpecialtiesCatalog);
  private readonly navigation = inject(NavigationService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly cargando = signal(true);
  protected readonly solicitudes = signal<readonly SolicitudEnPantalla[]>([]);
  protected readonly especialidades = signal<readonly { id: string; nombre: string }[]>([]);
  /**
   * Por qué no se pudieron leer las solicitudes, o `null`. Sin esto, una
   * lectura caída se mostraba como «No tiene solicitudes pendientes».
   */
  protected readonly errorDeCarga = signal<string | null>(null);
  /** Sin especialidades no hay qué autorizar: se dice, en vez de un recuadro vacío. */
  protected readonly errorDeEspecialidades = signal<string | null>(null);

  constructor() {
    this.cargarEspecialidades();
    this.cargar();
  }

  protected cargarEspecialidades(): void {
    this.errorDeEspecialidades.set(null);
    this.specialties.listar().subscribe({
      next: (opciones) =>
        this.especialidades.set(opciones.map((o) => ({ id: o.conceptId, nombre: o.display }))),
      error: (error: unknown) => {
        this.especialidades.set([]);
        this.errorDeEspecialidades.set(
          describeApiFailure(error, 'No pudimos traer la lista de especialidades para elegir qué autoriza.'),
        );
      },
    });
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorDeCarga.set(null);
    this.authz.listMyPendingCareRelationshipRequests().subscribe({
      next: (lista) => {
        if (lista.length === 0) {
          this.solicitudes.set([]);
          this.cargando.set(false);
          return;
        }
        forkJoin(lista.map((solicitud) => this.enPantalla(solicitud))).subscribe((items) => {
          this.solicitudes.set(items);
          this.cargando.set(false);
        });
      },
      error: (error: unknown) => {
        this.solicitudes.set([]);
        this.cargando.set(false);
        this.errorDeCarga.set(describeApiFailure(error, 'No pudimos traer sus solicitudes de vínculo.'));
      },
    });
  }

  /** Resuelve el nombre de quien pide; si su ficha no se puede leer, queda el id. */
  private enPantalla(solicitud: CareRelationship) {
    return this.profiles.getPractitionerProfile(solicitud.practitionerProfileId).pipe(
      map((perfil) => perfil.displayName ?? solicitud.practitionerProfileId),
      catchError(() => of(solicitud.practitionerProfileId)),
      map(
        (profesional): SolicitudEnPantalla => ({
          solicitud,
          profesional,
          elegidas: new Set(),
          decidiendo: false,
        }),
      ),
    );
  }

  protected alternar(item: SolicitudEnPantalla, especialidadId: string, marcada: boolean): void {
    const siguiente = new Set(item.elegidas);
    if (marcada) {
      siguiente.add(especialidadId);
    } else {
      siguiente.delete(especialidadId);
    }
    this.actualizar(item, { elegidas: siguiente });
  }

  protected marcada(item: SolicitudEnPantalla, especialidadId: string): boolean {
    return item.elegidas.has(especialidadId);
  }

  protected aceptar(item: SolicitudEnPantalla): void {
    if (item.elegidas.size === 0) {
      this.toasts.warning('Elija al menos una especialidad para autorizar, o rechace la solicitud.');
      return;
    }
    this.actualizar(item, { decidiendo: true });
    this.authz
      .respondToCareRelationshipRequest(item.solicitud.id, {
        decision: 'ACCEPT',
        authorizedSpecialtyConceptIds: [...item.elegidas],
      })
      .subscribe({
        next: () => {
          this.toasts.success('Autorizó el acceso. Ya puede retirarlo cuando quiera.');
          this.quitar(item);
        },
        error: (error: unknown) => {
          this.toasts.error(describeApiFailure(error, 'No se pudo guardar su decisión. Intente de nuevo.'));
          this.actualizar(item, { decidiendo: false });
        },
      });
  }

  protected rechazar(item: SolicitudEnPantalla): void {
    this.actualizar(item, { decidiendo: true });
    this.authz.respondToCareRelationshipRequest(item.solicitud.id, { decision: 'REJECT' }).subscribe({
      next: () => {
        this.toasts.success('Rechazó la solicitud.');
        this.quitar(item);
      },
      error: (error: unknown) => {
        this.toasts.error(describeApiFailure(error, 'No se pudo guardar su decisión. Intente de nuevo.'));
        this.actualizar(item, { decidiendo: false });
      },
    });
  }

  /*
   * Se busca por id y no por referencia: `actualizar` reemplaza el objeto, así
   * que la referencia que tiene en la mano el `subscribe` de `aceptar` o
   * `rechazar` ya no está en la lista cuando contesta el servidor. Por
   * referencia, un fallo dejaba los botones apagados para siempre y un éxito no
   * quitaba la solicitud de la pantalla.
   */
  private actualizar(item: SolicitudEnPantalla, cambio: Partial<SolicitudEnPantalla>): void {
    this.solicitudes.set(
      this.solicitudes().map((s) => (s.solicitud.id === item.solicitud.id ? { ...s, ...cambio } : s)),
    );
  }

  private quitar(item: SolicitudEnPantalla): void {
    this.solicitudes.set(this.solicitudes().filter((s) => s.solicitud.id !== item.solicitud.id));
  }
}
