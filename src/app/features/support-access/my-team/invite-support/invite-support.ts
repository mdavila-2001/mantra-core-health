import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
} from '@angular/core';

import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import { PracticeSitesClient } from '../../../../core/data-access/practice-sites/practice-sites.client';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import type { SupportInvitationCreated } from '../../../../core/data-access/support-access/support-invite.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime } from '../../support-labels';
import { CreateSecretaryForm } from './create-secretary/create-secretary-form';
import type { CreatedSupportStaffResponse } from '../../../../core/data-access/support-access/support-provisioning.types';
import {
  claveDeInvitacion,
  documentoParaEnviar,
  enviadaEl,
  errorDelDocumento,
  opcionesDeVinculacion,
  rechazoDeLaInvitacion,
  vinculacionesInvitables,
  type RechazoDeLaInvitacion,
} from './invite-support.rules';

const DOCUMENTO = 'input[data-testid="invitar-documento"]';
/** Lo más que se hace esperar a quien reintenta tras un límite de peticiones. */
const TOPE_DE_ESPERA_SEGUNDOS = 120;

/**
 * **Invitar o crear una secretaria** desde «Mi equipo».
 *
 * El doctor puede invitar a una secretaria ya registrada o crear su cuenta
 * directamente para vincularla de inmediato a su práctica.
 */
