import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { OrganizationLogoClient } from '../../../core/data-access/directory/organization-logo.client';
import { PharmacyProfile } from '../pharmacy-profile/pharmacy-profile';
import {
  datosDeLaOrganizacion,
  genteDeLaOrganizacion,
  OrganizationProfile,
  papelesDeLaOrganizacion,
} from './organization-profile';
import type { MyOrganization } from '../../../core/data-access/directory/directory.types';

const ORGANIZACION = {
  id: 't-1',
  code: 'SEGANDINA',
  createdAt: new Date(2026, 4, 2),
  isVerified: false,
  canAdminister: true,
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
        { provide: OrganizationLogoClient, useValue: { getUrl: () => of(null) } },
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

    const contenido = texto();
    expect(contenido).not.toContain('Sigla');
    expect(contenido).not.toContain('Casa matriz');
  });

  it('a un laboratorio le muestra su forma societaria, su país y el NIT de su carpeta', () => {
    tipo.set('DIAGNOSTIC_CENTER');
    const laboratorio = {
      ...ORGANIZACION,
      legalName: 'ERBOL SRL',
      payer: undefined,
      legalEntityType: 'SRL',
      taxIdentifier: '7788990011',
    };
    TestBed.overrideProvider(DirectoryClient, {
      useValue: { listMyOrganizations: () => of([laboratorio]) },
    });

    const contenido = texto();
    expect(contenido).toContain('ERBOL SRL');
    expect(contenido).toContain('SEGANDINA');
    expect(contenido).toContain('Bolivia');
    expect(contenido).toContain('7788990011');
    expect(contenido).toContain('Pendiente de verificación');
  });

  it('lo que no se registró se dice, no se esconde', () => {
    tipo.set('DIAGNOSTIC_CENTER');
    const escueta = {
      ...ORGANIZACION,
      payer: undefined,
      tradeName: undefined,
      timeZone: undefined,
    };
    TestBed.overrideProvider(DirectoryClient, {
      useValue: { listMyOrganizations: () => of([escueta]) },
    });

    const contenido = texto();
    expect(contenido).toContain('Nombre comercial');
    expect(contenido).toContain('Zona horaria');
    expect(contenido).toContain('Sin registrar');
  });

  it('la ficha es UNA tarjeta con pestañas, y el representante y la carpeta se leen en las suyas', () => {
    const fixture = TestBed.createComponent(OrganizationProfile);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;

    expect(raiz.querySelectorAll('app-card.perfil-organizacion')).toHaveLength(1);
    const pestanas = [...raiz.querySelectorAll('[role="tab"]')].map((tab) =>
      tab.textContent?.trim(),
    );
    expect(pestanas).toEqual(['Organización', 'Representante y gerentes', 'Documentos', 'Logo']);
  });
});

describe('ficha de la organización — datos', () => {
  const base = {
    id: 't-1',
    code: 'ERBOL',
    legalName: 'ERBOL SRL',
    tenantTypeConceptId: 'tt',
    statusConceptId: 'st',
    verificationStatusConceptId: 'vs',
    createdAt: new Date(2026, 0, 1),
    myRoleConceptId: 'owner',
    canAdminister: true,
    isVerified: false,
  } satisfies MyOrganization;

  it('el NIT de la aseguradora gana sobre el de la carpeta: es el que la ficha edita', () => {
    const datos = datosDeLaOrganizacion({
      ...base,
      taxIdentifier: '111',
      payer: { carrierCode: 'X', regulatorIdentifier: '222', sigla: 'X', address: 'Calle 1' },
    });

    expect(datos.find((dato) => dato.etiqueta === 'NIT')?.valor).toBe('222');
    expect(datos.find((dato) => dato.etiqueta.startsWith('Casa matriz'))?.valor).toBe(
      'Sin registrar',
    );
  });

  it('sin representante legal la pestaña es un vacío con próxima acción', () => {
    const estado = genteDeLaOrganizacion(base);

    expect(estado.status).toBe('empty');
  });

  it('el representante lleva su documento de identidad y las gerencias su cargo en palabras', () => {
    const estado = genteDeLaOrganizacion({
      ...base,
      legalRepresentative: {
        role: 'LEGAL_REPRESENTATIVE',
        fullName: 'Mariana Siles',
        email: 'legal@erbol.bo',
        idNumber: '4872190 SC',
      },
      executives: [{ role: 'GENERAL_MANAGER', fullName: 'Carlos Mendoza', phone: '+591 70000001' }],
    });

    expect(estado).toEqual({
      status: 'ready',
      data: {
        representante: {
          cargo: 'Representante legal',
          nombre: 'Mariana Siles',
          celular: null,
          correo: 'legal@erbol.bo',
          documento: '4872190 SC',
        },
        gerentes: [
          {
            cargo: 'Gerente General',
            nombre: 'Carlos Mendoza',
            celular: '+591 70000001',
            correo: null,
            documento: null,
          },
        ],
      },
    });
  });

  it('nombra cada papel como en el país, con su número y su estado', () => {
    const hoy = new Date(2026, 4, 1);
    const papeles = papelesDeLaOrganizacion(
      {
        ...base,
        legalEntityType: 'SRL',
        legalDocuments: [
          { role: 'TAX_IDENTIFIER_DOC', verificationStatus: 'VERIFICADO', documentNumber: '7788' },
          {
            role: 'OPERATING_LICENSE_DOC',
            verificationStatus: 'PENDIENTE',
            validTo: new Date(2026, 4, 11),
          },
          { role: 'COMMERCE_REGISTRY_DOC', verificationStatus: 'VENCIDO' },
        ],
      },
      hoy,
    );

    expect(papeles.map((papel) => papel.clave)).toEqual([
      'TAX_IDENTIFIER_DOC',
      'OPERATING_LICENSE_DOC',
      'COMMERCE_REGISTRY_DOC',
    ]);
    expect(papeles[0]?.nombre).toContain('N.º 7788');
    expect(papeles[0]?.verificacion).toBe('VERIFICADO');
    expect(papeles[1]?.diasParaVencer).toBe(10);
    expect(papeles[2]?.verificacion).toBe('PENDIENTE');
    expect(papeles[2]?.diasParaVencer).toBeNull();
  });
});
