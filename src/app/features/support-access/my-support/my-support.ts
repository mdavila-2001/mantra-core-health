import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_TEMPLATE_DEFAULT_ACTIONS,
  type MySupportEngagements,
  type SupportActionCode,
  type SupportCatalog,
  type SupportEngagement,
  type SupportEngagementRequest,
  type SupportScopeTarget,
} from '../../../core/data-access/support-access/support-access.types';
import {
  catalogFromGrants,
  summarizeGrants,
} from '../../../core/data-access/support-access/support-summary';
import {
  classifyReview,
  personNotice,
} from '../../../core/data-access/support-access/support-recertification';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { codeFromPasted, stripInvitationCode } from '../invitations/invitation-link';
import { SupportActionPicker } from '../support-action-picker/support-action-picker';
import { conditionNotes, obligationNotes } from './my-access-notes';
import { MyApprovals } from './my-approvals/my-approvals';
import { MyExplain, type MyExplainPrefill } from './my-explain/my-explain';
import { REDEEM_PRECONDITION_TEXT, redeemPreconditionOf, textoDelCanje } from './redeem-text';
import { readApiError } from '../../../core/http/api-error';
import {
  engagementStatusText,
  engagementStatusTone,
  expiryText,
  formatDay,
  grantLabel,
  itemDecisionText,
  itemDecisionTone,
  originText,
  requestStatusText,
  requestStatusTone,
  templateLabel,
} from '../support-labels';

/** El mismo mensaje para un código inexistente, usado o vencido. */
export const MENSAJE_DE_CODIGO_INVALIDO =
  'Ese código no es válido o ya no está disponible. Revíselo o pida uno nuevo a la organización.';

type TipoPedido = 'PRACTITIONER' | 'SERVICE' | 'LOCATION';

const TIPOS_DE_PEDIDO: readonly SegmentedOption<TipoPedido>[] = [
  { value: 'PRACTITIONER', label: 'Un doctor' },
  { value: 'SERVICE', label: 'Un servicio' },
  { value: 'LOCATION', label: 'Un piso o lugar' },
];

interface ItemPedido {
  readonly objetivo: SupportScopeTarget;
  readonly nombre: string;
  readonly acciones: readonly SupportActionCode[];
}

/**
 * **Mis accesos**: lo que una persona de apoyo puede hacer, por organización,
 * dicho en lenguaje simple.
 *
 * Desde acá se **pide más** (una solicitud que decide la organización), se
 * **une con un código o QR** y se ve el historial propio de lo pedido. Lo que se
 * muestra como «puede hacer» es el resumen de los permisos que la API devolvió;
 * si la organización los cambia, la próxima lectura lo refleja. Nada de esta
 * pantalla otorga nada.
 */
