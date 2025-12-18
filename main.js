// --- Global Variables ---
let scene, camera, renderer, particles;
let particleCount = 50000;
let templateID = 0; // 0: Heart, 1: Flower, 2: Saturn, 3: Firework
let expansionFactor = 0.5; // 0.0 to 1.0 based on hand distance

// --- GLSL Shaders ---
// NOTE: The Vertex Shader is the most complex part and is defined later (Section 3)
const particleVertexShader = `
    uniform float time;
    uniform float templateID;
    uniform float expansionFactor;
    attribute float particleIndex;
    attribute vec3 customColor;
    varying vec3 vColor;

    // A helper function for the heart shape (Implicit function: (x^2 + (9/4)y^2 + z^2 - 1)^3 - x^2 z^3 - (1/5)y^2 z^3 = 0)
    vec3 heartShape(float index) {
        float angle = index * 6.283185307; // 2 * PI
        float r = 0.2 + 0.8 * sin(angle);
        float x = 16.0 * pow(sin(angle), 3.0);
        float y = 13.0 * cos(angle) - 5.0 * cos(2.0 * angle) - 2.0 * cos(3.0 * angle) - cos(4.0 * angle);
        float z = 0.0;
        return vec3(x, y, z) * 0.05; // Scale down for scene
    }

    // A simple function for a rough flower/star shape
    vec3 flowerShape(float index) {
        float angle = index * 6.283185307;
        float r = 1.0 + 0.5 * sin(angle * 5.0); // 5 petals
        float x = r * cos(angle);
        float y = r * sin(angle);
        float z = 0.5 * cos(angle * 3.0);
        return vec3(x, y, z) * 1.5;
    }

    // A function for a rough Saturn/Ring shape
    vec3 saturnShape(float index) {
        float angle = index * 6.283185307;
        float radius = 2.5;
        // Ring
        float x = radius * cos(angle);
        float y = radius * sin(angle);
        float z = sin(time * 0.5 + index * 100.0) * 0.1; // Gentle wave in the ring
        return vec3(x, y, z);
    }
    
    // A function for a basic Firework explosion (dynamic, based on time)
    vec3 fireworkShape(float index) {
        vec3 initialPos = vec3(0.0);
        float explosionTime = mod(time * 0.2 + index * 0.01, 1.0);
        
        // Random direction vectors
        vec3 direction = normalize(vec3(
            sin(particleIndex * 1.23) * cos(particleIndex * 3.45), 
            sin(particleIndex * 5.67) * cos(particleIndex * 7.89), 
            sin(particleIndex * 9.01) * cos(particleIndex * 2.34)
        ));
        
        // Simple outward motion, exploding and then fading/resetting
        float speed = 5.0;
        return initialPos + direction * speed * explosionTime * (1.0 - explosionTime) * 10.0;
    }


    void main() {
        vColor = customColor;
        vec3 position = position;

        // --- Template Switching Logic ---
        if (templateID < 0.5) { // Heart
            position = heartShape(particleIndex / float(particleCount));
        } else if (templateID < 1.5) { // Flower
            position = flowerShape(particleIndex / float(particleCount));
        } else if (templateID < 2.5) { // Saturn
            position = saturnShape(particleIndex / float(particleCount));
        } else { // Firework
            position = fireworkShape(particleIndex / float(particleCount));
        }

        // --- Expansion Control (applied to all shapes) ---
        // This scales the entire shape outward from the center (0,0,0)
        position *= (1.0 + expansionFactor * 3.0);
        
        // Final position calculation
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (10.0 - expansionFactor * 5.0) * (200.0 / length(mvPosition.xyz));
        
        gl_Position = projectionMatrix * mvPosition;
    }
`;

// Fragment Shader (controls the color and fading)
const particleFragmentShader = `
    uniform float time;
    uniform float templateID;
    varying vec3 vColor;
    
    void main() {
        // Simple circular particle with fade-out at edges
        float r = 0.0, delta = 0.0;
        vec2 p = gl_PointCoord.xy - vec2(0.5);
        r = length(p);
        
        // Simple color change based on expansion factor (e.g., green -> red)
        vec3 dynamicColor = vColor;
        if (templateID == 3.0) { // Firework: Color pulses/cycles
            dynamicColor = mix(vColor, vec3(1.0, 0.5, 0.0), sin(time * 5.0) * 0.5 + 0.5);
        } else { // All other shapes
            dynamicColor = mix(vColor, vec3(1.0, 0.0, 0.0), sin(time) * 0.2);
        }

        // Final color calculation: shape color * opacity based on point radius
        gl_FragColor = vec4(dynamicColor, 1.0 - smoothstep(0.4, 0.5, r)); 
    }
`;

// --- Initialization Function ---
function init() {
    // Scene, Camera, Renderer Setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 10;
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create Particles
    createParticles();
    
    // Resize handling
    window.addEventListener('resize', onWindowResize, false);
    
    animate();
}

// --- Particle Creation ---
function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const particleIndices = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
        // Initial, non-shaped positions (can be random, since the shader will overwrite them)
        positions[i * 3 + 0] = Math.random() * 10 - 5;
        positions[i * 3 + 1] = Math.random() * 10 - 5;
        positions[i * 3 + 2] = Math.random() * 10 - 5;

        // Initial Colors (e.g., blue)
        colors[i * 3 + 0] = 0.2; // R
        colors[i * 3 + 1] = 0.4; // G
        colors[i * 3 + 2] = 1.0; // B
        
        // Pass a unique index to the shader to allow each particle to calculate its position
        particleIndices[i] = i; 
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('particleIndex', new THREE.BufferAttribute(particleIndices, 1));

    // Material (Uses Shaders)
    const material = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0.0 },
            templateID: { value: templateID },
            expansionFactor: { value: expansionFactor },
        },
        vertexShader: particleVertexShader,
        fragmentShader: particleFragmentShader,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

// --- Gesture Simulation (Replace with actual MediaPipe/Hand Tracking Logic) ---
let lastSwitchTime = Date.now();

function getGestureData() {
    // --- 1. SIMULATED HAND DATA FOR EXPANSION (Pinch Distance) ---
    // Simulate a gentle pulse in the 'pinch distance' (0.0 to 1.0)
    let t = Date.now() / 1000;
    const pulse = Math.sin(t * 1.5) * 0.5 + 0.5; // Smooth sine wave 0.0 to 1.0
    
    // Map pulse to the control range for expansion
    expansionFactor = 0.3 + pulse * 0.7; // Range 0.3 to 1.0
    
    // --- 2. SIMULATED HAND DATA FOR TEMPLATE SWITCH (Gesture) ---
    // Switch the template every 6 seconds to simulate a 'closed fist' gesture
    if (Date.now() - lastSwitchTime > 6000) {
        templateID = (templateID + 1) % 4; // Cycle through 0, 1, 2, 3
        console.log("Template Switched to ID:", templateID);
        lastSwitchTime = Date.now();
    }
    
    // In a real application, this function would:
    // 1. Get landmarks from MediaPipe.
    // 2. Calculate distance between thumb and index tip for `expansionFactor`.
    // 3. Detect a closed fist or specific finger configuration to update `templateID`.
}

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);

    // 1. Get current gesture data (simulated or real)
    getGestureData();

    // 2. Update shader uniforms
    const uniforms = particles.material.uniforms;
    uniforms.time.value += 0.01;
    uniforms.expansionFactor.value = expansionFactor;
    uniforms.templateID.value = templateID;

    // 3. Render
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start the application
init();