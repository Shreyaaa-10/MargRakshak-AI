(function () {
  const publicPages = ["index.html", "login.html", "about.html", ""];

  function currentFile() {
    const parts = location.pathname.split("/");
    return parts[parts.length - 1];
  }

  function isLoggedIn() {
    try {
      return Boolean(JSON.parse(localStorage.getItem("marg_user") || "null"));
    } catch (err) {
      return false;
    }
  }

  function requireAuth() {
    const file = currentFile();
    if (publicPages.includes(file)) return;
    if (!isLoggedIn()) location.href = "login.html";
  }

  function user() {
    try {
      return JSON.parse(localStorage.getItem("marg_user") || "null");
    } catch (err) {
      return null;
    }
  }

  function renderSidebar(active) {
    const host = document.querySelector("[data-sidebar]");
    if (!host) return;
    const person = user();
    const name = person?.name || window.MargData.driver.name;

    host.innerHTML = `
      <aside class="app-sidebar">
        <div class="d-flex align-items-center gap-2 mb-4">
          <div class="brand-mark">MR</div>
          <div>
            <div class="brand-title h5 mb-0">MargRakshak</div>
            <small class="text-secondary">AI Monitor</small>
          </div>
        </div>
        <nav class="d-grid gap-1">
          <a class="${active === "dashboard" ? "active" : ""}" href="dashboard.html">Live dashboard</a>
          <a class="${active === "alerts" ? "active" : ""}" href="alerts.html">Alert history</a>
          <a class="${active === "analytics" ? "active" : ""}" href="analytics.html">Analytics</a>
          <a class="${active === "settings" ? "active" : ""}" href="settings.html">Settings</a>
          <a class="${active === "about" ? "active" : ""}" href="about.html">About system</a>
        </nav>
        <div class="mt-auto pt-4">
          <p class="small text-secondary mb-1">Signed in as</p>
          <p class="mb-3">${name}</p>
          <button class="btn btn-outline-light btn-sm w-100" id="logout-btn" type="button">Log out</button>
        </div>
      </aside>
    `;

    host.querySelector("#logout-btn")?.addEventListener("click", function () {
      localStorage.removeItem("marg_user");
      location.href = "login.html";
    });
  }

  requireAuth();
  window.MargApp = { user, renderSidebar, isLoggedIn };
})();
