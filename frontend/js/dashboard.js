(function () {
  MargApp.renderSidebar("dashboard");

  const person = MargApp.user();
  const data = window.MargData;
  const byId = function (id) {
    return document.getElementById(id);
  };

  byId("driver-name").textContent = person?.name || data.driver.name;
  byId("vehicle-id").textContent = data.driver.vehicle;
  byId("shift-info").textContent = data.driver.shift;

  const videoUpload = byId("video-upload");
  const drivingVideo = byId("driving-video");
  const videoPlaceholder = byId("video-placeholder");
  const videoInfo = byId("video-info");
  const videoName = byId("video-name");
  const removeVideo = byId("remove-video");
  const startCamera = byId("start-camera");
  const analyzeVideoButton = byId("analyze-video");
  const toggleVideoPlaybackButton = byId("toggle-video-playback");
  const forwardVideoButton = byId("forward-video");
  const stopVideoAnalysisButton = byId("stop-video-analysis");
  const uploadLabel = document.querySelector('label[for="video-upload"]');
  const message = byId("analysis-message");
  const acknowledgeBtn = byId("acknowledge-alert");
  let uploadedVideoUrl = null;
  let uploadNumber = 0;
  let cameraStream = null;
  let cameraStartedAt = null;
  let cameraTimer = null;
  let frameTimer = null;
  let processingFrame = false;
  let monitoringSource = null;
  let lastStatus = "SAFE";
  let candidateStatus = null;
  let candidateStatusCount = 0;
  let acknowledgedStatus = null;
  let liveAlertCount = 0;
  let liveEyeWindow = [];
  let liveEvents = [];
  let liveSamples = [];
  let audioContext = null;

  function setMessage(text, isError) {
    message.textContent = text;
    message.classList.toggle("text-danger", Boolean(isError));
    message.classList.toggle("text-secondary", !isError);
  }

  function riskRank(level) {
    return { SAFE: 0, WARNING: 1, DANGER: 2 }[level] ?? 0;
  }

  function readAlertSettings() {
    try {
      return {
        beepEnabled: true,
        voiceEnabled: true,
        visualEnabled: true,
        alertMode: "all",
        ...JSON.parse(localStorage.getItem("marg_settings") || "{}"),
      };
    } catch (error) {
      return { beepEnabled: true, voiceEnabled: true, visualEnabled: true, alertMode: "all" };
    }
  }

  function setStatusTone(level, reasonText) {
    const tone = (level || "safe").toLowerCase();
    const toneClass = { safe: "status-safe", warning: "status-warn", danger: "status-danger" }[tone] || "status-safe";
    byId("status-hero").dataset.level = tone;
    byId("status-chip").textContent = level.toUpperCase();
    byId("status-level").textContent = level.toUpperCase();
    byId("status-level").className = "status-level " + toneClass;
    byId("live-status").textContent = reasonText || "Monitoring active";
    if (reasonText) {
      setMessage(reasonText, level === "DANGER");
    }
  }

  function playBeep(freq, durationMs, volume) {
    const settings = readAlertSettings();
    if (!settings.beepEnabled || settings.alertMode === "voice-only" || settings.alertMode === "visual-only") {
      return;
    }

    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioContext) {
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = freq;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000);
  }

  function speakAlert(messageText) {
    const settings = readAlertSettings();
    if (!settings.voiceEnabled || settings.alertMode === "beep-only" || settings.alertMode === "visual-only") {
      return;
    }
    if (!("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(messageText);
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function prepareAlertAudio() {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioContext) {
      audioContext = new AudioCtor();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(function (error) {
        setMessage("Audio alerts are unavailable: " + error.message, true);
      });
    }
  }

  function triggerAlert(level, reasonText) {
    if (level === lastStatus) return;

    const settings = readAlertSettings();
    if (settings.visualEnabled) {
      setStatusTone(level, reasonText);
    }
    if (level === "DANGER" && acknowledgedStatus !== level) {
      if (settings.alertMode === "voice-only") {
        speakAlert("DANGER! Driver fatigue detected. Please stay alert and stop at a safe location immediately.");
      } else if (settings.alertMode === "beep-only") {
        playBeep(950, 220, 0.08);
        playBeep(700, 180, 0.08);
      } else {
        playBeep(950, 220, 0.08);
        playBeep(700, 180, 0.08);
        speakAlert("DANGER! Driver fatigue detected. Please stay alert and stop at a safe location immediately.");
      }
    } else if (level === "WARNING" && acknowledgedStatus !== level) {
      if (settings.alertMode === "voice-only") {
        speakAlert("Attention! Please stay alert.");
      } else if (settings.alertMode === "beep-only") {
        playBeep(620, 180, 0.04);
      } else {
        playBeep(620, 180, 0.04);
        speakAlert("Attention! Please stay alert.");
      }
    }
    lastStatus = level;
    if (level === "SAFE") {
      acknowledgedStatus = null;
    }
  }

  function applyMonitoringResult(result) {
    const metrics = result.metrics || {};
    const reportedLevel = (result.status || "SAFE").toUpperCase();
    const normalizedLevel = reportedLevel === "NO FACE" ? "WARNING" : reportedLevel;
    const reason = result.reason || "Monitoring active";

    if (normalizedLevel === candidateStatus) {
      candidateStatusCount += 1;
    } else {
      candidateStatus = normalizedLevel;
      candidateStatusCount = 1;
    }

    if (monitoringSource === "camera" && cameraStartedAt) {
      const seconds = Math.floor((Date.now() - cameraStartedAt) / 1000);
      const sample = {
        seconds: seconds,
        ear: metrics.ear == null ? null : Number(metrics.ear),
        mar: metrics.mar == null ? null : Number(metrics.mar),
        head_pitch: metrics.head_pitch == null ? null : Number(metrics.head_pitch),
        head_yaw: metrics.head_yaw == null ? null : Number(metrics.head_yaw),
      };
      const lastSample = liveSamples[liveSamples.length - 1];
      if (lastSample && lastSample.seconds === seconds) {
        liveSamples[liveSamples.length - 1] = sample;
      } else if (!lastSample || lastSample.seconds < seconds) {
        liveSamples.push(sample);
      }
    }

    byId("ear-value").textContent = metrics.ear == null ? "--" : Number(metrics.ear).toFixed(3);
    byId("mar-value").textContent = metrics.mar == null ? "--" : Number(metrics.mar).toFixed(3);
    byId("pitch-value").textContent = metrics.head_pitch == null ? "--°" : Number(metrics.head_pitch).toFixed(1) + "°";
    byId("ear-bar").style.width = metrics.ear == null ? "0%" : Math.min(Number(metrics.ear) / 0.4 * 100, 100) + "%";
    byId("mar-bar").style.width = metrics.mar == null ? "0%" : Math.min(Number(metrics.mar) / 0.8 * 100, 100) + "%";
    byId("pitch-bar").style.width = metrics.head_pitch == null
      ? "0%"
      : Math.min(Math.abs(Number(metrics.head_pitch)) / 35 * 100, 100) + "%";
    if (metrics.ear != null) {
      liveEyeWindow.push(Number(metrics.ear) <= 0.21 ? 1 : 0);
      if (liveEyeWindow.length > 30) {
        liveEyeWindow.shift();
      }
    }
    const perclos = liveEyeWindow.length
      ? liveEyeWindow.reduce(function (total, closed) { return total + closed; }, 0) / liveEyeWindow.length * 100
      : null;
    byId("perclos-value").textContent = perclos == null ? "--%" : perclos.toFixed(1) + "%";
    byId("yaw-value").textContent = metrics.head_yaw == null ? "--°" : Number(metrics.head_yaw).toFixed(1) + "°";

    const confirmedLevel = candidateStatusCount >= (normalizedLevel === "DANGER" ? 2 : 3)
      ? normalizedLevel
      : lastStatus;
    const displayLevel = reportedLevel === "NO FACE" ? "WARNING" : confirmedLevel;
    const displayReason = reportedLevel === "NO FACE"
      ? reason
      : (confirmedLevel === normalizedLevel ? reason : "Checking sustained driver condition…");
    setStatusTone(displayLevel, displayReason);

    if (confirmedLevel !== lastStatus) {
      if (confirmedLevel !== "SAFE") {
        liveAlertCount += 1;
        const alertSeconds = monitoringSource === "recorded"
          ? Math.floor(drivingVideo.currentTime)
          : Math.floor((Date.now() - cameraStartedAt) / 1000);
        liveEvents.unshift({
          type: confirmedLevel === "DANGER" ? "Drowsiness" : "Attention",
          detail: reason,
          time: formatElapsed(alertSeconds),
          seconds: alertSeconds,
        });
        renderAlerts(liveEvents);
      }
      triggerAlert(confirmedLevel, reason);
    }

    byId("safety-score").textContent = reportedLevel === "NO FACE"
      ? "--"
      : (metrics.safety_score == null ? Math.max(0, 100 - liveAlertCount * 20) : metrics.safety_score);
    byId("total-alerts").textContent = metrics.total_alerts == null ? liveAlertCount : metrics.total_alerts;
  }

  function renderAlerts(events) {
    const list = byId("recent-alerts");
    list.replaceChildren();

    events.slice(0, 5).forEach(function (event) {
      const item = document.createElement("li");
      item.className = "recent-alert d-flex justify-content-between py-2 gap-3";

      const detail = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = event.type;
      detail.append(title, document.createTextNode(" · " + event.detail));

      const time = document.createElement("span");
      time.className = "text-secondary text-nowrap";
      time.textContent = event.time;
      item.append(detail, time);
      list.append(item);
    });

    if (!events.length) {
      const item = document.createElement("li");
      item.className = "text-secondary";
      item.textContent = "No alerts detected in this session.";
      list.append(item);
    }
  }

  function renderAnalysis(analysis) {
    const summary = analysis.summary;
    const tone = summary.risk_level.toLowerCase();
    const toneClass = { safe: "status-safe", warning: "status-warn", danger: "status-danger", "no data": "status-warn" }[tone];

    byId("status-hero").dataset.level = tone;
    byId("status-chip").textContent = summary.risk_level;
    byId("status-level").textContent = summary.risk_level;
    byId("status-level").className = "status-level " + toneClass;
    byId("live-status").textContent = summary.total_alerts + " alert(s) detected in this session";
    byId("safety-score").textContent = summary.safety_score == null ? "--" : summary.safety_score;
    byId("total-alerts").textContent = summary.total_alerts;
    byId("ear-value").textContent = summary.ear == null ? "--" : summary.ear.toFixed(3);
    byId("mar-value").textContent = summary.mar == null ? "--" : summary.mar.toFixed(3);
    byId("pitch-value").textContent = summary.head_pitch == null ? "--°" : summary.head_pitch.toFixed(1) + "°";
    byId("perclos-value").textContent = summary.perclos_percent == null ? "--%" : summary.perclos_percent.toFixed(1) + "%";
    byId("yaw-value").textContent = summary.head_yaw == null ? "--°" : summary.head_yaw.toFixed(1) + "°";
    byId("drowsiness-count").textContent = summary.drowsiness_count;
    byId("yawn-count").textContent = summary.yawn_count;
    byId("distraction-count").textContent = summary.distraction_count;
    byId("eye-closure-duration").textContent = summary.max_eye_closure_seconds;
    byId("yawn-duration").textContent = summary.max_yawn_seconds;
    byId("head-deviation-duration").textContent = summary.max_head_deviation_seconds;
    byId("session-mins").textContent = analysis.session_duration_label;

    byId("ear-bar").style.width = summary.ear == null ? "0%" : Math.min(summary.ear / 0.4 * 100, 100) + "%";
    byId("mar-bar").style.width = summary.mar == null ? "0%" : Math.min(summary.mar / 0.8 * 100, 100) + "%";
    byId("pitch-bar").style.width =
      summary.head_pitch == null ? "0%" : Math.min(Math.abs(summary.head_pitch) / 35 * 100, 100) + "%";

    setMessage(analysis.analysis_type + ": " + analysis.notice, false);
    renderAlerts(analysis.events);
  }

  async function loadLatest() {
    try {
      const response = await fetch("/api/latest");
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load the latest analysis.");
      }

      if (result.analysis) {
        renderAnalysis(result.analysis);
      } else {
        setMessage("Start camera monitoring or upload a video to create session analytics.", false);
        renderAlerts([]);
      }
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  async function uploadVideo(file, durationSeconds, currentUpload) {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("duration_seconds", String(durationSeconds));
    setMessage("Uploading video and generating driver analysis…", false);
    videoUpload.disabled = true;
    removeVideo.disabled = true;

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "The video could not be analyzed.");
      }
      if (currentUpload === uploadNumber) {
        renderAnalysis(result.analysis);
        if (riskRank(result.analysis.summary.risk_level) > riskRank(lastStatus)) {
          triggerAlert(
            result.analysis.summary.risk_level,
            "Recorded video: " + result.analysis.summary.risk_level.toLowerCase() + " risk detected."
          );
        }
      }
    } finally {
      if (currentUpload === uploadNumber) {
        videoUpload.disabled = false;
        removeVideo.disabled = false;
      }
    }
  }

  function formatElapsed(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  async function processLiveFrame() {
    if (!monitoringSource || !drivingVideo.videoWidth || processingFrame) return;
    if (monitoringSource === "recorded" && drivingVideo.paused) {
      return;
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / drivingVideo.videoWidth);
    canvas.width = Math.round(drivingVideo.videoWidth * scale);
    canvas.height = Math.round(drivingVideo.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setMessage("Could not prepare a video frame for analysis.", true);
      return;
    }
    context.drawImage(drivingVideo, 0, 0, canvas.width, canvas.height);

    const payload = { image: canvas.toDataURL("image/jpeg", 0.8) };
    processingFrame = true;
    try {
      const response = await fetch("/api/live-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseText = await response.text();
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error("The server returned an unexpected response (" + response.status + "). Check the Flask terminal for details.");
      }
      if (!response.ok) {
        throw new Error(result.error || "Live monitoring failed.");
      }

      if (!monitoringSource) return;
      applyMonitoringResult(result);
    } catch (error) {
      setMessage(error.message, true);
    } finally {
      processingFrame = false;
      if (monitoringSource && (monitoringSource !== "recorded" || !drivingVideo.paused)) {
        frameTimer = setTimeout(processLiveFrame, monitoringSource === "recorded" ? 700 : 1200);
      }
    }
  }

  function updateVideoPlaybackControls() {
    toggleVideoPlaybackButton.textContent = drivingVideo.paused ? "Play Video" : "Pause Video";
  }

  function stopRecordedAnalysis(messageText) {
    if (frameTimer) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
    monitoringSource = null;
    drivingVideo.pause();
    drivingVideo.controls = true;
    if (cameraTimer) {
      clearInterval(cameraTimer);
      cameraTimer = null;
    }
    analyzeVideoButton.disabled = !videoUpload.files[0];
    toggleVideoPlaybackButton.disabled = !videoUpload.files[0];
    forwardVideoButton.disabled = !videoUpload.files[0];
    stopVideoAnalysisButton.disabled = true;
    startCamera.disabled = false;
    videoUpload.disabled = false;
    removeVideo.disabled = false;
    uploadLabel.classList.remove("disabled");
    uploadLabel.removeAttribute("aria-disabled");
    updateVideoPlaybackControls();
    setMessage(messageText, false);
  }

  function stopCameraPreview() {
    if (frameTimer) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
    monitoringSource = null;
    processingFrame = false;
    if (cameraTimer) {
      clearInterval(cameraTimer);
      cameraTimer = null;
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(function (track) {
        track.stop();
      });
      cameraStream = null;
    }

    drivingVideo.pause();
    drivingVideo.srcObject = null;
    drivingVideo.classList.add("d-none");
    videoPlaceholder.classList.remove("d-none");
    startCamera.textContent = "Start Camera";
    videoUpload.disabled = false;
    uploadLabel.classList.remove("disabled");
    uploadLabel.removeAttribute("aria-disabled");
  }

  async function stopCamera() {
    const durationSeconds = cameraStartedAt
      ? Math.max(1, Math.ceil((Date.now() - cameraStartedAt) / 1000))
      : 0;
    const samples = liveSamples.slice();
    stopCameraPreview();
    if (!samples.length || !durationSeconds) {
      setMessage("Camera monitoring stopped.", false);
      return;
    }

    setMessage("Camera monitoring stopped. Saving session analytics…", false);
    try {
      const response = await fetch("/api/save-live-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_seconds: durationSeconds,
          samples: samples,
          alerts: liveEvents,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not save camera-session analytics.");
      }
      renderAnalysis(result.analysis);
    } catch (error) {
      setMessage(error.message, true);
    }
  }

  acknowledgeBtn.addEventListener("click", function () {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (audioContext) {
      audioContext.suspend();
    }
    acknowledgedStatus = lastStatus;
    setMessage("Alert acknowledged. Monitoring remains active.", false);
  });

  drivingVideo.addEventListener("play", function () {
    updateVideoPlaybackControls();
    if (monitoringSource === "recorded") {
      processLiveFrame();
    }
  });

  drivingVideo.addEventListener("pause", updateVideoPlaybackControls);
  drivingVideo.addEventListener("seeked", function () {
    if (monitoringSource === "recorded" && !drivingVideo.paused) {
      processLiveFrame();
    }
  });

  toggleVideoPlaybackButton.addEventListener("click", async function () {
    if (drivingVideo.paused) {
      try {
        await drivingVideo.play();
      } catch (error) {
        setMessage("Could not play the selected video: " + error.message, true);
      }
    } else {
      drivingVideo.pause();
    }
  });

  forwardVideoButton.addEventListener("click", function () {
    if (!Number.isFinite(drivingVideo.duration)) return;
    drivingVideo.currentTime = Math.min(drivingVideo.currentTime + 10, drivingVideo.duration);
  });

  stopVideoAnalysisButton.addEventListener("click", function () {
    stopRecordedAnalysis("Recorded-video monitoring stopped. No report was saved.");
  });

  startCamera.addEventListener("click", async function () {
    if (cameraStream) {
      stopCamera();
      return;
    }

    prepareAlertAudio();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMessage("Camera access requires localhost or a secure HTTPS connection in a supported browser.", true);
      return;
    }

    try {
      if (uploadedVideoUrl) {
        URL.revokeObjectURL(uploadedVideoUrl);
        uploadedVideoUrl = null;
      }
      drivingVideo.pause();
      drivingVideo.removeAttribute("src");
      drivingVideo.load();
      videoInfo.classList.add("d-none");
      videoUpload.value = "";

      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      monitoringSource = "camera";
      drivingVideo.srcObject = cameraStream;
      drivingVideo.muted = true;
      drivingVideo.classList.remove("d-none");
      videoPlaceholder.classList.add("d-none");
      await drivingVideo.play();

      cameraStartedAt = Date.now();
      startCamera.textContent = "Stop Camera";
      videoUpload.disabled = true;
      uploadLabel.classList.add("disabled");
      uploadLabel.setAttribute("aria-disabled", "true");
      setMessage("Camera preview is live. Driver status is continuously monitored.", false);

      cameraTimer = setInterval(function () {
        const elapsed = Math.floor((Date.now() - cameraStartedAt) / 1000);
        byId("session-mins").textContent = formatElapsed(elapsed);
        startCamera.textContent = "Stop Camera (" + formatElapsed(elapsed) + ")";
      }, 1000);

      candidateStatus = null;
      candidateStatusCount = 0;
      liveEyeWindow = [];
      liveAlertCount = 0;
      liveEvents = [];
      liveSamples = [];
      renderAlerts(liveEvents);
      lastStatus = "SAFE";
      processLiveFrame();
    } catch (error) {
      stopCameraPreview();
      setMessage(
        error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access in your browser and try again."
          : "Could not start the camera: " + error.message,
        true
      );
    }
  });

  videoUpload.addEventListener("change", function () {
    const file = this.files[0];
    if (!file) return;

    if (!/\.(mp4|avi|webm|mov)$/i.test(file.name)) {
      setMessage("Choose a supported MP4, AVI, WebM, or MOV file.", true);
      this.value = "";
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      setMessage("The video is too large. Maximum upload size is 250 MB.", true);
      this.value = "";
      return;
    }

    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = URL.createObjectURL(file);
    const currentUpload = ++uploadNumber;
    analyzeVideoButton.disabled = true;
    toggleVideoPlaybackButton.disabled = true;
    forwardVideoButton.disabled = true;
    drivingVideo.src = uploadedVideoUrl;
    drivingVideo.classList.remove("d-none");
    videoPlaceholder.classList.add("d-none");
    videoInfo.classList.remove("d-none");
    videoName.textContent = file.name;
    drivingVideo.addEventListener("loadedmetadata", function () {
      if (currentUpload !== uploadNumber) return;
      if (!Number.isFinite(drivingVideo.duration) || drivingVideo.duration <= 0) {
        setMessage("Could not read the video duration. Try another video.", true);
        return;
      }
      analyzeVideoButton.disabled = false;
      toggleVideoPlaybackButton.disabled = false;
      forwardVideoButton.disabled = false;
      updateVideoPlaybackControls();
      setMessage("Video ready. Select Analyze Video to monitor its playback and raise alerts.", false);
    }, { once: true });

    drivingVideo.addEventListener("error", function () {
      if (currentUpload === uploadNumber) {
        setMessage("The video preview could not be loaded. Try an MP4, WebM, or MOV file.", true);
      }
    }, { once: true });
    drivingVideo.load();
  });

  analyzeVideoButton.addEventListener("click", async function () {
    prepareAlertAudio();
    const file = videoUpload.files[0];
    if (!file || !Number.isFinite(drivingVideo.duration) || drivingVideo.duration <= 0) {
      setMessage("Select a readable driving video before analysis.", true);
      return;
    }

    const currentUpload = uploadNumber;
    analyzeVideoButton.disabled = true;
    startCamera.disabled = true;
    stopVideoAnalysisButton.disabled = false;
    toggleVideoPlaybackButton.disabled = false;
    forwardVideoButton.disabled = false;
    videoUpload.disabled = true;
    removeVideo.disabled = true;
    uploadLabel.classList.add("disabled");
    uploadLabel.setAttribute("aria-disabled", "true");
    drivingVideo.currentTime = 0;
    drivingVideo.controls = true;
    monitoringSource = "recorded";
    candidateStatus = null;
    candidateStatusCount = 0;
    liveEyeWindow = [];
    liveAlertCount = 0;
    liveEvents = [];
    lastStatus = "SAFE";
    renderAlerts(liveEvents);
    byId("session-mins").textContent = "00:00";
    setMessage("Analyzing recorded video playback. Metrics and risk update as frames are checked.", false);
    try {
      await drivingVideo.play();
      cameraTimer = setInterval(function () {
        byId("session-mins").textContent = formatElapsed(Math.floor(drivingVideo.currentTime));
      }, 1000);
    } catch (error) {
      monitoringSource = null;
      stopVideoAnalysisButton.disabled = true;
      analyzeVideoButton.disabled = false;
      startCamera.disabled = false;
      videoUpload.disabled = false;
      removeVideo.disabled = false;
      uploadLabel.classList.remove("disabled");
      uploadLabel.removeAttribute("aria-disabled");
      drivingVideo.controls = true;
      updateVideoPlaybackControls();
      setMessage("Could not play the selected video: " + error.message, true);
      return;
    }

    drivingVideo.addEventListener("ended", async function () {
      if (currentUpload !== uploadNumber) return;
      if (frameTimer) {
        clearTimeout(frameTimer);
        frameTimer = null;
      }
      monitoringSource = null;
      stopVideoAnalysisButton.disabled = true;
      if (cameraTimer) {
        clearInterval(cameraTimer);
        cameraTimer = null;
      }
      drivingVideo.controls = true;
      setMessage("Playback monitoring complete. Saving the session report…", false);
      try {
        await uploadVideo(file, drivingVideo.duration, currentUpload);
      } catch (error) {
        setMessage(error.message, true);
      } finally {
        analyzeVideoButton.disabled = false;
        startCamera.disabled = false;
        videoUpload.disabled = false;
        removeVideo.disabled = false;
        uploadLabel.classList.remove("disabled");
        uploadLabel.removeAttribute("aria-disabled");
        updateVideoPlaybackControls();
      }
    }, { once: true });
  });

  removeVideo.addEventListener("click", function () {
    uploadNumber += 1;
    monitoringSource = null;
    if (frameTimer) {
      clearTimeout(frameTimer);
      frameTimer = null;
    }
    if (cameraTimer) {
      clearInterval(cameraTimer);
      cameraTimer = null;
    }
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
      uploadedVideoUrl = null;
    }
    drivingVideo.pause();
    drivingVideo.removeAttribute("src");
    drivingVideo.load();
    drivingVideo.classList.add("d-none");
    videoInfo.classList.add("d-none");
    videoPlaceholder.classList.remove("d-none");
    videoUpload.value = "";
    analyzeVideoButton.disabled = true;
    toggleVideoPlaybackButton.disabled = true;
    forwardVideoButton.disabled = true;
    stopVideoAnalysisButton.disabled = true;
    videoUpload.disabled = false;
    removeVideo.disabled = false;
    startCamera.disabled = false;
    uploadLabel.classList.remove("disabled");
    uploadLabel.removeAttribute("aria-disabled");
    setMessage("Video preview removed. The saved analysis remains available.", false);
  });

  loadLatest();
})();
