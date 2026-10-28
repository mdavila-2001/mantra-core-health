import { HttpHeaders } from '@angular/common/http';

import { TENANT_HEADER } from '../../http/auth.interceptor';

/**
 * De qué organización habla una petición de la agenda cuando **no es la
 * activa** de la sesión.
 *
 * La API resuelve la organización con `X-Tenant-Id` y rechaza con 403 lo que
 * no es de ella: la agenda de otra organización al agendar
 * (`assertResourceInActiveTenant`) y el `?tenantId=` de otra al listar sus
 * agendas (`TENANT_SCOPE_CONFLICT`). El médico que agenda donde está afiliado
 * tiene que hablar como esa organización.
 *
 * Sin `tenantId` la petición sale como siempre: el interceptor pone la
 * organización de la sesión, y respeta la que ya venga declarada.
 */
export interface TenantScope {
  readonly tenantId?: string;
}

/** Las opciones HTTP que declaran esa organización; vacías si no hay ninguna. */
export function tenantOptions(scope: TenantScope = {}): { readonly headers?: HttpHeaders } {
  return scope.tenantId === undefined
    ? {}
    : { headers: new HttpHeaders({ [TENANT_HEADER]: scope.tenantId }) };
}
