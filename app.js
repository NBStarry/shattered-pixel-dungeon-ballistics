// 破碎像素地牢 - 弹道计算器 v2.0
// 双向弹道系统 + 攻击模拟

class BallisticsCalculator {
    constructor() {
        this.canvas = document.getElementById('grid-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.gridSize = 20;
        this.cellSize = 30;
        this.currentTool = null;
        this.showCalculation = false;
        
        // 新增：攻击模式
        this.attackMode = false;
        this.targetCell = null;
        this.playerTrajectory = null;
        
        // 新增：撤销/恢复历史
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        this.entities = {
            players: [],
            enemies: [],
            obstacles: [],
            walls: []
        };
        
        this.trajectories = [];
        this.recommendedPositions = [];
        this.scenarios = [];
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadScenarios();
        this.setupEventListeners();
        this.saveState(); // 保存初始状态
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
        this.attackMode = false;
        this.targetCell = null;
        this.playerTrajectory = null;
        this.trajectories = [];
        this.recommendedPositions = [];
        this.updateStatus(`已加载场景: ${scenario.name} - ${scenario.description}`);
        this.saveState();
        this.draw();
    }
    
    // 保存当前状态到历史
    saveState() {
        // 移除当前索引之后的所有历史（分支被覆盖）
        this.history = this.history.slice(0, this.historyIndex + 1);
        
        // 保存当前状态
        const state = {
            entities: JSON.parse(JSON.stringify(this.entities)),
            showCalculation: this.showCalculation,
            attackMode: this.attackMode,
            trajectories: JSON.parse(JSON.stringify(this.trajectories)),
            recommendedPositions: JSON.parse(JSON.stringify(this.recommendedPositions))
        };
        
        this.history.push(state);
        this.historyIndex++;
        
        // 限制历史长度
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateUndoRedoButtons();
    }
    
    // 撤销
    undo() {
        if (this.historyIndex <= 0) return;
        
        this.historyIndex--;
        this.restoreState(this.history[this.historyIndex]);
        this.updateStatus('↶ 已撤销');
    }
    
    // 恢复
    redo() {
        if (this.historyIndex >= this.history.length - 1) return;
        
        this.historyIndex++;
        this.restoreState(this.history[this.historyIndex]);
        this.updateStatus('↷ 已恢复');
    }
    
    // 恢复状态
    restoreState(state) {
        this.entities = JSON.parse(JSON.stringify(state.entities));
        this.showCalculation = state.showCalculation;
        this.attackMode = state.attackMode;
        this.trajectories = JSON.parse(JSON.stringify(state.trajectories));
        this.recommendedPositions = JSON.parse(JSON.stringify(state.recommendedPositions));
        this.targetCell = null;
        this.playerTrajectory = null;
        this.updateUndoRedoButtons();
        this.draw();
    }
    
    // 更新撤销/恢复按钮状态
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
            undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
            redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
        }
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
        // 工具按钮 - 支持点击取消选择
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.dataset.tool;
                
