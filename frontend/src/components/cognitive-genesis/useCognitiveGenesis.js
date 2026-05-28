import * as THREE from "three";

export function initCognitiveGenesis(container) {

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0A0A0A");

  const camera = new THREE.PerspectiveCamera(
    55,
    container.clientWidth / container.clientHeight,
    0.1,
    200
  );
  camera.position.z = 18;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  // ---------------- LIGHT ----------------
  const ambient = new THREE.AmbientLight("#1C1F26", 1.2);
  scene.add(ambient);

  const point = new THREE.PointLight("#C9B27C", 2);
  point.position.set(10, 10, 10);
  scene.add(point);

  const group = new THREE.Group();
  group.rotation.x = 0.35;
  scene.add(group);

  const radius = 4;
  const height = 12;
  const segments = 200;

  const points1 = [];
  const points2 = [];

  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 10;

    const x1 = radius * Math.cos(angle);
    const z1 = radius * Math.sin(angle);
    const y = (t - 0.5) * height;

    const x2 = radius * Math.cos(angle + Math.PI);
    const z2 = radius * Math.sin(angle + Math.PI);

    points1.push(new THREE.Vector3(x1, y, z1));
    points2.push(new THREE.Vector3(x2, y, z2));
  }

  const curve1 = new THREE.CatmullRomCurve3(points1);
  const curve2 = new THREE.CatmullRomCurve3(points2);

  const tubeGeo1 = new THREE.TubeGeometry(curve1, 400, 0.12, 16, false);
  const tubeGeo2 = new THREE.TubeGeometry(curve2, 400, 0.12, 16, false);

  const blueMaterial = new THREE.MeshStandardMaterial({
    color: "#0F1C2E",
    metalness: 0.4,
    roughness: 0.3
  });

  const champagneMaterial = new THREE.MeshStandardMaterial({
    color: "#C9B27C",
    metalness: 0.7,
    roughness: 0.2,
    emissive: "#C9B27C",
    emissiveIntensity: 0.15
  });

  const helix1 = new THREE.Mesh(tubeGeo1, blueMaterial);
  const helix2 = new THREE.Mesh(tubeGeo2, champagneMaterial);

  group.add(helix1);
  group.add(helix2);

  // -------- ENERGY PARTICLE --------
  const particleGeo = new THREE.SphereGeometry(0.25, 16, 16);
  const particleMat = new THREE.MeshStandardMaterial({
    color: "#C9B27C",
    emissive: "#C9B27C",
    emissiveIntensity: 0.4
  });

  const particle = new THREE.Mesh(particleGeo, particleMat);
  group.add(particle);

  let progress = 0;

  function animate() {
    requestAnimationFrame(animate);

    group.rotation.y += 0.002;

    progress += 0.002;
    if (progress > 1) progress = 0;

    const pos = curve1.getPointAt(progress);
    particle.position.copy(pos);

    renderer.render(scene, camera);
  }

  animate();

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  return () => {
    renderer.dispose();
    container.removeChild(renderer.domElement);
  };
}