/**
 * Main Game Engine for Primal Hunt
 * Handles game loop, entities, combat, and effects
 */

class Game extends EventEmitter {
    constructor() {
        super();

        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimap = document.getElementById('minimap');
        this.minimapCtx = this.minimap.getContext('2d');

        this.running = false;
        this.paused = false;
        this.lastTime = 0;
        this.gameTime = 600; // 10 minutes
        this.maxGameTime = 600;

        // Game objects
        this.map = null;
        this.camera = null;
        this.player = null;
        this.entities = [];
        this.projectiles = [];
        this.effects = [];
        this.traps = [];
        this.dome = null;

        // AI controllers
        this.aiControllers = [];

        // Stats
        this.stats = {
            damageDealt: 0,
            damageTaken: 0,
            abilitiesUsed: 0,
            huntersKilled: 0,
            evolutionStage: 1,
            time: 0
        };

        // Input
        this.input = {
            moveX: 0,
            moveY: 0,
            aimX: 0,
            aimY: 0,
            shooting: false
        };

        this.joystick = {
            active: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0
        };

        this.setupInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        if (this.camera) {
            this.camera.resize(this.canvas.width, this.canvas.height);
        }
    }

    setupInput() {
        // Keyboard input
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Touch input for joystick
        const joystickContainer = document.getElementById('joystick-container');
        const joystickKnob = document.getElementById('joystick-knob');

        joystickContainer.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = joystickContainer.getBoundingClientRect();
            this.joystick.active = true;
            this.joystick.startX = rect.left + rect.width / 2;
            this.joystick.startY = rect.top + rect.height / 2;
            this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
        });

        document.addEventListener('touchmove', (e) => {
            if (!this.joystick.active) return;
            const touch = e.touches[0];
            this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
        });

        document.addEventListener('touchend', () => {
            this.joystick.active = false;
            this.input.moveX = 0;
            this.input.moveY = 0;
            joystickKnob.style.transform = 'translate(0, 0)';
        });

        // Aim joystick (right side for mobile)
        const aimJoystickContainer = document.getElementById('aim-joystick-container');
        const aimJoystickKnob = document.getElementById('aim-joystick-knob');

        this.aimJoystick = {
            active: false,
            startX: 0,
            startY: 0
        };

        if (aimJoystickContainer) {
            aimJoystickContainer.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = aimJoystickContainer.getBoundingClientRect();
                this.aimJoystick.active = true;
                this.aimJoystick.startX = rect.left + rect.width / 2;
                this.aimJoystick.startY = rect.top + rect.height / 2;
                this.updateAimJoystick(touch.clientX, touch.clientY, aimJoystickKnob);
                this.input.shooting = true;
            });

            aimJoystickContainer.addEventListener('touchmove', (e) => {
                e.preventDefault();
                if (!this.aimJoystick.active) return;
                const touch = e.touches[0];
                this.updateAimJoystick(touch.clientX, touch.clientY, aimJoystickKnob);
            });

            aimJoystickContainer.addEventListener('touchend', () => {
                this.aimJoystick.active = false;
                this.input.shooting = false;
                aimJoystickKnob.style.transform = 'translate(0, 0)';
            });
        }

        // Mouse input (for desktop testing)
        this.canvas.addEventListener('mousemove', (e) => {
            this.input.aimX = e.clientX;
            this.input.aimY = e.clientY;
        });

        this.canvas.addEventListener('mousedown', () => {
            this.input.shooting = true;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.input.shooting = false;
        });

        // Touch for aiming (fallback when no aim joystick used)
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.aimJoystick.active) return;
            const touch = e.touches[0];
            this.input.aimX = touch.clientX;
            this.input.aimY = touch.clientY;
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.aimJoystick.active) return;
            if (e.touches.length > 1) {
                e.preventDefault();
                const touch = e.touches[1];
                this.input.aimX = touch.clientX;
                this.input.aimY = touch.clientY;
            }
        });
    }

    updateAimJoystick(touchX, touchY, knob) {
        const dx = touchX - this.aimJoystick.startX;
        const dy = touchY - this.aimJoystick.startY;
        const maxDist = 50;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

        // Convert to world aim position
        if (this.player && this.camera) {
            this.input.aimX = this.canvas.width / 2 + clampedX * 5;
            this.input.aimY = this.canvas.height / 2 + clampedY * 5;
        }
    }

    updateJoystick(touchX, touchY, knob) {
        const dx = touchX - this.joystick.startX;
        const dy = touchY - this.joystick.startY;
        const maxDist = 50;

        const dist = Math.sqrt(dx * dx + dy * dy);
        const clampedDist = Math.min(dist, maxDist);

        const angle = Math.atan2(dy, dx);
        const clampedX = Math.cos(angle) * clampedDist;
        const clampedY = Math.sin(angle) * clampedDist;

        knob.style.transform = `translate(${clampedX}px, ${clampedY}px)`;

        this.input.moveX = clampedX / maxDist;
        this.input.moveY = clampedY / maxDist;
    }

    handleKeyDown(e) {
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup': this.input.moveY = -1; break;
            case 's': case 'arrowdown': this.input.moveY = 1; break;
            case 'a': case 'arrowleft': this.input.moveX = -1; break;
            case 'd': case 'arrowright': this.input.moveX = 1; break;
            case '1': this.useAbility('primary'); break;
            case '2': this.useAbility('secondary'); break;
            case '3': this.useAbility('ability1'); break;
            case '4': this.useAbility('ability2'); break;
            case '5': this.useAbility('ability3'); break;
            case '6': this.useAbility('ability4'); break;
            case ' ': this.input.shooting = true; break;
            case 'shift':
                // Monster: toggle sneak; Hunter: jetpack dodge
                if (this.player instanceof Monster) {
                    this.player.toggleSneak();
                } else if (this.player instanceof Hunter) {
                    const dir = this.player.direction;
                    this.player.jetpackBoost(dir.x || 0, dir.y || 1);
                }
                break;
            case 'q':
                // Monster: use smell
                if (this.player instanceof Monster) {
                    this.player.useSmell();
                }
                break;
            case 'e':
                // Monster: start evolution when ready
                if (this.player instanceof Monster && this.player.pendingEvolution) {
                    this.player.startEvolution();
                    window.ui.showToast('Evolving! Stay hidden for 5 seconds...');
                }
                break;
            case 'escape':
                if (this.running) {
                    window.ui.togglePause();
                }
                break;
        }
    }

    handleKeyUp(e) {
        switch (e.key.toLowerCase()) {
            case 'w': case 'arrowup':
            case 's': case 'arrowdown':
                if ((e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') && this.input.moveY < 0) this.input.moveY = 0;
                if ((e.key.toLowerCase() === 's' || e.key === 'ArrowDown') && this.input.moveY > 0) this.input.moveY = 0;
                break;
            case 'a': case 'arrowleft':
            case 'd': case 'arrowright':
                if ((e.key.toLowerCase() === 'a' || e.key === 'ArrowLeft') && this.input.moveX < 0) this.input.moveX = 0;
                if ((e.key.toLowerCase() === 'd' || e.key === 'ArrowRight') && this.input.moveX > 0) this.input.moveX = 0;
                break;
            case ' ': this.input.shooting = false; break;
        }
    }

    init(role, characterData) {
        // Create map
        this.map = new GameMap(2000, 2000);

        // Create camera
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.camera.setBounds(this.map.width, this.map.height);

        // Reset state
        this.entities = [];
        this.projectiles = [];
        this.effects = [];
        this.traps = [];
        this.aiControllers = [];
        this.dome = null;
        this.gameTime = this.maxGameTime;
        this.stats = {
            damageDealt: 0,
            damageTaken: 0,
            abilitiesUsed: 0,
            huntersKilled: 0,
            evolutionStage: 1,
            time: 0
        };

        // Wildlife respawn system
        this.wildlifeRespawnTimer = 0;
        this.wildlifeRespawnInterval = 15; // seconds between respawn checks
        this.maxWildlife = 20;

        // Dropship respawn system
        this.dropshipQueue = []; // dead hunters waiting for respawn
        this.dropshipTimer = 0;
        this.dropshipInterval = 30; // seconds between dropship arrivals
        this.dropshipActive = false;

        // Power relay objective (Evolve-style)
        this.powerRelay = {
            x: this.map.width / 2,
            y: this.map.height / 2,
            health: 500,
            maxHealth: 500,
            radius: 40,
            active: false // becomes attackable at stage 3
        };

        // Screen shake
        this.screenShake = { intensity: 0, duration: 0 };

        const difficulty = GameSettings.difficulty;

        if (role === 'hunter') {
            // Player is a hunter
            const spawn = this.map.spawnPoints.hunters[0];
            this.player = new Hunter(spawn.x, spawn.y, characterData, true);
            this.entities.push(this.player);

            // Spawn AI hunters
            for (let i = 1; i < 4; i++) {
                const spawnPoint = this.map.spawnPoints.hunters[i];
                const hunterTypes = ['assault', 'trapper', 'medic', 'support'];
                const hunterData = HunterClasses[hunterTypes[i]];
                const aiHunter = new Hunter(spawnPoint.x, spawnPoint.y, hunterData, false);
                this.entities.push(aiHunter);
                this.aiControllers.push(new HunterAI(aiHunter, difficulty));
            }

            // Spawn AI monster
            const monsterSpawn = this.map.spawnPoints.monster;
            const monsterTypes = ['goliath', 'kraken', 'wraith', 'behemoth'];
            const monsterData = MonsterTypes[Utils.randomPick(monsterTypes)];
            const monster = new Monster(monsterSpawn.x, monsterSpawn.y, monsterData, false);
            this.entities.push(monster);
            this.aiControllers.push(new MonsterAI(monster, difficulty));

        } else {
            // Player is a monster
            const spawn = this.map.spawnPoints.monster;
            this.player = new Monster(spawn.x, spawn.y, characterData, true);
            this.entities.push(this.player);

            // Spawn AI hunters
            for (let i = 0; i < 4; i++) {
                const spawnPoint = this.map.spawnPoints.hunters[i];
                const hunterTypes = ['assault', 'trapper', 'medic', 'support'];
                const hunterData = HunterClasses[hunterTypes[i]];
                const aiHunter = new Hunter(spawnPoint.x, spawnPoint.y, hunterData, false);
                this.entities.push(aiHunter);
                this.aiControllers.push(new HunterAI(aiHunter, difficulty));
            }
        }

        // Spawn wildlife
        for (const spawnPoint of this.map.spawnPoints.wildlife) {
            const wildlife = new Wildlife(spawnPoint.x, spawnPoint.y, spawnPoint.type);
            this.entities.push(wildlife);
        }

        // Spawn 2-3 elite wildlife in strategic locations
        const eliteTypes = ['elite_tyrant', 'elite_mammoth', 'elite_sloth'];
        const eliteCount = Utils.randomInt(2, 3);
        for (let i = 0; i < eliteCount; i++) {
            const x = Utils.random(200, this.map.width - 200);
            const y = Utils.random(200, this.map.height - 200);
            const eliteType = eliteTypes[i % eliteTypes.length];
            const elite = new Wildlife(x, y, eliteType);
            this.entities.push(elite);
        }

        // Initialize player upgrades
        this.player.upgradePoints = 0;
        this.player.upgrades = {};
    }

    start() {
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        Audio.startMusic();
        this.loop();
    }

    stop() {
        this.running = false;
        Audio.stopMusic();
    }

    pause() {
        this.paused = true;
    }

    resume() {
        this.paused = false;
        this.lastTime = performance.now();
    }

    loop() {
        if (!this.running) return;

        const currentTime = performance.now();
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap delta time
        this.lastTime = currentTime;

        if (!this.paused) {
            this.update(dt);
        }

        this.render();

        requestAnimationFrame(() => this.loop());
    }

    update(dt) {
        // Update game timer
        this.gameTime -= dt;
        this.stats.time = this.maxGameTime - this.gameTime;

        // Check win/lose conditions
        if (this.gameTime <= 0) {
            this.endGame(this.player instanceof Monster); // Monster wins if time runs out
            return;
        }

        // Update player input
        this.updatePlayerInput(dt);

        // Update AI
        for (const ai of this.aiControllers) {
            if (ai.entity.isAlive) {
                ai.update(dt, this);
            }
        }

        // Update all entities
        for (const entity of this.entities) {
            entity.update(dt, this);
            this.constrainEntity(entity);
        }

        // Handle wildlife fleeing from threats
        this.updateWildlifeBehavior();

        // Respawn wildlife periodically
        this.updateWildlifeRespawn(dt);

        // Update dropship respawn timers
        this.updateDropshipRespawn(dt);

        // Update projectiles
        this.updateProjectiles(dt);

        // Update effects
        this.updateEffects(dt);

        // Update traps
        this.updateTraps(dt);

        // Update dome
        if (this.dome) {
            this.dome.remaining -= dt;
            if (this.dome.remaining <= 0) {
                this.dome = null;
            }
        }

        // Check collisions
        this.checkCollisions();

        // Update screen shake
        this.updateScreenShake(dt);

        // Update camera
        this.camera.follow(this.player);
        this.camera.update(dt);

        // Update UI
        window.ui.updateHUD(this.player, this.gameTime);
        window.ui.updateAbilityBar(this.player);

        // Check game over conditions
        this.checkGameOver();

        // Update monster evolution stat
        if (this.player instanceof Monster) {
            this.stats.evolutionStage = this.player.evolutionStage;
        }
    }

    updatePlayerInput(dt) {
        if (!this.player.isAlive) return;

        // Movement
        const moveSpeed = this.player.speed;
        this.player.vx = this.input.moveX * moveSpeed;
        this.player.vy = this.input.moveY * moveSpeed;

        // Aim direction
        if (this.input.aimX !== 0 || this.input.aimY !== 0) {
            const worldAim = this.camera.screenToWorld(this.input.aimX, this.input.aimY);
            this.player.facingAngle = Utils.angle(this.player.x, this.player.y, worldAim.x, worldAim.y);
        }

        // Auto-attack when shooting
        if (this.input.shooting && this.player.abilities.primary) {
            this.useAbility('primary');
        }
    }

    constrainEntity(entity) {
        // Keep entity within map bounds
        const constrained = this.map.constrainToMap(entity.x, entity.y, entity.radius);
        entity.x = constrained.x;
        entity.y = constrained.y;

        // Handle obstacle collisions
        const obstacle = this.map.getObstacleCollision(entity.x, entity.y, entity.radius);
        if (obstacle) {
            const angle = Utils.angle(obstacle.x, obstacle.y, entity.x, entity.y);
            const pushDist = obstacle.radius + entity.radius - Utils.distance(entity.x, entity.y, obstacle.x, obstacle.y);
            entity.x += Math.cos(angle) * pushDist;
            entity.y += Math.sin(angle) * pushDist;
        }

        // Handle dome constraint
        if (this.dome && entity.team !== 'wildlife') {
            const distFromDome = Utils.distance(entity.x, entity.y, this.dome.x, this.dome.y);
            if (distFromDome > this.dome.radius - entity.radius) {
                const angle = Utils.angle(this.dome.x, this.dome.y, entity.x, entity.y);
                entity.x = this.dome.x + Math.cos(angle) * (this.dome.radius - entity.radius);
                entity.y = this.dome.y + Math.sin(angle) * (this.dome.radius - entity.radius);
            }
        }
    }

    updateWildlifeBehavior() {
        for (const entity of this.entities) {
            if (entity instanceof Wildlife && entity.isAlive) {
                // Check for nearby threats
                for (const other of this.entities) {
                    if (other.team !== 'wildlife' && other.isAlive) {
                        const dist = Utils.distance(entity.x, entity.y, other.x, other.y);
                        if (dist < 150) {
                            entity.flee(other); // Elite wildlife will chase instead of flee
                            break;
                        }
                    }
                }

                // Elite wildlife killed by melee - grant buff
                if (!entity.isAlive && entity.isElite && entity.eliteBuff) {
                    // Find who killed it (closest enemy)
                    let killer = null;
                    let minDist = 100;
                    for (const other of this.entities) {
                        if (other.team !== 'wildlife' && other.isAlive) {
                            const dist = Utils.distance(entity.x, entity.y, other.x, other.y);
                            if (dist < minDist) {
                                minDist = dist;
                                killer = other;
                            }
                        }
                    }
                    if (killer) {
                        killer.addBuff({ ...entity.eliteBuff });
                        window.ui.showToast(`${entity.eliteBuff.name} acquired!`);
                        entity.eliteBuff = null; // Prevent double-granting
                    }
                }
            }
        }
    }

    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            // Move projectile
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;
            proj.life -= dt;

            // Check if out of bounds or expired
            if (proj.life <= 0 || proj.x < 0 || proj.x > this.map.width || proj.y < 0 || proj.y > this.map.height) {
                if (proj.explosive) {
                    this.createExplosion(proj.x, proj.y, {
                        radius: proj.explosionRadius,
                        damage: proj.damage,
                        color: proj.color
                    });
                }
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check obstacle collision
            const obstacle = this.map.getObstacleCollision(proj.x, proj.y, proj.size);
            if (obstacle) {
                if (proj.explosive) {
                    this.createExplosion(proj.x, proj.y, {
                        radius: proj.explosionRadius,
                        damage: proj.damage,
                        color: proj.color
                    });
                }
                this.projectiles.splice(i, 1);
                continue;
            }

            // Check entity collision
            for (const entity of this.entities) {
                if (entity === proj.owner || !entity.isAlive) continue;
                if (entity.team === proj.owner.team) continue;

                const dist = Utils.distance(proj.x, proj.y, entity.x, entity.y);
                if (dist < entity.radius + proj.size) {
                    // Hit!
                    const damage = proj.damage * proj.owner.getDamageMultiplier();
                    entity.takeDamage(damage, proj.owner);

                    if (proj.owner.isPlayer) {
                        this.stats.damageDealt += damage;
                    }
                    if (entity.isPlayer) {
                        this.stats.damageTaken += damage;
                    }

                    // Create hit effect
                    this.createHitEffect(proj.x, proj.y, proj.color);

                    // Show damage number
                    const screenPos = this.camera.worldToScreen(entity.x, entity.y);
                    window.ui.showDamageNumber(screenPos.x, screenPos.y - 20, Math.floor(damage), 'damage');

                    // On hit callback
                    if (proj.onHit) {
                        proj.onHit(entity);
                    }

                    if (proj.explosive) {
                        this.createExplosion(proj.x, proj.y, {
                            radius: proj.explosionRadius,
                            damage: proj.damage,
                            color: proj.color
                        });
                    }

                    // Check if wildlife was killed
                    if (!entity.isAlive && entity instanceof Wildlife) {
                        if (proj.owner instanceof Monster) {
                            proj.owner.feed(entity.foodValue);
                        }
                        // Grant elite buff to killer
                        if (entity.isElite && entity.eliteBuff && proj.owner) {
                            proj.owner.addBuff({ ...entity.eliteBuff });
                            window.ui.showToast(`${entity.eliteBuff.name} acquired!`);
                        }
                    }

                    this.projectiles.splice(i, 1);
                    break;
                }
            }
        }
    }

    updateEffects(dt) {
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            effect.life -= dt;
            effect.age = (effect.duration - effect.life) / effect.duration;

            if (effect.update) {
                effect.update(dt, this);
            }

            if (effect.life <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    updateTraps(dt) {
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const trap = this.traps[i];
            trap.life -= dt;

            if (trap.life <= 0) {
                this.traps.splice(i, 1);
                continue;
            }

            // Check if monster steps on trap
            for (const entity of this.entities) {
                if (entity.team === 'monster' && entity.isAlive && !trap.triggered) {
                    const dist = Utils.distance(trap.x, trap.y, entity.x, entity.y);
                    if (dist < trap.radius + entity.radius) {
                        trap.triggered = true;
                        entity.takeDamage(trap.damage, trap.owner);

                        if (trap.type === 'immobilize') {
                            entity.addDebuff({
                                id: 'trapped',
                                name: 'Trapped',
                                duration: trap.duration,
                                immobilized: true,
                                speedMultiplier: 0,
                                color: '#888888'
                            });
                        }

                        Audio.play('hit');
                        this.createHitEffect(trap.x, trap.y, trap.color);
                        this.traps.splice(i, 1);
                        break;
                    }
                }
            }
        }
    }

    checkCollisions() {
        // Entity-to-entity collision
        for (let i = 0; i < this.entities.length; i++) {
            for (let j = i + 1; j < this.entities.length; j++) {
                const a = this.entities[i];
                const b = this.entities[j];

                if (!a.isAlive || !b.isAlive) continue;

                const dist = Utils.distance(a.x, a.y, b.x, b.y);
                const minDist = a.radius + b.radius;

                if (dist < minDist) {
                    // Push apart
                    const angle = Utils.angle(a.x, a.y, b.x, b.y);
                    const overlap = minDist - dist;
                    const pushX = Math.cos(angle) * overlap * 0.5;
                    const pushY = Math.sin(angle) * overlap * 0.5;

                    a.x -= pushX;
                    a.y -= pushY;
                    b.x += pushX;
                    b.y += pushY;
                }
            }
        }
    }

    checkGameOver() {
        const hunters = this.getAliveHunters();
        const monster = this.getMonster();

        // Hunters win if monster is dead
        if (monster && !monster.isAlive) {
            this.endGame(this.player instanceof Hunter);
            return;
        }

        // Queue dead AI hunters for dropship
        for (const entity of this.entities) {
            if (entity instanceof Hunter && !entity.isAlive && entity.isDowned) {
                entity.isDowned = false; // Mark as fully dead, not downed
                if (!entity.isPlayer) {
                    this.queueForDropship(entity);
                }
                this.stats.huntersKilled++;
            }
        }

        // Monster wins if player hunter is dead (no self-respawn)
        if (this.player instanceof Hunter && !this.player.isAlive) {
            this.endGame(false);
            return;
        }

        // Monster wins if all hunters dead AND no dropship incoming
        if (hunters.length === 0 && this.dropshipQueue.length === 0) {
            this.endGame(this.player instanceof Monster);
            return;
        }

        // Activate power relay when monster reaches stage 3
        if (monster && monster.evolutionStage >= 3 && !this.powerRelay.active) {
            this.powerRelay.active = true;
            window.ui.showToast('Monster reached Stage 3! Defend the Power Relay!');
        }

        // Update power relay
        this.updatePowerRelay(0.016);
    }

    endGame(playerWon) {
        this.running = false;
        Audio.stopMusic();
        window.ui.showGameOver(playerWon, this.stats);
    }

    render() {
        const ctx = this.ctx;

        // Apply screen shake
        const shake = this.getScreenShakeOffset();

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(shake.x, shake.y);

        // Render map
        this.map.render(ctx, this.camera, this.canvas.width, this.canvas.height);

        // Render power relay
        if (this.powerRelay) {
            this.renderPowerRelay(ctx);
        }

        // Render dome
        if (this.dome) {
            this.renderDome(ctx);
        }

        // Render traps
        for (const trap of this.traps) {
            this.renderTrap(ctx, trap);
        }

        // Render effects (below entities)
        for (const effect of this.effects.filter(e => e.layer === 'below')) {
            this.renderEffect(ctx, effect);
        }

        // Sort entities by Y for proper layering
        const sortedEntities = [...this.entities].sort((a, b) => a.y - b.y);

        // Render entities
        for (const entity of sortedEntities) {
            if (this.camera.isOnScreen(entity.x, entity.y)) {
                entity.render(ctx, this.camera);
            }
        }

        // Render projectiles
        for (const proj of this.projectiles) {
            this.renderProjectile(ctx, proj);
        }

        // Render effects (above entities)
        for (const effect of this.effects.filter(e => e.layer !== 'below')) {
            this.renderEffect(ctx, effect);
        }

        ctx.restore(); // End screen shake

        // Render minimap
        this.map.renderMinimap(this.minimapCtx, this.entities, this.player, 120, 120);

        // Render FPS if enabled
        if (GameSettings.showFPS) {
            this.renderFPS(ctx);
        }

        // Render dropship indicator
        if (this.dropshipActive) {
            this.renderDropshipTimer(ctx);
        }
    }

    renderProjectile(ctx, proj) {
        const screenX = proj.x - this.camera.x;
        const screenY = proj.y - this.camera.y;

        // Trail
        ctx.strokeStyle = proj.color;
        ctx.lineWidth = proj.size / 2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX - proj.vx * 0.02, screenY - proj.vy * 0.02);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Projectile
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, proj.size, 0, Math.PI * 2);
        ctx.fill();

        // Glow
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, proj.size * 2);
        gradient.addColorStop(0, `${proj.color}66`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, proj.size * 2, 0, Math.PI * 2);
        ctx.fill();
    }

    renderEffect(ctx, effect) {
        const screenX = effect.x - this.camera.x;
        const screenY = effect.y - this.camera.y;

        switch (effect.type) {
            case 'explosion':
                const radius = effect.radius * Utils.easeOut(effect.age);
                const alpha = 1 - effect.age;

                ctx.globalAlpha = alpha;
                const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, radius);
                gradient.addColorStop(0, effect.color);
                gradient.addColorStop(0.5, effect.color + '88');
                gradient.addColorStop(1, 'transparent');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'hit':
                const hitSize = effect.size * (1 + effect.age);
                ctx.globalAlpha = 1 - effect.age;
                ctx.fillStyle = effect.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, hitSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'heal':
                ctx.globalAlpha = 0.5 * (1 - effect.age);
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius * effect.age, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;

            case 'shockwave':
                ctx.globalAlpha = 0.5 * (1 - effect.age);
                ctx.strokeStyle = effect.color || '#ffffff';
                ctx.lineWidth = 5 * (1 - effect.age);
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius * effect.age, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;

            case 'orbital_warning':
                // Pulsing warning circle
                ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 100) * 0.2;
                ctx.fillStyle = '#ff0000';
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;

            case 'homing_mine':
                const mineX = effect.x - this.camera.x;
                const mineY = effect.y - this.camera.y;
                ctx.fillStyle = effect.color;
                ctx.beginPath();
                ctx.arc(mineX, mineY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                // Glow
                ctx.globalAlpha = 0.5;
                ctx.beginPath();
                ctx.arc(mineX, mineY, effect.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'lightning_storm':
                ctx.globalAlpha = 0.3;
                ctx.fillStyle = effect.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'vortex':
                ctx.globalAlpha = 0.4 * (1 - effect.age);
                const vortexGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, effect.radius);
                vortexGrad.addColorStop(0, effect.color);
                vortexGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = vortexGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'supernova':
                ctx.globalAlpha = 0.3;
                const supernovaGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, effect.radius);
                supernovaGrad.addColorStop(0, effect.color);
                supernovaGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = supernovaGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'lava_pool':
                ctx.globalAlpha = 0.6 * (1 - effect.age * 0.5);
                const lavaGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, effect.radius);
                lavaGrad.addColorStop(0, '#ff6600');
                lavaGrad.addColorStop(0.5, '#ff4400');
                lavaGrad.addColorStop(1, '#ff220066');
                ctx.fillStyle = lavaGrad;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'decoy':
                const decoyX = effect.x - this.camera.x;
                const decoyY = effect.y - this.camera.y;
                ctx.globalAlpha = 0.7 * (1 - effect.age);
                ctx.fillStyle = effect.color;
                ctx.beginPath();
                ctx.arc(decoyX, decoyY, effect.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.font = `${effect.radius}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(effect.icon, decoyX, decoyY);
                ctx.globalAlpha = 1;
                break;

            case 'slash':
                ctx.globalAlpha = 1 - effect.age;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(screenX, screenY, effect.range, effect.startAngle, effect.endAngle);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;

            case 'shield':
                if (effect.entity) {
                    const shieldX = effect.entity.x - this.camera.x;
                    const shieldY = effect.entity.y - this.camera.y;
                    ctx.globalAlpha = 0.5 * (1 - effect.age);
                    ctx.strokeStyle = effect.color;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(shieldX, shieldY, effect.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }
                break;

            case 'cone':
                ctx.globalAlpha = 0.5 * (1 - effect.age);
                ctx.fillStyle = effect.color;
                ctx.beginPath();
                ctx.moveTo(screenX, screenY);
                ctx.arc(screenX, screenY, effect.range, effect.angle - effect.halfAngle, effect.angle + effect.halfAngle);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
                break;

            case 'beam':
                const fromX = effect.from.x - this.camera.x;
                const fromY = effect.from.y - this.camera.y;
                const toX = effect.to.x - this.camera.x;
                const toY = effect.to.y - this.camera.y;
                ctx.globalAlpha = 1 - effect.age;
                ctx.strokeStyle = effect.color;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.moveTo(fromX, fromY);
                ctx.lineTo(toX, toY);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break;
        }
    }

    renderTrap(ctx, trap) {
        const screenX = trap.x - this.camera.x;
        const screenY = trap.y - this.camera.y;

        // Trap circle
        ctx.fillStyle = trap.color + '44';
        ctx.beginPath();
        ctx.arc(screenX, screenY, trap.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = trap.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Teeth/spikes
        const spikes = 8;
        for (let i = 0; i < spikes; i++) {
            const angle = (i / spikes) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(
                screenX + Math.cos(angle) * trap.radius * 0.5,
                screenY + Math.sin(angle) * trap.radius * 0.5
            );
            ctx.lineTo(
                screenX + Math.cos(angle) * trap.radius,
                screenY + Math.sin(angle) * trap.radius
            );
            ctx.stroke();
        }
    }

    renderDome(ctx) {
        const screenX = this.dome.x - this.camera.x;
        const screenY = this.dome.y - this.camera.y;

        // Dome effect
        ctx.strokeStyle = this.dome.color;
        ctx.lineWidth = 5;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 200) * 0.2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.dome.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Fill
        const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.dome.radius);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.8, 'transparent');
        gradient.addColorStop(1, this.dome.color);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.dome.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    renderFPS(ctx) {
        const fps = Math.round(1000 / (performance.now() - this.lastTime + 1));
        ctx.fillStyle = '#00ff00';
        ctx.font = '14px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${fps} FPS`, this.canvas.width - 10, 80);
    }

    renderPowerRelay(ctx) {
        const relay = this.powerRelay;
        const screenX = relay.x - this.camera.x;
        const screenY = relay.y - this.camera.y;

        if (!this.camera.isOnScreen(relay.x, relay.y, 60)) return;

        // Base structure
        ctx.fillStyle = relay.active ? '#ff6600' : '#4488aa';
        ctx.beginPath();
        ctx.arc(screenX, screenY, relay.radius, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing glow when active
        if (relay.active) {
            const pulse = 0.3 + Math.sin(Date.now() / 300) * 0.2;
            ctx.globalAlpha = pulse;
            const gradient = ctx.createRadialGradient(screenX, screenY, relay.radius, screenX, screenY, relay.radius * 2.5);
            gradient.addColorStop(0, '#ff660088');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, relay.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = `${relay.radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', screenX, screenY);

        // Health bar
        const barWidth = relay.radius * 3;
        const barHeight = 8;
        const barY = screenY - relay.radius - 20;
        const healthPct = relay.health / relay.maxHealth;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);
        ctx.fillStyle = healthPct > 0.5 ? '#2ed573' : healthPct > 0.25 ? '#ffa502' : '#ff4757';
        ctx.fillRect(screenX - barWidth / 2, barY, barWidth * healthPct, barHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX - barWidth / 2, barY, barWidth, barHeight);

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.fillText('POWER RELAY', screenX, screenY + relay.radius + 15);
    }

    renderDropshipTimer(ctx) {
        const remaining = Math.ceil(this.dropshipInterval - this.dropshipTimer);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(this.canvas.width / 2 - 80, 50, 160, 30);
        ctx.fillStyle = '#00aaff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`DROPSHIP: ${remaining}s`, this.canvas.width / 2, 65);
    }

    // ==================== ABILITY EFFECTS ====================

    useAbility(abilityKey) {
        if (!this.player.isAlive) return;

        const ability = this.player.abilities[abilityKey];
        if (!ability) return;

        // Get target position
        const target = this.camera.screenToWorld(this.input.aimX || this.canvas.width / 2, this.input.aimY || this.canvas.height / 2);

        if (ability.use(this.player, target, this)) {
            this.stats.abilitiesUsed++;
        }
    }

    createProjectile(owner, target, options) {
        const angle = Utils.angle(owner.x, owner.y, target.x, target.y);
        const spread = options.spread || 0;
        const finalAngle = angle + spread;

        const projectile = {
            x: owner.x + Math.cos(finalAngle) * owner.radius,
            y: owner.y + Math.sin(finalAngle) * owner.radius,
            vx: Math.cos(finalAngle) * options.speed,
            vy: Math.sin(finalAngle) * options.speed,
            damage: options.damage,
            size: options.size || 5,
            color: options.color || '#ffffff',
            owner: owner,
            life: 3,
            explosive: options.explosive || false,
            explosionRadius: options.explosionRadius || 50,
            onHit: options.onHit || null
        };

        this.projectiles.push(projectile);
        Audio.play('shoot');
    }

    createExplosion(x, y, options) {
        // Visual effect
        this.effects.push({
            type: 'explosion',
            x, y,
            radius: options.radius,
            color: options.color || '#ff6600',
            life: 0.5,
            duration: 0.5,
            age: 0
        });

        // Damage entities in range
        for (const entity of this.entities) {
            if (!entity.isAlive) continue;

            const dist = Utils.distance(x, y, entity.x, entity.y);
            if (dist < options.radius) {
                const falloff = 1 - (dist / options.radius);
                const damage = options.damage * falloff;
                entity.takeDamage(damage, options.owner || null);

                // Knockback
                const angle = Utils.angle(x, y, entity.x, entity.y);
                entity.x += Math.cos(angle) * 20 * falloff;
                entity.y += Math.sin(angle) * 20 * falloff;
            }
        }

        Audio.play('hit');
        Utils.vibrate(100);

        // Screen shake proportional to explosion size
        this.addScreenShake(Math.min(options.radius * 0.1, 8), 0.3);
    }

    createHitEffect(x, y, color) {
        this.effects.push({
            type: 'hit',
            x, y,
            color: color || '#ffffff',
            size: 10,
            life: 0.2,
            duration: 0.2,
            age: 0
        });
    }

    createHealEffect(x, y, radius) {
        this.effects.push({
            type: 'heal',
            x, y,
            radius: radius,
            life: 0.5,
            duration: 0.5,
            age: 0,
            layer: 'below'
        });
    }

    createShockwave(entity, radius) {
        this.effects.push({
            type: 'shockwave',
            x: entity.x,
            y: entity.y,
            radius: radius,
            color: entity.color,
            life: 0.3,
            duration: 0.3,
            age: 0
        });
    }

    createMeleeEffect(entity, range) {
        // Arc slash effect
        const startAngle = entity.facingAngle - Math.PI / 4;
        const endAngle = entity.facingAngle + Math.PI / 4;

        this.effects.push({
            type: 'slash',
            entity: entity,
            startAngle,
            endAngle,
            range,
            life: 0.2,
            duration: 0.2,
            age: 0,
            update: (dt, game) => {
                // Damage during slash
            }
        });

        // Hit enemies in arc
        for (const other of this.entities) {
            if (other === entity || !other.isAlive || other.team === entity.team) continue;

            const dist = Utils.distance(entity.x, entity.y, other.x, other.y);
            if (dist < range + other.radius) {
                const angle = Utils.angle(entity.x, entity.y, other.x, other.y);
                const angleDiff = Math.abs(Utils.wrap(angle - entity.facingAngle, -Math.PI, Math.PI));
                if (angleDiff < Math.PI / 4) {
                    // In arc, deal damage
                    const damage = entity.damage * entity.getDamageMultiplier();
                    other.takeDamage(damage, entity);
                    this.createHitEffect(other.x, other.y, entity.color);

                    if (entity.isPlayer) this.stats.damageDealt += damage;
                    if (other.isPlayer) this.stats.damageTaken += damage;
                }
            }
        }

        Audio.play('hit');
    }

    createTrap(x, y, options) {
        this.traps.push({
            x, y,
            radius: options.radius,
            damage: options.damage,
            duration: options.duration,
            type: options.type,
            color: options.color,
            life: 30, // Trap lasts 30 seconds
            triggered: false,
            owner: this.player
        });
    }

    createDome(x, y, options) {
        this.dome = {
            x, y,
            radius: options.radius,
            remaining: options.duration,
            color: options.color
        };

        window.ui.showToast('Mobile Arena deployed!');
    }

    createBeam(from, to, color) {
        // Simple beam effect (could be enhanced with particles)
        this.effects.push({
            type: 'beam',
            from: { x: from.x, y: from.y },
            to: { x: to.x, y: to.y },
            color: color,
            life: 0.1,
            duration: 0.1,
            age: 0
        });
    }

    healAlliesInRange(user, range, amount) {
        for (const entity of this.entities) {
            if (entity.team === user.team && entity !== user && entity.isAlive) {
                const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                if (dist < range) {
                    entity.heal(amount);
                    this.createHealEffect(entity.x, entity.y, 30);
                }
            }
        }
    }

    getEnemiesInRange(entity, range) {
        return this.entities.filter(e =>
            e !== entity &&
            e.isAlive &&
            e.team !== entity.team &&
            e.team !== 'wildlife' &&
            Utils.distance(entity.x, entity.y, e.x, e.y) < range
        );
    }

    getAliveHunters() {
        return this.entities.filter(e => e instanceof Hunter && e.isAlive);
    }

    getAliveWildlife() {
        return this.entities.filter(e => e instanceof Wildlife && e.isAlive);
    }

    getMonster() {
        return this.entities.find(e => e instanceof Monster);
    }

    leapTo(entity, x, y, callback) {
        // Simple teleport with effect
        entity.x = x;
        entity.y = y;
        this.createShockwave(entity, 80);
        if (callback) callback();
    }

    teleportTo(entity, x, y, callback) {
        entity.x = x;
        entity.y = y;
        if (callback) callback();
    }

    createConeAttack(user, target, options) {
        const angle = Utils.angle(user.x, user.y, target.x, target.y);
        const halfAngle = Utils.degToRad(options.angle / 2);

        // Hit enemies in cone
        for (const entity of this.entities) {
            if (entity === user || !entity.isAlive || entity.team === user.team) continue;

            const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
            if (dist > options.range) continue;

            const toEntity = Utils.angle(user.x, user.y, entity.x, entity.y);
            const angleDiff = Math.abs(Utils.wrap(toEntity - angle, -Math.PI, Math.PI));

            if (angleDiff < halfAngle) {
                entity.takeDamage(options.damage, user);
                this.createHitEffect(entity.x, entity.y, options.color);
            }
        }

        // Visual effect
        this.effects.push({
            type: 'cone',
            x: user.x,
            y: user.y,
            angle,
            halfAngle,
            range: options.range,
            color: options.color,
            life: options.duration,
            duration: options.duration,
            age: 0
        });
    }

    charge(user, target, options) {
        const angle = Utils.angle(user.x, user.y, target.x, target.y);
        const dist = Utils.distance(user.x, user.y, target.x, target.y);
        const chargeTime = Math.min(dist / options.speed, 0.5);

        // Instant charge (simplified)
        user.x += Math.cos(angle) * dist * 0.8;
        user.y += Math.sin(angle) * dist * 0.8;

        // Damage and knockback enemies in path
        for (const entity of this.entities) {
            if (entity === user || !entity.isAlive || entity.team === user.team) continue;

            const entityDist = Utils.distance(user.x, user.y, entity.x, entity.y);
            if (entityDist < user.radius + entity.radius + 30) {
                entity.takeDamage(options.damage, user);

                // Knockback
                const knockAngle = Utils.angle(user.x, user.y, entity.x, entity.y);
                entity.x += Math.cos(knockAngle) * options.knockback;
                entity.y += Math.sin(knockAngle) * options.knockback;
            }
        }

        this.createShockwave(user, 50);
    }

    // ==================== MISSING ABILITY FUNCTIONS ====================

    getDownedAllyInRange(user, range) {
        for (const entity of this.entities) {
            if (entity.team === user.team && entity !== user && entity.isDowned) {
                const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                if (dist < range) {
                    return entity;
                }
            }
        }
        return null;
    }

    createShieldEffect(target) {
        this.effects.push({
            type: 'shield',
            x: target.x,
            y: target.y,
            entity: target,
            radius: target.radius + 10,
            color: '#00aaff',
            life: 0.5,
            duration: 0.5,
            age: 0
        });
    }

    cloakAlliesInRange(user, range, duration) {
        for (const entity of this.entities) {
            if (entity.team === user.team && entity.isAlive) {
                const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                if (dist < range) {
                    entity.addBuff({
                        id: 'invisible',
                        name: 'Cloaked',
                        duration: duration,
                        invisible: true,
                        color: 'rgba(100, 100, 255, 0.5)'
                    });
                }
            }
        }
        this.effects.push({
            type: 'shockwave',
            x: user.x,
            y: user.y,
            radius: range,
            color: 'rgba(100, 100, 255, 0.5)',
            life: 0.3,
            duration: 0.3,
            age: 0
        });
    }

    createOrbitalStrike(x, y, options) {
        // Warning indicator
        const effect = {
            type: 'orbital_warning',
            x: x,
            y: y,
            radius: options.radius,
            delay: options.delay,
            damage: options.damage,
            life: options.delay,
            duration: options.delay,
            age: 0,
            triggered: false
        };
        effect.update = (dt, game) => {
            if (!effect.triggered && effect.life <= dt) {
                effect.triggered = true;
                game.createExplosion(x, y, {
                    radius: options.radius,
                    damage: options.damage,
                    color: '#ff4400',
                    owner: null
                });
                Audio.play('hit');
            }
        };
        this.effects.push(effect);
    }

    createSlashEffect(user) {
        this.effects.push({
            type: 'slash',
            x: user.x,
            y: user.y,
            entity: user,
            startAngle: user.facingAngle - Math.PI / 4,
            endAngle: user.facingAngle + Math.PI / 4,
            range: 50,
            color: '#ff00ff',
            life: 0.2,
            duration: 0.2,
            age: 0
        });
    }

    createHomingMine(x, y, options) {
        const effect = {
            type: 'homing_mine',
            x: x + Utils.random(-30, 30),
            y: y + Utils.random(-30, 30),
            vx: 0,
            vy: 0,
            damage: options.damage,
            speed: options.speed,
            life: options.lifespan,
            duration: options.lifespan,
            age: 0,
            radius: 10,
            color: '#00ffff'
        };
        effect.update = (dt, game) => {
            // Find nearest hunter
            let nearest = null;
            let nearestDist = Infinity;
            for (const entity of game.entities) {
                if (entity.team === 'hunters' && entity.isAlive) {
                    const dist = Utils.distance(effect.x, effect.y, entity.x, entity.y);
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearest = entity;
                    }
                }
            }

            if (nearest) {
                const angle = Utils.angle(effect.x, effect.y, nearest.x, nearest.y);
                effect.vx = Math.cos(angle) * effect.speed;
                effect.vy = Math.sin(angle) * effect.speed;
                effect.x += effect.vx * dt;
                effect.y += effect.vy * dt;

                // Check collision
                if (nearestDist < nearest.radius + effect.radius) {
                    nearest.takeDamage(effect.damage, null);
                    game.createHitEffect(effect.x, effect.y, effect.color);
                    game.createExplosion(effect.x, effect.y, {
                        radius: 30,
                        damage: 0,
                        color: '#00ffff'
                    });
                    effect.life = 0;
                }
            }
        };
        this.effects.push(effect);
    }

    createLightningStorm(x, y, options) {
        const effect = {
            type: 'lightning_storm',
            x: x,
            y: y,
            radius: options.radius,
            damage: options.damage,
            strikesRemaining: options.strikes,
            strikeTimer: 0,
            strikeInterval: options.duration / options.strikes,
            life: options.duration,
            duration: options.duration,
            age: 0,
            color: '#00ffff'
        };
        effect.update = (dt, game) => {
            effect.strikeTimer += dt;
            if (effect.strikeTimer >= effect.strikeInterval && effect.strikesRemaining > 0) {
                effect.strikeTimer = 0;
                effect.strikesRemaining--;

                // Random strike within radius
                const strikeX = x + Utils.random(-options.radius, options.radius);
                const strikeY = y + Utils.random(-options.radius, options.radius);

                game.createExplosion(strikeX, strikeY, {
                    radius: 30,
                    damage: options.damage / options.strikes,
                    color: '#00ffff'
                });
                Audio.play('hit');
            }
        };
        this.effects.push(effect);
    }

    createVortex(x, y, options) {
        this.effects.push({
            type: 'vortex',
            x: x,
            y: y,
            radius: options.radius,
            pullStrength: options.pullStrength,
            life: options.duration,
            duration: options.duration,
            age: 0,
            color: '#9900ff',
            layer: 'below',
            update: (dt, game) => {
                // Pull hunters towards center
                for (const entity of game.entities) {
                    if (entity.team === 'hunters' && entity.isAlive) {
                        const dist = Utils.distance(x, y, entity.x, entity.y);
                        if (dist < options.radius && dist > 10) {
                            const angle = Utils.angle(entity.x, entity.y, x, y);
                            const pull = (options.pullStrength / dist) * dt;
                            entity.x += Math.cos(angle) * pull;
                            entity.y += Math.sin(angle) * pull;
                        }
                    }
                }
            }
        });
    }

    createAbduction(user, target, options) {
        // Find nearest hunter in range
        let nearestHunter = null;
        let nearestDist = options.range;

        for (const entity of this.entities) {
            if (entity.team === 'hunters' && entity.isAlive) {
                const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestHunter = entity;
                }
            }
        }

        if (nearestHunter) {
            // Teleport to hunter, grab them, teleport back
            const startX = user.x;
            const startY = user.y;

            // Dash to hunter
            user.x = nearestHunter.x;
            user.y = nearestHunter.y;

            // Deal damage
            nearestHunter.takeDamage(options.damage, user);

            // Bring hunter back
            nearestHunter.x = startX;
            nearestHunter.y = startY;
            user.x = startX;
            user.y = startY;

            this.createHitEffect(nearestHunter.x, nearestHunter.y, '#ff00ff');
        }
    }

    createSupernova(user, duration) {
        const effect = {
            type: 'supernova',
            x: user.x,
            y: user.y,
            entity: user,
            radius: 100,
            life: duration,
            duration: duration,
            age: 0,
            color: '#ff00ff',
            layer: 'below',
            damageTimer: 0
        };
        effect.update = (dt, game) => {
            // Update position to follow user
            effect.x = user.x;
            effect.y = user.y;

            // Damage enemies in range periodically
            effect.damageTimer += dt;
            if (effect.damageTimer >= 0.5) {
                effect.damageTimer = 0;
                for (const entity of game.entities) {
                    if (entity.team === 'hunters' && entity.isAlive) {
                        const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                        if (dist < effect.radius) {
                            entity.takeDamage(10, user);
                            game.createHitEffect(entity.x, entity.y, '#ff00ff');
                        }
                    }
                }
            }
        };
        this.effects.push(effect);
    }

    createDecoy(user, duration) {
        // Create a fake entity that looks like the monster
        const effect = {
            type: 'decoy',
            x: user.x,
            y: user.y,
            radius: user.radius,
            color: user.color,
            icon: user.icon,
            facingAngle: user.facingAngle,
            vx: Math.cos(user.facingAngle) * 100,
            vy: Math.sin(user.facingAngle) * 100,
            life: duration,
            duration: duration,
            age: 0
        };
        effect.update = (dt, game) => {
            // Move decoy forward
            effect.x += effect.vx * dt;
            effect.y += effect.vy * dt;

            // Constrain to map
            const constrained = game.map.constrainToMap(effect.x, effect.y, effect.radius);
            effect.x = constrained.x;
            effect.y = constrained.y;
        };
        this.effects.push(effect);
    }

    createLavaBomb(user, target, options) {
        // Create projectile
        this.createProjectile(user, target, {
            speed: 300,
            damage: options.damage,
            color: '#ff4400',
            size: 15,
            explosive: true,
            explosionRadius: 60
        });

        // Create lava pool at target after delay
        const poolX = target.x;
        const poolY = target.y;
        setTimeout(() => {
            if (!this.running) return;
            const effect = {
                type: 'lava_pool',
                x: poolX,
                y: poolY,
                radius: 50,
                damage: options.poolDamage,
                life: options.poolDuration,
                duration: options.poolDuration,
                age: 0,
                color: '#ff4400',
                layer: 'below',
                damageTimer: 0
            };
            effect.update = (dt, game) => {
                effect.damageTimer += dt;
                if (effect.damageTimer >= 0.5) {
                    effect.damageTimer = 0;
                    for (const entity of game.entities) {
                        if (entity.team === 'hunters' && entity.isAlive) {
                            const dist = Utils.distance(effect.x, effect.y, entity.x, entity.y);
                            if (dist < effect.radius) {
                                entity.takeDamage(effect.damage, null);
                                game.createHitEffect(entity.x, entity.y, '#ff4400');
                            }
                        }
                    }
                }
            };
            this.effects.push(effect);
        }, 500);
    }

    createRockWall(user, target, options) {
        const angle = Utils.angle(user.x, user.y, target.x, target.y);
        const perpAngle = angle + Math.PI / 2;

        // Create wall segments
        const segments = 5;
        const segmentWidth = options.width / segments;

        for (let i = 0; i < segments; i++) {
            const offset = (i - segments / 2) * segmentWidth;
            const wallX = target.x + Math.cos(perpAngle) * offset;
            const wallY = target.y + Math.sin(perpAngle) * offset;

            // Add temporary obstacle
            const wall = {
                type: 'rock',
                x: wallX,
                y: wallY,
                radius: 25,
                color: '#654321',
                temporary: true
            };
            this.map.obstacles.push(wall);

            // Remove after duration
            setTimeout(() => {
                const index = this.map.obstacles.indexOf(wall);
                if (index !== -1) {
                    this.map.obstacles.splice(index, 1);
                }
            }, options.duration * 1000);
        }

        Audio.play('hit');
    }

    createTongueGrab(user, target, options) {
        // Find nearest hunter in direction
        const angle = Utils.angle(user.x, user.y, target.x, target.y);
        let nearestHunter = null;
        let nearestDist = options.range || 300;

        for (const entity of this.entities) {
            if (entity.team === 'hunters' && entity.isAlive) {
                const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                const toEntity = Utils.angle(user.x, user.y, entity.x, entity.y);
                const angleDiff = Math.abs(Utils.wrap(toEntity - angle, -Math.PI, Math.PI));

                if (dist < nearestDist && angleDiff < Math.PI / 4) {
                    nearestDist = dist;
                    nearestHunter = entity;
                }
            }
        }

        if (nearestHunter) {
            // Create beam effect
            this.createBeam(user, nearestHunter, '#8B4513');

            // Pull hunter towards monster
            const pullAngle = Utils.angle(nearestHunter.x, nearestHunter.y, user.x, user.y);
            nearestHunter.x += Math.cos(pullAngle) * (nearestDist * 0.7);
            nearestHunter.y += Math.sin(pullAngle) * (nearestDist * 0.7);

            // Deal damage
            nearestHunter.takeDamage(options.damage, user);
            this.createHitEffect(nearestHunter.x, nearestHunter.y, '#8B4513');
        }
    }

    // ==================== WILDLIFE RESPAWN ====================

    updateWildlifeRespawn(dt) {
        this.wildlifeRespawnTimer += dt;
        if (this.wildlifeRespawnTimer < this.wildlifeRespawnInterval) return;
        this.wildlifeRespawnTimer = 0;

        const aliveWildlife = this.entities.filter(e => e instanceof Wildlife && e.isAlive).length;
        if (aliveWildlife >= this.maxWildlife) return;

        // Spawn 2-4 new wildlife
        const spawnCount = Utils.randomInt(2, 4);
        for (let i = 0; i < spawnCount && aliveWildlife + i < this.maxWildlife; i++) {
            const x = Utils.random(100, this.map.width - 100);
            const y = Utils.random(100, this.map.height - 100);
            const tile = this.map.getTileAt(x, y);
            if (tile === TerrainType.WATER || tile === TerrainType.ROCK) continue;

            // Check not too close to any player/hunter
            let tooClose = false;
            for (const entity of this.entities) {
                if (entity.team !== 'wildlife' && entity.isAlive) {
                    if (Utils.distance(x, y, entity.x, entity.y) < 300) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (tooClose) continue;

            let type = 'small';
            if (tile === TerrainType.FOREST) {
                type = Math.random() > 0.5 ? 'medium' : 'small';
            } else if (tile === TerrainType.CAVE) {
                type = Math.random() > 0.6 ? 'large' : 'medium';
            } else {
                type = Math.random() > 0.8 ? 'medium' : 'small';
            }

            const wildlife = new Wildlife(x, y, type);
            this.entities.push(wildlife);
        }
    }

    // ==================== DROPSHIP RESPAWN ====================

    updateDropshipRespawn(dt) {
        if (this.dropshipQueue.length === 0) return;

        this.dropshipTimer += dt;
        if (this.dropshipTimer < this.dropshipInterval) return;
        this.dropshipTimer = 0;

        // Respawn all queued hunters
        const respawnPoint = this.map.spawnPoints.hunters[0];
        for (const hunter of this.dropshipQueue) {
            hunter.revive();
            hunter.health = hunter.maxHealth * 0.75;
            // Spread spawn positions
            hunter.x = respawnPoint.x + Utils.random(-60, 60);
            hunter.y = respawnPoint.y + Utils.random(-60, 60);
        }

        // Show dropship notification
        window.ui.showToast('Dropship arrived! Hunters respawned.');
        Audio.play('ability');

        // Create visual effect at spawn
        this.createExplosion(respawnPoint.x, respawnPoint.y, {
            radius: 80,
            damage: 0,
            color: '#00aaff'
        });

        this.dropshipQueue = [];
        this.dropshipActive = false;
    }

    queueForDropship(hunter) {
        if (hunter.isPlayer) return; // Player doesn't auto-respawn
        if (this.dropshipQueue.includes(hunter)) return;
        this.dropshipQueue.push(hunter);
        if (!this.dropshipActive) {
            this.dropshipActive = true;
            this.dropshipTimer = 0;
        }
    }

    // ==================== POWER RELAY ====================

    updatePowerRelay(dt) {
        if (!this.powerRelay.active) return;

        // Check if monster is attacking relay
        const monster = this.getMonster();
        if (monster && monster.isAlive) {
            const dist = Utils.distance(monster.x, monster.y, this.powerRelay.x, this.powerRelay.y);
            if (dist < this.powerRelay.radius + monster.radius + 20) {
                // Monster is in melee range of relay - auto-attack
                this.powerRelay.health -= monster.damage * 0.5 * dt;
                if (Math.random() < 0.05) {
                    this.createHitEffect(this.powerRelay.x, this.powerRelay.y, '#ff4400');
                }
            }
        }

        // Relay destroyed - monster wins
        if (this.powerRelay.health <= 0) {
            this.powerRelay.health = 0;
            this.endGame(this.player instanceof Monster);
        }
    }

    // ==================== SCREEN SHAKE ====================

    addScreenShake(intensity, duration) {
        this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
        this.screenShake.duration = Math.max(this.screenShake.duration, duration);
    }

    updateScreenShake(dt) {
        if (this.screenShake.duration > 0) {
            this.screenShake.duration -= dt;
            if (this.screenShake.duration <= 0) {
                this.screenShake.intensity = 0;
            }
        }
    }

    getScreenShakeOffset() {
        if (this.screenShake.intensity <= 0) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.screenShake.intensity * 2,
            y: (Math.random() - 0.5) * this.screenShake.intensity * 2
        };
    }

    startRoll(user, target, options) {
        const angle = Utils.angle(user.x, user.y, target.x, target.y);

        user.addBuff({
            id: 'rolling',
            name: 'Rolling',
            duration: options.duration,
            speedMultiplier: 2,
            color: '#654321'
        });

        // Set velocity in direction
        user.vx = Math.cos(angle) * options.speed;
        user.vy = Math.sin(angle) * options.speed;

        // Create rolling effect
        const effect = {
            type: 'roll',
            x: user.x,
            y: user.y,
            entity: user,
            damage: options.damage,
            life: options.duration,
            duration: options.duration,
            age: 0,
            damageTimer: 0
        };
        effect.update = (dt, game) => {
            effect.x = user.x;
            effect.y = user.y;
            effect.damageTimer += dt;
            if (effect.damageTimer >= 0.2) {
                effect.damageTimer = 0;
                // Damage hunters on contact
                for (const entity of game.entities) {
                    if (entity.team === 'hunters' && entity.isAlive) {
                        const dist = Utils.distance(user.x, user.y, entity.x, entity.y);
                        if (dist < user.radius + entity.radius) {
                            entity.takeDamage(effect.damage, user);
                            game.createHitEffect(entity.x, entity.y, '#654321');

                            // Knockback
                            const knockAngle = Utils.angle(user.x, user.y, entity.x, entity.y);
                            entity.x += Math.cos(knockAngle) * 50;
                            entity.y += Math.sin(knockAngle) * 50;
                        }
                    }
                }
            }
        };
        this.effects.push(effect);
    }
}

// Export
window.Game = Game;
