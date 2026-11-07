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
  form.beepEnabled.checked = saved.beepEnabled !== false;
  form.voiceEnabled.checked = saved.voiceEnabled !== false;
  form.visualEnabled.checked = saved.visualEnabled !== false;
  form.alertMode.value = saved.alertMode || "all";

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const next = {
      driverName: form.driverName.value.trim(),
      vehicle: form.vehicle.value.trim(),
      ear: Number(form.ear.value),
      mar: Number(form.mar.value),
      notify: form.notify.checked,
      beepEnabled: form.beepEnabled.checked,
      voiceEnabled: form.voiceEnabled.checked,
      visualEnabled: form.visualEnabled.checked,
      alertMode: form.alertMode.value,
    };
    localStorage.setItem("marg_settings", JSON.stringify(next));
    document.getElementById("save-msg").textContent = "Saved. Alert preferences are now active.";
  });
})();
