// game.js

// --- Get DOM Elements ---
// (Keep these as they are)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('gameContainer');
const scoreDisplay = document.getElementById('score');
const timerDisplay = document.getElementById('timer');
const messageOverlay = document.getElementById('messageOverlay');
const finalScoreDisplay = document.getElementById('finalScore');
const startButton = document.getElementById('startButton');
const restartButton = document.getElementById('restartButton');

// --- Game Settings ---
const GAME_WIDTH = 400;
const GAME_HEIGHT = 600;
const GAME_TIME_LIMIT = 60; // seconds

// --- Physics Constants ---
const GRAVITY = 0.4;
const PUSH_FORCE = -9.0; // Adjusted vertical push for tap mechanic
const HORIZONTAL_PUSH_SPEED = 5.5; // NEW: Speed applied horizontally on tap
const HORIZONTAL_DAMPING = 0.995;
const BOUNCE_FACTOR_GROUND = 0.6;
const BOUNCE_FACTOR_WALL = 0.8;
const BOUNCE_FACTOR_RIM = 0.7;
const BOUNCE_FACTOR_BACKBOARD = 0.8;
const ANGULAR_DAMPING = 0.98;
const SPIN_ON_RIM_HIT = 0.15;
const SPIN_EFFECT_ON_BOUNCE = 0.1;
const SPIN_DAMPING_ON_BOUNCE = 0.85;

// --- Ball Properties ---
let ball = {
    x: GAME_WIDTH / 4,
    y: GAME_HEIGHT / 2,
    radius: 15,
    vx: 0, // Start with no horizontal velocity until first tap
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    color: '#ff8c00'
};

// --- Hoop Properties ---
let hoop = {
    x: GAME_WIDTH * 0.75,
    y: GAME_HEIGHT * 0.35,
    width: 80,
    rimThickness: 8,
    rimColor: '#ff4500',
    netHeight: 50,
    netColor: '#ffffffaa',
    backboardWidth: 10,
    backboardHeight: 70,
    backboardColor: '#ffffffcc',
    vx: 1.8,
    scoreZoneHeight: 10
};

// --- Game State ---
let score = 0;
let timeLeft = GAME_TIME_LIMIT;
let timerInterval = null;
let gameState = 'start'; // 'start', 'playing', 'gameOver'
// let isMouseDown = false; // REMOVED
let justClicked = false; // NEW: Flag for single tap event
let canScore = true;
let hitRimOrBackboard = false;
let lastTime = 0;

// --- Net Animation State ---
let isNetAnimating = false;
let netAnimationProgress = 0;
const NET_ANIMATION_DURATION = 15; // Frames
const NET_PULL_X_FACTOR = 0.15;
const NET_PULL_Y_FACTOR = 0.2;

// --- Initialization ---
function initGame() {
    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    gameContainer.style.width = `${GAME_WIDTH}px`;
    gameContainer.style.height = `${GAME_HEIGHT}px`;
    resetGame();
}

function resetGame() {
    score = 0;
    timeLeft = GAME_TIME_LIMIT;
    gameState = 'start';
    // isMouseDown = false; // REMOVED
    justClicked = false; // Reset click flag
    canScore = true;
    hitRimOrBackboard = false;
    isNetAnimating = false;
    netAnimationProgress = 0;
    lastTime = 0;

    ball.x = GAME_WIDTH / 4;
    ball.y = GAME_HEIGHT / 1.5; // Start lower
    ball.vx = 0; // Start stationary horizontally
    ball.vy = 0;
    ball.angle = 0;
    ball.angularVelocity = 0; // No initial spin

    hoop.x = GAME_WIDTH * 0.75;
    hoop.vx = Math.abs(hoop.vx) * (Math.random() > 0.5 ? 1 : -1); // Random initial direction

    scoreDisplay.textContent = `Score: ${score}`;
    timerDisplay.textContent = `Time: ${timeLeft}`;
    messageOverlay.style.display = 'none';
    startButton.style.display = 'block';
    restartButton.style.display = 'none';
    startButton.disabled = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    clearCanvas();
    drawCourt();
    drawHoop();
    drawBall();
}

