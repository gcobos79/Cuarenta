#!/usr/bin/env python3
"""Graba con Fish Audio (misma voz de Don Barajón) SOLO las frases nuevas de Amigos que todavía no tengan archivo en audio/.
Las frases son fijas y genéricas (sin nombres): se graban una sola vez y sirven para todas las partidas.
No toca las grabaciones existentes: al final añade las huellas nuevas a audio/index.js.
La llave de API NO está aquí: el entorno la inyecta en las peticiones a api.fish.audio.
Uso (desde la carpeta del repositorio):  python3 amigos/voz/generar_amigos.py [--dry]"""
import json, os, re, subprocess, sys, time
VOICE = 'a61617f5c2e749e2a9f30bdc73678467'
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
OUT = os.path.join(RAIZ, 'audio')

def don_hash(s):  # idéntica a huella() de voz.js y donHash() de Solo
    b = re.sub(r'\s+', ' ', str(s).strip()).encode('utf-8')
    a, c = 0x811c9dc5, 0x9747b28c
    for x in b:
        a = ((a ^ x) * 0x01000193) & 0xFFFFFFFF
        c = ((c ^ x) * 0x01000193) & 0xFFFFFFFF
    return '%08x%08x' % (a, c)

def tts(text, path):
    body = json.dumps({'text': text, 'reference_id': VOICE, 'format': 'mp3', 'mp3_bitrate': 64, 'latency': 'normal'})
    for intento in range(4):
        r = subprocess.run(['curl', '-sS', '-m', '120', '-o', path, '-w', '%{http_code}', '-X', 'POST', 'https://api.fish.audio/v1/tts',
                            '-H', 'Content-Type: application/json', '-H', 'model: s1', '-d', body], capture_output=True, text=True)
        if r.stdout.strip() == '200' and os.path.getsize(path) > 2000: return True
        time.sleep(2 + intento * 3)
    if os.path.exists(path): os.remove(path)
    return False

def main():
    frases = json.load(open(os.path.join(AQUI, 'catalogo-amigos.json'), encoding='utf-8'))['nuevas']
    idx = open(os.path.join(OUT, 'index.js'), encoding='utf-8').read()
    ids = [x for x in re.search(r"ids:'([^']*)'", idx).group(1).split(',') if x]
    faltan = [(don_hash(t), t) for t in frases if not os.path.exists(f'{OUT}/{don_hash(t)}.mp3')]
    chars = sum(len(t.encode('utf-8')) for _, t in faltan)
    print('frases de Amigos', len(frases), '| por grabar', len(faltan), '| caracteres', chars, '| costo aprox USD', round(chars * 15 / 1e6, 4))
    if '--dry' in sys.argv: return
    fallos = []
    for h, t in faltan:
        if tts(t, f'{OUT}/{h}.mp3'): ids.append(h)
        else: fallos.append(t)
    ids = sorted(set(ids) | {h for h, _ in faltan if os.path.exists(f'{OUT}/{h}.mp3')})
    nuevo = re.sub(r"ids:'[^']*'", "ids:'%s'" % ','.join(ids), idx)
    open(os.path.join(OUT, 'index.js'), 'w', encoding='utf-8').write(nuevo)
    print('grabadas', len(faltan) - len(fallos), '| fallos', len(fallos))
    for t in fallos: print('  FALLO:', t)

main()
