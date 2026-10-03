# Plan — Diagnóstico de SSH con GitHub

- Fecha: 2026-10-03 · Repos afectados: mantra-core-health (documentación de diagnóstico) · Predecesor: ninguno.
- Resultado observable: el desarrollador conoce la causa de `Permission denied (publickey)` en PowerShell y puede autenticar su cuenta tras crear su credencial local y registrar la pública.
- Kill-test: `ssh -vT -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 git@github.com`; no afirmar reparación si sigue rechazando la autenticación.

## Alcance
- IN: inventario de cliente SSH, archivos de identidad (solo nombres), estado de ssh-agent, configuración efectiva, prueba de autenticación y procedimiento mínimo. Documentos en esta carpeta.
- OUT: código de la aplicación, cambios previos del usuario, commits, push, cambios de remotos, claves privadas en logs, sustitución de claves, registro de accesos en GitHub sin intervención del titular.
- Ambigüedades registradas: el mensaje presenta un error sin solicitar explícitamente creación de credenciales; se interpreta como diagnóstico y ayuda para resolverlo. La elección de contraseña de una clave nueva corresponde al usuario y se hace localmente, nunca por chat.

## Ficha de resultado
- Actor: desarrollador en PowerShell.
- Dónde: Windows, desde mantra-core-health.
- Estado inicial: SSH a GitHub falla con publickey.
- Acción: identificar las identidades disponibles y probar autenticación sin interacción.
- Observable: causa sustentada por salida real y pasos exactos.
- Persistencia: solo documentación; si se precisa nueva credencial, su creación y alta serán pasos explícitos del titular.
- Borde/error: distinguir fallo de autenticación, host desconocido, red y cuenta aislada de diagnóstico.
- Peldaño inicial: UNKNOWN.

## H1 — Diagnóstico reproducible
**CA:** Dado el error reportado, cuando se inspecciona el usuario real, entonces se identifica el punto que impide autenticarse.
**DoD:** inventario SSH + prueba con log literal recortado; contraste con documentación oficial; gates de seguridad y evidencia.
**Estado:** A MEDIAS

### H1.S1 — Localizar la causa
**CA:** Dado el perfil local, cuando se prueba SSH, entonces se distingue la ausencia de identidad de una identidad rechazada.
**DoD:** comandos de las microtareas con salida guardada en evidencia/.
**Estado:** HECHO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Inventariar identidades disponibles | Dado el usuario real, cuando se listan sus identidades, entonces se conoce si dispone de clave local | `Get-ChildItem "$env:USERPROFILE\.ssh" -Force` → nombres de archivos, sin contenido privado | HECHO |
| H1.S1.M2 | Reproducir el rechazo de autenticación | Dado el inventario, cuando se conecta a GitHub, entonces el log permite explicar el rechazo | `ssh -vT -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 git@github.com` → causa observable | HECHO |
| H1.S1.M3 | Documentar la resolución aplicable | Dada la causa, cuando se consulta el reporte, entonces hay pasos acordes con la documentación oficial y límites explícitos | `Get-Content docs/trabajo/2026-10-03-github-ssh-publickey/REPORTE.md` → procedimiento, evidencia y no cubierto | HECHO |

### H1.S2 — Habilitar la identidad del titular
**CA:** Dado el diagnóstico, cuando el titular crea su clave y registra su parte pública, entonces GitHub reconoce su cuenta mediante SSH.
**DoD:** `ssh -T git@github.com` → saludo de autenticación satisfactoria correspondiente al titular.
**Estado:** BLOQUEADO

| ID | Microtarea | CA (binario) | DoD (comando de verificación) | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Crear la credencial local del titular | Dada la ausencia de clave, cuando el titular elige su contraseña localmente, entonces dispone de un par SSH | `ssh-keygen -lf "$env:USERPROFILE\.ssh\id_ed25519.pub"` → huella de clave ED25519 | BLOQUEADO |
| H1.S2.M2 | Registrar la pública en GitHub | Dada la clave local, cuando el titular registra su pública como Authentication Key, entonces GitHub acepta su identidad | `ssh -T git@github.com` → saludo autenticado, exit 1 documentado por GitHub | BLOQUEADO |

Estas dos microtareas se agregan tras confirmar que no existe identidad local. Dependen de la elección privada de contraseña y del alta en la sesión del titular. No se elige una contraseña por él, no se genera una clave sin contraseña como sustitución y no se solicita un secreto por chat. No hay una API consumidora propia que un doble pueda destrabar: simular el saludo SSH no demuestra autenticación ni reemplaza el registro real.

## Riesgos y bloqueos previstos
| Riesgo | Impacto | Mitigación |
|---|---|---|
| Usuario aislado distinto del titular | Diagnóstico falso | Ejecutar las pruebas de identidad en el contexto real mediante escalación autorizada |
| Clave privada o token expuesto | Credencial comprometida | No leer contenido privado ni volcar configuraciones generales |
| Registro de clave requiere sesión del titular | No se puede demostrar autenticación final | Entregar el alta exacta en GitHub y no simular una autenticación exitosa |
| Cambios previos del usuario | Riesgo de mezclar trabajo | Solo agregar esta carpeta; sin indexar ni modificar lo existente |

## Aplicabilidad
- Skills: outcome-first, context-thrift, factual-discovery, anti-hallucination-guard, scope-discipline, native-code-patterns (sin código que modificar), progress-reporting, root-cause-debugging, rationalization-guard, evidence-and-verification, finish-your-turn, windows-dev-environment, security-guardrails, qa-evidence-reporting, agent-orchestration y agent-resource-control.
- Sin UI, datos clínicos, código de aplicación o PR: no aplican build, suite frontend, capturas ni gates de PR.
- La regla 65 no transforma una simulación de autenticación en acceso real: no hay consumidor propio que implementar contra un doble en esta tarea de diagnóstico.
- Un agente de solo lectura verifica fuentes oficiales. Concurrencia: uno; sin procesos pesados.

## Hallazgos iniciales
- El pull obligatorio de AlovidaPromptManager respondió `Already up to date.` en el contexto del titular. El intento aislado había fallado por ownership; no se alteró safe.directory.
- OpenSSH instalado: OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2.
- El remoto origin usa HTTPS. El fallo de `ssh -T` y el transporte actual del repo son superficies distintas.
- Hay cambios previos en el árbol y en el índice; quedan fuera del alcance.
- La carpeta .ssh del titular contiene únicamente known_hosts. Todas las identidades predeterminadas dan type -1; ssh-agent está Stopped/Disabled.
- SSH alcanza GitHub, verifica la clave del host conocida y termina con Permission denied (publickey), exit 255, sin ofrecer una clave de usuario.
- `git ls-remote origin HEAD` mediante HTTPS devuelve una referencia HEAD y exit 0. No demuestra permisos de escritura ni autenticación SSH.
