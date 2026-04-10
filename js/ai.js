/**
 * AI System for Primal Hunt
 * Controls monster and hunter AI behavior with obstacle avoidance
 */

const AIState = {
    IDLE: 'idle',
    PATROL: 'patrol',
    CHASE: 'chase',
    ATTACK: 'attack',
    FLEE: 'flee',
    FEED: 'feed',
    EVOLVE: 'evolve',
    SUPPORT: 'support',
    HEAL: 'heal',
    SNEAK: 'sneak'
};

/**
 * Base AI Controller
 */
class AIController {
    constructor(entity) {
        this.entity = entity;
        this.state = AIState.IDLE;
        this.target = null;
        this.lastStateChange = 0;
        this.stateTimer = 0;
        this.thinkTimer = 0;
        this.thinkInterval = 0.2;
        this.path = [];
        this.pathIndex = 0;
        this.avoidanceAngle = 0;
        this.stuckTimer = 0;
        this.lastPos = { x: 0, y: 0 };
    }

    update(dt, game) {
        this.stateTimer += dt;
        this.thinkTimer += dt;

        if (this.thinkTimer >= this.thinkInterval) {
            this.thinkTimer = 0;
            this.think(game);
        }

        this.executeState(dt, game);

        // Stuck detection - if entity hasn't moved significantly, adjust path
        this.stuckTimer += dt;
        if (this.stuckTimer > 0.5) {
            const movedDist = Utils.distance(this.entity.x, this.entity.y, this.lastPos.x, this.lastPos.y);
            if (movedDist < 5 && (this.entity.vx !== 0 || this.entity.vy !== 0)) {
                // Entity is stuck, add random avoidance
                this.avoidanceAngle = (Math.random() - 0.5) * Math.PI;
            } else {
                this.avoidanceAngle *= 0.8; // Decay avoidance
            }
            this.lastPos.x = this.entity.x;
            this.lastPos.y = this.entity.y;
            this.stuckTimer = 0;
        }
    }

    think(game) {
        // Override in subclasses
    }

    executeState(dt, game) {
        // Override in subclasses
    }

    setState(newState) {
        if (this.state !== newState) {
            this.state = newState;
            this.stateTimer = 0;
            this.lastStateChange = Date.now();
        }
    }

    moveToward(targetX, targetY, speed, game) {
        let angle = Utils.angle(this.entity.x, this.entity.y, targetX, targetY);

        // Obstacle avoidance
        if (game) {
            angle = this.avoidObstacles(angle, speed, game);
        }

        // Apply stuck avoidance
        angle += this.avoidanceAngle;

        this.entity.vx = Math.cos(angle) * speed;
        this.entity.vy = Math.sin(angle) * speed;
    }

    moveAway(targetX, targetY, speed, game) {
        let angle = Utils.angle(targetX, targetY, this.entity.x, this.entity.y);

        if (game) {
            angle = this.avoidObstacles(angle, speed, game);
        }

        angle += this.avoidanceAngle;

        this.entity.vx = Math.cos(angle) * speed;
        this.entity.vy = Math.sin(angle) * speed;
    }

    avoidObstacles(desiredAngle, speed, game) {
        const lookAhead = this.entity.radius + 40;
        const entity = this.entity;

        // Check forward direction for obstacles
        const checkX = entity.x + Math.cos(desiredAngle) * lookAhead;
        const checkY = entity.y + Math.sin(desiredAngle) * lookAhead;

        const obstacle = game.map.getObstacleCollision(checkX, checkY, entity.radius);
        if (!obstacle) {
            // Also check map bounds
            const tile = game.map.getTileAt(checkX, checkY);
            if (tile !== TerrainType.WATER) {
                return desiredAngle;
            }
        }

        // Try angles to the left and right to find a clear path
        for (let offset = 0.4; offset <= Math.PI; offset += 0.4) {
            // Try right
            const rightAngle = desiredAngle + offset;
            const rightX = entity.x + Math.cos(rightAngle) * lookAhead;
            const rightY = entity.y + Math.sin(rightAngle) * lookAhead;
            const rightObs = game.map.getObstacleCollision(rightX, rightY, entity.radius);
            const rightTile = game.map.getTileAt(rightX, rightY);
            if (!rightObs && rightTile !== TerrainType.WATER) {
                return rightAngle;
            }

            // Try left
            const leftAngle = desiredAngle - offset;
            const leftX = entity.x + Math.cos(leftAngle) * lookAhead;
            const leftY = entity.y + Math.sin(leftAngle) * lookAhead;
            const leftObs = game.map.getObstacleCollision(leftX, leftY, entity.radius);
            const leftTile = game.map.getTileAt(leftX, leftY);
            if (!leftObs && leftTile !== TerrainType.WATER) {
                return leftAngle;
            }
        }

        // No clear path found, reverse
        return desiredAngle + Math.PI;
    }

