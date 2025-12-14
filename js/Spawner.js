/**
 * Spawner - Система спавна врагов из точек на карте
 * Обрабатывает object layers из Tiled с настройками спавна
 */
class Spawner {
    /**
     * @param {Object} config - Конфигурация спавнера
     */
    constructor(config = {}) {
        // Позиция спавнера на карте
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 32;
        this.height = config.height || 32;
        
        // Тип врага для спавна (имя файла или ID)
        this.enemyType = config.enemyType || config.class;
        
        // Максимальное количество живых врагов от этого спавнера
        this.maxEnemies = config.maxEnemies || 3;
        
        // Текущее количество живых врагов
        this.aliveCount = 0;
        
        // Интервал между спавнами (секунды)
        this.spawnInterval = config.spawnInterval || 5;
        
        // Таймер до следующего спавна
        this.spawnTimer = config.initialDelay || 0;
        
        // Начальная задержка перед первым спавном
        this.initialDelay = config.initialDelay || 1;
        
        // Активен ли спавнер
        this.active = config.active !== false;
        
        // Общее количество заспавненных врагов (для статистики)
        this.totalSpawned = 0;
        
        // Радиус случайного разброса при спавне
        this.spawnRadius = config.spawnRadius || 20;
        
        // Имя спавнера (для отладки)
        this.name = config.name || `Spawner_${this.enemyType}`;
    }

    /**
     * Обновление спавнера
     * @param {number} dt - Delta time
     * @param {GameManager} gameManager - Менеджер игры для спавна врагов
     */
    update(dt, gameManager) {
        if (!this.active) return;
        
        // Уменьшаем таймер
        this.spawnTimer -= dt;
        
        // Проверяем возможность спавна
        if (this.spawnTimer <= 0 && this.aliveCount < this.maxEnemies && this.totalSpawned < this.maxEnemies) {
            this.spawn(gameManager);
            this.spawnTimer = this.spawnInterval;
        }
    }

    /**
     * Спавнит врага
     * @param {GameManager} gameManager
     */
    spawn(gameManager) {
        // Случайное смещение в пределах радиуса
        const offsetX = (Math.random() - 0.5) * this.spawnRadius * 2;
        const offsetY = (Math.random() - 0.5) * this.spawnRadius * 2;
        
        const spawnX = this.x + this.width / 2 + offsetX;
        const spawnY = this.y + this.height / 2 + offsetY;
        
        // Создаём врага через GameManager
        const enemy = gameManager.spawnEnemyFromSpawner(this.enemyType, spawnX, spawnY, this);
        
        if (enemy) {
            this.aliveCount++;
            this.totalSpawned++;
            console.log(`${this.name}: Spawned ${this.enemyType} (${this.aliveCount}/${this.maxEnemies})`);
        }
    }

    /**
     * Вызывается когда враг от этого спавнера умирает
     */
    onEnemyDied() {
        this.aliveCount = Math.max(0, this.aliveCount - 1);
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderDebug(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        
        // Рамка спавнера
        ctx.strokeStyle = this.active ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, this.width, this.height);
        
        // Радиус спавна
        ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(
            screenX + this.width / 2,
            screenY + this.height / 2,
            this.spawnRadius,
            0,
            Math.PI * 2
        );
        ctx.stroke();
        
        // Информация
        ctx.fillStyle = '#00ff00';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${this.enemyType}`, screenX, screenY - 14);
        ctx.fillText(`${this.aliveCount}/${this.maxEnemies}`, screenX, screenY - 2);
    }
}

/**
 * SpawnerManager - Управление всеми спавнерами на карте
 */
class SpawnerManager {
    constructor() {
        this.spawners = [];
    }

    /**
     * Загружает спавнеры из слоя объектов карты Tiled
     * @param {Object} mapData - Данные карты
     */
    loadFromMap(mapData) {
        this.spawners = [];
        
        if (!mapData || !mapData.layers) {
            console.warn('SpawnerManager: No map data');
            return;
        }

        // Ищем слои объектов с именами содержащими 'spawn' или 'spawnpoint'
        const spawnLayers = mapData.layers.filter(layer => 
            layer.type === 'objectgroup' && 
            /spawn/i.test(layer.name)
        );

        for (const layer of spawnLayers) {
            if (!layer.objects) continue;
            
            for (const obj of layer.objects) {
                const spawner = this.createSpawnerFromObject(obj);
                if (spawner) {
                    this.spawners.push(spawner);
                }
            }
        }

        console.log(`SpawnerManager: Loaded ${this.spawners.length} spawners`);
    }

    /**
     * Создаёт спавнер из объекта Tiled
     * @param {Object} obj - Объект из Tiled
     * @returns {Spawner|null}
     */
    createSpawnerFromObject(obj) {
        // Получаем свойства из объекта Tiled
        const props = this.extractProperties(obj.properties);
        
        // Тип врага берём из class или type объекта, или из свойств
        const enemyType = obj.class || obj.type || props.enemyType || props.class || 'slime';
        
        return new Spawner({
            x: obj.x,
            y: obj.y,
            width: obj.width || 32,
            height: obj.height || 32,
            name: obj.name || `Spawner_${obj.id}`,
            enemyType: enemyType,
            maxEnemies: parseInt(props.maxEnemies) || parseInt(props.count) || 3,
            spawnInterval: parseFloat(props.spawnInterval) || parseFloat(props.interval) || 5,
            initialDelay: parseFloat(props.initialDelay) || parseFloat(props.delay) || 1,
            spawnRadius: parseFloat(props.spawnRadius) || parseFloat(props.radius) || 20,
            active: props.active !== 'false' && props.active !== false
        });
    }

    /**
     * Извлекает свойства из массива properties Tiled
     * @param {Array} properties
     * @returns {Object}
     */
    extractProperties(properties) {
        const result = {};
        if (!properties) return result;
        
        for (const prop of properties) {
            result[prop.name] = prop.value;
        }
        return result;
    }

    /**
     * Обновление всех спавнеров
     * @param {number} dt
     * @param {GameManager} gameManager
     */
    update(dt, gameManager) {
        for (const spawner of this.spawners) {
            spawner.update(dt, gameManager);
        }
    }

    /**
     * Отрисовка отладочной информации
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderDebug(ctx, camera) {
        for (const spawner of this.spawners) {
            spawner.renderDebug(ctx, camera);
        }
    }

    /**
     * Получает статистику по спавнерам
     * @returns {Object}
     */
    getStats() {
        let totalAlive = 0;
        let totalSpawned = 0;
        let activeSpawners = 0;

        for (const spawner of this.spawners) {
            totalAlive += spawner.aliveCount;
            totalSpawned += spawner.totalSpawned;
            if (spawner.active) activeSpawners++;
        }

        return {
            spawnerCount: this.spawners.length,
            activeSpawners,
            totalAlive,
            totalSpawned
        };
    }

    /**
     * Сбрасывает все спавнеры
     */
    reset() {
        for (const spawner of this.spawners) {
            spawner.aliveCount = 0;
            spawner.totalSpawned = 0;
            spawner.spawnTimer = spawner.initialDelay;
        }
    }
}
