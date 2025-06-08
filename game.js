const board = document.getElementById('game-board');
const scoreDisplay = document.getElementById('score');
const width = 8;
// Şeker görselleri
const candyImages = [
    'red.png',    // kırmızı
    'blue.png',   // mavi
    'yellow.png', // sarı
    'green.png',  // yeşil
    'purple.png', // mor
    'pink.png'    // turuncu/pembe
];
let squares = [];
let score = 0;
let selected = null;
let lastMove = null;
let audioUnlocked = false; // Ses izni kontrolü için değişken

// Artık sabit levels dizisi yok, görevler dinamik olacak
function getLevelConfig(level) {
    // Renk zorluğu: her 5 levelde bir yeni renk açılır
    let colorCount = Math.min(2 + Math.floor((level-1)/5), candyImages.length);
    let activeImages = candyImages.slice(0, colorCount);
    let moves = Math.max(25, 50 - Math.floor(level/2));
    // Görevde kaç renk olacak? Zorluk arttıkça artar
    let minGoalColors = Math.min(1 + Math.floor(level/10), activeImages.length); // 1, 2, 3...
    let maxGoalColors = Math.min(minGoalColors + 1, activeImages.length); // bir üst sınır
    let goalColorCount = Math.floor(Math.random() * (maxGoalColors - minGoalColors + 1)) + minGoalColors;
    // Rastgele görev renkleri seç
    let shuffled = [...activeImages].sort(() => Math.random() - 0.5);
    let goalImages = shuffled.slice(0, goalColorCount);
    let goals = {};
    for (let i = 0; i < goalImages.length; i++) {
        // İlk renkler için daha kolay, sonra daha zor
        let base = 10 + Math.floor(level/2) + i*3;
        goals[goalImages[i]] = base;
    }
    return { moves, goals, activeImages };
}

let currentLevel = parseInt(localStorage.getItem('candy_level') || '1');
let movesLeft = 0;
let colorGoals = {};
let colorProgress = {};

const levelInfo = document.getElementById('level-info');
const movesInfo = document.getElementById('moves-info');
const missionInfo = document.getElementById('mission-info');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalNext = document.getElementById('modal-next');
const modalRetry = document.getElementById('modal-retry');

function createBoard() {
    let config = getLevelConfig(currentLevel);
    let activeImages = config.activeImages || candyImages;
    for (let i = 0; i < width * width; i++) {
        const square = document.createElement('div');
        square.setAttribute('draggable', true);
        square.setAttribute('data-id', i);
        square.classList.add('candy');
        let row = Math.floor(i / width);
        let col = i % width;
        let img = document.createElement('img');
        img.src = getSafeCandyImage(row, col, activeImages);
        img.className = 'candy-img';
        square.appendChild(img);
        board.appendChild(square);
        squares.push(square);
    }
}

function dragStart(e) {
    selected = this;
    this.classList.add('selected');
}
function dragEnd(e) {
    this.classList.remove('selected');
    selected = null;
}
function dragOver(e) {
    e.preventDefault();
}
function dragEnter(e) {
    e.preventDefault();
}
function dragDrop(e) {
    if (!selected) return;
    const fromId = parseInt(selected.getAttribute('data-id'));
    const toId = parseInt(this.getAttribute('data-id'));
    const validMoves = [fromId - 1, fromId + 1, fromId - width, fromId + width];
    if (validMoves.includes(toId) && movesLeft > 0) {
        lastMove = { fromId, toId };
        movesLeft--;
        updateUI();
        playSound('move-sound');
        swapCandiesWithAnimation(fromId, toId, () => checkMatches(true));
    } else {
        lastMove = null;
    }
    selected.classList.remove('selected');
    selected = null;
}

// Kullanıcı ilk etkileşimde ses izni açılır
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const pop = document.getElementById('pop-sound');
    const move = document.getElementById('move-sound');
    if (pop) { pop.muted = true; pop.play().then(()=>{pop.pause(); pop.muted=false;}).catch(()=>{}); }
    if (move) { move.muted = true; move.play().then(()=>{move.pause(); move.muted=false;}).catch(()=>{}); }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function playSound(id) {
    if (!audioUnlocked) return;
    const audio = document.getElementById(id);
    if (audio) {
        audio.currentTime = 0;
        audio.muted = false;
        audio.play().catch((err) => {
            console.error('Ses çalınamıyor:', id, err);
        });
    }
}

