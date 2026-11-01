# Evidencia — la receta no es carta libre

Capturas con datos de prueba (cuentas `@alovida.test`), front y API de esta corrección.

| Captura | Qué muestra |
|---|---|
| `c4-mis-recetas-{desktop,mobile}-{light,dark}.png` | Tras recargar: una receta con un pedido vivo dice «Ya tiene un pedido», la ya retirada dice «Retirada»; ninguna ofrece comprar |

Por la API, con una receta nueva emitida por el médico:
- crear la receta con `validTo` vencido → 422 `MEDICATION_VALID_TO_IN_PAST`;
- primer pedido 201; segundo pedido con el primero abierto → 422 `PRESCRIPTION_ITEM_ALREADY_ORDERED`;
- cancelar el primero → el pedido siguiente entra (201);
- sobre la receta ya retirada (pedido → revisar → confirmar → listo → entrega con código → `RETIRADO`): otro pedido → 422;
- el estado clínico del ítem sigue «emitida» después de la entrega.
