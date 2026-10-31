# Evidencia — importación masiva estricta, y lo importado cruza con la receta

Capturas con datos de prueba (cuenta de farmacia `@alovida.test`), front y API de esta corrección, 1440×900 claro.

| Captura | Qué muestra |
|---|---|
| `c6-productos-aviso-desktop-light.png` | Catálogo con un producto de receta sin medicamento vinculado (`AMOX-SINVINC`, creado sin concepto: la API devolvió el aviso `MEDICATION_NOT_LINKED`) y uno importado por CSV con `medicamento` (`PARA-CHAVEZ-…`) |
| `c6-vincular-buscador-desktop-light.png` | Editar → «Ficha técnica»: el buscador «Medicamento de la receta» del catálogo de medicamentos |
| `c6-vincular-elegido-desktop-light.png` | Amoxicilina elegida |
| `c6-vinculado-recarga-desktop-light.png` | Guardar (`PATCH` 200) y recargar; en la base, el producto queda con el concepto de amoxicilina |

Por la API, en el mismo entorno:
- `dryRun` con `0`, `""`, `null`, `"true"`, `[]`, `{}` → 400 en los seis, ningún producto escrito;
- vista previa con un medicamento inexistente → `MEDICATION_NOT_FOUND` en esa fila; la carga con `medicamento: Paracetamol` deja el producto vinculado, y al abrir la farmacia una receta compartida con paracetamol el producto importado aparece como coincidencia;
- inventario por sede (`…/sites/:siteId/availability/bulk`): vista previa y carga devuelven lo mismo (una fila válida, otra `PRODUCT_NOT_FOUND`) y la carga escribe 7 unidades en la sede.
