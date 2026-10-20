(function () {
  MargApp.renderSidebar("analytics");
  const d = window.MargData;

  new Chart(document.getElementById("drowsy-chart"), {
    type: "line",
    data: {
      labels: d.hourLabels,
      datasets: [{
        label: "Dummy drowsiness score",
        data: d.hourlyDrowsyScore,
        borderColor: "#f4b400",
        backgroundColor: "rgba(244, 180, 0, 0.2)",
        fill: true,
        tension: 0.35,
      }],
    },
    options: {
      plugins: { legend: { labels: { color: "#e8eef4" } } },
      scales: {
        x: { ticks: { color: "#9bb0c3" }, grid: { color: "rgba(255,255,255,0.06)" } },
        y: { ticks: { color: "#9bb0c3" }, grid: { color: "rgba(255,255,255,0.06)" } },
      },
    },
  });

  new Chart(document.getElementById("type-chart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(d.alertTypes),
      datasets: [{
        data: Object.values(d.alertTypes),
        backgroundColor: ["#e74c3c", "#f39c12", "#3498db", "#9b59b6"],
      }],
    },
    options: { plugins: { legend: { labels: { color: "#e8eef4" } } } },
  });

  new Chart(document.getElementById("week-chart"), {
    type: "bar",
    data: {
      labels: d.weekLabels,
      datasets: [{
        label: "Dummy incidents",
        data: d.weeklyIncidents,
        backgroundColor: "#f4b400",
      }],
    },
    options: {
      plugins: { legend: { labels: { color: "#e8eef4" } } },
      scales: {
        x: { ticks: { color: "#9bb0c3" }, grid: { display: false } },
        y: { ticks: { color: "#9bb0c3" }, grid: { color: "rgba(255,255,255,0.06)" } },
      },
    },
  });
})();
