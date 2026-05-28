import asyncio
import base64
import hashlib
import json
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
TIMELINE_SEPARATOR = "。\n"
AUDIO_MIME = "audio/mpeg"


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


def _normalize_segment_text(text):
    if not isinstance(text, str):
        raise ValueError("segments[].text 必须是字符串")
    cleaned = text.replace("\r", "\n")
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = cleaned.strip()
    if not cleaned:
        raise ValueError("segments[].text 不能为空")
    return cleaned


def _normalize_segments(raw_segments):
    if raw_segments is None:
        return []
    if not isinstance(raw_segments, list):
        raise ValueError("segments 必须是数组")

    normalized = []
    for idx, item in enumerate(raw_segments):
        if not isinstance(item, dict):
            raise ValueError("segments[] 必须是对象")
        index = item.get("index", idx)
        if not isinstance(index, int) or index < 0:
            raise ValueError("segments[].index 必须是非负整数")
        text = _normalize_segment_text(item.get("text", ""))
        normalized.append({"index": index, "text": text})

    normalized.sort(key=lambda item: item["index"])
    expected = list(range(len(normalized)))
    actual = [item["index"] for item in normalized]
    if actual != expected:
        raise ValueError("segments[].index 必须从 0 开始连续递增")

    return normalized


def _validate_segment_text(text, segments):
    if not segments:
        return
    joined = TIMELINE_SEPARATOR.join(segment["text"] for segment in segments)
    if joined != text:
        raise ValueError("text 与 segments 拼接结果不一致")


