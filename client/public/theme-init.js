(function () {
  try {
    var t = localStorage.getItem('uzuz_theme');
    var dark = t ? t === 'dark' : !window.matchMedia('(prefers-color-scheme: light)').matches;
    document.documentElement.classList.toggle('dark', dark);
    var l = localStorage.getItem('uzuz_lang');
    if (l === 'uz' || l === 'ru' || l === 'en') document.documentElement.lang = l;
  } catch (e) {}
})();
