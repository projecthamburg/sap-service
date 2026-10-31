import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { brandGeometry } from "../../src/brand.js";

// Compare the rendered brand with independent, supplied artwork, not another
// rendering of the same component. Color is normalized to measure silhouette.
export async function compareBrandReference(page) {
  const fixture = new URL("../../tests/fixtures/", import.meta.url);
  const reference = JSON.parse(
    await readFile(new URL("sap-logo-reference.json", fixture), "utf8")
  );
  const bytes = await readFile(new URL(reference.source, fixture));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== reference.sha256 || hash !== brandGeometry.sourceSha256)
    throw Error(
      "The brand reference artwork changed; review its provenance before accepting a new baseline."
    );
  const result = await page.$eval(
    ".site-header .brand svg",
    async (svg, options) => {
      const clone = svg.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(options.viewBox[2]));
      clone.setAttribute("height", String(options.viewBox[3]));
      clone.setAttribute("style", "color:#1e2d53");
      const candidate =
        "data:image/svg+xml;base64," +
        btoa(new XMLSerializer().serializeToString(clone));
      async function pixels(src, rect) {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, 256, 256);
        context.drawImage(image, ...rect);
        return context.getImageData(0, 0, 256, 256).data;
      }
      const source = await pixels(options.image, [0, 0, 256, 256]),
        rendered = await pixels(candidate, options.viewBox);
      let intersection = 0,
        union = 0;
      for (let i = 0; i < source.length; i += 4) {
        const a =
            0.2126 * source[i] +
              0.7152 * source[i + 1] +
              0.0722 * source[i + 2] <
            options.threshold,
          b =
            0.2126 * rendered[i] +
              0.7152 * rendered[i + 1] +
              0.0722 * rendered[i + 2] <
            options.threshold;
        if (a && b) intersection++;
        if (a || b) union++;
      }
      return {
        intersectionOverUnion: union ? intersection / union : 0,
        variant: svg.dataset.brandVariant,
        viewBox: svg.getAttribute("viewBox"),
        renderedColor: getComputedStyle(svg).color,
      };
    },
    {
      image: "data:image/jpeg;base64," + bytes.toString("base64"),
      viewBox: reference.viewBox,
      threshold: reference.maskThreshold,
    }
  );
  return {
    ...result,
    sourceSha256: hash,
    minimum: reference.minimumIntersectionOverUnion,
    passed:
      result.variant === "lockup" &&
      result.intersectionOverUnion >= reference.minimumIntersectionOverUnion,
    limitations: [
      "Silhouette agreement is not a substitute for visual review of color, scale and clear space.",
    ],
  };
}
