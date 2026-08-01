# Runbook 1 · La aplicación no carga

**Síntoma.** El navegador no muestra nada: error de conexión, 502, 504, o una
espera indefinida. Ni siquiera el login.

**Impacto.** Total. Nadie puede usar la aplicación.
**Severidad.** S1.

---

## Diagnóstico

Todos los pasos son de solo lectura.

### 1 · ¿El servidor responde?

```bash
curl -I https://<dominio>/auth
```

| Resultado | Siguiente |
|---|---|
| `200` | No es esto: ir a [pantalla en blanco](pantalla-en-blanco.md) |
| `502` / `504` | El proceso de Node no está o no responde → paso 2 |
| Sin conexión / DNS | Red, DNS o certificado → paso 4 |
| `404` | Ruta base o `express.static` → [assets](assets-no-disponibles.md) |

### 2 · ¿El proceso está vivo?

```bash
# según el destino
docker ps | grep mantra
# o
ps aux | grep server.mjs
```

Y en los registros del proceso, los dos fallos más probables:

| Mensaje | Causa |
|---|---|
| `Cannot find module './env.generated'` | Se compiló sin `yarn env:generate` |
| `Cannot find module 'express'` / `@angular/ssr` | Resolución de dependencias bajo PnP en la imagen |
| `EADDRINUSE` | El `PORT` ya está ocupado |

Los dos primeros son de **build**, no de ejecución: el artefacto está incompleto.

### 3 · ¿El artefacto está completo?

```bash
ls dist/mantra-core-health/browser/index.html
ls dist/mantra-core-health/server/server.mjs
```

`server.mjs` busca `../browser` **relativo a sí mismo**:

```ts
const browserDistFolder = join(import.meta.dirname, '../browser');
```

Si la estructura `dist/mantra-core-health/{browser,server}/` no se preservó al
copiar, el servidor arranca y **no encuentra nada que servir**.

### 4 · ¿Es red, DNS o TLS?

```bash
dig +short <dominio>
curl -Iv https://<dominio> 2>&1 | grep -i "certificate\|SSL"
```

Un certificado vencido produce el mismo síntoma para el usuario.

## Evidencia a reunir

- [ ] Código de respuesta HTTP y cabeceras
- [ ] Registros del proceso, últimas 100 líneas
- [ ] Versión desplegada — **hoy no hay identificador de build** (`version: 0.0.0`)
- [ ] ¿Coincide con un despliegue reciente?
- [ ] ¿Afecta a todo el mundo o a algunos?

## Mitigación

| Causa | Acción |
|---|---|
| Proceso caído | Reiniciar. Si vuelve a caer, revisar registros antes de insistir |
| Artefacto incompleto | **Revertir.** Un artefacto mal construido no se arregla en caliente |
| Puerto ocupado | Corregir `PORT` |
| Certificado | Renovar |
| Causa desconocida | **Revertir** |

## Reversión

[Runbook 12](rollback-de-release.md).

## Escalamiento

| Situación | A quién |
|---|---|
| Infraestructura, DNS, TLS | Quien opere el destino |
| Artefacto mal construido | Equipo de frontend |
| **No es del frontend** | Si `/auth` responde 200, el problema es otro |

## Prevención

- **Versionar el artefacto** — hoy no se puede saber qué está corriendo (`HIGH`).
- Comprobación de salud en el contenedor.
- Monitoreo externo de disponibilidad: **no necesita instrumentar nada**, solo
  una URL. Ver [paneles y alertas](../../observability/dashboards-and-alerts.md).
- Smoke tras cada despliegue.
