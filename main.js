// --- 1. Scene Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
camera.position.z = 15;

// --- 2. Particle Variables ---
const particleCount = 20000;
let templateID = 0;
let expansionFactor = 0;

// --- 3. Shaders (The "Brain" of the particles) ---
const vShader = `
    uniform float uTime;
    uniform float uTemplate;
    uniform float uExpand;
    attribute float aIndex;
    varying vec3 vColor;

    vec3 getShape(float id, float i) {
        float angle = i * 6.28318;
        if(id < 0.5) { // Heart
            float x = 16.0 * pow(sin(angle), 3.0);
            float y = 13.0 * cos(angle) - 5.0 * cos(2.0*angle) - 2.0*cos(3.0*angle) - cos(4.0*angle);
            return vec3(x, y, 0.0) * 0.4;
        } else if(id < 1.5) { // Flower
            float r = 5.0 + 2.0 * sin(angle * 6.0);
            return vec3(r * cos(angle), r * sin(angle), sin(i * 10.0));
        } else { // Saturn/Ring
            float r = 8.0;
            return vec3(r * cos(angle), r * sin(angle) * 0.3, r * sin(angle));
        }
    }

    void main() {
        vec3 targetPos = getShape(uTemplate, aIndex / ${particleCount}.0);
        targetPos *= (1.0 + uExpand * 2.0);
        vColor = vec3(0.5 + 0.5 * sin(uTime + targetPos.x), 0.7, 1.0);
        vec4 mvPosition = modelViewMatrix * vec4(targetPos, 1.0);
        gl_PointSize = 4.0 * (100.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
    }
`;

const fShader = `
    varying vec3 vColor;
    void main() {
        if (length(gl_PointCoord - vec2(0.5)) > 0.5) discard;
        gl_FragColor = vec4(vColor, 1.0);
    }
`;

// --- 4. Create Particles ---
const geometry = new THREE.BufferGeometry();
const indices = new Float32Array(particleCount);
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) indices[i] = i;

geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aIndex', new THREE.BufferAttribute(indices, 1));

const material = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uTemplate: { value: 0 },
        uExpand: { value: 0 }
    },
    vertexShader: vShader,
    fragmentShader: fShader,
    transparent: true,
    blending: THREE.AdditiveBlending
});

const points = new THREE.Points(geometry, material);
scene.add(points);

// --- 5. Animation & Simulation ---
function animate() {
    requestAnimationFrame(animate);
    
    // Simulate gesture data for now
    const time = performance.now() * 0.001;
    material.uniforms.uTime.value = time;
    material.uniforms.uExpand.value = Math.abs(Math.sin(time)); // Pulse effect
    
    // Switch template every 4 seconds
    material.uniforms.uTemplate.value = Math.floor((time / 4.0) % 3);

    renderer.render(scene, camera);
}

animate();

// Resize Fix
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