    stop() {
        this.entity.vx = 0;
        this.entity.vy = 0;
    }

    getDistanceToTarget() {
        if (!this.target) return Infinity;
        return Utils.distance(this.entity.x, this.entity.y, this.target.x, this.target.y);
    }

    canSeeTarget(game) {
        if (!this.target) return false;
        return !this.target.isInvisible();
    }
}

/**
 * Monster AI Controller
 */
class MonsterAI extends AIController {
    constructor(entity, difficulty = 'normal') {
        super(entity);
        this.difficulty = difficulty;

        const difficultyMods = {
            easy: { aggressiveness: 0.3, accuracy: 0.6, reactionTime: 0.4 },
            normal: { aggressiveness: 0.5, accuracy: 0.8, reactionTime: 0.25 },
            hard: { aggressiveness: 0.8, accuracy: 0.95, reactionTime: 0.15 }
        };

        this.mods = difficultyMods[difficulty] || difficultyMods.normal;
        this.aggressiveness = this.mods.aggressiveness;

        this.huntingTarget = null;
        this.feedingTarget = null;
        this.lastAbilityUse = 0;
        this.abilityDelay = 1.5;
        this.sneakTimer = 0;
    }

    think(game) {
        const hunters = game.getAliveHunters();
        const wildlife = game.getAliveWildlife();

        // If evolving, don't change state
        if (this.entity.isEvolving) {
            this.setState(AIState.EVOLVE);
            return;
        }

        // Find nearest visible hunter
        let nearestHunter = null;
        let nearestHunterDist = Infinity;

        for (const hunter of hunters) {
            if (hunter.isInvisible()) continue;
            const dist = Utils.distance(this.entity.x, this.entity.y, hunter.x, hunter.y);
            if (dist < nearestHunterDist) {
                nearestHunterDist = dist;
                nearestHunter = hunter;
            }
        }

        // Find nearest wildlife for feeding
        let nearestWildlife = null;
        let nearestWildlifeDist = Infinity;

        for (const animal of wildlife) {
            const dist = Utils.distance(this.entity.x, this.entity.y, animal.x, animal.y);
            if (dist < nearestWildlifeDist) {
                nearestWildlifeDist = dist;
                nearestWildlife = animal;
            }
        }

        const stage = this.entity.evolutionStage;
        const healthPercent = this.entity.health / this.entity.maxHealth;

        // Ready to evolve - find safe spot
        if (this.entity.pendingEvolution) {
            if (nearestHunterDist > 400) {
                // Safe to evolve
                this.entity.startEvolution();
                this.entity.autoUpgradeAbilities();
                this.setState(AIState.EVOLVE);
                return;
            } else {
                // Flee to safe distance then evolve
                this.setState(AIState.FLEE);
                this.target = nearestHunter;
                return;
            }
        }

        // Low health - flee and feed
        if (healthPercent < 0.3 && stage < 3) {
            if (nearestHunterDist < 250) {
                this.setState(AIState.FLEE);
                this.target = nearestHunter;
            } else if (nearestWildlife) {
                this.setState(AIState.FEED);
                this.target = nearestWildlife;
            } else {
                this.setState(AIState.FLEE);
                this.target = nearestHunter;
            }
            return;
        }

        // Stage 1 - focus on feeding, sneak when hunters nearby
        if (stage === 1) {
            if (nearestHunterDist < 200) {
                if (nearestHunterDist < 120 && Math.random() < this.aggressiveness * 0.3) {
                    this.setState(AIState.ATTACK);
                    this.target = nearestHunter;
                } else {
                    // Sneak away
                    if (!this.entity.sneaking) this.entity.toggleSneak();
                    this.setState(AIState.FLEE);
                    this.target = nearestHunter;
                }
            } else {
                if (this.entity.sneaking && nearestHunterDist > 350) {
                    this.entity.toggleSneak();
                }
                if (nearestWildlife && nearestWildlifeDist < 400) {
                    this.setState(AIState.FEED);
                    this.target = nearestWildlife;
                } else {
                    this.setState(AIState.PATROL);
                }
            }
            return;
        }

        // Stage 2 - balance feeding and fighting, use abilities more
        if (stage === 2) {
            if (nearestHunterDist < 200 && Math.random() < this.aggressiveness) {
                this.setState(AIState.ATTACK);
                this.target = nearestHunter;
            } else if (nearestWildlife && this.entity.getEvolutionPercent() < 80) {
                this.setState(AIState.FEED);
                this.target = nearestWildlife;
            } else if (nearestHunter && nearestHunterDist < 400) {
                this.setState(AIState.CHASE);
                this.target = nearestHunter;
            } else {
                this.setState(AIState.PATROL);
            }
            return;
        }

        // Stage 3 - hunt the hunters aggressively, attack power relay
        if (stage === 3) {
            if (nearestHunter) {
                if (nearestHunterDist < 120) {
                    this.setState(AIState.ATTACK);
                } else {
                    this.setState(AIState.CHASE);
                }
                this.target = nearestHunter;
            } else if (game.powerRelay && game.powerRelay.active) {
                // Go attack the power relay
                this.target = game.powerRelay;
                this.setState(AIState.CHASE);
            } else {
                this.setState(AIState.PATROL);
            }
        }
    }

