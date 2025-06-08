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
// Zincirleme özel şeker patlatma sayaçları
let chainPopped = null;
let specialCounter = 0; // Özel şeker sayacı

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
        swapCandiesWithAnimation(fromId, toId, () => {
            let fromImg = squares[fromId].querySelector('img');
            let toImg = squares[toId].querySelector('img');
            // Palette + Bomb kombinasyonu
            if ((fromImg && toImg) && ((fromImg.src.includes('palette.png') && toImg.src.includes('bomb.png')) || (fromImg.src.includes('bomb.png') && toImg.src.includes('palette.png')))) {
                squares[fromId].removeChild(fromImg);
                squares[toId].removeChild(toImg);
                triggerPaletteBombCombo(fromId);
                return;
            }
            // Palette + normal şeker kombinasyonu
            if ((fromImg && toImg) && ((fromImg.src.includes('palette.png') && !toImg.src.includes('bomb.png') && !toImg.src.includes('firework.png') && !toImg.src.includes('palette.png')))) {
                let colorSrc = toImg.src;
                squares[fromId].removeChild(fromImg);
                squares[toId].removeChild(toImg);
                triggerPaletteColorCombo(colorSrc);
                return;
            }
            if ((fromImg && toImg) && ((toImg.src.includes('palette.png') && !fromImg.src.includes('bomb.png') && !fromImg.src.includes('firework.png') && !fromImg.src.includes('palette.png')))) {
                let colorSrc = fromImg.src;
                squares[fromId].removeChild(fromImg);
                squares[toId].removeChild(toImg);
                triggerPaletteColorCombo(colorSrc);
                return;
            }
            // Palette + Firework kombinasyonu
            if ((fromImg && toImg) && ((fromImg.src.includes('palette.png') && toImg.src.includes('firework.png')) || (fromImg.src.includes('firework.png') && toImg.src.includes('palette.png')))) {
                squares[fromId].removeChild(fromImg);
                squares[toId].removeChild(toImg);
                triggerPaletteFireworkCombo(fromId);
                return;
            }
            // Swap sonrası bomb ve firework kombinasyon kontrolü
            const isFromBomb = fromImg && fromImg.src.includes('bomb.png');
            const isFromFirework = fromImg && fromImg.src.includes('firework.png');
            const isToBomb = toImg && toImg.src.includes('bomb.png');
            const isToFirework = toImg && toImg.src.includes('firework.png');
            if ((isFromBomb && isToFirework) || (isFromFirework && isToBomb)) {
                squares[fromId].removeChild(fromImg);
                squares[toId].removeChild(toImg);
                triggerBombFireworkCombo(fromId);
                return;
            }
            if (isFromBomb) {
                squares[fromId].removeChild(fromImg);
                triggerBomb(fromId);
                return;
            } else if (isFromFirework) {
                squares[fromId].removeChild(fromImg);
                triggerFirework(fromId);
                return;
            } else if (isToBomb) {
                squares[toId].removeChild(toImg);
                triggerBomb(toId);
                return;
            } else if (isToFirework) {
                squares[toId].removeChild(toImg);
                triggerFirework(toId);
                return;
            }
            checkMatches(true);
        });
    } else {
        lastMove = null;
        // Başarısız hamle sonrası da hint timer başlat, ancak hamle hakkı varsa
        if (movesLeft > 0) {
            startHintTimer();
        }
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
    if (pop) {
        pop.muted = true;
        pop.play().catch(()=>{}).finally(()=>{ pop.muted = false; });
    }
    if (move) {
        move.muted = true;
        move.play().catch(()=>{}).finally(()=>{ move.muted = false; });
    }
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
    if (pop) {
        pop.muted = true;
        pop.play().catch(()=>{}).finally(()=>{ pop.muted = false; });
    }
    if (move) {
        move.muted = true;
        move.play().catch(()=>{}).finally(()=>{ move.muted = false; });
    }
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

function checkMatches(isPlayerMove = false) {
    let removed = false;
    let toBeCleared = [];
    let specialsToCreate = [];
    let matchGroups = [];
    // Satır
    for (let row = 0; row < width; row++) {
        let col = 0;
        while (col < width) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            if (!img1) { col++; continue; }
            let match = [i];
            for (let k = 1; col + k < width; k++) {
                let imgk = squares[i + k].querySelector('img');
                if (imgk && imgk.src === img1.src) match.push(i + k);
                else break;
            }
            if (match.length >= 3) {
                matchGroups.push([...match]);
                toBeCleared.push(...match);
                removed = true;
            }
            col += match.length > 1 ? match.length : 1;
        }
    }
    // Sütun
    for (let col = 0; col < width; col++) {
        let row = 0;
        while (row < width) {
            let i = row * width + col;
            let img1 = squares[i].querySelector('img');
            if (!img1) { row++; continue; }
            let match = [i];
            for (let k = 1; row + k < width; k++) {
                let imgk = squares[i + k * width].querySelector('img');
                if (imgk && imgk.src === img1.src) match.push(i + k * width);
                else break;
            }
            if (match.length >= 3) {
                matchGroups.push([...match]);
                toBeCleared.push(...match);
                removed = true;
            }
            row += match.length > 1 ? match.length : 1;
        }
    }
    // Kümeleri birleştir (L ve T için)
    let mergedGroups = [];
    let used = Array(matchGroups.length).fill(false);
    for (let i = 0; i < matchGroups.length; i++) {
        if (used[i]) continue;
        let group = new Set(matchGroups[i]);
        used[i] = true;
        let changed = true;
        while (changed) {
            changed = false;
            for (let j = 0; j < matchGroups.length; j++) {
                if (used[j]) continue;
                if (matchGroups[j].some(idx => group.has(idx))) {
                    matchGroups[j].forEach(idx => group.add(idx));
                    used[j] = true;
                    changed = true;
                }
            }
        }
        mergedGroups.push([...group]);
    }
    // Özel şekerleri oluştur
    let specialsPlaced = {};
    for (let group of mergedGroups) {
        if (group.length === 4) {
            // firework: ortadaki veya 2. kareye
            specialsPlaced[group[1]] = { pos: group[1], type: 'firework' };
        }
        if (group.length >= 5) {
            // bomb: ortadaki veya ilk kareye
            specialsPlaced[group[Math.floor(group.length/2)]] = { pos: group[Math.floor(group.length/2)], type: 'bomb' };
        }
    }
    // Tekrarları kaldır
    toBeCleared = [...new Set(toBeCleared)];
    let popped = false;
    for (let idx of toBeCleared) {
        let img = squares[idx].querySelector('img');
        if (img) {
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[idx].classList.add('pop');
            squares[idx].removeChild(img);
            popped = true;
            score++;
        }
    }
    // Özel şekerleri yerleştir
    for (let pos in specialsPlaced) {
        let s = specialsPlaced[pos];
        let square = squares[parseInt(pos)];
        if (square && !square.querySelector('img')) {
            let specialImg = createSpecialCandy(s.type);
            square.appendChild(specialImg);
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
        setTimeout(dropCandies, 200);
        return;
    } else if (isPlayerMove && lastMove) {
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
        } else {
            startHintTimer();
        }
    } else if (movesLeft <= 0) {
        showModal(false);
    }
}

