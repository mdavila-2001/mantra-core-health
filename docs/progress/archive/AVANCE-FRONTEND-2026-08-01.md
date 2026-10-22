# Avance del frontend — sesión del 2026-08-01

**Rama:** `justin/avance-2026-08-01` · **Base:** `dev` en `16bdf3f` (el merge de los organismos de
Marcelo) · **Estado verificado al cierre:** 778 pruebas en verde sobre 68 archivos ·
`yarn test:coverage` pasando sus umbrales · `yarn build` con SSR y 8 rutas prerenderizadas ·
flujo completo probado contra la API real.

Este documento tiene tres partes: **lo que hay**, **lo que falta**, y una tercera que se volvió la
más importante mientras escribíamos: **el trabajo paralelo que apareció en `origin/dev`** y que hay
que reconciliar antes de mergear nada.

---

## 1 · Lo que hay (hecho y verificado en esta sesión)

### El ciclo de autenticación, completo y funcionando de punta a punta

Probado contra la API viva con la base reconstruida, no solo con specs:

```
POST /iam/auth/register-patient       → 201 · PAT-0ac04878-…
POST /iam/auth/register-practitioner  → 201 · PRC-5e2c73e0-…
POST /iam/auth/login (correo del médico recién creado) → 200 con tokens
POST /iam/auth/login (contraseña mala)                 → 401
POST /iam/auth/forgot-password (cuenta real y falsa)   → 202, mismo cuerpo exacto
GET  localhost:4200/auth               → 200, SSR del login real
```

### Pantallas (todas nuevas de esta sesión)

| Ruta | Qué es |
| --- | --- |
| `/auth` | Login: un solo campo que acepta correo o documento (decide por la arroba), MFA opcional, enlaces a registro y recuperación |
| `/auth/registro` | **Registro dual**: selector Paciente / Profesional de salud, dos formularios distintos porque los obligatorios no se solapan |
| `/auth/recuperar` | Pedir el enlace de recuperación; el acuse no revela si la cuenta existe |
| `/auth/nueva-clave?token=…` | Fijar contraseña nueva; informa cuántas sesiones se cerraron |
| `/auth/verificar?token=…` | Landing del correo de verificación; un token vencido no se presenta como alarma |
| `/auth/organizacion` | Selector de organización cuando el token trae varios tenants, con nombres legibles (`tenantNames`) |
| `/` | Home real: saluda por nombre, muestra organización y roles del token, cierra sesión contra el servidor. Reemplaza al andamio de Angular |

### Infraestructura de sesión y errores

- **J3 · Interceptor de autenticación**: `Bearer` + `X-Tenant-Id`, refresco único en vuelo
  (dos 401 simultáneos → un solo refresh), reintento que no recursa, rutas públicas exceptuadas.
- **J8 · `AuthService` + guard**: sesión con signals, persistencia solo del refresh token con la
  degradación del `ThemeService`, `restoreSession()` al arrancar (antes de que el router evalúe el
  guard, para que no parpadee el login), guard = estado S1 del M34 que decide sin consultar la API.
- **J4 · Modelo de errores** (`api-error.ts` + `error-to-view-state.ts`): mapeo por `code` del
  catálogo real de Pablo — nunca por mensaje ni por status HTTP solo. Los dos 403 separados:
  `FORBIDDEN` es muro sin acción, `IDENTITY_VERIFICATION_REQUIRED` es puerta con ruta al flujo.
  El `NOT_FOUND` descarta mensaje y detalles a propósito (S6: no filtrar existencia).
- **Logout contra el servidor** (`POST /iam/auth/logout`), que limpia localmente **pase lo que
  pase**: si la red falla, la persona igual quiso salir.

### Design system y calidad

- **Tarjeta 13 · CVA en `radio-group` y `switch`** — desbloqueó J10; el CVA del grupo vive en el
  grupo porque el grupo ES el control.
