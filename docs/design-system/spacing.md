# Espaciado y radios

Grilla estricta de 4 px y ocho radios, uno de ellos con regla de uso.

---

## Espaciado

```css
--sp-1: 4px;  --sp-2: 8px;   --sp-3: 12px;  --sp-4: 16px;  --sp-5: 20px;
--sp-6: 24px; --sp-8: 32px;  --sp-10: 40px; --sp-12: 48px; --sp-16: 64px;
--sp-20: 80px;
```

**El número del token es el múltiplo, no el píxel**: `--sp-4` son 16 px, no 4.

### Los escalones que faltan, faltan a propósito

```ts
/** Grilla estricta de 4 px. Los escalones 7, 9, 11… no existen a propósito. */
export const SPACING_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] as const;
```

Once escalones, no veinte. Un catálogo con todos los múltiplos de 4 no es un
sistema: es una regla graduada, y con ella dos personas eligen 28 y 32 para el
mismo hueco.

La escala se **densifica abajo** (1, 2, 3, 4, 5, 6 seguidos) y se **espacia
arriba** (8, 10, 12, 16, 20), que es como se usa el espacio: la diferencia entre
4 y 8 px importa dentro de un control; la que hay entre 64 y 68 no importa en
ninguna parte.

### Uso

```ts
spacingToken(4)              // '--sp-4'  — tipado literal
cssVar(spacingToken(4))      // 'var(--sp-4)'
```

```css
.tarjeta {
  padding: var(--sp-6);
  gap: var(--sp-3);
}
```

`spacingToken(7)` **no compila**: el 7 no está en la unión.

## Radios

| Token | Valor | Uso |
|---|---|---|
| `--r-xs` | 4 px | Elementos muy pequeños |
| `--r-sm` | 8 px | Controles compactos |
| `--r-md` | 12 px | Por defecto de controles |
| `--r-lg` | 18 px | Tarjetas |
| `--r-xl` | 24 px | Contenedores grandes |
| `--r-2xl` | 32 px | Superficies destacadas |
| `--r-full` | 999 px | Píldoras, avatares, insignias |
| `--r-signature` | `28px 4px 28px 4px` | **Ver abajo** |

### El radio de firma

```css
/* radio de firma: UN elemento destacado por pantalla; nunca botones/inputs */
--r-signature: 28px 4px 28px 4px;
```

Es la forma que da identidad al sistema: dos esquinas redondas y dos casi rectas,
en diagonal. La regla es doble:

1. **Un solo elemento por pantalla.** Repetida, deja de identificar.
2. **Nunca en botones ni entradas.** Un control con forma asimétrica se lee como
   decorado, no como control.

El tipo lo repite junto a la constante, para que quien autocomplete lo lea:

```ts
/** `signature` (28px 4px 28px 4px) va en UN elemento por pantalla; nunca en botones ni inputs. */
export const RADIUS_NAMES = ['xs','sm','md','lg','xl','2xl','full','signature'] as const;
```

## Qué no está tokenizado

| Elemento | Estado | Consecuencia |
|---|---|---|
| Grosores de borde | No hay `--bw-*` | Cada componente escribe `1px` o `2px` |
| Anchos de contenedor | No hay `--container-*` | Cada layout fija el suyo |
| Índices de apilamiento | No hay `--z-*` | Diálogos, menús y avisos fijan el suyo. **Es lo más riesgoso de la lista**: dos capas con el mismo z compiten por el orden de aparición en el DOM |
| Alturas de control | No hay tokens | Se componen desde el espaciado y la tipografía |

Los índices de apilamiento son la única de las cuatro que puede producir un
defecto visible sin que nadie toque nada: basta con que dos capas coincidan.
Anotado como brecha `MEDIUM`.

## Reglas prácticas

1. **Nunca escribas un píxel de espaciado a mano.** Si el escalón que necesitás
   no existe, el diseño está fuera de la grilla y ésa es la conversación.
2. **`gap` antes que `margin`.** Con flex y grid, el hueco es del contenedor y no
   del hijo; así un componente no lleva margen que dependa de dónde lo pongan.
3. **El radio se compone con el tamaño.** Un control `sm` con `--r-lg` se ve
   inflado.
4. **`--r-full` para lo circular**, no un porcentaje: 999 px funciona sin importar
   el tamaño y no deforma un rectángulo.
