# MargRakshak AI: Viva Preparation Guide

## 1. Project in one minute

MargRakshak AI is a college-project prototype for monitoring signs of driver fatigue and distraction. A browser page captures or plays video, JavaScript sends sampled frames or an uploaded recording to a Python Flask server, and the backend uses OpenCV with MediaPipe Face Mesh when available to estimate facial measurements. Rule-based thresholds turn those measurements into events and a session summary. The dashboard and analytics page read the same saved session result.

This is an experimental prototype, not a certified driver-safety system. Camera position, lighting, occlusion, and model availability affect results.

## 2. Important truth about the current implementation

There are two distinct processing paths:

- **Recorded video:** the dashboard previews and plays the selected video locally. During playback, it periodically sends a frame to Flask for immediate status updates. When playback finishes, the browser uploads the video file to `/api/analyze`. The server processes sampled video frames and saves the completed analysis.
- **Webcam:** the browser requests camera permission, captures periodic frames, and sends them to `/api/live-monitor`. When monitoring stops, sampled metrics and alerts are submitted to `/api/save-live-session` and saved as a completed session.

The normal uploaded-video route uses computer-vision processing. It does **not** automatically switch to generated demo data if it fails to read the video or detect a face; it returns an error instead. `/api/analyze-demo` is a separate demo endpoint that generates deterministic sample measurements for a requested duration. It does not inspect video frames.

## 3. Folder and file map

| File | Responsibility |
| --- | --- |
| `backend/app.py` | Creates the Flask app, serves the frontend, validates uploads, defines API routes, and saves/reads session history. |
| `backend/analysis.py` | Holds thresholds, extracts frame measurements, detects event episodes, calculates the score/risk, and builds the common result object. |
| `backend/requirements.txt` | Lists Flask, NumPy, OpenCV, and MediaPipe dependencies. |
| `backend/uploads/` | Stores uploaded recordings using generated session IDs as filenames. |
| `backend/history.json` | Local session history. It is generated at runtime and ignored by Git. |
| `frontend/dashboard.html` | Dashboard layout and display elements, identified by HTML IDs. |
| `frontend/js/dashboard.js` | Upload, playback, webcam capture, alert behavior, API calls, and dashboard rendering. |
| `frontend/analytics.html` | Analytics layout, chart canvases, and event timeline. |
| `frontend/js/analytics.js` | Loads the latest saved session and creates the charts/timeline. |
| `frontend/alerts.html` | Alert-history table and event-type filter. |
| `frontend/js/alerts.js` | Loads saved history and renders/filter events. |
| `frontend/js/app.js` | Shared sidebar, browser-local login state, and page access redirect. |
| `frontend/js/settings.js` | Saves user preferences in browser `localStorage`. |
| `frontend/js/dummy-data.js` | Default driver and vehicle display information, not the completed session analysis. |
| `frontend/css/style.css` | Shared theme, layout, cards, and responsive styling. |
| `README.md` | Setup instructions, supported runtime, features, and limitations. |

## 4. How to run it

The project README recommends Python 3.12 because its pinned MediaPipe version uses a legacy Face Mesh API that is not available in Python 3.13+.

From the project root in PowerShell:

```powershell
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install -r backend\requirements.txt
.\.venv312\Scripts\python.exe backend\app.py
```

Then open `http://127.0.0.1:5000`. Flask serves both the HTML frontend and API from one address. Allow camera permission for webcam use. Stop the Flask server with `Ctrl+C`.

## 5. End-to-end recorded-video flow

