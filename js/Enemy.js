/**
 * Enemy - Класс врага
 * Наследуется от Entity, добавляет ИИ и атаку
 */
class Enemy extends Entity {
    // Базовый конфиг спрайта для врагов (можно переопределять по типу/спавнеру)
    static baseEnemySpriteConfig = {
        imagePath: 'images/npc/FuryPlayer.png',
        frameWidth: 40,
        frameHeight: 55,
        offsetX: 0,
        offsetY: 0,
        spacingX: 0,
        spacingY: 3,
        framesPerRow: 1,
        smooth: false,
        animations: {
            idle: {
                frames: [0],
                speed: 0.2,
                loop: true
            },
            walk: {
                frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                speed: 0.08,
                loop: true
            },
            attack: {
                frames: [19, 20, 21, 22],
                speed: 0.1,
                loop: false
            }
        }
    };

    // Базовые пресеты врагов (можно расширять через registerEnemyType)
    static defaultEnemyPresets = {
        g1: {
            name: 'Призрак',
            health: 35,
            damage: 18,
            moveSpeed: 100,
            detectionRange: 400,
            attackRange: 25,
            attackCooldown: 0.8,
            scoreValue: 30,
            dropChance: 0.25,
            spritePath: 'images/npc/g1.png',
            spriteConfig: Enemy.makeSpriteConfig('images/npc/g1.png', {
                frameWidth: 26,
                frameHeight: 49,
                framesPerRow: 1,
                spacingY: 1,
                animations: {
                    idle: {
                        frames: [0],
                        speed: 0.3,
                        loop: true
                    },
                    walk: {
                        frames: [0, 1, 2],
                        speed: 0.1,
                        loop: true
                    },
                    attack: {
                        frames: [0, 1, 2],
                        speed: 0.15,
                        loop: false
                    }
                }
            })

        
        },
        z1: {
            name: 'Z1',
            health: 50,
            damage: 12,
            moveSpeed: 55,
            detectionRange: 220,
            attackRange: 32,
            attackCooldown: 1.0,
            scoreValue: 15,
            dropChance: 0.16,
            spritePath: 'images/npc/z1.png',
            spriteConfig: Enemy.makeSpriteConfig('images/npc/z1.png', {
                frameWidth: 34,
                frameHeight: 41,
                framesPerRow: 1,
                spacingY: 1,
                animations: {
                    idle: {
                        frames: [0],
                        speed: 0.3,
                        loop: true
                    },
                    walk: {
                        frames: [0, 1, 2],
                        speed: 0.1,
                        loop: true
                    },
                    attack: {
                        frames: [0, 1, 2],
                        speed: 0.15,
                        loop: false
                    }
                }
            })
        },
        z2: {
            name: 'Z2',
            health: 80,
            damage: 18,
            moveSpeed: 65,
            detectionRange: 260,
            attackRange: 36,
            attackCooldown: 1.1,
            scoreValue: 28,
            dropChance: 0.2,
            spritePath: 'images/npc/z2.png',
            spriteConfig: Enemy.makeSpriteConfig('images/npc/z2.png', {
                frameWidth: 34,
                frameHeight: 51,
                framesPerRow: 1,
                spacingY: 1,
                animations: {
                    idle: {
                        frames: [0],
                        speed: 0.3,
                        loop: true
                    },
                    walk: {
                        frames: [0, 1, 2],
                        speed: 0.1,
                        loop: true
                    },
                    attack: {
                        frames: [0, 1, 2],
                        speed: 0.15,
                        loop: false
                    }
                }
            })

        },
        z3: {
            name: 'Z3',
            health: 120,
            damage: 26,
            moveSpeed: 70,
            detectionRange: 320,
            attackRange: 42,
            attackCooldown: 1.2,
            scoreValue: 40,
            dropChance: 0.22,
            spritePath: 'images/npc/z3.png',
            spriteConfig: Enemy.makeSpriteConfig('images/npc/z3.png', {
                frameWidth: 34,
                frameHeight: 53,
                framesPerRow: 1,
                spacingY: 1,
                animations: {
                    idle: {
                        frames: [0],
                        speed: 0.3,
                        loop: true
                    },
                    walk: {
                        frames: [0, 1, 2],
                        speed: 0.1,
                        loop: true
                    },
                    attack: {
                        frames: [0, 1, 2],
                        speed: 0.15,
                        loop: false
                    }
                }
            })

        }
    };

    // Вспомогательные статические методы
    static cloneAnimations(animations = {}) {
        const result = {};
        for (const key of Object.keys(animations)) {
            const anim = animations[key];
            result[key] = {
                ...anim,
                frames: Array.isArray(anim.frames) ? [...anim.frames] : []
            };
        }
        return result;
    }

