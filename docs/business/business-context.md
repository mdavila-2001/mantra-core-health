# Contexto de negocio

> **Alcance de esta página.** Se documenta lo que el código y los documentos del
> repositorio permiten afirmar. **No hay en este repositorio un documento de
> producto**, así que lo que sigue es lo verificable, no una visión de negocio
> completa. Las fuentes normativas (`identidad-visual.md`, el modelo M34) viven
> en el vault del proyecto.

---

## Qué es

**Mantra Core Health** es el frontend web del **ecosistema REDESA**, una
plataforma de salud. Consume una única API (`mantra-core-health-redesa-api`,
NestJS) y sirve a tres tipos de usuario.

Evidencia del dominio, en el propio código:

| Señal | Dónde |
|---|---|
| «Sumate a la red de salud más grande de **Bolivia**» | `register-patient.ts` |
| «Tu salud, conectada» · «Llevá tu historia clínica, tus turnos y tus estudios» | Reclamos de las pantallas |
| Sensibilidad `PHI` obligatoria en cada subida | `files.client.ts` |
| «datos clínicos: columnas de resultados, dosis y rangos alinean por cifra» | `styles.css` |
| «`--text-muted` … jamás para información clínica» | `design-tokens.types.ts` |
| Terminología con conjuntos de valores versionados | `terminology.client.ts` |
| Verificación de identidad y de matrícula | `identity.client.ts` |
| Multi-organización (`tenants[]`, `X-Tenant-Id`) | `session.store.ts`, interceptor |

## El modelo que gobierna la interfaz

El proyecto se rige por un **modelo canónico** (`M34`), que declara:

| Elemento | Cifra |
|---|---|
| Secciones contempladas | **81** |
| Estados de interfaz obligatorios | **9** (S1–S9) |
| Proyecciones materializadas | **14** |

**Los nueve estados son contrato, no una sugerencia visual**, y están codificados
en `ViewState<T>` de forma que las reglas no se puedan incumplir por olvido. Ver
[ADR-0005](../adr/ADR-0005-view-state-m34.md).

Y el sistema de diseño **REDSAT v1.0** rige la identidad, con sus excepciones
WCAG declaradas y medidas.

## Estado de la construcción

| Métrica | Valor |
|---|---|
| Secciones del modelo | 81 |
| **Pantallas implementadas** | **8** |
| Operaciones de API envueltas | 20 |
| Operaciones **con pantalla que las use** | 9 |
| Componentes del sistema de diseño | 48 |

**La infraestructura va por delante de la interfaz**, y es deliberado: hay seis
clientes de API completos y probados, un sistema de diseño de 48 componentes, y
el contrato de los nueve estados — todo listo para que las secciones se escriban
encima.

El menú lateral lo dice sin rodeos:

> *«Hoy tiene lo que existe de verdad… Las 81 secciones del modelo se van
> agregando a medida que sus pantallas se escriben — un ítem que lleva a una ruta
> vacía es peor que no tenerlo.»*

## Lo que hoy se puede hacer

| Capacidad | Estado |
|---|---|
| Registrarse como paciente (con documento) | ✅ |
| Registrarse como profesional (con correo, matrícula y colegio) | ✅ |
| Iniciar sesión con correo o documento | ✅ |
| Elegir organización cuando hay varias | ✅ |
| Verificar el correo desde el enlace | ✅ |
| Recuperar la contraseña de punta a punta | ✅ |
| Mantener la sesión entre recargas | ✅ |
| Cerrar sesión | ✅ |
| Cambiar de organización | ✅ |
| Ver el panel con el estado de la sesión | ✅ |
| Explorar el sistema de diseño | ✅ |
| **Cualquier cosa clínica** | **No implementado** |

## Los tres principios que se leen en el código

### 1 · La autoridad es la API

> *«Esconder un ítem no protege nada —la autoridad es la API, que valida en cada
> petición—; es no ofrecer una puerta que va a estar cerrada.»*

El frontend no autoriza. No verifica la firma del token. No filtra por rol para
proteger.

### 2 · No se filtra existencia

El estado S6 **descarta el mensaje y los detalles del error**, y su tipo no tiene
campos de datos: no se puede construir uno que revele si un recurso existe.

Y la recuperación de contraseña devuelve **siempre el mismo acuse**, exista o no
la cuenta.

### 3 · La antigüedad del dato se dice, no se esconde

Con 14 proyecciones materializadas, el estado S7 **exige** declarar `asOf`, y
`ViewStateHost` lo muestra siempre visible, *«nunca solo en un tooltip»*.

**En un sistema de salud, un dato viejo presentado como fresco es un riesgo
clínico.**

## Lo que no está documentado en ningún lado

| Falta | Consecuencia |
|---|---|
| Documento de producto | Esta página se apoya en el código |
| **Marco normativo** (HIPAA, GDPR, ley boliviana) | [Privacidad](../security/privacy.md) no puede afirmar cumplimiento |
| Acuerdos de nivel de servicio | No hay umbrales de disponibilidad |
| Prioridad de las 81 secciones | No se sabe qué viene después |
| Métricas de éxito del producto | Y no hay analítica para medirlas |

Registradas en [el análisis de brechas](../reports/documentation-gap-analysis.md).
