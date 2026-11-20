"""
Serviço de upload do postador (VPS). Roda em 127.0.0.1:3311, atrás do nginx.

  PUT  /upload/<id>/<video|capa>?exp=..&sig=..   corpo = o arquivo
  POST /fetch/<id>/<video|capa>?exp=..&sig=..    {"url": "..."}: a VPS baixa o arquivo

A assinatura é HMAC-SHA256(POSTAGEM_SECRET, "<id>.<kind>.<exp>"), gerada pelo
sistema (src/lib/services/postagens.ts). Os arquivos ficam em VIDEOS_DIR e o nginx
serve em /v/<id>-<kind>.<ext> — é de lá que a Meta busca o vídeo.
Só biblioteca padrão do Python.
"""
import hashlib
import hmac
import json
import os
import re
import shutil
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

SECRET = os.environ["POSTAGEM_SECRET"].encode()
VIDEOS_DIR = os.environ.get("VIDEOS_DIR", "/srv/studiotita/videos")
PUBLIC_BASE = os.environ.get("PUBLIC_BASE", "https://srv2157937.hstgr.cloud").rstrip("/")
ORIGINS = {o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "https://studiotita.vercel.app").split(",") if o.strip()}
MAX_BYTES = {"video": 1024 * 1024 * 1024, "capa": 15 * 1024 * 1024}
EXT = {"video": "mp4", "capa": "jpg"}
ROUTE = re.compile(r"^/(upload|fetch)/([0-9a-f-]{36})/(video|capa)$")


def valid(pid, kind, qs):
    try:
        exp = int(qs.get("exp", ["0"])[0])
    except ValueError:
        return False
    if exp < time.time():
        return False
    expected = hmac.new(SECRET, f"{pid}.{kind}.{exp}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, qs.get("sig", [""])[0])


class Handler(BaseHTTPRequestHandler):
    server_version = "studiotita-upload"

    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "PUT, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "content-type")
            self.send_header("Access-Control-Max-Age", "3600")

    def reply(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def target(self, action):
        u = urlparse(self.path)
        m = ROUTE.match(u.path)
        if not m or m.group(1) != action:
            self.reply(404, {"error": "rota não encontrada"})
            return None
        pid, kind = m.group(2), m.group(3)
        if not valid(pid, kind, parse_qs(u.query)):
            self.reply(403, {"error": "assinatura inválida ou link vencido"})
            return None
        name = f"{pid}-{kind}.{EXT[kind]}"
        return kind, os.path.join(VIDEOS_DIR, name), f"{PUBLIC_BASE}/v/{name}"

    def save(self, src, kind, path, length=None):
        tmp = path + ".part"
        total = 0
        with open(tmp, "wb") as f:
            while True:
                chunk = src.read(min(1 << 20, length - total) if length is not None else 1 << 20)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_BYTES[kind]:
                    f.close()
                    os.remove(tmp)
                    raise ValueError("arquivo maior que o limite")
                f.write(chunk)
                if length is not None and total >= length:
                    break
        if total == 0:
            os.remove(tmp)
            raise ValueError("arquivo vazio")
        os.replace(tmp, path)
        os.chmod(path, 0o644)
        return total

    def do_PUT(self):
        t = self.target("upload")
        if not t:
            return
        kind, path, public = t
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return self.reply(411, {"error": "envie o arquivo com Content-Length"})
        if length > MAX_BYTES[kind]:
            return self.reply(413, {"error": "arquivo maior que o limite"})
        try:
            size = self.save(self.rfile, kind, path, length)
        except ValueError as e:
            return self.reply(400, {"error": str(e)})
        self.reply(200, {"url": public, "bytes": size})

    def do_POST(self):
        t = self.target("fetch")
        if not t:
            return
        kind, path, public = t
        try:
            body = json.loads(self.rfile.read(min(int(self.headers.get("Content-Length", "0")), 8192)) or b"{}")
            url = str(body.get("url", ""))
        except (ValueError, json.JSONDecodeError):
            return self.reply(400, {"error": "corpo inválido"})
        if not re.match(r"^https?://", url):
            return self.reply(400, {"error": "o link precisa começar com http(s)://"})
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "studiotita-postador"})
            with urllib.request.urlopen(req, timeout=60) as r:
                size = self.save(r, kind, path)
        except ValueError as e:
            return self.reply(400, {"error": str(e)})
        except Exception as e:  # noqa: BLE001 — a mensagem volta para o Claude
            return self.reply(502, {"error": f"não consegui baixar: {e}"})
        self.reply(200, {"url": public, "bytes": size})

    def log_message(self, fmt, *args):
        # sem a query string (tem a assinatura)
        print("%s %s" % (self.command, self.path.split("?")[0]), flush=True)


if __name__ == "__main__":
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    shutil.disk_usage(VIDEOS_DIR)
    ThreadingHTTPServer(("127.0.0.1", 3311), Handler).serve_forever()
