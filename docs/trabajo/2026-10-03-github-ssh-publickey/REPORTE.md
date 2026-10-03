> **AVANCE: 3 / 5 — 60 %. Autenticación SSH: FAIL; causa identificada.**

# Reporte — SSH a GitHub sin identidad local

- Fecha: 2026-10-03 · Plan: [PLAN.md](./PLAN.md).
- Rama: marcelo/fix-perfil-medico-ux-credenciales-especialidades.
- Commit local observado: b84f74aaf3a359de93c53ab05941e2ec7ac5d0c1.
- Entorno: PowerShell, OpenSSH_for_Windows_9.5p2, contexto del titular.
- Peldaño: DISCOVERED para la causa; WRITTEN para el procedimiento. SSH no está reparado.

Falla porque OpenSSH no dispone de una identidad de usuario: la carpeta .ssh solo contiene known_hosts y el agente está detenido/deshabilitado. La red y la validación del host GitHub completan correctamente; no se llega a ofrecer una clave de usuario. Clasificación: ENTORNO, demostrada por inventario y conexión real.

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Identificar ausencia de clave en las rutas efectivas | `Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE '.ssh') -Force` | PASS diagnóstico: únicamente known_hosts |
| H1.S1.M2 | Reproducir el rechazo con causa observable | `ssh -vT -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=10 git@github.com` | PASS reproducción; autenticación FAIL, exit 255 |
| H1.S1.M3 | Documentar procedimiento y límites | `Get-Content -LiteralPath 'docs\trabajo\2026-10-03-github-ssh-publickey\REPORTE.md' -Raw -Encoding UTF8` | PASS lectura del artefacto; ejecución del procedimiento pendiente |

## A medias
### H1 — Habilitar SSH
- Qué anda: conexión SSH hasta autenticación y validación del host; lectura del remoto actual por HTTPS, exit 0.
- Qué no anda: autenticación SSH, Permission denied (publickey).
- Qué falta exactamente: crear el par ED25519 con contraseña elegida localmente por el titular, registrar su pública en GitHub y ejecutar ssh -T.
- Dónde quedó: documentos de esta carpeta; ninguna modificación de configuración o credenciales. El código de aplicación y sus cambios previos no se tocaron.

## Pendiente
| ID | Estado | Qué lo destraba |
|---|---|---|
| H1.S2.M1 | BLOQUEADO | El titular elige la contraseña de la nueva clave en su terminal local |
| H1.S2.M2 | BLOQUEADO | El titular agrega la pública en su sesión de GitHub y ejecuta la prueba final |

## Procedimiento para el titular
En PowerShell normal, crear la clave:

```powershell
ssh-keygen -t ed25519 -C "github-windows"
```

Aceptar la ruta predeterminada con Enter y elegir una contraseña cuando la solicite. El comentario github-windows es una etiqueta, no determina la cuenta: la cuenta queda asociada al registrar la pública. La ausencia de clave se confirmó durante esta sesión; si aparece una advertencia de sobrescritura, no reemplazar una clave existente.

Copiar únicamente la pública:

```powershell
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
```

Abrir [GitHub → SSH and GPG keys](https://github.com/settings/keys), elegir New SSH key, tipo Authentication Key, pegar la pública y guardar. La privada permanece local.

Probar en la misma cuenta de Windows:

```powershell
ssh -T git@github.com
```

Introducir la contraseña local si la pide. El resultado esperado, **no observado todavía**, es un saludo con el usuario autenticado. GitHub documenta exit 1 incluso en el caso satisfactorio porque no ofrece shell interactivo.

El agente no es obligatorio para esta prueba: puede usarse para recordar la contraseña más adelante. El remoto del repo ya usa HTTPS; se confirmó acceso de lectura y no se cambió a SSH.

## Evidencia
[Comandos y salida literal recortada](./evidencia/diagnostico.txt).

La lectura del reporte devolvió literalmente el procedimiento guardado, entre otros fragmentos:

```text
ssh-keygen -t ed25519 -C "github-windows"
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | Set-Clipboard
ssh -T git@github.com
```

Esto demuestra la presencia de los pasos en el artefacto, no su ejecución ni autenticación positiva.

```text
{"Name":"known_hosts","Length":93}
ssh-agent status=Stopped startType=Disabled
debug1: Connection established.
debug1: Host 'github.com' is known and matches the ED25519 host key.
debug1: No more authentication methods to try.
git@github.com: Permission denied (publickey).
ssh_exit=255
```

Prueba HTTPS, independiente de SSH:

```text
bf8171b18a5ec04178a0e0f7b13bae23c35a4668	HEAD
https_exit=0
```

Hipótesis descartadas: puerto/red bloqueados (Connection established); host desconocido (known and matches). No hay evidencia de una clave rechazada por cuenta equivocada: el cliente no dispone de una clave para ofrecer.

## Seguridad
- Amenazas consideradas: exposición de privada, aceptación de host desconocido, sobrescritura de clave, elección de contraseña por el agente. Categorías relevantes: A02, A04 y A07.
- Controles: inventario de nombres sin leer privadas; StrictHostKeyChecking=yes; modo BatchMode para diagnóstico; generación y contraseña en terminal del titular; solo .pub al portapapeles.
- Negativo real: sin identidad, GitHub deniega acceso con publickey, exit 255. Positivo SSH pendiente.
- No se cambiaron servicios, políticas, safe.directory, config SSH, remote origin ni controles de acceso.
- SAST/SCA y pruebas de aplicación: no aplican a documentación de diagnóstico sin cambios de código o dependencias.

## No cubierto
- Creación de clave, alta en GitHub, autenticación SSH positiva y persistencia después de reiniciar.
- Permiso de push: ls-remote solo verifica lectura. No se efectuó push.
- Claves fuera de las rutas efectivas o en otros dispositivos: no se hizo búsqueda general de secretos.
- Frontend, backend y cambios previos del usuario: no forman parte de este diagnóstico.

## Desvíos del plan
- Se agregaron H1.S2.M1 y H1.S2.M2 al confirmar ausencia de identidad; quedan explícitamente pendientes del titular.
- Se verificó lectura HTTPS al observar que ese es el transporte del remoto actual.
- No se simula un éxito SSH: no hay código consumidor que avanzar contra un doble y eso no demostraría acceso real (regla 65).

## Riesgos residuales
- El error SSH continuará hasta crear y registrar la credencial. Responsable: titular, al ejecutar el procedimiento.
- Si la pública se registra en otra cuenta, el saludo identificará esa cuenta; debe comprobarse antes de usar SSH con repos privados.

## Decisiones y ambigüedades
- Se interpretó el error compartido como solicitud de diagnóstico y resolución. Se completó el diagnóstico; la elección privada de contraseña y el registro de acceso corresponden al titular.
- No se decidió que una clave deba carecer de contraseña para automatizar su creación.
- Las skills de Windows y seguridad cubren esta tarea; no se encontró en el router una skill dedicada a SSH/GitHub. No se modificó el catálogo.
- Instrucciones del repo y estándar: ninguna contradicción aplicable. El formato de checkpoints se adaptó a prosa breve por las instrucciones de comunicación de la sesión.

## Fuentes
- [GitHub: generar una clave y gestionar el agente en Windows](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows).
- [GitHub: registrar la clave pública](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account).
- [GitHub: probar conexión y código de salida](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection).
- [GitHub: Permission denied (publickey)](https://docs.github.com/en/authentication/troubleshooting-ssh/error-permission-denied-publickey).
