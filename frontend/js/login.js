(function () {
  const form = document.getElementById("login-form");
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value.trim();
    if (!name || !email || !password) {
      document.getElementById("login-error").textContent = "Fill all fields to continue.";
      return;
    }
    localStorage.setItem("marg_user", JSON.stringify({ name: name, email: email }));
    location.href = "dashboard.html";
  });
})();