    static makeSpriteConfig(imagePath, extra = {}) {
        const baseAnimations = Enemy.cloneAnimations(Enemy.baseEnemySpriteConfig.animations);
        const extraAnimations = Enemy.cloneAnimations(extra.animations || {});
        return {
            ...Enemy.baseEnemySpriteConfig,
            imagePath: imagePath || Enemy.baseEnemySpriteConfig.imagePath,
            ...extra,
            animations: { ...baseAnimations, ...extraAnimations }
        };
    }

    constructor(config = {}) {
        const enemyType = config.enemyType || 'slime';

        // Получаем конфиг по типу (фиксированный, без оверрайдов)
        const enemyConfig = Enemy.defaultEnemyPresets[enemyType] || Enemy.defaultEnemyPresets.slime;

        // Конфигурация спрайта врага
        const enemySpriteConfig = enemyConfig.spriteConfig || Enemy.baseEnemySpriteConfig;

        super({
            ...enemyConfig,
            spriteConfig: { ...enemySpriteConfig, ...enemyConfig.spriteConfig },
            hitboxWidth: enemyConfig.hitboxWidth || 20,
            hitboxHeight: enemyConfig.hitboxHeight || 42,
            hitboxOffsetX: enemyConfig.hitboxOffsetX || 8,
            hitboxOffsetY: enemyConfig.hitboxOffsetY || 10,
            displayWidth: enemyConfig.displayWidth || 36,
            displayHeight: enemyConfig.displayHeight || 52,
            x: config.x,
            y: config.y
        });

        // Параметры врага
        this.health = enemyConfig.health || 50;
        this.maxHealth = enemyConfig.maxHealth || enemyConfig.health || 50;
        this.damage = enemyConfig.damage || 10;
        this.moveSpeed = enemyConfig.moveSpeed || 60;
        this.attackRange = enemyConfig.attackRange || 35;
        this.detectionRange = enemyConfig.detectionRange || 200;
        this.attackCooldown = enemyConfig.attackCooldown || 1.0;
        this.scoreValue = enemyConfig.scoreValue || 10;
        this.dropChance = enemyConfig.dropChance || 0.15;

        // Замедление/дебаффы
        this.slowFactor = 1;
        this.slowTimer = 0;

        // Отслеживание убийств
        this.lastAttacker = null;
        this.lastHitMeta = {};

        // Состояние ИИ
        this.aiState = 'idle'; // 'idle', 'chase', 'attack'
        this.target = null;
        this.attackTimer = 0;
        this.isAttacking = false;

        // Лёгкий патруль, чтобы враги всегда двигались
        this.wanderDirection = Math.random() < 0.5 ? -1 : 1;
        this.wanderTimer = 0;
        this.wanderSwitchTime = 1.2 + Math.random();
        this.wanderSpeedFactor = 0.4;

        // Эффект урона
        this.damageFlashTimer = 0;
        this.damageFlashDuration = 0.15;
        this.isDamaged = false;

        // Визуальные эффекты
        this.tint = config.tint || null; // Цвет для отличия врагов
    }

    /**
     * Устанавливает цель для преследования
     * @param {Entity} target
     */
    setTarget(target) {
        this.target = target;
    }

    /**
     * Обновление врага
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        if (!this.active) return;

        // Обновляем таймер урона
        if (this.isDamaged) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer <= 0) {
                this.isDamaged = false;
            }
        }

        // Обновляем таймер атаки
        if (this.attackTimer > 0) {
            this.attackTimer -= dt;
        }

        // Сбрасываем замедление
        if (this.slowTimer > 0) {
            this.slowTimer -= dt;
            if (this.slowTimer <= 0) {
                this.slowFactor = 1;
            }
        }

        // ИИ
        this.updateAI(dt, game);

        // Базовое обновление (анимация)
        super.update(dt, game);
    }

    /**
     * Обновление ИИ
     * @param {number} dt
     * @param {Game} game
     */
    updateAI(dt, game) {
        if (!this.target || !this.target.active) {
            this.runWander(dt);
            return;
        }

        // Расстояние до цели
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Определяем направление к цели
        this.direction = dx > 0 ? 1 : -1;

        // Проверка анимации атаки — легкое движение к цели, не стоим на месте
        if (this.isAttacking) {
            const anim = this.spriteConfig.animations['attack'];
            if (this.animationFrame >= anim.frames.length - 1) {
                this.isAttacking = false;
            }
            this.velocityX = this.direction * this.moveSpeed * 0.25 * this.slowFactor;
            this.setAnimation('attack');
            return;
        }

        // Логика ИИ
        if (distance <= this.attackRange + 4) {
            // Атака или агрессивное давление во время кулдауна
            this.aiState = 'attack';

            if (this.attackTimer <= 0) {
                this.performAttack(game);
            } else {
                // Продолжаем поддавливать, чтобы не залипать на месте
                this.velocityX = this.direction * this.moveSpeed * 0.55 * this.slowFactor;
                this.setAnimation('walk');
            }

        } else if (distance <= this.detectionRange) {
            // Преследование
            this.aiState = 'chase';
            this.velocityX = this.direction * this.moveSpeed * this.slowFactor;
            this.setAnimation('walk');

        } else {
            // Патруль вне зоны обнаружения
            this.runWander(dt);
        }
    }

