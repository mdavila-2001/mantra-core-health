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
  const tipoActivo = signal<string | null>(null);
  const pid = signal<string | null>(null);
  const hpid = signal<string | null>(null);

  beforeEach(async () => {
    esOrganizacion.set(false);
    tipoActivo.set(null);
    pid.set(null);
    hpid.set(null);
    await TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: {
            isOrganizationAccount: esOrganizacion,
            activeTenantType: tipoActivo,
            patientProfileId: pid,
            practitionerProfileId: hpid,
          },
        }],
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

  it('el dueño de una organización médica, sin perfil de paciente ni profesional, ve la ficha de la organización', async () => {
    tipoActivo.set('CLINIC');
    const dom = await render();

    expect(dom.querySelector('[data-testid="organizacion"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="persona"]')).toBeNull();
  });

  it('un médico que dirige su clínica sigue viendo su perfil de persona', async () => {
    tipoActivo.set('CLINIC');
    hpid.set('hp-1');
    const dom = await render();

    expect(dom.querySelector('[data-testid="persona"]')).not.toBeNull();
    expect(dom.querySelector('[data-testid="organizacion"]')).toBeNull();
  });
});
