# MargRakshak AI — Presentation Content

## Slide 1 — Title

**MargRakshak AI**  
*Driver Fatigue and Distraction Monitoring Prototype*

- Presented by: **[Your name / team]**
- Department: **[Department name]**
- Guide: **[Guide’s name]**
- Institution: **[College name]**

## Slide 2 — Problem Statement

- Driver fatigue and distraction can reduce attention while driving.
- Drivers or passengers may not notice early signs of fatigue.
- This project explores whether facial cues—such as eye closure, yawning, and head direction—can be used to raise alerts.
- This is a college-project prototype, not a certified vehicle-safety system.

## Slide 3 — Project Objectives

- Monitor facial measurements from a webcam or recorded video.
- Identify possible drowsiness, yawning, and head-position events.
- Show a session summary, risk level, and event timeline.
- Store completed session reports locally for review.

## Slide 4 — Proposed Solution

MargRakshak AI processes video and displays possible risk indicators:

1. The user starts webcam monitoring or selects a recorded video.
2. The browser sends sampled frames to the Flask backend.
3. OpenCV and, when available, MediaPipe Face Mesh estimate facial measurements.
4. Rule-based thresholds identify possible events.
5. The dashboard displays alerts and the completed session report.

**Suggested visual:** Video → Frame Processing → Facial Measurements → Event Rules → Dashboard.

## Slide 5 — System Architecture

- **Frontend:** HTML, CSS, Bootstrap, JavaScript, and Chart.js
- **Backend:** Python and Flask
- **Video processing:** OpenCV
- **Facial landmarks:** MediaPipe Face Mesh, when available
- **Session history:** Local JSON file

**Suggested visual:** Show the browser communicating with the Flask server, which uses OpenCV/MediaPipe and stores results in local history.

## Slide 6 — How the Analysis Works

- **Eye Aspect Ratio (EAR):** Estimates eye openness; a sustained low value may indicate eye closure.
- **PERCLOS estimate:** Percentage of sampled eye measurements below the closed-eye threshold.
- **Mouth Aspect Ratio (MAR):** Estimates mouth opening; a sustained high value may indicate a yawn.
- **Head pitch and yaw:** Estimate up/down and left/right head direction.
- Sustained threshold crossings are grouped into events instead of treating every frame as a separate alert.

## Slide 7 — Features and User Interface

- Live webcam monitoring with configurable visual, beep, and voice alerts.
- Recorded-video preview and frame-by-frame monitoring.
- Dashboard with session metrics, risk summary, and recent alerts.
- Analytics charts and event timeline.
- Local alert history for completed sessions.

**Suggested visuals:** Screenshots of the dashboard, analytics page, and alert history.

## Slide 8 — Results and Risk Summary

- The system creates a report containing session metrics and detected events.
- It assigns a prototype risk level: **SAFE, WARNING, DANGER,** or **NO DATA**.
- A session score is calculated from detected events when measurements are available.
- The dashboard and analytics pages use the same saved report.

**Important:** The score and thresholds are experimental project rules, not validated safety standards. Use actual screenshots or test-session results here; do not invent performance statistics.

## Slide 9 — Limitations

- This is a prototype, not a certified or safety-grade driver-monitoring system.
- Lighting, camera angle, face visibility, and occlusion can affect measurements.
- Sampling may miss brief events.
- OpenCV fallback measurements may be limited.
- Session history is stored locally in JSON; login is a browser-side demonstration, not secure authentication.
- Phone-use detection is not implemented.

## Slide 10 — Future Improvements

- Test the system under more lighting and camera conditions.
- Evaluate and tune thresholds using labeled data.
- Make measurement confidence and unavailable values clearer.
- Improve authentication and persistent data storage.
- Measure performance and validate the system before making safety claims.

## Slide 11 — Conclusion

- MargRakshak AI demonstrates a video-based approach to monitoring possible signs of driver fatigue and distraction.
- It combines browser-based video capture, facial measurements, rule-based event detection, and a reporting dashboard.
- The prototype provides a foundation for further testing and improvement, but should not be used as the sole basis for driving decisions.

**Thank you — Questions?**

## Presentation Tips

- Keep each slide to a few bullets and explain the details verbally.
- Use screenshots from your running application for the features and results slides.
- If asked how the project detects fatigue, explain EAR, PERCLOS, MAR, and head-position thresholds.
- Be clear that the project estimates possible indicators; it does not diagnose fatigue or guarantee road safety.
