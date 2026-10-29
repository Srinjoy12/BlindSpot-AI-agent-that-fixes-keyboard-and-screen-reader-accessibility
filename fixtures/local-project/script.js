// Local project script
document.addEventListener("DOMContentLoaded", () => {
  const launchBtn = document.getElementById("launch-btn");
  const settingsBtn = document.getElementById("settings-btn");

  if (launchBtn) {
    launchBtn.addEventListener("click", () => {
      alert("Launching workspace...");
    });
  }

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      console.log("Settings opened");
    });
  }
});
