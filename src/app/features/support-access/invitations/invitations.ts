import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  type OnInit,
} from '@angular/core';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ROLE_TEMPLATE_CODES,
  type AffiliationInvitation,
  type AffiliationInvitationKind,
  type SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';
import { HttpErrorResponse } from '@angular/common/http';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { drawQr } from '../../../shared/utils/qr/draw-qr';
import { expiryText, formatDay, templateLabel } from '../support-labels';
import { invitationLink } from './invitation-link';

type Uso = 'SINGLE' | 'MULTI';

const TIPOS: readonly SegmentedOption<AffiliationInvitationKind>[] = [
  { value: 'PRACTITIONER', label: 'Para un doctor' },
  { value: 'SUPPORT_STAFF', label: 'Para personal de apoyo' },
];

const USOS: readonly SegmentedOption<Uso>[] = [
  { value: 'SINGLE', label: 'Un solo uso' },
  { value: 'MULTI', label: 'Varios usos' },
];

const VIGENCIAS: readonly SelectOption<number>[] = [
  { value: 7, label: '7 días' },
  { value: 14, label: '14 días' },
  { value: 30, label: '30 días' },
  { value: 90, label: '90 días' },
];

/**
 * **Invitaciones y QR**: la organización emite un código (y su QR) para afiliar
 * a un doctor o sumar personal de apoyo.
 *
 * - **Un solo uso** se agota con el primer canje.
 * - **Varios usos** sirve para un grupo (el personal de una recepción): vence y
 *   tiene un tope de usos.
 *
 * El código en claro solo se ve **una vez**, al emitirlo: la API guarda su
 * huella. Por eso el resultado se muestra aparte y la lista de abajo no lo
 * trae.
 *
 * **El código es de portador** (F6): no está atado a nadie. Antes la pantalla pedía «a quién va dirigida» y rotulaba el
 * resultado «para X», pero ese nombre nunca viajaba a la API ni se guardaba: la organización podía creer que el código era
 * nominal. Ahora no se pide ni se muestra, y la pantalla dice lo que es: quien tenga el código lo puede usar hasta que
 * venza o se agote. (La API lo mitiga: un código sin persona destino no afilia solo, deja una solicitud que usted decide.) Canjear un código no da permisos por sí solo: el personal queda
 * vinculado y la organización configura qué puede hacer.
 */
