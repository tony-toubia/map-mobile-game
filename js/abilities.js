/**
 * Abilities System for Primal Hunt
 * Defines all abilities for Hunters and Monsters
 */

const AbilityType = {
    DAMAGE: 'damage',
    HEAL: 'heal',
    BUFF: 'buff',
    DEBUFF: 'debuff',
    UTILITY: 'utility',
    TRAP: 'trap',
    AREA: 'area',
    PROJECTILE: 'projectile'
};

/**
 * Base Ability class
 */
class Ability {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.icon = config.icon;
        this.type = config.type;
        this.cooldown = config.cooldown || 5;
        this.currentCooldown = 0;
        this.range = config.range || 100;
        this.damage = config.damage || 0;
        this.duration = config.duration || 0;
        this.cost = config.cost || 0; // Energy/stamina cost
        this.level = 1;
        this.maxLevel = config.maxLevel || 3;
        this.effect = config.effect || null;
    }

    canUse(user) {
        return this.currentCooldown <= 0 && user.energy >= this.cost;
    }

    use(user, target, game) {
        if (!this.canUse(user)) return false;

        this.currentCooldown = this.cooldown;
        user.energy -= this.cost;

        if (this.effect) {
            this.effect(user, target, game, this);
        }

        Audio.play('ability');
        return true;
    }

    update(dt) {
        if (this.currentCooldown > 0) {
            this.currentCooldown -= dt;
        }
    }

    upgrade() {
        if (this.level < this.maxLevel) {
            this.level++;
            this.damage *= 1.25;
            this.cooldown *= 0.85;
            if (this.duration > 0) this.duration *= 1.15;
            if (this.range > 0) this.range *= 1.1;
            return true;
        }
        return false;
    }

    getScaledDamage() {
        return Math.floor(this.damage * (1 + (this.level - 1) * 0.2));
    }
}

/**
 * Hunter Abilities Database
 */
