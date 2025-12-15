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
            sourceTeleportId: this.id,
            name: this.name
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
        const centerX = screenX + this.width / 2;
        const centerY = screenY + this.height / 2;
        
        // Портальное свечение
        const pulse = Math.sin(this.animTimer * 3) * 0.3 + 0.7;
        const rotationAngle = this.animTimer * 0.5;
        
        ctx.save();

        // Внешнее свечение
        const outerGlow = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.max(this.width, this.height)
        );
        outerGlow.addColorStop(0, `rgba(180, 100, 255, ${0.3 * pulse})`);
        outerGlow.addColorStop(0.5, `rgba(128, 50, 200, ${0.15 * pulse})`);
        outerGlow.addColorStop(1, 'rgba(100, 0, 180, 0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, this.width * 0.8, this.height * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Вращающиеся кольца
        ctx.translate(centerX, centerY);
        
        for (let ring = 0; ring < 3; ring++) {
            ctx.save();
            ctx.rotate(rotationAngle * (ring % 2 === 0 ? 1 : -1) + ring * Math.PI / 3);
            
            const ringAlpha = 0.4 - ring * 0.1;
            const ringScale = 0.9 - ring * 0.15;
            
            ctx.strokeStyle = `rgba(200, 150, 255, ${ringAlpha * pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.width * 0.4 * ringScale, this.height * 0.35 * ringScale, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.translate(-centerX, -centerY);

        // Основной портал с градиентом
        const gradient = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, Math.min(this.width, this.height) * 0.5
        );
        gradient.addColorStop(0, `rgba(50, 0, 100, ${0.9 * pulse})`);
        gradient.addColorStop(0.3, `rgba(100, 50, 180, ${0.7 * pulse})`);
        gradient.addColorStop(0.7, `rgba(150, 100, 220, ${0.5 * pulse})`);
        gradient.addColorStop(1, `rgba(180, 130, 255, ${0.3 * pulse})`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, this.width * 0.4, this.height * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        // Яркое ядро
        const coreGlow = ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, 15
        );
        coreGlow.addColorStop(0, `rgba(255, 255, 255, ${0.8 * pulse})`);
        coreGlow.addColorStop(0.5, `rgba(220, 180, 255, ${0.5 * pulse})`);
        coreGlow.addColorStop(1, 'rgba(180, 130, 255, 0)');
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        ctx.fill();

        // Частицы эффекта телепортации
        for (const p of this.particles) {
            const px = p.x - camera.x;
            const py = p.y - camera.y;
            
            const particleGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * p.life);
            particleGrad.addColorStop(0, `rgba(255, 220, 255, ${p.life * 0.9})`);
            particleGrad.addColorStop(0.5, `rgba(200, 150, 255, ${p.life * 0.6})`);
            particleGrad.addColorStop(1, 'rgba(150, 100, 200, 0)');
            ctx.fillStyle = particleGrad;
            ctx.beginPath();
            ctx.arc(px, py, p.size * p.life * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        
        // Подсказка если игрок рядом
        if (this.playerInside && this.requiresInteraction) {
            ctx.save();
            const hintPulse = Math.sin(this.animTimer * 5) * 0.1 + 0.9;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            const hintWidth = 100;
            const hintX = centerX - hintWidth / 2;
            ctx.fillRect(hintX, screenY - 35, hintWidth, 26);
            
            ctx.strokeStyle = `rgba(200, 150, 255, ${hintPulse})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(hintX, screenY - 35, hintWidth, 26);
            
            ctx.fillStyle = `rgba(255, 255, 255, ${hintPulse})`;
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('[F] Телепорт', centerX, screenY - 17);
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
