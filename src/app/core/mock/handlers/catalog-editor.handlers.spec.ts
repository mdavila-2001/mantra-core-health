import { HttpHeaders } from '@angular/common/http';

import type {
  AdminCatalogPage,
  AdminGlossaryTerm,
  AdminServiceItem,
  ServiceScopes,
} from '../../data-access/admin-portal/catalog-editor.types';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarEditorDeCatalogos } from './catalog-editor.handlers';

describe('editor de catálogos simulado: mismas reglas que /admin/catalogs/*', () => {
  const superadmin = buscarUsuario('superadmin')!;
  const seguridad: MockUser = { ...superadmin, roles: ['SECURITY_ADMIN'] };
  const paciente = buscarUsuario('paciente')!;

  function nuevoRouter() {
    const router = new MockRouter();
    registrarEditorDeCatalogos(router);
    return (metodo: MockMethod, ruta: string, opciones: { query?: Record<string, string>; body?: unknown; user?: MockUser | null } = {}) => {
      const [path, texto = ''] = ruta.split('?');
      const match = router.match(metodo, path!);
      if (match === null) throw new Error(`No existe ${metodo} ${path}`);
      const respuesta = match.handler({
        method: metodo,
        path: path!,
        params: match.params,
        query: new URLSearchParams(opciones.query ?? texto),
        body: opciones.body ?? null,
        headers: new HttpHeaders(),
        user: opciones.user === undefined ? superadmin : opciones.user,
      } satisfies MockRequest);
      return { status: isMockReply(respuesta) ? respuesta.status : 200, body: (isMockReply(respuesta) ? respuesta.body : respuesta) as unknown };
    };
  }

  describe('autorización (la API manda, no la pantalla)', () => {
    it('sin sesión 401 y con rol insuficiente 403, también en escritura', () => {
      const pedir = nuevoRouter();
      expect(pedir('GET', '/admin/catalogs/services', { user: null }).status).toBe(401);
      expect(pedir('GET', '/admin/catalogs/services', { user: paciente }).status).toBe(403);
      expect(pedir('POST', '/admin/catalogs/services', { user: paciente, body: {} }).status).toBe(403);
      expect(pedir('GET', '/admin/catalogs/glossary', { user: paciente, query: { audience: 'patient' } }).status).toBe(403);
    });

    it('el glosario lo lee la seguridad pero sólo lo escribe la superadministración', () => {
      const pedir = nuevoRouter();
      expect(pedir('GET', '/admin/catalogs/glossary', { user: seguridad, query: { audience: 'patient' } }).status).toBe(200);
      const alta = { slug: 'nuevo-termino', display: 'Nuevo', nameEs: 'Nuevo', audience: 'patient', text: { es: 'Texto' } };
      expect(pedir('POST', '/admin/catalogs/glossary', { user: seguridad, body: alta }).status).toBe(403);
      expect(pedir('POST', '/admin/catalogs/glossary', { user: superadmin, body: alta }).status).toBe(201);
    });
  });

  describe('servicios', () => {
    it('correcto: el alcance trae tipos, prácticas y monedas', () => {
      const pedir = nuevoRouter();
      const alcance = pedir('GET', '/admin/catalogs/services/scopes').body as ServiceScopes;
      expect(alcance.types.length).toBeGreaterThan(1);
      expect(alcance.currencies.map((m) => m.code)).toEqual(['BOB', 'USD']);
    });

    it('filtra por tipo de organización y pagina con cursor determinista', () => {
      const pedir = nuevoRouter();
      const clinicas = pedir('GET', '/admin/catalogs/services', { query: { practiceTypeConceptId: 'tipo-clinica' } }).body as AdminCatalogPage<AdminServiceItem>;
      expect(clinicas.items.length).toBe(3);
      expect(clinicas.items.every((s) => s.practiceTypeConceptId === 'tipo-clinica')).toBe(true);
      const primera = pedir('GET', '/admin/catalogs/services', { query: { limit: '2' } }).body as AdminCatalogPage<AdminServiceItem>;
      expect(primera.nextCursor).toBe('2');
      const segunda = pedir('GET', '/admin/catalogs/services', { query: { limit: '2', cursor: primera.nextCursor! } }).body as AdminCatalogPage<AdminServiceItem>;
      expect(segunda.items.map((s) => s.id)).not.toContain(primera.items[0]!.id);
    });

    it('límite: un parámetro no declarado, un limit fuera de rango y una práctica ajena se rechazan', () => {
      const pedir = nuevoRouter();
      expect(pedir('GET', '/admin/catalogs/services', { query: { rowVersion: '1' } }).status).toBe(400);
      expect(pedir('GET', '/admin/catalogs/services', { query: { limit: '201' } }).status).toBe(400);
      expect(pedir('GET', '/admin/catalogs/services', { query: { practiceId: 'otra-organizacion' } }).status).toBe(404);
      expect(pedir('GET', '/admin/catalogs/services/no-existe').status).toBe(404);
    });

    it('alta: 201, luego idempotente (200 y el mismo id) y 409 si el código se repite con datos distintos', () => {
      const pedir = nuevoRouter();
      const cuerpo = { practiceId: 'pr-lab-1', code: 'GLUCOSA', name: 'Glucosa en ayunas', defaultPrice: '40.00' };
      const creado = pedir('POST', '/admin/catalogs/services', { body: cuerpo });
      expect(creado.status).toBe(201);
      const repetido = pedir('POST', '/admin/catalogs/services', { body: cuerpo });
      expect(repetido.status).toBe(200);
      expect((repetido.body as AdminServiceItem).id).toBe((creado.body as AdminServiceItem).id);
      const distinto = pedir('POST', '/admin/catalogs/services', { body: { ...cuerpo, defaultPrice: '41.00' } });
      expect(distinto.status).toBe(409);
      expect((distinto.body as { reason: string }).reason).toBe('SERVICE_CATALOG_CODE_ALREADY_EXISTS');
    });

    it('inválido: campo no declarado 400, precio mal formado 400 con campo, precio cero 422', () => {
      const pedir = nuevoRouter();
      const base = { practiceId: 'pr-lab-1', code: 'X', name: 'X', defaultPrice: '10.00' };
      expect(pedir('POST', '/admin/catalogs/services', { body: { ...base, rowVersion: 1 } }).status).toBe(400);
      const malPrecio = pedir('POST', '/admin/catalogs/services', { body: { ...base, defaultPrice: '10,5' } });
      expect(malPrecio.status).toBe(400);
      expect(JSON.stringify(malPrecio.body)).toContain('defaultPrice');
      const cero = pedir('POST', '/admin/catalogs/services', { body: { ...base, defaultPrice: '0.00' } });
      expect(cero.status).toBe(422);
      expect((cero.body as { reason: string }).reason).toBe('SERVICE_CATALOG_PRICE_NOT_POSITIVE');
      expect(pedir('POST', '/admin/catalogs/services', { body: { ...base, practiceId: 'ajena' } }).status).toBe(404);
    });

    it('edición: exige versión, sube la versión y devuelve 409 con expected/actual si está vencida (sin pisar)', () => {
      const pedir = nuevoRouter();
      expect(pedir('PATCH', '/admin/catalogs/services/srv-1', { body: { name: 'Sin versión' } }).status).toBe(400);
      const ok = pedir('PATCH', '/admin/catalogs/services/srv-1', { body: { expectedRowVersion: 1, name: 'Consulta general v2', defaultPrice: '155.50' } });
      expect(ok.status).toBe(200);
      expect((ok.body as AdminServiceItem).rowVersion).toBe(2);
      expect((ok.body as AdminServiceItem).defaultPrice).toBe('155.50');
      const vencida = pedir('PATCH', '/admin/catalogs/services/srv-1', { body: { expectedRowVersion: 1, name: 'Pisada' } });
      expect(vencida.status).toBe(409);
      expect((vencida.body as { details: { expected: number; actual: number } }).details).toMatchObject({ expected: 1, actual: 2 });
      expect((pedir('GET', '/admin/catalogs/services/srv-1').body as AdminServiceItem).name).toBe('Consulta general v2');
    });

    it('desactivar y reactivar son idempotentes: repetir no sube la versión; no existe DELETE', () => {
      const pedir = nuevoRouter();
      const baja = pedir('POST', '/admin/catalogs/services/srv-2/deactivate', { body: { expectedRowVersion: 1 } }).body as AdminServiceItem;
      expect(baja).toMatchObject({ isActive: false, rowVersion: 2 });
      const otra = pedir('POST', '/admin/catalogs/services/srv-2/deactivate', { body: { expectedRowVersion: 2 } }).body as AdminServiceItem;
      expect(otra.rowVersion).toBe(2);
      const alta = pedir('POST', '/admin/catalogs/services/srv-2/reactivate', { body: { expectedRowVersion: 2 } }).body as AdminServiceItem;
      expect(alta).toMatchObject({ isActive: true, rowVersion: 3 });
      expect(() => pedir('DELETE', '/admin/catalogs/services/srv-2')).toThrow();
    });
  });

  describe('glosario', () => {
    const lista = (pedir: ReturnType<typeof nuevoRouter>, audience: string, extra: Record<string, string> = {}) =>
      pedir('GET', '/admin/catalogs/glossary', { query: { audience, ...extra } });

    it('la audiencia es obligatoria y cada una ve su propio texto', () => {
      const pedir = nuevoRouter();
      expect(pedir('GET', '/admin/catalogs/glossary').status).toBe(400);
      expect(lista(pedir, 'otra').status).toBe(400);
      const llano = (lista(pedir, 'patient').body as AdminCatalogPage<AdminGlossaryTerm>).items.find((t) => t.slug === 'glucemia')!;
      const clinico = (lista(pedir, 'professional').body as AdminCatalogPage<AdminGlossaryTerm>).items.find((t) => t.slug === 'glucemia')!;
      expect(llano.text?.es).not.toBe(clinico.text?.es);
    });

    it('filtra por estado y no inventa texto: una audiencia sin texto devuelve null', () => {
      const pedir = nuevoRouter();
      const retirados = (lista(pedir, 'patient', { state: 'retired' }).body as AdminCatalogPage<AdminGlossaryTerm>).items;
      expect(retirados.map((t) => t.slug)).toEqual(['termino-retirado']);
      pedir('POST', '/admin/catalogs/glossary', { body: { slug: 'solo-llano', display: 'Solo llano', nameEs: 'Solo llano', audience: 'patient', text: { es: 'Texto' } } });
      const profesional = (lista(pedir, 'professional', { q: 'solo-llano' }).body as AdminCatalogPage<AdminGlossaryTerm>).items[0]!;
      expect(profesional.text).toBeNull();
    });

    it('alta idempotente por slug y 409 si el contenido difiere; slug inválido 400', () => {
      const pedir = nuevoRouter();
      const alta = { slug: 'ecografia', display: 'Ecografía', nameEs: 'Ecografía', audience: 'patient', text: { es: 'Imagen con ondas de sonido.' } };
      expect(pedir('POST', '/admin/catalogs/glossary', { body: alta }).status).toBe(201);
      expect(pedir('POST', '/admin/catalogs/glossary', { body: alta }).status).toBe(200);
      const distinto = pedir('POST', '/admin/catalogs/glossary', { body: { ...alta, text: { es: 'Otra cosa.' } } });
      expect(distinto.status).toBe(409);
      expect((distinto.body as { reason: string }).reason).toBe('GLOSSARY_TERM_ALREADY_EXISTS');
      expect(pedir('POST', '/admin/catalogs/glossary', { body: { ...alta, slug: 'Mal Slug' } }).status).toBe(400);
    });

    it('edición sólo toca la audiencia pedida y respeta la versión', () => {
      const pedir = nuevoRouter();
      const edit = pedir('PATCH', '/admin/catalogs/glossary/gl-ayuno', { body: { expectedRowVersion: 1, audience: 'patient', text: { es: 'Nuevo texto llano.' } } });
      expect(edit.status).toBe(200);
      expect((edit.body as AdminGlossaryTerm).rowVersion).toBe(2);
      const clinico = pedir('GET', '/admin/catalogs/glossary/gl-ayuno', { query: { audience: 'professional' } }).body as AdminGlossaryTerm;
      expect(clinico.text?.es).toContain('Abstinencia');
      const vencida = pedir('PATCH', '/admin/catalogs/glossary/gl-ayuno', { body: { expectedRowVersion: 1, audience: 'patient', nameEs: 'Pisado' } });
      expect(vencida.status).toBe(409);
      expect(pedir('PATCH', '/admin/catalogs/glossary/gl-ayuno', { body: { expectedRowVersion: 2, audience: 'patient' } }).status).toBe(400);
    });

    it('retirar y reactivar; un término de otro catálogo es 404 con su razón', () => {
      const pedir = nuevoRouter();
      const retirado = pedir('POST', '/admin/catalogs/glossary/gl-glucemia/deactivate', { body: { expectedRowVersion: 1, audience: 'patient' } }).body as AdminGlossaryTerm;
      expect(retirado.state).toBe('retired');
      const vuelto = pedir('POST', '/admin/catalogs/glossary/gl-glucemia/reactivate', { body: { expectedRowVersion: 2, audience: 'patient' } }).body as AdminGlossaryTerm;
      expect(vuelto).toMatchObject({ state: 'active', rowVersion: 3 });
      const ajeno = pedir('GET', '/admin/catalogs/glossary/concepto-de-otro-catalogo', { query: { audience: 'patient' } });
      expect(ajeno.status).toBe(404);
      expect((ajeno.body as { reason: string }).reason).toBe('GLOSSARY_TERM_NOT_FOUND');
    });
  });

  it('cada registro del router arranca de cero: un cambio de una prueba no contamina a otra', () => {
    const a = nuevoRouter();
    a('PATCH', '/admin/catalogs/services/srv-3', { body: { expectedRowVersion: 1, name: 'Cambiado' } });
    const b = nuevoRouter();
    expect((b('GET', '/admin/catalogs/services/srv-3').body as AdminServiceItem).rowVersion).toBe(1);
  });
});
