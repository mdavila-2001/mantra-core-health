import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PsychologicalHelp } from './psychological-help';

describe('PsychologicalHelp', () => {
  it('muestra apoyo emocional, videos oficiales embebidos y acceso a ambas especialidades', async () => {
    await TestBed.configureTestingModule({
      imports: [PsychologicalHelp],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(PsychologicalHelp);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('h1')?.textContent).toContain('Ayuda psicológica');
    expect(root.querySelectorAll('iframe')).toHaveLength(2);
    expect(root.querySelector('iframe[title="OPS: Cuidar la salud mental"]')?.getAttribute('src'))
      .toContain('youtube-nocookie.com/embed/nY66tl39PkE');
    expect(root.querySelector('iframe[title="OPS: Adolescentes y salud mental"]')?.getAttribute('src'))
      .toContain('youtube-nocookie.com/embed/T1ysvMHuV-Y');
    expect(root.textContent).toContain('No hace falta tener un diagnóstico para pedir ayuda.');
    expect(root.textContent).toContain('Si hay peligro inmediato');
    expect(root.textContent).toContain('Buscar psicólogos');
    const enlaces = [...root.querySelectorAll('a')];
    expect(enlaces.find((link) => link.textContent?.includes('Ver psicólogos/as'))?.getAttribute('href'))
      .toContain('/directory');
    expect(enlaces.find((link) => link.textContent?.includes('Ver psiquiatras'))?.getAttribute('href'))
      .toContain('/directory');
  });
});
