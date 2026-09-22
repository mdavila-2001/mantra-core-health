import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type { PinMapa, PuntoGeo } from '../../../../shared/components/organisms/map/pin-mapa.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { NOTA_DE_DATOS_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import {
  TIPOS_DE_SOCIEDAD,
  type DatosLegalesDeLaEmpresa,
  type TipoDeSociedad,
} from '../pharmacy-profile.types';

/**
 * Por qué el tipo de sociedad no admite texto libre. Es la razón que dio el
 * propio cliente al pedir el campo, y va a la vista en las dos caras: quien
 * completa el formulario y quien después lee la ficha.
 */
const NOTA_DEL_TIPO_DE_SOCIEDAD =
  'La lista es cerrada a propósito: la plataforma cuenta cuántos proveedores hay de cada tipo ' +
  'de sociedad, y para que esa cuenta sirva el valor tiene que ser uno de estos ocho.';

/** El único pin de esta pantalla: la central de la empresa. */
const PIN_DE_LA_CENTRAL = 'central';

/**
 * **Los datos legales de la empresa**: razón social, tipo de sociedad, NIT,
 * dirección de la central y su punto en el mapa.
 *
 * ## Lectura primero, edición en el mismo lugar
 *
 * La ficha se abre para leerse —es lo que se hace el 99 % de las veces— y el
 * formulario aparece en la misma pestaña al pedirlo, sin cambiar de pantalla ni
 * abrir un diálogo: quien corrige un dato quiere ver los otros mientras lo hace.
 *
 * ## Lo que todavía no se guarda, y se dice
 *
 * No hay servicio donde mandar estos datos: el contrato de farmacia no publica
 * el perfil. Así que lo que se escriba se aplica **en pantalla** y se pierde al
 * recargar, y tanto el formulario como el aviso posterior lo declaran. Fingir
 * un guardado sería peor que no ofrecerlo.
 */
@Component({
  selector: 'app-datos-de-la-empresa',
  imports: [
    Alert,
    AppButton,
    AppMap,
    Chip,
    DecimalPipe,
    FormField,
    Input,
    Select,
    Skeleton,
    ViewStateHost,
  ],
  templateUrl: './datos-de-la-empresa.html',
  styleUrl: './datos-de-la-empresa.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosDeLaEmpresa {
  private readonly toasts = inject(ToastService);

  readonly state = input.required<ViewState<DatosLegalesDeLaEmpresa>>();

  /** La persona pidió reintentar; el dueño de los datos decide qué hacer. */
  readonly retry = output<void>();

  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;
  protected readonly notaDelTipo = NOTA_DEL_TIPO_DE_SOCIEDAD;

  /** Las ocho opciones salen de la lista cerrada, en su orden, sin traducir. */
  protected readonly opcionesDeSociedad: readonly SelectOption<TipoDeSociedad>[] =
    TIPOS_DE_SOCIEDAD.map((tipo) => ({ value: tipo, label: tipo }));

  /**
   * Lo que se está escribiendo; `null` cuando no hay formulario abierto.
   *
   * Es **la única** señal de que se está editando: una bandera aparte podría
   * quedar en `true` con el borrador vacío, y entonces el formulario se dibuja
   * sin nada que escribir.
   */
  protected readonly borrador = signal<DatosLegalesDeLaEmpresa | null>(null);

  protected readonly editando = computed(() => this.borrador() !== null);

  /**
   * Lo aplicado en esta sesión de pantalla. Nada de esto se persiste.
   *
   * **Al cablear la API hay que limpiarlo cuando llegue un `state` nuevo.** Hoy
   * es inalcanzable porque el estado no cambia nunca, pero con datos de verdad
   * esto gana siempre sobre lo recibido: un «Aplicar en la ficha» taparía toda
   * respuesta posterior del servidor y no habría forma de volver atrás salvo
   * recargando la página. Que no se resuelva con `linkedSignal`: en este repo
   * no reacciona bajo pruebas.
   */
  private readonly aplicado = signal<DatosLegalesDeLaEmpresa | null>(null);

  private readonly recibido = computed(() => dataOf(this.state()));

  /** Lo que la ficha muestra: lo aplicado en pantalla, o lo que llegó. */
  protected readonly empresa = computed(() => this.aplicado() ?? this.recibido());

  /** El punto que el mapa dibuja: el del formulario si está abierto. */
  protected readonly punto = computed<PuntoGeo | null>(
    () => (this.borrador() ?? this.empresa())?.puntoCentral ?? null,
  );

  protected readonly pines = computed<readonly PinMapa[]>(() => {
    const punto = this.punto();
    const empresa = this.empresa();
    if (punto === null || empresa === null) {
      return [];
    }
    return [
      {
        id: PIN_DE_LA_CENTRAL,
        lat: punto.lat,
        lng: punto.lng,
        titulo: empresa.razonSocial,
        subtitulo: empresa.direccionLegal,
      },
    ];
  });

  protected editar(): void {
    this.borrador.set(this.empresa());
  }

  protected descartar(): void {
    this.borrador.set(null);
  }

  /** Deja la ficha con lo escrito. En pantalla: no hay dónde guardarlo todavía. */
  protected aplicar(): void {
    const borrador = this.borrador();
    if (borrador === null) {
      return;
    }
    this.aplicado.set(borrador);
    this.borrador.set(null);
    this.toasts.info(
      'La ficha se ve con estos datos, pero todavía no se guardan: el guardado llega con el perfil de la farmacia.',
      'Cambios sólo en pantalla',
    );
  }

  protected fijarRazonSocial(valor: ValorDeCampo): void {
    this.actualizar({ razonSocial: textoDe(valor) });
  }

  protected fijarNit(valor: ValorDeCampo): void {
    this.actualizar({ nit: textoDe(valor) });
  }

  protected fijarDireccion(valor: ValorDeCampo): void {
    this.actualizar({ direccionLegal: textoDe(valor) });
  }

  /**
   * El tipo sale de la lista o no sale: el desplegable devuelve el mismo valor
   * que entró en `options`, así que acá no hay ningún texto libre que validar.
   */
  protected fijarTipoDeSociedad(valor: TipoDeSociedad | null): void {
    this.actualizar({ tipoDeSociedad: valor });
  }

  /**
   * El punto que se marcó en el mapa. Sólo con el formulario abierto: en
   * lectura el mapa muestra, no cambia la ficha por un clic al desplazarse.
   */
  protected marcarPunto(punto: PuntoGeo): void {
    this.actualizar({ puntoCentral: punto });
  }

  private actualizar(cambios: Partial<DatosLegalesDeLaEmpresa>): void {
    this.borrador.update((actual) => (actual === null ? null : { ...actual, ...cambios }));
  }
}

/**
 * Lo que emite `app-input`: el átomo declara `string | number | null` y en un
 * campo numérico devuelve un número, no su texto.
 */
type ValorDeCampo = string | number | null;

/**
 * Normaliza al borde lo que llega de un campo. La alternativa era un `$any()`
 * en la plantilla, que apaga justamente la comprobación que hace falta.
 */
function textoDe(valor: ValorDeCampo): string {
  return valor === null ? '' : String(valor);
}
