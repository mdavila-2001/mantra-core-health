import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Avatar } from './avatar';
import { AVATAR_SIZES, AVATAR_TONES } from './avatar.types';

describe('Avatar', () => {
  let fixture: ComponentFixture<Avatar>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  function crear(): ComponentFixture<Avatar> {
    return TestBed.createComponent(Avatar);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Avatar] }).compileComponents();
    fixture = crear();
    await fixture.whenStable();
  });

  describe('iniciales', () => {
    it('toma la primera y la última palabra del nombre', async () => {
      await setInputs({ name: 'Andrea Peña' });
      expect(host().textContent?.trim()).toBe('AP');
    });

    it('con un solo nombre usa una sola letra', async () => {
      await setInputs({ name: 'Andrea' });
      expect(host().textContent?.trim()).toBe('A');
    });

    it('ignora los nombres del medio y los espacios de más', async () => {
      await setInputs({ name: '  Andrea  Lucía   Peña Soto ' });
      expect(host().textContent?.trim()).toBe('AS');
    });

    it('las iniciales explícitas ganan sobre el nombre', async () => {
      await setInputs({ name: 'Andrea Peña', initials: 'xy' });
      expect(host().textContent?.trim()).toBe('XY');
    });

    it('nunca muestra más de dos letras', async () => {
      await setInputs({ initials: 'ABCDE' });
      expect(host().textContent?.trim()).toBe('AB');
    });

    it('respeta acentos y letras fuera del ASCII', async () => {
      await setInputs({ name: 'Ángela Ñanculeo' });
      expect(host().textContent?.trim()).toBe('ÁÑ');
    });
  });

  describe('cascada de respaldo', () => {
    it('sin src ni nombre cae en la silueta', () => {
      expect(host().querySelector('.avatar__silhouette')).not.toBeNull();
      expect(host().querySelector('img')).toBeNull();
    });

    it('con src muestra la foto', async () => {
      await setInputs({ src: '/foto.jpg', name: 'Andrea Peña' });

      expect(host().querySelector('img')).not.toBeNull();
      expect(host().querySelector('.avatar__initials')).toBeNull();
    });

    it('si la foto falla cae en las iniciales', async () => {
      await setInputs({ src: '/rota.jpg', name: 'Andrea Peña' });

      host().querySelector('img')!.dispatchEvent(new Event('error'));
      await fixture.whenStable();

      expect(host().querySelector('img')).toBeNull();
      expect(host().textContent?.trim()).toBe('AP');
    });

    it('si la foto falla y no hay nombre cae en la silueta', async () => {
      await setInputs({ src: '/rota.jpg' });

      host().querySelector('img')!.dispatchEvent(new Event('error'));
      await fixture.whenStable();

      expect(host().querySelector('.avatar__silhouette')).not.toBeNull();
    });

    it('tras una foto rota, una nueva src tiene su propia oportunidad', async () => {
      // Esta es la instancia que una lista reutiliza al reordenarse (misma
      // `app-avatar`, `src` distinto): sin esto, la persona de la fila queda
      // en iniciales para siempre aunque su foto sea válida.
      await setInputs({ src: '/rota.jpg', name: 'Andrea Peña' });
      host().querySelector('img')!.dispatchEvent(new Event('error'));
      await fixture.whenStable();
      expect(host().querySelector('img')).toBeNull();

      await setInputs({ src: '/nueva.jpg' });

      expect(host().querySelector('img')).not.toBeNull();
      expect(host().querySelector('.avatar__initials')).toBeNull();
    });
  });

  describe('color determinista', () => {
    it('el mismo nombre da siempre el mismo tono', async () => {
      await setInputs({ name: 'Andrea Peña' });
      const primero = [...host().classList].find((c) => c.startsWith('avatar--') && !c.match(/--(xs|sm|md|lg|xl|with-status)$/));

      const otro = crear();
      otro.componentRef.setInput('name', 'Andrea Peña');
      await otro.whenStable();
      const segundo = [...(otro.nativeElement as HTMLElement).classList].find(
        (c) => c.startsWith('avatar--') && !c.match(/--(xs|sm|md|lg|xl|with-status)$/),
      );

      expect(primero).toBe(segundo);
    });

    it('siempre cae en uno de los tres tonos de marca', async () => {
      const nombres = ['Andrea Peña', 'Bruno Salas', 'Carla Ruiz', 'Diego Mamani', 'Elena Vaca'];
      for (const name of nombres) {
        const propio = crear();
        propio.componentRef.setInput('name', name);
        await propio.whenStable();

        const clases = [...(propio.nativeElement as HTMLElement).classList];
        const tonos = AVATAR_TONES.filter((tone) => clases.includes(`avatar--${tone}`));
        expect(tonos.length).toBe(1);
      }
    });

    it('nombres distintos llegan a repartirse entre los tonos', async () => {
      const vistos = new Set<string>();
      for (const name of ['Ana Uno', 'Beto Dos', 'Caro Tres', 'Dani Cuatro', 'Eli Cinco', 'Fer Seis']) {
        const propio = crear();
        propio.componentRef.setInput('name', name);
        await propio.whenStable();
        const clases = [...(propio.nativeElement as HTMLElement).classList];
        AVATAR_TONES.forEach((tone) => {
          if (clases.includes(`avatar--${tone}`)) {
            vistos.add(tone);
          }
        });
      }
      expect(vistos.size).toBeGreaterThan(1);
    });
  });

  describe('tamaños', () => {
    it('cada talle pone su modificador', async () => {
      for (const size of AVATAR_SIZES) {
        await setInputs({ size });
        expect(host().classList.contains(`avatar--${size}`)).toBe(true);
      }
    });
  });

  describe('estado de presencia', () => {
    it('sin estado no dibuja el punto', () => {
      expect(host().querySelector('.avatar__status')).toBeNull();
    });

    it('en línea dibuja su punto', async () => {
      await setInputs({ status: 'online' });

      const dot = host().querySelector('.avatar__status');
      expect(dot).not.toBeNull();
      expect(dot!.classList.contains('avatar__status--online')).toBe(true);
    });

    it('desconectado dibuja el suyo', async () => {
      await setInputs({ status: 'offline' });

      expect(
        host().querySelector('.avatar__status')!.classList.contains('avatar__status--offline'),
      ).toBe(true);
    });

    it('el punto es decorativo: el estado se anuncia por texto', async () => {
      await setInputs({ name: 'Andrea Peña', status: 'online' });

      expect(host().querySelector('.avatar__status')!.getAttribute('aria-hidden')).toBe('true');
      expect(host().getAttribute('aria-label')).toBe('Andrea Peña, en línea');
    });
  });

  describe('accesibilidad', () => {
    it('se expone como imagen con nombre', async () => {
      await setInputs({ name: 'Andrea Peña' });

      expect(host().getAttribute('role')).toBe('img');
      expect(host().getAttribute('aria-label')).toBe('Andrea Peña');
    });

    it('con foto el nombre accesible es el alt', async () => {
      await setInputs({ src: '/foto.jpg', alt: 'Foto de Andrea Peña', name: 'Andrea Peña' });

      expect(host().getAttribute('aria-label')).toBe('Foto de Andrea Peña');
    });

    it('sin nombre ni foto usa el alt por defecto', () => {
      expect(host().getAttribute('aria-label')).toBe('Avatar de usuario');
    });

    it('las iniciales no se leen dos veces', async () => {
      await setInputs({ name: 'Andrea Peña' });

      expect(host().querySelector('.avatar__initials')!.getAttribute('aria-hidden')).toBe('true');
    });
  });
});
