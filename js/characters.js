/**
 * Characters System for Primal Hunt
 * Defines Hunter and Monster characters
 */

/**
 * Base Entity class
 */
class Entity {
    constructor(x, y, config) {
        this.id = Utils.generateId();
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.width = config.width || 40;
        this.height = config.height || 40;
        this.radius = config.radius || 20;

        this.maxHealth = config.maxHealth || 100;
        this.health = this.maxHealth;
        this.maxEnergy = config.maxEnergy || 100;
        this.energy = this.maxEnergy;
        this.energyRegen = config.energyRegen || 5;

        this.speed = config.speed || 150;
        this.baseSpeed = this.speed;
        this.damage = config.damage || 10;
        this.armor = config.armor || 0;

        this.team = config.team || 'neutral';
        this.isPlayer = config.isPlayer || false;
        this.isAlive = true;
        this.isDowned = false;

        this.buffs = [];
        this.debuffs = [];

        this.direction = { x: 0, y: 1 };
        this.facingAngle = 0;

        this.abilities = {};
        this.color = config.color || '#ffffff';
        this.icon = config.icon || '?';
    }

    update(dt, game) {
        if (!this.isAlive) return;

        // Update buffs and debuffs
        this.updateBuffs(dt);
        this.updateDebuffs(dt);

        // Update abilities cooldowns
        for (const key in this.abilities) {
            this.abilities[key].update(dt);
        }

        // Energy regeneration
        this.energy = Math.min(this.maxEnergy, this.energy + this.energyRegen * dt);

        // Apply movement
        const speedMod = this.getSpeedMultiplier();
        this.x += this.vx * speedMod * dt;
        this.y += this.vy * speedMod * dt;

        // Update facing direction
        if (this.vx !== 0 || this.vy !== 0) {
            this.facingAngle = Math.atan2(this.vy, this.vx);
            this.direction = Utils.normalize(this.vx, this.vy);
        }
    }

    takeDamage(amount, attacker) {
        if (!this.isAlive) return;

        // Check for shield buff
        const shieldBuff = this.buffs.find(b => b.shield);
        if (shieldBuff) {
            if (shieldBuff.shield >= amount) {
                shieldBuff.shield -= amount;
                return;
            } else {
                amount -= shieldBuff.shield;
                shieldBuff.shield = 0;
            }
        }

        // Apply armor reduction
        const actualDamage = Math.max(1, amount * (1 - this.armor * 0.01));
        this.health -= actualDamage;

        Audio.play('damage');
        Utils.vibrate(50);

        if (this.health <= 0) {
            this.health = 0;
            this.onDeath(attacker);
        }

        return actualDamage;
    }

    heal(amount) {
        if (!this.isAlive) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
        Audio.play('heal');
    }

    onDeath(killer) {
        this.isAlive = false;
        this.isDowned = true;
    }

    revive() {
        this.isAlive = true;
        this.isDowned = false;
        this.health = this.maxHealth * 0.5;
    }

    addBuff(buff) {
        // Remove existing buff of same type
        this.buffs = this.buffs.filter(b => b.id !== buff.id);
        this.buffs.push({ ...buff, remaining: buff.duration });
    }

    addDebuff(debuff) {
        this.debuffs = this.debuffs.filter(d => d.id !== debuff.id);
        this.debuffs.push({ ...debuff, remaining: debuff.duration });
    }

    updateBuffs(dt) {
        this.buffs = this.buffs.filter(buff => {
            buff.remaining -= dt;
            return buff.remaining > 0;
        });
    }

    updateDebuffs(dt) {
        this.debuffs = this.debuffs.filter(debuff => {
            debuff.remaining -= dt;
            return debuff.remaining > 0;
        });
    }

    getSpeedMultiplier() {
        let mult = 1;
        this.buffs.forEach(b => {
            if (b.speedMultiplier) mult *= b.speedMultiplier;
        });
        this.debuffs.forEach(d => {
            if (d.speedMultiplier) mult *= d.speedMultiplier;
        });
        return mult;
    }

