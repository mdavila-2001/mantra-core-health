# Cuentas demo del simulador

Para el backend simulado (`yarn start:demo`, `ng serve --configuration development,demo`). **El simulador acepta
cualquier contraseña que no esté vacía**: se entra con `<clave>@alovida.mock` o con el documento. Estas cuentas existen solo
ahí; no son las cuentas del hospital piloto del modelo (`DEMO-ANA-GUTIERREZ`…, contraseña `Demo-Apoyo-2026`), que son
para la API real.

## Las personas

| Clave (`<clave>@alovida.mock`) | Quién es | Rol de token · clase de cuenta | Qué ver con ella |
|---|---|---|---|
| `hospital_piloto` | Hospital Piloto Mantra (la **cuenta** de la organización) | `USER`, `SECURITY_ADMIN` · `ORGANIZATION` | Todas las pantallas de la organización: controles de sesión, revisión periódica, solicitudes, equipo, actividad |
| `ana` | Ana Gutiérrez, secretaria (permisos por doctor: Pérez y Rojas) | `USER` · `PERSON` | **Su recertificación vence en 9 días**: aviso y botón en «Mis accesos». «Mi actividad». Tiene dos pasos activados |
| `lucia` | Lucía Paz, recepción (Edificio A, piso 1) | `USER` · `PERSON` | **Aviso de dispositivo nuevo** en su primer ingreso de la pestaña. Tiene dos pasos activados |
| `marcos` | Marcos Ribera, call center (Ecografía; Suárez × Sede Norte) | `USER` · `PERSON` | **Aviso de dispositivo nuevo** (sin correo verificado: no puede pedir el código de «Fui yo»); con dos pasos obligatorios **entra con el token de alcance limitado** (`mfaEnrollment`) y queda restringido hasta activarlos en `/my-account/security/mfa` (pide la contraseña y el código de la app es `123456`). Tiene **dos invitaciones de organizaciones pendientes** en `/my-account/security/organization-invitations` |
| `silvia` | Silvia Soria, caja | `USER` · `PERSON` | Su vínculo está **suspendido**: «Mis accesos» muestra «Suspendido: pida a su organización que lo renueve», sin botón |
| `rosa` | Rosa Quiroga, secretaria del Consultorio Dra. Céspedes (organización aparte) | `USER` · `PERSON` | No ve el hospital. Sirve para canjear una invitación del hospital |
| `perez` | Dr. Andrés Pérez, cardiólogo | `PRACTITIONER` · `PERSON` | «Mi equipo» y «Actividad de mi equipo». Tiene dos pasos activados |
| `suarez` | Dr. Martín Suárez, pediatra | `PRACTITIONER` · `PERSON` | Recibe la ampliación de Ana. Con perfil profesional: sirve para canjear un QR multiuso de doctores (queda pendiente en «Médicos del centro») |
| `elena` | Elena Camacho, secretaria en **dos** organizaciones | `USER` · `PERSON` | Dos organizaciones en «Mis accesos». Si el hospital limita el horario del personal y hoy queda fuera, entra al consultorio con el aviso «La organización … no le permite entrar ahora» (`deniedTenants`) |
| `farmacia` | Farmacia Vida (cuenta de organización) | `USER` · `ORGANIZATION` | **No** tiene `SECURITY_ADMIN`: no ve «Controles de sesión» (la API lo exigiría) |

## Personas que figuran en los datos pero no entran

Existen en las listas para que haya qué revisar:

