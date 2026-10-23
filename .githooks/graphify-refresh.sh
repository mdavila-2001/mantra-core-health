#!/bin/sh
#
# Mantiene al día el grafo de graphify (`graphify-out/`) que consultan los
# asistentes de código. Lo llaman `post-checkout`, `post-merge` y `post-commit`,
# y la sesión de Claude Code al arrancar.
#
# ## Qué garantiza
#
# - **Nadie queda trabado:** si graphify no está instalado, no hace nada, y si
#   está, corre en segundo plano y el comando de git vuelve al instante.
# - **Nada sale de la máquina:** indexa solo código, con el analizador local y
#   sin LLM (`GRAPHIFY_BACKEND=none`). Es un repositorio de salud: los
#   documentos no se mandan a ningún modelo.
# - **Una corrida a la vez:** un candado evita dos indexaciones simultáneas. Si
#   llega otro pedido mientras corre, se repite una sola vez al terminar.
# - **No ahoga la máquina:** usa la mitad de los núcleos.
#
# Con `--session` (lo pasa el `SessionStart` de Claude Code) además le dice al
# asistente que el grafo existe y cómo consultarlo: lo que imprime un
# `SessionStart` entra al contexto de la sesión.
#
# `GRAPHIFY_SKIP_HOOK=1` lo apaga. Guía de instalación y uso: `docs/graphify.md`.

[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0
command -v graphify >/dev/null 2>&1 || exit 0
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
out="$root/graphify-out"
mkdir -p "$out" || exit 0

# `yarn install` activa los ganchos con `postinstall`, pero yarn solo lo corre
# cuando cambian las dependencias: quien ya tenía todo instalado no los tendría.
# La sesión los activa si no hay ningún `core.hooksPath`; uno propio no se toca.
if [ "$1" = "--session" ] && [ -d "$root/.githooks" ]; then
  git -C "$root" config core.hooksPath >/dev/null 2>&1 \
    || git -C "$root" config core.hooksPath .githooks
fi

if [ "$1" = "--session" ] && [ -f "$out/graph.json" ]; then
  cat <<'AVISO'
graphify: este repositorio tiene un grafo del código en graphify-out/, que se actualiza solo. Para
preguntas de estructura o de impacto, consultalo antes de recorrer archivos:
`graphify query "<símbolos>"`, `graphify affected "<símbolo>"`, `graphify path "<A>" "<B>"`.
Responde mejor con nombres de símbolos que con frases. No corras `graphify update` ni
`graphify install`. Guía: docs/graphify.md.
AVISO
fi

# Un candado de más de 30 minutos es de una corrida que murió a mitad.
find "$out" -maxdepth 1 -name .refresh.lock -mmin +30 -exec rmdir {} \; 2>/dev/null

lock="$out/.refresh.lock"
if ! mkdir "$lock" 2>/dev/null; then
  : > "$out/.refresh.pending"
  exit 0
fi

(
  trap 'rmdir "$lock"' EXIT
  workers=$(( $(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4) / 2 ))
  [ "$workers" -ge 1 ] || workers=1
  : > "$out/refresh.log"
  while :; do
    rm -f "$out/.refresh.pending"
    # La primera vez arma también las comunidades y `GRAPH_REPORT.md`; después
    # se salta ese paso, que no hace falta para consultar.
    cluster="--no-cluster"
    [ -f "$out/graph.json" ] || cluster=""
    echo "== $(date '+%Y-%m-%d %H:%M:%S')" >> "$out/refresh.log"
    GRAPHIFY_BACKEND=none GRAPHIFY_QUERY_LOG_DISABLE=1 \
      graphify extract "$root" --code-only $cluster --max-workers "$workers" \
      >> "$out/refresh.log" 2>&1
    [ -f "$out/.refresh.pending" ] || break
  done
) < /dev/null > /dev/null 2>&1 &

exit 0
