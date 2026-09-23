import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import type { RamaDepartamento } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { Select as AppSelect } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DepartmentMap, type DepartamentoElegible } from '@shared/components/organisms/department-map/department-map';

/**
 * «¿En qué localidad?»: el mapa de departamentos y el select de municipio.
 *
 * ## Qué cierra
 *
 * AC-03-6 y AC-03-7 de la TAREA 03: un mapa de Bolivia donde el departamento se
 * elige con un clic **y con el teclado**, y un select de ciudad que muestra
 * **sólo** los municipios de ese departamento, alimentado de
 * `VS_BO_MUNICIPALITY` (~340, catálogo real) y nunca de una lista escrita acá.
 * Lo monta el alta de paciente dos veces —residencia y trabajo— y el alta de
 * profesional una.
 *
 * ## Por qué reemplaza al árbol de municipios, y qué se perdió
 *
 * El alta usaba `app-tree-select`: un diálogo con buscador donde se escribe el
 * nombre del municipio sin saber su departamento. Eso es P-03-9 de la ficha
 * —«¿el mapa reemplaza al árbol o conviven?»— y **no está resuelto con el
 * propietario**. Se resolvió así, y se deja escrito para poder revertirlo:
 *
 * - **El pedido es explícito**: «un mapa de Bolivia para elegir el
 *   departamento, y un select para la ciudad específica». Un árbol con buscador
 *   no es ni una cosa ni la otra.
 * - **Lo que se pierde es la búsqueda por nombre suelto.** Quien sabe que vive
 *   en «Warnes» y no recuerda que Warnes es Santa Cruz tiene que elegir primero
 *   el departamento. En Bolivia eso es un supuesto razonable —el departamento
 *   propio se sabe— y es el precio de que el municipio quede inequívoco: siete
 *   nombres se repiten entre departamentos.
 * - **Lo que NO se perdió**: el catálogo es el mismo, el `conceptId` que viaja
 *   es el mismo, y el árbol sigue existiendo para las pantallas que lo usan.
 *   Volver atrás es cambiar el componente proyectado, no rehacer el dato.
 *
 * ## Por qué el departamento no viaja al backend
 *
 * Porque el código INE del municipio (`DDPPMM`) ya lo lleva adentro, y el
 * backend lo deriva. Mandar el par abriría la puerta a que llegara incoherente
 * —el municipio de uno con el departamento de otro— y no habría criterio para
 * decidir cuál gana. Acá el departamento es **cómo se llega** al municipio, no
 * un dato aparte.
 */
@Component({
  selector: 'app-location-picker',
  imports: [DepartmentMap, AppSelect, FormField],
  templateUrl: './location-picker.html',
  styleUrl: './location-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationPicker {
  /** El árbol del catálogo: cada departamento con sus municipios. */
  readonly ramas = input.required<readonly RamaDepartamento[]>();

  /** El `conceptId` del municipio elegido, que es lo único que viaja. */
  readonly value = model<string | null>(null);

  /** Rótulo del select de municipio. La prosa la pone quien lo monta. */
  readonly municipalityLabel = input('Ciudad o municipio');

  readonly municipalityHint = input('');

  /**
   * La explicación del municipio, la que el campo muestra al apuntarlo o al
   * enfocarlo. Vacía —lo normal— no dibuja nada.
   *
   * Va aparte del `hint` por la misma razón que en el motor de formularios: el
   * `hint` se lee sin hacer nada y existe en el teléfono, donde no hay puntero;
   * la explicación es la que no cabe siempre a la vista. Ver `description` en
   * `app-form-field`.
   */
  readonly municipalityDescription = input('');

  /** Si el municipio lleva asterisco. La validación vive en el `FormControl`. */
  readonly required = input(false);

  /** El error del municipio, cuando quien lo monta lo tiene. */
  readonly errorMessage = input('');

  readonly mapLabel = input('Mapa de Bolivia: elegí tu departamento');

  /** Prefijo de los `data-testid` de las dos partes. */
  readonly testId = input('location');

  /**
   * El departamento elegido a mano, cuando todavía no hay municipio.
   *
   * Es un estado propio y no derivado porque hay un momento —entre pulsar el
   * departamento y elegir la ciudad— en el que el municipio es `null` y el
   * departamento no: sin esto, el mapa se apagaría solo en cuanto se lo pulsa y
   * el select de ciudad no llegaría a aparecer nunca.
   */
  private readonly departamentoManual = signal<string | null>(null);

  /**
   * El departamento vigente: el del municipio elegido, si lo hay; el pulsado en
   * el mapa, si no.
   *
   * El municipio manda sobre el mapa a propósito: al volver a esta página con
   * un municipio ya elegido, el mapa tiene que mostrarlo marcado aunque nadie
   * haya vuelto a tocarlo.
   */
  protected readonly departamentoElegido = computed<string | null>(() => {
    const municipio = this.value();
    if (municipio !== null) {
      const rama = this.ramas().find((r) =>
        r.municipios.some((m) => m.conceptId === municipio),
      );
      if (rama !== undefined) return rama.conceptId;
    }
    return this.departamentoManual();
  });

  /** Los departamentos, tal como los quiere el mapa. */
  protected readonly departamentos = computed<readonly DepartamentoElegible[]>(() =>
    this.ramas().map((rama) => ({
      conceptId: rama.conceptId,
      sigla: rama.sigla,
      nombre: rama.nombre,
    })),
  );

  /**
   * Los municipios **del departamento elegido**, y ninguno más (AC-03-7).
   *
   * Sin departamento la lista es vacía y el select no se dibuja: 340 opciones
   * planas es exactamente lo que este control existe para evitar.
   */
  protected readonly municipios = computed<readonly SelectOption<string>[]>(() => {
    const departamento = this.departamentoElegido();
    if (departamento === null) return [];
    const rama = this.ramas().find((r) => r.conceptId === departamento);
    if (rama === undefined) return [];
    return rama.municipios.map((m) => ({ value: m.conceptId, label: m.nombre }));
  });

  /**
   * Cambia el departamento, y suelta el municipio que dejó de pertenecerle.
   *
   * Un select con un valor que no está entre sus opciones muestra un hueco que
   * miente: parece que no se eligió nada cuando en realidad hay un municipio de
   * otro departamento a punto de viajar.
   */
  protected elegirDepartamento(conceptId: string | null): void {
    this.departamentoManual.set(conceptId);
    const municipio = this.value();
    if (municipio === null) return;
    const rama = this.ramas().find((r) => r.conceptId === conceptId);
    const sigue = rama?.municipios.some((m) => m.conceptId === municipio) ?? false;
    if (!sigue) this.value.set(null);
  }

  protected elegirMunicipio(conceptId: string | null): void {
    this.value.set(conceptId);
  }
}
