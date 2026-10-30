import { toCanvas } from "html-to-image";

/**
 * One export path for every Seasonal Polaroid surface. The result page and
 * the My Polaroids gallery both hand their rendered frame node to this
 * module, so the downloaded PNG is the same composition the person approved
 * on screen: same template, same photo window, same caption typography.
 *
 * How the file is built
 * ---------------------
 * html-to-image rasterises the DOM by serialising it into an SVG
 * `<foreignObject>` and drawing that SVG onto a canvas. WebKit (Safari, and
 * every browser on iOS) paints that SVG before the `<img>` elements inside it
 * have loaded, so the template and the pet photo were missing from the file
 * while the caption and the sparkle were present. Repeating the capture does
 * not reliably help (verified: three consecutive captures stayed blank).
 *
 * The bitmap layers are therefore drawn straight from the already-decoded
 * `<img>` elements with `drawImage`, which every browser does synchronously
 * and deterministically, and html-to-image only rasterises the vector layer
 * (caption text, sparkle, overlays) on top. Geometry comes from the rendered
 * node itself, so the three surfaces cannot drift apart.
 */
export const SEASONAL_POLAROID_EXPORT_WIDTH = 1080;
export const SEASONAL_POLAROID_EXPORT_HEIGHT = 1620;
export const SEASONAL_POLAROID_EXPORT_BACKGROUND = "#F2E8D7";

/** Marks the frame parts the exporter draws natively. Set by `SeasonalPolaroidFrame`. */
export const SEASONAL_POLAROID_PART_ATTRIBUTE = "data-seasonal-polaroid";
export type SeasonalPolaroidPart = "template" | "photo-window" | "photo" | "caption";

/**
 * Presentation-only styles stripped from the capture. The result page tilts
 * the card by one degree and gives it a drop shadow; rasterising that
 * transformed node clipped the corners and baked the tilt into the file.
 * The vector layer is captured with a transparent background so it can be
 * composited over the natively drawn template and photo.
 */
export const SEASONAL_POLAROID_CAPTURE_STYLE: Partial<CSSStyleDeclaration> = {
  // Tailwind v4 writes the tilt to the individual `rotate` property, so both
  // the shorthand and the individual transform properties are cleared.
  transform: "none",
  rotate: "none",
  scale: "none",
  translate: "none",
  boxShadow: "none",
  borderRadius: "0",
  transition: "none",
  filter: "none",
  backgroundColor: "transparent",
};

/** How many times the vector layer is re-captured when it comes back without any caption ink. */
const VECTOR_LAYER_ATTEMPTS = 3;

/** Resolve once every font and image inside the node has finished loading and decoding. */
export async function waitForSeasonalPolaroidAssets(node: HTMLElement): Promise<void> {
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all(Array.from(node.querySelectorAll("img")).map(async (image) => {
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }
    if (typeof image.decode === "function") await image.decode().catch(() => undefined);
  }));
}

export type LayoutRect = { left: number; top: number; width: number; height: number };

function part<T extends Element = HTMLElement>(node: HTMLElement, name: SeasonalPolaroidPart): T | null {
  return node.querySelector<T>(`[${SEASONAL_POLAROID_PART_ATTRIBUTE}="${name}"]`);
}

/**
 * Layout box of an absolutely positioned child of the frame, in CSS pixels
 * before any transform. Computed `left`/`top`/`width`/`height` are used
 * values for positioned elements, so the result page's tilt does not distort
 * them the way `getBoundingClientRect()` would.
 */
function layoutRect(element: HTMLElement): LayoutRect {
  const style = getComputedStyle(element);
  return {
    left: parseFloat(style.left) || 0,
    top: parseFloat(style.top) || 0,
    width: parseFloat(style.width) || 0,
    height: parseFloat(style.height) || 0,
  };
}

/**
 * A CSS border radius ("4%" or "12px"), resolved against the box it rounds:
 * a percentage is taken of the width for the horizontal radius and of the
 * height for the vertical one, exactly as CSS does, and capped at half the box.
 */
export function resolveSeasonalPolaroidRadius(value: string, width: number, height: number): { x: number; y: number } {
  const [horizontal, vertical = horizontal] = value.trim().split(/\s+/);
  const resolve = (token: string, reference: number) => {
    const amount = parseFloat(token) || 0;
    return token.endsWith("%") ? (amount / 100) * reference : amount;
  };
  return { x: Math.min(resolve(horizontal!, width), width / 2), y: Math.min(resolve(vertical, height), height / 2) };
}

