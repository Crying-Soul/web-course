/**
 * GameManager - Центральный менеджер игровой логики
 * Управляет состоянием игры, сущностями и координирует менеджеры
 */
class GameManager {
    constructor() {
        // Игрок
        this.player = null;

        // Массив всех сущностей (враги, NPC и т.д.)
        this.entities = [];

        // Массив предметов на земле
        this.items = [];

        // Снаряды магии
        this.projectiles = [];

        // Состояние игры
        this.state = 'playing'; // 'playing', 'paused', 'gameover', 'victory'

        // Игровая статистика
        this.stats = {
            score: 0,
            wave: 0,
            kills: 0,
            totalKills: 0,
            time: 0,
            killStreak: 0,
            maxKillStreak: 0,
            killStreakTimer: 0,
            killStreakTimeout: 3 // Секунды для продолжения стрика
        };

        // Ссылки на другие менеджеры (устанавливаются при инициализации)
        this.physicsManager = null;
        this.eventManager = null;
        this.mapManager = null;

        // Новые менеджеры
        this.spawnerManager = new SpawnerManager();
        this.teleportManager = new TeleportManager();

        // Текущая карта
        this.currentMapPath = '';

        // Режим отладки (по умолчанию включен для тестирования)
        this.debug = true;

        // Система очков
        this.scoreMultiplier = 1.0;
        this.scoreDecayTimer = 0;
        this.scoreDecayInterval = 5; // каждые 5 секунд терять очки
        this.scoreLossAmount = 1; // терять 1 очко

        // Игрок и результаты
        this.playerName = 'Игрок';
        this.onGameOver = null;
        this.scoreManager = null;
    }

    /**
     * Инициализация GameManager
     * @param {Object} managers - Объект с менеджерами
     */
    init(managers) {
        this.physicsManager = managers.physicsManager;
        this.eventManager = managers.eventManager;
        this.mapManager = managers.mapManager;

        console.log('GameManager: Инициализирован');
    }

    /**
     * Загружает спавнеры и телепорты из карты
     * @param {Object} mapData - Данные карты
     */
    loadMapObjects(mapData) {
        if (!mapData) return;

        // Загружаем спавнеры
        this.spawnerManager.loadFromMap(mapData);

        // Загружаем телепорты
        this.teleportManager.loadFromMap(mapData);

        console.log('GameManager: Объекты карты загружены');
    }

    /**
     * Спавнит врага от спавнера
     * @param {string} enemyType - Тип врага
     * @param {number} x - X позиция
     * @param {number} y - Y позиция
     * @param {Spawner} spawner - Родительский спавнер
     * @returns {Enemy|null}
     */
    spawnEnemyFromSpawner(enemyType, x, y, spawner) {
        const enemy = new Enemy({
            enemyType: enemyType,
            x: x,
            y: y
        });
        
        // Связываем врага со спавнером
        enemy.spawner = spawner;
        enemy.gameManager = this;
        enemy.setTarget(this.player);
        
        // Устанавливаем колбэк смерти
        enemy.handleEnemyKilled = (killedEnemy) => {
            this.handleEnemyKilled(killedEnemy);
        };
        
        enemy.loadSprite();
        this.entities.push(enemy);
        
        return enemy;
    }    /**
     * Получает дефолтный конфиг врага по типу
     * @param {string} enemyType
     * @returns {Object}
     */
    getDefaultEnemyConfig(enemyType) {
        const configs = {
            slime: {
                name: 'Слайм',
                health: 30,
                damage: 8,
                moveSpeed: 60,
                detectionRange: 200,
                attackRange: 30,
                scoreValue: 10,
                dropChance: 0.15
            },
            zombie: {
                name: 'Зомби',
                health: 60,
                damage: 15,
                moveSpeed: 45,
                detectionRange: 250,
                attackRange: 35,
                scoreValue: 25,
                dropChance: 0.2
            },
            skeleton: {
                name: 'Скелет',
                health: 45,
                damage: 12,
                moveSpeed: 80,
                detectionRange: 300,
                attackRange: 40,
                scoreValue: 20,
                dropChance: 0.18
            },
            demon: {
                name: 'Демон',
                health: 100,
                damage: 25,
                moveSpeed: 70,
                detectionRange: 350,
                attackRange: 50,
                scoreValue: 50,
                dropChance: 0.35
            },
            ghost: {
                name: 'Призрак',
                health: 35,
                damage: 18,
                moveSpeed: 100,
                detectionRange: 400,
                attackRange: 25,
                scoreValue: 30,
                dropChance: 0.25
            }
        };

        return configs[enemyType] || configs.slime;
    }

