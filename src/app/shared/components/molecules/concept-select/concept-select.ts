import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';

import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';

/**
 * Selector de un campo de catálogo (`*_concept_id`), poblado desde la API.
 *
 * ## Por qué es una molécula y no código suelto en cada formulario
 *
 * Porque el cableado es siempre el mismo —pedir el target, mapear opciones,
 * traducir etiquetas, aguantar el fallo— y son **737 campos** los que van a
 * necesitarlo. Repetirlo garantiza que la décima pantalla lo haga distinto que
 * la primera; en particular, que alguna se caiga cuando el catálogo no responda.
 *
 * ## El valor es el `conceptId`, y no se muestra nunca
 *
 * Lo que se manda al backend es el identificador; lo que ve la persona es una
 * palabra. Es la regla del M34 sobre uuid en pantalla, aplicada al caso más
 * común de todos.
 *
 * ## Las etiquetas en español las decide la pantalla
 *
 * El catálogo trae su `display` en inglés técnico —«Administrative gender
 * female»— porque es terminología, no copy de producto. `labels` permite mapear
 * por **código** (`GENDER_FEMALE`), que es la identidad semántica estable del
 * valor; sin entrada para un código, cae al `display` del catálogo.
 *
 * Es exactamente el mismo criterio que `case-status.ts` ya aplica a los estados
 * de un trámite, y por la misma razón: el catálogo describe conceptos, la
 * interfaz habla con personas.
 *
 * ## Un catálogo que no responde no rompe el formulario
 *
 * El campo queda deshabilitado y lo dice. **No se cae a una entrada de texto
 * libre**: un `*_concept_id` tecleado a mano es un dato inválido que el backend
 * va a rechazar, o —peor— un uuid de otro conjunto que va a aceptar.
 */
@Component({
  selector: 'app-concept-select',
  imports: [Select],
  template: `
    <app-select
      [options]="opciones()"
      [value]="value() ?? ''"
      [disabled]="disabled() || cargando() || fallo()"
      [placeholder]="marcador()"
      (valueChange)="elegir($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConceptSelect {
  private readonly systemContext = inject(SystemContextClient);

  /** El campo a poblar, como `esquema.tabla.columna`. */
  readonly target = input.required<string>();

  /** El `conceptId` elegido, o `null`. Es lo que viaja al backend. */
  readonly value = model<string | null>(null);

  readonly disabled = input(false);

  /**
   * Qué se manda: el identificador del concepto o su código estable.
   *
   * Los dos existen en el contrato y **no son intercambiables**. Casi todo campo
   * `*_concept_id` recibe el uuid; unos pocos endpoints —el alta de organización
   * con su `tenantType`— reciben el **código** y resuelven el concepto del lado
   * del servidor. Mandarle el uuid a esos devuelve un 400, y mandarle el código
   * a los otros rompe la clave foránea.
   *
   * Se declara en cada uso en vez de adivinarse: quien escribe la pantalla sabe
   * qué pide su endpoint, y el componente no tiene forma de saberlo.
   */
  readonly valueField = input<'conceptId' | 'code'>('conceptId');

  /**
   * Palabras propias por código de concepto.
   *
   * Sin entrada para un código se usa el `display` del catálogo, que está en
   * inglés pero dice algo — a diferencia de una opción en blanco.
   */
  readonly labels = input<Readonly<Record<string, string>>>({});

  /** Texto de la opción vacía. */
  readonly placeholder = input('Sin especificar');

  private readonly opcionesCrudas = signal<readonly DynamicEnumOption[]>([]);
  protected readonly cargando = signal(false);
  protected readonly fallo = signal(false);

  protected readonly opciones = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: this.placeholder() },
    ...this.opcionesCrudas().map((opcion) => ({
      value: this.valueField() === 'code' ? opcion.code : opcion.conceptId,
      label: this.labels()[opcion.code] ?? opcion.display,
    })),
  ]);

  /**
   * Qué decir mientras no hay opciones.
   *
   * Tres estados distintos y tres textos: pedir, no poder, y no haber. Un único
   * «Sin especificar» para los tres haría creer que el campo es opcional cuando
   * lo que pasa es que el catálogo no cargó.
   */
  protected readonly marcador = computed(() => {
    if (this.cargando()) {
      return 'Cargando opciones…';
    }
    if (this.fallo()) {
      return 'No se pudo cargar el catálogo';
    }
    return this.placeholder();
  });

  constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => this.cargar(target));
    });
  }

  protected elegir(valor: string | null): void {
    // La opción vacía es ausencia, no un concepto llamado «».
    this.value.set(valor === null || valor === '' ? null : valor);
  }

  private cargar(target: string): void {
    this.cargando.set(true);
    this.fallo.set(false);

    this.systemContext.dynamicEnum(target).subscribe({
      next: (enumeracion) => {
        this.opcionesCrudas.set(enumeracion.options);
        this.cargando.set(false);
      },
      error: () => {
        // Sin catálogo el campo no se ofrece, pero la pantalla sigue viva: estos
        // campos son opcionales en el contrato y el alta tiene que poder
        // completarse igual.
        this.opcionesCrudas.set([]);
        this.cargando.set(false);
        this.fallo.set(true);
      },
    });
  }
}