// --- Game Loop ---
function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const deltaTime = (timestamp - lastTime) / (1000 / 60);
    lastTime = timestamp;

    if (gameState !== 'playing') {
        // (Keep drawing logic as is)
        clearCanvas();
        drawCourt();
        drawHoop();
        drawBall();
        if (isNetAnimating) updateNetAnimation(deltaTime);
        if (gameState === 'gameOver') {
            messageOverlay.style.display = 'block';
        }
        requestAnimationFrame(gameLoop);
        return;
    }

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// --- Update Logic ---
function update(deltaTime) {

    // --- Apply Input Force (Tap Mechanic) ---
    if (justClicked) {
        ball.vy = PUSH_FORCE; // Apply vertical impulse

        // Apply horizontal impulse based on hoop's current direction
        let direction = Math.sign(hoop.vx);
        // Handle case where hoop might be momentarily stationary (or if vx is 0)
        if (direction === 0) {
            direction = (Math.random() < 0.5) ? -1 : 1; // Assign random direction if hoop stopped
        }
        ball.vx = HORIZONTAL_PUSH_SPEED * direction;

        // Optional: Add a small random spin on tap?
        // ball.angularVelocity += (Math.random() - 0.5) * 0.1;

        justClicked = false; // Consume the click/tap for this update cycle
    }

    // --- Physics ---
    // Apply Gravity
    ball.vy += GRAVITY * deltaTime;

    // Update Position
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;

    // Update Angle based on Angular Velocity
    ball.angle += ball.angularVelocity * deltaTime;

    // Apply Damping (Only horizontal damping might be needed now)
    ball.vx *= Math.pow(HORIZONTAL_DAMPING, deltaTime); // Keep horizontal damping
    ball.angularVelocity *= Math.pow(ANGULAR_DAMPING, deltaTime);

    // Update Hoop Position
    hoop.x += hoop.vx * deltaTime;
    if (hoop.x + hoop.width / 2 > GAME_WIDTH - hoop.backboardWidth || hoop.x - hoop.width / 2 < 0) {
        hoop.vx *= -1;
        hoop.x += hoop.vx * deltaTime;
    }

    // Update Net Animation
    if (isNetAnimating) {
        updateNetAnimation(deltaTime);
    }

    // Collision Detection
    hitRimOrBackboard = false;
    handleCollisions(deltaTime);

    // Scoring Check
    checkScoring();
}

function updateNetAnimation(deltaTime) {
    netAnimationProgress += deltaTime / NET_ANIMATION_DURATION;
    if (netAnimationProgress >= 1) {
        isNetAnimating = false;
        netAnimationProgress = 0;
    }
}