    /**
     * Создаёт игрока в указанной позиции
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @returns {Promise<Player>}
     */
    async createPlayer(x, y) {
        this.player = new Player({ x, y });
        await this.player.loadSprite();
        this.player.gameManager = this;

        // Добавляем стартовое заклинание
        const startingSpell = new Item(ItemTypes.ARCANE_BOLT);
        this.player.inventory.addItem(startingSpell);

        console.log(`GameManager: Игрок создан на позиции (${x}, ${y}) с базовым заклинанием`);
        return this.player;
    }

    /**
     * Спавнит игрока в центре карты
     * @returns {Promise<Player>}
     */
    async spawnPlayerAtCenter() {
        if (!this.mapManager || !this.mapManager.ready) {
            throw new Error('GameManager: MapManager не готов');
        }

        const mapSize = this.mapManager.getPixelSize();
        const centerX = mapSize.width / 2;

        // Ищем позицию земли в центре карты
        const spawnY = this.findGroundLevel(centerX);

        return await this.createPlayer(centerX - 18, spawnY - 52); // Смещаем с учётом размера игрока
    }

    /**
     * Находит уровень земли в указанной X координате
     * @param {number} x - X координата в пикселях
     * @returns {number} - Y координата верхнего края земли
     */
    findGroundLevel(x) {
        const tileX = Math.floor(x / this.mapManager.tileWidth);
        const mapHeight = this.mapManager.height;

        // Начинаем сверху и ищем первый твёрдый тайл
        for (let tileY = 0; tileY < mapHeight; tileY++) {
            // Проверяем все слои
            for (let layerIndex = 0; layerIndex < this.mapManager.layers.length; layerIndex++) {
                const tileId = this.mapManager.getTileAt(layerIndex, tileX, tileY);
                if (tileId !== 0) {
                    // Нашли первый непустой тайл - это земля
                    return tileY * this.mapManager.tileHeight;
                }
            }
        }

        // Если земля не найдена, возвращаем середину карты
        return this.mapManager.getPixelSize().height / 2;
    }

    /**
     * Добавляет сущность в игру
     * @param {Entity} entity - Сущность для добавления
     */
    addEntity(entity) {
        this.entities.push(entity);
    }