// Kullanıcı ilk etkileşimde ses izni açılır
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const pop = document.getElementById('pop-sound');
    const move = document.getElementById('move-sound');
    if (pop) { pop.muted = true; pop.play().then(()=>{pop.pause(); pop.muted=false;}).catch(()=>{}); }
    if (move) { move.muted = true; move.play().then(()=>{move.pause(); move.muted=false;}).catch(()=>{}); }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function checkMatches(isPlayerMove = false) {
    let removed = false;
    let toBeCleared = [];
    // Satır
    for (let row = 0; row < width; row++) {
        for (let col = 0; col < width - 2; col++) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            let img2 = squares[i+1].querySelector('img');
            let img3 = squares[i+2].querySelector('img');
            if (img1 && img2 && img3 && img1.src && img1.src === img2.src && img1.src === img3.src) {
                toBeCleared.push(i, i+1, i+2);
                removed = true;
            }
        }
    }
    // Sütun
    for (let col = 0; col < width; col++) {
        for (let row = 0; row < width - 2; row++) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            let img2 = squares[i+width].querySelector('img');
            let img3 = squares[i+width*2].querySelector('img');
            if (img1 && img2 && img3 && img1.src && img1.src === img2.src && img1.src === img3.src) {
                toBeCleared.push(i, i+width, i+width*2);
                removed = true;
            }
        }
    }
    // Tekrarları kaldır
    toBeCleared = [...new Set(toBeCleared)];
    let popped = false;
    for (let idx of toBeCleared) {
        let img = squares[idx].querySelector('img');
        if (img) {
            // Görev ilerlet
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[idx].classList.add('pop');
            squares[idx].removeChild(img);
            popped = true;
            score++;
        }
    }
    if (popped) playSound('pop-sound');
    scoreDisplay.textContent = score;
    updateUI();
    // --- GÖREV TAMAMLANDI MI KONTROLÜ ---
    if (checkGoals() && modal.style.display !== 'flex') {
        showModal(true);
        return;
    }
    // --- HAMLE YOKSA TAHTAYI KARIŞTIR ---
    if (!removed && !hasPossibleMove() && !checkGoals() && movesLeft > 0) {
        shuffleBoard();
        setTimeout(() => {
            modalTitle.textContent = 'Oyun Karıştırıldı!';
            modalMessage.textContent = 'Hamle kalmadığı için oyun otomatik karıştırıldı.';
            modalNext.style.display = 'none';
            modalRetry.style.display = 'none';
            modal.style.display = 'flex';
            setTimeout(() => { modal.style.display = 'none'; checkMatches(); }, 1200);
        }, 300);
        return;
    }
    if (toBeCleared.length > 0) {
        // Animasyon için 300ms bekle, sonra gravity başlat
        setTimeout(dropCandies, 200);
        return;
    } else if (isPlayerMove && lastMove) {
        // Patlama yoksa hamleyi geri al ama hamle hakkı iade edilmesin
        let fromImg = squares[lastMove.fromId].querySelector('img');
        let toImg = squares[lastMove.toId].querySelector('img');
        if (fromImg && toImg) {
            let temp = fromImg.src;
            fromImg.src = toImg.src;
            toImg.src = temp;
        }
        updateUI();
        lastMove = null;
    } else if (isPlayerMove) {
        if (checkGoals()) {
            showModal(true);
        } else if (movesLeft <= 0) {
            showModal(false);
        }
    } else if (movesLeft <= 0) {
        showModal(false);
    }
}

function isEmptySquare(bg) {
    if (!bg) return true;
    if (bg === '' || bg === 'transparent' || bg === undefined) return true;
    if (bg.replace(/\s/g, '') === 'rgba(0,0,0,0)') return true;
    return false;
}

