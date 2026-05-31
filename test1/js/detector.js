class PoseDetector {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.pose = null;
        this.camera = null;
        this.isRunning = false;

        // UI 元素
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');

        this.statusDisplay = document.getElementById('status');
        this.landmarksDisplay = document.getElementById('landmarks');
        this.leftHandDisplay = document.getElementById('leftHandVis');
        this.rightHandDisplay = document.getElementById('rightHandVis');
        this.logPanel = document.getElementById('logPanel');

        this.logs = [];

        // 檢查依賴
        this.checkDependencies();

        // 事件監聽
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.resetBtn.addEventListener('click', () => this.reset());

        // 全局錯誤捕獲
        window.addEventListener('error', (e) => {
            this.log(`❌ 全局錯誤: ${e.message}`, 'error');
        });

        this.log('✅ 應用已初始化', 'info');
    }

    checkDependencies() {
        this.log('🔍 檢查依賴...', 'warning');
        
        const checks = [
            { name: 'Pose', exists: typeof Pose !== 'undefined' },
            { name: 'Camera', exists: typeof Camera !== 'undefined' },
            { name: 'getUserMedia', exists: navigator.mediaDevices?.getUserMedia }
        ];

        checks.forEach(check => {
            if (check.exists) {
                this.log(`✅ ${check.name} 已加載`, 'success');
            } else {
                this.log(`⚠️ ${check.name} 未加載`, 'warning');
            }
        });
    }

    log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString('zh-TW');
        const log = `[${timestamp}] ${message}`;
        this.logs.push(log);

        // 只保留最後 15 條日誌
        if (this.logs.length > 15) {
            this.logs.shift();
        }

        // 更新日誌面板
        this.logPanel.className = `status ${type}`;
        this.logPanel.innerHTML = this.logs.join('<br>');
        console.log(log);
    }

    async start() {
        try {
            if (this.isRunning) {
                this.log('⚠️ 檢測已在運行', 'warning');
                return;
            }

            this.log('🚀 開始初始化 MediaPipe Pose...', 'warning');

            // 再次檢查依賴
            if (typeof Pose === 'undefined') {
                throw new Error('❌ Pose 腳本未加載 - 請檢查網路連接');
            }
            if (typeof Camera === 'undefined') {
                throw new Error('❌ Camera 腳本未加載 - 請檢查網路連接');
            }

            // 初始化 Pose
            this.log('📦 創建 Pose 實例...', 'info');
            this.pose = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });

            this.log('⚙️ 設定 Pose 參數...', 'info');
            this.pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.3,
                minTrackingConfidence: 0.3
            });

            // 設定回調
            this.pose.onResults((results) => this.onResults(results));

            this.log('📹 初始化攝像頭...', 'warning');

            // 嘗試取得攝像頭權限
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('❌ 瀏覽器不支持攝像頭訪問');
            }

            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    try {
                        await this.pose.send({ image: this.video });
                    } catch (error) {
                        console.warn('處理影幀時出錯:', error);
                    }
                },
                width: 640,
                height: 480
            });

            this.canvas.width = 640;
            this.canvas.height = 480;

            this.log('▶️ 啟動攝像頭...', 'info');
            await this.camera.start();
            this.isRunning = true;

            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;

            this.statusDisplay.textContent = '✅ 執行中';
            this.statusDisplay.style.color = '#66ff66';

            this.log('🎯 攝像頭已啟動，等待檢測...\n請確保整個身體都在鏡頭中', 'success');

        } catch (error) {
            this.log(`❌ 錯誤: ${error.message}`, 'error');
            this.statusDisplay.textContent = '❌ 錯誤';
            this.statusDisplay.style.color = '#ff6666';
            this.stop();
        }
    }

    stop() {
        if (this.camera) {
            this.camera.stop();
            this.camera = null;
        }
        this.isRunning = false;
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.statusDisplay.textContent = '⏸️ 已停止';
        this.statusDisplay.style.color = '#ffff66';
        this.log('⏹️ 檢測已停止', 'warning');
    }

    reset() {
        this.stop();
        this.logs = [];
        this.logPanel.innerHTML = '';
        this.logPanel.className = 'status';
        this.statusDisplay.textContent = '未開始';
        this.statusDisplay.style.color = '#667eea';
        this.landmarksDisplay.textContent = '0/33';
        this.leftHandDisplay.textContent = '-';
        this.rightHandDisplay.textContent = '-';
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.log('🔄 已重置', 'info');
    }

    onResults(results) {
        // 清空畫布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // 更新統計
            const visibleCount = landmarks.filter(l => l.visibility > 0.1).length;
            this.landmarksDisplay.textContent = `${visibleCount}/33`;

            // 檢查手部
            const leftWrist = landmarks[15];  // LEFT_WRIST
            const rightWrist = landmarks[16]; // RIGHT_WRIST

            if (leftWrist && leftWrist.visibility > 0.1) {
                this.leftHandDisplay.textContent = (leftWrist.visibility * 100).toFixed(1) + '%';
            }
            if (rightWrist && rightWrist.visibility > 0.1) {
                this.rightHandDisplay.textContent = (rightWrist.visibility * 100).toFixed(1) + '%';
            }

            // 繪製骨架
            this.drawConnectors(landmarks);
            this.drawLandmarks(landmarks);
        } else {
            this.landmarksDisplay.textContent = '0/33';
            this.leftHandDisplay.textContent = '-';
            this.rightHandDisplay.textContent = '-';
        }
    }

    drawConnectors(landmarks) {
        const connections = [
            [12, 14], [14, 16],      // 右臂
            [11, 13], [13, 15],      // 左臂
            [11, 12],                // 肩膀
            [23, 25], [25, 27],      // 左腿
            [24, 26], [26, 28],      // 右腿
            [23, 24],                // 腰
            [5, 6], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0], [10, 9] // 頭部
        ];

        this.ctx.strokeStyle = '#667eea';
        this.ctx.lineWidth = 2;

        for (const [i, j] of connections) {
            const from = landmarks[i];
            const to = landmarks[j];

            if (from && to && from.visibility > 0.3 && to.visibility > 0.3) {
                const x1 = (1 - from.x) * this.canvas.width;
                const y1 = from.y * this.canvas.height;
                const x2 = (1 - to.x) * this.canvas.width;
                const y2 = to.y * this.canvas.height;

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();
            }
        }
    }

    drawLandmarks(landmarks) {
        landmarks.forEach((landmark, index) => {
            if (landmark.visibility > 0.3) {
                const x = (1 - landmark.x) * this.canvas.width;
                const y = landmark.y * this.canvas.height;

                // 手部用紅色，其他用藍色
                if (index >= 15 && index <= 22) {
                    this.ctx.fillStyle = '#ff6666';
                } else {
                    this.ctx.fillStyle = '#667eea';
                }

                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                this.ctx.fill();
            }
        });
    }
}

// 當頁面加載完成後初始化
window.addEventListener('DOMContentLoaded', () => {
    try {
        new PoseDetector();
    } catch (error) {
        console.error('初始化失敗:', error);
        alert('應用初始化失敗: ' + error.message);
    }
});
