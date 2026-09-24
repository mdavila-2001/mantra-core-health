import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { SpecialtyIcon } from '../../atoms/specialty-icon/specialty-icon';
import { StatusSeal } from '../status-seal/status-seal';
import type { StatusSealVariant } from '../status-seal/status-seal.types';

/**
 * La insignia de una especialidad médica: **una sola forma** para mostrarla,
 * en cualquier pantalla.
 *
 * ```html
 * <app-specialty-badge
 *   [especialidad]="e.nombre"
 *   [estado]="e.estado"
 *   [sello]="e.sello"
 * />
 * ```
 *
 * ## Qué problema cierra
 *
 * Antes de esto, una misma especialidad se dibujaba de cinco maneras sólo
 * dentro del perfil del profesional —chip, chip con otra regla de color, texto
 * suelto, título de ítem, conteo— y el color que le tocaba dependía de **quién
 * la miraba**: en el perfil propio se repartía por un hash del nombre, y en la
 * ficha que ve un paciente iban todas grises.
 *
 * ## El tono: uno solo, igual para todas
 *
 * `secondary`, para todas las especialidades. Hasta el 23/09/2026 la principal
 * iba en `primary` y con la palabra «Principal»; el médico pidió que todas se
 * vieran iguales (D-01) y la distinción se retiró de la insignia. El dato
 * `isPrimary` sigue en el contrato: sólo dejó de mostrarse.
 *
 * Por la misma razón, desde el 24/09/2026 tampoco marca la certificación del
 * consejo: una tilde en una sola insignia la volvía distinta de las otras, que
 * es justo lo que D-01 quita. El dato `boardCertified` sigue en el contrato y
 * se dice con palabras donde corresponde, en «Credenciales» de la ficha.
 *
 * **Por qué no el hash.** Repartía `success`, `info` y `secondary` entre
 * especialidades, y los dos primeros **significan algo** en este sistema, así
 * que una especialidad podía leerse como el estado de un trámite. Un color
 * arbitrario que aparenta ser una categoría es peor que ningún color: es
 * información falsa.
 *
 * **Por qué no `neutral`.** Porque el gris ya se probó y el cliente pidió
 * dejar de verlo (19/09/2026, registrado en `practitioner-profile-view.ts`).
 * Una especialidad no es un dato apagado.
 *
 * Queda `secondary`: de marca, sin significado de estado, y no gris. Lo que
 * distingue una especialidad de otra es el **ícono**, que es reconocimiento de
 * verdad y no un color sorteado. Los siete tonos del sistema pasan 4,5:1 en los
 * dos temas, así que la elección nunca fue de contraste — fue de significado.
 *
 * ## Nada se dice sólo con color
 *
 * El estado lo pone `app-status-seal`, que exige `label` por la misma razón:
 * el tono acompaña al texto, no lo reemplaza.
 *
 * ## Por qué vive en `organisms/` y no en `molecules/`
 *
 * Por el sello. Monta `app-status-seal`, que está clasificado como organismo, y
 * la jerarquía del repositorio la hace cumplir el linter: *«una molecule no
 * puede depender de un organism: la composición va al revés»*. Quien depende de
 * un organismo está por encima de él, así que acá va.
 *
 * Dicho lo cual, `status-seal` son sesenta líneas sin dependencias y un input
 * obligatorio: por forma es una molécula. Reclasificarlo tocaría su carpeta, el
 * barrel de organismos y sus cinco consumidores por un asunto de etiqueta, y
 * eso no es trabajo de este cambio. Queda anotado para que la ubicación de esta
 * pieza se lea como lo que es —una consecuencia— y no como un descuido.
 */
@Component({
  selector: 'app-specialty-badge',
  imports: [SpecialtyIcon, StatusSeal],
  templateUrl: './specialty-badge.html',
  styleUrl: './specialty-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'specialty-badge tone--secondary',
  },
})
export class SpecialtyBadge {
  /** El nombre de la especialidad. El ícono se resuelve de acá adentro. */
  readonly especialidad = input.required<string>();

  /** El estado en palabras. Sin texto no se dibuja sello, aunque haya `sello`. */
  readonly estado = input('');
  readonly sello = input<StatusSealVariant | null>(null);

  /**
   * El sello se dibuja sólo con las dos mitades: la variante pone tono y forma,
   * el texto dice qué significa. Con una sola, el estado quedaría dicho por
   * color, que es lo que este componente existe para evitar.
   */
  protected readonly muestraSello = computed(
    () => this.sello() !== null && this.estado().trim() !== '',
  );
}
