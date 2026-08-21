import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

import { mensajeDeError } from '../../../forms/paginated/mensaje-de-error';
import {
  MAX_CAMPOS_POR_PAGINA,
  type CampoDeFormulario,
  type PaginaDeFormulario,
} from '../../../forms/paginated/paginated-form.types';
import { AppButton } from '../../atoms/button/button';
import { Checkbox } from '../../atoms/checkbox/checkbox';
import { Input } from '../../atoms/input/input';
import type { InputType } from '../../atoms/input/input.types';
import { Progress } from '../../atoms/progress/progress';
import { Select } from '../../atoms/select/select';
import { Textarea } from '../../atoms/textarea/textarea';
import { FormField } from '../../molecules/form-field/form-field';
import { Stepper } from '../../molecules/stepper/stepper';
import type { StepperStep } from '../../molecules/stepper/stepper.types';
import { DatePicker } from '../date-picker/date-picker';
import { CampoPersonalizado } from './campo-personalizado';

/**
 * Cuántas páginas admite el stepper antes de estorbar.
 *
 * Con más, sus rótulos no caben en un teléfono y se convierten en una fila
 * ilegible. La barra de avance, que siempre está, no tiene ese problema.
 */
const MAX_PASOS_EN_EL_INDICADOR = 5;

/**
 * **Formulario por partes** — un formulario servido de a una página, con un tope
 * de cuatro campos en cada una y una barra que dice cuánto falta.
 *
 * ```html
 * <app-paginated-form
 *   [paginas]="paginas"
 *   [form]="formPaciente"
 *   label="Crear cuenta"
 *   submitLabel="Crear cuenta"
 *   [pending]="enviando()"
 *   (enviado)="registrar()"
 * />
 * ```
 *
 * ## Qué resuelve
 *
 * El alta de paciente pedía trece campos en una pantalla. Quien la abría veía
 * una pared, y la pared es lo que hace abandonar un registro a la mitad. Este
 * motor no es una comodidad de maquetación: **es la forma en que este producto
 * sirve formularios**, y por eso el tope de cuatro está en el contrato
 * (`MAX_CAMPOS_POR_PAGINA`) y no en una hoja de estilos.
 *
 * ## Las cuatro decisiones
 *
 * - **El dato vive en el `FormGroup` que recibe, nunca acá.** El motor no
 *   guarda valores propios: lee y escribe en el formulario de la pantalla. Así
 *   una pantalla puede seguir enviando exactamente lo que enviaba antes de
 *   paginarse — que es lo que permite migrar sin reescribir el envío.
 *
 * - **Se valida al pasar de página, no al final.** `avanzar()` marca como
 *   tocados sólo los controles de la página actual y no deja pasar si alguno
 *   está mal. Validar todo al enviar mandaría a la persona a buscar el error
 *   tres páginas atrás; validar todo al entrar pintaría de rojo lo que aún no
 *   escribió.
 *
 * - **La barra cuenta páginas terminadas, no la actual.** En el paso 1 de 4 dice
 *   0%: no hay nada hecho todavía. Empezar en 25% por haber abierto la pantalla
 *   es una barra que miente, y una barra que miente no se vuelve a mirar.
 *
 * - **El foco viaja con la página.** Al cambiar de paso, el título recibe el
 *   foco y una región viva anuncia «Paso 2 de 4: Datos de contacto». Sin eso,
 *   quien navega con teclado o lector se queda en el botón «Siguiente» de una
 *   página que ya no existe.
 */
@Component({
  selector: 'app-paginated-form',
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    AppButton,
    Checkbox,
    DatePicker,
    FormField,
    Input,
    Progress,
    Select,
    Stepper,
    Textarea,
  ],
  templateUrl: './paginated-form.html',
  styleUrl: './paginated-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'paginated-form',
  },
})
export class PaginatedForm {
  private readonly platformId = inject(PLATFORM_ID);

  readonly paginas = input.required<readonly PaginaDeFormulario[]>();

  /** El formulario de la pantalla. El motor escribe acá y en ningún otro sitio. */
  readonly form = input.required<FormGroup>();

  /** Nombre del recorrido, para el indicador y el lector de pantalla. */
  readonly label = input<string>('');

  readonly submitLabel = input<string>('Enviar');

  readonly pending = input(false, { transform: booleanAttribute });

  /** Se emite en la última página, y sólo si todo el formulario es válido. */
  readonly enviado = output<void>();

  /** Las plantillas de los campos `custom`, por `key`. */
  private readonly personalizados = contentChildren(CampoPersonalizado);

  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');

  private readonly indice = signal(0);

  readonly total = computed(() => this.paginas().length);

  /** Base 1, que es como se cuenta de cara a la persona. */
  readonly posicion = computed(() => Math.min(this.indice() + 1, this.total()));

  readonly pagina = computed<PaginaDeFormulario | null>(() => this.paginas()[this.indice()] ?? null);

  readonly esUltima = computed(() => this.posicion() >= this.total());

  readonly esPrimera = computed(() => this.indice() === 0);

