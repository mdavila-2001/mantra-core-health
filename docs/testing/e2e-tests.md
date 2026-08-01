# Pruebas extremo a extremo

**No existe ninguna.** Es la brecha `HIGH` de la estrategia de pruebas.

---

## Estado

```bash
grep -n "playwright\|cypress\|webdriver\|puppeteer\|selenium" package.json
```

Sin resultados. `README.md` lo reconoce en su sección «Running end-to-end tests»:
Angular no incluye un corredor E2E por defecto y este proyecto no eligió ninguno.

`.gitignore` reserva `__screenshots__/`, pero la carpeta no existe: alguien lo
previó y no llegó a implementarse.

## Lo que se verificó a mano

Seis flujos, contra la API viva, según `ESTADO-FRONTEND.md` §«El recorrido que se
verificó en un navegador real»:

| Flujo | Verificado |
|---|---|
| Alta de paciente por documento | ✅ manual |
| Alta de profesional por correo | ✅ manual |
| Login con correo y con documento | ✅ manual |
| Recuperación completa (pedido → correo → nueva clave) | ✅ manual |
| Verificación de correo desde el enlace | ✅ manual |
| Persistencia de la sesión entre recargas | ✅ manual |

**Funcionaron. Y nada garantiza que sigan funcionando.**

## Los cuatro journeys que más la necesitan

| # | Journey | Por qué jsdom no alcanza |
|---|---|---|
| 1 | **Login → panel** | Atraviesa guard, interceptor, store y persistencia con un router real |
| 2 | **Recarga con sesión** | `restoreSession` en el arranque real. **Requiere un `F5` de verdad** |
| 3 | **Login con varias organizaciones** | Tres componentes y dos navegaciones |
| 4 | **Recuperación completa** | Cruza el correo: imposible de cubrir sin un navegador y un buzón |

El **2** es el más valioso: es la funcionalidad que más fácil se rompe con un
cambio de orden en `app.config.ts`, y la que ninguna prueba actual toca.

## Y las tres cosas que jsdom no puede ver

Independientes de los journeys:

| Comportamiento | Por qué |
|---|---|
| La trampa de foco de `<dialog>` | jsdom no la implementa |
| El nav pasando a cajón bajo 780 px | jsdom no tiene layout |
| El anillo de foco visible | jsdom no pinta |

## Propuesta

### Herramienta: Playwright

| Motivo | |
|---|---|
| Un solo paquete, sin servidor aparte | |
| Tres motores (Chromium, Firefox, WebKit) | |
| Espera automática, sin `sleep` | |
| Trazas y capturas al fallar | |
| **Trae regresión visual incorporada** | Cubre también [visual-regression](visual-regression.md) |

El último punto es el que decide: una sola dependencia cubre dos capas
faltantes.

### El obstáculo real: el backend

Una prueba E2E necesita una API que responda. Tres opciones:

| Opción | A favor | En contra |
|---|---|---|
| **API real en CI** | Prueba de verdad de punta a punta | Lenta, frágil, necesita base de datos y datos sembrados |
| **API simulada** (interceptar la red en Playwright) | Rápida, determinista | No detecta un cambio de contrato |
| **Mixta** | Lo mejor de las dos | Más trabajo de montaje |

**Recomendación: empezar simulada.** Los cuatro journeys de arriba son de
*navegación, estado y persistencia*, no de contrato — y el contrato es problema de
[las pruebas de contrato](contract-tests.md), que es otra capa.

Con la red simulada, la prueba 2 (recarga con sesión) se puede escribir hoy y no
necesita ninguna infraestructura.

### Datos

| Regla | |
|---|---|
| Sintéticos y deterministas | Como las pruebas actuales |
| **Nunca contra un entorno productivo** | |
| **Nada que parezca PHI real**, ni de mentira | |
| Credenciales de prueba fuera del repositorio | Como ya están las de demostración |

## Qué hay que decidir antes

1. **¿Dónde corren?** No hay pipeline todavía. Ver
   [gestión del cambio](../governance/change-management.md).
2. **¿Contra qué API?** Ver la tabla de arriba.
3. **¿Bloquean la fusión?** Una E2E inestable que bloquea entrena a ignorarla.
4. **¿Quién las mantiene?** No hay `CODEOWNERS`.

La 3 es la que decide si la inversión rinde: **una suite E2E que falla al azar es
peor que no tenerla.**

## Estado

`HIGH` en [el análisis de brechas](../reports/documentation-gap-analysis.md).

Y es la razón por la que
[la matriz de trazabilidad](../governance/traceability-matrix.md) declara para
cada journey crítico una **excepción formal** en la columna E2E, tal como el plan
maestro permite: *«Cada journey crítico tiene al menos una validación E2E o una
justificación formal.»*
