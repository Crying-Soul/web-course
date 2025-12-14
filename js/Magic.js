/**
 * MagicProjectile - энергетический снаряд для заклинаний
 * Держим простую физику и столкновения с тайлами/врагами
 */
class MagicProjectile {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        const dirX = options.dirX || 1;
        const dirY = options.dirY || 0;
        const length = Math.max(Math.hypot(dirX, dirY), 0.0001);
        this.dirX = dirX / length;
        this.dirY = dirY / length;

        this.speed = options.speed || 360;
        this.damage = options.damage || 10;
        this.radius = options.radius || 6;
        this.lifeTime = options.lifeTime || 2.5;
        this.age = 0;
        this.pierce = options.pierce || 0;
        this.explosionRadius = options.explosionRadius || 0;
        this.element = options.element || 'arcane';
        this.trailColors = options.trailColors || ['#7cf7ff', '#b9f3ff'];
        this.owner = options.owner || null;
        this.slowAmount = options.slowAmount || 0;
        this.onKillMana = options.onKillMana || 0;
        this.spellId = options.spellId || 'unknown_spell';
        this.game = options.game || null;

        this.trail = [];
        this.maxTrail = 14;
        this.active = true;
        this.hitSet = new Set();
    }

    update(dt, game) {
        if (!this.active) return;
        if (game) this.game = game;
        this.age += dt;
        if (this.age >= this.lifeTime) {
            this.active = false;
            return;
        }

        // Движение
        this.x += this.dirX * this.speed * dt;
        this.y += this.dirY * this.speed * dt;

        // Запоминаем след
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrail) {
            this.trail.shift();
        }

        // Столкновение с картой
        const mapForCollision = this.game || game;
        if (mapForCollision && mapForCollision.physicsManager && mapForCollision.physicsManager.isSolidAt(this.x, this.y)) {
            this.explode(mapForCollision);
            this.active = false;
            return;
        }

        // Столкновение с врагами
        const entities = (this.game || game)?.gameManager?.entities || [];
        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;
            if (this.intersectsEnemy(enemy)) {
                this.hitEnemy(enemy);
                if (!this.active) break;
            }
        }
    }

    hitEnemy(enemy) {
        this.hitSet.add(enemy);
        if (typeof enemy.takeDamage === 'function') {
            enemy.takeDamage(this.damage, this.owner, { 
                spellId: this.spellId, 
                onKillMana: this.onKillMana,
                element: this.element 
            });
        }

        if (this.slowAmount > 0 && typeof enemy.applySlow === 'function') {
            enemy.applySlow(this.slowAmount, 1.8);
        }

        // Взрывной снаряд останавливается на контакте
        if (this.explosionRadius > 0) {
            this.explode(this.game);
            this.active = false;
            return;
        }

        // Пронзание нескольких целей
        if (this.pierce > 0) {
            this.pierce -= 1;
            return;
        }

        this.active = false;
    }

    explode(game) {
        if (!game || this.explosionRadius <= 0) return;
        const entities = game.gameManager?.entities || [];
        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;
            const dx = enemy.x + enemy.displayWidth / 2 - this.x;
            const dy = enemy.y + enemy.displayHeight / 2 - this.y;
            if (Math.hypot(dx, dy) <= this.explosionRadius) {
                enemy.takeDamage(this.damage * 0.75, this.owner, { 
                    spellId: this.spellId, 
                    onKillMana: this.onKillMana,
                    element: this.element 
                });
            }
        }
    }

    intersectsEnemy(enemy) {
        const bounds = enemy.getBounds();
        const nearestX = Math.max(bounds.left, Math.min(this.x, bounds.right));
        const nearestY = Math.max(bounds.top, Math.min(this.y, bounds.bottom));
        const dx = this.x - nearestX;
        const dy = this.y - nearestY;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }

    render(ctx, camera) {
        if (!this.active) return;
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // След
        for (let i = 0; i < this.trail.length; i++) {
            const p = this.trail[i];
            const t = i / this.trail.length;
            const alpha = 0.15 + 0.35 * t;
            const r = this.radius * (0.35 + 0.65 * t);
            ctx.fillStyle = this.trailColors[0] || '#7cf7ff';
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(p.x - camera.x, p.y - camera.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Основное ядро
        const gradient = ctx.createRadialGradient(screenX, screenY, this.radius * 0.2, screenX, screenY, this.radius);
        const c0 = this.trailColors[0] || '#ffffff';
        const c1 = this.trailColors[1] || '#7cf7ff';
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, c0);
        gradient.addColorStop(1, c1);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
