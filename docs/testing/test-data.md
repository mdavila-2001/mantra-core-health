# Datos de prueba

Sintéticos, deterministas y sin ninguna llamada a un servicio real.

---

## Reglas vigentes, verificadas

| Regla | Estado |
|---|---|
| Ninguna prueba llama a un servicio real | ✅ `HttpTestingController` en todas |
| Datos sintéticos | ✅ literales en cada prueba |
| Deterministas | ✅ sin aleatoriedad |
| Ninguna credencial real en el repositorio | ✅ las de demostración están en el `.env` de la API |
| Ningún dato que parezca PHI | ✅ no hay pantallas clínicas todavía |

## Dónde viven

**No hay una carpeta de fixtures.** Cada prueba declara sus datos:

```ts
const claims = { sub: 'user-1', roles: ['PATIENT'], tenants: ['t-1'] };
```

Con 71 archivos es manejable y tiene una ventaja: **la prueba se lee sola**, sin
saltar a otro archivo para saber qué se está probando.

Cuando la repetición empiece a doler, la respuesta correcta son **constructores**
(`unSessionStore({ tenants: ['a','b'] })`) y no un JSON compartido: un objeto
compartido acopla pruebas que deberían ser independientes.

## Los tokens de prueba

`decodeAccessToken` necesita un JWT real en forma. Las pruebas los arman
codificando en base64url, no con literales pegados.

Por eso `test-setup.ts` comprueba el entorno:

```ts
if (typeof atob !== 'function' || typeof TextDecoder !== 'function') {
  throw new Error('El entorno de pruebas no expone `atob` o `TextDecoder`…');
}
```

> *«el síntoma sería un puñado de pruebas fallando por "token ilegible" —porque la
> función devuelve `null` ante cualquier anomalía, que es lo correcto en
> producción— y nadie miraría el entorno.»*

**Un token de prueba nunca es un token real**, ni siquiera vencido: un JWT
vencido sigue conteniendo claims de alguien.

## Las pruebas que leen archivos del disco

Doce leen `src/styles.css`. **No es un dato de prueba: es la fuente real**, y ése
es el punto — comparar las dos declaraciones del sistema de diseño.

Consecuencia práctica: **esas pruebas fallan si se mueve `styles.css`**, y está
bien que fallen.

## Cuando existan datos clínicos

Ninguna pantalla los muestra todavía. Reglas para cuando las haya:

1. **Nada que parezca real.** Ni un nombre plausible, ni un documento con formato
   válido de una persona, ni un diagnóstico de un caso conocido.
2. **Nada copiado de un entorno real.** Ni siquiera «anonimizado»: la
   reidentificación es más fácil de lo que parece.
3. **Identificadores obviamente falsos**: `paciente-de-prueba-1`, no
   `Juan Pérez`.
4. **Nada de datos de prueba en el repositorio de la API** reutilizados acá sin
   revisar qué contienen.
5. **Valores clínicos fuera de rango** para que nadie los confunda con reales.

La regla 5 es la más práctica: una glucemia de `9999` no se confunde con un dato
de nadie.

## Datos para E2E, cuando existan

| Regla | |
|---|---|
| Cuenta de prueba dedicada, **nunca la de nadie** | |
| Credenciales por entorno, fuera del repositorio | Como ya están las de demostración |
| Sembrado idempotente | Correr dos veces da lo mismo |
| Limpieza posterior, o entorno desechable | |
| **Nunca contra producción** | |

Con la red simulada —que es lo que se hizo— nada de esto hace falta: las
respuestas se declaran en `e2e/support/api.ts`. Ver
[E2E](e2e-tests.md#contra-qué-se-prueba).

## Lo que no hay

| Elemento | Estado | ¿Hace falta? |
|---|---|---|
| Carpeta de fixtures | No | No a esta escala |
| Constructores de objetos de prueba | No | Cuando la repetición duela |
| Generación aleatoria | No | **No, y mejor**: rompe el determinismo |
| Base de datos de prueba | No | Cuando haya E2E contra API real |
| Servidor de simulación (MSW) | No | Playwright ya intercepta la red |
| Simulación de fallos | **Sí** | Ver [Provocar un fallo en la maqueta](fallos-simulados.md) |

**La ausencia de generación aleatoria es deliberadamente buena**: una prueba que
falla una de cada veinte ejecuciones se termina ignorando.
