import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ProfileAffiliationLinks } from './profile-affiliation-links';

/** Los dos atajos del perfil hacia invitaciones/solicitudes y procedimientos propios. */
describe('ProfileAffiliationLinks', () => {
  function pintar(size?: 'sm' | 'md' | 'lg'): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProfileAffiliationLinks);
    if (size) fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('enlaza a invitaciones y a procedimientos de «Mi cuenta»', () => {
    const root = pintar();
    expect(root.querySelector('[data-testid="profile-affiliations-link"]')?.getAttribute('href')).toBe('/my-account/affiliations');
    expect(root.querySelector('[data-testid="profile-my-procedures-link"]')?.getAttribute('href')).toBe('/my-account/my-procedures');
    expect(root.textContent).toContain('Invitaciones y solicitudes');
    expect(root.textContent).toContain('Procedimientos que hago');
  });

  it('el tamaño llega a los dos botones', () => {
    const root = pintar('sm');
    const enlaces = Array.from(root.querySelectorAll('a'));
    expect(enlaces.every((a) => a.className.includes('sm'))).toBe(true);
  });
});
