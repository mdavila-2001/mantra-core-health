import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Una explicación: por qué se pide lo que se está pidiendo en este paso. */
export interface TarjetaDeAyuda {
  readonly icono: NavIconName;
  readonly titulo: string;
  readonly texto: string;
}

/**
 * La columna que acompaña al alta: por qué te pedimos esto, y qué hacemos con
 * ello.
 *
 * ## Qué problema resuelve
 *
 * Un alta de salud pregunta cosas que ningún otro formulario pregunta —el
 * departamento que emitió tu cédula, dónde trabajás, qué seguro tenés—, y la
 * pregunta sin su motivo se lee como una intromisión. La respuesta no cabe en
 * la pista del campo: la pista dice qué escribir, no por qué se guarda ni quién
 * lo va a ver.
 *
 * Por eso el motivo vive **al lado** y no dentro del formulario. No compite con
 * los campos, no alarga la página y se puede leer o ignorar sin perder el hilo:
 * quien va rápido no la mira, quien duda encuentra la respuesta donde le nació
 * la duda, sin abandonar el alta para ir a buscarla.
 *
 * ## Por qué cambia con el paso
 *
 * Porque «por qué me piden ESTO» es una pregunta distinta en cada página. Una
 * lista fija con las ocho respuestas juntas es un texto legal: está todo y no
 * se lee nada. La pantalla le pasa las tarjetas del paso visible —ver
 * `pasoVisible` del motor— y el sello de privacidad se queda siempre, porque la
 * promesa no depende de qué se esté contestando.
 *
 * ## En el teléfono
 *
 * No hay costado, así que va debajo del formulario, después del botón: ahí es
 * donde alguien duda si sigue o abandona, y es el último sitio donde la
 * respuesta todavía sirve.
 */
@Component({
  selector: 'app-registro-ayuda',
  imports: [NavIcon],
  templateUrl: './registro-ayuda.html',
  styleUrl: './registro-ayuda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroAyuda {
  /**
   * Las explicaciones del paso que se está contestando.
   *
   * Vacío es un caso válido —hay pasos que no necesitan defenderse— y entonces
   * sólo queda el sello: la columna no se despuebla del todo, que se leería
   * como algo que no cargó.
   */
  readonly tarjetas = input<readonly TarjetaDeAyuda[]>([]);

  /**
   * Quién se está registrando. El sello prometía «tu información clínica la ve
   * el profesional que te atiende» también en el alta de una farmacia o de un
   * laboratorio, donde no hay información clínica: lo que se cuida ahí son los
   * papeles de la empresa.
   */
  readonly para = input<'persona' | 'empresa'>('persona');

  protected readonly promesas = computed(() =>
    this.para() === 'empresa' ? PROMESAS_A_LA_EMPRESA : PROMESAS_A_LA_PERSONA,
  );
}

const PROMESAS_A_LA_PERSONA = [
  'Todo lo que escribe viaja cifrado hasta nuestros servidores.',
  'Su información clínica la ve el profesional que le atiende, nadie más.',
  'No vendemos sus datos ni los usamos para publicidad.',
  'Puede corregirlos cuando quiera desde su perfil.',
] as const;

const PROMESAS_A_LA_EMPRESA = [
  'Todo lo que escribe viaja cifrado hasta nuestros servidores.',
  'Los papeles de la empresa los revisa sólo el equipo que aprueba su alta.',
  'No vendemos los datos de su empresa ni de sus gerentes.',
  'Puede corregirlos cuando quiera desde la ficha de su empresa.',
] as const;
