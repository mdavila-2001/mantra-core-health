import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DirectoryPage } from './directory-page';

const CLAVE = 'alovida.directorio.vista';

describe('DirectoryPage · grilla o lista', () => {
  beforeEach(() => localStorage.removeItem(CLAVE));
  afterEach(() => localStorage.removeItem(CLAVE));

  function montar(entradas: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DirectoryPage);
    for (const [nombre, valor] of Object.entries(entradas)) {
      fixture.componentRef.setInput(nombre, valor);
    }
    fixture.componentRef.setInput('titulo', 'Directorio');
    fixture.componentRef.setInput('subtitulo', 'Sub');
    fixture.componentRef.setInput('estado', { kind: 'ready', data: null });
    fixture.componentRef.setInput('sustantivo', { singular: 'cosa', plural: 'cosas' });
    fixture.componentRef.setInput('grupos', [
      { id: 'g', nombre: '', resultados: [{ id: '1', title: 'Uno', link: '/uno' }] },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  const botones = (f: ReturnType<typeof montar>) =>
    Array.from<HTMLButtonElement>(f.nativeElement.querySelectorAll('.directorio__vista'));

  it('arranca en grilla y cambia a lista al pulsar, recordándolo', () => {
    const f = montar();
    const [grilla, lista] = botones(f);
    expect(grilla!.getAttribute('aria-pressed')).toBe('true');

    lista!.click();
    f.detectChanges();

    expect(lista!.getAttribute('aria-pressed')).toBe('true');
    expect(f.nativeElement.querySelector('.directorio__grilla--lista')).not.toBeNull();
    expect(f.nativeElement.querySelector('li.tarjeta-resultado--lista')).not.toBeNull();
    expect(localStorage.getItem(CLAVE)).toBe('lista');
  });

  it('respeta la vista guardada', () => {
    localStorage.setItem(CLAVE, 'lista');
    const f = montar();
    expect(botones(f)[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  /* Propietario, 04/10/2026: el directorio de médicos abre en filas. */
  it('un directorio puede abrir en lista por defecto, con su propia memoria', () => {
    const claveMedicos = 'alovida.directorio.vista.medicos';
    localStorage.removeItem(claveMedicos);
    // Una grilla elegida en otro directorio no arrastra a éste.
    localStorage.setItem(CLAVE, 'grilla');
    const f = montar({ vistaPorDefecto: 'lista', claveDeVista: claveMedicos });
    f.detectChanges();

    expect(botones(f)[1]!.getAttribute('aria-pressed')).toBe('true');
    expect(f.nativeElement.querySelector('li.tarjeta-resultado--lista')).not.toBeNull();
    localStorage.removeItem(claveMedicos);
  });
});