def _cache_file_path(text, voice, rate, segments):
    digest = hashlib.sha256(
        json.dumps(
            {
                "voice": voice,
                "rate": rate,
                "text": text,
                "segments": segments,
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    return CACHE_DIR / f"{digest}.json"


async def _generate_audio_and_events(text, voice, rate):
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate)
    audio_chunks = []
    events = []
    async for chunk in communicate.stream():
        if not isinstance(chunk, dict):
            continue
        chunk_type = chunk.get("type")
        if chunk_type == "audio":
            data = chunk.get("data")
            if data:
                audio_chunks.append(data)
        elif chunk_type:
            events.append(chunk)
    return b"".join(audio_chunks), events


def _to_seconds(value):
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = float(value)
        except ValueError:
            return None
    if not isinstance(value, (int, float)):
        return None
    if value < 0:
        return None
    if value > 100000:
        return value / 10000000
    if value > 1000:
        return value / 1000
    return float(value)


def _first_non_none(*values):
    for value in values:
        if value is not None:
            return value
    return None


def _event_audio_time(event):
    return _first_non_none(
        _to_seconds(event.get("audio_offset")),
        _to_seconds(event.get("offset")),
        _to_seconds(event.get("start")),
    )


def _event_duration(event):
    return _first_non_none(
        _to_seconds(event.get("duration")),
        _to_seconds(event.get("duration_milliseconds")),
        _to_seconds(event.get("length")),
        0.0,
    )


def _event_text_offset(event):
    value = event.get("text_offset")
    if value is None:
        value = event.get("offset") if isinstance(event.get("offset"), int) and event.get("offset") < MAX_TEXT_LENGTH * 4 else None
    if value is None:
        value = event.get("textOffset")
    if isinstance(value, str):
        try:
            value = int(value)
        except ValueError:
            return None
    return value if isinstance(value, int) and value >= 0 else None


def _event_text_length(event):
    value = event.get("word_length")
    if value is None:
        value = event.get("text_length")
    if value is None:
        value = event.get("length") if isinstance(event.get("length"), int) and event.get("length") <= MAX_TEXT_LENGTH else None
    if value is None:
        text = event.get("text")
        if isinstance(text, str):
            value = len(text)
    if isinstance(value, str):
        try:
            value = int(value)
        except ValueError:
            return None
    return value if isinstance(value, int) and value > 0 else None


def _segment_spans(segments):
    spans = []
    cursor = 0
    for idx, segment in enumerate(segments):
        segment_text = segment["text"]
        start = cursor
        end = start + len(segment_text)
        spans.append({"index": segment["index"], "start_offset": start, "end_offset": end})
        cursor = end
        if idx < len(segments) - 1:
            cursor += len(TIMELINE_SEPARATOR)
    return spans


def _fallback_timeline_from_events(segments, events):
    points = []
    for event in events:
        if event.get("type") not in {"WordBoundary", "SentenceBoundary", "Boundary"}:
            continue
        start = _event_audio_time(event)
        if start is None:
            continue
        duration = _event_duration(event)
        points.append((start, max(start + duration, start)))

    if not points:
        return []

    points.sort(key=lambda item: item[0])
    timeline = []
    total = len(points)
    for idx, segment in enumerate(segments):
        point_index = min(idx, total - 1)
        start = points[point_index][0]
        if idx + 1 < total:
            end = points[min(idx + 1, total - 1)][0]
        else:
            end = points[-1][1]
        timeline.append({"index": segment["index"], "start": start, "end": max(end, start)})
    return _fill_timeline_gaps(timeline)


def _fill_timeline_gaps(timeline):
    if not timeline:
        return []

    result = [dict(item) for item in timeline]
    for idx, item in enumerate(result):
        if item["end"] < item["start"]:
            item["end"] = item["start"]
        if idx + 1 < len(result) and item["end"] < result[idx + 1]["start"]:
            item["end"] = result[idx + 1]["start"]

    for idx in range(len(result) - 2, -1, -1):
        if result[idx]["end"] <= result[idx]["start"]:
            result[idx]["end"] = max(result[idx + 1]["start"], result[idx]["start"])

    if len(result) == 1 and result[0]["end"] <= result[0]["start"]:
        result[0]["end"] = result[0]["start"]

    return result


def _build_segment_timeline(text, segments, events):
    if not segments:
        return []

    spans = _segment_spans(segments)
    timeline = [{"index": segment["index"], "start": None, "end": None} for segment in segments]

    for event in events:
        if event.get("type") not in {"WordBoundary", "SentenceBoundary", "Boundary"}:
            continue
        text_offset = _event_text_offset(event)
        start = _event_audio_time(event)
        if text_offset is None or start is None:
            continue
        text_length = _event_text_length(event) or 1
        end_offset = min(text_offset + text_length, len(text))
        end_time = max(start + _event_duration(event), start)

        for span_index, span in enumerate(spans):
            if end_offset <= span["start_offset"]:
                break
            if text_offset >= span["end_offset"]:
                continue
            item = timeline[span_index]
            item["start"] = start if item["start"] is None else min(item["start"], start)
            item["end"] = end_time if item["end"] is None else max(item["end"], end_time)

    if not any(item["start"] is not None for item in timeline):
        return _fallback_timeline_from_events(segments, events)

    for idx, item in enumerate(timeline):
        if item["start"] is None:
            prev_end = None
            next_start = None
            for prev in range(idx - 1, -1, -1):
                if timeline[prev]["end"] is not None:
                    prev_end = timeline[prev]["end"]
                    break
            for nxt in range(idx + 1, len(timeline)):
                if timeline[nxt]["start"] is not None:
                    next_start = timeline[nxt]["start"]
                    break
            if prev_end is not None and next_start is not None:
                item["start"] = prev_end
                item["end"] = max(next_start, prev_end)
            elif prev_end is not None:
                item["start"] = prev_end
                item["end"] = prev_end
            elif next_start is not None:
                item["start"] = next_start
                item["end"] = next_start
            else:
                item["start"] = 0.0
                item["end"] = 0.0
        elif item["end"] is None:
            item["end"] = item["start"]

    return _fill_timeline_gaps(timeline)


def _build_payload(text, voice, rate, segments):
    cache_path = _cache_file_path(text, voice, rate, segments)
    if cache_path.exists():
        return json.loads(cache_path.read_text(encoding="utf-8"))

    audio_bytes, events = asyncio.run(_generate_audio_and_events(text, voice, rate))
    payload = {
        "audioBase64": base64.b64encode(audio_bytes).decode("ascii"),
        "audioMime": AUDIO_MIME,
        "segments": _build_segment_timeline(text, segments, events),
    }
    cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return payload


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
            segments = _normalize_segments(payload.get("segments"))
            _validate_segment_text(text, segments)
            response_payload = _build_payload(text, voice, rate, segments)
        except ValueError as error:
            _json_response(self, 400, {"error": str(error)})
            return
        except Exception as error:
            _json_response(self, 500, {"error": f"音频生成失败: {error}"})
            return

        _json_response(self, 200, response_payload)
