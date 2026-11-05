import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_BASE_URL } from '../../../../../core/data-access/api';
import type { CreatedSupportStaffResponse } from '../../../../../core/data-access/support-access/support-provisioning.types';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { CreateSecretaryForm } from './create-secretary-form';

const CREATED: CreatedSupportStaffResponse = {
  userId: 'synthetic-user', personId: 'synthetic-person',
  supportProfileId: 'synthetic-support', linkId: 'synthetic-link', status: 'ACTIVE',
};

describe('CreateSecretaryForm · strict input contract', () => {
  let fixture: ComponentFixture<CreateSecretaryForm>;
  let http: HttpTestingController;
  const root = (): HTMLElement => fixture.nativeElement;
  const inputs = () => fixture.debugElement.queryAll(By.directive(Input));
  const submit = () => root().querySelector('form')?.dispatchEvent(new Event('submit', {
    bubbles: true, cancelable: true,
  }));
  const fill = () => {
    [' 1234567 ', ' Synthetic ', ' Person ', ' synthetic@example.test ', '+591 70000000', '1990-01-01']
      .forEach((value, index) => inputs()[index].triggerEventHandler('valueChange', value));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' },
    ] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CreateSecretaryForm);
    fixture.componentRef.setInput('roleAssignmentId', 'synthetic-assignment');
    fixture.detectChanges();
  });

  afterEach(() => {
    try { http.verify(); } finally { TestBed.resetTestingModule(); }
  });

  it.each([0, 1, 2, 3, 4, 5])('el campo %s normaliza null y número sin cambiar su contrato string', (index) => {
    const input = inputs()[index];
    input.triggerEventHandler('valueChange', null); fixture.detectChanges();
    expect(input.injector.get(Input).value()).toBe('');
    input.triggerEventHandler('valueChange', 123456); fixture.detectChanges();
    expect(input.injector.get(Input).value()).toBe('123456');
  });

  it('teléfono usa teclado telefónico y conserva prefijo sin convertirlo a número', () => {
    fill();
    const phone = inputs()[4].nativeElement.querySelector('input');
    expect(phone.type).toBe('text');
    expect(phone.getAttribute('inputmode')).toBe('tel');
    expect(phone.autocomplete).toBe('tel');
    expect(phone.value).toBe('+591 70000000');
  });

  it('campos vacíos no envían una provisión', () => {
    submit();
    http.expectNone('/me/practitioner/support-staff');
  });

  it('con datos válidos conserva payload y evita un segundo envío mientras espera', () => {
    let created: CreatedSupportStaffResponse | undefined;
    fixture.componentInstance.created.subscribe((value) => { created = value; });
    fill(); submit(); submit();
    const request = http.expectOne({ method: 'POST', url: '/me/practitioner/support-staff' });
    expect(request.request.body).toEqual({
      nationalId: '1234567', issuerAdministrativeAreaConceptId: 'lp-uuid',
      name: 'Synthetic', lastName: 'Person', email: 'synthetic@example.test',
      phone: '+591 70000000', birthDate: '1990-01-01',
      practitionerRoleAssignmentId: 'synthetic-assignment',
    });
    request.flush(CREATED); fixture.detectChanges();
    expect(created).toEqual(CREATED);
  });

  it('cancelar conserva el evento y no crea una cuenta', () => {
    let cancellations = 0;
    fixture.componentInstance.cancelled.subscribe(() => { ++cancellations; });
    root().querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    expect(cancellations).toBe(1);
    http.expectNone('/me/practitioner/support-staff');
  });
});
