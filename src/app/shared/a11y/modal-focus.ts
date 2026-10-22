/**
 * Las dos piezas de un modal que **no** puede ser un `<dialog>` nativo.
 *
 * `showModal()` da gratis la trampa de foco y la inertización del fondo, y es
 * lo primero que se usa (`app-content-dialog`, `molecules/dialog`). Pero hay
 * capas que no entran en la capa superior del navegador sin cambiar lo que
 * son: la hoja de contacto del chat se apoya en el hilo y deja la bandeja a la
 * vista, y el globo del tutorial convive con el elemento que señala, que en los
 * pasos de clic **tiene** que seguir siendo tocable. Para esas quedan estas dos
 * funciones, que reproducen lo mismo a mano:
 *
 * - {@link trapTabKey}: `Tab` y `Shift+Tab` dan la vuelta dentro de la capa en
 *   vez de salir a la página de atrás (WCAG 2.4.3, orden del foco).
 * - {@link inertBackground}: lo de atrás queda `inert` —ni foco, ni clic, ni
 *   lector de pantalla—, que es lo que promete `aria-modal="true"`.
 */

/** Lo que puede recibir foco con `Tab`. Mismo criterio que el cajón del armazón. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Los elementos tabulables dentro de `containers`, en el orden en que se dan.
 *
 * Se descartan los que no ocupan lugar (`getClientRects()` vacío: un control
 * con `display: none` o dentro de algo oculto sigue en el DOM y mandaría el
 * foco a la nada) y los que están dentro de algo `inert`. En jsdom nada tiene
 * layout, así que ahí el filtro de tamaño no se aplica: sin él las pruebas no
 * encontrarían ningún control.
 */
export function focusableWithin(...containers: readonly (Element | null | undefined)[]): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (const container of containers) {
    if (!container) continue;
    const candidates: HTMLElement[] = [];
    if (container instanceof HTMLElement && container.matches(FOCUSABLE_SELECTOR)) {
      candidates.push(container);
    }
    candidates.push(...Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)));
    for (const candidate of candidates) {
      if (candidate.closest('[inert]') !== null) continue;
      if (hasLayoutEngine(candidate) && candidate.getClientRects().length === 0) continue;
      if (!found.includes(candidate)) found.push(candidate);
    }
  }
  return found;
}

/**
 * Da la vuelta al `Tab` dentro de la capa.
 *
 * Se llama desde el `keydown` de la capa (o del documento). No hace nada con
 * otra tecla. Si el foco está fuera de lo permitido —en el contenedor mismo,
 * que suele tener `tabindex="-1"` para recibir el foco inicial—, `Tab` va al
 * primero y `Shift+Tab` al último.
 *
 * @returns `true` si movió el foco (y consumió el evento).
 */
export function trapTabKey(event: KeyboardEvent, ...containers: readonly (Element | null | undefined)[]): boolean {
  if (event.key !== 'Tab') return false;
  const focusables = focusableWithin(...containers);
  if (focusables.length === 0) {
    // Nada que recorrer: el foco se queda donde está en vez de escaparse.
    event.preventDefault();
    return true;
  }
  const active = (event.target instanceof Node ? event.target.ownerDocument : document)?.activeElement ?? null;
  const index = active instanceof HTMLElement ? focusables.indexOf(active) : -1;
  const last = focusables.length - 1;

  let next: number | null;
  if (index === -1) {
    next = event.shiftKey ? last : 0;
  } else if (event.shiftKey) {
    next = index === 0 ? last : null;
  } else {
    next = index === last ? 0 : null;
  }
  if (next === null) {
    // Dentro y sin llegar a un borde: el navegador sabe el orden mejor que
    // nadie, así que se lo deja avanzar solo.
    return false;
  }
  event.preventDefault();
  focusables[next]?.focus();
  return true;
}

/**
 * Deja inerte todo lo que no sea `layer` ni la contenga, y devuelve cómo
 * deshacerlo.
 *
 * Sube desde la capa hasta `<body>` y marca `inert` a los **hermanos** de cada
 * eslabón: así queda viva sólo la rama que lleva a la capa, sin tener que
 * saber cómo está armado el armazón. Sólo se tocan los que no eran ya inertes,
 * y sólo ésos se restauran: si otra capa había inertizado algo antes, sigue
 * igual al cerrar esta.
 *
 * Las regiones vivas (`aria-live`, `role="status"`, `role="alert"`) no se
 * tocan: un elemento inerte sale del árbol de accesibilidad y el aviso que
 * aparezca ahí —«Reenviado a …», un toast— no se oiría.
 */
export function inertBackground(layer: HTMLElement): () => void {
  const touched: Element[] = [];
  let branch: Element | null = layer;
  while (branch !== null && branch.parentElement !== null) {
    const parent: Element = branch.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === branch || sibling.hasAttribute('inert') || isLiveRegion(sibling)) continue;
      if (sibling.tagName === 'SCRIPT' || sibling.tagName === 'STYLE') continue;
      sibling.setAttribute('inert', '');
      touched.push(sibling);
    }
    if (parent.tagName === 'BODY') break;
    branch = parent;
  }
  return () => {
    for (const sibling of touched) sibling.removeAttribute('inert');
    touched.length = 0;
  };
}

function isLiveRegion(el: Element): boolean {
  const role = el.getAttribute('role');
  return el.hasAttribute('aria-live') || role === 'status' || role === 'alert' || role === 'log';
}

/**
 * Si el documento calcula layout. jsdom devuelve rectángulos vacíos para todo,
 * y descartar por tamaño ahí dejaría la lista vacía.
 */
function hasLayoutEngine(el: HTMLElement): boolean {
  const view = el.ownerDocument.defaultView;
  return !(view?.navigator.userAgent ?? '').includes('jsdom');
}