function dropCandies() {
    let config = getLevelConfig(currentLevel);
    let activeImages = config.activeImages || candyImages;
    for (let col = 0; col < width; col++) {
        let stack = [];
        // 1. Sütundaki mevcut şeker img src'lerini topla (boşları atla)
        for (let row = width - 1; row >= 0; row--) {
            let idx = row * width + col;
            let img = squares[idx].querySelector('img');
            if (img && img.src && img.src !== '' && !img.src.endsWith('/null.png')) {
                stack.push(img.src);
            }
        }
        // 2. Sütunu aşağıdan yukarıya doldur
        for (let row = width - 1; row >= 0; row--) {
            let idx = row * width + col;
            let oldImg = squares[idx].querySelector('img');
            if (oldImg) squares[idx].removeChild(oldImg);
            if (stack.length > 0) {
                let img = document.createElement('img');
                img.className = 'candy-img';
                img.src = stack.shift();
                squares[idx].appendChild(img);
            } else {
                let img = document.createElement('img');
                img.className = 'candy-img';
                img.src = getSafeCandyImage(row, col, activeImages);
                squares[idx].appendChild(img);
            }
        }
    }
    // DOM güncellensin, sonra zincirleme kontrol başlasın
    setTimeout(() => checkMatches(false), 0);
}

function addEventListeners() {
    squares.forEach(square => {
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragend', dragEnd);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('drop', dragDrop);
        // Mobil için sadece swipe (kaydırma) desteği
        square.addEventListener('touchstart', handleTouchStart, { passive: false });
        square.addEventListener('touchend', handleTouchEnd, { passive: false });
        // Sayfa kaymasını engelle
        square.addEventListener('touchmove', function(e) { e.preventDefault(); }, { passive: false });
    });
}

// Mobil kaydırma (swipe) desteği - sadece swipe ile hareket
let swipeStart = null;
let swipeStartId = null;
function handleTouchStart(e) {
    if (e.touches && e.touches.length === 1) {
        swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        swipeStartId = parseInt(this.getAttribute('data-id'));
    }
}
function handleTouchEnd(e) {
    if (!swipeStart || swipeStartId === null) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
        const end = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        const dx = end.x - swipeStart.x;
        const dy = end.y - swipeStart.y;
        let direction = null;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
            direction = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 20) {
            direction = dy > 0 ? 'down' : 'up';
        }
        let fromId = swipeStartId;
        let toId = null;
        if (direction === 'left' && fromId % width > 0) toId = fromId - 1;
        if (direction === 'right' && fromId % width < width - 1) toId = fromId + 1;
        if (direction === 'up' && fromId - width >= 0) toId = fromId - width;
        if (direction === 'down' && fromId + width < width * width) toId = fromId + width;
        if (toId !== null && movesLeft > 0) {
            lastMove = { fromId, toId };
            movesLeft--;
            updateUI();
            playSound('move-sound');
            swapCandiesWithAnimation(fromId, toId, () => checkMatches(true));
        }
    }
    swipeStart = null;
    swipeStartId = null;
}

function startLevel(level) {
    // Sıfırla
    score = 0;
    scoreDisplay.textContent = score;
    let config = getLevelConfig(level);
    movesLeft = config.moves;
    colorGoals = { ...config.goals };
    colorProgress = {};
    for (let color in colorGoals) colorProgress[color] = 0;
    // Tahtayı temizle ve yeniden oluştur
    board.innerHTML = '';
    squares = [];
    createBoard();
    addEventListeners();
    updateUI();
    setTimeout(checkMatches, 500);
}

function getCandyName(img) {
    switch (img) {
        case 'red.png': return 'Kırmızı';
        case 'blue.png': return 'Mavi';
        case 'yellow.png': return 'Sarı';
        case 'green.png': return 'Yeşil';
        case 'purple.png': return 'Mor';
        case 'pink.png': return 'Pembe';
        default: return img;
    }
}

function updateUI() {
    levelInfo.textContent = `Bölüm: ${currentLevel}`;
    movesInfo.textContent = `Kalan Hamle: ${movesLeft}`;
    let mission = 'Görev: ';
    let arr = [];
    for (let img in colorGoals) {
        let name = getCandyName(img);
        arr.push(`<img src="${img}" class="candy-img mission-img">: ${colorProgress[img]}/${colorGoals[img]}`);
    }
    mission += arr.join(', ');
    missionInfo.innerHTML = mission;
    // Hamle bittiğinde kaybetme kontrolü
    if (movesLeft === 0 && !checkGoals() && modal.style.display !== 'flex') {
        showModal(false);
    }
}

function checkGoals() {
    for (let color in colorGoals) {
        if (colorProgress[color] < colorGoals[color]) return false;
    }
    return true;
}

