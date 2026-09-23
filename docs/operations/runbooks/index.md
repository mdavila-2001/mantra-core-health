# Runbooks

Trece procedimientos, uno por síntoma. Cada uno con la misma estructura: síntoma,
impacto, diagnóstico seguro, evidencia, mitigación, reversión y escalamiento.

> **Advertencia que aplica a los trece.** No hay telemetría ni monitoreo, así que
> **la detección depende de que alguien reporte**. Y no hay despliegue de
> producción, así que varios pasos describen un entorno que todavía no existe.
> Ver [respuesta a incidentes](../../security/incident-response.md).

---

## Índice

| # | Síntoma | Causa más frecuente |
|---|---|---|
| 1 | [La aplicación no carga](app-no-carga.md) | Servidor caído o artefacto incompleto |
| 2 | [Pantalla en blanco](pantalla-en-blanco.md) | Excepción de render sin frontera |
| 3 | [Chunks desactualizados o fallidos](chunks-desactualizados.md) | Despliegue con pestañas abiertas |
| 4 | [Backend no disponible](backend-no-disponible.md) | La API caída o inalcanzable |
| 5 | [Autenticación en bucle](autenticacion-en-bucle.md) | Refresh token inválido o almacenamiento bloqueado |
| 6 | [CORS bloqueando](cors-bloqueando.md) | La API en otro dominio sin CORS |
| 7 | [Assets no disponibles](assets-no-disponibles.md) | Ruta base o estructura de `dist/` |
| 8 | [Variables de entorno incorrectas](variables-incorrectas.md) | `PUBLIC_API_BASE_URL` mal en el build |
| 9 | [Error de hidratación](error-de-hidratacion.md) | El árbol del servidor no coincide con el del cliente |
| 10 | [Aumento de errores del navegador](aumento-errores.md) | Regresión, o la API degradada |
| 11 | [Degradación de Core Web Vitals](degradacion-web-vitals.md) | Crecimiento del paquete |
| 12 | [Reversión de una entrega](rollback-de-release.md) | Cualquiera de los anteriores |
| 13 | [El mockup no publica lo que ya está en la rama](mockup-no-publica.md) | El build muere por memoria y el temporizador no reintenta |

## Lo primero, siempre

**Pedir el código de soporte.** Cuando el fallo viene de la API, la pantalla
muestra uno copiable:

```text
Código de soporte: abc-123
```

Es lo único que conecta el reporte con los registros del servidor.

**Si no hay código**, el fallo no fue de red: es un fallo de render, y eso
descarta la mitad de los runbooks de una. Ver
[pantalla en blanco](pantalla-en-blanco.md).

## La pregunta que separa las aguas

> **¿El panel muestra S8 o S9 en la tarjeta del directorio?**

| Respuesta | Significa |
|---|---|
| **S8 · Sin conexión** | La petición no llegó. **Es la API, el proxy o la red** — no el frontend |
| **S9 · Error inesperado** | La API respondió mal. **Es la API** |
| Todo bien | El problema está en otra parte |
| No carga ni la pantalla | Runbook 1 o 2 |

**Los estados del M34 son un instrumento de diagnóstico**, no solo de interfaz.
El panel fue construido para eso:

> *«una lectura real contra la API… Es la prueba de punta a punta de que el
> frontend habla con el backend.»*

## Reglas comunes

1. **No tocar producción sin registrar qué se tocó.**
2. **Revertir antes que corregir hacia adelante**, salvo que la corrección sea
   trivial y verificable.
3. **Nada de PHI en el registro del incidente.** Un identificador opaco basta.
4. **La mitad de los síntomas del frontend son de la API.** Escalar sin revertir
   el frontend, que no arregla nada.
5. **Tras cualquier intervención**, el smoke de
   [despliegue](../deployment.md#después--smoke).
