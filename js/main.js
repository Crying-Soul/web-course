/**
 * Точка входа в игру
 * Инициализирует и запускает игру
 */

// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('game-canvas');
    const loadingElement = document.getElementById('loading');

    // Создаём экземпляр игры
    const game = new Game(canvas);

    try {
        // Инициализируем игру
        await game.init();

        // Скрываем индикатор загрузки
        loadingElement.style.display = 'none';

        // Запускаем игровой цикл
        game.start();

        console.log('=== Terraria Arena Survival ===');
        console.log('Управление:');
        console.log('  A/D или ←/→ - движение');
        console.log('  W/↑/Space - прыжок');
        console.log('  ЛКМ или E - каст выбранного заклинания');
        console.log('  1-6 - переключение заклинаний');
        console.log('  Escape - пауза');
        console.log('  F3 - режим отладки');

    } catch (error) {
        console.error('Ошибка запуска игры:', error);
        loadingElement.textContent = 'Ошибка загрузки игры';
        loadingElement.style.color = 'red';
    }
});
