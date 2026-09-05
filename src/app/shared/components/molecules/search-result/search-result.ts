import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppButtonLink } from '../../atoms/button/button-link';

import type { SearchResultItem } from './search-result.types';

/**
 * Un resultado del buscador público.
 *
 * Es la tarjeta que repiten las **seis pantallas de listado** de V65 —la
 * portada, profesionales, medicamentos, hospitales, laboratorios y
 * aseguradoras— y la más vista de toda la superficie sin sesión.
 *
 * ## De dónde sale el diseño
 *
 * De la maqueta: `SALUD/Vistas/HTML/V65-buscador/publico/` y
 * `_assets/redsat.css` §25. El marcado y las clases son **los de la maqueta**,
 * no una reinterpretación — por eso el componente no trae CSS propio: lo estila
 * `src/styles/redsat.css`, que ya está en `angular.json` y es el mismo archivo
 * que usan las 141 pantallas portadas.
 *
 * Escribirle estilos acá lo separaría de la maqueta en la primera corrección
 * que alguien haga del lado del diseño.
 *
 * ## Por qué es de host `li`
 *
 * La maqueta lo dibuja como `<li class="app-resultado">` dentro de
 * `<ul class="app-resultado-lista">`, y esa semántica es la que hace que un
 * lector de pantalla anuncie «lista de 12 elementos» antes de leer el primero.
 * Un `<div>` con la misma pinta no dice cuántos resultados hay.
 *
 * ## Lo que este componente no hace
 *
 * **No conoce el dominio.** Las seis pantallas pintan la misma tarjeta con
 * datos de módulos distintos; que hablara de un perfil o de un medicamento
 * obligaría a una tarjeta por módulo. Quien la usa traduce lo suyo a
 * {@link SearchResultItem}.
 *
 * **No dibuja la columna derecha.** `.app-resultado__lado` cambia por completo
 * entre los seis listados —precio y disponibilidad en profesionales, stock y
 * farmacia en medicamentos, distancia en hospitales—, y casi siempre lleva un
 * botón. Modelarla habría dado un tipo con seis campos opcionales de los que
 * cada pantalla usa dos. Se **proyecta**: quien usa la tarjeta escribe su
 * `<div class="app-resultado__lado">` y pone lo que su dominio necesita.
 *
 * **No trae los iconos de las líneas de contexto.** La maqueta usa uno distinto
 * por tipo de dato —especialidad, dirección, distancia, idioma— y elegirlo
 * exige saber qué significa cada línea. `SearchResultMeta.iconKey` deja
 * declarada la intención para cuando el banco tenga su registro de iconos;
 * hoy la línea se pinta sin él antes que con el equivocado.
 */
@Component({
  selector: 'li[app-search-result]',
  imports: [AppButtonLink, RouterLink],
  templateUrl: './search-result.html',
  styleUrl: './search-result.css',
  host: { class: 'app-resultado' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResult {
  /** El resultado a pintar. */
  readonly resultado = input.required<SearchResultItem>();

  /**
   * Igual que `ResultCard.imagenFallo` — el hermano vertical de esta tarjeta—:
   * `linkedSignal` sobre la fuente, no `signal` + `set`, así una fila que el
   * `@for` reutiliza al pasar de página con una foto nueva tiene su propia
   * oportunidad. Sin esto, una `figureImageUrl` cuya versión no pasó el escaneo
   * de malware (422 real, reproducido contra el directorio) dejaba un ícono de
   * imagen rota en vez de caer a `figureText`.
   */
  protected readonly imagenFallo = linkedSignal({
    source: this.resultado,
    computation: () => false,
  });

  protected readonly mostrarImagen = computed(
    () => Boolean(this.resultado().figureImageUrl) && !this.imagenFallo(),
  );

  protected manejarErrorDeImagen(): void {
    this.imagenFallo.set(true);
  }
}
