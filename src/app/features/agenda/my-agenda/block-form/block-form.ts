import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';

import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { Card } from '@shared/components/molecules/card/card';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { DatePicker } from '@shared/components/organisms/date-picker/date-picker';

/** Lo que el formulario pide bloquear, ya en instantes. */
export interface BloqueoPedido {
  readonly desde: Date;
  readonly hasta: Date;
  readonly motivo: string;
  /** Para poder contarlo en el aviso de después. */
  readonly dias: number;
  readonly franjaHoraria: boolean;
}

/** Horas válidas de una franja, `HH:MM`. */
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * **Bloquear días u horarios** — D4 y D5 del plan de UX del 22/08/2026.
 *
 * ## Qué faltaba, exactamente
 *
 * Bloquear **ya existía**, y por eso el plan dejó abierta la duda de si el
 * cliente no lo había encontrado o si le faltaba el rango. Son las dos cosas:
 *
 * 1. **Descubribilidad (D5).** El único botón vivía dentro de la vista de un
 *    día, a la que se llega tocando ese día en el mes. Quien mira el mes para
 *    irse de vacaciones no tiene por qué adivinar que la acción está un nivel
 *    más abajo.
 * 2. **Rango y franja (D4).** Bloquear dos semanas eran catorce viajes de
 *    mes → día → confirmar. Y no había forma de bloquear **una tarde**: el
 *    bloqueo del día iba de medianoche a medianoche.
 *
 * ## Por qué el backend no hizo falta
 *
 * `POST /scheduling/resources/:id/exceptions` recibe `startAt` y `endAt` como
 * dos instantes cualesquiera. El bloqueo de un día ya los mandaba —medianoche
 * y medianoche del siguiente—, así que un rango de dos semanas o una franja de
 * 14:00 a 18:00 son la **misma llamada** con otros dos valores. Lo que faltaba
 * era el formulario.
 *
 * ## Por qué es un panel y no un diálogo
 *
 * Porque son cinco campos y una decisión que se toma mirando el calendario. Un
 * modal tapa justamente el mes que hay que consultar para elegir las fechas.
 */
@Component({
  selector: 'app-block-form',
  imports: [AppButton, Card, DatePicker, FormField, Input],
  templateUrl: './block-form.html',
  styleUrl: './block-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockForm {
  readonly bloquear = output<BloqueoPedido>();
  readonly cancelar = output<void>();

  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);

  /** Si el bloqueo es de una franja del día o de los días enteros. */
  protected readonly porFranja = signal(false);
  protected readonly horaDesde = signal('14:00');
  protected readonly horaHasta = signal('18:00');

  protected readonly motivo = signal('');

  /** El intento ya se envió una vez: recién ahí se muestran los errores. */
  protected readonly intentado = signal(false);

  /**
   * Cuántos días abarca el rango, contando los dos extremos.
   *
   * Se muestra antes de confirmar porque es el número que uno quiere revisar:
   * «del 10 al 24» son quince días y no catorce, y equivocarse ahí es volver
   * de vacaciones con la agenda abierta o cerrada un día de más.
   */
  protected readonly dias = computed(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    if (desde === null || hasta === null) {
      return 0;
    }
    const unDia = 24 * 60 * 60 * 1000;
    const diferencia = aMedianoche(hasta).getTime() - aMedianoche(desde).getTime();
    return diferencia < 0 ? 0 : Math.round(diferencia / unDia) + 1;
  });

  protected readonly error = computed<string | null>(() => {
    if (this.desde() === null || this.hasta() === null) {
      return 'Elegí el primer y el último día que querés bloquear.';
    }
    if (this.dias() === 0) {
      return 'El último día no puede ser anterior al primero.';
    }
    if (this.porFranja()) {
      if (!HORA.test(this.horaDesde()) || !HORA.test(this.horaHasta())) {
        return 'Las horas se escriben como HH:MM, por ejemplo 14:00.';
      }
      if (this.horaHasta() <= this.horaDesde()) {
        return 'La hora de fin tiene que ser posterior a la de inicio.';
      }
    }
    if (this.motivo().trim().length < 3) {
      return 'Escribí un motivo, aunque sea corto: es lo que vas a leer en el mes.';
    }
    return null;
  });

  /** El error, pero sólo después del primer intento. */
  protected readonly errorVisible = computed(() => (this.intentado() ? this.error() : null));

  protected fijarHoraDesde(valor: string | number | null): void {
    this.horaDesde.set(valor === null ? '' : String(valor));
  }

  protected fijarHoraHasta(valor: string | number | null): void {
    this.horaHasta.set(valor === null ? '' : String(valor));
  }

  protected fijarMotivo(valor: string | number | null): void {
    this.motivo.set(valor === null ? '' : String(valor));
  }

  /**
   * Arma los dos instantes y los emite.
   *
   * ## Los días enteros y la franja se arman distinto, y tiene que ser así
   *
   * **Días enteros**: de la medianoche del primero a la medianoche del
   * siguiente al último. El `+1` es lo que hace que el último día quede
   * bloqueado entero y no hasta las 00:00.
   *
   * **Franja**: se manda **una excepción por día**, de `horaDesde` a
   * `horaHasta` de ese día. No se puede mandar una sola de «el 10 a las 14:00
   * al 24 a las 18:00»: eso bloquearía las noches y las mañanas del medio
   * también, que es lo contrario de lo que alguien pide cuando dice «las tardes
   * de esas dos semanas».
   */
  protected enviar(): void {
    this.intentado.set(true);
    if (this.error() !== null) {
      return;
    }

    const desde = aMedianoche(this.desde()!);
    const hasta = aMedianoche(this.hasta()!);

    if (!this.porFranja()) {
      const fin = new Date(hasta);
      fin.setDate(fin.getDate() + 1);
      this.bloquear.emit({
        desde,
        hasta: fin,
        motivo: this.motivo().trim(),
        dias: this.dias(),
        franjaHoraria: false,
      });
      return;
    }

    this.bloquear.emit({
      desde: conHora(desde, this.horaDesde()),
      hasta: conHora(hasta, this.horaHasta()),
      motivo: this.motivo().trim(),
      dias: this.dias(),
      franjaHoraria: true,
    });
  }
}

/** La medianoche local de esa fecha. */
export function aMedianoche(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** Esa fecha con la hora `HH:MM` puesta, en hora local. */
export function conHora(fecha: Date, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h ?? 0, m ?? 0);
}
