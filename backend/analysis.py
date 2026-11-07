"""Driver fatigue and distraction analysis.

This module supports a real OpenCV+MediaPipe analysis path when available and a
stable deterministic demo fallback for environments where live detection is
unavailable.
"""

import logging
import math
import random
import threading
from statistics import mean

import cv2
import numpy as np

try:  # pragma: no cover - optional dependency, handled gracefully
    import mediapipe as mp
except Exception:  # pragma: no cover
    mp = None


logger = logging.getLogger(__name__)
_face_mesh = None
_face_mesh_lock = threading.Lock()
_face_mesh_error_logged = False


THRESHOLDS = {
    "ear_closed": 0.21,
    "minimum_eye_closure_seconds": 2,
    "mar_yawn": 0.60,
    "minimum_yawn_seconds": 3,
    "head_pitch_deviation_degrees": 20,
    "head_yaw_deviation_degrees": 25,
    "minimum_head_deviation_seconds": 3,
    "safe_score": 80,
    "warning_score": 55,
}


def _episodes(duration, rng, minimum_duration, maximum_duration):
    episodes = []
    start = rng.randint(8, 30)

    while start < duration:
        length = rng.randint(minimum_duration, maximum_duration)
        episodes.append((start, min(start + length, duration)))
        start += length + rng.randint(35, 85)

    return episodes


def _is_active(episodes, second):
    return any(start <= second < end for start, end in episodes)


def _find_events(samples, predicate, minimum_duration, event_type, detail):
    events = []
    start = None

    for index, sample in enumerate(samples + [None]):
        active = sample is not None and predicate(sample)

        if active and start is None:
            start = index
        elif not active and start is not None:
            duration = index - start
            if duration >= minimum_duration:
                events.append({
                    "seconds": start,
                    "duration_seconds": duration,
                    "type": event_type,
                    "detail": detail.format(duration=duration),
                })
            start = None

    return events


def _format_time(seconds):
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def _risk_level(score):
    if score >= THRESHOLDS["safe_score"]:
        return "SAFE"
    if score >= THRESHOLDS["warning_score"]:
        return "WARNING"
    return "DANGER"


def _distance(point_a, point_b):
    return float(np.linalg.norm(np.array(point_a) - np.array(point_b)))


def _normalise_landmarks(landmarks, width, height):
    return np.array(
        [[lm.x * width, lm.y * height, lm.z] for lm in landmarks],
        dtype=np.float32,
    )


