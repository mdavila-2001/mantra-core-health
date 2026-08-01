# Actualizaciones optimistas

**No existe ninguna.** Todas las mutaciones esperan la respuesta del servidor
antes de cambiar lo que se ve.

Esta página documenta por qué eso es correcto hoy y qué haría falta si dejara de
serlo.

---

## El patrón actual: pesimista

```ts
this.state.set(loading());                    // el botón se bloquea

this.iam.resetPassword({ token, newPassword }).subscribe({
  next: (resultado) => {
    this.state.set(ready(null));
    this.revokedSessions.set(resultado.revokedSessions);
    this.done.set(true);                      // recién acá cambia la pantalla
  },
  error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
});
```

Nada cambia hasta que el servidor confirma. La persona ve el botón en modo carga
y después el resultado.

## Las cinco mutaciones que existen hoy

| Operación | Pantalla | Por qué el optimismo no aplica |
|---|---|---|
| Iniciar sesión | Login | El resultado **son las credenciales**. No hay nada que adivinar |
| Registrar paciente | Registro | Devuelve identificadores que el cliente no puede inventar (`patientCode`) |
| Registrar profesional | Registro | Ídem |
| Pedir recuperación | Recuperar | El acuse es toda la respuesta |
| Fijar contraseña nueva | Nueva contraseña | Devuelve `revokedSessions`, un dato que solo el servidor sabe |
| Cerrar sesión | Armazón | **Ya es optimista.** Ver abajo |

**En las cinco primeras, el servidor devuelve información que el cliente no
puede predecir.** Ser optimista significaría inventar un `patientCode` o un
número de sesiones revocadas, y después corregirlo. Sería peor.

## La excepción: cerrar sesión

```ts
logout(): void {
  this.iam.logout().subscribe({
    next:  () => this.clearLocal(),
    error: () => this.clearLocal(),     // ← se limpia igual
  });
}
```

**Es optimista en el sentido que importa**: el resultado local es el mismo pase
lo que pase.

> *«si la petición falla, la persona igual quiso salir, y dejarla adentro por un
> error de red sería lo peor de los dos mundos. El token local se descarta y el
> del servidor caduca solo.»*

Es el caso en el que el optimismo es la respuesta correcta: la acción es
**idempotente y no destructiva**, y el peor escenario —que el servidor no se
entere— se resuelve solo cuando el refresh token expire.

## Qué haría falta para que valiera la pena

Una actualización optimista paga cuando se cumplen las cuatro:

1. **La operación es frecuente.** Marcar leído, favoritear, cambiar un
   interruptor.
2. **El resultado es predecible.** El cliente sabe exactamente cómo va a quedar.
3. **El fallo es raro.** Si falla el 10 % de las veces, la reversión se convierte
   en el caso habitual.
4. **La reversión es entendible.** La persona puede comprender que algo volvió
   atrás, y por qué.

**Ninguna operación de este frontend cumple las cuatro hoy.**

## Lo que haría falta construir

Además de la lógica de cada caso, tres piezas que no existen:

| Pieza | Estado |
|---|---|
| Caché donde escribir el valor optimista | **No existe** — ver [caché](caching.md) |
| Mecanismo de reversión | No existe |
| Forma de avisar que algo se revirtió | Existe `ToastService`, pero sin acción de deshacer |

**Sin caché no hay actualización optimista posible**, porque no hay dónde
escribir el valor provisional que no sea la señal local de una pantalla.

## Riesgo específico de un sistema de salud

Un valor clínico que aparece en pantalla **antes** de que el servidor lo acepte
es un valor que alguien puede leer y usar aunque nunca se haya guardado.

Para lecturas y para acciones de interfaz, el optimismo es una comodidad. Para
una dosis, una indicación o un resultado, **no lo es**: la confirmación del
servidor no es latencia que esconder, es parte del significado del dato.

Cualquier propuesta futura debería separar explícitamente:

| Tipo de dato | Optimismo |
|---|---|
| Preferencias de interfaz (tema, orden, filtros) | Razonable |
| Acciones reversibles sin consecuencia clínica | Evaluable caso por caso |
| **Cualquier dato clínico** | **No** |

## Estado

**No es una brecha.** Es una ausencia coherente con lo que la aplicación hace
hoy, y la propuesta correcta es no implementarla hasta que exista un caso que la
justifique. Registrado así en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
