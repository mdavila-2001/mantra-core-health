# graphify: el grafo del código para los asistentes

graphify arma un grafo del código (símbolos, llamadas, importaciones) en `graphify-out/` para que los
asistentes de código (Claude Code y otros) respondan preguntas de estructura sin leer archivo por
archivo. El grafo es local de cada máquina: no se versiona.

## Instalación (una vez por máquina)

```sh
pipx install graphifyy==0.9.95   # o: uv tool install graphifyy==0.9.95   (el paquete lleva dos «y»)
graphify --version
```

Requiere Python 3.10 o más nuevo. No hace falta nada más: con graphify instalado, el repositorio se
encarga solo.

La versión va fijada porque el gancho depende de las opciones de `graphify extract`: es la misma que
`.githooks/graphify-refresh.sh` instala en la nube. Quien ya tenga otra la alinea con
`pipx install --force graphifyy==0.9.95`.

### En la nube (Claude Code en claude.ai)

No hay que hacer nada. Cada sesión en la nube arranca en una máquina nueva: el `SessionStart` detecta
`CLAUDE_CODE_REMOTE=true`, instala graphify con `uv` y arma el grafo en segundo plano. Como la máquina
es nueva, el grafo se arma de cero en cada sesión y tarda unos minutos; mientras tanto el asistente
recibe el aviso de que todavía no existe y busca con las herramientas de siempre.

No cubre las sesiones que no leen el `.claude/settings.json` del repositorio: las que abren varios
repositorios a la vez y los hilos de un *project*. Ahí el grafo no se arma solo.

## Qué lo mantiene al día

| Cuándo | Quién lo dispara |
|---|---|
| Al traer cambios (`git pull`, `git merge`) | `.githooks/post-merge` |
| Al cambiar de rama | `.githooks/post-checkout` |
| Después de cada commit | `.githooks/post-commit` |
| Al abrir una sesión de Claude Code | `SessionStart` en `.claude/settings.json` |

Los cuatro llaman a `.githooks/graphify-refresh.sh`, que:

- **no hace nada** si graphify no está instalado (salvo en la nube, donde lo instala);
- corre **en segundo plano**: git y Claude Code no esperan;
- indexa **solo código**, con el analizador local y **sin LLM**: nada sale de la máquina;
- corre **una vez a la vez**; si llega otro pedido mientras corre, repite una sola vez al terminar;
- usa la mitad de los núcleos.

La primera vez arma el grafo completo; las siguientes, solo lo que cambió. Lo que no aporta al grafo
(datos, documentos, evidencia, JSON) está excluido en `.graphifyignore`.

Tiempos medidos en el front (rama `dev`, 2.532 archivos de código):

| Caso | Tiempo, en segundo plano |
|---|---|
| Primera vez | ~1,5 min |
| Sin cambios, o un commit | ~12 s |
| Un pull del tamaño de un PR típico | ~20 s |
| Cambio de rama entre `mockup`, `dev` y `test` | ~1,5 min (las ramas divergen en miles de archivos) |

Los ganchos se activan solos la primera vez que se abre Claude Code en el repositorio, y también con `yarn install` cuando cambian las dependencias (`postinstall`). Un `core.hooksPath` propio no se toca.

## Cómo se consulta

Funciona mejor **nombrando símbolos** que con preguntas en lenguaje natural:

```sh
graphify query "Dashboard tenantName"          # el subgrafo alrededor de esos símbolos
graphify affected "SessionStore"               # qué depende de algo antes de tocarlo
graphify path "Dashboard" "SessionStore"       # cómo se conectan dos piezas
graphify explain "ViewState"                   # un símbolo y sus vecinos
```

## Si algo no anda

- **Ver qué pasó en la última actualización:** `graphify-out/refresh.log`.
- **Apagarlo un rato:** `GRAPHIFY_SKIP_HOOK=1`.
- **Rearmarlo de cero:** borrar `graphify-out/` y hacer cualquier commit, pull o cambio de rama.
- **No ejecutes** `graphify install`, `graphify claude install` ni `graphify hook install` en el
  repositorio: escriben rutas de tu máquina en archivos versionados y reemplazan estos ganchos por
  otros más lentos. Tampoco hace falta `graphify update`: re-indexa todo cada vez.
