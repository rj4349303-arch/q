/**
 * Qualm AI - Introduction Website Script
 * Interactive micro-animations, glassmorphic modal controls, and video fallback logic
 */

document.addEventListener('DOMContentLoaded', () => {
    initVideoController();
    initInteractions();
});

// Download Modal Handlers
const downloadModal = document.getElementById('download-modal');

function openDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Stop background scrolling
    }
}

function closeDownloadModal() {
    if (downloadModal) {
        downloadModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore scrolling
    }
}

function handleOverlayClick(event) {
    if (event.target === downloadModal) {
        closeDownloadModal();
    }
}

// Download Simulation Toast
function simulateDownload(platform) {
    closeDownloadModal();
    
    // Create custom premium toast message
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%) translateY(50px)';
    toast.style.background = 'rgba(26, 26, 26, 0.9)';
    toast.style.color = '#FDFCF0';
    toast.style.padding = '1rem 2rem';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '500';
    toast.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
    toast.style.backdropFilter = 'blur(10px)';
    toast.style.webkitBackdropFilter = 'blur(10px)';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    toast.style.opacity = '0';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '0.75rem';
    
    toast.innerHTML = `
        <span class="material-symbols-outlined" style="color: #52e590; font-size: 1.2rem;">check_circle</span>
        <span>Initializing download of <strong>${platform}</strong>...</span>
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';
    }, 100);
    
    // Animate out
    setTimeout(() => {
        toast.style.transform = 'translateX(-50%) translateY(30px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 400);
    }, 4000);
}

// Video Playback Controls and Fallback Engine
const heroVideo = document.getElementById('hero-video');
const volumeIcon = document.getElementById('volume-icon');
const volumeToggleBtn = document.getElementById('volume-toggle-btn');

// Alternate premium loop URLs in case the main source gets blocked or is slow
const fallbackVideoUrls = [
    'Untitled%20design.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-flow-of-abstract-white-and-grey-shapes-41571-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-slow-motion-flowing-glowing-particles-background-loop-41584-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41561-large.mp4',
    'https://assets.mixkit.co/videos/preview/mixkit-under-the-sea-abstract-motion-background-41569-large.mp4'
];
let currentVideoIndex = 0;
let videoCheckTimeout;

function initVideoController() {
    if (!heroVideo) return;
    
    // Programmatically enforce muted and looping playback
    heroVideo.muted = true;
    heroVideo.loop = true;
    
    // Try to play the video programmatically
    const playPromise = heroVideo.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('Video autoplay started successfully.');
        }).catch(error => {
            console.warn('Autoplay prevented. Setting up user interaction listeners.');
            
            // Set up listener to play on user interaction
            const playOnInteraction = () => {
                heroVideo.play().then(() => {
                    console.log('Video started playing after user interaction.');
                    cleanupListeners();
                }).catch(err => {
                    console.error('Failed to play video on user interaction:', err);
                });
            };
            
            const events = ['click', 'touchstart', 'keydown', 'mousedown'];
            
            function cleanupListeners() {
                events.forEach(event => {
                    document.removeEventListener(event, playOnInteraction);
                });
            }
            
            events.forEach(event => {
                document.addEventListener(event, playOnInteraction, { once: true });
            });
        });
    }
    
    // Set video check timer. If video does not start playing within 8 seconds, try fallback URLs.
    // Note: Only switch to fallback if the video source has failed to load (readyState < 2).
    // If it is loaded (readyState >= 2) but paused (e.g. due to autoplay restriction), do not discard it.
    videoCheckTimeout = setTimeout(() => {
        if (heroVideo.readyState < 2) {
            console.warn('Primary video source slow to load, switching to next fallback loop.');
            tryNextVideoFallback();
        }
    }, 8000);

    heroVideo.addEventListener('playing', () => {
        clearTimeout(videoCheckTimeout);
    });

    heroVideo.addEventListener('error', () => {
        console.error('Video error encountered, trying next fallback.');
        clearTimeout(videoCheckTimeout);
        tryNextVideoFallback();
    });
}

function tryNextVideoFallback() {
    currentVideoIndex++;
    if (currentVideoIndex < fallbackVideoUrls.length) {
        heroVideo.src = fallbackVideoUrls[currentVideoIndex];
        heroVideo.muted = true;
        heroVideo.loop = true;
        heroVideo.load();
        heroVideo.play().catch(err => {
            console.warn('Playback block or fail for source:', fallbackVideoUrls[currentVideoIndex], err);
            tryNextVideoFallback();
        });
    } else {
        // All video CDNs failed or user is offline: Mount Canvas Particle Fallback
        initCanvasFallback();
    }
}

function toggleVideoMute() {
    if (!heroVideo) return;
    
    heroVideo.muted = !heroVideo.muted;
    if (heroVideo.muted) {
        volumeIcon.textContent = 'volume_off';
        volumeToggleBtn.title = 'Unmute audio';
    } else {
        volumeIcon.textContent = 'volume_up';
        volumeToggleBtn.title = 'Mute audio';
    }
}

// Canvas Particle Visualizer (Premium Failsafe Fallback)
function initCanvasFallback() {
    console.log('Mounting canvas particle fallback visualizer.');
    
    // Hide the video element
    heroVideo.style.display = 'none';
    if (volumeToggleBtn) volumeToggleBtn.style.display = 'none';
    
    // Create canvas
    const videoContainer = document.querySelector('.video-container');
    if (!videoContainer) return;
    
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '1';
    canvas.style.background = 'radial-gradient(circle at center, #272a31 0%, #101216 100%)';
    videoContainer.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    
    // Set resolution
    function resizeCanvas() {
        canvas.width = canvas.offsetWidth * window.devicePixelRatio;
        canvas.height = canvas.offsetHeight * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Particles configuration
    const particles = [];
    const particleCount = 65;
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * (canvas.width / window.devicePixelRatio);
            this.y = Math.random() * (canvas.height / window.devicePixelRatio);
            this.size = Math.random() * 2.5 + 0.5;
            this.speedX = Math.random() * 0.4 - 0.2;
            this.speedY = Math.random() * 0.4 - 0.2;
            this.color = Math.random() > 0.5 ? '#adc7ff' : '#e3b5ff'; // Match accents
            this.alpha = Math.random() * 0.5 + 0.1;
            this.fadeSpeed = Math.random() * 0.005 + 0.002;
            this.pulseDir = Math.random() > 0.5 ? 1 : -1;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            
            // Fade alpha pulsing
            this.alpha += this.fadeSpeed * this.pulseDir;
            if (this.alpha > 0.8 || this.alpha < 0.1) {
                this.pulseDir *= -1;
            }
            
            // Out of bounds reset
            const w = canvas.width / window.devicePixelRatio;
            const h = canvas.height / window.devicePixelRatio;
            if (this.x < 0 || this.x > w || this.y < 0 || this.y > h) {
                this.reset();
            }
        }
        
        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
            ctx.fill();
            ctx.restore();
        }
    }
    
    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }
    
    // Animation loop
    function animate() {
        const w = canvas.width / window.devicePixelRatio;
        const h = canvas.height / window.devicePixelRatio;
        ctx.clearRect(0, 0, w, h);
        
        // Draw connection lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
                if (dist < 85) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        
        // Update and draw particles
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        animationFrameId = requestAnimationFrame(animate);
    }
    
    animate();
    
    // Clean up animation on context change
    return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
    };
}

// Micro-interactions and Parallax Effects
function initInteractions() {
    const videoFrame = document.querySelector('.video-frame-outer');
    
    if (videoFrame && window.innerWidth > 1024) {
        document.addEventListener('mousemove', (e) => {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 45;
            const yAxis = (window.innerHeight / 2 - e.pageY) / 45;
            
            // Limit tilt values
            const tiltX = Math.max(-10, Math.min(10, yAxis));
            const tiltY = Math.max(-10, Math.min(10, -xAxis));
            
            videoFrame.style.transform = `rotateY(${tiltY}deg) rotateX(${tiltX}deg) translateY(-5px)`;
        });
        
        // Reset transform on mouse leave
        document.addEventListener('mouseleave', () => {
            videoFrame.style.transform = `rotateY(0deg) rotateX(0deg) translateY(0)`;
        });
    }
    
    // Smooth scrolling for links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            if (targetId.startsWith('#')) {
                const targetEl = document.querySelector(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
}

// Android QR Modal Controller
const androidModal = document.getElementById('android-modal');

function openAndroidModal() {
    closeDownloadModal();
    if (androidModal) {
        androidModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeAndroidModal() {
    if (androidModal) {
        androidModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function handleAndroidOverlayClick(event) {
    if (event.target === androidModal) {
        closeAndroidModal();
    }
}

function copyAndroidLink() {
    const linkText = document.getElementById('android-link-text').textContent;
    navigator.clipboard.writeText(linkText).then(() => {
        const copyStatus = document.getElementById('copy-status');
        const copyIcon = document.getElementById('copy-icon');
        const copyBox = document.getElementById('link-copy-box');
        
        copyIcon.textContent = 'check';
        copyStatus.style.opacity = '1';
        copyBox.style.borderColor = '#52e590';
        
        setTimeout(() => {
            copyIcon.textContent = 'content_copy';
            copyStatus.style.opacity = '0';
            copyBox.style.borderColor = 'rgba(26, 26, 26, 0.08)';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy link: ', err);
    });
}
