// A project-specific, portable adaptation of the Domscan evidence contract.
// This function is serialized into the browser: keep it self-contained.
export function captureDOM({
  scopes = [
    ".site-header .brand",
    ".site-footer .brand",
    ".approach-stamp",
    ".comparison-section",
  ],
  maxElements = 1000,
  maxCharacters = 100000,
} = {}) {
  const at = new Date().toISOString(),
    elements = [],
    scopeResults = [],
    unreadableStylesheets = [];
  const rules = [];
  function collect(list, sheet, conditions = []) {
    for (const rule of list) {
      if (rule.selectorText && rule.style)
        rules.push({
          sheet,
          selector: rule.selectorText,
          declarations: rule.style.cssText,
          conditions,
          order: rules.length,
        });
      else if (rule.cssRules) {
        const condition = rule.conditionText;
        let active = true;
        if (condition) {
          if (rule.constructor.name === "CSSMediaRule")
            active = matchMedia(condition).matches;
          else if (rule.constructor.name === "CSSSupportsRule")
            active = CSS.supports(condition);
        }
        if (active)
          collect(
            rule.cssRules,
            sheet,
            condition ? [...conditions, condition] : conditions
          );
      }
    }
  }
  for (const sheet of document.styleSheets) {
    try {
      collect(sheet.cssRules, sheet.href || "inline");
    } catch {
      unreadableStylesheets.push(sheet.href || "inline");
    }
  }
  let candidates = 0,
    characters = 0,
    textTruncated = false;
  for (const scope of scopes) {
    const matches = document.querySelectorAll(scope);
    if (matches.length !== 1) {
      scopeResults.push({
        selector: scope,
        status: matches.length ? "ambiguous" : "unavailable",
        matches: matches.length,
      });
      continue;
    }
    const root = matches[0],
      nodes = [root, ...root.querySelectorAll("*")];
    candidates += nodes.length;
    scopeResults.push({
      selector: scope,
      status: "captured",
      eligible: nodes.length,
    });
    for (const node of nodes) {
      if (elements.length >= maxElements) break;
      const steps = [];
      let ancestor = node;
      while (ancestor !== root) {
        const siblings = [...ancestor.parentElement.children].filter(
          (e) => e.localName === ancestor.localName
        );
        steps.unshift(
          `${ancestor.localName}:nth-of-type(${siblings.indexOf(ancestor) + 1})`
        );
        ancestor = ancestor.parentElement;
      }
      const selector = scope + (steps.length ? " > " + steps.join(" > ") : "");
      const rect = node.getBoundingClientRect(),
        style = getComputedStyle(node);
      let rendered = Boolean(node.getClientRects().length);
      for (
        let parent = node;
        parent && rendered;
        parent = parent.parentElement
      ) {
        const s = getComputedStyle(parent);
        if (
          s.display === "none" ||
          s.visibility === "hidden" ||
          Number(s.opacity) === 0
        )
          rendered = false;
      }
      const rawLabel = node.matches("input,textarea,select")
        ? ""
        : (node.getAttribute("aria-label") || node.innerText || "").trim();
      let text = rawLabel.slice(0, 280);
      let labelTruncated = rawLabel.length > 280;
      if (characters + text.length > maxCharacters) {
        text = "";
        labelTruncated = true;
        textTruncated = true;
      }
      characters += text.length;
      const center = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
      };
      const hit =
        center.x >= 0 &&
        center.x < innerWidth &&
        center.y >= 0 &&
        center.y < innerHeight
          ? document.elementFromPoint(center.x, center.y)
          : null;
      const matchedRules = rules.filter((rule) => {
        try {
          return node.matches(rule.selector);
        } catch {
          return false;
        }
      });
      const row = {
        selector,
        selectorMatches: document.querySelectorAll(selector).length,
        tag: node.localName,
        label: text,
        labelTruncated,
        role: node.getAttribute("role"),
        rendered,
        inViewport:
          rendered &&
          rect.bottom > 0 &&
          rect.top < innerHeight &&
          rect.right > 0 &&
          rect.left < innerWidth,
        interaction: {
          pointerEvents: style.pointerEvents,
          tabIndex: node.tabIndex,
          pointerHitAtCenter: Boolean(
            hit && (hit === node || node.contains(hit))
          ),
          focusVisible: node.matches(":focus-visible"),
        },
        geometry: {
          viewport: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          document: { x: rect.x + scrollX, y: rect.y + scrollY },
        },
        typography: {
          family: style.fontFamily,
          size: style.fontSize,
          weight: style.fontWeight,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
        },
        style: {
          display: style.display,
          position: style.position,
          color: style.color,
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          fill: style.fill,
          opacity: style.opacity,
        },
        state: {
          selected: node.getAttribute("aria-selected"),
          pressed: node.getAttribute("aria-pressed"),
          expanded: node.getAttribute("aria-expanded"),
          disabled: Boolean(node.disabled),
        },
        matchedRules,
      };
      if (node.localName === "svg")
        row.svg = {
          brand: node.getAttribute("data-brand"),
          variant: node.getAttribute("data-brand-variant"),
          viewBox: node.getAttribute("viewBox"),
          paths: [...node.querySelectorAll("path")].map((p) =>
            p.getAttribute("d")
          ),
          transforms: [...node.querySelectorAll("[transform]")].map((e) =>
            e.getAttribute("transform")
          ),
        };
      if (node.localName === "img")
        row.image = {
          src: node.currentSrc || node.src,
          complete: node.complete,
          naturalWidth: node.naturalWidth,
          naturalHeight: node.naturalHeight,
        };
      elements.push(row);
    }
  }
  return {
    schemaVersion: 1,
    at,
    url: location.href,
    language: document.documentElement.lang,
    theme: document.documentElement.dataset.theme,
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
    scopes: scopeResults,
    elements,
    coverage: {
      eligible: candidates,
      captured: elements.length,
      truncated: elements.length < candidates,
      charactersCaptured: characters,
      labelsLimitedTo: 280,
      textBudgetTruncated: textTruncated,
      hiddenIncluded: true,
      offscreenIncluded: true,
      unreadableStylesheets,
    },
    limitations: [
      "Snapshots are sequential, not atomic.",
      "Structural selectors identify this captured state, not durable component identities.",
      "Input values, raw HTML, cookies and storage are not captured.",
      "Cross-origin frames, closed shadow roots and canvas content are not traversed.",
      "Computed colors are observed values; no inferred contrast or design-quality score is claimed.",
      "Center-point hit testing is an observation, not proof that an arbitrary action is safe.",
    ],
  };
}

export function diffCaptures(before, after) {
  const previous = new Map(before.elements.map((e) => [e.selector, e])),
    current = new Map(after.elements.map((e) => [e.selector, e]));
  return {
    matching: "exact structural selector within the declared scopes",
    added: [...current.keys()].filter((k) => !previous.has(k)),
    removed: [...previous.keys()].filter((k) => !current.has(k)),
    changed: [...current.keys()].filter(
      (k) =>
        previous.has(k) &&
        JSON.stringify(previous.get(k)) !== JSON.stringify(current.get(k))
    ),
  };
}
