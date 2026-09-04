import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SearchResult } from './search-result';
import type { SearchResultItem } from './search-result.types';

/**
 * Lo que estas pruebas fijan.
 *
 * El diseño de esta tarjeta **no vive acá**: vive en la maqueta
 * `V65-buscador/publico/` y en `redsat.css` §25. Así que no se comprueba que se
 * vea bien —eso lo decide el CSS— sino que el **marcado sea el de la maqueta**:
 * las clases exactas, la semántica de lista y qué partes desaparecen cuando el
 * dato no viene.
 *
 * Es la diferencia entre una prueba que protege el diseño y una que lo
 * congela: si mañana el diseñador cambia un color, estas pruebas siguen
 * pasando; si alguien renombra `.app-resultado__cuerpo`, se rompen.
 */
@Component({
  imports: [SearchResult],
  template: `
    <ul class="app-resultado-lista">
      <li app-search-result [resultado]="dato()">
        @if (conLado()) {
          <div class="app-resultado__lado">
            <span class="app-resultado__precio">Bs 250<small>consulta</small></span>
          </div>
        }
      </li>
    </ul>
  `,
})
class Anfitrion {
  readonly conLado = signal(false);
  readonly dato = signal<SearchResultItem>({
    id: 'r-1',
    title: 'Dra. Marisol Quispe Ticona',
    link: '/buscar/perfil-profesional-detalle',
  });
}

describe('SearchResult', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  const elemento = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  const todos = (selector: string): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll(selector));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * El host es un `<li>` con la clase de la maqueta. Es lo que hace que un
   * lector de pantalla anuncie «lista de 12 elementos» antes del primero: un
   * `<div>` con la misma pinta no dice cuántos resultados hay.
   */
  it('es un `li` con la clase de la maqueta', () => {
    const host = elemento('li');

    expect(host).not.toBeNull();
    expect(host!.classList.contains('app-resultado')).toBe(true);
    expect(host!.parentElement!.classList.contains('app-resultado-lista')).toBe(true);
  });

  it('pinta el título como enlace de la aplicación', () => {
    const titulo = elemento('.app-resultado__titulo');
    const enlace = titulo!.querySelector('a')!;

    expect(enlace.textContent!.trim()).toBe('Dra. Marisol Quispe Ticona');
    expect(enlace.getAttribute('href')).toBe('/buscar/perfil-profesional-detalle');
  });

  // ─── Lo que desaparece cuando no hay dato ──────────────────────────────────

  /**
   * Con lo mínimo, la tarjeta **no deja huecos**. Un `<p>` vacío de líneas de
   * contexto o una columna derecha sin cifra dejan espacio en blanco que en la
   * maqueta no existe, y en una lista de veinte resultados se nota.
   */
  it('sin líneas ni sellos no deja los contenedores vacíos', () => {
    expect(elemento('.app-resultado__meta')).toBeNull();
    expect(elemento('.app-resultado__sellos')).toBeNull();
  });

  /**
   * La columna derecha se **proyecta**: cambia por completo entre los seis
   * listados y casi siempre lleva un botón. La tarjeta la coloca en su tercera
   * columna sin saber qué trae.
   */
  it('la columna derecha se proyecta y queda dentro de la tarjeta', () => {
    expect(elemento('.app-resultado__lado')).toBeNull();

    anfitrion.conLado.set(true);
    fixture.detectChanges();

    const lado = elemento('.app-resultado__lado')!;
    expect(lado.parentElement!.classList.contains('app-resultado')).toBe(true);
    expect(lado.querySelector('.app-resultado__precio')!.textContent).toContain('Bs 250');
  });

  // ─── Figura: imagen o iniciales, nunca las dos ─────────────────────────────

  /**
   * La figura es decorativa: el nombre ya está en el título, y anunciar «MQ»
   * después de «Dra. Marisol Quispe Ticona» es ruido para quien escucha.
   */
  it('la figura queda fuera del árbol accesible', () => {
    anfitrion.dato.update((d) => ({ ...d, figureText: 'MQ' }));
    fixture.detectChanges();

    const figura = elemento('.app-resultado__figura')!;
    expect(figura.getAttribute('aria-hidden')).toBe('true');
    expect(figura.textContent!.trim()).toBe('MQ');
  });

  it('la imagen gana sobre las iniciales y va con alt vacío', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      figureText: 'MQ',
      figureImageUrl: '/f/foto.jpg',
    }));
    fixture.detectChanges();

    const img = elemento('.app-resultado__figura img')!;
    expect(img.getAttribute('src')).toBe('/f/foto.jpg');
    expect(img.getAttribute('alt')).toBe('');
    expect(elemento('.app-resultado__figura')!.textContent!.trim()).toBe('');
  });

  /**
   * FND-04 (carril 02): una `figureImageUrl` que responde 422/404 —una foto
   * sembrada cuya versión no pasó el escaneo de malware, reproducido contra el
   * directorio real— no puede dejar un ícono de imagen rota. Cae al mismo
   * `figureText` que ya pinta cuando no hay foto.
   */
  it('cuando la imagen falla, cae a las iniciales en vez de quedar rota', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      figureText: 'MQ',
      figureImageUrl: '/f/rota.jpg',
    }));
    fixture.detectChanges();

    elemento('.app-resultado__figura img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(elemento('.app-resultado__figura img')).toBeNull();
    expect(elemento('.app-resultado__figura')!.textContent!.trim()).toBe('MQ');
  });

  // ─── Insignias: el tono va como en la maqueta ──────────────────────────────

  /**
   * `data-tono` y no una clase de color: es el atributo con el que
   * `redsat.css` selecciona (`.app-badge[data-tono="ok"]`). Con una clase
   * inventada la insignia se vería sin color y nadie sabría por qué.
   */
  it('el tipo y los sellos usan .app-badge con data-tono', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      kind: { label: 'Profesional', tone: 'info' },
      seals: [
        { label: 'Matrícula verificada', tone: 'ok' },
        { label: 'Espacio pagado', tone: 'neutro' },
      ],
    }));
    fixture.detectChanges();

    const tipo = elemento('.app-resultado__titulo .app-badge')!;
    expect(tipo.getAttribute('data-tono')).toBe('info');
    expect(tipo.textContent!.trim()).toBe('Profesional');

    const sellos = todos('.app-resultado__sellos .app-badge');
    expect(sellos.length).toBe(2);
    expect(sellos[0]!.getAttribute('data-tono')).toBe('ok');
    expect(sellos[1]!.textContent!.trim()).toBe('Espacio pagado');
  });

  it('las líneas de contexto salen en el orden en que vinieron', () => {
    anfitrion.dato.update((d) => ({
      ...d,
      meta: [
        { text: 'Cardiología · 14 años' },
        { text: 'Clínica Los Olivos' },
        { text: 'Sopocachi · 1,2 km' },
      ],
    }));
    fixture.detectChanges();

    const lineas = todos('.app-resultado__meta span').map((s) => s.textContent!.trim());
    expect(lineas).toEqual(['Cardiología · 14 años', 'Clínica Los Olivos', 'Sopocachi · 1,2 km']);
  });
});