// --- Bomb tetikleyici ---
function triggerBomb(index) {
    const row = Math.floor(index / width);
    const col = index % width;
    let popped = false;
    if (chainPopped === null) chainPopped = { bomb: 0, firework: 0 };
    chainPopped.bomb++;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            let r = row + dr;
            let c = col + dc;
            if (r >= 0 && r < width && c >= 0 && c < width) {
                let idx = r * width + c;
                let img = squares[idx].querySelector('img');
                if (img) {
                    // Palette varsa patlatma (sadece swipe ile patlar)
                    if (img.src.includes('palette.png')) continue;
                    // Chain reaction: bomb veya firework tetikle
                    if (img.src.includes('bomb.png')) {
                        squares[idx].removeChild(img);
                        triggerBomb(idx);
                        popped = true;
                        continue;
                    } else if (img.src.includes('firework.png')) {
                        squares[idx].removeChild(img);
                        triggerFirework(idx);
                        popped = true;
                        continue;
                    }
                    let imgName = img.src.split('/').pop();
                    if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
                    squares[idx].classList.add('pop');
                    squares[idx].removeChild(img);
                    score++;
                    popped = true;
                }
            }
        }
    }
    if (popped) {
        playSound('bomb-sound');
        specialCounter++;
        updateSpecialCounterUI();
        if (specialCounter % 5 === 0) createPaletteCandy();
    }
    scoreDisplay.textContent = score;
    updateUI();
    setTimeout(dropCandies, 200);
}

