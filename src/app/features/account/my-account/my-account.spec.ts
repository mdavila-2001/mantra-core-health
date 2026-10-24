import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { OrganizationProfile } from '../../organization/organization-profile/organization-profile';
import { MyProfile } from '../my-profile/my-profile';
import { MyAccount } from './my-account';

@Component({
  selector: 'app-my-profile',
  template: '<p data-testid="persona"></p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FalsoMyProfile {}

@Component({
  selector: 'app-organization-profile',
  template: '<p data-testid="organizacion"></p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class FalsoOrganizationProfile {}

describe('MyAccount', () => {
  const esOrganizacion = signal(false);

  beforeEach(async () => {
    esOrganizacion.set(false);
    await TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { isOrganizationAccount: esOrganizacion } }],
    })
      // Se sustituyen las dos pantallas reales por marcas: lo que se prueba es
      // cuál de las dos monta `MyAccount`, no lo que cada una dibuja.
      .overrideComponent(MyAccount, {
        remove: { imports: [MyProfile, OrganizationProfile] },
        add: { imports: [FalsoMyProfile, FalsoOrganizationProfile] },
      })
      .compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(MyAccount);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('una persona ve su perfil de persona y no la ficha de organización', async () => {
    const dom = await render();

    expect(dom.querySelector('[data-testid="persona"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="organizacion"]')).toBeNull();
  });

  it('una cuenta de organización ve su ficha y nunca monta el perfil de persona', async () => {
    esOrganizacion.set(true);
    const dom = await render();

    expect(dom.querySelector('[data-testid="organizacion"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="persona"]')).toBeNull();
  });
});
