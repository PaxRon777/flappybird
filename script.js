const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Handle dynamic resizing to fill the screen correctly
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game constants
const GRAVITY = 0.12; // Slightly slower fall
const JUMP = -3.8;
const PIPE_SPEED = 2.5;
const PIPE_SPAWN_RATE = 250; 
const PIPE_WIDTH = 120;       
const PIPE_GAP = 240;         

// Game state
let birdY = canvas.height / 2;
let birdVelocity = 0;
let pipes = [];
let frameCount = 0;
let score = 0;
let highScore = localStorage.getItem('flappyHighScore') || 0;
let lastScoreTime = Date.now();
let gameOver = false;
let gameStarted = false;
let gameStartTime = 0;

// Stars State
const stars = [];
function initStars() {
    stars.length = 0;
    for (let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: (Math.random() - 0.5) * 0.5
        });
    }
}
initStars();

// Plexus Particle System
let particles = [];
class Particle {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 1;
        // Start with zero velocity to ensure they only move via parallax and interaction
        this.speedX = 0;
        this.speedY = 0;
    }

    update(birdX, birdY) {
        const dx = birdX - this.x;
        const dy = birdY - this.y;
        const distance = Math.sqrt(dx*dx + dy*dy);

        let interactionVX = 0;
        let interactionVY = 0;

        if (distance < 300) { // Attraction radius
            interactionVX = dx / distance * 0.1;
            interactionVY = dy / distance * 0.05;
        } else {
            // Repulsion/Tearing away logic - very subtle to keep the parallax feel
            interactionVX = -dx / distance * 0.03;
            interactionVY = -dy / distance * 0.02;
        }

        // Apply interaction and heavy damping to prevent "floating" off-screen
        this.speedX += interactionVX;
        this.speedY += interactionVY;
        
        // High damping (0.85) ensures they don't keep moving after the bird passes
        this.speedX *= 0.85;
        this.speedY *= 0.85;

        // Clamp velocities to prevent extreme floating
        this.speedX = Math.max(-2, Math.min(2, this.speedX));
        this.speedY = Math.max(-2, Math.min(2, this.speedY));

        // Movement: Parallax (constant left drift of 0.6) + Interaction Velocity
        this.x += (this.speedX - 0.6); 
        this.y += this.speedY;
        // Robust Wrapping
        if (this.x < 0) {
            this.x = canvas.width;
        } else if (this.x > canvas.width) {
            this.x = 0;
        }
        if (this.y < 0) {
            this.y = canvas.height;
        } else if (this.y > canvas.height) {
            this.y = 0;
        }
    }

    draw(ctx) {
        ctx.fillStyle = 'rgba(112, 0, 255, 0.8)'; // Purple from your snippet
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initPlexus() {
    particles = [];
    for (let i = 0; i < 100; i++) {
        particles.push(new Particle());
    }
}
initPlexus();

let birdX = canvas.width * 0.2; // Move player slightly right from left edge

function drawBird() {
    ctx.save();
    ctx.translate(birdX, birdY);
    
    // Draw Spaceship Body (2x bigger)
    ctx.fillStyle = '#e5e7eb'; // Light gray/white
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-30, -20);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-30, 20);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Draw Window/Cockpit (2x bigger)
    ctx.fillStyle = '#3b82f6'; // Blue
    ctx.beginPath();
    ctx.arc(-10, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Engine Fire (only if moving up or just jumped)
    if (birdVelocity < 0) {
        ctx.fillStyle = 'orange';
        for(let i=0; i<5; i++) { // More fire particles for bigger ship
            const fireSize = Math.random() * 16 + 4;
            ctx.beginPath();
            ctx.arc(-36 - (Math.random()*10), Math.random()*8, fireSize, 0, Math.PI*2);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawPipes() {
    const time = Date.now() * 0.002; // Speed of pulsation
    // Pulsate alpha between 0.4 and 0.8 for a "breathing" effect
    const pulseAlpha = 0.6 + Math.sin(time) * 0.2;
    const pipeColor = `rgba(112, 0, 255, ${pulseAlpha})`;

    pipes.forEach(pipe => {
        // Top pipe
        ctx.fillStyle = pipeColor;
        ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.top);
        
        // Glow effect for top pipe
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(112, 0, 255, ${pulseAlpha})`;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, pipe.top);

        // Sci-fi pattern (horizontal lines)
        ctx.beginPath();
        for (let y = 10; y < pipe.top; y += 30) {
            ctx.moveTo(pipe.x, y);
            ctx.lineTo(pipe.x + PIPE_WIDTH, y);
        }
        ctx.stroke();

        // Bottom pipe
        ctx.fillStyle = pipeColor;
        ctx.fillRect(pipe.x, pipe.top + PIPE_GAP, PIPE_WIDTH, canvas.height);
        
        // Glow effect for bottom pipe
        ctx.shadowBlur = 15;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(pipe.x, pipe.top + PIPE_GAP, PIPE_WIDTH, canvas.height);

        // Sci-fi pattern (horizontal lines)
        ctx.beginPath();
        for (let y = pipe.top + PIPE_GAP + 10; y < canvas.height; y += 30) {
            ctx.moveTo(pipe.x, y);
            ctx.lineTo(pipe.x + PIPE_WIDTH, y);
        }
        ctx.stroke();
    });
    // Reset shadow for other elements
    ctx.shadowBlur = 0;
}

function update() {
    if (!gameStarted || gameOver) return;

    // Calculate dynamic speed first so it can be used for both spawning and movement
    let currentPipeSpeed = PIPE_SPEED;
    const timeElapsedSeconds = (Date.now() - gameStartTime) / 1000;
    currentPipeSpeed += timeElapsedSeconds * 0.05;
    if (timeElapsedSeconds >= 60) {
        currentPipeSpeed = Math.max(currentPipeSpeed, PIPE_SPEED * 2);
    }

    birdVelocity += GRAVITY;
    birdY += birdVelocity;

    // Collision with floor or ceiling
    const birdSize = canvas.height * 0.03;
    if (birdY + birdSize > canvas.height || birdY - birdSize < 0) {
        gameOver = true;
    }

    // Time-based scoring (+1 every second)
    if (Date.now() - lastScoreTime > 1000) {
        score++;
        lastScoreTime = Date.now();
    }

    // Pipe logic with dynamic spawn rate to maintain constant distance
    const baseDistance = 800; // Increased from 625 for more spacing
    const dynamicSpawnRate = Math.max(1, Math.floor(baseDistance / currentPipeSpeed));

    if (frameCount % dynamicSpawnRate === 0) {
        let minPipeTop = 150;
        let maxPipeTop = canvas.height - PIPE_GAP - 150;
        let topHeight = Math.floor(Math.random() * (maxPipeTop - minPipeTop + 1)) + minPipeTop;
        pipes.push({ x: canvas.width, top: topHeight });
    }

    // Update Stars
    stars.forEach(star => {
        star.x += star.speed;
        if (star.x > canvas.width) star.x = 0;
        if (star.x < 0) star.x = canvas.width;
    });

    // Update Plexus Particles
    particles.forEach(p => p.update(birdX, birdY));

    let nextPipes = [];
    pipes.forEach((pipe) => {
        pipe.x -= currentPipeSpeed;
        // Collision detection - Rectangular hitbox matching the spaceship graphic dimensions
        const birdWidth = 60;  // Matches drawing from -30 to 30
        const birdHeight = 40; // Matches drawing from -20 to 20
        if (
            birdX + birdWidth / 2 > pipe.x && 
            birdX - birdWidth / 2 < pipe.x + PIPE_WIDTH &&
            (birdY - birdHeight / 2 < pipe.top || birdY + birdHeight / 2 > pipe.top + PIPE_GAP)
        ) {
            gameOver = true;
        }

        // Score increment for passing pipes (using a range check to avoid precision issues with ===)
        if (!pipe.passed && pipe.x + PIPE_WIDTH < birdX) {
            score++;
            pipe.passed = true;
        }

        // Keep pipes that are still on screen
        if (pipe.x + PIPE_WIDTH > 0) {
            nextPipes.push(pipe);
        }
    });
    pipes = nextPipes;

    // High score check
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyHighScore', highScore);
    }

    frameCount++;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Stars
    ctx.fillStyle = 'white';
    stars.forEach(star => {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Plexus Particles and Lines
    for (let i = 0; i < particles.length; i++) {
        particles[i].draw(ctx);

        for (let j = i + 1; j < particles.length; j++) {
            const p1 = particles[i];
            const p2 = particles[j];
            const dx = p1.x - p2.x;
            const dy = p1.y - p2.y;
            const distance = Math.sqrt(dx*dx + dy*dy);

            if (distance < 150) {
                ctx.strokeStyle = `rgba(112, 0, 255, ${1 - distance/150})`; // Color from your snippet
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }

    drawPipes();
    drawBird();

    // Update score in the DOM
    if (gameStarted && !gameOver) {
        const currentScoreEl = document.getElementById('currentScore');
        if (currentScoreEl) currentScoreEl.innerText = score;
    } else if (gameOver) {
        const currentScoreEl = document.getElementById('currentScore');
        if (currentScoreEl) currentScoreEl.innerText = score;
    }

    // Update high score in the DOM
    const highScoreEl = document.getElementById('highScore');
    if (highScoreEl) highScoreEl.innerText = highScore;

    if (!gameStarted) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = `${canvas.height * 0.06}px Arial`;
        ctx.fillText('FLAPPY BIRD CLONE', canvas.width / 2, canvas.height / 2 - (canvas.height * 0.1));
        ctx.font = `${canvas.height * 0.04}px Arial`;
        ctx.fillText('Press ENTER to Start', canvas.width / 2, canvas.height / 2 + (canvas.height * 0.05));
    } else if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = `${canvas.height * 0.06}px Arial`;
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        ctx.font = `${canvas.height * 0.04}px Arial`;
        ctx.fillText(`Final Score: ${score}`, canvas.width / 2, canvas.height / 2 + (canvas.height * 0.1));
        ctx.fillText('Press ENTER to Restart', canvas.width / 2, canvas.height / 2 + (canvas.height * 0.2));
    }

    update();
    requestAnimationFrame(draw);
}

// Input handling
window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter') {
        if (!gameStarted) {
            gameStarted = true;
            birdY = canvas.height / 2;
            birdVelocity = 0;
            pipes = [];
            frameCount = 0;
            score = 0;
            lastScoreTime = Date.now();
            gameOver = false;
            gameStartTime = Date.now(); // Initialize start time
            initPlexus(); // Reset plexus on start
        } else if (gameOver) {
            birdY = canvas.height / 2;
            birdVelocity = 0;
            pipes = [];
            frameCount = 0;
            score = 0;
            lastScoreTime = Date.now();
            gameStartTime = Date.now(); // Initialize start time
            gameOver = false;
            initPlexus(); // Reset plexus on restart
        }
    } else if (e.code === 'Space') {
        if (gameStarted && !gameOver) {
            birdVelocity = JUMP;
        }
    }
});

canvas.addEventListener('mousedown', () => {
    if (gameStarted && !gameOver) {
        birdVelocity = JUMP;
    } else if (gameOver) {
        birdY = canvas.height / 2;
        birdVelocity = 0;
        pipes = [];
        frameCount = 0;
        score = 0;
        lastScoreTime = Date.now();
        gameStartTime = Date.now(); // Initialize start time
        gameOver = false;
        initPlexus(); // Reset plexus on restart
    }
});

draw();
