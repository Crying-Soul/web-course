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
        this.soundManager = null;

        // Новые менеджеры
        this.spawnerManager = new SpawnerManager();
        this.teleportManager = new TeleportManager();
        this.particleSystem = new ParticleSystem();

        // Текущая карта
        this.currentMapPath = '';

        // Режим отладки (по умолчанию выключен)
        this.debug = false;

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
        this.soundManager = managers.soundManager;

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

        // Эффект частиц при смерти
        const deathX = enemy.x + enemy.displayWidth / 2;
        const deathY = enemy.y + enemy.displayHeight / 2;
        this.particleSystem.createDeathEffect(deathX, deathY, '#ff4444');
        
        // Дополнительный эффект для стриков
        if (this.stats.killStreak >= 3) {
            this.particleSystem.createExplosionEffect(deathX, deathY, 30, ['#ffaa00', '#ff6600', '#ffffff']);
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
                if (typeof this.player.afterPhysicsUpdate === 'function') {
                    this.player.afterPhysicsUpdate(dt, game);
                }
            }

            // Применяем физику к сущностям
            this.physicsManager.update(this.entities, dt);
        }

        // Убираем неактивные сущности и предметы
        this.entities = this.entities.filter(entity => entity.active);
        this.items = this.items.filter(item => item.active);
        this.projectiles = this.projectiles.filter(p => p.active);

        // Обновляем систему частиц
        this.particleSystem.update(dt);
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

        // Отрисовываем частицы (поверх всего)
        this.particleSystem.render(ctx, camera);

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
        const panelWidth = 300;
        const panelHeight = 55;
        const panelX = (width - panelWidth) / 2;
        const panelY = 8;
        const cornerRadius = 8;

        ctx.save();

        // Тень панели
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        this.roundRect(ctx, panelX + 3, panelY + 3, panelWidth, panelHeight, cornerRadius);
        ctx.fill();

        // Фон панели с градиентом
        const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        bgGrad.addColorStop(0, 'rgba(30, 35, 50, 0.92)');
        bgGrad.addColorStop(1, 'rgba(15, 20, 35, 0.92)');
        ctx.fillStyle = bgGrad;
        this.roundRect(ctx, panelX, panelY, panelWidth, panelHeight, cornerRadius);
        ctx.fill();

        // Рамка
        ctx.strokeStyle = 'rgba(100, 120, 160, 0.5)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, panelX, panelY, panelWidth, panelHeight, cornerRadius);
        ctx.stroke();

        // Разделители
        ctx.strokeStyle = 'rgba(100, 120, 160, 0.3)';
        ctx.beginPath();
        ctx.moveTo(panelX + 100, panelY + 8);
        ctx.lineTo(panelX + 100, panelY + panelHeight - 8);
        ctx.moveTo(panelX + 200, panelY + 8);
        ctx.lineTo(panelX + 200, panelY + panelHeight - 8);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Счёт
        ctx.fillStyle = '#ffdd44';
        ctx.font = 'bold 20px Arial';
        ctx.shadowColor = 'rgba(255, 200, 0, 0.5)';
        ctx.shadowBlur = 8;
        ctx.fillText(`${this.stats.score}`, panelX + 50, panelY + 22);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#aab8d0';
        ctx.font = '10px Arial';
        ctx.fillText('ОЧКИ', panelX + 50, panelY + 42);

        // Враги
        ctx.fillStyle = '#ff7777';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`${this.entities.length}`, panelX + 150, panelY + 22);
        ctx.fillStyle = '#aab8d0';
        ctx.font = '10px Arial';
        ctx.fillText('ВРАГИ', panelX + 150, panelY + 42);

        // Убийства
        ctx.fillStyle = '#77ff77';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(`${this.stats.kills}`, panelX + 250, panelY + 22);
        ctx.fillStyle = '#aab8d0';
        ctx.font = '10px Arial';
        ctx.fillText('УБИЙСТВА', panelX + 250, panelY + 42);

        // Время (маленькое, справа сверху от панели)
        const minutes = Math.floor(this.stats.time / 60);
        const seconds = Math.floor(this.stats.time % 60);
        ctx.fillStyle = 'rgba(150, 160, 180, 0.8)';
        ctx.font = '11px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, panelX + panelWidth - 8, panelY - 2);

        ctx.restore();

        // Kill Streak
        if (this.stats.killStreak >= 3) {
            this.renderKillStreak(ctx, width);
        }
    }

    /**
     * Вспомогательный метод для рисования скруглённых прямоугольников
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Отрисовка индикатора kill streak
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     */
    renderKillStreak(ctx, width) {
        const x = width / 2;
        const y = 75;
        const streak = this.stats.killStreak;
        
        // Пульсирующий эффект
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 6) * 0.15 + 0.85;
        const shake = Math.sin(time * 20) * (streak > 10 ? 2 : 1);
        
        ctx.save();
        ctx.translate(shake, 0);
        
        // Размер зависит от стрика
        const baseSize = 14 + Math.min(streak / 2, 6);
        const panelWidth = 160 + streak * 4;
        const panelHeight = 40;
        
        // Внешнее свечение
        const glowGrad = ctx.createRadialGradient(x, y, 0, x, y, panelWidth / 1.5);
        const glowIntensity = 0.3 + Math.min(streak / 20, 0.3);
        glowGrad.addColorStop(0, `rgba(255, 150, 50, ${glowIntensity * pulse})`);
        glowGrad.addColorStop(0.5, `rgba(255, 100, 0, ${glowIntensity * 0.5 * pulse})`);
        glowGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(x - panelWidth, y - panelHeight, panelWidth * 2, panelHeight * 2);
        
        // Фон панели
        const bgGrad = ctx.createLinearGradient(x - panelWidth / 2, y - 20, x + panelWidth / 2, y + 20);
        bgGrad.addColorStop(0, `rgba(180, 60, 0, ${0.85 * pulse})`);
        bgGrad.addColorStop(0.5, `rgba(220, 100, 20, ${0.9 * pulse})`);
        bgGrad.addColorStop(1, `rgba(180, 60, 0, ${0.85 * pulse})`);
        ctx.fillStyle = bgGrad;
        this.roundRect(ctx, x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 6);
        ctx.fill();
        
        // Огненная рамка
        ctx.strokeStyle = `rgba(255, 200, 100, ${pulse})`;
        ctx.lineWidth = 2;
        this.roundRect(ctx, x - panelWidth / 2, y - panelHeight / 2, panelWidth, panelHeight, 6);
        ctx.stroke();
        
        // Текст стрика
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${baseSize}px Arial`;
        ctx.shadowColor = 'rgba(255, 100, 0, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillText(`🔥 STREAK x${streak} 🔥`, x, y - 3);
        ctx.shadowBlur = 0;
        
        // Бонус
        const bonus = Math.floor(streak * 0.5);
        ctx.fillStyle = '#ffee88';
        ctx.font = '11px Arial';
        ctx.fillText(`+${bonus} бонус за убийство`, x, y + 13);
        
        ctx.restore();
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     */
    renderDebugInfo(ctx) {
        if (!this.debug) return;

        const x = 50;
        const y = 70;
        const width = 220;
        const lineHeight = 14;
        
        const spawnerStats = this.spawnerManager.getStats();

        const sections = [
            { title: 'GAME STATE', items: [
                { label: 'State', value: this.state, color: '#00ff88' },
                { label: 'Time', value: `${this.stats.time.toFixed(1)}s`, color: '#88ff88' },
                { label: 'Score', value: this.stats.score, color: '#ffff00' },
            ]},
            { title: 'ENTITIES', items: [
                { label: 'Enemies', value: this.entities.length, color: '#ff6666' },
                { label: 'Items', value: this.items.length, color: '#66ffff' },
                { label: 'Projectiles', value: this.projectiles.length, color: '#ff66ff' },
            ]},
            { title: 'KILLS', items: [
                { label: 'Session', value: this.stats.kills, color: '#ffaa00' },
                { label: 'Total', value: this.stats.totalKills, color: '#ffaa00' },
                { label: 'Streak', value: `${this.stats.killStreak} (max: ${this.stats.maxKillStreak})`, color: '#ff6600' },
            ]},
            { title: 'SPAWNERS', items: [
                { label: 'Active', value: `${spawnerStats.activeSpawners}/${spawnerStats.spawnerCount}`, color: '#aaaaff' },
                { label: 'Alive', value: spawnerStats.totalAlive, color: '#aaaaff' },
            ]},
        ];

        if (this.player) {
            sections.push({ title: 'PLAYER', items: [
                { label: 'Position', value: `(${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)})`, color: '#88aaff' },
                { label: 'HP', value: `${this.player.health}/${this.player.maxHealth}`, color: '#ff4444' },
                { label: 'Mana', value: `${this.player.mana.toFixed(0)}/${this.player.maxMana}`, color: '#4488ff' },
                { label: 'OnGround', value: this.player.onGround ? 'YES' : 'NO', color: this.player.onGround ? '#00ff00' : '#ff0000' },
            ]});
        }

        // Подсчёт высоты
        let totalLines = 0;
        sections.forEach(s => { totalLines += 1 + s.items.length; });
        const height = totalLines * lineHeight + 16;

        // Фон
        ctx.fillStyle = 'rgba(10, 15, 25, 0.92)';
        this.roundRect(ctx, x, y, width, height, 6);
        ctx.fill();
        
        // Рамка
        ctx.strokeStyle = 'rgba(0, 255, 100, 0.4)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, width, height, 6);
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        let currentY = y + 8;
        
        sections.forEach(section => {
            // Заголовок секции
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 9px monospace';
            ctx.fillText(`═══ ${section.title} ═══`, x + 8, currentY);
            currentY += lineHeight;
            
            // Элементы секции
            ctx.font = '10px monospace';
            section.items.forEach(item => {
                ctx.fillStyle = '#888888';
                ctx.fillText(`${item.label}:`, x + 12, currentY);
                ctx.fillStyle = item.color;
                ctx.fillText(String(item.value), x + 90, currentY);
                currentY += lineHeight;
            });
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
