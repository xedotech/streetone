import * as THREE from "three";

export type HudState = {
  hp: number;
  ammo: number;
  inCar: boolean;
  speedKph: number;
  enemiesLeft: number;
  enemiesTotal: number;
  wanted: boolean;
  outcome: "play" | "win" | "lose";
  prompt: string;
  hitmarker: boolean;
};

export type StreetOneHandle = {
  dispose: () => void;
  start: () => void;
  restart: () => void;
  setTouch: (partial: Partial<TouchState>) => void;
};

type TouchState = {
  moveX: number;
  moveY: number;
  fire: boolean;
  enter: boolean;
  lookX: number;
  lookY: number;
};

type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

type Enemy = {
  mesh: THREE.Group;
  body: THREE.Mesh;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  alive: boolean;
  cooldown: number;
  patrolDir: number;
  sidewalk: number;
};

const DT = 1 / 60;
const MAX_STEPS = 4;
const STREET_HALF = 7;
const MAP_Z = 108;
const PLAYER_HP = 100;
const MAG = 36;
const ENEMY_HP = 70;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function wrapPi(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function mountStreetOne(
  canvas: HTMLCanvasElement,
  opts: {
    onHud: (h: HudState) => void;
    autoStart?: boolean;
  },
): StreetOneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x0a0b10, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0b10, 28, 120);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 220);
  const clock = { last: performance.now(), acc: 0 };

  const colliders: Aabb[] = [];
  const keys = new Set<string>();
  let injectKeys: string[] | null = null;
  let injectSteer: number | null = null;
  let started = Boolean(opts.autoStart);
  let disposed = false;
  let raf = 0;
  let pointerLocked = false;

  const touch: TouchState = {
    moveX: 0,
    moveY: 0,
    fire: false,
    enter: false,
    lookX: 0,
    lookY: 0,
  };

  const player = {
    x: 0,
    y: 0.9,
    z: 72,
    yaw: 0,
    pitch: 0.18,
    hp: PLAYER_HP,
    ammo: MAG,
    inCar: true,
    shootCd: 0,
    hurt: 0,
    hitmarker: 0,
    enterCd: 0,
    shake: 0,
  };
  const car = {
    x: 0,
    z: 72,
    yaw: 0,
    speed: 0,
    lateral: 0,
  };
  const cam = { yaw: 0, dist: 7.2, height: 2.6 };

  const enemies: Enemy[] = [];
  let outcome: HudState["outcome"] = "play";
  let hudDirty = true;

  const vForward = new THREE.Vector3();
  const vRight = new THREE.Vector3();
  const vTmp = new THREE.Vector3();
  const vTmp2 = new THREE.Vector3();

  scene.add(new THREE.HemisphereLight(0x6a7a99, 0x1a120c, 0.55));
  const moon = new THREE.DirectionalLight(0xc8d4ee, 0.45);
  moon.position.set(-20, 40, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.near = 4;
  moon.shadow.camera.far = 90;
  moon.shadow.camera.left = -40;
  moon.shadow.camera.right = 40;
  moon.shadow.camera.top = 40;
  moon.shadow.camera.bottom = -40;
  scene.add(moon);

  const asphalt = new THREE.MeshLambertMaterial({ color: 0x1a1b20 });
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x141518 });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x2a2926 });
  const curbMat = new THREE.MeshLambertMaterial({ color: 0x3a3936 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xc9b27a });
  const brick = [
    new THREE.MeshLambertMaterial({ color: 0x2c2622 }),
    new THREE.MeshLambertMaterial({ color: 0x24282c }),
    new THREE.MeshLambertMaterial({ color: 0x322820 }),
    new THREE.MeshLambertMaterial({ color: 0x1e2226 }),
  ];
  const windowOn = new THREE.MeshBasicMaterial({ color: 0xe8c37a });
  const windowOff = new THREE.MeshBasicMaterial({ color: 0x0c0d10 });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x2a2c30,
    metalness: 0.55,
    roughness: 0.45,
  });
  const carPaint = new THREE.MeshStandardMaterial({
    color: 0xb43a2c,
    metalness: 0.35,
    roughness: 0.4,
  });
  const carDark = new THREE.MeshStandardMaterial({
    color: 0x121214,
    metalness: 0.6,
    roughness: 0.35,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x8aa0b8,
    metalness: 0.2,
    roughness: 0.15,
    transparent: true,
    opacity: 0.55,
  });

  function box(
    mat: THREE.Material,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    shadow = true,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    scene.add(mesh);
    return mesh;
  }

  box(asphalt, 56, 0.08, MAP_Z * 2 + 20, 0, 0, 0, false).receiveShadow = true;
  box(roadMat, STREET_HALF * 2, 0.1, MAP_Z * 2 + 8, 0, 0.02, 0, false);
  box(walkMat, 5.4, 0.18, MAP_Z * 2, -(STREET_HALF + 3.4), 0.1, 0);
  box(walkMat, 5.4, 0.18, MAP_Z * 2, STREET_HALF + 3.4, 0.1, 0);
  box(curbMat, 0.28, 0.28, MAP_Z * 2, -STREET_HALF - 0.2, 0.16, 0);
  box(curbMat, 0.28, 0.28, MAP_Z * 2, STREET_HALF + 0.2, 0.16, 0);

  for (let z = -MAP_Z + 4; z < MAP_Z; z += 5.5) {
    box(dashMat, 0.18, 0.04, 2.2, 0, 0.08, z, false);
  }

  function addBuilding(
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    mat: THREE.Material,
  ) {
    box(mat, w, h, d, cx, h / 2, cz);
    colliders.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
    });
    const floors = Math.max(2, Math.floor(h / 4.2));
    const cols = 3;
    const face = cx < 0 ? w / 2 + 0.04 : -(w / 2 + 0.04);
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const on = (f * 7 + c * 3 + Math.abs(cz | 0)) % 5 !== 0;
        const wz = cz - d / 2 + 1.4 + c * ((d - 2.8) / Math.max(1, cols - 1));
        box(
          on ? windowOn : windowOff,
          0.08,
          1.05,
          0.7,
          cx + face,
          1.5 + f * 3.2,
          wz,
          false,
        );
      }
    }
  }

  let zCursor = -MAP_Z + 6;
  let i = 0;
  while (zCursor < MAP_Z - 6) {
    const depth = 10 + (i % 4) * 3.5;
    const height = 9 + ((i * 5) % 16);
    const width = 10 + (i % 3) * 1.4;
    const gap = i % 5 === 0 ? 4.5 : 1.1;
    addBuilding(
      -(STREET_HALF + 8.4),
      zCursor + depth / 2,
      width,
      depth,
      height,
      brick[i % brick.length]!,
    );
    addBuilding(
      STREET_HALF + 8.4,
      zCursor + depth / 2 + 1.4,
      width + 0.6,
      depth - 1,
      height + ((i % 2) * 4 - 1),
      brick[(i + 2) % brick.length]!,
    );
    zCursor += depth + gap;
    i += 1;
  }

  colliders.push(
    { minX: -30, maxX: 30, minZ: -MAP_Z - 4, maxZ: -MAP_Z - 0.4 },
    { minX: -30, maxX: 30, minZ: MAP_Z + 0.4, maxZ: MAP_Z + 4 },
  );

  const lampMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1e });
  const lampGlow = new THREE.MeshBasicMaterial({ color: 0xffd7a0 });
  for (let z = -90; z <= 90; z += 22) {
    for (const side of [-1, 1]) {
      const x = side * (STREET_HALF + 1.15);
      box(lampMat, 0.16, 5.2, 0.16, x, 2.6, z, false);
      box(lampMat, 1.4, 0.08, 0.12, x - side * 0.6, 5.15, z, false);
      const bulb = box(lampGlow, 0.28, 0.16, 0.28, x - side * 1.15, 5.02, z, false);
      const light = new THREE.PointLight(0xffc27a, 2.1, 16, 1.6);
      light.position.copy(bulb.position);
      scene.add(light);
    }
  }

  function makeSedan(paint: THREE.Material, x: number, z: number, yaw: number) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 4.15), paint);
    body.position.y = 0.55;
    body.castShadow = true;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.5, 2.05), carDark);
    cabin.position.set(0, 1.05, -0.15);
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.38, 1.85), glass);
    win.position.set(0, 1.1, -0.15);
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.28, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheels: THREE.Mesh[] = [];
    for (const [wx, wz] of [
      [-0.85, 1.25],
      [0.85, 1.25],
      [-0.85, -1.3],
      [0.85, -1.3],
    ] as const) {
      const w = new THREE.Mesh(wheelGeo, metal);
      w.position.set(wx, 0.32, wz);
      g.add(w);
      wheels.push(w);
    }
    g.add(body, cabin, win);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    scene.add(g);
    return { group: g, wheels };
  }

  const playerCar = makeSedan(carPaint, car.x, car.z, car.yaw);
  const parked = [
    makeSedan(
      new THREE.MeshStandardMaterial({ color: 0x2e3a48, metalness: 0.3, roughness: 0.5 }),
      -5.6,
      28,
      0.02,
    ),
    makeSedan(
      new THREE.MeshStandardMaterial({ color: 0x3c3c32, metalness: 0.3, roughness: 0.5 }),
      5.7,
      -12,
      Math.PI + 0.04,
    ),
    makeSedan(
      new THREE.MeshStandardMaterial({ color: 0x3a2a28, metalness: 0.3, roughness: 0.5 }),
      -5.5,
      -48,
      0.01,
    ),
  ];
  for (const p of parked) {
    colliders.push({
      minX: p.group.position.x - 1.1,
      maxX: p.group.position.x + 1.1,
      minZ: p.group.position.z - 2.2,
      maxZ: p.group.position.z + 2.2,
    });
  }

  const playerGroup = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.85, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0xcfc6b8 }),
  );
  torso.position.y = 0.95;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd7c4a8 }),
  );
  head.position.y = 1.62;
  playerGroup.add(torso, head);
  const gun = new THREE.Group();
  const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), metal);
  const gunGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.18, 0.1), carDark);
  gunGrip.position.set(0, -0.12, 0.08);
  gun.add(gunBody, gunGrip);
  gun.position.set(0.22, 1.15, -0.35);
  playerGroup.add(gun);
  scene.add(playerGroup);

  const muzzle = new THREE.PointLight(0xffeeaa, 0, 6);
  scene.add(muzzle);

  function spawnEnemy(x: number, z: number, sidewalk: number): Enemy {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.3, 0.8, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x2a3038 }),
    );
    body.position.y = 0.9;
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xb9a48c }),
    );
    skull.position.y = 1.52;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.06, 0.08),
      new THREE.MeshBasicMaterial({ color: 0xff4a3a }),
    );
    visor.position.set(0, 1.54, -0.16);
    g.add(body, skull, visor);
    g.position.set(x, 0, z);
    scene.add(g);
    return {
      mesh: g,
      body,
      x,
      z,
      yaw: sidewalk > 0 ? Math.PI : 0,
      hp: ENEMY_HP,
      alive: true,
      cooldown: 0.4 + Math.random(),
      patrolDir: sidewalk,
      sidewalk,
    };
  }

  const starts: Array<[number, number, number]> = [
    [-5.2, 50, -1],
    [5.3, 34, 1],
    [-5.1, 8, -1],
    [5.4, -18, 1],
    [-5.2, -62, -1],
    [5.3, -86, 1],
  ];
  for (const [x, z, s] of starts) enemies.push(spawnEnemy(x, z, s));

  let audio: AudioContext | null = null;
  let engineOsc: OscillatorNode | null = null;
  let engineGain: GainNode | null = null;

  function ensureAudio() {
    if (audio) return audio;
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audio = new Ctx();
    engineOsc = audio.createOscillator();
    engineGain = audio.createGain();
    engineOsc.type = "sawtooth";
    engineOsc.frequency.value = 55;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain).connect(audio.destination);
    engineOsc.start();
    return audio;
  }

  function blip(freq: number, dur: number, type: OscillatorType, vol = 0.08) {
    const ctx = ensureAudio();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g).connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur + 0.02);
  }

  function held(): Set<string> {
    return injectKeys ? new Set(injectKeys) : keys;
  }

  function setHeading(yaw: number) {
    vForward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    vRight.set(Math.cos(yaw), 0, -Math.sin(yaw));
  }

  function collideCircle(x: number, z: number, r: number) {
    for (const c of colliders) {
      const nx = clamp(x, c.minX, c.maxX);
      const nz = clamp(z, c.minZ, c.maxZ);
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (r - d) / d;
        x += dx * push;
        z += dz * push;
      }
    }
    x = clamp(x, -8.6, 8.6);
    z = clamp(z, -MAP_Z + 2, MAP_Z - 2);
    return { x, z };
  }

  function pointAabbRay(ax: number, az: number, bx: number, bz: number, c: Aabb) {
    const dx = bx - ax;
    const dz = bz - az;
    let tmin = 0;
    let tmax = 1;
    const orig = [ax, az];
    const slabs: Array<[number, number, number]> = [
      [c.minX, c.maxX, dx],
      [c.minZ, c.maxZ, dz],
    ];
    for (let s = 0; s < 2; s++) {
      const o = orig[s]!;
      const d = slabs[s]![2];
      const mn = slabs[s]![0];
      const mx = slabs[s]![1];
      if (Math.abs(d) < 1e-8) {
        if (o < mn || o > mx) return false;
      } else {
        let t1 = (mn - o) / d;
        let t2 = (mx - o) / d;
        if (t1 > t2) {
          const tmp = t1;
          t1 = t2;
          t2 = tmp;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return false;
      }
    }
    return tmin > 0.02 && tmin < 0.98;
  }

  function losClear(ax: number, az: number, bx: number, bz: number) {
    for (const c of colliders) {
      if (pointAabbRay(ax, az, bx, bz, c)) return false;
    }
    return true;
  }

  function fireWeapon() {
    if (player.shootCd > 0 || player.ammo <= 0 || player.inCar || outcome !== "play") return;
    player.shootCd = 0.16;
    player.ammo -= 1;
    player.shake = Math.max(player.shake, 0.12);
    setHeading(player.yaw);
    const ox = player.x;
    const oz = player.z;
    muzzle.position.set(ox + vForward.x * 0.6, 1.35, oz + vForward.z * 0.6);
    muzzle.intensity = 7;
    blip(190, 0.07, "square", 0.07);
    let hitEnemy: Enemy | null = null;
    let best = 42;
    for (const e of enemies) {
      if (!e.alive) continue;
      const to = vTmp.set(e.x - ox, 0, e.z - oz);
      const dist = to.length();
      if (dist > best || dist < 0.2) continue;
      to.normalize();
      if (vForward.dot(to) < 0.975) continue;
      if (!losClear(ox, oz, e.x, e.z)) continue;
      best = dist;
      hitEnemy = e;
    }
    if (hitEnemy) {
      hitEnemy.hp -= 38;
      player.hitmarker = 0.18;
      blip(640, 0.05, "triangle", 0.06);
      const mat = hitEnemy.body.material as THREE.MeshLambertMaterial;
      mat.color.setHex(0xaa3330);
      const flashed = hitEnemy;
      window.setTimeout(() => {
        if (flashed.alive) mat.color.setHex(0x2a3038);
      }, 80);
      if (hitEnemy.hp <= 0) {
        hitEnemy.alive = false;
        hitEnemy.mesh.visible = false;
        blip(90, 0.2, "sawtooth", 0.05);
        hudDirty = true;
      }
    }
  }

  function tryEnter() {
    if (player.enterCd > 0 || outcome !== "play") return;
    player.enterCd = 0.35;
    if (player.inCar) {
      player.inCar = false;
      player.x = car.x + Math.cos(car.yaw) * 1.7;
      player.z = car.z - Math.sin(car.yaw) * 1.7;
      player.yaw = car.yaw;
      const p = collideCircle(player.x, player.z, 0.45);
      player.x = p.x;
      player.z = p.z;
    } else {
      const dx = player.x - car.x;
      const dz = player.z - car.z;
      if (dx * dx + dz * dz < 4.2 * 4.2) {
        player.inCar = true;
        player.yaw = car.yaw;
      }
    }
    hudDirty = true;
  }

  function step(dt: number) {
    if (!started || outcome !== "play") return;
    const k = held();
    player.shootCd = Math.max(0, player.shootCd - dt);
    player.enterCd = Math.max(0, player.enterCd - dt);
    player.hurt = Math.max(0, player.hurt - dt);
    player.hitmarker = Math.max(0, player.hitmarker - dt);
    player.shake = Math.max(0, player.shake - dt * 2.4);
    muzzle.intensity *= Math.pow(0.001, dt);

    const throttle =
      (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) +
      (k.has("KeyS") || k.has("ArrowDown") ? -1 : 0) +
      touch.moveY;
    let steer = 0;
    if (injectSteer != null) steer = injectSteer;
    else {
      if (k.has("KeyA") || k.has("ArrowLeft")) steer += 1;
      if (k.has("KeyD") || k.has("ArrowRight")) steer -= 1;
      if (player.inCar) steer += -touch.moveX;
    }
    steer = clamp(steer, -1, 1);

    if (k.has("KeyF") || k.has("KeyE") || touch.enter) {
      touch.enter = false;
      if (!k.has("_enterLatch")) {
        keys.add("_enterLatch");
        tryEnter();
      }
    } else {
      keys.delete("_enterLatch");
    }

    if (player.inCar) {
      const accel = 18;
      const brake = 26;
      if (throttle > 0) car.speed += accel * throttle * dt;
      else if (throttle < 0) {
        if (car.speed > 0.4) car.speed += brake * throttle * dt;
        else car.speed += 10 * throttle * dt;
      } else {
        car.speed *= Math.pow(0.22, dt);
      }
      car.speed = clamp(car.speed, -9, 24);
      const speedFactor = clamp(Math.abs(car.speed) / 7.5, 0, 1);
      const reverse = car.speed >= 0 ? 1 : -1;
      car.yaw += steer * 2.35 * speedFactor * reverse * dt;
      car.yaw = wrapPi(car.yaw);
      setHeading(car.yaw);
      car.x += vForward.x * car.speed * dt;
      car.z += vForward.z * car.speed * dt;
      const hit = collideCircle(car.x, car.z, 1.15);
      if (hit.x !== car.x || hit.z !== car.z) car.speed *= 0.55;
      car.x = hit.x;
      car.z = hit.z;
      player.x = car.x;
      player.z = car.z;
      player.yaw = car.yaw;
      cam.yaw = car.yaw;
      cam.dist = 8.8;
      cam.height = 3.2;

      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - car.x;
        const dz = e.z - car.z;
        if (dx * dx + dz * dz < 1.7 * 1.7 && Math.abs(car.speed) > 7) {
          e.hp -= 90;
          car.speed *= 0.7;
          if (e.hp <= 0) {
            e.alive = false;
            e.mesh.visible = false;
            blip(80, 0.25, "sawtooth", 0.06);
            hudDirty = true;
          }
        }
      }
    } else {
      car.speed *= Math.pow(0.15, dt);
      setHeading(player.yaw);
      const ax = touch.moveX + (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
      const az = touch.moveY + (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
      const len = Math.hypot(ax, az);
      const speed = k.has("ShiftLeft") || k.has("ShiftRight") ? 7.2 : 4.6;
      if (len > 0.12) {
        const nx = ax / len;
        const nz = az / len;
        player.x += (vForward.x * nz + vRight.x * nx) * speed * dt;
        player.z += (vForward.z * nz + vRight.z * nx) * speed * dt;
      }
      const hit = collideCircle(player.x, player.z, 0.42);
      player.x = hit.x;
      player.z = hit.z;
      player.yaw += touch.lookX * 1.8 * dt;
      player.pitch = clamp(player.pitch + touch.lookY * 1.2 * dt, -0.6, 0.7);
      cam.yaw = player.yaw;
      cam.dist = 4.6;
      cam.height = 2.15;
      if (touch.fire || k.has("Space")) fireWeapon();
    }

    const px = player.x;
    const pz = player.z;
    for (const e of enemies) {
      if (!e.alive) continue;
      e.cooldown = Math.max(0, e.cooldown - dt);
      const dx = px - e.x;
      const dz = pz - e.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 34) {
        const ang = Math.atan2(-dx, -dz);
        e.yaw = ang;
        if (dist > 11) {
          e.x += -Math.sin(ang) * 3.4 * dt;
          e.z += -Math.cos(ang) * 3.4 * dt;
        } else if (e.cooldown <= 0 && losClear(e.x, e.z, px, pz)) {
          e.cooldown = 0.85;
          player.hp -= 9;
          player.hurt = 0.25;
          player.shake = 0.18;
          blip(140, 0.08, "square", 0.05);
          hudDirty = true;
          if (player.hp <= 0) {
            player.hp = 0;
            outcome = "lose";
          }
        }
      } else {
        e.z += e.patrolDir * 1.6 * dt;
        if (e.z > 90 || e.z < -90) e.patrolDir *= -1;
        e.yaw = e.patrolDir > 0 ? 0 : Math.PI;
      }
      const p = collideCircle(e.x, e.z, 0.4);
      e.x = p.x;
      e.z = p.z;
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.yaw;
    }

    if (enemies.every((e) => !e.alive) && outcome === "play") {
      outcome = "win";
      hudDirty = true;
    }

    if (engineGain && engineOsc && audio) {
      const t = Math.abs(car.speed) / 24;
      engineGain.gain.value = player.inCar && started ? 0.025 + t * 0.04 : 0;
      engineOsc.frequency.value = 48 + t * 90;
    }
  }

  function render() {
    setHeading(cam.yaw);
    const tx = player.x - vForward.x * cam.dist;
    const ty = cam.height + (player.inCar ? 0.2 : 0);
    const tz = player.z - vForward.z * cam.dist;
    camera.position.lerp(vTmp.set(tx, ty, tz), 0.14);
    vTmp2.set(player.x, player.inCar ? 1.15 : 1.35, player.z);
    camera.lookAt(vTmp2);
    if (player.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * player.shake * 0.35;
      camera.position.y += (Math.random() - 0.5) * player.shake * 0.2;
    }

    playerCar.group.position.set(car.x, 0, car.z);
    playerCar.group.rotation.y = car.yaw;
    const spin = car.speed * 0.35;
    for (const w of playerCar.wheels) w.rotation.x += spin * 0.08;
    playerGroup.visible = !player.inCar;
    playerGroup.position.set(player.x, 0, player.z);
    playerGroup.rotation.y = player.yaw;

    renderer.render(scene, camera);
  }

  function emitHud() {
    const left = enemies.filter((e) => e.alive).length;
    const nearCar =
      !player.inCar && Math.hypot(player.x - car.x, player.z - car.z) < 4.2;
    opts.onHud({
      hp: Math.max(0, player.hp),
      ammo: player.ammo,
      inCar: player.inCar,
      speedKph: Math.abs(car.speed) * 4.2,
      enemiesLeft: left,
      enemiesTotal: enemies.length,
      wanted: left > 0 && started,
      outcome,
      prompt: !started
        ? "Start"
        : outcome === "win"
          ? "Street is yours"
          : outcome === "lose"
            ? "You dropped"
            : player.inCar
              ? "F exit · WASD drive · A left D right"
              : nearCar
                ? "F enter · click / space fire"
                : "Space fire · F enter car",
      hitmarker: player.hitmarker > 0,
    });
  }

  function loop() {
    if (disposed) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    let delta = (now - clock.last) / 1000;
    clock.last = now;
    delta = Math.min(delta, 0.1);
    clock.acc += delta;
    let steps = 0;
    while (clock.acc >= DT && steps < MAX_STEPS) {
      step(DT);
      clock.acc -= DT;
      steps += 1;
      hudDirty = true;
    }
    render();
    if (hudDirty) {
      hudDirty = false;
      emitHud();
    }
  }

  function resize() {
    const parent = canvas.parentElement ?? canvas;
    const w = Math.max(1, parent.clientWidth);
    const h = Math.max(1, parent.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === "Space" || e.code.startsWith("Arrow") || e.code === "KeyF") {
      e.preventDefault();
    }
    keys.add(e.code);
    if (started && e.code === "Space" && !player.inCar) fireWeapon();
  }
  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }
  function onBlur() {
    keys.clear();
  }
  function onMouseMove(e: MouseEvent) {
    if (!pointerLocked || player.inCar) return;
    player.yaw -= e.movementX * 0.0024;
    player.pitch = clamp(player.pitch - e.movementY * 0.002, -0.7, 0.75);
  }
  function onMouseDown(e: MouseEvent) {
    if (!started || e.button !== 0) return;
    if (!player.inCar) fireWeapon();
  }
  function onLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  function onClick() {
    if (!started) return;
    const req = canvas.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    Promise.resolve(req.call(canvas, { unadjustedMovement: true })).catch(() => {
      canvas.requestPointerLock();
    });
  }

  function reset() {
    player.x = 0;
    player.z = 72;
    player.yaw = 0;
    player.pitch = 0.18;
    player.hp = PLAYER_HP;
    player.ammo = MAG;
    player.inCar = true;
    player.shootCd = 0;
    player.hurt = 0;
    car.x = 0;
    car.z = 72;
    car.yaw = 0;
    car.speed = 0;
    outcome = "play";
    enemies.forEach((e, idx) => {
      const s = starts[idx]!;
      e.x = s[0];
      e.z = s[1];
      e.alive = true;
      e.hp = ENEMY_HP;
      e.mesh.visible = true;
      e.cooldown = 0.5;
      (e.body.material as THREE.MeshLambertMaterial).color.setHex(0x2a3038);
    });
    hudDirty = true;
  }

  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", onBlur);
  document.addEventListener("visibilitychange", onBlur);
  document.addEventListener("pointerlockchange", onLockChange);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("click", onClick);

  window.__controlsTest = {
    getYaw: () => (player.inCar ? car.yaw : player.yaw),
    getSpeed: () => (player.inCar ? car.speed : 0),
    setSteer: (v) => {
      injectSteer = v;
    },
    setKeys: (codes) => {
      injectKeys = codes;
    },
  };

  emitHud();
  raf = requestAnimationFrame(loop);
  if (opts.autoStart) {
    started = true;
    ensureAudio();
  }

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("click", onClick);
      if (window.__controlsTest) delete window.__controlsTest;
      engineOsc?.stop();
      void audio?.close();
      renderer.dispose();
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
    },
    start() {
      started = true;
      void ensureAudio()?.resume();
      const req = canvas.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | void;
      Promise.resolve(req.call(canvas, { unadjustedMovement: true })).catch(() => {
        canvas.requestPointerLock();
      });
      hudDirty = true;
    },
    restart() {
      reset();
      started = true;
      hudDirty = true;
    },
    setTouch(partial) {
      Object.assign(touch, partial);
    },
  };
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      setSteer?: (v: number) => void;
      setKeys?: (codes: string[]) => void;
    };
  }
}
