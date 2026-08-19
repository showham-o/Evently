/*!
 * Accessibility Widget — vanilla JS, framework-agnostic
 * Israeli Web Accessibility Standard (TI 5568 / WCAG 2.1 AA)
 *
 * Integration: include accessibility-widget.css and this file on any page.
 *   <link rel="stylesheet" href="accessibility-widget.css">
 *   <script src="accessibility-widget.js" defer></script>
 * The widget builds its own DOM, wires its own events, and persists its
 * own state — no markup or global variables required from the host page.
 * Everything is namespaced with the "ax" prefix and wrapped in an IIFE so
 * it cannot collide with existing scripts on the page.
 */
(function () {
  "use strict";

  if (window.__axAccessibilityWidgetLoaded) return; // guard against double-inclusion
  window.__axAccessibilityWidgetLoaded = true;

  // ---------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------
  var STORAGE_SETTINGS_KEY = "ax-widget-settings-v1";
  var STORAGE_TRIGGER_POS_KEY = "ax-widget-trigger-pos-v1";
  var STORAGE_PANEL_POS_KEY = "ax-widget-panel-pos-v1";

  var FONT_SIZE_MIN = 0;
  var FONT_SIZE_MAX = 4;
  var CONTRAST_MODES = ["dark", "light", "grayscale"];

  var DEFAULT_SETTINGS = {
    fontSize: 0,
    contrast: "none", // 'none' | 'dark' | 'light' | 'grayscale'
    readableFont: false,
    highlightLinks: false,
    stopAnimations: false
  };

  var DRAG_CLICK_THRESHOLD_PX = 6;
  var KEY_MOVE_STEP = 12;
  var KEY_MOVE_STEP_LARGE = 40;
  var EDGE_MARGIN = 8;

  // ---------------------------------------------------------------------
  // Small utilities
  // ---------------------------------------------------------------------
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function safeGetJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function safeSetJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      /* localStorage unavailable (private mode / quota) - fail silently */
    }
  }

  function safeRemove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (err) {
      /* ignore */
    }
  }

  // ---------------------------------------------------------------------
  // Icons (inline SVG, no external requests)
  // ---------------------------------------------------------------------
  // NOTE: colors are set via inline `style` (not the `fill`/`stroke` XML
  // presentation attributes) and hardcoded rather than `currentColor`. The
  // widget's own `all: initial` isolation reset (accessibility-widget.css)
  // resets every CSS property - including SVG presentation properties and
  // `color` itself - on every descendant, which (a) overrides presentation
  // attributes entirely, since CSS always wins over them regardless of
  // specificity/!important, and (b) breaks `currentColor` inheritance since
  // `color` no longer inherits from the button. Inline `style` beats an
  // external non-!important stylesheet rule, so it survives the reset.
  // International Symbol of Access (wheelchair), simplified for legibility
  // at 30x30px. Filled white shapes for the head/torso/arm, a stroked ring
  // for the big wheel (safe now that svg descendants are excluded from the
  // widget's `all: initial` reset - see the CSS file's note on that).
  // "Universal Access" icon (standing figure, arms and legs spread, ring
  // outline) - matches the reference at tabnav.com/he/get-free-widget.
  // Built entirely from circles and straight lines with explicit endpoint
  // coordinates (no `transform`), so there's no cross-browser rotation-origin
  // ambiguity like the previous wheelchair-style icon had.
  var ICON_ACCESSIBILITY =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display:block;fill:none;stroke:none;">' +
    '<circle cx="12" cy="12" r="10" style="fill:none;stroke:#ffffff;stroke-width:1.4;"/>' +
    '<circle cx="12" cy="7.3" r="1.9" style="fill:#ffffff;stroke:none;"/>' +
    '<path d="M6.5 10.8H17.5M12 9.6V13.6M12 13.6L8.3 18.6M12 13.6L15.7 18.6" style="fill:none;stroke:#ffffff;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;"/>' +
    "</svg>";

  var ICON_CLOSE =
    '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display:block;fill:none;stroke:none;">' +
    '<path d="M6 6l12 12M18 6L6 18" style="fill:none;stroke:#ffffff;stroke-width:2.2;stroke-linecap:round;"/>' +
    "</svg>";

  // ---------------------------------------------------------------------
  // Markup
  // ---------------------------------------------------------------------
  var WIDGET_HTML =
    '<div class="ax-widget-root" id="ax-widget-root">' +
    '<button type="button" class="ax-trigger" id="ax-trigger" ' +
    'aria-haspopup="dialog" aria-expanded="false" aria-controls="ax-panel" ' +
    'aria-label="פתיחת תפריט נגישות (ניתן לגרור למיקום אחר עם העכבר או מקשי החצים)">' +
    ICON_ACCESSIBILITY +
    "</button>" +
    '<div class="ax-panel" id="ax-panel" role="dialog" aria-modal="true" ' +
    'aria-labelledby="ax-panel-title" hidden>' +
    '<div class="ax-panel-header" id="ax-panel-header" tabindex="0" ' +
    'aria-label="כותרת תפריט נגישות, ניתנת לגרירה למיקום אחר עם העכבר או מקשי החצים">' +
    '<span>' +
    '<span class="ax-panel-title" id="ax-panel-title">הגדרות נגישות</span>' +
    '<span class="ax-panel-hint">ניתן לגרור את החלון למיקום נוח</span>' +
    "</span>" +
    '<button type="button" class="ax-close-btn" id="ax-close-btn" aria-label="סגירת תפריט נגישות">' +
    ICON_CLOSE +
    "</button>" +
    "</div>" +
    '<div class="ax-panel-body">' +
    '<div class="ax-control-group" role="group" aria-labelledby="ax-fontsize-label">' +
    '<span class="ax-control-label" id="ax-fontsize-label">גודל טקסט</span>' +
    '<div class="ax-btn-row">' +
    '<button type="button" class="ax-btn ax-fontsize-btn" id="ax-font-decrease" aria-label="הקטנת גודל טקסט">א−</button>' +
    '<span class="ax-fontsize-level" id="ax-fontsize-level" aria-hidden="true">רגיל</span>' +
    '<button type="button" class="ax-btn ax-fontsize-btn" id="ax-font-increase" aria-label="הגדלת גודל טקסט">א+</button>' +
    "</div>" +
    "</div>" +
    '<div class="ax-control-group" role="group" aria-labelledby="ax-contrast-label">' +
    '<span class="ax-control-label" id="ax-contrast-label">מצבי ניגודיות</span>' +
    '<div class="ax-btn-grid">' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-contrast="dark" aria-pressed="false">ניגודיות כהה</button>' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-contrast="light" aria-pressed="false">ניגודיות בהירה</button>' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-contrast="grayscale" aria-pressed="false">גווני אפור</button>' +
    "</div>" +
    "</div>" +
    '<div class="ax-control-group" role="group" aria-labelledby="ax-extra-label">' +
    '<span class="ax-control-label" id="ax-extra-label">התאמות נוספות</span>' +
    '<div class="ax-btn-grid">' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-toggle="readableFont" aria-pressed="false">גופן קריא</button>' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-toggle="highlightLinks" aria-pressed="false">הדגשת קישורים</button>' +
    '<button type="button" class="ax-btn ax-toggle" data-ax-toggle="stopAnimations" aria-pressed="false">עצירת אנימציות</button>' +
    "</div>" +
    "</div>" +
    '<button type="button" class="ax-reset-btn" id="ax-reset-btn">איפוס כל ההגדרות</button>' +
    '<span class="ax-footer-note">התאמות אלו נשמרות בדפדפן שלך בלבד</span>' +
    "</div>" +
    "</div>" +
    '<div class="ax-sr-only" id="ax-live-region" aria-live="polite" role="status"></div>' +
    "</div>";

  // ---------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------
  var settings = mergeDefaults(safeGetJSON(STORAGE_SETTINGS_KEY, {}));

  function mergeDefaults(partial) {
    var merged = {};
    var key;
    for (key in DEFAULT_SETTINGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) {
        merged[key] =
          partial && Object.prototype.hasOwnProperty.call(partial, key)
            ? partial[key]
            : DEFAULT_SETTINGS[key];
      }
    }
    if (typeof merged.fontSize !== "number") merged.fontSize = 0;
    merged.fontSize = clamp(Math.round(merged.fontSize), FONT_SIZE_MIN, FONT_SIZE_MAX);
    if (CONTRAST_MODES.indexOf(merged.contrast) === -1) merged.contrast = "none";
    return merged;
  }

  function persistSettings() {
    safeSetJSON(STORAGE_SETTINGS_KEY, settings);
  }

  // DOM refs, populated in init()
  var root, trigger, panel, panelHeader, closeBtn, liveRegion;
  var fontDecreaseBtn, fontIncreaseBtn, fontLevelLabel;
  var contrastButtons, toggleButtons, resetBtn;

  var FONT_LEVEL_LABELS = ["רגיל", "מוגדל 1", "מוגדל 2", "מוגדל 3", "מוגדל 4"];

  // ---------------------------------------------------------------------
  // Applying settings to the page
  // ---------------------------------------------------------------------
  function applyAllSettings() {
    var html = document.documentElement;

    for (var i = FONT_SIZE_MIN; i <= FONT_SIZE_MAX; i++) {
      html.classList.remove("ax-font-size-" + i);
    }
    if (settings.fontSize > 0) {
      html.classList.add("ax-font-size-" + settings.fontSize);
    }

    html.classList.remove("ax-contrast-dark", "ax-contrast-light", "ax-contrast-grayscale");
    if (settings.contrast !== "none") {
      html.classList.add("ax-contrast-" + settings.contrast);
    }

    html.classList.toggle("ax-readable-font", !!settings.readableFont);
    html.classList.toggle("ax-highlight-links", !!settings.highlightLinks);
    html.classList.toggle("ax-stop-animations", !!settings.stopAnimations);

    toggleMarquees(!!settings.stopAnimations);
    syncControlsWithState();
  }

  function toggleMarquees(shouldStop) {
    var marquees = document.querySelectorAll("marquee");
    for (var i = 0; i < marquees.length; i++) {
      var el = marquees[i];
      try {
        if (shouldStop && typeof el.stop === "function") el.stop();
        if (!shouldStop && typeof el.start === "function") el.start();
      } catch (err) {
        /* non-standard element implementation - ignore */
      }
    }
  }

  function syncControlsWithState() {
    if (!fontDecreaseBtn) return; // controls not built yet

    fontLevelLabel.textContent = FONT_LEVEL_LABELS[settings.fontSize];
    setDisabled(fontDecreaseBtn, settings.fontSize <= FONT_SIZE_MIN);
    setDisabled(fontIncreaseBtn, settings.fontSize >= FONT_SIZE_MAX);

    for (var i = 0; i < contrastButtons.length; i++) {
      var btn = contrastButtons[i];
      var mode = btn.getAttribute("data-ax-contrast");
      btn.setAttribute("aria-pressed", settings.contrast === mode ? "true" : "false");
    }

    for (var j = 0; j < toggleButtons.length; j++) {
      var tbtn = toggleButtons[j];
      var key = tbtn.getAttribute("data-ax-toggle");
      tbtn.setAttribute("aria-pressed", settings[key] ? "true" : "false");
    }
  }

  function setDisabled(button, disabled) {
    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function announce(message) {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(function () {
      liveRegion.textContent = message;
    }, 30);
  }

  // ---------------------------------------------------------------------
  // Control handlers
  // ---------------------------------------------------------------------
  function handleFontDecrease() {
    if (settings.fontSize <= FONT_SIZE_MIN) return;
    settings.fontSize -= 1;
    persistSettings();
    applyAllSettings();
    announce("גודל טקסט: " + FONT_LEVEL_LABELS[settings.fontSize]);
  }

  function handleFontIncrease() {
    if (settings.fontSize >= FONT_SIZE_MAX) return;
    settings.fontSize += 1;
    persistSettings();
    applyAllSettings();
    announce("גודל טקסט: " + FONT_LEVEL_LABELS[settings.fontSize]);
  }

  function handleContrastClick(mode) {
    settings.contrast = settings.contrast === mode ? "none" : mode;
    persistSettings();
    applyAllSettings();
    announce(settings.contrast === "none" ? "מצב ניגודיות בוטל" : "מצב ניגודיות הופעל");
  }

  function handleToggleClick(key, label) {
    settings[key] = !settings[key];
    persistSettings();
    applyAllSettings();
    announce(label + (settings[key] ? " הופעל" : " בוטל"));
  }

  function handleReset() {
    settings = mergeDefaults({});
    safeRemove(STORAGE_SETTINGS_KEY);
    applyAllSettings();
    announce("כל הגדרות הנגישות אופסו");
  }

  // ---------------------------------------------------------------------
  // Panel open / close + focus management
  // ---------------------------------------------------------------------
  var lastFocusedBeforeOpen = null;

  function openPanel() {
    lastFocusedBeforeOpen = document.activeElement;
    panel.hidden = false; // must be laid out (visible) before measuring/positioning it
    positionPanelNearTrigger();
    trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onDocumentKeydown, true);
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.setTimeout(function () {
      closeBtn.focus();
    }, 0);
  }

  function closePanel() {
    if (panel.hidden) return;
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onDocumentKeydown, true);
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    if (lastFocusedBeforeOpen && typeof lastFocusedBeforeOpen.focus === "function") {
      lastFocusedBeforeOpen.focus();
    } else {
      trigger.focus();
    }
  }

  function togglePanel() {
    if (panel.hidden) openPanel();
    else closePanel();
  }

  function getFocusableInPanel() {
    var selector =
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.slice.call(panel.querySelectorAll(selector));
  }

  function onDocumentKeydown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      closePanel();
      return;
    }
    if (event.key !== "Tab") return;

    var focusable = getFocusableInPanel();
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onDocumentPointerDown(event) {
    if (panel.hidden) return;
    if (root.contains(event.target)) return; // click inside widget - handled elsewhere
    closePanel();
  }

  // ---------------------------------------------------------------------
  // Dragging (mouse, touch and pen via Pointer Events + full keyboard support)
  // ---------------------------------------------------------------------
  function makeDraggable(target, handle, options) {
    options = options || {};
    var storageKey = options.storageKey;
    var onTap = options.onTap;
    var excludeSelector = options.excludeSelector;

    var dragging = false;
    var moved = false;
    var pointerId = null;
    var startClientX = 0;
    var startClientY = 0;
    var startLeft = 0;
    var startTop = 0;

    function currentLeftTop() {
      var rect = target.getBoundingClientRect();
      return { left: rect.left, top: rect.top };
    }

    function applyPosition(left, top, persist) {
      var maxLeft = window.innerWidth - target.offsetWidth - EDGE_MARGIN;
      var maxTop = window.innerHeight - target.offsetHeight - EDGE_MARGIN;
      var clampedLeft = clamp(left, EDGE_MARGIN, Math.max(EDGE_MARGIN, maxLeft));
      var clampedTop = clamp(top, EDGE_MARGIN, Math.max(EDGE_MARGIN, maxTop));

      target.style.left = clampedLeft + "px";
      target.style.top = clampedTop + "px";
      target.style.right = "auto";
      target.style.bottom = "auto";

      if (persist && storageKey) {
        safeSetJSON(storageKey, { left: clampedLeft, top: clampedTop });
      }
    }

    function restorePosition() {
      if (!storageKey) return false;
      var saved = safeGetJSON(storageKey, null);
      if (!saved || typeof saved.left !== "number" || typeof saved.top !== "number") {
        return false;
      }
      applyPosition(saved.left, saved.top, false);
      return true;
    }

    function onPointerDown(event) {
      if (event.button !== undefined && event.button !== 0) return;
      if (excludeSelector && event.target.closest(excludeSelector)) return;

      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      startClientX = event.clientX;
      startClientY = event.clientY;
      var pos = currentLeftTop();
      startLeft = pos.left;
      startTop = pos.top;

      try {
        handle.setPointerCapture(pointerId);
      } catch (err) {
        /* pointer capture unsupported - drag still works via document listeners */
      }
      handle.classList.add("ax-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    function onPointerMove(event) {
      if (!dragging) return;
      var dx = event.clientX - startClientX;
      var dy = event.clientY - startClientY;
      if (Math.abs(dx) > DRAG_CLICK_THRESHOLD_PX || Math.abs(dy) > DRAG_CLICK_THRESHOLD_PX) {
        moved = true;
      }
      applyPosition(startLeft + dx, startTop + dy, false);
      event.preventDefault();
    }

    function onPointerUp(event) {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("ax-dragging");
      try {
        handle.releasePointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("pointercancel", onPointerUp);

      var pos = currentLeftTop();
      applyPosition(pos.left, pos.top, true);

      if (!moved && typeof onTap === "function") {
        onTap();
      }
    }

    function onKeyDown(event) {
      var step = event.shiftKey ? KEY_MOVE_STEP_LARGE : KEY_MOVE_STEP;
      var pos = currentLeftTop();
      var handled = true;

      switch (event.key) {
        case "ArrowUp":
          applyPosition(pos.left, pos.top - step, true);
          break;
        case "ArrowDown":
          applyPosition(pos.left, pos.top + step, true);
          break;
        case "ArrowLeft":
          applyPosition(pos.left - step, pos.top, true);
          break;
        case "ArrowRight":
          applyPosition(pos.left + step, pos.top, true);
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    }

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("keydown", onKeyDown);
    handle.style.touchAction = "none";

    return { applyPosition: applyPosition, restorePosition: restorePosition };
  }

  var triggerDrag, panelDrag;

  function positionPanelNearTrigger() {
    // Panel must already be visible (display:flex, not [hidden]) by this point,
    // so offsetWidth/offsetHeight below reflect its real laid-out size instead
    // of the 0x0 a display:none element would report.
    if (panelDrag.restorePosition()) return;

    var triggerRect = trigger.getBoundingClientRect();
    var panelWidth = panel.offsetWidth;
    var panelHeight = panel.offsetHeight;

    var preferredTop = triggerRect.top - panelHeight - 12;
    var top =
      preferredTop >= EDGE_MARGIN
        ? preferredTop
        : Math.min(triggerRect.bottom + 12, window.innerHeight - panelHeight - EDGE_MARGIN);
    var left = clamp(
      triggerRect.left,
      EDGE_MARGIN,
      Math.max(EDGE_MARGIN, window.innerWidth - panelWidth - EDGE_MARGIN)
    );

    panel.style.left = left + "px";
    panel.style.top = top + "px";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  // ---------------------------------------------------------------------
  // Wiring
  // ---------------------------------------------------------------------
  function attachEventListeners() {
    fontDecreaseBtn.addEventListener("click", handleFontDecrease);
    fontIncreaseBtn.addEventListener("click", handleFontIncrease);

    for (var i = 0; i < contrastButtons.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          handleContrastClick(btn.getAttribute("data-ax-contrast"));
        });
      })(contrastButtons[i]);
    }

    var toggleLabels = {
      readableFont: "גופן קריא",
      highlightLinks: "הדגשת קישורים",
      stopAnimations: "עצירת אנימציות"
    };
    for (var j = 0; j < toggleButtons.length; j++) {
      (function (btn) {
        var key = btn.getAttribute("data-ax-toggle");
        btn.addEventListener("click", function () {
          handleToggleClick(key, toggleLabels[key] || key);
        });
      })(toggleButtons[j]);
    }

    resetBtn.addEventListener("click", handleReset);
    closeBtn.addEventListener("click", closePanel);

    window.addEventListener("resize", function () {
      var trg = triggerDrag.applyPosition;
      var tRect = trigger.getBoundingClientRect();
      trg(tRect.left, tRect.top, false);
      if (!panel.hidden) {
        var pRect = panel.getBoundingClientRect();
        panelDrag.applyPosition(pRect.left, pRect.top, false);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  function init() {
    document.body.insertAdjacentHTML("beforeend", WIDGET_HTML);

    root = document.getElementById("ax-widget-root");
    trigger = document.getElementById("ax-trigger");
    panel = document.getElementById("ax-panel");
    panelHeader = document.getElementById("ax-panel-header");
    closeBtn = document.getElementById("ax-close-btn");
    liveRegion = document.getElementById("ax-live-region");
    fontDecreaseBtn = document.getElementById("ax-font-decrease");
    fontIncreaseBtn = document.getElementById("ax-font-increase");
    fontLevelLabel = document.getElementById("ax-fontsize-level");
    contrastButtons = Array.prototype.slice.call(panel.querySelectorAll("[data-ax-contrast]"));
    toggleButtons = Array.prototype.slice.call(panel.querySelectorAll("[data-ax-toggle]"));
    resetBtn = document.getElementById("ax-reset-btn");

    triggerDrag = makeDraggable(trigger, trigger, {
      storageKey: STORAGE_TRIGGER_POS_KEY,
      onTap: togglePanel
    });
    panelDrag = makeDraggable(panel, panelHeader, {
      storageKey: STORAGE_PANEL_POS_KEY,
      excludeSelector: ".ax-close-btn"
    });

    triggerDrag.restorePosition();
    attachEventListeners();
    applyAllSettings();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