// --- Firework tetikleyici ---
function triggerFirework(index) {
    const row = Math.floor(index / width);
    const col = index % width;
    let popped = false;
    if (chainPopped === null) chainPopped = { bomb: 0, firework: 0 };
    chainPopped.firework++;
    // Row
    for (let c = 0; c < width; c++) {
        let idx = row * width + c;
        let img = squares[idx].querySelector('img');
        if (img) {
            // Palette varsa patlatma (sadece swipe ile patlar)
            if (img.src.includes('palette.png')) continue;
            if (img.src.includes('bomb.png')) {
                squares[idx].removeChild(img);
                triggerBomb(idx);
                popped = true;
                continue;
            } else if (img.src.includes('firework.png')) {
                squares[idx].removeChild(img);
                triggerFirework(idx);
                popped = true;
                continue;
            }
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[idx].classList.add('pop');
            squares[idx].removeChild(img);
            score++;
            popped = true;
        }
    }
    // Column
    for (let r = 0; r < width; r++) {
        let idx = r * width + col;
        let img = squares[idx].querySelector('img');
        if (img) {
            // Palette varsa patlatma (sadece swipe ile patlar)
            if (img.src.includes('palette.png')) continue;
            if (img.src.includes('bomb.png')) {
                squares[idx].removeChild(img);
                triggerBomb(idx);
                popped = true;
                continue;
            } else if (img.src.includes('firework.png')) {
                squares[idx].removeChild(img);
                triggerFirework(idx);
                popped = true;
                continue;
            }
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[idx].classList.add('pop');
            squares[idx].removeChild(img);
            score++;
            popped = true;
        }
    }
    if (popped) {
        playSound('firework-sound');
        specialCounter++;
        updateSpecialCounterUI();
        if (specialCounter % 5 === 0) createPaletteCandy();
    }
    scoreDisplay.textContent = score;
    updateUI();
    setTimeout(dropCandies, 200);
}

// --- Bomb + Firework kombinasyonu tetikleyici ---
function triggerBombFireworkCombo(index) {
    const row = Math.floor(index / width);
    const col = index % width;
    let popped = false;
    // 3 satır (row-1, row, row+1)
    for (let r = Math.max(0, row - 1); r <= Math.min(width - 1, row + 1); r++) {
        for (let c = 0; c < width; c++) {
            let idx = r * width + c;
            let img = squares[idx].querySelector('img');
            if (img) {
                // Palette varsa patlatma (sadece swipe ile patlar)
                if (img.src.includes('palette.png')) continue;
                let imgName = img.src.split('/').pop();
                if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
                squares[idx].classList.add('pop');
                squares[idx].removeChild(img);
                score++;
                popped = true;
            }
        }
    }
    // 3 sütun (col-1, col, col+1), satırlar zaten patlatıldıysa tekrar patlatma
    for (let c = Math.max(0, col - 1); c <= Math.min(width - 1, col + 1); c++) {
        for (let r = 0; r < width; r++) {
            if (r >= row - 1 && r <= row + 1) continue;
            let idx = r * width + c;
            let img = squares[idx].querySelector('img');
            if (img) {
                // Palette varsa patlatma (sadece swipe ile patlar)
                if (img.src.includes('palette.png')) continue;
                let imgName = img.src.split('/').pop();
                if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
                squares[idx].classList.add('pop');
                squares[idx].removeChild(img);
                score++;
                popped = true;
            }
        }
    }
    if (popped) playSound('pop-sound');
    scoreDisplay.textContent = score;
    updateUI();
    setTimeout(dropCandies, 200);
}

// --- Özel şeker oluşturucu ---
function createSpecialCandy(type) {
    let img = document.createElement('img');
    img.className = 'candy-img';
    if (type === 'bomb') img.src = 'bomb.png';
    else if (type === 'firework') img.src = 'firework.png';
    return img;
}

