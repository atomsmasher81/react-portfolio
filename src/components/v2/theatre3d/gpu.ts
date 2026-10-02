import * as THREE from "three";

// Getting a scene onto the GPU without holding up the page: its shaders
// compiled in parallel (where the browser can) and its pictures uploaded a
// few at a time, before it's first drawn. Drawn straight away instead, every
// shader is compiled and linked, and every picture uploaded, in that one
// frame: a long stall.

/**
 * Compile everything `scene` will draw (into the render target that's set now),
 * then wait, without holding up the page, until the browser has finished (it
 * compiles in parallel where it can; where it can't, it finishes when first
 * drawn). Like three's compileAsync, but that waits for ever if a material is
 * disposed meanwhile (its check throws), and this never waits longer than `ms`:
 * whatever isn't ready by then is finished when it's drawn.
 */
export function compileQuietly(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, ms = 4000) {
    gl.compile(scene, camera);
    return programsReady(gl, ms);
}

const DRAWN = ["isMesh", "isPoints", "isLine", "isSprite"] as const;
type Flags = Partial<Record<(typeof DRAWN)[number], boolean>>;

/**
 * gl.compile, a few things at a time: making dozens of programs at once takes
 * a while on a slow device. Returns a step to call (a frame at a time) until it
 * says it's done. The lights and fog still come from the whole scene: the rest
 * is simply passed over for the moment (marked as not drawn).
 */
export function compileByParts(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera, ms = 4) {
    const all: (THREE.Object3D & Flags)[] = [];
    scene.traverse((o) => {
        if (DRAWN.some((k) => (o as Flags)[k])) all.push(o);
    });
    let next = 0;
    return () => {
        const t0 = performance.now();
        while (next < all.length && performance.now() - t0 < ms) {
            const part = new Set(all.slice(next, next + 6));
            next += 6;
            const off: [THREE.Object3D & Flags, (typeof DRAWN)[number]][] = [];
            for (const o of all) {
                if (part.has(o)) continue;
                for (const k of DRAWN)
                    if (o[k]) {
                        o[k] = false;
                        off.push([o, k]);
                    }
            }
            try {
                gl.compile(scene, camera);
            } finally {
                for (const [o, k] of off) o[k] = true;
            }
        }
        return next >= all.length;
    };
}

/**
 * Wait, without holding up the page, until every shader program made so far
 * has finished compiling (a material may have several: one for each set of
 * lights it's seen with), or `ms` at most.
 */
export function programsReady(gl: THREE.WebGLRenderer, ms = 4000) {
    const t0 = performance.now();
    return new Promise<void>((resolve) => {
        const check = () => {
            const waiting = (gl.info.programs ?? []).some((p) => (p as unknown as { isReady?: () => boolean }).isReady?.() === false);
            if (!waiting || performance.now() - t0 > ms) resolve();
            else window.setTimeout(check, 16);
        };
        check();
    });
}

/**
 * A program's first use asks the browser about it (its uniforms and attributes,
 * and its log), waiting on the GPU each time: done for dozens at once in a
 * first frame, that adds up. Do it for those not used yet, for at most `ms`;
 * returns whether they're all done.
 */
export function introduceSome(gl: THREE.WebGLRenderer, ms = 4) {
    const t0 = performance.now();
    for (const p of gl.info.programs ?? []) {
        const q = p as unknown as { getUniforms(): unknown; getAttributes(): unknown; __known?: boolean };
        if (q.__known) continue;
        if (performance.now() - t0 > ms) return false;
        q.getUniforms();
        q.getAttributes();
        q.__known = true;
    }
    return true;
}

/** Every picture the materials under `root` use (not render targets, which are drawn into). */
export function picturesOf(root: THREE.Object3D) {
    const out = new Set<THREE.Texture>();
    const add = (x: unknown) => {
        const t = x as THREE.Texture | null;
        if (t && t.isTexture && !(t as THREE.Texture & { isRenderTargetTexture?: boolean }).isRenderTargetTexture) out.add(t);
    };
    root.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (!m) return;
        for (const mat of Array.isArray(m) ? m : [m]) {
            Object.values(mat).forEach(add);
            const u = (mat as THREE.ShaderMaterial).uniforms;
            if (u) Object.values(u).forEach((x) => (Array.isArray(x?.value) ? x.value.forEach(add) : add(x?.value)));
        }
    });
    return Array.from(out);
}

/** Upload pictures that aren't on the GPU yet, for at most `ms`; returns those still to go. */
export function uploadSome(gl: THREE.WebGLRenderer, pictures: THREE.Texture[], ms = 4) {
    const t0 = performance.now();
    while (pictures.length && performance.now() - t0 < ms) {
        const t = pictures.pop()!;
        const p = gl.properties.get(t) as { __version?: number };
        if (t.version > 0 && p.__version !== t.version && t.image) gl.initTexture(t);
    }
    return pictures;
}

/** Draw everything once, even what's out of view (some materials only settle what they are when first drawn). */
export function drawAll(gl: THREE.WebGLRenderer, scene: THREE.Object3D, camera: THREE.Camera) {
    const culled: THREE.Object3D[] = [];
    scene.traverse((o) => {
        if (!o.frustumCulled) return;
        o.frustumCulled = false;
        culled.push(o);
    });
    gl.render(scene, camera);
    for (const o of culled) o.frustumCulled = true;
}
