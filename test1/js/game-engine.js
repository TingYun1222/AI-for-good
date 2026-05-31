class Egg {
    static normalEggImages = [];
    static normalEggImagePaths = ['蛋1.png', '蛋2.png', '蛋3.png', '蛋4.png', '蛋5.png'];
    static badEggImages = [];
    static badEggImagePaths = ['壞蛋11.png', '壞蛋22.png', '壞蛋33.png', '壞蛋44.png', '壞蛋55.png'];

    static ensureNormalEggImagesLoaded() {
        if (this.normalEggImages.length > 0) return;

        this.normalEggImagePaths.forEach(path => {
            const img = new Image();
            img.src = path;
            this.normalEggImages.push(img);
        });
    }

    static ensureBadEggImagesLoaded() {
        if (this.badEggImages.length > 0) return;

        this.badEggImagePaths.forEach(path => {
            const img = new Image();
            img.src = path;
            this.badEggImages.push(img);
        });
    }

    constructor(x, y, type = 'normal') {
        this.x = x;
        this.y = y;
        this.type = type; // 'normal' or 'bad'
        this.radius = this.type === 'normal' ? 52 : 42;
        this.collected = false;
        this.createdTime = Date.now();

        Egg.ensureNormalEggImagesLoaded();
        Egg.ensureBadEggImagesLoaded();
        this.normalEggImage = null;
        this.badEggImage = null;
        if (this.type === 'normal' && Egg.normalEggImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * Egg.normalEggImages.length);
            this.normalEggImage = Egg.normalEggImages[randomIndex];
        } else if (this.type === 'bad' && Egg.badEggImages.length > 0) {
            const randomIndex = Math.floor(Math.random() * Egg.badEggImages.length);
            this.badEggImage = Egg.badEggImages[randomIndex];
        }
    }

    draw(ctx) {
        if (this.collected) return;
        
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        if (this.type === 'normal' && this.normalEggImage && this.normalEggImage.complete) {
            const maxSize = this.radius * 2.9;
            const ratio = this.normalEggImage.naturalWidth > 0
                ? this.normalEggImage.naturalHeight / this.normalEggImage.naturalWidth
                : 1;
            const drawWidth = maxSize;
            const drawHeight = maxSize * ratio;
            ctx.drawImage(this.normalEggImage, this.x - drawWidth / 2, this.y - drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();
            return;
        }

        if (this.type === 'bad' && this.badEggImage && this.badEggImage.complete) {
            const maxSize = this.radius * 2.5;
            const ratio = this.badEggImage.naturalWidth > 0
                ? this.badEggImage.naturalHeight / this.badEggImage.naturalWidth
                : 1;
            const drawWidth = maxSize;
            const drawHeight = maxSize * ratio;
            ctx.drawImage(this.badEggImage, this.x - drawWidth / 2, this.y - drawHeight / 2, drawWidth, drawHeight);
            ctx.restore();
            return;
        }
        
        // 繪製蛋形（使用圓形近似橢圓）
        ctx.fillStyle = this.type === 'normal' ? '#FFD700' : '#666666';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // 繪製高光（只對正常蛋）
        if (this.type === 'normal') {
            ctx.fillStyle = '#FFB700';
            ctx.beginPath();
            ctx.arc(this.x - 8, this.y - 8, 8, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }

    checkCollision(x, y, radius = 40) {
        const dx = this.x - x;
        const dy = this.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.radius + radius);
    }
}

class PoseDetector {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.poseDetector = null;
        this.camera = null;
        this.isInitialized = false;
        this.lastPose = null;
    }

    async initialize() {
        try {
            console.log('🚀 初始化姿勢檢測...');
            
            // 檢查瀏覽器支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('❌ 您的瀏覽器不支持攝像頭功能，請使用現代瀏覽器');
            }

            // 檢查依賴
            if (typeof window.Pose === 'undefined') {
                throw new Error('❌ MediaPipe Pose 未加載，請檢查網路連接');
            }
            if (typeof window.Camera === 'undefined') {
                throw new Error('❌ Camera Utils 未加載，請檢查網路連接');
            }

            console.log('✅ 依賴檢查通過');

            // 檢查攝像頭權限
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                console.log('✅ 攝像頭權限已獲取');
                // 立即停止測試流
                stream.getTracks().forEach(track => track.stop());
            } catch (permissionError) {
                console.error('❌ 攝像頭權限被拒絕:', permissionError);
                throw new Error('請允許瀏覽器訪問攝像頭，然後重新整理頁面');
            }

            // 初始化 Pose
            this.poseDetector = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/${file}`;
                }
            });

            // 設置姿勢檢測選項
            this.poseDetector.setOptions({
                modelComplexity: 1,  // 0, 1, or 2 (higher = more accurate but slower)
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });

            this.poseDetector.onResults((results) => {
                this.onResults(results);
            });

            await this.poseDetector.initialize();
            console.log('✅ Pose 已初始化');

            // 初始化 Camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    if (this.poseDetector && this.video.readyState >= 2) {
                        await this.poseDetector.send({ image: this.video });
                    }
                },
                width: 640,
                height: 480
            });

            console.log('✅ Camera 已初始化');

            // 啟動攝像頭（在 Pose 初始化之後）
            try {
                await this.camera.start();
                console.log('✅ 攝像頭已啟動');
            } catch (cameraError) {
                console.error('❌ 攝像頭啟動失敗:', cameraError);
                throw new Error('無法啟動攝像頭，請檢查攝像頭是否被其他應用程式占用');
            }

            // 啟動後再等待視頻尺寸，避免尚未開始時卡住
            await new Promise((resolve, reject) => {
                const startedAt = Date.now();
                const maxWaitMs = 10000;

                const checkVideo = () => {
                    if (this.video.videoWidth > 0 && this.video.videoHeight > 0) {
                        this.canvas.width = this.video.videoWidth;
                        this.canvas.height = this.video.videoHeight;
                        console.log(`✅ 視頻尺寸: ${this.canvas.width}x${this.canvas.height}`);
                        resolve();
                        return;
                    }

                    if (Date.now() - startedAt > maxWaitMs) {
                        reject(new Error('攝像頭畫面初始化超時，請重新整理後再試一次'));
                        return;
                    }

                    setTimeout(checkVideo, 100);
                };

                checkVideo();
            });

            this.isInitialized = true;
            console.log('🎉 姿勢檢測初始化完成！');
            return true;
        } catch (error) {
            console.error('❌ 初始化失敗:', error);
            throw error;
        }
    }

    onResults(results) {
        this.lastPose = results;
        
        // 調試信息
        if (results.poseLandmarks && results.poseLandmarks.length > 0) {
            console.log('📍 檢測到姿勢，共', results.poseLandmarks.length, '個關鍵點');
            const hands = this.getHandPositions();
            if (hands.left || hands.right) {
                console.log('👐 手部位置:', hands);
            } else {
                console.log('❌ 沒有檢測到手部');
            }
        } else {
            console.log('❌ 沒有檢測到姿勢');
        }
    }

    drawConnectors(landmarks) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 7],
            [0, 4], [4, 5], [5, 6], [6, 8],
            [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
            [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
            [11, 23], [12, 24], [23, 24], [23, 25], [24, 26]
        ];

        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 2;

        for (const [start, end] of connections) {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            if (startPoint.visibility > 0.5 && endPoint.visibility > 0.5) {
                // 視頻是鏡像的，所以 MediaPipe 返回的坐標需要翻轉回來
                const startX = (1 - startPoint.x) * this.canvas.width;
                const startY = startPoint.y * this.canvas.height;
                const endX = (1 - endPoint.x) * this.canvas.width;
                const endY = endPoint.y * this.canvas.height;

                this.ctx.beginPath();
                this.ctx.moveTo(startX, startY);
                this.ctx.lineTo(endX, endY);
                this.ctx.stroke();
            }
        }
    }

    drawLandmarks(landmarks) {
        this.ctx.fillStyle = '#FF0000';
        
        for (const landmark of landmarks) {
            if (landmark.visibility > 0.5) {
                // 視頻是鏡像的，所以 MediaPipe 返回的坐標需要翻轉回來
                const x = (1 - landmark.x) * this.canvas.width;
                const y = landmark.y * this.canvas.height;

                this.ctx.beginPath();
                this.ctx.arc(x, y, 6, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    getHandPositions() {
        if (!this.lastPose || !this.lastPose.poseLandmarks) {
            return { left: null, right: null };
        }

        const landmarks = this.lastPose.poseLandmarks;
        const LEFT_WRIST = 15;
        const RIGHT_WRIST = 16;

        const leftWrist = landmarks[LEFT_WRIST];
        const rightWrist = landmarks[RIGHT_WRIST];

        const positions = { left: null, right: null };

        if (leftWrist && leftWrist.visibility > 0.5) {
            // 視頻是鏡像的，所以 MediaPipe 返回的坐標需要翻轉回來
            positions.left = {
                x: (1 - leftWrist.x) * this.canvas.width,
                y: leftWrist.y * this.canvas.height
            };
        }

        if (rightWrist && rightWrist.visibility > 0.5) {
            // 視頻是鏡像的，所以 MediaPipe 返回的坐標需要翻轉回來
            positions.right = {
                x: (1 - rightWrist.x) * this.canvas.width,
                y: rightWrist.y * this.canvas.height
            };
        }

        return positions;
    }

    calculateAngle(a, b, c) {
        const ab = { x: a.x - b.x, y: a.y - b.y };
        const cb = { x: c.x - b.x, y: c.y - b.y };

        const dot = ab.x * cb.x + ab.y * cb.y;
        const abLen = Math.sqrt(ab.x * ab.x + ab.y * ab.y);
        const cbLen = Math.sqrt(cb.x * cb.x + cb.y * cb.y);

        if (abLen === 0 || cbLen === 0) return 180;

        const cosValue = Math.max(-1, Math.min(1, dot / (abLen * cbLen)));
        return Math.acos(cosValue) * (180 / Math.PI);
    }

    isSquatting() {
        if (!this.lastPose || !this.lastPose.poseLandmarks) {
            return false;
        }

        const landmarks = this.lastPose.poseLandmarks;
        const LEFT_HIP = 23;
        const RIGHT_HIP = 24;
        const LEFT_KNEE = 25;
        const RIGHT_KNEE = 26;
        const LEFT_ANKLE = 27;
        const RIGHT_ANKLE = 28;

        const leftHip = landmarks[LEFT_HIP];
        const rightHip = landmarks[RIGHT_HIP];
        const leftKnee = landmarks[LEFT_KNEE];
        const rightKnee = landmarks[RIGHT_KNEE];
        const leftAnkle = landmarks[LEFT_ANKLE];
        const rightAnkle = landmarks[RIGHT_ANKLE];

        const minVisibility = 0.5;
        if (
            !leftHip || !rightHip || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle ||
            leftHip.visibility < minVisibility || rightHip.visibility < minVisibility ||
            leftKnee.visibility < minVisibility || rightKnee.visibility < minVisibility ||
            leftAnkle.visibility < minVisibility || rightAnkle.visibility < minVisibility
        ) {
            return false;
        }

        const leftKneeAngle = this.calculateAngle(leftHip, leftKnee, leftAnkle);
        const rightKneeAngle = this.calculateAngle(rightHip, rightKnee, rightAnkle);

        // 蹲下判定：雙膝角度明顯彎曲
        return leftKneeAngle < 145 && rightKneeAngle < 145;
    }

    isFullBodyDetected() {
        if (!this.lastPose || !this.lastPose.poseLandmarks) {
            return false;
        }

        const landmarks = this.lastPose.poseLandmarks;
        const requiredPoints = [0, 11, 12, 15, 16, 23, 24, 25, 26, 27, 28];
        const minVisibility = 0.55;

        return requiredPoints.every(index => {
            const point = landmarks[index];
            return point && point.visibility > minVisibility;
        });
    }

    getBodyCenterXNormalized() {
        if (!this.lastPose || !this.lastPose.poseLandmarks) {
            return null;
        }

        const landmarks = this.lastPose.poseLandmarks;
        const LEFT_HIP = 23;
        const RIGHT_HIP = 24;
        const minVisibility = 0.5;

        const leftHip = landmarks[LEFT_HIP];
        const rightHip = landmarks[RIGHT_HIP];

        if (!leftHip || !rightHip || leftHip.visibility < minVisibility || rightHip.visibility < minVisibility) {
            return null;
        }

        const centerX = (leftHip.x + rightHip.x) / 2;
        return 1 - centerX;
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
        }
        this.isInitialized = false;
    }
}

class GameEngine {
    constructor() {
        this.state = 'start'; // start, playing, ended
        this.score = 0;
        this.collected = 0;
        this.goodCollected = 0;
        this.time = 0;
        this.gameTime = 60; // 60 秒遊戲時間
        this.eggs = [];
        this.poseDetector = null;
        this.gameLoopId = null;
        this.spawnInterval = null;
        this.timeInterval = null;
        this.maxEggs = 20;
        this.badEggRatio = 0.4; // 40% 壞蛋
        this.mouseOnlyMode = false;
        this.isSquatting = false;
        this.mustStandBeforeNextCollect = false;
        this.balanceSamples = [];
        this.lastBalanceAlertAt = 0;
        this.goodEggSpawnIntervalMs = 3000;
        this.targetGoodEggSpawnCount = 20;
        this.goodEggsPerSpawn = 1;
        this.spawnedGoodEggCount = 0;
        this.eggLifetimeMs = 6000;
        this.grassImage = new Image();
        this.grassImage.src = '草地.png';
    }

    async startGame() {
        try {
            console.log('🎮 開始初始化遊戲...');
            this.state = 'preparing';
            this.score = 0;
            this.collected = 0;
            this.goodCollected = 0;
            this.time = this.gameTime;
            this.eggs = [];
            this.spawnedGoodEggCount = 0;
            this.mustStandBeforeNextCollect = false;
            this.balanceSamples = [];
            this.lastBalanceAlertAt = 0;

            // 初始化姿勢偵測
            const video = document.getElementById('video');
            const canvas = document.getElementById('canvas');
            
            if (!video || !canvas) {
                throw new Error('找不到視頻或畫布元素');
            }

            console.log('🎮 初始化姿勢偵測...');
            this.poseDetector = new PoseDetector(video, canvas);

            try {
                await this.poseDetector.initialize();
                this.mouseOnlyMode = false;
            } catch (poseError) {
                console.warn('⚠️ 姿勢偵測不可用，改用滑鼠模式:', poseError);
                this.mouseOnlyMode = true;
            }

            // 先啟動更新迴圈，讓玩家在開始前看到偵測畫面
            this.gameLoopId = setInterval(() => {
                this.update();
            }, 50);

            this.updateUI();

            if (!this.mouseOnlyMode) {
                const fullBodyReady = await this.waitForFullBodyDetection(15000);
                if (!fullBodyReady) {
                    throw new Error('開始前需要先完整入鏡（頭、手、身體、雙腳都要在畫面內）');
                }
            }

            this.state = 'playing';
            
            console.log('✅ 遊戲已準備就緒，開始生成蛋蛋...');

            // 計時器
            this.timeInterval = setInterval(() => {
                this.time--;
                this.updateUI();
                if (this.time <= 0) {
                    this.endGame();
                }
            }, 1000);

            // 好蛋每 3 秒生成一波；30 秒內共生成 20 顆
            this.spawnEggWave();
            this.spawnInterval = setInterval(() => this.spawnEggWave(), this.goodEggSpawnIntervalMs);
            
            this.updateUI();
            console.log('🎮 遊戲已啟動！');
        } catch (error) {
            console.error('❌ 遊戲啟動失敗:', error);
            const errorMessage = error.message || '未知錯誤';
            alert(`無法啟動遊戲：${errorMessage}`);
            this.state = 'start';
            this.updateUI();
            this.showScreen('startScreen');
        }
    }

    async waitForFullBodyDetection(timeoutMs = 15000) {
        const checkInterval = 120;
        const stableDurationMs = 1000;
        const startAt = Date.now();
        let stableSince = null;

        return new Promise((resolve) => {
            const timer = setInterval(() => {
                if (!this.poseDetector) {
                    clearInterval(timer);
                    resolve(false);
                    return;
                }

                const detected = this.poseDetector.isFullBodyDetected();
                if (detected) {
                    if (!stableSince) {
                        stableSince = Date.now();
                    }
                    if (Date.now() - stableSince >= stableDurationMs) {
                        clearInterval(timer);
                        resolve(true);
                        return;
                    }
                } else {
                    stableSince = null;
                }

                if (Date.now() - startAt >= timeoutMs) {
                    clearInterval(timer);
                    resolve(false);
                }
            }, checkInterval);
        });
    }

    spawnEggWave() {
        if (this.state !== 'playing') return;

        const canvas = document.getElementById('canvas');
        if (!canvas.width || !canvas.height) return;

        const remainingGoodEggs = this.targetGoodEggSpawnCount - this.spawnedGoodEggCount;
        const spawnGoodCount = Math.min(this.goodEggsPerSpawn, Math.max(0, remainingGoodEggs));

        for (let i = 0; i < spawnGoodCount; i++) {
            const egg = this.createEggWithoutOverlap('normal', canvas);
            if (egg) {
                this.eggs.push(egg);
                this.spawnedGoodEggCount++;
            }
        }

        // 每波仍有機率追加壞蛋，維持挑戰感
        if (Math.random() < this.badEggRatio) {
            const badEgg = this.createEggWithoutOverlap('bad', canvas);
            if (badEgg) {
                this.eggs.push(badEgg);
            }
        }
    }

    createEggWithoutOverlap(type, canvas) {
        const margin = 84;
        const lowerThirdTop = canvas.height * (2 / 3);
        const minY = Math.max(margin, lowerThirdTop + 24);
        const maxY = canvas.height - margin;
        const yRange = Math.max(1, maxY - minY);
        const radius = type === 'normal' ? 52 : 42;
        const maxAttempts = 40;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = Math.random() * (canvas.width - margin * 2) + margin;
            const y = minY + Math.random() * yRange;

            if (this.isSpawnPositionAvailable(x, y, radius)) {
                return new Egg(x, y, type);
            }
        }

        return null;
    }

    isSpawnPositionAvailable(x, y, radius) {
        const gap = 14;
        return this.eggs.every(existingEgg => {
            if (existingEgg.collected) {
                return true;
            }

            const dx = existingEgg.x - x;
            const dy = existingEgg.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance >= (existingEgg.radius + radius + gap);
        });
    }

    update() {
        if (this.state !== 'playing' && this.state !== 'preparing') return;

        const canvas = document.getElementById('canvas');
        let hands = this.poseDetector ? this.poseDetector.getHandPositions() : { left: null, right: null };
        this.isSquatting = this.poseDetector ? this.poseDetector.isSquatting() : false;
        this.updateBalanceStatus();

        // 每次成功撿蛋後，需先站起來才能再撿下一顆
        if (this.mustStandBeforeNextCollect && !this.isSquatting) {
            this.mustStandBeforeNextCollect = false;
        }

        this.updateUI();

        if (this.state === 'preparing') {
            this.renderGameFrame();
            return;
        }

        this.removeExpiredEggs();

        // 如果沒有檢測到手部，嘗試使用滑鼠位置（測試模式）
        if (!hands.left && !hands.right) {
            // 檢查是否有滑鼠事件
            if (window.mousePosition) {
                hands = { left: window.mousePosition, right: null };
                console.log('🐭 使用滑鼠位置測試:', window.mousePosition);
            }
        }

        // 調試信息
        if (this.eggs.length > 0) {
            console.log('🥚 當前蛋數量:', this.eggs.length, '手部位置:', hands);
        }

        // 姿勢模式需蹲下才可撿蛋；滑鼠模式不限制
        const canCollect = this.mouseOnlyMode || (this.isSquatting && !this.mustStandBeforeNextCollect);

        // 檢查碰撞
        if (canCollect && (hands.left || hands.right)) {
            const positions = [];
            if (hands.left) positions.push(hands.left);
            if (hands.right) positions.push(hands.right);
            
            for (let pos of positions) {
                for (let i = this.eggs.length - 1; i >= 0; i--) {
                    const egg = this.eggs[i];
                    if (!egg.collected && egg.checkCollision(pos.x, pos.y, 40)) {
                        egg.collected = true;
                        this.collectEgg(egg);
                        if (!this.mouseOnlyMode) {
                            this.mustStandBeforeNextCollect = true;
                        }
                        this.eggs.splice(i, 1);
                        console.log(`🥚 收集了蛋！剩餘: ${this.eggs.length} 個`);
                    }
                }
            }
        }

        // 繪製遊戲幀
        this.renderGameFrame();
    }

    removeExpiredEggs() {
        const now = Date.now();
        this.eggs = this.eggs.filter(egg => !egg.collected && (now - egg.createdTime) <= this.eggLifetimeMs);
    }

    renderGameFrame() {
        const canvas = document.getElementById('canvas');
        if (!canvas.width || !canvas.height) return;

        const ctx = canvas.getContext('2d');
        
        // 清除畫布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 在畫面下方三分之一繪製草地
        const grassTop = canvas.height * (2 / 3);
        const grassHeight = canvas.height - grassTop;
        if (this.grassImage && this.grassImage.complete) {
            ctx.drawImage(this.grassImage, 0, grassTop, canvas.width, grassHeight);
        } else {
            const grassGradient = ctx.createLinearGradient(0, grassTop, 0, canvas.height);
            grassGradient.addColorStop(0, 'rgba(94, 191, 74, 0.62)');
            grassGradient.addColorStop(1, 'rgba(49, 138, 41, 0.85)');
            ctx.fillStyle = grassGradient;
            ctx.fillRect(0, grassTop, canvas.width, grassHeight);
        }

        // 繪製姿勢骨架
        if (this.poseDetector && this.poseDetector.lastPose && this.poseDetector.lastPose.poseLandmarks) {
            this.poseDetector.drawConnectors(this.poseDetector.lastPose.poseLandmarks);
            this.poseDetector.drawLandmarks(this.poseDetector.lastPose.poseLandmarks);
        }

        // 繪製手部位置標記（調試用）
        const hands = this.poseDetector ? this.poseDetector.getHandPositions() : { left: null, right: null };
        ctx.fillStyle = '#00FF00';
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        
        if (hands.left) {
            ctx.beginPath();
            ctx.arc(hands.left.x, hands.left.y, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillText('L', hands.left.x - 5, hands.left.y + 5);
        }
        
        if (hands.right) {
            ctx.beginPath();
            ctx.arc(hands.right.x, hands.right.y, 20, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillText('R', hands.right.x - 5, hands.right.y + 5);
        }

        // 繪製蛋蛋
        for (let egg of this.eggs) {
            if (!egg.collected) {
                egg.draw(ctx);
            }
        }
    }

    updateBalanceStatus() {
        if (this.mouseOnlyMode || !this.poseDetector || typeof window.speechSynthesis === 'undefined') {
            return;
        }

        const centerX = this.poseDetector.getBodyCenterXNormalized();
        if (centerX === null) {
            return;
        }

        const now = Date.now();
        const sampleWindowMs = 2000;
        this.balanceSamples.push({ t: now, x: centerX });
        this.balanceSamples = this.balanceSamples.filter(item => now - item.t <= sampleWindowMs);

        if (this.balanceSamples.length < 10) {
            return;
        }

        let minX = Infinity;
        let maxX = -Infinity;
        let diffSum = 0;
        let diffCount = 0;

        for (let i = 0; i < this.balanceSamples.length; i++) {
            const x = this.balanceSamples[i].x;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);

            if (i > 0) {
                diffSum += Math.abs(x - this.balanceSamples[i - 1].x);
                diffCount++;
            }
        }

        const swayRange = maxX - minX;
        const avgStep = diffCount > 0 ? diffSum / diffCount : 0;
        const isUnstable = swayRange > 0.16 && avgStep > 0.012;

        if (!isUnstable) {
            return;
        }

        const cooldownMs = 6500;
        if (now - this.lastBalanceAlertAt < cooldownMs) {
            return;
        }

        this.lastBalanceAlertAt = now;
        this.speakWarning('請站穩重心，保持身體平衡');
    }

    speakWarning(text) {
        if (typeof window.speechSynthesis === 'undefined') {
            return;
        }

        if (window.speechSynthesis.speaking) {
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 1.02;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }

    collectEgg(egg) {
        this.collected++;
        if (egg.type === 'normal') {
            this.score += 2;
            this.goodCollected++;
        } else {
            this.score -= 1;
        }

        // 時間獎勵：越早撿到加分越高（0~10 秒 +6，11~20 秒 +5，依此類推）
        const elapsedSeconds = this.gameTime - this.time;
        const tier = Math.floor(Math.max(0, elapsedSeconds - 1) / 10);
        const timeBonus = Math.max(0, 6 - tier);
        this.score += timeBonus;

        this.updateUI();
    }

    updateUI() {
        document.getElementById('scoreValue').textContent = this.score;
        document.getElementById('collectedValue').textContent = this.collected;
        document.getElementById('timeValue').textContent = this.time;
        document.getElementById('leftValue').textContent = Math.max(0, this.maxEggs - this.collected);
        const statusValue = document.getElementById('statusValue');
        if (statusValue) {
            if (this.state === 'preparing') {
                statusValue.textContent = this.mouseOnlyMode
                    ? '🖱️ 攝影機不可用，滑鼠模式'
                    : '🧍 請先完整入鏡，感應全身後開始';
                return;
            }

            if (this.mouseOnlyMode) {
                statusValue.textContent = '🖱️ 滑鼠模式';
            } else {
                if (this.mustStandBeforeNextCollect) {
                    statusValue.textContent = this.isSquatting ? '⬆️ 先站起來才能撿下一顆' : '✅ 已站起來，請再蹲下撿下一顆';
                } else {
                    statusValue.textContent = this.isSquatting ? '✅ 已蹲下可撿蛋' : '⬇️ 請先蹲下再撿蛋';
                }
            }
        }
    }

    generateRedeemCode(length = 10) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < length; i++) {
            const index = Math.floor(Math.random() * chars.length);
            code += chars[index];
        }
        return code;
    }

    formatDateTimeToSecond(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
    }

    endGame() {
        this.state = 'ended';
        
        // 清理
        clearInterval(this.gameLoopId);
        clearInterval(this.timeInterval);
        clearInterval(this.spawnInterval);
        
        if (this.poseDetector) {
            this.poseDetector.stop();
        }

        // 生成消息
        let message = '';
        if (this.score >= 30) {
            message = '🌟 太棒了！你是蛋蛋獵人大師！';
        } else if (this.score >= 20) {
            message = '😊 不錯！再加點努力就更好了！';
        } else if (this.score >= 10) {
            message = '💪 加油！下次會更好！';
        } else {
            message = '🎮 再試一次吧！';
        }

        // 顯示結果
        document.getElementById('finalScore').textContent = this.score;
        document.getElementById('finalCollected').textContent = this.collected;
        document.getElementById('message').textContent = message;

        const bonusRedeemEl = document.getElementById('bonusRedeem');
        const finishedAtEl = document.getElementById('finishedAt');
        const finishedAt = new Date();

        if (bonusRedeemEl) {
            if (this.goodCollected >= 6) {
                bonusRedeemEl.textContent = `兌換代碼: ${this.generateRedeemCode(10)}`;
                bonusRedeemEl.style.display = 'block';
            } else {
                bonusRedeemEl.style.display = 'none';
                bonusRedeemEl.textContent = '';
            }
        }

        if (finishedAtEl) {
            finishedAtEl.textContent = this.formatDateTimeToSecond(finishedAt);
        }
        
        // 切換到結束畫面
        this.showScreen('endScreen');
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
    }
}

// 全局遊戲實例
let gameEngine = null;

function initGame() {
    gameEngine = new GameEngine();
}

function startGameHandler() {
    console.log('🎮 開始遊戲按鈕被點擊');
    if (gameEngine) {
        // 檢查攝像頭權限
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('您的瀏覽器不支持攝像頭功能，請使用現代瀏覽器');
            return;
        }
        
        // 先切換到遊戲畫面
        gameEngine.showScreen('gameScreen');
        // 再開始遊戲
        gameEngine.startGame();
    } else {
        console.error('❌ 遊戲引擎未初始化');
    }
}

function restartGame() {
    initGame();
    gameEngine.showScreen('startScreen');
}

// 頁面加載時初始化
function initializeGame() {
    if (window.gameInitialized) {
        console.log('Game already initialized, skipping...');
        return;
    }
    
    console.log('🎮 頁面加載完成，初始化遊戲...');
    initGame();
    
    // 事件監聽
    const startBtn = document.getElementById('startBtn');
    const restartBtn = document.getElementById('restartBtn');
    
    if (startBtn) {
        console.log('✅ 找到開始按鈕');
        startBtn.addEventListener('click', startGameHandler);
    } else {
        console.error('❌ 找不到開始按鈕');
    }
    
    if (restartBtn) {
        console.log('✅ 找到重新開始按鈕');
        restartBtn.addEventListener('click', restartGame);
    } else {
        console.error('❌ 找不到重新開始按鈕');
    }

    // 添加滑鼠移動事件監聽（測試用）
    const canvas = document.getElementById('canvas');
    if (canvas) {
        canvas.addEventListener('mousemove', (event) => {
            const rect = canvas.getBoundingClientRect();
            window.mousePosition = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        });
    }

    // 顯示開始畫面
    gameEngine.showScreen('startScreen');
    console.log('🎮 遊戲初始化完成');
    
    window.gameInitialized = true;
}

// 檢查是否頁面已經加載完成
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    // 頁面已經加載完成，直接初始化
    initializeGame();
}
