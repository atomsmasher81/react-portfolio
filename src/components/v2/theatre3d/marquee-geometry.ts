import * as THREE from "three";

// Small geometry helpers shared by the marquee's parts.

/** UVs in metres, projected along each vertex's main axis, so tiling textures keep their scale. */
export function metreUVs(geo: THREE.BufferGeometry) {
    const p = geo.attributes.position;
    const n = geo.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i));
        const ay = Math.abs(n.getY(i));
        const az = Math.abs(n.getZ(i));
        const [u, v] = ax >= ay && ax >= az ? [p.getZ(i), p.getY(i)] : ay >= az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)];
        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geo;
}

/** A rounded rectangle centred on the origin, added to a shape or path. */
export function roundedRect<P extends THREE.Path>(path: P, w: number, h: number, r: number) {
    const x = -w / 2;
    const y = -h / 2;
    path.moveTo(x + r, y);
    path.lineTo(x + w - r, y);
    path.quadraticCurveTo(x + w, y, x + w, y + r);
    path.lineTo(x + w, y + h - r);
    path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    path.lineTo(x + r, y + h);
    path.quadraticCurveTo(x, y + h, x, y + h - r);
    path.lineTo(x, y + r);
    path.quadraticCurveTo(x, y, x + r, y);
    return path;
}

/** A box by its corners, with metre UVs. */
export function boxBetween(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return metreUVs(g);
}
