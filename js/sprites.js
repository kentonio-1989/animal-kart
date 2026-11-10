'use strict';
// ===== ドット絵スプライト(ビルボード)描画 =====
// ATLAS(atlas.js)は { src: 'data:image/png;base64,...', w, h, rects: { key: [x, y, w, h] } }
const SVS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in float aB;
uniform mat4 uVP; out vec2 vUV; out vec3 vW; out float vB;
void main(){ vUV=aUV; vW=aPos; vB=aB; gl_Position=uVP*vec4(aPos,1.0); }`;
const SFS = `#version 300 es
precision mediump float; in vec2 vUV; in vec3 vW; in float vB;
uniform sampler2D uTex; uniform vec3 uCam, uFogC; uniform vec2 uFog; uniform float uShade; out vec4 o;
void main(){
  vec4 c=texture(uTex,vUV); if(c.a<0.5) discard;
  vec3 col=c.rgb*uShade;
  col=mix(col,vec3(1.0),clamp(vB-1.0,0.0,1.0));
  float f=clamp((distance(vW,uCam)-uFog.x)/(uFog.y-uFog.x),0.0,1.0);
  o=vec4(mix(col,uFogC,f*f*(3.0-2.0*f)),1.0);
}`;

const ATLAS_IMG = new Image();
const ATLAS_READY = new Promise(res => {
  if (typeof ATLAS === 'undefined') { res(false); return; }
  ATLAS_IMG.onload = () => res(true); ATLAS_IMG.onerror = () => res(false);
  ATLAS_IMG.src = ATLAS.src;
});
function atlasRect(key) { return typeof ATLAS !== 'undefined' ? ATLAS.rects[key] : null; }

// 2D キャンバスにスプライトを描く(HUD・メニュー用)。高さ h に合わせ、中心 (cx, cy)
function drawAtlas(ctx, key, cx, cy, h, flip = false) {
  const r = atlasRect(key); if (!r || !ATLAS_IMG.complete || !ATLAS_IMG.naturalWidth) return false;
  const w = (h * r[2]) / r[3];
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(cx, cy); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(ATLAS_IMG, r[0], r[1], r[2], r[3], -w / 2, -h / 2, w, h);
  ctx.restore(); return true;
}

class Sprites {
  constructor(R) {
    this.R = R; const gl = R.gl;
    this.prog = R._prog(SVS, SFS);
    const u = n => gl.getUniformLocation(this.prog, n);
    this.u = { VP: u('uVP'), Tex: u('uTex'), Cam: u('uCam'), FogC: u('uFogC'), Fog: u('uFog'), Shade: u('uShade') };
    this.max = 1200; this.data = new Float32Array(this.max * 6 * 6);
    this.vao = gl.createVertexArray(); gl.bindVertexArray(this.vao);
    this.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
    gl.bindVertexArray(null);
    this.tex = null; this.n = 0; this.right = [1, 0, 0];
    ATLAS_READY.then(ok => {
      if (!ok) return;
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ATLAS_IMG);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, null);
    });
  }
  // カメラの位置と注視点から、ビルボードの右方向(水平)を求める
  begin(eye, target) {
    const zx = eye[0] - target[0], zz = eye[2] - target[2], l = Math.hypot(zx, zz) || 1;
    this.right = [zz / l, 0, -zx / l]; this.n = 0;
  }
  // 足もと (x, y, z) を基準に高さ h で立てる。opt: { flip, bright, center }
  add(key, x, y, z, h, opt = {}) {
    const r = atlasRect(key); if (!r || this.n >= this.max) return;
    const w = (h * r[2]) / r[3], hw = w / 2, rx = this.right[0] * hw, rz = this.right[2] * hw;
    const y0 = opt.center ? y - h / 2 : y, y1 = y0 + h;
    let u0 = r[0] / ATLAS.w, u1 = (r[0] + r[2]) / ATLAS.w; const v0 = r[1] / ATLAS.h, v1 = (r[1] + r[3]) / ATLAS.h;
    if (opt.flip) { const t = u0; u0 = u1; u1 = t; }
    const b = opt.bright || 1, d = this.data; let o = this.n * 36;
    const P = (px, py, pz, u, v) => { d[o++] = px; d[o++] = py; d[o++] = pz; d[o++] = u; d[o++] = v; d[o++] = b; };
    P(x - rx, y0, z - rz, u0, v1); P(x + rx, y0, z + rz, u1, v1); P(x + rx, y1, z + rz, u1, v0);
    P(x - rx, y0, z - rz, u0, v1); P(x + rx, y1, z + rz, u1, v0); P(x - rx, y1, z - rz, u0, v0);
    this.n++;
  }
  flush(shade = 1) {
    const R = this.R, gl = R.gl;
    if (!this.tex || !this.n) { this.n = 0; return; }
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(this.u.VP, false, R.vp); gl.uniform3fv(this.u.Cam, R.cam); gl.uniform3fv(this.u.FogC, R.env.fog);
    const f = R.env.fogRange; gl.uniform2f(this.u.Fog, f[0], f[1]); gl.uniform1f(this.u.Shade, shade);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex); gl.uniform1i(this.u.Tex, 0);
    gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.n * 36);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, this.n * 6);
    gl.bindVertexArray(null); gl.useProgram(R.prog); this.n = 0;
  }
}