// --- Collision Handling ---
// (Keep handleCollisions function as is)
function handleCollisions(deltaTime) {
    // Ground Collision
    if (ball.y + ball.radius > GAME_HEIGHT) {
        ball.y = GAME_HEIGHT - ball.radius;
        const incomingVy = ball.vy;
        ball.vy *= -BOUNCE_FACTOR_GROUND;
        ball.vx += ball.angularVelocity * SPIN_EFFECT_ON_BOUNCE * Math.abs(incomingVy) * deltaTime;
        ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE;
        ball.vx *= BOUNCE_FACTOR_GROUND; // Ground friction still useful
        canScore = true;
    }

    // Ceiling Collision
    if (ball.y - ball.radius < 0) {
        ball.y = ball.radius;
        const incomingVy = ball.vy;
        ball.vy *= -BOUNCE_FACTOR_WALL;
        ball.vx += ball.angularVelocity * SPIN_EFFECT_ON_BOUNCE * Math.abs(incomingVy) * deltaTime;
        ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE;
        canScore = true;
    }

    // Wall Collisions
    if (ball.x + ball.radius > GAME_WIDTH || ball.x - ball.radius < 0) {
        const hitRightWall = ball.x + ball.radius > GAME_WIDTH;
        ball.x = hitRightWall ? GAME_WIDTH - ball.radius : ball.radius;
        // Stop horizontal movement on wall hit? Or bounce? Bounce feels better.
        ball.vx *= -BOUNCE_FACTOR_WALL;
        ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE; // Dampen spin too
    }

    // Hoop Collisions (Keep as is)
    const hoopTopY = hoop.y;
    const hoopBottomY = hoop.y + hoop.rimThickness;
    const hoopCenterX = hoop.x;
    const hoopLeftRimX = hoop.x - hoop.width / 2;
    const hoopRightRimX = hoop.x + hoop.width / 2;
    const backboardLeftX = hoopRightRimX;
    const backboardRightX = backboardLeftX + hoop.backboardWidth;
    const backboardTopY = hoop.y - hoop.backboardHeight / 2 + hoop.rimThickness / 2;
    const backboardBottomY = hoop.y + hoop.backboardHeight / 2 + hoop.rimThickness / 2;

    // 1. Backboard Collision (Keep as is)
    if (ball.x + ball.radius > backboardLeftX &&
        ball.x - ball.radius < backboardRightX &&
        ball.y + ball.radius > backboardTopY &&
        ball.y - ball.radius < backboardBottomY)
    {
        if (ball.vx > 0 && ball.x < backboardRightX) {
            hitRimOrBackboard = true;
            canScore = true;
            ball.x = backboardLeftX - ball.radius;
            const impactRatio = (ball.y - backboardTopY) / hoop.backboardHeight;
            ball.vx *= -BOUNCE_FACTOR_BACKBOARD;
            ball.angularVelocity -= (impactRatio - 0.5) * SPIN_ON_RIM_HIT * 1.5 * deltaTime;
            ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE * 0.95;
        }
    }

    // 2. Rim Collision (Keep as is)
    const checkRimCollision = (rimX) => {
        if (Math.abs(ball.x - rimX) < ball.radius + hoop.rimThickness) {
            if (ball.y > hoopTopY - ball.radius && ball.y < hoopBottomY + ball.radius) {
                const closestX = Math.max(rimX - hoop.rimThickness / 2, Math.min(ball.x, rimX + hoop.rimThickness / 2));
                const closestY = Math.max(hoopTopY, Math.min(ball.y, hoopBottomY));
                const dx = ball.x - closestX;
                const dy = ball.y - closestY;

                if ((dx * dx + dy * dy) < (ball.radius * ball.radius)) {
                    hitRimOrBackboard = true;
                    canScore = true;
                    const incomingVy = ball.vy;

                    if (ball.y < hoopTopY + hoop.rimThickness) { // Hit from above
                        ball.vy *= -BOUNCE_FACTOR_RIM;
                        ball.y = hoopTopY - ball.radius; // Adjust position slightly
                    } else { // Hit from side/below (less common physics needed)
                        // Keep horizontal bounce minimal if hit from side/below
                        // ball.vx *= -BOUNCE_FACTOR_RIM * 0.7; // Maybe remove/reduce this
                        ball.x += (ball.x > hoopCenterX ? 1 : -1) * 1; // Slight push away
                        if(ball.vy > 0) ball.vy *= -0.1; // Nudge up if hit below
                    }

                    // Apply spin based on hit location (Keep as is)
                    const hitOffset = (ball.x - rimX);
                    const spinDirection = (rimX < hoopCenterX) ? 1 : -1;
                    ball.angularVelocity += spinDirection * SPIN_ON_RIM_HIT * (1 - Math.abs(hitOffset) / ball.radius) * deltaTime;
                    // Spin effect on bounce (Keep as is)
                    // ball.vx += ball.angularVelocity * SPIN_EFFECT_ON_BOUNCE * Math.abs(incomingVy) * 0.5 * deltaTime; // Maybe reduce this interaction
                    ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE * 0.9;

                    return true;
                }
            }
        }
        return false;
    };

    checkRimCollision(hoopLeftRimX);
    checkRimCollision(hoopRightRimX);
}


