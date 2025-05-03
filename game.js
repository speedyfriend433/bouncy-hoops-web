// game.js

// --- Get DOM Elements ---
// It's good practice to get these once at the start
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
const PUSH_FORCE = -9.5;
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
    vx: 4,
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
let isMouseDown = false;
let canScore = true;
let hitRimOrBackboard = false;
let lastTime = 0; // Moved here for broader scope if needed outside loop

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
    // Set container size dynamically via JS if needed, or keep fixed in CSS
    gameContainer.style.width = `${GAME_WIDTH}px`;
    gameContainer.style.height = `${GAME_HEIGHT}px`;
    resetGame();
}

function resetGame() {
    score = 0;
    timeLeft = GAME_TIME_LIMIT;
    gameState = 'start';
    isMouseDown = false;
    canScore = true;
    hitRimOrBackboard = false;
    isNetAnimating = false;
    netAnimationProgress = 0;
    lastTime = 0; // Reset lastTime

    ball.x = GAME_WIDTH / 4;
    ball.y = GAME_HEIGHT / 2;
    ball.vx = 4 + Math.random() * 2;
    ball.vy = 0;
    ball.angle = 0;
    ball.angularVelocity = (Math.random() - 0.5) * 0.1;

    hoop.x = GAME_WIDTH * 0.75;
    hoop.vx = Math.abs(hoop.vx) * (Math.random() > 0.5 ? 1 : -1);

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
    const deltaTime = (timestamp - lastTime) / (1000 / 60); // Normalize to 60 FPS
    lastTime = timestamp;

    if (gameState !== 'playing') {
        clearCanvas();
        drawCourt();
        drawHoop(); // Keep drawing hoop with potential animation ending
        drawBall(); // Keep drawing ball in its final position
        if (isNetAnimating) updateNetAnimation(deltaTime); // Let net animation finish
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
    // Apply Input Force
    if (isMouseDown) {
        ball.vy = PUSH_FORCE;
    }

    // Apply Gravity
    ball.vy += GRAVITY * deltaTime;

    // Update Position
    ball.x += ball.vx * deltaTime;
    ball.y += ball.vy * deltaTime;

    // Update Angle based on Angular Velocity
    ball.angle += ball.angularVelocity * deltaTime;

    // Apply Damping
    ball.vx *= Math.pow(HORIZONTAL_DAMPING, deltaTime);
    ball.angularVelocity *= Math.pow(ANGULAR_DAMPING, deltaTime);

    // Update Hoop Position
    hoop.x += hoop.vx * deltaTime;
    if (hoop.x + hoop.width / 2 > GAME_WIDTH - hoop.backboardWidth || hoop.x - hoop.width / 2 < 0) {
        hoop.vx *= -1;
        hoop.x += hoop.vx * deltaTime; // Prevent sticking
    }

    // Update Net Animation
    if (isNetAnimating) {
        updateNetAnimation(deltaTime);
    }

    // Collision Detection
    hitRimOrBackboard = false; // Reset before checks
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
function handleCollisions(deltaTime) {
    // Ground Collision
    if (ball.y + ball.radius > GAME_HEIGHT) {
        ball.y = GAME_HEIGHT - ball.radius;
        const incomingVy = ball.vy;
        ball.vy *= -BOUNCE_FACTOR_GROUND;
        ball.vx += ball.angularVelocity * SPIN_EFFECT_ON_BOUNCE * Math.abs(incomingVy) * deltaTime;
        ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE;
        ball.vx *= BOUNCE_FACTOR_GROUND;
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
        ball.vx *= -BOUNCE_FACTOR_WALL;
        ball.angularVelocity *= SPIN_DAMPING_ON_BOUNCE;
    }

    // Hoop Collisions
    const hoopTopY = hoop.y;
    const hoopBottomY = hoop.y + hoop.rimThickness;
    const hoopCenterX = hoop.x;
    const hoopLeftRimX = hoop.x - hoop.width / 2;
    const hoopRightRimX = hoop.x + hoop.width / 2;
    const backboardLeftX = hoopRightRimX;
    const backboardRightX = backboardLeftX + hoop.backboardWidth;
    const backboardTopY = hoop.y - hoop.backboardHeight / 2 + hoop.rimThickness / 2;
    const backboardBottomY = hoop.y + hoop.backboardHeight / 2 + hoop.rimThickness / 2;

    // 1. Backboard Collision
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

    // 2. Rim Collision
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

                    if (ball.y < hoopTopY + hoop.rimThickness) {
                        ball.vy *= -BOUNCE_FACTOR_RIM;
                        ball.y = hoopTopY - ball.radius;
                    } else {
                        ball.vx *= -BOUNCE_FACTOR_RIM * 0.7;
                        ball.x += (ball.x > hoopCenterX ? 1 : -1) * 2;
                        if(ball.vy > 0) ball.vy *= -0.1;
                    }

                    const hitOffset = (ball.x - rimX);
                    const spinDirection = (rimX < hoopCenterX) ? 1 : -1;
                    ball.angularVelocity += spinDirection * SPIN_ON_RIM_HIT * (1 - Math.abs(hitOffset) / ball.radius) * deltaTime;
                    ball.vx += ball.angularVelocity * SPIN_EFFECT_ON_BOUNCE * Math.abs(incomingVy) * 0.5 * deltaTime;
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
function checkScoring() {
    const hoopTopY = hoop.y;
    const hoopBottomY = hoop.y + hoop.scoreZoneHeight;
    const hoopLeftRimX = hoop.x - hoop.width / 2;
    const hoopRightRimX = hoop.x + hoop.width / 2;

    if (canScore && ball.vy > 0 &&
        ball.y - ball.radius < hoopBottomY &&
        ball.y + ball.radius > hoopTopY &&
        ball.x > hoopLeftRimX && ball.x < hoopRightRimX)
    {
        const prevY = ball.y - ball.vy; // Simple check based on current velocity
        if (prevY <= hoopTopY + hoop.rimThickness / 2) {
             const points = hitRimOrBackboard ? 2 : 3;
             score += points;
             scoreDisplay.textContent = `Score: ${score}`;
             canScore = false;
             triggerNetAnimation();
             // console.log(hitRimOrBackboard ? "Score! (2 points)" : "Swish! (3 points)");
         }
    }

    if (!canScore && ball.y < hoop.y - 100) {
         canScore = true;
    }
}

function triggerNetAnimation() {
     isNetAnimating = true;
     netAnimationProgress = 0;
 }

// --- Drawing ---
function clearCanvas() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

function drawCourt() {
    ctx.fillStyle = '#d2b48c';
    ctx.fillRect(0, GAME_HEIGHT - 20, GAME_WIDTH, 20);
}

function drawBall() {
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    ctx.translate(-ball.x, -ball.y);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = ball.color;
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.closePath();

     // Draw rotating lines
     ctx.beginPath();
     ctx.moveTo(ball.x, ball.y - ball.radius);
     ctx.lineTo(ball.x, ball.y + ball.radius);
     ctx.moveTo(ball.x - ball.radius, ball.y);
     ctx.lineTo(ball.x + ball.radius, ball.y);
     ctx.moveTo(ball.x - ball.radius * 0.7, ball.y - ball.radius * 0.7);
     ctx.bezierCurveTo(ball.x - ball.radius * 0.3, ball.y + ball.radius * 0.1, ball.x + ball.radius * 0.3, ball.y + ball.radius * 0.1, ball.x + ball.radius * 0.7, ball.y - ball.radius * 0.7);
     ctx.moveTo(ball.x - ball.radius * 0.7, ball.y + ball.radius * 0.7);
     ctx.bezierCurveTo(ball.x - ball.radius * 0.3, ball.y - ball.radius * 0.1, ball.x + ball.radius * 0.3, ball.y - ball.radius * 0.1, ball.x + ball.radius * 0.7, ball.y + ball.radius * 0.7);
     ctx.strokeStyle = '#00000088';
     ctx.lineWidth = 1;
     ctx.stroke();
     ctx.closePath();

    ctx.restore();
}

function drawHoop() {
    const hoopTopY = hoop.y;
    const hoopBottomY = hoop.y + hoop.rimThickness;
    const hoopLeftRimX = hoop.x - hoop.width / 2;
    const hoopRightRimX = hoop.x + hoop.width / 2;

    // Backboard
    const backboardLeftX = hoopRightRimX;
    const backboardTopY = hoop.y - hoop.backboardHeight / 2 + hoop.rimThickness / 2;
     ctx.fillStyle = hoop.backboardColor;
     ctx.fillRect(backboardLeftX, backboardTopY, hoop.backboardWidth, hoop.backboardHeight);
     ctx.strokeStyle = '#999';
     ctx.strokeRect(backboardLeftX, backboardTopY, hoop.backboardWidth, hoop.backboardHeight);

    // Net (with Animation)
    let netBottomY = hoopBottomY + hoop.netHeight;
    let netBottomPullX = hoop.width * 0.2;

    if (isNetAnimating) {
        const animFactor = Math.sin(netAnimationProgress * Math.PI);
        netBottomPullX += hoop.width * NET_PULL_X_FACTOR * animFactor;
        netBottomY += hoop.netHeight * NET_PULL_Y_FACTOR * animFactor;
    }

    const netBottomLeftX = hoopLeftRimX + netBottomPullX;
    const netBottomRightX = hoopRightRimX - netBottomPullX;

    ctx.beginPath();
    ctx.moveTo(hoopLeftRimX, hoopBottomY);
    ctx.lineTo(netBottomLeftX, netBottomY);
    ctx.lineTo(netBottomRightX, netBottomY);
    ctx.lineTo(hoopRightRimX, hoopBottomY);
    ctx.strokeStyle = hoop.netColor;
    ctx.lineWidth = 2;
    ctx.stroke();

     // Vertical net lines
     for(let i = 0.2; i < 0.81; i += 0.2) {
         const bottomX = netBottomLeftX + (netBottomRightX - netBottomLeftX) * (i / 0.6 - (0.2 / 0.6));
         ctx.moveTo(hoopLeftRimX + hoop.width * i, hoopBottomY);
         ctx.lineTo(bottomX, netBottomY);
         ctx.stroke();
     }

    // Rim
    ctx.fillStyle = hoop.rimColor;
    ctx.fillRect(hoopLeftRimX - hoop.rimThickness / 2, hoopTopY, hoop.width + hoop.rimThickness, hoop.rimThickness);
     ctx.strokeStyle = '#a00';
     ctx.lineWidth = 1;
     ctx.strokeRect(hoopLeftRimX - hoop.rimThickness / 2, hoopTopY, hoop.width + hoop.rimThickness, hoop.rimThickness);
}

function draw() {
    clearCanvas();
    drawCourt();
    drawHoop();
    drawBall();
}

// --- Timer ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timeLeft = GAME_TIME_LIMIT;
    timerDisplay.textContent = `Time: ${timeLeft}`;
    timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `Time: ${timeLeft}`;
        if (timeLeft <= 0 && gameState === 'playing') {
            endGame();
        }
    }, 1000);
}