1. The user selects a supported MP4, AVI, WebM, or MOV file. The browser checks the extension and the 250 MB limit, then creates a temporary local URL for preview.
2. The browser reads the video duration and enables **Analyze Video**.
3. While the video plays, `dashboard.js` draws the current video frame onto a small canvas, encodes it as a JPEG data URL, and posts it as JSON to `/api/live-monitor`. This endpoint returns current measurements and status for the dashboard alerts.
4. On playback completion, the browser sends the original file and its duration as multipart form data to `/api/analyze`.
5. `app.py` validates the request, gives the saved file a generated UUID filename, saves it under `backend/uploads/`, and calculates a SHA-256 digest.
6. `analysis.py` reads the recording with OpenCV and samples frames. For each sample it tries MediaPipe Face Mesh measurements, with an OpenCV face/eye cascade fallback for more limited estimates.
7. The analysis layer applies thresholds, finds sustained event episodes, calculates session metrics, score, risk level, and timeline, then returns one structured result.
8. Flask saves that result in `backend/history.json` and returns it as JSON. The dashboard renders the returned object directly.

Stopping recorded-video monitoring early stops frame-by-frame playback monitoring and does not create a partial report. A completed report is generated after the video reaches its end.

## 6. Webcam flow

1. The browser calls `getUserMedia` to request camera permission and displays the camera stream in the video element.
2. About once every 1.2 seconds, JavaScript sends a frame to `/api/live-monitor`.
3. Flask decodes the image and calls the same face-metric helper used by video analysis. It returns EAR, MAR, head angles when available, plus a current status and reason.
4. The dashboard updates values and triggers configured visual, beep, or speech alerts. Browser settings control these alert preferences.
5. When the user stops the camera, JavaScript posts its sampled metrics and alerts to `/api/save-live-session`.
6. Flask builds the report with the shared analysis rules, stores it in history, and returns it to the dashboard.

The webcam stream itself is not stored as a recording; the saved report contains sampled measurements and events.

## 7. Measurements and rule logic

Thresholds are grouped in `backend/analysis.py` under `THRESHOLDS`, making them easier to change in one place.

| Term | Meaning in this project |
| --- | --- |
| EAR | Eye Aspect Ratio. Landmark mode compares vertical eye opening with eye width. A lower value suggests a more closed eye. The closed-eye threshold is `0.21`. |
| PERCLOS | Percentage of measured samples whose EAR is at or below `0.21`. It is an estimate based on sampled frames, not a continuous medical measurement. |
| MAR | Mouth Aspect Ratio: vertical mouth opening divided by mouth width. A value at or above `0.60` is treated as a possible yawn. |
| Head pitch | Estimated up/down head rotation in degrees. Deviation threshold is an absolute angle of `20°`. |
| Head yaw | Estimated left/right head rotation in degrees. Deviation threshold is an absolute angle of `25°`. |
| Drowsiness event | A low-EAR episode lasting at least 2 seconds. |
| Yawn event | A high-MAR episode lasting at least 3 seconds. |
| Distraction event | A pitch or yaw threshold episode lasting at least 3 seconds. |

The result builder groups consecutive samples that meet a rule into an event. This means an event represents a sustained episode rather than every individual frame that crosses a threshold.

### Score and risk

For a session with usable measurements, the prototype starts at 100 and subtracts a penalty per detected event: 46 for drowsiness, 10 for yawning, and 12 for distraction. The score is limited to the range 0–100. The event rules also affect risk: drowsiness, or yawning together with distraction, leads to DANGER; yawning or distraction leads to WARNING. If those event rules do not determine the level, score thresholds are used: 80 or above is SAFE, 55–79 is WARNING, and below 55 is DANGER. With no usable measurements, score is unavailable and risk is `NO DATA`.

These are project rules, not an industry standard or a validated safety score.

## 8. How one result feeds all pages

The common result object contains session metadata, `summary`, `thresholds`, `events`, and `series`.

- The dashboard uses `summary` for score, risk, average measurements, event counts, and duration. It displays `events` as recent alerts.
- Analytics requests `/api/latest`, then builds charts from `series` and event distribution/timeline from `events`.
- Alert history requests `/api/history`, flattens events across sessions, and adds session information before displaying the table.
- `/api/latest` returns the newest saved report. `/api/history` returns all saved reports.

This shared result is the reason the dashboard summary and analytics charts describe the same completed session. The pages do not calculate separate random card or chart values.

## 9. API route cheat sheet