    getDamageMultiplier() {
        let mult = 1;
        this.buffs.forEach(b => {
            if (b.damageMultiplier) mult *= b.damageMultiplier;
        });
        return mult;
    }

    isInvisible() {
        return this.buffs.some(b => b.invisible);
    }

    isImmobilized() {
        return this.debuffs.some(d => d.immobilized);
    }

    render(ctx, camera) {
        if (!this.isAlive && !this.isDowned) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Don't render if invisible (unless it's the player)
        if (this.isInvisible() && !this.isPlayer) {
            return;
        }

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(screenX, screenY + this.radius * 0.8, this.radius * 0.8, this.radius * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const alpha = this.isInvisible() ? 0.3 : 1;
        ctx.globalAlpha = alpha;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = this.isDowned ? '#ff0000' : 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Icon
        ctx.fillStyle = '#ffffff';
        ctx.font = `${this.radius}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, screenX, screenY);

        // Direction indicator
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(
            screenX + Math.cos(this.facingAngle) * (this.radius + 10),
            screenY + Math.sin(this.facingAngle) * (this.radius + 10)
        );
        ctx.stroke();

        ctx.globalAlpha = 1;

        // Health bar (for non-players or when damaged)
        if (this.health < this.maxHealth || !this.isPlayer) {
            this.renderHealthBar(ctx, screenX, screenY);
        }

        // Render buffs/debuffs indicators
        this.renderStatusEffects(ctx, screenX, screenY);
    }

    renderHealthBar(ctx, screenX, screenY) {
        const barWidth = this.radius * 2;
        const barHeight = 6;
        const barY = screenY - this.radius - 15;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(screenX - barWidth / 2, barY, barWidth, barHeight);

        // Health
        const healthPercent = this.health / this.maxHealth;
        const healthColor = healthPercent > 0.5 ? '#2ed573' : healthPercent > 0.25 ? '#ffa502' : '#ff4757';
        ctx.fillStyle = healthColor;
        ctx.fillRect(screenX - barWidth / 2, barY, barWidth * healthPercent, barHeight);

        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX - barWidth / 2, barY, barWidth, barHeight);
    }

    renderStatusEffects(ctx, screenX, screenY) {
        const effectY = screenY - this.radius - 25;
        let offsetX = 0;

        // Render buff icons
        this.buffs.forEach((buff, i) => {
            ctx.fillStyle = buff.color || '#00ff00';
            ctx.beginPath();
            ctx.arc(screenX - 20 + offsetX, effectY, 5, 0, Math.PI * 2);
            ctx.fill();
            offsetX += 12;
        });

        // Render debuff icons
        this.debuffs.forEach((debuff, i) => {
            ctx.fillStyle = debuff.color || '#ff0000';
            ctx.beginPath();
            ctx.arc(screenX - 20 + offsetX, effectY, 5, 0, Math.PI * 2);
            ctx.fill();
            offsetX += 12;
        });
    }
}

/**
 * Hunter class
 */
class Hunter extends Entity {
    constructor(x, y, hunterData, isPlayer = false) {
        super(x, y, {
            ...hunterData.stats,
            team: 'hunters',
            isPlayer,
            color: hunterData.color,
            icon: hunterData.icon
        });

        this.name = hunterData.name;
        this.role = hunterData.role;
        this.description = hunterData.description;
        this.hunterClass = hunterData.id;

        // Clone abilities
        const abilitySet = getAbilitiesForCharacter('hunter', hunterData.id);
        if (abilitySet) {
            this.abilities = cloneAbilities(abilitySet);
        }

        // Jetpack system
        this.jetpackFuel = 100;
        this.maxJetpackFuel = 100;
        this.jetpackActive = false;
        this.jetpackBoosting = false;

        // Dodge/boost cooldown
        this.dodgeCooldown = 0;
        this.dodgeMaxCooldown = 3;
    }

    update(dt, game) {
        super.update(dt, game);

        // Jetpack fuel regeneration
        if (!this.jetpackBoosting) {
            this.jetpackFuel = Math.min(this.maxJetpackFuel, this.jetpackFuel + 15 * dt);
        }

        // Dodge cooldown
        if (this.dodgeCooldown > 0) {
            this.dodgeCooldown -= dt;
        }
    }

    jetpackBoost(dirX, dirY) {
        if (this.jetpackFuel < 25 || this.dodgeCooldown > 0) return false;

        this.jetpackFuel -= 25;
        this.dodgeCooldown = this.dodgeMaxCooldown;

        // Burst of speed in the direction
        const boostSpeed = 400;
        this.x += dirX * boostSpeed * 0.15;
        this.y += dirY * boostSpeed * 0.15;

        Audio.play('ability');
        Utils.vibrate(30);
        return true;
    }

    render(ctx, camera) {
        super.render(ctx, camera);

        if (!this.isAlive) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Jetpack fuel bar (small bar below character)
        if (this.isPlayer) {
            const fuelWidth = this.radius * 1.5;
            const fuelHeight = 3;
            const fuelY = screenY + this.radius + 8;
            const fuelPct = this.jetpackFuel / this.maxJetpackFuel;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(screenX - fuelWidth / 2, fuelY, fuelWidth, fuelHeight);
            ctx.fillStyle = fuelPct > 0.3 ? '#00ccff' : '#ff6600';
            ctx.fillRect(screenX - fuelWidth / 2, fuelY, fuelWidth * fuelPct, fuelHeight);
        }

        // Role indicator for AI teammates
        if (!this.isPlayer) {
            ctx.fillStyle = this.color;
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.hunterClass.toUpperCase(), screenX, screenY + this.radius + 15);
        }
    }
}

/**
 * Monster class
 */
class Monster extends Entity {
    constructor(x, y, monsterData, isPlayer = false) {
        super(x, y, {
            ...monsterData.stats,
            team: 'monster',
            isPlayer,
            color: monsterData.color,
            icon: monsterData.icon
        });

        this.name = monsterData.name;
        this.description = monsterData.description;
        this.monsterType = monsterData.id;

        // Evolution system
        this.evolutionStage = 1;
        this.maxEvolutionStage = 3;
        this.evolutionProgress = 0;
        this.evolutionThreshold = 150; // Balanced: requires ~10 small or 5 medium kills

        // Store evolution multipliers
        this.evolutionMultipliers = monsterData.evolutionMultipliers || {
            health: 1.5,
            damage: 1.4,
            armor: 1.3,
            speed: 1.1,
            size: 1.2
        };

        // Clone abilities
        const abilitySet = getAbilitiesForCharacter('monster', monsterData.id);
        if (abilitySet) {
            this.abilities = cloneAbilities(abilitySet);
        }

        // Monster armor system (Evolve-style: feeding grants armor)
        this.monsterArmor = 0;
        this.maxMonsterArmor = monsterData.stats.maxHealth * 0.5; // Armor pool = 50% of max health

        // Sneak mode
        this.sneaking = false;
        this.sneakSpeedMultiplier = 0.5;

        // Smell ability
        this.smellRange = 300;
        this.smellActive = false;
        this.smellTimer = 0;
        this.smellDuration = 3;
        this.smellCooldown = 0;
        this.smellMaxCooldown = 10;
        this.detectedEntities = [];

        // Evolution cocoon
        this.isEvolving = false;
        this.evolveTimer = 0;
        this.evolveDuration = 5; // 5 seconds vulnerable while evolving
        this.pendingEvolution = false;

        // Ability points for evolution selection
        this.abilityPoints = 0;
        this.abilityLevels = {}; // Track individual ability upgrade levels
    }

    update(dt, game) {
        super.update(dt, game);

        // Evolution cocoon phase
        if (this.isEvolving) {
            this.evolveTimer += dt;
            if (this.evolveTimer >= this.evolveDuration) {
                this.completeEvolution();
            }
            // Can't move while evolving
            this.vx = 0;
            this.vy = 0;
            return;
        }

        // Smell cooldown
        if (this.smellCooldown > 0) {
            this.smellCooldown -= dt;
        }

        // Smell active timer
        if (this.smellActive) {
            this.smellTimer -= dt;
            if (this.smellTimer <= 0) {
                this.smellActive = false;
                this.detectedEntities = [];
            } else {
                // Update detected entities
                this.detectedEntities = [];
                if (game) {
                    for (const entity of game.entities) {
                        if (entity !== this && entity.isAlive) {
                            const dist = Utils.distance(this.x, this.y, entity.x, entity.y);
                            if (dist < this.smellRange) {
                                this.detectedEntities.push(entity);
                            }
                        }
                    }
                }
            }
        }

        // Sneaking speed modifier
        if (this.sneaking) {
            this.vx *= this.sneakSpeedMultiplier;
            this.vy *= this.sneakSpeedMultiplier;
        }
    }

    takeDamage(amount, attacker) {
        if (!this.isAlive) return;

        // Armor absorbs damage first (Evolve-style)
        if (this.monsterArmor > 0) {
            if (this.monsterArmor >= amount) {
                this.monsterArmor -= amount;
                Audio.play('damage');
                Utils.vibrate(30);
                return amount;
            } else {
                amount -= this.monsterArmor;
                this.monsterArmor = 0;
            }
        }

        // Remaining damage goes to health via parent
        return super.takeDamage(amount, attacker);
    }

    feed(foodValue) {
        this.evolutionProgress += foodValue;

        // Feeding also restores armor (Evolve-style)
        this.monsterArmor = Math.min(this.maxMonsterArmor, this.monsterArmor + foodValue * 0.5);

        // Check if ready to evolve
        if (this.evolutionProgress >= this.evolutionThreshold && this.evolutionStage < this.maxEvolutionStage) {
            this.pendingEvolution = true;
        }
    }

    startEvolution() {
        if (!this.pendingEvolution || this.isEvolving) return false;
        if (this.evolutionStage >= this.maxEvolutionStage) return false;

        this.isEvolving = true;
        this.evolveTimer = 0;

        // Monster is vulnerable during cocoon
        Audio.play('evolve');
        Utils.vibrate([50, 30, 50]);

        return true;
    }

    completeEvolution() {
        this.isEvolving = false;
        this.pendingEvolution = false;
        this.evolutionStage++;
        this.evolutionProgress = 0;
        this.evolutionThreshold *= 1.8;

        // Apply evolution bonuses
        const mult = this.evolutionMultipliers;
        this.maxHealth *= mult.health;
        this.health = this.maxHealth;
        this.damage *= mult.damage;
        this.armor += 5;
        this.speed *= mult.speed;
        this.radius *= mult.size;

        // Update armor pool
        this.maxMonsterArmor = this.maxHealth * 0.5;
        this.monsterArmor = this.maxMonsterArmor;

        // Grant ability points instead of auto-upgrading
        this.abilityPoints += 3;

        Audio.play('roar');
        Utils.vibrate([100, 50, 100, 50, 100]);

        return true;
    }

    // Auto-evolve for AI monsters (upgrades abilities automatically)
    evolve() {
        if (this.evolutionStage >= this.maxEvolutionStage) return false;
        this.pendingEvolution = true;
        this.startEvolution();
        // AI auto-spends ability points
        this.autoUpgradeAbilities();
        return true;
    }

    autoUpgradeAbilities() {
        const keys = Object.keys(this.abilities);
        while (this.abilityPoints > 0 && keys.length > 0) {
            const key = Utils.randomPick(keys);
            if (this.abilities[key].upgrade()) {
                this.abilityPoints--;
            } else {
                keys.splice(keys.indexOf(key), 1);
            }
        }
    }

    getEvolutionPercent() {
        return (this.evolutionProgress / this.evolutionThreshold) * 100;
    }

    getArmorPercent() {
        return this.maxMonsterArmor > 0 ? (this.monsterArmor / this.maxMonsterArmor) * 100 : 0;
    }

    toggleSneak() {
        this.sneaking = !this.sneaking;
        if (this.sneaking) {
            this.addBuff({
                id: 'sneaking',
                name: 'Sneaking',
                duration: 999,
                invisible: true,
                color: 'transparent'
            });
        } else {
            this.buffs = this.buffs.filter(b => b.id !== 'sneaking');
        }
    }

    useSmell() {
        if (this.smellCooldown > 0) return false;
        this.smellActive = true;
        this.smellTimer = this.smellDuration;
        this.smellCooldown = this.smellMaxCooldown;
        Audio.play('ability');
        return true;
    }

    render(ctx, camera) {
        // Monster has larger, more menacing rendering
        if (!this.isAlive && !this.isDowned) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Evolution cocoon rendering
        if (this.isEvolving) {
            const progress = this.evolveTimer / this.evolveDuration;

            // Cocoon shell
            ctx.fillStyle = `rgba(100, 0, 150, ${0.5 + progress * 0.3})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius * (1.2 + progress * 0.3), 0, Math.PI * 2);
            ctx.fill();

