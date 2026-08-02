import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { authFailureCategory, authMethodOf, loginFailureCategory } from './auth-tracing';
import { extensionOf, fileAttributes, sizeBucket } from './file-tracing';
import { countInvalidControls } from './form-tracing';

describe('auth-tracing', () => {
  it('deriva el método del discriminante del tipo, sin tocar el valor', () => {
    expect(authMethodOf({ kind: 'email' })).toBe('email');
    expect(authMethodOf({ kind: 'nationalId' })).toBe('national_id');
  });

  it.each([
    [0, 'network_error'],
    [403, 'invalid_credentials'],
    [422, 'validation_error'],
    [400, 'validation_error'],
    [429, 'rate_limited'],
    [500, 'server_error'],
    [503, 'server_error'],
    [418, 'unknown'],
  ])('traduce el estado %i a la categoría %s', (status, esperada) => {
    const error = new HttpErrorResponse({ status, statusText: 'x' });

    expect(authFailureCategory(error)).toBe(esperada);
  });

  it('un 401 general significa sesión vencida', () => {
    expect(authFailureCategory(new HttpErrorResponse({ status: 401 }))).toBe('expired_session');
  });

  it('un 401 en el login significa credenciales inválidas, que es otra cosa', () => {
    // Contarlos juntos confundiría un ataque de fuerza bruta con un pico de
    // sesiones caducadas.
    expect(loginFailureCategory(new HttpErrorResponse({ status: 401 }))).toBe(
      'invalid_credentials',
    );
  });

  it('lo que no es un error HTTP cae en «unknown» en vez de inventar', () => {
    expect(authFailureCategory(new Error('roto'))).toBe('unknown');
  });

  it('NUNCA mira el cuerpo: la categoría sale solo del estado', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: { message: 'el correo ana.perez@clinica.example ya existe' },
    });

    expect(authFailureCategory(error)).toBe('validation_error');
  });
});

describe('file-tracing', () => {
  it('NO devuelve el nombre del archivo', () => {
    const archivo = new File(['x'], 'analisis-ana-perez-marzo.pdf', { type: 'application/pdf' });

    const atributos = fileAttributes(archivo);

    // Ese nombre solo lleva un nombre completo y un diagnóstico.
    expect(JSON.stringify(atributos)).not.toContain('ana-perez');
    expect(JSON.stringify(atributos)).not.toContain('analisis');
    expect(atributos['file.extension']).toBe('pdf');
    expect(atributos['file.mime.type']).toBe('application/pdf');
  });

  it('NO devuelve el tamaño exacto: cruzado con la hora señalaría una subida', () => {
    const archivo = new File(['0123456789'], 'x.pdf');

    expect(JSON.stringify(fileAttributes(archivo))).not.toContain('10');
    expect(fileAttributes(archivo)['file.size.bucket']).toBe('0-1MB');
  });

  it.each([
    [500_000, '0-1MB'],
    [2_000_000, '1-5MB'],
    [10_000_000, '5-20MB'],
    [50_000_000, '20-100MB'],
    [500_000_000, '100MB+'],
  ])('mete %i bytes en la cubeta %s', (bytes, cubeta) => {
    expect(sizeBucket(bytes)).toBe(cubeta);
  });

  it('NO publica un apellido como si fuera una extensión', () => {
    // El caso que obligó a la lista blanca: sin ella, `perez` viajaba tal cual.
    expect(extensionOf('informe.de.ana.perez')).toBe('otra');
    expect(extensionOf('informe.de.ana.perez')).not.toContain('perez');
  });

  it('reconoce lo que este sistema sube de verdad, incluido DICOM', () => {
    expect(extensionOf('foto.JPG')).toBe('jpg');
    expect(extensionOf('estudio.dcm')).toBe('dcm');
    expect(extensionOf('receta.pdf')).toBe('pdf');
  });

  it('agrupa bajo «otra» lo que no está en la lista', () => {
    expect(extensionOf('script.exe')).toBe('otra');
  });

  it('dice «desconocida» cuando no hay extensión que leer', () => {
    expect(extensionOf('sin-extension')).toBe('desconocida');
    expect(extensionOf('.oculto')).toBe('desconocida');
    expect(extensionOf('termina-en-punto.')).toBe('desconocida');
  });

  it('marca como desconocido el tipo que el navegador no supo determinar', () => {
    expect(fileAttributes(new File(['x'], 'x.dat'))['file.mime.type']).toBe('desconocido');
  });
});

describe('countInvalidControls', () => {
  it('cuenta los controles inválidos, no dice cuáles', () => {
    const form = new FormGroup({
      identifier: new FormControl('', Validators.required),
      password: new FormControl('', Validators.required),
      mfaCode: new FormControl('123'),
    });

    expect(countInvalidControls(form)).toBe(2);
  });

  it('devuelve cero con el formulario completo', () => {
    const form = new FormGroup({
      identifier: new FormControl('ana', Validators.required),
    });

    expect(countInvalidControls(form)).toBe(0);
  });

  it('baja por grupos anidados', () => {
    const form = new FormGroup({
      datos: new FormGroup({
        nombre: new FormControl('', Validators.required),
        apellido: new FormControl('', Validators.required),
      }),
      acepta: new FormControl(true),
    });

    expect(countInvalidControls(form)).toBe(2);
  });

  it('baja por arreglos', () => {
    const form = new FormArray([
      new FormControl('', Validators.required),
      new FormControl('ok', Validators.required),
    ]);

    expect(countInvalidControls(form)).toBe(1);
  });
});
