import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AccountLinkCompletion,
  AccountLinkCompletionResult,
  AccountLinkRequestResult,
  AttributeMappingsReplacement,
  AttributeMappingsResult,
  CreatedProvider,
  CreatedProvisioningRule,
  FederatedCallback,
  FederatedCallbackResult,
  FederatedLoginStart,
  FederatedLoginStartResult,
  IdentityUnlink,
  IdentityUnlinkResult,
  KeyRotationResult,
  NewAccountLinkRequest,
  NewIdentityProvider,
  NewProtocolConfig,
  NewProvisioningRule,
  NewSigningKey,
  NewTenantBinding,
  ProtocolConfigResult,
  PublishedSigningKey,
  SigningKeyRotation,
  TenantBindingResult,
} from './auth-providers.types';

interface KeyRotationBody {
  readonly newKeyId: string;
  readonly retiringCount: number;
  readonly graceUntil?: string;
}

interface AccountLinkRequestBody {
  readonly id: string;
  readonly linkToken: string;
  readonly expiresAt: string;
  readonly statusConceptId: string;
}

function toKeyRotationResult(body: KeyRotationBody): KeyRotationResult {
  return {
    newKeyId: body.newKeyId,
    retiringCount: body.retiringCount,
    ...(body.graceUntil === undefined ? {} : { graceUntil: new Date(body.graceUntil) }),
  };
}

function toAccountLinkRequestResult(body: AccountLinkRequestBody): AccountLinkRequestResult {
  return {
    id: body.id,
    linkToken: body.linkToken,
    expiresAt: new Date(body.expiresAt),
    statusConceptId: body.statusConceptId,
  };
}

/**
 * Cliente de `auth_providers` (M40): identidad federada y sus proveedores.
 *
 * El módulo es **solo de comando**: 11 POST y 1 PUT, ningún GET. Se registran
 * proveedores, se los configura y se opera el login federado, pero nada de eso
 * se puede leer todavía; los listados quedan a la espera de sus endpoints de
 * consulta.
 *
 * Los cuerpos viajan tal como los declaran los tipos: el backend valida con
 * `forbidNonWhitelisted`, así que una propiedad de más es un 400. Los campos
 * opcionales ausentes se omiten (la serialización descarta `undefined`).
 */
@Injectable({
  providedIn: 'root',
})
export class AuthProvidersClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /auth-providers/identity-providers` — el proveedor nace en borrador. */
  createProvider(provider: NewIdentityProvider): Observable<CreatedProvider> {
    return this.http.post<CreatedProvider>(
      this.url('/auth-providers/identity-providers'),
      provider,
    );
  }

  /** `POST …/:id/protocol-configs` — una configuración activa por entorno. */
  configureProtocol(
    providerId: string,
    config: NewProtocolConfig,
  ): Observable<ProtocolConfigResult> {
    return this.http.post<ProtocolConfigResult>(
      this.url(`/auth-providers/identity-providers/${encodeURIComponent(providerId)}/protocol-configs`),
      config,
    );
  }

  /** `POST …/:id/signing-keys` — publicar una clave de firma. */
  publishSigningKey(providerId: string, key: NewSigningKey): Observable<PublishedSigningKey> {
    return this.http.post<PublishedSigningKey>(
      this.url(`/auth-providers/identity-providers/${encodeURIComponent(providerId)}/signing-keys`),
      key,
    );
  }

  /** `POST …/:id/signing-keys/rotate` — las salientes se retiran con gracia. */
  rotateSigningKey(
    providerId: string,
    rotation: SigningKeyRotation,
  ): Observable<KeyRotationResult> {
    return this.http
      .post<KeyRotationBody>(
        this.url(
          `/auth-providers/identity-providers/${encodeURIComponent(providerId)}/signing-keys/rotate`,
        ),
        rotation,
      )
      .pipe(map(toKeyRotationResult));
  }

  /** `PUT …/:id/attribute-mappings` — reemplaza el mapeo completo. */
  setAttributeMappings(
    providerId: string,
    replacement: AttributeMappingsReplacement,
  ): Observable<AttributeMappingsResult> {
    return this.http.put<AttributeMappingsResult>(
      this.url(
        `/auth-providers/identity-providers/${encodeURIComponent(providerId)}/attribute-mappings`,
      ),
      replacement,
    );
  }

  /** `POST /auth-providers/tenant-bindings` — quién puede usar el proveedor. */
  bindTenant(binding: NewTenantBinding): Observable<TenantBindingResult> {
    return this.http.post<TenantBindingResult>(
      this.url('/auth-providers/tenant-bindings'),
      binding,
    );
  }

  /** `POST …/:id/provisioning-rules` — decide la primera regla que case. */
  createProvisioningRule(
    providerId: string,
    rule: NewProvisioningRule,
  ): Observable<CreatedProvisioningRule> {
    return this.http.post<CreatedProvisioningRule>(
      this.url(
        `/auth-providers/identity-providers/${encodeURIComponent(providerId)}/provisioning-rules`,
      ),
      rule,
    );
  }

  /** `POST …/by-code/:code/authorize` — registra el intento y devuelve el state. */
  startFederatedLogin(
    providerCode: string,
    start: FederatedLoginStart,
  ): Observable<FederatedLoginStartResult> {
    return this.http.post<FederatedLoginStartResult>(
      this.url(
        `/auth-providers/identity-providers/by-code/${encodeURIComponent(providerCode)}/authorize`,
      ),
      start,
    );
  }

  /** `POST …/by-code/:code/callback` — todo desenlace queda registrado. */
  processCallback(
    providerCode: string,
    callback: FederatedCallback,
  ): Observable<FederatedCallbackResult> {
    return this.http.post<FederatedCallbackResult>(
      this.url(
        `/auth-providers/identity-providers/by-code/${encodeURIComponent(providerCode)}/callback`,
      ),
      callback,
    );
  }

  /** `POST /auth-providers/account-link-requests` — el token viaja una sola vez. */
  requestAccountLink(request: NewAccountLinkRequest): Observable<AccountLinkRequestResult> {
    return this.http
      .post<AccountLinkRequestBody>(this.url('/auth-providers/account-link-requests'), request)
      .pipe(map(toAccountLinkRequestResult));
  }

  /** `POST /auth-providers/account-link-requests/complete` — cierra el vínculo. */
  completeAccountLink(completion: AccountLinkCompletion): Observable<AccountLinkCompletionResult> {
    return this.http.post<AccountLinkCompletionResult>(
      this.url('/auth-providers/account-link-requests/complete'),
      completion,
    );
  }

  /** `POST /auth-providers/federated-identities/:id/unlink` — revoca, no borra. */
  unlinkIdentity(identityId: string, unlink: IdentityUnlink): Observable<IdentityUnlinkResult> {
    return this.http.post<IdentityUnlinkResult>(
      this.url(`/auth-providers/federated-identities/${encodeURIComponent(identityId)}/unlink`),
      unlink,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
