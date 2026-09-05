// Use one tab-icon candidate so a fixed-size ICO cannot outrank the SVG.
// Separate files also avoid relying on SVG media queries in favicon caches.
(function () {
  var icon = document.getElementById('site-favicon');
  if (!icon || !window.matchMedia) return;
  var theme = window.matchMedia('(prefers-color-scheme: dark)');
  function updateIcon() {
    icon.href = theme.matches ? '/favicon-dark.svg?v=3' : '/favicon-light.svg?v=3';
  }
  updateIcon();
  if (theme.addEventListener) theme.addEventListener('change', updateIcon);
  else if (theme.addListener) theme.addListener(updateIcon);
})();
