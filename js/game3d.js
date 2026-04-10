/**
 * 3D Game Extension for Primal Hunt
 * Extends the base Game class with 3D rendering
 */

class Game3D extends Game {
    constructor() {
        super();

        this.use3D = true;
        this.renderer3d = null;
        this.terrain3d = null;
        this.characters3d = null;
        this.effects3d = null;
        this.postProcessing = null;
    }

    init(role, characterData) {
        // Call parent init
        super.init(role, characterData);

        // Initialize 3D systems
        if (this.use3D) {
            this.init3D();
        }
    }

    init3D() {
        // Create 3D renderer
        this.renderer3d = new Renderer3D(this.canvas);

        // Create 3D terrain from game map
        this.terrain3d = new Terrain3D(this.renderer3d, this.map);

        // Create character manager
        this.characters3d = new Characters3D(this.renderer3d);

        // Create effects manager
        this.effects3d = new Effects3D(this.renderer3d);

        // Create post-processing
        this.postProcessing = new PostProcessing(this.renderer3d);

        // Set camera bounds
        this.renderer3d.camera.position.set(0, 40, 30);
    }

    resize() {
        super.resize();

        if (this.renderer3d) {
            this.renderer3d.onResize();
        }
        if (this.postProcessing) {
            this.postProcessing.resize(window.innerWidth, window.innerHeight);
        }
    }

    update(dt) {
        // Call parent update (handles all game logic)
        super.update(dt);

        // Update 3D systems
        if (this.use3D && this.renderer3d) {
            this.update3D(dt);
        }
    }

    update3D(dt) {
        const time = this.renderer3d.clock.getElapsedTime();

        // Update camera to follow player (with screen shake)
        if (this.player) {
            const shake = this.getScreenShakeOffset();
            this.renderer3d.updateCamera(
                this.player.x + shake.x * 10,
                this.player.y + shake.y * 10,
                dt
            );
        }

        // Update terrain animations
        if (this.terrain3d) {
            this.terrain3d.update(time);
        }

        // Update character meshes
        if (this.characters3d) {
            for (const entity of this.entities) {
                if (entity.isAlive || entity.isDowned) {
                    this.characters3d.getOrCreateMesh(entity, this.map);
                    this.characters3d.updateMesh(entity, this.map, time);
                } else {
                    this.characters3d.removeMesh(entity.id);
                }
            }
        }

        // Update effects
        if (this.effects3d) {
            this.effects3d.update(dt);
        }

        // Update dynamic lights
        this.renderer3d.updateDynamicLights(dt);
    }

    render() {
        if (this.use3D && this.renderer3d) {
            this.render3D();
        } else {
            super.render();
        }
    }

    render3D() {
        const time = this.renderer3d.clock.getElapsedTime();

        // Render projectiles in 3D
        this.renderProjectiles3D();

        // Use post-processing if available
        if (this.postProcessing && this.postProcessing.enabled) {
            this.postProcessing.render(
                this.renderer3d.scene,
                this.renderer3d.camera,
                time
            );
        } else {
            this.renderer3d.render();
        }

        // Still render 2D minimap
        this.map.renderMinimap(
            this.minimapCtx,
            this.entities,
            this.player,
            120, 120
        );

        // Render FPS if enabled
        if (GameSettings.showFPS) {
            this.renderFPS(this.ctx);
        }
    }

    renderProjectiles3D() {
        // Create/update 3D projectile representations
        for (const proj of this.projectiles) {
            if (!proj.mesh3d && this.effects3d) {
                // Create projectile mesh
                const geometry = new THREE.SphereGeometry(proj.size * 0.01, 8, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color(proj.color),
                    transparent: true,
                    opacity: 0.9
                });
                const mesh = new THREE.Mesh(geometry, material);
                this.renderer3d.addToScene(mesh);
                proj.mesh3d = mesh;

                // Create trail effect
                if (this.effects3d.createProjectileTrail) {
                    proj.trail3d = this.effects3d.createProjectileTrail(proj);
                }
            }

            if (proj.mesh3d) {
                const worldPos = this.renderer3d.gameToWorld(proj.x, proj.y);
                proj.mesh3d.position.set(worldPos.x, 0.5, worldPos.z);
            }
        }

        // Clean up dead projectile meshes
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            if (proj.life <= 0 && proj.mesh3d) {
                this.renderer3d.removeFromScene(proj.mesh3d);
                proj.mesh3d.geometry.dispose();
                proj.mesh3d.material.dispose();
                delete proj.mesh3d;
            }
        }
    }

    // Override effect creation methods to add 3D effects

    createExplosion(x, y, options) {
        // Call parent for game logic
        super.createExplosion(x, y, options);

        // Add 3D effect
        if (this.effects3d) {
            this.effects3d.createExplosion(x, y, options);
        }
    }

    createHitEffect(x, y, color) {
        // Parent doesn't need to do anything for pure visual
        if (this.effects3d) {
            this.effects3d.createHitEffect(x, y, color);
        }
    }

    createHealEffect(x, y, radius) {
        if (this.effects3d) {
            this.effects3d.createHealEffect(x, y, radius);
        }
    }

    createBeam(from, to, color) {
        if (this.effects3d) {
            this.effects3d.createBeam(from, to, color);
        }
    }

    createDome(x, y, options) {
        // Store dome for game logic
        this.dome = {
            x, y,
            radius: options.radius,
            remaining: options.duration,
            color: options.color
        };

        // Create 3D dome
        if (this.effects3d) {
            this.effects3d.createDome(x, y, options.radius, options.duration);
        }

        window.ui.showToast('Mobile Arena deployed!');
    }

    createConeAttack(user, target, options) {
        // Call parent for damage logic
        super.createConeAttack(user, target, options);

        // Add 3D fire effect
        if (this.effects3d) {
            const angle = Utils.angle(user.x, user.y, target.x, target.y);
            this.effects3d.createFireCone(user, angle, options.range, options.duration);
        }
    }

    createLightningStorm(x, y, options) {
        // Call parent for game logic
        super.createLightningStorm(x, y, options);

        // Lightning visual effects are created per-strike in the parent
    }

    createShockwave(entity, radius) {
        // Add shockwave effect
        if (this.effects3d) {
            this.effects3d.createExplosion(entity.x, entity.y, {
                color: entity.color || 0xffffff,
                radius: radius
            });
        }

        // Screen shake
        this.addScreenShake(radius * 0.05, 0.2);
    }

    createTrap(x, y, options) {
        super.createTrap(x, y, options);
        // Add 3D glow for trap
        if (this.renderer3d) {
            this.renderer3d.requestDynamicLight(x, y, 0x888888, 1, 2);
        }
    }

    createSlashEffect(user) {
        super.createSlashEffect(user);
        if (this.renderer3d) {
            this.renderer3d.requestDynamicLight(user.x, user.y, 0xff00ff, 2, 0.3);
        }
    }

    createLightningStorm(x, y, options) {
        super.createLightningStorm(x, y, options);
        if (this.renderer3d) {
            this.renderer3d.requestDynamicLight(x, y, 0x00ffff, 3, options.duration);
        }
    }

    stop() {
        super.stop();

        // Clean up 3D resources
        if (this.characters3d) {
            this.characters3d.clear();
        }
        if (this.effects3d) {
            this.effects3d.clear();
        }
        if (this.terrain3d) {
            this.terrain3d.dispose();
        }
        if (this.postProcessing) {
            this.postProcessing.dispose();
        }
        if (this.renderer3d) {
            this.renderer3d.dispose();
        }
    }
}

// Replace the default Game with Game3D
window.Game = Game3D;
