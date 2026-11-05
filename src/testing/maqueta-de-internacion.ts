import { HttpHeaders } from '@angular/common/http';
import { HttpTestingController, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { AccessSite, InfraAction } from '../app/core/data-access/infrastructure-ops/infrastructure-ops.types';
import { registerAdt } from '../app/core/mock/handlers/adt.handlers';
import { registrarInfraestructura } from '../app/core/mock/handlers/infrastructure.handlers';
import { registerInfrastructureOps } from '../app/core/mock/handlers/infrastructure-ops.handlers';
import { registrarProcedimientos } from '../app/core/mock/handlers/procedures.handlers';
import { isMockReply, MockRouter, type MockMethod } from '../app/core/mock/mock-router';
import { buscarUsuario, TENANT_HOSPITAL, type MockUser } from '../app/core/mock/mock-session';
import { dataOf, ready, routeAuthPending } from '../app/core/view-state/view-state';
import type { ViewState } from '../app/core/view-state/view-state.types';
import type { InfrastructureAccess } from '../app/core/data-access/infrastructure-ops/infrastructure-ops.types';

/**
 * Las pantallas de internación contra el **simulador real** de F2/F3 (que imita
 * a la API: lo vigila `infra-f2f3-contract.spec.ts`), como en
 * `maqueta-de-infraestructura.ts`. Las carreras se prueban respondiendo a mano
 * y en otro orden; el resto, con `responderTodo`.
 */
export class MaquetaDeInternacion {
  private readonly router = new MockRouter();

  constructor(
    public usuario: MockUser = buscarUsuario('enfermeria')!,
    private readonly tenant: string | null = TENANT_HOSPITAL,
  ) {
    registrarProcedimientos(this.router);
    registrarInfraestructura(this.router);
    registerInfrastructureOps(this.router);
    registerAdt(this.router);
  }

  /** Lo que la maqueta respondería, sin tocar ninguna petición. */
  llamar(method: MockMethod, path: string, body: unknown = null, query = '', extra: Record<string, string> = {}): { status: number; body: unknown } {
    const match = this.router.match(method, path);
    if (match === null) throw new Error(`La maqueta no conoce ${method} ${path}`);
    let headers = new HttpHeaders();
    for (const [k, v] of Object.entries(extra)) headers = headers.set(k, v);
    if (this.tenant !== null) headers = headers.set('X-Tenant-Id', this.tenant);
    const r = match.handler({ method, path, params: match.params, query: new URLSearchParams(query), body, headers, user: this.usuario });
    return isMockReply(r) ? { status: r.status, body: r.body } : { status: 200, body: r };
  }

  /** Responde una petición pendiente. Devuelve el estado HTTP que se usó. */
  responder(req: TestRequest): number {
    const url = new URL(req.request.urlWithParams, 'http://x');
    const extra: Record<string, string> = {};
    for (const k of req.request.headers.keys()) extra[k] = req.request.headers.get(k)!;
    const r = this.llamar(req.request.method as MockMethod, url.pathname, req.request.body, url.search.slice(1), extra);
    if (r.status >= 400) req.flush(r.body as object, { status: r.status, statusText: 'Error' });
    else req.flush(r.body as object);
    return r.status;
  }

  /** Responde todo lo pendiente, en tandas, hasta que no quede nada. */
  responderTodo(http: HttpTestingController, alCambiar: () => void = () => undefined, vueltas = 8): void {
    for (let i = 0; i < vueltas; i++) {
      const pendientes = http.match(() => true).filter((r) => !r.cancelled);
      if (pendientes.length === 0) return;
      for (const req of pendientes) this.responder(req);
      alCambiar();
    }
  }

  /** El acceso del usuario de la maqueta (`/practice/infrastructure-access/me`). */
  acceso(): InfrastructureAccess {
    return this.llamar('GET', '/practice/infrastructure-access/me').body as InfrastructureAccess;
  }
}

/**
 * Un `InpatientAccessStore` de prueba: el estado lo fija cada caso (S1, S5, S9
 * o listo), con la misma interfaz que lee la pantalla.
 */
export function accesoDePrueba(inicial: ViewState<InfrastructureAccess> = routeAuthPending()) {
  const state = signal<ViewState<InfrastructureAccess>>(inicial);
  const sites = () => dataOf(state())?.sites ?? [];
  const actionsIn = (s: AccessSite): readonly InfraAction[] => [...new Set([...s.actions, ...s.grants.flatMap((g) => g.actions)])];
  const site = (id: string | null) => sites().find((s) => s.siteId === id) ?? null;
  return {
    state,
    sites,
    isHospital: signal(true),
    ensure: vi.fn(),
    reload: vi.fn(),
    actionsIn,
    site,
    pickSite: (requested: string | null, action: InfraAction) => {
      const ok = sites().filter((s) => actionsIn(s).includes(action));
      return ok.find((s) => s.siteId === requested) ?? ok[0] ?? null;
    },
    can: (id: string | null, action: InfraAction) => {
      const s = site(id);
      return s !== null && actionsIn(s).includes(action);
    },
    canAnywhere: (action: InfraAction) => sites().some((s) => actionsIn(s).includes(action)),
    listo: (a: InfrastructureAccess) => state.set(ready(a)),
  };
}

/**
 * Verifica que no queden pedidos sin responder y limpia el módulo de prueba.
 * Sirve también en pruebas que no montan nada (funciones puras del mismo
 * archivo): sin `HttpTestingController` no hay nada que verificar.
 */
export function verificarHttp(): void {
  const http = TestBed.inject(HttpTestingController, null);
  try {
    http?.verify({ ignoreCancelled: true });
  } finally {
    TestBed.resetTestingModule();
  }
}
