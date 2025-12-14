/**
 * Teleport - Зона телепортации для перехода на другую карту
 */
class Teleport {
    /**
     * @param {Object} config - Конфигурация телепорта
     */
    constructor(config = {}) {
        this.x = config.x || 0;
        this.y = config.y || 0;
        this.width = config.width || 32;
        this.height = config.height || 64;
        
        // Целевая карта
        this.targetMap = config.targetMap || '';
        
        // Позиция спавна на целевой карте (опционально)
        this.targetX = config.targetX || null;
        this.targetY = config.targetY || null;
        
        // ID целевого телепорта (для связи телепортов)
        this.targetTeleportId = config.targetTeleportId || '';
        
        // Уникальный ID этого телепорта
        this.id = config.id || config.name || '';
        
        // Имя для отображения
        this.name = config.name || 'Телепорт';
        
        // Активен ли телепорт
        this.active = config.active !== false;
        
        // Требует ли активации (нажатия клавиши)
        this.requiresInteraction = config.requiresInteraction !== false;
        
        // Время перезарядки после использования
        this.cooldown = config.cooldown || 2;
        this.cooldownTimer = 0;
        
        // Анимация
        this.animTimer = 0;
        this.particleTimer = 0;
        this.particles = [];
        
        // Игрок внутри зоны
        this.playerInside = false;
    }

    /**
     * Обновление телепорта
     * @param {number} dt
     * @param {Player} player
     * @param {EventManager} eventManager
     * @returns {Object|null} - Данные для телепортации или null
     */
    update(dt, player, eventManager) {
        if (!this.active) return null;
        
        // Обновляем кулдаун
        if (this.cooldownTimer > 0) {
            this.cooldownTimer -= dt;
        }
        
        // Анимация
        this.animTimer += dt;
        this.updateParticles(dt);
        
        // Проверяем пересечение с игроком
        const wasInside = this.playerInside;
        this.playerInside = this.checkCollision(player);
        
        // Если игрок внутри и телепорт готов
        if (this.playerInside && this.cooldownTimer <= 0) {
            // Автоматическая телепортация или по нажатию
            if (!this.requiresInteraction) {
                return this.getTeleportData();
            } else if (eventManager.isKeyJustPressed('KeyF') || eventManager.isKeyJustPressed('KeyE')) {
                return this.getTeleportData();
            }
        }
        
        return null;
    }

    /**
     * Проверка пересечения с игроком
     * @param {Player} player
     * @returns {boolean}
     */
    checkCollision(player) {
        if (!player) return false;
        
        const pb = player.getBounds();
        return (
            pb.left < this.x + this.width &&
            pb.right > this.x &&
            pb.top < this.y + this.height &&
            pb.bottom > this.y
        );
    }

    /**
     * Возвращает данные для телепортации
     * @returns {Object}
     */
    getTeleportData() {
        this.cooldownTimer = this.cooldown;
        return {
            targetMap: this.targetMap,
            targetX: this.targetX,
            targetY: this.targetY,
            targetTeleportId: this.targetTeleportId,
            sourceTeleportId: this.id
        };
    }

