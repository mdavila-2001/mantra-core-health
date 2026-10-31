# Reglas comunes de los agentes de corrección (leer entero antes de empezar)

Entorno vivo: ver ~/auditoria/informes/LEEME-ENTORNO.md (API :3000, SSR :4000, simulador :4100, base local; datos propios SOLO por la API).
Informes con la evidencia y la causa de cada hallazgo: ~/auditoria/informes/{far01-02,far03,far04-05,far06-07,promos-servicios}.md. Contrato: ~/auditoria/2026-10-29-farmacia/carriles/CONTRATO.md.

## Aislamiento
- NO edites ~/auditoria/wt/* (es el código que sirve el entorno vivo) ni los repos de /home/user/*.
- Tu worktree: `git -C /home/user/<repo> worktree add ~/auditoria/fix/<tu-id> -b fix/<tu-id> origin/dev` (repo = mantra-core-health-api o mantra-core-health).
  Ahorrá disco (quedan ~5 GB): NO instales dependencias; enlazá `ln -s ~/auditoria/wt/<repo>/node_modules ~/auditoria/fix/<tu-id>/node_modules` (y `.yarn`/`.pnp*` si el repo los necesita).
- Archivos disjuntos entre agentes: tocá SOLO los de tu alcance. Si necesitás otro, parate y decilo en tu informe.
- Commits locales en tu rama `fix/<tu-id>` (mensajes en español, imperativo, terminan con las dos líneas:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` y `Claude-Session: https://claude.ai/code/session_015MMaS98KL72mgGbLZDjt5V`). Un commit por hallazgo. NO empujes, NO abras PR, NO cambies .env ni .claude: yo integro.

## Calidad (CLAUDE.md de cada repo manda)
- NO_TEST_WEAKENING: no borres, saltees ni aflojes pruebas ni techos de tamaño; agregá specs que fallen sin tu cambio y pasen con él.
- Preservá autorización (la API es la autoridad), contratos de API, persistencia y validación. Usá las primitivas existentes antes de crear otra.
- Corepack yarn, nunca npm. Nada de `any` nuevos ni archivos nuevos de más de 600 líneas.
- Cada corrección se prueba: (a) spec dirigido, (b) lint/typecheck de lo tocado, y (c) prueba viva UI→request→response→persistencia→recarga→UI (front) o curl literal con método+ruta+código+cuerpo recortado (API). Un toast no prueba nada. "Debería andar" no cuenta: pegá comando y salida, o decí 'no se ejecutó'.

## Recursos compartidos (4 CPU, 15 GB): SERIALIZÁ lo pesado
- Build, ng test/jest completo y arranque de servidores: `flock /tmp/heavy.lock <comando>`. Jest/vitest: SOLO los specs que tocás (nunca la suite entera: ya hubo exit 137 por memoria). NODE_OPTIONS=--max-old-space-size=3072.
- Navegador (Playwright + Chromium sin ventana): `flock /tmp/browser.lock node tu-script.cjs`; nunca esperar `networkidle`; capturas en ~/auditoria/evidencia/fix-<tu-id>/ (antes y después).
- Para probar tu cambio vivo, levantá TU instancia en OTRO puerto (API: `PORT=<3100+n> RATE_LIMIT_DISABLED=true SEED_ON_BOOT=false ORM_SCHEMA_SYNC=off` con el .env copiado del entorno; front: `PORT=<4100+n>` apuntando a tu API) y APAGALA al terminar. Para el front, la CSP toma PUBLIC_API_BASE_URL y la API necesita CORS_ALLOWED_ORIGINS con el origen de tu front.
- Cerrá todo proceso que lances.

## Entrega
Escribí ~/auditoria/informes/fix-<tu-id>.md: por hallazgo → qué cambiaste (ruta:línea), commit SHA, prueba (comando + salida recortada), y si quedó algo sin resolver o sin ejecutar (decilo, no lo ocultes). Respondé con resumen ≤250 palabras y la lista de SHAs en orden.