const HunterAbilities = {
    // Assault Class Abilities
    assault: {
        primary: new Ability({
            id: 'assault_rifle',
            name: 'Assault Rifle',
            description: 'Rapid fire assault rifle dealing consistent damage',
            icon: '🔫',
            type: AbilityType.PROJECTILE,
            cooldown: 0.2,
            damage: 8,
            range: 400,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 800,
                    damage: ability.getScaledDamage(),
                    color: '#ffff00',
                    size: 4
                });
            }
        }),
        secondary: new Ability({
            id: 'grenade',
            name: 'Frag Grenade',
            description: 'Explosive grenade dealing area damage',
            icon: '💥',
            type: AbilityType.AREA,
            cooldown: 8,
            damage: 45,
            range: 300,
            effect: (user, target, game, ability) => {
                game.createExplosion(target.x, target.y, {
                    radius: 80,
                    damage: ability.getScaledDamage(),
                    color: '#ff6600'
                });
            }
        }),
        ability1: new Ability({
            id: 'damage_boost',
            name: 'Adrenaline Rush',
            description: 'Increase damage output for 5 seconds',
            icon: '⚡',
            type: AbilityType.BUFF,
            cooldown: 20,
            duration: 5,
            effect: (user, target, game, ability) => {
                user.addBuff({
                    id: 'damage_boost',
                    name: 'Adrenaline',
                    duration: ability.duration,
                    damageMultiplier: 1.5,
                    color: '#ff0000'
                });
            }
        }),
        ability2: new Ability({
            id: 'rocket',
            name: 'Rocket Launcher',
            description: 'Fire a devastating rocket',
            icon: '🚀',
            type: AbilityType.PROJECTILE,
            cooldown: 15,
            damage: 80,
            range: 500,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 400,
                    damage: ability.getScaledDamage(),
                    color: '#ff4400',
                    size: 10,
                    explosive: true,
                    explosionRadius: 60
                });
            }
        })
    },

    // Trapper Class Abilities
    trapper: {
        primary: new Ability({
            id: 'smg',
            name: 'SMG',
            description: 'Fast-firing submachine gun',
            icon: '🔫',
            type: AbilityType.PROJECTILE,
            cooldown: 0.15,
            damage: 5,
            range: 300,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 700,
                    damage: ability.getScaledDamage(),
                    color: '#00ff00',
                    size: 3
                });
            }
        }),
        secondary: new Ability({
            id: 'harpoon',
            name: 'Harpoon',
            description: 'Slows the monster significantly',
            icon: '🎣',
            type: AbilityType.DEBUFF,
            cooldown: 12,
            damage: 15,
            duration: 3,
            range: 350,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 600,
                    damage: ability.getScaledDamage(),
                    color: '#00ffff',
                    size: 6,
                    onHit: (hitTarget) => {
                        hitTarget.addDebuff({
                            id: 'slowed',
                            name: 'Harpooned',
                            duration: ability.duration,
                            speedMultiplier: 0.5,
                            color: '#00ffff'
                        });
                    }
                });
            }
        }),
        ability1: new Ability({
            id: 'trap',
            name: 'Bear Trap',
            description: 'Place a trap that immobilizes the monster',
            icon: '🪤',
            type: AbilityType.TRAP,
            cooldown: 18,
            damage: 20,
            duration: 2,
            effect: (user, target, game, ability) => {
                game.createTrap(target.x, target.y, {
                    radius: 40,
                    damage: ability.getScaledDamage(),
                    duration: ability.duration,
                    type: 'immobilize',
                    color: '#888888'
                });
            }
        }),
        ability2: new Ability({
            id: 'dome',
            name: 'Mobile Arena',
            description: 'Create a dome that prevents the monster from escaping',
            icon: '🔮',
            type: AbilityType.UTILITY,
            cooldown: 60,
            duration: 15,
            effect: (user, target, game, ability) => {
                game.createDome(user.x, user.y, {
                    radius: 250,
                    duration: ability.duration,
                    color: 'rgba(0, 200, 255, 0.3)'
                });
            }
        })
    },

    // Medic Class Abilities
    medic: {
        primary: new Ability({
            id: 'pistol',
            name: 'Pistol',
            description: 'Accurate semi-automatic pistol',
            icon: '🔫',
            type: AbilityType.PROJECTILE,
            cooldown: 0.4,
            damage: 12,
            range: 350,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 600,
                    damage: ability.getScaledDamage(),
                    color: '#ffffff',
                    size: 4
                });
            }
        }),
        secondary: new Ability({
            id: 'heal_burst',
            name: 'Heal Burst',
            description: 'Heal all nearby allies',
            icon: '💚',
            type: AbilityType.HEAL,
            cooldown: 15,
            damage: -40, // Negative = healing
            range: 150,
            effect: (user, target, game, ability) => {
                const healAmount = Math.abs(ability.getScaledDamage());
                game.healAlliesInRange(user, ability.range, healAmount);
                game.createHealEffect(user.x, user.y, ability.range);
                Audio.play('heal');
            }
        }),
        ability1: new Ability({
            id: 'heal_beam',
            name: 'Healing Beam',
            description: 'Continuous healing beam to target ally',
            icon: '💉',
            type: AbilityType.HEAL,
            cooldown: 0.5,
            damage: -5,
            range: 200,
            effect: (user, target, game, ability) => {
                if (target && target.team === user.team) {
                    target.heal(Math.abs(ability.getScaledDamage()));
                    game.createBeam(user, target, '#00ff00');
                }
            }
        }),
        ability2: new Ability({
            id: 'revive',
            name: 'Revive',
            description: 'Revive a downed teammate',
            icon: '❤️‍🔥',
            type: AbilityType.UTILITY,
            cooldown: 30,
            range: 100,
            effect: (user, target, game, ability) => {
                const downed = game.getDownedAllyInRange(user, ability.range);
                if (downed) {
                    downed.revive();
                    game.createHealEffect(downed.x, downed.y, 50);
                }
            }
        })
    },

    // Support Class Abilities
    support: {
        primary: new Ability({
            id: 'shotgun',
            name: 'Shotgun',
            description: 'Powerful close-range shotgun',
            icon: '🔫',
            type: AbilityType.PROJECTILE,
            cooldown: 0.8,
            damage: 35,
            range: 200,
            effect: (user, target, game, ability) => {
                // Shotgun fires multiple pellets
                for (let i = 0; i < 5; i++) {
                    const spread = (Math.random() - 0.5) * 0.3;
                    game.createProjectile(user, target, {
                        speed: 500,
                        damage: Math.floor(ability.getScaledDamage() / 5),
                        color: '#ffaa00',
                        size: 3,
                        spread: spread
                    });
                }
            }
        }),
        secondary: new Ability({
            id: 'shield',
            name: 'Shield Projector',
            description: 'Project a shield on an ally',
            icon: '🛡️',
            type: AbilityType.BUFF,
            cooldown: 12,
            duration: 4,
            range: 200,
            effect: (user, target, game, ability) => {
                if (target && target.team === user.team) {
                    target.addBuff({
                        id: 'shielded',
                        name: 'Shielded',
                        duration: ability.duration,
                        shield: 50,
                        color: '#00aaff'
                    });
                    game.createShieldEffect(target);
                }
            }
        }),
        ability1: new Ability({
            id: 'cloak',
            name: 'Cloaking Field',
            description: 'Make all nearby allies invisible briefly',
            icon: '👻',
            type: AbilityType.UTILITY,
            cooldown: 35,
            duration: 5,
            range: 150,
            effect: (user, target, game, ability) => {
                game.cloakAlliesInRange(user, ability.range, ability.duration);
            }
        }),
        ability2: new Ability({
            id: 'orbital',
            name: 'Orbital Strike',
            description: 'Call in an orbital bombardment',
            icon: '☄️',
            type: AbilityType.AREA,
            cooldown: 45,
            damage: 100,
            range: 400,
            effect: (user, target, game, ability) => {
                game.createOrbitalStrike(target.x, target.y, {
                    radius: 100,
                    damage: ability.getScaledDamage(),
                    delay: 2
                });
            }
        })
    }
};

