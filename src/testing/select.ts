/* ============================================================================
    Manejar un `app-select` desde una prueba.

    `app-select` ya no envuelve un `<select>` nativo: el campo es un botón que
    abre un `<dialog>` con la lista (ver `atoms/select/select.ts`). Estas
    funciones hacen lo que haría la persona —tocar el campo, tocar la opción—,
    así las pruebas no dependen de cómo está armado por dentro.

    `host` es el elemento `app-select` o cualquier ancestro que contenga uno
    solo (por ejemplo, el `[data-testid]` que le pone la pantalla).
    ========================================================================== */

/** Lo mínimo de un fixture que hace falta: estabilizar después de cada toque. */
interface Estabilizable {
  whenStable(): Promise<unknown>;
  detectChanges?(): void;
}

function hostDe(host: Element): Element {
  if (host.matches('app-select')) {
    return host;
  }
  const dentro = host.querySelector('app-select');
  if (!dentro) {
    throw new Error('No hay ningún app-select dentro del elemento dado.');
  }
  return dentro;
}

/** El botón que abre la lista. */
export function selectTrigger(host: Element): HTMLButtonElement {
  const boton = hostDe(host).querySelector<HTMLButtonElement>('.select-trigger');
  if (!boton) {
    throw new Error('El app-select no tiene su botón .select-trigger.');
  }
  return boton;
}

/** El texto que muestra el campo: la opción elegida o el placeholder. */
export function selectShownLabel(host: Element): string {
  return hostDe(host).querySelector('.select-value')?.textContent?.trim() ?? '';
}

/** Si el campo muestra una opción elegida y no el placeholder. */
export function selectHasValue(host: Element): boolean {
  const valor = hostDe(host).querySelector('.select-value');
  return valor !== null && !valor.classList.contains('is-placeholder');
}

async function estabilizar(fixture: Estabilizable): Promise<void> {
  fixture.detectChanges?.();
  await fixture.whenStable();
}

async function abrir(fixture: Estabilizable, host: Element): Promise<Element> {
  const real = hostDe(host);
  if (!real.querySelector('dialog')) {
    selectTrigger(real).click();
    await estabilizar(fixture);
  }
  return real;
}

async function cerrar(fixture: Estabilizable, real: Element): Promise<void> {
  const dialogo = real.querySelector('dialog');
  if (dialogo) {
    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await estabilizar(fixture);
  }
}

function filas(real: Element): HTMLElement[] {
  return Array.from(real.querySelectorAll<HTMLElement>('[role="option"]'));
}

/** Los rótulos de las opciones, en orden. Abre la lista y la vuelve a cerrar. */
export async function selectOptionLabels(
  fixture: Estabilizable,
  host: Element,
): Promise<string[]> {
  const real = await abrir(fixture, host);
  const rotulos = filas(real).map(
    (fila) => fila.querySelector('.option-label')?.textContent?.trim() ?? '',
  );
  await cerrar(fixture, real);
  return rotulos;
}

/** Las opciones deshabilitadas, por rótulo. Abre la lista y la vuelve a cerrar. */
export async function selectDisabledLabels(
  fixture: Estabilizable,
  host: Element,
): Promise<string[]> {
  const real = await abrir(fixture, host);
  const rotulos = filas(real)
    .filter((fila) => fila.getAttribute('aria-disabled') === 'true')
    .map((fila) => fila.querySelector('.option-label')?.textContent?.trim() ?? '');
  await cerrar(fixture, real);
  return rotulos;
}

/**
 * Elige una opción como lo haría la persona: abre el modal y toca la fila.
 * `opcion` es el rótulo exacto o la posición en la lista completa.
 */
export async function chooseSelectOption(
  fixture: Estabilizable,
  host: Element,
  opcion: string | number,
): Promise<void> {
  const real = await abrir(fixture, host);
  const todas = filas(real);
  const fila =
    typeof opcion === 'number'
      ? todas[opcion]
      : todas.find(
          (candidata) => candidata.querySelector('.option-label')?.textContent?.trim() === opcion,
        );
  if (!fila) {
    const hay = todas.map((candidata) => candidata.textContent?.trim()).join(' | ');
    throw new Error(`No hay opción «${String(opcion)}» en el app-select. Hay: ${hay}`);
  }
  fila.click();
  await estabilizar(fixture);
}

/* ----------------------------------------------------------------------------
   Variantes síncronas, para pruebas que ya avanzan con `detectChanges()` y no
   esperan `whenStable()` (por ejemplo, con peticiones HTTP de prueba abiertas
   o con una cadena de pasos que cada prueba repite). Hacen exactamente lo
   mismo que las de arriba: tocar el campo, leer o tocar la fila, cerrar.
   -------------------------------------------------------------------------- */

/** Lo mínimo de un fixture para la variante síncrona. */
interface Detectable {
  detectChanges(): void;
}

function abrirAhora(fixture: Detectable, host: Element): Element {
  const real = hostDe(host);
  if (!real.querySelector('dialog')) {
    selectTrigger(real).click();
    fixture.detectChanges();
  }
  return real;
}

function cerrarAhora(fixture: Detectable, real: Element): void {
  const dialogo = real.querySelector('dialog');
  if (dialogo) {
    dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
  }
}

/** Como {@link selectOptionLabels}, sin esperar a que la página se estabilice. */
export function selectOptionLabelsNow(fixture: Detectable, host: Element): string[] {
  const real = abrirAhora(fixture, host);
  const rotulos = filas(real).map(
    (fila) => fila.querySelector('.option-label')?.textContent?.trim() ?? '',
  );
  cerrarAhora(fixture, real);
  return rotulos;
}

/** Como {@link chooseSelectOption}, sin esperar a que la página se estabilice. */
export function chooseSelectOptionNow(
  fixture: Detectable,
  host: Element,
  opcion: string | number,
): void {
  const real = abrirAhora(fixture, host);
  const todas = filas(real);
  const fila =
    typeof opcion === 'number'
      ? todas[opcion]
      : todas.find(
          (candidata) => candidata.querySelector('.option-label')?.textContent?.trim() === opcion,
        );
  if (!fila) {
    const hay = todas.map((candidata) => candidata.textContent?.trim()).join(' | ');
    cerrarAhora(fixture, real);
    throw new Error(`No hay opción «${String(opcion)}» en el app-select. Hay: ${hay}`);
  }
  fila.click();
  fixture.detectChanges();
}
