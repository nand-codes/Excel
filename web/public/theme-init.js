/* Runs before React mounts so the correct appearance is painted first. */
(function () {
  try {
    var saved = localStorage.getItem('excelDS_theme') || localStorage.getItem('exelDS_theme');
    if (!saved) {
      saved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    if (saved === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {
    /* private mode with storage disabled — light appearance is a fine default */
  }
})();
