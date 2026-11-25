#!/bin/bash
# 背景の小物をまとめて 3D にする（すでにあるものは飛ばす。時間がかかりすぎたものは別のシードでもう一度）
cd "$(dirname "$0")"
PY=C:/Users/jyori/ComfyUI/.venv/Scripts/python.exe
for n in $(PYTHONUTF8=1 $PY -c "import scene_specs as s; print(' '.join(s.SCENE))" | tr -d '\r'); do
  read -r seed other <<< "$(PYTHONUTF8=1 $PY -c "import scene_specs as s; v=s.SCENE['$n']; i=v['pick']; print(v['seeds'][i], v['seeds'][1-i if len(v['seeds'])>1 else i])" | tr -d '\r')"
  [ -f "C:/Users/jyori/ComfyUI/output/tabako/glb/${n}_${seed}.glb" ] && continue
  PYTHONUTF8=1 $PY gen.py mesh --only $n 2>&1 | tail -1 || true
  [ -f "C:/Users/jyori/ComfyUI/output/tabako/glb/${n}_${seed}.glb" ] || { echo "retry $n $other"; PYTHONUTF8=1 $PY gen.py mesh --only $n --seed $other --mesh-seed $seed 2>&1 | tail -1; }
done
echo SCENE_DONE
