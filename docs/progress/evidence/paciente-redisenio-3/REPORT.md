# Rediseño del paciente — tercera vuelta (22/10/2026)

Pedido: «ahora mejor el resto de cosas, hay muchas cosas que aún faltan». Las
pantallas que la primera y la segunda vuelta no habían tocado seguían planas:
historia clínica, farmacia y dependientes.

El directorio de médicos (paginación, filas sin aire, `@defer` del tablero) lo
resolvieron #1146 y #1149, mergeados antes; este PR se rebasó encima y no toca
`directory-page`, `result-card` ni `access-tree`.

## Qué cambió

| Pantalla | Antes | Después |
|---|---|---|
| Mi historia clínica | Lista plana de títulos | Cada atención es una tarjeta con ícono de carpeta clínica; al abrirse se realza |
| Farmacia | «Escriba qué busca…» como texto suelto, pegado a los botones y a «Sus últimos pedidos» | Tarjeta con ícono de píldora; pedidos separados por una línea |
| Dependientes | Vacío con un párrafo largo | Ícono de personas y «cómo funciona» en tres pasos numerados — mismo contenido, sin segundo botón (criterio humano, regla 2) |

Los estilos van en la hoja de cada componente bajo
`:host-context(.app-shell--paciente)`: no suman al paquete inicial ni cambian
otros roles.

## Verificación

- `yarn build` (producción) y `yarn typecheck`: OK.
- Pruebas de historia, farmacia y dependientes: verdes.
- En navegador: las tres pantallas a 1440 y 390, claro y oscuro.

Antes = el sitio publicado de `mockup`.
