import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdminCatalogPage, AdminGlossaryTerm } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { GlossaryTab } from './glossary-tab';

function termino(slug: string, extra: Partial<AdminGlossaryTerm> = {}): AdminGlossaryTerm {
  return {
    conceptId: `gl-${slug}`,
    slug,
    code: slug.toUpperCase(),
    display: slug,
    nameEs: slug,
    state: 'active',
    audience: 'patient',
    text: { es: `Texto de ${slug}` },
    rowVersion: 1,
    updatedAt: '2026-10-31T10:00:00.000Z',
    ...extra,
  };
}

const pagina = (items: AdminGlossaryTerm[], nextCursor: string | null = null): AdminCatalogPage<AdminGlossaryTerm> => ({ items, count: items.length, limit: 20, nextCursor });

interface Interno {
  ejecutar(fila: { id: string; item: AdminGlossaryTerm }, accion: string): void;
  elegirAudiencia(a: 'patient' | 'professional'): void;
  abrirAlta(): void;
  aviso(): { tono: string; texto: string } | null;
  lista(): { status: string };
}

describe('GlossaryTab', () => {
  let fixture: ComponentFixture<GlossaryTab>;
  let http: HttpTestingController;
  const esLista = (r: { url: string }) => r.url === '/admin/catalogs/glossary';
  const interno = () => fixture.componentInstance as unknown as Interno;
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  async function montar(): Promise<void> {
    await TestBed.configureTestingModule({ imports: [GlossaryTab], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(GlossaryTab);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('pide siempre con audiencia (obligatoria) y muestra el texto de esa audiencia', async () => {
    await montar();
    const req = http.expectOne(esLista);
    expect(req.request.params.get('audience')).toBe('patient');
    req.flush(pagina([termino('glucemia')]));
    fixture.detectChanges();
    expect(texto()).toContain('Texto de glucemia');
    expect(texto()).toContain('Vigente');
  });

  it('una audiencia sin texto lo dice y no lo inventa', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([termino('solo-llano', { text: null })]));
    fixture.detectChanges();
    expect(texto()).toContain('Sin texto para esta audiencia todavía');
  });

  it('cambiar de audiencia vuelve a pedir y cambia el rótulo de la columna', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([termino('a')]));
    interno().elegirAudiencia('professional');
    const req = http.expectOne(esLista);
    expect(req.request.params.get('audience')).toBe('professional');
    req.flush(pagina([termino('a', { audience: 'professional' })]));
    fixture.detectChanges();
    expect(texto()).toContain('Definición clínica');
  });

  it('S3: sin términos explica por qué y qué hacer', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([]));
    fixture.detectChanges();
    expect(interno().lista().status).toBe('empty');
    expect(texto()).toContain('Use «Nuevo término»');
  });

  it('retirar manda versión y audiencia, relee y avisa', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([termino('glucemia')]));
    interno().ejecutar({ id: 'gl-glucemia', item: termino('glucemia') }, 'deactivate');
    const req = http.expectOne('/admin/catalogs/glossary/gl-glucemia/deactivate');
    expect(req.request.body).toEqual({ expectedRowVersion: 1, audience: 'patient' });
    req.flush(termino('glucemia', { state: 'retired', rowVersion: 2 }));
    http.expectOne(esLista).flush(pagina([termino('glucemia', { state: 'retired', rowVersion: 2 })]));
    fixture.detectChanges();
    expect(interno().aviso()?.texto).toContain('quedó retirado (versión 2)');
    expect(texto()).toContain('Retirado');
  });

  it('un rol que sólo lee recibe 403 al retirar: se explica, no se oculta', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([termino('glucemia')]));
    interno().ejecutar({ id: 'gl-glucemia', item: termino('glucemia') }, 'deactivate');
    http.expectOne('/admin/catalogs/glossary/gl-glucemia/deactivate').flush({ statusCode: 403, code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    expect(interno().aviso()?.tono).toBe('error');
    expect(interno().aviso()?.texto).toMatch(/no tiene permiso/i);
  });

  it('«Nuevo término» abre el modal de alta', async () => {
    await montar();
    http.expectOne(esLista).flush(pagina([]));
    interno().abrirAlta();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-glossary-dialog')).not.toBeNull();
  });
});
