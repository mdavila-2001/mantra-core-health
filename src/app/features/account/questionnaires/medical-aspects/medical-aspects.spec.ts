import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import { MedicalAspects } from './medical-aspects';

/**
 * «Aspectos médicos» — lo que el paciente declara de su salud (FT-22).
 *
 * Lo que estas pruebas fijan es lo que el pedido llamaba «editables y
 * persistentes»: que el formulario llegue lleno con lo declarado, que guardar
 * mande TODOS los campos —incluidos los vaciados, que es como se borra—, que la
 * pantalla se repinte con lo que devolvió el servidor y no con lo tipeado, y que
 * un fallo de red no se lleve puesto lo escrito.
 */

const RUTA = '/clinical/me/medical-aspects';

/** Doble mínimo de la sesión: lo único que el componente le pide es el perfil. */
function authDoble(patientProfileId: string | null) {
  return { patientProfileId: signal(patientProfileId) };
}

describe('MedicalAspects', () => {
  let fixture: ComponentFixture<MedicalAspects>;
  let http: HttpTestingController;

  function configurar(perfil: string | null = 'pp-1'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authDoble(perfil) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MedicalAspects);
    fixture.detectChanges();
  }

  function responder(aspectos: object): void {
    http.expectOne((r) => r.url === RUTA && r.method === 'GET').flush(aspectos);
    fixture.detectChanges();
  }

  function campo(clave: string): HTMLTextAreaElement | HTMLInputElement {
    const host = fixture.nativeElement.querySelector(`[data-testid="aspecto-${clave}"]`);
    return host.querySelector('textarea, input') as HTMLTextAreaElement | HTMLInputElement;
  }

  /** Escribe en un campo como lo haría una persona. */
  function escribir(clave: string, texto: string): void {
    const control = campo(clave);
    control.value = texto;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function boton(testid: string): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  }

  /**
   * Si el botón está apagado.
   *
   * `aria-disabled` y no el atributo nativo: el sistema de diseño lo hace así a
   * propósito, para que un botón apagado siga siendo alcanzable con el teclado y
   * pueda explicar por qué no se puede pulsar.
   */
  function apagado(testid: string): boolean {
    return boton(testid)?.getAttribute('aria-disabled') === 'true';
  }

  afterEach(() => http.verify());

  /** No hay a quién más pedirle: el servidor resuelve al titular por la sesión. */
  it('lee los aspectos del titular sin mandar ningún identificador', () => {
    configurar();

    const pedido = http.expectOne((r) => r.url === RUTA && r.method === 'GET');
    expect(pedido.request.url).not.toContain('pp-1');
    pedido.flush({});
  });

  it('una cuenta sin ficha de paciente no pide nada', () => {
    configurar(null);

    http.expectNone(() => true);
    expect(fixture.nativeElement.textContent).toContain('Esta sección es para pacientes');
  });

  /** FT-22-R03 · el formulario llega con lo declarado, no en blanco. */
  it('muestra lo ya declarado en sus campos', () => {
    configurar();
    responder({ bloodType: 'O+', allergiesText: 'Penicilina', updatedAt: '2026-09-01T10:00:00Z' });

    expect(campo('bloodType').value).toBe('O+');
    expect(campo('allergiesText').value).toBe('Penicilina');
    expect(fixture.nativeElement.textContent).toContain('Guardado por última vez');
  });

  it('quien nunca declaró nada recibe una invitación, no siete campos mudos', () => {
    configurar();
    responder({});

    expect(fixture.nativeElement.querySelector('[data-testid="aspectos-vacio"]')).not.toBeNull();
  });

  /** Un «Guardar» habilitado sin nada que guardar enseña a ignorarlo. */
  it('Guardar está deshabilitado mientras no haya cambios', () => {
    configurar();
    responder({ bloodType: 'O+' });

    expect(apagado('aspectos-guardar')).toBe(true);

    escribir('bloodType', 'A-');
    expect(apagado('aspectos-guardar')).toBe(false);
  });

  /**
   * FT-22-R04. Guardar persiste, y la pantalla se repinta con lo que el
   * servidor devolvió —no con lo tipeado—: si el servidor normalizó algo, lo que
   * se ve tiene que ser lo que quedó guardado.
   */
  it('guardar manda todos los campos y repinta con la respuesta del servidor', () => {
    configurar();
    responder({ bloodType: 'O+', allergiesText: 'Penicilina' });

    escribir('bloodType', 'a-');
    // Vaciar un campo es como se borra: tiene que viajar en `''`, no ausente.
    escribir('allergiesText', '');
    boton('aspectos-guardar')?.click();
    fixture.detectChanges();

    const pedido = http.expectOne((r) => r.url === RUTA && r.method === 'PUT');
    const cuerpo = pedido.request.body as Record<string, string>;
    expect(cuerpo['bloodType']).toBe('a-');
    expect(cuerpo['allergiesText']).toBe('');
    expect(Object.keys(cuerpo).length).toBe(7);

    pedido.flush({ bloodType: 'A-', updatedAt: '2026-09-06T12:00:00Z' });
    fixture.detectChanges();

    // Lo del servidor, en mayúscula, y no la «a-» que se tipeó.
    expect(campo('bloodType').value).toBe('A-');
    expect(campo('allergiesText').value).toBe('');
    expect(apagado('aspectos-guardar')).toBe(true);
  });

  /** Descartar vuelve a lo confirmado por el servidor, no a un formulario vacío. */
  it('descartar cambios restaura lo último guardado', () => {
    configurar();
    responder({ bloodType: 'O+' });

    escribir('bloodType', 'AB+');
    boton('aspectos-cancelar')?.click();
    fixture.detectChanges();

    expect(campo('bloodType').value).toBe('O+');
    expect(boton('aspectos-cancelar')).toBeNull();
  });

  /** Si falla la red, lo escrito sigue en pantalla: se reintenta, no se retipea. */
  it('un fallo al guardar no se lleva puesto lo escrito', () => {
    configurar();
    responder({ bloodType: 'O+' });

    escribir('bloodType', 'B+');
    boton('aspectos-guardar')?.click();
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === RUTA && r.method === 'PUT')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(campo('bloodType').value).toBe('B+');
    expect(apagado('aspectos-guardar')).toBe(false);
  });

  /** Una lectura caída se dice y se ofrece reintentar, en vez de quedar en blanco. */
  it('si la lectura falla, lo dice y ofrece reintentar', () => {
    configurar();
    http
      .expectOne((r) => r.url === RUTA && r.method === 'GET')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos traer tus aspectos médicos');
  });
});
