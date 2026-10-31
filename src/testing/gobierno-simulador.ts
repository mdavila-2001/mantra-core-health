import { provideHttpClient, withInterceptors, type HttpInterceptorFn } from '@angular/common/http';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../environments/environment';
import { SessionStore } from '../app/core/auth/session.store';
import {
  reiniciarElGobiernoDeAccesos,
  reiniciarLaSesionDelSimulador,
} from '../app/core/mock/handlers/mock-reset';
import { sellarPasoExtra } from '../app/core/mock/handlers/support-access.governance.core';
import { mockBackendInterceptor } from '../app/core/mock/mock-backend.interceptor';
import {
  buscarUsuario,
  emitirAccessToken,
  TENANT_HOSPITAL_PILOTO,
} from '../app/core/mock/mock-session';

/* ============================================================================
    El backend simulado del gobierno de accesos **dentro de una prueba de componente**.

    Las pantallas de gobierno se prueban de punta a punta: la persona toca la interfaz, sale una petición real por el
    `HttpClient`, el simulador responde con la forma de la API (la misma que valida `contract-validator`), la pantalla
    recarga y se ve lo guardado. Nada se reemplaza salvo la red.

    Uso (`isolate: false`: el estado del simulador sobrevive entre archivos, así que cada prueba lo reinicia):

    ```ts
    const sim = abrirElSimulador('hospital_piloto');
    beforeEach(() => { sim.reiniciar(); TestBed.configureTestingModule({ providers: [...sim.providers] }); sim.iniciarSesion(); });
    afterAll(() => sim.cerrar());
    ```
   ========================================================================== */

export interface SimuladorDePrueba {
  readonly providers: (Provider | EnvironmentProviders)[];
  /** Reinicia el gobierno de accesos y la sesión del simulador (antes de configurar el `TestBed`). */
  reiniciar(): void;
  /** Abre la sesión de la persona en el `SessionStore` (después de configurar el `TestBed`). */
  iniciarSesion(): void;
  /** Sella el segundo paso de la persona, como si ya hubiera escrito su código. */
  conPasoExtra(): void;
  /** Devuelve el entorno a como estaba. */
  cerrar(): void;
}

export function abrirElSimulador(clave: string): SimuladorDePrueba {
  const usuario = buscarUsuario(clave);
  if (usuario === undefined) throw new Error(`No hay una cuenta simulada «${clave}».`);
  const anterior = environment.mockBackend;
  Object.assign(environment, { mockBackend: true });
  const conSesion: HttpInterceptorFn = (request, next) =>
    next(
      request.clone({
        setHeaders: {
          Authorization: `Bearer ${emitirAccessToken(usuario)}`,
          'X-Tenant-Id': TENANT_HOSPITAL_PILOTO,
        },
      }),
    );
  return {
    providers: [provideHttpClient(withInterceptors([conSesion, mockBackendInterceptor]))],
    reiniciar: () => {
      Object.assign(environment, { mockBackend: true });
      reiniciarLaSesionDelSimulador();
      reiniciarElGobiernoDeAccesos();
    },
    iniciarSesion: () =>
      TestBed.inject(SessionStore).start({
        accessToken: emitirAccessToken(usuario),
        refreshToken: '',
      }),
    conPasoExtra: () => sellarPasoExtra(usuario.id),
    cerrar: () => {
      Object.assign(environment, { mockBackend: anterior });
    },
  };
}

/** Un `ActivatedRoute` mínimo con parámetros de ruta y de consulta, para pantallas que los leen de la instantánea. */
export function rutaConParametros(
  params: Readonly<Record<string, string>>,
  query: Readonly<Record<string, string>> = {},
): {
  readonly snapshot: {
    readonly paramMap: { get(name: string): string | null };
    readonly queryParamMap: { get(name: string): string | null };
  };
} {
  return {
    snapshot: {
      paramMap: { get: (name) => params[name] ?? null },
      queryParamMap: { get: (name) => query[name] ?? null },
    },
  };
}

/**
 * Espera a que la pantalla refleje algo: estabiliza, detecta cambios y reintenta hasta `limite` ms. Las respuestas del simulador
 * llegan con una pequeña espera (como una red de verdad), así que una sola pasada no basta.
 */
export async function esperarHasta(
  fixture: { whenStable(): Promise<unknown>; detectChanges(): void },
  condicion: () => boolean,
  limite = 4000,
): Promise<void> {
  const inicio = Date.now();
  for (;;) {
    await fixture.whenStable();
    fixture.detectChanges();
    if (condicion()) return;
    if (Date.now() - inicio > limite)
      throw new Error('La pantalla no llegó al estado esperado a tiempo.');
    await new Promise((r) => setTimeout(r, 15));
  }
}

/* ---- manos de la persona ---------------------------------------------------------------------------------------- */

interface Estabilizable {
  whenStable(): Promise<unknown>;
  detectChanges(): void;
}

/** El elemento con ese `data-testid`, en el documento (los diálogos se montan fuera del componente). */
export function porId(id: string, raiz: ParentNode = document.body): HTMLElement | null {
  return raiz.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

/** El texto visible de ese elemento, sin espacios de más; vacío si no existe. */
export function textoDe(id: string, raiz: ParentNode = document.body): string {
  return (porId(id, raiz)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

async function estabilizar(fixture: Estabilizable): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Toca un botón o enlace (si el `data-testid` está en un anfitrión, el control es el `button`/`a` de dentro). */
export async function tocar(fixture: Estabilizable, id: string): Promise<void> {
  const el = porId(id);
  if (el === null) throw new Error(`No hay nada con data-testid="${id}".`);
  (el.matches('button,a,input')
    ? el
    : (el.querySelector<HTMLElement>('button,a,input') ?? el)
  ).click();
  await estabilizar(fixture);
}

/** Escribe en un campo de texto (`input` o `textarea`, o el que está dentro del anfitrión con ese `data-testid`). */
export async function escribirEn(fixture: Estabilizable, id: string, valor: string): Promise<void> {
  const el = porId(id);
  if (el === null) throw new Error(`No hay nada con data-testid="${id}".`);
  const campo = (el.matches('input,textarea') ? el : el.querySelector('input,textarea')) as
    HTMLInputElement | HTMLTextAreaElement | null;
  if (campo === null) throw new Error(`«${id}» no tiene un campo de texto.`);
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  await estabilizar(fixture);
}

/** Marca o desmarca una casilla (`app-checkbox`) por el `data-testid` de su fila. */
export async function marcar(fixture: Estabilizable, id: string, marcada: boolean): Promise<void> {
  const el = porId(id);
  const casilla = el?.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? null;
  if (casilla === null) throw new Error(`No hay casilla en «${id}».`);
  if (casilla.checked !== marcada) casilla.click();
  await estabilizar(fixture);
}

export { estabilizar };