| Route | What it does |
| --- | --- |
| `GET /` | Serves the frontend landing page. |
| `POST /api/analyze` | Receives and analyzes an uploaded video; saves and returns the completed result. |
| `POST /api/live-monitor` | Receives one encoded camera/video frame and returns current metrics and status. |
| `POST /api/save-live-session` | Receives webcam samples and alerts, builds the session result, and saves it. |
| `POST /api/analyze-demo` | Produces a separate deterministic demo result without inspecting video frames. |
| `GET /api/latest` | Returns the most recently saved analysis, or `null` when there is none. |
| `GET /api/history` | Returns saved session reports for alert history. |

A successful analysis response has the shape `{ "analysis": { ... } }`. Errors have an `error` message and an appropriate HTTP status code, such as 400 for invalid input or 413 for a file that is too large.

## 10. Frontend concepts to explain

- **HTML** provides page structure and IDs such as `ear-value` or `event-timeline` that JavaScript can update.
- **CSS** controls visual appearance and responsive layout.
- **JavaScript** handles browser events, file preview, camera frames, HTTP `fetch` calls, and updates the page.
- **Flask** maps HTTP routes to Python functions and returns JSON.
- **OpenCV** reads video frames, decodes images, and provides basic face/eye detection.
- **MediaPipe Face Mesh** provides facial landmarks used for EAR, MAR, and head-pose estimates when available.
- **Chart.js** draws analytics charts from the JSON series.
- **JSON history** is a simple local persistence choice for a college prototype. It is not SQLite and is not designed for many simultaneous users.
- **`localStorage`** holds the demo login identity and settings in the browser. Login is not secure backend authentication.

## 11. Common viva questions and short answers

**What problem does the project address?**  
It demonstrates how measurable eye, mouth, and head-position indicators can be used to raise possible fatigue or distraction alerts for a driver.

**What is EAR?**  
EAR compares vertical eye opening with horizontal eye width using facial landmarks. A sustained low EAR can indicate eye closure.

**What is PERCLOS?**  
It is the percentage of sampled eye measurements below the closed-eye threshold. It summarizes eye closure over a time window or session.

**Why use thresholds?**  
They make the prototype understandable and easy to tune. They are simple rules, not a trained classifier.

**Why sample frames instead of processing every frame?**  
Sampling reduces the amount of work and network traffic while still producing a time-based prototype estimate. It can miss brief events, so sampling frequency is a limitation.

**How is a yawn identified?**  
The system computes MAR from mouth landmarks and records a yawn episode if MAR stays at or above its threshold for the minimum duration.

**What is the difference between the live endpoint and the analysis endpoint?**  
`/api/live-monitor` analyzes one image and returns immediate status. `/api/analyze` receives an entire recording and builds a saved session report.

**Where are results stored?**  
The recording is saved in `backend/uploads/`, and its result is saved in `backend/history.json`. Both are local to the project.

**Is the safety score a real-world safety guarantee?**  
No. It is a transparent project formula based on event penalties and must not be used as a certified safety assessment.

**What happens when the face or measurements are unavailable?**  
The system reports missing/no-face conditions or an analysis error rather than treating missing measurements as proof that the driver is safe. OpenCV-only fallback measurements are limited.

**Is the login production-ready?**  
No. It is a frontend demonstration using browser `localStorage`; it does not authenticate users securely on the server.

**What would you improve next?**  
Test across lighting and camera positions, make measurement validity and confidence clearer, tune thresholds using labeled data, improve persistence and authentication, and evaluate performance before making any safety claims.

## 12. Honest limitations to mention

- This is a prototype and not certified or safety-grade.
- Face landmarks can fail under poor lighting, occlusion, unusual camera angles, or when the face is out of frame.
- OpenCV's fallback cascade can detect faces/eyes but cannot reliably estimate all mouth and head-pose metrics; those values may be unavailable.
- The webcam session saves sampled measurements, not the camera video.
- Sampling may miss short events and can affect duration estimates.
- Session history uses a local JSON file; it is not a multi-user database.
- Login and settings are browser-local demos, not secure account management.
- The score and thresholds are prototype rules, not clinically or statistically validated.