// --- Game State Control ---
function startGame() {
    if (gameState === 'playing') return;
    gameState = 'playing';
    startButton.style.display = 'none';
    startButton.disabled = true;
    restartButton.style.display = 'none';
    messageOverlay.style.display = 'none';
    canScore = true;
    hitRimOrBackboard = false;
    isNetAnimating = false;

    startTimer();
    lastTime = performance.now(); // Reset lastTime for deltaTime
    requestAnimationFrame(gameLoop);
}

function endGame() {
    if (gameState !== 'playing') return;
    gameState = 'gameOver';
    clearInterval(timerInterval);
    timerInterval = null;
    isMouseDown = false;
    finalScoreDisplay.textContent = `Final Score: ${score}`;
    // messageOverlay display handled in gameLoop
    restartButton.style.display = 'block';
}

// --- Event Listeners ---
function handleInteractionStart(event) {
    event.preventDefault();
    if (gameState === 'playing') {
         isMouseDown = true;
     }
}

function handleInteractionEnd(event) {
     event.preventDefault();
     isMouseDown = false;
}

canvas.addEventListener('mousedown', handleInteractionStart);
canvas.addEventListener('mouseup', handleInteractionEnd);
canvas.addEventListener('mouseleave', handleInteractionEnd);

canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
canvas.addEventListener('touchend', handleInteractionEnd);
canvas.addEventListener('touchcancel', handleInteractionEnd);

startButton.addEventListener('click', () => {
    resetGame();
    startGame();
});

restartButton.addEventListener('click', () => {
     resetGame();
     startGame();
});

// --- Initial Setup ---
// Make sure the DOM is ready before initializing
// Since the script is at the end of the body, we can just call initGame directly.
// If the script was in the <head>, we'd wrap this in a DOMContentLoaded listener.
initGame();