def _head_pose_from_landmarks(landmarks_2d, width, height):
    if landmarks_2d.shape[0] < 6:
        return 0.0, 0.0, 0.0

    model_points = np.array([
        [0.0, 0.0, 0.0],
        [0.0, -330.0, -65.0],
        [-225.0, 170.0, -135.0],
        [225.0, 170.0, -135.0],
        [-150.0, -150.0, -125.0],
        [150.0, -150.0, -125.0],
    ], dtype=np.float32)

    image_points = landmarks_2d[[1, 152, 263, 33, 287, 57], :2].astype(np.float32)

    focal_length = float(width)
    camera_matrix = np.array([
        [focal_length, 0.0, width / 2.0],
        [0.0, focal_length, height / 2.0],
        [0.0, 0.0, 1.0],
    ], dtype=np.float32)
    dist_coeffs = np.zeros((4, 1), dtype=np.float32)

    success, rotation_vector, _translation_vector = cv2.solvePnP(
        model_points,
        image_points,
        camera_matrix,
        dist_coeffs,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not success:
        return 0.0, 0.0, 0.0

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    pitch = math.degrees(math.asin(rotation_matrix[2, 0]))
    yaw = math.degrees(math.atan2(rotation_matrix[2, 1], rotation_matrix[2, 2]))
    roll = math.degrees(math.atan2(rotation_matrix[1, 0], rotation_matrix[0, 0]))
    return pitch, yaw, roll


def _face_metrics(frame):
    if frame is None:
        return None

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if mp is not None and hasattr(mp, "solutions"):
        height, width = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        try:
            global _face_mesh, _face_mesh_error_logged
            with _face_mesh_lock:
                if _face_mesh is None:
                    _face_mesh = mp.solutions.face_mesh.FaceMesh(
                        static_image_mode=True,
                        max_num_faces=1,
                        refine_landmarks=True,
                        min_detection_confidence=0.5,
                    )
                results = _face_mesh.process(rgb)
            if not results.multi_face_landmarks:
                return None

            landmark_list = results.multi_face_landmarks[0].landmark
            landmarks = _normalise_landmarks(landmark_list, width, height)
            image_landmarks = landmarks[:, :2]

            left_eye = [image_landmarks[160], image_landmarks[158], image_landmarks[144], image_landmarks[153], image_landmarks[33], image_landmarks[133]]
            right_eye = [image_landmarks[385], image_landmarks[387], image_landmarks[380], image_landmarks[373], image_landmarks[362], image_landmarks[263]]

            def eye_ratio(indices):
                p1, p2, p3, p4, p5, p6 = indices
                vertical_1 = _distance(p1, p3)
                vertical_2 = _distance(p2, p4)
                horizontal = _distance(p5, p6)
                if horizontal == 0:
                    return 0.0
                return (vertical_1 + vertical_2) / (2.0 * horizontal)

            left_ear = eye_ratio(left_eye)
            right_ear = eye_ratio(right_eye)
            ear = float((left_ear + right_ear) / 2.0)

            vertical = _distance(image_landmarks[13], image_landmarks[14])
            horizontal = _distance(image_landmarks[61], image_landmarks[291])
            mar = vertical / horizontal if horizontal else 0.0

            pitch, yaw, roll = _head_pose_from_landmarks(landmarks, width, height)
            if not math.isfinite(pitch):
                pitch = 0.0
            if not math.isfinite(yaw):
                yaw = 0.0
            if not math.isfinite(roll):
                roll = 0.0

            return {
                "ear": round(ear, 3),
                "mar": round(mar, 3),
                "head_pitch": round(float(pitch), 1),
                "head_yaw": round(float(yaw), 1),
                "head_roll": round(float(roll), 1),
                "face_detected": True,
                "method": "MediaPipe Face Mesh",
            }
        except Exception:
            if not _face_mesh_error_logged:
                logger.exception("MediaPipe Face Mesh failed; falling back to OpenCV detection.")
                _face_mesh_error_logged = True

    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    if face_cascade.empty():
        return None

    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5)
    if len(faces) == 0:
        return None

    face_x, face_y, face_width, face_height = faces[0]
    eye_region = gray[
        face_y:face_y + int(face_height * 0.6),
        face_x:face_x + face_width,
    ]
    eye_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_eye_tree_eyeglasses.xml"
    )
    eyes = (
        eye_cascade.detectMultiScale(eye_region, scaleFactor=1.1, minNeighbors=4)
        if not eye_cascade.empty()
        else ()
    )

    return {
        "ear": 0.3 if len(eyes) >= 2 else None,
        "mar": None,
        "head_pitch": None,
        "head_yaw": None,
        "head_roll": None,
        "face_detected": True,
        "method": "OpenCV face and eye cascades",
    }


