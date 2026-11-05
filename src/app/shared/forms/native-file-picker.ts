import { DestroyRef, Directive, ElementRef, inject, Renderer2, signal } from '@angular/core';

/**
 * Avisa cuándo el diálogo nativo de archivos de un `<input type="file">` está
 * abierto, para que la zona de soltar que lo rodea deje de aceptar arrastres
 * mientras tanto.
 *
 * ## Por qué
 *
 * Quien elige «desde su dispositivo» abre el diálogo del sistema. Mientras ese
 * diálogo está abierto, en Windows se puede arrastrar un archivo desde el
 * propio diálogo hasta la página, y la zona de soltar lo tomaba: dos caminos
 * de selección a la vez, con la zona iluminada como si invitara a soltar
 * (captura del propietario, 04/11/2026). La regla es una sola para todas las
 * superficies con arrastre y selector nativo —`app-file-input`,
 * `appFileDropTarget` y el dropzone de resultados de laboratorio—: si se
 * eligió el diálogo, no se arrastra hasta que el diálogo se cierre.
 *
 * ## Cómo sabe que abrió y que cerró
 *
 * - Abre con el `click` del control (también el sintético que dispara un
 *   `<label for>` o un `.click()` programático). Un control deshabilitado no
 *   abre nada.
 * - Cierra con `change` (eligió algo), con `cancel` (lo cerró sin elegir;
 *   Chrome 113, Firefox 91, Safari 16.4) y, para navegadores que todavía no
 *   emiten `cancel`, con el `focus` de la ventana, que vuelve a la página en
 *   cuanto el diálogo se cierra. Si un navegador no emitiera ninguno de los
 *   tres, el estado quedaría «abierto» hasta el siguiente `change`: el peor
 *   caso es no poder arrastrar hasta elegir, nunca una selección perdida.
 */
export function observeNativeFilePicker(
  input: HTMLInputElement,
  renderer: Renderer2,
  onChange: (open: boolean) => void,
): () => void {
  const stops = [
    renderer.listen(input, 'click', () => {
      if (!input.disabled) onChange(true);
    }),
    renderer.listen(input, 'change', () => onChange(false)),
    renderer.listen(input, 'cancel', () => onChange(false)),
    renderer.listen('window', 'focus', () => onChange(false)),
  ];
  return () => {
    for (const stop of stops) stop();
  };
}

/**
 * La misma observación, declarada sobre el propio `<input type="file">`.
 *
 * Quien lo contiene la lee con `viewChild(NativeFilePicker)` y consulta
 * `open()` en sus handlers de `dragover`/`drop`.
 */
@Directive({
  selector: 'input[type=file][appNativeFilePicker]',
  standalone: true,
  host: { '[class.is-picker-open]': 'open()' },
})
export class NativeFilePicker {
  private readonly state = signal(false);
  /** `true` mientras el diálogo del sistema está abierto. */
  readonly open = this.state.asReadonly();

  constructor() {
    const stop = observeNativeFilePicker(
      inject(ElementRef<HTMLInputElement>).nativeElement,
      inject(Renderer2),
      (open) => this.state.set(open),
    );
    inject(DestroyRef).onDestroy(stop);
  }
}
