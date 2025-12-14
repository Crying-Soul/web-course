/**
 * PhysicsManager - Управление физикой игры
 * Гравитация, коллизии с тайлами, движение сущностей
 */
class PhysicsManager {
    constructor(mapManager) {
        this.mapManager = mapManager;
        
        // Физические константы
        this.gravity = 980; // пикселей/сек²
        this.maxFallSpeed = 600; // максимальная скорость падения
        
        // Список твёрдых тайлов (ID тайлов, через которые нельзя пройти)
        // По умолчанию все непустые тайлы считаются твёрдыми
        this.solidTiles = new Set();
        this.useAllAsSolid = true; // Все непустые тайлы твёрдые
    }

    /**
     * Устанавливает список твёрдых тайлов
     * @param {number[]} tileIds - Массив ID твёрдых тайлов
     */
    setSolidTiles(tileIds) {
        this.solidTiles = new Set(tileIds);
        this.useAllAsSolid = false;
    }

    /**
     * Проверяет, является ли тайл твёрдым
     * @param {number} tileId - ID тайла
     * @returns {boolean}
     */
    isSolidTile(tileId) {
        if (tileId === 0) return false;
        if (this.useAllAsSolid) return true;
        return this.solidTiles.has(tileId);
    }

    /**
     * Проверяет, есть ли твёрдый тайл в указанной позиции мира
     * @param {number} worldX - X координата в пикселях
     * @param {number} worldY - Y координата в пикселях
     * @returns {boolean}
     */
    isSolidAt(worldX, worldY) {
        const tileX = Math.floor(worldX / this.mapManager.tileWidth);
        const tileY = Math.floor(worldY / this.mapManager.tileHeight);
        
        // Проверяем все слои (начиная с основного - обычно индекс 0 или 1)
        for (let i = 0; i < this.mapManager.layers.length; i++) {
            if (!this.mapManager.isCollidableLayer(i)) continue;
            const tileId = this.mapManager.getTileAt(i, tileX, tileY);
            if (this.isSolidTile(tileId)) return true;
        }
        return false;
    }

    /**
     * Применяет физику к сущности
     * @param {Entity} entity - Сущность
     * @param {number} dt - Delta time
     */
    applyPhysics(entity, dt) {
        if (!entity.hasPhysics) return;

        // Применяем гравитацию
        if (!entity.onGround) {
            entity.velocityY += this.gravity * dt;
            entity.velocityY = Math.min(entity.velocityY, this.maxFallSpeed);
        }

        // Сохраняем старую позицию
        const oldX = entity.x;
        const oldY = entity.y;

        // Перемещаем по X
        entity.x += entity.velocityX * dt;
        this.resolveCollisionX(entity, oldX);

        // Перемещаем по Y
        entity.y += entity.velocityY * dt;
        this.resolveCollisionY(entity, oldY);
    }

    /**
     * Разрешает коллизии по оси X
     * @param {Entity} entity - Сущность
     * @param {number} oldX - Предыдущая позиция X
     */
    resolveCollisionX(entity, oldX) {
        const bounds = entity.getBounds();
        
        // Проверяем углы хитбокса
        const checkPoints = [
            { x: bounds.left, y: bounds.top + 1 },
            { x: bounds.left, y: bounds.bottom - 1 },
            { x: bounds.right, y: bounds.top + 1 },
            { x: bounds.right, y: bounds.bottom - 1 },
            // Дополнительные точки для высоких сущностей
            { x: bounds.left, y: bounds.top + bounds.height / 2 },
            { x: bounds.right, y: bounds.top + bounds.height / 2 }
        ];

        for (const point of checkPoints) {
            if (this.isSolidAt(point.x, point.y)) {
                entity.x = oldX;
                entity.velocityX = 0;
                return;
            }
        }
    }

    /**
     * Разрешает коллизии по оси Y
     * @param {Entity} entity - Сущность
     * @param {number} oldY - Предыдущая позиция Y
     */
    resolveCollisionY(entity, oldY) {
        const bounds = entity.getBounds();
        entity.onGround = false;

        // Проверяем точки внизу (для приземления)
        const bottomPoints = [
            { x: bounds.left + 2, y: bounds.bottom },
            { x: bounds.right - 2, y: bounds.bottom },
            { x: bounds.left + bounds.width / 2, y: bounds.bottom }
        ];

        // Проверяем точки вверху (для потолка)
        const topPoints = [
            { x: bounds.left + 2, y: bounds.top },
            { x: bounds.right - 2, y: bounds.top },
            { x: bounds.left + bounds.width / 2, y: bounds.top }
        ];

        // Проверка нижних точек (падение)
        if (entity.velocityY >= 0) {
            for (const point of bottomPoints) {
                if (this.isSolidAt(point.x, point.y)) {
                    // Выравниваем по верхней границе тайла
                    const tileY = Math.floor(point.y / this.mapManager.tileHeight);
                    entity.y = tileY * this.mapManager.tileHeight - entity.hitboxHeight - entity.hitboxOffsetY;
                    entity.velocityY = 0;
                    entity.onGround = true;
                    return;
                }
            }
        }

        // Проверка верхних точек (прыжок в потолок)
        if (entity.velocityY < 0) {
            for (const point of topPoints) {
                if (this.isSolidAt(point.x, point.y)) {
                    entity.y = oldY;
                    entity.velocityY = 0;
                    return;
                }
            }
        }
    }

    /**
     * Проверяет, стоит ли сущность на земле
     * @param {Entity} entity - Сущность
     * @returns {boolean}
     */
    checkOnGround(entity) {
        const bounds = entity.getBounds();
        
        // Проверяем точку чуть ниже ног
        const checkY = bounds.bottom + 1;
        
        return this.isSolidAt(bounds.left + 2, checkY) ||
               this.isSolidAt(bounds.right - 2, checkY) ||
               this.isSolidAt(bounds.left + bounds.width / 2, checkY);
    }

    /**
     * Обновляет физику для всех сущностей
     * @param {Entity[]} entities - Массив сущностей
     * @param {number} dt - Delta time
     */
    update(entities, dt) {
        for (const entity of entities) {
            this.applyPhysics(entity, dt);
        }
    }
}