function createPaletteCandy() {
    // Boardda zaten palette varsa tekrar oluşturma
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (img && img.src.includes('palette.png')) return;
    }
    // Rastgele bir kutu seç, boşsa veya özel şeker değilse palette ekle
    let candidates = [];
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (img && !img.src.includes('bomb.png') && !img.src.includes('firework.png') && !img.src.includes('palette.png')) {
            candidates.push(i);
        }
    }
    if (candidates.length === 0) return;
    let idx = candidates[Math.floor(Math.random() * candidates.length)];
    let square = squares[idx];
    if (square) {
        let oldImg = square.querySelector('img');
        if (oldImg) square.removeChild(oldImg);
        let paletteImg = document.createElement('img');
        paletteImg.src = 'palette.png';
        paletteImg.className = 'candy-img';
        square.appendChild(paletteImg);
    }
}

function getSafeCandyImage(row, col, activeImages) {
    if (!activeImages || activeImages.length === 0) return candyImages[0];
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
    // 10 denemede bulamazsa rastgele döndür (asla null dönmesin)
    return activeImages[0] || candyImages[0];
}

// --- Tahtada hamle var mı kontrolü (shuffle için) ---
function hasPossibleMove() {
    // Sadece normal şekerler arasında swap ile 3'lü eşleşme olur mu?
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (!img || img.src.includes('bomb.png') || img.src.includes('firework.png') || img.src.includes('palette.png')) continue;
        let row = Math.floor(i / width);
        let col = i % width;
        // Sağ ile swap
        if (col < width - 1) {
            let j = i + 1;
            let img2 = squares[j].querySelector('img');
            if (img2 && !img2.src.includes('bomb.png') && !img2.src.includes('firework.png') && !img2.src.includes('palette.png')) {
                if (wouldMatch(i, j)) return true;
            }
        }
        // Aşağı ile swap
        if (row < width - 1) {
            let j = i + width;
            let img2 = squares[j].querySelector('img');
            if (img2 && !img2.src.includes('bomb.png') && !img2.src.includes('firework.png') && !img2.src.includes('palette.png')) {
                if (wouldMatch(i, j)) return true;
            }
        }
    }
    return false;
}
// Swap sonrası 3'lü eşleşme olur mu?
function wouldMatch(i, j) {
    // Swap et, kontrol et, geri al
    let img1 = squares[i].querySelector('img');
    let img2 = squares[j].querySelector('img');
    if (!img1 || !img2) return false;
    let temp = img1.src;
    img1.src = img2.src;
    img2.src = temp;
    let result = isMatchAt(i) || isMatchAt(j);
    img2.src = img1.src;
    img1.src = temp;
    return result;
}
// Bir karede 3'lü eşleşme var mı?
function isMatchAt(idx) {
    let img = squares[idx].querySelector('img');
    if (!img) return false;
    let src = img.src;
    let row = Math.floor(idx / width);
    let col = idx % width;
    // Yatay
    let count = 1;
    for (let d = 1; col - d >= 0; d++) {
        let img2 = squares[row * width + (col - d)].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    for (let d = 1; col + d < width; d++) {
        let img2 = squares[row * width + (col + d)].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    if (count >= 3) return true;
    // Dikey
    count = 1;
    for (let d = 1; row - d >= 0; d++) {
        let img2 = squares[(row - d) * width + col].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    for (let d = 1; row + d < width; d++) {
        let img2 = squares[(row + d) * width + col].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    if (count >= 3) return true;
    return false;
}

// Oyun tahtasındaki karelere drag & drop ve mobil swipe eventlerini ekler
function addEventListeners() {
    for (let i = 0; i < squares.length; i++) {
        const square = squares[i];
        // Drag & Drop (masaüstü)
        square.addEventListener('dragstart', dragStart);
        square.addEventListener('dragend', dragEnd);
        square.addEventListener('dragover', dragOver);
        square.addEventListener('dragenter', dragEnter);
        square.addEventListener('drop', dragDrop);
        // Mobil swipe
        square.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                swipeStartId = i;
                e.preventDefault();
            }
        }, { passive: false });
        square.addEventListener('touchend', function(e) {
            handleTouchEnd(e, i);
        });
        // Masaüstü tıklama ile özel şeker patlatma
        square.addEventListener('click', function(e) {
            const img = square.querySelector('img');
            if (!img) return;
            if (img.src.includes('bomb.png')) {
                squares[i].removeChild(img);
                triggerBomb(i);
            } else if (img.src.includes('firework.png')) {
                squares[i].removeChild(img);
                triggerFirework(i);
            }
        });
    }
}

let swipeStart = null;
let swipeStartId = null;

function handleTouchEnd(e, idx) {
    if (swipeStart !== null && swipeStartId !== null) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - swipeStart.x;
        const dy = touch.clientY - swipeStart.y;
        const SWIPE_THRESHOLD = 30;
        const TAP_THRESHOLD = 10;
        let direction = null;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > SWIPE_THRESHOLD) direction = 'right';
            else if (dx < -SWIPE_THRESHOLD) direction = 'left';
        } else {
            if (dy > SWIPE_THRESHOLD) direction = 'down';
            else if (dy < -SWIPE_THRESHOLD) direction = 'up';
        }
        if (direction) {
            let targetId = null;
            if (direction === 'right' && (swipeStartId % width) < width - 1) targetId = swipeStartId + 1;
            if (direction === 'left' && (swipeStartId % width) > 0) targetId = swipeStartId - 1;
            if (direction === 'down' && swipeStartId + width < width * width) targetId = swipeStartId + width;
            if (direction === 'up' && swipeStartId - width >= 0) targetId = swipeStartId - width;
            if (targetId !== null) {
                const fromSquare = squares[swipeStartId];
                const toSquare = squares[targetId];
                selected = fromSquare;
                dragDrop.call(toSquare, { preventDefault: () => {} });
                swipeStart = null;
                swipeStartId = null;
                return;
            }
        }
        // Eğer hareket çok küçükse (tap), sadece o zaman özel şeker patlat
        if (Math.abs(dx) < TAP_THRESHOLD && Math.abs(dy) < TAP_THRESHOLD) {
            const img = squares[idx].querySelector('img');
            if (img) {
                if (img.src.includes('bomb.png')) {
                    squares[idx].removeChild(img);
                    triggerBomb(idx);
                } else if (img.src.includes('firework.png')) {
                    squares[idx].removeChild(img);
                    triggerFirework(idx);
                }
            }
        }
    }
    swipeStart = null;
    swipeStartId = null;
}