                // 如果点击已选中的工具，取消选择
                if (this.currentTool === tool) {
                    e.target.classList.remove('active');
                    this.currentTool = null;
                    this.attackMode = false;
                    this.showCalculation = false;
                    this.updateStatus('工具已取消，点击网格进入攻击模式');
                } else {
                    // 选择新工具
                    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
                    document.getElementById('attack-btn').classList.remove('active');
                    e.target.classList.add('active');
                    this.currentTool = tool;
                    this.attackMode = false;
                    this.showCalculation = false;
                    this.updateStatus(`已选择: ${this.getToolName(this.currentTool)}`);
                }
                this.draw();
            });
        });
        
        // 攻击模式按钮
        document.getElementById('attack-btn').addEventListener('click', () => {
            document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
            document.getElementById('attack-btn').classList.toggle('active');
            
            if (document.getElementById('attack-btn').classList.contains('active')) {
                this.currentTool = null;
                this.attackMode = false;
                this.showCalculation = false;
                this.updateStatus('⚔️ 攻击模式：点击网格任意位置查看弹道');
            } else {
                this.attackMode = false;
                this.updateStatus('攻击模式已关闭');
            }
            this.draw();
        });
        
        document.getElementById('calc-btn').addEventListener('click', () => {
            this.calculateTrajectoriesWithRecommendations();
            this.showCalculation = true;
            this.attackMode = false;
            document.getElementById('attack-btn').classList.remove('active');
            this.draw();
        });
        
        // 撤销/恢复按钮
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undo();
        });
        
        document.getElementById('redo-btn').addEventListener('click', () => {
            this.redo();
        });
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z / Cmd+Z - 撤销
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Shift+Z / Cmd+Shift+Z - 恢复
            else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                this.redo();
            }
            // Ctrl+Y / Cmd+Y - 恢复（替代方案）
            else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                this.redo();
            }
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            if (confirm('确定要清空所有内容吗？')) {
                this.entities = { players: [], enemies: [], obstacles: [], walls: [] };
                this.trajectories = [];
                this.recommendedPositions = [];
                this.showCalculation = false;
                this.attackMode = false;
                this.targetCell = null;
                this.playerTrajectory = null;
                this.updateStatus('已清空所有内容');
                this.saveState();
                this.draw();
            }
        });
        
        document.getElementById('scenario-select').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadScenario(e.target.value);
                e.target.value = '';
            }
        });
        
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.handleCanvasClick(touch);
        });
    }
    
    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.cellSize);
        const y = Math.floor((e.clientY - rect.top) / this.cellSize);
        
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) return;
        
        // 攻击模式：点击显示弹道
        if (!this.currentTool) {
            if (this.entities.players.length === 0) {
                this.updateStatus('请先放置玩家位置！');
                return;
            }
            
            this.attackMode = true;
            this.targetCell = { x, y };
            this.calculatePlayerAttack();
            this.calculateEnemyTrajectories();
            this.updateAttackStatus();
            this.draw();
            return;
        }
        
        // 放置模式
        const pos = { x, y };
        if (this.hasEntityAt(x, y)) {
            this.removeEntityAt(x, y);
            this.updateStatus(`已移除 (${x}, ${y}) 的对象`);
        } else {
            this.addEntity(this.currentTool, pos);
            this.updateStatus(`已放置 ${this.getToolName(this.currentTool)} 于 (${x}, ${y})`);
        }
        
        this.showCalculation = false;
        this.attackMode = false;
        this.saveState();
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
        const typeMap = {
            'player': 'players',
            'enemy': 'enemies',
            'obstacle': 'obstacles',
            'wall': 'walls'
        };
        const key = typeMap[type];
        
        if (type === 'player' && this.entities.players.length > 0) {
            this.entities.players = [];
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
    
    // 弹道算法 - 基于破碎像素地牢源码
    checkLineOfSight(x0, y0, x1, y1) {
        const points = [];
        
        let dx = x1 - x0;
        let dy = y1 - y0;
        
        const stepX = dx > 0 ? 1 : -1;
        const stepY = dy > 0 ? 1 : -1;
        
        dx = Math.abs(dx);
        dy = Math.abs(dy);
        
        let stepA, stepB, dA, dB;
        let isXMajor;
        
        if (dx > dy) {
            stepA = stepX;
            stepB = stepY;
            dA = dx;
            dB = dy;
            isXMajor = true;
        } else {
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
        
        while (x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize) {
            const currentCell = { x, y };
            
            if (!(x === x0 && y === y0)) {
                const hasObstacle = this.entities.obstacles.some(o => o.x === x && o.y === y);
                const hasWall = this.entities.walls.some(w => w.x === x && w.y === y);
                
                if (hasWall || hasObstacle) {
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
            
            if (x === x1 && y === y1) {
                break;
            }
            
            previousCell = { x, y };
            
            if (isXMajor) {
                x += stepA;
            } else {
                y += stepA;
            }
            
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
    
    // 计算玩家攻击
    calculatePlayerAttack() {
        if (!this.targetCell || this.entities.players.length === 0) {
            this.playerTrajectory = null;
            return;
        }
        
        const player = this.entities.players[0];
        const result = this.checkLineOfSight(player.x, player.y, this.targetCell.x, this.targetCell.y);
        
        // 检查路径上是否有敌人
        const hitEnemies = [];
        for (const point of result.points) {
            const enemy = this.entities.enemies.find(e => e.x === point.x && e.y === point.y);
            if (enemy && !(point.x === player.x && point.y === player.y)) {
                hitEnemies.push(enemy);
            }
        }
        
        this.playerTrajectory = {
            ...result,
            hitEnemies,
            canHit: hitEnemies.length > 0
        };
    }
    
    // 计算敌人弹道
    calculateEnemyTrajectories() {
        this.trajectories = [];
        
        if (this.entities.players.length === 0 || this.entities.enemies.length === 0) {
            return;
        }
        
        const player = this.entities.players[0];
        
        this.entities.enemies.forEach(enemy => {
            const result = this.checkLineOfSight(enemy.x, enemy.y, player.x, player.y);
            this.trajectories.push({
                enemy,
                player,
                ...result
            });
        });
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
        
        this.entities.enemies.forEach(enemy => {
            const result = this.checkLineOfSight(enemy.x, enemy.y, player.x, player.y);
            this.trajectories.push({
                enemy,
                player,
                ...result
            });
            
            if (!result.blocked) {
                allBlocked = false;
                this.calculateRecommendedPositions(enemy, player, result.points);
            }
        });
        
        if (allBlocked) {
            this.updateStatus('✅ 所有弹道已被阻挡！你是安全的！', true);
        } else {
            const dangerous = this.trajectories.filter(t => !t.blocked).length;
            this.updateStatus(`⚠️ 有 ${dangerous} 条弹道未被阻挡！请放置障碍物！`, false);
        }
    }
    
    calculateTrajectoriesWithRecommendations() {
        this.calculateTrajectories();
        this.calculateRecommendedAttackPositions();
        
        // 更新状态消息，包含建议攻击点位信息
        const dangerous = this.trajectories.filter(t => !t.blocked).length;
        const attackPoints = this.recommendedAttackPositions.length;
        
        // 如果有攻击点位，自动取消工具选择，让用户可以直接点击查看
        if (attackPoints > 0) {
            this.currentTool = null;
            document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
        }
        
        if (dangerous === 0 && attackPoints > 0) {
            this.updateStatus(`✅ 你是安全的！找到 ${attackPoints} 个建议攻击点位（蓝色），点击查看弹道`, true);
        } else if (dangerous === 0 && attackPoints === 0) {
            this.updateStatus('✅ 所有弹道已被阻挡！你是安全的！', true);
        } else if (attackPoints > 0) {
            this.updateStatus(`⚠️ 有 ${dangerous} 条危险弹道！找到 ${attackPoints} 个建议攻击点位（蓝色），点击查看弹道`, false);
        } else {
            this.updateStatus(`⚠️ 有 ${dangerous} 条弹道未被阻挡！请放置障碍物！`, false);
        }
    }
    
    calculateRecommendedAttackPositions() {
        this.recommendedAttackPositions = [];
        
        if (this.entities.players.length === 0 || this.entities.enemies.length === 0) {
            return;
        }
        
        const player = this.entities.players[0];
        
        // 遍历网格中的所有位置（排除已有实体的位置）
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                if (this.hasEntityAt(x, y)) continue;
                
                // 检查从玩家到该位置的弹道
                const playerShot = this.checkLineOfSight(player.x, player.y, x, y);
                
                // 检查该弹道是否能打到任何敌人
                const hitEnemies = [];
                for (const point of playerShot.points) {
                    const enemy = this.entities.enemies.find(e => e.x === point.x && e.y === point.y);
                    if (enemy && !(point.x === player.x && point.y === player.y)) {
                        hitEnemies.push(enemy);
                    }
                }
                
                if (hitEnemies.length === 0) continue;
                
                // 检查所有敌人是否都打不到玩家
                const allEnemiesBlocked = this.entities.enemies.every(enemy => {
                    const enemyShot = this.checkLineOfSight(enemy.x, enemy.y, player.x, player.y);
                    return enemyShot.blocked;
                });
                
                // 如果能打到敌人且所有敌人都打不到玩家，推荐这个位置
                if (allEnemiesBlocked) {
                    this.recommendedAttackPositions.push({ 
                        x, 
                        y, 
                        hitCount: hitEnemies.length 
                    });
                }
            }
        }
    }
    
    updateAttackStatus() {
        if (!this.playerTrajectory || !this.targetCell) return;
        
        const enemyCanHit = this.trajectories.some(t => !t.blocked);
        
        if (this.playerTrajectory.canHit && !enemyCanHit) {
            this.updateStatus(`🎯 完美！你能打到敌人，敌人打不到你！`, true);
        } else if (this.playerTrajectory.canHit && enemyCanHit) {
            this.updateStatus(`⚠️ 你能打到敌人，但敌人也能打到你！`, null);
        } else if (!this.playerTrajectory.canHit && !enemyCanHit) {
            this.updateStatus(`✅ 你打不到敌人，但敌人也打不到你（安全）`, true);
        } else {
            this.updateStatus(`❌ 你打不到敌人，但敌人能打到你！危险！`, false);
        }
    }
    
    calculateRecommendedPositions(enemy, player, pathPoints) {
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
        
        this.drawGrid();
        
        if (this.showCalculation) {
            this.drawTrajectories();
            this.drawRecommendedPositions();
            this.drawRecommendedAttackPositions();
        }
        
        if (this.attackMode && this.playerTrajectory) {
            this.drawPlayerTrajectory();
            this.drawEnemyTrajectories();
            this.drawTargetCell();
        }
        
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
    
    drawPlayerTrajectory() {
        if (!this.playerTrajectory) return;
        
        const ctx = this.ctx;
        const traj = this.playerTrajectory;
        
        // 玩家弹道：绿色=能打到，灰色=打不到
        ctx.strokeStyle = traj.canHit ? '#4ecca3' : '#888888';
        ctx.lineWidth = 4;
        ctx.setLineDash([]);
        
        ctx.beginPath();
        for (let i = 0; i < traj.points.length; i++) {
            const p = traj.points[i];
            const px = p.x * this.cellSize + this.cellSize / 2;
            const py = p.y * this.cellSize + this.cellSize / 2;
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.stroke();
        
        // 标记命中的敌人
        if (traj.hitEnemies && traj.hitEnemies.length > 0) {
            traj.hitEnemies.forEach(enemy => {
                const ex = enemy.x * this.cellSize + this.cellSize / 2;
                const ey = enemy.y * this.cellSize + this.cellSize / 2;
                
                ctx.strokeStyle = '#4ecca3';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(ex, ey, this.cellSize / 2.5, 0, Math.PI * 2);
                ctx.stroke();
            });
        }
    }
    
    drawEnemyTrajectories() {
        const ctx = this.ctx;
        
        this.trajectories.forEach(traj => {
            // 敌人弹道：红色=危险，橙色虚线=安全
            ctx.strokeStyle = traj.blocked ? '#ff9a3c' : '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.setLineDash(traj.blocked ? [5, 5] : []);
            
            // 沿着实际弹道路径绘制
            ctx.beginPath();
            for (let i = 0; i < traj.points.length; i++) {
                const p = traj.points[i];
                const px = p.x * this.cellSize + this.cellSize / 2;
                const py = p.y * this.cellSize + this.cellSize / 2;
                
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
            
            ctx.setLineDash([]);
            
            // 标记阻挡点
            if (traj.blocked && traj.blocker) {
                const bx = traj.blocker.x * this.cellSize + this.cellSize / 2;
                const by = traj.blocker.y * this.cellSize + this.cellSize / 2;
                ctx.fillStyle = '#ff9a3c';
                ctx.beginPath();
                ctx.arc(bx, by, 6, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }
    
    drawTargetCell() {
        if (!this.targetCell) return;
        
        const ctx = this.ctx;
        const x = this.targetCell.x * this.cellSize;
        const y = this.targetCell.y * this.cellSize;
        
        ctx.strokeStyle = '#ffd93d';
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, this.cellSize - 4, this.cellSize - 4);
    }
    
    drawTrajectories() {
        const ctx = this.ctx;
        
        this.trajectories.forEach(traj => {
            ctx.strokeStyle = traj.blocked ? '#4ecca3' : '#ff6b6b';
            ctx.lineWidth = 3;
            ctx.setLineDash(traj.blocked ? [5, 5] : []);
            
            // 沿着实际弹道路径绘制
            ctx.beginPath();
            for (let i = 0; i < traj.points.length; i++) {
                const p = traj.points[i];
                const px = p.x * this.cellSize + this.cellSize / 2;
                const py = p.y * this.cellSize + this.cellSize / 2;
                
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();
            
            ctx.setLineDash([]);
            
            // 标记阻挡点
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
    
    drawRecommendedAttackPositions() {
        const ctx = this.ctx;
        
        this.recommendedAttackPositions.forEach(pos => {
            // 蓝色/青色标记建议的攻击位置
            ctx.fillStyle = 'rgba(52, 152, 219, 0.5)';
            ctx.fillRect(
                pos.x * this.cellSize + 2,
                pos.y * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
            
            ctx.strokeStyle = '#3498db';
            ctx.lineWidth = 3;
            ctx.strokeRect(
                pos.x * this.cellSize + 2,
                pos.y * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
            
            // 显示命中数量
            if (pos.hitCount > 0) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${this.cellSize * 0.5}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(
                    pos.hitCount.toString(),
                    pos.x * this.cellSize + this.cellSize / 2,
                    pos.y * this.cellSize + this.cellSize / 2
                );
            }
        });
    }
    
    drawEntities() {
        const ctx = this.ctx;
        
        ctx.fillStyle = '#6c757d';
        this.entities.walls.forEach(wall => {
            ctx.fillRect(
                wall.x * this.cellSize,
                wall.y * this.cellSize,
                this.cellSize,
                this.cellSize
            );
        });
        
        ctx.fillStyle = '#ffd93d';
        this.entities.obstacles.forEach(obs => {
            ctx.beginPath();
            const cx = obs.x * this.cellSize + this.cellSize / 2;
            const cy = obs.y * this.cellSize + this.cellSize / 2;
            ctx.arc(cx, cy, this.cellSize / 3, 0, Math.PI * 2);
            ctx.fill();
        });
        
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
        
        ctx.fillStyle = '#4ecca3';
        this.entities.players.forEach(player => {
            ctx.fillRect(
                player.x * this.cellSize + this.cellSize / 4,
                player.y * this.cellSize + this.cellSize / 4,
                this.cellSize / 2,
                this.cellSize / 2
            );
        });
        
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

document.addEventListener('DOMContentLoaded', () => {
    new BallisticsCalculator();
});