    executeState(dt, game) {
        switch (this.state) {
            case AIState.IDLE:
                this.stop();
                break;
            case AIState.PATROL:
                this.patrol(dt, game);
                break;
            case AIState.CHASE:
                this.chase(dt, game);
                break;
            case AIState.ATTACK:
                this.attack(dt, game);
                break;
            case AIState.FLEE:
                this.flee(dt, game);
                break;
            case AIState.FEED:
                this.feed(dt, game);
                break;
            case AIState.EVOLVE:
                this.stop();
                break;
        }
    }

    patrol(dt, game) {
        // Use smell periodically
        if (this.entity.smellCooldown <= 0 && Math.random() < 0.02) {
            this.entity.useSmell();
        }

        if (this.stateTimer > 2) {
            const angle = Math.random() * Math.PI * 2;
            this.moveToward(
                this.entity.x + Math.cos(angle) * 200,
                this.entity.y + Math.sin(angle) * 200,
                this.entity.speed * 0.5,
                game
            );
            this.stateTimer = 0;
        }
    }

    chase(dt, game) {
        if (!this.target || (this.target.isAlive !== undefined && !this.target.isAlive)) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist < 80) {
            this.setState(AIState.ATTACK);
            return;
        }

        this.moveToward(this.target.x, this.target.y, this.entity.speed, game);

        // Try to use gap-closing abilities when in range
        if (dist < 300) {
            this.tryUseAbility('ability2', game);
        }
    }

    attack(dt, game) {
        if (!this.target || (this.target.isAlive !== undefined && !this.target.isAlive)) {
            this.setState(AIState.CHASE);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist > 180) {
            this.setState(AIState.CHASE);
            return;
        }

        // Face target
        this.entity.facingAngle = Utils.angle(this.entity.x, this.entity.y, this.target.x, this.target.y);

        // Use abilities with reaction time delay
        const now = Date.now() / 1000;
        if (now - this.lastAbilityUse > this.abilityDelay * this.mods.reactionTime) {
            if (dist < 60) {
                this.tryUseAbility('primary', game);
            }

            if (dist < 150 && dist > 40) {
                this.tryUseAbility('ability1', game);
            }

            // Use special abilities strategically
            if (Math.random() < 0.25) {
                // Pick ability based on situation
                const healthPct = this.entity.health / this.entity.maxHealth;
                if (healthPct > 0.5) {
                    // Aggressive - use damage abilities
                    this.tryUseAbility(Utils.randomPick(['ability3', 'ability4']), game);
                } else {
                    // Defensive - prefer mobility abilities
                    this.tryUseAbility('ability4', game);
                }
            }

            this.lastAbilityUse = now;
        }

        // Combat movement - strafe and close/open distance
        if (dist > 60) {
            this.moveToward(this.target.x, this.target.y, this.entity.speed * 0.6, game);
        } else if (dist < 30) {
            this.moveAway(this.target.x, this.target.y, this.entity.speed * 0.3, game);
        } else {
            // Strafe around target
            const strafeAngle = this.entity.facingAngle + Math.PI / 2 * (Math.sin(Date.now() / 800) > 0 ? 1 : -1);
            this.entity.vx = Math.cos(strafeAngle) * this.entity.speed * 0.4;
            this.entity.vy = Math.sin(strafeAngle) * this.entity.speed * 0.4;
        }
    }

    flee(dt, game) {
        if (!this.target) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist > 500) {
            if (this.entity.sneaking) this.entity.toggleSneak();
            this.setState(AIState.PATROL);
            return;
        }

        this.moveAway(this.target.x, this.target.y, this.entity.speed, game);

        // Use sneak when fleeing at distance
        if (dist > 250 && !this.entity.sneaking) {
            this.entity.toggleSneak();
        }
    }

    feed(dt, game) {
        if (!this.target || !this.target.isAlive) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist < 50) {
            // Attack wildlife
            this.tryUseAbility('primary', game);
            this.stop();
        } else {
            this.moveToward(this.target.x, this.target.y, this.entity.speed, game);
        }

        // Wildlife was killed - feed
        if (!this.target.isAlive && this.target.foodValue) {
            this.entity.feed(this.target.foodValue);
            this.target = null;
            this.setState(AIState.PATROL);
        }
    }

    tryUseAbility(abilityKey, game) {
        const ability = this.entity.abilities[abilityKey];
        if (ability && ability.canUse(this.entity)) {
            const target = this.target || {
                x: this.entity.x + Math.cos(this.entity.facingAngle) * 100,
                y: this.entity.y + Math.sin(this.entity.facingAngle) * 100
            };
            ability.use(this.entity, target, game);
            return true;
        }
        return false;
    }
}

