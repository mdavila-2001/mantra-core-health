import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { Subject, of, throwError, type Observable } from 'rxjs';

import {
  DocumentAvailabilityClient,
  type DocumentAvailability,
  type DocumentAvailabilityQuery,
} from '../../../core/data-access/iam/document-availability.client';
import { mensajeDeError } from '../../../shared/forms/paginated/error-message';
import {
  DisponibilidadDeDocumento,
  DOCUMENTO_TOMADO,
  esErrorDeDocumentoYaRegistrado,
} from './document-availability';

const LA_PAZ = 'dep-la-paz';

/** Un cliente que responde lo que la prueba decida, y registra lo que le preguntaron. */
class IamFalso {
  readonly preguntas: DocumentAvailabilityQuery[] = [];
  respuesta: () => Observable<DocumentAvailability> = () => of({ available: true });
  check(query: DocumentAvailabilityQuery): Observable<DocumentAvailability> {
    this.preguntas.push(query);
    return this.respuesta();
  }
}

@Component({ template: '' })
class Anfitrion {
  readonly documento = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[A-Za-z0-9.-]+$/)],
  });
  readonly departamento = new FormControl<string | null>(null);
  readonly disponibilidad = new DisponibilidadDeDocumento(
    inject(DocumentAvailabilityClient),
    'PRACTITIONER',
    this.documento,
    this.departamento,
  );
}

describe('DisponibilidadDeDocumento (C-10 / MD-01)', () => {
  let iam: IamFalso;
  let host: Anfitrion;

  beforeEach(() => {
    vi.useFakeTimers();
    iam = new IamFalso();
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentAvailabilityClient, useValue: iam }],
    });
    host = TestBed.createComponent(Anfitrion).componentInstance;
  });

  afterEach(() => vi.useRealTimers());

  function escribir(numero: string, departamento: string | null): void {
    host.departamento.setValue(departamento);
    host.documento.setValue(numero);
  }

  it('sin documento no dice nada y no pregunta', () => {
    expect(host.disponibilidad.estado()).toBe('sin-dato');
    vi.advanceTimersByTime(1000);
    expect(iam.preguntas).toEqual([]);
  });

  it('con documento y sin departamento, pide el departamento sin preguntar', () => {
    escribir('1234567', null);
    expect(host.disponibilidad.estado()).toBe('falta-departamento');
    vi.advanceTimersByTime(1000);
    expect(iam.preguntas).toEqual([]);
  });

  it('un formato inválido lo dice el campo: no se consulta', () => {
    escribir('12 34', LA_PAZ);
    vi.advanceTimersByTime(1000);
    expect(iam.preguntas).toEqual([]);
    expect(host.disponibilidad.estado()).toBe('sin-dato');
  });

  it('espera a que deje de escribir y pregunta una sola vez, por número, departamento y tipo', () => {
    host.departamento.setValue(LA_PAZ);
    host.documento.setValue('12');
    host.documento.setValue('123');
    host.documento.setValue('1234567');
    expect(host.disponibilidad.estado()).toBe('comprobando');
    vi.advanceTimersByTime(400);
    expect(iam.preguntas).toEqual([
      { number: '1234567', issuer: LA_PAZ, userType: 'PRACTITIONER' },
    ]);
    expect(host.disponibilidad.estado()).toBe('libre');
    expect(host.documento.valid).toBe(true);
  });

  it('documento tomado: el campo queda inválido con su propio mensaje', () => {
    iam.respuesta = () => of({ available: false });
    escribir('1234567', LA_PAZ);
    vi.advanceTimersByTime(400);
    expect(host.disponibilidad.estado()).toBe('tomado');
    expect(host.documento.hasError(DOCUMENTO_TOMADO)).toBe(true);
    host.documento.markAsTouched();
    expect(
      mensajeDeError(host.documento, { label: 'Cédula', mensajeDeError: 'formato' }),
    ).toContain('Ya hay un médico registrado con este documento');
  });

  it('cambiar el departamento vuelve a preguntar por el mismo número', () => {
    escribir('1234567', LA_PAZ);
    vi.advanceTimersByTime(400);
    host.departamento.setValue('dep-santa-cruz');
    vi.advanceTimersByTime(400);
    expect(iam.preguntas.map((p) => p.issuer)).toEqual([
      LA_PAZ,
      'dep-santa-cruz',
    ]);
  });

  it('si la consulta falla, no bloquea el campo y lo dice', () => {
    iam.respuesta = () => throwError(() => new HttpErrorResponse({ status: 429 }));
    escribir('1234567', LA_PAZ);
    vi.advanceTimersByTime(400);
    expect(host.documento.valid).toBe(true);
    expect(host.disponibilidad.estado()).toBe('sin-respuesta');
  });

  it('una respuesta vieja no pisa la nueva: la consulta anterior se cancela', () => {
    const lenta = new Subject<DocumentAvailability>();
    iam.respuesta = () => lenta;
    escribir('1111111', LA_PAZ);
    vi.advanceTimersByTime(400);
    iam.respuesta = () => of({ available: true });
    host.documento.setValue('2222222');
    vi.advanceTimersByTime(400);
    lenta.next({ available: false });
    expect(host.documento.hasError(DOCUMENTO_TOMADO)).toBe(false);
    expect(host.disponibilidad.estado()).toBe('libre');
  });

  it('reconoce el 409 del contrato y sólo ése', () => {
    const conMotivo = new HttpErrorResponse({
      status: 409,
      error: { code: 'CONFLICT', message: 'x', details: { reason: 'DOCUMENT_ALREADY_REGISTERED' } },
    });
    const otro409 = new HttpErrorResponse({
      status: 409,
      error: { code: 'CONFLICT', message: 'Ya existe una cuenta con ese correo' },
    });
    expect(esErrorDeDocumentoYaRegistrado(conMotivo)).toBe(true);
    expect(esErrorDeDocumentoYaRegistrado(otro409)).toBe(false);
    expect(esErrorDeDocumentoYaRegistrado(new Error('x'))).toBe(false);
  });
});
