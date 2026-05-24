import asyncio
import hashlib
import json
import os
import re
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path

import edge_tts

DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"
DEFAULT_RATE = "+0%"
MAX_TEXT_LENGTH = 4000
CACHE_DIR = Path(tempfile.gettempdir()) / "review_html_tts_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _json_response(handler, status_code, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(body)


def _audio_response(handler, audio_bytes):
    handler.send_response(200)
    handler.send_header("Content-Type", "audio/mpeg")
    handler.send_header("Content-Length", str(len(audio_bytes)))
    handler.send_header("Cache-Control", "public, max-age=31536000, immutable")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.end_headers()
    handler.wfile.write(audio_bytes)


def _normalize_rate(rate):
    if not isinstance(rate, str):
        return DEFAULT_RATE
    cleaned = rate.strip()
    return cleaned if re.fullmatch(r"[+-]\d+%", cleaned) else DEFAULT_RATE


def _normalize_text(text):
    if not isinstance(text, str):
        raise ValueError("text 必须是字符串")
    cleaned = text.replace("\r", "\n")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = cleaned.strip()
    if not cleaned:
        raise ValueError("text 不能为空")
    if len(cleaned) > MAX_TEXT_LENGTH:
        raise ValueError(f"text 不能超过 {MAX_TEXT_LENGTH} 个字符")
    return cleaned


def _cache_file_path(text, voice, rate):
    digest = hashlib.sha256(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{digest}.mp3"


async def _generate_audio_file(text, voice, rate, output_path):
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    await communicate.save(str(output_path))


def _get_audio_bytes(text, voice, rate):
    cache_path = _cache_file_path(text, voice, rate)
    if cache_path.exists():
        return cache_path.read_bytes()
    asyncio.run(_generate_audio_file(text, voice, rate, cache_path))
    return cache_path.read_bytes()


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length)
            payload = json.loads(raw_body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            _json_response(self, 400, {"error": "请求体必须是合法 JSON"})
            return

        try:
            text = _normalize_text(payload.get("text", ""))
            voice = payload.get("voice") or DEFAULT_VOICE
            rate = _normalize_rate(payload.get("rate"))
            audio_bytes = _get_audio_bytes(text, voice, rate)
        except ValueError as error:
            _json_response(self, 400, {"error": str(error)})
            return
        except Exception as error:
            _json_response(self, 500, {"error": f"音频生成失败: {error}"})
            return

        _audio_response(self, audio_bytes)
