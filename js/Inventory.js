/**
 * Inventory - Класс инвентаря игрока
 * Управляет слотами и предметами
 */
class Inventory {
    constructor(slots = 6) {
        this.slots = new Array(slots).fill(null);
        this.selectedSlot = 0;
        this.maxSlots = slots;
    }

    /**
     * Добавляет предмет в инвентарь
     * @param {Item} item - Предмет для добавления
     * @returns {boolean} - Успешно ли добавлен
     */
    addItem(item) {
        // Ищем пустой слот
        for (let i = 0; i < this.maxSlots; i++) {
            if (this.slots[i] === null) {
                this.slots[i] = item.clone();
                return true;
            }
        }
        return false; // Инвентарь полон
    }

    /**
     * Удаляет предмет из слота
     * @param {number} slotIndex - Индекс слота
     * @returns {Item|null} - Удалённый предмет
     */
    removeItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
        const item = this.slots[slotIndex];
        this.slots[slotIndex] = null;
        return item;
    }

    /**
     * Получает предмет в слоте
     * @param {number} slotIndex - Индекс слота
     * @returns {Item|null}
     */
    getItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.maxSlots) return null;
        return this.slots[slotIndex];
    }

    /**
     * Получает выбранный предмет
     * @returns {Item|null}
     */
    getSelectedItem() {
        return this.slots[this.selectedSlot];
    }

    /**
     * Выбирает слот
     * @param {number} slotIndex - Индекс слота
     */
    selectSlot(slotIndex) {
        if (slotIndex >= 0 && slotIndex < this.maxSlots) {
            this.selectedSlot = slotIndex;
        }
    }

    /**
     * Следующий слот
     */
    nextSlot() {
        this.selectedSlot = (this.selectedSlot + 1) % this.maxSlots;
    }

    /**
     * Предыдущий слот
     */
    prevSlot() {
        this.selectedSlot = (this.selectedSlot - 1 + this.maxSlots) % this.maxSlots;
    }

    /**
     * Проверяет, есть ли оружие в выбранном слоте
     * @returns {boolean}
     */
    hasSpellSelected() {
        const item = this.getSelectedItem();
        return item && item.type === 'spell';
    }

    /**
     * Отрисовка инвентаря (UI)
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        const slotSize = 32;
        const padding = 4;
        const startX = 10;
        const totalHeight = this.maxSlots * slotSize + (this.maxSlots - 1) * padding;
        const startY = Math.max(10, ctx.canvas.height - totalHeight - 10);
        
        for (let i = 0; i < this.maxSlots; i++) {
            const x = startX;
            const y = startY + i * (slotSize + padding);
            
            // Фон слота
            ctx.fillStyle = i === this.selectedSlot ? 'rgba(255, 255, 100, 0.5)' : 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(x, y, slotSize, slotSize);
            
            // Рамка
            ctx.strokeStyle = i === this.selectedSlot ? '#ffff00' : '#555555';
            ctx.lineWidth = i === this.selectedSlot ? 2 : 1;
            ctx.strokeRect(x, y, slotSize, slotSize);
            
            // Предмет
            const item = this.slots[i];
            if (item) {
                const prevSmoothing = ctx.imageSmoothingEnabled;
                const prevQuality = ctx.imageSmoothingQuality || 'low';
                if (item.imageLoaded) {
                // Временная настройка сглаживания для предмета
                    try {
                        if (item.pixelPerfect) {
                            ctx.imageSmoothingEnabled = false;
                        } else {
                            ctx.imageSmoothingEnabled = !!item.smooth;
                            if (item.smooth) ctx.imageSmoothingQuality = 'high';
                        }
                    } catch (e) {}

                    // Подгоняем изображение под слот сохраняя пропорции — центрируем
                    const targetW = slotSize - 8;
                    const targetH = slotSize - 8;
                    const scale = Math.min(targetW / item.width, targetH / item.height, 1);
                    const drawW = Math.round(item.width * scale);
                    const drawH = Math.round(item.height * scale);
                    const drawX = Math.round(x + (slotSize - drawW) / 2);
                    const drawY = Math.round(y + (slotSize - drawH) / 2);
                    ctx.drawImage(item.image, drawX, drawY, drawW, drawH);
                } else {
                    // Если нет изображения — рисуем стилизованную магическую плашку
                    const cx = Math.round(x + slotSize / 2);
                    const cy = Math.round(y + slotSize / 2);
                    const r = (slotSize - 10) / 2;
                    const gradient = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
                    const color = item.iconColor || '#7cf7ff';
                    gradient.addColorStop(0, '#ffffff');
                    gradient.addColorStop(0.35, color);
                    gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(cx, cy, r, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                    ctx.stroke();
                }

                // Восстанавливаем сглаживание
                try {
                    ctx.imageSmoothingEnabled = prevSmoothing;
                    ctx.imageSmoothingQuality = prevQuality;
                } catch (e) {}
            }
            
            // Номер слота
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'left';
            ctx.fillText((i + 1).toString(), x + 2, y + 10);
        }

        // Панель характеристик выбранного заклинания
        const selected = this.getSelectedItem();
        const panelX = startX + slotSize + 14;
        const panelY = startY;
        const panelW = 180;
        const panelH = 82;

        ctx.fillStyle = 'rgba(10, 12, 24, 0.75)';
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, panelW, panelH);

        ctx.fillStyle = '#e8f0ff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';

        if (selected) {
            const styleLabel = selected.castStyle === 'beam' ? 'Луч'
                : selected.castStyle === 'zone' ? 'Нова'
                : selected.castStyle === 'spray' ? 'Веер'
                : 'Снаряд';

            ctx.fillText(`${selected.name} (${styleLabel})`, panelX + 8, panelY + 16);
            ctx.fillStyle = '#9fb2d6';
            ctx.font = '11px Arial';
            ctx.fillText(`Стихия: ${selected.element}`, panelX + 8, panelY + 32);
            ctx.fillText(`Урон: ${selected.damage}`, panelX + 8, panelY + 46);
            ctx.fillText(`Мана: ${selected.manaCost} | КД: ${selected.cooldown}s`, panelX + 8, panelY + 60);
            if (selected.spread) {
                ctx.fillText(`Веер: ${selected.projectileCount} / ${selected.spread}°`, panelX + 8, panelY + 74);
            } else if (selected.castStyle === 'beam') {
                ctx.fillText(`Длина луча: ${selected.beamLength}`, panelX + 8, panelY + 74);
            } else if (selected.castStyle === 'zone') {
                ctx.fillText(`Радиус: ${selected.zoneRadius} | тик: ${selected.zoneTickDamage}`, panelX + 8, panelY + 74);
            }
        } else {
            ctx.fillStyle = '#9fb2d6';
            ctx.font = '11px Arial';
            ctx.fillText('Пустой слот — подберите заклинание', panelX + 8, panelY + 32);
        }
    }
}