/**
 * Hunter AI Controller
 */
class HunterAI extends AIController {
    constructor(entity, difficulty = 'normal') {
        super(entity);
        this.difficulty = difficulty;

        const difficultyMods = {
            easy: { accuracy: 0.5, reactionTime: 0.5, teamwork: 0.3 },
            normal: { accuracy: 0.7, reactionTime: 0.3, teamwork: 0.5 },
            hard: { accuracy: 0.9, reactionTime: 0.15, teamwork: 0.8 }
        };

        this.mods = difficultyMods[difficulty] || difficultyMods.normal;
        this.role = entity.role || 'Damage Dealer';
        this.lastAbilityUse = 0;
        this.abilityDelay = 0.8;
        this.groupUpTimer = 0;
    }

    think(game) {
        const monster = game.getMonster();
        const allies = game.getAliveHunters().filter(h => h !== this.entity);

        if (!monster || !monster.isAlive) {
            this.setState(AIState.PATROL);
            return;
        }

        const distToMonster = Utils.distance(this.entity.x, this.entity.y, monster.x, monster.y);
        const healthPercent = this.entity.health / this.entity.maxHealth;

        // Check if monster is visible (not sneaking)
        const canSeeMonster = !monster.isInvisible();

        // Role-specific behavior
        switch (this.role) {
            case 'Damage Dealer':
                this.thinkAssault(monster, distToMonster, healthPercent, allies, game, canSeeMonster);
                break;
            case 'Control Specialist':
                this.thinkTrapper(monster, distToMonster, healthPercent, allies, game, canSeeMonster);
                break;
            case 'Healer':
                this.thinkMedic(monster, distToMonster, healthPercent, allies, game, canSeeMonster);
                break;
            case 'Buffer/Utility':
                this.thinkSupport(monster, distToMonster, healthPercent, allies, game, canSeeMonster);
                break;
            default:
                this.thinkAssault(monster, distToMonster, healthPercent, allies, game, canSeeMonster);
        }
    }

    thinkAssault(monster, dist, health, allies, game, canSee) {
        if (health < 0.25 && dist < 150) {
            this.setState(AIState.FLEE);
            this.target = monster;
        } else if (canSee && dist < 350) {
            this.setState(AIState.ATTACK);
            this.target = monster;
        } else if (canSee) {
            this.setState(AIState.CHASE);
            this.target = monster;
        } else {
            // Can't see monster - group up with team
            this.groupWithTeam(allies, monster);
        }
    }

