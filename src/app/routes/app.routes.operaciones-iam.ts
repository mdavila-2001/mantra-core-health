import type { Routes } from '@angular/router';
import {
  pantallaDeAccesoDelegado,
  pantallaDeProveedoresDeIdentidad,
} from './operacion.helpers';

/**
 * Pantallas de operación de acceso delegado y proveedores de identidad federada.
 */
export const RUTAS_OPERACIONES_IAM: Routes = [
  pantallaDeAccesoDelegado('delegations/new', 'Nueva delegación', () =>
    import('../features/delegated-access/practitioner-delegate-form/practitioner-delegate-form').then(
      (m) => m.PractitionerDelegateForm,
    ),
  ),
  pantallaDeAccesoDelegado('delegations/revoke', 'Revocar delegación', () =>
    import('../features/delegated-access/delegation-revocation/delegation-revocation').then(
      (m) => m.DelegationRevocation,
    ),
  ),
  pantallaDeAccesoDelegado('delegations/requests/new', 'Solicitar acceso delegado', () =>
    import('../features/delegated-access/access-request-form/access-request-form').then(
      (m) => m.AccessRequestForm,
    ),
  ),
  pantallaDeAccesoDelegado('delegations/grants/new', 'Otorgar concesión', () =>
    import('../features/delegated-access/grant-form/grant-form').then((m) => m.GrantForm),
  ),
  pantallaDeAccesoDelegado('assignments/new', 'Asignar usuario de organización', () =>
    import('../features/delegated-access/org-assignment-form/org-assignment-form').then(
      (m) => m.OrgAssignmentForm,
    ),
  ),
  pantallaDeAccesoDelegado('assignments/edit', 'Reasignar o suspender asignación', () =>
    import('../features/delegated-access/org-assignment-update/org-assignment-update').then(
      (m) => m.OrgAssignmentUpdate,
    ),
  ),
  pantallaDeAccesoDelegado('requests/resolve', 'Resolver solicitud de acceso', () =>
    import('../features/delegated-access/access-request-resolution/access-request-resolution').then(
      (m) => m.AccessRequestResolution,
    ),
  ),
  pantallaDeAccesoDelegado('permission-sets/new', 'Publicar set de permisos', () =>
    import('../features/delegated-access/permission-set-form/permission-set-form').then(
      (m) => m.PermissionSetForm,
    ),
  ),
  pantallaDeAccesoDelegado('permission-sets/new-version', 'Versionar set de permisos', () =>
    import('../features/delegated-access/set-version-form/set-version-form').then(
      (m) => m.SetVersionForm,
    ),
  ),
  pantallaDeAccesoDelegado('operations/evaluate-actor', 'Evaluar actor efectivo', () =>
    import('../features/delegated-access/actor-evaluation/actor-evaluation').then(
      (m) => m.ActorEvaluation,
    ),
  ),
  pantallaDeAccesoDelegado('operations/expiry-sweep', 'Barrido de expiración', () =>
    import('../features/delegated-access/expiry-sweep/expiry-sweep').then((m) => m.ExpirySweep),
  ),
  pantallaDeProveedoresDeIdentidad('providers/new', 'Registrar proveedor de identidad', () =>
    import('../features/auth-providers/provider-form/provider-form').then((m) => m.ProviderForm),
  ),
  pantallaDeProveedoresDeIdentidad(
    'providers/protocol',
    'Configurar protocolo del proveedor',
    () =>
      import('../features/auth-providers/protocol-config-form/protocol-config-form').then(
        (m) => m.ProtocolConfigForm,
      ),
  ),
  pantallaDeProveedoresDeIdentidad(
    'providers/attribute-mappings',
    'Fijar mapeo de atributos',
    () =>
      import('../features/auth-providers/attribute-mappings-form/attribute-mappings-form').then(
        (m) => m.AttributeMappingsForm,
      ),
  ),
  pantallaDeProveedoresDeIdentidad(
    'providers/provisioning-rule',
    'Definir regla de aprovisionamiento',
    () =>
      import('../features/auth-providers/provisioning-rule-form/provisioning-rule-form').then(
        (m) => m.ProvisioningRuleForm,
      ),
  ),
  pantallaDeProveedoresDeIdentidad('keys/new', 'Publicar clave de firma', () =>
    import('../features/auth-providers/signing-key-form/signing-key-form').then(
      (m) => m.SigningKeyForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad('keys/rotate', 'Rotar clave de firma', () =>
    import('../features/auth-providers/key-rotation-form/key-rotation-form').then(
      (m) => m.KeyRotationForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad(
    'organizations/link',
    'Vincular proveedor a una organización',
    () =>
      import('../features/auth-providers/tenant-binding-form/tenant-binding-form').then(
        (m) => m.TenantBindingForm,
      ),
  ),
  pantallaDeProveedoresDeIdentidad('login/start', 'Iniciar login federado', () =>
    import('../features/auth-providers/login-start-form/login-start-form').then(
      (m) => m.LoginStartForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad('login/callback', 'Completar el ingreso con el proveedor', () =>
    import('../features/auth-providers/login-callback-form/login-callback-form').then(
      (m) => m.LoginCallbackForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad('accounts/link', 'Solicitar vinculación de cuenta', () =>
    import('../features/auth-providers/account-link-request-form/account-link-request-form').then(
      (m) => m.AccountLinkRequestForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad('accounts/complete', 'Completar vinculación de cuenta', () =>
    import('../features/auth-providers/account-link-complete-form/account-link-complete-form').then(
      (m) => m.AccountLinkCompleteForm,
    ),
  ),
  pantallaDeProveedoresDeIdentidad('accounts/unlink', 'Desvincular identidad federada', () =>
    import('../features/auth-providers/identity-unlink-form/identity-unlink-form').then(
      (m) => m.IdentityUnlinkForm,
    ),
  ),
];
