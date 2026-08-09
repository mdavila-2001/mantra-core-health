# Runbook 11 · Degradación de Core Web Vitals

**Síntoma.** La aplicación se siente lenta, o Lighthouse empeora respecto de una
medición anterior.

**Impacto.** Medio.
**Severidad.** S3, salvo que sea inusable.

---

## La limitación de partida

**No hay medición.** Ni sintética ni de campo. Ver
[Core Web Vitals](../../performance/core-web-vitals.md).

Este runbook se dispara por **percepción**, no por una alerta, y el primer paso
es convertir la percepción en un número.

## Lo único que sí se mide, y en cada build

```text
▲ [WARNING] bundle initial exceeded maximum budget.
  Budget 500.00 kB was not met by 16.70 kB with a total of 516.70 kB.
```

**Es el único indicador de rendimiento automático del proyecto**, y detecta la
regresión más común: que el paquete crezca.

## Diagnóstico

### 1 · Medir, antes que opinar

```bash
yarn build
yarn serve:ssr:mantra-core-health &
npx lighthouse http://localhost:4000/auth --view
```

**No requiere instalar nada permanente.** Da LCP, FCP y CLS.

Repetir contra el commit anterior da la comparación, que es lo que hace falta.

### 2 · ¿Creció el paquete?

```bash
yarn build 2>&1 | grep "Initial total"
```

Referencia: **516,70 kB crudo · 132,27 kB en tránsito**.

| Crecimiento | Causa probable |
|---|---|
| Decenas de kB | Una dependencia nueva |
| Unos pocos kB | Código nuevo |
| Un fragmento diferido que pasó a inicial | Un `import` directo donde había `loadComponent` |

**La tercera es la más silenciosa**: cambiar `loadComponent` por un `import`
directo no rompe nada y suma 181 kB de golpe.

### 3 · ¿Qué métrica empeoró?

| Métrica | Dónde mirar |
|---|---|
| **LCP** | Tamaño del paquete · `inlineCritical: false` · el arranque que espera al refresco |
| **CLS** | El cambio de nav a cajón bajo SSR · tipografías con `swap` |
| **INP** | Trabajo en el hilo principal. **Solo se mide de campo** |
| **TTFB** | El servidor SSR o la infraestructura |

### 4 · Las dos causas propias de este proyecto

**El arranque espera al canje del refresh token:**

```ts
provideAppInitializer(() => inject(AuthService).restoreSession())
```

Es una petición antes de la primera pintada, a cambio de que no haya parpadeo al
login. **Si el LCP es malo, éste es el primer lugar donde mirar** — y el
intercambio está documentado, no es un descuido.

**`inlineCritical: false`:**

```json
"styles": { "minify": true, "inlineCritical": false }
```

Hay una petición de CSS bloqueante que Angular evitaría por defecto. **El motivo
de la desactivación no está registrado en ninguna parte** (brecha `MEDIUM`).

### 5 · ¿Es la API?

Un panel lento con la aplicación rápida es la API, no el frontend. La tarjeta del
directorio es el termómetro.

## Evidencia

- [ ] Informe de Lighthouse, antes y después
- [ ] `Initial total` de los dos builds
- [ ] Ruta afectada
- [ ] Dispositivo y red de quien reporta
- [ ] ¿Coincide con un despliegue?

## Mitigación

| Causa | Acción |
|---|---|
| Dependencia nueva pesada | Evaluar quitarla. Ver las seis preguntas de [dependencias](../../security/dependencies.md#reglas-al-agregar-una-dependencia) |
| Fragmento que pasó a inicial | Volver a `loadComponent` |
| Crecimiento gradual | **Diferir las pantallas de `auth/`** — la oportunidad más clara |
| API lenta | Escalar |

## Escalamiento

Frontend, salvo TTFB (infraestructura) o panel lento con aplicación rápida (API).

## Prevención

| # | Qué | Esfuerzo |
|---|---|---|
| 1 | **Lighthouse una vez, con `npx`** — la primera línea base real | Bajo |
| 2 | Presupuestos en el pipeline (`check-bundle-budget.mjs`) | Bajo |
| 3 | Presupuesto **por fragmento**, para que la vitrina no crezca sin aviso | Bajo |
| 4 | Recuperar o volver a decidir `inlineCritical` | Bajo |
| 5 | Diferir las pantallas de `auth/` | Medio |
| 6 | Web Vitals de campo | Alto — requiere decisiones de privacidad |

**El 1 es el que desbloquea todo lo demás**: sin una línea base, cualquier
umbral es inventado.
