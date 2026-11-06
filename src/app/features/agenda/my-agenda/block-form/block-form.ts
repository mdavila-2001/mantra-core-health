import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
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
import { SegmentedControl } from '@shared/components/molecules/segmented-control/segmented-control';
import { DatePicker } from '@shared/components/organisms/date-picker/date-picker';

import * as F from './block-form.franja';

import type { BloqueoEnEdicion, BloqueoPedido } from './block-form.types';

export { aMedianoche, conHora } from './block-form.franja';
export type { BloqueoEnEdicion, BloqueoPedido } from './block-form.types';

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
  imports: [AppButton, Card, DatePicker, FormField, Input, SegmentedControl, Select],
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

  /**
   * Lo que se está editando, o `null` para dar de alta.
   *
   * El mismo formulario hace las dos cosas **a propósito**. Escribir uno
   * aparte para editar es el camino corto que termina con dos formularios que
   * divergen: uno gana un campo, el otro no, y a los seis meses nadie sabe
   * cuál es el bueno. Es el mismo argumento por el que la creación de citas
   * reutiliza «la tarjeta».
   */
  readonly editando = input<BloqueoEnEdicion | null>(null);

  protected readonly esEdicion = computed(() => this.editando() !== null);

  readonly bloquear = output<BloqueoPedido>();
  readonly cancelar = output<void>();

  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);

  /** Si el bloqueo es de una franja del día o de los días enteros. */
  protected readonly porFranja = signal(false);
  protected readonly horaDesde = signal('14:00');
  protected readonly horaHasta = signal('18:00');

  protected readonly motivo = signal('');

  private readonly idioma = inject(LOCALE_ID);

  protected readonly pasoDeHora = F.PASO_DE_HORA_SEGUNDOS;
  protected readonly atajos = F.ATAJOS_DE_FRANJA;

  protected readonly opcionesDeAlcance = F.OPCIONES_DE_ALCANCE;

  protected readonly alcance = computed<F.Alcance>(() => (this.porFranja() ? 'franja' : 'dias'));

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

  constructor() {
    // Precarga lo que se está editando. Un `effect` y no un valor inicial
    // porque el bloqueo llega por input y puede cambiar sin que el componente
    // se vuelva a crear — la lista de bloqueos es una sola pantalla.
    effect(() => {
      const actual = this.editando();
      if (actual === null) return;
      untracked(() => {
        this.desde.set(actual.desde);
        this.hasta.set(actual.hasta);
        this.tipo.set(actual.exceptionType);
        this.motivo.set(actual.descripcion ?? '');
        // Si no arranca y termina a medianoche, es una franja de horas.
        const franja =
          actual.desde.getHours() !== 0 ||
          actual.desde.getMinutes() !== 0 ||
          actual.hasta.getHours() !== 0;
        this.porFranja.set(franja);
        if (franja) {
          this.horaDesde.set(F.comoHora(actual.desde));
          this.horaHasta.set(F.comoHora(actual.hasta));
        }
      });
    });
  }

  /** El intento ya se envió una vez: recién ahí se muestran los errores. */
  protected readonly intentado = signal(false);

  /**
   * Cuántos días abarca el rango, contando los dos extremos.
   *
   * Se muestra antes de confirmar porque es el número que uno quiere revisar:
   * «del 10 al 24» son quince días y no catorce, y equivocarse ahí es volver
   * de vacaciones con la agenda abierta o cerrada un día de más.
   */
  protected readonly dias = computed(() => F.diasDelRango(this.desde(), this.hasta()));

  protected readonly error = computed<string | null>(() => {
    if (this.desde() === null || this.hasta() === null) {
      return 'Elija el primer y el último día que quiere bloquear.';
    }
    if (this.dias() === 0) {
      return 'El último día no puede ser anterior al primero.';
    }
    if (this.porFranja()) {
      if (!F.HORA.test(this.horaDesde()) || !F.HORA.test(this.horaHasta())) {
        return 'Las horas se escriben como HH:MM, por ejemplo 14:00.';
      }
      if (this.horaHasta() <= this.horaDesde()) {
        return 'La hora de fin tiene que ser posterior a la de inicio.';
      }
    }
    if (this.exigeTexto() && this.motivo().trim().length < 3) {
      return 'Eligió «Otro»: cuente en una línea de qué se trata.';
    }
    return null;
  });

  // Per-field time errors. A missing time is flagged only after the first
  // submit; an inverted range is flagged on «Hasta» right away, since by then
  // it is a wrong value and not a draft.
  protected readonly errorHoraDesde = computed(() =>
    this.porFranja() ? F.errorDeHora(this.horaDesde(), null, this.intentado()) : null,
  );

  protected readonly errorHoraHasta = computed(() =>
    this.porFranja() ? F.errorDeHora(this.horaHasta(), this.horaDesde(), this.intentado()) : null,
  );

  protected readonly duracionFranja = computed(() =>
    F.duracionDeFranja(this.horaDesde(), this.horaHasta()),
  );

  protected readonly atajoActivo = computed(() => F.atajoActivo(this.horaDesde(), this.horaHasta()));

  protected readonly resumen = computed(() =>
    F.resumenDeBloqueo(
      this.desde(),
      this.hasta(),
      this.porFranja() ? { desde: this.horaDesde(), hasta: this.horaHasta() } : null,
      this.idioma,
    ),
  );

  /** El error, pero sólo después del primer intento. */
  protected readonly errorVisible = computed(() => (this.intentado() ? this.error() : null));

  protected elegirAlcance(valor: F.Alcance): void {
    this.porFranja.set(valor === 'franja');
  }

  protected aplicarAtajo(atajo: F.AtajoDeFranja): void {
    this.horaDesde.set(atajo.desde);
    this.horaHasta.set(atajo.hasta);
  }

  // A single-day block is the most common one: picking the first day fills
  // the last one when it is empty or now earlier.
  protected elegirDesde(valor: Date | null): void {
    this.desde.set(valor);
    const hasta = this.hasta();
    if (valor !== null && (hasta === null || F.aMedianoche(hasta) < F.aMedianoche(valor))) {
      this.hasta.set(valor);
    }
  }

  protected fijarHoraDesde(valor: string | number | null): void {
    this.horaDesde.set(F.comoTexto(valor));
  }

  protected fijarHoraHasta(valor: string | number | null): void {
    this.horaHasta.set(F.comoTexto(valor));
  }

  protected elegirTipo(valor: AvailabilityExceptionType | null): void {
    if (valor !== null) {
      this.tipo.set(valor);
    }
  }

  protected fijarMotivo(valor: string | number | null): void {
    this.motivo.set(F.comoTexto(valor));
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

    const desde = F.aMedianoche(this.desde()!);
    const hasta = F.aMedianoche(this.hasta()!);
    const franja = this.porFranja();
    const finDelDia = new Date(hasta);
    finDelDia.setDate(finDelDia.getDate() + 1);
    this.bloquear.emit({
      desde: franja ? F.conHora(desde, this.horaDesde()) : desde,
      hasta: franja ? F.conHora(hasta, this.horaHasta()) : finDelDia,
      exceptionType: this.tipo(),
      motivo: this.motivo().trim(),
      dias: this.dias(),
      franjaHoraria: franja,
    });
  }
}

