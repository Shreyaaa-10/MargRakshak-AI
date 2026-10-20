# MargRakshak AI

Web-based intelligent driver fatigue and distraction detection system (college project).

**Approach:** frontend UI first with dummy data. Webcam monitoring and AI detection come later, one feature at a time.

## Tech stack (do not change without asking)

| Layer | Tools |
| --- | --- |
| Frontend | HTML5, CSS3, Bootstrap 5, vanilla JavaScript, Chart.js |
| Backend (later) | Python, Flask |
| AI (later) | OpenCV, MediaPipe, rule-based EAR/MAR/head-pose, YOLO in a later phase |
| Database (later) | SQLite |

## How to run the UI (this phase)

You only need a browser. No Python packages yet.

1. Open the project folder in Cursor or VS Code.
2. Open `frontend/index.html` in your browser  
   **or** from the project folder run:

```bash
python -m http.server 5500
```

3. Visit `http://localhost:5500/frontend/`
4. On Login, use any name, email, and password (data stays in the browser only).

## Pages

- Landing — `frontend/index.html`
- Login — `frontend/login.html`
- Live dashboard — `frontend/dashboard.html` (dummy status, camera placeholder)
- Alerts — `frontend/alerts.html`
- Analytics — `frontend/analytics.html`
- Settings — `frontend/settings.html`
- About the system — `frontend/about.html`

## What is not built yet

- Flask API
- SQLite
- Webcam capture
- MediaPipe / OpenCV / YOLO detection