    thinkTrapper(monster, dist, health, allies, game, canSee) {
        if (health < 0.2) {
            this.setState(AIState.FLEE);
            this.target = monster;
        } else if (canSee && dist < 300) {
            this.setState(AIState.ATTACK);
            this.target = monster;
            // Try to deploy dome when monster is close
            if (dist < 200 && !game.dome) {
                this.tryUseAbility('ability2', game);
            }
        } else if (canSee) {
            this.setState(AIState.CHASE);
            this.target = monster;
        } else {
            this.groupWithTeam(allies, monster);
        }
    }

    thinkMedic(monster, dist, health, allies, game, canSee) {
        // Priority: heal injured allies
        const injuredAlly = allies.find(a => a.health / a.maxHealth < 0.5);
        const criticalAlly = allies.find(a => a.health / a.maxHealth < 0.25);

        if (criticalAlly) {
            this.setState(AIState.HEAL);
            this.target = criticalAlly;
        } else if (injuredAlly) {
            this.setState(AIState.HEAL);
            this.target = injuredAlly;
        } else if (canSee && dist < 250) {
            this.setState(AIState.ATTACK);
            this.target = monster;
        } else {
            // Stay with team - medic should not be alone
            this.setState(AIState.SUPPORT);
            this.target = allies[0] || monster;
        }
    }

    thinkSupport(monster, dist, health, allies, game, canSee) {
        const targetedAlly = allies.find(a => a.health / a.maxHealth < 0.4);

        if (targetedAlly && Math.random() < this.mods.teamwork) {
            this.setState(AIState.SUPPORT);
            this.target = targetedAlly;
        } else if (canSee && dist < 300) {
            this.setState(AIState.ATTACK);
            this.target = monster;
        } else if (canSee) {
            this.setState(AIState.CHASE);
            this.target = monster;
        } else {
            this.groupWithTeam(allies, monster);
        }
    }

    groupWithTeam(allies, monster) {
        // Find center of team
        if (allies.length > 0) {
            let avgX = 0, avgY = 0;
            for (const ally of allies) {
                avgX += ally.x;
                avgY += ally.y;
            }
            avgX /= allies.length;
            avgY /= allies.length;

            const distToTeam = Utils.distance(this.entity.x, this.entity.y, avgX, avgY);
            if (distToTeam > 150) {
                this.setState(AIState.SUPPORT);
                this.target = { x: avgX, y: avgY, isAlive: true };
            } else {
                // Move toward monster's last known position
                this.setState(AIState.CHASE);
                this.target = monster;
            }
        } else {
            this.setState(AIState.CHASE);
            this.target = monster;
        }
    }

    executeState(dt, game) {
        switch (this.state) {
            case AIState.IDLE:
                this.stop();
                break;
            case AIState.PATROL:
                this.patrol(dt, game);
                break;
            case AIState.CHASE:
                this.chase(dt, game);
                break;
            case AIState.ATTACK:
                this.attackMonster(dt, game);
                break;
            case AIState.FLEE:
                this.flee(dt, game);
                break;
            case AIState.SUPPORT:
                this.support(dt, game);
                break;
            case AIState.HEAL:
                this.heal(dt, game);
                break;
        }
    }

    patrol(dt, game) {
        if (this.stateTimer > 1.5) {
            const angle = Math.random() * Math.PI * 2;
            const patrolX = this.entity.x + Math.cos(angle) * 200;
            const patrolY = this.entity.y + Math.sin(angle) * 200;
            this.moveToward(patrolX, patrolY, this.entity.speed * 0.3, game);
            this.stateTimer = 0;
        }
    }

    chase(dt, game) {
        if (!this.target) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();
        const optimalRange = this.getOptimalRange();

        if (dist < optimalRange && this.target.isAlive !== false) {
            this.setState(AIState.ATTACK);
            return;
        }

        this.moveToward(this.target.x, this.target.y, this.entity.speed, game);
    }

