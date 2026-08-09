# Analítica

**No existe ninguna.** Ni producto, ni script, ni evento.

Para el catálogo de lo que habría que emitir cuando se decida, ver
[eventos analíticos](../observability/analytics-events.md).

---

## Verificado por ausencia

```bash
grep -rn "gtag\|dataLayer\|analytics\|mixpanel\|amplitude\|segment\|posthog\|plausible\|matomo" src/
```

Sin resultados. `package.json` tampoco trae ninguna dependencia de analítica, y
`src/index.html` **no tiene ningún script de terceros**: solo el anti-parpadeo
del tema, que es propio y en línea.

| Mecanismo | Estado |
|---|---|
| Google Analytics / GTM | No |
| Segment, Mixpanel, Amplitude, PostHog | No |
| Plausible, Fathom, Matomo | No |
| Píxeles de terceros | No |
| Grabación de sesión (Hotjar, FullStory) | No |
| Mapas de calor | No |
| Pruebas A/B | No |
| Banner de consentimiento | **No, y hoy no hace falta**: no hay nada que consentir |

## Qué NO se sabe hoy

Las preguntas que nadie puede responder con datos:

| Pregunta | |
|---|---|
| ¿Cuánta gente intenta iniciar sesión y falla? | Sin dato |
| ¿Cuántos registros se empiezan y se abandonan, y en qué campo? | Sin dato |
| ¿Cuántos enlaces de verificación de correo se abren? | Sin dato |
| ¿Cuántas recuperaciones se piden y cuántas se completan? | Sin dato |
| ¿Cuánta gente pertenece a varias organizaciones? | Sin dato |
| ¿Se usa la vitrina del sistema de diseño en producción? | Sin dato |
| ¿Cuántos errores S8/S9 ve la gente por día? | **Sin dato** |

La última no es de producto: es operativa. Sin ella, **la única señal de que la
API está caída para los usuarios es que alguien lo reporte**. Está tratada en
[reporte de errores](../observability/error-reporting.md).

## Lo que sí hay: nada que no sea propio

**Cero scripts de terceros en el paquete.** Es una propiedad real y valiosa:

| Consecuencia | |
|---|---|
| Privacidad | Ningún tercero ve la IP ni el comportamiento de los usuarios |
| Seguridad | Ninguna vía de inyección por una dependencia de ejecución |
| Rendimiento | Ninguna petición ni JavaScript de terceros bloqueando la carga |
| Cumplimiento | No hay transferencia de datos a terceros que declarar |

Las tipografías están **autoalojadas** (`@fontsource*`), así que ni siquiera hay
una petición a Google Fonts —que vería la IP de cada visitante—.

**Esto no se pierde por accidente.** Añadir un script de analítica es una
decisión con consecuencias en las cuatro filas de arriba, y en una aplicación de
salud la primera pesa especialmente: el solo hecho de visitar una sección puede
revelar una condición médica.

## Antes de agregar analítica

Seis cosas que hay que decidir **antes** de elegir herramienta:

1. **Qué se puede medir sin revelar PHI.** «Visitó la sección de oncología» es un
   dato de salud, aunque no lleve el nombre del paciente.
2. **Consentimiento.** Qué se puede medir sin él, y qué exige un banner.
3. **Autoalojado o de terceros.** Un producto autoalojado (Matomo, Plausible)
   mantiene la propiedad de las cuatro filas de arriba; uno de terceros no.
4. **Qué campos están prohibidos**, siempre: identificadores de paciente,
   documentos, correos, nombres de archivo, contenido de formularios, tokens,
   fragmentos de URL con parámetros sensibles.
5. **Retención.** Cuánto tiempo, y quién puede consultarlo.
6. **Cómo se prueba** que un evento no filtra lo que no debe.

## Un caso aparte: telemetría de errores

**No es analítica y no debería esperarla.** Saber que hay un pico de errores S9
es una necesidad operativa, no de producto, y su discusión de privacidad es
distinta —se trata de mensajes de error, no de comportamiento—.

Es la primera que conviene resolver, y está tratada por separado en
[reporte de errores](../observability/error-reporting.md).

## Estado

Registrado como brecha `MEDIUM` de producto (no se puede medir nada) y `HIGH`
operativa (no se detecta una degradación) en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

**No se implementa acá**: añadir telemetría es un cambio de producto, y el plan
lo dice explícitamente — *«No añadir telemetría nueva como parte implícita de la
documentación.»*