// --- SES MODALI KAPATMA ve OYUN BAŞLATMA ---
document.addEventListener('DOMContentLoaded', function() {
    const audioModal = document.getElementById('audio-modal');
    const audioAllow = document.getElementById('audio-allow');
    let boardInitialized = false;
    if (audioAllow) {
        audioAllow.addEventListener('click', function() {
            unlockAudio();
            if (audioModal) audioModal.style.display = 'none';
            if (!boardInitialized) {
                startGame();
                boardInitialized = true;
            }
        });
    }
    // Eğer modal yoksa veya otomatik kapalıysa, yine de oyunu başlat
    if (audioModal && audioModal.style.display === 'none' && !boardInitialized) {
        startGame();
        boardInitialized = true;
    }
});

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

function startGame() {
    // Tahtayı ve oyunu başlat
    board.innerHTML = '';
    squares = [];
    score = 0;
    movesLeft = 0;
    colorGoals = {};
    colorProgress = {};
    chainPopped = null;
    specialCounter = 0;
    updateSpecialCounterUI();
    createBoard();
    // Level ve görevleri ayarla
    let config = getLevelConfig(currentLevel);
    movesLeft = config.moves;
    colorGoals = { ...config.goals };
    colorProgress = {};
    for (let key in colorGoals) colorProgress[key] = 0;
    updateUI();
    addEventListeners();
    startHintTimer();
}

// Basit UI güncellemesi (geliştirilebilir)
function updateUI() {
    if (typeof levelInfo !== 'undefined') levelInfo.textContent = 'Bölüm: ' + currentLevel;
    if (typeof movesInfo !== 'undefined') movesInfo.textContent = 'Kalan Hamle: ' + movesLeft;
    if (typeof missionInfo !== 'undefined') {
        let html = '';
        for (let key in colorGoals) {
            html += `<img src="${key}" class="mission-img"> ${colorProgress[key]||0}/${colorGoals[key]}  `;
        }
        missionInfo.innerHTML = html;
    }
}

