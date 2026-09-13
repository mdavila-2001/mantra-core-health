import { TestBed } from '@angular/core/testing';

import { PublicProfilePager } from './public-profile-pager';

/**
 * Anterior / siguiente de las listas de la ficha pública: la misma lógica que
 * el carrusel de imágenes de una publicación.
 */
describe('PublicProfilePager', () => {
  function crear(total: number, pageSize: number, page = 0) {
    const fixture = TestBed.createComponent(PublicProfilePager);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('pageSize', pageSize);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('testId', 'p');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const boton = (cual: 'previous' | 'next') =>
      el.querySelector<HTMLButtonElement>(`[data-testid="p-${cual}"]`);
    const contador = () => el.querySelector('[data-testid="p-counter"]')?.textContent?.trim();
    return { fixture, el, boton, contador };
  }

  it('con una sola página no dibuja nada', () => {
    const { el } = crear(3, 3);
    expect(el.querySelector('nav')).toBeNull();
  });

  it('en la primera página, «anterior» está deshabilitado y el contador dice 1 de N', () => {
    const { boton, contador } = crear(7, 3);
    expect(boton('previous')!.disabled).toBe(true);
    expect(boton('next')!.disabled).toBe(false);
    expect(contador()).toBe('1 de 3');
  });

  it('«siguiente» avanza y en la última página se deshabilita, sin dar la vuelta', () => {
    const { fixture, boton, contador } = crear(7, 3);
    boton('next')!.click();
    fixture.detectChanges();
    expect(contador()).toBe('2 de 3');
    boton('next')!.click();
    fixture.detectChanges();
    expect(contador()).toBe('3 de 3');
    expect(boton('next')!.disabled).toBe(true);
    expect(fixture.componentInstance.page()).toBe(2);
  });

  it('«anterior» retrocede', () => {
    const { fixture, boton, contador } = crear(7, 3, 2);
    boton('previous')!.click();
    fixture.detectChanges();
    expect(contador()).toBe('2 de 3');
  });

  it('una página fuera de rango se acota a la última', () => {
    const { contador } = crear(4, 2, 9);
    expect(contador()).toBe('2 de 2');
  });
});
