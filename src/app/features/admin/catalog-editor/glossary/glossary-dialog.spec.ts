import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdminGlossaryTerm, GlossaryAudience } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { GlossaryDialog } from './glossary-dialog';

const TERMINO: AdminGlossaryTerm = {
  conceptId: 'gl-ayuno',
  slug: 'ayuno',
  code: 'AYUNO',
  display: 'Ayuno',
  nameEs: 'Ayuno',
  state: 'active',
  audience: 'patient',
  text: { es: 'No comer antes del examen.' },
  rowVersion: 2,
  updatedAt: '2026-10-31T10:00:00.000Z',
};

interface Interno {
  slug: { set(v: string): void };
  display: { set(v: string): void };
  nameEs: { set(v: string): void };
  textEs: { set(v: string): void };
  textEn: { set(v: string): void };
  errores(): Record<string, string>;
  aviso(): string | null;
  conflicto(): boolean;
  guardar(): void;
}

describe('GlossaryDialog', () => {
  let fixture: ComponentFixture<GlossaryDialog>;
  let http: HttpTestingController;
  let guardados: AdminGlossaryTerm[];
  const interno = () => fixture.componentInstance as unknown as Interno;

  function montar(termino: AdminGlossaryTerm | null, audience: GlossaryAudience = 'patient'): void {
    TestBed.configureTestingModule({ imports: [GlossaryDialog], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GlossaryDialog);
    fixture.componentRef.setInput('audience', audience);
    fixture.componentRef.setInput('termino', termino);
    guardados = [];
    fixture.componentInstance.saved.subscribe((t) => guardados.push(t));
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('alta inválida: marca identificador, término, nombre y texto sin llamar a la API', () => {
    montar(null);
    interno().slug.set('Mal Slug');
    interno().guardar();
    expect(Object.keys(interno().errores()).sort()).toEqual(['display', 'nameEs', 'slug', 'text']);
    http.expectNone('/admin/catalogs/glossary');
  });

  it('alta correcta: manda la audiencia y el texto; el inglés sólo si se escribió', () => {
    montar(null, 'professional');
    interno().slug.set('ecografia');
    interno().display.set('Ecografía');
    interno().nameEs.set('Ecografía');
    interno().textEs.set('Estudio por ultrasonido.');
    interno().guardar();
    const req = http.expectOne('/admin/catalogs/glossary');
    expect(req.request.body).toEqual({ slug: 'ecografia', display: 'Ecografía', nameEs: 'Ecografía', audience: 'professional', text: { es: 'Estudio por ultrasonido.' } });
    req.flush({ ...TERMINO, slug: 'ecografia' });
    expect(guardados.length).toBe(1);
  });

  it('un identificador repetido con otro contenido se muestra en su campo', () => {
    montar(null);
    interno().slug.set('ayuno');
    interno().display.set('Ayuno');
    interno().nameEs.set('Ayuno');
    interno().textEs.set('Otro texto.');
    interno().guardar();
    http.expectOne('/admin/catalogs/glossary').flush(
      { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'GLOSSARY_TERM_ALREADY_EXISTS' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(interno().errores()['slug']).toMatch(/Ya existe/);
    expect(guardados).toEqual([]);
  });

  it('edición: manda versión y audiencia y sólo lo que cambió; sin cambios no manda nada', () => {
    montar(TERMINO);
    interno().guardar();
    http.expectNone('/admin/catalogs/glossary/gl-ayuno');
    expect(interno().aviso()).toBe('No hay cambios para guardar.');
    interno().textEs.set('Pasar horas sin comer antes del examen.');
    interno().guardar();
    const req = http.expectOne('/admin/catalogs/glossary/gl-ayuno');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ expectedRowVersion: 2, audience: 'patient', text: { es: 'Pasar horas sin comer antes del examen.' } });
    req.flush({ ...TERMINO, rowVersion: 3 });
    expect(guardados[0]!.rowVersion).toBe(3);
  });

  it('409 de versión conserva lo escrito y marca el conflicto', () => {
    montar(TERMINO);
    interno().textEs.set('Mi texto');
    interno().guardar();
    http.expectOne('/admin/catalogs/glossary/gl-ayuno').flush(
      { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'GLOSSARY_TERM_VERSION_MISMATCH', details: { expected: 2, actual: 3 } },
      { status: 409, statusText: 'Conflict' },
    );
    expect(interno().conflicto()).toBe(true);
    expect(guardados).toEqual([]);
  });

  it('403 de un rol que no es superadministración se explica sin el texto crudo', () => {
    montar(TERMINO);
    interno().nameEs.set('Otro nombre');
    interno().guardar();
    http.expectOne('/admin/catalogs/glossary/gl-ayuno').flush({ statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
    expect(interno().aviso()).toMatch(/no tiene permiso/i);
  });
});
