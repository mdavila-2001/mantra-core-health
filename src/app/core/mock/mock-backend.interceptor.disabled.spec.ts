import { readFileSync } from 'node:fs';

import {
  HttpRequest,
  HttpResponse,
  type HttpEvent,
  type HttpHandlerFn,
} from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { lastValueFrom, of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { mockBackendInterceptor as sustituto } from './mock-backend.interceptor.disabled';
import { mockBackendInterceptor as completo } from './mock-backend.interceptor';

/**
 * F4 (revisión de seguridad del front): los builds reales no llevan el backend simulado. El sustituto debe poder ponerse en
 * lugar del real sin que `app.config.ts` lo note, y no debe importar nada del simulador.
 */
describe('mock-backend.interceptor.disabled', () => {
  const llamar = (interceptor: typeof sustituto): Observable<HttpEvent<unknown>> => {
    const peticion = new HttpRequest('GET', '/me/support-agenda');
    const siguiente: HttpHandlerFn = () => of(new HttpResponse({ status: 200, body: 'red' }));
    return runInInjectionContext(Injector.create({ providers: [] }), () =>
      interceptor(peticion, siguiente),
    );
  };

  it('deja pasar la petición a la red, tal cual', async () => {
    const respuesta = (await lastValueFrom(llamar(sustituto))) as HttpResponse<string>;
    expect(respuesta.body).toBe('red');
  });

  it('es intercambiable con el interceptor completo: mismo nombre exportado y misma firma', () => {
    expect(typeof sustituto).toBe('function');
    expect(typeof completo).toBe('function');
    expect(sustituto.length).toBe(completo.length);
  });

  it('no importa nada del simulador (ni `handlers`, ni fixtures, ni sesiones de prueba)', () => {
    const fuente = readFileSync('src/app/core/mock/mock-backend.interceptor.disabled.ts', 'utf8');
    const imports = fuente
      .split('\n')
      .filter((linea) => /^\s*(import|export)\b.*\bfrom\b/.test(linea));
    expect(imports.filter((linea) => !linea.includes('@angular/common/http'))).toEqual([]);
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/import\(/);
  });

  it('angular.json lo sustituye en TODAS las configuraciones reales y en NINGUNA de las de demostración', () => {
    const angular = JSON.parse(readFileSync('angular.json', 'utf8')) as {
      projects: Record<
        string,
        {
          architect: {
            build: {
              configurations: Record<
                string,
                { fileReplacements?: { replace: string; with: string }[] }
              >;
            };
          };
        }
      >;
    };
    const configuraciones = Object.values(angular.projects)[0]!.architect.build.configurations;
    const sustituyen = (nombre: string): boolean =>
      (configuraciones[nombre]?.fileReplacements ?? []).some(
        (r) =>
          r.replace === 'src/app/core/mock/mock-backend.interceptor.ts' &&
          r.with === 'src/app/core/mock/mock-backend.interceptor.disabled.ts',
      );
    for (const real of ['production', 'production-api', 'real-api', 'e2e-real'])
      expect(sustituyen(real), real).toBe(true);
    for (const demo of ['demo', 'development']) expect(sustituyen(demo), demo).toBe(false);
  });
});
