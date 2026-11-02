import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { reemplazarAnimate } from '../../../../../testing/animate';
import { AccountExistsCheck } from './account-exists-check';
import { AccountExistsDialog } from './account-exists-dialog';

describe('AccountExistsCheck + AccountExistsDialog', () => {
  let http: HttpTestingController;
  let check: AccountExistsCheck;
  let restaurarAnimate: () => void;

  beforeEach(() => {
    restaurarAnimate = reemplazarAnimate(() => ({ finished: Promise.resolve(), cancel: () => undefined }));
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    check = TestBed.inject(AccountExistsCheck);
  });

  afterEach(() => {
    http.verify();
    restaurarAnimate();
  });

  function responder(kind: string, value: string, exists: boolean): void {
    const req = http.expectOne(
      (r) =>
        r.url.endsWith('/iam/auth/identifier-exists') &&
        r.params.get('kind') === kind &&
        r.params.get('value') === value,
    );
    req.flush({ exists });
  }

  it('si el documento ya existe, deja el tipo para abrir el aviso', () => {
    check.verificar('NATIONAL_ID', ' 4567890 ');
    responder('NATIONAL_ID', '4567890', true);

    expect(check.encontrado()).toBe('NATIONAL_ID');
  });

  it('si no existe, no avisa nada', () => {
    check.verificar('EMAIL', 'nuevo@correo.bo');
    responder('EMAIL', 'nuevo@correo.bo', false);

    expect(check.encontrado()).toBeNull();
  });

  it('un campo vacío no consulta', () => {
    check.verificar('ORG_NAME', '   ');

    http.expectNone((r) => r.url.endsWith('/iam/auth/identifier-exists'));
  });

  it('salir dos veces del mismo valor consulta una sola vez', () => {
    check.verificar('NATIONAL_ID', '123');
    responder('NATIONAL_ID', '123', false);
    check.verificar('NATIONAL_ID', '123');

    http.expectNone((r) => r.url.endsWith('/iam/auth/identifier-exists'));
  });

  it('si la consulta falla, no avisa y deja volver a intentar', () => {
    check.verificar('EMAIL', 'a@b.bo');
    http
      .expectOne((r) => r.url.endsWith('/iam/auth/identifier-exists'))
      .flush('x', { status: 500, statusText: 'Error' });
    expect(check.encontrado()).toBeNull();

    check.verificar('EMAIL', 'a@b.bo');
    responder('EMAIL', 'a@b.bo', true);
    expect(check.encontrado()).toBe('EMAIL');
  });

  it('el modal dice que ya existe y «Iniciar sesión» lleva a /auth', () => {
    const fixture = TestBed.createComponent(AccountExistsDialog);
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="cuenta-existente"]')).toBeNull();

    check.encontrado.set('NATIONAL_ID');
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="content-dialog-title"]')?.textContent).toContain(
      'Ya existe este usuario',
    );
    const boton = root.querySelector<HTMLButtonElement>('[data-testid="cuenta-existente-login"]');
    boton?.click();

    expect(navegar).toHaveBeenCalledWith('/auth');
    expect(check.encontrado()).toBeNull();
  });
});
