'use strict';
// ===== 共通ユーティリティ・行列・WebGL描画 =====
const TAU = Math.PI * 2;
const RETRO_H = 300; // 3D 画面の縦の解像度(ドット数)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hsl(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return [f(0), f(8), f(4)];
}
function hex(h) { return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]; }
function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

const M4 = {
  ident() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  chain(...ms) { let o = ms[0]; for (let i = 1; i < ms.length; i++) o = M4.mul(o, ms[i]); return o; },
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f); return m;
  },
  lookAt(e, c, u) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2];
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    const m = new Float32Array(16);
    m[0] = xx; m[1] = yx; m[2] = zx; m[4] = xy; m[5] = yy; m[6] = zy; m[8] = xz; m[9] = yz; m[10] = zz;
    m[12] = -(xx * e[0] + xy * e[1] + xz * e[2]);
    m[13] = -(yx * e[0] + yy * e[1] + yz * e[2]);
    m[14] = -(zx * e[0] + zy * e[1] + zz * e[2]); m[15] = 1; return m;
  },
  trans(x, y, z) { const m = M4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { const m = M4.ident(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotY(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotX(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotZ(a) { const m = M4.ident(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  xform(m, x, y, z) {
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
  },
};

// ===== メッシュ作成 =====
class MeshBuilder {
  constructor() { this.d = []; this.m = null; }
  _v(p, n, c, e) {
    let x = p[0], y = p[1], z = p[2], nx = n[0], ny = n[1], nz = n[2];
    const m = this.m;
    if (m) {
      const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
      const NX = m[0] * nx + m[4] * ny + m[8] * nz, NY = m[1] * nx + m[5] * ny + m[9] * nz, NZ = m[2] * nx + m[6] * ny + m[10] * nz;
      x = X; y = Y; z = Z; nx = NX; ny = NY; nz = NZ;
    }
    this.d.push(x, y, z, nx, ny, nz, c[0], c[1], c[2], e);
  }
  tri(a, b, c, n, col, e = 0) { this._v(a, n, col, e); this._v(b, n, col, e); this._v(c, n, col, e); }
  triC(a, b, c, n, ca, cb, cc, e = 0) { this._v(a, n, ca, e); this._v(b, n, cb, e); this._v(c, n, cc, e); }
  quad(a, b, c, d, n, col, e = 0) { this.tri(a, b, c, n, col, e); this.tri(a, c, d, n, col, e); }
  box(cx, cy, cz, sx, sy, sz, col, e = 0) {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2;
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0], col, e);
    this.quad([x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0], [-1, 0, 0], col, e);
    this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0], col, e);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], col, e);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], col, e);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], col, e);
  }
  // y方向の円柱(cyが底面)。rTop=0 で円すい
  cyl(cx, cy, cz, r, h, seg, col, e = 0, rTop = r, caps = true) {
    const sl = (r - rTop) / h;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      const n0 = norm3([c0, sl, s0]), n1 = norm3([c1, sl, s1]);
      const p00 = [cx + r * c0, cy, cz + r * s0], p01 = [cx + r * c1, cy, cz + r * s1];
      const p10 = [cx + rTop * c0, cy + h, cz + rTop * s0], p11 = [cx + rTop * c1, cy + h, cz + rTop * s1];
      this._v(p00, n0, col, e); this._v(p01, n1, col, e); this._v(p11, n1, col, e);
      this._v(p00, n0, col, e); this._v(p11, n1, col, e); this._v(p10, n0, col, e);
      if (caps) {
        this.tri([cx, cy, cz], p01, p00, [0, -1, 0], col, e);
        if (rTop > 0) this.tri([cx, cy + h, cz], p10, p11, [0, 1, 0], col, e);
      }
    }
  }
  cone(cx, cy, cz, r, h, seg, col, e = 0) { this.cyl(cx, cy, cz, r, h, seg, col, e, 0, true); }
  sphere(cx, cy, cz, r, seg, col, e = 0, sy = 1) {
    const rings = Math.max(3, seg >> 1);
    for (let j = 0; j < rings; j++) {
      const t0 = (j / rings) * Math.PI, t1 = ((j + 1) / rings) * Math.PI;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
        const d = (t, a) => [Math.sin(t) * Math.cos(a), Math.cos(t), Math.sin(t) * Math.sin(a)];
        const P = v => [cx + v[0] * r, cy + v[1] * r * sy, cz + v[2] * r];
        const v00 = d(t0, a0), v01 = d(t0, a1), v10 = d(t1, a0), v11 = d(t1, a1);
        this._v(P(v00), v00, col, e); this._v(P(v10), v10, col, e); this._v(P(v11), v11, col, e);
        this._v(P(v00), v00, col, e); this._v(P(v11), v11, col, e); this._v(P(v01), v01, col, e);
      }
    }
  }
  disc(cx, cy, cz, r, seg, col, e = 0) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
      this.tri([cx, cy, cz], [cx + r * Math.cos(a0), cy, cz + r * Math.sin(a0)], [cx + r * Math.cos(a1), cy, cz + r * Math.sin(a1)], [0, 1, 0], col, e);
    }
  }
}
function norm3(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }

// ===== シェーダ =====
const VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec4 aCol;
uniform mat4 uVP; uniform mat4 uM;
out vec3 vN; out vec4 vC; out vec3 vW;
void main(){ vec4 w=uM*vec4(aPos,1.0); vW=w.xyz; vN=mat3(uM)*aNor; vC=aCol; gl_Position=uVP*w; }`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec4 vC; in vec3 vW;
uniform vec3 uL, uSun, uAmb, uCam, uFogC; uniform vec2 uFog; uniform vec4 uTint; uniform float uA;
out vec4 o;
void main(){
  vec3 n=normalize(vN);
  float d=max(dot(n,uL),0.0);
  float hemi=0.55+0.45*n.y;
  vec3 base=vC.rgb*uTint.rgb;
  vec3 lit=base*(uAmb*hemi+uSun*d);
  lit=mix(lit,base,clamp(vC.a,0.0,1.0));
  lit=mix(lit,vec3(1.0),uTint.a);
  float f=clamp((distance(vW,uCam)-uFog.x)/(uFog.y-uFog.x),0.0,1.0);
  vec3 col=mix(lit,uFogC,f*f*(3.0-2.0*f));
  col=floor(col*20.0+0.5)/20.0;
  o=vec4(col,uA);
}`;
const PVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aCol; layout(location=2) in float aSize;
uniform mat4 uVP; uniform float uScale; out vec4 vC;
void main(){ gl_Position=uVP*vec4(aPos,1.0); gl_PointSize=clamp(aSize*uScale/max(gl_Position.w,0.1),1.0,300.0); vC=aCol; }`;
const PFS = `#version 300 es
precision mediump float; in vec4 vC; out vec4 o;
void main(){ vec2 c=gl_PointCoord-0.5; float r=length(c)*2.0; if(r>1.0) discard; o=vec4(vC.rgb, vC.a*(1.0-r*r)); }`;

class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('このブラウザは WebGL2 に対応していません');
    this.gl = gl; this.canvas = canvas;
    this.prog = this._prog(VS, FS); this.pprog = this._prog(PVS, PFS);
    const u = n => gl.getUniformLocation(this.prog, n);
    this.u = { VP: u('uVP'), M: u('uM'), L: u('uL'), Sun: u('uSun'), Amb: u('uAmb'), Cam: u('uCam'), FogC: u('uFogC'), Fog: u('uFog'), Tint: u('uTint'), A: u('uA') };
    this.pu = { VP: gl.getUniformLocation(this.pprog, 'uVP'), Scale: gl.getUniformLocation(this.pprog, 'uScale') };
    this.pMax = 5000; this.pData = new Float32Array(this.pMax * 8);
    this.pvao = gl.createVertexArray(); gl.bindVertexArray(this.pvao);
    this.pbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
    gl.bindVertexArray(null);
    this.white = [1, 1, 1, 0];
    this.resize();
  }
  _prog(vs, fs) {
    const gl = this.gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  mesh(src) {
    const gl = this.gl, data = src instanceof MeshBuilder ? new Float32Array(src.d) : src;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 24);
    gl.bindVertexArray(null);
    return { vao, buf, count: data.length / 10 };
  }
  freeMesh(m) { if (!m) return; this.gl.deleteBuffer(m.buf); this.gl.deleteVertexArray(m.vao); }
  resize() {
    // ドット絵風: 縦 RETRO_H ドット前後の粗い解像度で描き、CSS で拡大(image-rendering: pixelated)
    const k = Math.min(1, RETRO_H / Math.max(1, innerHeight));
    const w = Math.max(1, Math.round(innerWidth * k)), h = Math.max(1, Math.round(innerHeight * k));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h); this.w = w; this.h = h;
  }
  begin(vp, proj, cam, env) {
    const gl = this.gl, u = this.u;
    this.vp = vp; this.proj = proj; this.cam = cam; this.env = env;
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(u.VP, false, vp);
    gl.uniform3fv(u.L, env.light); gl.uniform3fv(u.Sun, env.sun); gl.uniform3fv(u.Amb, env.amb);
    gl.uniform3fv(u.Cam, cam); gl.uniform3fv(u.FogC, env.fog);
    this.fog(true);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
  }
  fog(on) { const f = this.env.fogRange; this.gl.uniform2f(this.u.Fog, on ? f[0] : 1e7, on ? f[1] : 2e7); }
  blend(mode) {
    const gl = this.gl;
    if (!mode) { gl.disable(gl.BLEND); gl.depthMask(true); return; }
    gl.enable(gl.BLEND); gl.depthMask(false);
    if (mode === 'add') gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }
  draw(mesh, m, tint, alpha = 1) {
    const gl = this.gl;
    gl.uniformMatrix4fv(this.u.M, false, m);
    gl.uniform4fv(this.u.Tint, tint || this.white); gl.uniform1f(this.u.A, alpha);
    gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  particles(ps) {
    const gl = this.gl, list = ps.list; if (!list.length) return;
    const d = this.pData; let n = 0, nAdd = 0;
    const put = p => { const o = n * 8; d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.r; d[o + 4] = p.g; d[o + 5] = p.b; d[o + 6] = p.a * Math.min(1, p.life / p.fade); d[o + 7] = p.size; n++; };
    for (const p of list) if (!p.add && n < this.pMax) put(p);
    const nNorm = n;
    for (const p of list) if (p.add && n < this.pMax) { put(p); nAdd++; }
    gl.useProgram(this.pprog);
    gl.uniformMatrix4fv(this.pu.VP, false, this.vp); gl.uniform1f(this.pu.Scale, this.h * this.proj[5] * 0.5);
    gl.bindVertexArray(this.pvao); gl.bindBuffer(gl.ARRAY_BUFFER, this.pbuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 8);
    gl.enable(gl.BLEND); gl.depthMask(false);
    if (nNorm) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArrays(gl.POINTS, 0, nNorm); }
    if (nAdd) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.drawArrays(gl.POINTS, nNorm, nAdd); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.useProgram(this.prog);
  }
}

// ===== パーティクル =====
class Particles {
  constructor() { this.list = []; }
  add(x, y, z, vx, vy, vz, life, size, col, a = 1, add = false, grav = 0, drag = 0, grow = 0) {
    if (this.list.length > 4800) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, life, fade: Math.min(life, 0.35), size, r: col[0], g: col[1], b: col[2], a, add, grav, drag, grow });
  }
  burst(x, y, z, n, speed, life, size, col, add = true, grav = 0) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, e = Math.random() * 0.9 + 0.1, s = speed * (0.4 + Math.random() * 0.6);
      this.add(x, y, z, Math.cos(a) * s * e, s * (0.3 + Math.random()), Math.sin(a) * s * e, life * (0.6 + Math.random() * 0.6), size, col, 1, add, grav, 1.5);
    }
  }
  update(dt) {
    const L = this.list; let j = 0;
    for (let i = 0; i < L.length; i++) {
      const p = L[i]; p.life -= dt; if (p.life <= 0) continue;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.size += p.grow * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; }
      L[j++] = p;
    }
    L.length = j;
  }
  clear() { this.list.length = 0; }
}
