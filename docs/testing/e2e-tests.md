# Pruebas extremo a extremo

**Siete journeys de sesión, con Playwright, contra el artefacto de producción.**

```bash
yarn e2e        # construye, sirve y corre
yarn e2e:ui     # el modo interactivo, para depurar
```

Corren en CI en un job propio (`e2e` en `.github/workflows/ci.yml`), en paralelo
con el resto de la batería.

---

## Qué se prueba

| # | Journey | Qué fija |
|---|---|---|
| 1 | Sin sesión, `/panel` manda al login | El guard con un router real |
| 2 | Login con una organización entra directo | Guard, interceptor y store encadenados |
| 3 | Con varias organizaciones hay que elegir | Tres componentes y dos navegaciones |
| 4 | **La sesión sobrevive a una recarga** | `restoreSession` en el arranque real |
| 5 | Con el refresh token muerto, la recarga lleva al login **sin error** | Que un token vencido no sea una pantalla de error |
| 6 | Cerrar sesión vuelve al login **y no deja entrar atrás** | Que el borrado local sea de verdad |
| 7 | Credenciales inválidas dan un mensaje accionable | Que `UNAUTHENTICATED` no se lea como «sesión vencida» |

El **4** es el más valioso: se rompe con un cambio de orden en los
`provideAppInitializer` de `app.config.ts` —`restoreSession` corre **antes** de
que el router evalúe el guard— y ninguna prueba unitaria puede enterarse.

## Las dos decisiones de montaje

### 1 · Contra el artefacto de producción, no contra `ng serve`

`playwright.config.ts` levanta el servidor con
`yarn build && PORT=4173 node dist/mantra-core-health/server/server.mjs`.

Cuatro rutas se **prerenderizan en el build**, y el prerenderizado solo existe en
el artefacto construido. Probar contra el servidor de desarrollo dejaría fuera
justo lo que más fácil se rompe: que el HTML del servidor y el del cliente
coincidan al hidratar.

De paso se verifica la CSP: el artefacto es el que emite las cabeceras de
seguridad, así que si una bloqueara un script la aplicación no arrancaría y estas
pruebas lo dirían.

**Esta decisión ya se pagó sola.** Ver «Lo que encontró», más abajo.

> Cada corrida levanta un servidor **limpio**. Reutilizar uno existente ahorraba
> un build y costaba mucho más: el servidor de renderizado lee el HTML
> prerenderizado al arrancar y lo guarda en memoria, así que uno viejo sirve
> referencias a chunks cuyo hash ya cambió y las siete pruebas fallan por tiempo
> sin decir por qué. Si el puerto 4173 está ocupado, Playwright lo dice en una
> línea.

### 2 · La red va simulada

`e2e/support/api.ts` intercepta las rutas de la API y responde lo que cada prueba
necesita. Los siete journeys son de **navegación, estado y persistencia**, no de
contrato — el contrato es [otra capa](contract-tests.md) y otra herramienta.

Sin base de datos, sin datos sembrados, sin una API levantada, y **el mismo
resultado en cada corrida**. Una suite E2E que falla al azar se termina
ignorando, que es peor que no tenerla.

## Lo que encontró

Dos defectos que bloqueaban producción, ninguno visible de otra forma.

### `security.allowedHosts` rechazaba cualquier dominio real

`angular.json` traía `build.options.security.allowedHosts: ["localhost"]`. Esa
opción **se hornea en el artefacto**, así que el servidor de producción respondía
**400 a toda petición cuyo `Host` no fuera `localhost`**.

Verificado con `curl`: `Host: localhost` → 200, `Host: mantra.example.com` → 400.

Se quitó del build y la validación del `Host` pasó a `deploy/nginx.conf`, donde
es configuración en caliente y no una imagen distinta por dominio. Ver
[despliegue](../operations/deployment.md#validación-del-host).

### Cerrar sesión no borraba el refresh token

La prueba 6 entra a `/panel` **después** de salir. Volvía a entrar.

`AuthService.logout()` limpiaba el almacenamiento **dentro del callback de la
respuesta** de la API. La navegación al login es local e instantánea; la
respuesta viaja por la red. La navegación ganaba siempre, el borrado no llegaba a
correr, y la siguiente recarga **restauraba la sesión que se acababa de cerrar**.

Se invirtió el orden: el aviso al servidor sale primero —el interceptor necesita
el access token del store— y la limpieza va inmediatamente después, sin esperar.
Ver [sesión y tokens](../security/session-and-tokens.md#el-orden-al-cerrar-sesión).

## Lo que sigue sin cubrirse

| Comportamiento | Estado |
|---|---|
| Recuperación completa de contraseña | Cruza el correo: necesita un buzón, no solo un navegador |
| La trampa de foco de `<dialog>` | Cubierta por el navegador, no por una prueba propia |
| El nav pasando a cajón bajo 780 px | Requiere las capturas de [regresión visual](visual-regression.md) |
| El anillo de foco visible | Ídem |

Las capturas visuales están configuradas pero **no generadas**: dependen del
sistema donde se toman —las fuentes y el antialiasing de macOS no son los de
Linux— y comparar entre plataformas produce diferencias que no son regresiones.
Se generan en el contenedor; ver [regresión visual](visual-regression.md).

## Datos

| Regla | |
|---|---|
| Sintéticos y deterministas | El token de prueba se fabrica en `e2e/support/api.ts` |
| **Nunca contra un entorno productivo** | El `webServer` es local por construcción |
| **Nada que parezca PHI real**, ni de mentira | |

## Estado

La brecha `HIGH` de la estrategia de pruebas queda **cerrada** para los journeys
de sesión. [La matriz de trazabilidad](../governance/traceability-matrix.md)
sustituye la excepción formal por la prueba concreta en esos siete casos; el de
recuperación de contraseña mantiene su justificación.