def _build_result(samples, session_id, created_at, filename, duration, analysis_type, notice):
    events = []
    events.extend(_find_events(
        samples,
        lambda sample: sample.get("ear") is not None and sample["ear"] <= THRESHOLDS["ear_closed"],
        THRESHOLDS["minimum_eye_closure_seconds"],
        "Drowsiness",
        "Eye closure persisted for {duration} seconds",
    ))
    events.extend(_find_events(
        samples,
        lambda sample: sample.get("mar") is not None and sample["mar"] >= THRESHOLDS["mar_yawn"],
        THRESHOLDS["minimum_yawn_seconds"],
        "Yawn",
        "Yawning episode lasted {duration} seconds",
    ))
    events.extend(_find_events(
        samples,
        lambda sample: (
            (sample.get("head_pitch") is not None and abs(sample["head_pitch"]) >= THRESHOLDS["head_pitch_deviation_degrees"])
            or (sample.get("head_yaw") is not None and abs(sample["head_yaw"]) >= THRESHOLDS["head_yaw_deviation_degrees"])
        ),
        THRESHOLDS["minimum_head_deviation_seconds"],
        "Distraction",
        "Head deviation lasted {duration} seconds",
    ))
    events.sort(key=lambda event: event["seconds"])

    counts = {
        "drowsiness": sum(event["type"] == "Drowsiness" for event in events),
        "yawns": sum(event["type"] == "Yawn" for event in events),
        "distractions": sum(event["type"] == "Distraction" for event in events),
    }

    ear_values = [sample.get("ear") for sample in samples if sample.get("ear") is not None]
    mar_values = [sample.get("mar") for sample in samples if sample.get("mar") is not None]
    pitch_values = [sample.get("head_pitch") for sample in samples if sample.get("head_pitch") is not None]
    yaw_values = [sample.get("head_yaw") for sample in samples if sample.get("head_yaw") is not None]
    perclos = (
        sum(value <= THRESHOLDS["ear_closed"] for value in ear_values) / len(ear_values) * 100
        if ear_values
        else None
    )

    def average(values):
        return round(mean(values), 3) if values else None

    has_metrics = bool(ear_values or mar_values or pitch_values or yaw_values)
    score = (
        max(
            0,
            min(
                100,
                100 - counts["drowsiness"] * 46 - counts["yawns"] * 10 - counts["distractions"] * 12,
            ),
        )
        if has_metrics
        else None
    )
    if not has_metrics:
        risk_level = "NO DATA"
    elif counts["drowsiness"] or (counts["yawns"] and counts["distractions"]):
        risk_level = "DANGER"
    elif counts["yawns"] or counts["distractions"]:
        risk_level = "WARNING"
    else:
        risk_level = _risk_level(score)

    for index, event in enumerate(events, start=1):
        event["id"] = f"E-{index:03d}"
        event["time"] = _format_time(event["seconds"])
        event["severity"] = (
            "High" if event["type"] == "Drowsiness" or event["duration_seconds"] >= 6 else "Medium"
        )
        event["status"] = "Logged"

    def max_duration(event_type):
        return max(
            (event["duration_seconds"] for event in events if event["type"] == event_type),
            default=0,
        )

    point_count = min(60, duration)
    event_penalties = {"Drowsiness": 46, "Yawn": 10, "Distraction": 12}
    series = []
    for point in range(point_count):
        sample_index = round(point * (duration - 1) / max(point_count - 1, 1))
        sample = samples[sample_index]
        point_score = (
            max(
                0,
                100 - sum(event_penalties[event["type"]] for event in events if event["seconds"] <= sample_index),
            )
            if has_metrics
            else None
        )
        observed_ear_values = [
            item.get("ear")
            for item in samples[: sample_index + 1]
            if item.get("ear") is not None
        ]
        perclos_so_far = (
            sum(value <= THRESHOLDS["ear_closed"] for value in observed_ear_values)
            / len(observed_ear_values) * 100
            if observed_ear_values
            else None
        )
        series.append({
            "seconds": sample_index,
            "time": _format_time(sample_index),
            "safety_score": point_score,
            "ear": sample["ear"],
            "perclos_percent": round(perclos_so_far, 1) if perclos_so_far is not None else None,
            "mar": sample["mar"],
            "head_pitch": sample["head_pitch"],
            "head_yaw": sample["head_yaw"],
        })

    return {
        "session_id": session_id,
        "created_at": created_at,
        "analysis_type": analysis_type,
        "notice": notice,
        "video_filename": filename,
        "session_duration_seconds": duration,
        "session_duration_label": _format_time(duration),
        "summary": {
            "safety_score": score,
            "risk_level": risk_level,
            "drowsiness_count": counts["drowsiness"],
            "yawn_count": counts["yawns"],
            "distraction_count": counts["distractions"],
            "total_alerts": len(events),
            "ear": average(ear_values),
            "perclos_percent": round(perclos, 1) if perclos is not None else None,
            "max_eye_closure_seconds": max_duration("Drowsiness"),
            "mar": average(mar_values),
            "max_yawn_seconds": max_duration("Yawn"),
            "head_pitch": round(mean(pitch_values), 1) if pitch_values else None,
            "head_yaw": round(mean(yaw_values), 1) if yaw_values else None,
            "max_head_deviation_seconds": max_duration("Distraction"),
        },
        "thresholds": THRESHOLDS,
        "events": events,
        "series": series,
    }


