(function () {
  'use strict';

  if (!window.THREE) return;

  const THREE = window.THREE;
  const stage = document.getElementById('threeStage');
  const loading = document.getElementById('renderStatus');
  const cm = value => (Number(value) || 0) / 100;
  const design = new THREE.Group();
  design.name = 'Architectural model';
  const textureCache = new Map();
  const materialCache = new Map();
  let visible = false;
  let rebuildQueued = false;
  const sceneRecords = new Map();
  const renderStats = { updates:0, geometryBuilds:0, transformUpdates:0 };
  let selectionHelper=null, selectionTarget=null;
  let lastSunSignature='';
  const entityNode=id=>{let found=null;design.traverse(node=>{if(node.userData?.entityId===id)found=node;});return found;};
  const sceneSignature=value=>JSON.stringify(value,(key,v)=>['status','utilization','colorCode','redundant','redundancyReason','isRedundant'].includes(key)?undefined:v);

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch(error){if(loading)loading.textContent='WebGL unavailable — continue in Plan view';console.warn('Atelier 3D unavailable:',error.message);return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xdde4e1, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.physicallyCorrectLights = true;
  renderer.domElement.setAttribute('aria-label', 'Interactive physically based 3D model');
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdce5e2);
  scene.fog = new THREE.Fog(0xdce5e2, 28, 70);
  scene.add(design);

  // Physically prefiltered image-based lighting, the way the three.js examples
  // do it: build a small "room" scene of emissive light panels and run it
  // through PMREMGenerator. This gives every PBR material soft, roughness-aware
  // reflections and realistic ambient — the difference between a flat SketchUp
  // look and a believable interior. Falls back to a plain cube on failure.
  function buildRoomEnvScene() {
    const s = new THREE.Scene();
    const box = new THREE.BoxGeometry(1, 1, 1); box.deleteAttribute('uv');
    const surface = (col, rough) => { const m = new THREE.MeshStandardMaterial({ side: THREE.BackSide, roughness: rough == null ? 1 : rough, metalness: 0 }); m.color.set(col); return m; };
    const shell = new THREE.Mesh(box, surface('#aab4b9')); shell.scale.set(34, 20, 34); s.add(shell);
    const panel = (col, intensity) => { const m = new THREE.MeshStandardMaterial(); m.color.set('#000'); m.emissive = new THREE.Color(col); m.emissiveIntensity = intensity; return m; };
    const plane = new THREE.PlaneGeometry(1, 1);
    const ceil = new THREE.Mesh(plane, panel('#fff6e6', 1.7)); ceil.scale.set(26, 26, 1); ceil.rotation.x = Math.PI / 2; ceil.position.y = 9.7; s.add(ceil);
    const skylight = new THREE.Mesh(plane, panel('#dcecf6', 1.2)); skylight.scale.set(12, 4, 1); skylight.rotation.x = Math.PI / 2; skylight.position.set(6, 9.68, -4); s.add(skylight);
    const cool = new THREE.Mesh(plane, panel('#cfe0ef', .8)); cool.scale.set(20, 12, 1); cool.rotation.y = Math.PI / 2; cool.position.set(-16.8, 3, 0); s.add(cool);
    const warm = new THREE.Mesh(plane, panel('#f4e6c8', .55)); warm.scale.set(20, 12, 1); warm.rotation.y = -Math.PI / 2; warm.position.set(16.8, 3, 0); s.add(warm);
    const back = new THREE.Mesh(plane, panel('#e7eef2', .5)); back.scale.set(24, 12, 1); back.position.set(0, 3, -16.8); s.add(back);
    return s;
  }
  let environment = null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = buildRoomEnvScene();
    environment = pmrem.fromScene(envScene, .04).texture;
    envScene.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
    pmrem.dispose();
  } catch (err) {
    const c = document.createElement('canvas'); c.width = c.height = 8; const ctx2 = c.getContext('2d'); ctx2.fillStyle = '#dfe6ea'; ctx2.fillRect(0, 0, 8, 8);
    environment = new THREE.CanvasTexture(c);
  }
  scene.environment = environment;

  const camera = new THREE.PerspectiveCamera(39, 1, 0.03, 180);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.screenSpacePanning = true;
  controls.minDistance = 3;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.target.set(5.5, 0.65, 3.6);
  camera.position.set(11, 10, 14);

  const hemi = new THREE.HemisphereLight(0xeaf5ff, 0x9a876f, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dc, 3.6);
  sun.position.set(-10, 17, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 55;
  sun.shadow.bias = -0.00012;
  sun.shadow.normalBias = 0.055;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xb8d6e6, 0.7);
  fill.position.set(12, 8, -12);
  scene.add(fill);

  function updateSun(settings) {
    const state = settings || { azimuth: 135, altitude: 38, intensity: 3.6 };
    const north=window.atelierBridge?.project.north||0;
    const signature=JSON.stringify([state,north,controls.target.x,controls.target.y,controls.target.z]);
    if(signature===lastSunSignature)return;lastSunSignature=signature;
    const azimuth = ((Number(state.azimuth) || 0)+north) * Math.PI / 180;
    const altitude = Math.max(2, Math.min(88, Number(state.altitude) || 38)) * Math.PI / 180;
    const radius = 24, horizontal = Math.cos(altitude) * radius;
    // Architectural convention: azimuth is clockwise from plan north.
    // Plan +Y/world +Z is south, so north is -Z in the renderer.
    sun.position.set(controls.target.x + Math.sin(azimuth) * horizontal, Math.sin(altitude) * radius, controls.target.z - Math.cos(azimuth) * horizontal);
    const intensity = Math.max(.2, Math.min(6, Number(state.intensity) || 3.6));
    const daylight = Math.max(0, Math.min(1, (intensity - .2) / 5.8));
    const altDeg = Number(state.solarAltitude ?? state.altitude ?? 38);
    // Stronger, crisper key light with lower ambient/fill gives real
    // directional shading gradients instead of a flat, evenly-lit look.
    sun.intensity = Math.max(2.2, intensity * 1.15);
    // Warm the sun toward the horizon (golden hour), cool/blue at night.
    const warm = new THREE.Color('#ffb066'), noon = new THREE.Color('#fff2d6');
    sun.color.copy(warm).lerp(noon, Math.max(0, Math.min(1, altDeg / 35)));
    // IBL (scene.environment) now supplies soft ambient/fill, so keep the
    // hemisphere and fill lights low or they wash out the form again.
    hemi.intensity = .05 + daylight * .2;
    fill.intensity = daylight * .12;
    // Sky + fog shift from daytime haze to night.
    const daySky = new THREE.Color('#d3dfe4'), nightSky = new THREE.Color('#0e131c');
    const sky = daySky.clone().lerp(nightSky, 1 - daylight);
    if (scene.background && scene.background.isColor) scene.background.copy(sky);
    if (scene.fog) scene.fog.color.copy(sky);
    renderer.setClearColor(sky, 1);
    renderer.toneMappingExposure = .85 + (1 - daylight) * .14;
    sun.target.position.copy(controls.target);
    sun.target.updateMatrixWorld();
    if (typeof updateMirrorReflections === 'function') updateMirrorReflections();
    renderer.shadowMap.needsUpdate = true;
    if (typeof wakeRenderLoop === 'function') wakeRenderLoop(3);
  }

  const groundMat = new THREE.MeshStandardMaterial({ color: 0xbac4bd, roughness: 0.94, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.045;
  ground.receiveShadow = true;
  scene.add(ground);

  function colorOf(value, fallback) {
    try { return new THREE.Color(value || fallback); } catch (_) { return new THREE.Color(fallback); }
  }

  function canvasTexture(kind) {
    if (textureCache.has(kind)) return textureCache.get(kind);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d');
    if (kind === 'wood') {
      const gg = c.createLinearGradient(0, 0, 256, 0); gg.addColorStop(0, '#b98f63'); gg.addColorStop(.5, '#ac835a'); gg.addColorStop(1, '#b58b61');
      c.fillStyle = gg; c.fillRect(0, 0, 256, 256);
      for (let y = 2; y < 256; y += 9) {
        c.strokeStyle = `rgba(74,44,22,${0.13 + (y % 37) / 420})`;
        c.lineWidth = 1 + (y % 3 === 0 ? 1 : 0); c.beginPath();
        for (let x = 0; x <= 256; x += 8) c.lineTo(x, y + Math.sin(x * .022 + y) * 1.3);
        c.stroke();
      }
      for (let i = 0; i < 130; i++) { c.fillStyle = 'rgba(255,231,190,.05)'; c.fillRect((i * 47) % 256, (i * 83) % 256, 34, 1); }
      for (let i = 0; i < 60; i++) { c.fillStyle = 'rgba(70,44,22,.05)'; c.fillRect((i * 61) % 256, (i * 97) % 256, 22, 1); }
    } else if (kind === 'fabric') {
      c.fillStyle = '#bbb6aa'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1;
      for (let x = 0; x < 256; x += 4) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
      c.strokeStyle = 'rgba(25,25,25,.1)';
      for (let y = 2; y < 256; y += 4) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
    } else if (kind === 'stone') {
      // Soft marble: pale base, cloudy mottling and gentle wandering veins —
      // no hard diagonal streak (which the normal map used to emboss as dashes).
      const gg = c.createLinearGradient(0, 0, 256, 256); gg.addColorStop(0, '#d6d3cb'); gg.addColorStop(1, '#cac6bd'); c.fillStyle = gg; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 26; i++) { const x = (i * 79) % 256, y = (i * 137) % 256, r = 26 + (i % 5) * 16, rg = c.createRadialGradient(x, y, 2, x, y, r); rg.addColorStop(0, `rgba(178,174,165,${.05 + (i % 3) * .04})`); rg.addColorStop(1, 'rgba(178,174,165,0)'); c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2); }
      c.strokeStyle = 'rgba(150,145,135,.16)'; c.lineWidth = 1.1;
      for (let v = 0; v < 4; v++) { c.beginPath(); let x = (v * 90 + 30) % 256, y = 0; c.moveTo(x, y); for (let s = 0; s < 8; s++) { x += ((v * 53 + s * 31) % 40) - 20; y += 32; c.lineTo(x, y); } c.stroke(); }
      for (let i = 0; i < 160; i++) { const vv = 150 + (i * 37) % 55; c.fillStyle = `rgba(${vv},${vv},${vv},.05)`; c.fillRect((i * 53) % 256, (i * 97) % 256, 1, 1); }
    } else if (kind === 'tile') {
      c.fillStyle = '#d8d8d2'; c.fillRect(0, 0, 256, 256);
      c.strokeStyle = '#a5a9a5'; c.lineWidth = 3;
      for (let p = 0; p <= 256; p += 64) { c.beginPath(); c.moveTo(p, 0); c.lineTo(p, 256); c.stroke(); c.beginPath(); c.moveTo(0, p); c.lineTo(256, p); c.stroke(); }
    } else if (kind === 'concrete') {
      c.fillStyle = '#b8b7b2'; c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        const v = 120 + ((i * 37) % 80);
        c.fillStyle = `rgba(${v},${v},${v},.14)`;
        c.fillRect((i * 53) % 256, (i * 97) % 256, 1 + i % 2, 1 + (i % 3));
      }
    } else {
      c.fillStyle = '#d6c7ad'; c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 32) { c.fillStyle = y % 64 ? 'rgba(80,55,30,.06)' : 'rgba(255,255,255,.06)'; c.fillRect(0, y, 256, 16); }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    texture.encoding = THREE.sRGBEncoding;
    textureCache.set(kind, texture);
    return texture;
  }

  // Derive a tangent-space normal map from a diffuse canvas by reading its
  // luminance gradient. Adds tactile surface relief (grain, grout, weave)
  // without any external texture files.
  const normalCache = new Map();
  function normalTexture(kind, strength) {
    const key = kind + '|' + (strength || 1);
    if (normalCache.has(key)) return normalCache.get(key);
    const src = canvasTexture(kind).image;
    const size = src.width, sc = src.getContext('2d');
    const data = sc.getImageData(0, 0, size, size).data;
    const lum = i => { const p = (i % size + size) % size; return 0; };
    const out = document.createElement('canvas'); out.width = out.height = size;
    const oc = out.getContext('2d'), img = oc.createImageData(size, size);
    const L = (x, y) => { const xi = (x + size) % size, yi = (y + size) % size, o = (yi * size + xi) * 4; return (data[o] * .299 + data[o + 1] * .587 + data[o + 2] * .114) / 255; };
    const s = (strength || 1) * 2.2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (L(x - 1, y) - L(x + 1, y)) * s, dy = (L(x, y - 1) - L(x, y + 1)) * s;
      const nz = 1, len = Math.hypot(dx, dy, nz), o = (y * size + x) * 4;
      img.data[o] = (dx / len * .5 + .5) * 255; img.data[o + 1] = (dy / len * .5 + .5) * 255; img.data[o + 2] = (nz / len * .5 + .5) * 255; img.data[o + 3] = 255;
    }
    oc.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(out);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    normalCache.set(key, tex);
    return tex;
  }

  function pbr(entity, override) {
    const kind = (override || entity.material || 'Wood').toLowerCase();
    const opacity = Math.max(.08, 1 - (Number(entity.transparency) || 0) / 100);
    const key = [kind, entity.color || '#aaa', opacity.toFixed(2), entity.active ? 1 : 0, Number(entity.roughness ?? '').toFixed(3)].join('|');
    if (materialCache.has(key)) return materialCache.get(key);
    const common = { color: colorOf(entity.color, '#aaa'), roughness: .55, metalness: 0 };
    let material;
    if (kind === 'glass') {
      material = new THREE.MeshPhysicalMaterial({ color: colorOf(entity.color, '#a8d4db'), roughness: .08, metalness: 0, transparent: true, opacity: Math.min(.58, opacity), transmission: .72, thickness: .08, ior: 1.5, side: THREE.DoubleSide, depthWrite: false });
    } else if (kind === 'mirror') {
      // A mirror is an opaque, highly reflective surface. The environment map
      // supplies the visual reflection; mirror() also adds a controlled
      // reflected-sun light for usable daylight contribution and shadows.
      material = new THREE.MeshPhysicalMaterial({ color: colorOf(entity.color, '#b7c7c7'), roughness: Math.max(.015, Math.min(.28, Number(entity.roughness ?? .045))), metalness: 1, envMapIntensity: 1.65, clearcoat: .35, clearcoatRoughness: .08, side: THREE.DoubleSide });
    } else {
      // Satin clearcoat on finished materials makes them respond to the
      // environment instead of reading as dead-matte plastic — the main cue
      // separating "toy render" from a believable interior.
      let clear = 0, clearRough = .5;
      if (kind === 'metal') { common.metalness = .76; common.roughness = .25; }
      if (kind === 'fabric' || kind === 'leather') { common.roughness = kind === 'fabric' ? .9 : .5; common.map = canvasTexture('fabric'); common.normalMap = normalTexture('fabric', .6); common.normalScale = new THREE.Vector2(.4, .4); if (kind === 'leather') { clear = .28; clearRough = .4; } }
      if (kind === 'wood') { common.roughness = .5; common.map = canvasTexture('wood'); common.normalMap = normalTexture('wood', .9); common.normalScale = new THREE.Vector2(.6, .6); clear = .22; clearRough = .55; }
      if (kind === 'stone') { common.roughness = .35; common.map = canvasTexture('stone'); common.normalMap = normalTexture('stone', .35); common.normalScale = new THREE.Vector2(.18, .18); clear = .2; clearRough = .35; }
      if (kind === 'concrete') { common.roughness = .9; common.map = canvasTexture('concrete'); common.normalMap = normalTexture('concrete', .7); common.normalScale = new THREE.Vector2(.35, .35); }
      if (kind === 'ceramic') { common.roughness = .12; clear = .55; clearRough = .08; }
      if (kind === 'natural') { common.roughness = .82; }
      if (kind === 'plastic') { common.roughness = .35; clear = .3; clearRough = .35; }
      common.envMapIntensity = kind === 'metal' ? 1.3 : kind === 'ceramic' ? 1.1 : kind === 'plastic' ? .95 : .8;
      if (opacity < .99) { common.transparent = true; common.opacity = opacity; common.depthWrite = opacity > .6; }
      if (entity.active && ['tv', 'cooktop', 'lamp'].includes(entity.shape || entity.type)) { common.emissive = colorOf(entity.color, '#6fb4d2'); common.emissiveIntensity = 1.3; }
      if (clear > 0) { material = new THREE.MeshPhysicalMaterial(Object.assign(common, { clearcoat: clear, clearcoatRoughness: clearRough })); }
      else material = new THREE.MeshStandardMaterial(common);
    }
    materialCache.set(key, material);
    return material;
  }

  // Three.js shadow maps treat transparent/transmissive meshes as opaque unless
  // shadow casting is disabled explicitly. Glazing should remain visible and
  // reflective, but it must not stop the sun from reaching the room behind it.
  function blocksSun(material) {
    return !(material && (Number(material.transmission) > .05 || (material.transparent && Number(material.opacity) < .6)));
  }

  function box(group, sx, sy, sz, x, y, z, material, radius) {
    const geometry = new THREE.BoxGeometry(Math.max(.008, sx), Math.max(.008, sy), Math.max(.008, sz), radius ? 2 : 1, radius ? 2 : 1, radius ? 2 : 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = blocksSun(material);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function cylinder(group, rt, rb, height, segments, x, y, z, material, rotateX) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, height, segments), material);
    mesh.position.set(x, y, z);
    if (rotateX) mesh.rotation.z = Math.PI / 2;
    mesh.castShadow = blocksSun(material); mesh.receiveShadow = true; group.add(mesh); return mesh;
  }

  // Rounded rectangle profile used by roundedBox.
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    return s;
  }
  // A softly rounded/chamfered box. Real objects have beveled edges that catch
  // light — this removes the hard "CGI cube" read that flat BoxGeometry gives.
  // ExtrudeGeometry's auto UVs distort textures (diagonal/streaky grain). Rebuild
  // UVs with a planar per-face (triplanar) projection in metres so wood/stone
  // grain maps cleanly on every rounded box.
  function applyBoxUV(geo) {
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = [];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      let u, v;
      if (nx >= ny && nx >= nz) { u = z; v = y; } else if (ny >= nx && ny >= nz) { u = x; v = z; } else { u = x; v = y; }
      uv.push(u, v);
    }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  }
  function roundedBox(group, w, h, d, r, x, y, z, material) {
    w = Math.max(.02, w); h = Math.max(.02, h); d = Math.max(.02, d);
    r = Math.max(.004, Math.min(r, w / 2 - .004, h / 2 - .004));
    const bevel = Math.max(.003, Math.min(r * .8, d / 2 - .004, .022));
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), { depth: Math.max(.004, d - bevel * 2), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 3, steps: 1 });
    geo.center(); geo.computeVertexNormals(); applyBoxUV(geo);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = blocksSun(material); mesh.receiveShadow = true;
    group.add(mesh); return mesh;
  }

  function localGroup(entity) {
    const g = new THREE.Group();
    g.position.set(cm(entity.x + entity.w / 2), cm(entity.elevation || 0), cm(entity.y + entity.d / 2));
    // Plan +Y maps to WebGL +Z. Three.js rotates +X toward -Z for a
    // positive Y rotation, so negate the plan angle to preserve the
    // canvas convention (and the clockwise handedness of L/U stairs).
    g.rotation.y = -(Number(entity.rotation) || 0) * Math.PI / 180;
    g.userData.entityId = entity.id;
    return g;
  }

  function addLegs(g, w, d, h, material, topOffset) {
    const leg = Math.min(.075, w * .08, d * .12);
    for (const x of [-w * .39, w * .39]) for (const z of [-d * .34, d * .34]) box(g, leg, h - topOffset, leg, x, (h - topOffset) / 2, z, material);
  }

  function sofa(g, o, w, d, h, mat) {
    const seatTop = h * .44, cushN = w > 2.2 ? 3 : 2, span = w * .82, unit = span / cushN;
    roundedBox(g, w * .96, h * .3, d * .92, .06, 0, h * .2, d * .02, mat);            // base
    for (let i = 0; i < cushN; i++) {                                                  // seat cushions
      const cx = -span / 2 + (i + .5) * unit;
      roundedBox(g, unit - .03, h * .2, d * .6, .06, cx, seatTop, d * .08, mat);
    }
    for (let i = 0; i < cushN; i++) {                                                  // back cushions
      const cx = -span / 2 + (i + .5) * unit;
      const bc = roundedBox(g, unit - .03, h * .46, d * .18, .06, cx, h * .68, -d * .33, mat); bc.rotation.x = -.09;
    }
    roundedBox(g, w * .1, h * .66, d * .92, .06, -w * .45, h * .42, d * .02, mat);      // arms
    roundedBox(g, w * .1, h * .66, d * .92, .06, w * .45, h * .42, d * .02, mat);
    roundedBox(g, w * .96, h * .5, d * .12, .06, 0, h * .62, -d * .46, mat);            // back panel
    const foot = pbr({ material: 'Wood', color: '#3f342c' });
    for (const x of [-w * .42, w * .42]) for (const z of [-d * .38, d * .38]) cylinder(g, .028, .036, .11, 12, x, .055, z, foot);
    if (o.type === 'sectional') { roundedBox(g, w * .34, h * .3, d * .5, .06, w * .3, h * .2, d * .42, mat); roundedBox(g, w * .3, h * .2, d * .44, .06, w * .3, seatTop, d * .42, mat); }
  }

  function chair(g, o, w, d, h, mat) {
    const frame = pbr({ material: o.material === 'Fabric' || o.material === 'Leather' ? 'Wood' : o.material, color: '#5b4c3f' });
    if (o.type === 'accent-chair') {                                                    // tub/armchair
      roundedBox(g, w * .9, h * .16, d * .82, .06, 0, h * .46, .02, mat);
      const back = roundedBox(g, w * .9, h * .5, .12, .07, 0, h * .74, -d * .36, mat); back.rotation.x = -.12;
      roundedBox(g, w * .12, h * .4, d * .72, .05, -w * .44, h * .5, 0, mat); roundedBox(g, w * .12, h * .4, d * .72, .05, w * .44, h * .5, 0, mat);
      for (const x of [-w * .34, w * .34]) for (const z of [-d * .32, d * .32]) cylinder(g, .022, .03, h * .42, 10, x, h * .21, z, frame);
    } else if (o.type === 'lounge-chair') {
      roundedBox(g, w * .86, h * .16, d * .78, .06, 0, h * .44, .02, mat);
      const back = roundedBox(g, w * .86, h * .5, .12, .07, 0, h * .72, -d * .34, mat); back.rotation.x = -.15;
      roundedBox(g, w * .11, h * .44, d * .74, .05, -w * .45, h * .46, 0, mat); roundedBox(g, w * .11, h * .44, d * .74, .05, w * .45, h * .46, 0, mat);
      addLegs(g, w, d, h * .4, frame, .02);
    } else {                                                                           // slim dining / side chair
      roundedBox(g, w * .8, .05, d * .74, .03, 0, h * .47, .01, mat);                  // seat
      const back = roundedBox(g, w * .7, h * .04, .04, .015, 0, h * .9, -d * .34, mat); back.rotation.x = -.06; // top rail
      const back2 = roundedBox(g, w * .7, h * .04, .04, .015, 0, h * .72, -d * .33, mat); back2.rotation.x = -.06; // mid rail
      for (const x of [-w * .22, w * .22]) { const st = roundedBox(g, .035, h * .48, .035, .012, x, h * .72, -d * .34, mat); st.rotation.x = -.06; } // back stiles
      const legMat = pbr({ material: mat === undefined ? 'Wood' : (o.material === 'Fabric' ? 'Wood' : o.material), color: '#5b4c3f' });
      for (const x of [-w * .36, w * .36]) for (const z of [-d * .34, d * .34]) cylinder(g, .017, .022, h * .47, 8, x, h * .235, z, legMat); // legs
    }
  }

  function bed(g, o, w, d, h, mat) {
    const frame = pbr({ material: 'Wood', color: '#6f5540' });
    roundedBox(g, w, h * .3, d, .04, 0, h * .17, 0, frame);                            // divan base
    roundedBox(g, w * .95, h * .32, d * .92, .07, 0, h * .5, d * .02, mat);            // mattress
    const duvetCol = new THREE.Color(o.color || '#b9b6ae').clone(); duvetCol.offsetHSL(0, .01, .05);
    const duvet = pbr({ material: 'Fabric', color: '#' + duvetCol.getHexString() });
    roundedBox(g, w * .93, h * .16, d * .62, .06, 0, h * .62, d * .14, duvet);          // duvet over lower bed
    const linen = pbr({ material: 'Fabric', color: '#eeece4' });
    roundedBox(g, w * .93, h * .05, d * .12, .03, 0, h * .69, d * .43, linen);          // turned-down sheet
    const count = w > 1.25 ? 2 : 1;
    for (let i = 0; i < count; i++) roundedBox(g, w * (count === 2 ? .4 : .58), h * .18, d * .22, .07, (i - (count - 1) / 2) * w * .43, h * .74, -d * .3, linen); // plump pillows
    roundedBox(g, w * 1.02, h * 1.05, .09, .05, 0, h * .55, -d * .49, frame);          // headboard
    for (const x of [-w * .47, w * .47]) cylinder(g, .03, .035, h * .2, 10, x, h * .1, d * .47, frame);
  }

  function table(g, o, w, d, h, mat, round) {
    if (round) {
      cylinder(g, w * .49, w * .49, .06, 40, 0, h - .03, 0, mat);
      cylinder(g, w * .47, w * .49, .03, 40, 0, h - .075, 0, mat);
      cylinder(g, .07, .1, h - .09, 20, 0, (h - .09) / 2, 0, pbr({ material: 'Metal', color: '#43403a' }));
      cylinder(g, .3, .33, .04, 32, 0, .02, 0, pbr({ material: 'Metal', color: '#43403a' }));
    } else {
      roundedBox(g, w, .06, d, .02, 0, h - .03, 0, mat);                               // top
      roundedBox(g, w * .98, .05, d * .96, .02, 0, h - .09, 0, mat);                   // apron
      const legMat = pbr({ material: o.material === 'Glass' ? 'Metal' : o.material, color: '#54463a' });
      for (const sx of [-.42, .42]) for (const sz of [-.4, .4]) roundedBox(g, Math.min(.09, w * .09), h - .1, Math.min(.09, d * .12), .02, w * sx, (h - .1) / 2, d * sz, legMat);
    }
  }

  function cabinet(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .02, 0, h / 2, 0, mat);
    const face = pbr({ material: o.material, color: o.color || '#999' });
    const doors = o.type === 'fridge' ? 2 : Math.max(2, Math.round(w / .55));
    const shadeCol = new THREE.Color(o.color || '#999'); shadeCol.offsetHSL(0, 0, -.05);
    const recess = pbr({ material: o.material, color: '#' + shadeCol.getHexString() });
    for (let i = 0; i < doors; i++) {
      const dw = w / doors - .014, x = -w / 2 + (i + .5) * w / doors;
      roundedBox(g, dw, h * .9, .022, .01, x, h * .5, d / 2 + .012, face);              // door panel
      if (o.type !== 'fridge') { roundedBox(g, dw * .72, h * .78, .012, .01, x, h * .5, d / 2 + .008, recess); roundedBox(g, dw * .6, h * .66, .01, .008, x, h * .5, d / 2 + .016, face); } // shaker frame + raised panel
      const hx = i % 2 === 0 ? x + dw * .4 : x - dw * .4;
      cylinder(g, .009, .009, Math.min(.24, h * .26), 8, hx, h * .5, d / 2 + .032, pbr({ material: 'Metal', color: '#4c514f' }));
    }
    if (o.type === 'fridge') for (const y of [h * .66, h * .3]) roundedBox(g, .04, h * .24, .03, .01, w * .38, y, d / 2 + .03, pbr({ material: 'Metal', color: '#8b918f' }));
  }

  function kitchen(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .9, d, .02, 0, h * .45, 0, mat);                              // carcass
    roundedBox(g, w + .06, .06, d + .06, .02, 0, h * .93, 0, pbr({ material: 'Stone', color: '#cfcdc4' })); // worktop
    box(g, w + .06, .05, .025, 0, h * .93 + h * .12, -d / 2 - .01, pbr({ material: 'Stone', color: '#c4c2b9' })); // splashback
    const bays = Math.max(2, Math.round(w / .62)), door = pbr({ material: 'Wood', color: o.color || '#aaa' });
    for (let i = 0; i < bays; i++) {
      const bw = w / bays - .018, x = -w / 2 + (i + .5) * w / bays;
      roundedBox(g, bw, h * .66, .02, .01, x, h * .43, d / 2 + .012, door);
      cylinder(g, .007, .007, bw * .3, 8, x, h * .64, d / 2 + .032, pbr({ material: 'Metal', color: '#5c5f5d' }), true).rotation.x = Math.PI / 2;
    }
    for (const x of [-w * .42, w * .42]) box(g, .05, h * .12, .05, x, h * .06, 0, pbr({ material: 'Metal', color: '#3a3d3b' })); // plinth feet
  }

  function plant(g, o, w, d, h) {
    const isTree = o.type === 'garden-tree';
    if (isTree) cylinder(g, w * .34, w * .42, h * .05, 20, 0, h * .025, 0, pbr({ material: 'Natural', color: '#584732' }));
    else cylinder(g, w * .23, w * .31, h * .25, 24, 0, h * .125, 0, pbr({ material: 'Ceramic', color: o.type === 'flower-pot' ? o.color : '#8a6b51' }));
    const trunk = pbr({ material: 'Wood', color: '#5a452f' }), trunkH = isTree ? h * .46 : h * .5, trunkY0 = isTree ? h * .05 : h * .22;
    cylinder(g, w * (isTree ? .05 : .04), w * (isTree ? .095 : .06), trunkH, 12, 0, trunkY0 + trunkH / 2, 0, trunk);
    if (isTree) for (let i = 0; i < 3; i++) { const br = cylinder(g, w * .02, w * .04, trunkH * .5, 8, Math.cos(i * 2.1) * w * .1, trunkY0 + trunkH * .85, Math.sin(i * 2.1) * w * .1, trunk); br.rotation.z = Math.cos(i * 2.1) * .5; br.rotation.x = Math.sin(i * 2.1) * .5; }
    // Layered low-poly canopy masses in varied greens read as foliage far
    // better than a cluster of smooth spheres.
    const base = new THREE.Color(o.color || (isTree ? '#41693f' : '#557d55'));
    const masses = isTree
      ? [[0, .66, 0, .33], [-.24, .6, .12, .25], [.26, .62, -.1, .26], [.06, .82, -.06, .23], [-.12, .76, .18, .2], [.18, .74, .12, .19], [0, .54, -.2, .2]]
      : [[0, .58, 0, .3], [-.18, .52, .12, .2], [.18, .54, -.1, .2], [0, .74, 0, .22]];
    masses.forEach((m, i) => {
      const c = base.clone().offsetHSL(0, (i % 2 ? -.03 : .03), (i % 3 - 1) * .06);
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(w * m[3], 1), new THREE.MeshStandardMaterial({ color: c, roughness: .82, metalness: 0, flatShading: true, envMapIntensity: .4 }));
      mesh.position.set(m[0] * w, m[1] * h, m[2] * d); mesh.scale.set(1, .92, 1); mesh.rotation.y = i * 1.3; mesh.castShadow = true; g.add(mesh);
    });
  }

  function car(g, o, w, d, h, mat) {
    roundedBox(g, w * .94, h * .34, d * .92, .09, 0, h * .28, 0, mat);                  // lower body, rounded
    roundedBox(g, w * .9, h * .16, d * .38, .07, 0, h * .44, d * .28, mat);             // hood
    roundedBox(g, w * .9, h * .16, d * .32, .07, 0, h * .44, -d * .34, mat);            // boot
    const cabin = roundedBox(g, w * .82, h * .32, d * .5, .11, 0, h * .58, -d * .03, mat); // greenhouse
    const glass = pbr({ material: 'Glass', color: '#5a7a8a', transparency: 55 });
    roundedBox(g, w * .74, h * .24, d * .48, .07, 0, h * .6, -d * .03, glass);          // glazing inset
    const tire = pbr({ material: 'Plastic', color: '#17191a' }), rim = pbr({ material: 'Metal', color: '#9aa0a0' });
    for (const x of [-w * .5, w * .5]) for (const z of [-d * .3, d * .3]) {
      cylinder(g, h * .17, h * .17, .14, 22, x, h * .17, z, tire, true);
      cylinder(g, h * .085, h * .085, .145, 14, x, h * .17, z, rim, true);
    }
    const light = pbr({ material: 'Glass', color: '#f4e4bd', transparency: 12, active: true, shape: 'lamp' });
    for (const x of [-w * .32, w * .32]) roundedBox(g, w * .14, h * .09, .03, .02, x, h * .34, d * .455, light);
    const tail = pbr({ material: 'Glass', color: '#c0392b', transparency: 18 });
    for (const x of [-w * .32, w * .32]) roundedBox(g, w * .12, h * .08, .03, .02, x, h * .36, -d * .455, tail);
  }

  function door(g, o, w, d, h, mat) {
    const frame = pbr({ material: 'Wood', color: '#614b3b' });
    box(g, .07, h + .08, .08, -w / 2, h / 2, 0, frame); box(g, .07, h + .08, .08, w / 2, h / 2, 0, frame); box(g, w, .07, .08, 0, h + .035, 0, frame);
    if (o.type === 'garage-door') {
      const open = Math.max(0, Math.min(1, (o.openAngle || 0) / 100));
      if (open < .98) { const panel = box(g, w * .94, h * (1 - open), d, 0, h - h * (1 - open) / 2, 0, mat); for (let y = .18; y < h * (1 - open); y += .34) box(panel, w * .9, .018, d * 1.05, 0, -h * (1 - open) / 2 + y, 0, frame); }
      return;
    }
    if (o.type === 'sliding-door') {
      const open = Math.max(0, Math.min(1, (o.openAngle || 0) / 100));
      box(g, w * .56, h * .96, d, -w * .2 + open * w * .44, h * .48, 0, mat);
      box(g, w * .5, h * .96, d * .75, w * .24, h * .48, 0, mat);
      return;
    }
    const makeLeaf = (leafW, hingeX, direction) => {
      const pivot = new THREE.Group(); pivot.position.set(hingeX, 0, 0);
      const angle = Math.max(0, Math.min(120, Number(o.openAngle) || 0)) * Math.PI / 180 * (o.swingSide || 1) * direction;
      // Match the 2D swing arc: canvas +Y is WebGL +Z, hence the inverse
      // sign in the local Y rotation.
      pivot.rotation.y = -angle;
      box(pivot, leafW, h * .96, d, direction * leafW / 2, h * .48, 0, mat);
      const knob = pbr({ material: 'Metal', color: '#b69a58' });
      cylinder(pivot, .025, .025, .055, 16, direction * leafW * .39, h * .52, d * .62, knob, true).rotation.x = Math.PI / 2;
      g.add(pivot);
    };
    const makeTempleLeaf = (leafW, hingeX, direction) => {
      const pivot = new THREE.Group(); pivot.position.set(hingeX, 0, 0);
      const angle = Math.max(0, Math.min(120, Number(o.openAngle) || 0)) * Math.PI / 180 * (o.swingSide || 1) * direction;
      pivot.rotation.y = -angle;
      const leafX = direction * leafW / 2, accent = pbr({ material: 'Metal', color: '#b68a43' });
      box(pivot, leafW * .94, h * .44, d, leafX, h * .23, 0, mat, 1);
      box(pivot, .065, h * .48, d * 1.02, leafX - direction * leafW * .43, h * .67, 0, mat, 1);
      box(pivot, .065, h * .48, d * 1.02, leafX + direction * leafW * .43, h * .67, 0, mat, 1);
      box(pivot, leafW * .88, .065, d * 1.02, leafX, h * .9, 0, mat, 1);
      for (let i = -1; i <= 1; i++) box(pivot, .022, h * .31, d * .72, leafX + i * leafW * .2, h * .68, 0, accent, 1);
      for (let i = 0; i < 2; i++) box(pivot, leafW * .78, .022, d * .72, leafX, h * (.57 + i * .14), 0, accent, 1);
      cylinder(pivot, .026, .026, .06, 16, leafX + direction * leafW * .28, h * .49, d * .62, accent, true).rotation.x = Math.PI / 2;
      g.add(pivot);
    };
    if (o.type === 'temple-double-door') {
      makeTempleLeaf(w / 2, -w / 2, 1); makeTempleLeaf(w / 2, w / 2, -1);
      const accent = pbr({ material: 'Metal', color: '#b68a43' });
      box(g, w * 1.08, .12, .13, 0, h + .09, 0, accent, 1);
      if (o.templeFinial !== false) cylinder(g, .055, .025, .18, 12, 0, h + .22, 0, accent);
    } else if (o.type === 'double-door') { makeLeaf(w / 2, -w / 2, 1); makeLeaf(w / 2, w / 2, -1); }
    else if (o.hingeSide === 'right') makeLeaf(w, w / 2, -1); else makeLeaf(w, -w / 2, 1);
  }

  function windowMesh(g, o, w, d, h) {
    const frame = pbr({ material: 'Metal', color: '#e5e4de' });
    const glass = pbr({ material: 'Glass', color: o.color || '#9ec6cf', transparency: o.transparency == null ? 55 : o.transparency });
    box(g, w, h, Math.max(.012, d * .35), 0, h / 2, 0, glass);
    const bar = Math.min(.055, w * .04);
    box(g, w, bar, d, 0, bar / 2, 0, frame); box(g, w, bar, d, 0, h - bar / 2, 0, frame);
    box(g, bar, h, d, -w / 2 + bar / 2, h / 2, 0, frame); box(g, bar, h, d, w / 2 - bar / 2, h / 2, 0, frame);
    box(g, bar * .72, h, d, 0, h / 2, 0, frame); box(g, w, bar * .72, d, 0, h / 2, 0, frame);
  }

  function mirror(g, o, w, d, h) {
    const panel = pbr({ material: 'Mirror', color: o.color || '#b7c7c7', roughness: o.roughness ?? .045 });
    const frame = pbr({ material: 'Metal', color: o.frameColor || '#4d5552' });
    const inset = Math.min(.055, Math.max(.018, Math.min(w, h) * .035));
    box(g, Math.max(.06, w - inset * 2), Math.max(.12, h - inset * 2), Math.max(.014, d * .22), 0, h / 2, 0, panel, 1);
    box(g, w, inset, d * .52, 0, h - inset / 2, 0, frame, 1);
    box(g, w, inset, d * .52, 0, inset / 2, 0, frame, 1);
    box(g, inset, h - inset * 2, d * .52, -w / 2 + inset / 2, h / 2, 0, frame, 1);
    box(g, inset, h - inset * 2, d * .52, w / 2 - inset / 2, h / 2, 0, frame, 1);
    // A restrained highlight makes the reflective face readable even when the
    // environment is low contrast.
    const sheen = pbr({ material: 'Glass', color: '#dcebed', transparency: 78 });
    const highlight = box(g, Math.max(.02, w * .035), Math.max(.08, h * .62), .012, -w * .22, h * .55, d * .14, sheen, 1);
    highlight.rotation.z = -.18;
    g.userData.mirrorSpec = { o, w, d, h, light: null };
    const reflected = new THREE.SpotLight(0xfff0ce, 0, 24, .35, .72, 1.5);
    reflected.castShadow = true;
    reflected.shadow.mapSize.set(512, 512);
    reflected.shadow.bias = -0.00035;
    reflected.shadow.normalBias = .025;
    reflected.target = new THREE.Object3D();
    g.add(reflected.target);
    g.add(reflected);
    g.userData.mirrorSpec.light = reflected;
  }

  function roof(g, o, w, d, h, mat) {
    // The slab is opaque and casts shadow. Its underside is what you see from
    // inside, so render it as a smooth painted ceiling (no concrete speckle),
    // lifted a touch lighter than the chosen colour.
    const tint = colorOf(o.color, '#cfd0cb'); tint.offsetHSL(0, -.02, .12);
    const ceilMat = new THREE.MeshStandardMaterial({ color: tint, roughness: .93, metalness: 0, envMapIntensity: .28 });
    box(g, w, Math.max(.04, h), d, 0, Math.max(.02, h / 2), 0, ceilMat, 1);
    // Top roof finish, slightly darker/warmer than the ceiling.
    const capC = colorOf(o.color, '#a8aaa5'); capC.offsetHSL(0, 0, -.03);
    const cap = new THREE.MeshStandardMaterial({ color: capC, roughness: .82, metalness: 0, envMapIntensity: .4 });
    box(g, Math.max(.05, w - .04), .025, Math.max(.05, d - .04), 0, h + .012, 0, cap, 1);
  }

  function roofShadowOccluder(o) {
    const g = localGroup(o), w = cm(o.w), d = cm(o.d), h = Math.max(.04, cm(o.height || 15.24));
    // Keep an invisible, non-raycastable slab in the shadow pass. This lets
    // users hide the roof geometry for interior inspection without turning off
    // the physical fact that the roof blocks direct sunlight.
    const blockerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, colorWrite: false, depthWrite: false });
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.04, w), h, Math.max(.04, d)), blockerMat);
    blocker.position.y = h / 2;
    blocker.castShadow = true;
    blocker.receiveShadow = false;
    blocker.raycast = () => {};
    g.userData.roofShadowOccluder = true;
    g.add(blocker);
    return g;
  }

  function updateMirrorReflections() {
    design.traverse(g => {
      const spec = g.userData && g.userData.mirrorSpec;
      if (!spec || !spec.light) return;
      const worldPosition = new THREE.Vector3();
      const worldQuaternion = new THREE.Quaternion();
      g.getWorldPosition(worldPosition); g.getWorldQuaternion(worldQuaternion);
      const toSun = sun.position.clone().sub(worldPosition).normalize();
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion).normalize();
      if (normal.dot(toSun) < 0) normal.negate();
      const incoming = toSun.clone().negate();
      const reflectedDirection = incoming.sub(normal.clone().multiplyScalar(2 * incoming.dot(normal))).normalize();
      const localDirection = reflectedDirection.clone().applyQuaternion(worldQuaternion.clone().invert()).normalize();
      const localNormal = normal.clone().applyQuaternion(worldQuaternion.clone().invert()).normalize();
      const surfaceOffset = Math.max(.014, spec.d * .006);
      spec.light.position.set(localNormal.x * surfaceOffset, spec.h * .5 + localNormal.y * surfaceOffset, localNormal.z * surfaceOffset);
      spec.light.target.position.copy(localDirection.clone().multiplyScalar(8));
      spec.light.intensity = (spec.o.reflectionEnabled === false ? 0 : Math.max(0, Number(sun.intensity) || 0) * Math.max(.05, Math.min(1, Number(spec.o.reflectionStrength ?? .58))) * 2.2);
      spec.light.angle = Math.max(.12, Math.min(1.1, Number(spec.o.reflectionSpread ?? 32) * Math.PI / 180));
      spec.light.target.updateMatrixWorld();
    });
  }

  function appliance(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .02, 0, h / 2, 0, mat);
    const dark = pbr({ material: 'Glass', color: '#263038', transparency: 12 });
    if (o.shape === 'washer') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, h) * .24, .035, 12, 32), pbr({ material: 'Metal', color: '#777f80' }));
      ring.position.set(0, h * .52, d / 2 + .02); ring.castShadow = true; g.add(ring);
      cylinder(g, Math.min(w, h) * .19, Math.min(w, h) * .19, .025, 32, 0, h * .52, d / 2 + .025, dark).rotation.x = Math.PI / 2;
    } else box(g, w * .78, h * .64, .025, 0, h * .52, d / 2 + .018, dark, 1);
    box(g, w * .8, .07, .02, 0, h * .9, d / 2 + .02, pbr({ material: 'Metal', color: '#545b5b' }));
  }

  function switchboard(g, o, w, d, h, mat) {
    const face = pbr({ material: 'Plastic', color: o.color || '#f1efe8' });
    box(g, w, h, d, 0, h / 2, 0, mat, 1);
    box(g, w * .88, h * .86, .018, 0, h / 2, d / 2 + .012, face, 1);
    const count = Math.max(1, Math.min(8, Math.round(Number(o.switches) || 4)));
    const switchMat = pbr({ material: 'Plastic', color: '#d5dad4' });
    const contact = pbr({ material: 'Metal', color: '#6d7770' });
    for (let i = 0; i < count; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = -w * .3 + col * w * .2, y = h * (row ? .31 : .69);
      box(g, w * .12, h * .24, .022, x, y, d / 2 + .027, switchMat, 1);
      box(g, w * .035, h * .035, .026, x, y, d / 2 + .043, contact, 1);
    }
  }

  function electricalPanel(g, o, w, d, h, mat) {
    box(g, w, h, d, 0, h / 2, 0, mat, 1);
    const doorMat = pbr({ material: 'Metal', color: o.color || '#d9ddd8' });
    box(g, w * .9, h * .9, .024, 0, h / 2, d / 2 + .014, doorMat, 1);
    box(g, .018, h * .78, .028, 0, h / 2, d / 2 + .032, pbr({ material: 'Metal', color: '#87908a' }));
    const count = Math.max(1, Math.min(12, Math.round(Number(o.breakers) || 8)));
    const breaker = pbr({ material: 'Plastic', color: '#657a70' });
    for (let i = 0; i < count; i++) {
      const col = i % 4, row = Math.floor(i / 4), x = -w * .27 + col * w * .18, y = h * (.72 - row * .17);
      box(g, w * .07, h * .1, .03, x, y, d / 2 + .042, breaker, 1);
    }
    const status = pbr({ material: 'Glass', color: o.active === false ? '#77827c' : '#70c28c', transparency: 8, active: o.active !== false, shape: 'ceiling-light' });
    cylinder(g, Math.min(w, h) * .045, Math.min(w, h) * .045, .018, 16, w * .33, h * .12, d / 2 + .045, status, true);
  }

  function ceilingFan(g, o, w, d, h, mat) {
    const metal = pbr({ material: 'Metal', color: '#5c615e' }), bodyMat = pbr({ material: 'Metal', color: o.color || '#cfccc2' });
    cylinder(g, w * .028, w * .028, .4, 10, 0, .2, 0, metal);          // downrod up to ceiling
    cylinder(g, w * .07, w * .07, .05, 12, 0, .4, 0, metal);           // ceiling canopy
    cylinder(g, w * .13, w * .15, .12, 20, 0, -.01, 0, bodyMat);       // motor housing
    cylinder(g, w * .09, w * .11, .05, 20, 0, -.08, 0, bodyMat);       // bottom cap
    const blades = Math.max(2, Math.min(12, Math.round(Number(o.bladeCount) || 4)));
    for (let i = 0; i < blades; i++) {
      const pivot = new THREE.Group(); pivot.rotation.y = i * Math.PI * 2 / blades; g.add(pivot);
      box(pivot, w * .1, .012, w * .05, w * .17, -.01, 0, metal, 1);   // blade arm from hub
      const blade = box(pivot, w * .42, .014, w * .17, w * .47, -.03, 0, bodyMat, 1); blade.rotation.z = .1; // pitched blade
    }
  }

  function ceilingLight(g, o, w, d, h) {
    const active = o.active !== false;
    const color = colorOf(o.color, '#fff2b5');
    const lens = new THREE.MeshStandardMaterial({ color, emissive: active ? color : new THREE.Color('#3e443f'), emissiveIntensity: active ? 1.35 : .08, roughness: .25, metalness: .04, side: THREE.DoubleSide });
    box(g, w * .92, Math.max(.025, h * .35), d * .92, 0, h * .35, 0, pbr({ material: 'Metal', color: '#aeb4ad' }), 1);
    box(g, w * .78, Math.max(.018, h * .3), d * .78, 0, h * .7, 0, lens, 1);
    const lumens = Math.max(100, Math.min(5000, Number(o.lumens) || 1000));
    if (active) {
      const light = new THREE.PointLight(color, Math.min(8, lumens / 180), 8, 1.7);
      light.position.set(0, -.04, 0); light.castShadow = false; g.add(light);
    }
  }

  // A proper handrail: a bar running 0.9 m above the tread line between two
  // points, with vertical balusters. Fixes rails that used to lie on the steps.
  function stairRailing(g, ax, ay, az, bx, by, bz) {
    const railMat = pbr({ material: 'Metal', color: '#6b6f6c' }), railH = .9;
    const a = new THREE.Vector3(ax, ay + railH, az), b = new THREE.Vector3(bx, by + railH, bz);
    const dir = b.clone().sub(a), len = Math.max(.1, dir.length());
    const rail = new THREE.Mesh(new THREE.BoxGeometry(.045, .045, len), railMat);
    rail.position.copy(a).add(b).multiplyScalar(.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
    rail.castShadow = true; g.add(rail);
    const n = Math.max(2, Math.round(len / .3));
    for (let i = 0; i <= n; i++) { const t = i / n; cylinder(g, .013, .013, railH, 8, ax + (bx - ax) * t, ay + (by - ay) * t + railH / 2, az + (bz - az) * t, railMat); }
  }

  function straightStaircase(g,o,w,d,h,mat){
    const total=Math.max(6,Math.min(36,Math.round(Number(o.stepCount)||16))),tread=d/total;
    for(let i=0;i<total;i++) box(g,w,.085,tread+.012,0,h*(i+1)/total-.043,d/2-(i+.5)*tread,mat,1);
    const stringMat=pbr({material:o.material||'Wood',color:'#6b4e37'});
    for(const x of [-w/2+.08,w/2-.08]){const s=box(g,.10,.14,Math.hypot(d,h),x,h/2,0,stringMat);s.rotation.x=Math.atan2(h,d);}
    stairRailing(g, -w/2+.06, 0, d/2-.05, -w/2+.06, h, -d/2+.05);
    stairRailing(g, w/2-.06, 0, d/2-.05, w/2-.06, h, -d/2+.05);
  }

  function staircase(g, o, w, d, h, mat, kind) {
    const total = Math.max(6, Math.min(36, Math.round(Number(o.stepCount) || 16)));
    const lower = Math.max(1, Math.min(35, Math.round(Number(o.lowerStepCount) || Math.ceil(total / 2))));
    const upper = Math.max(1, Math.min(35, Math.round(Number(o.upperStepCount) || Math.max(1, total - lower))));
    const sw = Math.max(.65, Math.min(cm(o.stairWidth || 95), w * .46, d * .46));
    const landingLength = Math.max(sw, Math.min(cm(o.landingLength || o.landingDepth || 100), d * .42));
    const landingWidth = Math.max(kind === 'u-stairs' ? sw * 2 : sw, Math.min(cm(o.landingWidth || (kind === 'u-stairs' ? w : sw)), w));
    const run = Math.max(.55, d - landingLength), lowerTread = run / lower, upperTread = run / upper;
    const leftX = -w / 2 + sw / 2;
    const treadSlab = (sx, sy, sz, x, y, z) => box(g, sx, .085, sz, x, y, z, mat, 1);
    // Lower flight ends exactly at the near edge of the middle platform;
    // it must never run underneath or past the landing.
    for (let i = 0; i < lower; i++) {
      const rise = h * .5 * (i + 1) / lower, z = d / 2 - (i + .5) * lowerTread;
      treadSlab(sw, .085, lowerTread + .012, leftX, rise - .043, z);
    }
    treadSlab(landingWidth, .085, landingLength, kind === 'u-stairs' ? 0 : leftX, h * .5 - .043, -d / 2 + landingLength / 2);
    if (kind === 'u-stairs') {
      const rightX = w / 2 - sw / 2;
      for (let i = 0; i < upper; i++) {
        const rise = h * .5 + h * .5 * (i + 1) / upper, z = -d / 2 + landingLength + (i + .5) * upperTread;
        treadSlab(sw, .085, upperTread + .012, rightX, rise - .043, z);
      }
    } else {
      const run2 = Math.max(.55, w - sw), secondTread = run2 / upper;
      for (let i = 0; i < upper; i++) {
        const rise = h * .5 + h * .5 * (i + 1) / upper, x = -w / 2 + sw + (i + .5) * secondTread;
        treadSlab(secondTread + .012, .085, sw, x, rise - .043, -d / 2 + sw / 2);
      }
    }
    // Open-tread construction intentionally has no continuous support block.
    // Two thin guard rails below follow the exact same clockwise flight paths
    // as the 2D symbol; the under-stair volume remains visually open.
    if(o.underStorage!==false){
      const storageMat=pbr({material:'Wood',color:'#806245'}),cabW=Math.max(.72,Math.min(w-sw-.18,1.35)),cabD=Math.max(.42,Math.min(sw*.78,.72)),cabH=Math.min(h*.34,1.05);
      const sx=kind==='u-stairs'?0:(-w/2+sw+cabW/2+.08),sz=kind==='u-stairs'?0:(-d/2+cabD/2+.08);
      box(g,cabW,cabH,cabD,sx,cabH/2-.02,sz,storageMat,1);box(g,cabW*.78,.035,.025,sx,cabH*.54,sz+cabD/2+.014,pbr({material:'Metal',color:'#4f514b'}),1);
    }
    // Handrails at 0.9 m above the treads with balusters, following each flight.
    const railX = -w / 2 + .05;
    stairRailing(g, railX, 0, d / 2 - .05, railX, h * .5, -d / 2 + landingLength);        // lower flight (left, open side)
    if (kind === 'u-stairs') {
      stairRailing(g, railX, h * .5, -d / 2 + .05, w / 2 - .05, h * .5, -d / 2 + .05);     // landing back guard
      stairRailing(g, w / 2 - .05, h * .5, -d / 2 + landingLength, w / 2 - .05, h, d / 2 - .05); // upper flight (right, rises toward front)
    } else {
      const zFront = -d / 2 + sw - .05;
      stairRailing(g, railX, h * .5, -d / 2 + landingLength, railX, h * .5, zFront);        // landing turn guard
      stairRailing(g, -w / 2 + sw, h * .5, zFront, w / 2 - .05, h, zFront);                 // upper flight (front edge)
    }
  }

  function addBulb(g, colorHex, lumens, active, x, y, z, shadow) {
    if (!active) return;
    const l = Math.max(100, Math.min(5000, Number(lumens) || 800));
    const light = new THREE.PointLight(colorHex, Math.min(9, l / 170), 9, 1.8);
    light.position.set(x, y, z);
    light.castShadow = !!shadow;
    if (shadow) { light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.0004; }
    g.add(light);
  }
  function emissiveMat(colorHex, active, intensity) {
    const c = new THREE.Color(colorHex);
    return new THREE.MeshStandardMaterial({ color: c, emissive: active ? c : new THREE.Color('#3e443f'), emissiveIntensity: active ? (intensity || 2.2) : .06, roughness: .3, metalness: .05 });
  }
  function ottoman(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .8, d, Math.min(w, d) * .22, 0, h * .44, 0, mat);
    roundedBox(g, w * .92, h * .22, d * .92, Math.min(w, d) * .18, 0, h * .82, 0, mat);
    const foot = pbr({ material: 'Wood', color: '#493b32' });
    for (const x of [-w * .36, w * .36]) for (const z of [-d * .36, d * .36]) cylinder(g, .02, .026, h * .12, 10, x, h * .05, z, foot);
  }
  function bookshelf(g, o, w, d, h, mat) {
    box(g, w, h, .04, 0, h / 2, -d / 2 + .02, mat);
    box(g, .05, h, d, -w / 2 + .025, h / 2, 0, mat); box(g, .05, h, d, w / 2 - .025, h / 2, 0, mat);
    box(g, w, .05, d, 0, .025, 0, mat); box(g, w, .05, d, 0, h - .025, 0, mat);
    const shelves = Math.max(3, Math.round(h / .35));
    const bookCols = ['#8a4b3a', '#3f5d6e', '#6d7a4a', '#96813f', '#5a4a6b', '#7a5a45'];
    // Deterministic pseudo-random so books don't re-shuffle on every rebuild.
    let seed = 20260101; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let s = 1; s < shelves; s++) {
      const y = h * s / shelves; box(g, w - .1, .035, d - .06, 0, y, 0, mat);
      let x = -w / 2 + .08, bi = 0;
      while (x < w / 2 - .1) { const bw = .02 + rnd() * .035, bh = (h / shelves) * (.55 + rnd() * .32); box(g, bw, bh, d * .7, x + bw / 2, y + bh / 2 + .02, 0, pbr({ material: 'Wood', color: bookCols[(bi++) % bookCols.length] })); x += bw + .006; }
    }
  }
  function dresser(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .02, 0, h / 2, 0, mat);
    const face = pbr({ material: o.material, color: o.color || '#957a5f' }), knob = pbr({ material: 'Metal', color: '#4a4d4a' });
    const rows = 3, cols = w > 1 ? 2 : 1;
    for (let r = 0; r < rows; r++) for (let ccol = 0; ccol < cols; ccol++) {
      const dw = w / cols - .04, dh = h / rows - .035, x = -w / 2 + (ccol + .5) * w / cols, y = h - (r + .5) * h / rows;
      roundedBox(g, dw, dh, .022, .01, x, y, d / 2 + .012, face);
      cylinder(g, .012, .012, .055, 12, x, y, d / 2 + .04, knob, true).rotation.x = Math.PI / 2;
    }
    for (const x of [-w * .42, w * .42]) box(g, .05, h * .08, .05, x, h * .04, 0, pbr({ material: 'Wood', color: '#4a3d31' }));
  }
  function console3d(g, o, w, d, h, mat) {
    roundedBox(g, w, .05, d, .02, 0, h - .025, 0, mat);
    const leg = pbr({ material: o.material, color: '#5f4d3f' });
    for (const x of [-w * .44, w * .44]) for (const z of [-d * .34, d * .34]) cylinder(g, .022, .028, h - .05, 10, x, (h - .05) / 2, z, leg);
    roundedBox(g, w * .82, .035, d * .82, .02, 0, h * .4, 0, mat);
  }
  function fireplace(g, o, w, d, h, mat) {
    box(g, w, h, d, 0, h / 2, 0, mat);
    const cavity = pbr({ material: 'Stone', color: '#2a2422' });
    box(g, w * .6, h * .5, d * .6, 0, h * .38, d * .15, cavity, 1);
    box(g, w * 1.05, .06, d * 1.15, 0, h * .68, 0, pbr({ material: 'Stone', color: '#c9c3bb' }), 1);
    if (o.active !== false) { const fire = emissiveMat('#e07b2e', true, 2.6); box(g, w * .5, h * .28, d * .35, 0, h * .26, d * .15, fire, 1); addBulb(g, 0xff8a3a, 500, true, 0, h * .3, d * .2, false); }
  }
  function piano(g, o, w, d, h, mat) {
    box(g, w, h * .78, d * .8, 0, h * .45, -d * .05, mat);
    box(g, w, h * .18, d, 0, h * .09, 0, mat);
    const keys = pbr({ material: 'Plastic', color: '#f4f1e8' });
    box(g, w * .92, .05, d * .28, 0, h * .5, d * .42, keys, 1);
    box(g, w * .92, h * .04, d * .28, 0, h * .56, d * .42, mat, 1);
    const black = pbr({ material: 'Plastic', color: '#1a1715' });
    for (let x = -w * .4; x < w * .42; x += w * .06) box(g, w * .02, .04, d * .16, x, h * .53, d * .46, black, 1);
  }
  function wallCabinet(g, o, w, d, h, mat) {
    box(g, w, h, d, 0, h / 2, 0, mat);
    const face = pbr({ material: o.material, color: o.color || '#c1c3ba' });
    const doors = Math.max(2, Math.round(w / .5));
    for (let i = 0; i < doors; i++) { const dw = w / doors - .012, x = -w / 2 + (i + .5) * w / doors; box(g, dw, h * .9, .016, x, h / 2, d / 2 + .01, face); box(g, .008, h * .3, .012, x + dw * .36, h * .5, d / 2 + .02, pbr({ material: 'Metal', color: '#565b5a' })); }
  }
  function rangeHood(g, o, w, d, h, mat) {
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(w * .18, w * .5, h * .7, 4), mat);
    funnel.rotation.y = Math.PI / 4; funnel.position.y = h * .55; funnel.castShadow = true; g.add(funnel);
    box(g, w * .2, h * .4, d * .2, 0, h * .85, 0, mat);
    box(g, w * .9, .04, d * .9, 0, h * .2, 0, pbr({ material: 'Metal', color: '#8b9192' }), 1);
  }
  function pendant(g, o, w, d, h, mat) {
    const active = o.active !== false, color = o.color || '#f2d9a0';
    cylinder(g, .008, .008, h, 8, 0, h / 2, 0, pbr({ material: 'Metal', color: '#3c3f3d' }));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(w * .5, h * .28, 24, 1, true), emissiveMat(color, active, 1.4));
    shade.position.y = h * .14; g.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(w * .18, 16, 12), emissiveMat(color, active, 2.6)); bulb.position.y = h * .04; g.add(bulb);
    addBulb(g, new THREE.Color(color).getHex(), o.lumens || 800, active, 0, h * .04, 0, false);
  }
  function chandelier(g, o, w, d, h, mat) {
    const active = o.active !== false, color = o.color || '#e8c874';
    cylinder(g, .008, .008, h * .5, 8, 0, h * .75, 0, pbr({ material: 'Metal', color: '#4a3f2c' }));
    cylinder(g, w * .12, w * .12, h * .1, 16, 0, h * .5, 0, pbr({ material: 'Metal', color: color }));
    const arms = 6;
    for (let i = 0; i < arms; i++) {
      const a = i * Math.PI * 2 / arms, rx = Math.cos(a) * w * .42, rz = Math.sin(a) * w * .42;
      const arm = new THREE.Mesh(new THREE.TorusGeometry(w * .22, .012, 6, 16, Math.PI), pbr({ material: 'Metal', color: color }));
      arm.position.set(rx * .5, h * .5, rz * .5); arm.rotation.y = -a; arm.rotation.x = Math.PI / 2; g.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(w * .07, 12, 8), emissiveMat(color, active, 2.4)); bulb.position.set(rx, h * .5, rz); g.add(bulb);
    }
    addBulb(g, new THREE.Color(color).getHex(), o.lumens || 1600, active, 0, h * .5, 0, false);
  }
  function sconce(g, o, w, d, h, mat) {
    const active = o.active !== false, color = o.color || '#e9d6a6';
    box(g, w * .5, h, d * .3, 0, h / 2, -d / 2, mat, 1);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(w * .5, w * .35, h * .6, 16, 1, true), emissiveMat(color, active, 1.6));
    shade.position.set(0, h * .5, d * .15); g.add(shade);
    addBulb(g, new THREE.Color(color).getHex(), o.lumens || 400, active, 0, h * .5, d * .15, false);
  }
  function downlight(g, o, w, d, h, mat) {
    const active = o.active !== false, color = o.color || '#fff2c8';
    cylinder(g, w * .5, w * .5, h, 24, 0, h / 2, 0, pbr({ material: 'Metal', color: '#c8ccc6' }));
    cylinder(g, w * .38, w * .38, h * .3, 24, 0, .01, 0, emissiveMat(color, active, 2.8));
    if (active) { const l = new THREE.SpotLight(new THREE.Color(color).getHex(), Math.min(6, (o.lumens || 600) / 150), 8, .7, .5, 1.6); l.position.set(0, 0, 0); l.target.position.set(0, -3, 0); l.castShadow = false; g.add(l); g.add(l.target); }
  }
  function umbrella(g, o, w, d, h, mat) {
    cylinder(g, .03, .03, h, 10, 0, h / 2, 0, pbr({ material: 'Metal', color: '#7a7d78' }));
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(w * .5, h * .22, 8), mat);
    canopy.position.y = h * .9; canopy.castShadow = true; g.add(canopy);
  }
  function pergola(g, o, w, d, h, mat) {
    for (const x of [-w / 2 + .08, w / 2 - .08]) for (const z of [-d / 2 + .08, d / 2 - .08]) box(g, .1, h, .1, x, h / 2, z, mat);
    box(g, w, .1, .12, 0, h - .05, -d / 2 + .06, mat); box(g, w, .1, .12, 0, h - .05, d / 2 - .06, mat);
    box(g, .12, .1, d, -w / 2 + .06, h - .05, 0, mat); box(g, .12, .1, d, w / 2 - .06, h - .05, 0, mat);
    const slats = Math.max(6, Math.round(w / .28));
    for (let i = 0; i <= slats; i++) box(g, .05, .07, d - .1, -w / 2 + i * w / slats, h - .02, 0, mat);
  }
  function pool(g, o, w, d, h, mat) {
    // Sits on the surface (not sunk below the floor slab, which hid it before).
    const coping = pbr({ material: 'Stone', color: '#d7d3c8' }), t = Math.min(.16, w * .06);
    box(g, w, h, t, 0, h / 2, -d / 2 + t / 2, coping); box(g, w, h, t, 0, h / 2, d / 2 - t / 2, coping);
    box(g, t, h, d, -w / 2 + t / 2, h / 2, 0, coping); box(g, t, h, d, w / 2 - t / 2, h / 2, 0, coping);
    box(g, w - t, .05, d - t, 0, .03, 0, pbr({ material: 'Ceramic', color: '#8fc7d8' }));   // basin floor
    box(g, w + t, .05, d + t, 0, h + .02, 0, coping, 1);                                     // coping lip
    const water = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(o.color || '#4aa3c4'), roughness: .05, metalness: 0, transparent: true, opacity: .82, transmission: .35, ior: 1.33 });
    const wm = new THREE.Mesh(new THREE.BoxGeometry(w - t, h * .8, d - t), water); wm.position.y = h * .42; g.add(wm);
  }
  function fence(g, o, w, d, h, mat) {
    box(g, w, .06, d, 0, h * .25, 0, mat); box(g, w, .06, d, 0, h * .75, 0, mat);
    const pickets = Math.max(4, Math.round(w / .12));
    for (let i = 0; i < pickets; i++) box(g, w / pickets * .6, h, d * .6, -w / 2 + (i + .5) * w / pickets, h / 2, 0, mat);
    for (const x of [-w / 2 + .04, w / 2 - .04]) box(g, .08, h * 1.1, d, x, h * .55, 0, mat);
  }
  function gate(g, o, w, d, h, mat) {
    for (const x of [-w / 2, w / 2]) box(g, .08, h * 1.15, d, x, h * .575, 0, mat);
    box(g, w, .06, d * .7, 0, h * .2, 0, mat); box(g, w, .06, d * .7, 0, h * .85, 0, mat);
    const bars = 5; for (let i = 0; i < bars; i++) box(g, .04, h * .65, d * .5, -w / 2 + (i + .5) * w / bars, h * .52, 0, mat);
    const diag = box(g, Math.hypot(w, h * .6), .04, d * .5, 0, h * .52, 0, mat); diag.rotation.z = Math.atan2(h * .6, w);
  }
  function grill(g, o, w, d, h, mat) {
    box(g, w, h * .35, d, 0, h * .72, 0, mat, 1);
    const grate = pbr({ material: 'Metal', color: '#2a2d2f' });
    box(g, w * .9, .03, d * .9, 0, h * .9, 0, grate, 1);
    for (const x of [-w * .35, 0, w * .35]) cylinder(g, .02, .02, h * .55, 8, x, h * .27, 0, pbr({ material: 'Metal', color: '#54595a' }));
    box(g, w * .3, h * .1, .04, w * .3, h * .72, d / 2 + .04, pbr({ material: 'Wood', color: '#5a4a3a' }), 1);
  }
  function curtains(g, o, w, d, h, mat) {
    const panels = 2, pw = w / panels * .48;
    for (let i = 0; i < panels; i++) {
      const cx = (i === 0 ? -1 : 1) * (w / 2 - pw / 2);
      for (let f = 0; f < 5; f++) { const fx = cx + (f - 2) * pw * .22; const fold = new THREE.Mesh(new THREE.CylinderGeometry(pw * .13, pw * .13, h * .96, 8, 1, true, -Math.PI / 2, Math.PI), mat); fold.position.set(fx, h / 2, 0); fold.castShadow = true; g.add(fold); }
    }
    box(g, w * 1.05, .04, .04, 0, h - .02, 0, pbr({ material: 'Metal', color: '#5a5f5c' }));
  }
  function blind(g, o, w, d, h, mat) {
    box(g, w, h, Math.max(.01, d * .4), 0, h / 2, 0, mat, 1);
    box(g, w * 1.04, .05, d, 0, h + .02, 0, pbr({ material: 'Metal', color: '#8b9192' }));
    const slats = Math.max(6, Math.round(h / .1));
    const slatMat = pbr({ material: o.material, color: o.color || '#d6d2c6' });
    for (let i = 1; i < slats; i++) box(g, w, .006, d * .45, 0, h * i / slats, .005, slatMat, 1);
  }
  function wallArt(g, o, w, d, h, mat) {
    box(g, w, h, Math.max(.02, d), 0, h / 2, 0, pbr({ material: 'Wood', color: o.color || '#5a4a3a' }), 1);
    const art = new THREE.MeshStandardMaterial({ color: new THREE.Color(o.color || '#7b8ea0'), roughness: .6, metalness: 0 });
    box(g, w * .86, h * .82, d + .01, 0, h / 2, d * .5, art, 1);
  }

  // ── North Indian household objects ──────────────────────────────────
  function mandir(g, o, w, d, h, mat) {
    const gold = pbr({ material: 'Metal', color: '#c99a3a' }), back = pbr({ material: 'Wood', color: '#6b4527' });
    roundedBox(g, w, h * .4, d, .02, 0, h * .2, 0, mat);
    roundedBox(g, w * .94, h * .03, d * .94, .01, 0, h * .42, 0, gold);
    roundedBox(g, w * .74, h * .3, .02, .01, 0, h * .6, -d * .34, back);
    for (const x of [-w * .42, w * .42]) cylinder(g, .022, .028, h * .34, 10, x, h * .59, d * .38, mat);
    roundedBox(g, w, h * .03, d * .18, .01, 0, h * .76, d * .34, mat);
    cylinder(g, w * .38, w * .46, h * .07, 4, 0, h * .8, 0, mat).rotation.y = Math.PI / 4;
    cylinder(g, w * .24, w * .38, h * .1, 4, 0, h * .88, 0, mat).rotation.y = Math.PI / 4;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(w * .2, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.position.y = h * .92; dome.castShadow = true; g.add(dome);
    cylinder(g, .014, .014, h * .07, 8, 0, h * .99, 0, gold);
  }
  function tulsi(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .58, d, .02, 0, h * .29, 0, mat);
    roundedBox(g, w * 1.12, h * .08, d * 1.12, .02, 0, h * .6, 0, mat);
    roundedBox(g, w * .78, h * .06, d * .78, .02, 0, h * .64, 0, pbr({ material: 'Natural', color: '#3c2c1e' }));
    const leaf = pbr({ material: 'Natural', color: '#4f8a54' });
    for (let i = 0; i < 11; i++) { const a = i * 2.399, rr = w * (.04 + (i % 3) * .07), m = new THREE.Mesh(new THREE.SphereGeometry(w * .1, 10, 8), leaf); m.scale.set(1, 1.35, 1); m.position.set(Math.cos(a) * rr, h * (.72 + (i % 4) * .06), Math.sin(a) * rr); m.castShadow = true; g.add(m); }
  }
  function diwan(g, o, w, d, h, mat) {
    const wood = pbr({ material: 'Wood', color: '#6f5238' });
    roundedBox(g, w, h * .5, d, .03, 0, h * .28, 0, wood);
    roundedBox(g, w * .97, h * .34, d * .95, .06, 0, h * .62, 0, pbr({ material: 'Fabric', color: '#c9b48c' }));
    const bolster = pbr({ material: 'Fabric', color: '#9c7b52' });
    for (const x of [-w * .44, w * .44]) { const b = cylinder(g, d * .14, d * .14, d * .9, 16, x, h * .78, 0, bolster); b.rotation.x = Math.PI / 2; }
    for (const x of [-w * .28, 0, w * .28]) { const c = roundedBox(g, w * .18, h * .5, d * .5, .05, x, h * .9, -d * .18, bolster); c.rotation.x = -.12; }
    for (const x of [-w * .43, w * .43]) for (const z of [-d * .4, d * .4]) box(g, .05, h * .3, .05, x, h * .13, z, wood);
  }
  function jhula(g, o, w, d, h, mat) {
    const wood = mat, chain = pbr({ material: 'Metal', color: '#6a6f6c' });
    for (const x of [-w * .42, w * .42]) for (const z of [-d * .42, d * .42]) box(g, .05, h, .05, x, h / 2, z, wood);
    roundedBox(g, w, .06, .06, .02, 0, h * .96, 0, wood);
    for (const x of [-w * .42, w * .42]) box(g, .05, .05, d * .84, x, h * .96, 0, wood);
    const seatY = h * .42;
    roundedBox(g, w * .62, h * .05, d * .72, .03, 0, seatY, 0, pbr({ material: 'Wood', color: '#8a6a45' }));
    roundedBox(g, w * .62, h * .3, .05, .03, 0, seatY + h * .16, -d * .3, pbr({ material: 'Wood', color: '#8a6a45' }));
    for (const x of [-w * .28, w * .28]) for (const z of [-d * .3, d * .3]) cylinder(g, .008, .008, h * .96 - seatY, 6, x, (h * .96 + seatY) / 2, z, chain);
  }
  function floorSeating(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .72, d, .05, 0, h * .36, 0, mat);
    const white = pbr({ material: 'Fabric', color: '#efe9dd' });
    const n = Math.max(2, Math.round(w / .55));
    for (let i = 0; i < n; i++) { const cx = -w / 2 + (i + .5) * w / n; roundedBox(g, w / n - .05, h * 2.2, d * .28, .06, cx, h * 1.4, -d * .34, i % 2 ? mat : white); }
    const b = cylinder(g, h * .62, h * .62, w * .9, 16, 0, h * .95, d * .34, pbr({ material: 'Fabric', color: '#b06a5f' })); b.rotation.z = Math.PI / 2;
  }
  function charpai(g, o, w, d, h, mat) {
    const wood = pbr({ material: 'Wood', color: '#7a5a3a' });
    for (const x of [-w * .44, w * .44]) for (const z of [-d * .42, d * .42]) cylinder(g, .03, .04, h, 10, x, h / 2, z, wood);
    roundedBox(g, w, .06, .07, .02, 0, h * .9, -d * .44, wood); roundedBox(g, w, .06, .07, .02, 0, h * .9, d * .44, wood);
    roundedBox(g, .07, .06, d, .02, -w * .44, h * .9, 0, wood); roundedBox(g, .07, .06, d, .02, w * .44, h * .9, 0, wood);
    const jute = pbr({ material: 'Natural', color: o.color || '#a98b5c' }); roundedBox(g, w * .84, .02, d * .82, .01, 0, h * .88, 0, jute);
    const line = pbr({ material: 'Natural', color: '#8a6f45' });
    for (let x = -w * .38; x < w * .4; x += w * .09) box(g, .012, .014, d * .82, x, h * .9, 0, line);
    for (let z = -d * .36; z < d * .4; z += d * .16) box(g, w * .84, .012, .012, 0, h * .9, z, line);
  }
  function almirah(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .015, 0, h / 2, 0, mat);
    const face = pbr({ material: 'Metal', color: o.color || '#8b9aa0' });
    roundedBox(g, w * .48, h * .94, .02, .01, -w * .24, h * .5, d / 2 + .012, face);
    roundedBox(g, w * .48, h * .94, .02, .01, w * .24, h * .5, d / 2 + .012, face);
    roundedBox(g, w * .34, h * .78, .008, .006, w * .24, h * .52, d / 2 + .02, pbr({ material: 'Mirror', color: '#c3d0cf', roughness: .06 }));
    for (const x of [-w * .03, w * .45]) cylinder(g, .011, .011, h * .18, 8, x, h * .5, d / 2 + .03, pbr({ material: 'Metal', color: '#565b59' }));
  }
  function gasStove(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .55, d, .02, 0, h * .27, 0, mat);
    const steel = pbr({ material: 'Metal', color: '#3a3f41' });
    for (const x of [-w * .24, w * .24]) {
      cylinder(g, Math.min(w, d) * .15, Math.min(w, d) * .18, h * .12, 18, x, h * .58, 0, steel);
      const grate = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * .2, .01, 6, 18), steel); grate.rotation.x = Math.PI / 2; grate.position.set(x, h * .64, 0); g.add(grate);
    }
    for (const x of [-w * .38, -w * .13, w * .13, w * .38]) { const k = cylinder(g, .022, .022, .03, 10, x, h * .5, d / 2 + .02, steel); k.rotation.x = Math.PI / 2; }
  }
  function gasCylinder(g, o, w, d, h, mat) {
    const body = pbr({ material: 'Metal', color: o.color || '#9c3128' }), valve = pbr({ material: 'Metal', color: '#8a8f8c' });
    cylinder(g, w * .44, w * .46, h * .8, 22, 0, h * .4, 0, body);
    cylinder(g, w * .3, w * .44, h * .12, 22, 0, h * .86, 0, body);
    cylinder(g, w * .12, w * .14, h * .1, 12, 0, h * .95, 0, valve);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(w * .3, .02, 6, 20), valve); ring.rotation.x = Math.PI / 2; ring.position.y = h; g.add(ring);
  }
  function roPurifier(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .03, 0, h / 2, 0, mat);
    roundedBox(g, w * .68, h * .48, .02, .02, 0, h * .56, d / 2 + .011, pbr({ material: 'Glass', color: '#6fb0d4', transparency: 22 }));
    cylinder(g, .02, .02, .05, 10, 0, h * .2, d / 2 + .03, pbr({ material: 'Metal', color: '#5a5f5d' }), false).rotation.x = Math.PI / 2;
  }
  function geyser(g, o, w, d, h, mat) {
    cylinder(g, w * .46, w * .46, h * .86, 24, 0, h * .5, 0, mat);
    cylinder(g, w * .3, w * .46, h * .1, 24, 0, h * .92, 0, mat);
    const pipe = pbr({ material: 'Metal', color: '#9aa0a0' });
    for (const x of [-w * .22, w * .22]) cylinder(g, .014, .014, h * .28, 8, x, h * .96, d * .1, pipe);
    const led = pbr({ material: 'Glass', color: '#d24a3a', transparency: 8, active: true, shape: 'ceiling-light' });
    cylinder(g, .02, .02, .02, 10, w * .3, h * .4, d * .44, led, false).rotation.x = Math.PI / 2;
  }
  function squatToilet(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .6, d, .05, 0, h * .3, 0, mat);                                  // raised pan platform
    const rim = new THREE.Mesh(new THREE.TorusGeometry(w * .24, w * .06, 10, 24), mat); rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.5, 1); rim.position.set(0, h * .6, 0); rim.castShadow = true; g.add(rim); // oval pan rim
    const hole = new THREE.Mesh(new THREE.CircleGeometry(w * .2, 22), pbr({ material: 'Ceramic', color: '#3a3f3e' })); hole.rotation.x = -Math.PI / 2; hole.scale.set(1, 1.5, 1); hole.position.set(0, h * .585, 0); g.add(hole); // dark trough
    const rest = pbr({ material: 'Ceramic', color: '#dfe4df' });
    for (const x of [-w * .35, w * .35]) roundedBox(g, w * .16, h * .16, d * .52, .02, x, h * .62, 0, rest); // footrests
  }
  function cooler(g, o, w, d, h, mat) {
    roundedBox(g, w, h, d, .03, 0, h / 2, 0, mat);
    roundedBox(g, w * .9, h * .5, .02, .01, 0, h * .44, d / 2 + .011, pbr({ material: 'Metal', color: '#8b918d' }));
    cylinder(g, w * .28, w * .28, .03, 20, 0, h * .76, d / 2 + .02, pbr({ material: 'Plastic', color: '#5a5f5c' }), false).rotation.x = Math.PI / 2;
    const wh = pbr({ material: 'Plastic', color: '#2a2d2b' });
    for (const x of [-w * .38, w * .38]) for (const z of [-d * .38, d * .38]) { const c = cylinder(g, .035, .035, .03, 10, x, .035, z, wh); c.rotation.x = Math.PI / 2; }
  }
  function inverter(g, o, w, d, h, mat) {
    roundedBox(g, w, h * .55, d, .02, 0, h * .275, 0, pbr({ material: 'Plastic', color: '#2f4a63' }));
    roundedBox(g, w * .9, h * .4, d * .8, .02, 0, h * .76, 0, mat);
    const led = pbr({ material: 'Glass', color: o.active === false ? '#7d867f' : '#5ebf86', transparency: 8, active: o.active !== false, shape: 'ceiling-light' });
    cylinder(g, .012, .012, .02, 10, -w * .2, h * .82, d / 2 + .02, led, false).rotation.x = Math.PI / 2;
  }
  function waterTank(g, o, w, d, h, mat) {
    cylinder(g, w * .4, w * .48, h * .88, 24, 0, h * .44, 0, mat);
    cylinder(g, w * .42, w * .4, h * .12, 24, 0, h * .92, 0, mat);
    cylinder(g, w * .15, w * .18, h * .06, 16, 0, h * .99, 0, mat);
    const rib = pbr({ material: 'Plastic', color: '#1c1c1c' });
    for (let y = .2; y < .85; y += .22) { const r = new THREE.Mesh(new THREE.TorusGeometry(w * .44, .012, 6, 24), rib); r.rotation.x = Math.PI / 2; r.position.y = h * y; g.add(r); }
  }
  function jaali(g, o, w, d, h, mat) {
    const t = Math.max(.03, cm(o.d) * .6);
    roundedBox(g, w, .06, t, .01, 0, .03, 0, mat); roundedBox(g, w, .06, t, .01, 0, h - .03, 0, mat);
    roundedBox(g, .06, h, t, .01, -w / 2 + .03, h / 2, 0, mat); roundedBox(g, .06, h, t, .01, w / 2 - .03, h / 2, 0, mat);
    const cols = Math.max(3, Math.round(w / .16)), rows = Math.max(4, Math.round(h / .16));
    for (let i = 1; i < cols; i++) box(g, .022, h, t * .8, -w / 2 + i * w / cols, h / 2, 0, mat);
    for (let j = 1; j < rows; j++) box(g, w, .022, t * .8, 0, j * h / rows, 0, mat);
  }

  let contactShadowTex = null;
  function contactShadowTexture() {
    if (contactShadowTex) return contactShadowTex;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), grad = c.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(20,26,22,.55)'); grad.addColorStop(.6, 'rgba(20,26,22,.22)'); grad.addColorStop(1, 'rgba(20,26,22,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
    contactShadowTex = new THREE.CanvasTexture(cv);
    return contactShadowTex;
  }
  const NO_CONTACT_SHADOW = new Set(['door', 'window', 'roof', 'mirror', 'art', 'wall-cabinet', 'range-hood', 'pendant', 'chandelier', 'sconce', 'downlight', 'curtains', 'blind', 'switchboard', 'electrical-panel', 'ceiling-fan', 'ceiling-light', 'radiator', 'tv', 'rug', 'pool']);
  function addContactShadow(g, o, w, d) {
    if (NO_CONTACT_SHADOW.has(o.shape || o.type) || (Number(o.elevation) || 0) > 15) return;
    const mat = new THREE.MeshBasicMaterial({ map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: .9 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.35, d * 1.35), mat);
    plane.rotation.x = -Math.PI / 2; plane.position.y = .012; plane.renderOrder = -1; plane.raycast = () => {};
    g.add(plane);
  }

  function buildObject(o) {
    const g = localGroup(o), w = cm(o.w), d = cm(o.d), h = cm(o.height || 80), mat = pbr(o), t = o.shape || o.type;
    if(!o.system)addContactShadow(g, o, w, d);
    if(t==='service-route'){
      const points=window.Atelier.serviceLocalPoints(o).map(p=>new THREE.Vector3(cm(p.x),cm(p.z)+.015,cm(p.y))),radius=cm(o.diameter||2.5)/2;
      for(let i=1;i<points.length;i++){const delta=points[i].clone().sub(points[i-1]),length=delta.length();if(length<.0001)continue;const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),mat);mesh.position.copy(points[i]).add(points[i-1]).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(mesh);}
      for(const p of points){const joint=new THREE.Mesh(new THREE.SphereGeometry(radius,12,8),mat);joint.position.copy(p);g.add(joint);}
    }
    else if(t.startsWith('service-')){
      if(t==='service-tap'){cylinder(g,.018,.018,h*.7,12,0,h*.35,0,mat);box(g,w*.8,.035,.04,w*.2,h*.7,0,mat);box(g,w*.8,.025,.025,0,h*.85,0,mat);}
      else if(t==='service-drain'){box(g,w,h*.25,d,0,h*.125,0,mat);for(let i=-2;i<=2;i++)box(g,w*.8,.008,d*.06,0,h*.26,i*d*.16,pbr({material:'Metal',color:'#303c3a'}));}
      else if(t==='service-valve'){cylinder(g,w*.16,w*.16,h,12,0,h/2,0,mat);const wheel=new THREE.Mesh(new THREE.TorusGeometry(w*.35,w*.06,8,20),mat);wheel.rotation.x=Math.PI/2;wheel.position.y=h;g.add(wheel);}
      else {box(g,w,h,d,0,h/2,0,mat);for(const x of [-w*.2,w*.2])box(g,w*.1,h*.18,.01,x,h*.55,d*.51,pbr({material:'Plastic',color:'#33423c'}));}
    }
    else if (t === 'sofa') sofa(g, o, w, d, h, mat);
    else if (t === 'chair') chair(g, o, w, d, h, mat);
    else if (t === 'bed') bed(g, o, w, d, h, mat);
    else if (t === 'table' || t === 'round-table') table(g, o, w, d, h, mat, t === 'round-table');
    else if (t === 'desk') {
      if (o.type === 'media-console') {
        roundedBox(g, w, h, d, .02, 0, h / 2, 0, mat);
        const dr = pbr({ material: o.material, color: o.color || '#725d4c' }), doors = Math.max(2, Math.round(w / .5));
        for (let i = 0; i < doors; i++) { const dw = w / doors - .02, x = -w / 2 + (i + .5) * w / doors; roundedBox(g, dw, h * .7, .018, .01, x, h * .5, d / 2 + .012, dr); box(g, dw * .5, .012, .012, x, h * .5, d / 2 + .022, pbr({ material: 'Metal', color: '#5a5f5d' })); }
        for (const x of [-w * .42, w * .42]) box(g, .04, h * .1, .04, x, h * .05, 0, pbr({ material: 'Wood', color: '#4a3d31' }));
      } else {
        table(g, o, w, d, h, mat, false);
        roundedBox(g, w * .42, h * .44, d * .82, .02, w * .26, h * .52, 0, mat);
        const dr = pbr({ material: o.material, color: '#6f5946' });
        for (const y of [h * .68, h * .4]) { roundedBox(g, w * .38, h * .16, .016, .01, w * .26, y, d * .43, dr); cylinder(g, .008, .008, w * .12, 8, w * .26, y, d * .44, pbr({ material: 'Metal', color: '#54595a' }), true).rotation.x = Math.PI / 2; }
      }
    }
    else if (t === 'cabinet') cabinet(g, o, w, d, h, mat);
    else if (t === 'kitchen') kitchen(g, o, w, d, h, mat);
    else if (t === 'plant') plant(g, o, w, d, h);
    else if (t === 'car') car(g, o, w, d, h, mat);
    else if (t === 'door') door(g, o, w, d, h, mat);
    else if (t === 'window') windowMesh(g, o, w, d, h);
    else if (t === 'mirror') mirror(g, o, w, d, h);
    else if (t === 'roof') roof(g, o, w, d, h, mat);
    else if (t === 'appliance' || t === 'washer') appliance(g, o, w, d, h, mat);
    else if (t === 'lamp') {
      cylinder(g, .03, .04, h * .76, 12, 0, h * .4, 0, pbr({ material: 'Metal', color: '#5d625f' }));
      cylinder(g, w * .35, w * .5, h * .22, 32, 0, h * .83, 0, mat);
      cylinder(g, w * .34, w * .34, .035, 24, 0, .018, 0, pbr({ material: 'Metal', color: '#5d625f' }));
      if (o.active) { const light = new THREE.PointLight(0xffd9a0, 18, 5, 2); light.position.set(0, h * .76, 0); light.castShadow = true; light.shadow.mapSize.set(512, 512); g.add(light); }
    } else if (t === 'tv') {
      // Keep the selected object material on the TV bezel/body.  The old
      // branch used one fixed glass material for the whole volume, so changing
      // Wood/Metal/Plastic/etc. in the inspector could not appear in 3D.
      roundedBox(g, w, h, Math.max(.03, d), .012, 0, h / 2, 0, pbr({ material: o.material === 'Glass' ? 'Plastic' : o.material, color: '#20262a' }));
      const screen = pbr({ material: 'Glass', color: o.active ? '#3c9aca' : '#0e1417', transparency: o.active ? 3 : 10, active: !!o.active, shape: 'tv' });
      box(g, w * .9, h * .78, Math.max(.012, d * .5), 0, h * .55, d / 2 + .006, screen, 1);
      box(g, w * .24, .035, d * 2.2, 0, -.075, 0, pbr({ material: 'Metal', color: '#3b4141' })); box(g, .05, .16, .05, 0, -.02, 0, pbr({ material: 'Metal', color: '#3b4141' }));
    } else if (t === 'cooktop') {
      box(g, w, h, d, 0, h / 2, 0, mat, 1); const burner = pbr({ material: 'Metal', color: o.active ? '#d55c32' : '#1e2323', active: !!o.active, shape: 'cooktop' });
      for (const x of [-w * .24, w * .24]) for (const z of [-d * .24, d * .24]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * .13, .014, 8, 28), burner); ring.rotation.x = Math.PI / 2; ring.position.set(x, h + .012, z); g.add(ring); }
    } else if (t === 'sink' || t === 'double-sink') {
      box(g, w, h, d, 0, h / 2, 0, mat); const steel = pbr({ material: 'Metal', color: '#879393' });
      const count = t === 'double-sink' ? 2 : 1;
      for (let i = 0; i < count; i++) { const basin = cylinder(g, Math.min(w / count, d) * .31, Math.min(w / count, d) * .26, .08, 28, (i - (count - 1) / 2) * w * .45, h + .01, 0, steel); basin.scale.z = 1.22; }
      const faucet = new THREE.Mesh(new THREE.TorusGeometry(.12, .018, 8, 22, Math.PI), steel); faucet.rotation.z = Math.PI / 2; faucet.position.set(0, h + .12, -d * .28); g.add(faucet);
    } else if (t === 'toilet') {
      box(g, w * .76, h * .72, d * .27, 0, h * .64, -d * .35, mat, 1);
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(w * .47, 30, 18), mat); bowl.scale.set(1, .48, 1.32); bowl.position.set(0, h * .34, d * .1); bowl.castShadow = true; g.add(bowl);
      const seat = new THREE.Mesh(new THREE.TorusGeometry(w * .34, .038, 10, 32), mat); seat.scale.z = 1.35; seat.rotation.x = Math.PI / 2; seat.position.set(0, h * .58, d * .1); g.add(seat);
    } else if (t === 'tub') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(d * .43, d * .49, Math.max(d, w * .82), 36), mat);
      body.rotation.z = Math.PI / 2; body.scale.z = .82; body.position.y = h / 2; body.castShadow = true; g.add(body);
      box(g, w * .62, h * .48, d * .48, 0, h * .62, 0, pbr({ material: 'Glass', color: '#83b4ba', transparency: 42 }), 1);
    } else if (t === 'shower') {
      box(g, w, .06, d, 0, .03, 0, pbr({ material: 'Stone', color: '#d0d4d0' }));
      box(g, .025, h, d, -w / 2, h / 2, 0, mat); box(g, w, h, .025, 0, h / 2, -d / 2, mat);
      cylinder(g, .14, .14, .025, 24, w * .25, h * .82, -d * .34, pbr({ material: 'Metal', color: '#777f7e' })).rotation.x = Math.PI / 2;
    } else if (t === 'three-side-stairs') {
      try{const layout=window.Atelier.threeSideStairLayout(o);for(const p of layout.parts){if(p.kind==='entrance'&&o.skipStairEntrance)continue;const height=.085;box(g,cm(p.w),height,cm(p.d),cm(p.x),cm(p.z)-height/2,cm(p.y),p.kind==='landing'?pbr({material:o.material||'Concrete',color:'#dac9a7'}):mat);}for(const p of layout.risers)box(g,cm(p.w),cm(p.height),cm(p.d),cm(p.x),cm(p.z-p.height/2),cm(p.y),mat);for(const rail of layout.rails)stairRailing(g,cm(rail.a.x),cm(rail.z1),cm(rail.a.y),cm(rail.b.x),cm(rail.z2),cm(rail.b.y));}catch(error){box(g,w,.03,d,0,.015,0,pbr({material:'Concrete',color:'#bd5544'}));}
    } else if (t === 'stairs') {
      straightStaircase(g, o, w, d, h, mat);
    } else if (t === 'l-stairs' || t === 'u-stairs') {
      staircase(g, o, w, d, h, mat, t);
    } else if (t === 'rug') {
      box(g, w, Math.max(.012, h), d, 0, Math.max(.006, h / 2), 0, mat, 1);
      const bc = new THREE.Color(o.color || '#bf9e7c'); bc.offsetHSL(0, 0, -.12);
      const border = pbr({ material: 'Fabric', color: '#' + bc.getHexString() });
      const th = Math.min(w, d) * .07, top = Math.max(.014, h) + .001;
      box(g, w * .86, .004, th, 0, top, -d * .43 + th / 2, border, 1); box(g, w * .86, .004, th, 0, top, d * .43 - th / 2, border, 1);
      box(g, th, .004, d * .86, -w * .43 + th / 2, top, 0, border, 1); box(g, th, .004, d * .86, w * .43 - th / 2, top, 0, border, 1);
    }
    else if (t === 'radiator') {
      for (let x = -w * .42; x <= w * .42; x += w * .12) roundedBox(g, w * .07, h, d, .012, x, h / 2, 0, mat);
      roundedBox(g, w, .04, d, .015, 0, h * .17, 0, mat); roundedBox(g, w, .04, d, .015, 0, h * .83, 0, mat);
    } else if (t === 'switchboard') switchboard(g, o, w, d, h, mat);
    else if (t === 'electrical-panel') electricalPanel(g, o, w, d, h, mat);
    else if (t === 'ceiling-fan') ceilingFan(g, o, w, d, h, mat);
    else if (t === 'ceiling-light') ceilingLight(g, o, w, d, h);
    else if (t === 'planter') {
      roundedBox(g, w, h, d, .02, 0, h / 2, 0, mat); box(g, w * .9, .04, d * .78, 0, h + .015, 0, pbr({ material: 'Natural', color: '#3c3122' }));
      const greens = ['#4f8a54', '#5f9a5a', '#43703f'];
      for (let x = -w * .38; x <= w * .38; x += w * .13) for (let k = 0; k < 2; k++) {
        const r = d * (.12 + (k ? .04 : .08)), leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color: new THREE.Color(greens[(Math.round((x + w) / (w * .13)) + k) % 3]), roughness: .82, flatShading: true, envMapIntensity: .4 }));
        leaf.scale.set(1, 1.5, 1); leaf.position.set(x + (k ? d * .05 : 0), h + d * (.14 + k * .1), (k ? d * .08 : -d * .05)); leaf.castShadow = true; g.add(leaf);
      }
    } else if (t === 'bench') {
      roundedBox(g, w, .1, d * .52, .03, 0, h * .48, d * .1, mat); roundedBox(g, w, h * .42, .09, .03, 0, h * .72, -d * .36, mat);
      const bl = pbr({ material: o.material === 'Wood' ? 'Wood' : 'Metal', color: '#4a3d31' });
      for (const x of [-w * .42, w * .42]) roundedBox(g, .06, h * .48, d * .8, .02, x, h * .24, d * .04, bl);
    }
    else if (t === 'ottoman') ottoman(g, o, w, d, h, mat);
    else if (t === 'console') console3d(g, o, w, d, h, mat);
    else if (t === 'bookshelf') bookshelf(g, o, w, d, h, mat);
    else if (t === 'dresser') dresser(g, o, w, d, h, mat);
    else if (t === 'fireplace') fireplace(g, o, w, d, h, mat);
    else if (t === 'piano') piano(g, o, w, d, h, mat);
    else if (t === 'wall-cabinet') wallCabinet(g, o, w, d, h, mat);
    else if (t === 'range-hood') rangeHood(g, o, w, d, h, mat);
    else if (t === 'pendant') pendant(g, o, w, d, h, mat);
    else if (t === 'chandelier') chandelier(g, o, w, d, h, mat);
    else if (t === 'sconce') sconce(g, o, w, d, h, mat);
    else if (t === 'downlight') downlight(g, o, w, d, h, mat);
    else if (t === 'umbrella') umbrella(g, o, w, d, h, mat);
    else if (t === 'pergola') pergola(g, o, w, d, h, mat);
    else if (t === 'pool') pool(g, o, w, d, h, mat);
    else if (t === 'fence') fence(g, o, w, d, h, mat);
    else if (t === 'gate') gate(g, o, w, d, h, mat);
    else if (t === 'grill') grill(g, o, w, d, h, mat);
    else if (t === 'curtains') curtains(g, o, w, d, h, mat);
    else if (t === 'blind') blind(g, o, w, d, h, mat);
    else if (t === 'art') wallArt(g, o, w, d, h, mat);
    else if (t === 'mandir') mandir(g, o, w, d, h, mat);
    else if (t === 'tulsi') tulsi(g, o, w, d, h, mat);
    else if (t === 'diwan') diwan(g, o, w, d, h, mat);
    else if (t === 'jhula') jhula(g, o, w, d, h, mat);
    else if (t === 'floor-seating') floorSeating(g, o, w, d, h, mat);
    else if (t === 'charpai') charpai(g, o, w, d, h, mat);
    else if (t === 'almirah') almirah(g, o, w, d, h, mat);
    else if (t === 'gas-stove') gasStove(g, o, w, d, h, mat);
    else if (t === 'gas-cylinder') gasCylinder(g, o, w, d, h, mat);
    else if (t === 'ro-purifier') roPurifier(g, o, w, d, h, mat);
    else if (t === 'geyser') geyser(g, o, w, d, h, mat);
    else if (t === 'squat-toilet') squatToilet(g, o, w, d, h, mat);
    else if (t === 'cooler') cooler(g, o, w, d, h, mat);
    else if (t === 'inverter') inverter(g, o, w, d, h, mat);
    else if (t === 'water-tank') waterTank(g, o, w, d, h, mat);
    else if (t === 'jaali') jaali(g, o, w, d, h, mat);
    else box(g, w, h, d, 0, h / 2, 0, mat, 1);

    return g;
  }

  function nearestOpening(wall, floorData) {
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
    return floorData.items.filter(it => ['door', 'window'].includes(it.shape)).map(it => {
      const x = it.x + it.w / 2, y = it.y + it.d / 2;
      const t = ((x - wall.x1) * dx + (y - wall.y1) * dy) / (len * len);
      const px = wall.x1 + t * dx, py = wall.y1 + t * dy;
      const angle = Math.abs((((it.rotation || 0) - Math.atan2(dy, dx) * 180 / Math.PI + 90) % 180 + 180) % 180 - 90);
      return { item: it, center: t * len, distance: Math.hypot(x - px, y - py), angle };
    }).filter(v => v.distance < Math.max(35, wall.thickness * 2) && v.angle < 10 && v.center > 0 && v.center < len)
      .map(v => ({ ...v, start: Math.max(0, v.center - v.item.w / 2), end: Math.min(len, v.center + v.item.w / 2) }));
  }

  function wallSection(parent, wall, start, end, bottom, height, material) {
    if (end - start < 1 || height < 1) return;
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1, angle = Math.atan2(dy, dx);
    const mid = (start + end) / 2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(cm(end - start), cm(height), cm(wall.thickness)), material);
    mesh.position.set(cm(wall.x1 + Math.cos(angle) * mid), cm(bottom + height / 2), cm(wall.y1 + Math.sin(angle) * mid));
    mesh.rotation.y = -angle;
    mesh.castShadow = true; mesh.receiveShadow = false; parent.add(mesh);
  }

  function buildWalls(parent, floorData, mode) {
    if (mode === 'hidden') return;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#e0dbd0'), roughness: .95, metalness: 0, envMapIntensity: .3 });
    const xs = floorData.walls.flatMap(w => [w.x1, w.x2]), ys = floorData.walls.flatMap(w => [w.y1, w.y2]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const yaw = ((window.atelierBridge?.project.camera.yaw) || -38) * Math.PI / 180;
    const viewX = Math.sin(yaw), viewY = Math.cos(yaw);
    floorData.walls.forEach(wall => {
      const len = Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) || 1;
      const towardCamera = (((wall.x1 + wall.x2) / 2 - cx) * viewX + ((wall.y1 + wall.y2) / 2 - cy) * viewY) > 20;
      const wallHeight = mode === 'cutaway' && (towardCamera || wall.thickness <= 16) ? Math.min(58, wall.height || 280) : (wall.height || 280);
      const openings = nearestOpening(wall, floorData);
      const cuts = [0, len, ...openings.flatMap(v => [v.start, v.end])].sort((a, b) => a - b).filter((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) > .1);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i], b = cuts[i + 1], opening = openings.find(v => (a + b) / 2 > v.start + .1 && (a + b) / 2 < v.end - .1);
        if (!opening) wallSection(parent, wall, a, b, 0, wallHeight, mat);
        else {
          const sill = opening.item.shape === 'window' ? (opening.item.elevation || 90) : 0;
          const top = Math.min(wallHeight, sill + (opening.item.height || 120));
          wallSection(parent, wall, a, b, 0, Math.min(sill, wallHeight), mat);
          wallSection(parent, wall, a, b, top, wallHeight - top, mat);
        }
      }
    });
  }

  function roomFloor(parent, room) {
    if(room.stairOpenings?.length){
      const poly=room.polygon||[{x:room.x,y:room.y},{x:room.x+room.w,y:room.y},{x:room.x+room.w,y:room.y+room.d},{x:room.x,y:room.y+room.d}],triangles=THREE.ShapeUtils.triangulateShape(poly.map(p=>new THREE.Vector2(p.x,p.y)),[]);let pieces=triangles.map(ids=>ids.map(i=>poly[i]));
      for(const hole of room.stairOpenings)pieces=pieces.flatMap(p=>window.Atelier.subtractStairOpening(p,hole));
      for(const polygon of pieces)roomFloor(parent,{...room,polygon,stairOpenings:null});return;
    }
    const finish = (room.floorMaterial || (/kitchen|bath/i.test(room.name) ? 'tile' : /terrace|garage/i.test(room.name) ? 'stone' : 'wood')).toLowerCase();
    // Texture repeat is room-specific.  Never mutate the shared texture in
    // textureCache or one room's finish scale will leak into every other room
    // after a rebuild.
    const textureKind = finish === 'tile' ? 'tile' : finish === 'wood' ? 'wood' : finish === 'stone' ? 'stone' : finish === 'concrete' ? 'concrete' : finish === 'carpet' ? 'fabric' : 'fabric';
    const tex = canvasTexture(textureKind).clone();
    tex.needsUpdate = true;
    const opacity = Math.max(.25, Math.min(1, Number(room.opacity ?? 1)));
    // Lift the tint slightly and add a restrained diffuse contribution so a
    // selected room colour is not visually crushed by the procedural finish
    // texture and ACES/tone-mapped lighting.
    const floorTint = colorOf(room.color, '#ddd'); floorTint.offsetHSL(0, 0, .035);
    const rough = finish === 'tile' ? .26 : finish === 'stone' ? .5 : finish === 'concrete' ? .82 : finish === 'carpet' ? .93 : .5;
    const mat = new THREE.MeshStandardMaterial({ color: floorTint, map: tex, roughness: rough, metalness: 0, envMapIntensity: finish === 'carpet' ? .3 : .75, emissive: floorTint.clone(), emissiveIntensity: .025, transparent: opacity < .999, opacity, depthWrite: opacity > .6 });
    tex.repeat.set(Math.max(1, room.w / (finish === 'wood' ? 100 : 140)), Math.max(1, room.d / (finish === 'wood' ? 100 : 140)));
    let geo;
    if(room.polygon){const shape=new THREE.Shape();room.polygon.forEach((p,i)=>i?shape.lineTo(cm(p.x-room.x-room.w/2),-cm(p.y-room.y-room.d/2)):shape.moveTo(cm(p.x-room.x-room.w/2),-cm(p.y-room.y-room.d/2)));shape.closePath();geo=new THREE.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false});geo.rotateX(-Math.PI/2);}else geo=new THREE.BoxGeometry(cm(room.w), .055, cm(room.d));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cm(room.x + room.w / 2), .018, cm(room.y + room.d / 2)); mesh.receiveShadow = true; mesh.userData.ownsFloorMaterial = true; mesh.userData.entityId=room.id;parent.add(mesh);
    if(room.polygon)return;
    // Skirting / baseboard around the room perimeter — a small but strong
    // interior-realism cue that grounds the walls to the floor.
    const skb = new THREE.MeshStandardMaterial({ color: new THREE.Color('#dcd6ca'), roughness: .65, metalness: 0 });
    const sw = cm(room.w), sd = cm(room.d), cx = cm(room.x + room.w / 2), cz = cm(room.y + room.d / 2), sh = .085, st = .022;
    const strip = (bw, bd, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, sh, bd), skb); m.position.set(x, sh / 2 + .04, z); m.castShadow = false; m.receiveShadow = true; parent.add(m); };
    strip(sw, st, cx, cz - sd / 2 + st / 2); strip(sw, st, cx, cz + sd / 2 - st / 2);
    strip(st, sd, cx - sw / 2 + st / 2, cz); strip(st, sd, cx + sw / 2 - st / 2, cz);
  }

  function clearDesign() {
    while (design.children.length) {
      const child = design.children.pop();
      child.traverse(node => {
        if (node.geometry) node.geometry.dispose();
        if (node.userData?.ownsFloorMaterial && node.material) {
          if (node.material.map) node.material.map.dispose();
          node.material.dispose();
        }
      });
    }
  }
  function disposeNode(child) {
    child.parent?.remove(child);
    const shared=new Set(materialCache.values()),disposed=new Set();
    child.traverse(node=>{
      node.geometry?.dispose();
      for(const material of Array.isArray(node.material)?node.material:[node.material]){
        if(!material||shared.has(material)||disposed.has(material))continue;
        disposed.add(material);
        if(node.userData?.ownsFloorMaterial)material.map?.dispose();
        material.dispose();
      }
    });
  }

  function buildColumn3D(col) {
    const group = new THREE.Group();
    const w = cm(col.w || 23);
    const d = cm(col.d || 30);
    const h = cm(col.height || 280);
    const cx = cm(col.x + (col.w || 23) / 2);
    const cz = cm(col.y + (col.d || 30) / 2);
    const mat = pbr({ material: 'concrete', color: col.color || '#9ea29e' });
    if(col.shape==='circle'){const mesh=cylinder(group,w/2,w/2,h,24,cx,h/2,cz,mat);mesh.scale.z=d/w;}else box(group, w, h, d, cx, h / 2, cz, mat);
    const trimMat = pbr({ material: 'concrete', color: '#8d928e' });
    box(group, w + 0.03, 0.06, d + 0.03, cx, 0.03, cz, trimMat);
    if(col.rotation){group.children.forEach(node=>{node.position.x-=cx;node.position.z-=cz;});group.position.set(cx,0,cz);group.rotation.y=-col.rotation*Math.PI/180;}
    group.userData.entityId = col.id;
    return group;
  }

  function buildBeam3D(beam) {
    const group = new THREE.Group();
    const dx = beam.x2 - beam.x1;
    const dy = beam.y2 - beam.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    const angle = Math.atan2(dy, dx);
    const bw = cm(beam.width || 23);
    const bd = cm(beam.depth || 35);
    const ceilH = cm(beam.ceilingHeight || 280);
    const midX = cm((beam.x1 + beam.x2) / 2);
    const midZ = cm((beam.y1 + beam.y2) / 2);
    const midY = ceilH - bd / 2;
    const mat = pbr({ material: 'concrete', color: beam.color || '#a4a9a5' });
    const geo = new THREE.BoxGeometry(cm(len), bd, bw);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(midX, midY, midZ);
    mesh.rotation.y = -angle;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    group.userData.entityId = beam.id;
    return group;
  }

  function addSelection(floorData) {
    const id = window.atelierBridge && window.atelierBridge.selected;
    const target=id?entityNode(id):null;
    if(target===selectionTarget&&selectionHelper){selectionHelper.update();return;}
    if(selectionHelper)disposeNode(selectionHelper);
    selectionHelper=null;selectionTarget=target;
    if (!target) return;
    const helper = new THREE.BoxHelper(target, 0x29a978); helper.material.depthTest = false; helper.material.transparent = true; helper.material.opacity = .9; helper.renderOrder = 999; design.add(helper);selectionHelper=helper;
  }

  let sceneContext='',objectDrag=null;
  function rebuild() {
    rebuildQueued = false;
    // Scaling previews the existing mesh; rebuild its geometry only at commit.
    if(objectDrag?.mode==='scale')return;
    const bridge = window.atelierBridge;
    if (!bridge) return;
    const projectData = bridge.project, floorData = bridge.floor();
    renderStats.updates++;
    const seen=new Set();let geometryChanged=false;
    function upsert(key,data,make,elevation,transformOnly=false){
      seen.add(key);
      const signature=sceneSignature(transformOnly?Object.fromEntries(Object.entries(data).filter(([k])=>!['x','y','rotation','elevation'].includes(k))):data);
      let record=sceneRecords.get(key);
      if(!record||record.signature!==signature){
        if(record)disposeNode(record.group);
        const group=new THREE.Group();make(group);group.position.y=cm(elevation);
        design.add(group);record={group,signature};sceneRecords.set(key,record);geometryChanged=true;renderStats.geometryBuilds++;
      }
      record.group.position.y=cm(elevation);
      if(transformOnly){const node=record.group.children[0];if(node){const x=cm(data.x+data.w/2),z=cm(data.y+data.d/2),y=cm(data.elevation||0),rotation=-(data.rotation||0)*Math.PI/180;if(node.position.x!==x||node.position.y!==y||node.position.z!==z||node.rotation.y!==rotation||node.scale.x!==1){renderStats.transformUpdates++;geometryChanged=true;}node.position.set(x,y,z);node.rotation.y=rotation;node.scale.set(1,1,1);}}
    }
    const structureOnly=!!window.Atelier.state.structureOnly3D;
    const floors=projectData.camera.allFloors?projectData.floors:[floorData];
    floors.forEach(f=>{
      const prefix=f.id+':',elevation=f.elevation||0;
      const connections=window.Atelier.stairConnections?.(f,projectData)||[],stairOpenings=connections.map(c=>c.opening);
      if(!structureOnly){
      f.rooms.forEach(room=>{const data={...room,stairOpenings};upsert(prefix+'room:'+room.id,data,g=>roomFloor(g,data),elevation);});
      for(const c of connections.filter(()=>!projectData.camera.allFloors))upsert(prefix+'stair-arrival:'+c.o.id,{platform:c.platform,mismatch:c.mismatch},g=>{const shape=new THREE.Shape();c.platform.forEach((p,i)=>i?shape.lineTo(cm(p.x),-cm(p.y)):shape.moveTo(cm(p.x),-cm(p.y)));shape.closePath();const geo=new THREE.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,pbr({material:'Concrete',color:c.mismatch?'#bd5544':'#b8cfde'}));mesh.position.y=-.08;mesh.receiveShadow=true;g.add(mesh);},elevation);
      upsert(prefix+'walls',{walls:f.walls,openings:f.items.filter(o=>['door','window'].includes(o.shape)),mode:projectData.camera.wallMode},g=>buildWalls(g,f,projectData.camera.wallMode||'cutaway'),elevation);
      if(!projectData.framingMode)f.items.forEach(item=>{
        const hiddenRoof=(item.shape||item.type)==='roof'&&projectData.camera.roofMode==='hidden';
        const skipStairEntrance=item.shape==='three-side-stairs'&&connections.some(c=>Math.abs(c.o.x-item.x)<.1&&Math.abs(c.o.y-item.y)<.1&&Math.abs(c.o.w-item.w)<.1&&Math.abs(c.o.d-item.d)<.1);upsert(prefix+'item:'+item.id,{...item,hiddenRoof,skipStairEntrance},g=>g.add(hiddenRoof?roofShadowOccluder(item):buildObject({...item,skipStairEntrance})),elevation,true);
      });
      }
      if(structureOnly||projectData.showStructure!==false){
        (f.structuralWalls||[]).forEach(wall=>upsert(prefix+'rc-wall:'+wall.id,{...wall,displayMode:structureOnly?'full':projectData.camera.wallMode},g=>buildWalls(g,{...f,walls:[wall],items:[]},structureOnly?'full':projectData.camera.wallMode||'cutaway'),elevation));
        (f.slabs||[]).forEach(slab=>upsert(prefix+'structural-slab:'+slab.id,slab,g=>{
          const material=pbr({material:'Concrete',color:'#a4b5bb'});
          // Shared slab/beam top faces otherwise flicker when floors are stacked.
          material.polygonOffset=true;material.polygonOffsetFactor=2;material.polygonOffsetUnits=2;const shape=new THREE.Shape();window.Atelier.structuralPolygon(slab).forEach((q,i)=>i?shape.lineTo(cm(q.x),-cm(q.y)):shape.moveTo(cm(q.x),-cm(q.y)));shape.closePath();const geometry=new THREE.ExtrudeGeometry(shape,{depth:cm(slab.thickness||15),bevelEnabled:false});geometry.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geometry,material);mesh.position.y=cm(window.Atelier.structuralBasis(projectData).storeyHeight-(slab.thickness||15));mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.entityId=slab.id;g.add(mesh);
        },elevation));
        (f.columns||[]).forEach(col=>upsert(prefix+'column:'+col.id,col,g=>g.add(buildColumn3D(col)),elevation));
        (f.beams||[]).forEach(beam=>upsert(prefix+'beam:'+beam.id,beam,g=>{const node=buildBeam3D(beam);if(node)g.add(node);},elevation));
      }
    });
    for(const [key,record] of sceneRecords)if(!seen.has(key)){disposeNode(record.group);sceneRecords.delete(key);geometryChanged=true;}
    addSelection(floorData);
    const bounds = bridge.planBounds();
    const cx = cm((bounds.minX + bounds.maxX) / 2), cz = cm((bounds.minY + bounds.maxY) / 2);
    const nextContext=JSON.stringify([projectData.projectId,projectData.camera.allFloors,floors.map(f=>[f.id,f.elevation])]);
    if(geometryChanged&&!objectDrag&&nextContext!==sceneContext){
      const sceneBounds=new THREE.Box3().setFromObject(design);
      if(projectData.camera.allFloors&&!sceneBounds.isEmpty())sceneBounds.getCenter(controls.target);
      else controls.target.set(cx, cm(floorData.elevation||0)+.72, cz);
    }
    sceneContext=nextContext;
    sun.target.position.set(cx, 0, cz); scene.add(sun.target);
    updateSun(projectData.sun);
    updateMirrorReflections();
    if(geometryChanged)renderer.shadowMap.needsUpdate = true;
    wakeRenderLoop(3);
    if (loading) loading.classList.add('ready');
  }

  function requestRebuild() {
    if (rebuildQueued) return;
    rebuildQueued = true;
    requestAnimationFrame(() => {
      rebuild();
      wakeRenderLoop(3);
    });
  }

  function updateOrbitFog() {
    if(!scene.fog)return;
    // Keep the building visible when a narrow viewport fits a distant stack.
    // Fog still softens the background beyond the orbit target.
    scene.fog.near=Math.max(28,camera.position.distanceTo(controls.target)*1.3);
    scene.fog.far=Math.max(70,scene.fog.near+42);
  }
  function setCamera(state) {
    if (!state) return;
    const theta = (Number.isFinite(Number(state.yaw))?Number(state.yaw):-38) * Math.PI / 180;
    const phi = (90 - Math.max(12, Math.min(80, Number(state.pitch) || 34))) * Math.PI / 180;
    const zoom = Math.max(.000001, Number(state.zoom) || .56);
    const distance = 11 / zoom;
    controls.maxDistance=Math.max(70,distance*1.2);
    camera.position.set(
      controls.target.x + Math.sin(phi) * Math.sin(theta) * distance,
      controls.target.y + Math.cos(phi) * distance,
      controls.target.z + Math.sin(phi) * Math.cos(theta) * distance
    );
    controls.update();
    updateOrbitFog();
    wakeRenderLoop(3);
  }

  function fitCamera(state) {
    if(walk.active)setWalk(false);
    resize();
    rebuild();
    const box=new THREE.Box3().setFromObject(design);
    if(box.isEmpty())return state.zoom;
    const radius=box.getSize(new THREE.Vector3()).length()/2;
    const vertical=camera.fov*Math.PI/360;
    const horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
    const distance=Math.max(.1,radius*1.12/Math.sin(Math.min(vertical,horizontal)));
    const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
    box.getCenter(controls.target);
    state.zoom=Math.min(.9,11/distance);
    camera.far=Math.max(180,distance+radius*3);camera.updateProjectionMatrix();
    setCamera(state);
    controls.enableDamping=damping;
    return state.zoom;
  }

  function setPreset(name) {
    const presets = { dollhouse: { yaw: -38, pitch: 34, zoom: .56 }, top: { yaw: 0, pitch: 78, zoom: .56 }, front: { yaw: -2, pitch: 22, zoom: .56 } };
    setCamera(presets[name] || presets.dollhouse);
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const previousAspect=camera.aspect;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    if(visible&&!walk.active&&previousAspect>0&&Math.abs(previousAspect-camera.aspect)>.01){
      const factor=previousAspect/camera.aspect;
      const delta=camera.position.clone().sub(controls.target);
      delta.setLength(Math.max(controls.minDistance,Math.min(controls.maxDistance,delta.length()*factor)));
      camera.position.copy(controls.target).add(delta);
      const project=window.atelierBridge?.project;if(project){project.camera.zoom=Math.max(.000001,Math.min(1.4,11/delta.length()));window.atelierBridge.updateCameraUI?.();}
    }
    updateOrbitFog();
    wakeRenderLoop(2);
  }

  function setVisible(next) {
    visible = !!next;
    stage.style.display = visible ? 'block' : 'none';
    if (visible) {
      resize();
      rebuild();
      setCamera(window.atelierBridge && window.atelierBridge.project.camera);
      renderer.shadowMap.needsUpdate = true;
      wakeRenderLoop(5);
    } else {
      if(objectDrag){window.atelierBridge?.cancelEdit?.();objectDrag=null;}
      moveMode=false;transformMode='move';clearManipulationHelper();if(window.Atelier){window.Atelier.state.move3DMode=false;window.Atelier.state.transform3DMode='orbit';}controls.enabled=!walk.active;
      isLoopRunning = false;
    }
  }

  let isInteracting = false;

  controls.addEventListener('start', () => {
    isInteracting = true;
    wakeRenderLoop();
  });
  controls.addEventListener('change', () => {
    if (!visible || !window.atelierBridge) return;
    const delta = camera.position.clone().sub(controls.target);
    const radius = Math.max(.001, delta.length());
    updateOrbitFog();
    const pitch = 90 - Math.acos(Math.max(-1, Math.min(1, delta.y / radius))) * 180 / Math.PI;
    const yaw = Math.atan2(delta.x, delta.z) * 180 / Math.PI;
    const state = window.atelierBridge.project.camera;
    state.yaw = yaw; state.pitch = pitch; state.zoom = Math.max(.000001, Math.min(1.4, 11 / radius));
    window.atelierBridge.updateCameraUI();
  });
  controls.addEventListener('end', () => {
    isInteracting = false;
    wakeRenderLoop(15);
    window.atelierBridge?.queueSave();
  });

  // ── 3D Shift-to-Move Object Interaction & Pointer Controls ─────────
  let shiftPressed = false;
  let moveMode=false;
  let transformMode='move',manipulationHelper=null;
  const transformHint=stage.querySelector('.render-badge');transformHint.id='threeTransformHint';
  if(window.Atelier?.readOnly)transformHint.textContent='Drag to orbit · Scroll or pinch to zoom';
  function clearManipulationHelper(){if(manipulationHelper){disposeNode(manipulationHelper);manipulationHelper=null;}transformHint.textContent=window.Atelier?.readOnly?'Drag to orbit · Scroll or pinch to zoom':'Drag to orbit · Shift-drag an object to move';transformHint.style.display='block';}
  function refreshManipulationHelper(entity){
    clearManipulationHelper();if(!moveMode)return;entity||=window.atelierBridge?.findEntity(window.atelierBridge.selected);
    transformHint.style.display='block';transformHint.textContent=transformMode==='rotate'?'Rotate · drag horizontally · Shift snaps to 15°':transformMode==='scale'?'Uniform scale · drag right to enlarge, left to shrink':'Move · drag an object on its floor';
    if(!entity||!['rotate','scale'].includes(transformMode)||entity.hostWallId||!window.atelierBridge?.floor().items.includes(entity))return;
    const helper=new THREE.Group(),radius=cm(Math.max(entity.w,entity.d))/2+.2,points=[];
    helper.position.set(cm(entity.x+entity.w/2),cm((entity.elevation||0)+(window.atelierBridge.floor().elevation||0))+.03,cm(entity.y+entity.d/2));
    if(transformMode==='rotate'){for(let i=0;i<64;i++){const angle=i*Math.PI/32;points.push(new THREE.Vector3(Math.cos(angle)*radius,.1,Math.sin(angle)*radius));}helper.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0x238fca,depthTest:false})));}
    else{points.push(new THREE.Vector3(-radius,0,0),new THREE.Vector3(radius,0,0),new THREE.Vector3(0,0,-radius),new THREE.Vector3(0,0,radius),new THREE.Vector3(0,0,0),new THREE.Vector3(0,cm(entity.height||80),0));helper.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:0xc07827,depthTest:false})));}
    manipulationHelper=helper;scene.add(helper);wakeRenderLoop();
  }
  function setManipulationMode(mode){if(objectDrag){window.atelierBridge?.cancelEdit?.();objectDrag=null;requestRebuild();}moveMode=['move','rotate','scale'].includes(mode);transformMode=moveMode?mode:'move';if(window.Atelier){window.Atelier.state.move3DMode=moveMode;window.Atelier.state.transform3DMode=moveMode?mode:'orbit';}controls.enabled=!moveMode&&!walk.active;renderer.domElement.style.cursor=moveMode?'grab':'default';refreshManipulationHelper();}
  function setMoveMode(on){setManipulationMode(on?'move':'orbit');}
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let clickOrigin = null;

  function updatePointer(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  function getRaycastEntity() {
    const hit = raycaster.intersectObjects(design.children, true).find(result => {
      let node = result.object; while (node && !node.userData?.entityId) node = node.parent; result.entityNode = node; return !!node;
    });
    if (!hit?.entityNode) return null;
    const entityId = hit.entityNode.userData.entityId;
    const entity = window.atelierBridge?.findEntity ? window.atelierBridge.findEntity(entityId) : (window.atelierBridge?.floor?.()?.items || []).find(item => item.id === entityId);
    return entity ? { entity, groupNode: hit.entityNode } : null;
  }

  function updateHoverCursor(e) {
    if (walk.active || !visible) return;
    if (objectDrag) {
      renderer.domElement.style.cursor = 'grabbing';
      return;
    }
    if ((shiftPressed||moveMode) && e) {
      updatePointer(e);
      const hit = getRaycastEntity();
      const hasSelected = !!(window.atelierBridge?.selected && (window.atelierBridge?.findEntity ? window.atelierBridge.findEntity(window.atelierBridge.selected) : null));
      renderer.domElement.style.cursor = (hit || hasSelected) ? 'grab' : 'default';
      return;
    }
    renderer.domElement.style.cursor = 'default';
  }

  renderer.domElement.addEventListener('pointerdown', e => {
    if(objectDrag){
      if(e.pointerId!==objectDrag.pointerId){window.atelierBridge?.cancelEdit?.();objectDrag=null;clickOrigin=null;controls.enabled=!walk.active&&!moveMode;requestRebuild();refreshManipulationHelper();}
      return;
    }
    clickOrigin = { x: e.clientX, y: e.clientY };

    if (walk.active) {
      walk.dragging = true;
      walk.lastX = e.clientX;
      walk.lastY = e.clientY;
      wakeRenderLoop();
      return;
    }

    // Shift + Left-click: Initiate 3D Object Move
    if ((moveMode || e.shiftKey || shiftPressed) && e.button === 0 && !window.atelierBridge?.project.camera.allFloors) {
      updatePointer(e);
      let hit = getRaycastEntity();
      let targetEntity = hit?.entity;
      let targetGroup = hit?.groupNode;

      // If clicked on empty space while an item is selected, move the selected item
      if (!targetEntity && window.atelierBridge?.selected) {
        targetEntity = window.atelierBridge.findEntity ? window.atelierBridge.findEntity(window.atelierBridge.selected) : (window.atelierBridge?.floor?.()?.items || []).find(i => i.id === window.atelierBridge.selected);
        if (targetEntity) {
          targetGroup = entityNode(targetEntity.id);
        }
      }

      if (targetEntity && targetGroup && window.atelierBridge?.canTransform(targetEntity) && ['x','y','w','d'].every(key=>Number.isFinite(targetEntity[key]))) {
        const mode=moveMode?transformMode:'move';
        if(mode!=='move'&&(!window.atelierBridge.floor().items.includes(targetEntity)||targetEntity.hostWallId||window.Atelier.isServiceRoute?.(targetEntity))){window.atelierBridge.showToast('Use this transform on an unattached object; edit this element in Properties');return;}
        const bridge = window.atelierBridge;
        if (bridge?.selected !== targetEntity.id) {
          bridge?.select(targetEntity.id);
          requestRebuild();
        }

        window.Atelier.armEdit();

        const elev = cm((targetEntity.elevation || 0)+(bridge.floor().elevation||0));
        const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -elev);
        const startPlaneHit = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, startPlaneHit);

        objectDrag = {
          entity: targetEntity,
          groupNode: targetGroup,
          dragPlane,
          startPlaneHit,
          origX: targetEntity.x,
          origY: targetEntity.y,
          original:JSON.parse(JSON.stringify(targetEntity)),mode,
          pointerId:e.pointerId,startClient:{x:e.clientX,y:e.clientY},
          hasMoved: false
        };
        refreshManipulationHelper(targetEntity);

        controls.enabled = false;
        isInteracting = false;
        renderer.domElement.style.cursor = 'grabbing';
        e.stopPropagation();
        wakeRenderLoop();
        return;
      }
    }

    isInteracting = true;
    wakeRenderLoop();
  });

  window.addEventListener('pointermove', e => {
    if (!visible) return;

    if (objectDrag) {
      if(e.pointerId!==objectDrag.pointerId)return;
      if(!objectDrag.hasMoved&&Math.hypot(e.clientX-objectDrag.startClient.x,e.clientY-objectDrag.startClient.y)<(e.pointerType==='touch'?6:3))return;
      window.atelierBridge?.beginEdit?.();
      if(objectDrag.mode!=='move'){
        const {entity,original,groupNode,mode}=objectDrag,dx=e.clientX-objectDrag.startClient.x;
        if(mode==='rotate'){let angle=(original.rotation||0)+dx*.5;if(e.shiftKey)angle=Math.round(angle/15)*15;entity.rotation=dx===0?original.rotation:((Math.round(angle*10)/10)%360+360)%360;groupNode.rotation.y=-(entity.rotation||0)*Math.PI/180;transformHint.textContent='Rotate · '+(entity.rotation||0)+'°';}
        else{const factor=Math.max(.1,Math.min(5,Math.exp(dx/200))),cx=original.x+original.w/2,cy=original.y+original.d/2;entity.w=original.w*factor;entity.d=original.d*factor;entity.height=(original.height||80)*factor;entity.x=dx===0?original.x:cx-entity.w/2;entity.y=dx===0?original.y:cy-entity.d/2;if(dx===0){if(original.height===undefined)delete entity.height;else entity.height=original.height;}groupNode.scale.setScalar(factor);manipulationHelper?.scale.setScalar(factor);transformHint.textContent='Uniform scale · '+Math.round(factor*100)+'%';}
        objectDrag.hasMoved=true;selectionHelper?.update();renderer.shadowMap.needsUpdate=true;wakeRenderLoop();return;
      }
      updatePointer(e);
      const currentPlaneHit = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(objectDrag.dragPlane, currentPlaneHit)) {
        const deltaWorldX = currentPlaneHit.x - objectDrag.startPlaneHit.x;
        const deltaWorldZ = currentPlaneHit.z - objectDrag.startPlaneHit.z;
        const dx = deltaWorldX * 100;
        const dy = deltaWorldZ * 100;

        const snapFn = e.altKey?(v=>v):(window.atelierBridge?.snap || (v => v));
        const newX = snapFn(objectDrag.origX + dx);
        const newY = snapFn(objectDrag.origY + dy);

        if (newX !== objectDrag.entity.x || newY !== objectDrag.entity.y) {
          objectDrag.entity.x = newX;
          objectDrag.entity.y = newY;
          objectDrag.hasMoved = true;

          // Move the 3D group directly
          objectDrag.groupNode.position.x = cm(newX + objectDrag.entity.w / 2);
          objectDrag.groupNode.position.z = cm(newY + objectDrag.entity.d / 2);

          // Update selection helper
          const boxHelper = design.children.find(c => c.isBoxHelper);
          if (boxHelper) boxHelper.update();

          // Sync smart guides, 2D canvas & inspector
          window.atelierBridge?.applySmartGuides?.([objectDrag.entity]);
          window.Atelier.requestDraw();

          wakeRenderLoop();
        }
      }
      return;
    }

    if (walk.active && walk.dragging) {
      walk.yaw -= (e.clientX - walk.lastX) * .005;
      walk.pitch = Math.max(-1.2, Math.min(1.2, walk.pitch - (e.clientY - walk.lastY) * .005));
      walk.lastX = e.clientX;
      walk.lastY = e.clientY;
      applyWalkLook();
      wakeRenderLoop();
      return;
    }

    if (shiftPressed) {
      updateHoverCursor(e);
    }
  });

  window.addEventListener('pointerup', e => {
    if (objectDrag) {
      if(e.pointerId!==objectDrag.pointerId)return;
      if (window.atelierBridge?.commitEdit?.()) {
        renderer.shadowMap.needsUpdate = true;
        requestRebuild();
        window.atelierBridge?.queueSave?.();
        window.atelierBridge?.showToast?.(`${objectDrag.mode==='rotate'?'Rotated':objectDrag.mode==='scale'?'Scaled':'Moved'} ${objectDrag.entity.name || objectDrag.entity.type || 'object'}`);
      }
      window.atelierBridge?.renderInspector?.();
      controls.enabled = !walk.active&&!moveMode;
      objectDrag = null;
      requestRebuild();
      refreshManipulationHelper();
      updateHoverCursor(e);
      wakeRenderLoop(5);
      return;
    }

    if (walk.dragging) {
      walk.dragging = false;
      wakeRenderLoop(5);
    }

    if (isInteracting) {
      isInteracting = false;
      wakeRenderLoop(15);
    }
  });

  renderer.domElement.addEventListener('pointerup', event => {
    if (walk.active || objectDrag) return;
    if (!clickOrigin || Math.hypot(event.clientX - clickOrigin.x, event.clientY - clickOrigin.y) > 5) return;
    updatePointer(event);
    const hit = raycaster.intersectObjects(design.children, true).find(result => {
      let node = result.object; while (node && !node.userData?.entityId) node = node.parent; result.entityNode = node; return !!node;
    });
    window.atelierBridge?.select(hit?.entityNode?.userData?.entityId || null);
    requestRebuild();
  });

  window.addEventListener('pointercancel', e => {
    if (objectDrag) {
      if(e.pointerId!==objectDrag.pointerId)return;
      window.atelierBridge?.cancelEdit?.();requestRebuild();
      controls.enabled = !walk.active&&!moveMode;
      objectDrag = null;
      refreshManipulationHelper();
    }
    if (walk.dragging) walk.dragging = false;
    if (isInteracting) {
      isInteracting = false;
      wakeRenderLoop(15);
    }
  });
  window.addEventListener('blur',()=>{shiftPressed=false;if(objectDrag){window.atelierBridge?.cancelEdit?.();objectDrag=null;requestRebuild();refreshManipulationHelper();}walk.dragging=false;walk.keys={};controls.enabled=!walk.active&&!moveMode;});

  renderer.domElement.addEventListener('wheel', () => {
    wakeRenderLoop(25);
  }, { passive: true });

  // ── First-person walk-through camera ────────────────────────────────
  const walk = { active: false, yaw: Math.PI, pitch: 0, keys: {}, dragging: false, lastX: 0, lastY: 0, speed: 2.8, eye: 1.62 };
  const clock = new THREE.Clock();
  function applyWalkLook() {
    const dir = new THREE.Vector3(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch));
    camera.lookAt(camera.position.clone().add(dir));
  }
  function isWalkMoving() {
    return !!(walk.keys.KeyW || walk.keys.KeyS || walk.keys.KeyA || walk.keys.KeyD ||
              walk.keys.ArrowUp || walk.keys.ArrowDown || walk.keys.ArrowLeft || walk.keys.ArrowRight);
  }
  function setWalk(on) {
    walk.active = !!on; controls.enabled = !walk.active; walk.keys = {};
    if (walk.active) {
      camera.fov = 58; camera.updateProjectionMatrix();
      const t = controls.target;
      camera.position.set(t.x, cm(window.atelierBridge.floor().elevation||0)+walk.eye, t.z + 2.5); walk.yaw = Math.PI; walk.pitch = -.05; applyWalkLook();
      renderer.domElement.style.cursor = 'crosshair';
    } else {
      camera.fov = 39; camera.updateProjectionMatrix(); renderer.domElement.style.cursor = 'default';
      setCamera(window.atelierBridge && window.atelierBridge.project.camera);
    }
    wakeRenderLoop(3);
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') {
      shiftPressed = true;
      if (!walk.active && visible) {
        updateHoverCursor();
      }
    }
    if (e.key === 'Escape' && objectDrag) {
      window.atelierBridge?.cancelEdit?.();
      controls.enabled = !walk.active&&!moveMode;
      objectDrag = null;
      requestRebuild();
      refreshManipulationHelper();
      window.atelierBridge?.draw?.();
      window.atelierBridge?.renderInspector?.();
      renderer.domElement.style.cursor = 'default';
      wakeRenderLoop(3);
      return;
    }
    if (!walk.active || !visible) return;
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    walk.keys[e.code] = true;
    if (e.code.startsWith('Arrow')) e.preventDefault();
    wakeRenderLoop();
  });

  window.addEventListener('keyup', e => {
    if (e.key === 'Shift') {
      shiftPressed = false;
      if (!objectDrag && !walk.active && visible) {
        renderer.domElement.style.cursor = 'default';
      }
    }
    if (!walk.active || !visible) return;
    walk.keys[e.code] = false;
    wakeRenderLoop(10);
  });

  new ResizeObserver(resize).observe(stage);

  // ── Render on demand / single-loop scheduler ───────────────────────
  let isLoopRunning = false;
  let remainingSettleFrames = 0;

  function wakeRenderLoop(frames = 0) {
    if (frames > remainingSettleFrames) {
      remainingSettleFrames = frames;
    }
    if (!isLoopRunning && visible && !document.hidden) {
      isLoopRunning = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    if (!visible || document.hidden) {
      isLoopRunning = false;
      return;
    }

    let keepRunning = false;

    if (walk.active) {
      if (isWalkMoving() || walk.dragging) {
        if (isWalkMoving()) {
          const dt = Math.min(.05, clock.getDelta());
          const spd = walk.speed * ((walk.keys.ShiftLeft || walk.keys.ShiftRight) ? 2.1 : 1) * dt;
          const fwd = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw));
          const right = new THREE.Vector3(-fwd.z, 0, fwd.x); // forward × up (fixes reversed A/D)
          if (walk.keys.KeyW || walk.keys.ArrowUp) camera.position.addScaledVector(fwd, spd);
          if (walk.keys.KeyS || walk.keys.ArrowDown) camera.position.addScaledVector(fwd, -spd);
          if (walk.keys.KeyA || walk.keys.ArrowLeft) camera.position.addScaledVector(right, -spd);
          if (walk.keys.KeyD || walk.keys.ArrowRight) camera.position.addScaledVector(right, spd);
          camera.position.y = cm(window.atelierBridge.floor().elevation||0)+walk.eye;
          applyWalkLook();
        } else {
          clock.getDelta();
        }
        keepRunning = true;
      }
    } else {
      const dampingActive = controls.update();
      if (isInteracting || dampingActive) {
        keepRunning = true;
      }
    }

    renderer.render(scene, camera);

    if (remainingSettleFrames > 0) {
      remainingSettleFrames--;
      keepRunning = true;
    }

    if (keepRunning) {
      requestAnimationFrame(tick);
    } else {
      isLoopRunning = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible) {
      wakeRenderLoop(3);
    }
  });

  window.atelier3D = { setVisible, setMoveMode, setManipulationMode, requestRebuild, rebuild, setCamera, fitCamera, setPreset, updateSun, resize, setWalk, isWalking: () => walk.active, requestRender: wakeRenderLoop, getStats:()=>({...renderStats,groups:sceneRecords.size,geometries:renderer.info.memory.geometries,cameraDistance:camera.position.distanceTo(controls.target),cameraTarget:controls.target.toArray()}) };
  window.dispatchEvent(new CustomEvent('atelier:renderer-ready'));
})();
