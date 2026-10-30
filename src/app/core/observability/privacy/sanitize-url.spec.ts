import { apiRouteTemplate, hostOf, sanitizeUrl, schemeOf } from './sanitize-url';

/**
 * Lo que estas pruebas protegen no es un formato: es que **el token del correo
 * nunca llegue a Jaeger**.
 *
 * Dos rutas de esta aplicación reciben una credencial de un solo uso por query
 * string (`/auth/verify-email?token=…`, `/auth/reset-password?token=…`). Si alguna
 * vez alguien «mejora» esta función para conservar los parámetros seguros, esta
 * prueba tiene que fallar.
 */
describe('sanitizeUrl', () => {
  it('descarta el query string entero, que es donde viaja el token del correo', () => {
    expect(sanitizeUrl('/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.abc.def')).toBe(
      '/auth/verify-email',
    );
  });

  it('descarta también el de la ruta de nueva contraseña', () => {
    const limpia = sanitizeUrl('/auth/reset-password?token=abc123&origen=correo');

    expect(limpia).toBe('/auth/reset-password');
    expect(limpia).not.toContain('abc123');
  });

  it('descarta el fragmento', () => {
    expect(sanitizeUrl('/dashboard#seccion-privada')).toBe('/dashboard');
  });

  it('conserva la ruta de una URL absoluta y descarta el resto', () => {
    expect(sanitizeUrl('https://api.ejemplo.com/iam/auth/login?x=1')).toBe('/iam/auth/login');
  });

  it('no deja pasar credenciales embebidas en la URL', () => {
    expect(sanitizeUrl('https://ana:secreta@api.ejemplo.com/perfil')).toBe('/perfil');
  });

  it('descarta entera una URL que no se puede analizar, en vez de recortarla a mano', () => {
    // Recortar algo con forma desconocida es cómo se filtra un token.
    expect(sanitizeUrl('http://[esto-no-es-una-url')).toBe('/');
  });

  it('tolera lo que no es texto sin lanzar: rompería un guard', () => {
    expect(sanitizeUrl(undefined as unknown as string)).toBe('/');
    expect(sanitizeUrl('')).toBe('/');
  });
});

describe('apiRouteTemplate', () => {
  it('agrupa por endpoint sustituyendo los UUID', () => {
    expect(apiRouteTemplate('/profiles/3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(
      '/profiles/:id',
    );
  });

  it('sustituye también los identificadores numéricos', () => {
    expect(apiRouteTemplate('/profiles/8437/documentos')).toBe('/profiles/:id/documentos');
  });

  it('no toca los segmentos que forman parte de la ruta', () => {
    expect(apiRouteTemplate('/iam/auth/login')).toBe('/iam/auth/login');
  });

  it('limpia el query antes de sustituir', () => {
    expect(apiRouteTemplate('/profiles/8437?incluir=todo')).toBe('/profiles/:id');
  });
});

/**
 * El token del enlace de una receta compartida (FAR-01) viaja en la **ruta**,
 * no en el query: abre la receta a una farmacia con sesión. No puede llegar a
 * `url.path`, a `app.api.route.template` ni a la plantilla del Router.
 */
describe('el token de la receta compartida', () => {
  const TOKEN = 'Q2hhcmxpZVN5bnRoZXRpY1Rva2VuMDEyMzQ1Njc4OWFi';

  it('se redacta en la vista pública de la API', () => {
    expect(sanitizeUrl(`/public/prescription-shares/${TOKEN}`)).toBe('/public/prescription-shares/:token');
    expect(apiRouteTemplate(`/public/prescription-shares/${TOKEN}`)).toBe(
      '/public/prescription-shares/:token',
    );
  });

  it('se redacta detrás de by-token, sin tocar el segmento by-token', () => {
    expect(sanitizeUrl(`https://api.example.test/clinical/prescription-shares/by-token/${TOKEN}`)).toBe(
      '/clinical/prescription-shares/by-token/:token',
    );
    expect(apiRouteTemplate(`/clinical/prescription-shares/by-token/${TOKEN}`)).toBe(
      '/clinical/prescription-shares/by-token/:token',
    );
  });

  it('sin distinguir mayúsculas de minúsculas', () => {
    expect(sanitizeUrl(`/Pharmacy/Prescription-Shares/${TOKEN}`)).toBe('/Pharmacy/Prescription-Shares/:token');
    expect(sanitizeUrl(`/clinical/prescription-shares/BY-TOKEN/${TOKEN}`)).toBe(
      '/clinical/prescription-shares/BY-TOKEN/:token',
    );
  });

  it('se redacta en las rutas del front que lo llevan', () => {
    expect(sanitizeUrl(`/rx/${TOKEN}?utm=x`)).toBe('/rx/:token');
    expect(sanitizeUrl(`/administration/pharmacy-orders/rx/${TOKEN}`)).toBe(
      '/administration/pharmacy-orders/rx/:token',
    );
  });

  it('un uuid detrás de esos segmentos es un id, no el token', () => {
    const id = '0b9d3f4e-1a2b-4c3d-8e9f-001122334455';
    expect(apiRouteTemplate(`/clinical/prescription-shares/${id}/revoke`)).toBe(
      '/clinical/prescription-shares/:id/revoke',
    );
    expect(sanitizeUrl(`/verify/rx/${id}`)).toBe(`/verify/rx/${id}`);
  });

  it('no cambia la lista ni el resto de las rutas', () => {
    expect(sanitizeUrl('/clinical/prescription-shares?patientProfileId=pp-1')).toBe(
      '/clinical/prescription-shares',
    );
    expect(sanitizeUrl('/my-account/pharmacy/prescriptions')).toBe('/my-account/pharmacy/prescriptions');
  });
});

describe('hostOf y schemeOf', () => {
  it('no ponen nada para una ruta relativa: el mismo origen no aporta información', () => {
    expect(hostOf('/iam/auth/login')).toBeNull();
    expect(schemeOf('/iam/auth/login')).toBeNull();
  });

  it('extraen host y esquema de una URL absoluta', () => {
    expect(hostOf('https://api.ejemplo.com/iam')).toBe('api.ejemplo.com');
    expect(schemeOf('https://api.ejemplo.com/iam')).toBe('https');
  });

  it('devuelven null ante una URL ilegible en vez de adivinar', () => {
    expect(hostOf('http://[rota')).toBeNull();
    expect(schemeOf('http://[rota')).toBeNull();
  });
});