@Component({
  selector: 'app-invite-support',
  imports: [Alert, AppButton, Badge, Card, CreateSecretaryForm, FormField, Input, Select, ViewStateHost],
  templateUrl: './invite-support.html',
  styleUrl: './invite-support.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InviteSupport {
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly support = inject(SupportAccessClient);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  /** Se pidió llevar el foco al documento y el formulario todavía no está dibujado (se están leyendo las vinculaciones). */
  private focoPendiente = false;

  /** Las invitaciones que el doctor ya envió y la secretaria no respondió, tal como las leyó «Mi equipo». */
  readonly sent = input<readonly DoctorTeamMember[]>([]);

  /** La invitación quedó guardada: «Mi equipo» vuelve a leer su lista. */
  readonly invited = output<SupportInvitationCreated>();

  protected readonly abierto = signal(false);
  protected readonly vinculaciones = signal<ViewState<readonly MyRoleAssignment[]>>(loading());
  protected readonly documento = signal('');
  protected readonly vinculacionId = signal<string | null>(null);
  /** El documento ya se dejó o se intentó enviar: recién entonces se le marcan los errores. */
  protected readonly documentoTocado = signal(false);
  protected readonly intento = signal(false);
  protected readonly enviando = signal(false);
  protected readonly rechazo = signal<RechazoDeLaInvitacion | null>(null);
  protected readonly exito = signal<SupportInvitationCreated | null>(null);
  /** Hay que esperar un poco antes de reintentar (límite de peticiones). */
  protected readonly esperando = signal(false);

  protected readonly opciones = computed(() => {
    const estado = this.vinculaciones();
    return estado.status === 'ready' ? opcionesDeVinculacion(estado.data) : [];
  });

  protected readonly errorDocumento = computed(() => {
    const local = this.documentoTocado() || this.intento() ? errorDelDocumento(this.documento()) : null;
    if (local !== null) return local;
    const rechazo = this.rechazo();
    return rechazo?.campo === 'documento' ? rechazo.mensaje : '';
  });

  protected readonly errorVinculacion = computed(() => {
    if (this.intento() && this.vinculacionId() === null) return 'Elija en qué vinculación la va a invitar.';
    const rechazo = this.rechazo();
    return rechazo?.campo === 'vinculacion' ? rechazo.mensaje : '';
  });

  /** Un rechazo que no es de un campo: va en un aviso, con lo que se puede hacer a continuación. */
  protected readonly rechazoGeneral = computed(() => {
    const rechazo = this.rechazo();
    return rechazo !== null && rechazo.campo === null ? rechazo : null;
  });

  /** El nombre de la secretaria invitada, como lo devolvió la API. */
  protected readonly invitada = computed(() => this.exito()?.items[0]?.personName ?? 'la secretaria');

  protected readonly fecha = formatDateTime;
  protected readonly enviadaEl = enviadaEl;
  protected readonly clave = claveDeInvitacion;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerEspera());
  }

  protected readonly modo = signal<'invitar' | 'crear'>('invitar');

  /** No se pide nada hasta que el doctor abre el formulario: la lista de vinculaciones solo sirve ahí. */
  protected abrir(modo: 'invitar' | 'crear' = 'invitar'): void {
    this.modo.set(modo);
    this.abierto.set(true);
    this.exito.set(null);
    this.focoPendiente = true;
    this.cargarVinculaciones();
  }

  /** Cierra el formulario o el aviso y devuelve el foco a un elemento que sigue estando: el botón que lo abrió. */
  protected cerrar(): void {
    this.abierto.set(false);
    this.exito.set(null);
    this.focoPendiente = false;
    this.limpiar();
    this.enfocar('[data-testid="invitar-abrir"]');
  }

  protected onSecretariaCreada(creada: CreatedSupportStaffResponse): void {
    this.cerrar();
    this.invited.emit({
      id: creada.linkId,
      tenantId: 'tenant-hospital',
      items: [
        {
          id: creada.linkId,
          kind: 'PRACTITIONER',
          targetKind: 'PRACTITIONER',
          tenantId: 'tenant-hospital',
          organizationName: creada.organizationName ?? null,
          userId: creada.userId,
          personName: creada.organizationName ?? 'Secretaria vinculada',
          status: 'ACTIVE',
          initiatedBy: 'PRACTITIONER',
          awaiting: null,
          practiceSiteId: null,
          clinicalUnitId: null,
          careSpaceId: null,
          practitionerRoleAssignmentId: null,
          practitionerProfileId: null,
          targetName: creada.organizationName ?? null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  }

  protected otra(): void {
    this.exito.set(null);
    this.limpiar();
    this.enfocar(DOCUMENTO);
  }

  protected cargarVinculaciones(): void {
    this.vinculaciones.set(loading());
    this.practiceSites.listMyRoleAssignments().subscribe({
      next: (todas) => {
        const activas = vinculacionesInvitables(todas);
        if (activas.length === 0) {
          this.vinculaciones.set(
            empty(
              { label: 'Pida su vinculación a un hospital en «Mis procedimientos»', route: '/my-account/my-procedures' },
              'Todavía no tiene una vinculación activa con un hospital. Sin ella, una secretaria no tiene dónde asistirlo.',
            ),
          );
          this.vinculacionId.set(null);
          return;
        }
        this.vinculaciones.set(ready(activas));
        if (this.focoPendiente) {
          this.focoPendiente = false;
          this.enfocar(DOCUMENTO);
        }
        // Con una sola no hay nada que elegir; con varias, se conserva lo elegido solo si sigue estando.
        const actual = this.vinculacionId();
        this.vinculacionId.set(
          activas.length === 1 ? activas[0]!.id : activas.some((v) => v.id === actual) ? actual : null,
        );
      },
      error: (fallo: unknown) => this.vinculaciones.set(errorToViewState<readonly MyRoleAssignment[]>(fallo)),
    });
  }

  protected cambiarDocumento(valor: string | number | null): void {
    this.documento.set(String(valor ?? ''));
    if (this.rechazo()?.campo === 'documento') this.rechazo.set(null);
  }

  protected cambiarVinculacion(valor: string | null): void {
    this.vinculacionId.set(valor);
    if (this.rechazo()?.campo === 'vinculacion') this.rechazo.set(null);
  }

  protected enviar(): void {
    if (this.enviando()) return;
    this.intento.set(true);
    this.rechazo.set(null);
    const vinculacion = this.vinculacionId();
    if (errorDelDocumento(this.documento()) !== null || vinculacion === null) return;

    this.detenerEspera();
    this.enviando.set(true);
    this.support
      .inviteSupportStaff({
        nationalId: documentoParaEnviar(this.documento()),
        practitionerRoleAssignmentId: vinculacion,
      })
      .subscribe({
        next: (creada) => {
          this.enviando.set(false);
          this.exito.set(creada);
          this.limpiar();
          this.invited.emit(creada);
          // El formulario desaparece: el foco pasa al aviso de éxito, que lo lee el lector de pantalla.
          this.enfocar('[data-testid="invitar-exito"]');
        },
        error: (fallo: unknown) => {
          this.enviando.set(false);
          const rechazo = rechazoDeLaInvitacion(fallo);
          this.rechazo.set(rechazo);
          if (rechazo.esperarSegundos !== undefined) this.esperar(rechazo.esperarSegundos);
        },
      });
  }

  /** Apaga «Reintentar» durante `segundos` (con un tope razonable) y lo vuelve a encender solo. */
  private esperar(segundos: number): void {
    this.detenerEspera();
    this.esperando.set(true);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      this.esperando.set(false);
    }, Math.min(Math.max(segundos, 1), TOPE_DE_ESPERA_SEGUNDOS) * 1000);
  }

  private detenerEspera(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
    this.esperando.set(false);
  }

  /** Lleva el foco a un elemento del propio componente, cuando Angular ya lo dibujó. */
  private enfocar(selector: string): void {
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }

  /** Deja el formulario como recién abierto; la vinculación elegida se conserva. */
  private limpiar(): void {
    this.detenerEspera();
    this.documento.set('');
    this.documentoTocado.set(false);
    this.intento.set(false);
    this.rechazo.set(null);
  }
}
