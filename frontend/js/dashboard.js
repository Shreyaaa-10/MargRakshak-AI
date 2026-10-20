(function () {
  MargApp.renderSidebar("dashboard");

  const person = MargApp.user();
  const data = window.MargData;

  document.getElementById("driver-name").textContent =
    person?.name || data.driver.name;

  document.getElementById("vehicle-id").textContent =
    data.driver.vehicle;

  document.getElementById("shift-info").textContent =
    data.driver.shift;

  // -----------------------------
  // Dummy safety data
  // -----------------------------

  const states = [
    {
      key: "ALERT",
      level: "SAFE",
      detail: "Driver alert",
      tone: "safe",
      ear: 0.29,
      mar: 0.16,
      pitch: 3
    },
    {
      key: "YAWN",
      level: "WARNING",
      detail: "Yawn detected (dummy)",
      tone: "warning",
      ear: 0.26,
      mar: 0.62,
      pitch: 6
    },
    {
      key: "DROWSY",
      level: "DANGER",
      detail: "Possible drowsiness (dummy)",
      tone: "danger",
      ear: 0.14,
      mar: 0.22,
      pitch: 18
    },
    {
      key: "ALERT",
      level: "SAFE",
      detail: "Driver alert",
      tone: "safe",
      ear: 0.31,
      mar: 0.17,
      pitch: 2
    }
  ];

  let i = 0;
  let minutes = data.live.sessionMinutes;

  function paint() {
    const s = states[i % states.length];

    const toneClass = {
      safe: "status-safe",
      warning: "status-warn",
      danger: "status-danger"
    }[s.tone];

    document.getElementById("status-hero").dataset.level = s.tone;

    document.getElementById("status-chip").textContent = s.level;

    const levelEl = document.getElementById("status-level");
    levelEl.textContent = s.level;
    levelEl.className = "status-level " + toneClass;

    document.getElementById("live-status").textContent = s.detail;

    document.getElementById("ear-value").textContent =
      s.ear.toFixed(2);

    document.getElementById("mar-value").textContent =
      s.mar.toFixed(2);

    document.getElementById("pitch-value").textContent =
      s.pitch + "°";

    document.getElementById("ear-bar").style.width =
      Math.min((s.ear / 0.4) * 100, 100) + "%";

    document.getElementById("mar-bar").style.width =
      Math.min((s.mar / 0.8) * 100, 100) + "%";

    document.getElementById("pitch-bar").style.width =
      Math.min((s.pitch / 30) * 100, 100) + "%";

    document.getElementById("session-mins").textContent =
      minutes + " min";
  }

  paint();

  setInterval(function () {
    i += 1;
    minutes += 1;
    paint();
  }, 2500);

  // -----------------------------
  // Recent alerts
  // -----------------------------

  const list = document.getElementById("recent-alerts");

  list.innerHTML = data.alerts
    .slice(0, 4)
    .map(function (a) {
      return `
        <li class="recent-alert d-flex justify-content-between py-2">
          <span>
            <strong>${a.type}</strong> · ${a.detail}
          </span>

          <span class="text-secondary">
            ${a.time}
          </span>
        </li>
      `;
    })
    .join("");


  // ==========================================
  // DRIVING VIDEO UPLOAD
  // ==========================================

  const videoUpload = document.getElementById("video-upload");
  const drivingVideo = document.getElementById("driving-video");
  const videoPlaceholder = document.getElementById("video-placeholder");
  const videoInfo = document.getElementById("video-info");
  const videoName = document.getElementById("video-name");
  const removeVideo = document.getElementById("remove-video");

  let uploadedVideoUrl = null;


  // When user selects a video
  videoUpload.addEventListener("change", function () {

    const file = this.files[0];

    if (!file) {
      return;
    }

    console.log("Selected video:", file.name);
    console.log("Video type:", file.type);


    // Check if it is a video
    if (!file.type.startsWith("video/")) {

      alert("Please select a valid video file.");

      this.value = "";

      return;
    }


    // Remove previous video URL
    if (uploadedVideoUrl) {
      URL.revokeObjectURL(uploadedVideoUrl);
    }


    // Create temporary URL
    uploadedVideoUrl = URL.createObjectURL(file);


    // Put video into video element
    drivingVideo.src = uploadedVideoUrl;

    drivingVideo.classList.remove("d-none");

    videoPlaceholder.classList.add("d-none");

    videoInfo.classList.remove("d-none");

    videoName.textContent = file.name;


    // Load video
    drivingVideo.load();


    console.log("Video URL created:", uploadedVideoUrl);


    // Video successfully loaded
    drivingVideo.addEventListener(
      "loadeddata",
      function () {

        console.log("Video loaded successfully.");

      },
      { once: true }
    );


    // Video loading error
    drivingVideo.addEventListener(
      "error",
      function () {

        console.error(
          "Video could not be played:",
          drivingVideo.error
        );

        alert(
          "The video could not be played. Please try another MP4 video."
        );

      },
      { once: true }
    );

  });


  // ==========================================
  // REMOVE VIDEO
  // ==========================================

  removeVideo.addEventListener("click", function () {

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

  });

})();