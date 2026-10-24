import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { ClaimListItem } from '../../../../core/data-access/insurance/insurance.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { dialable, whatsappUrl } from '../../../../shared/utils/telephone/telephone';

/**
 * Barra de canales de contacto directo de la aseguradora (subtarea 2.3,
 * endurecida en la Tarea 2): WhatsApp, call center y correo de siniestros.
 *
 * ## El contacto es un enlace, no una acción
 *
 * Los tres botones son anclas (`href`), nunca `(click)`: la plataforma no
 * envía el mensaje ni marca la llamada, sólo abre el canal con el destino y
 * el mensaje ya cargados. Por eso el WhatsApp usa `a[app-button]` con
 * `target="_blank"` puesto a mano —el átomo no lo gestiona solo— y el call
 * center/correo usan `a[app-link]` con `tel:`/`mailto:`, que un navegador
 * abre en la propia app de teléfono o correo, no en una pestaña.
 *
 * ## Espacio también activa el enlace (CA-2.1)
 *
 * Un `<a href>` nativo se activa con Enter, no con Espacio. El botón de
 * WhatsApp escucha `(keydown.space)` y dispara el `click()` del propio
 * elemento tras `preventDefault()` —si no, Espacio hace scroll de página en
 * vez de abrir el chat.
 *
 * ## Guards por falsy, no por `=== null`
 *
 * `toClaimListItem` (`insurance.client.ts`) hace *spread* del cuerpo tal
 * cual llega: una API que todavía no manda estos tres campos entrega
 * `undefined`, no `null`. Los `@if` de la plantilla comprueban verdad, no
 * igualdad estricta con `null`, para no mostrar botones rotos contra una
 * API vieja.
 */
@Component({
  selector: 'app-insurance-contact-channels',
  imports: [AppButtonLink, Link, Tooltip],
  templateUrl: './insurance-contact-channels.html',
  styleUrl: './insurance-contact-channels.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceContactChannels {
  /** La cabecera de la solicitud: trae el nombre de la aseguradora y sus canales. */
  readonly header = input.required<ClaimListItem>();

  /**
   * El enlace de WhatsApp, con el mensaje contextual ya cargado.
   *
   * El mensaje nombra la solicitud, el paciente y la aseguradora porque es
   * lo que el criterio de aceptación exige para que quien atiende del otro
   * lado sepa de qué se trata sin pedirlo de nuevo.
   */
  protected readonly whatsapp = computed(() => {
    const h = this.header();
    if (!h.carrierWhatsappNumber) return null;

    const paciente = h.patient.displayName ?? h.patient.patientCode ?? 'sin nombre registrado';
    const poliza = h.policyIdentifier ? ` (Póliza ${h.policyIdentifier})` : '';
    const mensaje =
      `Hola ${h.carrierName}, me comunico desde AloVida sobre la solicitud ` +
      `${h.claimIdentifier} del paciente ${paciente}${poliza}. Necesito asistencia ` +
      'sobre la cobertura o el dictamen de este caso.';

    return whatsappUrl(h.carrierWhatsappNumber, mensaje);
  });

  /**
   * El teléfono del call center, ya limpio para `tel:`.
   *
   * Comprueba el resultado de `dialable`, no el valor crudo (CA-2.3): un
   * dato guardado sin ningún dígito ("N/A") dejaría `tel:` vacío, un enlace
   * roto, si sólo se mirara que `phone` sea verdadero.
   */
  protected readonly callCenterHref = computed(() => {
    const phone = this.header().carrierCallCenterPhone;
    if (!phone) return null;
    const digits = dialable(phone);
    return digits ? `tel:${digits}` : null;
  });

  /** El teléfono del call center, tal cual se muestra (sin limpiar). */
  protected readonly callCenterDisplay = computed(() => this.header().carrierCallCenterPhone);

  /** El correo de siniestros, si la aseguradora lo publicó. */
  protected readonly supportEmail = computed(() => this.header().carrierSupportEmail);

  /** Si hay al menos un canal para mostrar. */
  protected readonly hasAnyChannel = computed(
    () => Boolean(this.whatsapp()) || Boolean(this.callCenterHref()) || Boolean(this.supportEmail()),
  );

  /** El nombre de la aseguradora, para los `aria-label`/tooltips de cada botón. */
  protected readonly carrierName = computed(() => this.header().carrierName);

  /**
   * Activa el enlace de WhatsApp con la tecla Espacio (CA-2.1): un `<a>`
   * nativo sólo responde a Enter, y Espacio sobre un elemento enfocable de
   * por sí hace scroll de la página si no se lo frena acá.
   */
  protected onWhatsappKeydownSpace(event: Event): void {
    event.preventDefault();
    (event.currentTarget as HTMLAnchorElement).click();
  }
}
