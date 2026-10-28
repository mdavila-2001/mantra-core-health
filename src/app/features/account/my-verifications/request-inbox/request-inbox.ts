import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import type { RequestThread } from '../my-verifications.model';

/**
 * La bandeja de solicitudes enviadas, como un chat: la lista de conversaciones
 * a la izquierda y el hilo abierto a la derecha (una debajo de la otra en
 * angosto), con las burbujas y el papel de la mensajería del producto
 * (`--chat-*`).
 *
 * Es presentacional: no lee ni escribe nada. Recibe los hilos ya armados
 * (`buildThreads`) y avisa qué se pidió —retirar, volver a pedir—; quien la
 * monta llama a la API y vuelve a leer. Vive aparte de «Mis verificaciones» por
 * tamaño: sus estilos solos son los de un chat.
 */
@Component({
  selector: 'app-request-inbox',
  imports: [AppButton, AppButtonLink, DatePipe, NavIcon, RouterLink, StatusSeal],
  templateUrl: './request-inbox.html',
  styleUrl: './request-inbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestInbox {
  /** Las conversaciones, de la novedad más reciente a la más vieja. */
  readonly threads = input.required<readonly RequestThread[]>();

  /** Hay una escritura en curso: las acciones se apagan hasta que termine. */
  readonly busy = input(false);

  /** La conversación abierta. Sin elegir, la de la novedad más reciente. */
  readonly openId = model<string | null>(null);

  readonly withdraw = output<RequestThread>();
  readonly requestAgain = output<RequestThread>();

  protected readonly abierto = computed<RequestThread | null>(() => {
    const hilos = this.threads();
    return hilos.find((h) => h.id === this.openId()) ?? hilos[0] ?? null;
  });
}
