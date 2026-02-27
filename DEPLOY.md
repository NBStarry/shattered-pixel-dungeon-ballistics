# 部署指南

## 本地测试

### 方法1: 直接打开
```bash
# macOS/Linux
open index.html

# Windows
start index.html
```

### 方法2: Python HTTP服务器
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000

# 访问 http://localhost:8000
```

### 方法3: Node.js http-server
```bash
# 安装
npm install -g http-server

# 运行
http-server -p 8000

# 访问 http://localhost:8000
```

### 方法4: VS Code Live Server
1. 安装 "Live Server" 扩展
2. 右键点击 index.html
3. 选择 "Open with Live Server"

## 在线部署

### GitHub Pages（推荐）

1. **创建仓库**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/ballistics-calculator.git
git push -u origin main
```

2. **启用Pages**
- 进入仓库 Settings
- 找到 Pages 选项
- Source 选择 main 分支
- 保存

3. **访问**
```
https://你的用户名.github.io/ballistics-calculator/
```

### Vercel（最快）

1. **安装CLI**
```bash
npm install -g vercel
```

2. **部署**
```bash
vercel --prod
```

3. 访问生成的URL

### Netlify

1. **注册并登录** netlify.com
2. **拖拽部署**
   - 将整个文件夹拖到Netlify
   - 自动部署完成
3. 获得永久URL

### 自己的服务器

#### Nginx配置
```nginx
server {
    listen 80;
    server_name ballistics.yourdomain.com;
    
    root /var/www/ballistics-calculator;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

#### Apache配置
```apache
<VirtualHost *:80>
    ServerName ballistics.yourdomain.com
    DocumentRoot /var/www/ballistics-calculator
    
    <Directory /var/www/ballistics-calculator>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

## 移动端优化

### PWA支持（可选）

创建 `manifest.json`:
```json
{
  "name": "破碎像素地牢弹道计算器",
  "short_name": "弹道计算器",
  "description": "Shattered Pixel Dungeon弹道学辅助工具",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#16213e",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

在 `index.html` 添加:
```html
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#16213e">
```

### 添加到主屏幕

#### iOS (Safari)
1. 点击分享按钮
2. 选择"添加到主屏幕"
3. 确认

#### Android (Chrome)
1. 点击菜单
2. 选择"添加到主屏幕"
3. 确认

## 性能优化

### 压缩代码
```bash
# 安装工具
npm install -g terser csso-cli html-minifier

# 压缩JS
terser app.js -o app.min.js -c -m

# 压缩CSS（内联在HTML中，可跳过）

# 压缩HTML
html-minifier --collapse-whitespace --remove-comments index.html -o index.min.html
```

### 启用GZIP（服务器配置）
```nginx
# Nginx
gzip on;
gzip_types text/html text/css application/javascript application/json;
gzip_min_length 256;
```

## 自定义域名

### Cloudflare（推荐）
1. 添加你的域名
2. 设置DNS CNAME记录指向GitHub Pages/Vercel/Netlify
3. 启用HTTPS（自动）

### 自有域名直接指向
```
A记录: 
@ -> 你的服务器IP
www -> 你的服务器IP
```

## 监控与分析

### Google Analytics
在 `index.html` 的 `<head>` 中添加:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_TRACKING_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_TRACKING_ID');
</script>
```

## 故障排查

### 场景加载失败
- 检查 `scenarios.json` 是否在同一目录
- 检查浏览器Console错误信息
- 确保使用HTTP服务器（而非file://协议）

### Canvas不显示
- 检查浏览器兼容性
- 确保JavaScript已启用
- 检查Console错误

### 移动端触摸不响应
- 检查 `touch-action: none` CSS
- 确保viewport设置正确

## 备份与版本控制

### Git标签
```bash
# 创建版本标签
git tag -a v1.0 -m "Initial release"
git push origin v1.0
```

### 自动部署
使用GitHub Actions自动部署到Pages:
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

---

**部署愉快！** 🚀