function swapCandiesWithAnimation(fromId, toId, callback) {
    let fromImg = squares[fromId].querySelector('img');
    let toImg = squares[toId].querySelector('img');
    if (!fromImg || !toImg) {
        if (typeof callback === 'function') callback();
        return;
    }
    // Yönü bul
    let dir = '';
    if (toId === fromId + 1) dir = 'right';
    else if (toId === fromId - 1) dir = 'left';
    else if (toId === fromId + width) dir = 'down';
    else if (toId === fromId - width) dir = 'up';
    // Animasyon class'ı ekle
    squares[fromId].classList.add('swap-' + dir);
    squares[toId].classList.add('swap-' + (dir === 'left' ? 'right' : dir === 'right' ? 'left' : dir === 'up' ? 'down' : 'up'));
    // Animasyon bitince swap ve class'ı kaldır
    setTimeout(() => {
        squares[fromId].classList.remove('swap-' + dir);
        squares[toId].classList.remove('swap-' + (dir === 'left' ? 'right' : dir === 'right' ? 'left' : dir === 'up' ? 'down' : 'up'));
        // Swap işlemi
        let fromImg2 = squares[fromId].querySelector('img');
        let toImg2 = squares[toId].querySelector('img');
        if (fromImg2 && toImg2) {
            let temp = fromImg2.src;
            fromImg2.src = toImg2.src;
            toImg2.src = temp;
        }
        if (typeof callback === 'function') callback();
    }, 180);
}

// --- GÖREV TAMAMLANMA KONTROLÜ ---
function checkGoals() {
    for (let key in colorGoals) {
        if ((colorProgress[key] || 0) < colorGoals[key]) return false;
    }
    return true;
}

function dropCandies() {
    // Basit gravity: yukarıdan aşağıya boşlukları doldur
    for (let col = 0; col < width; col++) {
        for (let row = width - 1; row >= 0; row--) {
            let idx = row * width + col;
            if (!squares[idx].querySelector('img')) {
                // Yukarıdan ilk dolu şekeri bul
                for (let k = row - 1; k >= 0; k--) {
                    let aboveIdx = k * width + col;
                    let aboveImg = squares[aboveIdx].querySelector('img');
                    if (aboveImg) {
                        squares[idx].appendChild(aboveImg);
                        break;
                    }
                }
                // Eğer yukarıda hiç şeker yoksa yeni şeker oluştur
                if (!squares[idx].querySelector('img')) {
                    let config = getLevelConfig(currentLevel);
                    let activeImages = config.activeImages || candyImages;
                    let img = document.createElement('img');
                    img.src = getSafeCandyImage(row, col, activeImages);
                    img.className = 'candy-img';
                    squares[idx].appendChild(img);
                }
            }
        }
    }
    addEventListeners();
    setTimeout(() => {
        // Zincirleme bittiğinde ve board idle ise, timer başlat
        let anyMatch = false;
        for (let i = 0; i < squares.length; i++) {
            if (isMatchAt(i)) { anyMatch = true; break; }
        }
        if (!anyMatch && movesLeft > 0) {
            startHintTimer();
        }
        checkMatches(false);
    }, 100);
}

// --- MODAL GÖSTERİM FONKSİYONU ---
function showModal(isWin) {
    if (!modal) return;
    modal.style.display = 'flex';
    if (isWin) {
        playSound('win-sound');
        modalTitle.textContent = 'Tebrikler!';
        modalMessage.textContent = 'Bölümü başarıyla tamamladınız!';
        modalNext.style.display = '';
        modalRetry.style.display = 'none';
        modalNext.onclick = function() {
            currentLevel++;
            localStorage.setItem('candy_level', currentLevel);
            modal.style.display = 'none';
            startGame();
        };
    } else {
        playSound('lose-sound');
        modalTitle.textContent = 'Oyun Bitti!';
        modalMessage.textContent = 'Hamleleriniz bitti veya görev tamamlanamadı.';
        modalNext.style.display = 'none';
        modalRetry.style.display = '';
        modalRetry.onclick = function() {
            modal.style.display = 'none';
            startGame();
        };
    }
}

function updateSpecialCounterUI() {
    const span = document.getElementById('special-counter');
    if (span) span.textContent = specialCounter;
}

// Palette bir bomb ile swipelanırsa: rastgele 3 kareye bomb yerleştir ve hepsini patlat.
function triggerPaletteBombCombo() {
    // Tüm şekerleri patlat
    let popped = false;
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (img && !img.src.includes('palette.png')) {
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[i].classList.add('pop');
            squares[i].removeChild(img);
            score++;
            popped = true;
        }
    }
    if (popped) playSound('palette-sound');
    scoreDisplay.textContent = score;
    updateUI();
    setTimeout(dropCandies, 200);
}

