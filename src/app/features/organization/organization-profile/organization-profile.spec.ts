import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { LogoDeOrganizacionClient } from '../../../core/data-access/directory/organization-logo.client';
import { PharmacyProfile } from '../pharmacy-profile/pharmacy-profile';
import { OrganizationProfile } from './organization-profile';

const ORGANIZACION = {
  id: 't-1',
  legalName: 'Seguros Andina S.A.',
  tradeName: 'Seguros Andina',
  timeZone: 'America/La_Paz',
  payer: { sigla: 'SA', regulatorIdentifier: '1020304050', address: 'Av. Central 100' },
};

describe('OrganizationProfile', () => {
  const tipo = signal<string | null>('PAYER');

  beforeEach(async () => {
    tipo.set('PAYER');
    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { activeTenantType: tipo, activeTenantId: signal('t-1') },
        },
        { provide: DirectoryClient, useValue: { listMyOrganizations: () => of([ORGANIZACION]) } },
        // El logo tiene su propia prueba (`organization-logo.spec.ts`): acá no es lo que se mira.
        { provide: LogoDeOrganizacionClient, useValue: { obtenerUrl: () => of(null) } },
      ],
    })
      // La ficha de farmacia tiene sus propios specs: acá sólo se prueba que se elige.
      .overrideComponent(OrganizationProfile, {
        remove: { imports: [PharmacyProfile] },
      })
      .compileComponents();
  });

  function texto(): string {
    const fixture = TestBed.createComponent(OrganizationProfile);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('titula el perfil según el tipo de organización', () => {
    expect(texto()).toContain('Perfil de la aseguradora');

    tipo.set('DIAGNOSTIC_CENTER');
    expect(texto()).toContain('Perfil del laboratorio');
  });

  it('muestra los datos de la organización que devuelve el directorio', () => {
    const contenido = texto();

    expect(contenido).toContain('Seguros Andina S.A.');
    expect(contenido).toContain('Seguros Andina');
    expect(contenido).toContain('America/La_Paz');
  });

  it('a la aseguradora le suma sus datos de regulador', () => {
    const contenido = texto();

    expect(contenido).toContain('NIT');
    expect(contenido).toContain('1020304050');
  });

  it('a un laboratorio no le pinta campos de aseguradora', () => {
    tipo.set('DIAGNOSTIC_CENTER');
    const sinPayer = { ...ORGANIZACION, payer: undefined };
    TestBed.overrideProvider(DirectoryClient, {
      useValue: { listMyOrganizations: () => of([sinPayer]) },
    });

    expect(texto()).not.toContain('NIT');
  });
});
