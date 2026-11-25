#!/usr/bin/env python3
"""Combine stylesheets into a few files in css/ so a page loads one CSS file.

Phones were loading 15-18 separate render-blocking CSS files per page.
The source files stay as they are. tools/css-bundles.json lists each bundle's
files in order ("bundles") and which bundle each page uses ("pages"); pages
with identical styles share a bundle, so it is cached once. Run this (or
tools/bump-build.sh, which calls it) after editing any CSS file."""
import json, os, re, sys
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
cfg = json.load(open(os.path.join(root, 'tools', 'css-bundles.json')))
build = sys.argv[1] if len(sys.argv) > 1 else 'dev'
for name, files in cfg['bundles'].items():
    out = [f'/* Built by tools/build-css.py from: {", ".join(files)}. Do not edit; edit the sources. */\n']
    for f in files:
        out.append(f'\n/* ---- {f} ---- */\n' + open(os.path.join(root, f), encoding='utf-8').read() + '\n')
    open(os.path.join(root, 'css', f'{name}.css'), 'w', encoding='utf-8').write(''.join(out))
    print(f'css/{name}.css  {len(files)} files')
for page, name in cfg['pages'].items():
    p = os.path.join(root, 'index.html' if page == 'index' else f'{page}.html')
    html = open(p, encoding='utf-8').read()
    html, n = re.subn(r'href="/css/[a-z-]+\.css\?v=[^"]*"', f'href="/css/{name}.css?v={build}"', html)
    assert n == 1, f'{page}: expected one bundle link, found {n}'
    open(p, 'w', encoding='utf-8').write(html)
