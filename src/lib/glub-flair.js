// "Flair": preset ambient effects for your whole chat line - a theme for your
// message row rather than for the app chrome. Distinct from "&"-code formatting
// (format.js), which owns text colors and styles: flair owns MOTION around the
// line, and the two compose freely.
//
// Everything is drawn procedurally by CSS keyframes (see .flair-* in style.css) -
// no images, no GIFs, no canvas, and no per-frame JavaScript at all. Each effect
// animates only `opacity` and `transform` on one or two pseudo-elements, which the
// browser hands to the compositor, so a screenful of flaired lines costs
// essentially nothing on the main thread. Particle fields are one 2px dot cloned
// by `box-shadow` into a dozen sparks, so a whole ember shower is a single
// composited layer.
//
// This module is the registry only, kept DOM-free so it can be reasoned about (and
// tested) in isolation. A name reaching the DOM becomes a CSS class, so the
// whitelist here is load-bearing: unknown names resolve to "" rather than being
// interpolated into markup.

export const FLAIRS = ["fire", "lightning", "stars", "rain", "plume", "neon", "matrix", "sonar", "fireflies", "bubbles", "aurora", "bitcoin", "glitch", "sol"];

const KNOWN = new Set(FLAIRS);

// How many of THIS flair may animate on screen at once. 0 = no limit.
//
// The flairs are nowhere near equally expensive, so one global cap is the wrong
// knob: it's either too tight for the cheap ones or too loose for the dear ones.
// Four of these are a couple of pseudo-elements animating opacity and transform,
// which the compositor eats by the screenful. Plume is a different animal - two
// animated pseudo-elements plus half a dozen BLURRED, screen-BLENDED blobs and
// their motes, each on its own animations. Blur and blend are the expensive words:
// they can't be composited as cheaply as a transform, and they stack.
//
// So the number lives next to the effect that earns it. Anything new starts at 0
// and only gets a limit if it's measured to need one.
const FLAIR_LIMITS = {
	fire: 0,
	lightning: 0,
	stars: 0,
	rain: 0,
	plume: 3,
	// two pseudo-elements animating opacity and nothing else - no blur, no blend, no
	// particles. Cheaper than any of the others, so it starts uncapped like they did.
	neon: 0,
	// The only flair made of TEXT, and it is the node count that earns it a cap
	// rather than blur: a column is a stack of glyph cells plus a strip of them for
	// the head, so one row builds ~110 elements where rain builds ten. Measured at
	// ~20 composited animations per row, which is fine by itself and is not fine
	// twenty rows deep. Capped a little above plume, whose blur is dearer per row.
	matrix: 4,
	// three rings, two pseudo-elements, and every one of them animating nothing but
	// opacity and a scale. No blur, no blend, no glyphs, and a fifth of rain's node
	// count. Starts uncapped, per the rule above.
	sonar: 0,
	// four or five small dots, three composited animations each, and a glow that is a
	// pair of static box-shadows rather than a filter - so it rasterizes once and
	// costs nothing per frame. The cheapest particle flair here.
	fireflies: 0,
	// fire's construction with fire's costs: one element per bubble, three composited
	// animations each, and nothing blurred or blended anywhere. The highlight is a
	// pseudo-element on the bubble, which is a node rather than a frame's work.
	// Starts uncapped, per the rule above.
	bubbles: 0,
	// Six soft curtains plus a blurred layer and a star field. The filter is one
	// rasterized layer per row, so keep the number of simultaneous aurora rows low.
	aurora: 6,
	// The circuit board. Measured at ~50 positioned spans plus one small svg. None of
	// them is blurred,
	// blended or filtered, so what earns the cap is node count rather than paint -
	// the same thing that earns matrix its 4, and this sits a little under matrix.
	//
	// The COST is spiky rather than steady, which is why the cap is not the only
	// guard: a standing board is fifty static divs and no animations at all, and then
	// a surge starts one short opacity animation on each of them at once. The ticker
	// caps how many boards may surge in a tick (CIRCUIT_MAX_PER_TICK); this caps how
	// many may stand.
	bitcoin: 5,
	// Nothing standing at all: between tears a glitch row is two pseudo-elements, the
	// same as aurora. What it costs is entirely in the one-shot, where it briefly
	// clones the row's own content two or three times - and that is bounded by the
	// ticker's per-tick cap rather than by how many rows are up.
	glitch: 0,
	// Two gradient sheets and a handful of soft ellipses. The softness is a
	// radial-gradient background rather than a filter, which is the whole reason this
	// starts uncapped where plume is capped at three: plume's blobs are BLURRED and
	// screen-BLENDED, and both of those words cost a frame's work every frame. A
	// gradient rasterizes once. Nearer fireflies than plume in every way that bills.
	sol: 0,
};

// how many of `raw` may animate at once; 0 for unlimited (and for unknown names,
// which render nothing anyway).
export function flairLimit(raw) {
	const n = flairName(raw);
	return n && FLAIR_LIMITS[n] > 0 ? FLAIR_LIMITS[n] : 0;
}

// names this flair used to answer to. Renaming a flair is not free: the choice is
// persisted in localStorage indefinitely, and it rides along on every message in the
// `glub` tag, so a peer on an older build is still sending the old name
// right now. Without this table both would fall through the whitelist below and
// resolve to "" - a saved preference would silently vanish and their rows would
// render bare. One line each is cheaper than either failure.
// ("circuit" was this flair's name for one release; anyone who set it in that window
// has it in localStorage and on every message they have sent since.)
const ALIASES = { plasma: "plume", circuit: "bitcoin" };

// normalize an untrusted flair name (yours or a peer's) to a known one, or "".
export function flairName(raw) {
	const s = String(raw || "").trim().toLowerCase();
	const n = ALIASES[s] || s;
	return KNOWN.has(n) ? n : "";
}

// the class pair a flaired element needs: the shared base plus the effect itself.
// "" for an unknown name, so callers can concatenate unconditionally.
export function flairClass(raw) {
	const n = flairName(raw);
	return n ? `flair flair-${n}` : "";
}

// --- per-line randomization ---------------------------------------------------
// An effect built from fixed keyframes looks mechanical: every line twinkles the
// same shape, at the same moment, forever. So the *inputs* are randomized per
// line instead - the star field, the twinkle periods, the phase offsets - and
// handed to CSS as custom properties. The animations stay pure CSS (compositor,
// no per-frame JS); the randomness costs a few Math.random() calls the one time a
// line is built. Every message gets its own night sky.

const rnd = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];

// flairs that want an extra one-shot layer in the markup, fired by a shared ticker
// (see app.js): the stars flair's shooting star, the lightning flair's strike.
// (fire and rain instead use it as a persistent container of individual particles:
// one element per spark/drop is the only way each gets its own spawn time and path,
// which a box-shadow field - one element, one animation - cannot give.)
const FX_FLAIRS = new Set(["stars", "lightning", "fire", "rain", "plume", "neon", "matrix", "sonar", "fireflies", "bubbles", "aurora", "bitcoin", "glitch", "sol"]);

export function flairHasFx(raw) {
	return FX_FLAIRS.has(flairName(raw));
}

// what a flair's fx layer starts life containing. Empty for the one-shot effects
// (stars/lightning fill it at fire time); fire pre-populates it with its embers,
// emitted from messageHtml so they survive every in-place rerender.
function auroraCurtainMarkup() {
	let html = "";
	for (let i = 0; i < 6; i++) {
		html += `<span class="auroraCurtain" style="--c-i:${i}" aria-hidden="true"></span>`;
	}
	return html;
}

function starBandMarkup() {
	let html = "";
	for (let i = 0; i < 6; i++) {
		const top = (5 + i * 15 + rnd(-3, 3)).toFixed(1);
		const left = Math.round(rnd(0, 48));
		const field = particleField(14 + ((Math.random() * 7) | 0), 54, 5, STAR_TINTS);
		const dur = rnd(3.2, 6.8).toFixed(2);
		const delay = rnd(0, 6).toFixed(2);
		html += `<span class="starBand" style="--sb-top:${top}%;--sb-left:${left}px;--sb-field:${field};--sb-dur:${dur}s;--sb-delay:-${delay}s"></span>`;
	}
	return html;
}

export function flairFxInner(raw) {
	const n = flairName(raw);
	if (n === "stars") return starBandMarkup();
	if (n === "aurora") return auroraCurtainMarkup();
	if (n === "fire") return fireEmberMarkup();
	if (n === "rain") return rainDropMarkup();
	if (n === "plume") return plumePuffMarkup();
	// neon's fx layer holds the one part of it that isn't tube: the segment that
	// gives out. Both pseudo-elements are spoken for - one is the colored glass,
	// the other the filament running down the middle of it.
	if (n === "neon") return `<span class="neonDead"></span>`;
	if (n === "matrix") return matrixColumnMarkup();
	if (n === "sonar") return sonarPingMarkup();
	if (n === "fireflies") return fireflyMarkup();
	if (n === "bubbles") return bubbleMarkup();
	// the board is persistent: it is this row's circuitry, not a thing that happens to
	// it, so it is drawn once and the surge only lights what is already there
	if (n === "bitcoin") return circuitBoardMarkup();
	if (n === "sol") return solRayMarkup();
	return "";
}

// A persistent overlay laid over the row - including over its TEXT, which is what
// separates it from the fx layer above. Two other things separate it: the ticker
// never empties and refills it, and the animation budget never parks it. .flairFx is
// hidden outright on a quiet row because particles cost frames; this is one static
// gradient that costs none, and a row that lost it would visibly stop matching its
// neighbours.
//
// Three flairs want one and all three want the same thing - a screen you are reading
// THROUGH rather than at. (Sonar is the third: a scope is a display in exactly the way
// a tube and a monitor are, and without the glass its rings read as ripples in water
// rather than as a trace on a screen.) Every other flair pays nothing, not even an
// empty node.
// (glitch is the fourth, and it belongs: a tear is a fault in a SIGNAL, and a signal
// needs a screen to be a fault on. Without the glass the bands read as the text
// sliding about of its own accord.)
const SCANLINE_FLAIRS = new Set(["neon", "matrix", "sonar", "glitch"]);

export function flairOverlayInner(raw) {
	return SCANLINE_FLAIRS.has(flairName(raw)) ? `<span class="flairScan" aria-hidden="true"></span>` : "";
}

// cool white-blues, so a field reads as starlight rather than confetti
const STAR_TINTS = ["#ffffff", "#ffffff", "#cfe6ff", "#a8ccff", "#dbe9ff", "#bcd8ff", "#e9f2ff"];