    /**
     * Обновление частиц
     * @param {number} dt
     */
    updateParticles(dt) {
        this.particleTimer += dt;
        
        // Создаём новые частицы
        if (this.particleTimer > 0.05) {
            this.particleTimer = 0;
            this.particles.push({
                x: this.x + Math.random() * this.width,
                y: this.y + this.height,
                vx: (Math.random() - 0.5) * 20,
                vy: -30 - Math.random() * 40,
                life: 1,
                size: 2 + Math.random() * 3
            });
        }
        
        // Обновляем частицы
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt * 1.5;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * Отрисовка телепорта
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        
        // Портальное свечение
        const pulse = Math.sin(this.animTimer * 3) * 0.3 + 0.7;
        
        // Фон портала
        const gradient = ctx.createLinearGradient(
            screenX, screenY,
            screenX, screenY + this.height
        );
        gradient.addColorStop(0, `rgba(128, 0, 255, ${0.2 * pulse})`);
        gradient.addColorStop(0.5, `rgba(180, 100, 255, ${0.4 * pulse})`);
        gradient.addColorStop(1, `rgba(128, 0, 255, ${0.2 * pulse})`);
        
        ctx.fillStyle = gradient;
        ctx.fillRect(screenX, screenY, this.width, this.height);
        
        // Рамка
        ctx.strokeStyle = `rgba(200, 150, 255, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, this.width, this.height);
        
        // Частицы
        for (const p of this.particles) {
            const px = p.x - camera.x;
            const py = p.y - camera.y;
            ctx.fillStyle = `rgba(200, 150, 255, ${p.life * 0.8})`;
            ctx.beginPath();
            ctx.arc(px, py, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Подсказка если игрок рядом
        if (this.playerInside && this.requiresInteraction) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(screenX - 10, screenY - 30, this.width + 20, 24);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('[F] Телепорт', screenX + this.width / 2, screenY - 12);
        }
    }

    /**
     * Отрисовка отладки
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderDebug(ctx, camera) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;
        
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenX, screenY, this.width, this.height);
        
        ctx.fillStyle = '#ff00ff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`→ ${this.targetMap}`, screenX, screenY - 2);
    }
}

/**
 * TeleportManager - Управление телепортами на карте
 */
class TeleportManager {
    constructor() {
        this.teleports = [];
        this.pendingTeleport = null;
    }

    /**
     * Загружает телепорты из карты Tiled
     * @param {Object} mapData
     */
    loadFromMap(mapData) {
        this.teleports = [];
        this.pendingTeleport = null;
        
        if (!mapData || !mapData.layers) {
            console.warn('TeleportManager: No map data');
            return;
        }

        // Ищем слои объектов с именами содержащими 'teleport'
        const teleportLayers = mapData.layers.filter(layer => 
            layer.type === 'objectgroup' && 
            /teleport/i.test(layer.name)
        );

        for (const layer of teleportLayers) {
            if (!layer.objects) continue;
            
            for (const obj of layer.objects) {
                const teleport = this.createTeleportFromObject(obj);
                if (teleport) {
                    this.teleports.push(teleport);
                }
            }
        }

        console.log(`TeleportManager: Loaded ${this.teleports.length} teleports`);
    }

    /**
     * Создаёт телепорт из объекта Tiled
     * @param {Object} obj
     * @returns {Teleport|null}
     */
    createTeleportFromObject(obj) {
        const props = this.extractProperties(obj.properties);
        
        return new Teleport({
            x: obj.x,
            y: obj.y,
            width: obj.width || 32,
            height: obj.height || 64,
            id: obj.name || `teleport_${obj.id}`,
            name: obj.name || 'Телепорт',
            targetMap: props.targetMap || props.target || '',
            targetX: props.targetX ? parseFloat(props.targetX) : null,
            targetY: props.targetY ? parseFloat(props.targetY) : null,
            targetTeleportId: props.targetTeleportId || props.targetId || '',
            requiresInteraction: props.requiresInteraction !== 'false' && props.auto !== 'true',
            cooldown: parseFloat(props.cooldown) || 2,
            active: props.active !== 'false'
        });
    }

    /**
     * Извлекает свойства из массива Tiled
     * @param {Array} properties
     * @returns {Object}
     */
    extractProperties(properties) {
        const result = {};
        if (!properties) return result;
        
        for (const prop of properties) {
            // Поддержка как camelCase, так и snake_case
            let name = prop.name;
            if (name === 'target_map') name = 'targetMap';
            if (name === 'target_x') name = 'targetX';
            if (name === 'target_y') name = 'targetY';
            if (name === 'target_teleport_id') name = 'targetTeleportId';
            if (name === 'requires_interaction') name = 'requiresInteraction';
            
            result[name] = prop.value;
        }
        return result;
    }

    /**
     * Обновление телепортов
     * @param {number} dt
     * @param {Player} player
     * @param {EventManager} eventManager
     * @returns {Object|null} - Данные телепортации
     */
    update(dt, player, eventManager) {
        for (const teleport of this.teleports) {
            const result = teleport.update(dt, player, eventManager);
            if (result) {
                this.pendingTeleport = result;
                return result;
            }
        }
        return null;
    }

    /**
     * Получает и очищает ожидающую телепортацию
     * @returns {Object|null}
     */
    consumePendingTeleport() {
        const result = this.pendingTeleport;
        this.pendingTeleport = null;
        return result;
    }

    /**
     * Находит телепорт по ID
     * @param {string} id
     * @returns {Teleport|null}
     */
    getTeleportById(id) {
        return this.teleports.find(t => t.id === id) || null;
    }

    /**
     * Отрисовка всех телепортов
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        for (const teleport of this.teleports) {
            teleport.render(ctx, camera);
        }
    }

    /**
     * Отрисовка отладки
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderDebug(ctx, camera) {
        for (const teleport of this.teleports) {
            teleport.renderDebug(ctx, camera);
        }
    }
}
