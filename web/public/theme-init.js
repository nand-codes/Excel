/* Runs before React mounts so the correct appearance is painted first. */
(function () {
  try {
    var saved = localStorage.getItem('excelDS_theme') || localStorage.getItem('exelDS_theme');
    /* Dark is the designed appearance; light is opt-in through the toggle. */
    if (saved !== 'light') document.documentElement.classList.add('dark');
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();