// one 2px dot is cloned into a whole field by box-shadow, so a random field is
// just a random offset list - still a single composited layer no matter how many
// particles it holds. X advances by a jittered step rather than being uniformly
// random, which keeps particles from clumping the way pure noise does.
function particleField(count, step, jitterY, tints) {
	const out = [];
	let x = 0;
	for (let i = 0; i < count; i++) {
		x += rnd(step * 0.55, step * 1.45);
		out.push(`${Math.round(x)}px ${Math.round(rnd(-jitterY, jitterY))}px ${pick(tints)}`);
	}
	return out.join(", ");
}

// --- procedural lightning ------------------------------------------------------
// A bolt is generated as SVG markup on the fly - a jagged polyline down the row
// with a soft wide stroke under a bright thin core, plus a fork about half the
// time. No assets and no canvas: it's a string, built only at the moment a strike
// fires and dropped from the DOM again when the animation ends. Every bolt is a
// different shape.
export function lightningStrikeMarkup(w, h) {
	const width = Math.max(60, Math.round(w));
	const height = Math.max(8, Math.round(h));
	const jitter = width * 0.055;
	const segs = 3 + ((Math.random() * 3) | 0);
	const pts = [];
	let x = width * (0.12 + Math.random() * 0.76);
	for (let i = 0; i <= segs; i++) {
		const y = (height / segs) * i;
		pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
		x = Math.max(2, Math.min(width - 2, x + (Math.random() * 2 - 1) * jitter));
	}
	const main = pts.join(" ");
	// a fork peels off a middle vertex and dies partway down
	let fork = "";
	if (Math.random() < 0.55 && pts.length > 2) {
		const i = 1 + ((Math.random() * (pts.length - 2)) | 0);
		const [fx, fy] = pts[i].split(",").map(Number);
		const dir = Math.random() < 0.5 ? -1 : 1;
		const f = [
			`${fx.toFixed(1)},${fy.toFixed(1)}`,
			`${(fx + dir * jitter * 1.6).toFixed(1)},${Math.min(height, fy + height * 0.22).toFixed(1)}`,
			`${(fx + dir * jitter * 2.4).toFixed(1)},${Math.min(height, fy + height * 0.44).toFixed(1)}`,
		].join(" ");
		fork = `<polyline class="boltGlow" points="${f}"/><polyline class="boltCore" points="${f}"/>`;
	}
	// the flash sits under the bolt so a strike lights the whole row, not just the
	// path - that's what makes it read as lightning rather than a drawn squiggle.
	// Wrapped in one node so a caller can APPEND and remove it: the rain flair keeps
	// its drops in the same layer, and replacing the layer's contents would wipe them.
	return (
		`<span class="strike">` +
		`<span class="boltFlash"></span>` +
		`<svg class="boltSvg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">` +
		`<polyline class="boltGlow" points="${main}"/><polyline class="boltCore" points="${main}"/>${fork}` +
		`</svg>` +
		`</span>`
	);
}

// embers glow warm; ash is what's left of them, so field B mixes dull greys in
const EMBER_TINTS = ["#ffb057", "#ff7a18", "#ffd08a", "#ff9d3d", "#ffc46b", "#ff6a00"];
const ASH_TINTS = ["#8a7f77", "#6d635c", "#b9a89a", "#c9762f", "#7d726a", "#ffa14d"];

// a drifting particle's lateral path, as offsets the keyframes ease through. Signs
// alternate around a constant `lean` (the line's prevailing draft) so the particle
// serpentines rather than travelling straight. Amplitudes are deliberately gentle:
// big alternating offsets read as a jolt at every waypoint, not a float.
function wobble(prefix, amp, lean) {
	const d = Math.random() < 0.5 ? -1 : 1;
	return {
		[`${prefix}1`]: `${(d * amp * 0.4 + lean * 0.3).toFixed(1)}px`,
		[`${prefix}2`]: `${(-d * amp * 0.5 + lean * 0.65).toFixed(1)}px`,
		[`${prefix}3`]: `${(d * amp * 0.35 + lean).toFixed(1)}px`,
	};
}

// --- individual embers ----------------------------------------------------------
// The bright embers can't be a box-shadow field: one element means ONE animation,
// so every clone is locked to the same spawn moment and the same path - the tell
// that made the old shower look like a marching row. Each ember is its own span
// instead, and gets TWO animations that compose into the final transform:
//
//   `translate` (rise + lifetime) - linear, so vertical speed stays steady
//   `transform` (sway)            - ease-in-out + alternate, a smooth oscillation
//
// Because the two run at unrelated periods, the combined path is a non-repeating
// serpentine with no corners in it, and because every ember has its own period and
// a random negative delay, they drift in and out of phase forever: sometimes a
// cluster, sometimes a lull with nothing rising at all. The `emberShort` variant
// dies partway up, so a given spark may or may not make it.
const EMBER_MIN = 5;
const EMBER_MAX = 7;