- **Tarjeta 11 · `vitest.config.ts` con umbrales bloqueantes** (80/80/60), medidos antes de
  fijarlos y probados en las dos direcciones (pasa con lo actual, falla al subirlos a mano). La
  vitrina quedó excluida del cómputo: 118 funciones de demostración hundían `features/` de 84,6 % a
  26,1 %.
- **Tarjeta 10 · Breakpoints tokenizados** (`--bp-sm/md/lg` + `breakpoints.ts`), extraídos de lo
  que el código ya usaba (780 px de facto), con prueba de deriva CSS ↔ TS. CSS no admite variables
  en `@media`: el número va literal con comentario, la variable es la fuente.
- **`autocomplete` en el átomo `Input`** — bug real encontrado probando: el navegador guardaba el
  número de credencial como nombre de usuario. Ahora cada campo declara su pista (`username`,
  `email`, `new-password`, `off`…), con la distinción fina de que el correo es `username` en el
  alta de profesional (es su credencial) y `email` en la de paciente (es solo contacto).
- **Tarjeta 14 · Mensaje al diseñador** — escrito en `PARA-EL-DISENADOR.md` (raíz del workspace,
  fuera de este repo), pendiente de enviar.

### Fuera de este repo, en la misma sesión

- Rebuild completo de la base (tarjeta 2): 1 155 tablas, 6 007 FKs, 59 schemas.
- Bootstrap del primer `SECURITY_ADMIN` ejecutado (`admin@redesa.test`).
- Diagnóstico del bug `tenants: []` (concepto de membresía equivocado) — Pablo lo corrigió.
- Migración de recuperación de contraseña aplicada a mano a la base local (el rebuild fue antes
  del commit que la trae; un rebuild futuro la aplica sola).

---

## 2 · LO MÁS IMPORTANTE: hay trabajo paralelo en `origin/dev` que duplica el nuestro

