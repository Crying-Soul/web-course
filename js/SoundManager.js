/**
 * SoundManager - управление загрузкой и воспроизведением звуков
 * Поддерживает предварительную загрузку, ограничение одновременных экземпляров
 * и удобные методы для игровых событий (шаги, урон, смерть).
 */
class SoundManager {
    constructor(basePath = 'sounds/') {
        this.basePath = basePath;
        this.sounds = new Map();
        this.masterVolume = 0.6;
        this.enabled = true;
    }

    /**
     * Регистрирует звуковой набор
     * @param {string} key
     * @param {string[]} sources - относительные пути к файлам
     * @param {Object} options
     */
    register(key, sources, options = {}) {
        this.sounds.set(key, {
            sources,
            templates: [],
            maxInstances: options.maxInstances || 4,
            volume: options.volume ?? 1,
            cooldownMs: options.cooldownMs || 0,
            lastPlay: 0,
            playing: 0
        });
    }

    /**
     * Предзагружает все зарегистрированные звуки
     */
    async loadAll() {
        this.register('footstep_grass', [
            'blocks/grass1.wav', 'blocks/grass2.wav', 'blocks/grass3.wav'
        ], { volume: 0.35, maxInstances: 8, cooldownMs: 50 });

        this.register('footstep_stone', [
            'blocks/stone1.wav', 'blocks/stone2.wav', 'blocks/stone3.wav',
            'blocks/stone4.wav', 'blocks/stone5.wav', 'blocks/stone6.wav'
        ], { volume: 0.4, maxInstances: 8, cooldownMs: 45 });

        this.register('player_hit', [
            'player/hit1.wav', 'player/hit2.wav', 'player/hit3.wav'
        ], { volume: 0.6, maxInstances: 2, cooldownMs: 120 });

        this.register('zombie_hit', [
            'zombie/hurt1.wav', 'zombie/hurt2.wav'
        ], { volume: 0.55, maxInstances: 3, cooldownMs: 90 });

        this.register('zombie_death', ['zombie/death.wav'], { volume: 0.65, maxInstances: 2, cooldownMs: 200 });
        this.register('zombie_idle', ['zombie/say1.wav', 'zombie/say2.wav'], { volume: 0.5, maxInstances: 2, cooldownMs: 600 });

        this.register('ghost_hit', [
            'ghost/hit1.wav', 'ghost/hit2.wav', 'ghost/hit3.wav', 'ghost/hit4.wav'
        ], { volume: 0.55, maxInstances: 3, cooldownMs: 90 });

        this.register('ghost_death', ['ghost/death.wav'], { volume: 0.6, maxInstances: 2, cooldownMs: 200 });
        this.register('ghost_idle', ['ghost/idle1.wav', 'ghost/idle2.wav', 'ghost/idle3.wav', 'ghost/idle4.wav'], { volume: 0.45, maxInstances: 2, cooldownMs: 700 });

        const tasks = [];
        for (const [key, entry] of this.sounds.entries()) {
            for (const src of entry.sources) {
                tasks.push(this.preloadSound(entry, src));
            }
        }
        await Promise.all(tasks);
    }

    preloadSound(entry, src) {
        return new Promise((resolve) => {
            const audio = new Audio(this.basePath + src);
            audio.preload = 'auto';
            audio.volume = Math.min(1, Math.max(0, entry.volume * this.masterVolume));

            const done = () => resolve();
            audio.addEventListener('canplaythrough', done, { once: true });
            audio.addEventListener('error', done, { once: true });

            entry.templates.push(audio);
        });
    }

    /**
     * Воспроизводит звуковой набор
     * @param {string} key
     * @param {Object} options
     */
    play(key, options = {}) {
        if (!this.enabled) return;
        const entry = this.sounds.get(key);
        if (!entry || entry.templates.length === 0) return;

        const now = performance.now();
        if (entry.cooldownMs && now - entry.lastPlay < entry.cooldownMs) return;
        if (entry.playing >= entry.maxInstances) return;

        const template = entry.templates[Math.floor(Math.random() * entry.templates.length)];
        const audio = template.cloneNode(true);
        audio.volume = Math.min(1, Math.max(0, (options.volume ?? entry.volume) * this.masterVolume));
        audio.loop = options.loop || false;

        entry.playing += 1;
        entry.lastPlay = now;

        const handleEnd = () => {
            entry.playing = Math.max(0, entry.playing - 1);
            audio.removeEventListener('ended', handleEnd);
            audio.removeEventListener('error', handleEnd);
        };
        audio.addEventListener('ended', handleEnd);
        audio.addEventListener('error', handleEnd);

        audio.play().catch(() => handleEnd());
    }

    /**
     * Проигрывает звук шага в зависимости от типа тайла
     * @param {string|null} tileType
     */
    playFootstep(tileType) {
        if (!tileType || tileType === 'grass' || tileType === 'dirt') {
            this.play('footstep_grass');
        } else if (tileType === 'stone') {
            this.play('footstep_stone');
        } else {
            this.play('footstep_grass');
        }
    }

    playPlayerHit() {
        this.play('player_hit');
    }

    playEnemyHit(enemyType) {
        const family = this.getEnemyFamily(enemyType);
        if (family === 'ghost') {
            this.play('ghost_hit');
        } else if (family === 'zombie') {
            this.play('zombie_hit');
        }
    }

    playEnemyDeath(enemyType) {
        const family = this.getEnemyFamily(enemyType);
        if (family === 'ghost') {
            this.play('ghost_death');
        } else if (family === 'zombie') {
            this.play('zombie_death');
        }
    }

    playEnemyIdle(enemyType) {
        const family = this.getEnemyFamily(enemyType);
        if (family === 'ghost') {
            this.play('ghost_idle');
        } else if (family === 'zombie') {
            this.play('zombie_idle');
        }
    }

    getEnemyFamily(enemyType) {
        if (!enemyType) return null;
        if (enemyType === 'g1') return 'ghost';
        if (enemyType === 'z1' || enemyType === 'z2' || enemyType === 'z3') return 'zombie';
        return null;
    }
}