@Component({
  selector: 'app-invitations',
  imports: [Alert, AppButton, Badge, Card, FormField, Input, PageHeader, SegmentedControl, Select, ViewStateHost],
  templateUrl: './invitations.html',
  styleUrl: './invitations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invitations implements OnInit {
  private readonly client = inject(SupportAccessClient);
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  protected readonly tipos = TIPOS;
  protected readonly usos = USOS;
  protected readonly vigencias = VIGENCIAS;
  protected readonly opcionesDeRol: readonly SelectOption<SupportRoleTemplateCode>[] = SUPPORT_ROLE_TEMPLATE_CODES.map((code) => ({
    value: code,
    label: templateLabel(code),
  }));

  protected readonly tipo = signal<AffiliationInvitationKind>('SUPPORT_STAFF');
  protected readonly uso = signal<Uso>('SINGLE');
  protected readonly usosMaximos = signal<string | number | null>(10);
  protected readonly vigencia = signal<number | null>(14);
  protected readonly rol = signal<SupportRoleTemplateCode | null>('SECRETARY');
  protected readonly emitiendo = signal(false);
  protected readonly falloDeEmision = signal<string | null>(null);
  protected readonly intento = signal(false);

  /** La invitación recién emitida, con el código en claro. */
  protected readonly emitida = signal<AffiliationInvitation | null>(null);
  protected readonly qrDisponible = signal(true);
  protected readonly lista = signal<ViewState<readonly AffiliationInvitation[]>>(loading());

  private readonly lienzo = viewChild<ElementRef<HTMLCanvasElement>>('qr');

  protected readonly falta = computed<string | null>(() => {
    if (this.uso() === 'MULTI') {
      const n = Number(this.usosMaximos());
      if (!Number.isInteger(n) || n < 2 || n > 200) return 'Los usos deben ser un número entre 2 y 200.';
    }
    if (this.vigencia() === null) return 'Elija cuánto dura.';
    if (this.tipo() === 'SUPPORT_STAFF' && this.rol() === null) return 'Elija el rol con el que se suman.';
    return null;
  });

  constructor() {
    // Dibujar el QR cuando el lienzo ya existe: aparece recién al haber una emisión.
    effect(() => {
      const emitida = this.emitida();
      const canvas = this.lienzo()?.nativeElement;
      if (emitida?.code === undefined || canvas === undefined) return;
      const origen = this.document.defaultView?.location.origin ?? '';
      drawQr(canvas, invitationLink(origen, emitida.code), 192).catch(() => this.qrDisponible.set(false));
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.lista.set(loading());
    this.client.listInvitations().subscribe({
      next: ({ items }) =>
        this.lista.set(items.length === 0 ? empty({ label: 'Emita la primera invitación arriba' }, 'Todavía no emitió ninguna invitación.') : ready(items)),
      error: (failure: unknown) => this.lista.set(errorToViewState<readonly AffiliationInvitation[]>(failure)),
    });
  }

  protected emitir(): void {
    this.intento.set(true);
    if (this.falta() !== null || this.emitiendo()) return;
    this.emitiendo.set(true);
    this.falloDeEmision.set(null);
    const unSoloUso = this.uso() === 'SINGLE';
    this.client
      .createInvitation({
        kind: this.tipo(),
        maxUses: unSoloUso ? 1 : Number(this.usosMaximos()),
        expiresInDays: this.vigencia()!,
        ...(this.tipo() === 'SUPPORT_STAFF' && this.rol() !== null ? { roleTemplate: this.rol()! } : {}),
      })
      .subscribe({
        next: (invitacion) => {
          this.emitiendo.set(false);
          this.intento.set(false);
          this.qrDisponible.set(true);
          this.emitida.set(invitacion);
          this.toasts.success('Invitación emitida.', 'Copie el código ahora: no se vuelve a mostrar.');
          this.cargar();
        },
        error: (failure: unknown) => {
          this.emitiendo.set(false);
          const detalle = failure instanceof HttpErrorResponse ? readApiError(failure) : null;
          const estado = errorToViewState<unknown>(failure);
          this.falloDeEmision.set(
            // Un QR de doctor sin destino necesita una práctica activa donde dejar la solicitud (412 en la API, 422 `PRECONDITION_FAILED`).
            detalle?.details?.['reason'] === 'SUPPORT_AFFILIATION_PRACTICE_MISSING'
              ? 'Su organización todavía no tiene una práctica activa, y un código para doctores necesita una donde recibir las solicitudes. Registre la práctica y vuelva a emitirlo.'
              : 'message' in estado && typeof estado.message === 'string'
                ? estado.message
                : (detalle?.message ?? '') !== ''
                  ? detalle!.message
                  : 'No pudimos emitir la invitación.',
          );
        },
      });
  }

  protected async copiar(codigo: string): Promise<void> {
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(codigo);
      this.toasts.success('Código copiado.');
    } catch {
      this.toasts.error('No pudimos copiarlo: selecciónelo y cópielo a mano.');
    }
  }

  protected cerrarResultado(): void {
    this.emitida.set(null);
  }

  /* ---- lectura ------------------------------------------------------------- */

  protected filas(): readonly AffiliationInvitation[] {
    const l = this.lista();
    return l.status === 'ready' ? l.data : [];
  }
  protected rolDe = (i: AffiliationInvitation): string => (i.roleTemplate === undefined ? '' : templateLabel(i.roleTemplate));
  protected tipoDe = (i: AffiliationInvitation): string => (i.kind === 'PRACTITIONER' ? 'Doctor' : 'Personal de apoyo');
  protected dia = formatDay;
  protected vence = (i: AffiliationInvitation): string => expiryText(i.expiresAt);
  protected estadoTexto = (i: AffiliationInvitation): string =>
    ({ ACTIVE: 'Vigente', USED: 'Usada', EXPIRED: 'Vencida', REVOKED: 'Revocada' })[i.status];
  protected estadoTono = (i: AffiliationInvitation): BadgeVariant =>
    ({ ACTIVE: 'success', USED: 'secondary', EXPIRED: 'warning', REVOKED: 'error' } as const)[i.status];
}
