import { TestBed } from '@angular/core/testing';

import { GlossaryTermCover, pictogramOfTags } from './glossary-term-cover';

describe('pictogramOfTags', () => {
  it('toma el pictograma de la primera etiqueta que tiene uno', () => {
    expect(
      pictogramOfTags([{ internalCode: 'glossary-tag-chronic' }, { internalCode: 'glossary-tag-respiratory' }]),
    ).toBe('respiratory');
  });

  it('urología usa el dibujo de los riñones', () => {
    expect(pictogramOfTags([{ internalCode: 'glossary-tag-urologic' }])).toBe('renal');
  });

  it('sin etiqueta con dibujo propio devuelve null', () => {
    expect(pictogramOfTags([{ internalCode: 'glossary-tag-chronic' }])).toBeNull();
    expect(pictogramOfTags([])).toBeNull();
  });
});

describe('GlossaryTermCover', () => {
  function montar(entradas: { category?: string; system?: 'respiratory' | null }) {
    const fixture = TestBed.createComponent(GlossaryTermCover);
    if (entradas.category !== undefined) fixture.componentRef.setInput('category', entradas.category);
    if (entradas.system !== undefined) fixture.componentRef.setInput('system', entradas.system);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja el sistema del cuerpo cuando el término tiene uno', () => {
    const el = montar({ category: 'glossary-category-disease', system: 'respiratory' });
    expect(el.querySelector('svg path')).not.toBeNull();
    expect(el.querySelector('app-glossary-category-icon')).toBeNull();
  });

  it('sin sistema, cae al ícono de la categoría: nunca queda vacía', () => {
    const el = montar({ category: 'glossary-category-disease', system: null });
    expect(el.querySelector('app-glossary-category-icon svg')).not.toBeNull();
  });

  it('es decorativa para el lector de pantalla y no se hace pasar por foto', () => {
    const el = montar({ category: 'glossary-category-disease' });
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.textContent).toContain('Ilustración de referencia');
    expect(el.querySelector('img')).toBeNull();
  });
});
