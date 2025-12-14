/**
 * Player - Класс игрока
 * Наследуется от Entity, добавляет управление и специфичную логику
 */
class Player extends Entity {
    constructor(config = {}) {
        // Конфигурация спрайта игрока (BestiaryGirl)
        const playerSpriteConfig = {
            imagePath: 'images/npc/FuryPlayer.png',
            frameWidth: 40,       // Ширина одного кадра
            frameHeight: 55,      // Высота одного кадра
            offsetX: 0,           // Отступ слева
            offsetY: 0,           // Отступ сверху
            spacingX: 0,          // Промежуток по X
            spacingY: 3,          // Промежуток по Y
            framesPerRow: 1,      // Вертикальный спрайт (1 кадр в строке)
            animations: {
                idle: {
                    frames: [0],  // Кадры для анимации (индексы)
                    speed: 0.2,
                    loop: true
                },
                walk: {
                    frames: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
                    speed: 0.06,
                    loop: true
                },
                jump: {
                    frames: [1],
                    speed: 0.1,
                    loop: false
                },
                fall: {
                    frames: [1],
                    speed: 0.1,
                    loop: false
                }, 
                attack: {
                    frames: [19, 20, 21, 22],
                    speed: 0.08,
                    loop: false
                }
            }
            ,
            smooth: true // улучшить качество отрисовки спрайта игрока
        };
        
        // Объединяем с переданной конфигурацией
        super({
            ...config,
            spriteConfig: { ...playerSpriteConfig, ...config.spriteConfig },
            hitboxWidth: 20,
            hitboxHeight: 42,
            hitboxOffsetX: 8,
            hitboxOffsetY: 10,
            displayWidth: 36,
            displayHeight: 52
        });
        
        // Параметры движения игрока
        this.moveSpeed = 150;      // Скорость ходьбы
        this.jumpForce = 350;      // Сила прыжка
        this.airControl = 0.7;     // Контроль в воздухе (множитель)
        
        // Состояния
        this.isJumping = false;
        this.canJump = true;
        
        // Количество прыжков (для двойного прыжка в будущем)
        this.maxJumps = 1;
        this.jumpsLeft = this.maxJumps;
        
        // Инвентарь
        this.inventory = new Inventory(6);
        
        // Магия
        this.isCasting = false;
        this.castTimer = 0;
        this.castWindup = 0.18; // короткая задержка для анимации
        this.spellCooldowns = new Map();
        this.globalCastLock = 0;

        // Ресурс маны
        this.maxMana = 120;
        this.mana = this.maxMana;
        this.manaRegen = 18; // в секунду
        this.manaRegenDelay = 0.6;
        this.manaRegenCooldown = 0;

        // Баффы
        this.buffs = [];

        // Провал через платформы по нажатию S
        this.dropThroughTimer = 0;
        this.isDroppingThrough = false;
        
        // Эффект урона
        this.damageFlashTimer = 0;
        this.damageFlashDuration = 0.2;
        this.isDamaged = false;
        this.invincibleTimer = 0; // Неуязвимость после получения урона
        this.invincibleDuration = 0.5;
    }
    
    /**
     * Обновление маны (реген с задержкой)
     */
    updateMana(dt) {
        if (this.manaRegenCooldown > 0) {
            this.manaRegenCooldown -= dt;
            return;
        }

        const regen = this.manaRegen * this.getManaRegenMultiplier();
        this.mana = Math.min(this.maxMana, this.mana + regen * dt);
    }

    /**
     * Обновление и очистка баффов
     */
    updateBuffs(dt) {
        this.buffs = this.buffs.filter(buff => {
            buff.timeLeft -= dt;
            return buff.timeLeft > 0;
        });
    }

    addBuff(id, config) {
        const existing = this.buffs.find(b => b.id === id);
        if (existing) {
            existing.stacks = Math.min(existing.stacks + (config.stacks || 1), existing.maxStacks || existing.stacks);
            const newDuration = config.duration || existing.duration || 0;
            existing.duration = Math.max(existing.duration || 0, newDuration);
            existing.timeLeft = Math.max(existing.timeLeft, newDuration);
        } else {
            this.buffs.push({
                id,
                stacks: config.stacks || 1,
                maxStacks: config.maxStacks || 10,
                timeLeft: config.duration || 5,
                duration: config.duration || 5,
                bonuses: config.bonuses || {}
            });
        }
    }

