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

/**
 * MagicBeam - мгновенный луч, который пробивает линию
 */
class MagicBeam {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        const tx = options.targetX || this.x + 1;
        const ty = options.targetY || this.y;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const len = Math.max(Math.hypot(dx, dy), 0.0001);
        this.dirX = dx / len;
        this.dirY = dy / len;

        this.length = options.length || 300;
        this.width = options.width || 14;
        this.damage = options.damage || 20;
        this.element = options.element || 'arcane';
        this.duration = options.duration || 0.25;
        this.age = 0;
        this.owner = options.owner || null;
        this.game = options.game || null;
        this.active = true;
        this.hitSet = new Set();
    }

    update(dt, game) {
        if (!this.active) return;
        this.age += dt;
        const g = this.game || game;
        if (g) this.applyHits(g);
        if (this.age >= this.duration) {
            this.active = false;
        }
    }

    applyHits(game) {
        const entities = game.gameManager?.entities || [];
        const sx = this.x;
        const sy = this.y;
        const ex = sx + this.dirX * this.length;
        const ey = sy + this.dirY * this.length;

        for (const enemy of entities) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            if (this.hitSet.has(enemy)) continue;

            const exCenter = enemy.x + enemy.displayWidth / 2;
            const eyCenter = enemy.y + enemy.displayHeight / 2;
            const dist = this.pointToSegmentDistance(exCenter, eyCenter, sx, sy, ex, ey);
            if (dist <= this.width) {
                this.hitSet.add(enemy);
                enemy.takeDamage(this.damage, this.owner, { spellId: 'beam', element: this.element });
            }
        }
    }

    pointToSegmentDistance(px, py, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx * dx + dy * dy;
        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const ddx = px - projX;
        const ddy = py - projY;
        return Math.hypot(ddx, ddy);
    }

    render(ctx, camera) {
        if (!this.active) return;
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        const ex = sx + this.dirX * this.length;
        const ey = sy + this.dirY * this.length;

        ctx.save();
        const grad = ctx.createLinearGradient(sx, sy, ex, ey);
        grad.addColorStop(0, 'rgba(255,255,255,0.9)');
        grad.addColorStop(0.4, 'rgba(162,240,255,0.8)');
        grad.addColorStop(1, 'rgba(124,107,255,0.6)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = this.width;
        ctx.globalAlpha = 0.85;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.restore();
    }
}

/**
 * MagicZone - стационарная зона урона/замедления
 */
class MagicZone {
    constructor(options = {}) {
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.radius = options.radius || 80;
        this.duration = options.duration || 1.2;
        this.tickDamage = options.tickDamage || 8;
        this.tickRate = options.tickRate || 0.3;
        this.element = options.element || 'frost';
        this.slowAmount = options.slowAmount || 0;
        this.owner = options.owner || null;
        this.game = options.game || null;
        this.age = 0;
        this.tickTimer = 0;
        this.active = true;
    }

    update(dt, game) {
        if (!this.active) return;
        this.age += dt;
        this.tickTimer -= dt;
        const g = this.game || game;

        if (this.tickTimer <= 0 && g) {
            this.applyTick(g);
            this.tickTimer = this.tickRate;
        }

        if (this.age >= this.duration) {
            this.active = false;
        }
    }

    applyTick(game) {
        const enemies = game.gameManager?.entities || [];
        for (const enemy of enemies) {
            if (!(enemy instanceof Enemy) || !enemy.active) continue;
            const dx = enemy.x + enemy.displayWidth / 2 - this.x;
            const dy = enemy.y + enemy.displayHeight / 2 - this.y;
            if (Math.hypot(dx, dy) <= this.radius) {
                enemy.takeDamage(this.tickDamage, this.owner, { spellId: 'zone', element: this.element });
                if (this.slowAmount > 0 && enemy.applySlow) {
                    enemy.applySlow(this.slowAmount, 1.0);
                }
            }
        }
    }

    render(ctx, camera) {
        if (!this.active) return;
        const sx = this.x - camera.x;
        const sy = this.y - camera.y;
        ctx.save();
        const grd = ctx.createRadialGradient(sx, sy, this.radius * 0.2, sx, sy, this.radius);
        grd.addColorStop(0, 'rgba(194, 246, 255, 0.35)');
        grd.addColorStop(1, 'rgba(107, 170, 255, 0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
