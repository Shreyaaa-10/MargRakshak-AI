(function () {
  MargApp.renderSidebar("settings");
  const form = document.getElementById("settings-form");
  const saved = JSON.parse(localStorage.getItem("marg_settings") || "{}");
  const person = MargApp.user();

  form.driverName.value = saved.driverName || person?.name || "";
  form.vehicle.value = saved.vehicle || window.MargData.driver.vehicle;
  form.ear.value = saved.ear ?? 0.21;
  form.mar.value = saved.mar ?? 0.6;
  form.notify.checked = saved.notify !== false;

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const next = {
      driverName: form.driverName.value.trim(),
      vehicle: form.vehicle.value.trim(),
      ear: Number(form.ear.value),
      mar: Number(form.mar.value),
      notify: form.notify.checked,
    };
    localStorage.setItem("marg_settings", JSON.stringify(next));
    document.getElementById("save-msg").textContent = "Saved in this browser (dummy settings).";
  });
})();