    getBuffValue(key) {
        let value = 0;
        for (const buff of this.buffs) {
            if (buff.bonuses && buff.bonuses[key]) {
                value += buff.bonuses[key] * buff.stacks;
            }
        }
        return value;
    }

    getDamageMultiplier() {
        return 1 + this.getBuffValue('damage');
    }

    getProjectileSpeedMultiplier() {
        return 1 + this.getBuffValue('projectileSpeed');
    }

    getManaRegenMultiplier() {
        return 1 + this.getBuffValue('manaRegen');
    }

    getCooldownReduction() {
        return Math.min(0.5, this.getBuffValue('cooldownReduction')); // Максимум 50%
    }

    getMoveSpeedMultiplier() {
        return 1 + this.getBuffValue('moveSpeed');
    }

    getDefenseBonus() {
        return this.getBuffValue('defense');
    }

    getLifeSteal() {
        return this.getBuffValue('lifeSteal');
    }

    /**
     * Реакция на убийство врага
     */
    onKill(enemy, context = {}) {
        // Базовый бафф Arcane Fury за каждое убийство
        this.addBuff('arcane_fury', {
            stacks: 1,
            maxStacks: 12,
            duration: 8,
            bonuses: {
                damage: 0.05,
                projectileSpeed: 0.04,
                manaRegen: 0.04
            }
        });

        const manaBonus = 10 + (context.onKillMana || 0);
        this.mana = Math.min(this.maxMana, this.mana + manaBonus);
        
        // Шанс получить дополнительные баффы на основе элемента убившего заклинания
        this.tryGrantElementalBuff(context);
        
        // Лайфстил при убийстве
        const lifeSteal = this.getLifeSteal();
        if (lifeSteal > 0) {
            const healAmount = Math.floor((enemy.maxHealth || 30) * lifeSteal);
            this.health = Math.min(this.maxHealth, this.health + healAmount);
        }
    }

