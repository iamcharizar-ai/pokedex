// The altar's glow (FORGE-EXPERIENCE.md section 6): the water that fills the crevices from each socket, the bleach to white, the pour into the Key Stone and the
// wells that fill and drain. One small WebGL2 program reads the maps tools/build-altar.py makes from the altar picture (sprites/forge) and draws light over it;
// nothing else about the altar is drawn here. It draws only when `set` changes something, so it costs nothing while the forge rests.

export type RGB = readonly [number, number, number]

/** sprites/forge/altar.json */
export interface AltarMeta {
  size: [number, number]
  wells: { x: number; y: number; r: number }[]
  centre: { x: number; y: number; r: number }
  scale16: number
  basinIds: number[]
  routeMax: number[]
  pourMax: number
}

export interface GlowState {
  /** how far each socket's water has run along its crevices (0 none, 1 everywhere it reaches) */
  fill: [number, number, number]
  /** the colour of each socket's water (0 to 1) */
  colour: [RGB, RGB, RGB]
  /** a Comet's water cycles through every colour */
  prism: [boolean, boolean, boolean]
  /** 0 to 1: every filled crevice is bleached to white at once */
  white: number
  /** 0 to 1: a wave of white runs out along the crevices from the sockets: the near ones whiten first, the far ones last (1: all white) */
  bleach: number
  /** null: not pouring. 0 to 1: the white water is draining toward the centre (0 just begun, 1 arrived) */
  pour: number | null
  /** how lit each well is, over its whole inside seen from above (0 dark, 1 fully lit), then the centre recess; a draining well fades from 1 to 0 */
  wells: [number, number, number, number]
  /** how white the wells are (0 their socket's colour, 1 white) */
  wellWhite: number
  /** seconds, for the shimmer */
  time: number
}

