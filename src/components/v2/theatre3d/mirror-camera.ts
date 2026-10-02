import * as THREE from "three";

// Your own face in the glass, if you let the mirror see you. The page owns
// the stream and the asking; this only draws it. Every frame stays on the
// GPU: the video becomes a texture, and a few times a second a small square
// copy of it is rendered into a ring of cells in one render target, so some
// shards can show you a few seconds ago, and one cell keeps a still taken
// just after it began. Nothing is read back, stored or sent anywhere.

/** The ring: a 6 by 6 grid of 170 px cells in one 1024 px target. 32 cells of history, one still. */
export const RING = {
    size: 1024,
    grid: 6,
    cell: 170,
    frames: 32,
    fps: 8,
    still: 35,
};

const copyVertex = /* glsl */ `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const copyFragment = /* glsl */ `
    uniform sampler2D tVideo;
    uniform vec4 uCrop;
    varying vec2 vUv;
    void main() {
        gl_FragColor = vec4(texture2D(tVideo, uCrop.xy + vUv * uCrop.zw).rgb, 1.0);
    }
`;

export class MirrorCamera {
    readonly video: HTMLVideoElement;
    readonly live: THREE.VideoTexture;
    readonly ring: THREE.WebGLRenderTarget;
    /** The video cropped to a centred square (a little high on a tall video, where the face is): offset xy, scale zw. */
    readonly crop = new THREE.Vector4(0, 0, 1, 1);
    /** The ring cell written last, and how many hold a frame. */
    head = -1;
    count = 0;
    stillTaken = false;
    private readonly scene = new THREE.Scene();
    private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly material: THREE.ShaderMaterial;
    private lastCopy = -1;
    private firstFrame = -1;

    constructor(stream: MediaStream) {
        const v = document.createElement("video");
        v.muted = true;
        v.defaultMuted = true;
        v.playsInline = true;
        v.autoplay = true;
        v.setAttribute("playsinline", "");
        v.setAttribute("muted", "");
        v.setAttribute("aria-hidden", "true");
        // Kept in the page, invisible: some browsers stop decoding a video that isn't in the document.
        v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1";
        document.body.appendChild(v);
        v.srcObject = stream;
        const play = () => v.play().catch(() => {});
        v.addEventListener("loadedmetadata", play);
        v.addEventListener("canplay", play);
        play();
        this.video = v;
        // raw camera values; the glass decodes them
        this.live = new THREE.VideoTexture(v);
        this.live.colorSpace = THREE.NoColorSpace;
        this.live.minFilter = THREE.LinearFilter;
        this.live.generateMipmaps = false;
        this.ring = new THREE.WebGLRenderTarget(RING.size, RING.size, { depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
        this.material = new THREE.ShaderMaterial({
            uniforms: { tVideo: { value: this.live }, uCrop: { value: this.crop } },
            vertexShader: copyVertex,
            fragmentShader: copyFragment,
            depthTest: false,
            depthWrite: false,
        });
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
        quad.frustumCulled = false;
        this.scene.add(quad);
    }

    get ready() {
        return this.video.readyState >= 2 && this.video.videoWidth > 0;
    }

    /** Keep the crop right and, a few times a second, copy the current frame into the ring. */
    update(renderer: THREE.WebGLRenderer, time: number) {
        if (this.video.paused && this.video.readyState >= 1) this.video.play().catch(() => {});
        if (!this.ready) return;
        // upload the current frame every time, rather than trusting frame callbacks on a hidden video
        this.live.needsUpdate = true;
        const w = this.video.videoWidth;
        const h = this.video.videoHeight;
        if (w >= h) this.crop.set((1 - h / w) / 2, 0, h / w, 1);
        else this.crop.set(0, (1 - w / h) * 0.62, 1, w / h);
        if (this.firstFrame < 0) this.firstFrame = time;
        if (time - this.lastCopy >= 1 / RING.fps) {
            this.lastCopy = time;
            this.head = (this.head + 1) % RING.frames;
            this.count = Math.min(RING.frames, this.count + 1);
            this.copyInto(renderer, this.head);
        }
        // the still: taken once, after the camera has had a moment to settle its exposure
        if (!this.stillTaken && time - this.firstFrame > 1.6) {
            this.stillTaken = true;
            this.copyInto(renderer, RING.still);
        }
    }

    private copyInto(renderer: THREE.WebGLRenderer, cell: number) {
        const x = (cell % RING.grid) * RING.cell;
        const y = Math.floor(cell / RING.grid) * RING.cell;
        this.ring.viewport.set(x, y, RING.cell, RING.cell);
        this.ring.scissor.set(x, y, RING.cell, RING.cell);
        this.ring.scissorTest = true;
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(this.ring);
        renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(prev);
    }

    dispose() {
        this.video.pause();
        this.video.srcObject = null;
        this.video.remove();
        this.live.dispose();
        this.ring.dispose();
        this.material.dispose();
    }
}
