import { signal, type Signal } from '@angular/core';

/**
 * Fontanería de `ControlValueAccessor`, una sola vez.
 *
 * Los tres átomos que se enchufan a formularios necesitan exactamente lo mismo:
 * guardar los dos callbacks que registra Angular y recordar si el formulario
 * deshabilitó el control. Repetirlo en cada componente son tres copias de un
 * estado mutable fácil de desincronizar, y heredar de una clase base ataría los
 * componentes entre sí sin necesidad.
 *
 * Se compone en vez de heredarse: cada átomo tiene un puente propio y sigue
 * siendo dueño de su plantilla y de sus signals.
 */
export interface ValueAccessorBridge<T> {
  /**
   * Si el formulario deshabilitó el control.
   *
   * Va aparte del `input()` `disabled` del componente porque son dos fuentes
   * distintas —la plantilla y `FormControl.disable()`— y ninguna debe pisar a
   * la otra: el control queda deshabilitado si **cualquiera** de las dos lo pide.
   */
  readonly disabledByForm: Signal<boolean>;
  registerOnChange(fn: (value: T) => void): void;
  registerOnTouched(fn: () => void): void;
  setDisabledState(isDisabled: boolean): void;
  /** Avisa al formulario de un cambio hecho por la persona, nunca de uno propio. */
  emitChange(value: T): void;
  /** Avisa que la persona ya interactuó: habilita mostrar errores. */
  emitTouched(): void;
}

/**
 * Crea el puente. Los callbacks arrancan vacíos porque un control usado suelto
 * (con `[(value)]` y sin formulario) nunca los recibe, y llamarlos no debe
 * fallar.
 */
export function createValueAccessorBridge<T>(): ValueAccessorBridge<T> {
  const disabledByForm = signal(false);
  let onChange: (value: T) => void = () => undefined;
  let onTouched: () => void = () => undefined;

  return {
    disabledByForm: disabledByForm.asReadonly(),
    registerOnChange: (fn) => {
      onChange = fn;
    },
    registerOnTouched: (fn) => {
      onTouched = fn;
    },
    setDisabledState: (isDisabled) => disabledByForm.set(isDisabled),
    emitChange: (value) => onChange(value),
    emitTouched: () => onTouched(),
  };
}
