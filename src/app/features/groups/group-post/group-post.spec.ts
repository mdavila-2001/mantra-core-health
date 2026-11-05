import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { GroupWallItem } from '../../../core/data-access/community/community.types';
import { GroupPost } from './group-post';

/**
 * Una publicación del muro de un grupo, con su hilo de respuestas anidado
 * (sangría tope 3). Sólo ofrece «Responder» a quien puede; la caja de
 * respuesta la proyecta el muro. El texto es del autor y se pinta como texto.
 */

function item(id: string, partial: Partial<GroupWallItem> = {}): GroupWallItem {
  return {
    id,
    authorProfileId: `perfil-${id}-123456789`,
    bodyText: `Texto ${id}`,
    createdAt: new Date('2026-10-30T12:00:00Z'),
    replies: [],
    ...partial,
  };
}

const HILO = item('p1', {
  replyCount: 2,
  replies: [item('r1', { threadDepth: 1, replies: [item('r2', { threadDepth: 5 })] })],
});

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [GroupPost],
  template: `
    <app-group-post [post]="post()" [puedeResponder]="puede()" [respondiendoA]="abierta()" (responder)="pedidos.push($event)">
      <p class="caja">caja de respuesta</p>
    </app-group-post>
  `,
})
class Host {
  readonly post = signal(HILO);
  readonly puede = signal(true);
  readonly abierta = signal<string | null>(null);
  readonly pedidos: string[] = [];
}

describe('GroupPost', () => {
  let fixture: ComponentFixture<Host>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const articulos = (): HTMLElement[] => Array.from(root().querySelectorAll<HTMLElement>('article.publicacion'));

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('pinta el hilo anidado con su sangría, topada en 3', () => {
    expect(articulos().map((a) => a.getAttribute('data-nivel'))).toEqual(['0', '1', '3']);
    expect(articulos()[0]!.querySelector('.publicacion__cuerpo')?.textContent).toBe('Texto p1');
    expect(articulos()[0]!.querySelector('.publicacion__autor')?.textContent).toBe('Perfil perfil-p');
    expect(root().querySelector('.publicacion__conteo')?.textContent).toBe('2 respuestas');
  });

  it('«Responder» de cualquier nivel sube con el id de esa publicación', () => {
    const botones = Array.from(root().querySelectorAll<HTMLButtonElement>('.publicacion__acciones button'));
    botones[2]!.click();
    botones[0]!.click();
    expect(fixture.componentInstance.pedidos).toEqual(['r2', 'p1']);
  });

  it('la publicación con la respuesta abierta lo anuncia y ofrece cerrar', () => {
    fixture.componentInstance.abierta.set('r1');
    fixture.detectChanges();
    const boton = articulos()[1]!.querySelector('.publicacion__acciones button')!;
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(boton.textContent?.trim()).toBe('Cerrar respuesta');
    expect(articulos()[0]!.querySelector('.publicacion__acciones button')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('sin permiso de responder no hay botones', () => {
    fixture.componentInstance.puede.set(false);
    fixture.detectChanges();
    expect(root().querySelectorAll('.publicacion__acciones')).toHaveLength(0);
  });

  it('proyecta la caja de respuesta y pinta el cuerpo como texto', () => {
    expect(articulos()[0]!.querySelector('.caja')).not.toBeNull();
    fixture.componentInstance.post.set(item('x', { bodyText: '<img src=x onerror=1>' }));
    fixture.detectChanges();
    expect(root().querySelector('.publicacion__cuerpo')?.textContent).toBe('<img src=x onerror=1>');
    expect(root().querySelector('.publicacion__cuerpo img')).toBeNull();
  });
});
