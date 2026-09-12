import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { StickerPicker } from './sticker-picker';
import { PACK_DE_STICKERS } from '../../../../../core/messaging/sticker-pack.generated';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el pack **se manda al tocarlo** —un sticker es el mensaje, no parte de
 * uno—, que cada uno se anuncia por lo que dice y no por su archivo, y que la
 * atribución de CC BY-SA 4.0 está a la vista: la licencia de las ilustraciones
 * la exige, y una atribución que sólo vive en un archivo del repositorio no la
 * cumple.
 */
describe('StickerPicker', () => {
  let fixture: ComponentFixture<StickerPicker>;

  const stickers = (): HTMLElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="composer-sticker"]'),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [StickerPicker] });
    fixture = TestBed.createComponent(StickerPicker);
    fixture.detectChanges();
  });

  it('muestra el pack entero', () => {
    expect(stickers().length).toBe(PACK_DE_STICKERS.length);
    expect(PACK_DE_STICKERS.length).toBeGreaterThanOrEqual(24);
  });

  it('cada sticker se anuncia por lo que dice', () => {
    expect(stickers()[0]?.getAttribute('aria-label')).toBe(
      `Enviar sticker: ${PACK_DE_STICKERS[0].nombre}`,
    );
    expect(stickers()[0]?.querySelector('img')?.getAttribute('alt')).toBe(
      PACK_DE_STICKERS[0].nombre,
    );
  });

  it('lo emite al tocarlo, sin previsualización', () => {
    let elegido = '';
    fixture.componentInstance.elegido.subscribe((s) => (elegido = s.id));

    stickers()[0]?.click();

    expect(elegido).toBe(PACK_DE_STICKERS[0].id);
  });

  it('muestra la atribución que la licencia exige', () => {
    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('OpenMoji');
    expect(texto).toContain('CC BY-SA 4.0');
  });

  it('los identificadores del pack son fijos y únicos', () => {
    // No se derivan de nada: son los uuids con los que el backend siembra el
    // pack. Si se generaran, un sticker mandado en un entorno no se entendería
    // en otro.
    const ids = new Set(PACK_DE_STICKERS.map((s) => s.id));
    expect(ids.size).toBe(PACK_DE_STICKERS.length);
    for (const sticker of PACK_DE_STICKERS) {
      expect(sticker.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
      );
    }
  });
});
