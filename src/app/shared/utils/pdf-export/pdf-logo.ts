/**
 * El logo del consultorio, tal como lo necesita el maquetador de PDF.
 *
 * `jsPDF` sólo dibuja PNG y JPEG, y necesita saber las proporciones para
 * contener la imagen en su caja sin estirarla. Todo eso se resuelve **antes**
 * de maquetar —`buildBlocksPdf` es síncrono y no puede esperar a una imagen—,
 * y este módulo es donde queda listo.
 */

/** Un logo listo para dibujar: siempre PNG o JPEG, con sus proporciones. */
export interface PdfLogo {
  /** La imagen como `data:` URL. */
  readonly dataUrl: string;
  readonly formato: 'PNG' | 'JPEG';
  /** Tamaño natural en píxeles. Sólo importa su proporción. */
  readonly ancho: number;
  readonly alto: number;
}

/** Lado mayor máximo al normalizar: un membrete no necesita más y el PDF no engorda. */
const LADO_MAXIMO_PX = 512;

/**
 * El logo con el que salen los documentos **por omisión**.
 *
 * Lo fija `PdfBrandingService` cuando conoce al profesional de la sesión, y así
 * los doce documentos que pasan por el maquetador lo llevan sin que cada uno
 * tenga que recibirlo. `options.logo` de cada documento lo pisa (`null` = sin
 * logo). Se limpia al cerrar sesión o cambiar de profesional: un logo que
 * sobrevive a su dueño saldría en el papel de otra persona.
 */
let logoVigente: PdfLogo | null = null;

export function establecerLogoDeDocumentos(logo: PdfLogo | null): void {
  logoVigente = logo;
}

export function logoDeDocumentos(): PdfLogo | null {
  return logoVigente;
}

/**
 * Deja una imagen cualquiera lista para el PDF: la decodifica, la reduce si es
 * enorme y la vuelve PNG.
 *
 * Pasa por un `canvas` a propósito: es lo que convierte WEBP y SVG —que `jsPDF`
 * no acepta— y lo que normaliza un JPEG con perfil raro. Sólo existe en el
 * navegador; bajo SSR o en una prueba devuelve `null` y el documento sale sin
 * logo, que es un resultado válido y no un error.
 *
 * **Nunca rechaza**: una imagen que no se puede leer no puede impedir que se
 * genere una receta.
 *
 * @param dataUrl - La imagen tal como llegó.
 * @returns El logo listo, o `null` si no se pudo preparar.
 */
export async function prepararLogo(dataUrl: string): Promise<PdfLogo | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  try {
    const imagen = await cargarImagen(dataUrl);
    const anchoNatural = imagen.naturalWidth || imagen.width;
    const altoNatural = imagen.naturalHeight || imagen.height;
    if (!(anchoNatural > 0) || !(altoNatural > 0)) {
      return null;
    }
    const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(anchoNatural, altoNatural));
    const ancho = Math.max(1, Math.round(anchoNatural * escala));
    const alto = Math.max(1, Math.round(altoNatural * escala));

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext('2d');
    if (contexto === null) {
      return null;
    }
    contexto.drawImage(imagen, 0, 0, ancho, alto);
    return { dataUrl: lienzo.toDataURL('image/png'), formato: 'PNG', ancho, alto };
  } catch {
    return null;
  }
}

/** Cuánto se espera a que decodifique: pasado eso, el documento sale sin logo. */
const ESPERA_MAXIMA_MS = 3000;

function cargarImagen(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const imagen = new Image();
    // Hay entornos donde `Image` existe y nunca dispara `load` ni `error`
    // (un DOM de prueba, un navegador sin decodificador): sin este tope la
    // promesa quedaría colgada para siempre.
    const espera = setTimeout(() => rechazar(new Error('logo sin respuesta')), ESPERA_MAXIMA_MS);
    imagen.onload = () => {
      clearTimeout(espera);
      resolver(imagen);
    };
    imagen.onerror = () => {
      clearTimeout(espera);
      rechazar(new Error('logo ilegible'));
    };
    imagen.src = dataUrl;
  });
}

/**
 * Cómo entra un logo en su caja: contenido, centrado en vertical y pegado al
 * borde derecho. Nunca se estira ni se sale.
 *
 * Es aritmética pura y vive acá para poder probarla sin dibujar nada.
 *
 * @returns Ancho y alto finales en puntos, y el desplazamiento vertical desde
 *   el borde superior de la caja.
 */
export function contenerLogo(
  logo: Pick<PdfLogo, 'ancho' | 'alto'>,
  caja: { readonly ancho: number; readonly alto: number },
): { readonly ancho: number; readonly alto: number; readonly arriba: number } | null {
  if (!(logo.ancho > 0) || !(logo.alto > 0)) {
    return null;
  }
  const escala = Math.min(caja.ancho / logo.ancho, caja.alto / logo.alto);
  const ancho = logo.ancho * escala;
  const alto = logo.alto * escala;
  return { ancho, alto, arriba: (caja.alto - alto) / 2 };
}