export function fireEmberMarkup() {
	const count = EMBER_MIN + ((Math.random() * (EMBER_MAX - EMBER_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		const short = Math.random() < 0.4; // ~2 in 5 burn out before the top
		const size = Math.random() < 0.25 ? 3 : 2;
		const style = [
			`--e-x:${Math.round(rnd(4, 92))}%`,
			`--e-size:${size}px`,
			`--e-tint:${pick(EMBER_TINTS)}`,
			`--e-peak:${rnd(0.62, 1).toFixed(2)}`,
			`--e-lift:${rnd(1.5, 2.6).toFixed(2)}em`,
			`--e-amp:${rnd(3, 11).toFixed(1)}px`,
			// unrelated periods for rise vs sway, each phase-shifted on its own
			`--e-rise:${rnd(2.8, 6.4).toFixed(2)}s`,
			`--e-rise-delay:-${rnd(0, 7).toFixed(2)}s`,
			`--e-sway:${rnd(1.3, 2.9).toFixed(2)}s`,
			`--e-sway-delay:-${rnd(0, 3).toFixed(2)}s`,
		].join(";");
		html += `<span class="ember${short ? " emberShort" : ""}" style="${style}"></span>`;
	}
	return html;
}

// --- rain ----------------------------------------------------------------------
// Rain is the first flair whose motion goes DOWN, and the detail that sells it is
// the impact: rather than decorating the bottom edge with unrelated rings, each
// drop IS its own ripple - at the end of its fall it flattens and spreads into a
// wide, thin ellipse (transform-origin at its foot), so every splash is
// perfectly correlated with a real drop and costs no extra element.
//
// Two animations per drop compose into the transform, as with embers, but here they
// share one period so the fall and the splash stay in phase:
//   `translate` - the fall (linear, plus this line's wind lean) + opacity
//   `transform` - the splash (a scale that flattens the drop on landing)
const RAIN_TINTS = ["#cfe4f5", "#9fc0d8", "#eaf4ff", "#b9d3e6", "#8fb0c8", "#dceaf6"];
const DROP_MIN = 7;
const DROP_MAX = 10;

// The one value here that is deliberately NOT randomized. Everything else about a
// drop varies per line, but wind does not: a screenful of rain messages each
// slanting their own way reads as chaos, not weather, because a real downpour has a
// single prevailing direction across the whole scene. So the drift is a constant and
// only its magnitude wobbles slightly per drop - enough that the streaks aren't a
// printed pattern, never enough to flip one against the rest.
const RAIN_WIND_PX = 7; // horizontal drift over a full fall, same for every line

export function rainDropMarkup() {
	const count = DROP_MIN + ((Math.random() * (DROP_MAX - DROP_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		// same wind on every line and every drop, give or take a little (see RAIN_WIND_PX)
		const drift = RAIN_WIND_PX * rnd(0.85, 1.15);
		// the streak is tilted to match the direction it's actually travelling -
		// a vertical dash drifting sideways reads as sliding, not falling
		const tilt = Math.max(-17, Math.min(17, drift * 1.6));
		const style = [
			`--d-x:${Math.round(rnd(2, 96))}%`,
			`--d-len:${rnd(5, 10).toFixed(1)}px`,
			`--d-tint:${pick(RAIN_TINTS)}`,
			`--d-op:${rnd(0.45, 0.95).toFixed(2)}`,
			`--d-lean:${drift.toFixed(1)}px`,
			`--d-tilt:${tilt.toFixed(1)}deg`,
			`--d-ring:${rnd(7, 13).toFixed(1)}px`,
			// gravity is quick: short periods and high turnover. The random negative
			// delay scatters the spawn moments into a real shower rather than a row.
			`--d-fall:${rnd(0.34, 0.72).toFixed(2)}s`,
			`--d-delay:-${rnd(0, 1.2).toFixed(2)}s`,
		].join(";");
		html += `<span class="drop" style="${style}"></span>`;
	}
	return html;
}

// --- plume ---------------------------------------------------------------------
// A violet plume lit from the LEFT edge of the row, burning out along the top and
// bottom and dying to black toward the right. Where the other flairs are made of
// PARTICLES you can count, this one is made of volume: a few very large, very soft
// blobs drifting and swelling past each other behind the text.
//
// Two things carry the look, and neither is the blobs themselves.
//
// First, `screen` blending: where two puffs overlap their light ADDS, which is what
// a camera does when it can't hold the highlights - lit evenly, but wherever the
// volume is densest the value clips and blows out toward white. Painting those hot
// spots directly would mean deciding up front where they go; letting overlap decide
// means they move as the plume moves and land somewhere new on every line, free.
//
// Second, everything is masked by one left-to-right falloff (see the stylesheet), so
// the plume is brightest where a line starts and gone by the time it ends. Puffs are
// biased to the left THIRD to match, rather than relying on the mask alone to hide
// blobs that shouldn't have been drawn further out in the first place. The plume is
// an accent on the start of a line, not a background behind the whole of it.
//
// Three animations compose per puff, all with unrelated periods and their own phase:
//   `translate` - the drift (ease-in-out + alternate: a lazy wander, no corners)
//   `transform` - the swell (scale, ditto - plume breathes, it doesn't pulse)
//   `opacity`   - the density passing through the light
// Nothing shares a period with anything else, so the field churns rather than
// looping, and no two lines are ever at the same moment of it.
const PLASMA_TINTS = ["#a855f7", "#c084fc", "#8b5cf6", "#9333ea", "#b06cf0", "#7e3ff2"];
// the blown-out centres - near-white with only a hint of the violet left in them
const PLASMA_CORES = ["#f3e8ff", "#efe0ff", "#ffffff", "#e9d5ff", "#f7efff"];
const PUFF_MIN = 4;
const PUFF_MAX = 6;

// Motes: a few specks that spawn out in the dark, where the plume's glow has
// already tapered off, and drift LEFT into it - so the plume reads as drawing them
// in rather than shedding them. They fade up out of nothing at the far end and are
// swallowed (fading again) as they reach the bright edge, which is what sells the
// direction: something that arrives from the dark and doesn't come out the other
// side has been consumed.
//
// Sparse on purpose. A dense stream would read as rain blowing sideways; two or
// three at a time, on long unrelated periods, reads as the odd particle being
// pulled in. They travel with a slight vertical drift so they arc rather than
// tracking a ruled line.
const MOTE_TINTS = ["#e9d5ff", "#c084fc", "#f3e8ff", "#d8b4fe", "#a855f7"];
const MOTE_MIN = 2;
const MOTE_MAX = 4;

function plumeMoteMarkup() {
	const count = MOTE_MIN + ((Math.random() * (MOTE_MAX - MOTE_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		const style = [
			// starts beyond where the glow has faded out, ends inside the bright edge
			`--m-from:${Math.round(rnd(62, 108))}%`,
			`--m-to:${Math.round(rnd(4, 20))}%`,
			`--m-y:${Math.round(rnd(12, 88))}%`,
			`--m-rise:${rnd(-7, 7).toFixed(1)}px`,
			`--m-size:${Math.random() < 0.3 ? 2 : 1.4}px`,
			`--m-tint:${pick(MOTE_TINTS)}`,
			`--m-op:${rnd(0.4, 0.85).toFixed(2)}`,
			// slow, and long gaps between: the delay is a big negative so most motes
			// spend most of the cycle already gone
			`--m-dur:${rnd(4.5, 9.5).toFixed(2)}s`,
			`--m-delay:-${rnd(0, 9).toFixed(2)}s`,
		].join(";");
		html += `<span class="mote" style="${style}"></span>`;
	}
	return html;
}

export function plumePuffMarkup() {
	const count = PUFF_MIN + ((Math.random() * (PUFF_MAX - PUFF_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		// larger than the row is tall (a blob small enough to read as a shape stops
		// reading as volume) but no larger than it needs to be. Size and position are
		// now the ONLY things keeping the blobs on the lit side - the layer they live in
		// dropped its mask so the motes could be seen out in the dark - so an oversized
		// or right-leaning blob puts color where the plume should already be gone.
		const size = Math.round(rnd(54, 108));
		const style = [
			`--p-x:${Math.round(rnd(-18, 19))}%`,
			`--p-y:${Math.round(rnd(15, 85))}%`,
			`--p-size:${size}px`,
			`--p-tint:${pick(PLASMA_TINTS)}`,
			`--p-core:${pick(PLASMA_CORES)}`,
			`--p-blur:${Math.round(rnd(10, 22))}px`,
			`--p-op:${rnd(0.28, 0.55).toFixed(2)}`,
			`--p-dx:${rnd(-16, 16).toFixed(1)}px`,
			`--p-dy:${rnd(-9, 9).toFixed(1)}px`,
			`--p-swell:${rnd(1.12, 1.42).toFixed(2)}`,
			`--p-drift-dur:${rnd(7.5, 15).toFixed(2)}s`,
			`--p-drift-delay:-${rnd(0, 14).toFixed(2)}s`,
			`--p-swell-dur:${rnd(4.6, 9.4).toFixed(2)}s`,
			`--p-swell-delay:-${rnd(0, 9).toFixed(2)}s`,
			`--p-breathe-dur:${rnd(5.2, 11).toFixed(2)}s`,
			`--p-breathe-delay:-${rnd(0, 10).toFixed(2)}s`,
		].join(";");
		html += `<span class="puff" style="${style}"></span>`;
	}
	// the motes ride in the same layer, so they're masked and blended with the plume
	return html + plumeMoteMarkup();
}

// the plume surging: one dense billow that swells out of nowhere and thins away.
// Appended and removed like the rain squall, so it never disturbs the puffs it
// passes through - it just briefly gives them something much brighter to overlap.
// Kept to the lit half of the row, since that's where the plume lives.
export function plumeSurgeMarkup() {
	return (
		`<span class="surge" style="` +
		`--ps-x:${Math.round(rnd(1, 20))}%;` +
		`--ps-tint:${pick(PLASMA_TINTS)};` +
		`--ps-core:${pick(PLASMA_CORES)}` +
		`"></span>`
	);
}

// a squall: one translucent slanted sheet driven across the row. Appended for the
// ~600ms it lasts and removed again, so it never disturbs the drops it passes.
export function rainGustMarkup() {
	const tilt = rnd(8, 16) * (Math.random() < 0.5 ? -1 : 1);
	return `<span class="gust" style="--g-tilt:${tilt.toFixed(1)}deg"></span>`;
}

// --- matrix ---------------------------------------------------------------------
// The first flair made of TEXT. Every other effect here is a fill - a gradient, a
// box-shadow field, a blurred blob - and this one is glyphs, which is the whole
// reason it looks like nothing else in the list.
//
// The signature detail of the falling-code look isn't the falling. It's that the
// glyph at the head of a column KEEPS CHANGING while it falls. That normally means
// rewriting text content every few frames, which is exactly the per-frame JavaScript
// this module has never needed - so instead the head is a sprite sheet made of text:
// a cell clipped to one glyph tall, holding a vertical strip of glyphs, translated by
// a `steps()` animation. The strip jumps a whole glyph at a time, the cell shows one,
// and the character appears to churn. One compositor animation, no JS, no reflow.
//
// Half-width katakana, as the film uses. They are the risk in this flair: a monospace
// stack that has no CJK coverage falls back per-glyph, and fallback advance widths
// vary. So every cell is a fixed 1em box with the glyph centred in it - a substituted
// glyph can look different, but it cannot move the column it sits in.
const MATRIX_GLYPHS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789";
// Glyphs in a head's strip. Mirrored by `steps()` and the translate distance in
// .mtxReel's keyframes - CSS cannot read a custom property inside steps(), so the
// two have to agree by hand. A harness asserts they do.
const MATRIX_REEL_LEN = 5;
const MATRIX_TRAIL_MIN = 2;
const MATRIX_TRAIL_MAX = 3;
const MATRIX_COL_MIN = 8;
const MATRIX_COL_MAX = 11;

const glyph = () => MATRIX_GLYPHS[(Math.random() * MATRIX_GLYPHS.length) | 0];

function matrixReel() {
	let out = "";
	for (let i = 0; i < MATRIX_REEL_LEN; i++) out += `<i>${glyph()}</i>`;
	return `<span class="mtxReel">${out}</span>`;
}

export function matrixColumnMarkup() {
	const count = MATRIX_COL_MIN + ((Math.random() * (MATRIX_COL_MAX - MATRIX_COL_MIN + 1)) | 0);
	// Columns are spread by a jittered STEP rather than placed at uniform-random x,
	// for the same reason the particle fields are (see particleField): pure noise
	// clumps, and a clump plus a bare patch reads as a handful of stray glyphs rather
	// than as rain. The step keeps them apart; the jitter keeps them off a grid.
	const step = 100 / count;
	let x = rnd(-step * 0.4, step * 0.4);
	let html = "";
	for (let i = 0; i < count; i++) {
		x += step * rnd(0.62, 1.38);
		const trail = MATRIX_TRAIL_MIN + ((Math.random() * (MATRIX_TRAIL_MAX - MATRIX_TRAIL_MIN + 1)) | 0);
		// the trail is drawn ABOVE the head and dims with distance from it: the column
		// is falling, so what's behind it is what it has already lit and left.
		let body = "";
		for (let d = trail; d >= 1; d--) {
			// falls off with distance from the head, but never to nothing - a trail that
			// fades to invisible is just a head, and the tail is what reads as a column.
			body += `<span class="mtxGlyph" style="--m-dim:${(1 / (1 + d * 0.45)).toFixed(2)}">${glyph()}</span>`;
		}
		const style = [
			`--m-x:${Math.max(0, Math.min(97, x)).toFixed(1)}%`,
			`--m-size:${rnd(10, 13).toFixed(1)}px`,
			`--m-op:${rnd(0.8, 1).toFixed(2)}`,
			// Fast, because this is a terminal spitting out lines rather than snow
			// drifting past. A column crosses the row in about a second, and the head
			// churns several times inside that - the churn is what actually reads as
			// a machine printing, so it's the quicker of the two by a wide margin.
			// The two periods stay unrelated, so a column never lands on the same
			// glyph at the same height twice.
			`--m-fall:${rnd(0.55, 1.3).toFixed(3)}s`,
			`--m-delay:-${rnd(0, 2).toFixed(3)}s`,
			// This is a period for the WHOLE strip, so the per-character rate is this
			// over MATRIX_REEL_LEN. Pushed much below about a quarter-second the head
			// stops reading as characters at all and becomes a flickering dot - which
			// is faster but says less. Around 10-20 changes a second it still reads as
			// a machine printing something.
			`--m-reel:${rnd(0.26, 0.5).toFixed(3)}s`,
			`--m-reel-delay:-${rnd(0, 0.5).toFixed(3)}s`,
		].join(";");
		html += `<span class="mtxCol" style="${style}">${body}<span class="mtxHead">${matrixReel()}</span></span>`;
	}
	return html;
}

// --- sonar ----------------------------------------------------------------------
// A node pinging the mesh. Concentric rings leave one point on the row and fade as
// they widen.
//
// This is the first flair whose motion is RADIAL. Every other effect here travels
// along an axis - fire and ash up, rain and code down, the plume left to right - and
// axial motion is a language they now share whether they meant to or not. Expansion
// from a point is the one thing none of them can look like.
//
// The row is a slot cut across the scope, so a ring is a whole circle for the first
// moment of its life and two arcs travelling apart for the rest of it. That clipping
// is the effect rather than a compromise with it: a wavefront seen through a
// letterbox is two arcs, and it is what makes a 22px-tall row read as a window onto
// something much larger than the row.
//
// ONE origin per line, not several. Two or three points on a row read as noise; one
// reads as this message being a node that transmitted, which is the whole idea. So
// the variation that keeps a screenful from pulsing in unison is all at the row level
// - where the ping leaves from, how often it goes out, how far it carries, and a
// phase offset so no two rows are at the same moment of it.
//
// Nothing is drawn AT the origin. A dot there was the obvious thing to put in and it
// turned out to be the wrong one: it made the row look like it had a control on it,
// and the wavefronts read better arriving out of nothing.
//
// --- pacing ---------------------------------------------------------------------
// A burst of rings, and then a long silence. This is the whole feel of the effect and
// it is not what the obvious arrangement gives you: rings spaced evenly around the
// cycle mean there is ALWAYS a wavefront somewhere, which is a rhythm rather than a
// scan, and a rhythm has nothing to wait for.
//
// So the three rings leave close together - a fraction of a cycle apart, --son-gap -
// and each one has finished travelling by a little past halfway through. What is left
// is dead time, and the dead time is the effect: a slow ping goes out, you watch it
// run out to nothing, and then there is a few seconds of empty water before the next
// one. That is the part that builds.
//
// The rings themselves carry almost nothing: an index each. They take the cycle from
// --son-ping and their spacing from --son-gap, so the burst stays tight whatever
// cycle the row happened to draw, and stays tight without this function and flairVars
// having to agree on a random number they each draw separately.
const SONAR_RINGS = 3;

export function sonarPingMarkup() {
	let html = "";
	for (let i = 0; i < SONAR_RINGS; i++) {
		html += `<span class="ping" style="--r-i:${i}" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false" aria-hidden="true"><circle class="pingHalo" cx="50" cy="50" r="5"></circle><circle class="pingCore" cx="50" cy="50" r="5"></circle></svg></span>`;
	}
	return html;
}

// The contact: something out in the dark that the sweep finds, loses, and finds again
// a little further along. The one part of this flair that is an event rather than a
// rhythm.
//
// Structure only - no position and no timing. Both belong to whoever can see the
// wavefronts: a contact is lit by a ring ARRIVING at it, so the moment it flashes has
// to be worked out against a live animation, and its range has to be inside the band
// a wavefront actually sweeps. That is app.js's job (see sonarBlip); this keeps the
// class names in the one file that owns them.
//
// Just the dot. It had a small ring of its own, expanding out of it as it lit, and
// that was one idea too many: radial expansion is what the SWEEP does, so giving the
// contact its own made the row look like it had two emitters on it. A contact is a
// thing the sweep found, not a second station answering back.
export function sonarBlipMarkup() {
	return `<span class="blip"><span class="blipDot"></span></span>`;
}

// --- fireflies -------------------------------------------------------------------
// A few of them meandering over the row, each glowing up and dying away on its own
// clock. The closest thing here to fire's embers, and built the same way for the same
// reason: one element per insect, because a box-shadow field is ONE animation and
// every clone in it lights at the same instant on the same path - which is the exact
// opposite of what a firefly is.
//
// What it does with that construction is fire's opposite, though. An ember GOES
// somewhere: it rises, and the sway is a decoration on the rise. A firefly has
// nowhere to be, so nothing here is a journey - it is two slow oscillations at right
// angles on unrelated periods, which traces a path that wanders and never closes.
// Three animations compose per insect, each on its own property so none of them
// clobbers another:
//
//   `translate` - the horizontal drift  (ease-in-out + alternate)
//   `transform` - the vertical bob      (ditto, on a period unrelated to the drift)
//   `opacity`   - the glow              (its own period again)
//
// The glow sharing no period with either axis is the whole trick, and it is free: an
// insect lights up somewhere new every time, forever. And since each is dark for
// about half its cycle, those dark stretches drift past each other - a row is never
// all lit or all dark, and four insects read as a good many more.
const FLY_TINTS = ["#d4ff6a", "#c8ff5a", "#b6f542", "#eaff9c", "#ffe98a", "#ddff7e"];
// A few more than you see at once: each is dark for about half its cycle, so a row
// of five is showing two or three at any moment.
const FLY_MIN = 4;
const FLY_MAX = 6;

export function fireflyMarkup() {
	const count = FLY_MIN + ((Math.random() * (FLY_MAX - FLY_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		// One base period per insect, with the other two derived as FRACTIONS of it
		// rather than drawn independently.
		//
		// Drawn independently from overlapping ranges - which is how this started - the
		// drift and the bob can come out nearly equal, and two oscillations on nearly
		// the same period trace a straight line. That is the one shape this must never
		// be, and it is not a rare corner: measured over six insects, one was already
		// coming out at 0.94 correlation between its axes, which is a fly pacing back
		// and forth along a diagonal. A ratio held well away from 1 cannot do it,
		// whatever the base happens to be. (Near 1:2 is fine and even good - it traces
		// a figure eight - which is why the band is allowed to straddle it.)
		//
		// `alternate` means the visible round trip is TWICE each of these, so the
		// numbers read faster than they look.
		const drift = rnd(3.6, 7.4);
		const bob = Math.min(4.6, Math.max(1.8, drift * rnd(0.38, 0.66)));
		let glow = Math.min(6.4, Math.max(2.6, drift * rnd(0.45, 0.9)));
		// ...and the glow is kept clear of the bob for the same kind of reason: locked
		// to the vertical oscillation, an insect would light at the same height every
		// single time.
		if (Math.abs(glow - bob) < 0.6) glow = bob + 0.9;
		const style = [
			// kept off the very top and bottom of the row, and paired with a shallow bob
			// below. A row can be a single line of about twenty pixels, and an insect
			// that wanders further than that is simply clipped away for half its life -
			// which reads as broken rather than as one leaving the frame.
			`--f-x:${Math.round(rnd(4, 92))}%`,
			`--f-y:${Math.round(rnd(22, 78))}%`,
			// the HALO's size, not the insect's - the bright part is the inner quarter of
			// it (see .fly in the stylesheet). A few are noticeably larger, which reads as
			// depth: the big ones are the near ones.
			`--f-size:${Math.round(rnd(9, 15))}px`,
			`--f-tint:${pick(FLY_TINTS)}`,
			`--f-peak:${rnd(0.72, 1).toFixed(2)}`,
			// wide horizontally, shallow vertically - the row has room in only one of
			// those directions
			`--f-ax:${rnd(9, 26).toFixed(1)}px`,
			`--f-ay:${rnd(2.5, 6).toFixed(1)}px`,
			// the three periods worked out above, each phase-shifted on its own so no two
			// insects are ever at the same point of the same cycle
			`--f-drift:${drift.toFixed(2)}s`,
			`--f-drift-delay:-${rnd(0, 9).toFixed(2)}s`,
			`--f-bob:${bob.toFixed(2)}s`,
			`--f-bob-delay:-${rnd(0, 6).toFixed(2)}s`,
			`--f-glow:${glow.toFixed(2)}s`,
			`--f-glow-delay:-${rnd(0, 6.5).toFixed(2)}s`,
		].join(";");
		html += `<span class="fly" style="${style}"></span>`;
	}
	return html;
}

// --- sol --------------------------------------------------------------------------
// Sunlight, and the shapes it makes rather than the star that sends it.
//
// There is no sun drawn anywhere in this flair. It sits off the left edge, out of
// frame, and what the row holds is only what reaches it: a bloom of glare at that edge
// and the burst of rays it throws across the sky. That is a deliberate difference from
// bitcoin, which anchors a MARK to its right edge - two flairs with an object stuck to
// an edge would read as one idea done twice. It is also just what a sunburst is: you
// are looking at the light, not at the source.
//
// THE SKY IS A PALE WASHED BLUE, and it costs something real. A message body carries
// its author's per-key colour as an inline style, which no stylesheet can override
// without taking away the one thing that tells two speakers apart. The light end of
// that palette - the pale yellows, the cyans - has little contrast left on a pale
// field. An earlier revision fixed this with a halo around every glyph and it read as
// heavy, so what carries legibility now is the sky stopping well short of white: there
// is real blue in the base, and the ramp deepens toward the far end, which is where
// most of a line's words are.
//
// THE RAYS ARE THE FX LAYER: a handful of wedges pinned by their narrow ends to the
// sun's position off frame, each one reaching, swinging and flaring on its own clock.
// Three animations each, one property apiece so they compose rather than clobber:
//
//   `transform` - scaleX, the reach: how far this ray currently throws  (alternate)
//   `rotate`    - the swing about the shared axis                       (its own period)
//   `opacity`   - the flare, on uneven stops so it catches
//
// THE FAN IS NEVER ROTATED AS A GROUP. Turning the whole burst is a searchlight: every
// ray holds its neighbour at a fixed angle and the thing reads as one rigid object
// spinning. Rays swinging independently about a shared origin open and close the gaps
// between them, which is what light through moving air actually does - the same reason
// plume varies each puff's period rather than the group's.
//
// A ray is a clipped gradient, not a blur and not a filter: it rasterizes once and then
// the compositor only ever multiplies a matrix, which is what lets this stay uncapped.
const RAY_MIN = 9;
const RAY_MAX = 14;

export function solRayMarkup() {
	const count = RAY_MIN + ((Math.random() * (RAY_MAX - RAY_MIN + 1)) | 0);
	// THE SUN'S POSITION, drawn once for the whole row: every ray starts here, or they
	// are several light sources rather than one. It sits ON the row's left edge and
	// mostly outside it, so what shows is the edge of a glare and the rays leaving it.
	//
	// Two other placements were tried and both are worse. Per-ray origins spread over
	// twenty-odd pixels and the burst reads as a smear. An origin several hundred pixels
	// ABOVE the row makes the rays arrive near-parallel, which is what distance does to
	// real light - but it puts the vanishing point out of frame, and the row stops
	// reading as a sun with rays coming off it.
	const srcX = rnd(-9, -1).toFixed(1);
	const srcY = Math.round(rnd(44, 56));
	// The fan opens around the HORIZONTAL, so the rays radiate out across the row rather
	// than down into it. Laid out in ORDER across the spread with a jitter, rather than
	// each ray taking an independent random angle: independent angles clump, and with a
	// dozen draws on one range you reliably get two rays a degree apart reading as one
	// thick ray, plus a bald patch somewhere else. Walking the spread guarantees the
	// burst covers it; the jitter is what stops it looking combed.
	//
	// The spread is wide on purpose even though a 22px row clips most of it. A ray at 30
	// degrees leaves the row within twenty pixels and stays a short spike crowded round
	// the core; a ray at 3 degrees runs most of the width. That difference in visible
	// length across the fan is what a sunburst looks like cropped to a letterbox.
	const spread = rnd(54, 78);
	const first = -spread / 2 + rnd(-5, 5);
	const step = spread / Math.max(1, count - 1);
	let html = "";
	for (let i = 0; i < count; i++) {
		const ang = first + step * i + rnd(-step * 0.34, step * 0.34);
		// One base period with the other two derived from it, the rule fireflies set:
		// two oscillations on near-equal periods trace a straight line, and a ray
		// sliding evenly along a ruler is the one thing this must never look like.
		const reach = rnd(5.5, 12);
		const turn = Math.min(19, Math.max(7, reach * rnd(1.2, 1.8)));
		let flare = Math.min(9, Math.max(3.2, reach * rnd(0.45, 0.78)));
		if (Math.abs(flare - reach) < 1.2) flare = reach * 0.55 + 1.3;
		// HOW FAR THIS ONE THROWS, and how far it pulls back. The gap between the two is
		// wide - a ray can more than double - because the brief for this is plume's:
		// lengths that grow and shrink irregularly rather than a fan that holds its
		// shape. The pair is per-ray, so one is reaching while its neighbour retreats;
		// shared endpoints would make the whole burst pump like a heart.
		const max = rnd(0.86, 1);
		const min = max * rnd(0.36, 0.68);
		const style = [
			`--r-x:${srcX}%`,
			`--r-y:${srcY}%`,
			`--r-ang:${ang.toFixed(1)}deg`,
			// long enough that the shallow rays cross the row even pulled back to --r-min;
			// the overflow on .flair clips whatever leaves.
			`--r-len:${Math.round(rnd(220, 520))}px`,
			// the wedge's thickness at its OUTER end. It narrows to nothing at the sun, so
			// near the core the fan is a set of fine spikes rather than a solid pool.
			`--r-thick:${Math.round(rnd(7, 24))}px`,
			// tight range: these are all meant to be blinding, and a fan whose members
			// differ much in brightness reads as some rays being closer than others
			`--r-peak:${rnd(0.72, 0.95).toFixed(2)}`,
			`--r-min:${min.toFixed(2)}`,
			`--r-max:${max.toFixed(2)}`,
			// the up-and-down swing about the sun. Bigger than it was when the sun was
			// far away: with the origin on the row's own edge, a few degrees at the root
			// is only a few pixels of travel where the ray crosses the row.
			`--r-swing:${rnd(2.4, 7.5).toFixed(2)}deg`,
			`--r-reach-dur:${reach.toFixed(2)}s`,
			`--r-reach-delay:-${rnd(0, 15).toFixed(2)}s`,
			`--r-turn-dur:${turn.toFixed(2)}s`,
			`--r-turn-delay:-${rnd(0, 21).toFixed(2)}s`,
			`--r-flare-dur:${flare.toFixed(2)}s`,
			`--r-flare-delay:-${rnd(0, 9.5).toFixed(2)}s`,
		].join(";");
		html += `<span class="ray" style="${style}"></span>`;
	}
	return html;
}

// the CSS custom properties a flaired line wants, as { "--name": value }. Unknown
// or var-less flairs get {} - the stylesheet carries fallbacks for every var, so a
// line (or a /flair preview chip) with no vars set still renders correctly.
// --- bubbles ------------------------------------------------------------------
// glub. The one flair the client is named after, and the closest thing here to
// fire - which is where its construction comes from: one element per bubble,
// because a box-shadow field is a single animation and every particle in it rises
// on the same clock. What is borrowed is the machinery; what it does with it is
// the opposite of an ember in every reading.
//
// An ember is a hot speck that burns out. A bubble is an OUTLINE with a hole in
// the middle, and three things separate it from a spark at a glance:
//
//   it is round and empty   a ring, not a dot - a hairline of colour with a barely
//                           tinted fill, so the row shows through it
//   it has a highlight      one small pale dot up and to the left, the specular
//                           reflection every drawn bubble has. This is what stops a
//                           ring reading as a smoke puff
//   it GROWS as it climbs   pressure drops as it rises, so a bubble swells on the
//                           way up. It is a small effect - about a fifth - but it is
//                           the one that makes the motion read as underwater rather
//                           than as slow embers
//
// Three animations per bubble, and each drives a SEPARATE property so they compose
// without fighting: `translate` carries the rise, `transform` the sway, `scale` the
// swell. Fire needs only two and puts them on translate and transform; the third
// axis is free because the individual transform properties are separate longhands.
// All three are compositor properties, so a bubble costs the same as an ember.
//
// Wider and slower than fire on purpose: an ember flicks, a bubble wobbles. The sway
// amplitude runs about double and the periods about half again as long.
const BUBBLE_TINTS = ["#5fe0d8", "#7ef0e6", "#a8f7f0", "#4fc8d8", "#6fe8ea", "#c9fdfa"];
const BUBBLE_MIN = 5;
const BUBBLE_MAX = 8;

export function bubbleMarkup() {
	const count = BUBBLE_MIN + ((Math.random() * (BUBBLE_MAX - BUBBLE_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < count; i++) {
		// a third of them are the small fast ones that never make the surface, the
		// same trick fire plays with its short embers - it stops the field reading as
		// one column of evenly spaced dots
		const short = Math.random() < 0.34;
		// A HAIRLINE outline whatever the size, which is why this is a range of whole
		// pixels rather than a scale factor: a 1px ring on a 5px bubble and a 1px ring
		// on a 10px one are the same drawing at two sizes, and a scaled one would
		// thicken its own edge as it grew.
		const size = Math.round(rnd(4, 10));
		const style = [
			`--b-x:${Math.round(rnd(4, 92))}%`,
			`--b-size:${size}px`,
			`--b-tint:${pick(BUBBLE_TINTS)}`,
			`--b-peak:${rnd(0.55, 0.92).toFixed(2)}`,
			`--b-lift:${rnd(1.6, 2.8).toFixed(2)}em`,
			// double fire's, and the reason the two read as different substances: an
			// ember is pushed by draught, a bubble is pushed by water
			`--b-amp:${rnd(7, 20).toFixed(1)}px`,
			// how much bigger it is at the surface than at the floor. Kept under a
			// quarter: past that it stops looking like pressure and starts looking like
			// the bubble coming towards you
			`--b-grow:${rnd(1.1, 1.26).toFixed(3)}`,
			// slower than an ember's, and the three periods are unrelated so the path
			// never closes and the field never marches in step
			`--b-rise:${rnd(4.2, 9.5).toFixed(2)}s`,
			`--b-rise-delay:-${rnd(0, 9).toFixed(2)}s`,
			`--b-sway:${rnd(2.2, 4.4).toFixed(2)}s`,
			`--b-sway-delay:-${rnd(0, 4).toFixed(2)}s`,
			// tied to the rise rather than drawn on its own: the swell IS the climb, so
			// a bubble that grew on some other clock would be shrinking half way up
			`--b-grow-dur:var(--b-rise)`,
		].join(";");
		html += `<span class="bubble${short ? " bubbleShort" : ""}" style="${style}"></span>`;
	}
	return html;
}

// The pop: a bubble reaching the surface and going.
//
// Rare and one-shot, so it is fired by the shared ticker rather than by a CSS loop -
// a loop would pop on a fixed beat and always in the same place, which is the one
// thing a surprise cannot be. Two parts, because a bubble that simply faded would
// read as it drifting off screen:
//
//   the bubble  swells hard and vanishes - the burst itself
//   the ring    a hairline circle expanding out of where it was, gone almost at once
//
// Placed in the TOP of the row: bubbles pop at a surface, and the top edge is the
// only surface a chat line has.
export function bubblePopMarkup() {
	const size = Math.round(rnd(6, 11));
	const style = [
		`--p-x:${Math.round(rnd(8, 88))}%`,
		`--p-y:${Math.round(rnd(6, 42))}%`,
		`--p-size:${size}px`,
		`--p-tint:${pick(BUBBLE_TINTS)}`,
	].join(";");
	return `<span class="bubblePop" style="${style}"><span class="popRing"></span></span>`;
}

// --- bitcoin ----------------------------------------------------------------------
// A circuit board etched behind the row, dark until power runs through it, ending on
// a coin. Named for where it ends rather than what it is mostly made of: the board is
// the bulk of the drawing, but the mark at the end of it is the point.
//
// Neo waking up in the pod: what makes that shot is not the machinery, it is that you
// only see the machinery when something surges past. So this flair has no ambient
// state worth the name - a near-black field, and nothing else, until a pulse arrives
// and lights the traces it passes over. Between pulses the row looks like it has no
// flair on it at all, which is the point and is also the risk: the pulse has to be
// frequent enough that a reader connects the two.
//
// THE TRACES ARE NOT SVG, and that is worth explaining because they obviously could
// be. A trace is axis-aligned by definition - a pcb has no diagonals - so every
// segment is a rectangle, and a rectangle is a positioned span. Three things follow
// that SVG would have made harder rather than easier: the strokes stay exactly 1px at
// any row height without vector-effect (a row is 22px for one line and 90px for five,
// and a viewBox stretched across that range distorts everything in it), a pad stays
// CIRCULAR under the same stretch where an SVG circle would go oval, and each segment
// is already its own element, which is what lets the light arrive at each one
// separately. The coin is the one piece that is SVG, because it is the one piece with
// curves in it.
//
// Percentages throughout, so a board drawn once survives every reflow the row ever
// has - a wrapped line, a translation, an expanded name.
//
// THE LIGHT TRAVELS, it does not fade in. Every segment carries `--t`, its own
// position across the row as 0..1, and the surge (see circuitSurge in app.js) turns
// that into a delay. So the glow enters at the left edge, runs the traces, and
// arrives at the coin last, because the coin is furthest right.

// A board's lanes are spaced in PIXELS from the top edge, not in percentages of the
// row, and that is the one measurement that decides whether this flair is usable.
//
// A row is 22px for a one-line message and 90px for a five-line one. Lanes laid out as
// percentages put the same number of traces in both, so a short message got a board
// crushed into the height of its own text - dense, crossing every word, unreadable.
// Fixed pixel spacing makes the board a property of the SPACE rather than of the row:
// a one-line message shows the two lanes that fit and the rest fall past the bottom
// edge, where .flair's overflow clips them away for free. Longer messages get more
// board. Nothing has to know the height for that to work, which is what lets the
// markup be built once, at insert time, before there is a layout to measure.
const CIR_LANE_TOP = 4; // first lane, px below the row's top edge
const CIR_LANE_GAP = 16; // and the spacing between lanes
const CIR_LANE_MIN = 3;
const CIR_LANE_MAX = 4;
// A run is the wavefront's step size: the light arrives at a whole segment at once, so
// this is the resolution of the sweep. Long runs make the surge a slideshow; short
// ones buy smoothness with elements, and a chat log can hold hundreds of these rows.
const CIR_RUN_MIN = 7; // % of row width
const CIR_RUN_MAX = 16;

// One straight run of trace. X is a percentage (the row's width is the thing the light
// crosses); Y is pixels (see the note on lanes above).
function cirSeg(x1, y1, x2, y2) {
	const x = Math.min(x1, x2);
	const y = Math.min(y1, y2);
	const w = Math.abs(x2 - x1);
	const h = Math.abs(y2 - y1);
	const style =
		`--c-x:${x.toFixed(2)}%;--c-y:${y.toFixed(1)}px;` +
		// the trace's own width is 1px on whichever axis is the thin one
		(w > 0 ? `--c-w:${w.toFixed(2)}%;--c-h:1px;` : `--c-w:1px;--c-h:${h.toFixed(1)}px;`) +
		// a vertical run has one x, so it lights with the horizontal run that feeds it
		`--t:${(Math.max(x1, x2) / 100).toFixed(3)}`;
	return `<i class="cirSeg" style="${style}"></i>`;
}

// A branch: off the trunk at a right angle and a short run away. It used to die in a
// small hollow ring - a via - and the ring is gone: at the size a chat row gives it,
// it read as a bead on a wire rather than as a hole in a board, and the traces are
// cleaner ending bare. A branch heading below a short row's bottom edge is not a
// problem worth solving: it is clipped, and a trace leaving the board is what a real
// one does.
function cirBranch(x, y) {
	const dir = Math.random() < 0.5 ? -1 : 1;
	const y2 = Math.max(2, y + dir * rnd(9, 20));
	const x2 = Math.min(97, x + rnd(3, 9));
	return cirSeg(x, y, x, y2) + cirSeg(x, y2, x2, y2);
}

export function circuitBoardMarkup() {
	const lanes = CIR_LANE_MIN + ((Math.random() * (CIR_LANE_MAX - CIR_LANE_MIN + 1)) | 0);
	let html = "";
	for (let i = 0; i < lanes; i++) {
		let x = 0;
		let y = CIR_LANE_TOP + i * CIR_LANE_GAP + rnd(-2, 2);
		// every lane starts at the left edge: that is where the power comes in, and a
		// trace that begins in the middle of the row has nothing feeding it
		while (x < 97) {
			const run = Math.min(rnd(CIR_RUN_MIN, CIR_RUN_MAX), 98 - x);
			html += cirSeg(x, y, x + run, y);
			x += run;
			if (x >= 97) break;
			// A jog: the trace steps to another height and carries on.
			//
			// The probability is high, and that is not about looking busy. A trace that
			// runs the full width at one height is, behind a single line of text,
			// exactly a strikethrough - and the first cut of this flair struck through
			// every short message on screen. Jogging often enough that no horizontal
			// run survives more than a word or two is what stops the board reading as
			// typography. It also happens to be what a real board looks like.
			if (Math.random() < 0.72) {
				const dir = Math.random() < 0.5 ? -1 : 1;
				const y2 = Math.max(2, y + dir * rnd(4, 11));
				html += cirSeg(x, y, x, y2);
				y = y2;
			}
			if (Math.random() < 0.22) html += cirBranch(x, y);
			// some traces run off the right edge - they go somewhere else on the board -
			// and the rest simply stop
			if (x > 45 && Math.random() < 0.2) break;
		}
	}
	return html + cirCoinMarkup();
}

// --- the coin --------------------------------------------------------------------
// A solid disc with the bitcoin B knocked out of it, anchored to the right-hand edge
// and sized to the row - so it grows with a five-line message the way a seal stamped
// on a page would.
//
// ONE PATH, using fill-rule="evenodd", and that is what makes this drawable without a
// mask, without a <defs> id (which would collide across every row on screen), and
// without depending on the page's background colour. evenodd flips fill on each
// nested subpath, so the order reads exactly as the drawing does: the disc fills, the
// B's strokes cut back out of it, and the counters inside the B's two bowls fill
// again. Painting the B in the flair's own background colour would have looked
// identical and been a lie - it would break over any other surface, and the chip
// preview is another surface.
//
// THE PROPORTIONS ARE MEASURED, not eyeballed. The reference mark was straightened
// and scanned, and the numbers that came back are the ones a horizontal scanline
// gives - stem, counter and outer wall widths - because those survive the tilt the
// real logo carries and a bounding box does not. As a percentage of the disc's
// diameter: stem 9.7, counter 11.2, right wall 11.8 (so the B is 32.7 across at the
// bowl's waist), the whole mark 63.4 tall. Everything below is those figures in
// viewBox units, where the disc spans 2..98 and one percent of it is 0.96.
//
// It is drawn UPRIGHT. The real logo leans about eleven degrees and this deliberately
// does not: it sits at the end of a row of text, where a tilted mark reads as a
// rendering fault rather than as a style.
//
// The bowls are CUBICS rather than arcs. Nothing here transforms the path any more,
// but authoring them as curves is what let the shape be tuned against the reference
// by overlaying the two - and an arc cannot be scaled or skewed without becoming an
// ellipse arc, which is a trap worth not leaving lying around.
const CIR_B = {
	left: 31.5, // the stem's left edge
	stem: 9.3, // ...and its width - measured 9.7% of the disc
	bodyTop: 26.5, // the bowls, top and bottom, excluding the ticks
	bodyBot: 73.5,
	mid: 49.6, // where the two bowls meet
	top: 19.5, // the ticks reach this far past the body, top and bottom
	bot: 80.5,
	upperR: 65, // how far each bowl reaches right - the lower one is the wider,
	lowerR: 69.5, // which is what stops a B reading as an 8
	wallX: 10, // the bowl wall's thickness, right and top/bottom
	wallY: 5.6,
	waist: 5.4, // the single bar the two bowls share
	cap: 1.25, // how square the bowls' right caps are (1 = a true semicircle)
	serifW: 5, // the foot on the spine, top and bottom - see below
	serifH: 5.6,
	tickW: 6,
	tick1: 40.5,
	tick2: 51,
};

function cirCoinPath() {
	const o = CIR_B;
	// CENTRED BY CONSTRUCTION, not by the numbers happening to add up.
	//
	// They did not: measured against the disc, the mark's own bounding box sat at x=48
	// against a centre of 50, so the whole B was two units left of where it belonged -
	// small enough to look like nothing and big enough to look wrong on a disc. It is
	// an easy thing to reintroduce, too, since the mark's extent depends on the serif
	// at one end and on whichever bowl reaches furthest at the other, and neither is a
	// number anyone would think to re-check after tuning it. So the offset is computed
	// rather than baked in, and the mark stays centred through any retune.
	//
	// Horizontal only. Vertically the mark already runs 19.5..80.5, which is centred,
	// and its waist sits a shade above the middle on purpose - that is how a B is
	// drawn, and "correcting" it would be correcting the letterform.
	const markL = o.left - o.serifW;
	const markR = Math.max(o.upperR, o.lowerR);
	const dx = 50 - (markL + markR) / 2;
	const P = (x, y) => `${(x + dx).toFixed(2)},${y.toFixed(2)}`;
	const rect = (x1, y1, x2, y2) => `M${P(x1, y1)} L${P(x2, y1)} L${P(x2, y2)} L${P(x1, y2)} Z`;
	// a bowl: a flat left edge against the stem, and a right cap swept by two cubics
	const bowl = (x0, xr, yTop, yBot) => {
		const rr = (yBot - yTop) / 2;
		const ym = (yTop + yBot) / 2;
		const xa = xr - rr;
		const c = rr * 0.5523 * o.cap; // 0.5523 is the circle constant for a cubic quarter
		return (
			`M${P(x0, yTop)} L${P(xa, yTop)} C${P(xa + c, yTop)} ${P(xr, ym - c)} ${P(xr, ym)}` +
			` C${P(xr, ym + c)} ${P(xa + c, yBot)} ${P(xa, yBot)} L${P(x0, yBot)} Z`
		);
	};
	const xs = o.left + o.stem; // where the spine ends and the counters begin
	return [
		// the disc - two half arcs, so it needs no near-coincident start and end point
		"M2,50 A48,48 0 1,0 98,50 A48,48 0 1,0 2,50 Z",
		// THE SPINE IS NOT DRAWN, and that is the whole trick. It was, once - a rect
		// from `left` to `xs` - and it OVERLAPPED both bowls, which under evenodd is
		// an even number of subpaths and so filled the spine back in with gold. The B
		// came out with no upright at all, which reads as a 3. The bowls already start
		// at `left`, so the strip between there and the counters IS the spine; drawing
		// it again is what erased it.
		bowl(o.left, o.upperR, o.bodyTop, o.mid), // the two bowls...
		bowl(o.left, o.lowerR, o.mid, o.bodyBot),
		bowl(xs, o.upperR - o.wallX, o.bodyTop + o.wallY, o.mid - o.waist / 2), // ...and their
		bowl(xs, o.lowerR - o.wallX, o.mid + o.waist / 2, o.bodyBot - o.wallY), // counters
		// Serifs: a foot off the spine at each end. The bitcoin mark carries them and
		// they do more work than their size suggests - a bare spine ends flush with
		// the bowls and reads as a bar the bowls happen to sit on, where a footed one
		// reads as a letter. They sit entirely LEFT of the bowls, so unlike the spine
		// they overlap nothing and knock out cleanly.
		rect(o.left - o.serifW, o.bodyTop, o.left, o.bodyTop + o.serifH),
		rect(o.left - o.serifW, o.bodyBot - o.serifH, o.left, o.bodyBot),
		// the two strokes through top and bottom - what makes a B a bitcoin B
		rect(o.tick1, o.top, o.tick1 + o.tickW, o.bodyTop),
		rect(o.tick2, o.top, o.tick2 + o.tickW, o.bodyTop),
		rect(o.tick1, o.bodyBot, o.tick1 + o.tickW, o.bot),
		rect(o.tick2, o.bodyBot, o.tick2 + o.tickW, o.bot),
	].join(" ");
}

function cirCoinMarkup() {
	// --t just past 1: the coin is the last thing the pulse reaches, and it sits a
	// little beyond where the traces stop
	return (
		`<span class="cirCoinWrap" style="--t:1.02" aria-hidden="true">` +
		`<svg class="cirCoin" viewBox="0 0 100 100"><path fill-rule="evenodd" d="${cirCoinPath()}"/></svg>` +
		`</span>`
	);
}

// --- glitch ------------------------------------------------------------------------
// The signal tears. The row splits into two or three horizontal bands, they jump
// sideways for a few frames, and they snap back.
//
// THE ONLY FLAIR THAT DISTURBS THE LINE'S OWN GEOMETRY. Every other effect here
// happens AROUND the text - particles over it, a wash behind it, glass in front of it
// - and the text itself never moves. This one appears to break the text, which is why
// it is the one that needed a rule written down before it was built: it must never
// make a message unreadable for longer than a blink. The whole tear is under two
// hundred milliseconds and it is rare, and both of those are load-bearing rather than
// tuning.
//
// It works by CLONING. A band is a copy of the row's own content, clipped to one
// horizontal slice of it and translated sideways; the bands tile the row between them,
// and the real content is held invisible underneath for exactly as long as they exist.
// There is no other way to displace part of a line: the text is one flow, and a flow
// cannot be cut into pieces that move independently.
//
// Holding the original invisible is the dangerous part - a chat client that loses a
// message to a cosmetic effect has done something much worse than fail to animate - so
// it is done with a Web Animations keyframe rather than a class. An animation with
// fill "none" hands the element back to the stylesheet the moment it ends OR is
// cancelled, so a torn row cannot stay hidden: not if the tear is interrupted, not if
// the row is re-rendered mid-flight, not if the tab is hidden halfway through. There
// is no cleanup path to get wrong because there is no cleanup.

const GLITCH_BANDS_MIN = 2;
const GLITCH_BANDS_MAX = 3;
// How far a band slides. Small on purpose: this reads as a fault in the picture, and a
// fault does not move things halfway across the screen. Far enough to be unmistakable,
// near enough that a word displaced by it is still a word you can find.
const GLITCH_SHIFT_MIN = 4;
const GLITCH_SHIFT_MAX = 15;

// Where the row is cut, as the cumulative percentages of a vertical tiling.
//
// Contiguous by construction rather than by chance - the bands must cover the row
// between them, with no gap and no overlap, because the real content is invisible
// underneath and a gap in the tiling is a missing stripe of the message.
function glitchCuts(n) {
	const cuts = [0];
	for (let i = 1; i < n; i++) cuts.push(rnd(i / n - 0.16, i / n + 0.16) * 100);
	cuts.push(100);
	return cuts;
}

// One tear. `inner` is the row's own content, already cloned and stripped by the
// caller (only app.js can read a rendered row); `pad` is that row's padding, so the
// copies line up with the original to the pixel instead of to a hardcoded guess.
export function glitchTearMarkup(inner, pad) {
	const n = GLITCH_BANDS_MIN + ((Math.random() * (GLITCH_BANDS_MAX - GLITCH_BANDS_MIN + 1)) | 0);
	const cuts = glitchCuts(n);
	// One band stays put. A tear where every slice moves reads as the whole line
	// wobbling; one anchored slice is what makes the others look torn away from it.
	const anchored = (Math.random() * n) | 0;
	let html = "";
	for (let i = 0; i < n; i++) {
		const top = cuts[i];
		const bot = cuts[i + 1];
		// alternating signs, so the bands pull apart rather than drifting together
		const dir = i % 2 === 0 ? 1 : -1;
		const dx = i === anchored ? 0 : dir * rnd(GLITCH_SHIFT_MIN, GLITCH_SHIFT_MAX);
		const style = [
			// clip-path is set once here and never animated - only the transform moves,
			// so a band stays on the compositor for its whole short life
			`clip-path:inset(${top.toFixed(2)}% 0 ${(100 - bot).toFixed(2)}% 0)`,
			`--g-dx:${dx.toFixed(1)}px`,
			`padding:${pad}`,
		].join(";");
		html += `<span class="tearBand" style="${style}">${inner}</span>`;
	}
	return `<span class="tear" aria-hidden="true">${html}</span>`;
}

export function flairVars(raw) {
	const n = flairName(raw);
	// the signal's own idle: how the wash breathes and how often the tracking bar
	// crosses, both per line so a screenful of glitch rows is never in step
	if (n === "glitch") {
		return {
			"--gl-wash-dur": `${rnd(5.5, 10).toFixed(2)}s`,
			"--gl-wash-delay": `-${rnd(0, 9).toFixed(2)}s`,
			"--gl-wash-peak": rnd(0.55, 0.9).toFixed(2),
			// long, and mostly spent off the row: a tracking bar that crossed
			// continuously would be a scanner, and this is a fault in the hold
			"--gl-track-dur": `${rnd(7, 15).toFixed(2)}s`,
			"--gl-track-delay": `-${rnd(0, 14).toFixed(2)}s`,
			"--gl-text-dur": `${rnd(6, 11).toFixed(2)}s`,
			"--gl-text-delay": `-${rnd(0, 9).toFixed(2)}s`,
		};
	}
	// circuit keeps almost nothing here, and that is the flair rather than an
	// oversight: its board is markup and its light is a one-shot, so the only thing
	// left to vary per line is the &g wildcard's scroll.
	if (n === "bitcoin") {
		return {
			"--cir-text-dur": `${rnd(7, 12).toFixed(2)}s`,
			"--cir-text-delay": `-${rnd(0, 9).toFixed(2)}s`,
		};
	}
	// a fire never repeats itself: the glow's huff, both ember fields' speed, phase,
	// spacing, color and corkscrew all differ per line, so a screenful of fire
	// lines breathes out of step instead of pulsing as one.
	if (n === "fire") {
		const lean = rnd(-6, 9); // this line's prevailing draft
		return {
			"--fire-glow-dur": `${rnd(2.6, 5.2).toFixed(2)}s`,
			"--fire-glow-delay": `-${rnd(0, 5).toFixed(2)}s`,
			"--fire-glow-peak": rnd(0.82, 1).toFixed(2),
			"--fire-glow-low": rnd(0.34, 0.55).toFixed(2),
			// the bright embers are individual spans (see fireEmberMarkup); this field
			// is only the dim ash haze behind them, where uniform timing doesn't read
			// - it's slow, faint, and snuffs out partway up (see flairAshRise).
			"--ash-field": particleField(5, 68, 5, ASH_TINTS),
			"--ash-left": `${Math.round(rnd(8, 40))}px`,
			"--ash-dur": `${rnd(4.2, 7.5).toFixed(2)}s`,
			"--ash-delay": `-${rnd(0, 7).toFixed(2)}s`,
			...wobble("--ash-x", rnd(6, 13), lean),
			"--fire-text-dur": `${rnd(3.4, 6.2).toFixed(2)}s`,
			"--fire-text-delay": `-${rnd(0, 5).toFixed(2)}s`,
		};
	}
	// a storm is never in sync with itself: every line gets its own flash cadence,
	// phase, brightness and origin, so the room flickers unevenly like real weather.
	if (n === "lightning") {
		return {
			"--lit-haze-dur": `${rnd(4.5, 9).toFixed(2)}s`,
			"--lit-haze-delay": `-${rnd(0, 6).toFixed(2)}s`,
			"--lit-flash-dur": `${rnd(6.5, 14).toFixed(2)}s`,
			"--lit-flash-delay": `-${rnd(0, 12).toFixed(2)}s`,
			"--lit-flash-peak": rnd(0.18, 0.42).toFixed(2), // the faint sheet-lightning glow
			"--lit-flash-x": `${Math.round(rnd(12, 88))}%`, // where the glow is centred
			"--lit-text-dur": `${rnd(5.5, 9.5).toFixed(2)}s`, // the &g wildcard's flicker
			"--lit-text-delay": `-${rnd(0, 8).toFixed(2)}s`,
		};
	}
	// rain's drops carry their own timing (see rainDropMarkup); these are the row's
	// ambient layers - the overcast wash and the wet gleam along the bottom edge.
	if (n === "rain") {
		return {
			"--rain-haze-dur": `${rnd(5, 9.5).toFixed(2)}s`,
			"--rain-haze-delay": `-${rnd(0, 8).toFixed(2)}s`,
			"--rain-haze-peak": rnd(0.55, 0.9).toFixed(2),
			"--rain-text-dur": `${rnd(2.4, 4.6).toFixed(2)}s`,
			"--rain-text-delay": `-${rnd(0, 4).toFixed(2)}s`,
		};
	}
	// the puffs carry their own timing (see plumePuffMarkup); these are the row's
	// ambient layers - the violet wash, the edge burn along the top and bottom, and
	// the lamp behind the plume, which drifts so the source isn't nailed to one spot.
	if (n === "plume") {
		return {
			"--plume-wash-dur": `${rnd(6.5, 12).toFixed(2)}s`,
			"--plume-wash-delay": `-${rnd(0, 11).toFixed(2)}s`,
			"--plume-wash-peak": rnd(0.5, 0.8).toFixed(2),
			"--plume-lamp-x": `${Math.round(rnd(4, 22))}%`,
			"--plume-lamp-dur": `${rnd(9, 17).toFixed(2)}s`,
			"--plume-lamp-delay": `-${rnd(0, 16).toFixed(2)}s`,
			// how dim and how bright THIS line's plume burns between. A wide, per-line
			// swing is most of what stops a screenful of them pulsing as one organism.
			"--plume-lamp-low": rnd(0.32, 0.5).toFixed(2),
			"--plume-lamp-peak": rnd(0.74, 0.98).toFixed(2),
			// and how far it reaches, on its own period - so length and brightness are
			// never in step, which is what keeps it from looking like a single throb.
			// `far` is the once-a-cycle long throw (see flairPlumeReach): several
			// times the resting length, enough to run most of the way across a line.
			// The period is long so it stays an event rather than a rhythm.
			"--plume-reach-min": rnd(0.6, 0.82).toFixed(2),
			"--plume-reach-max": rnd(1.02, 1.24).toFixed(2),
			"--plume-reach-far": rnd(1.9, 3.3).toFixed(2),
			"--plume-reach-dur": `${rnd(16, 30).toFixed(2)}s`,
			"--plume-reach-delay": `-${rnd(0, 30).toFixed(2)}s`,
			"--plume-text-dur": `${rnd(4.5, 8.5).toFixed(2)}s`,
			"--plume-text-delay": `-${rnd(0, 8).toFixed(2)}s`,
		};
	}
	// neon is a FRAME, not a field: everything it does happens on the row's outline.
	// Two things are randomized, and they're the two that would give the trick away
	// if they weren't - the buzz's period, and everything about the failing segment.
	// A tube that always dies in the same place at the same interval is a loop; one
	// that dies somewhere new, on a period nothing else shares, is a broken sign.
	if (n === "neon") {
		// which color this tube burns. Splitting it per line is what makes a screenful
		// read as a street of signs rather than one repeated sign.
		const pink = Math.random() < 0.62; // pink leads more often - it's the warmer read
		const onTop = Math.random() < 0.5;
		return {
			"--neon-lit": pink ? "#ff2d95" : "#22e6ff",
			"--neon-halo": pink ? "#ff5cb0" : "#7ceeff",
			// how hard this tube burns. Hue alone was not enough per-line variety to
			// read: two neon rows in a row looked like one sign printed twice, where
			// two fire rows never do. Bloom carries it - it changes how much of the
			// row the tube lights. (The bend does NOT vary: the corner radius is the
			// one thing here that reads as chrome rather than as glass, and a big or
			// wandering one turns the row straight back into a button.)
			"--neon-bloom": `${rnd(6, 11).toFixed(1)}px`,
			// the hum: fast, shallow, and on its own period per line so no two tubes
			// buzz together. Anything slower than about a second stops reading as
			// electrical and starts reading as breathing.
			"--neon-hum-dur": `${rnd(0.62, 1.35).toFixed(2)}s`,
			"--neon-hum-delay": `-${rnd(0, 1.2).toFixed(2)}s`,
			// the dead-tube stutter. Long period, because it has to stay an EVENT: a
			// tube that gutters every few seconds is a strobe, and the whole point is
			// that you catch it out of the corner of your eye.
			"--neon-dead-dur": `${rnd(11, 23).toFixed(2)}s`,
			"--neon-dead-delay": `-${rnd(0, 22).toFixed(2)}s`,
			// offset so the patch straddles whichever rail fails, biased inward - it
			// has further to reach across the row than off it (see .neonDead)
			"--neon-dead-top": onTop ? "-9px" : "auto",
			"--neon-dead-bottom": onTop ? "auto" : "-9px",
			"--neon-dead-x": `${Math.round(rnd(8, 62))}%`,
			"--neon-dead-w": `${Math.round(rnd(14, 34))}%`,
			"--neon-text-dur": `${rnd(4, 7).toFixed(2)}s`,
			"--neon-text-delay": `-${rnd(0, 6).toFixed(2)}s`,
		};
	}
	// the columns carry their own timing (see matrixColumnMarkup); these are the row's
	// ambient layers - the phosphor wash and the bloom the falling code throws onto the
	// glass it's behind.
	if (n === "matrix") {
		return {
			"--mtx-wash-dur": `${rnd(4.5, 9).toFixed(2)}s`,
			"--mtx-wash-delay": `-${rnd(0, 8).toFixed(2)}s`,
			"--mtx-wash-peak": rnd(0.5, 0.85).toFixed(2),
			"--mtx-text-dur": `${rnd(3.5, 6.5).toFixed(2)}s`,
			"--mtx-text-delay": `-${rnd(0, 6).toFixed(2)}s`,
		};
	}
	// the rings carry only their index (see sonarPingMarkup); everything that decides
	// what this row's ping actually looks like is here, because all of it has to be
	// shared - the emitter and the rings must agree on where the origin is and when a
	// pulse leaves, or the dot flashes for a ring that isn't there.
	if (n === "sonar") {
		return {
			// biased to the left half: a ping needs somewhere to run, and the row runs
			// rightward. An emitter out at 90% spends its whole life against the edge.
			"--son-x": `${Math.round(rnd(8, 66))}%`,
			// kept near the middle so both arcs of a clipped ring are on screen. Off at
			// the top or bottom edge you only ever see half a wavefront, which reads as a
			// curve sliding by rather than as something expanding.
			"--son-y": `${Math.round(rnd(34, 66))}%`,
			// how far this node's ping carries before it dies. Varies per line, so some
			// rows reach most of the way across and others barely leave the origin.
			"--son-reach": `${Math.round(rnd(120, 215))}px`,
			// The whole cycle, silence included - so this is the interval between one
			// burst and the next, not the time a ring spends travelling (which is the
			// expansion window in the keyframes, a little under half of this).
			//
			// Slow, and deliberately much slower than it first was. At three or four
			// seconds a row pinged about as often as a cursor blinks and the effect read
			// as a busy indicator; at ten it reads as something sweeping open water and
			// waiting to hear back. The wide spread matters as much as the number: rows
			// on very different cycles drift in and out of step forever, so a screenful
			// never settles into one beat.
			"--son-ping": `${rnd(8.5, 12).toFixed(2)}s`,
			// how far apart the rings of a burst leave, as a fraction of the cycle. Small
			// on purpose: this is one pulse seen as three wavefronts, not three pulses.
			"--son-gap": rnd(0.075, 0.105).toFixed(3),
			// the row's own phase, so every line sits somewhere different in the cycle.
			// Drawn across the full cycle, or rows would cluster into the part of it the
			// range happened to cover.
			"--son-phase": `-${rnd(0, 12).toFixed(2)}s`,
			"--son-lit": rnd(0.7, 1).toFixed(2),
			"--son-wash-dur": `${rnd(5, 9.5).toFixed(2)}s`,
			"--son-wash-delay": `-${rnd(0, 9).toFixed(2)}s`,
			"--son-wash-peak": rnd(0.55, 0.9).toFixed(2),
			// slow: this is a sweep, and the stylesheet's gradient puts two of them in a
			// cycle, so anything quick turns a scope into a strobe.
			"--son-text-dur": `${rnd(7, 11.5).toFixed(2)}s`,
			"--son-text-delay": `-${rnd(0, 11).toFixed(2)}s`,
		};
	}
	// the insects carry their own everything (see fireflyMarkup); this is only the
	// warm dark they are seen against, breathing slowly on a per-line period.
	if (n === "fireflies") {
		return {
			"--fly-wash-dur": `${rnd(6, 12).toFixed(2)}s`,
			"--fly-wash-delay": `-${rnd(0, 11).toFixed(2)}s`,
			"--fly-wash-peak": rnd(0.55, 0.9).toFixed(2),
			"--fly-text-dur": `${rnd(6, 10).toFixed(2)}s`,
			"--fly-text-delay": `-${rnd(0, 9).toFixed(2)}s`,
		};
	}
	// the bubbles themselves carry their own timing (see bubbleMarkup); these are the
	// row's ambient layers - the tank's light and the fine carbonation behind them
	if (n === "bubbles") {
		const drift = rnd(-5, 7); // this line's current, leaning the fizz with it
		return {
			"--bub-wash-dur": `${rnd(7, 14).toFixed(2)}s`,
			"--bub-wash-delay": `-${rnd(0, 13).toFixed(2)}s`,
			"--bub-wash-peak": rnd(0.5, 0.82).toFixed(2),
			// the fizz is a cloned field rather than individual nodes, and that is the
			// right call for exactly the reason it is wrong for the bubbles: these are
			// specks a pixel across, far too small for anyone to catch that they share a
			// cadence, and one composited layer is the whole cost of them
			"--fizz-field": particleField(6, 58, 4, BUBBLE_TINTS),
			"--fizz-left": `${Math.round(rnd(6, 44))}px`,
			"--fizz-dur": `${rnd(3.4, 6.2).toFixed(2)}s`,
			"--fizz-delay": `-${rnd(0, 6).toFixed(2)}s`,
			...wobble("--fizz-x", rnd(5, 12), drift),
			"--bub-text-dur": `${rnd(6, 11).toFixed(2)}s`,
			"--bub-text-delay": `-${rnd(0, 10).toFixed(2)}s`,
		};
	}
	// Aurora has no particles to carry their own timing, so everything that makes one
	// row's sky differ from the next is here: the two sheets' drift, their lean, how
	// far each travels, and how deeply each breathes.
	//
	// The two are kept on UNRELATED periods for the reason the fireflies' axes are:
	// two sheets drifting at the same rate are one sheet, and the interference
	// between them is the entire effect. The ratio is held well away from 1.
	if (n === "aurora") {
		return {
			// The sky is one box-shadow field; the curtains are separate gel sheets.
			"--aur-stars": particleField(20, 58, 26, STAR_TINTS),
			"--aur-curtain-dur": `${rnd(12, 24).toFixed(2)}s`,
			"--aur-curtain-delay": `-${rnd(0, 22).toFixed(2)}s`,
			"--aur-sway-dur": `${rnd(9, 17).toFixed(2)}s`,
			"--aur-sway-delay": `-${rnd(0, 16).toFixed(2)}s`,
			"--aur-glow-dur": `${rnd(8, 16).toFixed(2)}s`,
			"--aur-glow-delay": `-${rnd(0, 14).toFixed(2)}s`,
			"--aur-star-dur": `${rnd(4, 8).toFixed(2)}s`,
			"--aur-star-delay": `-${rnd(0, 7).toFixed(2)}s`,
			"--aur-text-dur": `${rnd(8, 15).toFixed(2)}s`,
			"--aur-text-delay": `-${rnd(0, 13).toFixed(2)}s`,
		};
	}
	// Everything that decides whether two sol rows look like the same afternoon: how
	// hard the glare is, how fast it breathes, and the clock the words run on. The rays
	// themselves carry no per-LINE vars: everything about a ray is per-RAY and lives on
	// the element, because a burst whose members share a period is a rigid object turning
	// rather than light through moving air (see solRayMarkup).
	if (n === "sol") {
		return {
			"--sol-glare": rnd(0.85, 1).toFixed(2),
			// the glare bloom at the edge pulsing, and the corona under it breathing slower
			// still - two periods on the same source, so the light never sits perfectly still
			"--sol-shim-dur": `${rnd(4.5, 9.5).toFixed(2)}s`,
			"--sol-shim-delay": `-${rnd(0, 9).toFixed(2)}s`,
			"--sol-glow-dur": `${rnd(11, 21).toFixed(2)}s`,
			"--sol-glow-delay": `-${rnd(0, 19).toFixed(2)}s`,
			"--sol-text-dur": `${rnd(8, 14).toFixed(2)}s`,
			"--sol-text-delay": `-${rnd(0, 12).toFixed(2)}s`,
		};
	}
	if (n !== "stars") return {};
	return {
		// two independent fields: a denser one up top, a sparser one lower down
		"--star-a-field": particleField(28, 52, 11, STAR_TINTS),
		"--star-b-field": particleField(20, 68, 12, STAR_TINTS),
		"--star-a-left": `${Math.round(rnd(4, 28))}px`,
		"--star-a-top": `${Math.round(rnd(16, 40))}%`,
		"--star-b-left": `${Math.round(rnd(12, 46))}px`,
		"--star-b-top": `${Math.round(rnd(54, 80))}%`,
		// where each field re-appears after twinkling out (the keyframes move it
		// while it's invisible, so stars come back somewhere new)
		"--star-a-dx": `${Math.round(rnd(-16, 20))}px`,
		"--star-a-dy": `${Math.round(rnd(-7, 7))}px`,
		"--star-b-dx": `${Math.round(rnd(-20, 16))}px`,
		"--star-b-dy": `${Math.round(rnd(-7, 7))}px`,
		// periods differ per line AND per field, so nothing beats in unison; the
		// negative delay starts each one mid-cycle so lines never march together.
		"--star-a-dur": `${rnd(2.2, 4.8).toFixed(2)}s`,
		"--star-b-dur": `${rnd(2.8, 5.6).toFixed(2)}s`,
		"--star-a-delay": `-${rnd(0, 5).toFixed(2)}s`,
		"--star-b-delay": `-${rnd(0, 5).toFixed(2)}s`,
		// the repeating background field fills any row height, including image
		// messages; the offsets keep two rows from tiling in lockstep
		"--star-bg-x": `${Math.round(rnd(0, 160))}px`,
		"--star-bg-y": `${Math.round(rnd(0, 120))}px`,
	};
}
