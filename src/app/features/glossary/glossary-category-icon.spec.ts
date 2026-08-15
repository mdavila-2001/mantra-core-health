import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  GLOSSARY_CATEGORY_ORDER,
  glossaryCategoryOrder,
  GlossaryCategoryIcon,
  isGlossaryCategoryCode,
} from './glossary-category-icon';

/**
 * El ícono de categoría, y las dos funciones puras que lo acompañan.
 *
 * Lo único que se afirma del componente es que **siempre** dibuja un único
 * `<svg>`, sea la categoría que sea: las 11 formas concretas no se listan acá
 * adentro una por una (eso lo prueba la vista), lo que importa es que ninguna
 * categoría deje el ícono vacío ni rompa con dos svg a la vez.
 */
describe('GlossaryCategoryIcon', () => {
  let fixture: ComponentFixture<GlossaryCategoryIcon>;

  function svgCount(): number {
    return (fixture.nativeElement as HTMLElement).querySelectorAll('svg').length;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GlossaryCategoryIcon] }).compileComponents();
    fixture = TestBed.createComponent(GlossaryCategoryIcon);
  });

  it('cada una de las 11 categorías dibuja exactamente un svg', async () => {
    for (const categoria of GLOSSARY_CATEGORY_ORDER) {
      fixture.componentRef.setInput('category', categoria);
      await fixture.whenStable();
      expect(svgCount(), categoria).toBe(1);
    }
  });

  it('una categoría desconocida cae en el ícono genérico, no en uno vacío', async () => {
    fixture.componentRef.setInput('category', 'glossary-category-inventada');
    await fixture.whenStable();

    expect(svgCount()).toBe(1);
  });

  it('el host se anuncia decorativo: el nombre accesible lo da el texto de al lado', () => {
    expect((fixture.nativeElement as HTMLElement).getAttribute('aria-hidden')).toBe('true');
  });
});

describe('isGlossaryCategoryCode', () => {
  it('reconoce las 11 categorías del glosario', () => {
    for (const categoria of GLOSSARY_CATEGORY_ORDER) {
      expect(isGlossaryCategoryCode(categoria)).toBe(true);
    }
  });

  it('rechaza un value set que no es una categoría del glosario', () => {
    // `condition-code` es un conjunto de valores real del catálogo, pero no una
    // de las 11 categorías: es exactamente el caso que este filtro existe para
    // sacar de la grilla.
    expect(isGlossaryCategoryCode('condition-code')).toBe(false);
    expect(isGlossaryCategoryCode('glossary-tag-cardiovascular')).toBe(false);
  });
});

describe('glossaryCategoryOrder', () => {
  it('respeta el orden declarado de la grilla', () => {
    expect(glossaryCategoryOrder('glossary-category-anatomy')).toBe(0);
    expect(glossaryCategoryOrder('glossary-category-care')).toBe(
      GLOSSARY_CATEGORY_ORDER.length - 1,
    );
  });

  it('una categoría desconocida se va al final, no rompe el orden de las demás', () => {
    expect(glossaryCategoryOrder('inventada')).toBe(GLOSSARY_CATEGORY_ORDER.length);
  });
});
