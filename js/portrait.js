// The avatar, rebuilt from its own pixels as instanced cubes.
// uAssemble: 0 = scattered, 1 = assembled  (intro)
// uRelief:   pushes bright pixels forward    (about)
// uScatter:  breaks it into floating room dust (after about)
import * as THREE from 'three';

const VERT = /* glsl */`
  uniform float uAssemble, uRelief, uScatter, uTime;
  attribute vec3 aHome, aColor, aScatter;
  attribute float aDepth, aSeed;
  varying vec3 vColor; varying vec3 vNormal; varying float vChaos;
  mat3 rot(float a, float b) {
    float ca = cos(a), sa = sin(a), cb = cos(b), sb = sin(b);
    return mat3(cb, 0., -sb, 0., 1., 0., sb, 0., cb) * mat3(1., 0., 0., 0., ca, sa, 0., -sa, ca);
  }
  void main() {
    float a = clamp(uAssemble * 1.7 - aSeed * 0.7, 0., 1.);
    a = 1. - pow(1. - a, 3.);
    float s = clamp(uScatter * 1.7 - aSeed * 0.7, 0., 1.);
    s = s * s * (3. - 2. * s);
    float chaos = max(1. - a, s);
    float wave = sin(uTime * 1.6 + aHome.x * 2.2 + aHome.y * 1.3) * 0.035;
    vec3 home = aHome + vec3(0., 0., (aDepth + wave) * uRelief);
    vec3 drift = aScatter + vec3(sin(uTime * .21 + aSeed * 40.) * .7, sin(uTime * .33 + aSeed * 17.) * .45, cos(uTime * .19 + aSeed * 29.) * .7);
    vec3 p = mix(home, drift, chaos);
    mat3 R = rot(chaos * (uTime * .7 + aSeed * 20.), chaos * (uTime * .5 + aSeed * 11.));
    vec3 lp = R * (position * (1. - chaos * .45));
    vNormal = normalize(mat3(modelMatrix) * (R * normal));
    vColor = aColor; vChaos = chaos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p + lp, 1.);
  }
`;
const FRAG = /* glsl */`
  varying vec3 vColor; varying vec3 vNormal; varying float vChaos;
  void main() {
    vec3 L = normalize(vec3(.35, .7, .6));
    float d = max(dot(normalize(vNormal), L), 0.);
    float rim = pow(1. - abs(normalize(vNormal).z), 2.) * .15;
    vec3 c = vColor * (.62 + .55 * d) + vec3(.9, .55, .12) * (rim + vChaos * .12);
    gl_FragColor = vec4(c, 1.);
  }
`;

export function createPortrait(image, { size = 64, cube = 0.066 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  g.drawImage(image, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data;

  const n = size * size;
  const home = new Float32Array(n * 3), color = new Float32Array(n * 3), scatter = new Float32Array(n * 3);
  const depth = new Float32Array(n), seed = new Float32Array(n);
  const c = new THREE.Color();
  let s = 12345;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const half = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, k = i * 4;
    home.set([(x - half) * cube, (half - y) * cube, 0], i * 3);
    c.setRGB(px[k] / 255, px[k + 1] / 255, px[k + 2] / 255, THREE.SRGBColorSpace);
    color.set([c.r, c.g, c.b], i * 3);
    const lum = (0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]) / 255;
    depth[i] = (lum - 0.4) * 0.9 + (rand() - 0.5) * 0.08;
    scatter.set([(rand() - 0.5) * 25, 2.45 + rand() * 1.7, (rand() - 0.5) * 25 - 1], i * 3);
    seed[i] = rand();
  }

  const box = new THREE.BoxGeometry(cube * 0.94, cube * 0.94, cube * 0.94);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index;
  geo.setAttribute('position', box.getAttribute('position'));
  geo.setAttribute('normal', box.getAttribute('normal'));
  geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 3));
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(color, 3));
  geo.setAttribute('aScatter', new THREE.InstancedBufferAttribute(scatter, 3));
  geo.setAttribute('aDepth', new THREE.InstancedBufferAttribute(depth, 1));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1));
  geo.instanceCount = n;

  const uniforms = { uAssemble: { value: 0 }, uRelief: { value: 0 }, uScatter: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.name = 'portraitCubes';

  const group = new THREE.Group();
  group.add(mesh);
  return { group, uniforms, width: size * cube };
}