  /** Páginas terminadas sobre el total, en tanto por ciento. */
  readonly avance = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.indice() / this.total()) * 100),
  );

  /** «Crear cuenta: paso 2 de 4, Datos de contacto». */
  readonly resumen = computed(() => {
    const nombre = this.label().trim();
    const progreso = `paso ${this.posicion()} de ${this.total()}`;
    const seccion = this.pagina()?.titulo ?? '';
    const cola = seccion === '' ? progreso : `${progreso}, ${seccion}`;
    return nombre === '' ? cola : `${nombre}: ${cola}`;
  });

  readonly mostrarPasos = computed(() => this.total() > 1 && this.total() <= MAX_PASOS_EN_EL_INDICADOR);

  readonly pasos = computed<readonly StepperStep[]>(() =>
    this.paginas().map((pagina, posicion) => ({
      label: pagina.titulo,
      status:
        posicion < this.indice() ? 'complete' : posicion === this.indice() ? 'current' : 'upcoming',
    })),
  );

  constructor() {
    // La invariante, comprobada también cuando las páginas llegan armadas a mano
    // en vez de por `paginarCampos`. En desarrollo se avisa fuerte: en
    // producción el fallo no es una excepción, es una pantalla con nueve campos.
    effect(() => {
      if (!isDevMode()) return;
      for (const pagina of this.paginas()) {
        if (pagina.campos.length > MAX_CAMPOS_POR_PAGINA) {
          console.error(
            `[app-paginated-form] La página «${pagina.titulo}» trae ${pagina.campos.length} campos y el tope es ${MAX_CAMPOS_POR_PAGINA}. Pasalos por paginarCampos().`,
          );
        }
      }
      const grupo = this.form();
      for (const pagina of this.paginas()) {
        for (const campo of pagina.campos) {
          if (campo.control !== 'custom' && grupo.get(campo.key) === null) {
            console.error(
              `[app-paginated-form] El campo «${campo.key}» no existe en el formulario: lo que se escriba ahí no se guarda en ningún lado.`,
            );
          }
        }
      }
    });

    // El foco sigue a la página. No en el primer render: robarle el foco a quien
    // acaba de entrar es exactamente lo que la directiva `appAnuncio` evita
    // cuando el elemento ya estaba en pantalla.
    let primera = true;
    effect(() => {
      this.indice();
      if (primera) {
        primera = false;
        return;
      }
      if (isPlatformBrowser(this.platformId)) {
        this.titulo()?.nativeElement.focus({ preventScroll: false });
      }
    });
  }

  /** El control de un campo, para la plantilla. */
  protected controlDe(campo: CampoDeFormulario) {
    return this.form().get(campo.key);
  }

  /**
   * El `type` del `<input>` nativo.
   *
   * `tel` no está entre los tipos del átomo, y no es un olvido: un `type="tel"`
   * no valida nada que `text` no valide y en cambio cambia el teclado del
   * teléfono a uno sin letras, que estorba en los números con extensión. Lo que
   * hace el trabajo es el `autocomplete="tel"`, igual que ya hacía el signup a
   * mano antes de paginarse.
   */
  protected tipoDeInput(campo: CampoDeFormulario): InputType {
    return campo.control === 'tel' ? 'text' : (campo.control as InputType);
  }

  protected errorDe(campo: CampoDeFormulario): string {
    return mensajeDeError(this.controlDe(campo), campo);
  }

  protected plantillaDe(campo: CampoDeFormulario) {
    return this.personalizados().find((entrada) => entrada.key() === campo.key)?.template ?? null;
  }

  /**
   * El valor de un campo `date`.
   *
   * `app-date-picker` trabaja con `model()` y no es un `ControlValueAccessor`,
   * así que no se enchufa con `formControlName`. Se puentea a mano contra el
   * mismo `FormControl` en vez de guardar la fecha en un signal aparte —que es
   * lo que hace hoy el signup— porque dos fuentes para el mismo dato terminan
   * siempre en una que se olvidó de actualizarse.
   */
  protected fechaDe(campo: CampoDeFormulario): Date | null {
    const valor: unknown = this.controlDe(campo)?.value;
    return valor instanceof Date ? valor : null;
  }

  protected escribirFecha(campo: CampoDeFormulario, valor: Date | null): void {
    const control = this.controlDe(campo);
    control?.setValue(valor);
    control?.markAsTouched();
  }

  protected avanzar(): void {
    if (!this.paginaEsValida()) return;
    if (this.esUltima()) return;
    this.indice.update((actual) => actual + 1);
  }

  protected retroceder(): void {
    // Sin validar: volver atrás a corregir algo no puede quedar bloqueado por lo
    // que está mal en la página de la que se vuelve.
    if (this.esPrimera()) return;
    this.indice.update((actual) => actual - 1);
  }

  /** El botón de la última página. Valida **todo**, no sólo lo visible. */
  protected enviar(): void {
    const grupo = this.form();
    grupo.markAllAsTouched();
    if (grupo.invalid) {
      // Lleva a la primera página con algo mal: dejar a la persona en la última
      // con un botón que no responde es el peor final posible.
      const fallo = this.paginas().findIndex((pagina) =>
        pagina.campos.some((campo) => this.form().get(campo.key)?.invalid === true),
      );
      if (fallo !== -1) this.indice.set(fallo);
      return;
    }
    this.enviado.emit();
  }

  /** El submit del `<form>`: en la última página envía, en el resto avanza. */
  protected continuar(): void {
    if (this.esUltima()) {
      this.enviar();
      return;
    }
    this.avanzar();
  }

  /** Marca lo de esta página y responde si se puede pasar. */
  private paginaEsValida(): boolean {
    const pagina = this.pagina();
    if (pagina === null) return true;

    let valida = true;
    for (const campo of pagina.campos) {
      const control = this.controlDe(campo);
      if (control === null) continue;
      control.markAsTouched();
      if (control.invalid) valida = false;
    }
    return valida;
  }
}
