import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { RegistrationBadge } from './registration-badge';

/**
 * La insignia es decoración: lo que se prueba es que dice el tipo correcto, que
 * la celebración sólo existe cuando se pide, y que nunca se anuncia —la
 * confirmación ya se anuncia con su título—.
 */
describe('RegistrationBadge', () => {
  let fixture: ComponentFixture<RegistrationBadge>;

  function render(type: string, celebrate = false): HTMLElement {
    fixture = TestBed.createComponent(RegistrationBadge);
    fixture.componentRef.setInput('type', type);
    fixture.componentRef.setInput('celebrate', celebrate);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RegistrationBadge] }).compileComponents();
  });

  it('dibuja el ícono del tipo de cuenta que se está creando', () => {
    const farmacia = render('pharmacy');
    const svgFarmacia = farmacia.querySelector('app-account-icon svg');
    const markupFarmacia = svgFarmacia?.innerHTML;

    expect(svgFarmacia).not.toBeNull();
    // Cada tipo trae su propio dibujo: el de farmacia no es el de paciente.
    expect(render('patient').querySelector('app-account-icon svg')?.innerHTML).not.toBe(markupFarmacia);
  });

  it('en reposo no trae marca de verificación ni destellos', () => {
    const root = render('patient');

    expect(root.querySelector('.badge')?.classList).not.toContain('badge--celebrate');
    expect(root.querySelector('.badge__check')).toBeNull();
    expect(root.querySelectorAll('.badge__spark')).toHaveLength(0);
  });

  it('al celebrar agrega la marca de verificación y ocho destellos', () => {
    const root = render('patient', true);

    expect(root.querySelector('.badge')?.classList).toContain('badge--celebrate');
    expect(root.querySelector('.badge__check')).not.toBeNull();
    expect(root.querySelectorAll('.badge__spark')).toHaveLength(8);
  });

  it('cada destello sabe hacia dónde sale y de qué color', () => {
    const chispas = Array.from(
      render('insurer', true).querySelectorAll<HTMLElement>('.badge__spark'),
    );

    for (const chispa of chispas) {
      expect(chispa.style.getPropertyValue('--x')).toMatch(/rem$/);
      expect(chispa.style.getPropertyValue('--y')).toMatch(/rem$/);
      expect(chispa.style.getPropertyValue('--c')).toMatch(/^var\(--c-/);
    }
    // Ocho direcciones distintas: si dos coincidieran, serían siete destellos.
    const destinos = new Set(
      chispas.map((c) => `${c.style.getPropertyValue('--x')}|${c.style.getPropertyValue('--y')}`),
    );
    expect(destinos.size).toBe(8);
  });

  it('es decorativa: no se anuncia', () => {
    expect(render('laboratory', true).querySelector('.badge')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
