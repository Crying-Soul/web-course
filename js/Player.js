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
        this.footstepTimer = 0;
        this.footstepInterval = 0.28;
        
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

        // Выкинуть выбранное заклинание
        if (eventManager.isKeyJustPressed('KeyQ')) {
            this.dropSelectedSpell(game);
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
     * Выбрасывает выбранное заклинание на землю
     */
    dropSelectedSpell(game) {
        const item = this.inventory.getSelectedItem();
        if (!item || item.type !== 'spell') return;
        const removed = this.inventory.removeItem(this.inventory.selectedSlot);
        if (!removed || !game || !game.gameManager) return;
        const spawnX = this.x + this.displayWidth / 2 + this.direction * 12;
        const spawnY = this.y + this.displayHeight / 2;
        game.gameManager.spawnItem(removed.id, spawnX, spawnY, {
            velocityX: this.direction * 120,
            velocityY: -120,
            drop: true
        });
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

        const castStyle = spell.castStyle || 'projectile';

        // Направление персонажа смотрит туда же
        this.direction = dirX >= 0 ? 1 : -1;

        if (!game || !game.gameManager) return;

        if (castStyle === 'beam') {
            const beam = new MagicBeam({
                x: centerX,
                y: centerY,
                targetX,
                targetY,
                length: spell.beamLength || 360,
                width: spell.beamWidth || 14,
                duration: spell.beamDuration || 0.25,
                damage: spell.damage * this.getDamageMultiplier(),
                element: spell.element,
                owner: this,
                game
            });
            game.gameManager.addProjectile(beam);
            return;
        }

        if (castStyle === 'zone') {
            const zone = new MagicZone({
                x: centerX,
                y: centerY,
                radius: spell.zoneRadius || 90,
                duration: spell.zoneDuration || 1.0,
                tickDamage: spell.zoneTickDamage || Math.max(6, spell.damage * 0.35 * this.getDamageMultiplier()),
                tickRate: spell.zoneTickRate || 0.25,
                element: spell.element,
                slowAmount: spell.slow || 0,
                owner: this,
                game
            });
            game.gameManager.addProjectile(zone);
            return;
        }

        if (castStyle === 'spray') {
            const count = spell.projectileCount || 3;
            const spreadRad = (spell.spread || 30) * Math.PI / 180;
            for (let i = 0; i < count; i++) {
                const t = count === 1 ? 0 : (i / (count - 1) - 0.5);
                const angle = Math.atan2(dirY, dirX) + spreadRad * t;
                const px = Math.cos(angle);
                const py = Math.sin(angle);
                const projectile = new MagicProjectile({
                    x: centerX,
                    y: centerY,
                    dirX: px,
                    dirY: py,
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
                game.gameManager.addProjectile(projectile);
            }
            return;
        }

        // Обычный снаряд
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
        game.gameManager.addProjectile(projectile);
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
     * Вызывается после применения физики (для шагов и проверок поверхности)
     */
    afterPhysicsUpdate(dt, game) {
        this.handleFootsteps(dt, game);
    }

    handleFootsteps(dt, game) {
        if (!game || !game.mapManager || !game.soundManager) return;

        const speed = Math.abs(this.velocityX);
        const movingOnGround = this.onGround && speed > 18;

        if (movingOnGround) {
            this.footstepTimer -= dt;
            if (this.footstepTimer <= 0) {
                const bounds = this.getBounds();
                const footX = bounds.left + bounds.width / 2;
                const footY = bounds.bottom + 1;
                const tileType = game.mapManager.getTileTypeAtWorld(footX, footY) || 'grass';
                game.soundManager.playFootstep(tileType);

                const speedFactor = Math.min(speed / this.moveSpeed, 1.6);
                this.footstepTimer = Math.max(0.16, this.footstepInterval - 0.05 * speedFactor);
            }
        } else {
            // Быстро отпускаем таймер, чтобы шаг звучал сразу после приземления/старта движения
            this.footstepTimer = Math.min(this.footstepTimer, 0.1);
        }
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
                    
                    // Эффект частиц при подборе
                    if (game.gameManager.particleSystem) {
                        const pickupX = item.x + item.width / 2;
                        const pickupY = item.y + item.height / 2;
                        game.gameManager.particleSystem.createPickupEffect(
                            pickupX, pickupY, item.iconColor || '#ffff00'
                        );
                    }
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
        // В режиме отладки игрок бессмертен
        if (this.gameManager && this.gameManager.debug) {
            console.log(`Player: Урон заблокирован в режиме отладки (${amount})`);
            return;
        }

        // Неуязвимость после удара
        if (this.invincibleTimer > 0) return;
        
        // Применяем защиту
        const defense = this.getDefenseBonus();
        const actualDamage = Math.max(1, amount - defense);
        
        if (this.gameManager && this.gameManager.soundManager) {
            this.gameManager.soundManager.playPlayerHit();
        }

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
        this.active = false;
        if (this.gameManager && typeof this.gameManager.gameOver === 'function') {
            this.gameManager.gameOver();
        }
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
     * Отрисовка UI игрока (HP и Mana бары с улучшенными эффектами)
     * @param {CanvasRenderingContext2D} ctx
     */
    renderUI(ctx) {
        const barWidth = 150;
        const barHeight = 18;
        const x = ctx.canvas.width - barWidth - 50;
        const y = 15;
        const cornerRadius = 4;
        
        ctx.save();
        
        // === HP БАР ===
        const hpPercent = this.health / this.maxHealth;
        
        // Фоновая панель с тенью
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.roundRect(ctx, x - 6, y - 4, barWidth + 32, barHeight + 8, cornerRadius + 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(20, 15, 25, 0.9)';
        this.roundRect(ctx, x - 4, y - 2, barWidth + 28, barHeight + 4, cornerRadius);
        ctx.fill();
        
        // Фон полоски
        ctx.fillStyle = 'rgba(60, 30, 30, 0.9)';
        this.roundRect(ctx, x, y, barWidth, barHeight, cornerRadius - 1);
        ctx.fill();
        
        // HP градиент
        if (hpPercent > 0) {
            const hpGradient = ctx.createLinearGradient(x, y, x, y + barHeight);
            if (hpPercent > 0.5) {
                hpGradient.addColorStop(0, '#ff6666');
                hpGradient.addColorStop(0.5, '#ff3333');
                hpGradient.addColorStop(1, '#cc2222');
            } else if (hpPercent > 0.25) {
                hpGradient.addColorStop(0, '#ff9933');
                hpGradient.addColorStop(0.5, '#ff6633');
                hpGradient.addColorStop(1, '#cc4422');
            } else {
                hpGradient.addColorStop(0, '#ff4444');
                hpGradient.addColorStop(0.5, '#cc0000');
                hpGradient.addColorStop(1, '#880000');
            }
            
            ctx.fillStyle = hpGradient;
            this.roundRect(ctx, x, y, barWidth * hpPercent, barHeight, cornerRadius - 1);
            ctx.fill();
            
            // Блик сверху
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            this.roundRect(ctx, x, y, barWidth * hpPercent, barHeight / 2, cornerRadius - 1);
            ctx.fill();
        }
        
        // Эффект урона - пульсация
        if (this.isDamaged) {
            const pulseAlpha = Math.sin(this.damageFlashTimer * 20) * 0.3 + 0.3;
            ctx.strokeStyle = `rgba(255, 100, 100, ${pulseAlpha})`;
            ctx.lineWidth = 3;
            this.roundRect(ctx, x - 2, y - 2, barWidth + 4, barHeight + 4, cornerRadius);
            ctx.stroke();
        }
        
        // Текст HP
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.fillText(`${Math.ceil(this.health)} / ${this.maxHealth}`, x + barWidth / 2, y + barHeight / 2);
        ctx.shadowBlur = 0;
        
        // Иконка сердца
        ctx.fillStyle = '#ff4444';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('❤', x + barWidth + 14, y + barHeight / 2 + 1);
        
        // Рамка
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, y, barWidth, barHeight, cornerRadius - 1);
        ctx.stroke();

        // === MANA БАР ===
        const manaY = y + barHeight + 10;
        const manaPercent = this.mana / this.maxMana;
        
        // Фон
        ctx.fillStyle = 'rgba(20, 25, 45, 0.9)';
        this.roundRect(ctx, x - 4, manaY - 2, barWidth + 28, barHeight + 4, cornerRadius);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(20, 40, 80, 0.9)';
        this.roundRect(ctx, x, manaY, barWidth, barHeight, cornerRadius - 1);
        ctx.fill();

        // Mana градиент
        if (manaPercent > 0) {
            const manaGradient = ctx.createLinearGradient(x, manaY, x, manaY + barHeight);
            manaGradient.addColorStop(0, '#66ccff');
            manaGradient.addColorStop(0.5, '#4bc8ff');
            manaGradient.addColorStop(1, '#2090cc');
            
            ctx.fillStyle = manaGradient;
            this.roundRect(ctx, x, manaY, barWidth * manaPercent, barHeight, cornerRadius - 1);
            ctx.fill();
            
            // Блик
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.roundRect(ctx, x, manaY, barWidth * manaPercent, barHeight / 2, cornerRadius - 1);
            ctx.fill();
        }

        // Текст Mana
        ctx.fillStyle = '#e0f6ff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.fillText(`${Math.floor(this.mana)} / ${this.maxMana}`, x + barWidth / 2, manaY + barHeight / 2);
        ctx.shadowBlur = 0;
        
        // Иконка маны
        ctx.fillStyle = '#4bc8ff';
        ctx.font = '14px Arial';
        ctx.fillText('✦', x + barWidth + 14, manaY + barHeight / 2 + 1);
        
        // Рамка
        ctx.strokeStyle = 'rgba(75, 200, 255, 0.5)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, x, manaY, barWidth, barHeight, cornerRadius - 1);
        ctx.stroke();
        
        ctx.restore();

        // Активные баффы (слева сверху) с улучшенным дизайном
        const buffSize = 28;
        const buffWidth = 85;
        const buffStartX = 12;
        const buffStartY = 12;
        
        for (let i = 0; i < this.buffs.length; i++) {
            const buff = this.buffs[i];
            const bx = buffStartX;
            const by = buffStartY + i * (buffSize + 5);
            const pct = Math.min(buff.timeLeft / (buff.duration || buff.timeLeft), 1);
            
            // Фон с градиентом
            const buffGradient = ctx.createLinearGradient(bx, by, bx + buffWidth, by);
            buffGradient.addColorStop(0, 'rgba(30, 40, 70, 0.85)');
            buffGradient.addColorStop(1, 'rgba(20, 30, 50, 0.7)');
            ctx.fillStyle = buffGradient;
            this.roundRect(ctx, bx, by, buffWidth, buffSize, 4);
            ctx.fill();
            
            // Прогресс-бар снизу
            if (pct > 0) {
                const progressGradient = ctx.createLinearGradient(bx, by + buffSize - 4, bx + buffWidth * pct, by + buffSize);
                progressGradient.addColorStop(0, 'rgba(108, 240, 255, 0.6)');
                progressGradient.addColorStop(1, 'rgba(80, 200, 255, 0.3)');
                ctx.fillStyle = progressGradient;
                ctx.fillRect(bx + 2, by + buffSize - 5, (buffWidth - 4) * pct, 3);
            }
            
            // Рамка (пульсирует если бафф скоро кончится)
            const borderAlpha = pct < 0.3 ? (Math.sin(Date.now() / 100) * 0.3 + 0.7) : 0.6;
            ctx.strokeStyle = `rgba(108, 240, 255, ${borderAlpha})`;
            ctx.lineWidth = 1;
            this.roundRect(ctx, bx, by, buffWidth, buffSize, 4);
            ctx.stroke();
            
            // Иконка стаков
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`x${buff.stacks}`, bx + 6, by + buffSize / 2 - 2);
            
            // Название баффа (сокращённое)
            const buffName = this.getBuffDisplayName(buff.id);
            ctx.fillStyle = '#b8d4ff';
            ctx.font = '10px Arial';
            ctx.fillText(buffName, bx + 28, by + buffSize / 2 - 2);
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
     * Получает отображаемое имя баффа
     */
    getBuffDisplayName(buffId) {
        const names = {
            'arcane_fury': 'Ярость',
            'burning_soul': 'Пламя',
            'frost_armor': 'Мороз',
            'static_charge': 'Заряд',
            'void_embrace': 'Пустота',
            'divine_blessing': 'Свет',
            'arcane_intellect': 'Разум',
            'stone_skin': 'Камень',
            'flow_state': 'Поток'
        };
        return names[buffId] || buffId.substring(0, 8);
    }
}
