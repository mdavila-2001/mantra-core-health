# Contratos de componente y transición

## Ficha de componente

Nombre/ruta; categoría visual; consumidores; propósito; semántica; entradas; eventos; estado controlado/no controlado; invariantes; variantes admitidas; combinaciones inválidas; foco/teclado; contenido extremo; tokens; responsabilidades excluidas; pruebas; ejemplos de composición; propietario real cuando exista.

## Matriz de estados

Una fila por estado aplicable: normal, hover, pressed, focus-visible, seleccionado, ocupado, deshabilitado, read-only, error, éxito o estado específico. Registrar apariencia, semántica, interacción permitida, anuncio accesible y condición de entrada/salida. No todos los estados corresponden a todos los componentes.

## Ficha de transición

ID; componente/flujo; cambio explicado; disparador; estado inicial/final; propiedades animadas; duración/curva; inicio de acción funcional; interrupción; foco; variante reducida; fallback; coste medido; prueba; evidencia; decisión de mantener/simplificar/retirar.

## Ejemplo de criterio verificable

“Cerrar el panel durante su apertura deja el panel cerrado, devuelve el foco al disparador si existe y no impide volver a abrirlo; con movimiento reducido la misma secuencia funciona sin desplazamiento”.

Ese criterio se puede probar. “La animación debe verse Ultra HD y perfecta” expresa una aspiración, pero no un contrato técnico.