    /**
     * Пытается дать элементальный бафф в зависимости от типа заклинания
     */
    tryGrantElementalBuff(context) {
        const element = context.element;
        if (!element) return;
        
        // 20% шанс получить специальный бафф
        if (Math.random() > 0.2) return;
        
        switch (element) {
            case 'fire':
                this.addBuff('burning_soul', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 10,
                    bonuses: { damage: 0.08 }
                });
                break;
            case 'frost':
                this.addBuff('frost_armor', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 12,
                    bonuses: { defense: 2 }
                });
                break;
            case 'lightning':
                this.addBuff('static_charge', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 8,
                    bonuses: { cooldownReduction: 0.04 }
                });
                break;
            case 'void':
            case 'shadow':
                this.addBuff('void_embrace', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 10,
                    bonuses: { lifeSteal: 0.02 }
                });
                break;
            case 'holy':
                this.addBuff('divine_blessing', {
                    stacks: 1,
                    maxStacks: 3,
                    duration: 15,
                    bonuses: { manaRegen: 0.15 }
                });
                break;
            case 'arcane':
                this.addBuff('arcane_intellect', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 12,
                    bonuses: { damage: 0.03, projectileSpeed: 0.05 }
                });
                break;
            case 'earth':
                this.addBuff('stone_skin', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 15,
                    bonuses: { defense: 3, moveSpeed: -0.02 }
                });
                break;
            case 'water':
                this.addBuff('flow_state', {
                    stacks: 1,
                    maxStacks: 5,
                    duration: 10,
                    bonuses: { moveSpeed: 0.05, manaRegen: 0.05 }
                });
                break;
        }
    }

    /**
     * Применяет бафф напрямую (для пауэр-апов)
     * @param {string} buffId - ID баффа
     * @param {Object} config - Конфигурация
     */
    applyPowerUp(buffId, config) {
        this.addBuff(buffId, config);
        console.log(`Player: Получен power-up ${buffId}!`);
    }

    /**
     * Обработка ввода игрока
    * @param {EventManager} eventManager - Менеджер событий
    * @param {Game} game - Игра
     */
    handleInput(eventManager, game) {
        // Не двигаемся во время атаки
        // if (this.isAttacking) {
        //     this.velocityX = 0;
        //     return;
        // }
        
        // Горизонтальное движение
        let moveX = 0;

        // Провалиться через платформу на S (только если стоим на платформе)
        if (eventManager.isKeyJustPressed('KeyS') && this.onGround && game && game.mapManager && game.physicsManager) {
            // Проверяем тайл под игроком
            const bounds = this.getBounds();
            const footX = bounds.left + bounds.width / 2;
            const footY = bounds.bottom + 1;
            const tileX = Math.floor(footX / game.mapManager.tileWidth);
            const tileY = Math.floor(footY / game.mapManager.tileHeight);
            let standingOnPlatform = false;
            const foundTiles = [];
            for (let i = 0; i < game.mapManager.layers.length; i++) {
                if (!game.mapManager.isCollidableLayer(i)) continue;
                const tileId = game.mapManager.getTileAt(i, tileX, tileY);
                foundTiles.push({ layer: i, tileId });
                if (game.physicsManager.isPlatformTile(tileId)) {
                    standingOnPlatform = true;
                    // remember which tile caused it
                    var platformTileInfo = { layer: i, tileId };
                    break;
                }
            }

            // Debug info (only when debug mode is enabled)
            if (game.gameManager && game.gameManager.debug) {
                if (standingOnPlatform) {
                    console.log(`Player: Detected platform under feet - tile ${platformTileInfo.tileId} at layer ${platformTileInfo.layer}`);
                } else {
                    console.log(`Player: No platform under feet. Found tiles: ${JSON.stringify(foundTiles)}`);
                }
            }

            if (standingOnPlatform) {
                this.dropThroughTimer = 0.25;
                // Сразу начинаем падать вниз через платформу
                this.onGround = false;
                this.velocityY = Math.max(this.velocityY, 60);
                if (game.gameManager && game.gameManager.debug) {
                    console.log('Player: Drop-through initiated');
                }
            }
        }
        
        if (eventManager.isKeyDown('KeyA') || eventManager.isKeyDown('ArrowLeft')) {
            moveX = -1;
            this.direction = -1;
        }
        if (eventManager.isKeyDown('KeyD') || eventManager.isKeyDown('ArrowRight')) {
            moveX = 1;
            this.direction = 1;
        }
        
        // Применяем скорость с учётом контроля в воздухе и баффов
        const control = this.onGround ? 1 : this.airControl;
        const speedMult = this.getMoveSpeedMultiplier();
        this.velocityX = moveX * this.moveSpeed * control * speedMult;
        
        // Прыжок
        if ((eventManager.isKeyJustPressed('Space') || eventManager.isKeyJustPressed('KeyW') || eventManager.isKeyJustPressed('ArrowUp'))) {
            this.jump();
        }
        
        // Каст (ЛКМ или E)
        if (eventManager.mouse.leftButton || eventManager.isKeyJustPressed('KeyE')) {
            this.tryCastSpell(game);
        }
        
        // Переключение слотов инвентаря (1-6)
        for (let i = 1; i <= 6; i++) {
            if (eventManager.isKeyJustPressed(`Digit${i}`)) {
                this.inventory.selectSlot(i - 1);
            }
        }
        
        // Колёсико мыши для переключения слотов
        // (реализуется через EventManager если нужно)
    }
    
    /**
     * Попытка атаки
     */
    tryCastSpell(game) {
        if (this.isCasting || this.globalCastLock > 0) return;

        const spell = this.inventory.getSelectedItem();
        if (!spell || spell.type !== 'spell') return;

        const cooldown = this.spellCooldowns.get(spell.id) || 0;
        if (cooldown > 0) return;

        if (this.mana < spell.manaCost) return;

        // Расходуем ресурсы и ставим кулдауны с учётом cooldown reduction
        this.mana -= spell.manaCost;
        this.manaRegenCooldown = this.manaRegenDelay;
        const cdr = this.getCooldownReduction();
        const actualCooldown = spell.cooldown * (1 - cdr);
        this.spellCooldowns.set(spell.id, actualCooldown);
        this.globalCastLock = 0.08;

        this.isCasting = true;
        this.castTimer = this.castWindup;
        this.setAnimation('attack', true);

        this.castSpell(spell, game);
    }

    /**
     * Создаёт магический снаряд
     * @param {Item} spell
     * @param {Game} game
     */
    castSpell(spell, game) {
        const centerX = this.x + this.displayWidth / 2;
        const centerY = this.y + this.displayHeight / 2 - 6;
        const targetX = game.eventManager.mouse.worldX || centerX + this.direction;
        const targetY = game.eventManager.mouse.worldY || centerY;
        const dirX = targetX - centerX;
        const dirY = targetY - centerY;

        const projectile = new MagicProjectile({
            x: centerX,
            y: centerY,
            dirX,
            dirY,
            speed: spell.projectileSpeed * this.getProjectileSpeedMultiplier(),
            damage: spell.damage * this.getDamageMultiplier(),
            radius: spell.projectileRadius,
            lifeTime: spell.projectileLife,
            trailColors: spell.trailColors,
            pierce: spell.pierce,
            explosionRadius: spell.explosionRadius,
            element: spell.element,
            slowAmount: spell.slow,
            owner: this,
            onKillMana: spell.onKillMana,
            spellId: spell.id,
            game
        });

        // Направление персонажа смотрит туда же
        this.direction = dirX >= 0 ? 1 : -1;

        if (game && game.gameManager) {
            game.gameManager.addProjectile(projectile);
        }
    }

    /**
     * Выполняет прыжок
     */
    jump() {
        if (this.onGround && this.jumpsLeft > 0) {
            this.velocityY = -this.jumpForce;
            this.isJumping = true;
            this.onGround = false;
            this.jumpsLeft--;
        }
    }

    /**
     * Обновление состояния игрока
     * @param {number} dt - Delta time
     * @param {Game} game - Ссылка на игру
     */
    update(dt, game) {
        // Обновляем таймеры
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }
        
        if (this.isDamaged) {
            this.damageFlashTimer -= dt;
            if (this.damageFlashTimer <= 0) {
                this.isDamaged = false;
            }
        }

        if (this.globalCastLock > 0) {
            this.globalCastLock -= dt;
        }

        if (this.isCasting) {
            this.castTimer -= dt;
            if (this.castTimer <= 0) {
                this.isCasting = false;
            }
        }

        // Таймер провала через платформы
        if (this.dropThroughTimer > 0) {
            this.dropThroughTimer -= dt;
            if (this.dropThroughTimer <= 0) {
                this.dropThroughTimer = 0;
            }
        }

        // Флаг провала через платформы (используется PhysicsManager)
        this.isDroppingThrough = this.dropThroughTimer > 0;

        // Персональные кулдауны заклинаний
        for (const [spellId, value] of this.spellCooldowns.entries()) {
            const next = value - dt;
            if (next <= 0) {
                this.spellCooldowns.delete(spellId);
            } else {
                this.spellCooldowns.set(spellId, next);
            }
        }

        // Манареген и баффы
        this.updateMana(dt);
        this.updateBuffs(dt);
        
        // Обработка ввода
        this.handleInput(game.eventManager, game);
        
        // Восстановление прыжков при приземлении
        if (this.onGround) {
            this.jumpsLeft = this.maxJumps;
            this.isJumping = false;
        }
        
        // Подбор предметов
        this.pickupItems(game);
        
        // Обновление анимации на основе состояния
        this.updateAnimationState();
        
        // Базовое обновление (анимация)
        super.update(dt, game);
    }
    
    /**
     * Подбирает предметы рядом
     * @param {Game} game
     */
    pickupItems(game) {
        const bounds = this.getBounds();
        
        for (let i = game.gameManager.items.length - 1; i >= 0; i--) {
            const item = game.gameManager.items[i];
            if (!item.active) continue;
            
            const itemBounds = item.getBounds();
            
            // Простая проверка пересечения
            if (bounds.left < itemBounds.right &&
                bounds.right > itemBounds.left &&
                bounds.top < itemBounds.bottom &&
                bounds.bottom > itemBounds.top) {
                
                // Пробуем добавить в инвентарь
                if (this.inventory.addItem(item)) {
                    item.active = false;
                    console.log(`Player: Подобран ${item.name}`);
                }
            }
        }
    }

    /**
     * Определяет текущую анимацию на основе состояния
     */
    updateAnimationState() {
        // Не меняем анимацию во время каста
        if (this.isCasting) {
            this.setAnimation('attack');
            return;
        }
        
        if (!this.onGround) {
            if (this.velocityY < 0) {
                this.setAnimation('jump');
            } else {
                this.setAnimation('fall');
            }
        } else if (Math.abs(this.velocityX) > 10) {
            this.setAnimation('walk');
        } else {
            this.setAnimation('idle');
        }
    }

    /**
     * Получает урон
     * @param {number} amount - Количество урона
     */
    takeDamage(amount) {
        // Неуязвимость после удара
        if (this.invincibleTimer > 0) return;
        
        // Применяем защиту
        const defense = this.getDefenseBonus();
        const actualDamage = Math.max(1, amount - defense);
        
        this.health -= actualDamage;
        this.isDamaged = true;
        this.damageFlashTimer = this.damageFlashDuration;
        this.invincibleTimer = this.invincibleDuration;
        
        if (this.health <= 0) {
            this.health = 0;
            this.die();
        }
    }

    /**
     * Смерть игрока
     */
    die() {
        console.log('Player: Игрок погиб!');
        // В будущем - респаун, game over экран и т.д.
    }
    
    /**
     * Отрисовка игрока
     * @param {CanvasRenderingContext2D} ctx
     * @param {Camera} camera
     */
    render(ctx, camera) {
        if (!this.active) return;
        
        ctx.save();
        
        // Мигание при неуязвимости
        if (this.invincibleTimer > 0 && Math.floor(this.invincibleTimer * 10) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }
        
        // Базовая отрисовка
        super.render(ctx, camera);
        
        ctx.restore();

        // Светящийся шар в руке при касте
        if (this.isCasting) {
            const handX = Math.floor(this.x - camera.x + (this.direction === 1 ? this.displayWidth - 10 : 10));
            const handY = Math.floor(this.y - camera.y + this.displayHeight / 2);
            const r = 10;
            const g = ctx.createRadialGradient(handX, handY, 2, handX, handY, r);
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.4, '#7cf7ff');
            g.addColorStop(1, 'rgba(124,247,255,0)');
            ctx.globalAlpha = 0.7;
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(handX, handY, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
    }
    
    
    /**
     * Отрисовка UI игрока (HP бар)
     * @param {CanvasRenderingContext2D} ctx
     */
    renderUI(ctx) {
        // HP бар в верхней части экрана справа
        const barWidth = 150;
        const barHeight = 16;
        const x = ctx.canvas.width - barWidth - 50;
        const y = 15;
        
        // Фон
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 5, y - 5, barWidth + 10, barHeight + 10);
        
        // Фон полоски
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // HP
        const hpPercent = this.health / this.maxHealth;
        const hpColor = hpPercent > 0.5 ? '#ff3333' : hpPercent > 0.25 ? '#ff6633' : '#ff0000';
        ctx.fillStyle = hpColor;
        ctx.fillRect(x, y, barWidth * hpPercent, barHeight);
        
        // Текст
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(this.health)} / ${this.maxHealth}`, x + barWidth / 2, y + 12);
        
        // Иконка сердца
        ctx.fillStyle = '#ff0000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText('❤', x - 8, y + 13);
        
        // Рамка
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);

        // Мана под HP
        const manaY = y + barHeight + 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 5, manaY - 5, barWidth + 10, barHeight + 10);

        ctx.fillStyle = '#1c2d5c';
        ctx.fillRect(x, manaY, barWidth, barHeight);

        const manaPercent = this.mana / this.maxMana;
        const manaColor = '#4bc8ff';
        ctx.fillStyle = manaColor;
        ctx.fillRect(x, manaY, barWidth * manaPercent, barHeight);

        ctx.fillStyle = '#e0f6ff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.floor(this.mana)} / ${this.maxMana}`, x + barWidth / 2, manaY + 12);
        ctx.strokeStyle = '#4bc8ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, manaY, barWidth, barHeight);

        // Активные баффы (слева сверху)
        const buffSize = 26;
        const buffStartX = 12;
        const buffStartY = 12;
        for (let i = 0; i < this.buffs.length; i++) {
            const buff = this.buffs[i];
            const bx = buffStartX;
            const by = buffStartY + i * (buffSize + 6);
            ctx.fillStyle = 'rgba(20, 26, 52, 0.75)';
            ctx.fillRect(bx, by, buffSize * 2.8, buffSize);
            ctx.strokeStyle = '#6cf0ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, by, buffSize * 2.8, buffSize);

            ctx.fillStyle = '#6cf0ff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.fillText(`${buff.id.toUpperCase()} x${buff.stacks}`, bx + 6, by + 16);

            ctx.fillStyle = 'rgba(108, 240, 255, 0.35)';
            const pct = Math.min(buff.timeLeft / (buff.duration || buff.timeLeft), 1);
            ctx.fillRect(bx, by + buffSize - 6, (buffSize * 2.8) * pct, 4);
        }
    }
}