function showModal(success) {
    modal.style.display = 'flex';
    if (success) {
        modalTitle.textContent = 'Tebrikler!';
        modalMessage.textContent = `Bölüm ${currentLevel} tamamlandı!`;
        modalNext.style.display = 'inline-block';
        modalRetry.style.display = 'none';
    } else {
        modalTitle.textContent = 'Başaramadın!';
        modalMessage.textContent = `Görevi tamamlayamadın.`;
        modalNext.style.display = 'none';
        modalRetry.style.display = 'inline-block';
    }
}

modalNext.onclick = () => {
    modal.style.display = 'none';
    currentLevel++;
    localStorage.setItem('candy_level', currentLevel);
    startLevel(currentLevel);
};
modalRetry.onclick = () => {
    modal.style.display = 'none';
    startLevel(currentLevel);
};

// Oyun başlat
startLevel(currentLevel);

function hasPossibleMove() {
    // Yatayda iki aynı görsel yan yana ve üçüncüsü komşuysa
    for (let row = 0; row < width; row++) {
        for (let col = 0; col < width - 1; col++) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            let img2 = squares[i+1].querySelector('img');
            if (img1 && img2 && img1.src && img1.src === img2.src) {
                // Sola veya sağa bak
                if (col > 0) {
                    let img0 = squares[i-1].querySelector('img');
                    if (img0 && img0.src === img1.src) return true;
                }
                if (col < width-2) {
                    let img3 = squares[i+2].querySelector('img');
                    if (img3 && img3.src === img1.src) return true;
                }
                // Yukarı/aşağı bak
                if (row > 0) {
                    let imgUp = squares[i-width].querySelector('img');
                    if (imgUp && imgUp.src === img1.src) return true;
                }
                if (row < width-1) {
                    let imgDown = squares[i+width].querySelector('img');
                    if (imgDown && imgDown.src === img1.src) return true;
                }
            }
        }
    }
    // Dikeyde iki aynı görsel üst üste ve üçüncüsü komşuysa
    for (let col = 0; col < width; col++) {
        for (let row = 0; row < width - 1; row++) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            let img2 = squares[i+width].querySelector('img');
            if (img1 && img2 && img1.src && img1.src === img2.src) {
                // Yukarı veya aşağı bak
                if (row > 0) {
                    let imgUp = squares[i-width].querySelector('img');
                    if (imgUp && imgUp.src === img1.src) return true;
                }
                if (row < width-2) {
                    let imgDown2 = squares[i+width*2].querySelector('img');
                    if (imgDown2 && imgDown2.src === img1.src) return true;
                }
                // Sola/sağa bak
                if (col > 0) {
                    let imgLeft = squares[i-1].querySelector('img');
                    if (imgLeft && imgLeft.src === img1.src) return true;
                }
                if (col < width-1) {
                    let imgRight = squares[i+1].querySelector('img');
                    if (imgRight && imgRight.src === img1.src) return true;
                }
            }
        }
    }
    return false;
}

function shuffleBoard() {
    // Tüm img src'lerini topla
    let imgs = squares.map(sq => {
        let img = sq.querySelector('img');
        return img ? img.src : null;
    });
    // Karıştır
    for (let i = imgs.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
    }
    // Tekrar ata
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'candy-img';
            squares[i].appendChild(img);
        }
        img.src = imgs[i];
    }
    // Eğer hamle yoksa, kullanıcıya "hamle yok, oyun bitti" mesajı göster
    setTimeout(() => {
        if (!hasPossibleMove()) {
            modalTitle.textContent = 'Hamle Yok!';
            modalMessage.textContent = 'Oyun tahtasında hamle kalmadı. Bölümü tekrar başlatabilirsin.';
            modalNext.style.display = 'none';
            modalRetry.style.display = 'inline-block';
            modal.style.display = 'flex';
        }
    }, 200);
}

// Ses izni modalı için butonun çalışmasını sağla
window.addEventListener('DOMContentLoaded', function() {
    const audioModal = document.getElementById('audio-modal');
    const audioAllow = document.getElementById('audio-allow');
    if (audioModal && audioAllow) {
        audioAllow.onclick = function() {
            unlockAudio();
            // Modalı DOM'dan tamamen kaldır
            audioModal.parentNode.removeChild(audioModal);
        };
    }
});