def _demo_analysis(duration_seconds, content_digest, filename, session_id, created_at):
    duration = max(1, min(int(round(duration_seconds)), 7200))
    rng = random.Random(content_digest)
    eye_episodes = _episodes(duration, rng, 2, 6)
    yawn_episodes = _episodes(duration, rng, 3, 7)
    head_episodes = _episodes(duration, rng, 3, 8)

    samples = []
    for second in range(duration):
        eye_closed = _is_active(eye_episodes, second)
        yawning = _is_active(yawn_episodes, second)
        head_deviated = _is_active(head_episodes, second)
        samples.append({
            "seconds": second,
            "ear": round(rng.uniform(0.13, 0.19) if eye_closed else rng.uniform(0.24, 0.34), 3),
            "mar": round(rng.uniform(0.62, 0.82) if yawning else rng.uniform(0.15, 0.34), 3),
            "head_pitch": round(rng.uniform(21, 32) if head_deviated else rng.uniform(-8, 12), 1),
            "head_yaw": round(rng.uniform(26, 42) if head_deviated else rng.uniform(-14, 14), 1),
        })

    return _build_result(
        samples,
        session_id,
        created_at,
        filename,
        duration,
        "Prototype Analysis / Demo Analysis",
        "Demonstration values only. This prototype does not inspect video frames and is not real AI detection.",
    )


def _real_analysis(video_path, duration_seconds, filename, session_id, created_at):
    duration = max(1, min(int(round(duration_seconds)), 7200))
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        return None

    samples = []
    detected_faces = 0
    methods = set()
    frame_index = 0
    sample_interval = max(1, int(capture.get(cv2.CAP_PROP_FRAME_COUNT) / max(duration, 1)))

    while True:
        success, frame = capture.read()
        if not success:
            break
        if frame_index % sample_interval == 0:
            metrics = _face_metrics(frame)
            if metrics is None:
                metrics = {
                    "ear": None,
                    "mar": None,
                    "head_pitch": None,
                    "head_yaw": None,
                }
            else:
                detected_faces += 1
                methods.add(metrics.get("method", "OpenCV face detection"))
            sample_seconds = min(len(samples), duration - 1)
            samples.append({
                "seconds": sample_seconds,
                "ear": metrics.get("ear", 0.3),
                "mar": metrics.get("mar", 0.2),
                "head_pitch": metrics.get("head_pitch", 0.0),
                "head_yaw": metrics.get("head_yaw", 0.0),
            })
            if len(samples) >= duration:
                break
        frame_index += 1

    capture.release()
    if not samples or not detected_faces:
        return None

    if len(samples) < duration:
        while len(samples) < duration:
            samples.append(samples[-1].copy())

    method = "MediaPipe Face Mesh" if "MediaPipe Face Mesh" in methods else "OpenCV face and eye cascades"
    notice = (
        "Frame-based analysis using facial landmarks."
        if method == "MediaPipe Face Mesh"
        else "OpenCV detected faces and eyes. This setup cannot reliably estimate MAR or head pose; unavailable values are omitted."
    )
    return _build_result(
        samples[:duration],
        session_id,
        created_at,
        filename,
        duration,
        "Computer vision analysis / " + method,
        notice,
    )


def analyze_video(duration_seconds, content_digest, filename, session_id, created_at, video_path=None):
    """Analyze a video session using real frame processing when available."""
    duration = max(1, min(int(round(duration_seconds)), 7200))
    if video_path is not None:
        real_result = _real_analysis(video_path, duration, filename, session_id, created_at)
        if real_result is None:
            raise ValueError(
                "Could not read the video or detect a driver face. Try a readable video with the driver's face clearly visible."
            )
        if real_result["summary"]["risk_level"] == "NO DATA":
            raise ValueError(
                "A face was detected, but this setup could not measure eye or face landmarks. Use a compatible MediaPipe Face Mesh environment to analyze this video."
            )
        return real_result
    return _demo_analysis(duration, content_digest, filename, session_id, created_at)
