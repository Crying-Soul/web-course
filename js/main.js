/**
 * Точка входа в игру
 * Инициализирует и запускает игру
 */

// Ждём загрузки DOM
document.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('game-canvas');
    const loadingElement = document.getElementById('loading');
    const startCard = document.getElementById('start-card');
    const gameoverCard = document.getElementById('gameover-card');
    const playerNameInput = document.getElementById('player-name');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const leaderboardList = document.getElementById('leaderboard-list');
    const leaderboardPreview = document.getElementById('leaderboard-preview');
    const resScore = document.getElementById('res-score');
    const resKills = document.getElementById('res-kills');
    const resTime = document.getElementById('res-time');

    const game = new Game(canvas);
    const scoreManager = new ScoreManager();

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const renderLeaderboard = (container, scores, compact = false) => {
        container.innerHTML = '';
        scores.forEach((entry, idx) => {
            if (compact) {
                const div = document.createElement('div');
                div.className = 'meta';
                div.innerHTML = `<strong>${entry.score}</strong><span>${idx + 1}. ${entry.name}</span>`;
                container.appendChild(div);
            } else {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${idx + 1}. ${entry.name}</strong><span>${entry.score} очк · ${entry.kills} убийств · ${formatTime(entry.time)}</span>`;
                container.appendChild(li);
            }
        });
    };

    const handleGameOver = (results) => {
        resScore.textContent = results.score;
        resKills.textContent = results.kills;
        resTime.textContent = formatTime(results.time);

        renderLeaderboard(leaderboardList, scoreManager.getTop(10), false);
        gameoverCard.classList.remove('hidden');
    };

    try {
        await scoreManager.load();
        renderLeaderboard(leaderboardPreview, scoreManager.getTop(3), true);

        // Инициализируем игру (без запуска цикла)
        await game.init();
        loadingElement.style.display = 'none';

        // Подписываемся на конец игры
        game.gameManager.onGameOver = handleGameOver;
        game.gameManager.scoreManager = scoreManager;

        startBtn.addEventListener('click', () => {
            const name = (playerNameInput.value || '').trim();
            if (!name) {
                playerNameInput.focus();
                return;
            }

            game.gameManager.playerName = name;
            startCard.classList.add('hidden');
            game.start();

            console.log('=== Terraria Arena Survival ===');
            console.log('Управление:');
            console.log('  A/D или ←/→ - движение');
            console.log('  W/↑/Space - прыжок');
            console.log('  ЛКМ или E - каст выбранного заклинания');
            console.log('  1-6 - переключение заклинаний');
            console.log('  Q - выкинуть выбранное заклинание');
            console.log('  Escape - пауза');
            console.log('  = - режим отладки');
        });

        restartBtn.addEventListener('click', () => {
            window.location.reload();
        });

    } catch (error) {
        console.error('Ошибка запуска игры:', error);
        loadingElement.textContent = 'Ошибка загрузки игры';
        loadingElement.style.color = 'red';
    }
});
