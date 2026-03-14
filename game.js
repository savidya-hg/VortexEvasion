let isPaused = true, score = 0, health = 5, hasUsedRevive = false, currentSolution = null;
let player, missiles;
const SHIP_IMG = 'https://upload.wikimedia.org/wikipedia/commons/1/1f/Space-Invaders-ship.png';

const config = { 
    type: Phaser.AUTO, width: window.innerWidth, height: window.innerHeight,
    physics: { default: 'arcade', arcade: { debug: false } }, 
    scene: { preload, create, update }
};
const game = new Phaser.Game(config);

//assets
function preload() {
    this.load.image('ship', SHIP_IMG);
    this.load.spritesheet('boom', 'https://labs.phaser.io/assets/sprites/explosion.png', { frameWidth: 64, frameHeight: 64 });
    let graphics = this.make.graphics();
    graphics.fillStyle(0xff3333).fillRect(2, 0, 6, 20);
    graphics.generateTexture('missile', 10, 20);
    graphics.destroy();
}

function create() {
    //ship size
    player = this.physics.add.sprite(config.width/2, config.height/2, 'ship').setScale(0.06).setDepth(10);
    player.setSize(player.width - 40, player.height - 40).setOffset(30, 0);

    //explosion spritesheet
    this.anims.create({ 
        key: 'explode', 
        frames: this.anims.generateFrameNumbers('boom', { start: 0, end: 23 }), 
        frameRate: 60, hideOnComplete: true 
    });

    //missile to missile collision logic
    missiles = this.physics.add.group();
    this.physics.add.overlap(player, missiles, handleCollision, null, this);
    this.physics.add.collider(missiles, missiles, (m1, m2) => {
        triggerExplosion(m1.x, m1.y); m1.destroy(); m2.destroy();
        score += 500;   //+points
    }, null, this);
}

function update() {
    //cursor movement and ship rotation
    let pointer = this.input.activePointer;
    let targetAngle = Phaser.Math.Angle.Between(player.x, player.y, pointer.x, pointer.y) + Math.PI/2;
    player.rotation = Phaser.Math.Angle.RotateTo(player.rotation, targetAngle, 0.12);

    if (isPaused) return;

    let moveDir = player.rotation - Math.PI/2, speed = 5.3;
    
    //missile angle & speed
    missiles.getChildren().forEach(m => {
        let angle = Phaser.Math.Angle.Between(m.x, m.y, player.x, player.y) + Math.PI/2;
        m.rotation = Phaser.Math.Angle.RotateTo(m.rotation, angle, 0.01); 
        this.physics.velocityFromRotation(m.rotation - Math.PI/2, 480, m.body.velocity);
        m.x -= Math.cos(moveDir) * speed; 
        m.y -= Math.sin(moveDir) * speed;
    });

    score++;
    document.getElementById('score-ui').innerText = "SCORE: " + score;
}

function startGame() { 
    //hides menu and shows game ui
    document.getElementById('ui-layer').classList.add('hidden'); 
    document.getElementById('health-container').style.display = 'flex';
    document.getElementById('score-ui').style.display = 'block';
    isPaused = false; 
    updateHealthUI();
    game.scene.scenes[0].time.addEvent({ 
        delay: 2500, callback: spawnMissile, callbackScope: game.scene.scenes[0], loop: true 
    }); 
}

//missile spawn
function spawnMissile() {
    if (isPaused) return;
    let angle = Math.random() * Math.PI * 2;
    let m = missiles.create(player.x + Math.cos(angle) * 800, player.y + Math.sin(angle) * 800, 'missile');
    m.rotation = angle;
    m.setSize(10, 20);
}

//ship and missile collision
function handleCollision(p, m) {
    triggerExplosion(m.x, m.y);
    m.destroy(); health--; updateHealthUI();
    this.cameras.main.shake(120, 0.015);
    if (health <= 0) { 
        isPaused = true; this.physics.pause(); 
        if (!hasUsedRevive) triggerApiPuzzle(); else finishGame(); 
    }
}

//explosion display
function triggerExplosion(x, y) {
    let boom = game.scene.scenes[0].add.sprite(x, y, 'boom').setScale(2);
    boom.play('explode');
}

//heart api
async function triggerApiPuzzle() {
    document.getElementById('puzzle-ui').style.display = 'block';
    try { 
        const res = await fetch('https://marcconrad.com/uob/heart/api.php');
        const data = await res.json(); 
        currentSolution = data.solution; 
        document.getElementById('puzzle-img').src = data.question.replace('http://', 'https://'); 
    } catch (e) { finishGame(); }
}

//heart api answer
function checkAnswer() {
    if (parseInt(document.getElementById('ans-input').value) === currentSolution) {
        hasUsedRevive = true; document.getElementById('puzzle-ui').style.display = 'none';
        isPaused = false; game.scene.scenes[0].physics.resume(); 
        health = 3; updateHealthUI(); missiles.clear(true, true);
    } else { finishGame(); }
}

async function finishGame() {
    //hide game ui and show menu ui
    isPaused = true; 
    game.scene.scenes[0].physics.pause();
    
    document.getElementById('puzzle-ui').style.display = 'none';
    document.getElementById('health-container').style.display = 'none';
    document.getElementById('score-ui').style.display = 'none';
    
    document.getElementById('final-score-text').innerText = "FINAL SCORE: " + score; 
    
    //if highscore is beaten personal record
    if (score > userHighScore) {
        document.getElementById('new-record-msg').style.display = 'block';
        await _supabase.from('leaderboards').update({ high_score: score }).eq('username', currentUser);
    }
    document.getElementById('game-over-ui').style.display = 'block';
}

function updateUIForLogin() {
    //hide signin login after logging in
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
    for(let i=0; i<health; i++) {
        container.innerHTML += `<img src="${SHIP_IMG}" style="width:24px; filter: drop-shadow(0 0 5px var(--neon-green));">`;
    }
}

//fact api
async function fetchFact() {
    const factPopup = document.getElementById('fact-popup'), factText = document.getElementById('fact-text');
    factPopup.style.display = 'block';
    factText.innerText = "LINKING TO DATASTREAM...";
    try {
        const response = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
        const data = await response.json();
        const fullFact = data.text;
        factText.innerText = "";
        let i = 0;
        //typewriter effect
        function typeWriter() {
            if (i < fullFact.length) { factText.innerHTML += fullFact.charAt(i); i++; setTimeout(typeWriter, 25); }
        }
        typeWriter();
    } catch (e) { factText.innerText = "API Unreachable"; }
}

function openModal(id) {
    document.getElementById(id).style.display = 'block';
}
function closeModals() {
    document.querySelectorAll('.modal, .terminal-window').forEach(m => m.style.display = 'none');
}