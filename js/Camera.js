/**
 * Camera - Класс камеры с плавным следованием за целью
 */
class Camera {
    constructor(width, height) {
        // Позиция камеры (левый верхний угол)
        this.x = 0;
        this.y = 0;
        
        // Размеры видимой области
        this.width = width;
        this.height = height;
        
        // Размеры мира (для пересчёта при resize)
        this.worldWidth = 0;
        this.worldHeight = 0;
        
        // Цель для следования
        this.target = null;
        
        // Плавность следования (0-1, где 1 = мгновенно)
        this.smoothing = 0.1;
        
        // Смещение точки фокуса (от центра цели)
        this.offsetX = 0;
        this.offsetY = -30; // Немного выше центра персонажа
        
        // Границы мира (для ограничения камеры)
        this.worldBounds = {
            minX: 0,
            minY: 0,
            maxX: Infinity,
            maxY: Infinity
        };
        
        // "Мёртвая зона" - область, где камера не двигается
        this.deadZone = {
            width: 50,
            height: 30
        };
    }

    /**
     * Устанавливает цель для следования
     * @param {Entity} target - Сущность для отслеживания
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Устанавливает границы мира
     * @param {number} width - Ширина мира в пикселях
     * @param {number} height - Высота мира в пикселях
     */
    setWorldBounds(width, height) {
        // Сохраняем размеры мира для пересчёта при resize
        this.worldWidth = width;
        this.worldHeight = height;
        
        this.worldBounds = {
            minX: 0,
            minY: 0,
            maxX: Math.max(0, width - this.width),
            maxY: Math.max(0, height - this.height)
        };
    }

    /**
     * Мгновенно центрирует камеру на цели
     */
    centerOnTarget() {
        if (!this.target) return;
        
        const targetX = this.target.x + this.target.displayWidth / 2 + this.offsetX;
        const targetY = this.target.y + this.target.displayHeight / 2 + this.offsetY;
        
        this.x = targetX - this.width / 2;
        this.y = targetY - this.height / 2;
        
        this.clampToBounds();
    }

    /**
     * Мгновенно перемещает камеру в позицию
     * @param {number} x - X координата
     * @param {number} y - Y координата
     */
    setPosition(x, y) {
        this.x = x;
        this.y = y;
        this.clampToBounds();
    }

    /**
     * Обновление камеры
     * @param {number} dt - Delta time
     */
    update(dt) {
        if (!this.target) return;
        
        // Вычисляем желаемую позицию камеры (центр на цели)
        const targetCenterX = this.target.x + this.target.displayWidth / 2 + this.offsetX;
        const targetCenterY = this.target.y + this.target.displayHeight / 2 + this.offsetY;
        
        const desiredX = targetCenterX - this.width / 2;
        const desiredY = targetCenterY - this.height / 2;
        
        // Плавное следование с интерполяцией
        const lerpFactor = 1 - Math.pow(1 - this.smoothing, dt * 60);
        
        this.x += (desiredX - this.x) * lerpFactor;
        this.y += (desiredY - this.y) * lerpFactor;
        
        // Ограничиваем границами мира
        this.clampToBounds();
    }

    /**
     * Ограничивает камеру границами мира
     */
    clampToBounds() {
        this.x = Math.max(this.worldBounds.minX, Math.min(this.x, this.worldBounds.maxX));
        this.y = Math.max(this.worldBounds.minY, Math.min(this.y, this.worldBounds.maxY));
    }

    /**
     * Обновляет размеры камеры
     * @param {number} width - Новая ширина
     * @param {number} height - Новая высота
     */
    resize(width, height) {
        const oldWidth = this.width;
        const oldHeight = this.height;
        
        this.width = width;
        this.height = height;
        
        // Пересчитываем границы мира с учётом нового размера камеры
        if (this.worldBounds.maxX !== Infinity && this.worldWidth) {
            this.worldBounds.maxX = Math.max(0, this.worldWidth - this.width);
            this.worldBounds.maxY = Math.max(0, this.worldHeight - this.height);
        }
        
        this.clampToBounds();
    }

    /**
     * Проверяет, находится ли точка в видимой области
     * @param {number} x - X координата
     * @param {number} y - Y координата
     * @returns {boolean}
     */
    isVisible(x, y, width = 0, height = 0) {
        return x + width >= this.x &&
               x <= this.x + this.width &&
               y + height >= this.y &&
               y <= this.y + this.height;
    }

    /**
     * Конвертирует мировые координаты в экранные
     * @param {number} worldX - X в мировых координатах
     * @param {number} worldY - Y в мировых координатах
     * @returns {Object} - {x, y} в экранных координатах
     */
    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y
        };
    }

    /**
     * Конвертирует экранные координаты в мировые
     * @param {number} screenX - X в экранных координатах
     * @param {number} screenY - Y в экранных координатах
     * @returns {Object} - {x, y} в мировых координатах
     */
    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.x,
            y: screenY + this.y
        };
    }
}
