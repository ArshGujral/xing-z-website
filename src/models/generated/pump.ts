import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

function buildLatheGeometry(profile: { points: [number, number][]; segments?: number }): THREE.LatheGeometry {
  const points = profile.points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y));
  return new THREE.LatheGeometry(points, profile.segments ?? 24);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  // setStyle with an explicit SRGBColorSpace, NOT the numeric constructor.
  //
  // `new THREE.Color(r, g, b)` treats its arguments as LINEAR working-space components,
  // while an authored `baseColor` hex is sRGB. Feeding one to the other skipped the
  // transfer function and lifted every dark albedo: #2e2a28, authored as a near-black
  // vinyl, rendered at roughly sRGB 0.46 — a mid grey. The error is largest exactly where
  // it matters most, because the transfer curve is steepest near black.
  return new THREE.Color().setStyle(source, THREE.SRGBColorSpace);
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  // A material that declares -- with evidence -- that its subject carries no texture
  // detail gets NO texture set. Synthesising one anyway is not a harmless default: the
  // branch below then forces color to white and roughness to 1 and reads both from the
  // generated maps, so the authored albedo and the reference-derived roughness are both
  // discarded, and the model gains mottling the reference does not have. Measured on the
  // tuxedo cat, whose black fur rendered as speckled grey-and-white from a palette that
  // only ever described two flat regions.
  const textureless = (spec.textureless as { declared?: boolean } | undefined)?.declared === true;
  const textures = textureless
    ? null
    : makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Xing-Z Submersible Pump
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createXingZSubmersiblePumpModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Xing-Z Submersible Pump";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "analysisArtifact": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "motor-block", "regionId": "teal", "specMaterialId": "teal-plastic", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "base-band", "regionId": "band", "specMaterialId": "black-plastic", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "outlet-nozzle", "regionId": "nozzle", "specMaterialId": "nozzle-black", "profileId": "plastic.glossy", "status": "proceed"}, {"componentId": "impeller-dome", "regionId": "slot", "specMaterialId": "slot-shadow", "profileId": "plastic.glossy", "status": "proceed"}], "controlledViewsRequired": ["environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["teal-plastic"] = createSculptMaterial(
    "teal-plastic",
    {"id": "teal-plastic", "name": "Teal moulded plastic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2ccdb4", "color": "#2ccdb4", "albedo": {"dominant": "#2ccdb4", "secondary": ["#22b39c", "#5fe0cb"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#2ccdb4", "#22b39c", "#5fe0cb"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.42, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "embossed-wordmark", "region": "XIING panel on the block front", "kind": "decal", "properties": {"implementation": "photo projection (src/models/pump.ts)", "roughness": 0.38}, "evidenceRef": "zone-r1c1"}, {"id": "top-sheen", "region": "block top and dome shoulder", "kind": "gloss", "properties": {"roughness": 0.35}, "evidenceRef": "zone-r1c2"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.798, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": 0.0, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#03A996", "#93F7ED", "#88F7E8", "#84F7E8", "#5FF2DE"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 193.7, "meanSaturation": 0.575, "gradientStrength": 0.423, "mottle": 0.025, "streakRatio": 1.52, "hueSpread": 0.0, "specularFraction": 0.007}}, "materialEvidence": {"componentId": "motor-block", "regionId": "teal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\00-teal.png", "bbox": {"x": 1040, "y": 450, "width": 110, "height": 150}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0105}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "motor-block", "regionId": "teal", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.798, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/00-teal.png: uniform teal moulded plastic with a soft environment highlight", "Skill rule: solid albedo for flat moulded plastic"]}, "envMapIntensity": 0.7},
    options
  );
  materialMap["black-plastic"] = createSculptMaterial(
    "black-plastic",
    {"id": "black-plastic", "name": "Black base plastic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#1b1b1b", "color": "#1b1b1b", "albedo": {"dominant": "#1b1b1b", "secondary": ["#262626", "#111111"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#1b1b1b", "#262626", "#111111"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.5, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "band-sheen", "region": "band top edge", "kind": "gloss", "properties": {"roughness": 0.38}, "evidenceRef": "zone-r2c1"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.86, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": 0.0, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#03B4A8", "#03B0A2", "#059C8C", "#0E4941", "#181818"], "paletteHueRisk": [], "gradientAxis": "vertical", "stats": {"meanLum": 86.8, "meanSaturation": 0.757, "gradientStrength": 0.427, "mottle": 0.009, "streakRatio": 0.54, "hueSpread": 0.004, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "base-band", "regionId": "band", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\01-band.png", "bbox": {"x": 520, "y": 885, "width": 120, "height": 35}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0027}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "base-band", "regionId": "band", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.86, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/01-band.png: near-uniform satin black"]}, "envMapIntensity": 0.5},
    options
  );
  materialMap["nozzle-black"] = createSculptMaterial(
    "nozzle-black",
    {"id": "nozzle-black", "name": "Black nozzle plastic", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#161616", "color": "#161616", "albedo": {"dominant": "#161616", "secondary": ["#2a2a2a"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#161616", "#2a2a2a"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.45, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.755, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#626163", "#2D2E2D", "#101111", "#101010", "#202020"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 33.6, "meanSaturation": 0.016, "gradientStrength": 0.332, "mottle": 0.037, "streakRatio": 1.4, "hueSpread": 0.127, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "outlet-nozzle", "regionId": "nozzle", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\02-nozzle.png", "bbox": {"x": 400, "y": 225, "width": 60, "height": 45}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0017}, "observations": ["near-neutral colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "outlet-nozzle", "regionId": "nozzle", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.755, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/02-nozzle.png: uniform black with soft highlights"]}, "envMapIntensity": 0.6},
    options
  );
  materialMap["slot-shadow"] = createSculptMaterial(
    "slot-shadow",
    {"id": "slot-shadow", "name": "Slot shadow", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#070707", "color": "#070707", "albedo": {"dominant": "#070707", "secondary": ["#070707"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#070707"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.8, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "plastic.glossy", "materialFamily": "plastic", "materialSubtype": "generic-polymer", "materialFinish": "glossy", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "plastic.glossy", "method": "family-subtype-finish", "confidence": 0.822, "sourceRefs": ["three.mesh-physical", "three.mesh-standard", "adobe.pbr-guide-1", "google.filament-pbr", "mit.material-recognition"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap"], "validationViews": ["neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.2, "variation": 0.0}, "clearcoatRoughness": {"base": 0.18, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#30B0A2", "#062823", "#030A08", "#020907", "#020806"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 30.3, "meanSaturation": 0.705, "gradientStrength": 0.511, "mottle": 0.01, "streakRatio": 1.97, "hueSpread": 0.021, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "impeller-dome", "regionId": "slot", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\03-slot.png", "bbox": {"x": 505, "y": 520, "width": 14, "height": 120}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0011}, "observations": ["chromatic base-colour response", "directional surface frequency", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "impeller-dome", "regionId": "slot", "materialId": null, "family": "plastic", "subtype": "generic-polymer", "finish": "glossy", "aliases": [], "confidence": 0.822, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/03-slot.png: slot interior in shadow"]}, "envMapIntensity": 0.2},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_base_band_0 = makeAttachmentEndpoint(null);
  const node_base_band_0 = new THREE.Group();
  node_base_band_0.name = "Base band__pivot";
  node_base_band_0.scale.set(1, 1, 1);
  if (endpoint_base_band_0) {
    node_base_band_0.position.copy(endpoint_base_band_0.start);
    node_base_band_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_band_0.position.set(0.0, 0.0, 0.0);
    node_base_band_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_band_0.userData.sculptComponent = {"id": "base-band", "name": "Base band", "level": "macro", "role": "structure", "importance": 0.9, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black moulded ring round the bowl top (r 0.507) with a closed top deck the teal housing sits on; a visible black ledge stays in front of the housing.", "geometryDescriptor": {"topologyIntent": "Black moulded ring round the bowl top (r 0.507) with a closed top deck the teal housing sits on; a visible black ledge stays in front of the housing.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, 0.155], [0.497, 0.155], [0.507, 0.161], [0.507, 0.22899999999999998], [0.5, 0.236], [0.0001, 0.236]], "segments": 128}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black-plastic", "materialLayers": ["black-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "clips", "kind": "fastener", "description": "Teal snap clips set into the band at -90 and -22 degrees (and one inferred at the back).", "effect": {"components": "clip-*"}, "region": "band", "evidenceRef": "zone-r2c0"}, {"id": "band-edge", "kind": "bevel", "description": "Soft top edge of the band catching a highlight.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.007, "segments": 2}}, "region": "band top", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 156, 140, 1.0)", "secondaryAlbedo": "rgba(24, 24, 24, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "black-plastic"}, "materialRegions": [{"regionId": "band", "materialId": "black-plastic", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\01-band.png", "bbox": {"x": 520, "y": 885, "width": 120, "height": 35}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0027}}]};
  node_base_band_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_base_band_0);
  nodes["base-band"] = node_base_band_0;
  const mesh_base_band_0Geometry = endpoint_base_band_0
    ? new THREE.CylinderGeometry(endpoint_base_band_0.endRadius, endpoint_base_band_0.baseRadius, endpoint_base_band_0.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, 0.155], [0.497, 0.155], [0.507, 0.161], [0.507, 0.22899999999999998], [0.5, 0.236], [0.0001, 0.236]], "segments": 128});
  if (!endpoint_base_band_0) {
    mesh_base_band_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_base_band_0 = new THREE.Mesh(
    mesh_base_band_0Geometry,
    materialMap["black-plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_band_0.name = "Base band";
  if (endpoint_base_band_0) {
    mesh_base_band_0.position.copy(endpoint_base_band_0.midpoint);
    mesh_base_band_0.quaternion.copy(endpoint_base_band_0.quaternion);
  }
  mesh_base_band_0.castShadow = options.castShadow ?? true;
  mesh_base_band_0.receiveShadow = options.receiveShadow ?? true;
  mesh_base_band_0.userData.sculptComponent = {"id": "base-band", "name": "Base band", "level": "macro", "role": "structure", "importance": 0.9, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black moulded ring round the bowl top (r 0.507) with a closed top deck the teal housing sits on; a visible black ledge stays in front of the housing.", "geometryDescriptor": {"topologyIntent": "Black moulded ring round the bowl top (r 0.507) with a closed top deck the teal housing sits on; a visible black ledge stays in front of the housing.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, 0.155], [0.497, 0.155], [0.507, 0.161], [0.507, 0.22899999999999998], [0.5, 0.236], [0.0001, 0.236]], "segments": 128}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-band", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black-plastic", "materialLayers": ["black-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "clips", "kind": "fastener", "description": "Teal snap clips set into the band at -90 and -22 degrees (and one inferred at the back).", "effect": {"components": "clip-*"}, "region": "band", "evidenceRef": "zone-r2c0"}, {"id": "band-edge", "kind": "bevel", "description": "Soft top edge of the band catching a highlight.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.007, "segments": 2}}, "region": "band top", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 156, 140, 1.0)", "secondaryAlbedo": "rgba(24, 24, 24, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "black-plastic"}, "materialRegions": [{"regionId": "band", "materialId": "black-plastic", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\01-band.png", "bbox": {"x": 520, "y": 885, "width": 120, "height": 35}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0027}}]};
  node_base_band_0.add(mesh_base_band_0);
  meshes["base-band"] = mesh_base_band_0;
  colliders["base-band"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["base-band"] ??= [];
  destructionGroups["base-band"].push(node_base_band_0);

  const endpoint_base_bowl_1 = makeAttachmentEndpoint(null);
  const node_base_bowl_1 = new THREE.Group();
  node_base_bowl_1.name = "Base bowl__pivot";
  node_base_bowl_1.scale.set(1, 1, 1);
  if (endpoint_base_bowl_1) {
    node_base_bowl_1.position.copy(endpoint_base_bowl_1.start);
    node_base_bowl_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_base_bowl_1.position.set(0.0, 0.09, 0.0);
    node_base_bowl_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_base_bowl_1.userData.sculptComponent = {"id": "base-bowl", "name": "Base bowl", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black revolved bowl under the band: flat suction face, rounded bottom edge, near-vertical slotted wall.", "geometryDescriptor": {"topologyIntent": "Black revolved bowl under the band: flat suction face, rounded bottom edge, near-vertical slotted wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, -0.09], [0.4, -0.09], [0.44, -0.075], [0.47, -0.05], [0.49, 0.0], [0.5, 0.05], [0.5, 0.069], [0.0001, 0.069]], "segments": 128}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.09, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-bowl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black-plastic", "materialLayers": ["black-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "intake-slots", "kind": "linework", "description": "48 vertical intake slots all round the bowl wall.", "effect": {"repetitionSystem": "intake-slots"}, "region": "bowl wall", "evidenceRef": "zone-r2c1"}, {"id": "bottom-round", "kind": "bevel", "description": "Rounded bowl underside.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.04, "segments": 3}}, "region": "bowl bottom", "evidenceRef": "zone-r2c0"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 156, 140, 1.0)", "secondaryAlbedo": "rgba(24, 24, 24, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_base_bowl_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-bowl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["base-band"] ?? root).add(node_base_bowl_1);
  nodes["base-bowl"] = node_base_bowl_1;
  const mesh_base_bowl_1Geometry = endpoint_base_bowl_1
    ? new THREE.CylinderGeometry(endpoint_base_bowl_1.endRadius, endpoint_base_bowl_1.baseRadius, endpoint_base_bowl_1.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, -0.09], [0.4, -0.09], [0.44, -0.075], [0.47, -0.05], [0.49, 0.0], [0.5, 0.05], [0.5, 0.069], [0.0001, 0.069]], "segments": 128});
  if (!endpoint_base_bowl_1) {
    mesh_base_bowl_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_base_bowl_1 = new THREE.Mesh(
    mesh_base_bowl_1Geometry,
    materialMap["black-plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_base_bowl_1.name = "Base bowl";
  if (endpoint_base_bowl_1) {
    mesh_base_bowl_1.position.copy(endpoint_base_bowl_1.midpoint);
    mesh_base_bowl_1.quaternion.copy(endpoint_base_bowl_1.quaternion);
  }
  mesh_base_bowl_1.castShadow = options.castShadow ?? true;
  mesh_base_bowl_1.receiveShadow = options.receiveShadow ?? true;
  mesh_base_bowl_1.userData.sculptComponent = {"id": "base-bowl", "name": "Base bowl", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black revolved bowl under the band: flat suction face, rounded bottom edge, near-vertical slotted wall.", "geometryDescriptor": {"topologyIntent": "Black revolved bowl under the band: flat suction face, rounded bottom edge, near-vertical slotted wall.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, -0.09], [0.4, -0.09], [0.44, -0.075], [0.47, -0.05], [0.49, 0.0], [0.5, 0.05], [0.5, 0.069], [0.0001, 0.069]], "segments": 128}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0.09, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "base-bowl", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "black-plastic", "materialLayers": ["black-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "intake-slots", "kind": "linework", "description": "48 vertical intake slots all round the bowl wall.", "effect": {"repetitionSystem": "intake-slots"}, "region": "bowl wall", "evidenceRef": "zone-r2c1"}, {"id": "bottom-round", "kind": "bevel", "description": "Rounded bowl underside.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.04, "segments": 3}}, "region": "bowl bottom", "evidenceRef": "zone-r2c0"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(5, 156, 140, 1.0)", "secondaryAlbedo": "rgba(24, 24, 24, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_base_bowl_1.add(mesh_base_bowl_1);
  meshes["base-bowl"] = mesh_base_bowl_1;
  colliders["base-bowl"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["base-bowl"] ??= [];
  destructionGroups["base-bowl"].push(node_base_bowl_1);

  const endpoint_impeller_dome_2 = makeAttachmentEndpoint(null);
  const node_impeller_dome_2 = new THREE.Group();
  node_impeller_dome_2.name = "Impeller dome__pivot";
  node_impeller_dome_2.scale.set(1, 1, 1);
  if (endpoint_impeller_dome_2) {
    node_impeller_dome_2.position.copy(endpoint_impeller_dome_2.start);
    node_impeller_dome_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_impeller_dome_2.position.set(-0.15, 0.39, 0.0);
    node_impeller_dome_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_impeller_dome_2.userData.sculptComponent = {"id": "impeller-dome", "name": "Impeller dome", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Teal revolved dome over the impeller: near-vertical slotted wall (r 0.33) rounding into a flat top with a recess for the outlet collar.", "geometryDescriptor": {"topologyIntent": "Teal revolved dome over the impeller: near-vertical slotted wall (r 0.33) rounding into a flat top with a recess for the outlet collar.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, -0.156], [0.335, -0.156], [0.33, -0.06], [0.322, 0.05], [0.31, 0.11], [0.29, 0.155], [0.255, 0.195], [0.2, 0.225], [0.15, 0.235], [0.135, 0.22], [0.0001, 0.22]], "segments": 96}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.15, 0.39, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "impeller-dome", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "slot-shadow", "materialLayers": ["teal-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "vent-slots", "kind": "linework", "description": "32 vertical vent slots round the dome wall (13 visible on the front-left).", "effect": {"repetitionSystem": "vent-slots"}, "region": "dome wall", "evidenceRef": "zone-r1c0"}, {"id": "top-recess", "kind": "bevel", "description": "Shallow round recess in the dome top holding the outlet collar.", "effect": {"edgeTreatment": {"type": "chamfer", "bevelRadius": 0.015, "segments": 1}}, "region": "dome top", "evidenceRef": "zone-r0c0"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(3, 10, 8, 1.0)", "secondaryAlbedo": "rgba(2, 8, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "slot-shadow"}, "materialRegions": [{"regionId": "slot", "materialId": "slot-shadow", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\03-slot.png", "bbox": {"x": 505, "y": 520, "width": 14, "height": 120}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_impeller_dome_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "impeller-dome", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["base-band"] ?? root).add(node_impeller_dome_2);
  nodes["impeller-dome"] = node_impeller_dome_2;
  const mesh_impeller_dome_2Geometry = endpoint_impeller_dome_2
    ? new THREE.CylinderGeometry(endpoint_impeller_dome_2.endRadius, endpoint_impeller_dome_2.baseRadius, endpoint_impeller_dome_2.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, -0.156], [0.335, -0.156], [0.33, -0.06], [0.322, 0.05], [0.31, 0.11], [0.29, 0.155], [0.255, 0.195], [0.2, 0.225], [0.15, 0.235], [0.135, 0.22], [0.0001, 0.22]], "segments": 96});
  if (!endpoint_impeller_dome_2) {
    mesh_impeller_dome_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_impeller_dome_2 = new THREE.Mesh(
    mesh_impeller_dome_2Geometry,
    materialMap["slot-shadow"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_impeller_dome_2.name = "Impeller dome";
  if (endpoint_impeller_dome_2) {
    mesh_impeller_dome_2.position.copy(endpoint_impeller_dome_2.midpoint);
    mesh_impeller_dome_2.quaternion.copy(endpoint_impeller_dome_2.quaternion);
  }
  mesh_impeller_dome_2.castShadow = options.castShadow ?? true;
  mesh_impeller_dome_2.receiveShadow = options.receiveShadow ?? true;
  mesh_impeller_dome_2.userData.sculptComponent = {"id": "impeller-dome", "name": "Impeller dome", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Teal revolved dome over the impeller: near-vertical slotted wall (r 0.33) rounding into a flat top with a recess for the outlet collar.", "geometryDescriptor": {"topologyIntent": "Teal revolved dome over the impeller: near-vertical slotted wall (r 0.33) rounding into a flat top with a recess for the outlet collar.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, -0.156], [0.335, -0.156], [0.33, -0.06], [0.322, 0.05], [0.31, 0.11], [0.29, 0.155], [0.255, 0.195], [0.2, 0.225], [0.15, 0.235], [0.135, 0.22], [0.0001, 0.22]], "segments": 96}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [-0.15, 0.39, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "impeller-dome", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "slot-shadow", "materialLayers": ["teal-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "vent-slots", "kind": "linework", "description": "32 vertical vent slots round the dome wall (13 visible on the front-left).", "effect": {"repetitionSystem": "vent-slots"}, "region": "dome wall", "evidenceRef": "zone-r1c0"}, {"id": "top-recess", "kind": "bevel", "description": "Shallow round recess in the dome top holding the outlet collar.", "effect": {"edgeTreatment": {"type": "chamfer", "bevelRadius": 0.015, "segments": 1}}, "region": "dome top", "evidenceRef": "zone-r0c0"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(3, 10, 8, 1.0)", "secondaryAlbedo": "rgba(2, 8, 6, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "slot-shadow"}, "materialRegions": [{"regionId": "slot", "materialId": "slot-shadow", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\03-slot.png", "bbox": {"x": 505, "y": 520, "width": 14, "height": 120}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_impeller_dome_2.add(mesh_impeller_dome_2);
  meshes["impeller-dome"] = mesh_impeller_dome_2;
  colliders["impeller-dome"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["impeller-dome"] ??= [];
  destructionGroups["impeller-dome"].push(node_impeller_dome_2);

  const endpoint_motor_block_3 = makeAttachmentEndpoint(null);
  const node_motor_block_3 = new THREE.Group();
  node_motor_block_3.name = "Motor block__pivot";
  node_motor_block_3.scale.set(1, 1, 1);
  if (endpoint_motor_block_3) {
    node_motor_block_3.position.copy(endpoint_motor_block_3.start);
    node_motor_block_3.rotation.set(0.0, 1.5708, 0.0);
  } else {
    node_motor_block_3.position.set(-0.05, 0.0, 0.0);
    node_motor_block_3.rotation.set(0.0, 1.5708, 0.0);
  }
  node_motor_block_3.userData.sculptComponent = {"id": "motor-block", "name": "Motor block", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Teal block over the motor: side profile with a front face sloping back 15 degrees and rounded top edges, extruded 0.52 across x.", "geometryDescriptor": {"topologyIntent": "Teal block over the motor: side profile with a front face sloping back 15 degrees and rounded top edges, extruded 0.52 across x.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.3, 0.23399999999999999], [0.3, 0.57], [0.285, 0.605], [0.25, 0.625], [-0.12, 0.625], [-0.165, 0.61], [-0.195, 0.575], [-0.29, 0.23399999999999999]], "depth": 0.52}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.05, 0, 0], "rotation": [0, 1.5708, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-block", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal-plastic", "materialLayers": ["teal-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "xiing-panel", "kind": "bevel", "description": "Raised panel on the sloped front carrying the embossed XIING bolt wordmark.", "effect": {"components": "xiing-panel"}, "region": "block front", "evidenceRef": "zone-r1c1"}, {"id": "top-radius", "kind": "bevel", "description": "Rounded top front and back edges.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.04, "segments": 3}}, "region": "block top", "evidenceRef": "zone-r0c2"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(132, 247, 232, 1.0)", "secondaryAlbedo": "rgba(3, 169, 150, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "teal-plastic"}, "materialRegions": [{"regionId": "teal", "materialId": "teal-plastic", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\00-teal.png", "bbox": {"x": 1040, "y": 450, "width": 110, "height": 150}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0105}}]};
  node_motor_block_3.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-block", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["base-band"] ?? root).add(node_motor_block_3);
  nodes["motor-block"] = node_motor_block_3;
  const mesh_motor_block_3Geometry = endpoint_motor_block_3
    ? new THREE.CylinderGeometry(endpoint_motor_block_3.endRadius, endpoint_motor_block_3.baseRadius, endpoint_motor_block_3.length, 16, 6)
    : buildExtrudeGeometry({"points": [[0.3, 0.23399999999999999], [0.3, 0.57], [0.285, 0.605], [0.25, 0.625], [-0.12, 0.625], [-0.165, 0.61], [-0.195, 0.575], [-0.29, 0.23399999999999999]], "depth": 0.52});
  if (!endpoint_motor_block_3) {
    mesh_motor_block_3Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_motor_block_3 = new THREE.Mesh(
    mesh_motor_block_3Geometry,
    materialMap["teal-plastic"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_motor_block_3.name = "Motor block";
  if (endpoint_motor_block_3) {
    mesh_motor_block_3.position.copy(endpoint_motor_block_3.midpoint);
    mesh_motor_block_3.quaternion.copy(endpoint_motor_block_3.quaternion);
  }
  mesh_motor_block_3.castShadow = options.castShadow ?? true;
  mesh_motor_block_3.receiveShadow = options.receiveShadow ?? true;
  mesh_motor_block_3.userData.sculptComponent = {"id": "motor-block", "name": "Motor block", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.75, "primitive": "extrude", "topologyClass": "assembled-solid", "topologyRationale": "Teal block over the motor: side profile with a front face sloping back 15 degrees and rounded top edges, extruded 0.52 across x.", "geometryDescriptor": {"topologyIntent": "Teal block over the motor: side profile with a front face sloping back 15 degrees and rounded top edges, extruded 0.52 across x.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "profile2D": {"points": [[0.3, 0.23399999999999999], [0.3, 0.57], [0.285, 0.605], [0.25, 0.625], [-0.12, 0.625], [-0.165, 0.61], [-0.195, 0.575], [-0.29, 0.23399999999999999]], "depth": 0.52}}, "parent": "base-band", "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.75}, "transform": {"position": [-0.05, 0, 0], "rotation": [0, 1.5708, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.75}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "motor-block", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal-plastic", "materialLayers": ["teal-plastic"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "xiing-panel", "kind": "bevel", "description": "Raised panel on the sloped front carrying the embossed XIING bolt wordmark.", "effect": {"components": "xiing-panel"}, "region": "block front", "evidenceRef": "zone-r1c1"}, {"id": "top-radius", "kind": "bevel", "description": "Rounded top front and back edges.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.04, "segments": 3}}, "region": "block top", "evidenceRef": "zone-r0c2"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(132, 247, 232, 1.0)", "secondaryAlbedo": "rgba(3, 169, 150, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "teal-plastic"}, "materialRegions": [{"regionId": "teal", "materialId": "teal-plastic", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\00-teal.png", "bbox": {"x": 1040, "y": 450, "width": 110, "height": 150}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0105}}]};
  node_motor_block_3.add(mesh_motor_block_3);
  meshes["motor-block"] = mesh_motor_block_3;
  colliders["motor-block"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["motor-block"] ??= [];
  destructionGroups["motor-block"].push(node_motor_block_3);

  const endpoint_outlet_nozzle_4 = makeAttachmentEndpoint(null);
  const node_outlet_nozzle_4 = new THREE.Group();
  node_outlet_nozzle_4.name = "Outlet nozzle__pivot";
  node_outlet_nozzle_4.scale.set(1, 1, 1);
  if (endpoint_outlet_nozzle_4) {
    node_outlet_nozzle_4.position.copy(endpoint_outlet_nozzle_4.start);
    node_outlet_nozzle_4.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_outlet_nozzle_4.position.set(0.0, 0.22, 0.0);
    node_outlet_nozzle_4.rotation.set(0.0, 0.0, 0.0);
  }
  node_outlet_nozzle_4.userData.sculptComponent = {"id": "outlet-nozzle", "name": "Outlet nozzle", "level": "macro", "role": "motion", "importance": 0.95, "confidence": 0.9, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black revolved hose nozzle: collar flange in the dome recess, plain tube, three barbs narrowing upwards, open bore.", "geometryDescriptor": {"topologyIntent": "Black revolved hose nozzle: collar flange in the dome recess, plain tube, three barbs narrowing upwards, open bore.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, 0.0], [0.12, 0.0], [0.12, 0.012], [0.1, 0.025], [0.075, 0.025], [0.075, 0.09], [0.085, 0.092], [0.07, 0.135], [0.085, 0.137], [0.07, 0.19], [0.083, 0.192], [0.068, 0.245], [0.05, 0.245], [0.05, 0.17], [0.0001, 0.17]], "segments": 64}}, "parent": "impeller-dome", "attachment": {"parentSocket": "dome-recess", "localStart": [0, 0, 0], "localEnd": [0, 0.245, 0], "contactType": "seated", "embedDepth": 0.002, "overlap": 0.002, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0.22, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "outlet-nozzle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "nozzle-black", "materialLayers": ["nozzle-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "barbs", "kind": "bevel", "description": "Three hose barbs with sharp lower lips.", "effect": {"ridge": {"count": 3, "height": 0.015}}, "region": "nozzle", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(32, 32, 32, 1.0)", "secondaryAlbedo": "rgba(16, 16, 16, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "nozzle-black"}, "materialRegions": [{"regionId": "nozzle", "materialId": "nozzle-black", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\02-nozzle.png", "bbox": {"x": 400, "y": 225, "width": 60, "height": 45}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0017}}]};
  node_outlet_nozzle_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "outlet-nozzle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["impeller-dome"] ?? root).add(node_outlet_nozzle_4);
  nodes["outlet-nozzle"] = node_outlet_nozzle_4;
  const mesh_outlet_nozzle_4Geometry = endpoint_outlet_nozzle_4
    ? new THREE.CylinderGeometry(endpoint_outlet_nozzle_4.endRadius, endpoint_outlet_nozzle_4.baseRadius, endpoint_outlet_nozzle_4.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0001, 0.0], [0.12, 0.0], [0.12, 0.012], [0.1, 0.025], [0.075, 0.025], [0.075, 0.09], [0.085, 0.092], [0.07, 0.135], [0.085, 0.137], [0.07, 0.19], [0.083, 0.192], [0.068, 0.245], [0.05, 0.245], [0.05, 0.17], [0.0001, 0.17]], "segments": 64});
  if (!endpoint_outlet_nozzle_4) {
    mesh_outlet_nozzle_4Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_outlet_nozzle_4 = new THREE.Mesh(
    mesh_outlet_nozzle_4Geometry,
    materialMap["nozzle-black"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_outlet_nozzle_4.name = "Outlet nozzle";
  if (endpoint_outlet_nozzle_4) {
    mesh_outlet_nozzle_4.position.copy(endpoint_outlet_nozzle_4.midpoint);
    mesh_outlet_nozzle_4.quaternion.copy(endpoint_outlet_nozzle_4.quaternion);
  }
  mesh_outlet_nozzle_4.castShadow = options.castShadow ?? true;
  mesh_outlet_nozzle_4.receiveShadow = options.receiveShadow ?? true;
  mesh_outlet_nozzle_4.userData.sculptComponent = {"id": "outlet-nozzle", "name": "Outlet nozzle", "level": "macro", "role": "motion", "importance": 0.95, "confidence": 0.9, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Black revolved hose nozzle: collar flange in the dome recess, plain tube, three barbs narrowing upwards, open bore.", "geometryDescriptor": {"topologyIntent": "Black revolved hose nozzle: collar flange in the dome recess, plain tube, three barbs narrowing upwards, open bore.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0001, 0.0], [0.12, 0.0], [0.12, 0.012], [0.1, 0.025], [0.075, 0.025], [0.075, 0.09], [0.085, 0.092], [0.07, 0.135], [0.085, 0.137], [0.07, 0.19], [0.083, 0.192], [0.068, 0.245], [0.05, 0.245], [0.05, 0.17], [0.0001, 0.17]], "segments": 64}}, "parent": "impeller-dome", "attachment": {"parentSocket": "dome-recess", "localStart": [0, 0, 0], "localEnd": [0, 0.245, 0], "contactType": "seated", "embedDepth": 0.002, "overlap": 0.002, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0.22, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "outlet-nozzle", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "nozzle-black", "materialLayers": ["nozzle-black"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "barbs", "kind": "bevel", "description": "Three hose barbs with sharp lower lips.", "effect": {"ridge": {"count": 3, "height": 0.015}}, "region": "nozzle", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(32, 32, 32, 1.0)", "secondaryAlbedo": "rgba(16, 16, 16, 1.0)", "materialClass": "plastic", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "nozzle-black"}, "materialRegions": [{"regionId": "nozzle", "materialId": "nozzle-black", "profileId": "plastic.glossy", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\pump\\material-evidence\\02-nozzle.png", "bbox": {"x": 400, "y": 225, "width": 60, "height": 45}, "sourceWidth": 1254, "sourceHeight": 1254, "loaderWarnings": [], "coverage": 0.0017}}]};
  node_outlet_nozzle_4.add(mesh_outlet_nozzle_4);
  meshes["outlet-nozzle"] = mesh_outlet_nozzle_4;
  colliders["outlet-nozzle"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["outlet-nozzle"] ??= [];
  destructionGroups["outlet-nozzle"].push(node_outlet_nozzle_4);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createXingZSubmersiblePumpLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Xing-Z Submersible Pump look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "direction": [-0.3, 0.8, 0.5], "intensity": 2.2, "color": "#ffffff", "evidence": "Soft highlight on the dome shoulder and the block top; the right face of the block falls a little darker."}, {"id": "fill", "type": "hemisphere", "skyColor": "#ffffff", "groundColor": "#d9d9d9", "intensity": 0.7, "evidence": "White sweep lifts the black base to dark grey."}, {"id": "rim", "type": "directional", "direction": [0.6, 0.4, -0.7], "intensity": 1.2, "color": "#ffffff", "evidence": "Bright edges on the band top and the barb lips."}, {"id": "environment", "type": "room-environment", "intensity": 0.8, "evidence": "Broad softbox reflections on the teal plastic."}, {"id": "exposure", "type": "tone-mapping", "toneMapping": "ACES filmic", "exposure": 1.0, "evidence": "Bright white background, no clipping on the teal."}, {"id": "ground", "type": "contact shadow", "opacity": 0.25, "evidence": "Soft contact shadow under the bowl."}];
  lights.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createXingZSubmersiblePumpEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameXingZSubmersiblePumpCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createXingZSubmersiblePumpPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureXingZSubmersiblePumpRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createXingZSubmersiblePumpInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
