import base64
import hashlib
import io
import json
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import RequestEntityTooLarge
from werkzeug.utils import secure_filename

from analysis import analyze_video, _build_result, _face_metrics, _format_time


PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_FOLDER = PROJECT_ROOT / "frontend"
UPLOAD_FOLDER = Path(__file__).resolve().parent / "uploads"
HISTORY_FILE = Path(__file__).resolve().parent / "history.json"
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".webm", ".mov"}
MAX_VIDEO_SIZE = 250 * 1024 * 1024
MAX_SESSION_SECONDS = 2 * 60 * 60

app = Flask(__name__, static_folder=str(FRONTEND_FOLDER), static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = MAX_VIDEO_SIZE
UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


def read_history():
    if not HISTORY_FILE.exists():
        return []

    with HISTORY_FILE.open("r", encoding="utf-8") as history_file:
        history = json.load(history_file)

    if not isinstance(history, list):
        raise ValueError("The saved session history must be a JSON list.")
    return history


def write_history(history):
    temporary_file = HISTORY_FILE.with_suffix(".tmp")
    temporary_file.write_text(
        json.dumps(history, indent=2),
        encoding="utf-8",
    )
    temporary_file.replace(HISTORY_FILE)


def json_error(message, status_code):
    return jsonify({"error": message}), status_code


def save_analysis(analysis):
    history = read_history()
    history.insert(0, analysis)
    write_history(history)


@app.errorhandler(RequestEntityTooLarge)
def handle_large_upload(_error):
    return json_error("The video is too large. Maximum upload size is 250 MB.", 413)


@app.get("/")
def home():
    return send_from_directory(FRONTEND_FOLDER, "index.html")


@app.post("/api/analyze")
def analyze_upload():
    video = request.files.get("video")
    if video is None or not video.filename:
        return json_error("Choose a video file to analyze.", 400)

    safe_name = secure_filename(video.filename)
    extension = Path(safe_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return json_error("Use an MP4, AVI, WebM, or MOV video.", 400)

    try:
        duration_seconds = float(request.form.get("duration_seconds", ""))
    except ValueError:
        return json_error("The video duration could not be read. Try another video.", 400)

    if not 0 < duration_seconds <= MAX_SESSION_SECONDS:
        return json_error("Video duration must be between 1 second and 2 hours.", 400)

    session_id = str(uuid.uuid4())
    stored_name = f"{session_id}{extension}"
    upload_path = UPLOAD_FOLDER / stored_name
    video.save(upload_path)

    digest = hashlib.sha256()
    with upload_path.open("rb") as saved_video:
        for chunk in iter(lambda: saved_video.read(1024 * 1024), b""):
            digest.update(chunk)

    created_at = datetime.now(timezone.utc).isoformat()
    try:
        analysis = analyze_video(
            duration_seconds=duration_seconds,
            content_digest=digest.hexdigest(),
            filename=safe_name,
            session_id=session_id,
            created_at=created_at,
            video_path=upload_path,
        )
    except ValueError as error:
        upload_path.unlink(missing_ok=True)
        return json_error(str(error), 422)

    try:
        save_analysis(analysis)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        upload_path.unlink(missing_ok=True)
        return json_error(f"Could not save this analysis to history: {error}", 500)

    return jsonify({"analysis": analysis}), 201


@app.post("/api/analyze-demo")
def analyze_camera_demo():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("A JSON session duration is required.", 400)

    try:
        duration_seconds = float(payload.get("duration_seconds", ""))
    except (TypeError, ValueError):
        return json_error("The camera session duration is invalid.", 400)

    if not 0 < duration_seconds <= MAX_SESSION_SECONDS:
        return json_error("Camera session duration must be between 1 second and 2 hours.", 400)

    session_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    analysis = analyze_video(
        duration_seconds=duration_seconds,
        content_digest=session_id,
        filename="Live camera demo (camera feed not analyzed)",
        session_id=session_id,
        created_at=created_at,
    )

    try:
        save_analysis(analysis)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return json_error(f"Could not save this camera demo to history: {error}", 500)

    return jsonify({"analysis": analysis}), 201


@app.get("/api/latest")
def latest_analysis():
    try:
        history = read_history()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return json_error(f"Could not read session history: {error}", 500)
    return jsonify({"analysis": history[0] if history else None})


@app.get("/api/history")
def analysis_history():
    try:
        history = read_history()
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return json_error(f"Could not read session history: {error}", 500)
    return jsonify({"sessions": history})


@app.post("/api/save-live-session")
def save_live_session():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("A live-session payload is required.", 400)

    try:
        duration_seconds = float(payload.get("duration_seconds", ""))
    except (TypeError, ValueError):
        return json_error("The live-session duration is invalid.", 400)
    if not math.isfinite(duration_seconds) or not 0 < duration_seconds <= MAX_SESSION_SECONDS:
        return json_error("Live-session duration must be between 1 second and 2 hours.", 400)

    supplied_samples = payload.get("samples")
    if not isinstance(supplied_samples, list) or not supplied_samples:
        return json_error("The live session has no sampled metrics to save.", 400)
    if len(supplied_samples) > MAX_SESSION_SECONDS:
        return json_error("The live session contains too many samples.", 400)
    supplied_alerts = payload.get("alerts", [])
    if not isinstance(supplied_alerts, list) or len(supplied_alerts) > MAX_SESSION_SECONDS:
        return json_error("The live-session alerts are invalid.", 400)

    duration = max(1, int(math.ceil(duration_seconds)))
    samples_by_second = {}
    metric_names = ("ear", "mar", "head_pitch", "head_yaw")
    for sample in supplied_samples:
        if not isinstance(sample, dict):
            return json_error("Live-session samples must be objects.", 400)
        try:
            seconds = int(sample.get("seconds", -1))
        except (TypeError, ValueError, OverflowError):
            return json_error("A live-session sample has an invalid timestamp.", 400)
        if seconds < 0 or seconds >= duration:
            return json_error("A live-session sample timestamp is outside the session.", 400)

        normalized = {"seconds": seconds}
        for name in metric_names:
            value = sample.get(name)
            if value is None:
                normalized[name] = None
                continue
            try:
                numeric_value = float(value)
            except (TypeError, ValueError, OverflowError):
                return json_error(f"Live-session metric '{name}' must be numeric or null.", 400)
            if not math.isfinite(numeric_value):
                return json_error(f"Live-session metric '{name}' must be finite.", 400)
            normalized[name] = numeric_value
        samples_by_second[seconds] = normalized

    samples = [
        samples_by_second.get(second, {
            "seconds": second,
            "ear": None,
            "mar": None,
            "head_pitch": None,
            "head_yaw": None,
        })
        for second in range(duration)
    ]
    session_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()
    analysis = _build_result(
        samples,
        session_id,
        created_at,
        "Live camera session",
        duration,
        "Live camera monitoring / sampled frames",
        "Metrics are based on sampled webcam frames and are not a certified safety assessment.",
    )
    events = analysis["events"]
    for alert in supplied_alerts:
        if not isinstance(alert, dict):
            return json_error("Live-session alerts must be objects.", 400)
        try:
            seconds = int(alert.get("seconds", -1))
        except (TypeError, ValueError, OverflowError):
            return json_error("A live-session alert has an invalid timestamp.", 400)
        alert_type = alert.get("type")
        detail = alert.get("detail")
        if seconds < 0 or seconds >= duration:
            return json_error("A live-session alert timestamp is outside the session.", 400)
        if not isinstance(alert_type, str) or alert_type not in {"Attention", "Drowsiness"}:
            return json_error("A live-session alert has an unsupported type.", 400)
        if not isinstance(detail, str) or not detail.strip() or len(detail) > 500:
            return json_error("A live-session alert detail is invalid.", 400)
        already_recorded = any(
            abs(event["seconds"] - seconds) <= 3
            and (event["type"] == alert_type or alert_type == "Attention")
            for event in events
        )
        if not already_recorded:
            events.append({
                "seconds": seconds,
                "duration_seconds": 0,
                "type": alert_type,
                "detail": detail.strip(),
                "time": _format_time(seconds),
                "severity": "High" if alert_type == "Drowsiness" else "Medium",
                "status": "Logged",
            })
    events.sort(key=lambda event: event["seconds"])
    for index, event in enumerate(events, start=1):
        event["id"] = f"E-{index:03d}"
    analysis["summary"]["total_alerts"] = len(events)
    if events and analysis["summary"]["risk_level"] == "NO DATA":
        analysis["summary"]["risk_level"] = "WARNING"

    try:
        save_analysis(analysis)
    except (OSError, json.JSONDecodeError, ValueError) as error:
        return json_error(f"Could not save this live session to history: {error}", 500)

    return jsonify({"analysis": analysis}), 201


@app.post("/api/live-monitor")
def live_monitor():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return json_error("A camera frame payload is required.", 400)

    image_data = payload.get("image")
    if not isinstance(image_data, str) or not image_data:
        return json_error("Camera frame is missing.", 400)

    if image_data.startswith("data:image/"):
        encoded = image_data.split(",", 1)[1]
    else:
        encoded = image_data

    try:
        binary = base64.b64decode(encoded, validate=True)
    except ValueError:
        return json_error("The camera frame is not valid base64 image data.", 400)

    frame_array = np.frombuffer(binary, dtype=np.uint8)
    frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
    if frame is None:
        return json_error("The camera frame could not be decoded.", 400)

    metrics = _face_metrics(frame)
    if metrics is None:
        metrics = {
            "ear": None,
            "mar": None,
            "head_pitch": None,
            "head_yaw": None,
            "head_roll": 0.0,
            "face_detected": False,
        }

    ear = metrics.get("ear")
    mar = metrics.get("mar")
    head_pitch = metrics.get("head_pitch")
    head_yaw = metrics.get("head_yaw")
    if not metrics.get("face_detected"):
        risk = "NO FACE"
        reason = "No face detected. Adjust the camera so the driver is visible."
    else:
        risk = "SAFE"
        reason = "Face detected; monitoring active"
        if (
            (ear is not None and ear <= 0.21)
            or (mar is not None and mar >= 0.6)
            or (head_pitch is not None and abs(head_pitch) >= 20)
            or (head_yaw is not None and abs(head_yaw) >= 25)
        ):
            risk = "WARNING"
            reason = "Driver attention is drifting"
        if (
            (ear is not None and ear <= 0.18)
            or (
                mar is not None
                and mar >= 0.75
                and head_pitch is not None
                and abs(head_pitch) >= 20
            )
        ):
            risk = "DANGER"
            reason = "Danger: fatigue or distraction risk detected"

    return jsonify({
        "status": risk,
        "reason": reason,
        "metrics": {
            "ear": round(float(ear), 3) if ear is not None else None,
            "mar": round(float(mar), 3) if mar is not None else None,
            "head_pitch": round(float(head_pitch), 1) if head_pitch is not None else None,
            "head_yaw": round(float(head_yaw), 1) if head_yaw is not None else None,
            "face_detected": bool(metrics.get("face_detected", False)),
        },
    })


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
