# MargRakshak AI 🚗

MargRakshak AI is a college mini-project focused on driver fatigue and distraction detection. The idea is to develop a web application that can help monitor a driver's alertness and identify signs of drowsiness or distraction.

I'm currently working on the frontend. The backend, webcam monitoring, and AI detection features will be added in the upcoming stages.

## Tech Stack

| Part | Technology |
|---|---|
| Frontend | HTML, CSS, Bootstrap 5, JavaScript |
| Charts | Chart.js |
| Backend (planned) | Python, Flask |
| Computer Vision (planned) | OpenCV, MediaPipe |
| Database (planned) | SQLite |
| Object Detection (later) | YOLO |

## Current Features

- Landing page
- Login page
- Driver monitoring dashboard
- Alerts page
- Analytics page
- Settings page
- About page

The pages currently use dummy data. Actual driver monitoring and AI-based detection are not implemented yet.

## How to Run

You can run the frontend in your browser.

1. Download or clone this repository.
2. Open the project folder in VS Code or another code editor.
3. Open a terminal in the project folder.
4. Run the following command:

   ```bash
   python -m http.server 5500
   ```

5. Open `http://localhost:5500/frontend/` in your browser.

You can also open `frontend/index.html` directly in your browser.

## Project Structure

```text
MargRakshak-AI/
├── README.md
└── frontend/
    ├── index.html
    ├── login.html
    ├── dashboard.html
    ├── alerts.html
    ├── analytics.html
    ├── settings.html
    └── about.html
```

## What's Next?

I'm planning to work on these features next:

- Connect the frontend to a Python Flask backend.
- Store application data using SQLite.
- Add webcam monitoring.
- Use MediaPipe and OpenCV for facial landmark detection.
- Explore EAR, MAR, and head-pose analysis for detecting signs of fatigue and distraction.
- Add YOLO-based object detection in a later stage.

## Note

This project is still under development. The current version focuses on the frontend, and the monitoring data is only for demonstration. It is not yet a working driver-safety system.
