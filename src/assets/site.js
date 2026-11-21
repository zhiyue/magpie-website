// Opens the page in the visitor's language on a first visit, and remembers a choice made in
// the language menu. It runs before the page is drawn, so nobody sees the wrong language flash by.
(function () {
  var root = document.documentElement;
  var pages = JSON.parse(root.dataset.pages);
  var KEY = "magpie-language";
  var read = function () {
    try {
      return localStorage.getItem(KEY);
    } catch (error) {
      return null;
    }
  };
  // "zh-TW" opens the Chinese page and "en-GB" the English one.
  var match = function (tag) {
    var codes = Object.keys(pages);
    var wanted = String(tag).toLowerCase();
    return (
      codes.find(function (code) {
        return code.toLowerCase() === wanted;
      }) ||
      codes.find(function (code) {
        return code.toLowerCase().split("-")[0] === wanted.split("-")[0];
      })
    );
  };
  // Only the page without a language in its address moves the visitor: a link to a
  // particular language always shows that language.
  if (root.hasAttribute("data-default")) {
    var chosen = read();
    var preferred =
      (chosen && pages[chosen] !== undefined && chosen) ||
      (navigator.languages || [navigator.language]).map(match).find(Boolean);
    if (preferred && preferred !== root.lang)
      location.replace(pages[preferred] + location.search + location.hash);
  }
  document.addEventListener("click", function (event) {
    var link = event.target.closest && event.target.closest("a[data-lang]");
    if (!link) return;
    try {
      localStorage.setItem(KEY, link.dataset.lang);
    } catch (error) {
      // Private browsing: the choice simply is not remembered.
    }
  });
})();
