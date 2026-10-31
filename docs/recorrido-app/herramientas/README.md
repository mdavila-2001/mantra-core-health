# Herramientas del recorrido

Son scripts de Playwright. No son pruebas: recorren la aplicación y dejan evidencia en `out/`, que
no se versiona. Usan el Chromium del sistema con `require('playwright')`.

## Pasos

1. Levantar el front en modo simulador. Necesita 8 GB de heap; sin ellos la compilación cae con
   «The expression evaluated to a falsy value».

   ```bash
   NODE_OPTIONS=--max-old-space-size=8192 yarn start:demo --port 4200
   ```

2. Desde esta carpeta, leer el árbol real del router. Escribe `router-tree.json`:

   ```bash
   node routes.js
   ```

3. Quitar los duplicados de ese árbol y guardar el resultado como `routes-unique.json`. Es una
   lista de `{ path, ... }`, sin redirecciones y con las rutas únicas.

4. Recorrer una cuenta. `anon` y `superadmin` recorren todas las rutas fijas; las demás
   cuentas, su menú más los enlaces que encuentran. Con `MOVIL=1` usa 390×844:

   ```bash
   node crawl.js <correo|anon> [maxEnlacesExtra]
   ```

5. Abrir las fichas que no tienen enlace navegable, con los ids sembrados del simulador:

   ```bash
   node dirigido.js
   ```

6. Hacer el alta de paciente completa con capturas, en escritorio y móvil:

   ```bash
   node alta.js
   ```

7. Generar `../atlas-pantallas.md`:

   ```bash
   python3 atlas.py ../atlas-pantallas.md
   ```

## Cuentas

Las cuentas están en `src/app/core/mock/README.md`. Cualquier contraseña sirve. Tienen un límite
de diez ingresos por minuto contra la API real; el simulador no lo tiene.
