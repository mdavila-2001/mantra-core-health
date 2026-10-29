import type { PinMap } from './map-pin.types';

/**
 * El contenido del popup, armado con DOM propio: Leaflet vive fuera del
 * template de Angular, así que acá no hay proyección de contenido — el CTA
 * entra como etiqueta y sale como callback. Todo texto va por `textContent`:
 * los nombres vienen de datos y jamás se interpolan como HTML.
 */
export function construirPopup(
  documento: Document,
  pin: PinMap,
  alElegir: () => void,
): HTMLElement {
  const caja = documento.createElement('div');
  caja.className = 'mapa__popup';

  const titulo = documento.createElement('strong');
  titulo.className = 'mapa__popup-titulo';
  titulo.textContent = pin.titulo;
  caja.appendChild(titulo);

  if (pin.estado !== undefined) {
    const estado = documento.createElement('span');
    estado.className = `mapa__popup-estado mapa__popup-estado--${pin.estado.tono}`;
    estado.textContent = pin.estado.etiqueta;
    caja.appendChild(estado);
  }

  if (pin.subtitulo !== undefined) {
    const detalle = documento.createElement('p');
    detalle.className = 'mapa__popup-detalle';
    detalle.textContent = pin.subtitulo;
    caja.appendChild(detalle);
  }

  if (pin.ctaEtiqueta !== undefined) {
    const cta = documento.createElement('button');
    cta.type = 'button';
    cta.className = 'mapa__popup-cta';
    cta.textContent = pin.ctaEtiqueta;
    cta.addEventListener('click', alElegir);
    caja.appendChild(cta);
  }

  return caja;
}

/** «Farmacia Central · Sede Centro, Tiene todo, 1,2 km en línea recta»: lo que dice el pin enfocado. */
export function pinAccessibleName(pin: PinMap): string {
  return [pin.titulo, pin.estado?.etiqueta, pin.subtitulo]
    .filter((parte): parte is string => parte !== undefined && parte !== '')
    .join(', ');
}
