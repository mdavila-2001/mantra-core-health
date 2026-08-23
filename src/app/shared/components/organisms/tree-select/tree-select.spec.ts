import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { TreeSelect } from './tree-select';
import type { TreeSelectGroup } from './tree-select.types';

/**
 * Un recorte del árbol real: dos departamentos, y un nombre repetido entre
 * ellos. El nombre repetido es el motivo de que este componente exista.
 */
const GRUPOS: readonly TreeSelectGroup<string>[] = [
  {
    label: 'Cochabamba',
    items: [
      { value: 'cb-sacaba', label: 'Sacaba' },
      { value: 'cb-tiquipaya', label: 'Tiquipaya' },
      { value: 'cb-san-pedro', label: 'San Pedro' },
    ],
  },
  {
    label: 'Potosí',
    items: [
      { value: 'pt-uyuni', label: 'Uyuni' },
      { value: 'pt-san-pedro', label: 'San Pedro' },
    ],
  },
];

describe('TreeSelect', () => {
  let fixture: ComponentFixture<TreeSelect<string>>;

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.tree-select-trigger');
  }
  function dialog(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role=dialog]');
  }
  function buscador(): HTMLInputElement {
    return fixture.nativeElement.querySelector('.search-input');
  }
  function ramas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.tree-branch'));
  }
  function hojas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.tree-leaf'));
  }
  function textoDeHojas(): string[] {
    return hojas().map((hoja) => hoja.querySelector('.leaf-label')!.textContent!.trim());
  }

  async function abrir(): Promise<void> {
    trigger().click();
    await fixture.whenStable();
  }

  async function escribir(texto: string): Promise<void> {
    const input = buscador();
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function tecla(key: string): Promise<void> {
    dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TreeSelect] }).compileComponents();
    fixture = TestBed.createComponent<TreeSelect<string>>(TreeSelect);
    fixture.componentRef.setInput('groups', GRUPOS);
    await fixture.whenStable();
  });

  describe('el diálogo', () => {
    it('el disparador declara que abre uno, y muestra el marcador de posición', () => {
      expect(trigger().getAttribute('aria-haspopup')).toBe('dialog');
      expect(trigger().getAttribute('aria-expanded')).toBe('false');
      expect(dialog()).toBeNull();
    });

    it('al abrir, el foco entra al buscador y no al árbol', async () => {
      await abrir();

      expect(dialog()).not.toBeNull();
      // El foco vive en el buscador y la fila activa viaja por
      // `aria-activedescendant`: es lo que permite escribir y navegar a la vez.
      expect(document.activeElement).toBe(buscador());
    });

    it('Escape cierra y devuelve el foco al disparador', async () => {
      await abrir();

      await tecla('Escape');

      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(trigger());
    });

    it('deshabilitado no abre', async () => {
      fixture.componentRef.setInput('disabled', true);
      await fixture.whenStable();

      await abrir();

      expect(dialog()).toBeNull();
    });
  });

  describe('el árbol', () => {
    it('empieza con las ramas plegadas: nueve titulares, no 340 filas', async () => {
      await abrir();

      expect(ramas()).toHaveLength(2);
      expect(hojas()).toHaveLength(0);
      expect(ramas()[0].getAttribute('aria-expanded')).toBe('false');
    });

    it('desplegar una rama muestra sólo sus hojas', async () => {
      await abrir();

      ramas()[0].querySelector<HTMLButtonElement>('.branch-toggle')!.click();
      await fixture.whenStable();

      expect(ramas()[0].getAttribute('aria-expanded')).toBe('true');
      expect(textoDeHojas()).toEqual(['Sacaba', 'Tiquipaya', 'San Pedro']);
    });

    it('elegir una hoja cierra y deja el valor con su rama a la vista', async () => {
      await abrir();
      ramas()[0].querySelector<HTMLButtonElement>('.branch-toggle')!.click();
      await fixture.whenStable();

      hojas()[0].querySelector<HTMLButtonElement>('.leaf-button')!.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe('cb-sacaba');
      expect(dialog()).toBeNull();
      // El nombre solo sería ambiguo: «San Pedro» existe en dos departamentos.
      expect(trigger().textContent).toContain('Sacaba · Cochabamba');
    });

    it('al reabrir, la rama de lo ya elegido viene desplegada', async () => {
      fixture.componentRef.setInput('value', 'pt-uyuni');
      await fixture.whenStable();

      await abrir();

      expect(ramas()[0].getAttribute('aria-expanded')).toBe('false');
      expect(ramas()[1].getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('la búsqueda', () => {
    it('filtra por nombre de hoja y despliega lo que encuentra', async () => {
      await abrir();

      await escribir('uyuni');

      expect(ramas()).toHaveLength(1);
      expect(textoDeHojas()).toEqual(['Uyuni']);
    });

    it('ignora acentos y mayúsculas: «Potosi» encuentra «Potosí»', async () => {
      await abrir();

      await escribir('POTOSI');

      // Casó la rama, así que trae todas sus hojas: es lo que uno espera al
      // escribir el nombre de un departamento.
      expect(ramas()).toHaveLength(1);
      expect(textoDeHojas()).toEqual(['Uyuni', 'San Pedro']);
    });

    it('un nombre repetido aparece bajo cada departamento, no una sola vez', async () => {
      await abrir();

      await escribir('san pedro');

      // Es el motivo entero de que esto sea un árbol: sueltos, los dos «San
      // Pedro» son indistinguibles.
      expect(ramas().map((rama) => rama.querySelector('.branch-label')!.textContent!.trim()))
        .toEqual(['Cochabamba', 'Potosí']);
      expect(textoDeHojas()).toEqual(['San Pedro', 'San Pedro']);
    });

    it('sin coincidencias lo dice, en vez de mostrar un árbol vacío', async () => {
      await abrir();

      await escribir('montevideo');

      expect(ramas()).toHaveLength(0);
      expect(fixture.nativeElement.querySelector('.tree-empty')).not.toBeNull();
    });

    it('anuncia cuántos resultados hay', async () => {
      await abrir();

      await escribir('san pedro');

      const recuento = fixture.nativeElement.querySelector('.search-count');
      expect(recuento.getAttribute('aria-live')).toBe('polite');
      expect(recuento.textContent).toContain('2');
    });
  });

  describe('el teclado', () => {
    it('abajo entra en la primera rama y la señala con aria-activedescendant', async () => {
      await abrir();

      await tecla('ArrowDown');

      const activo = buscador().getAttribute('aria-activedescendant');
      expect(activo).toBe(ramas()[0].id);
      expect(ramas()[0].classList.contains('is-active')).toBe(true);
    });

    it('derecha despliega la rama activa; izquierda la pliega', async () => {
      await abrir();
      await tecla('ArrowDown');

      await tecla('ArrowRight');
      expect(ramas()[0].getAttribute('aria-expanded')).toBe('true');

      await tecla('ArrowLeft');
      expect(ramas()[0].getAttribute('aria-expanded')).toBe('false');
    });

    it('Enter sobre una hoja la elige', async () => {
      await abrir();
      await tecla('ArrowDown');
      await tecla('ArrowRight');
      await tecla('ArrowDown');

      await tecla('Enter');

      expect(fixture.componentInstance.value()).toBe('cb-sacaba');
      expect(dialog()).toBeNull();
    });

    it('arriba en la primera fila se queda: no da la vuelta al final', async () => {
      await abrir();
      await tecla('ArrowDown');

      await tecla('ArrowUp');

      // En una lista larga, saltar del principio al final se siente como haber
      // perdido el lugar.
      expect(buscador().getAttribute('aria-activedescendant')).toBe(ramas()[0].id);
    });

    it('cambiar la búsqueda descarta la fila activa', async () => {
      await abrir();
      await tecla('ArrowDown');

      await escribir('uyuni');

      // `aria-activedescendant` apuntando a una fila que ya no existe deja al
      // lector de pantalla sin decir nada.
      expect(buscador().getAttribute('aria-activedescendant')).toBeNull();
    });
  });

  it('«Quitar elección» borra el valor y sólo aparece si hay uno', async () => {
    await abrir();
    expect(fixture.nativeElement.textContent).not.toContain('Quitar elección');
    await tecla('Escape');

    fixture.componentRef.setInput('value', 'cb-sacaba');
    await fixture.whenStable();
    await abrir();

    const quitar = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('.dialog-actions button'),
    ).find((boton) => boton.textContent!.includes('Quitar'))!;
    quitar.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.value()).toBeNull();
  });
});
