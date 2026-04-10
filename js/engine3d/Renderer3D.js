/**
 * 3D Renderer for Primal Hunt
 * Uses Three.js for WebGL rendering with isometric camera
 */

class Renderer3D {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Three.js core components
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false
        });

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Set background color
        this.scene.background = new THREE.Color(0x1a1a2e);
        this.scene.fog = new THREE.Fog(0x1a1a2e, 80, 200);

        // World scale: game coords * this = 3D coords
        this.worldScale = 0.05;

        // Setup camera (isometric view)
        this.setupCamera();

        // Setup lighting
        this.setupLighting();

        // Container for game objects
        this.entityMeshes = new Map();
        this.effectMeshes = [];

        // Clock for animations
        this.clock = new THREE.Clock();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    setupCamera() {
        // Isometric-style perspective camera
        const aspect = this.width / this.height;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);

        // Isometric angle (looking down at ~45 degrees)
        this.cameraOffset = new THREE.Vector3(0, 40, 30);
        this.cameraTarget = new THREE.Vector3(0, 0, 0);

        this.camera.position.copy(this.cameraOffset);
        this.camera.lookAt(this.cameraTarget);
    }

    setupLighting() {
        // Ambient light for base illumination
        this.ambientLight = new THREE.AmbientLight(0x404060, 0.4);
        this.scene.add(this.ambientLight);

        // Main directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;

        // Shadow settings
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 200;
        this.sunLight.shadow.camera.left = -60;
        this.sunLight.shadow.camera.right = 60;
        this.sunLight.shadow.camera.top = 60;
        this.sunLight.shadow.camera.bottom = -60;
        this.sunLight.shadow.bias = -0.0005;

        this.scene.add(this.sunLight);

        // Hemisphere light for sky/ground color variation
        this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x2d5016, 0.3);
        this.scene.add(this.hemiLight);

        // Point light pool for dynamic ability effects
        this.dynamicLights = [];
        for (let i = 0; i < 10; i++) {
            const light = new THREE.PointLight(0xffffff, 0, 20);
            light.castShadow = false;
            this.scene.add(light);
            this.dynamicLights.push({ light, active: false, life: 0 });
        }
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
    }

    /**
     * Update camera to follow target
     */
    updateCamera(targetX, targetY, dt) {
        // Convert 2D game coords to 3D world coords
        const targetPos = this.gameToWorld(targetX, targetY);

        // Smooth camera follow
        this.cameraTarget.lerp(targetPos, 0.1);

        // Update camera position
        const desiredPos = this.cameraTarget.clone().add(this.cameraOffset);
        this.camera.position.lerp(desiredPos, 0.1);
        this.camera.lookAt(this.cameraTarget);

        // Update shadow camera position to follow
        this.sunLight.position.set(
            this.cameraTarget.x + 30,
            60,
            this.cameraTarget.z + 30
        );
        this.sunLight.target.position.copy(this.cameraTarget);
    }

    /**
     * Request a dynamic light for effects (takes game coordinates)
     */
    requestDynamicLight(x, y, color, intensity, life) {
        for (const lightData of this.dynamicLights) {
            if (!lightData.active) {
                const pos = this.gameToWorld(x, y);
                lightData.light.position.set(pos.x, 2, pos.z);
                lightData.light.color.setHex(color);
                lightData.light.intensity = intensity;
                lightData.active = true;
                lightData.life = life;
                lightData.maxLife = life;
                return lightData;
            }
        }
        return null;
    }

    /**
     * Update dynamic lights
     */
    updateDynamicLights(dt) {
        for (const lightData of this.dynamicLights) {
            if (lightData.active) {
                lightData.life -= dt;
                if (lightData.life <= 0) {
                    lightData.active = false;
                    lightData.light.intensity = 0;
                } else {
                    // Fade out
                    const t = lightData.life / lightData.maxLife;
                    lightData.light.intensity *= t;
                }
            }
        }
    }

    /**
     * Convert game coordinates to 3D world coordinates
     * Game coords: (0,0) to (2000,2000), 3D coords: centered at origin
     */
    gameToWorld(gameX, gameY) {
        return new THREE.Vector3(
            (gameX - 1000) * this.worldScale,
            0,
            (gameY - 1000) * this.worldScale
        );
    }

    /**
     * Render the scene
     */
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Clear all entity meshes
     */
    clearEntities() {
        for (const [id, meshData] of this.entityMeshes) {
            this.scene.remove(meshData.group);
            if (meshData.group.geometry) meshData.group.geometry.dispose();
            if (meshData.group.material) meshData.group.material.dispose();
        }
        this.entityMeshes.clear();
    }

    /**
     * Add object to scene
     */
    addToScene(object) {
        this.scene.add(object);
    }

    /**
     * Remove object from scene
     */
    removeFromScene(object) {
        this.scene.remove(object);
    }

    /**
     * Dispose of renderer
     */
    dispose() {
        this.renderer.dispose();
        this.clearEntities();
    }
}

// Export
window.Renderer3D = Renderer3D;