function getSafeCandyImage(row, col, activeImages) {
    let tries = 0;
    while (tries < 10) {
        let img = activeImages[Math.floor(Math.random() * activeImages.length)];
        // Yatayda kontrol
        let left1 = col > 0 ? squares[row * width + (col - 1)]?.querySelector('img')?.src : null;
        let left2 = col > 1 ? squares[row * width + (col - 2)]?.querySelector('img')?.src : null;
        // Dikeyde kontrol
        let up1 = row > 0 ? squares[(row - 1) * width + col]?.querySelector('img')?.src : null;
        let up2 = row > 1 ? squares[(row - 2) * width + col]?.querySelector('img')?.src : null;
        if (!((left1 === img && left2 === img) || (up1 === img && up2 === img))) {
            return img;
        }
        tries++;
    }
    // 10 denemede bulamazsa rastgele döndür
    return activeImages[Math.floor(Math.random() * activeImages.length)];
}

// Swap animasyonlu fonksiyon
function animateSwap(fromId, toId, callback) {
    const fromSquare = squares[fromId];
    const toSquare = squares[toId];
    if (!fromSquare || !toSquare) { callback(); return; }
    const diff = toId - fromId;
    let dirFrom, dirTo;
    if (diff === 1) { dirFrom = 'swap-right'; dirTo = 'swap-left'; }
    else if (diff === -1) { dirFrom = 'swap-left'; dirTo = 'swap-right'; }
    else if (diff === width) { dirFrom = 'swap-down'; dirTo = 'swap-up'; }
    else if (diff === -width) { dirFrom = 'swap-up'; dirTo = 'swap-down'; }
    else { callback(); return; }
    fromSquare.classList.add(dirFrom);
    toSquare.classList.add(dirTo);
    let finished = 0;
    function onAnimEnd(e) {
        finished++;
        this.classList.remove(dirFrom, dirTo);
        this.removeEventListener('animationend', onAnimEnd);
        if (finished === 2) callback();
    }
    fromSquare.addEventListener('animationend', onAnimEnd);
    toSquare.addEventListener('animationend', onAnimEnd);
}

// Drag & Drop ve Swipe işlemlerinde swap kodunu değiştir:
function swapCandiesWithAnimation(fromId, toId, afterSwap) {
    animateSwap(fromId, toId, () => {
        let fromImg = squares[fromId].querySelector('img');
        let toImg = squares[toId].querySelector('img');
        if (fromImg && toImg) {
            let temp = fromImg.src;
            fromImg.src = toImg.src;
            toImg.src = temp;
        }
        if (afterSwap) afterSwap();
    });
}

// Drag & Drop
function dragDrop(e) {
    if (!selected) return;
    const fromId = parseInt(selected.getAttribute('data-id'));
    const toId = parseInt(this.getAttribute('data-id'));
    const validMoves = [fromId - 1, fromId + 1, fromId - width, fromId + width];
    if (validMoves.includes(toId) && movesLeft > 0) {
        lastMove = { fromId, toId };
        movesLeft--;
        updateUI();
        playSound('move-sound');
        swapCandiesWithAnimation(fromId, toId, () => checkMatches(true));
    } else {
        lastMove = null;
    }
    selected.classList.remove('selected');
    selected = null;
}

// Mobil swipe
function handleTouchEnd(e) {
    if (!swipeStart || swipeStartId === null) return;
    if (e.changedTouches && e.changedTouches.length === 1) {
        const end = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        const dx = end.x - swipeStart.x;
        const dy = end.y - swipeStart.y;
        let direction = null;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) {
            direction = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 20) {
            direction = dy > 0 ? 'down' : 'up';
        }
        let fromId = swipeStartId;
        let toId = null;
        if (direction === 'left' && fromId % width > 0) toId = fromId - 1;
        if (direction === 'right' && fromId % width < width - 1) toId = fromId + 1;
        if (direction === 'up' && fromId - width >= 0) toId = fromId - width;
        if (direction === 'down' && fromId + width < width * width) toId = fromId + width;
        if (toId !== null && movesLeft > 0) {
            lastMove = { fromId, toId };
            movesLeft--;
            updateUI();
            playSound('move-sound');
            swapCandiesWithAnimation(fromId, toId, () => checkMatches(true));
        }
    }
    swipeStart = null;
    swipeStartId = null;
}