            // Pulsing energy
            const pulse = Math.sin(Date.now() / 150) * 0.3 + 0.7;
            ctx.globalAlpha = pulse;
            const cocoonGrad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, this.radius * 1.8);
            cocoonGrad.addColorStop(0, '#ff00ff');
            cocoonGrad.addColorStop(0.5, '#9900ff88');
            cocoonGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = cocoonGrad;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.radius * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Progress bar
            const barWidth = this.radius * 3;
            const barY = screenY - this.radius - 30;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth, 8);
            ctx.fillStyle = '#ff00ff';
            ctx.fillRect(screenX - barWidth / 2, barY, barWidth * progress, 8);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('EVOLVING...', screenX, barY - 5);
            return;
        }

        // Sneak mode visual
        if (this.sneaking) {
            ctx.globalAlpha = 0.3;
        }

        // Evolution glow based on stage
        if (this.evolutionStage > 1) {
            const glowRadius = this.radius + 10 * this.evolutionStage;
            const gradient = ctx.createRadialGradient(screenX, screenY, this.radius, screenX, screenY, glowRadius);
            gradient.addColorStop(0, `${this.color}66`);
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(screenX, screenY, glowRadius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Call parent render
        super.render(ctx, camera);

        if (this.sneaking) {
            ctx.globalAlpha = 1;
        }

        // Armor bar (above health bar)
        if (this.monsterArmor > 0) {
            const armorWidth = this.radius * 2;
            const armorHeight = 4;
            const armorY = screenY - this.radius - 22;
            const armorPct = this.monsterArmor / this.maxMonsterArmor;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(screenX - armorWidth / 2, armorY, armorWidth, armorHeight);
            ctx.fillStyle = '#4488cc';
            ctx.fillRect(screenX - armorWidth / 2, armorY, armorWidth * armorPct, armorHeight);
        }

        // Evolution stage indicator
        const stageColor = this.evolutionStage === 3 ? '#ff4444' : this.evolutionStage === 2 ? '#ffaa00' : '#9b59b6';
        ctx.fillStyle = stageColor;
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`Stage ${this.evolutionStage}`, screenX, screenY + this.radius + 20);

        // Pending evolution indicator
        if (this.pendingEvolution && this.isPlayer) {
            ctx.fillStyle = '#ff00ff';
            ctx.font = 'bold 11px Arial';
            ctx.fillText('READY TO EVOLVE', screenX, screenY + this.radius + 34);
        }

        // Smell detection indicators
        if (this.smellActive && this.isPlayer) {
            // Smell radius ring
            ctx.globalAlpha = 0.15;
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(screenX, screenY, this.smellRange, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Highlight detected entities
            for (const detected of this.detectedEntities) {
                const dx = detected.x - camera.x;
                const dy = detected.y - camera.y;
                ctx.strokeStyle = detected.team === 'hunters' ? '#ff4444' : '#ffaa00';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.arc(dx, dy, detected.radius + 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
}

/**
 * Wildlife (food for monster)
 */
class Wildlife extends Entity {
    constructor(x, y, type, isElite = false) {
        const wildlifeTypes = {
            small: { health: 20, foodValue: 15, speed: 80, radius: 12, color: '#8B4513', icon: '🐀' },
            medium: { health: 50, foodValue: 30, speed: 60, radius: 18, color: '#654321', icon: '🦌' },
            large: { health: 100, foodValue: 50, speed: 40, radius: 25, color: '#4a3728', icon: '🦬' },
            elite_tyrant: { health: 200, foodValue: 80, speed: 50, radius: 35, color: '#cc2200', icon: '🦖', damage: 30 },
            elite_mammoth: { health: 300, foodValue: 100, speed: 30, radius: 40, color: '#5544aa', icon: '🦣', damage: 25 },
            elite_sloth: { health: 150, foodValue: 60, speed: 20, radius: 30, color: '#229944', icon: '🦥', damage: 15 }
        };

        const data = wildlifeTypes[type] || wildlifeTypes.small;

        super(x, y, {
            ...data,
            team: 'wildlife'
        });

        this.type = type;
        this.foodValue = data.foodValue;
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.wanderTimer = 0;
        this.fleeTarget = null;
        this.state = 'wander';
        this.isElite = isElite || type.startsWith('elite_');
        this.isAggressive = this.isElite; // Elite wildlife fights back

        // Elite buff granted on kill
        if (this.isElite) {
            const eliteBuffs = {
                elite_tyrant: { id: 'elite_damage', name: 'Tyrant Strength', damageMultiplier: 1.35, duration: 120, color: '#ff4400' },
                elite_mammoth: { id: 'elite_armor', name: 'Mammoth Hide', speedMultiplier: 1, duration: 120, color: '#5544aa', shield: 100 },
                elite_sloth: { id: 'elite_regen', name: 'Sloth Vitality', duration: 120, color: '#229944' }
            };
            this.eliteBuff = eliteBuffs[type] || null;
        }
    }

    update(dt, game) {
        super.update(dt, game);

        // Simple AI - wander and flee from threats (or fight if elite)
        this.wanderTimer -= dt;

        // Elite wildlife: aggressive - attacks nearby non-wildlife
        if (this.isAggressive && this.fleeTarget && this.fleeTarget.isAlive) {
            const dist = Utils.distance(this.x, this.y, this.fleeTarget.x, this.fleeTarget.y);
            if (dist < 60) {
                // Attack
                this.state = 'attack';
                this.vx = 0;
                this.vy = 0;
                // Deal melee damage periodically
                if (this.wanderTimer <= 0) {
                    this.fleeTarget.takeDamage(this.damage || 10, this);
                    this.wanderTimer = 1;
                }
            } else if (dist < 200) {
                // Chase
                const angle = Utils.angle(this.x, this.y, this.fleeTarget.x, this.fleeTarget.y);
                this.vx = Math.cos(angle) * this.speed;
                this.vy = Math.sin(angle) * this.speed;
                this.state = 'chase';
            } else {
                this.fleeTarget = null;
                this.state = 'wander';
            }
        } else if (this.fleeTarget && this.fleeTarget.isAlive && !this.isAggressive) {
            const dist = Utils.distance(this.x, this.y, this.fleeTarget.x, this.fleeTarget.y);
            if (dist < 200) {
                const angle = Utils.angle(this.fleeTarget.x, this.fleeTarget.y, this.x, this.y);
                this.vx = Math.cos(angle) * this.speed;
                this.vy = Math.sin(angle) * this.speed;
                this.state = 'flee';
            } else {
                this.fleeTarget = null;
                this.state = 'wander';
            }
        } else {
            // Wander
            if (this.wanderTimer <= 0) {
                this.wanderAngle += (Math.random() - 0.5) * Math.PI;
                this.wanderTimer = Utils.random(1, 3);
            }

            this.vx = Math.cos(this.wanderAngle) * this.speed * 0.5;
            this.vy = Math.sin(this.wanderAngle) * this.speed * 0.5;
        }
    }

    flee(threat) {
        this.fleeTarget = threat;
        this.state = this.isAggressive ? 'chase' : 'flee';
    }

    render(ctx, camera) {
        super.render(ctx, camera);

        if (!this.isAlive || !this.isElite) return;

        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Elite glow
        ctx.globalAlpha = 0.3;
        const glowGrad = ctx.createRadialGradient(screenX, screenY, this.radius, screenX, screenY, this.radius * 2);
        glowGrad.addColorStop(0, this.color + '88');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Elite label
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('ELITE', screenX, screenY + this.radius + 15);
    }
}

/**
 * Hunter class definitions
 */
const HunterClasses = {
    assault: {
        id: 'assault',
        name: 'ASSAULT',
        role: 'Damage Dealer',
        description: 'High damage output with explosives and assault weapons.',
        icon: '🎯',
        color: '#e74c3c',
        stats: {
            maxHealth: 100,
            maxEnergy: 100,
            speed: 160,
            damage: 15,
            armor: 10,
            radius: 20
        }
    },
    trapper: {
        id: 'trapper',
        name: 'TRAPPER',
        role: 'Control Specialist',
        description: 'Controls the battlefield with traps and slowing effects.',
        icon: '🪤',
        color: '#2ecc71',
        stats: {
            maxHealth: 90,
            maxEnergy: 120,
            speed: 170,
            damage: 10,
            armor: 5,
            radius: 18
        }
    },
    medic: {
        id: 'medic',
        name: 'MEDIC',
        role: 'Healer',
        description: 'Keeps the team alive with powerful healing abilities.',
        icon: '💉',
        color: '#3498db',
        stats: {
            maxHealth: 80,
            maxEnergy: 150,
            speed: 165,
            damage: 8,
            armor: 5,
            radius: 18
        }
    },
    support: {
        id: 'support',
        name: 'SUPPORT',
        role: 'Buffer/Utility',
        description: 'Provides shields, cloaking, and orbital strikes.',
        icon: '🛡️',
        color: '#9b59b6',
        stats: {
            maxHealth: 95,
            maxEnergy: 130,
            speed: 155,
            damage: 12,
            armor: 8,
            radius: 19
        }
    }
};

/**
 * Monster type definitions
 */
const MonsterTypes = {
    goliath: {
        id: 'goliath',
        name: 'GOLIATH',
        description: 'A massive beast built for direct combat. Uses brute strength and fire.',
        icon: '👹',
        color: '#8B0000',
        stats: {
            maxHealth: 200,
            maxEnergy: 100,
            speed: 140,
            damage: 25,
            armor: 15,
            radius: 35
        },
        evolutionMultipliers: {
            health: 1.6,
            damage: 1.5,
            armor: 1.3,
            speed: 1.1,
            size: 1.15
        }
    },
    kraken: {
        id: 'kraken',
        name: 'KRAKEN',
        description: 'A flying nightmare that attacks from range with lightning.',
        icon: '🦑',
        color: '#4B0082',
        stats: {
            maxHealth: 150,
            maxEnergy: 150,
            speed: 180,
            damage: 20,
            armor: 5,
            radius: 30
        },
        evolutionMultipliers: {
            health: 1.4,
            damage: 1.6,
            armor: 1.2,
            speed: 1.15,
            size: 1.1
        }
    },
    wraith: {
        id: 'wraith',
        name: 'WRAITH',
        description: 'A stealthy assassin that warps through space to strike.',
        icon: '👻',
        color: '#800080',
        stats: {
            maxHealth: 120,
            maxEnergy: 120,
            speed: 200,
            damage: 18,
            armor: 0,
            radius: 25
        },
        evolutionMultipliers: {
            health: 1.3,
            damage: 1.5,
            armor: 1.0,
            speed: 1.2,
            size: 1.1
        }
    },
    behemoth: {
        id: 'behemoth',
        name: 'BEHEMOTH',
        description: 'An unstoppable juggernaut that rolls through obstacles.',
        icon: '🦣',
        color: '#654321',
        stats: {
            maxHealth: 300,
            maxEnergy: 80,
            speed: 100,
            damage: 35,
            armor: 25,
            radius: 45
        },
        evolutionMultipliers: {
            health: 1.7,
            damage: 1.4,
            armor: 1.5,
            speed: 1.05,
            size: 1.2
        }
    }
};

// Export
window.Entity = Entity;
window.Hunter = Hunter;
window.Monster = Monster;
window.Wildlife = Wildlife;
window.HunterClasses = HunterClasses;
window.MonsterTypes = MonsterTypes;
