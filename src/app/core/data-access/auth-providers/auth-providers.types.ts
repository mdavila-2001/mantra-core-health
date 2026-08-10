/**
 * Tipos de la vista para `auth_providers` (M40): proveedores de identidad
 * federada, claves de firma con rotación, login federado y vinculación de
 * cuentas.
 *
 * Los literales replican los `@IsIn` de los DTOs del backend. Los campos
 * `…Json` y `claims` son `Record<string, unknown>` porque el backend valida
 * con `@IsObject` (un array o un primitivo son 400) y el modelo no declara su
 * esquema interior.
 */

/** Entorno al que pertenece una configuración de protocolo. */
export type IdpEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

/** Protocolo de federación del proveedor. */
export type IdpProtocol = 'OIDC' | 'SAML' | 'OAUTH2';

/** Naturaleza del proveedor. */
export type IdpCategory = 'ENTERPRISE' | 'SOCIAL' | 'GOVERNMENT';

/** Cómo se autentica el cliente ante el endpoint de token. */
export type TokenEndpointAuth = 'CLIENT_SECRET_POST' | 'CLIENT_SECRET_BASIC' | 'PRIVATE_KEY_JWT';

/** Qué hace una regla de aprovisionamiento cuando su condición se cumple. */
export type ProvisioningEffect = 'ALLOW' | 'DENY';

/** Alta de un proveedor de identidad. Nace en borrador, sin poder autenticar. */
export interface NewIdentityProvider {
  readonly code: string;
  readonly name: string;
  readonly protocol: IdpProtocol;
  readonly category: IdpCategory;
  readonly tenantId?: string;
  readonly issuer?: string;
  readonly isGlobal?: boolean;
}

/** Proveedor recién registrado. `stateConceptId` es el borrador inicial. */
export interface CreatedProvider {
  readonly id: string;
  readonly code: string;
  readonly stateConceptId: string;
  readonly isGlobal: boolean;
}

/** Clave descubierta en el JWKS del proveedor al configurar el protocolo. */
export interface DiscoveredKey {
  readonly keyId: string;
  readonly algorithm: string;
  readonly publicKey: string;
  readonly certificate?: string;
}

/**
 * Configuración de protocolo de un entorno. Reconfigurar reemplaza: solo hay
 * una configuración activa por entorno. `clientSecretRef` es la referencia del
 * secreto en el vault — el secreto nunca viaja acá.
 */
export interface NewProtocolConfig {
  readonly environment: IdpEnvironment;
  readonly clientId?: string;
  readonly clientSecretRef?: string;
  readonly authorizeUrl?: string;
  readonly tokenUrl?: string;
  readonly userinfoUrl?: string;
  readonly jwksUri?: string;
  readonly metadataUrl?: string;
  readonly samlEntityId?: string;
  readonly samlAcsUrl?: string;
  readonly scopes?: string;
  readonly responseType?: string;
  readonly tokenEndpointAuth?: TokenEndpointAuth;
  readonly pkceRequired?: boolean;
  readonly extraConfigJson?: Record<string, unknown>;
  readonly discoveredKeys?: readonly DiscoveredKey[];
}

/** Resultado de configurar el protocolo. `replaced` dice si sustituyó a otra. */
export interface ProtocolConfigResult {
  readonly id: string;
  readonly providerId: string;
  readonly environmentConceptId: string;
  readonly replaced: boolean;
  readonly importedKeyIds: readonly string[];
}

