# MargRakshak AI

MargRakshak AI is a college project prototype for monitoring driver fatigue and distraction using a webcam or recorded video. It uses a Flask backend with OpenCV and MediaPipe facial landmarks.

## Features

- Live webcam monitoring with visual, beep, and voice alert preferences.
- Recorded-video playback controls with frame-by-frame monitoring.
- Session risk summaries, metrics, and alert timelines.
- Local alert history and analytics for completed monitoring sessions.

## Tech stack

| Layer | Tools |
| --- | --- |
| Frontend | HTML5, CSS3, Bootstrap 5, vanilla JavaScript, Chart.js |
| Backend | Python, Flask |
| Computer vision | OpenCV; MediaPipe Face Mesh for landmark-based metrics |
| Database (later) | SQLite |

## Run the project on Windows

Run Flask from the project root so the frontend and API are served from the same address.

1. Install Python 3.12. The legacy MediaPipe Face Mesh API used by this project is not available in Python 3.13+.
2. In PowerShell, open the project folder and create the environment and install dependencies:

```powershell
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install -r backend\requirements.txt
```

3. Start the server:

```powershell
.\.venv312\Scripts\python.exe backend\app.py
```

4. Open `http://127.0.0.1:5000` in a browser and log in.
5. Allow camera access for live monitoring, or upload an MP4, AVI, WebM, or MOV file. Recorded-video monitoring includes play/pause, **Forward 10s**, and **Stop Analysis** controls.
6. Stop the webcam session to save its sampled metrics. A recorded-video report is saved when playback completes; stopping early does not save a partial report.

Stop Flask with `Ctrl+C`. Uploaded videos and session history stay local in `backend/uploads/` and `backend/history.json`; these files are excluded from Git.

## Pages

- Landing: `frontend/index.html`
- Login: `frontend/login.html`
- Live dashboard: `frontend/dashboard.html`
- Alert history: `frontend/alerts.html`
- Analytics: `frontend/analytics.html`
- Settings: `frontend/settings.html`
- About: `frontend/about.html`

## Limitations

- This is an academic prototype, not a certified or safety-grade driver-monitoring device. Do not rely on it as the sole basis for driving decisions.
- Lighting, camera angle, occlusion, and face visibility affect detection. OpenCV-only environments cannot reliably estimate all facial metrics; unavailable values should be treated as unknown, not safe.
- Session history is stored locally in JSON. SQLite is not wired in.
- Phone-use detection is not implemented.