// Palette bir normal şeker ile swipelanırsa, tahtadaki o türdeki tüm şekerler otomatik patlasın.
function triggerPaletteColorCombo(colorImgSrc) {
    let popped = false;
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (img && img.src === colorImgSrc) {
            let imgName = img.src.split('/').pop();
            if (colorProgress[imgName] !== undefined) colorProgress[imgName]++;
            squares[i].classList.add('pop');
            squares[i].removeChild(img);
            score++;
            popped = true;
        }
    }
    if (popped) playSound('palette-sound');
    scoreDisplay.textContent = score;
    updateUI();
    setTimeout(dropCandies, 200);
}

// Palette bir firework ile swipelanırsa: rastgele 3 kareye firework yerleştir ve hepsini patlat.
function triggerPaletteFireworkCombo(centerIdx) {
    // Rastgele 3 farklı kare seç
    let candidates = [];
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (img && !img.src.includes('bomb.png') && !img.src.includes('firework.png') && !img.src.includes('palette.png')) {
            candidates.push(i);
        }
    }
    if (candidates.length < 3) return;
    // 3 farklı kare seç
    let selected = [];
    while (selected.length < 3 && candidates.length > 0) {
        let idx = Math.floor(Math.random() * candidates.length);
        selected.push(candidates[idx]);
        candidates.splice(idx, 1);
    }
    // Seçilenlere firework yerleştir ve patlat
    for (let i = 0; i < selected.length; i++) {
        let idx = selected[i];
        let square = squares[idx];
        let oldImg = square.querySelector('img');
        if (oldImg) square.removeChild(oldImg);
        let fwImg = document.createElement('img');
        fwImg.src = 'firework.png';
        fwImg.className = 'candy-img';
        square.appendChild(fwImg);
    }
    // Hepsini patlat
    for (let i = 0; i < selected.length; i++) {
        triggerFirework(selected[i]);
    }
    playSound('palette-sound');
}

// Yeni hint animasyonu ve zamanlayıcı fonksiyonları
let hintTimeout = null;
let lastHintIndex = null;

function clearHintAnimation() {
    if (lastHintIndex !== null && squares[lastHintIndex]) {
        squares[lastHintIndex].classList.remove('hint-animate');
        let img = squares[lastHintIndex].querySelector('img');
        if (img) img.classList.remove('hint-animate');
    }
    lastHintIndex = null;
    if (hintTimeout) {
        clearTimeout(hintTimeout);
        hintTimeout = null;
    }
}

function handleHintAnimation() {
    clearHintAnimation();
    // Tüm olası hamleleri kategorilere ayır: özel şeker kombinasyonu, 5'li, 4'lü, 3'lü
    let specialMoves = [];
    let fiveMoves = [];
    let fourMoves = [];
    let threeMoves = [];
    for (let i = 0; i < squares.length; i++) {
        let img = squares[i].querySelector('img');
        if (!img || img.src.includes('bomb.png') || img.src.includes('firework.png') || img.src.includes('palette.png')) continue;
        let row = Math.floor(i / width);
        let col = i % width;
        // Sağ ile swap
        if (col < width - 1) {
            let j = i + 1;
            let img2 = squares[j].querySelector('img');
            if (img2 && !img2.src.includes('bomb.png') && !img2.src.includes('firework.png') && !img2.src.includes('palette.png')) {
                // 1. Özel şeker kombinasyonu (biri özelse)
                if (img.src.includes('palette.png') || img2.src.includes('palette.png') || img.src.includes('bomb.png') || img2.src.includes('bomb.png') || img.src.includes('firework.png') || img2.src.includes('firework.png')) {
                    if (wouldMatch(i, j)) specialMoves.push(i);
                } else {
                    // 2. 5'li, 4'lü, 3'lü kontrolü
                    let matchLen = getMatchLengthAfterSwap(i, j);
                    if (matchLen >= 5) fiveMoves.push(i);
                    else if (matchLen === 4) fourMoves.push(i);
                    else if (matchLen === 3) threeMoves.push(i);
                }
            }
        }
        // Aşağı ile swap
        if (row < width - 1) {
            let j = i + width;
            let img2 = squares[j].querySelector('img');
            if (img2 && !img2.src.includes('bomb.png') && !img2.src.includes('firework.png') && !img2.src.includes('palette.png')) {
                if (img.src.includes('palette.png') || img2.src.includes('palette.png') || img.src.includes('bomb.png') || img2.src.includes('bomb.png') || img.src.includes('firework.png') || img2.src.includes('firework.png')) {
                    if (wouldMatch(i, j)) specialMoves.push(i);
                } else {
                    let matchLen = getMatchLengthAfterSwap(i, j);
                    if (matchLen >= 5) fiveMoves.push(i);
                    else if (matchLen === 4) fourMoves.push(i);
                    else if (matchLen === 3) threeMoves.push(i);
                }
            }
        }
    }
    // Öncelik sırasına göre ilk bulduğunu göster
    let hintIdx = null;
    if (specialMoves.length > 0) hintIdx = specialMoves[0];
    else if (fiveMoves.length > 0) hintIdx = fiveMoves[0];
    else if (fourMoves.length > 0) hintIdx = fourMoves[0];
    else if (threeMoves.length > 0) hintIdx = threeMoves[0];
    if (hintIdx !== null) {
        squares[hintIdx].classList.add('hint-animate');
        let img = squares[hintIdx].querySelector('img');
        if (img) img.classList.add('hint-animate');
        lastHintIndex = hintIdx;
    }
}

