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

// Generated from ObjectSculptSpec target: Xing-Z H Frame Motor
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createXingZHFrameMotorModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Xing-Z H Frame Motor";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40.0, "aspect": 1.0, "orientation": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}, "positionHint": [0.0, 0.0, 3.0], "note": "For likeness work, solve the reference camera (forge/stage1_intake/solve_camera_pose.py) so the review render aligns with the photo and the reference can be projected. Confirm by overlay review."}, "approximationNotes": []};
  root.userData.materialPipeline = {"schemaVersion": 1, "status": "proceed", "registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "analysisArtifact": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-analysis.json", "targetThreshold": 0.7, "unresolvedNotObservedMaterials": [], "regions": [{"componentId": "lower-cup", "regionId": "coat", "specMaterialId": "powder-coat", "profileId": "coating.painted-metal", "status": "proceed"}, {"componentId": "end-bell", "regionId": "alu", "specMaterialId": "cast-aluminium", "profileId": "metal.aluminum", "status": "proceed"}, {"componentId": "shaft", "regionId": "teal", "specMaterialId": "teal-paint", "profileId": "coating.painted-metal", "status": "proceed"}, {"componentId": "bolt-right-0", "regionId": "bolt", "specMaterialId": "brass", "profileId": "metal.brass", "status": "proceed"}, {"componentId": "bracket-right", "regionId": "bracket", "specMaterialId": "bracket-coat", "profileId": "coating.painted-metal", "status": "proceed"}], "controlledViewsRequired": ["albedo-unlit", "environment-reflection", "grazing", "neutral-studio", "reference-beauty"]};
  root.userData.materialReferenceRegistry = "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["powder-coat"] = createSculptMaterial(
    "powder-coat",
    {"id": "powder-coat", "name": "Black satin powder coat", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#151515", "color": "#151515", "albedo": {"dominant": "#151515", "secondary": ["#1d1d1d"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#151515", "#1d1d1d"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.55, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "embossed-wordmark", "region": "front of the can between the brackets", "kind": "decal", "properties": {"implementation": "from the photo projection (src/models/projection.ts)", "roughness": 0.35}, "evidenceRef": "zone-r1c1"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "coating.painted-metal", "materialFamily": "coating", "materialSubtype": "paint-over-metal", "materialFinish": "gloss-or-satin", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "coating.painted-metal", "method": "family-subtype-finish", "confidence": 0.831, "sourceRefs": ["three.mesh-physical", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-1", "adobe.pbr-guide-2"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap", "clearcoatRoughnessMap", "metalnessMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": 0.0, "clearcoatRoughness": {"base": 0.12, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#2F2F2F", "#3C3C3C", "#414141", "#393939", "#303131"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 58.3, "meanSaturation": 0.002, "gradientStrength": 0.073, "mottle": 0.013, "streakRatio": 0.9, "hueSpread": 0.0, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "lower-cup", "regionId": "coat", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\00-coat.png", "bbox": {"x": 470, "y": 1150, "width": 150, "height": 80}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0051}, "observations": ["near-neutral colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "lower-cup", "regionId": "coat", "materialId": null, "family": "coating", "subtype": "paint-over-metal", "finish": "gloss-or-satin", "aliases": [], "confidence": 0.831, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/00-coat.png: near-uniform satin black", "Skill rule: solid albedo for flat paint"]}, "envMapIntensity": 0.5},
    options
  );
  materialMap["bracket-coat"] = createSculptMaterial(
    "bracket-coat",
    {"id": "bracket-coat", "name": "Black satin bracket coat", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#121212", "color": "#121212", "albedo": {"dominant": "#121212", "secondary": ["#1a1a1a"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#121212", "#1a1a1a"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.5, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "flange-pins", "region": "bracket flanges", "kind": "decal", "properties": {"implementation": "photo projection"}, "evidenceRef": "zone-r1c0"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "coating.painted-metal", "materialFamily": "coating", "materialSubtype": "paint-over-metal", "materialFinish": "gloss-or-satin", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "coating.painted-metal", "method": "family-subtype-finish", "confidence": 0.831, "sourceRefs": ["three.mesh-physical", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-1", "adobe.pbr-guide-2"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap", "clearcoatRoughnessMap", "metalnessMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": {"base": 0.75, "variation": 0.0}, "clearcoatRoughness": {"base": 0.12, "variation": 0.0}, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "worn-composite", "recipe": {"metalness": 0.0, "roughness": 0.9, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 0.5, "anisotropy": 0.0, "procedural": "mottle"}, "palette": ["#131313", "#131313", "#070707", "#0C0C0C", "#141414"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 12.8, "meanSaturation": 0.0, "gradientStrength": 0.056, "mottle": 0.003, "streakRatio": 1.21, "hueSpread": 0.0, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "bracket-right", "regionId": "bracket", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\04-bracket.png", "bbox": {"x": 1010, "y": 870, "width": 50, "height": 50}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0011}, "observations": ["near-neutral colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "bracket-right", "regionId": "bracket", "materialId": null, "family": "coating", "subtype": "paint-over-metal", "finish": "gloss-or-satin", "aliases": [], "confidence": 0.831, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/04-bracket.png: satin black like the housing"]}, "envMapIntensity": 0.5},
    options
  );
  materialMap["cast-aluminium"] = createSculptMaterial(
    "cast-aluminium",
    {"id": "cast-aluminium", "name": "As-cast aluminium", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c4c6c6", "color": "#c4c6c6", "albedo": {"dominant": "#c4c6c6", "secondary": ["#a9abab", "#dcdede"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#c4c6c6", "#a9abab", "#dcdede"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.45, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 1.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "cast-grain", "region": "end-bell faces", "kind": "stain", "properties": {"pattern": "as-cast grain", "scale": "sub-millimetre"}, "evidenceRef": "zone-r1c1"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "metal.aluminum", "materialFamily": "metal", "materialSubtype": "aluminum", "materialFinish": "satin", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "metal.aluminum", "method": "family-subtype-finish", "confidence": 0.767, "sourceRefs": ["three.mesh-standard", "three.pmrem", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "anisotropyMap"], "validationViews": ["neutral-studio", "environment-reflection", "grazing"]}, "anisotropy": {"base": 0.2, "variation": 0.0}, "textureAnalysis": {"finishClass": "brushed-steel", "recipe": {"metalness": 1.0, "roughness": 0.35, "clearcoat": 0.0, "clearcoatRoughness": 0.0, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 1.0, "procedural": "brushed"}, "palette": ["#E1E0DE", "#D9D6D4", "#D1CFCC", "#CAC8C5", "#CBC8C6"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 208.8, "meanSaturation": 0.022, "gradientStrength": 0.116, "mottle": 0.034, "streakRatio": 1.75, "hueSpread": 0.0, "specularFraction": 0.108}}, "materialEvidence": {"componentId": "end-bell", "regionId": "alu", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\01-alu.png", "bbox": {"x": 900, "y": 600, "width": 80, "height": 40}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0014}, "observations": ["near-neutral colour response", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "end-bell", "regionId": "alu", "materialId": null, "family": "metal", "subtype": "aluminum", "finish": "satin", "aliases": [], "confidence": 0.767, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "textureless": {"declared": true, "evidence": ["material-evidence/01-alu.png: as-cast satin aluminium, grain sub-pixel at configurator scale"]}, "envMapIntensity": 1.0},
    options
  );
  materialMap["teal-paint"] = createSculptMaterial(
    "teal-paint",
    {"id": "teal-paint", "name": "Teal shaft paint", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#2f5c54", "color": "#2f5c54", "albedo": {"dominant": "#2f5c54", "secondary": ["#3f7a6f", "#1f3f39"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#2f5c54", "#3f7a6f", "#1f3f39"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.35, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "sheen", "region": "shaft length", "kind": "gloss", "properties": {"clearcoat": 0.4, "roughness": 0.3}, "evidenceRef": "zone-r0c1"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "coating.painted-metal", "materialFamily": "coating", "materialSubtype": "paint-over-metal", "materialFinish": "gloss-or-satin", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "coating.painted-metal", "method": "family-subtype-finish", "confidence": 0.829, "sourceRefs": ["three.mesh-physical", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-1", "adobe.pbr-guide-2"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "clearcoatMap", "clearcoatRoughnessMap", "metalnessMap"], "validationViews": ["albedo-unlit", "neutral-studio", "grazing", "environment-reflection", "reference-beauty"]}, "clearcoat": 0.4, "clearcoatRoughness": 0.3, "ior": {"base": 1.5, "variation": 0.0}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#364643", "#68847F", "#1B2D2B", "#98BFB9", "#7BA29B"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 117.8, "meanSaturation": 0.248, "gradientStrength": 0.647, "mottle": 0.024, "streakRatio": 0.98, "hueSpread": 0.001, "specularFraction": 0.0}}, "materialEvidence": {"componentId": "shaft", "regionId": "teal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\02-teal.png", "bbox": {"x": 750, "y": 150, "width": 40, "height": 250}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0042}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "shaft", "regionId": "teal", "materialId": null, "family": "coating", "subtype": "paint-over-metal", "finish": "gloss-or-satin", "aliases": [], "confidence": 0.829, "source": "vision"}, "alternatives": []}, "textureless": {"declared": true, "evidence": ["material-evidence/02-teal.png: uniform dark teal paint with fine brushed streaks"]}, "envMapIntensity": 0.9},
    options
  );
  materialMap["brass"] = createSculptMaterial(
    "brass",
    {"id": "brass", "name": "Brass / yellow-zinc hardware", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#c4a24c", "color": "#c4a24c", "albedo": {"dominant": "#c4a24c", "secondary": ["#a8842f", "#e2c57a"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#c4a24c", "#a8842f", "#e2c57a"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.32, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 1.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "hex-facets", "region": "bolt flats", "kind": "gloss", "properties": {"roughness": 0.22}, "evidenceRef": "zone-r1c0"}], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "referenceMaterialId": "metal.brass", "materialFamily": "metal", "materialSubtype": "brass-bronze", "materialFinish": "polished-or-aged", "materialReference": {"registry": "C:\\Users\\arshp\\.claude\\skills\\img2threejs\\docs\\materials\\material-reference.json", "profileId": "metal.brass", "method": "family-subtype-finish", "confidence": 0.86, "sourceRefs": ["three.mesh-standard", "gltf.2", "khronos.gltf-pbr", "adobe.pbr-guide-2", "google.filament-pbr"], "requiredMaps": ["map", "roughnessMap"], "optionalMaps": ["normalMap", "aoMap", "metalnessMap"], "validationViews": ["albedo-unlit", "environment-reflection", "grazing", "reference-beauty"]}, "textureAnalysis": {"finishClass": "painted-metal", "recipe": {"metalness": 0.0, "roughness": 0.5, "clearcoat": 1.0, "clearcoatRoughness": 0.05, "transmission": 0.0, "ior": 1.5, "envMapIntensity": 1.0, "anisotropy": 0.0, "procedural": "flat-clearcoat"}, "palette": ["#665332", "#B8A27C", "#E0D9D2", "#E7D6C6", "#F5C9B3"], "paletteHueRisk": [], "gradientAxis": "horizontal", "stats": {"meanLum": 188.6, "meanSaturation": 0.257, "gradientStrength": 0.548, "mottle": 0.031, "streakRatio": 1.67, "hueSpread": 0.01, "specularFraction": 0.195}}, "materialEvidence": {"componentId": "bolt-right-0", "regionId": "bolt", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\03-bolt.png", "bbox": {"x": 1100, "y": 828, "width": 30, "height": 25}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0003}, "observations": ["chromatic base-colour response", "strong image-space gradient; verify it is material pattern, not lighting", "single-image PBR inference requires controlled render validation"], "hypothesis": {"componentId": "bolt-right-0", "regionId": "bolt", "materialId": null, "family": "metal", "subtype": "brass-bronze", "finish": "polished-or-aged", "aliases": [], "confidence": 0.86, "source": "vision"}, "alternatives": []}, "needsEnvironment": true, "textureless": {"declared": true, "evidence": ["material-evidence/03-bolt.png: plain yellow-zinc plating"]}, "envMapIntensity": 1.0},
    options
  );
  materialMap["bore-dark"] = createSculptMaterial(
    "bore-dark",
    {"id": "bore-dark", "name": "Shadowed bore", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "baseColor": "#0c0c0c", "color": "#0c0c0c", "albedo": {"dominant": "#0c0c0c", "secondary": ["#0c0c0c"], "samplingNotes": "Sampled from the reference crop."}, "colorVariation": {"palette": ["#0c0c0c"], "pattern": "uniform", "amplitude": 0.04, "heightCorrelation": 0.2}, "roughness": {"base": 0.7, "variation": 0.06, "map": "independent-procedural-field", "localResponse": "slightly lower on edges catching the key light"}, "metalness": {"base": 0.0, "variation": 0.0}, "ambientOcclusion": {"cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [], "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Replace with image-derived color, roughness, noise, and edge-wear notes.", "textureless": {"declared": true, "evidence": ["Shadowed bore, no visible texture"]}},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const endpoint_lower_cup_0 = makeAttachmentEndpoint(null);
  const node_lower_cup_0 = new THREE.Group();
  node_lower_cup_0.name = "Rounded lower cup__pivot";
  node_lower_cup_0.scale.set(1, 1, 1);
  if (endpoint_lower_cup_0) {
    node_lower_cup_0.position.copy(endpoint_lower_cup_0.start);
    node_lower_cup_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_lower_cup_0.position.set(0.0, 0.0, 0.0);
    node_lower_cup_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_lower_cup_0.userData.sculptComponent = {"id": "lower-cup", "name": "Rounded lower cup", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved drawn-steel cup with a deep rounded bottom; its lip sits just proud at the joint line.", "geometryDescriptor": {"topologyIntent": "Revolved drawn-steel cup with a deep rounded bottom; its lip sits just proud at the joint line.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, 0.0], [0.36, 0.0], [0.41, 0.012], [0.445, 0.03], [0.472, 0.058], [0.49, 0.092], [0.498, 0.13], [0.5, 0.17], [0.5, 0.49], [0.503, 0.496], [0.503, 0.505], [0.0, 0.505]], "segments": 96}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lower-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "powder-coat", "materialLayers": ["powder-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bottom-round", "kind": "bevel", "description": "Deep rounded bottom (about 0.2 D radius) to a flat centre.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.2, "segments": 8}}, "region": "bottom", "evidenceRef": "zone-r2c1"}, {"id": "joint-step", "kind": "linework", "description": "Joint line: the cup lip stands just proud of the body.", "effect": {"step": 0.003}, "region": "joint line", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(57, 57, 57, 1.0)", "secondaryAlbedo": "rgba(47, 47, 47, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "powder-coat"}, "materialRegions": [{"regionId": "coat", "materialId": "powder-coat", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\00-coat.png", "bbox": {"x": 470, "y": 1150, "width": 150, "height": 80}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0051}}]};
  node_lower_cup_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lower-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["root"] ?? root).add(node_lower_cup_0);
  nodes["lower-cup"] = node_lower_cup_0;
  const mesh_lower_cup_0Geometry = endpoint_lower_cup_0
    ? new THREE.CylinderGeometry(endpoint_lower_cup_0.endRadius, endpoint_lower_cup_0.baseRadius, endpoint_lower_cup_0.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0, 0.0], [0.36, 0.0], [0.41, 0.012], [0.445, 0.03], [0.472, 0.058], [0.49, 0.092], [0.498, 0.13], [0.5, 0.17], [0.5, 0.49], [0.503, 0.496], [0.503, 0.505], [0.0, 0.505]], "segments": 96});
  if (!endpoint_lower_cup_0) {
    mesh_lower_cup_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_lower_cup_0 = new THREE.Mesh(
    mesh_lower_cup_0Geometry,
    materialMap["powder-coat"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_lower_cup_0.name = "Rounded lower cup";
  if (endpoint_lower_cup_0) {
    mesh_lower_cup_0.position.copy(endpoint_lower_cup_0.midpoint);
    mesh_lower_cup_0.quaternion.copy(endpoint_lower_cup_0.quaternion);
  }
  mesh_lower_cup_0.castShadow = options.castShadow ?? true;
  mesh_lower_cup_0.receiveShadow = options.receiveShadow ?? true;
  mesh_lower_cup_0.userData.sculptComponent = {"id": "lower-cup", "name": "Rounded lower cup", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved drawn-steel cup with a deep rounded bottom; its lip sits just proud at the joint line.", "geometryDescriptor": {"topologyIntent": "Revolved drawn-steel cup with a deep rounded bottom; its lip sits just proud at the joint line.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, 0.0], [0.36, 0.0], [0.41, 0.012], [0.445, 0.03], [0.472, 0.058], [0.49, 0.092], [0.498, 0.13], [0.5, 0.17], [0.5, 0.49], [0.503, 0.496], [0.503, 0.505], [0.0, 0.505]], "segments": 96}}, "parent": null, "attachment": null, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "lower-cup", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "powder-coat", "materialLayers": ["powder-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bottom-round", "kind": "bevel", "description": "Deep rounded bottom (about 0.2 D radius) to a flat centre.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.2, "segments": 8}}, "region": "bottom", "evidenceRef": "zone-r2c1"}, {"id": "joint-step", "kind": "linework", "description": "Joint line: the cup lip stands just proud of the body.", "effect": {"step": 0.003}, "region": "joint line", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(57, 57, 57, 1.0)", "secondaryAlbedo": "rgba(47, 47, 47, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "powder-coat"}, "materialRegions": [{"regionId": "coat", "materialId": "powder-coat", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\00-coat.png", "bbox": {"x": 470, "y": 1150, "width": 150, "height": 80}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0051}}]};
  node_lower_cup_0.add(mesh_lower_cup_0);
  meshes["lower-cup"] = mesh_lower_cup_0;
  colliders["lower-cup"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["lower-cup"] ??= [];
  destructionGroups["lower-cup"].push(node_lower_cup_0);

  const endpoint_can_body_1 = makeAttachmentEndpoint(null);
  const node_can_body_1 = new THREE.Group();
  node_can_body_1.name = "Can body__pivot";
  node_can_body_1.scale.set(1, 1, 1);
  if (endpoint_can_body_1) {
    node_can_body_1.position.copy(endpoint_can_body_1.start);
    node_can_body_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_can_body_1.position.set(0.0, 0.0, 0.0);
    node_can_body_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_can_body_1.userData.sculptComponent = {"id": "can-body", "name": "Can body", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved black can from the joint line up to the end-bell skirt; a small chamfer at the joint makes the groove.", "geometryDescriptor": {"topologyIntent": "Revolved black can from the joint line up to the end-bell skirt; a small chamfer at the joint makes the groove.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, 0.505], [0.497, 0.505], [0.5, 0.511], [0.5, 1.065], [0.0, 1.065]], "segments": 96}}, "parent": "lower-cup", "attachment": {"parentSocket": "cup-lip", "localStart": [0, 0.505, 0], "localEnd": [0, 1.065, 0], "contactType": "butt-joint", "embedDepth": 0.004, "overlap": 0.004, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "can-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "powder-coat", "materialLayers": ["powder-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "joint-chamfer", "kind": "bevel", "description": "Small chamfer at the joint line.", "effect": {"edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 1}}, "region": "joint line", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(57, 57, 57, 1.0)", "secondaryAlbedo": "rgba(47, 47, 47, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_can_body_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "can-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["lower-cup"] ?? root).add(node_can_body_1);
  nodes["can-body"] = node_can_body_1;
  const mesh_can_body_1Geometry = endpoint_can_body_1
    ? new THREE.CylinderGeometry(endpoint_can_body_1.endRadius, endpoint_can_body_1.baseRadius, endpoint_can_body_1.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0, 0.505], [0.497, 0.505], [0.5, 0.511], [0.5, 1.065], [0.0, 1.065]], "segments": 96});
  if (!endpoint_can_body_1) {
    mesh_can_body_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_can_body_1 = new THREE.Mesh(
    mesh_can_body_1Geometry,
    materialMap["powder-coat"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_can_body_1.name = "Can body";
  if (endpoint_can_body_1) {
    mesh_can_body_1.position.copy(endpoint_can_body_1.midpoint);
    mesh_can_body_1.quaternion.copy(endpoint_can_body_1.quaternion);
  }
  mesh_can_body_1.castShadow = options.castShadow ?? true;
  mesh_can_body_1.receiveShadow = options.receiveShadow ?? true;
  mesh_can_body_1.userData.sculptComponent = {"id": "can-body", "name": "Can body", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.85, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved black can from the joint line up to the end-bell skirt; a small chamfer at the joint makes the groove.", "geometryDescriptor": {"topologyIntent": "Revolved black can from the joint line up to the end-bell skirt; a small chamfer at the joint makes the groove.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, 0.505], [0.497, 0.505], [0.5, 0.511], [0.5, 1.065], [0.0, 1.065]], "segments": 96}}, "parent": "lower-cup", "attachment": {"parentSocket": "cup-lip", "localStart": [0, 0.505, 0], "localEnd": [0, 1.065, 0], "contactType": "butt-joint", "embedDepth": 0.004, "overlap": 0.004, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.85}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.85}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "can-body", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "powder-coat", "materialLayers": ["powder-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "joint-chamfer", "kind": "bevel", "description": "Small chamfer at the joint line.", "effect": {"edgeTreatment": {"type": "chamfer", "bevelRadius": 0.006, "segments": 1}}, "region": "joint line", "evidenceRef": "zone-r2c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(57, 57, 57, 1.0)", "secondaryAlbedo": "rgba(47, 47, 47, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_can_body_1.add(mesh_can_body_1);
  meshes["can-body"] = mesh_can_body_1;
  colliders["can-body"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["can-body"] ??= [];
  destructionGroups["can-body"].push(node_can_body_1);

  const endpoint_end_bell_2 = makeAttachmentEndpoint(null);
  const node_end_bell_2 = new THREE.Group();
  node_end_bell_2.name = "Die-cast aluminium end-bell__pivot";
  node_end_bell_2.scale.set(1, 1, 1);
  if (endpoint_end_bell_2) {
    node_end_bell_2.position.copy(endpoint_end_bell_2.start);
    node_end_bell_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_end_bell_2.position.set(0.0, 1.169, 0.0);
    node_end_bell_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_end_bell_2.userData.sculptComponent = {"id": "end-bell", "name": "Die-cast aluminium end-bell", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved cast cap: short skirt, rounded rim, raised rib annulus and a raised inner disc round the hub.", "geometryDescriptor": {"topologyIntent": "Revolved cast cap: short skirt, rounded rim, raised rib annulus and a raised inner disc round the hub.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, -0.10400000000000009], [0.502, -0.10400000000000009], [0.502, -0.02], [0.494, -0.006], [0.48, 0.0], [0.44, 0.0], [0.44, 0.012], [0.3, 0.012], [0.29, 0.0], [0.27, 0.0], [0.26, 0.018], [0.12, 0.018], [0.12, 0.0], [0.0, 0.0]], "segments": 128}}, "parent": "can-body", "attachment": {"parentSocket": "can-top", "localStart": [0, -0.10400000000000009, 0], "localEnd": [0, 0, 0], "contactType": "butt-joint", "embedDepth": 0.004, "overlap": 0.004, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.169, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "end-bell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "skirt-edge", "kind": "bevel", "description": "Rounded rim over a short skirt.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.02, "segments": 3}}, "region": "top rim", "evidenceRef": "zone-r1c1"}, {"id": "rib-pattern", "kind": "bevel", "description": "Raised annulus r 0.30-0.44 crossed by six radial ribs; raised inner disc r 0.12-0.26.", "effect": {"repetitionSystem": "ribs"}, "region": "top face", "evidenceRef": "zone-r1c1"}, {"id": "screw-heads", "kind": "fastener", "description": "4 brass domed screws on raised pads at r 0.456.", "effect": {"repetitionSystem": "screw-pads+screw-heads"}, "region": "top face rim", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(209, 207, 204, 1.0)", "secondaryAlbedo": "rgba(202, 200, 197, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "cast-aluminium"}, "materialRegions": [{"regionId": "alu", "materialId": "cast-aluminium", "profileId": "metal.aluminum", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\01-alu.png", "bbox": {"x": 900, "y": 600, "width": 80, "height": 40}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0014}}]};
  node_end_bell_2.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "end-bell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["can-body"] ?? root).add(node_end_bell_2);
  nodes["end-bell"] = node_end_bell_2;
  const mesh_end_bell_2Geometry = endpoint_end_bell_2
    ? new THREE.CylinderGeometry(endpoint_end_bell_2.endRadius, endpoint_end_bell_2.baseRadius, endpoint_end_bell_2.length, 16, 6)
    : buildLatheGeometry({"points": [[0.0, -0.10400000000000009], [0.502, -0.10400000000000009], [0.502, -0.02], [0.494, -0.006], [0.48, 0.0], [0.44, 0.0], [0.44, 0.012], [0.3, 0.012], [0.29, 0.0], [0.27, 0.0], [0.26, 0.018], [0.12, 0.018], [0.12, 0.0], [0.0, 0.0]], "segments": 128});
  if (!endpoint_end_bell_2) {
    mesh_end_bell_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_end_bell_2 = new THREE.Mesh(
    mesh_end_bell_2Geometry,
    materialMap["cast-aluminium"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_end_bell_2.name = "Die-cast aluminium end-bell";
  if (endpoint_end_bell_2) {
    mesh_end_bell_2.position.copy(endpoint_end_bell_2.midpoint);
    mesh_end_bell_2.quaternion.copy(endpoint_end_bell_2.quaternion);
  }
  mesh_end_bell_2.castShadow = options.castShadow ?? true;
  mesh_end_bell_2.receiveShadow = options.receiveShadow ?? true;
  mesh_end_bell_2.userData.sculptComponent = {"id": "end-bell", "name": "Die-cast aluminium end-bell", "level": "macro", "role": "body", "importance": 0.95, "confidence": 0.8, "primitive": "lathe", "topologyClass": "assembled-solid", "topologyRationale": "Revolved cast cap: short skirt, rounded rim, raised rib annulus and a raised inner disc round the hub.", "geometryDescriptor": {"topologyIntent": "Revolved cast cap: short skirt, rounded rim, raised rib annulus and a raised inner disc round the hub.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry", "latheProfile": {"points": [[0.0, -0.10400000000000009], [0.502, -0.10400000000000009], [0.502, -0.02], [0.494, -0.006], [0.48, 0.0], [0.44, 0.0], [0.44, 0.012], [0.3, 0.012], [0.29, 0.0], [0.27, 0.0], [0.26, 0.018], [0.12, 0.018], [0.12, 0.0], [0.0, 0.0]], "segments": 128}}, "parent": "can-body", "attachment": {"parentSocket": "can-top", "localStart": [0, -0.10400000000000009, 0], "localEnd": [0, 0, 0], "contactType": "butt-joint", "embedDepth": 0.004, "overlap": 0.004, "gapTolerance": 0.002}, "dimensions": {"width": 1, "height": 1, "depth": 1, "units": "relative", "confidence": 0.8}, "transform": {"position": [0, 1.169, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.8}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "end-bell", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "cast-aluminium", "materialLayers": ["cast-aluminium"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "skirt-edge", "kind": "bevel", "description": "Rounded rim over a short skirt.", "effect": {"edgeTreatment": {"type": "fillet", "bevelRadius": 0.02, "segments": 3}}, "region": "top rim", "evidenceRef": "zone-r1c1"}, {"id": "rib-pattern", "kind": "bevel", "description": "Raised annulus r 0.30-0.44 crossed by six radial ribs; raised inner disc r 0.12-0.26.", "effect": {"repetitionSystem": "ribs"}, "region": "top face", "evidenceRef": "zone-r1c1"}, {"id": "screw-heads", "kind": "fastener", "description": "4 brass domed screws on raised pads at r 0.456.", "effect": {"repetitionSystem": "screw-pads+screw-heads"}, "region": "top face rim", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(209, 207, 204, 1.0)", "secondaryAlbedo": "rgba(202, 200, 197, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "cast-aluminium"}, "materialRegions": [{"regionId": "alu", "materialId": "cast-aluminium", "profileId": "metal.aluminum", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\01-alu.png", "bbox": {"x": 900, "y": 600, "width": 80, "height": 40}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0014}}]};
  node_end_bell_2.add(mesh_end_bell_2);
  meshes["end-bell"] = mesh_end_bell_2;
  colliders["end-bell"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["end-bell"] ??= [];
  destructionGroups["end-bell"].push(node_end_bell_2);

  const attachment_shaft_3 = {"parentSocket": "hub-bore", "localStart": [0, 0.03, 0], "localEnd": [0, 0.722, 0], "contactType": "socket", "embedDepth": 0.005, "overlap": 0.005, "gapTolerance": 0.002, "baseRadius": 0.047, "endRadius": 0.047};
  const endpoint_shaft_3 = makeAttachmentEndpoint(attachment_shaft_3);
  const node_shaft_3 = new THREE.Group();
  node_shaft_3.name = "Teal output shaft__pivot";
  node_shaft_3.scale.set(1, 1, 1);
  if (endpoint_shaft_3) {
    node_shaft_3.position.copy(endpoint_shaft_3.start);
    node_shaft_3.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_shaft_3.position.set(0.0, 0.03, 0.0);
    node_shaft_3.rotation.set(0.0, 0.0, 0.0);
  }
  node_shaft_3.userData.sculptComponent = {"id": "shaft", "name": "Teal output shaft", "level": "macro", "role": "motion", "importance": 0.95, "confidence": 0.9, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Teal-painted steel shaft rising from the hub bore to 0.72 D above the top face.", "geometryDescriptor": {"topologyIntent": "Teal-painted steel shaft rising from the hub bore to 0.72 D above the top face.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "end-bell", "attachment": {"parentSocket": "hub-bore", "localStart": [0, 0.03, 0], "localEnd": [0, 0.722, 0], "contactType": "socket", "embedDepth": 0.005, "overlap": 0.005, "gapTolerance": 0.002, "baseRadius": 0.047, "endRadius": 0.047}, "dimensions": {"width": 0.094, "height": 0.692, "depth": 0.094, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0.03, 0], "rotation": [0, 0, 0], "scale": [0.094, 0.692, 0.094]}, "actionProfile": {"animationRole": "spin", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shaft", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal-paint", "materialLayers": ["teal-paint"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tip-bore", "kind": "bevel", "description": "Small centre hole in the shaft tip.", "effect": {"recess": {"radius": 0.016}}, "region": "shaft tip", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(104, 132, 127, 1.0)", "secondaryAlbedo": "rgba(27, 45, 43, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "teal-paint"}, "materialRegions": [{"regionId": "teal", "materialId": "teal-paint", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\02-teal.png", "bbox": {"x": 750, "y": 150, "width": 40, "height": 250}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0042}}]};
  node_shaft_3.userData.actionProfile = {"animationRole": "spin", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shaft", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["end-bell"] ?? root).add(node_shaft_3);
  nodes["shaft"] = node_shaft_3;
  const mesh_shaft_3Geometry = endpoint_shaft_3
    ? new THREE.CylinderGeometry(endpoint_shaft_3.endRadius, endpoint_shaft_3.baseRadius, endpoint_shaft_3.length, 16, 6)
    : new THREE.CylinderGeometry(0.5, 0.5, 1, 24, 8);
  if (!endpoint_shaft_3) {
    mesh_shaft_3Geometry.scale(0.094, 0.692, 0.094);
  }
  const mesh_shaft_3 = new THREE.Mesh(
    mesh_shaft_3Geometry,
    materialMap["teal-paint"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_shaft_3.name = "Teal output shaft";
  if (endpoint_shaft_3) {
    mesh_shaft_3.position.copy(endpoint_shaft_3.midpoint);
    mesh_shaft_3.quaternion.copy(endpoint_shaft_3.quaternion);
  }
  mesh_shaft_3.castShadow = options.castShadow ?? true;
  mesh_shaft_3.receiveShadow = options.receiveShadow ?? true;
  mesh_shaft_3.userData.sculptComponent = {"id": "shaft", "name": "Teal output shaft", "level": "macro", "role": "motion", "importance": 0.95, "confidence": 0.9, "primitive": "cylinder", "topologyClass": "assembled-solid", "topologyRationale": "Teal-painted steel shaft rising from the hub bore to 0.72 D above the top face.", "geometryDescriptor": {"topologyIntent": "Teal-painted steel shaft rising from the hub bore to 0.72 D above the top face.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "end-bell", "attachment": {"parentSocket": "hub-bore", "localStart": [0, 0.03, 0], "localEnd": [0, 0.722, 0], "contactType": "socket", "embedDepth": 0.005, "overlap": 0.005, "gapTolerance": 0.002, "baseRadius": 0.047, "endRadius": 0.047}, "dimensions": {"width": 0.094, "height": 0.692, "depth": 0.094, "units": "relative", "confidence": 0.9}, "transform": {"position": [0, 0.03, 0], "rotation": [0, 0, 0], "scale": [0.094, 0.692, 0.094]}, "actionProfile": {"animationRole": "spin", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.9}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "shaft", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "teal-paint", "materialLayers": ["teal-paint"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "tip-bore", "kind": "bevel", "description": "Small centre hole in the shaft tip.", "effect": {"recess": {"radius": 0.016}}, "region": "shaft tip", "evidenceRef": "zone-r0c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "none", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["full-object"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(104, 132, 127, 1.0)", "secondaryAlbedo": "rgba(27, 45, 43, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "teal-paint"}, "materialRegions": [{"regionId": "teal", "materialId": "teal-paint", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\02-teal.png", "bbox": {"x": 750, "y": 150, "width": 40, "height": 250}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0042}}]};
  node_shaft_3.add(mesh_shaft_3);
  meshes["shaft"] = mesh_shaft_3;
  colliders["shaft"] = {"type": "cylinder", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["shaft"] ??= [];
  destructionGroups["shaft"].push(node_shaft_3);

  const endpoint_bracket_left_4 = makeAttachmentEndpoint(null);
  const node_bracket_left_4 = new THREE.Group();
  node_bracket_left_4.name = "H-frame bracket (left)__pivot";
  node_bracket_left_4.scale.set(1, 1, 1);
  if (endpoint_bracket_left_4) {
    node_bracket_left_4.position.copy(endpoint_bracket_left_4.start);
    node_bracket_left_4.rotation.set(0.0, -0.6981, 0.0);
  } else {
    node_bracket_left_4.position.set(-0.3191, 0.7825, 0.2661);
    node_bracket_left_4.rotation.set(0.0, -0.6981, 0.0);
  }
  node_bracket_left_4.userData.sculptComponent = {"id": "bracket-left", "name": "H-frame bracket (left)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "geometryDescriptor": {"topologyIntent": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "can-body", "attachment": {"parentSocket": "can-side", "localStart": [-0.3191, 0.6, 0.2661], "localEnd": [-0.3191, 0.965, 0.2661], "contactType": "welded", "embedDepth": 0.01, "overlap": 0.01, "gapTolerance": 0.002}, "dimensions": {"width": 0.3, "height": 0.365, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.3191, 0.7825, 0.2661], "rotation": [0, -0.6981, 0], "scale": [0.3, 0.365, 0.18]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bracket-coat", "materialLayers": ["bracket-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bracket-bolts", "kind": "fastener", "description": "Two brass hex bolts with washers on the bracket face near its outer edge.", "effect": {"components": "washer-left-*, bolt-left-*"}, "region": "bracket face", "evidenceRef": "zone-r1c0"}, {"id": "flange-pins", "kind": "fastener", "description": "Two small pin dots on the inner flange.", "effect": {"decal": "from photo projection"}, "region": "bracket flange", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c0"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 19, 1.0)", "secondaryAlbedo": "rgba(7, 7, 7, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_bracket_left_4.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["can-body"] ?? root).add(node_bracket_left_4);
  nodes["bracket-left"] = node_bracket_left_4;
  const mesh_bracket_left_4Geometry = endpoint_bracket_left_4
    ? new THREE.CylinderGeometry(endpoint_bracket_left_4.endRadius, endpoint_bracket_left_4.baseRadius, endpoint_bracket_left_4.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_bracket_left_4) {
    mesh_bracket_left_4Geometry.scale(0.3, 0.365, 0.18);
  }
  const mesh_bracket_left_4 = new THREE.Mesh(
    mesh_bracket_left_4Geometry,
    materialMap["bracket-coat"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bracket_left_4.name = "H-frame bracket (left)";
  if (endpoint_bracket_left_4) {
    mesh_bracket_left_4.position.copy(endpoint_bracket_left_4.midpoint);
    mesh_bracket_left_4.quaternion.copy(endpoint_bracket_left_4.quaternion);
  }
  mesh_bracket_left_4.castShadow = options.castShadow ?? true;
  mesh_bracket_left_4.receiveShadow = options.receiveShadow ?? true;
  mesh_bracket_left_4.userData.sculptComponent = {"id": "bracket-left", "name": "H-frame bracket (left)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "geometryDescriptor": {"topologyIntent": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "can-body", "attachment": {"parentSocket": "can-side", "localStart": [-0.3191, 0.6, 0.2661], "localEnd": [-0.3191, 0.965, 0.2661], "contactType": "welded", "embedDepth": 0.01, "overlap": 0.01, "gapTolerance": 0.002}, "dimensions": {"width": 0.3, "height": 0.365, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [-0.3191, 0.7825, 0.2661], "rotation": [0, -0.6981, 0], "scale": [0.3, 0.365, 0.18]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-left", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bracket-coat", "materialLayers": ["bracket-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bracket-bolts", "kind": "fastener", "description": "Two brass hex bolts with washers on the bracket face near its outer edge.", "effect": {"components": "washer-left-*, bolt-left-*"}, "region": "bracket face", "evidenceRef": "zone-r1c0"}, {"id": "flange-pins", "kind": "fastener", "description": "Two small pin dots on the inner flange.", "effect": {"decal": "from photo projection"}, "region": "bracket flange", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c0"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 19, 1.0)", "secondaryAlbedo": "rgba(7, 7, 7, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}};
  node_bracket_left_4.add(mesh_bracket_left_4);
  meshes["bracket-left"] = mesh_bracket_left_4;
  colliders["bracket-left"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["bracket-left"] ??= [];
  destructionGroups["bracket-left"].push(node_bracket_left_4);

  const endpoint_bracket_right_5 = makeAttachmentEndpoint(null);
  const node_bracket_right_5 = new THREE.Group();
  node_bracket_right_5.name = "H-frame bracket (right)__pivot";
  node_bracket_right_5.scale.set(1, 1, 1);
  if (endpoint_bracket_right_5) {
    node_bracket_right_5.position.copy(endpoint_bracket_right_5.start);
    node_bracket_right_5.rotation.set(0.0, 0.6981, 0.0);
  } else {
    node_bracket_right_5.position.set(0.3191, 0.7825, 0.2661);
    node_bracket_right_5.rotation.set(0.0, 0.6981, 0.0);
  }
  node_bracket_right_5.userData.sculptComponent = {"id": "bracket-right", "name": "H-frame bracket (right)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "geometryDescriptor": {"topologyIntent": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "can-body", "attachment": {"parentSocket": "can-side", "localStart": [0.3191, 0.6, 0.2661], "localEnd": [0.3191, 0.965, 0.2661], "contactType": "welded", "embedDepth": 0.01, "overlap": 0.01, "gapTolerance": 0.002}, "dimensions": {"width": 0.3, "height": 0.365, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.3191, 0.7825, 0.2661], "rotation": [0, 0.6981, 0], "scale": [0.3, 0.365, 0.18]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bracket-coat", "materialLayers": ["bracket-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bracket-bolts", "kind": "fastener", "description": "Two brass hex bolts with washers on the bracket face near its outer edge.", "effect": {"components": "washer-right-*, bolt-right-*"}, "region": "bracket face", "evidenceRef": "zone-r1c0"}, {"id": "flange-pins", "kind": "fastener", "description": "Two small pin dots on the inner flange.", "effect": {"decal": "from photo projection"}, "region": "bracket flange", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c0"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 19, 1.0)", "secondaryAlbedo": "rgba(7, 7, 7, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "bracket-coat"}, "materialRegions": [{"regionId": "bracket", "materialId": "bracket-coat", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\04-bracket.png", "bbox": {"x": 1010, "y": 870, "width": 50, "height": 50}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_bracket_right_5.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}};
  (nodes["can-body"] ?? root).add(node_bracket_right_5);
  nodes["bracket-right"] = node_bracket_right_5;
  const mesh_bracket_right_5Geometry = endpoint_bracket_right_5
    ? new THREE.CylinderGeometry(endpoint_bracket_right_5.endRadius, endpoint_bracket_right_5.baseRadius, endpoint_bracket_right_5.length, 16, 6)
    : new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  if (!endpoint_bracket_right_5) {
    mesh_bracket_right_5Geometry.scale(0.3, 0.365, 0.18);
  }
  const mesh_bracket_right_5 = new THREE.Mesh(
    mesh_bracket_right_5Geometry,
    materialMap["bracket-coat"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_bracket_right_5.name = "H-frame bracket (right)";
  if (endpoint_bracket_right_5) {
    mesh_bracket_right_5.position.copy(endpoint_bracket_right_5.midpoint);
    mesh_bracket_right_5.quaternion.copy(endpoint_bracket_right_5.quaternion);
  }
  mesh_bracket_right_5.castShadow = options.castShadow ?? true;
  mesh_bracket_right_5.receiveShadow = options.receiveShadow ?? true;
  mesh_bracket_right_5.userData.sculptComponent = {"id": "bracket-right", "name": "H-frame bracket (right)", "level": "macro", "role": "structure", "importance": 0.8, "confidence": 0.7, "primitive": "box", "topologyClass": "assembled-solid", "topologyRationale": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "geometryDescriptor": {"topologyIntent": "Pressed-steel channel bracket welded to the can, its face turned toward the front to carry two bolts.", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": "can-body", "attachment": {"parentSocket": "can-side", "localStart": [0.3191, 0.6, 0.2661], "localEnd": [0.3191, 0.965, 0.2661], "contactType": "welded", "embedDepth": 0.01, "overlap": 0.01, "gapTolerance": 0.002}, "dimensions": {"width": 0.3, "height": 0.365, "depth": 0.18, "units": "relative", "confidence": 0.7}, "transform": {"position": [0.3191, 0.7825, 0.2661], "rotation": [0, 0.6981, 0], "scale": [0.3, 0.365, 0.18]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "base", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.7}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": true, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "bracket-right", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "base"}}, "material": "bracket-coat", "materialLayers": ["bracket-coat"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "bracket-bolts", "kind": "fastener", "description": "Two brass hex bolts with washers on the bracket face near its outer edge.", "effect": {"components": "washer-right-*, bolt-right-*"}, "region": "bracket face", "evidenceRef": "zone-r1c0"}, {"id": "flange-pins", "kind": "fastener", "description": "Two small pin dots on the inner flange.", "effect": {"decal": "from photo projection"}, "region": "bracket flange", "evidenceRef": "zone-r1c1"}], "surfaceDetail": {"macroRoughness": 0.6, "microRoughness": 0.5, "bumpAmplitude": 0.004, "normalPattern": "crinkle powder-coat wrinkle", "displacementPattern": "", "occlusionPattern": "darken seams and recess steps", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["zone-r1c0"], "details": [], "fidelityTier": "blockout", "colorMaterialRecipe": {"dominantAlbedo": "rgba(19, 19, 19, 1.0)", "secondaryAlbedo": "rgba(7, 7, 7, 1.0)", "materialClass": "metal", "materialClassConfidence": 0.8, "evidenceRef": "material-evidence palette (photo crop)"}, "uvContract": {"status": "unwrapped", "strategy": "generated procedural coordinates", "materialId": "bracket-coat"}, "materialRegions": [{"regionId": "bracket", "materialId": "bracket-coat", "profileId": "coating.painted-metal", "crop": {"path": "D:\\CLAUDE WEBSITE\\.img2threejs-work\\h-frame\\material-evidence\\04-bracket.png", "bbox": {"x": 1010, "y": 870, "width": 50, "height": 50}, "sourceWidth": 1536, "sourceHeight": 1536, "loaderWarnings": [], "coverage": 0.0011}}]};
  node_bracket_right_5.add(mesh_bracket_right_5);
  meshes["bracket-right"] = mesh_bracket_right_5;
  colliders["bracket-right"] = {"type": "box", "offset": [0, 0, 0], "scale": [1, 1, 1], "isTrigger": false, "notes": "Proxy follows the component bounds."};
  destructionGroups["bracket-right"] ??= [];
  destructionGroups["bracket-right"].push(node_bracket_right_5);

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createXingZHFrameMotorLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Xing-Z H Frame Motor look-dev lights";
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
  lights.userData.lightingFromPhoto = [{"id": "key", "type": "directional", "direction": [-0.4, 0.8, 0.45], "intensity": 2.4, "color": "#ffffff", "evidence": "Soft highlight down the left of the can and on the top face; shadow falls right."}, {"id": "fill", "type": "hemisphere", "skyColor": "#ffffff", "groundColor": "#d9d9d9", "intensity": 0.6, "evidence": "Seamless white sweep lifts the shadow side of the black coat to dark grey."}, {"id": "rim", "type": "directional", "direction": [0.6, 0.4, -0.7], "intensity": 1.4, "color": "#ffffff", "evidence": "Thin bright edges on the top rim, band edges and shaft right side."}, {"id": "environment", "type": "room-environment", "intensity": 0.8, "evidence": "Studio softboxes reflected in the ground steel and screw domes."}, {"id": "exposure", "type": "tone-mapping", "toneMapping": "ACES filmic", "exposure": 1.0, "evidence": "Bright white background without clipping on the steel highlights."}, {"id": "ground", "type": "contact shadow", "opacity": 0.25, "evidence": "Soft ground shadow under the base and studs on the white sweep."}];
  lights.userData.lookDevTargets = {"qualityPriority": "balanced", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createXingZHFrameMotorEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
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
export function frameXingZHFrameMotorCamera(
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
export function createXingZHFrameMotorPresentationComposer(
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

export function configureXingZHFrameMotorRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createXingZHFrameMotorInspectControls(
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