export const CALM: GlowState = {
  fill: [0, 0, 0],
  colour: [[1, 0.25, 0.25], [0.3, 0.55, 1], [0.25, 0.9, 0.45]],
  prism: [false, false, false],
  white: 0,
  bleach: 0,
  pour: null,
  wells: [0, 0, 0, 0],
  wellWhite: 0,
  time: 0,
}

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); gl_Position = vec4(aPos, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFlow, uPourMap, uWells;
uniform vec3 uCol[3];
uniform float uPrism[3], uFill[3], uRoute[3];
uniform float uWhite, uBleach, uTime, uScale, uPourMax, uPour, uWellWhite;
uniform float uWell[4];
uniform vec3 uWellGeom[4];
uniform float uPx;                     // one picture pixel, in uv

float dec(vec4 t) { return (floor(t.r * 255.0 + 0.5) * 256.0 + floor(t.g * 255.0 + 0.5)) / uScale; }
vec3 rainbow(float h) { return clamp(abs(fract(h + vec3(0.0, 0.6667, 0.3333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0); }

// the light in the crevices at a point: rgb, already scaled by how strong it is
vec3 crevice(vec2 p) {
  vec4 f = texture(uFlow, p);
  if (f.a < 0.02) return vec3(0.0);
  float d = dec(f);
  float b = f.b * 255.0;
  int i = b < 100.0 ? 0 : (b < 200.0 ? 1 : 2);
  if (uPour >= 0.0) {
    // the pour: white water runs toward the centre; behind it the crevice is empty, ahead of it still full
    float dc = dec(texture(uPourMap, p));
    float head = uPourMax * (1.0 - uPour);
    float band = uPourMax * 0.22;
    float full = smoothstep(head, head - 6.0, dc);
    float inBand = smoothstep(head - 6.0, head, dc) * smoothstep(head + band, head, dc);
    float level = uFill[i] > 0.001 ? 1.0 : 0.0;
    return vec3(1.0, 0.98, 0.94) * (0.75 * full + 1.0 * inBand) * level * f.a;
  }
  float L = uFill[i] * uRoute[i];
  float on = (uFill[i] > 0.001 ? 1.0 : 0.0) * smoothstep(L, L - 5.0, d);
  float front = (uFill[i] > 0.001 && uFill[i] < 0.999 ? 1.0 : 0.0) * exp(-pow((L - d) / 7.0, 2.0));
  vec3 col = uCol[i];
  if (uPrism[i] > 0.5) col = mix(col, rainbow(d * 0.004 - uTime * 0.4), 0.85);
  float shimmer = 0.82 + 0.18 * sin(d * 0.07 - uTime * 3.0);
  vec3 water = col * shimmer;
  // the bleach is a wave from the socket: x is how far along its own crevices this point is (0 at the socket, 1 at the farthest end)
  float x = clamp(d / max(uRoute[i], 1.0), 0.0, 1.0);
  const float BAND = 0.18;
  float head = uBleach * (1.0 + BAND);
  float wave = 1.0 - smoothstep(head - BAND, head, x);
  float edge = (uBleach > 0.001 && uBleach < 0.999) ? exp(-pow((x - (head - BAND * 0.5)) / (BAND * 0.5), 2.0)) : 0.0;
  water = mix(water, vec3(1.0, 0.98, 0.94), max(uWhite, wave));
  vec3 c = water * on + vec3(1.0, 0.98, 0.94) * (front * 0.9 + edge * 0.5 * on);
  return c * f.a;
}

// the wells are seen from above: each is a disc that lights over its whole inside, and fades out (never a water level)
vec3 wells(vec2 p) {
  vec4 m = texture(uWells, p);
  vec3 c = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    float mk = k == 0 ? m.r : k == 1 ? m.g : k == 2 ? m.b : m.a;
    if (mk < 0.02 || uWell[k] <= 0.001) continue;
    vec3 g = uWellGeom[k];
    float r = length(p - g.xy) / g.z;                 // 0 at the middle, 1 at the rim
    float lens = 0.8 + 0.2 * (1.0 - r * r);           // a little brighter in the middle, like a lit disc
    vec3 col = k < 3 ? uCol[k] : vec3(1.0, 0.98, 0.94);
    if (k < 3 && uPrism[k] > 0.5) col = rainbow(uTime * 0.4 + float(k) * 0.3);
    col = mix(col, vec3(1.0, 0.98, 0.94), uWellWhite);
    c += col * lens * uWell[k] * mk;
  }
  return c;
}

vec3 light(vec2 p) { return crevice(p) + wells(p); }

void main() {
  vec3 core = light(vUv);
  // a soft halo: the same light, sampled round the point
  vec3 halo = vec3(0.0);
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.7853982;
    vec2 o = vec2(cos(a), sin(a));
    halo += light(vUv + o * uPx * 5.0) + light(vUv + o * uPx * 12.0) * 0.7;
  }
  halo /= 13.6;
  vec3 c = core + halo * 0.6;
  float alpha = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
  outColor = vec4(min(c, vec3(alpha)), alpha);       // premultiplied
}`

export interface AltarImages { flow: ImageBitmap; pour: ImageBitmap; wells: ImageBitmap }

/** Fetch the altar's maps. They are data, not pictures: no premultiplying and no colour conversion. */
export async function loadAltarMaps(base = '/sprites/forge/'): Promise<{ meta: AltarMeta; images: AltarImages }> {
  const get = async (f: string): Promise<ImageBitmap> => createImageBitmap(await (await fetch(base + f)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
  const meta = (await (await fetch(base + 'altar.json')).json()) as AltarMeta
  const [flow, pour, wells] = await Promise.all([get('altar-flow.png'), get('altar-pour.png'), get('altar-wells.png')])
  return { meta, images: { flow, pour, wells } }
}

export class AltarGlow {
  private gl: WebGL2RenderingContext
  private canvas: HTMLCanvasElement
  private u: Record<string, WebGLUniformLocation | null> = {}
  private state: GlowState = { ...CALM }
  private frame = 0
  private lost = false

  constructor(canvas: HTMLCanvasElement, meta: AltarMeta, images: AltarImages) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, alpha: true, antialias: false })
    if (!gl) throw new Error('WebGL2 is not available')
    this.gl = gl
    const sh = (type: number, src: string): WebGLShader => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
    gl.useProgram(prog)
    for (const n of ['uFlow', 'uPourMap', 'uWells', 'uCol', 'uPrism', 'uFill', 'uRoute', 'uWhite', 'uBleach', 'uTime', 'uScale', 'uPourMax', 'uPour', 'uWellWhite', 'uWell', 'uWellGeom', 'uPx']) this.u[n] = gl.getUniformLocation(prog, n)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    // the distance maps are two bytes of one number: they must not be blended between neighbours
    const tex = (unit: number, img: ImageBitmap, nearest: boolean): void => {
      const t = gl.createTexture()
      gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      const f = nearest ? gl.NEAREST : gl.LINEAR
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
    tex(0, images.flow, true); tex(1, images.pour, true); tex(2, images.wells, false)
    gl.uniform1i(this.u.uFlow, 0); gl.uniform1i(this.u.uPourMap, 1); gl.uniform1i(this.u.uWells, 2)
    gl.uniform1f(this.u.uScale, meta.scale16)
    gl.uniform1f(this.u.uPourMax, meta.pourMax)
    gl.uniform1fv(this.u.uRoute, meta.routeMax)
    gl.uniform1f(this.u.uPx, 1 / meta.size[0])
    const geom = [...meta.wells, meta.centre].flatMap((w) => [w.x, w.y, w.r])
    gl.uniform3fv(this.u.uWellGeom, geom)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true })
    this.resize()
  }

  /** Match the canvas to its size on the screen (at most 1024 across: the glow is soft, and phones should not draw more). */
  resize(): void {
    const w = Math.max(64, Math.min(1024, Math.round(this.canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) || 512))
    if (this.canvas.width !== w) { this.canvas.width = w; this.canvas.height = w }
    this.gl.viewport(0, 0, w, w)
    this.draw()
  }

  /** Change what is lit; it draws at the next frame. */
  set(patch: Partial<GlowState>): void {
    this.state = { ...this.state, ...patch }
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.draw() })
  }

  draw(): void {
    if (this.lost) return
    const { gl, state: s, u } = this
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform3fv(u.uCol, s.colour.flatMap((c) => [...c]))
    gl.uniform1fv(u.uPrism, s.prism.map((p) => (p ? 1 : 0)))
    gl.uniform1fv(u.uFill, s.fill)
    gl.uniform1f(u.uWhite, s.white)
    gl.uniform1f(u.uBleach, s.bleach)
    gl.uniform1f(u.uPour, s.pour === null ? -1 : s.pour)
    gl.uniform1fv(u.uWell, s.wells)
    gl.uniform1f(u.uWellWhite, s.wellWhite)
    gl.uniform1f(u.uTime, s.time)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  destroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame)
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
