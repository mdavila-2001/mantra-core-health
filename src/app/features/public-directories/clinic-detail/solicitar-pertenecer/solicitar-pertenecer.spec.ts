import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { SessionStore } from '@core/auth/session.store';
import { ROLE_ASSIGNMENT_STATUS } from '@core/data-access/practice-sites/role-assignment-concepts';

import { SolicitarPertenecer } from './solicitar-pertenecer';

const PRACTICAS = [
  { id: 'prac-1', code: 'LO', name: 'Clínica Los Olivos' },
  { id: 'prac-2', code: 'OT', name: 'Otra Clínica' },
];

describe('SolicitarPertenecer', () => {
  let fixture: ComponentFixture<SolicitarPertenecer>;
  let http: HttpTestingController;

  function montar(profesional: boolean, nombre = 'Clínica los olivos'): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: SessionStore,
          useValue: { practitionerProfileId: signal(profesional ? 'prof-1' : null) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SolicitarPertenecer);
    fixture.componentRef.setInput('nombre', nombre);
    fixture.detectChanges();
  }

  function responder(vinculos: unknown[] = [], practicas: unknown[] = PRACTICAS): void {
    http.expectOne((r) => r.url.endsWith('/practices') && r.method === 'GET').flush(practicas);
    http.expectOne((r) => r.url.includes('role-assignments') && r.method === 'GET').flush(vinculos);
    fixture.detectChanges();
  }

  const texto = (): string => fixture.nativeElement.textContent as string;
  const boton = (): HTMLButtonElement | null =>
    fixture.nativeElement.querySelector('[data-testid="solicitar-boton"]');

  afterEach(() => http?.verify());

  it('no dibuja nada ni pide nada si quien mira no es profesional', () => {
    montar(false);
    expect(fixture.nativeElement.querySelector('[data-testid="solicitar-pertenecer"]')).toBeNull();
  });

  it('ofrece solicitar y envía el pedido a la organización identificada por nombre', () => {
    montar(true);
    responder();
    expect(boton()).not.toBeNull();
    expect(texto()).toContain('queda pendiente hasta que la organización la apruebe');

    boton()!.click();
    const post = http.expectOne((r) => r.method === 'POST');
    expect(post.request.url).toContain('/practices/prac-1/role-assignments/self-request');
    post.flush({});
    // Tras enviar, relee el vínculo: ahora queda pendiente.
    responder([]);
    expect(fixture.nativeElement.querySelector('[data-testid="solicitar-enviada"]')).not.toBeNull();
  });

  it('con una solicitud pendiente no ofrece pedir otra y lo dice', () => {
    montar(true);
    responder([
      { id: 'a1', practiceId: 'prac-1', practiceName: 'Clínica Los Olivos', status: ROLE_ASSIGNMENT_STATUS.PENDING },
    ]);
    expect(boton()).toBeNull();
    expect(texto()).toContain('pendiente');
  });

  it('si ya pertenece lo dice y no ofrece pedir', () => {
    montar(true);
    responder([
      { id: 'a1', practiceId: 'prac-1', practiceName: 'Clínica Los Olivos', status: ROLE_ASSIGNMENT_STATUS.ACTIVE },
    ]);
    expect(boton()).toBeNull();
    expect(texto()).toContain('Ya pertenece');
  });

  it('un vínculo rechazado permite pedir de nuevo', () => {
    montar(true);
    responder([
      { id: 'a1', practiceId: 'prac-1', practiceName: 'Clínica Los Olivos', status: ROLE_ASSIGNMENT_STATUS.REJECTED },
    ]);
    expect(boton()).not.toBeNull();
  });

  it('si no identifica la organización no pide a ciegas', () => {
    montar(true, 'Nombre que no existe');
    responder();
    expect(boton()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="solicitar-sin-id"]')).not.toBeNull();
  });

  it('si la lectura falla ofrece reintentar', () => {
    montar(true);
    http.expectOne((r) => r.url.endsWith('/practices')).flush('x', { status: 500, statusText: 'err' });
    http.match((r) => r.url.includes('role-assignments')).forEach((p) => { if (!p.cancelled) p.flush('x', { status: 500, statusText: 'err' }); });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="solicitar-error-lectura"]')).not.toBeNull();
  });
});
