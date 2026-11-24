"""Recorta la fuente de íconos Material a los que usa la plataforma.

La fuente completa trae más de 2.000 íconos (125 KB); la plataforma usa unos 80. Este script busca en el código
todos los textos que son nombres de ícono, arma una fuente con esos (más las letras que forman sus nombres) y la
guarda en src/styles/fuentes/. Una prueba (src/lib/__tests__/iconos.test.ts) avisa si falta alguno.

Cuándo correrlo: al usar un ícono nuevo (la prueba lo avisa).
Cómo: python3 -m pip install fonttools brotli && python3 scripts/iconos/recortar.py
"""
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / 'node_modules/material-icons/iconfont/material-icons.woff2'
DESTINO = RAIZ / 'src/styles/fuentes/material-icons-sya.woff2'
INCLUIDOS = RAIZ / 'scripts/iconos/incluidos.json'
TODOS = RAIZ / 'scripts/iconos/todos.json'


def ligaduras(fuente: TTFont) -> dict[str, str]:
    """Nombre del ícono -> glifo, leído de la tabla de ligaduras."""
    letra = {glifo: chr(u) for u, glifo in fuente.getBestCmap().items()}
    r = {}
    for lookup in fuente['GSUB'].table.LookupList.Lookup:
        for st in lookup.SubTable:
            st = getattr(st, 'ExtSubTable', st)
            for primero, lista in getattr(st, 'ligatures', {}).items():
                for lig in lista:
                    nombre = ''.join(letra.get(g, '?') for g in [primero, *lig.Component])
                    r[nombre] = lig.LigGlyph
    return r


def usados(nombres: set[str]) -> set[str]:
    """Todos los textos del código que son nombres de ícono (entre comillas o como texto de un material-icons)."""
    r = set()
    for archivo in (RAIZ / 'src').rglob('*'):
        if archivo.suffix not in ('.ts', '.tsx'):
            continue
        texto = archivo.read_text(encoding='utf-8')
        r |= {m for m in re.findall(r"""['"`]([a-z0-9_]+)['"`]""", texto) if m in nombres}
        r |= {m for m in re.findall(r'material-icons[^>]*>\s*([a-z0-9_]+)\s*<', texto) if m in nombres}
    return r


def main():
    fuente = TTFont(ORIGEN)
    ligs = ligaduras(fuente)
    elegidos = sorted(usados(set(ligs)))
    letras = sorted({c for n in elegidos for c in n})
    letra_a_glifo = {chr(u): g for u, g in fuente.getBestCmap().items()}
    glifos = ['.notdef'] + [letra_a_glifo[c] for c in letras if c in letra_a_glifo] + [ligs[n] for n in elegidos]

    opciones = subset.Options()
    opciones.flavor = 'woff2'
    opciones.layout_features = ['*']
    # Sin esto, el recorte sumaría todas las ligaduras que se pueden formar con esas letras (o sea, casi todos los íconos)
    opciones.layout_closure = False
    opciones.notdef_outline = True
    opciones.name_IDs = ['*']
    recortador = subset.Subsetter(opciones)
    recortador.populate(glyphs=glifos, unicodes=[ord(c) for c in letras])
    recortador.subset(fuente)
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    fuente.flavor = 'woff2'
    fuente.save(DESTINO)

    INCLUIDOS.write_text(json.dumps(elegidos, indent=0) + '\n', encoding='utf-8')
    TODOS.write_text(json.dumps(sorted(ligs)) + '\n', encoding='utf-8')
    print(f'{len(elegidos)} íconos · {DESTINO.stat().st_size / 1024:.1f} KB (la completa: {ORIGEN.stat().st_size / 1024:.0f} KB)')


if __name__ == '__main__':
    main()
