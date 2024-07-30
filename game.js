class Game {
    constructor() {
        this.canvas = document.getElementById("game");
        this.context = this.canvas.getContext("2d");
        this.lastRefreshTime = Date.now();
        this.sinceLastSpawn = 0;
        this.sprites = [];
        this.score = 0;
        this.spriteData;
        this.spriteImage;
        this.flowers = [];
        this.bear;
        this.buttons = [];
        this.ui = [];
        this.level = 9;
        this.debug = false;
        this.font = '30px Verdana';
        this.txtoptions = {
            alignment: "center",
            font: 'Verdana',
            fontSize: 12,
            lineHeight: 15,
            color: "#fff"
        };

        // Stopwatch properties
        this.stopwatchStart = 0;
        this.stopwatchElapsed = 0;
        this.stopwatchRunning = false;

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.correctSfx = new SFX({
            context: this.audioContext,
            src: { mp3: "gliss.mp3", webm: "gliss.webm" },
            loop: false,
            volume: 0.3
        });
        this.wrongSfx = new SFX({
            context: this.audioContext,
            src: { mp3: "boing.mp3", webm: "boing.webm" },
            loop: false,
            volume: 0.3
        });
        this.dropSfx = new SFX({
            context: this.audioContext,
            src: { mp3: "swish.mp3", webm: "swish.webm" },
            loop: false,
            volume: 0.3
        });

        const game = this;
        const options = {
            assets: [
                "beargame.json",
                "beargame.png"
            ],
            oncomplete: function () {
                const progress = document.getElementById('progress');
                progress.style.display = "none";
                game.load();
            },
            onprogress: function (value) {
                const bar = document.getElementById('progress-bar');
                bar.style.width = `${value * 100}%`;
            }
        };

        const preloader = new Preloader(options);
    }

    load() {
        const game = this;
        this.loadJSON("flowers", function (data, game) {
            game.spriteData = JSON.parse(data);
            game.spriteImage = new Image();
            game.spriteImage.src = game.spriteData.meta.image;
            game.spriteImage.onload = function () {
                game.init();
            }
        });
    }

    loadJSON(json, callback) {
        const xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', json + '.json', true);
        const game = this;
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == 200) {
                callback(xobj.responseText, game);
            }
        };
        xobj.send(null);
    }

    init() {
        const fps = 25;
        this.config = {};
        this.config.speed = 80; // Starting speed of icebergs, pixel travel per second
        this.config.duration = 2000; // Game duration in milliseconds
        this.config.lives = 9;
        this.config.levels = 1;
        this.lives = this.config.lives;

        const sourceSize = this.spriteData.frames[0].sourceSize;
        this.gridSize = { rows: 9, cols: 10, width: sourceSize.w, height: sourceSize.h };
        const topleft = { x: 150, y: 40 };
        this.spawnInfo = { count: 0, total: 0 };
        this.flowers = [];
        for (let row = 0; row < this.gridSize.rows; row++) {
            let y = row * this.gridSize.height + topleft.y;
            this.flowers.push([]);
            for (let col = 0; col < this.gridSize.cols; col++) {
                let x = col * this.gridSize.width + topleft.x;
                const sprite = this.spawn(x, y);
                this.flowers[row].push(sprite);
                this.spawnInfo.total++;
            }
        }
        this.gridSize.topleft = topleft;

        const msgoptions = {
            game: this,
            frame: "flowers0006.png",
            center: true,
            scale: 1.0,
        };
        this.msgPanel = new Sprite2("msgPanel", msgoptions);

        const game = this;
        if ('ontouchstart' in window) {
            this.canvas.addEventListener("touchstart", function (event) { game.tap(event); });
        } else {
            this.canvas.addEventListener("mousedown", function (event) { game.tap(event); });
        }
        this.state = "initialised";
        this.refresh();
    }

    refresh() {
        const now = Date.now();
        const dt = (now - this.lastRefreshTime) / 1000.0;

        this.update(dt);
        this.render();

        this.lastRefreshTime = now;

        const game = this;
        requestAnimationFrame(function () { game.refresh(); });
    }

    update(dt) {
        console.log(this.state)
        let removed;
        do {
            removed = false;
            let i = 0;
            for (let sprite of this.sprites) {
                if (sprite.kill) {
                    this.sprites.splice(i, 1);
                    this.clearGrid(sprite);
                    removed = true;
                    break;
                }
                i++;
            }
        } while (removed);

        switch (this.state) {
            case "spawning":
                if (this.spawnInfo.count == this.spawnInfo.total) {
                    delete this.spawnInfo;
                    this.state = "ready";
                }
                break;
            case "removing":
                if (this.removeInfo.count == this.removeInfo.total) {
                    delete this.removeInfo;
                    this.removeGridGaps();
                    this.state = "dropping";
                    this.dropSfx.play();
                }
                break;
            case "dropping":
                if (this.dropInfo.count == this.dropInfo.total) {
                    delete this.dropInfo;
                    this.state = "ready";
                }
                break;
            case "initialised":
                this.msgPanel.index = 3;
                dt = 0;
                this.state = "instructions1";
                break;
            case "instructions1":
                this.msgPanel.index = 3;
                dt = 0;
                break;
            case "instructions2":
                this.msgPanel.index = 3;
                dt = 0;
                break;
                case "gameover":
                    this.msgPanel.index = 3;
                    dt = 0;
                    break;
        }

        for (let sprite of this.sprites) {
            if (sprite == null) continue;
            sprite.update(dt);
        }

        
        if (this.stopwatchRunning) {
            this.stopwatchElapsed -= dt;
        }

        
        if(this.stopwatchElapsed <= 0 && this.state == "ready")
        {
            this.state = "gameover"
        }
    }

    clearGrid(sprite) {
        for (let row of this.flowers) {
            let col = row.indexOf(sprite);
            if (col != -1) {
                row[col] = null;
                return true;
            }
        }
        return false;
    }

    removeGridGaps() {
        this.dropInfo = { count: 0, total: 0 };

        for (let col = 0; col < this.flowers[0].length; col++) {
            let row;
            for (row = this.flowers.length - 1; row >= 0; row--) {
                if (this.flowers[row][col] == null) {
                    let count = 0;
                    for (let r = row - 1; r >= 0; r--) {
                        var sprite = this.flowers[r][col];
                        count++;
                        if (sprite != null) {
                            [this.flowers[row][col], this.flowers[r][col]] = [this.flowers[r][col], this.flowers[row][col]];
                            sprite.initDrop(this.gridSize.topleft.y + this.gridSize.height * row);
                            break;
                        }
                    }
                }
            }
            for (row = this.flowers.length - 1; row >= 0; row--) {
                if (this.flowers[row][col] == null) {
                    break;
                }
            }
            for (let r = row; r >= 0; r--) {
                let x = col * this.gridSize.width + this.gridSize.topleft.x;
                let y = this.gridSize.topleft.y - this.gridSize.height * (row - r + 1);
                const sprite = this.spawn(x, y);
                this.flowers[r][col] = sprite;
                sprite.initDrop(this.gridSize.topleft.y + r * this.gridSize.height);
            }
        }
    }

    spawn(x, y) {
        const index = Math.floor(Math.random() * 5);
        const frameData = this.spriteData.frames[index];
        const s = new Sprite({
            game: this,
            context: this.context,
            x: x,
            y: y,
            index: index,
            width: frameData.sourceSize.w,
            height: frameData.sourceSize.h,
            frameData: frameData,
            anchor: { x: 0.5, y: 0.5 },
            image: this.spriteImage,
            json: this.spriteData,
            states: {
                spawn: { duration: 0.5 },
                static: { duration: 1.5 },
                die: { duration: 0.8 },
                drop: { moveY: 450 }
            }
        });

        this.sprites.push(s);
        this.sinceLastSpawn = 0;

        return s;
    }

    render() {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let sprite of this.sprites) sprite.render();

        this.context.font = "20px Verdana";
        this.context.fillStyle = "#999";
        let str = "Score";
        let txt = this.context.measureText(str);
        let left = (this.gridSize.topleft.x + txt.width) / 4;
        this.context.fillText("Score", left, 30);
        this.context.font = "30px Verdana";
        this.context.fillStyle = "#333";
        str = String(this.score);
        txt = this.context.measureText(str);
        left = (this.gridSize.topleft.x + txt.width) / 3;
        this.context.fillText(this.score, left, 65);

        
        this.context.font = "20px Verdana";
        this.context.fillStyle = "#999";
        let timeStr = "Time";
        let timeTxt = this.context.measureText(timeStr);
        this.context.fillText("Time", this.canvas.width - timeTxt.width - 10, 30);
        this.context.font = "30px Verdana";
        this.context.fillStyle = "#333";
        let elapsedTime = (this.stopwatchElapsed).toFixed(2);
        let elapsedTxt = this.context.measureText(elapsedTime);
        this.context.fillText(elapsedTime, this.canvas.width - elapsedTxt.width - 10, 65);

        switch (this.state) {
            case "initialised": break;
            case "instructions1":
                this.context.font = this.font;
                this.context.textAlign = "center";
                this.context.fillStyle = "white";
                this.context.fillText("Tap to Start Game", this.canvas.width / 2, this.canvas.height / 2);
                break;
            case "instructions2":
                this.context.font = this.font;
                this.context.textAlign = "center";
                this.context.fillStyle = "white";
                this.context.fillText("Instruction : Match 3 more objects", this.canvas.width / 2, this.canvas.height / 2);
                this.context.fillText("prevent the bomb. it will cost you a lot", this.canvas.width / 2 + 30, this.canvas.height / 2 + 35);
                break;
            case "gameover":
                if (!this.gameOverText) {
                    this.gameOverText = document.createElement("div");
                    this.gameOverText.textContent = "Game Over!";
                    this.gameOverText.style.position = "absolute";
                    this.gameOverText.style.top = "50%";
                    this.gameOverText.style.left = "35%";
                    this.gameOverText.style.transform = "translate(-50%, -50%)";
                    this.gameOverText.style.fontSize = "40px";
                    this.gameOverText.style.color = "red";
                    this.gameOverText.style.zIndex = 2; 
                    document.body.appendChild(this.gameOverText);
                  }
                  this.context.clearRect(0, 0, this.canvas.width , this.canvas.height);
                  break;

        }
    }

    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        const scale = { x: this.canvas.width / rect.width, y: this.canvas.height / rect.height };
        const clientX = evt.targetTouches ? evt.targetTouches[0].clientX : evt.pageX;
        const clientY = evt.targetTouches ? evt.targetTouches[0].clientY : evt.pageY;
        return {
            x: (clientX - rect.left) * scale.x,
            y: (clientY - rect.top) * scale.y
        };
    }

    getConnectedSprites(index, row, col, connected = []) {
        const sprite = this.flowers[row][col];
        const grid = this.flowers;

        try {
            if (sprite.index == index && !sprite.checked) {
                connected.push(sprite);
                sprite.checked = true;

                for (let r = row - 1; r <= row + 1; r++) {
                    for (let c = col - 1; c <= col + 1; c++) {
                        if ((r === row && c === col) || (r !== row && c !== col)) {
                            continue;
                        }

                        if (boundaryCheck(r, c)) {
                            connected.concat(this.getConnectedSprites(index, r, c, connected));
                        }
                    }
                }
                connected.concat(this.getConnectedSprites(index, r, c, connected));
            }
        } catch (e) {
            console.log(`Problem with ${row}, ${col}`);

        }
        sprite.checked = true;

        return connected;

        function boundaryCheck(row, col) {
            if (row < 0 || row >= grid.length || col < 0 || col >= grid[0].length) return false;
            return true;
        }
    }

    tap(evt) {
        if (this.state != "ready" && this.state != "instructions1" && this.state != "instructions2") return;

        evt.preventDefault();
        switch (this.state) {
            case "initialised":
            case "instructions1":
                this.state = "instructions2";
                return;
            case "instructions2":
                this.state = "spawning";
                this.startStopwatch();
                return;
            case "gameover":
                this.resetGame();
                return;
        }

        const mousePos = this.getMousePos(evt);
        const canvasScale = this.canvas.width / this.canvas.offsetWidth;
        const loc = {};

        loc.x = mousePos.x * canvasScale;
        loc.y = mousePos.y * canvasScale;

        for (let sprite of this.sprites) {
            if (sprite.hitTest(loc)) {
                let row, col, found = false;

                for (let sprite of this.sprites) sprite.checked = false;
                let i = 0;
                for (row of this.flowers) {
                    col = row.indexOf(sprite);
                    if (col != -1) {
                        row = i;
                        found = true;
                        break;
                    }
                    i++;
                }
                if (found) {
                    const connected = this.getConnectedSprites(sprite.index, row, col);
                    if (connected.length >= 3 && sprite.index != 4) {
                        this.correctSfx.play();
                        for (let sprite of connected) {
                            sprite.state = sprite.states.die;
                        }
                        this.stopwatchElapsed += Math.random(1, connected.length) * 5;
                        this.score += connected.length;
                        this.state = "removing";
                        this.removeInfo = { count: 0, total: connected.length };
                    } else if(connected.length >= 3 && sprite.index == 4) {
                        
                        for(let sprite of connected){
                            sprite.state = sprite.states.die;
                        }
                        this.score -= Math.round(Math.random(0, 3) * 10);
                        this.stopwatchElapsed -= Math.random(1, connected.length) * 5;
                        this.state = "removing";
                        this.removeInfo ={count: 0, total: connected.length};
                        this.wrongSfx.play();
                    } else{
                        this.stopwatchElapsed -= Math.random(1, 2) * 5;
                        this.score -= Math.round(Math.random(0, 3) * 10);
                        this.wrongSfx.play();
                    }
                }
            }
        }
    }

    startStopwatch() {
        this.stopwatchStart = Date.now();
        this.stopwatchElapsed = 30;
        this.stopwatchRunning = true;
    }

    stopStopwatch() {
        this.stopwatchRunning = false;
    }

    resetStopwatch() {
        this.stopwatchElapsed = 0;
    }

    resetGame() {
        this.state = "spawning";
        this.score = 0;
        this.sprites = [];
        this.flowers = [];
        this.removeInfo = null;
    
        this.startStopwatch();
    
        if (this.gameOverText) {
          document.body.removeChild(this.gameOverText);
          this.gameOverText = null;
        }
      }
    
}
