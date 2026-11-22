/**
 * TTC vehicles from the landing page's finale, without their street, platform, wind or snow:
 *  - the Flexity streetcar now on the site (vendor/landing/streetcar.js)
 *  - the Toronto Rocket subway train it replaced (vendor/landing/subway.js)
 * Both are built with no crew, so the windows stay empty (no floating photos).
 */
import { createStreetcar } from "../vendor/landing/streetcar.js";
import { createSubway } from "../vendor/landing/subway.js";
import { shared } from "../lib/flat.js";
import { overrideUniforms } from "../lib/patch.js";

export const streetcar = {
  id: "streetcar",
  name: "TTC Flexity streetcar",
  source: "landing/streetcar.js",
  palettes: [
    { id: "day", label: "Day", note: "light theme", swatch: ["#18D9D2", "#FFFFFF"] },
    { id: "night", label: "Night", note: "dark theme", swatch: ["#0E9F9A", "#6F5BD8"] },
  ],
  defaultPalette: "day",
  hero: { az: -32, el: 8 },     // the site's opening shot: from the platform, toward the nose
  light: 143,                    // streetcar.js lightW: lights the platform side
  build(palette) {
    const s = createStreetcar([]);
    s.setTheme(palette === "night");
    const car = s.scene.children[0];
    s.scene.remove(car);
    overrideUniforms(car, { uLight: shared.light });
    return car;
  },
};

export const subway = {
  id: "subway",
  name: "TTC subway train (earlier finale)",
  source: "landing/subway.js",
  palettes: [{ id: "site", label: "Lilac", note: "original", swatch: ["#F1EFF8", "#E09DFF"] }],
  defaultPalette: "site",
  hero: { az: -32, el: 8 },
  light: 143,
  build() {
    const s = createSubway([]);
    const train = s.scene.children[0];
    s.scene.remove(train);
    overrideUniforms(train, { uLight: shared.light });
    return train;
  },
};
