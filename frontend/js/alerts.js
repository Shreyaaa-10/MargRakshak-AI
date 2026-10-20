(function () {
  MargApp.renderSidebar("alerts");

  const tbody = document.getElementById("alerts-body");
  const filter = document.getElementById("type-filter");

  function severityBadge(level) {
    const map = { High: "danger", Medium: "warning", Low: "secondary" };
    return `<span class="badge text-bg-${map[level] || "secondary"}">${level}</span>`;
  }

  function render(type) {
    const rows = window.MargData.alerts.filter(function (a) {
      return type === "all" || a.type === type;
    });
    tbody.innerHTML = rows.map(function (a) {
      return `<tr>
        <td>${a.id}</td>
        <td>${a.time}</td>
        <td>${a.type}</td>
        <td>${a.detail}</td>
        <td>${severityBadge(a.severity)}</td>
        <td>${a.status}</td>
      </tr>`;
    }).join("");
  }

  filter.addEventListener("change", function () {
    render(filter.value);
  });
  render("all");
})();