function roundedRectPath(context: CanvasRenderingContext2D, rect: LayoutRect, radius: { x: number; y: number }): void {
  const { left, top, width, height } = rect;
  const { x, y } = radius;
  context.beginPath();
  context.moveTo(left + x, top);
  context.lineTo(left + width - x, top);
  context.ellipse(left + width - x, top + y, x, y, 0, -Math.PI / 2, 0);
  context.lineTo(left + width, top + height - y);
  context.ellipse(left + width - x, top + height - y, x, y, 0, 0, Math.PI / 2);
  context.lineTo(left + x, top + height);
  context.ellipse(left + x, top + height - y, x, y, 0, Math.PI / 2, Math.PI);
  context.lineTo(left, top + y);
  context.ellipse(left + x, top + y, x, y, 0, Math.PI, Math.PI * 1.5);
  context.closePath();
}

/**
 * Where an image of `natural` size is painted inside `box` for the given
 * `object-fit` with a centred `object-position`: `cover` scales it up until
 * it fills the box (overflow is clipped), `contain` scales it down until it
 * fits, anything else stretches it like `fill`.
 */
export function seasonalPolaroidFittedBox(fit: string, natural: { width: number; height: number }, box: LayoutRect): LayoutRect {
  if ((fit !== "cover" && fit !== "contain") || !natural.width || !natural.height) return { ...box };
  const scale = fit === "cover"
    ? Math.max(box.width / natural.width, box.height / natural.height)
    : Math.min(box.width / natural.width, box.height / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}

/** Draw a decoded image into a box honouring its computed `object-fit`. */
function drawFitted(context: CanvasRenderingContext2D, image: HTMLImageElement, rect: LayoutRect): void {
  const { naturalWidth, naturalHeight } = image;
  if (!naturalWidth || !naturalHeight || !rect.width || !rect.height) return;
  const drawn = seasonalPolaroidFittedBox(getComputedStyle(image).objectFit, { width: naturalWidth, height: naturalHeight }, rect);
  context.save();
  context.beginPath();
  context.rect(rect.left, rect.top, rect.width, rect.height);
  context.clip();
  context.drawImage(image, drawn.left, drawn.top, drawn.width, drawn.height);
  context.restore();
}

/** True when the caption window holds text that is actually painted (not hidden, collapsed or transparent). */
function captionHasVisibleText(caption: HTMLElement): boolean {
  return Array.from(caption.querySelectorAll<HTMLElement>("p")).some((paragraph) => {
    if (!paragraph.textContent?.trim()) return false;
    const style = getComputedStyle(paragraph);
    return style.visibility === "visible" && style.display !== "none" && parseFloat(style.opacity) > 0;
  });
}

/** True when the vector layer carries caption ink inside the caption window. */
function hasCaptionInk(layer: HTMLCanvasElement, caption: LayoutRect, pixelRatio: number): boolean {
  const context = layer.getContext("2d");
  if (!context) return true;
  const left = Math.max(0, Math.floor(caption.left * pixelRatio));
  const top = Math.max(0, Math.floor(caption.top * pixelRatio));
  const width = Math.min(layer.width - left, Math.ceil(caption.width * pixelRatio));
  const height = Math.min(layer.height - top, Math.ceil(caption.height * pixelRatio));
  if (width <= 0 || height <= 0) return true;
  const { data } = context.getImageData(left, top, width, height);
  let inked = 0;
  for (let index = 3; index < data.length; index += 4) {
    if (data[index]! > 0 && ++inked >= 16) return true;
  }
  return false;
}

/**
 * Rasterise everything except the template and the photo: caption text,
 * sparkle, overlays. The photo window's own background and inset shadow are
 * hidden for the duration of the capture because the photo is drawn
 * underneath this layer; on screen both are covered by the photo anyway.
 */
async function captureVectorLayer(node: HTMLElement, pixelRatio: number, caption: LayoutRect | null, captionHasText: boolean): Promise<HTMLCanvasElement> {
  const photoWindow = part(node, "photo-window");
  const previous = photoWindow ? { backgroundColor: photoWindow.style.backgroundColor, boxShadow: photoWindow.style.boxShadow } : null;
  if (photoWindow) {
    photoWindow.style.backgroundColor = "transparent";
    photoWindow.style.boxShadow = "none";
  }
  const baseOptions = {
    // The generated image is a short-lived blob URL. html-to-image appends a
    // query string when cacheBust is enabled, which turns that blob URL into
    // an invalid resource while cloning the node.
    cacheBust: false,
    pixelRatio,
    style: SEASONAL_POLAROID_CAPTURE_STYLE,
    filter: (element: HTMLElement) => {
      const name = typeof element.getAttribute === "function" ? element.getAttribute(SEASONAL_POLAROID_PART_ATTRIBUTE) : null;
      return name !== "template" && name !== "photo";
    },
  };
  try {
    let layer: HTMLCanvasElement | null = null;
    for (let attempt = 1; attempt <= VECTOR_LAYER_ATTEMPTS; attempt++) {
      try {
        layer = await toCanvas(node, { ...baseOptions, skipFonts: false });
      } catch {
        layer = await toCanvas(node, { ...baseOptions, skipFonts: true, fontEmbedCSS: "" });
      }
      if (!caption || !captionHasText || hasCaptionInk(layer, caption, pixelRatio)) return layer;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    throw new Error("export_failed");
  } finally {
    if (photoWindow && previous) {
      photoWindow.style.backgroundColor = previous.backgroundColor;
      photoWindow.style.boxShadow = previous.boxShadow;
    }
  }
}

/**
 * Rasterise the frame node into the approved 1080 × 1620 canvas.
 *
 * The composition is built at output resolution (pixelRatio = 1080 /
 * displayed width) instead of at the displayed size, so text, the template
 * and the photo stay crisp whether the node is a 430px result card or a
 * 300px gallery card. Passing `width`/`height` to html-to-image would enlarge
 * the canvas without enlarging the DOM node, so the scale is applied through
 * pixelRatio and the result is normalised onto the fixed 2:3 output canvas.
 */
export async function renderSeasonalPolaroidCanvas(node: HTMLElement): Promise<HTMLCanvasElement> {
  await waitForSeasonalPolaroidAssets(node);
  // Used layout width (fractional, untransformed); html-to-image sizes its
  // canvas from clientWidth, which differs by less than a pixel.
  const displayedWidth = parseFloat(getComputedStyle(node).width) || node.clientWidth || node.getBoundingClientRect().width || SEASONAL_POLAROID_EXPORT_WIDTH;
  const displayedHeight = parseFloat(getComputedStyle(node).height) || node.clientHeight || displayedWidth * 1.5;
  const pixelRatio = Math.min(4, Math.max(1, SEASONAL_POLAROID_EXPORT_WIDTH / displayedWidth));

  const template = part<HTMLImageElement>(node, "template");
  const photoWindow = part(node, "photo-window");
  const photo = part<HTMLImageElement>(node, "photo");
  const caption = part(node, "caption");
  const captionRect = caption ? layoutRect(caption) : null;
  const vectorLayer = await captureVectorLayer(node, pixelRatio, captionRect, Boolean(caption && captionHasVisibleText(caption)));

  const rendered = document.createElement("canvas");
  rendered.width = Math.round(displayedWidth * pixelRatio);
  rendered.height = Math.round(displayedHeight * pixelRatio);
  const stage = rendered.getContext("2d");
  if (!stage) throw new Error("export_failed");
  stage.imageSmoothingEnabled = true;
  stage.imageSmoothingQuality = "high";
  stage.fillStyle = SEASONAL_POLAROID_EXPORT_BACKGROUND;
  stage.fillRect(0, 0, rendered.width, rendered.height);
  stage.scale(pixelRatio, pixelRatio);

  // 1. The decorative template, stretched over the whole frame like `object-fill`.
  if (template && template.naturalWidth) drawFitted(stage, template, layoutRect(template));

  // 2. The photo window: its background, then the photo clipped to the rounded corners.
  if (photoWindow) {
    const windowRect = layoutRect(photoWindow);
    const windowStyle = getComputedStyle(photoWindow);
    stage.save();
    roundedRectPath(stage, windowRect, resolveSeasonalPolaroidRadius(windowStyle.borderTopLeftRadius, windowRect.width, windowRect.height));
    stage.clip();
    stage.fillStyle = windowStyle.backgroundColor;
    stage.fillRect(windowRect.left, windowRect.top, windowRect.width, windowRect.height);
    if (photo && photo.naturalWidth) drawFitted(stage, photo, windowRect);
    stage.restore();
  }

  // 3. Caption, sparkle and overlays, rasterised from the DOM at the same scale.
  stage.setTransform(1, 0, 0, 1, 0, 0);
  stage.drawImage(vectorLayer, 0, 0);

  const output = document.createElement("canvas");
  output.width = SEASONAL_POLAROID_EXPORT_WIDTH;
  // The template is 2:3 (1024 × 1536). Keep that ratio so the full decorative
  // frame is in the file.
  output.height = SEASONAL_POLAROID_EXPORT_HEIGHT;
  const context = output.getContext("2d");
  if (!context) throw new Error("export_failed");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(rendered, 0, 0, output.width, output.height);
  return output;
}

export async function exportSeasonalPolaroidPng(node: HTMLElement): Promise<Blob | null> {
  const output = await renderSeasonalPolaroidCanvas(node);
  return new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/png"));
}
