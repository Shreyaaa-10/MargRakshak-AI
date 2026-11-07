(function () {
  MargApp.renderSidebar("analytics");

  const message = document.getElementById("analytics-message");
  const content = document.getElementById("analytics-content");
  const textColor = "#9bb0c3";
  const gridColor = "rgba(255,255,255,0.06)";
  const charts = [];

  function chartOptions(showLegend) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: showLegend,
          labels: { color: "#e8eef4" },
        },
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { beginAtZero: true, ticks: { color: textColor }, grid: { color: gridColor } },
      },
    };
  }

  function showChartEmpty(canvasId, emptyId, text) {
    document.getElementById(canvasId).classList.add("d-none");
    const empty = document.getElementById(emptyId);
    empty.textContent = text;
    empty.classList.remove("d-none");
  }

  function createChart(canvasId, emptyId, config, hasData, emptyText) {
    if (!hasData) {
      showChartEmpty(canvasId, emptyId, emptyText);
      return;
    }
    if (typeof Chart === "undefined") {
      showChartEmpty(canvasId, emptyId, "Charts could not load. Check your connection and refresh.");
      return;
    }
    try {
      charts.push(new Chart(document.getElementById(canvasId), config));
    } catch (error) {
      showChartEmpty(canvasId, emptyId, "This chart could not be displayed.");
      console.error("Could not render analytics chart:", error);
    }
  }

  function resizeCharts() {
    charts.forEach(function (chart) {
      chart.resize();
    });
  }

  function addTimeline(events) {
    const body = document.getElementById("event-timeline");
    body.replaceChildren();

    if (!events.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 5;
      cell.className = "text-secondary py-4 text-center";
      cell.textContent = "No alerts were recorded during this session.";
      return;
    }

    events.forEach(function (event) {
      const row = body.insertRow();
      const values = [
        event.time || "--:--",
        event.type || "Alert",
        event.detail || "No additional details",
        Number(event.duration_seconds) > 0 ? Number(event.duration_seconds) + "s" : "—",
        event.severity || "Unspecified",
      ];
      values.forEach(function (value) {
        row.insertCell().textContent = value;
      });
    });
  }

  function metricHasData(series, key) {
    return series.some(function (point) {
      return Number.isFinite(Number(point[key])) && point[key] !== null;
    });
  }

  function render(analysis) {
    const summary = analysis.summary || {};
    const series = Array.isArray(analysis.series) ? analysis.series : [];
    const events = Array.isArray(analysis.events) ? analysis.events : [];
    const labels = series.map(function (point) { return point.time || ""; });
    content.classList.remove("d-none");
    const risk = String(summary.risk_level || "NO DATA").toUpperCase();
    const riskKey = risk === "SAFE" || risk === "WARNING" || risk === "DANGER"
      ? risk.toLowerCase()
      : "no-data";
    const riskDescription = {
      SAFE: "No sustained indicators were recorded. This is not a guarantee of safety.",
      WARNING: "Attention indicators were recorded. Review the alerts and session conditions.",
      DANGER: "Sustained fatigue or distraction indicators were recorded. Review the timeline.",
      "NO DATA": "There was not enough measurable face data to assess this session.",
    }[risk] || "Session risk could not be determined.";

    document.getElementById("analytics-risk-panel").dataset.level = riskKey;
    document.getElementById("analytics-risk-badge").textContent = risk;
    document.getElementById("analytics-risk-description").textContent = riskDescription;
    document.getElementById("analytics-score").textContent =
      Number.isFinite(summary.safety_score) ? summary.safety_score + "/100" : "Unavailable";
    document.getElementById("analytics-duration").textContent = analysis.session_duration_label || "--";
    document.getElementById("analytics-source").textContent = analysis.analysis_type || "Monitoring session";
    document.getElementById("analytics-filename").textContent = analysis.video_filename || "Unnamed session";
    document.getElementById("analytics-alerts").textContent = events.length;
    const measuredSamples = series.filter(function (point) {
      return ["ear", "mar", "head_pitch", "head_yaw"].some(function (key) {
        return point[key] !== null && Number.isFinite(Number(point[key]));
      });
    }).length;
    document.getElementById("analytics-coverage").textContent =
      measuredSamples + " / " + series.length;
    document.getElementById("analytics-alert-types").textContent =
      new Set(events.map(function (event) { return event.type || "Alert"; })).size;

    const scoreDataAvailable = series.some(function (point) {
      return point.safety_score !== null && Number.isFinite(Number(point.safety_score));
    });
    createChart("drowsy-chart", "score-chart-empty", {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Session score",
          data: series.map(function (point) { return point.safety_score; }),
          borderColor: "#14B8A6",
          backgroundColor: "rgba(20, 184, 166, 0.16)",
          fill: true,
          tension: 0.25,
          spanGaps: false,
        }],
      },
      options: {
        ...chartOptions(false),
        scales: {
          ...chartOptions(false).scales,
          y: { min: 0, max: 100, ticks: { color: textColor }, grid: { color: gridColor } },
        },
      },
    }, scoreDataAvailable, "No score data is available for this session.");

    const eventCounts = events.reduce(function (counts, event) {
      const type = event.type || "Other";
      counts[type] = (counts[type] || 0) + 1;
      return counts;
    }, {});
    const eventTypes = Object.keys(eventCounts);
    createChart("type-chart", "type-chart-empty", {
      type: "doughnut",
      data: {
        labels: eventTypes,
        datasets: [{
          data: eventTypes.map(function (type) { return eventCounts[type]; }),
          backgroundColor: ["#e74c3c", "#f39c12", "#3498db", "#14B8A6", "#9b59b6"],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#e8eef4" } } },
      },
    }, eventTypes.length > 0, "No alerts were recorded.");

    createChart("ear-chart", "ear-chart-empty", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "EAR",
            data: series.map(function (point) { return point.ear; }),
            borderColor: "#38BDF8",
            yAxisID: "y",
            tension: 0.25,
            spanGaps: false,
          },
          {
            label: "PERCLOS (%)",
            data: series.map(function (point) { return point.perclos_percent; }),
            borderColor: "#14B8A6",
            yAxisID: "y1",
            tension: 0.25,
            spanGaps: false,
          },
        ],
      },
      options: {
        ...chartOptions(true),
        scales: {
          ...chartOptions(true).scales,
          y1: {
            position: "right",
            min: 0,
            max: 100,
            ticks: { color: textColor },
            grid: { drawOnChartArea: false },
          },
        },
      },
    }, metricHasData(series, "ear") || metricHasData(series, "perclos_percent"), "Eye measurements are unavailable.");

    createChart("mar-chart", "mar-chart-empty", {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "MAR",
          data: series.map(function (point) { return point.mar; }),
          borderColor: "#f39c12",
          tension: 0.25,
          spanGaps: false,
        }],
      },
      options: chartOptions(true),
    }, metricHasData(series, "mar"), "Mouth measurements are unavailable.");

    createChart("head-chart", "head-chart-empty", {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Pitch (°)",
            data: series.map(function (point) { return point.head_pitch; }),
            borderColor: "#9b59b6",
            tension: 0.25,
            spanGaps: false,
          },
          {
            label: "Yaw (°)",
            data: series.map(function (point) { return point.head_yaw; }),
            borderColor: "#38BDF8",
            tension: 0.25,
            spanGaps: false,
          },
        ],
      },
      options: chartOptions(true),
    }, metricHasData(series, "head_pitch") || metricHasData(series, "head_yaw"), "Head-direction measurements are unavailable.");

    addTimeline(events);
    message.textContent = analysis.notice || "This report shows the latest completed monitoring session.";
    message.classList.toggle("analytics-notice-warning", risk === "NO DATA");
  }

  fetch("/api/latest")
    .then(async function (response) {
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load session analytics.");
      }
      if (!result.analysis) {
        message.textContent = "No saved monitoring session yet. Start the camera or analyze a video from the dashboard.";
        return;
      }
      render(result.analysis);
    })
    .catch(function (error) {
      message.textContent = error.message;
      message.classList.add("analytics-notice-error");
    });

  document.querySelector(".analytics-technical").addEventListener("toggle", function () {
    if (this.open) {
      requestAnimationFrame(resizeCharts);
    }
  });
  window.addEventListener("resize", resizeCharts);
})();
