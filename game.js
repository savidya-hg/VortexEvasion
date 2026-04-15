// game state and global variables
let isPaused = true;
let score = 0;
let health = 5;
let hasUsedRevive = false;
let currentSolution = null;

let player, missiles, stars, smokeEmitter, playerTrail;

// ship img link
const SHIP_IMG = 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Space-Invaders-ship.png';

// game engine setup
const config = { 
    type: Phaser.AUTO, 
    width: window.innerWidth, 
    height: window.innerHeight,
    physics: { 
        default: 'arcade', 
        arcade: { debug: false } 
    }, 
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// --- game  functions

function preload() {
    this.load.image('ship', SHIP_IMG);
    this.load.spritesheet('boom', 'https://labs.phaser.io/assets/sprites/explosion.png', { 
        frameWidth: 64, 
        frameHeight: 64 
    });
    
    // pixel star texture
    let starGfx = this.make.graphics();
    starGfx.fillStyle(0xffffff);
    starGfx.fillRect(3, 0, 2, 8); 
    starGfx.fillRect(0, 3, 8, 2); 
    starGfx.fillRect(2, 2, 4, 4); 
    starGfx.generateTexture('star', 8, 8);

    // missile texture
    let mGfx = this.make.graphics();
    mGfx.fillStyle(0xff3333); // main body
    mGfx.fillRect(3, 6, 6, 18); 
    mGfx.fillStyle(0xffffff); // white tip
    mGfx.fillRect(4.5, 0, 3, 6); 
    mGfx.fillStyle(0xaa0000); // dark red fins
    mGfx.fillRect(0, 18, 3, 6); 
    mGfx.fillRect(9, 18, 3, 6); 
    mGfx.generateTexture('missile', 12, 24);

    // smoke particle
    let pGfx = this.make.graphics();
    pGfx.fillStyle(0x999999); 
    pGfx.fillRect(0, 0, 6, 6);
    pGfx.generateTexture('smoke', 6, 6);
    
    // clear up graphic objects
    starGfx.destroy(); 
    mGfx.destroy(); 
    pGfx.destroy();
}

function create() {
    // infinite star background
    stars = this.add.group();
    for (let i = 0; i < 150; i++) {
        let x = Phaser.Math.Between(0, config.width);
        let y = Phaser.Math.Between(0, config.height);
        let star = stars.create(x, y, 'star').setDepth(1);
        star.setScale(Phaser.Math.FloatBetween(0.5, 1.2)); 
        star.setAlpha(Phaser.Math.FloatBetween(0.3, 0.8));
    }

    // smoke trail config
    const trailConfig = {
        speed: { min: 5, max: 15 },
        scale: { start: 1.5, end: 0.5 },
        alpha: { start: 0.7, end: 0 },
        lifespan: 1500,        
        blendMode: 'NORMAL',
        frequency: 10,         
        quantity: 2,           
        emitting: false
    };

    smokeEmitter = this.add.particles(0, 0, 'smoke', trailConfig);  // missile smoke
    playerTrail = this.add.particles(0, 0, 'smoke', trailConfig);   // player smoke

    // player ship setup
    player = this.physics.add.sprite(config.width/2, config.height/2, 'ship');
    player.setScale(0.06).setDepth(10);
    player.setSize(player.width - 40, player.height - 40).setOffset(30, 0);

    // explosion animation
    this.anims.create({ 
        key: 'explode', 
        frames: this.anims.generateFrameNumbers('boom', { start: 0, end: 23 }), 
        frameRate: 60, 
        hideOnComplete: true 
    });

    // missile group and collision
    missiles = this.physics.add.group();
    this.physics.add.overlap(player, missiles, handleCollision, null, this);
    this.physics.add.collider(missiles, missiles, (m1, m2) => {
        triggerExplosion(m1.x, m1.y); 
        m1.destroy(); 
        m2.destroy();
        score += 500;
    }, null, this);
}

function update() {
    // make the ship point at the mouse cursor
    let pointer = this.input.activePointer;
    let targetAngle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y) + Math.PI/2;
    player.rotation = Phaser.Math.Angle.RotateTo(player.rotation, targetAngle, 0.12);

    if (isPaused) return;

    let moveDir = player.rotation - Math.PI/2;
    let speed = 5.3;
    
    // stars movement to create the movement illusion
    stars.getChildren().forEach(star => {
        star.x -= Math.cos(moveDir) * (speed * 0.6); 
        star.y -= Math.sin(moveDir) * (speed * 0.6);
        if (star.x < 0) star.x = config.width;
        if (star.x > config.width) star.x = 0;
        if (star.y < 0) star.y = config.height;
        if (star.y > config.height) star.y = 0;
    });

    // smoke start from back of the ship
    let shipTailX = player.x - Math.sin(player.rotation) * 10;
    let shipTailY = player.y + Math.cos(player.rotation) * 10;
    playerTrail.emitParticleAt(shipTailX, shipTailY);

    // move and rotate each missile toward the ship
    missiles.getChildren().forEach(m => {
        let angle = Phaser.Math.Angle.Between(m.x, m.y, player.x, player.y) + Math.PI/2;
        m.rotation = Phaser.Math.Angle.RotateTo(m.rotation, angle, 0.025); 
        this.physics.velocityFromRotation(m.rotation - Math.PI/2, 400, m.body.velocity);
        
        m.x -= Math.cos(moveDir) * speed; 
        m.y -= Math.sin(moveDir) * speed;

        // drop smoke from the back of the missile
        let tailX = m.x - Math.sin(m.rotation) * 15;
        let tailY = m.y + Math.cos(m.rotation) * 15;
        smokeEmitter.emitParticleAt(tailX, tailY);
    });

    // keep all smoke trails moving with the world drift
    [smokeEmitter, playerTrail].forEach(emitter => {
        emitter.forEachAlive(p => {
            p.x -= Math.cos(moveDir) * speed;
            p.y -= Math.sin(moveDir) * speed;
        });
    });

    // increase score
    score++;
    document.getElementById('score-ui').innerText = "SCORE: " + score;
}