    attackMonster(dt, game) {
        if (!this.target || (this.target.isAlive !== undefined && !this.target.isAlive)) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();
        const optimalRange = this.getOptimalRange();

        // Face target
        this.entity.facingAngle = Utils.angle(this.entity.x, this.entity.y, this.target.x, this.target.y);

        // Use abilities
        const now = Date.now() / 1000;
        if (now - this.lastAbilityUse > this.abilityDelay) {
            // Primary attack with accuracy check
            if (Math.random() < this.mods.accuracy) {
                this.tryUseAbility('primary', game);
            }

            // Secondary abilities less often
            if (Math.random() < 0.15) {
                this.tryUseAbility('secondary', game);
            }
            if (Math.random() < 0.08) {
                this.tryUseAbility('ability1', game);
            }
            if (Math.random() < 0.05) {
                this.tryUseAbility('ability2', game);
            }

            this.lastAbilityUse = now;
        }

        // Maintain optimal range with strafing
        if (dist > optimalRange + 50) {
            this.moveToward(this.target.x, this.target.y, this.entity.speed * 0.6, game);
        } else if (dist < optimalRange - 50) {
            this.moveAway(this.target.x, this.target.y, this.entity.speed * 0.5, game);
        } else {
            // Strafe
            const time = Date.now() / 1000;
            const strafeDir = Math.sin(time * 2 + this.entity.id.charCodeAt(0)) > 0 ? 1 : -1;
            const strafeAngle = this.entity.facingAngle + (Math.PI / 2) * strafeDir;
            this.entity.vx = Math.cos(strafeAngle) * this.entity.speed * 0.35;
            this.entity.vy = Math.sin(strafeAngle) * this.entity.speed * 0.35;
        }

        // Use jetpack dodge when monster is too close (reactive)
        if (dist < 60 && this.entity.jetpackFuel >= 25 && this.entity.dodgeCooldown <= 0) {
            const awayAngle = Utils.angle(this.target.x, this.target.y, this.entity.x, this.entity.y);
            this.entity.jetpackBoost(Math.cos(awayAngle), Math.sin(awayAngle));
        }
    }

    flee(dt, game) {
        if (!this.target) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist > 350) {
            this.setState(AIState.CHASE);
            return;
        }

        this.moveAway(this.target.x, this.target.y, this.entity.speed, game);

        // Dodge boost while fleeing
        if (dist < 120 && this.entity.jetpackFuel >= 25 && this.entity.dodgeCooldown <= 0) {
            const awayAngle = Utils.angle(this.target.x, this.target.y, this.entity.x, this.entity.y);
            this.entity.jetpackBoost(Math.cos(awayAngle), Math.sin(awayAngle));
        }
    }

    support(dt, game) {
        if (!this.target || (this.target.isAlive !== undefined && !this.target.isAlive)) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        // Stay near ally
        if (dist > 120) {
            this.moveToward(this.target.x, this.target.y, this.entity.speed * 0.6, game);
        } else {
            // Use shield on ally
            this.tryUseAbility('secondary', game);
            // Use cloak if available
            if (Math.random() < 0.05) {
                this.tryUseAbility('ability1', game);
            }
        }

        // Also attack monster if nearby
        const monster = game.getMonster();
        if (monster && monster.isAlive) {
            const monsterDist = Utils.distance(this.entity.x, this.entity.y, monster.x, monster.y);
            if (monsterDist < 250) {
                this.entity.facingAngle = Utils.angle(this.entity.x, this.entity.y, monster.x, monster.y);
                this.tryUseAbility('primary', game);
            }
        }
    }

    heal(dt, game) {
        if (!this.target || !this.target.isAlive || this.target.health >= this.target.maxHealth * 0.85) {
            this.setState(AIState.PATROL);
            return;
        }

        const dist = this.getDistanceToTarget();

        if (dist > 120) {
            this.moveToward(this.target.x, this.target.y, this.entity.speed, game);
        } else {
            // Use healing abilities
            this.tryUseAbility('ability1', game); // Heal beam
            this.tryUseAbility('secondary', game); // Heal burst

            // Light movement to stay near target
            if (dist > 80) {
                this.moveToward(this.target.x, this.target.y, this.entity.speed * 0.3, game);
            } else {
                this.stop();
            }
        }
    }

    getOptimalRange() {
        switch (this.role) {
            case 'Damage Dealer':
                return 200;
            case 'Control Specialist':
                return 180;
            case 'Healer':
                return 220;
            case 'Buffer/Utility':
                return 150;
            default:
                return 180;
        }
    }

    tryUseAbility(abilityKey, game) {
        const ability = this.entity.abilities[abilityKey];
        if (ability && ability.canUse(this.entity)) {
            const target = this.target || {
                x: this.entity.x + Math.cos(this.entity.facingAngle) * 100,
                y: this.entity.y + Math.sin(this.entity.facingAngle) * 100
            };
            ability.use(this.entity, target, game);
            return true;
        }
        return false;
    }
}

// Export
window.AIState = AIState;
window.AIController = AIController;
window.MonsterAI = MonsterAI;
window.HunterAI = HunterAI;
