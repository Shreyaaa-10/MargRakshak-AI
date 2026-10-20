# MargRakshak AI 🚗

**A Web-Based Intelligent Driver Fatigue and Distraction Detection System**

MargRakshak AI is a college mini-project focused on developing a web-based system to help monitor driver alertness and identify potential signs of fatigue and distraction.

The project is being developed incrementally, starting with the frontend user interface and dummy data. Backend integration, webcam monitoring, and AI-based detection will be implemented in later phases.

## 🎯 Project Objectives

- Design a user-friendly dashboard for driver monitoring.
- Present driver alertness information and alerts through a web interface.
- Develop a foundation for real-time fatigue and distraction monitoring.
- Integrate computer vision and backend services in future development phases.

## 🛠️ Technology Stack

The technology stack is defined for the project and will not be changed without reviewing the requirements.

| Layer | Technologies |
|---|---|
| Frontend | HTML5, CSS3, Bootstrap 5, JavaScript |
| Data Visualization | Chart.js |
| Backend (planned) | Python, Flask |
| Computer Vision (planned) | OpenCV, MediaPipe |
| Detection Approach (planned) | Eye Aspect Ratio (EAR), Mouth Aspect Ratio (MAR), head-pose analysis |
| Object Detection (later phase) | YOLO |
| Database (planned) | SQLite |

## ✨ Current Frontend Features

The current phase focuses on the user interface and sample data.

- **Landing Page:** Introduction to the project.
- **Login Page:** Basic login interface for demonstration.
- **Dashboard:** Monitoring interface with sample status information and a camera placeholder.
- **Alerts Page:** Interface for displaying driver-related alerts.
- **Analytics Page:** Visual representation of sample monitoring data.
- **Settings Page:** Interface for system settings.
- **About Page:** Overview of the project and its purpose.

> **Current status:** The frontend interface is under development using dummy data. Live camera monitoring and actual fatigue or distraction detection are not yet implemented.

## 📂 Project Structure

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

This structure represents the main pages; supporting CSS, JavaScript, images, and other assets may also be present in the frontend folder.

## 🚀 How to Run the Project

You can run the current frontend locally using a web browser.

### Prerequisites

- A modern web browser.
- Python installed if you want to use the local HTTP server.

### Option 1: Open the HTML file

1. Clone or download this repository.
2. Open the project folder.
3. Open `frontend/index.html` in your browser.

### Option 2: Run a local HTTP server

From the root directory of the project, run:

```bash
python -m http.server 5500
```

Then open:

http://localhost:5500/frontend/

The server serves the project files locally. Keep the terminal running while using the application.

### Login

Use sample details as supported by the current frontend implementation. If the login is only a demonstration, it should not be treated as secure authentication or used with real passwords.

## 🔭 Planned Development

The following features are planned for future phases:

- Flask backend and API integration.
- SQLite database integration.
- Webcam capture and frame processing.
- Facial landmark detection using MediaPipe.
- Eye-closure and mouth-opening analysis using EAR and MAR.
- Head-pose analysis for potential distraction indicators.
- Alert generation and monitoring history.
- YOLO-based object detection in a later phase, if required.

These features will be implemented and tested incrementally.

## 🎓 Project Information

**Project:** MargRakshak AI  
**Type:** College Mini-Project  
**Domain:** Web Development, Computer Vision, and Artificial Intelligence

## ⚠️ Disclaimer

This is an academic project under development. The current frontend uses sample data and is not a validated driver-safety system. It should not be relied upon for real-world driving decisions.

## 📌 Development Status

**Phase 1: Frontend UI and sample data**

Backend development, database integration, webcam monitoring, and AI-based detection remain future development tasks.