// --- game logic

function startGame() { 
    // hide menu elements
    document.getElementById('ui-layer').classList.add('hidden'); 
    document.getElementById('logout-ui').classList.add('hidden');
    document.getElementById('auth-ui').classList.add('hidden');
    document.getElementById('fact-api-container').classList.add('hidden');
    
    // show game hud
    document.getElementById('health-container').style.display = 'flex';
    document.getElementById('score-ui').style.display = 'block';
    
    isPaused = false; 
    updateHealthUI();

    // launch 2 missiles at start
    spawnMissile();
    spawnMissile();

    // spawn new missile every 2.5s
    game.scene.scenes[0].time.addEvent({ 
        delay: 2500, 
        callback: spawnMissile, 
        callbackScope: game.scene.scenes[0], 
        loop: true 
    }); 
}

function spawnMissile() {
    if (isPaused) return;
    let angle = Math.random() * Math.PI * 2;
    // spawn missile out of screen
    let m = missiles.create(player.x + Math.cos(angle) * 850, player.y + Math.sin(angle) * 850, 'missile');
    m.rotation = angle;
    m.setSize(12, 24); 
}

function handleCollision(p, m) {
    // boom!
    triggerExplosion(m.x, m.y);
    m.destroy(); 
    
    // take dmg and shake the screen
    health--; 
    updateHealthUI();
    this.cameras.main.shake(120, 0.015);
    
    // check if ded
    if (health <= 0) { 
        isPaused = true; 
        this.physics.pause(); 
        // check if heart api is used
        if (!hasUsedRevive) triggerApiPuzzle(); else finishGame(); 
    }
}

function triggerExplosion(x, y) {
    let boom = game.scene.scenes[0].add.sprite(x, y, 'boom').setScale(2);
    boom.play('explode');
}

// --- api and system functions

async function triggerApiPuzzle() {
    document.getElementById('puzzle-ui').style.display = 'block';
    try { 
        const res = await fetch('https://marcconrad.com/uob/heart/api.php');
        const data = await res.json(); 
        currentSolution = data.solution; 
        document.getElementById('puzzle-img').src = data.question.replace('http://', 'https://'); 
    } catch (e) { 
        finishGame(); 
    }
}

function checkAnswer() {
    const input = document.getElementById('ans-input');
    if (parseInt(input.value) === currentSolution) {
        hasUsedRevive = true; 
        document.getElementById('puzzle-ui').style.display = 'none';
        isPaused = false; 
        game.scene.scenes[0].physics.resume(); 
        health = 3; 
        updateHealthUI(); 
        missiles.clear(true, true);
    } else { 
        finishGame(); 
    }
}

async function finishGame() {
    isPaused = true; 
    game.scene.scenes[0].physics.pause();
    
    document.getElementById('puzzle-ui').style.display = 'none';
    document.getElementById('health-container').style.display = 'none';
    document.getElementById('score-ui').style.display = 'none';
    document.getElementById('final-score-text').innerText = "FINAL SCORE: " + score; 

    // update high score
    if (score > userHighScore) {
        document.getElementById('new-record-msg').style.display = 'block';
        await _supabase.from('leaderboards').update({ high_score: score }).eq('username', currentUser);
    }
    
    document.getElementById('game-over-ui').style.display = 'block';
}

function updateUIForLogin() {
    document.getElementById('auth-ui').classList.add('hidden');
    document.getElementById('logout-ui').classList.remove('hidden');
    document.getElementById('user-display').innerText = currentUser.toUpperCase();
    document.getElementById('personal-best').innerText = "BEST:" + userHighScore;
    
    const playBtn = document.getElementById('main-play-btn');
    playBtn.disabled = false;
    playBtn.innerText = "PLAY: " + currentUser.toUpperCase();
}

function updateHealthUI() {
    const container = document.getElementById('health-container');
    container.innerHTML = '';
    // health ship icon
    for(let i=0; i<health; i++) {
        container.innerHTML += `<img src="${SHIP_IMG}" style="width:30px; ">`;
    }
}

async function fetchFact() {
    const factPopup = document.getElementById('fact-popup');
    const factText = document.getElementById('fact-text');
    factPopup.style.display = 'block';
    factText.innerText = "LINKING...";

    try {
        const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        const data = await response.json();
        const fullFact = data.text;
        
        // simple typewriter effect
        factText.innerText = "";
        let i = 0;
        function typeWriter() {
            if (i < fullFact.length) { 
                factText.innerHTML += fullFact.charAt(i); 
                i++; 
                setTimeout(typeWriter, 25); 
            }
        }
        typeWriter();
    } catch (e) { 
        factText.innerText = "API Unreachable"; 
    }
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModals() {
    document.querySelectorAll('.modal, .terminal-window').forEach(m => m.style.display = 'none');
}