// Keep the match ball readable at CSS size, independent of render resolution.
// The upper bound preserves a credible size in the optional stadium overview.
export function visibleBallDiameter(distance, fov, viewportHeight) {
 return Math.min(.5, Math.max(.2508, 6 / Math.max(1, viewportHeight) * 2 * distance * Math.tan(fov * Math.PI / 360)));
}
