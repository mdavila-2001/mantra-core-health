import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { VitrinaMinima } from './vitrina-minima';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Lo que estas pruebas fijan.
 *
 * Cuatro reglas que no se leen en la plantilla: que la vitrina nace **en
 * público** —crearla en privado dejaría a quien la acaba de crear con el mismo
 * rechazo que lo trajo—, que la foto **es obligatoria sólo para grupos**, que
 * el enlace **se propone desde el nombre** sin obligar a nadie a inventar una
 * URL, y que **sin organización activa no se pide nada**.
 */
describe('VitrinaMinima', () => {
  let fixture: ComponentFixture<VitrinaMinima>;
  let http: HttpTestingController;

  const tenantId = signal<string | null>('t-1');
  const displayName = signal<string | null>('Dra. Lucía Salas');

  const vitrinaCreada = {
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'tg-1',
    slug: 'dra-lucia-salas',
    displayName: 'Dra. Lucía Salas',
    avatarFileId: 'file-1',
    visibility: 'PUBLIC',
    statusConceptId: 'st-1',
  };

  const interno = <T,>(nombre: string): T => {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  };

  /**
   * Igual que {@link interno} pero **sin atar** el método al componente: un
   * signal es una función, y atarlo se lleva puesto su `.set`.
   */
  const señal = <T,>(nombre: string): WritableSignal<T> =>
    (fixture.componentInstance as unknown as Record<string, WritableSignal<T>>)[nombre]!;

  const montar = (motivo: 'articulos' | 'grupos' = 'articulos'): void => {
    fixture = TestBed.createComponent(VitrinaMinima);
    fixture.componentRef.setInput('motivo', motivo);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    tenantId.set('t-1');
    displayName.set('Dra. Lucía Salas');

    await TestBed.configureTestingModule({
      imports: [VitrinaMinima],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { activeTenantId: tenantId, displayName } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('propone el enlace a partir del nombre, sin tildes ni mayúsculas', () => {
    montar();

    expect(interno<() => string>('slug')()).toBe('dra-lucia-salas');
  });

  it('el enlace escrito a mano deja de seguir al nombre', () => {
    montar();
    interno<(v: string) => void>('alEscribirNombre')('Dra. Lucía Salas');

    // Lo toca a mano…
    señal<string>('slug').set('lucia-cardio');
    // …y el nombre cambia después.
    interno<(v: string) => void>('alEscribirNombre')('Dra. Lucía Salas Fuentes');

    expect(interno<() => string>('slug')()).toBe('lucia-cardio');
  });

  it('la crea en PÚBLICO: es lo que el servidor comprueba', () => {
    montar();

    interno<() => void>('crear')();

    const req = http.expectOne('/community/profiles/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      slug: 'dra-lucia-salas',
      displayName: 'Dra. Lucía Salas',
      visibility: 'PUBLIC',
    });
    req.flush(vitrinaCreada);
  });

  it('avisa de la vitrina creada a quien la pidió', () => {
    montar();
    let recibida: { id?: string } | null = null;
    fixture.componentInstance.creada.subscribe((perfil) => (recibida = perfil));

    interno<() => void>('crear')();
    http.expectOne('/community/profiles/me').flush(vitrinaCreada);

    expect(recibida).toMatchObject({ id: 'pp-1' });
  });

  it('con foto la sube primero y manda su id en la misma escritura', () => {
    montar();
    señal<readonly File[]>('foto').set([
      new File(['x'], 'yo.png', { type: 'image/png' }),
    ]);

    interno<() => void>('crear')();

    const subida = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'file-9' });

    const req = http.expectOne('/community/profiles/me');
    expect(req.request.body).toMatchObject({ avatarFileId: 'file-9', visibility: 'PUBLIC' });
    req.flush(vitrinaCreada);
  });

  it('si la subida de la foto falla, la vitrina NO se crea', () => {
    montar();
    señal<readonly File[]>('foto').set([
      new File(['x'], 'yo.png', { type: 'image/png' }),
    ]);

    interno<() => void>('crear')();
    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    expect(http.match('/community/profiles/me')).toHaveLength(0);
    expect(interno<() => boolean>('guardando')()).toBe(false);
  });

  /**
   * Un grupo público exige nombre, foto y visibilidad pública: crear la vitrina
   * sin foto dejaría a la persona con el mismo rechazo que la trajo hasta acá.
   */
  it('para un grupo la foto es obligatoria; para un artículo no', () => {
    montar('grupos');
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);

    señal<readonly File[]>('foto').set([
      new File(['x'], 'yo.png', { type: 'image/png' }),
    ]);
    expect(interno<() => boolean>('puedeCrear')()).toBe(true);

    montar('articulos');
    expect(interno<() => boolean>('puedeCrear')()).toBe(true);
  });

  it('un enlace con mayúsculas o espacios no deja crear', () => {
    montar();
    señal<string>('slug').set('Mi Vitrina');

    expect(interno<() => boolean>('slugValido')()).toBe(false);
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);
  });

  it('sin organización activa no se pide nada', () => {
    tenantId.set(null);
    montar();

    expect(interno<() => boolean>('sinOrganizacion')()).toBe(true);
    interno<() => void>('crear')();
    expect(http.match('/community/profiles/me')).toHaveLength(0);
  });

  it('el enlace ya tomado se explica, no se repite «probá de nuevo»', () => {
    montar();
    interno<() => void>('crear')();

    http
      .expectOne('/community/profiles/me')
      .flush({ message: 'tomado' }, { status: 409, statusText: 'Conflict' });

    expect(interno<() => string>('error')()).toContain('ya lo usa otra persona');
  });
});