// --- Scoring Logic ---
// (Keep checkScoring function as is)
function checkScoring() {
    const hoopTopY = hoop.y;
    const hoopBottomY = hoop.y + hoop.scoreZoneHeight;
    const hoopLeftRimX = hoop.x - hoop.width / 2;
    const hoopRightRimX = hoop.x + hoop.width / 2;

    if (canScore && ball.vy > 0 &&
        ball.y - ball.radius < hoopBottomY && // Check top edge hasn't passed bottom zone yet
        ball.y + ball.radius > hoopTopY && // Check bottom edge has passed top of rim
        ball.x > hoopLeftRimX && ball.x < hoopRightRimX)
    {
        // More reliable check: Ball center crossed the rim line in this frame
         const prevY = ball.y - ball.vy; // Position in previous frame (approx)
         if (prevY <= hoopTopY + hoop.rimThickness / 2 && ball.y > hoopTopY + hoop.rimThickness / 2) {
             const points = hitRimOrBackboard ? 2 : 3;
             score += points;
             scoreDisplay.textContent = `Score: ${score}`;
             canScore = false;
             triggerNetAnimation();
             // console.log(hitRimOrBackboard ? "Score! (2 points)" : "Swish! (3 points)");
         }
    }

    // Reset canScore if the ball goes significantly above the hoop OR hits ground
    if (!canScore && ball.y < hoop.y - 150) { // Reset higher above hoop
         canScore = true;
    }
    // Also handled in ground collision now
}

function triggerNetAnimation() {
     isNetAnimating = true;
     netAnimationProgress = 0;
 }

// --- Drawing ---
// (Keep drawing functions as is: clearCanvas, drawCourt, drawBall, drawHoop, draw)
function clearCanvas() { ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT); }
function drawCourt() { ctx.fillStyle = '#d2b48c'; ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20); }
function drawBall() { /* ... Keep existing rotation draw code ... */ ctx.save(); ctx.translate(ball.x, ball.y); ctx.rotate(ball.angle); ctx.translate(-ball.x, -ball.y); ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fillStyle = ball.color; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke(); ctx.closePath(); ctx.beginPath(); ctx.moveTo(ball.x, ball.y - ball.radius); ctx.lineTo(ball.x, ball.y + ball.radius); ctx.moveTo(ball.x - ball.radius, ball.y); ctx.lineTo(ball.x + ball.radius, ball.y); ctx.moveTo(ball.x - ball.radius * 0.7, ball.y - ball.radius * 0.7); ctx.bezierCurveTo(ball.x - ball.radius * 0.3, ball.y + ball.radius * 0.1, ball.x + ball.radius * 0.3, ball.y + ball.radius * 0.1, ball.x + ball.radius * 0.7, ball.y - ball.radius * 0.7); ctx.moveTo(ball.x - ball.radius * 0.7, ball.y + ball.radius * 0.7); ctx.bezierCurveTo(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.1, ball.x + ball.radius * 0.3, ball.y - ball.radius * 0.1, ball.x + ball.radius * 0.7, ball.y + ball.radius * 0.7); ctx.strokeStyle = '#00000088'; ctx.lineWidth = 1; ctx.stroke(); ctx.closePath(); ctx.restore(); }
function drawHoop() { /* ... Keep existing hoop and net animation draw code ... */ const hoopTopY=hoop.y; const hoopBottomY=hoop.y+hoop.rimThickness; const hoopLeftRimX=hoop.x-hoop.width/2; const hoopRightRimX=hoop.x+hoop.width/2; const backboardLeftX=hoopRightRimX; const backboardTopY=hoop.y-hoop.backboardHeight/2+hoop.rimThickness/2; ctx.fillStyle=hoop.backboardColor; ctx.fillRect(backboardLeftX,backboardTopY,hoop.backboardWidth,hoop.backboardHeight); ctx.strokeStyle='#999'; ctx.strokeRect(backboardLeftX,backboardTopY,hoop.backboardWidth,hoop.backboardHeight); let netBottomY=hoopBottomY+hoop.netHeight; let netBottomPullX=hoop.width*0.2; if(isNetAnimating){ const animFactor=Math.sin(netAnimationProgress*Math.PI); netBottomPullX+=hoop.width*NET_PULL_X_FACTOR*animFactor; netBottomY+=hoop.netHeight*NET_PULL_Y_FACTOR*animFactor; } const netBottomLeftX=hoopLeftRimX+netBottomPullX; const netBottomRightX=hoopRightRimX-netBottomPullX; ctx.beginPath(); ctx.moveTo(hoopLeftRimX,hoopBottomY); ctx.lineTo(netBottomLeftX,netBottomY); ctx.lineTo(netBottomRightX,netBottomY); ctx.lineTo(hoopRightRimX,hoopBottomY); ctx.strokeStyle=hoop.netColor; ctx.lineWidth=2; ctx.stroke(); for(let i=0.2; i<0.81; i+=0.2){ const bottomX=netBottomLeftX+(netBottomRightX-netBottomLeftX)*(i/0.6-(0.2/0.6)); ctx.moveTo(hoopLeftRimX+hoop.width*i,hoopBottomY); ctx.lineTo(bottomX,netBottomY); ctx.stroke(); } ctx.fillStyle=hoop.rimColor; ctx.fillRect(hoopLeftRimX-hoop.rimThickness/2,hoopTopY,hoop.width+hoop.rimThickness,hoop.rimThickness); ctx.strokeStyle='#a00'; ctx.lineWidth=1; ctx.strokeRect(hoopLeftRimX-hoop.rimThickness/2,hoopTopY,hoop.width+hoop.rimThickness,hoop.rimThickness); }
function draw() { clearCanvas(); drawCourt(); drawHoop(); drawBall(); }