/** Publicación de una clave de firma. Fechas en ISO 8601 con zona horaria. */
export interface NewSigningKey {
  readonly keyId: string;
  readonly algorithm: string;
  readonly publicKey: string;
  readonly certificate?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

/** Clave de firma publicada. */
export interface PublishedSigningKey {
  readonly id: string;
  readonly keyId: string;
  readonly stateConceptId: string;
}

/**
 * Rotación de clave: publica la nueva y retira las salientes con gracia.
 * `graceHours: 0` las retira al instante — lo que se quiere ante una clave
 * comprometida; el default del backend es 24.
 */
export interface SigningKeyRotation extends NewSigningKey {
  readonly graceHours?: number;
}

/** Resultado de la rotación. `graceUntil` es hasta cuándo valen las salientes. */
export interface KeyRotationResult {
  readonly newKeyId: string;
  readonly retiringCount: number;
  readonly graceUntil?: Date;
}

/** Un mapeo de claim a atributo del modelo. Solo puede haber un identificador. */
export interface AttributeMapping {
  readonly sourceClaim: string;
  readonly targetAttribute: string;
  readonly isIdentifier?: boolean;
  readonly required?: boolean;
  readonly transformJson?: Record<string, unknown>;
}

/** Reemplazo completo del mapeo de atributos de un proveedor. */
export interface AttributeMappingsReplacement {
  readonly mappings: readonly AttributeMapping[];
}

/** Resultado de fijar el mapeo. `removed` son los mapeos anteriores retirados. */
export interface AttributeMappingsResult {
  readonly providerId: string;
  readonly mappingIds: readonly string[];
  readonly removed: number;
  readonly identifierClaim: string;
}

/** Vínculo de un proveedor con un tenant. Aprovisionar exige rol por defecto. */
export interface NewTenantBinding {
  readonly providerId: string;
  readonly tenantId: string;
  readonly isEnabled?: boolean;
  readonly autoProvision?: boolean;
  readonly justInTimeProvisioning?: boolean;
  readonly defaultRoleConceptId?: string;
  readonly allowedEmailDomains?: string;
}

/** Resultado del vínculo. `updated` dice si ya existía y se actualizó. */
export interface TenantBindingResult {
  readonly id: string;
  readonly providerId: string;
  readonly tenantId: string;
  readonly isEnabled: boolean;
  readonly updated: boolean;
}

/**
 * Regla de aprovisionamiento. La prioridad es única y decide la primera regla
 * que case; `assignRoleConceptId` y `assignTenantId` solo con efecto `ALLOW`.
 */
export interface NewProvisioningRule {
  readonly priority: number;
  readonly effect: ProvisioningEffect;
  readonly tenantId?: string;
  readonly conditionJson?: Record<string, unknown>;
  readonly assignRoleConceptId?: string;
  readonly assignTenantId?: string;
}

/** Regla creada. */
export interface CreatedProvisioningRule {
  readonly id: string;
  readonly priority: number;
  readonly effectConceptId: string;
  readonly isActive: boolean;
}

/** Inicio del login federado contra un proveedor, por su código. */
export interface FederatedLoginStart {
  readonly tenantId?: string;
  readonly environment?: IdpEnvironment;
  readonly ip?: string;
  readonly userAgent?: string;
}

/** Intento iniciado: el `state` es lo único que liga el callback con nosotros. */
export interface FederatedLoginStartResult {
  readonly attemptId: string;
  readonly state: string;
  readonly nonce: string;
  readonly authorizeUrl: string;
  readonly pkceRequired: boolean;
}

/**
 * Callback del proveedor. `userId` es el usuario local ya resuelto por IAM:
 * este módulo no crea usuarios — sin él, un login sin identidad previa
 * devuelve un token de vinculación en lugar de crear nada.
 */
export interface FederatedCallback {
  readonly state: string;
  readonly externalSubject: string;
  readonly claims: Record<string, unknown>;
  readonly tenantId?: string;
  readonly userId?: string;
  readonly ip?: string;
  readonly userAgent?: string;
}

/** Desenlace del callback. Todo intento queda registrado, incluso el rechazo. */
export interface FederatedCallbackResult {
  readonly outcomeConceptId: string;
  readonly provisioned: boolean;
  readonly attemptId: string;
  readonly federatedIdentityId?: string;
  readonly userId?: string;
  readonly failureReasonConceptId?: string;
  readonly linkToken?: string;
}

/** Solicitud de vinculación de un sujeto externo con una cuenta local. */
export interface NewAccountLinkRequest {
  readonly providerId: string;
  readonly externalSubject: string;
  readonly expiresInMinutes?: number;
}

/**
 * Solicitud creada. `linkToken` se devuelve **una sola vez** — en la tabla
 * queda su hash; perderlo obliga a solicitar de nuevo.
 */
export interface AccountLinkRequestResult {
  readonly id: string;
  readonly linkToken: string;
  readonly expiresAt: Date;
  readonly statusConceptId: string;
}

/** Cierre de la vinculación presentando el token recibido. */
export interface AccountLinkCompletion {
  readonly linkToken: string;
  readonly externalEmail?: string;
  readonly displayName?: string;
  readonly claims?: Record<string, unknown>;
}

/** Vinculación completada: la identidad federada quedó activa. */
export interface AccountLinkCompletionResult {
  readonly requestId: string;
  readonly federatedIdentityId: string;
  readonly userId: string;
  readonly statusConceptId: string;
}

/** Desvinculación de una identidad federada. El motivo queda en la auditoría. */
export interface IdentityUnlink {
  readonly reason: string;
}

/** Identidad desvinculada: se revoca, no se borra — el histórico apunta a ella. */
export interface IdentityUnlinkResult {
  readonly id: string;
  readonly stateConceptId: string;
  readonly attemptId: string;
}
