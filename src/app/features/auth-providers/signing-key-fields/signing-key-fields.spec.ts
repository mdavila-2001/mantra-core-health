import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SigningKeyFields } from './signing-key-fields';

describe('SigningKeyFields', () => {
  let fixture: ComponentFixture<SigningKeyFields>;
  let component: SigningKeyFields;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SigningKeyFields] }).compileComponents();

    fixture = TestBed.createComponent(SigningKeyFields);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function interno<T>(nombre: string): T {
    return (component as unknown as Record<string, unknown>)[nombre] as T;
  }

  function formulario(): {
    patchValue: (v: object) => void;
    controls: { keyId: { touched: boolean } };
  } {
    return interno<{
      patchValue: (v: object) => void;
      controls: { keyId: { touched: boolean } };
    }>('form');
  }

  it('incompleta devuelve null y deja los errores marcados', () => {
    expect(component.intentarLeer()).toBeNull();
    expect(formulario().controls.keyId.touched).toBe(true);
  });

  it('la clave mínima lleva exactamente sus tres campos, recortados', () => {
    formulario().patchValue({ keyId: '  k-1  ', algorithm: 'RS256', publicKey: 'pem' });

    expect(component.intentarLeer()).toEqual({
      keyId: 'k-1',
      algorithm: 'RS256',
      publicKey: 'pem',
    });
  });

  it('certificado y vigencia viajan solo cuando se cargan, con las fechas en ISO', () => {
    formulario().patchValue({
      keyId: 'k-1',
      algorithm: 'RS256',
      publicKey: 'pem',
      certificate: 'cert',
    });
    interno<{ set: (v: Date) => void }>('validTo').set(new Date('2027-01-01T00:00:00.000Z'));

    expect(component.intentarLeer()).toEqual({
      keyId: 'k-1',
      algorithm: 'RS256',
      publicKey: 'pem',
      certificate: 'cert',
      validTo: '2027-01-01T00:00:00.000Z',
    });
  });
});
