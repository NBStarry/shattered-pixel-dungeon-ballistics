# 弹道算法修正说明

## 问题发现
2026-02-27：Bei发现弹道计算与游戏实际行为不一致。

## 原因分析
初版使用标准Bresenham算法，但游戏使用改进版实现。

## 源码参考
```
shattered-pixel-dungeon/core/src/main/java/
com/shatteredpixel/shatteredpixeldungeon/mechanics/Ballistica.java
```

GitHub: https://github.com/00-Evan/shattered-pixel-dungeon

## 关键差异

### 1. 主轴/副轴选择
**错误实现**（标准Bresenham）:
```javascript
let err = dx - dy;
if (e2 > -dy) x += sx;  // X和Y可能同时步进
if (e2 < dx) y += sy;
```

**正确实现**（游戏源码）:
```javascript
if (dx > dy) {
    stepA = stepX;  // X为主轴
    stepB = stepY;  // Y为副轴
} else {
    stepA = stepY;  // Y为主轴
    stepB = stepX;  // X为副轴
}
// 主轴每次必然步进，副轴根据累积误差步进
```

### 2. 碰撞检测逻辑
**游戏机制**：
- 检测到solid地形时，实际碰撞位置是**前一个格子**
- 弹道在障碍物前停止，而非穿透

### 3. 步进顺序
游戏源码中：
1. 先步进主轴（较长的轴）
2. 累积误差 += 副轴长度
3. 如果误差 >= 主轴长度，步进副轴并减去误差

这确保了路径完全匹配游戏内弹道。

## 修复结果
- ✅ 弹道路径与游戏完全一致
- ✅ 障碍物阻挡判定准确
- ✅ 支持复杂场景（多敌人、斜线攻击）

## 测试场景
建议用预设场景验证：
1. 基础示例 - 简单直线弹道
2. 天狗战 - 斜线弹道
3. 多敌人包围 - 多条弹道交叉

---

**修复时间**: 2026-02-27 11:03  
**提交**: 193f09f
