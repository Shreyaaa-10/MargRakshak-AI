(function () {
  MargApp.renderSidebar("alerts");

  const tbody = document.getElementById("alerts-body");
  const filter = document.getElementById("type-filter");
  let allEvents = [];

  function severityBadge(level) {
    const map = { High: "danger", Medium: "warning", Low: "secondary" };
    const badge = document.createElement("span");
    badge.className = "badge text-bg-" + (map[level] || "secondary");
    badge.textContent = level;
    return badge;
  }

  function render(type) {
    tbody.replaceChildren();
    const events = allEvents.filter(function (event) {
      return type === "all" || event.type === type;
    });

    events.forEach(function (event) {
      const row = tbody.insertRow();
      row.insertCell().textContent = event.id + " · " + event.session_id.slice(0, 8);
      row.insertCell().textContent = event.time;
      row.insertCell().textContent = event.type;
      row.insertCell().textContent =
        event.detail + " · " + event.video_filename + " · " + event.session_date;
      row.insertCell().append(severityBadge(event.severity));
      row.insertCell().textContent = event.status;
    });

    if (!events.length) {
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.className = "text-secondary";
      cell.textContent = allEvents.length
        ? "No events match this filter."
        : "No saved monitoring sessions yet. Start the camera or analyze a video from the dashboard.";
    }
  }

  filter.addEventListener("change", function () {
    render(filter.value);
  });

  fetch("/api/history")
    .then(async function (response) {
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not load alert history.");
      }

      allEvents = result.sessions.flatMap(function (session) {
        return session.events.map(function (event) {
          return {
            ...event,
            session_id: session.session_id,
            video_filename: session.video_filename,
            session_date: new Date(session.created_at).toLocaleString(),
          };
        });
      });
      render(filter.value);
    })
    .catch(function (error) {
      tbody.replaceChildren();
      const row = tbody.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 6;
      cell.className = "text-danger";
      cell.textContent = error.message;
    });
})();
