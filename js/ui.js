/**
 * UI System for Primal Hunt
 * Handles all user interface elements and interactions
 */

class UIManager {
    constructor() {
        this.currentScreen = 'main-menu';
        this.selectedRole = null;
        this.selectedCharacter = null;

        // Screen elements
        this.screens = {
            mainMenu: document.getElementById('main-menu'),
            roleSelect: document.getElementById('role-select'),
            hunterSelect: document.getElementById('hunter-select'),
            monsterSelect: document.getElementById('monster-select'),
            gameScreen: document.getElementById('game-screen'),
            upgradeScreen: document.getElementById('upgrade-screen'),
            gameOver: document.getElementById('game-over'),
            howToPlay: document.getElementById('how-to-play'),
            settings: document.getElementById('settings'),
            loading: document.getElementById('loading-screen')
        };

        // HUD elements
        this.hud = {
            healthBar: document.getElementById('player-health'),
            healthText: document.getElementById('health-text'),
            timer: document.getElementById('game-timer'),
            evolutionIndicator: document.getElementById('evolution-indicator'),
            evoProgress: document.getElementById('evo-progress'),
            abilityBar: document.getElementById('ability-bar'),
            pauseMenu: document.getElementById('pause-menu')
        };

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Main Menu
        document.getElementById('btn-play').addEventListener('click', () => {
            Audio.init();
            Audio.play('click');
            this.showScreen('role-select');
        });

        document.getElementById('btn-how-to-play').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('how-to-play');
        });

        document.getElementById('btn-settings').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('settings');
        });

        // Role Selection
        document.getElementById('btn-back-role').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('main-menu');
        });

        document.getElementById('select-hunter').addEventListener('click', () => {
            Audio.play('click');
            this.selectedRole = 'hunter';
            this.showScreen('hunter-select');
            this.populateHunterGrid();
        });

        document.getElementById('select-monster').addEventListener('click', () => {
            Audio.play('click');
            this.selectedRole = 'monster';
            this.showScreen('monster-select');
            this.populateMonsterGrid();
        });

        // Hunter Selection
        document.getElementById('btn-back-hunter').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('role-select');
        });

        document.getElementById('btn-confirm-hunter').addEventListener('click', () => {
            if (this.selectedCharacter) {
                Audio.play('click');
                this.startGame();
            }
        });

        // Monster Selection
        document.getElementById('btn-back-monster').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('role-select');
        });

        document.getElementById('btn-confirm-monster').addEventListener('click', () => {
            if (this.selectedCharacter) {
                Audio.play('click');
                this.startGame();
            }
        });

        // Game Screen
        document.getElementById('btn-pause').addEventListener('click', () => {
            Audio.play('click');
            this.togglePause();
        });

        document.getElementById('btn-resume').addEventListener('click', () => {
            Audio.play('click');
            this.togglePause();
        });

        document.getElementById('btn-upgrades').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('upgrade-screen');
            this.populateUpgradeTree();
        });

        document.getElementById('btn-quit').addEventListener('click', () => {
            Audio.play('click');
            if (window.game) window.game.stop();
            this.showScreen('main-menu');
        });

        // Upgrade Screen
        document.getElementById('btn-back-upgrade').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('game-screen');
        });

        document.getElementById('btn-apply-upgrades').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('game-screen');
            if (window.game) window.game.resume();
        });

        // Game Over
        document.getElementById('btn-play-again').addEventListener('click', () => {
            Audio.play('click');
            this.startGame();
        });

        document.getElementById('btn-main-menu').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('main-menu');
        });

        // Help & Settings Back
        document.getElementById('btn-back-help').addEventListener('click', () => {
            Audio.play('click');
            this.showScreen('main-menu');
        });

        document.getElementById('btn-back-settings').addEventListener('click', () => {
            Audio.play('click');
            GameSettings.save();
            this.showScreen('main-menu');
        });

        // Settings Controls
        document.getElementById('sfx-volume').addEventListener('input', (e) => {
            GameSettings.sfxVolume = e.target.value / 100;
            Audio.setSFXVolume(GameSettings.sfxVolume);
        });

        document.getElementById('music-volume').addEventListener('input', (e) => {
            GameSettings.musicVolume = e.target.value / 100;
            Audio.setMusicVolume(GameSettings.musicVolume);
        });

        document.getElementById('vibration-toggle').addEventListener('change', (e) => {
            GameSettings.vibration = e.target.checked;
        });

        document.getElementById('fps-toggle').addEventListener('change', (e) => {
            GameSettings.showFPS = e.target.checked;
        });

        document.getElementById('difficulty-select').addEventListener('change', (e) => {
            GameSettings.difficulty = e.target.value;
        });

        // Load settings
        this.loadSettings();
    }

    showScreen(screenId) {
        // Hide all screens
        for (const screen of Object.values(this.screens)) {
            screen.classList.remove('active');
        }

        // Show target screen
        const targetScreen = this.screens[this.screenIdToKey(screenId)];
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
        }
    }

    screenIdToKey(id) {
        const mapping = {
            'main-menu': 'mainMenu',
            'role-select': 'roleSelect',
            'hunter-select': 'hunterSelect',
            'monster-select': 'monsterSelect',
            'game-screen': 'gameScreen',
            'upgrade-screen': 'upgradeScreen',
            'game-over': 'gameOver',
            'how-to-play': 'howToPlay',
            'settings': 'settings',
            'loading': 'loading'
        };
        return mapping[id] || id;
    }

    populateHunterGrid() {
        const grid = document.getElementById('hunter-grid');
        grid.innerHTML = '';

        for (const key in HunterClasses) {
            const hunter = HunterClasses[key];
            const card = this.createCharacterCard(hunter, 'hunter');
            grid.appendChild(card);
        }
    }

    populateMonsterGrid() {
        const grid = document.getElementById('monster-grid');
        grid.innerHTML = '';

        for (const key in MonsterTypes) {
            const monster = MonsterTypes[key];
            const card = this.createCharacterCard(monster, 'monster');
            grid.appendChild(card);
        }
    }

    createCharacterCard(character, type) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.characterId = character.id;

        card.innerHTML = `
            <div class="char-icon">${character.icon}</div>
            <div class="char-name">${character.name}</div>
            <div class="char-role">${character.role || character.description.substring(0, 30)}...</div>
        `;

        card.addEventListener('click', () => {
            Audio.play('click');
            this.selectCharacter(character, type, card);
        });

        return card;
    }

    selectCharacter(character, type, cardElement) {
        // Deselect all cards
        const cards = document.querySelectorAll('.character-card');
        cards.forEach(c => c.classList.remove('selected'));

        // Select this card
        cardElement.classList.add('selected');
        this.selectedCharacter = character;

        // Update info panel
        this.updateCharacterInfo(character, type);

        // Enable confirm button
        const confirmBtn = type === 'hunter'
            ? document.getElementById('btn-confirm-hunter')
            : document.getElementById('btn-confirm-monster');
        confirmBtn.disabled = false;
    }

    updateCharacterInfo(character, type) {
        const prefix = type === 'hunter' ? 'hunter' : 'monster';
        document.getElementById(`${prefix}-name`).textContent = character.name;
        document.getElementById(`${prefix}-desc`).textContent = character.description;

        // Stats
        const statsContainer = document.getElementById(`${prefix}-stats`);
        const stats = character.stats;
        statsContainer.innerHTML = `
            <div class="stat-bar">
                <div class="stat-label">HEALTH</div>
                <div class="stat-fill-bg">
                    <div class="stat-fill" style="width: ${(stats.maxHealth / 300) * 100}%; background: #e74c3c;"></div>
                </div>
            </div>
            <div class="stat-bar">
                <div class="stat-label">DAMAGE</div>
                <div class="stat-fill-bg">
                    <div class="stat-fill" style="width: ${(stats.damage / 40) * 100}%; background: #f39c12;"></div>
                </div>
            </div>
            <div class="stat-bar">
                <div class="stat-label">SPEED</div>
                <div class="stat-fill-bg">
                    <div class="stat-fill" style="width: ${(stats.speed / 200) * 100}%; background: #3498db;"></div>
                </div>
            </div>
            <div class="stat-bar">
                <div class="stat-label">ARMOR</div>
                <div class="stat-fill-bg">
                    <div class="stat-fill" style="width: ${(stats.armor / 30) * 100}%; background: #9b59b6;"></div>
                </div>
            </div>
        `;

        // Abilities
        const abilitiesContainer = document.getElementById(`${prefix}-abilities`);
        const abilities = getAbilitiesForCharacter(type, character.id);
        abilitiesContainer.innerHTML = '';

        if (abilities) {
            for (const key in abilities) {
                const ability = abilities[key];
                const preview = document.createElement('div');
                preview.className = 'ability-preview';
                preview.innerHTML = `${ability.icon} ${ability.name}`;
                preview.title = ability.description;
                abilitiesContainer.appendChild(preview);
            }
        }
    }

    startGame() {
        this.showScreen('loading');

        // Simulate loading
        const loadingProgress = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');

        let progress = 0;
        const loadingSteps = [
            'Generating terrain...',
            'Spawning wildlife...',
            'Preparing hunters...',
            'Awakening the monster...',
            'Starting the hunt!'
        ];

        const loadingInterval = setInterval(() => {
            progress += Utils.randomInt(5, 15);
            if (progress > 100) progress = 100;

            loadingProgress.style.width = `${progress}%`;
            loadingText.textContent = loadingSteps[Math.floor(progress / 25)] || loadingSteps[0];

            if (progress >= 100) {
                clearInterval(loadingInterval);
                setTimeout(() => {
                    this.showScreen('game-screen');

                    // Initialize game
                    if (!window.game) {
                        window.game = new Game();
                    }

                    window.game.init(this.selectedRole, this.selectedCharacter);
                    window.game.start();
                }, 500);
            }
        }, 100);
    }

    togglePause() {
        const pauseMenu = this.hud.pauseMenu;
        pauseMenu.classList.toggle('hidden');

        if (window.game) {
            if (pauseMenu.classList.contains('hidden')) {
                window.game.resume();
            } else {
                window.game.pause();
            }
        }
    }

    updateHUD(player, gameTime) {
        // Health
        const healthPercent = (player.health / player.maxHealth) * 100;
        this.hud.healthBar.style.width = `${healthPercent}%`;

        // Color health bar based on percentage
        if (healthPercent > 50) {
            this.hud.healthBar.style.background = 'linear-gradient(90deg, #2ed573, #7bed9f)';
        } else if (healthPercent > 25) {
            this.hud.healthBar.style.background = 'linear-gradient(90deg, #ffa502, #ff6348)';
        } else {
            this.hud.healthBar.style.background = 'linear-gradient(90deg, #ff4757, #ff6b81)';
        }

        this.hud.healthText.textContent = `${Math.floor(player.health)}/${player.maxHealth}`;

        // Timer
        this.hud.timer.textContent = Utils.formatTime(gameTime);

        // Monster-specific HUD
        if (player instanceof Monster) {
            this.hud.evolutionIndicator.style.display = 'block';

            // Evolution info
            const stageText = player.isEvolving ? 'EVOLVING...' : `Stage ${player.evolutionStage}`;
            this.hud.evolutionIndicator.querySelector('.evo-stage').textContent = stageText;

            if (player.pendingEvolution && !player.isEvolving) {
                this.hud.evoProgress.style.width = '100%';
                this.hud.evoProgress.style.background = '#ff00ff';
            } else if (player.isEvolving) {
                const evoPct = (player.evolveTimer / player.evolveDuration) * 100;
                this.hud.evoProgress.style.width = `${evoPct}%`;
                this.hud.evoProgress.style.background = '#ff00ff';
            } else {
                this.hud.evoProgress.style.width = `${player.getEvolutionPercent()}%`;
                this.hud.evoProgress.style.background = '';
            }

            // Armor display
            if (player.monsterArmor > 0) {
                this.hud.healthText.textContent = `${Math.floor(player.health)}/${player.maxHealth} | Armor: ${Math.floor(player.monsterArmor)}`;
            }
        } else {
            this.hud.evolutionIndicator.style.display = 'none';
        }

        // Hunter-specific HUD (jetpack fuel)
        if (player instanceof Hunter) {
            this.hud.healthText.textContent = `${Math.floor(player.health)}/${player.maxHealth} | Fuel: ${Math.floor(player.jetpackFuel)}%`;
        }

        // Power relay health (when active)
        if (window.game && window.game.powerRelay && window.game.powerRelay.active) {
            const relay = window.game.powerRelay;
            const relayPct = Math.floor((relay.health / relay.maxHealth) * 100);
            this.hud.timer.textContent = Utils.formatTime(gameTime) + ` | Relay: ${relayPct}%`;
        }
    }

    updateAbilityBar(player) {
        const bar = this.hud.abilityBar;
        bar.innerHTML = '';

        const abilityKeys = ['primary', 'secondary', 'ability1', 'ability2'];
        const keyLabels = ['1', '2', '3', '4'];

        abilityKeys.forEach((key, index) => {
            const ability = player.abilities[key];
            if (!ability) return;

            const btn = document.createElement('button');
            btn.className = 'ability-btn';
            if (ability.currentCooldown > 0) {
                btn.classList.add('on-cooldown');
            }

            btn.innerHTML = `
                <span class="ability-icon">${ability.icon}</span>
                <span class="ability-key">${keyLabels[index]}</span>
                ${ability.currentCooldown > 0 ? `<span class="cooldown-overlay">${Math.ceil(ability.currentCooldown)}s</span>` : ''}
            `;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (window.game) {
                    window.game.useAbility(key);
                }
            });

            btn.addEventListener('click', () => {
                if (window.game) {
                    window.game.useAbility(key);
                }
            });

            bar.appendChild(btn);
        });

        // Add special abilities for monster
        if (player instanceof Monster && player.abilities.ability3) {
            const specialKeys = ['ability3', 'ability4'];
            const specialLabels = ['5', '6'];

            specialKeys.forEach((key, index) => {
                const ability = player.abilities[key];
                if (!ability) return;

                const btn = document.createElement('button');
                btn.className = 'ability-btn';
                if (ability.currentCooldown > 0) {
                    btn.classList.add('on-cooldown');
                }

                btn.innerHTML = `
                    <span class="ability-icon">${ability.icon}</span>
                    <span class="ability-key">${specialLabels[index]}</span>
                    ${ability.currentCooldown > 0 ? `<span class="cooldown-overlay">${Math.ceil(ability.currentCooldown)}s</span>` : ''}
                `;

                btn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (window.game) {
                        window.game.useAbility(key);
                    }
                });

                bar.appendChild(btn);
            });
        }

        // Add special action buttons
        if (player instanceof Monster) {
            // Sneak button
            const sneakBtn = document.createElement('button');
            sneakBtn.className = `ability-btn ${player.sneaking ? 'active-ability' : ''}`;
            sneakBtn.innerHTML = `<span class="ability-icon">🐾</span><span class="ability-key">Snk</span>`;
            sneakBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                player.toggleSneak();
            });
            sneakBtn.addEventListener('click', () => player.toggleSneak());
            bar.appendChild(sneakBtn);

            // Smell button
            const smellBtn = document.createElement('button');
            const smellReady = player.smellCooldown <= 0;
            smellBtn.className = `ability-btn ${!smellReady ? 'on-cooldown' : ''} ${player.smellActive ? 'active-ability' : ''}`;
            smellBtn.innerHTML = `<span class="ability-icon">👃</span><span class="ability-key">Q</span>
                ${!smellReady ? `<span class="cooldown-overlay">${Math.ceil(player.smellCooldown)}s</span>` : ''}`;
            smellBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                player.useSmell();
            });
            smellBtn.addEventListener('click', () => player.useSmell());
            bar.appendChild(smellBtn);

            // Evolve button (when ready)
            if (player.pendingEvolution && !player.isEvolving) {
                const evolveBtn = document.createElement('button');
                evolveBtn.className = 'ability-btn evolve-ready';
                evolveBtn.innerHTML = `<span class="ability-icon">🧬</span><span class="ability-key">E</span>`;
                evolveBtn.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    player.startEvolution();
                    window.ui.showToast('Evolving! Stay hidden for 5 seconds...');
                });
                evolveBtn.addEventListener('click', () => {
                    player.startEvolution();
                    window.ui.showToast('Evolving! Stay hidden for 5 seconds...');
                });
                bar.appendChild(evolveBtn);
            }
        }

        // Dodge/boost button for hunters
        if (player instanceof Hunter) {
            const dodgeBtn = document.createElement('button');
            const canDodge = player.jetpackFuel >= 25 && player.dodgeCooldown <= 0;
            dodgeBtn.className = `ability-btn ${!canDodge ? 'on-cooldown' : ''}`;
            dodgeBtn.innerHTML = `<span class="ability-icon">💨</span><span class="ability-key">Sft</span>
                ${!canDodge && player.dodgeCooldown > 0 ? `<span class="cooldown-overlay">${Math.ceil(player.dodgeCooldown)}s</span>` : ''}`;
            dodgeBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const dir = player.direction;
                player.jetpackBoost(dir.x || 0, dir.y || 1);
            });
            dodgeBtn.addEventListener('click', () => {
                const dir = player.direction;
                player.jetpackBoost(dir.x || 0, dir.y || 1);
            });
            bar.appendChild(dodgeBtn);
        }
    }

    populateUpgradeTree() {
        const tree = document.getElementById('skill-tree');
        tree.innerHTML = '';

        if (!window.game || !window.game.player) return;

        const player = window.game.player;
        const points = player.upgradePoints || 0;
        document.getElementById('upgrade-points').textContent = points;

        // Create upgrade categories
        const categories = {
            'Combat': [
                { id: 'damage', name: 'Damage Boost', desc: '+10% damage', cost: 1, icon: '⚔️' },
                { id: 'critChance', name: 'Critical Strike', desc: '+5% crit chance', cost: 2, icon: '💥' },
                { id: 'attackSpeed', name: 'Attack Speed', desc: '+10% attack speed', cost: 1, icon: '⚡' }
            ],
            'Defense': [
                { id: 'health', name: 'Vitality', desc: '+20 max health', cost: 1, icon: '❤️' },
                { id: 'armor', name: 'Thick Skin', desc: '+5 armor', cost: 2, icon: '🛡️' },
                { id: 'regen', name: 'Regeneration', desc: '+2 health/sec', cost: 2, icon: '💚' }
            ],
            'Utility': [
                { id: 'speed', name: 'Swift', desc: '+10% movement speed', cost: 1, icon: '🏃' },
                { id: 'energy', name: 'Stamina', desc: '+20 max energy', cost: 1, icon: '🔋' },
                { id: 'cooldown', name: 'Quick Recovery', desc: '-10% cooldowns', cost: 2, icon: '⏱️' }
            ]
        };

        for (const [categoryName, skills] of Object.entries(categories)) {
            const category = document.createElement('div');
            category.className = 'skill-category';
            category.innerHTML = `<h3>${categoryName}</h3>`;

            const skillList = document.createElement('div');
            skillList.className = 'skill-list';

            for (const skill of skills) {
                const unlocked = player.upgrades && player.upgrades[skill.id];
                const canAfford = points >= skill.cost;

                const item = document.createElement('div');
                item.className = `skill-item ${unlocked ? 'unlocked' : ''} ${!canAfford && !unlocked ? 'locked' : ''}`;

                item.innerHTML = `
                    <div class="skill-icon">${skill.icon}</div>
                    <div class="skill-info">
                        <h4>${skill.name}</h4>
                        <p>${skill.desc}</p>
                    </div>
                    ${!unlocked ? `<div class="skill-cost">${skill.cost}</div>` : '<div class="skill-cost" style="background: #2ed573;">✓</div>'}
                `;

                if (!unlocked && canAfford) {
                    item.addEventListener('click', () => {
                        Audio.play('ability');
                        this.purchaseUpgrade(skill.id, skill.cost);
                        this.populateUpgradeTree();
                    });
                }

                skillList.appendChild(item);
            }

            category.appendChild(skillList);
            tree.appendChild(category);
        }
    }

    purchaseUpgrade(skillId, cost) {
        if (!window.game || !window.game.player) return;

        const player = window.game.player;
        if (!player.upgradePoints || player.upgradePoints < cost) return;

        player.upgradePoints -= cost;
        if (!player.upgrades) player.upgrades = {};
        player.upgrades[skillId] = true;

        // Apply upgrade
        switch (skillId) {
            case 'damage':
                player.damage *= 1.1;
                break;
            case 'health':
                player.maxHealth += 20;
                player.health += 20;
                break;
            case 'armor':
                player.armor += 5;
                break;
            case 'speed':
                player.speed *= 1.1;
                break;
            case 'energy':
                player.maxEnergy += 20;
                break;
        }
    }

    showGameOver(victory, stats) {
        this.showScreen('game-over');

        const result = document.getElementById('game-result');
        const summary = document.getElementById('game-summary');
        const statsDiv = document.getElementById('end-stats');

        result.textContent = victory ? 'VICTORY' : 'DEFEAT';
        result.className = victory ? 'victory' : 'defeat';

        if (victory) {
            summary.textContent = this.selectedRole === 'monster'
                ? 'You eliminated all hunters!'
                : 'The monster has been captured!';
            Audio.play('victory');
        } else {
            summary.textContent = this.selectedRole === 'monster'
                ? 'You were captured by the hunters!'
                : 'The monster has evolved and escaped!';
            Audio.play('defeat');
        }

        statsDiv.innerHTML = `
            <div class="stat-row">
                <span class="label">Time Survived</span>
                <span class="value">${Utils.formatTime(stats.time)}</span>
            </div>
            <div class="stat-row">
                <span class="label">Damage Dealt</span>
                <span class="value">${stats.damageDealt}</span>
            </div>
            <div class="stat-row">
                <span class="label">Damage Taken</span>
                <span class="value">${stats.damageTaken}</span>
            </div>
            ${this.selectedRole === 'monster' ? `
            <div class="stat-row">
                <span class="label">Evolution Stage</span>
                <span class="value">Stage ${stats.evolutionStage}</span>
            </div>
            <div class="stat-row">
                <span class="label">Hunters Killed</span>
                <span class="value">${stats.huntersKilled}</span>
            </div>
            ` : `
            <div class="stat-row">
                <span class="label">Abilities Used</span>
                <span class="value">${stats.abilitiesUsed}</span>
            </div>
            `}
        `;
    }

    showDamageNumber(x, y, amount, type = 'damage') {
        const num = document.createElement('div');
        num.className = `damage-number ${type}`;
        num.textContent = type === 'heal' ? `+${amount}` : `-${amount}`;
        num.style.left = `${x}px`;
        num.style.top = `${y}px`;

        document.getElementById('game-screen').appendChild(num);

        setTimeout(() => num.remove(), 1000);
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 3000);
    }

    loadSettings() {
        GameSettings.load();

        document.getElementById('sfx-volume').value = GameSettings.sfxVolume * 100;
        document.getElementById('music-volume').value = GameSettings.musicVolume * 100;
        document.getElementById('vibration-toggle').checked = GameSettings.vibration;
        document.getElementById('fps-toggle').checked = GameSettings.showFPS;
        document.getElementById('difficulty-select').value = GameSettings.difficulty;
    }
}

// Export
window.UIManager = UIManager;
