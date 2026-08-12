# Actores y roles

Tres actores identificables en el código. **La interfaz no ramifica por rol
todavía**, y eso es un hecho, no una omisión.

---

## Los actores

| Actor | Entra con | Registro | Evidencia |
|---|---|---|---|
| **Paciente** | **Documento** de identidad | Auto-registro. Correo opcional | `PatientRegistration`, `POST /iam/auth/register-patient` |
| **Profesional de salud** | **Correo** | Auto-registro. Matrícula y nº de colegio **obligatorios** | `PractitionerRegistration` |
| **Administrador** | Correo | Lo siembra la API. Da de alta usuarios | `IamClient.createUser` → `POST /iam/users` |

### La diferencia de identificador no es cosmética

```ts
export type LoginCredentials =
  | { kind: 'email';      email: string;      password: string; mfaCode?: string }
  | { kind: 'nationalId'; nationalId: string; password: string; mfaCode?: string };
```

El backend exige **uno u otro, nunca ambos**. La unión discriminada lo hace
cumplir: mandar los dos **no compila**.

Y el login **no pregunta cuál es**: lo decide la arroba, *«que es la misma regla
que usaría cualquiera al mirarlo»*.

### Un profesional necesita habilitación comprobable

| Campo | Paciente | Profesional |
|---|---|---|
| Identificador de acceso | Documento | Correo |
| Correo | Opcional | **Obligatorio** |
| `licenseNumber` (matrícula) | — | **Obligatorio** |
| `credentialNumber` (nº de colegio) | — | **Obligatorio** |

> *«Un profesional sin habilitación comprobable no es un profesional.»*

Por eso el registro tiene **dos formularios y no uno condicional**:
*«mezclarlos obligaría a validar "obligatorio si el tipo es…", que es de donde
salen los formularios que mienten.»*

## Roles

Viajan en el claim `roles[]` del token:

```ts
readonly roles = computed<readonly string[]>(() => this.claims()?.roles ?? []);
```

**El frontend no los interpreta.** Los muestra en el panel como insignias y nada
más:

```html
@for (role of roles(); track role) {
  <app-badge variant="info" [value]="role" />
} @empty {
  <span class="panel__vacio">El token no declara ningún rol.</span>
}
```

| Lo que el frontend hace con los roles | |
|---|---|
| Mostrarlos en el panel | ✅ |
| Filtrar el menú | **No hoy.** El menú tiene dos ítems fijos |
| Guard por rol | **No existe** |
| Ocultar acciones | No |

### El rol conocido

`SECURITY_ADMIN` aparece nombrado en `terminology/README.md`, como el rol que
exigen las operaciones de administración de terminología:

> *«Ningún usuario de esta aplicación lo tiene, así que envolverlas sería
> publicar una API que nadie puede llamar.»*

Es la única mención de un rol concreto en todo el frontend.

### Y la razón por la que esto está bien

> *«Esconder un ítem no protege nada —la autoridad es la API, que valida en cada
> petición—; es no ofrecer una puerta que va a estar cerrada. Quien escriba la
> URL a mano se topa con el guard primero y con un 403 después.»*

**Filtrar el menú por rol es una mejora de experiencia, no de seguridad.** Cuando
se implemente, seguirá sin ser un control de acceso.

## Organizaciones (tenants)

Un usuario puede pertenecer a **varias**:

| Claim | Contenido |
|---|---|
| `tenants[]` | Identificadores de las organizaciones |
| `tenantNames{}` | Su nombre legible, *«para no mostrar uuid crudos»* |

### La elección no se adivina

```ts
readonly activeTenantId = computed<string | null>(() => {
  const chosen = this.selectedTenantId();
  if (chosen !== null) return chosen;
  const tenants = this.tenants();
  return tenants.length === 1 ? (tenants[0] ?? null) : null;
});
```

Con una se resuelve sola. **Con varias, manda la persona**, y hasta que elija el
encabezado `X-Tenant-Id` no se manda:

> *«Elegir por ella podría mostrarle datos de la organización equivocada.»*

### Cambiar de organización es un cambio de contexto

```ts
protected changeTenant(tenantId: string): void {
  this.auth.selectTenant(tenantId);
  void this.router.navigateByUrl('/dashboard');
}
```

Se vuelve al panel, no se recarga la vista actual: *«podría ser el detalle de un
recurso que en esta organización no existe.»*

## Verificación de identidad

Cuatro operaciones escritas y **sin pantalla que las use**:

| Operación | Para quién |
|---|---|
| `POST /identity/me/identity-verification` | Paciente |
| `POST /identity/me/practitioner/identity-verification` | Profesional |
| `POST /identity/me/practitioner/license-verification` | Profesional (matrícula) |
| `GET /identity/me/verification-cases/:caseId` | Consulta del propio caso |

**Ninguna recibe a quién se verifica**:

> *«el backend lo resuelve del usuario autenticado en vez de leerlo del cuerpo,
> justamente para que nadie pueda pedir la verificación de otro.»*

Y el estado S5 «con acción» existe para ofrecer esa salida:

```ts
case 'IDENTITY_VERIFICATION_REQUIRED':
  return forbidden({
    message: body.message || 'Necesitás verificar tu identidad para continuar.',
    nextAction: { label: 'Verificar identidad', route: IDENTITY_VERIFICATION_ROUTE },
  });
```

> **Pero `IDENTITY_VERIFICATION_ROUTE` vale `/identity/me`, que es una ruta de la
> API y no del router.** La puerta no lleva a ninguna parte. Brecha `HIGH`, ver
> [A11Y-02](../accessibility/audit-report.md#a11y-02--high--identity_verification_route-no-lleva-a-ninguna-parte).

## Lo que no se puede documentar

| Falta | Por qué |
|---|---|
| El catálogo completo de roles | Solo `SECURITY_ADMIN` aparece nombrado |
| Qué puede hacer cada rol | Lo define la API |
| Qué secciones ve cada actor | Solo hay 8 pantallas de 81 |
| El registro de organizaciones | `/iam/auth/register-organization` está en la lista de rutas públicas del interceptor y **ningún cliente lo llama** |
