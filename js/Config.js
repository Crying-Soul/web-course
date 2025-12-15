/**
 * Config - Централизованная конфигурация игры
 * Содержит все магические числа и настройки в одном месте
 */
const Config = {
    // === ДИСПЛЕЙ ===
    display: {
        viewWidth: 800,
        viewHeight: 450,
        scale: 2,
        pixelArt: true
    },

    // === ФИЗИКА ===
    physics: {
        gravity: 980,
        maxFallSpeed: 600,
        platformTiles: [128, 129, 130, 131, 132]
    },

    // === ИГРОК ===
    player: {
        moveSpeed: 150,
        jumpForce: 350,
        airControl: 0.7,
        maxHealth: 100,
        maxMana: 120,
        manaRegen: 18,
        manaRegenDelay: 0.6,
        invincibleDuration: 0.5,
        damageFlashDuration: 0.2,
        castWindup: 0.18,
        footstepInterval: 0.28,
        hitbox: {
            width: 20,
            height: 42,
            offsetX: 8,
            offsetY: 10
        },
        display: {
            width: 36,
            height: 52
        }
    },

    // === КАМЕРА ===
    camera: {
        smoothing: 0.1,
        offsetY: -30,
        deadZone: {
            width: 50,
            height: 30
        }
    },

    // === СПАВНЕРЫ ===
    spawner: {
        activationRadius: 400,
        defaultMaxEnemies: 3,
        defaultSpawnInterval: 5,
        defaultSpawnRadius: 20,
        variancePercent: 0.3
    },

    // === СИСТЕМА ОЧКОВ ===
    scoring: {
        decayInterval: 5,
        decayAmount: 1,
        multiplierDecayRate: 0.001,
        killStreakTimeout: 3,
        killStreakBonus: 0.5
    },

    // === ВИЗУАЛЬНЫЕ ЭФФЕКТЫ ===
    effects: {
        projectile: {
            maxTrailLength: 14,
            glowIntensity: 0.8
        },
        beam: {
            defaultWidth: 14,
            defaultLength: 300,
            defaultDuration: 0.25
        },
        zone: {
            defaultRadius: 80,
            defaultDuration: 1.2,
            defaultTickRate: 0.3
        },
        particles: {
            deathParticleCount: 12,
            pickupParticleCount: 8,
            castParticleCount: 6
        }
    },

    // === ТЕЛЕПОРТЫ ===
    teleport: {
        defaultCooldown: 2,
        particleSpawnRate: 0.05
    },

    // === ЗВУКИ ===
    audio: {
        masterVolume: 0.6,
        footstep: {
            volume: 0.35,
            cooldownMs: 50
        },
        combat: {
            hitVolume: 0.6,
            deathVolume: 0.65
        }
    },

    // === UI ===
    ui: {
        healthBar: {
            width: 150,
            height: 16,
            marginRight: 50,
            marginTop: 15
        },
        manaBar: {
            gapFromHealth: 12
        },
        inventory: {
            slotSize: 32,
            padding: 4,
            marginLeft: 10,
            marginBottom: 10
        },
        statsPanel: {
            width: 280,
            height: 50
        },
        buffIcon: {
            size: 26,
            gap: 6
        }
    },

    // === ЦВЕТА ===
    colors: {
        health: {
            high: '#ff3333',
            medium: '#ff6633',
            low: '#ff0000'
        },
        mana: '#4bc8ff',
        manaBackground: '#1c2d5c',
        sky: {
            top: '#1e3a5f',
            middle: '#4a90c2',
            light: '#87ceeb',
            bottom: '#b8d4e8'
        },
        debug: {
            onGround: 'lime',
            inAir: 'red',
            spawner: '#00ff00',
            teleport: '#ff00ff'
        },
        rarity: {
            common: '#ffffff',
            uncommon: '#00ff00',
            rare: '#0088ff',
            epic: '#aa00ff',
            legendary: '#ff8800'
        }
    }
};

// Замораживаем конфигурацию для предотвращения случайных изменений
Object.freeze(Config);
Object.keys(Config).forEach(key => {
    if (typeof Config[key] === 'object') {
        Object.freeze(Config[key]);
    }
});
