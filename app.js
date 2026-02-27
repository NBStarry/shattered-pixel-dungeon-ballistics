// 破碎像素地牢 - 弹道计算器
// Grid-based ballistics calculator for Shattered Pixel Dungeon

class BallisticsCalculator {
    constructor() {
        this.canvas = document.getElementById('grid-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20; // 网格大小
        this.cellSize = 30; // 每个格子的像素大小
        this.currentTool = null;
        this.showCalculation = false;
        
        // 游戏实体
        this.entities = {
            players: [],
            enemies: [],
            obstacles: [],
            walls: []
        };
        
        // 计算结果
        this.trajectories = [];
        this.recommendedPositions = [];
        
        // 场景数据
        this.scenarios = [];
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadScenarios();
        this.setupEventListeners();
        this.draw();
        window.addEventListener('resize', () => this.setupCanvas());
    }
    
    async loadScenarios() {
        try {
            const response = await fetch('scenarios.json');
            const data = await response.json();
            this.scenarios = data.scenarios;
            this.populateScenarioSelect();
        } catch (error) {
            console.error('加载场景失败:', error);
        }
    }
    
    populateScenarioSelect() {
        const select = document.getElementById('scenario-select');
        this.scenarios.forEach(scenario => {
            const option = document.createElement('option');
            option.value = scenario.id;
            option.textContent = scenario.name;
            select.appendChild(option);
        });
    }
    
    loadScenario(scenarioId) {
        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;
        
        this.entities = JSON.parse(JSON.stringify(scenario.entities));
        this.showCalculation = false;
        this.trajectories = [];
        this.recommendedPositions = [];
        this.updateStatus(`已加载场景: ${scenario.name} - ${scenario.description}`);
        this.draw();
    }
    
    setupCanvas() {
        const container = document.getElementById('canvas-container');
        const size = Math.min(container.clientWidth, container.clientHeight);
        this.canvas.width = size;
        this.canvas.height = size;
        this.cellSize = size / this.gridSize;
        this.draw();
    }
    
    setupEventListeners() {
        // 工具按钮
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentTool = e.target.dataset.tool;
                this.showCalculation = false;
                this.updateStatus(`已选择: ${this.getToolName(this.currentTool)}`);
                this.draw();
            });
        });
        
        // 计算按钮
        document.getElementById('calc-btn').addEventListener('click', () => {
            this.calculateTrajectories();
            this.showCalculation = true;
            this.draw();
        });
        
        // 清空按钮
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('确定要清空所有内容吗？')) {
                this.entities = { players: [], enemies: [], obstacles: [], walls: [] };
                this.trajectories = [];
                this.recommendedPositions = [];
                this.showCalculation = false;
                this.updateStatus('已清空所有内容');
                this.draw();
            }
        });
        
        // 场景选择
        document.getElementById('scenario-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadScenario(e.target.value);
                e.target.value = ''; // 重置选择器
            }
        });
        
        // Canvas点击/触摸
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleCanvasClick(touch);
        });
    }
    
    handleCanvasClick(e) {
        if (!this.currentTool) {
            this.updateStatus('请先选择要放置的对象');
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.cellSize);
        const y = Math.floor((e.clientY - rect.top) / this.cellSize);
        
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
        
        const pos = { x, y };
        
        // 检查是否已有实体
        if (this.hasEntityAt(x, y)) {
            this.removeEntityAt(x, y);
            this.updateStatus(`已移除 (${x}, ${y}) 的对象`);
        } else {
            this.addEntity(this.currentTool, pos);
            this.updateStatus(`已放置 ${this.getToolName(this.currentTool)} 于 (${x}, ${y})`);
        }
        
        this.showCalculation = false;
        this.draw();
    }
    
    hasEntityAt(x, y) {
        for (const type in this.entities) {
            if (this.entities[type].some(e => e.x === x && e.y === y)) {
                return true;
            }
        }
        return false;
    }
    
    removeEntityAt(x, y) {
        for (const type in this.entities) {
            this.entities[type] = this.entities[type].filter(e => !(e.x === x && e.y === y));
        }
    }
    
    addEntity(type, pos) {
        // 正确的单数到复数映射
        const typeMap = {
            'player': 'players',
            'enemy': 'enemies',
            'obstacle': 'obstacles',
            'wall': 'walls'
        };
        const key = typeMap[type];
        
        if (type === 'player' && this.entities.players.length > 0) {
            this.entities.players = []; // 只允许一个玩家
        }
        this.entities[key].push(pos);
    }
    
    getToolName(tool) {
        const names = {
            player: '玩家',
            enemy: '敌人',
            obstacle: '障碍物',
            wall: '墙体'
        };
        return names[tool] || tool;
    }
    
    updateStatus(text, safe = null) {
        const status = document.getElementById('status');
        status.textContent = text;
        status.className = 'status';
        if (safe === true) status.classList.add('safe');
        if (safe === false) status.classList.add('danger');
    }
    
    // 弹道算法 - 基于破碎像素地牢源码的实现
    // 参考: shattered-pixel-dungeon/core/src/main/java/.../mechanics/Ballistica.java
    checkLineOfSight(x0, y0, x1, y1) {
        const points = [];
        
        // 计算差值和方向
        let dx = x1 - x0;
        let dy = y1 - y0;
        
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        
        dx = Math.abs(dx);
        dy = Math.abs(dy);
        
        // 确定主轴和副轴（与游戏源码一致）
        let stepA, stepB, dA, dB;
        let isXMajor;
        
        if (dx > dy) {
            // X轴为主轴
            stepA = stepX;
            stepB = stepY;
            dA = dx;
            dB = dy;
            isXMajor = true;
        } else {
            // Y轴为主轴
            stepA = stepY;
            stepB = stepX;
            dA = dy;
            dB = dx;
            isXMajor = false;
        }
        
        let x = x0;
        let y = y0;
        let err = Math.floor(dA / 2);
        let collisionPos = null;
        let previousCell = null;
        
        // 遍历路径
        while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
            const currentCell = { x, y };
            
            // 检查当前格子是否为障碍物或墙体（不包括起点）
            if (!(x === x0 && y === y0)) {
                const hasObstacle = this.entities.obstacles.some(o => o.x === x && o.y === y);
                const hasWall = this.entities.walls.some(w => w.x === x && w.y === y);
                
                if (hasWall || hasObstacle) {
                    // 游戏机制：碰撞发生在solid地形的前一个格子
                    if (previousCell) {
                        collisionPos = previousCell;
                    } else {
                        collisionPos = currentCell;
                    }
                    points.push(currentCell);
                    break;
                }
            }
            
            points.push(currentCell);
            
            // 到达目标点
            if (x === x1 && y === y1) {
                break;
            }
            
            previousCell = { x, y };
            
            // 主轴步进
            if (isXMajor) {
                x += stepA;
            } else {
                y += stepA;
            }
            
            // 副轴根据累积误差步进
            err += dB;
            if (err >= dA) {
                err -= dA;
                if (isXMajor) {
                    y += stepB;
                } else {
                    x += stepB;
                }
            }
        }
        
        if (collisionPos) {
            return { blocked: true, points, blocker: collisionPos };
        }
        
        return { blocked: false, points };
    }
    
    calculateTrajectories() {
        this.trajectories = [];
        this.recommendedPositions = [];
        
        if (this.entities.players.length === 0) {
            this.updateStatus('请先放置玩家位置！', false);
            return;
        }
        
        if (this.entities.enemies.length === 0) {
            this.updateStatus('请先放置至少一个敌人！', false);
            return;
        }
        
        const player = this.entities.players[0];
        let allBlocked = true;
        
        // 计算每个敌人到玩家的弹道
        this.entities.enemies.forEach(enemy => {
            const result = this.checkLineOfSight(enemy.x, enemy.y, player.x, player.y);
            this.trajectories.push({
                enemy,
                player,
                ...result
            });
            
            if (!result.blocked) {
                allBlocked = false;
                // 如果弹道未被阻挡，计算推荐位置
                this.calculateRecommendedPositions(enemy, player, result.points);
            }
        });
        
        // 更新状态
        if (allBlocked) {
            this.updateStatus('✅ 所有弹道已被阻挡！你是安全的！', true);
        } else {
            const dangerous = this.trajectories.filter(t => !t.blocked).length;
            this.updateStatus(`⚠️ 有 ${dangerous} 条弹道未被阻挡！请放置障碍物！`, false);
        }
    }
    
    calculateRecommendedPositions(enemy, player, pathPoints) {
        // 推荐放置障碍物的位置（弹道路径上，不包括起点终点）
        for (let i = 1; i < pathPoints.length - 1; i++) {
            const p = pathPoints[i];
            if (!this.hasEntityAt(p.x, p.y)) {
                if (!this.recommendedPositions.some(r => r.x === p.x && r.y === p.y)) {
                    this.recommendedPositions.push(p);
                }
            }
        }
    }
    
    draw() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格
        this.drawGrid();
        
        // 如果显示计算结果，先绘制弹道和推荐位置
        if (this.showCalculation) {
            this.drawTrajectories();
            this.drawRecommendedPositions();
        }
        
        // 绘制实体（最后绘制，确保在最上层）
        this.drawEntities();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = '#2a3f5f';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= this.gridSize; i++) {
            const pos = i * this.cellSize;
            ctx.beginPath();
            ctx.moveTo(pos, 0);
            ctx.lineTo(pos, this.canvas.height);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, pos);
            ctx.lineTo(this.canvas.width, pos);
            ctx.stroke();
        }
    }
    
    drawTrajectories() {
        const ctx = this.ctx;
        
        this.trajectories.forEach(traj => {
            ctx.strokeStyle = traj.blocked ? '#4ecca3' : '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.setLineDash(traj.blocked ? [5, 5] : []);
            
            ctx.beginPath();
            const startX = traj.enemy.x * this.cellSize + this.cellSize / 2;
            const startY = traj.enemy.y * this.cellSize + this.cellSize / 2;
            const endX = traj.player.x * this.cellSize + this.cellSize / 2;
            const endY = traj.player.y * this.cellSize + this.cellSize / 2;
            
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
            
            ctx.setLineDash([]);
            
            // 如果被阻挡，标记阻挡点
            if (traj.blocked && traj.blocker) {
                const bx = traj.blocker.x * this.cellSize + this.cellSize / 2;
                const by = traj.blocker.y * this.cellSize + this.cellSize / 2;
                ctx.fillStyle = '#4ecca3';
                ctx.beginPath();
                ctx.arc(bx, by, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    drawRecommendedPositions() {
        const ctx = this.ctx;
        
        this.recommendedPositions.forEach(pos => {
            ctx.fillStyle = 'rgba(255, 217, 61, 0.4)';
            ctx.fillRect(
                pos.x * this.cellSize + 2,
                pos.y * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
            
            // 绘制边框
            ctx.strokeStyle = '#ffd93d';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                pos.x * this.cellSize + 2,
                pos.y * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
        });
    }
    
    drawEntities() {
        const ctx = this.ctx;
        
        // 绘制墙体
        ctx.fillStyle = '#6c757d';
        this.entities.walls.forEach(wall => {
            ctx.fillRect(
                wall.x * this.cellSize,
                wall.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
        });
        
        // 绘制障碍物
        ctx.fillStyle = '#ffd93d';
        this.entities.obstacles.forEach(obs => {
            ctx.beginPath();
            const cx = obs.x * this.cellSize + this.cellSize / 2;
            const cy = obs.y * this.cellSize + this.cellSize / 2;
            ctx.arc(cx, cy, this.cellSize / 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
        // 绘制敌人
        ctx.fillStyle = '#ff6b6b';
        this.entities.enemies.forEach(enemy => {
            ctx.beginPath();
            const cx = enemy.x * this.cellSize + this.cellSize / 2;
            const cy = enemy.y * this.cellSize + this.cellSize / 2;
            const size = this.cellSize / 2.5;
            ctx.moveTo(cx, cy - size);
            ctx.lineTo(cx + size, cy + size);
            ctx.lineTo(cx - size, cy + size);
            ctx.closePath();
            ctx.fill();
        });
        
        // 绘制玩家
        ctx.fillStyle = '#4ecca3';
        this.entities.players.forEach(player => {
            ctx.fillRect(
                player.x * this.cellSize + this.cellSize / 4,
                player.y * this.cellSize + this.cellSize / 4,
                this.cellSize / 2,
                this.cellSize / 2
            );
        });
        
        // 绘制图标文字
        ctx.font = `${this.cellSize * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        this.entities.players.forEach(player => {
            ctx.fillStyle = '#000';
            ctx.fillText('🦸', player.x * this.cellSize + this.cellSize / 2, player.y * this.cellSize + this.cellSize / 2);
        });
        
        this.entities.enemies.forEach(enemy => {
            ctx.fillStyle = '#fff';
            ctx.fillText('👹', enemy.x * this.cellSize + this.cellSize / 2, enemy.y * this.cellSize + this.cellSize / 2);
        });
        
        this.entities.obstacles.forEach(obs => {
            ctx.fillStyle = '#000';
            ctx.fillText('🛡️', obs.x * this.cellSize + this.cellSize / 2, obs.y * this.cellSize + this.cellSize / 2);
        });
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new BallisticsCalculator();
});
