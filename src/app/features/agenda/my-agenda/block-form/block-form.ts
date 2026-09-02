import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import type {
  AvailabilityExceptionType,
  AvailabilityExceptionTypeOption,
} from '@core/data-access/scheduling/scheduling.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { Input } from '@shared/components/atoms/input/input';
import { Select } from '@shared/components/atoms/select/select';
import type { SelectOption } from '@shared/components/atoms/select/select.types';
import { Card } from '@shared/components/molecules/card/card';
import { FormField } from '@shared/components/molecules/form-field/form-field';
import { DatePicker } from '@shared/components/organisms/date-picker/date-picker';

/** Lo que el formulario pide bloquear, ya en instantes. */
export interface BloqueoPedido {
  readonly desde: Date;
  readonly hasta: Date;
  /**
   * El motivo del catálogo. Antes no viajaba y quien creaba la excepción
   * ponía `ABSENCE` fijo para todo — vacaciones, feriados y trámites quedaban
   * indistinguibles en la base.
   */
  readonly exceptionType: AvailabilityExceptionType;
  /** El texto libre. Vacío salvo que el motivo elegido lo exija. */
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
 * 3. **El motivo (TAREA-11, punto 4).** El formulario pedía texto libre y
 *    nada más, así que **todo bloqueo nacía con `ABSENCE`**: vacaciones,
 *    feriado y trámite quedaban indistinguibles en la base aunque la columna
 *    `exception_type_concept_id` existiera para distinguirlos. Ahora la lista
 *    viene del servidor y el texto libre pasa a ser la excepción, no la regla.
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
  imports: [AppButton, Card, DatePicker, FormField, Input, Select],
  templateUrl: './block-form.html',
  styleUrl: './block-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockForm {
  /**
   * Los motivos que se pueden elegir, tal como los publica la API.
   *
   * Entran por input y no se piden acá: este componente no habla con la red
   * —es lo que lo hace probable sin montar un cliente— y quien lo usa ya tiene
   * el recurso cargado, así que la llamada le sale gratis.
   *
   * Con la lista vacía el selector no se dibuja y el formulario sigue
   * funcionando con `ABSENCE`, que es exactamente lo que hacía antes: un
   * catálogo que no cargó no puede impedir que alguien se vaya de vacaciones.
   */
  readonly motivos = input<readonly AvailabilityExceptionTypeOption[]>([]);

  readonly bloquear = output<BloqueoPedido>();
  readonly cancelar = output<void>();

  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);

  /** Si el bloqueo es de una franja del día o de los días enteros. */
  protected readonly porFranja = signal(false);
  protected readonly horaDesde = signal('14:00');
  protected readonly horaHasta = signal('18:00');

  protected readonly motivo = signal('');

  /**
   * El motivo elegido. Arranca en `ABSENCE` porque es el que la pantalla
   * mandaba fijo antes de que hubiera catálogo: si la lista no llega, el
   * comportamiento es el de siempre y no el de un campo vacío.
   */
  protected readonly tipo = signal<AvailabilityExceptionType>('ABSENCE');

  /**
   * Sólo los motivos que **cierran** horario.
   *
   * `EXTRA` viaja en el mismo catálogo pero abre disponibilidad fuera del
   * patrón: ofrecerlo en un formulario titulado «Bloquear» sería ofrecer lo
   * contrario de lo que el botón promete. El servidor marca la diferencia con
   * `blocks`, y acá se respeta en vez de mantener una segunda lista.
   */
  protected readonly opcionesDeMotivo = computed<SelectOption<AvailabilityExceptionType>[]>(() =>
    this.motivos()
      .filter((m) => m.blocks)
      .map((m) => ({ value: m.type, label: m.label })),
  );

  /** El motivo elegido, con sus reglas, si está en la lista. */
  protected readonly motivoElegido = computed(() =>
    this.motivos().find((m) => m.type === this.tipo()),
  );

  /**
   * Si hay que explicar por qué.
   *
   * La regla la fija el servidor (`requiresText`, hoy sólo «Otro»), no una
   * comparación contra `'OTHER'` escrita acá: el día que el propietario agregue
   * un motivo que también la exija, esta pantalla ya lo cumple.
   */
  protected readonly exigeTexto = computed(() => this.motivoElegido()?.requiresText ?? false);

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
    if (this.exigeTexto() && this.motivo().trim().length < 3) {
      return 'Elegiste «Otro»: contá en una línea de qué se trata.';
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

  protected elegirTipo(valor: AvailabilityExceptionType | null): void {
    if (valor !== null) {
      this.tipo.set(valor);
    }
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
        exceptionType: this.tipo(),
        motivo: this.motivo().trim(),
        dias: this.dias(),
        franjaHoraria: false,
      });
      return;
    }

    this.bloquear.emit({
      desde: conHora(desde, this.horaDesde()),
      hasta: conHora(hasta, this.horaHasta()),
      exceptionType: this.tipo(),
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
