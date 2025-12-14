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
            time: 0
        };
        
        // Ссылки на другие менеджеры (устанавливаются при инициализации)
        this.physicsManager = null;
        this.eventManager = null;
        this.mapManager = null;
        
        // Режим отладки (по умолчанию включен для тестирования)
        this.debug = true;
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
     * Создаёт игрока в указанной позиции
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @returns {Promise<Player>}
     */
    async createPlayer(x, y) {
        this.player = new Player({ x, y });
        await this.player.loadSprite();
        this.player.gameManager = this;
        
        console.log(`GameManager: Игрок создан на позиции (${x}, ${y})`);
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
        if (killer instanceof Player) {
            killer.onKill(enemy, context);
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
        
        // Обновляем игрока
        if (this.player && this.player.active) {
            this.player.update(dt, game);
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
        
        // Переключение режима отладки
        if (this.eventManager && this.eventManager.isKeyJustPressed('F3')) {
            this.debug = !this.debug;
            console.log(`GameManager: Debug mode ${this.debug ? 'ON' : 'OFF'}`);
        }
    }

    /**
     * Отрисовка всех игровых объектов
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     * @param {Camera} camera - Камера
     */
    render(ctx, camera) {
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
    }
    
    /**
     * Отрисовка UI
     * @param {CanvasRenderingContext2D} ctx
     */
    renderUI(ctx) {
        // UI игрока (HP)
        if (this.player) {
            this.player.renderUI(ctx);
            this.player.inventory.render(ctx);
        }
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx - Контекст canvas
     */
    renderDebugInfo(ctx) {
        if (!this.debug) return;
        
        // Фон для текста
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(50, 2, 180, 150);
        
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        
        const info = [
            `State: ${this.state}`,
            `Enemies: ${this.entities.length}`,
            `Items: ${this.items.length}`,
            `Kills: ${this.stats.kills}`,
            `Time: ${this.stats.time.toFixed(1)}s`,
        ];
        
        if (this.player) {
            info.push(
                `Player: (${this.player.x.toFixed(0)}, ${this.player.y.toFixed(0)})`,
                `HP: ${this.player.health}/${this.player.maxHealth}`,
                `Mana: ${this.player.mana.toFixed(0)}/${this.player.maxMana}`,
                `OnGround: ${this.player.onGround}`,
                `Animation: ${this.player.currentAnimation}`,
                `Casting: ${this.player.isCasting}`
            );
        }
        
        info.forEach((text, i) => {
            ctx.fillText(text, 55, 15 + i * 12);
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
        this.state = 'gameover';
        console.log('GameManager: Game Over');
    }
}
