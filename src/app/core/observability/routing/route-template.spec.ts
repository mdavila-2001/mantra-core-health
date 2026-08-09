import { Router, type Routes } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routeTemplate } from './route-template';

/**
 * Lo que esto protege es el nombre de las operaciones en Jaeger.
 *
 * Con la URL real, `/pacientes/8437` y `/pacientes/8438` serían dos operaciones
 * distintas: la lista crecería hasta ser inútil y ninguna estadística de
 * latencia por pantalla se podría calcular. Y en dos rutas de esta aplicación,
 * la URL real lleva además un token de un solo uso.
 */
const RUTAS: Routes = [
  { path: '', children: [{ path: 'panel', component: class {} }] },
  { path: 'auth', component: class {} },
  { path: 'auth/verificar', component: class {} },
  { path: 'pacientes/:pacienteId', component: class {} },
  { path: 'pacientes/:pacienteId/estudios/:estudioId', component: class {} },
  { path: 'informes', loadChildren: () => Promise.resolve([]) },
  { path: '**', component: class {} },
];

describe('routeTemplate', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(RUTAS)] });
    router = TestBed.inject(Router);
  });

  it('sustituye el parámetro por su nombre declarado', () => {
    expect(routeTemplate(router, '/pacientes/8437')).toBe('/pacientes/:pacienteId');
  });

  it('sustituye también un identificador que no parece uno', () => {
    // Una expresión regular no distinguiría esto de un segmento fijo. La
    // configuración del Router sí, porque está declarado.
    expect(routeTemplate(router, '/pacientes/clinica-norte')).toBe('/pacientes/:pacienteId');
  });

  it('resuelve varios parámetros en la misma ruta', () => {
    expect(routeTemplate(router, '/pacientes/8437/estudios/22')).toBe(
      '/pacientes/:pacienteId/estudios/:estudioId',
    );
  });

  it('descarta el query string, que es donde viaja el token del correo', () => {
    expect(routeTemplate(router, '/auth/verificar?token=eyJhbGciOi.abc.def')).toBe(
      '/auth/verificar',
    );
  });

  it('no toca una ruta sin parámetros', () => {
    expect(routeTemplate(router, '/auth')).toBe('/auth');
  });

  it('resuelve una ruta hija', () => {
    expect(routeTemplate(router, '/panel')).toBe('/panel');
  });

  it('conserva la ruta saneada cuando ninguna rama encaja, en vez de inventar', () => {
    // Se prefiere lo cierto: una plantilla equivocada agruparía operaciones
    // que no tienen nada que ver.
    expect(routeTemplate(router, '/no/existe/esto')).toBe('/no/existe/esto');
  });

  it('la raíz es la raíz', () => {
    expect(routeTemplate(router, '/')).toBe('/');
  });
});