    /**
     * Удаляет сущность из игры
     * @param {Entity} entity - Сущность для удаления
     */
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) {
            this.entities.splice(index, 1);
        }
    }

    /**
     * Добавляет предмет на землю
     * @param {Item} item
     */
    addItem(item) {
        this.items.push(item);
    }

    /**
     * Спавнит предмет в указанной позиции
     * @param {string} itemTypeId - ID типа предмета
     * @param {number} x - Позиция X
     * @param {number} y - Позиция Y
     * @returns {Promise<Item>}
     */
    async spawnItem(itemTypeId, x, y, options = {}) {
        const item = createItem(itemTypeId, x, y);
        await item.loadImage();

        // Параметры начальной скорости (для падения/выброса)
        if (typeof options.velocityX === 'number') item.velocityX = options.velocityX;
        if (typeof options.velocityY === 'number') item.velocityY = options.velocityY;
        // Если предмет спавнится "сверху", гарантируем что он в воздухе
        if (options.drop) item.onGround = false;

        this.addItem(item);
        console.log(`GameManager: Предмет ${item.name} заспавнен на (${x}, ${y})`);
        return item;
    }

    /**
     * Выдаёт стартовые заклинания игроку
     */
    async giveStarterSpells() {
        if (!this.player) return;
        const starterSpells = ['arcane_bolt', 'arcane_beam', 'frost_nova', 'thorn_burst'];
        for (const spellId of starterSpells) {
            const spell = createItem(spellId);
            await spell.loadImage();
            this.player.inventory.addItem(spell);
        }
    }

    /**
     * Спавнит врага в указанной позиции
     * @param {number} x - Позиция X
     * @param {number} y - Позиция Y
     * @param {Object} config - Дополнительная конфигурация
     * @returns {Promise<Enemy>}
     */
    async spawnEnemy(x, y, config = {}) {
        const enemy = new Enemy({ x, y, ...config });
        await enemy.loadSprite();
        enemy.setTarget(this.player);
        enemy.gameManager = this;
        this.addEntity(enemy);
        console.log(`GameManager: Враг заспавнен на (${x}, ${y})`);
        return enemy;
    }

    /**
     * Спавнит тестовый контент (предметы и врагов)
     */
    async spawnTestContent() {
        const mapSize = this.mapManager.getPixelSize();
        const centerX = mapSize.width / 2;

        // Игрок сразу получает набор заклинаний
        const starterSpells = ['arcane_bolt', 'frost_lance', 'solar_orb'];
        for (const spellId of starterSpells) {
            const spell = createItem(spellId);
            await spell.loadImage();
            this.player.inventory.addItem(spell);
        }

        // Спавним несколько врагов
        await this.spawnEnemy(centerX - 200, this.findGroundLevel(centerX - 200) - 52, { health: 30, maxHealth: 30 });
        await this.spawnEnemy(centerX + 200, this.findGroundLevel(centerX + 200) - 52, { health: 50, maxHealth: 50 });
        await this.spawnEnemy(centerX + 300, this.findGroundLevel(centerX + 300) - 52, { health: 70, maxHealth: 70, damage: 15 });
    }

    /**
     * Добавляет снаряд в игру
     * @param {MagicProjectile} projectile
     */
    addProjectile(projectile) {
        this.projectiles.push(projectile);
    }

    /**
     * Обрабатывает смерть врага
     * @param {Enemy} enemy
     * @param {Entity|null} killer
     * @param {Object} context
     */
    handleEnemyKilled(enemy, killer = null, context = {}) {
        this.stats.kills += 1;
        this.stats.totalKills += 1;

        // Обновляем статистику спавнера
        if (enemy.spawner) {
            enemy.spawner.onEnemyDied();
        }

        // Очки за убийство (базовые + бонус за стрик + коэффициент)
        const baseScore = enemy.scoreValue || 10;
        const streakBonus = Math.floor(this.stats.killStreak * 0.5);
        const totalScore = Math.floor((baseScore + streakBonus) * this.scoreMultiplier);
        this.stats.score += totalScore;

        // Kill streak система
        this.stats.killStreak += 1;
        this.stats.killStreakTimer = this.stats.killStreakTimeout;

        if (this.stats.killStreak > this.stats.maxKillStreak) {
            this.stats.maxKillStreak = this.stats.killStreak;
        }

        // Создаём всплывающий текст с очками
        if (this.stats.killStreak >= 3) {
            console.log(`Kill Streak: ${this.stats.killStreak}! (+${totalScore} очков)`);
        }

        // Дроп заклинания с врага
        this.tryDropSpell(enemy);

        // Колбэк для игрока
        if (killer instanceof Player) {
            killer.onKill(enemy, context);
        }
    }

    /**
     * Попытка дропа заклинания с врага
     * @param {Enemy} enemy
     */
    tryDropSpell(enemy) {
        const dropChance = enemy.dropChance || 0.15;

        if (Math.random() < dropChance) {
            // Получаем случайный тип заклинания
            const spellType = getRandomSpellType();

            // Спавним предмет с небольшим подбросом
            this.spawnItem(spellType, enemy.x + enemy.displayWidth / 2, enemy.y, {
                velocityX: (Math.random() - 0.5) * 100,
                velocityY: -150 - Math.random() * 100,
                drop: true
            });

            console.log(`Враг дропнул: ${spellType}`);
        }
    }

    /**
     * Обновление всей игровой логики
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        if (this.state !== 'playing') return;

        // Обновляем статистику времени
        this.stats.time += dt;

        // Обновляем kill streak таймер
        this.updateKillStreak(dt);

        // Обновляем систему очков
        this.updateScoreSystem(dt);

        // Обновляем спавнеры
        this.spawnerManager.update(dt, this);

        // Обновляем телепорты
        const teleportData = this.teleportManager.update(dt, this.player, this.eventManager);
        if (teleportData) {
            if (teleportData.name && teleportData.name.toLowerCase() === 'end run') {
                // Специальный телепорт окончания забега
                this.stats.score += 1000;
                console.log('End Run! +1000 очков');
                this.gameOver();
            } else if (game.handleTeleport) {
                game.handleTeleport(teleportData);
            }
        }

        // Обновляем игрока
        if (this.player && this.player.active) {
            this.player.update(dt, game);
        }

        // Проверяем падение за карту
        if (this.player && this.player.y > this.mapManager.getPixelSize().height) {
            this.gameOver();
        }

        // Обновляем всех сущностей
        for (const entity of this.entities) {
            if (entity.active) {
                entity.update(dt, game);
            }
        }

        // Обновляем предметы
        for (const item of this.items) {
            if (item.active) {
                item.update(dt);
            }
        }

        // Обновляем снаряды
        for (const projectile of this.projectiles) {
            if (projectile.active) {
                projectile.update(dt, game);
            }
        }

        // Применяем физику к предметам (падают на землю)
        if (this.physicsManager) {
            for (const item of this.items) {
                if (item.active && item.hasPhysics) {
                    this.physicsManager.applyPhysics(item, dt);
                }
            }
        }

        // Физика
        if (this.physicsManager) {
            // Применяем физику к игроку
            if (this.player) {
                this.physicsManager.applyPhysics(this.player, dt);
            }

            // Применяем физику к сущностям
            this.physicsManager.update(this.entities, dt);
        }

        // Убираем неактивные сущности и предметы
        this.entities = this.entities.filter(entity => entity.active);
        this.items = this.items.filter(item => item.active);
        this.projectiles = this.projectiles.filter(p => p.active);

    }

    /**
     * Обновляет таймер kill streak
     * @param {number} dt
     */
    updateKillStreak(dt) {
        if (this.stats.killStreakTimer > 0) {
            this.stats.killStreakTimer -= dt;
            if (this.stats.killStreakTimer <= 0) {
                // Стрик закончился
                if (this.stats.killStreak >= 3) {
                    console.log(`Kill Streak ended: ${this.stats.killStreak} kills!`);
                }
                this.stats.killStreak = 0;
            }
        }
    }

    /**
     * Обновляет систему очков: уменьшает коэффициент и теряет очки со временем
     * @param {number} dt
     */
    updateScoreSystem(dt) {
        // Уменьшаем коэффициент очков со временем (медленно)
        this.scoreMultiplier = Math.max(0.1, this.scoreMultiplier - dt * 0.001); // уменьшается на 0.001 в секунду

        // Таймер потери очков
        this.scoreDecayTimer += dt;
        if (this.scoreDecayTimer >= this.scoreDecayInterval) {
            this.scoreDecayTimer = 0;
            // Теряем очки
            if (this.stats.score > 0) {
                this.stats.score = Math.max(0, this.stats.score - this.scoreLossAmount);
                console.log(`Score decayed: -${this.scoreLossAmount}, total: ${this.stats.score}`);
            }
        }
    }

    /**
     * Отрисовка всех игровых объектов
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Camera} camera - Камера
     */
    render(ctx, camera) {
        // Отрисовываем телепорты (под предметами)
        this.teleportManager.render(ctx, camera);

        // Отрисовываем предметы на земле
        for (const item of this.items) {
            if (item.active) {
                item.render(ctx, camera);
            }
        }

        // Отрисовываем снаряды
        for (const projectile of this.projectiles) {
            if (projectile.active) {
                projectile.render(ctx, camera);
            }
        }

        // Отрисовываем сущности (врагов)
        for (const entity of this.entities) {
            if (entity.active) {
                entity.render(ctx, camera);

                if (this.debug) {
                    entity.renderDebug(ctx, camera);
                }
            }
        }

        // Отрисовываем игрока (поверх врагов)
        if (this.player && this.player.active) {
            this.player.render(ctx, camera);

            if (this.debug) {
                this.player.renderDebug(ctx, camera);
            }
        }

        // Отладочная информация спавнеров
        if (this.debug) {
            this.spawnerManager.renderDebug(ctx, camera);
            this.teleportManager.renderDebug(ctx, camera);
        }
    }

    /**
     * Отрисовка UI
     * @param {CanvasRenderingContext2D} ctx
     */
    renderUI(ctx) {
        // UI игрока (HP, мана, баффы)
        if (this.player) {
            this.player.renderUI(ctx);
            this.player.inventory.render(ctx);
        }

        // Статистика (счёт, враги, стрик)
        this.renderStatsUI(ctx);
    }

    /**
     * Отрисовка статистики игры
     * @param {CanvasRenderingContext2D} ctx
     */
    renderStatsUI(ctx) {
        const width = ctx.canvas.width;

        // Верхняя панель статистики (по центру)
        const panelWidth = 280;
        const panelX = (width - panelWidth) / 2;
        const panelY = 10;

        // Фон панели
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(panelX, panelY, panelWidth, 50);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelWidth, 50);

        // Счёт
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`⭐ ${this.stats.score}`, panelX + 60, panelY + 22);

        // Количество врагов
        ctx.fillStyle = '#ff6666';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`👹 ${this.entities.length}`, panelX + 140, panelY + 22);

        // Убийства
        ctx.fillStyle = '#66ff66';
        ctx.fillText(`💀 ${this.stats.kills}`, panelX + 220, panelY + 22);

        // Время
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '12px Arial';
        const minutes = Math.floor(this.stats.time / 60);
        const seconds = Math.floor(this.stats.time % 60);
        ctx.fillText(`⏱ ${minutes}:${seconds.toString().padStart(2, '0')}`, panelX + panelWidth / 2, panelY + 42);

        // Kill Streak (если есть)
        if (this.stats.killStreak >= 3) {
            this.renderKillStreak(ctx, width);
        }
    }

    /**
     * Отрисовка kill streak
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     */
    renderKillStreak(ctx, width) {
        const streakText = `🔥 KILL STREAK: ${this.stats.killStreak}x 🔥`;
        const x = width / 2;
        const y = 80;

        // Пульсирующий эффект
        const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.8;

        // Фон
        ctx.fillStyle = `rgba(255, 100, 0, ${0.4 * pulse})`;
        ctx.fillRect(x - 100, y - 20, 200, 35);

        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${16 + Math.floor(this.stats.killStreak / 3)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(streakText, x, y);

        // Бонусные очки
        const bonus = Math.floor(this.stats.killStreak * 0.5);
        ctx.fillStyle = '#ffff00';
        ctx.font = '12px Arial';
        ctx.fillText(`+${bonus} bonus per kill`, x, y + 16);
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     */
    renderDebugInfo(ctx) {
        if (!this.debug) return;

        // Фон для текста
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(50, 70, 200, 180);

        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';

        const spawnerStats = this.spawnerManager.getStats();

        const info = [
            `State: ${this.state}`,
            `Enemies: ${this.entities.length}`,
            `Items: ${this.items.length}`,
            `Projectiles: ${this.projectiles.length}`,
            `Kills: ${this.stats.kills} (Total: ${this.stats.totalKills})`,
            `Score: ${this.stats.score}`,
            `Kill Streak: ${this.stats.killStreak} (Max: ${this.stats.maxKillStreak})`,
            `Time: ${this.stats.time.toFixed(1)}s`,
            `--- Spawners ---`,
            `Active: ${spawnerStats.activeSpawners}/${spawnerStats.spawnerCount}`,
            `Alive from spawners: ${spawnerStats.totalAlive}`,
        ];

        if (this.player) {
            info.push(
                `--- Player ---`,
                `Pos: (${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)})`,
                `HP: ${this.player.health}/${this.player.maxHealth}`,
                `Mana: ${this.player.mana.toFixed(0)}/${this.player.maxMana}`,
                `OnGround: ${this.player.onGround}`
            );
        }

        info.forEach((text, i) => {
            ctx.fillText(text, 55, 85 + i * 12);
        });
    }

    /**
     * Пауза игры
     */
    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            console.log('GameManager: Игра на паузе');
        }
    }

    /**
     * Возобновление игры
     */
    resume() {
        if (this.state === 'paused') {
            this.state = 'playing';
            console.log('GameManager: Игра возобновлена');
        }
    }

    /**
     * Конец игры
     */
    gameOver() {
        if (this.state === 'gameover') return;
        this.state = 'gameover';
        if (this.player) {
            this.player.active = false;
        }

        const results = this.getResults();
        if (this.scoreManager) {
            this.scoreManager.addResult(results);
        }
        if (typeof this.onGameOver === 'function') {
            this.onGameOver(results);
        }

        console.log('GameManager: Game Over');
    }

    /**
     * Возвращает итоговые результаты забега
     * @returns {{name: string, score: number, kills: number, time: number}}
     */
    getResults() {
        return {
            name: this.playerName || 'Игрок',
            score: this.stats.score,
            kills: this.stats.kills,
            time: Math.floor(this.stats.time)
        };
    }
}