@Component({
  selector: 'app-my-support',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    ContentDialog,
    FormField,
    Input,
    MyApprovals,
    MyExplain,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    SupportActionPicker,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './my-support.html',
  styleUrl: './my-support.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySupport implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly toasts = inject(ToastService);
  private readonly location = inject(Location);
  private readonly dialogs = inject(DialogService);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<ViewState<MySupportEngagements>>(loading());

  /* ---- unirse con un código ------------------------------------------------ */
  protected readonly codigo = signal('');
  protected readonly canjeando = signal(false);
  protected readonly resultadoDelCanje = signal<{
    tono: 'success' | 'info' | 'error';
    texto: string;
    enlace?: { texto: string; ruta: string };
  } | null>(null);

  /* ---- pedir más ------------------------------------------------------------ */
  protected readonly pidiendoEn = signal<SupportEngagement | null>(null);
  protected readonly catalogo = signal<SupportCatalog | null>(null);
  protected readonly errorDeCatalogo = signal<string | null>(null);
  protected readonly tiposDePedido = TIPOS_DE_PEDIDO;
  protected readonly tipoDePedido = signal<TipoPedido>('PRACTITIONER');
  protected readonly objetivoElegido = signal<string | null>(null);
  protected readonly accionesDelPedido = signal<readonly SupportActionCode[]>([]);
  protected readonly items = signal<readonly ItemPedido[]>([]);
  protected readonly mensaje = signal('');
  protected readonly enviando = signal(false);
  protected readonly falloDeEnvio = signal<string | null>(null);
  protected readonly intentoDeEnvio = signal(false);

  /**
   * Una pregunta lista para «¿Por qué no puedo?»: `?action=&doctor=&tenant=&patient=&at=` (por ejemplo, desde un bloque
   * «Reservado»). Se **precarga y espera un clic**: un enlace no puede hacer que el navegador de la persona consulte el
   * motivo de un acceso sobre un paciente arbitrario (F7). El parámetro `ask=1` de enlaces antiguos se ignora.
   */
  protected readonly preguntaLista = signal<MyExplainPrefill | null>(null);

  protected readonly vinculos = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.engagements : [];
  });
  protected readonly solicitudes = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.requests : [];
  });

  protected readonly opcionesDeObjetivo = computed<readonly SelectOption<string>[]>(() => {
    const c = this.catalogo();
    if (c === null) return [];
    switch (this.tipoDePedido()) {
      case 'PRACTITIONER':
        return c.doctors.map((d) => ({ value: d.id, label: `${d.name} · ${d.specialty}` }));
      case 'SERVICE':
        return c.services.map((s) => ({ value: s.id, label: s.name }));
      case 'LOCATION':
        return c.locations.map((n) => ({ value: n.id, label: n.name }));
    }
  });

  ngOnInit(): void {
    // El código del QR viaja en el fragmento (`#code=`). Se lee una vez y se borra
    // de la barra de direcciones y del historial: es un secreto de portador y no
    // debe quedar en un marcador, una captura ni un `Referer`.
    const { code, path } = stripInvitationCode(this.location.path(true));
    if (code !== null) {
      this.codigo.set(code);
      this.location.replaceState(path);
    }
    this.leerPregunta();
    this.cargar();
  }

  private leerPregunta(): void {
    const q = this.route.snapshot.queryParamMap;
    const action = q.get('action');
    if (action === null) return;
    this.preguntaLista.set({
      ...(q.get('tenant') === null ? {} : { tenantId: q.get('tenant')! }),
      question: {
        action,
        ...(q.get('doctor') === null ? {} : { practitionerRoleAssignmentId: q.get('doctor')! }),
        ...(q.get('patient') === null ? {} : { patientProfileId: q.get('patient')! }),
        ...(q.get('at') === null ? {} : { at: q.get('at')! }),
      },
    });
  }

  protected cargar(): void {
    this.state.set(loading());
    this.client.listMyEngagements().subscribe({
      next: (datos) =>
        this.state.set(
          datos.engagements.length === 0 && datos.requests.length === 0
            ? empty(
                { label: 'Escriba un código arriba para unirse' },
                'Todavía no ayuda en ninguna organización.',
              )
            : ready(datos),
        ),
      error: (failure: unknown) => this.state.set(errorToViewState<MySupportEngagements>(failure)),
    });
  }

  /* ---- lectura ------------------------------------------------------------- */

  protected rol = (v: SupportEngagement): string => templateLabel(v.roleTemplate);
  protected estadoTexto = (v: SupportEngagement): string => engagementStatusText(v.status);
  protected estadoTono = (v: SupportEngagement) => engagementStatusTone(v.status);
  protected origen = (v: SupportEngagement): string => originText(v.origin);
  protected dia = formatDay;
  protected solicitudTexto = requestStatusText;
  protected solicitudTono = requestStatusTone;
  protected decisionTexto = itemDecisionText;
  protected decisionTono = itemDecisionTone;
  protected nombreDelItem = (i: Parameters<typeof grantLabel>[0]): string => grantLabel(i);
  protected vence = (s: SupportEngagementRequest): string => expiryText(s.expiresAt);

  /** El resumen en lenguaje simple de lo que puede hacer en esa organización. */
  protected resumen(v: SupportEngagement): readonly string[] {
    return summarizeGrants(v.grants, catalogFromGrants(v.organizationName, v.grants));
  }

  /** Las condiciones y prohibiciones de sus permisos, en frases. */
  protected condiciones = (v: SupportEngagement): readonly string[] => conditionNotes(v.grants);

  /** Lo que se le pedirá al actuar (motivo, segundo paso, aprobación). */
  protected obligaciones = (v: SupportEngagement): readonly string[] => obligationNotes(v.grants);

  /** El aviso de recertificación de este vínculo, o `null` si está al día. */
  protected aviso(v: SupportEngagement): ReturnType<typeof personNotice> {
    return personNotice(classifyReview(v), v);
  }

  protected readonly confirmando = signal<string | null>(null);

  /**
   * La persona declara que **sigue trabajando aquí**. No renueva nada: la que renueva (y
   * reactiva) el vínculo es la organización, y el diálogo se lo dice antes de enviar.
   */
  protected async confirmarVinculo(v: SupportEngagement): Promise<void> {
    if (this.confirmando() !== null) return;
    const confirmado = await this.dialogs.confirm({
      title: 'Confirmar que sigo trabajando aquí',
      message: `Confirmo que sigo trabajando en ${v.organizationName} como ${templateLabel(v.roleTemplate).toLocaleLowerCase('es')}. Esto le avisa a la organización, pero no renueva su vínculo: la que lo renueva es la organización.`,
      confirmLabel: 'Confirmar que sigo trabajando aquí',
    });
    if (!confirmado) return;
    this.confirmando.set(v.id);
    this.client.confirmMyEngagement(v.id).subscribe({
      next: (resultado) => {
        this.confirmando.set(null);
        // `reactivated` es lo que la API de hoy hace con un vínculo suspendido; la pantalla no lo ofrece,
        // pero si llega se dice la verdad de lo que quedó.
        this.toasts.success(
          resultado.reactivated
            ? 'Su vínculo volvió a estar activo.'
            : 'Le avisamos a la organización que sigue trabajando aquí.',
          resultado.reactivated ? undefined : 'Ella debe renovar el vínculo.',
        );
        this.cargar();
      },
      error: (failure: unknown) => {
        this.confirmando.set(null);
        const estado = errorToViewState<unknown>(failure);
        this.toasts.error(
          'message' in estado && typeof estado.message === 'string'
            ? estado.message
            : 'No pudimos registrar su confirmación. Vuelva a intentarlo.',
        );
      },
    });
  }

  protected ordenDeEstado(v: SupportEngagement): boolean {
    return v.status === 'ACTIVE';
  }

  /* ---- canjear ------------------------------------------------------------- */

  protected canjear(): void {
    const limpio = codeFromPasted(this.codigo());
    if (limpio === '' || this.canjeando()) return;
    this.canjeando.set(true);
    this.resultadoDelCanje.set(null);
    this.client.redeemInvitation(limpio).subscribe({
      next: (r) => {
        this.canjeando.set(false);
        this.codigo.set('');
        this.resultadoDelCanje.set({
          tono: r.pendingApproval === true ? 'info' : 'success',
          texto: textoDelCanje(r),
        });
        this.cargar();
      },
      error: (failure: unknown) => {
        this.canjeando.set(false);
        // Un código que no existe, ya se usó o venció se dice **igual**: la API
        // responde lo mismo para los tres a propósito, y esta pantalla tampoco
        // debe dar pistas de cuál fue.
        // Dos 412 **no** son el 422 opaco de un código malo: dicen algo que la persona puede arreglar (completar su perfil
        // profesional; o pedir a la organización que registre su práctica), y el código sigue siendo válido.
        const previa =
          failure instanceof HttpErrorResponse
            ? redeemPreconditionOf(readApiError(failure)?.details?.['reason'])
            : null;
        if (previa !== null) {
          this.resultadoDelCanje.set({
            tono: 'error',
            texto: REDEEM_PRECONDITION_TEXT[previa],
            ...(previa === 'PROFILE_REQUIRED'
              ? { enlace: { texto: 'Completar mi perfil profesional', ruta: '/my-account' } }
              : {}),
          });
          return;
        }
        const rechazado =
          failure instanceof HttpErrorResponse &&
          failure.status >= 400 &&
          failure.status < 500 &&
          failure.status !== 429;
        this.resultadoDelCanje.set({
          tono: 'error',
          texto: rechazado
            ? MENSAJE_DE_CODIGO_INVALIDO
            : 'No pudimos canjear el código. Revise su conexión y vuelva a intentar.',
        });
      },
    });
  }

  /* ---- pedir más permisos --------------------------------------------------- */

  protected abrirPedido(vinculo: SupportEngagement): void {
    this.pidiendoEn.set(vinculo);
    this.catalogo.set(null);
    this.errorDeCatalogo.set(null);
    this.items.set([]);
    this.mensaje.set('');
    this.falloDeEnvio.set(null);
    this.intentoDeEnvio.set(false);
    this.tipoDePedido.set('PRACTITIONER');
    this.objetivoElegido.set(null);
    this.accionesDelPedido.set([...SUPPORT_TEMPLATE_DEFAULT_ACTIONS[vinculo.roleTemplate]]);
    this.client.getMyCatalog(vinculo.tenantId).subscribe({
      next: (c) => this.catalogo.set(c),
      error: () =>
        this.errorDeCatalogo.set(
          'No pudimos cargar los doctores, servicios y lugares de esta organización.',
        ),
    });
  }

  protected cerrarPedido(): void {
    this.pidiendoEn.set(null);
  }

  protected cambiarTipoDePedido(tipo: TipoPedido): void {
    this.tipoDePedido.set(tipo);
    this.objetivoElegido.set(null);
  }

  protected agregarItem(): void {
    const id = this.objetivoElegido();
    const c = this.catalogo();
    if (id === null || c === null || this.accionesDelPedido().length === 0) return;
    let objetivo: SupportScopeTarget;
    let nombre: string;
    switch (this.tipoDePedido()) {
      case 'PRACTITIONER':
        objetivo = { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: id };
        nombre = c.doctors.find((d) => d.id === id)?.name ?? 'Doctor';
        break;
      case 'SERVICE':
        objetivo = { targetKind: 'SERVICE', healthcareServiceId: id };
        nombre = `Servicio · ${c.services.find((s) => s.id === id)?.name ?? ''}`;
        break;
      case 'LOCATION': {
        const nodo = c.locations.find((n) => n.id === id);
        objetivo =
          nodo?.kind === 'SITE'
            ? { targetKind: 'LOCATION', practiceSiteId: id }
            : { targetKind: 'LOCATION', careSpaceId: id };
        nombre = nodo?.name ?? 'Ubicación';
        break;
      }
    }
    this.items.update((actual) => [
      ...actual,
      { objetivo, nombre, acciones: this.accionesDelPedido() },
    ]);
    this.objetivoElegido.set(null);
  }

  protected quitarItem(indice: number): void {
    this.items.update((actual) => actual.filter((_, i) => i !== indice));
  }

  protected enviarPedido(): void {
    this.intentoDeEnvio.set(true);
    const vinculo = this.pidiendoEn();
    if (vinculo === null || this.items().length === 0 || this.enviando()) return;
    this.enviando.set(true);
    this.falloDeEnvio.set(null);
    this.client
      .requestEngagement({
        tenantId: vinculo.tenantId,
        roleTemplate: vinculo.roleTemplate,
        parentEngagementId: vinculo.id,
        ...(this.mensaje().trim() === '' ? {} : { message: this.mensaje().trim() }),
        items: this.items().map((i) => ({ ...i.objetivo, proposedActions: i.acciones })),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.pidiendoEn.set(null);
          this.toasts.success(
            'Solicitud enviada.',
            'La organización la va a revisar. Vence en 15 días.',
          );
          this.cargar();
        },
        error: (failure: unknown) => {
          this.enviando.set(false);
          const estado = errorToViewState<unknown>(failure);
          this.falloDeEnvio.set(
            'message' in estado && typeof estado.message === 'string'
              ? estado.message
              : 'No pudimos enviar la solicitud.',
          );
        },
      });
  }
}
