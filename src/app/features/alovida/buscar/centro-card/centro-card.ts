import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '@shared/components/atoms/nav-icon/nav-icon.types';

import { ATTRIBUTE_ICON, type CentroAtributo, type CentroTarjeta } from './centro-card.types';

/**
 * Una entidad de salud **en tarjeta con portada**.
 *
 * ## Por qué el directorio no usa `result-card`
 *
 * `result-card` describe un resultado de directorio genérico: figura de 56 px,
 * título, dos líneas de contexto. Sirve para comparar profesionales, donde lo
 * que decide es el nombre, la especialidad y el sello.
 *
 * Un centro de salud no se elige así. Se elige como se elige un lugar al que
 * hay que ir: mirando qué es, dónde queda y qué cara tiene. Con la tarjeta
 * genérica, cuarenta clínicas se ven exactamente iguales —una inicial gris y
 * dos renglones— y la única forma de distinguirlas es abrirlas de a una. Por
 * eso acá la foto ocupa el primer tercio de la tarjeta y los atributos van en
 * una fila que se barre de un vistazo, que es la forma que tienen los
 * directorios de lugares (el cliente la pidió por su nombre: «como InfoCasas»).
 *
 * ## Los cuatro verticales usan ESTA tarjeta (AC-06-2)
 *
 * Hospitales, laboratorios, aseguradoras y medicamentos. Antes eran tres
 * formas distintas —grilla con portada, lista de renglones y una tarjeta
 * propia sin imagen—, y la misma búsqueda cambiaba de aspecto según en qué
 * pestaña cayera. Lo que cambia entre verticales son **los datos de abajo** y
 * los botones del pie, no la anatomía.
 *
 * ## Imagen: lo que hay, y lo que no se inventa (AC-06-3)
 *
 * La portada y el logo salen de `coverUrl` y `avatarUrl` cuando la API los
 * sirve. Hoy no los sirve para casi nadie: ni el padrón de 642
 * establecimientos, ni el catálogo de 17 aseguradoras, ni la vitrina de
 * medicamentos traen una URL de imagen, y `directory.tenants` no tiene columna
 * de logo. La caída es el **degradado del tema con las iniciales**, no una
 * foto de archivo: una imagen de stock en la ficha de un hospital real afirma
 * algo falso sobre ese hospital, y la regla 00.8 lo prohíbe. De dónde salen
 * las fotos de verdad es P-06-2, y no se resuelve dibujando.
 *
 * ## Lo que no inventa
 *
 * Todo lo que pinta sale de la API, campo por campo. La maqueta de un portal
 * inmobiliario muestra además precio, superficie y antigüedad; el equivalente
 * en salud —precio de consulta, tiempo de espera, camas libres— la API **no lo
 * sirve**, así que la tarjeta lo omite en vez de rellenarlo. Un precio
 * inventado en un directorio de salud no es un pendiente de diseño: es alguien
 * que llega con Bs 200 a una consulta de Bs 350.
 *
 * ## Lo que proyecta
 *
 * El pie (`<ng-content>`): ahí van los botones que cada listado necesite —«Ver
 * ficha», «Cómo llegar», «Ver farmacias donde está disponible»— y el
 * desplegable `app-card-detail-panel`. Sin contenido proyectado, el pie no se
 * dibuja.
 */
@Component({
  selector: 'li[app-centro-card]',
  imports: [NavIcon, RouterLink],
  templateUrl: './centro-card.html',
  styleUrl: './centro-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El desplegable se mide contra este ancestro para no exceder el ancho de
    // la tarjeta (AC-06-6). Ver `card-detail-panel.types.ts`.
    '[attr.data-card-root]': '""',
  },
})
export class CentroCard {
  /** La entidad a pintar. */
  readonly centro = input.required<CentroTarjeta>();

  /** Qué glifo del set cerrado le toca a un atributo. */
  protected iconFor(atributo: CentroAtributo): NavIconName {
    return ATTRIBUTE_ICON[atributo.clave];
  }
}
