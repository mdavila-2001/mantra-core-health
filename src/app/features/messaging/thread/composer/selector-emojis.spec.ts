import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SelectorEmojis } from './selector-emojis';
import { GRUPOS_DE_EMOJIS } from './emoji-catalog.generated';
import { ChatPreferencias } from '../../../../core/messaging/chat-preferencias';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el catálogo **se busca en castellano** —«jeringa» encuentra 💉, con tilde
 * o sin ella—, que Salud sigue siendo la primera pestaña y que un emoji del
 * catálogo llega con su nombre como rótulo accesible. Antes eran 150 emojis sin
 * nombre: lo que no estuviera en la lista no existía, y un lector de pantalla
 * sólo podía decir «Insertar 💉».
 */
describe('SelectorEmojis', () => {
  let fixture: ComponentFixture<SelectorEmojis>;

  const emojis = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="composer-emoji"]'),
    );

  const buscar = (texto: string): void => {
    const campo = fixture.nativeElement.querySelector(
      '[data-testid="emojis-buscar"]',
    ) as HTMLInputElement;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SelectorEmojis] });
    // Sin recientes: la pestaña de recientes no existe hasta que se usa una.
    TestBed.inject(ChatPreferencias).emojisRecientes.set([]);
    fixture = TestBed.createComponent(SelectorEmojis);
    fixture.detectChanges();
  });

  it('trae un catálogo grande, no una lista escrita a mano', () => {
    const total = GRUPOS_DE_EMOJIS.reduce(
      (suma, grupo) => suma + grupo.emojis.length,
      0,
    );
    expect(total).toBeGreaterThan(1500);
  });

  it('abre en Salud: es lo que se manda en un chat de salud', () => {
    expect(GRUPOS_DE_EMOJIS[0].clave).toBe('salud');
    expect(
      fixture.nativeElement.querySelector('[data-testid="emojis-rotulo"]')
        ?.textContent,
    ).toContain('Salud');
    expect(emojis().map((b) => b.textContent?.trim())).toContain('💉');
  });

  it('encuentra por nombre en castellano', () => {
    buscar('jeringa');

    expect(emojis()[0]?.textContent?.trim()).toBe('💉');
  });

  it('encuentra sin tildes lo que se llama con tilde', () => {
    buscar('corazon');

    const encontrados = emojis().map((b) => b.textContent?.trim());
    expect(encontrados.length).toBeGreaterThan(0);
    expect(encontrados).toContain('❤️');
  });

  it('cada emoji se anuncia con su nombre, no con su símbolo', () => {
    buscar('jeringa');

    // CLDR lo nombra «jeringuilla» y «jeringa» es una de sus palabras de
    // búsqueda: se encuentra por las dos y se anuncia por su nombre. El nombre
    // sale de la fuente tal cual — traducirlo acá sería inventarlo.
    expect(emojis()[0]?.getAttribute('aria-label')).toBe('jeringuilla');
  });

  it('dice cuántos encontró, y lo dice también cuando no encontró nada', () => {
    buscar('jeringa');
    const rotulo = (): string =>
      fixture.nativeElement.querySelector('[data-testid="emojis-rotulo"]')
        ?.textContent ?? '';
    expect(rotulo()).toContain('encontrado');

    buscar('zzzzzz');
    expect(emojis().length).toBe(0);
    expect(rotulo()).toContain('Sin emojis');
  });

  it('mientras se busca no se ofrecen pestañas: la rejilla ya no es un grupo', () => {
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="emojis-categoria"]').length,
    ).toBeGreaterThan(0);

    buscar('gato');

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="emojis-categoria"]').length,
    ).toBe(0);
  });

  it('elegir uno lo emite y lo recuerda', () => {
    const preferencias = TestBed.inject(ChatPreferencias);
    let elegido = '';
    fixture.componentInstance.elegido.subscribe((emoji) => (elegido = emoji));

    buscar('jeringa');
    emojis()[0]?.click();

    expect(elegido).toBe('💉');
    expect(preferencias.emojisRecientes()).toContain('💉');
  });

  it('no recorta el resultado a una sola pantalla ni lo deja sin tope', () => {
    // Con una letra frecuente coinciden cientos; se muestra un tope para no
    // dibujar mil botones por tecleo.
    buscar('a');

    expect(emojis().length).toBeGreaterThan(10);
    expect(emojis().length).toBeLessThanOrEqual(90);
  });
});
