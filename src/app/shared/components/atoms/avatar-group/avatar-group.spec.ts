import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Avatar } from '../avatar/avatar';
import { AvatarGroupComponent } from './avatar-group';

@Component({
  imports: [AvatarGroupComponent, Avatar],
  template: `
    <app-avatar-group [overflow]="overflow()" size="sm" label="Equipo tratante">
      <app-avatar name="Andrea Peña" size="sm" />
      <app-avatar name="Bruno Salas" size="sm" />
      <app-avatar name="Carla Ruiz" size="sm" />
    </app-avatar-group>
  `,
})
class HostComponent {
  readonly overflow = signal(0);
}

describe('AvatarGroupComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function group(): HTMLElement {
    return fixture.nativeElement.querySelector('app-avatar-group');
  }
  function more(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.avatar-group__more');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('proyecta los avatares que recibe', () => {
    expect(fixture.nativeElement.querySelectorAll('app-avatar').length).toBe(3);
  });

  describe('contador de desbordamiento', () => {
    it('sin overflow no lo muestra', () => {
      expect(more()).toBeNull();
    });

    it('con overflow muestra +N', async () => {
      host.overflow.set(4);
      await fixture.whenStable();

      expect(more()!.textContent?.trim()).toBe('+4');
    });

    it('lo dice en palabras para el lector de pantalla', async () => {
      host.overflow.set(4);
      await fixture.whenStable();

      // «+4» no se lee bien en voz alta
      expect(more()!.getAttribute('aria-label')).toBe('4 personas más');
    });

    it('un overflow de 0 o negativo no dibuja nada', async () => {
      host.overflow.set(-1);
      await fixture.whenStable();

      expect(more()).toBeNull();
    });
  });

  describe('accesibilidad', () => {
    it('se anuncia como un grupo con nombre', () => {
      expect(group().getAttribute('role')).toBe('group');
      expect(group().getAttribute('aria-label')).toBe('Equipo tratante');
    });
  });

  it('el talle del grupo acompaña al de sus avatares', () => {
    expect(group().classList.contains('avatar-group--sm')).toBe(true);
  });
});