| Persona | Estado del vínculo | Dónde aparece |
|---|---|---|
| Gabriel Rojas (call center) | **Por vencer**: vence en 12 días | Revisión periódica |
| Pedro Camacho (recepción) | **Vencido**: venció hace 6 días, se suspende en 9. Tiene dos permisos | Revisión periódica |
| Silvia Soria (caja) | **Suspendida** hace 7 días por no confirmarse (entra como `silvia`) | Revisión periódica; la **organización** la reactiva al confirmarla (la persona no) |
| Rocío Vargas, Sofía Aguilar, Julia Mamani | Solicitudes pendientes (Rocío vence en 2 días: urgente) | Solicitudes de apoyo |
| Carmen Ibáñez y Luis Terán | Solicitudes **vencidas** (la de Luis no está barrida: la pantalla la trata igual) | Solicitudes de apoyo → «Vencida» |
| Pedro, Silvia, Gabriel, Raúl Peña, Mariana López | Solicitudes ya resueltas (rechazadas, aprobadas, parcial) | Solicitudes de apoyo → Resueltas (con las dos vencidas, siete: cinco y dos en dos páginas) |

La **bitácora** trae unas veinte entradas de los últimos 28 días (agenda, mensajes, búsquedas de pacientes, vínculos), de modo que los
filtros y el CSV tienen con qué trabajar.

## Valores fijos del simulador

| Qué | Valor |
|---|---|
| Código de verificación en dos pasos (cuentas que lo tienen: `ana`, `lucia`, `perez`, `hospital_piloto`) | `123456` |
| Agenda (forma de la API) | `GET /me/support-agenda` contesta solo citas, como la API; los horarios libres salen de `GET /me/support-agenda/free-slots`, que **no existe en la API real** (existe para poder crear citas en la demo) |
| Dispositivo nuevo | Se simula para `lucia` y `marcos` mientras la política lo avise y no lo confirmen. «Fui yo» pide el **código de 8 dígitos** que el simulador «manda al correo» (`12345678`); `marcos` no tiene correo verificado (`DEVICE_CONFIRM_NO_VERIFIED_EMAIL`). «No fui yo» cierra la otra sesión que el simulador crea para cada cuenta |
| Confirmar la identidad (alta y baja de un factor) | Una contraseña cualquiera sirve, salvo `incorrecta` (422 `MFA_REAUTH_FAILED`); sin contraseña ni código, 422 `MFA_REAUTH_REQUIRED`. Quitar un factor: `POST /iam/me/mfa/:factorId/revoke` |
| Horario del personal | Mínimo 4 horas (`SESSION_POLICY_HOURS_TOO_SHORT`); sin horas, `SESSION_POLICY_HOURS_EMPTY`; una regla que dejaría afuera a quien la guarda: `WOULD_LOCK_OUT_ACTOR` / `IP_RULES_WOULD_LOCK_OUT_ACTOR`. `GET /iam/me/network` dice que la API ve la conexión como `203.0.113.7` |
| Contenido clínico en la bandeja | El mensaje clínico del paciente sale como «Contenido clínico oculto: requiere acceso clínico temporal aprobado.» mientras el doctor no apruebe el acceso (`contentHidden`) |
| Códigos de invitación de arranque | `Qm7vK2xTb9LrW4zYp1nDf8aHc5UeJ3oS` (personal de recepción, 20 usos, 3 gastados) y `tZ6hN0cXw3GdR8yVkP2sBj5LmQa9Fe4U` (para el Dr. Flores). **Distinguen mayúsculas.** Los que emite la pantalla son de 32 caracteres base64url al azar |
| Política de arranque del hospital | Todas las cuentas: 15 minutos, avisa dispositivo nuevo. Personal: 10 minutos, avisa. Sin horario, sin red, sin dos pasos |
| Qué se aplica de la política | Plazo de inactividad (va en el token como `idleTimeoutMinutes`), horario, dos pasos (sin factor, el login entra con el token limitado; el horario o los dos pasos de **una** organización no impiden entrar a otra: la que niega va en `deniedTenants`) y aviso de dispositivo nuevo. **El ingreso por red no se simula** (el navegador no tiene una red que comparar); sí el rechazo de guardar redes que dejen afuera a quien las guarda, con el origen fijo `190.129.10.4` |
| Cuándo se suspende un vínculo | Al leerlo, si pasaron más de 15 días desde su fecha de recertificación |

El estado se guarda en `sessionStorage`: sobrevive a F5 y desaparece al cerrar la pestaña. Para volver a empezar, abra una pestaña nueva.
