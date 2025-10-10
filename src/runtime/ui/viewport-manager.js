function getViewportManager() {
    return `
        const viewportManager = {
            scale: 1.0,
            translateX: 0,
            translateY: 0,
            isDragging: false,
            startX: 0,
            startY: 0,
            minScale: 0.2,
            maxScale: 6.0,
            initialTouchDistance: 0,
            initialTouchCenter: { x: 0, y: 0 },
            lastTouchCenter: { x: 0, y: 0 },
            wheelHistory: [],
            activePointers: new Map(),
            diagonalUnlocked: false,
            lastValidDeltaX: 0,
            lastValidDeltaY: 0,
            lastWheelTime: 0,
            contentBounds: {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            },

            // ホイールイベント処理：ズーム
            handleWheelZoom: function(e, container) {
                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const worldX = (mouseX - this.translateX) / this.scale;
                const worldY = (mouseY - this.translateY) / this.scale;

                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * delta));

                this.translateX = mouseX - worldX * newScale;
                this.translateY = mouseY - worldY * newScale;
                this.scale = newScale;

                this.applyTransform();
            },

            // 2本指タッチ時のピンチズーム処理
            handlePinchZoom: function(pointers, container) {
                const rect = container.getBoundingClientRect();
                const centerX = this.initialTouchCenter.x - rect.left;
                const centerY = this.initialTouchCenter.y - rect.top;

                const worldX = (centerX - this.translateX) / this.scale;
                const worldY = (centerY - this.translateY) / this.scale;

                const dx = pointers[1].x - pointers[0].x;
                const dy = pointers[1].y - pointers[0].y;
                const currentDistance = Math.sqrt(dx * dx + dy * dy);

                const scaleChange = currentDistance / this.initialTouchDistance;
                const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scaleChange));

                this.translateX = centerX - worldX * newScale;
                this.translateY = centerY - worldY * newScale;
                this.scale = newScale;

                this.initialTouchDistance = currentDistance;
            },

            // 2本指タッチ時のパン処理
            handleTwoFingerPan: function(currentCenter) {
                const panX = currentCenter.x - this.lastTouchCenter.x;
                const panY = currentCenter.y - this.lastTouchCenter.y;

                this.translateX += panX;
                this.translateY += panY;

                this.lastTouchCenter = currentCenter;
            },

            // ホイールイベント処理：パン
            handleWheelPan: function(e) {
                const now = Date.now();

                // 500ms以上間隔が空いたらリセット
                if (now - this.lastWheelTime > 500) {
                    this.diagonalUnlocked = false;
                    this.wheelHistory = [];
                    this.lastValidDeltaX = 0;
                    this.lastValidDeltaY = 0;
                }
                this.lastWheelTime = now;

                // 履歴に追加
                this.wheelHistory.push({
                    time: now,
                    deltaX: e.deltaX,
                    deltaY: e.deltaY
                });

                // 古い履歴を削除
                this.wheelHistory = this.wheelHistory.filter(h => now - h.time < 300);

                let deltaX = e.deltaX;
                let deltaY = e.deltaY;

                // 斜め移動の検出
                const recentEvents = this.wheelHistory.slice(-3);
                const hasRecentX = recentEvents.some(h => Math.abs(h.deltaX) > 0.5);
                const hasRecentY = recentEvents.some(h => Math.abs(h.deltaY) > 0.5);

                if (hasRecentX && hasRecentY && !this.diagonalUnlocked) {
                    this.diagonalUnlocked = true;
                    console.log('Diagonal mode unlocked!');
                }

                // 有効なデルタ値を記録
                if (Math.abs(deltaX) > 0.5) {
                    this.lastValidDeltaX = deltaX;
                }
                if (Math.abs(deltaY) > 0.5) {
                    this.lastValidDeltaY = deltaY;
                }

                // 斜めモードが有効な場合、片方が0でも補完
                if (this.diagonalUnlocked) {
                    const threshold = 0.5;

                    if (Math.abs(this.lastValidDeltaX) > 0 && Math.abs(this.lastValidDeltaY) > 0) {
                        const ratio = Math.abs(this.lastValidDeltaX / this.lastValidDeltaY);

                        if (Math.abs(deltaX) < threshold && Math.abs(deltaY) > threshold) {
                            deltaX = deltaY * ratio * Math.sign(this.lastValidDeltaX);
                            console.log(\`Compensating X: \${deltaX}\`);
                        } else if (Math.abs(deltaY) < threshold && Math.abs(deltaX) > threshold) {
                            deltaY = deltaX / ratio * Math.sign(this.lastValidDeltaY);
                            console.log(\`Compensating Y: \${deltaY}\`);
                        }
                    }
                }

                this.translateX -= deltaX;
                this.translateY -= deltaY;

                this.applyTransform();
            },

            init: function() {
                const container = document.getElementById('treeContainer');
                if (!container) {
                    console.error('treeContainer element not found');
                    return;
                }

                // ホイールイベント
                container.addEventListener('wheel', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    if (e.ctrlKey) {
                        this.handleWheelZoom(e, container);
                    } else {
                        this.handleWheelPan(e);
                    }
                }, { passive: false });

                // Pointer Eventsでマルチタッチ対応
                container.addEventListener('pointerdown', (e) => {
                    this.activePointers.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY
                    });

                    if (this.activePointers.size === 2) {
                        // 2本指の初期状態を記録
                        const pointers = Array.from(this.activePointers.values());
                        const dx = pointers[1].x - pointers[0].x;
                        const dy = pointers[1].y - pointers[0].y;
                        this.initialTouchDistance = Math.sqrt(dx * dx + dy * dy);
                        this.initialTouchCenter = {
                            x: (pointers[0].x + pointers[1].x) / 2,
                            y: (pointers[0].y + pointers[1].y) / 2
                        };
                        this.lastTouchCenter = { ...this.initialTouchCenter };
                    } else if (this.activePointers.size === 1) {
                        // ノード以外の場所をクリックした場合のみドラッグ開始
                        const clickedNode = e.target.closest('.node');
                        if (!clickedNode) {
                            this.isDragging = true;
                            this.startX = e.clientX - this.translateX;
                            this.startY = e.clientY - this.translateY;
                            container.style.cursor = 'grabbing';
                        }
                    }
                });

                container.addEventListener('pointermove', (e) => {
                    if (!this.activePointers.has(e.pointerId)) return;

                    this.activePointers.set(e.pointerId, {
                        x: e.clientX,
                        y: e.clientY
                    });

                    if (this.activePointers.size === 2) {
                        // 2本指操作
                        const pointers = Array.from(this.activePointers.values());
                        const currentCenter = {
                            x: (pointers[0].x + pointers[1].x) / 2,
                            y: (pointers[0].y + pointers[1].y) / 2
                        };

                        // ピンチズーム
                        if (this.initialTouchDistance > 0) {
                            this.handlePinchZoom(pointers, container);
                        }

                        // 2本指パン
                        this.handleTwoFingerPan(currentCenter);

                        this.applyTransform();
                    } else if (this.isDragging) {
                        // 1本指/マウスドラッグ
                        this.translateX = e.clientX - this.startX;
                        this.translateY = e.clientY - this.startY;
                        this.applyTransform();
                    }
                });

                container.addEventListener('pointerup', (e) => {
                    this.activePointers.delete(e.pointerId);

                    if (this.activePointers.size < 2) {
                        this.initialTouchDistance = 0;
                    }

                    if (this.activePointers.size === 0 && this.isDragging) {
                        this.isDragging = false;
                        container.style.cursor = 'grab';
                    }
                });

                container.addEventListener('pointercancel', (e) => {
                    this.activePointers.delete(e.pointerId);
                    if (this.activePointers.size === 0 && this.isDragging) {
                        this.isDragging = false;
                        container.style.cursor = 'grab';
                    }
                });

                // 初期カーソル設定
                container.style.cursor = 'grab';
            },

            applyTransform: function() {
                const contentWrapper = document.getElementById('contentWrapper');
                if (contentWrapper) {
                    contentWrapper.style.transform = \`translate(\${this.translateX}px, \${this.translateY}px) scale(\${this.scale})\`;
                }

                const nodeLayer = document.getElementById('nodeLayer');
                const edgeLayer = document.getElementById('edgeLayer');
                const transform = \`translate(\${this.translateX}, \${this.translateY}) scale(\${this.scale})\`;
                if (nodeLayer) {
                    nodeLayer.setAttribute('transform', transform);
                }
                if (edgeLayer) {
                    edgeLayer.setAttribute('transform', transform);
                }
            },

            resetView: function() {
                // 座標を更新
                this.updateContentBounds();

                // 有効な境界が見つからない場合は何もしない
                if (!isFinite(this.contentBounds.minX) || !isFinite(this.contentBounds.minY)) return;

                // 最も左と最も上の位置が枠内に収まるように配置（スケール1.0固定）
                const margin = 50;
                this.translateX = margin - this.contentBounds.minX;
                this.translateY = margin - this.contentBounds.minY;
                this.scale = 1.0;

                this.applyTransform();
            },

            // 個別ノードから境界を計算
            calculateBoundsFromNodes: function(nodeLayer) {
                const bounds = {
                    minX: Infinity,
                    minY: Infinity,
                    maxX: -Infinity,
                    maxY: -Infinity
                };

                const nodes = nodeLayer.querySelectorAll('.node');
                nodes.forEach(node => {
                    if (node.classList.contains('hidden')) return;
                    const transform = node.getAttribute('transform');
                    if (!transform) return;
                    const match = transform.match(/translate\\(([^,]+),\\s*([^)]+)\\)/);
                    if (!match) return;
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    const width = parseFloat(node.getAttribute('data-width')) || 0;
                    const height = parseFloat(node.getAttribute('data-height')) || 0;
                    bounds.minX = Math.min(bounds.minX, x);
                    bounds.minY = Math.min(bounds.minY, y);
                    bounds.maxX = Math.max(bounds.maxX, x + width);
                    bounds.maxY = Math.max(bounds.maxY, y + height);
                });

                return bounds;
            },

            updateContentBounds: function() {
                const nodeLayer = document.getElementById('nodeLayer');
                const edgeLayer = document.getElementById('edgeLayer');
                if (!nodeLayer) return;

                // 現在のtransformを一時的に保存してリセット
                const nodeTransform = nodeLayer.getAttribute('transform');
                const edgeTransform = edgeLayer ? edgeLayer.getAttribute('transform') : null;
                nodeLayer.setAttribute('transform', '');
                if (edgeLayer) edgeLayer.setAttribute('transform', '');

                // nodeLayer全体のbboxを取得
                try {
                    const bbox = nodeLayer.getBBox();
                    this.contentBounds = {
                        minX: bbox.x,
                        minY: bbox.y,
                        maxX: bbox.x + bbox.width,
                        maxY: bbox.y + bbox.height
                    };
                } catch (e) {
                    this.contentBounds = this.calculateBoundsFromNodes(nodeLayer);
                }

                // transformを元に戻す
                if (nodeTransform) {
                    nodeLayer.setAttribute('transform', nodeTransform);
                }
                if (edgeLayer && edgeTransform) {
                    edgeLayer.setAttribute('transform', edgeTransform);
                }
            },

            fitToContent: function() {
                // 座標を更新
                this.updateContentBounds();

                // 有効な境界が見つからない場合は何もしない
                if (!isFinite(this.contentBounds.minX) || !isFinite(this.contentBounds.minY)) return;

                // 最も左と最も上の位置が枠内に収まるように配置
                const margin = 50;
                this.translateX = margin - this.contentBounds.minX;
                this.translateY = margin - this.contentBounds.minY;
                this.scale = 1.0;

                this.applyTransform();
            },

            fitToView: function() {
                // 座標を更新
                this.updateContentBounds();

                // 有効な境界が見つからない場合は何もしない
                if (!isFinite(this.contentBounds.minX) || !isFinite(this.contentBounds.minY) ||
                    !isFinite(this.contentBounds.maxX) || !isFinite(this.contentBounds.maxY)) {
                    return;
                }

                const container = document.getElementById('treeContainer');
                if (!container) return;

                const containerRect = container.getBoundingClientRect();
                // 実際の表示可能な幅と高さを使用
                const containerWidth = window.innerWidth - containerRect.left;
                const containerHeight = window.innerHeight - containerRect.top;

                // コンテンツのサイズ
                const contentWidth = this.contentBounds.maxX - this.contentBounds.minX;
                const contentHeight = this.contentBounds.maxY - this.contentBounds.minY;

                // マージン
                const margin = 50;

                // 全体が収まるスケールを計算（拡大はしない）
                const scaleX = (containerWidth - margin * 2) / contentWidth;
                const scaleY = (containerHeight - margin * 2) / contentHeight;
                const scale = Math.min(scaleX, scaleY, 1.0);

                // スケール適用後のコンテンツサイズ
                const scaledWidth = contentWidth * scale;
                const scaledHeight = contentHeight * scale;

                // 中央配置
                const centerX = (containerWidth - scaledWidth) / 2;
                const centerY = (containerHeight - scaledHeight) / 2;

                this.translateX = centerX - this.contentBounds.minX * scale;
                this.translateY = centerY - this.contentBounds.minY * scale;
                this.scale = scale;

                this.applyTransform();
            }
        };
    `;
}

module.exports = {
    getViewportManager
};