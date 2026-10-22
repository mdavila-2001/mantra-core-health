# Pendiente de decisión — «Mis cuestionarios» del paciente

**Estado:** oculto del menú desde el 25/09/2026. El código, la ruta y la pantalla siguen enteros.

## Qué se hizo

El propietario pidió sacar «Mis cuestionarios» de la vista del paciente porque **todavía no está
decidido qué hacer con la sección** — no porque esté mal, rota o descartada. Se aplicó el mecanismo
que la casa ya usa para esto exactamente (`fueraDelMenuPara`, `navigation.map.ts`, la misma pieza
que usan «Ajustes» y el ícono de Chats): la sección sigue existiendo, con su ruta
(`/my-account/questionnaires`), su guard y su pantalla intactos — sólo deja de ocupar un renglón en
el menú lateral del paciente. Sigue alcanzable por enlace directo y por «Tus accesos».

**No se tocó ni se borró ningún archivo de la pantalla, del módulo `M-surveys` ni del backend.**
Revertir esto es una sola línea: quitar `fueraDelMenuPara: [ANY_ROLE]` de la entrada
`my-account/questionnaires` en `src/app/core/navigation/navigation.map.ts`.

## Qué falta

**Charlar con el propietario qué hacer con la sección de acá en más.** Opciones sobre la mesa, sin
que ninguna esté decidida:

- Dejarla oculta permanentemente y, en ese caso, evaluar si vale la pena retirar el código en un
  trabajo aparte (no de paso, con su propio plan).
- Rediseñarla o cambiarle el alcance antes de volver a mostrarla.
- Devolverla al menú tal como está, si el motivo de ocultarla era otro (por ejemplo, timing de
  lanzamiento) y no el contenido de la pantalla.

Hasta que eso se converse, la sección queda **oculta pero viva**: no es un `TODO` de código, es una
decisión de producto sin tomar.