// Swap sonrası en uzun eşleşme uzunluğunu döndürür
function getMatchLengthAfterSwap(i, j) {
    let img1 = squares[i].querySelector('img');
    let img2 = squares[j].querySelector('img');
    if (!img1 || !img2) return 0;
    let temp = img1.src;
    img1.src = img2.src;
    img2.src = temp;
    let maxLen = Math.max(getMatchLengthAt(i), getMatchLengthAt(j));
    img2.src = img1.src;
    img1.src = temp;
    return maxLen;
}
// Bir karede swap sonrası en uzun yatay/dikey eşleşme uzunluğunu döndürür
function getMatchLengthAt(idx) {
    let img = squares[idx].querySelector('img');
    if (!img) return 0;
    let src = img.src;
    let row = Math.floor(idx / width);
    let col = idx % width;
    // Yatay
    let count = 1;
    for (let d = 1; col - d >= 0; d++) {
        let img2 = squares[row * width + (col - d)].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    for (let d = 1; col + d < width; d++) {
        let img2 = squares[row * width + (col + d)].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    let maxCount = count;
    // Dikey
    count = 1;
    for (let d = 1; row - d >= 0; d++) {
        let img2 = squares[(row - d) * width + col].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    for (let d = 1; row + d < width; d++) {
        let img2 = squares[(row + d) * width + col].querySelector('img');
        if (img2 && img2.src === src) count++; else break;
    }
    if (count > maxCount) maxCount = count;
    return maxCount;
}

// --- Yeni hint timer yönetimi ---
// 1. dragDrop ve handleTouchEnd'de sadece clearHintAnimation() çağrılır, startHintTimer() kaldırıldı
const originalDragDrop = dragDrop;
dragDrop = function(e) {
    clearHintAnimation();
    originalDragDrop.apply(this, arguments);
    // startHintTimer(); // KALDIRILDI
};
const originalHandleTouchEnd = handleTouchEnd;
handleTouchEnd = function(e, idx) {
    clearHintAnimation();
    originalHandleTouchEnd.apply(this, arguments);
    // startHintTimer(); // KALDIRILDI
};

// 2. checkMatches fonksiyonunun en sonunda, sadece oyuncu hamlesiyle board idle olduğunda startHintTimer() çağrılır
// (else if (isPlayerMove) {...} bloğunun sonuna ekle)
//
// else if (isPlayerMove) {
//     if (checkGoals()) {
//         showModal(true);
//     } else if (movesLeft <= 0) {
//         showModal(false);
//     } else {
//         startHintTimer();
//     }
// }

// 3. Oyun başında da sadece temizle (zaten var)

function startHintTimer() {
    clearHintAnimation();
    hintTimeout = setTimeout(() => {
        handleHintAnimation();
    }, 2500); // 2.5 saniye
}