    /**
     * Примитивное блуждание, чтобы враги не стояли на месте
     */
    runWander(dt) {
        this.aiState = 'wander';
        this.wanderTimer += dt;
        if (this.wanderTimer >= this.wanderSwitchTime) {
            this.wanderTimer = 0;
            this.wanderSwitchTime = 1 + Math.random() * 1.5;
            this.wanderDirection = Math.random() < 0.5 ? -1 : 1;
        }

        this.direction = this.wanderDirection;
        this.velocityX = this.direction * this.moveSpeed * this.wanderSpeedFactor * this.slowFactor;
        this.setAnimation('walk');
    }

    /**
     * Выполняет атаку
     * @param {Game} game
     */
    performAttack(game) {
        this.attackTimer = this.attackCooldown;
        this.isAttacking = true;
        this.setAnimation('attack', true);

        // Наносим урон цели
        if (this.target && typeof this.target.takeDamage === 'function') {
            const dx = this.target.x - this.x;
            const distance = Math.abs(dx);

            if (distance <= this.attackRange + 20) {
                this.target.takeDamage(this.damage);
            }
        }
    }

    /**
     * Получает урон
     * @param {number} amount - Количество урона
     * @param {Entity} attacker - Атакующий
     * @param {Object} context - Доп. сведения об источнике
     */
    takeDamage(amount, attacker = null, context = {}) {
        this.health -= amount;
        this.isDamaged = true;
        this.damageFlashTimer = this.damageFlashDuration;
        this.lastAttacker = attacker;
        this.lastHitMeta = context || {};

        // Отброс от атакующего
        if (attacker) {
            const knockbackDir = this.x > attacker.x ? 1 : -1;
            this.velocityX = knockbackDir * 100;
            this.velocityY = -50;
        }

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /**
     * Смерть врага
     */
    die() {
        this.active = false;
        console.log('Enemy: Враг уничтожен');

        if (this.gameManager && typeof this.gameManager.handleEnemyKilled === 'function') {
            this.gameManager.handleEnemyKilled(this, this.lastAttacker, this.lastHitMeta);
        }
    }

    /**
     * Применяет замедление к врагу
     * @param {number} amount - 0..1 сила замедления
     * @param {number} duration - длительность эффекта
     */
    applySlow(amount = 0.2, duration = 1.5) {
        this.slowFactor = Math.min(this.slowFactor, 1 - amount);
        this.slowTimer = Math.max(this.slowTimer, duration);
    }

    /**
     * Отрисовка врага
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;

        ctx.save();

        // Эффект получения урона - красная вспышка
        if (this.isDamaged) {
            ctx.globalCompositeOperation = 'source-over';
        }

        // Базовая отрисовка
        super.render(ctx, camera);

        // Если получил урон - красный оверлей
        if (this.isDamaged && this.imageLoaded) {
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            const screenX = Math.floor(this.x - camera.x);
            const screenY = Math.floor(this.y - camera.y);
            ctx.fillRect(screenX, screenY, this.displayWidth, this.displayHeight);
        }

        ctx.restore();

        // Полоска HP
        this.renderHealthBar(ctx, camera);
    }

    /**
     * Отрисовка полоски здоровья
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    renderHealthBar(ctx, camera) {
        const barWidth = 30;
        const barHeight = 4;
        const screenX = Math.floor(this.x - camera.x) + (this.displayWidth - barWidth) / 2;
        const screenY = Math.floor(this.y - camera.y) - 8;

        // Фон
        ctx.fillStyle = '#333333';
        ctx.fillRect(screenX, screenY, barWidth, barHeight);

        // HP
        const hpPercent = this.health / this.maxHealth;
        const hpColor = hpPercent > 0.5 ? '#00ff00' : hpPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(screenX, screenY, barWidth * hpPercent, barHeight);

        // Рамка
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(screenX, screenY, barWidth, barHeight);
    }
}