// --- Timer ---
// (Keep startTimer function as is)
function startTimer() { if (timerInterval) clearInterval(timerInterval); timeLeft = GAME_TIME_LIMIT; timerDisplay.textContent = `Time: ${timeLeft}`; timerInterval = setInterval(() => { timeLeft--; timerDisplay.textContent = `Time: ${timeLeft}`; if (timeLeft <= 0 && gameState === 'playing') { endGame(); } }, 1000); }

// --- Game State Control ---
// (Keep startGame and endGame functions largely as is, just ensure flags are reset)
function startGame() {
    if (gameState === 'playing') return;
    // resetGame(); // Called by button click now
    gameState = 'playing';
    startButton.style.display = 'none';
    startButton.disabled = true;
    restartButton.style.display = 'none';
    messageOverlay.style.display = 'none';
    canScore = true;
    hitRimOrBackboard = false;
    isNetAnimating = false;
    justClicked = false; // Reset flag

    startTimer();
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function endGame() {
    if (gameState !== 'playing') return;
    gameState = 'gameOver';
    clearInterval(timerInterval);
    timerInterval = null;
    // isMouseDown = false; // REMOVED
    justClicked = false; // Ensure click flag is off
    finalScoreDisplay.textContent = `Final Score: ${score}`;
    restartButton.style.display = 'block';
}

// --- Event Listeners ---
function handleInteractionStart(event) {
    event.preventDefault();
    if (gameState === 'playing') {
         // Set the flag only, force applied in update loop
         justClicked = true;
     }
}

// We don't need to do anything on interaction end for the tap mechanic
function handleInteractionEnd(event) {
     event.preventDefault();
     // No action needed here now
     // isMouseDown = false; // REMOVED
}

// (Keep event listener assignments as they are)
canvas.addEventListener('mousedown', handleInteractionStart);
canvas.addEventListener('mouseup', handleInteractionEnd); // Keep listener, though function is empty
canvas.addEventListener('mouseleave', handleInteractionEnd); // Keep listener, though function is empty

canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
canvas.addEventListener('touchend', handleInteractionEnd); // Keep listener
canvas.addEventListener('touchcancel', handleInteractionEnd); // Keep listener

startButton.addEventListener('click', () => {
    resetGame();
    startGame();
});

restartButton.addEventListener('click', () => {
     resetGame();
     startGame();
});

// --- Initial Setup ---
initGame();