Mientras esta sesión avanzaba, **el agente de la máquina de Pablo trabajó sobre el frontend** y
subió a `origin/dev` (PRs #4, #5 y #6, entre las 03:39 y las 06:31):

1. Mergeó nuestra rama publicada `justin/j3-t13-auth-y-cva` (J3 + tarjeta 13 + docs).
2. Sobre ella construyó **su propia fase 3**: `a9edf5c` «cierra la fase 3 con errores tipados,
   sesión y pantallas de ingreso», `865c107` cliente de terminología, `803e8fa` consumo del 403
   tipado, logout y nombres.

El resultado es un **tenedor**: dos implementaciones de lo mismo, ninguna contiene a la otra.

| Pieza | `origin/dev` (agente de Pablo) | Esta rama (nosotros) |
| --- | --- | --- |
| Login | SI (suyo) | SI (nuestro, distinto) |
| Recuperación de contraseña (2 pantallas) | SI (suyas) | SI (nuestras) |
| `AuthService` + guard | SI (suyos) | SI (nuestros) |
| Modelo de errores | `api-error.ts` de **322** líneas | `api-error.ts` (76) + `error-to-view-state.ts` |
| **Registro dual paciente/profesional** | no | **SI** |
| **Selector de organización** | no | **SI** |
| **Landing de verificación de correo** | no | **SI** |
| **Home real con logout** | no (queda el andamio) | **SI** |
| **Cliente de terminología** | **SI** | no (nuestra carpeta sigue con README) |
| **Umbrales de coverage** (t11) | no | **SI** |
| **Breakpoints** (t10) | no | **SI** |
| **`autocomplete` en `Input`** | no | **SI** |
| `COORDINACION-AGENTES.md` (protocolo entre agentes) | SI | no |

**Qué significa:** mergear esta rama a `dev` tal cual va a chocar de frente en login,
recuperación, `AuthService`, guard y modelo de errores. **No es un merge mecánico: es una decisión
de qué implementación queda en cada pieza.** Nadie debería resolver esos conflictos sin mirar los
dos lados, porque ambos funcionan y tienen pruebas.

**Recomendación concreta para la reconciliación** (a decidir con Pablo/Marcelo):

- Donde solo un lado tiene la pieza, entra esa: su cliente de terminología; nuestro registro dual,
  selector, verify-email, Home, t11, t10 y `autocomplete`.
- Donde hay dos, hay que elegir **una** por pieza y portarle lo que la otra tenga de más. Nuestro
  lado tiene a favor la verificación de punta a punta contra la API real y el mapeo S1–S9 del M34;
  el suyo habría que leerlo con el mismo cuidado (322 líneas de `api-error.ts` sugieren un modelo
  más extenso — puede ser mejor o solo más largo, no lo juzgamos sin leerlo).
- El `COORDINACION-AGENTES.md` de ellos parece ser el canal por el que su agente coordina; vale
  adoptarlo como práctica si vamos a seguir trabajando en paralelo.

---

## 3 · Lo que falta

### Se puede hacer ya (nada lo bloquea)

- **La reconciliación del punto 2.** Es lo primero: cada hora de trabajo nuevo sobre cualquiera de
  las dos ramas agranda el conflicto.
- **Alta de organización** — el formulario condicional por tipo de tenant (PAYER/BROKER/PROVIDER).
  El backend está completo y el cliente de terminología ya existe… en la rama de ellos.
- Portar nuestro pendiente de la lista del diseñador (enviar `PARA-EL-DISENADOR.md`).

### Bloqueado por decisión, no por código

- **Tarjetas 22 (verificación de identidad) y 23 (altas administrativas):** la aplicación no tiene
  interior — sin navegación ni área de administración, cada pantalla nueva es una ruta suelta.
  Inventar el armazón sin diseño es trabajo que probablemente se tire; decidirlo primero.
- **MFA:** el campo queda siempre visible como opcional porque el backend no señala cuándo hace
  falta (no hay código de error para eso). Cuando lo declare, se oculta hasta que lo pida.
- **`localStorage` para el refresh token:** superficie de XSS conocida. La alternativa
  (`httpOnly` cookie) exige cambio del backend. Decisión de seguridad previa a producción.

### Deuda anotada (ninguna urgente)

- 20 consultas de medios escritas `max-width` (escritorio-primero) contra la regla mobile-first.
  Convertirlas es refactor visual con riesgo; merece tarjeta propia.
- `core/` en ~82 % de cobertura, dos puntos sobre el umbral: el próximo agregado sin pruebas lo
  hace fallar.
- El panel «Avisos (dev)» asoma en toda pantalla en desarrollo (en producción no se descarga).
- El texto de la columna de marca del login se corta en ventanas bajas.
- `postgres-init` falla en el primer arranque de un stack recién creado (carrera con Postgres);
  el reintento lo resuelve. Está reportado.

### Decisiones nuestras pendientes de validación

Todas documentadas en los mensajes de commit correspondientes; las dos que pedían decisión de
equipo: **el registro no inicia sesión sola** (lleva al login — la tarjeta 21 pedía decidirlo y
documentarlo, está documentado) y **los avisos de error quedan fijos** hasta cerrarse (validar con
el diseñador).

---

## 4 · Cómo levantar todo (probado)

```bash
# almacenes (nunca el servicio `api` del compose)
cd mantra-core-health-redesa-api && docker compose up -d postgres postgres-init mongodb mongo-init redis opensearch opensearch-init minio
# API en el host
corepack yarn build && corepack yarn start:prod        # :3000
# bootstrap del primer admin (una vez, idempotente)
corepack yarn postman:bootstrap                        # admin@redesa.test / S3cret-passw0rd
# frontend
cd ../mantra-core-health && corepack yarn start        # :4200
```

`yarn` no está en el PATH de esta máquina: usar siempre `corepack yarn`.