/**
 * Monster Abilities Database
 */
const MonsterAbilities = {
    // Goliath - Heavy Brawler
    goliath: {
        primary: new Ability({
            id: 'melee',
            name: 'Claw Strike',
            description: 'Powerful melee attack',
            icon: '👊',
            type: AbilityType.DAMAGE,
            cooldown: 0.6,
            damage: 25,
            range: 60,
            effect: (user, target, game, ability) => {
                const enemies = game.getEnemiesInRange(user, ability.range);
                enemies.forEach(enemy => {
                    enemy.takeDamage(ability.getScaledDamage(), user);
                });
                game.createMeleeEffect(user, ability.range);
            }
        }),
        ability1: new Ability({
            id: 'rock_throw',
            name: 'Rock Throw',
            description: 'Hurl a massive boulder at hunters',
            icon: '🪨',
            type: AbilityType.PROJECTILE,
            cooldown: 8,
            damage: 50,
            range: 400,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 350,
                    damage: ability.getScaledDamage(),
                    color: '#666666',
                    size: 20,
                    explosive: true,
                    explosionRadius: 50
                });
            }
        }),
        ability2: new Ability({
            id: 'leap_smash',
            name: 'Leap Smash',
            description: 'Leap to target location and smash the ground',
            icon: '💨',
            type: AbilityType.AREA,
            cooldown: 12,
            damage: 60,
            range: 300,
            effect: (user, target, game, ability) => {
                game.leapTo(user, target.x, target.y, () => {
                    game.createExplosion(user.x, user.y, {
                        radius: 100,
                        damage: ability.getScaledDamage(),
                        color: '#8B4513'
                    });
                });
            }
        }),
        ability3: new Ability({
            id: 'fire_breath',
            name: 'Fire Breath',
            description: 'Breathe fire in a cone',
            icon: '🔥',
            type: AbilityType.AREA,
            cooldown: 10,
            damage: 40,
            range: 150,
            effect: (user, target, game, ability) => {
                game.createConeAttack(user, target, {
                    angle: 60,
                    range: ability.range,
                    damage: ability.getScaledDamage(),
                    color: '#ff4400',
                    duration: 0.5
                });
            }
        }),
        ability4: new Ability({
            id: 'charge',
            name: 'Charge',
            description: 'Charge forward, knocking back hunters',
            icon: '🦏',
            type: AbilityType.UTILITY,
            cooldown: 15,
            damage: 35,
            range: 250,
            effect: (user, target, game, ability) => {
                game.charge(user, target, {
                    speed: 600,
                    damage: ability.getScaledDamage(),
                    knockback: 100
                });
            }
        })
    },

    // Kraken - Flying Ranged
    kraken: {
        primary: new Ability({
            id: 'ranged_attack',
            name: 'Lightning Strike',
            description: 'Ranged lightning attack',
            icon: '⚡',
            type: AbilityType.PROJECTILE,
            cooldown: 0.8,
            damage: 20,
            range: 350,
            effect: (user, target, game, ability) => {
                game.createProjectile(user, target, {
                    speed: 500,
                    damage: ability.getScaledDamage(),
                    color: '#00ffff',
                    size: 8
                });
            }
        }),
        ability1: new Ability({
            id: 'banshee_mines',
            name: 'Banshee Mines',
            description: 'Deploy floating mines that home in on hunters',
            icon: '💣',
            type: AbilityType.TRAP,
            cooldown: 10,
            damage: 30,
            effect: (user, target, game, ability) => {
                for (let i = 0; i < 3; i++) {
                    game.createHomingMine(user.x, user.y, {
                        damage: ability.getScaledDamage(),
                        speed: 150,
                        lifespan: 10
                    });
                }
            }
        }),
        ability2: new Ability({
            id: 'lightning_storm',
            name: 'Lightning Storm',
            description: 'Call down lightning in an area',
            icon: '🌩️',
            type: AbilityType.AREA,
            cooldown: 14,
            damage: 70,
            range: 300,
            effect: (user, target, game, ability) => {
                game.createLightningStorm(target.x, target.y, {
                    radius: 120,
                    damage: ability.getScaledDamage(),
                    strikes: 5,
                    duration: 2
                });
            }
        }),
        ability3: new Ability({
            id: 'aftershock',
            name: 'Aftershock',
            description: 'Release a pulse of energy around you',
            icon: '💫',
            type: AbilityType.AREA,
            cooldown: 8,
            damage: 45,
            range: 120,
            effect: (user, target, game, ability) => {
                game.createExplosion(user.x, user.y, {
                    radius: ability.range,
                    damage: ability.getScaledDamage(),
                    color: '#9900ff'
                });
            }
        }),
        ability4: new Ability({
            id: 'vortex',
            name: 'Vortex',
            description: 'Create a vortex that pulls in hunters',
            icon: '🌀',
            type: AbilityType.UTILITY,
            cooldown: 18,
            duration: 3,
            range: 200,
            effect: (user, target, game, ability) => {
                game.createVortex(target.x, target.y, {
                    radius: ability.range,
                    duration: ability.duration,
                    pullStrength: 200
                });
            }
        })
    },

    // Wraith - Stealthy Assassin
    wraith: {
        primary: new Ability({
            id: 'slash',
            name: 'Scythe Slash',
            description: 'Quick slashing attack',
            icon: '⚔️',
            type: AbilityType.DAMAGE,
            cooldown: 0.4,
            damage: 18,
            range: 50,
            effect: (user, target, game, ability) => {
                const enemies = game.getEnemiesInRange(user, ability.range);
                enemies.forEach(enemy => {
                    enemy.takeDamage(ability.getScaledDamage(), user);
                });
                game.createSlashEffect(user);
            }
        }),
        ability1: new Ability({
            id: 'warp_blast',
            name: 'Warp Blast',
            description: 'Teleport and explode at target location',
            icon: '✨',
            type: AbilityType.AREA,
            cooldown: 6,
            damage: 55,
            range: 250,
            effect: (user, target, game, ability) => {
                game.teleportTo(user, target.x, target.y, () => {
                    game.createExplosion(user.x, user.y, {
                        radius: 80,
                        damage: ability.getScaledDamage(),
                        color: '#ff00ff'
                    });
                });
            }
        }),
        ability2: new Ability({
            id: 'abduction',
            name: 'Abduction',
            description: 'Grab a hunter and drag them to you',
            icon: '👻',
            type: AbilityType.UTILITY,
            cooldown: 14,
            damage: 25,
            range: 300,
            effect: (user, target, game, ability) => {
                game.createAbduction(user, target, {
                    damage: ability.getScaledDamage(),
                    range: ability.range
                });
            }
        }),
        ability3: new Ability({
            id: 'supernova',
            name: 'Supernova',
            description: 'Create a damage field and attack rapidly',
            icon: '💥',
            type: AbilityType.BUFF,
            cooldown: 20,
            duration: 4,
            effect: (user, target, game, ability) => {
                user.addBuff({
                    id: 'supernova',
                    name: 'Supernova',
                    duration: ability.duration,
                    attackSpeedMultiplier: 2.5,
                    color: '#ff00ff'
                });
                game.createSupernova(user, ability.duration);
            }
        }),
        ability4: new Ability({
            id: 'decoy',
            name: 'Decoy',
            description: 'Create a decoy and become invisible',
            icon: '🎭',
            type: AbilityType.UTILITY,
            cooldown: 25,
            duration: 5,
            effect: (user, target, game, ability) => {
                game.createDecoy(user, ability.duration);
                user.addBuff({
                    id: 'invisible',
                    name: 'Invisible',
                    duration: ability.duration,
                    invisible: true,
                    color: 'transparent'
                });
            }
        })
    },

    // Behemoth - Massive Tank
    behemoth: {
        primary: new Ability({
            id: 'smash',
            name: 'Heavy Smash',
            description: 'Devastating ground slam',
            icon: '👊',
            type: AbilityType.DAMAGE,
            cooldown: 1.0,
            damage: 40,
            range: 80,
            effect: (user, target, game, ability) => {
                const enemies = game.getEnemiesInRange(user, ability.range);
                enemies.forEach(enemy => {
                    enemy.takeDamage(ability.getScaledDamage(), user);
                });
                game.createShockwave(user, ability.range);
            }
        }),
        ability1: new Ability({
            id: 'lava_bomb',
            name: 'Lava Bomb',
            description: 'Launch lava bombs that leave burning pools',
            icon: '🌋',
            type: AbilityType.AREA,
            cooldown: 10,
            damage: 45,
            range: 350,
            effect: (user, target, game, ability) => {
                game.createLavaBomb(user, target, {
                    damage: ability.getScaledDamage(),
                    poolDuration: 5,
                    poolDamage: 10
                });
            }
        }),
        ability2: new Ability({
            id: 'rock_wall',
            name: 'Rock Wall',
            description: 'Create a wall of rock',
            icon: '🧱',
            type: AbilityType.UTILITY,
            cooldown: 16,
            duration: 8,
            range: 200,
            effect: (user, target, game, ability) => {
                game.createRockWall(user, target, {
                    width: 200,
                    duration: ability.duration
                });
            }
        }),
        ability3: new Ability({
            id: 'tongue_grab',
            name: 'Tongue Grab',
            description: 'Pull a hunter towards you',
            icon: '👅',
            type: AbilityType.UTILITY,
            cooldown: 12,
            damage: 20,
            range: 300,
            effect: (user, target, game, ability) => {
                game.createTongueGrab(user, target, {
                    damage: ability.getScaledDamage(),
                    pullSpeed: 400
                });
            }
        }),
        ability4: new Ability({
            id: 'roll',
            name: 'Roll',
            description: 'Roll into a ball and crush hunters',
            icon: '🏃',
            type: AbilityType.UTILITY,
            cooldown: 8,
            damage: 30,
            effect: (user, target, game, ability) => {
                game.startRoll(user, target, {
                    speed: 500,
                    damage: ability.getScaledDamage(),
                    duration: 3
                });
            }
        })
    }
};

/**
 * Get abilities for a character
 */
function getAbilitiesForCharacter(role, characterId) {
    if (role === 'hunter') {
        return HunterAbilities[characterId] || null;
    } else if (role === 'monster') {
        return MonsterAbilities[characterId] || null;
    }
    return null;
}

/**
 * Clone abilities (for new instances)
 */
function cloneAbilities(abilities) {
    const cloned = {};
    for (const key in abilities) {
        cloned[key] = new Ability({
            id: abilities[key].id,
            name: abilities[key].name,
            description: abilities[key].description,
            icon: abilities[key].icon,
            type: abilities[key].type,
            cooldown: abilities[key].cooldown,
            damage: abilities[key].damage,
            range: abilities[key].range,
            duration: abilities[key].duration,
            cost: abilities[key].cost,
            maxLevel: abilities[key].maxLevel,
            effect: abilities[key].effect
        });
    }
    return cloned;
}

// Export
window.AbilityType = AbilityType;
window.Ability = Ability;
window.HunterAbilities = HunterAbilities;
window.MonsterAbilities = MonsterAbilities;
window.getAbilitiesForCharacter = getAbilitiesForCharacter;
window.cloneAbilities = cloneAbilities;
