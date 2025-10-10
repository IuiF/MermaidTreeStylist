function getVerticalLayout() {
    return `
        function verticalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const container = document.getElementById('treeContainer');
            if (!container) {
                console.error('treeContainer element not found');
                return new Map();
            }
            let containerWidth = Math.max(800, container.clientWidth || 800);

            const nodeWidthMap = calculateAllNodeWidths(nodes);
            const treeStructure = analyzeTreeStructure(nodes, connections);
            const nodePositions = new Map();

            const leftMargin = 50;
            const baseSpacing = 60; // 基本スペース
            const edgeClearance = 80; // エッジとノード間のクリアランス
            const minLevelSpacing = 120; // 階層間の最小距離

            // 各階層間の必要な距離を動的に計算
            const levelHeights = [];
            for (let i = 0; i < treeStructure.levels.length - 1; i++) {
                const fromLevel = treeStructure.levels[i];
                const toLevel = treeStructure.levels[i + 1];
                levelHeights[i] = calculateLevelSpacing(fromLevel, toLevel, connections, i, i + 1, treeStructure.levels);
            }

            // 各階層のY座標を計算
            const levelYPositions = [50];
            for (let i = 1; i < treeStructure.levels.length; i++) {
                const height = Math.max(levelHeights[i - 1] || minLevelSpacing, minLevelSpacing);
                levelYPositions[i] = levelYPositions[i - 1] + height + edgeClearance;
            }

            treeStructure.levels.forEach((level, levelIndex) => {
                const y = levelYPositions[levelIndex];

                if (levelIndex === 0) {
                    let currentX = leftMargin;
                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            setNodePosition(element, currentX, y);
                            const dimensions = svgHelpers.getNodeDimensions(element);
                            nodePositions.set(node.id, { x: currentX, y: y, width: dimensions.width });
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                            currentX += dimensions.width + nodeSpacing;
                        }
                    });
                } else {
                    let levelMaxX = leftMargin;

                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            // 全ての親を取得
                            const parents = connections.filter(conn => conn.to === node.id).map(conn => conn.from);

                            if (parents.length > 0) {
                                // 複数の親を持つ場合、最も階層が浅い（ルートに近い）親を優先
                                let selectedParent = null;
                                let minParentLevel = Infinity;
                                let maxParentX = -1;

                                for (const parentId of parents) {
                                    if (nodePositions.has(parentId)) {
                                        // 親の階層を取得
                                        let parentLevel = -1;
                                        for (let i = 0; i < treeStructure.levels.length; i++) {
                                            if (treeStructure.levels[i].some(n => n.id === parentId)) {
                                                parentLevel = i;
                                                break;
                                            }
                                        }

                                        const parentPos = nodePositions.get(parentId);

                                        // 階層が浅い親を優先、同じ階層ならX座標が大きい親を選択
                                        if (parentLevel < minParentLevel ||
                                            (parentLevel === minParentLevel && parentPos.x > maxParentX)) {
                                            minParentLevel = parentLevel;
                                            maxParentX = parentPos.x;
                                            selectedParent = parentId;
                                        }
                                    }
                                }

                                if (selectedParent) {
                                    const parentPos = nodePositions.get(selectedParent);

                                    // 選択された親の子ノードのみを兄弟として扱う
                                    const siblings = connections.filter(conn => conn.from === selectedParent).map(conn => conn.to);

                                    // 複数の親を持つ場合は親の右に、単一の親なら親と同じ位置から
                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                    let startX = parents.length > 1
                                        ? parentPos.x + parentPos.width + nodeSpacing
                                        : parentPos.x;

                                    // 全ての兄弟（自分を除く）の中で最も右にあるノードの右に配置
                                    siblings.forEach(siblingId => {
                                        if (siblingId !== node.id && nodePositions.has(siblingId)) {
                                            const siblingPos = nodePositions.get(siblingId);
                                            const siblingSpacing = calculateNodeSpacing(siblingId, connections, true);
                                            startX = Math.max(startX, siblingPos.x + siblingPos.width + siblingSpacing);
                                        }
                                    });

                                    startX = Math.max(startX, levelMaxX);

                                    setNodePosition(element, startX, y);
                                    const dimensions = svgHelpers.getNodeDimensions(element);
                                    nodePositions.set(node.id, { x: startX, y: y, width: dimensions.width });

                                    levelMaxX = Math.max(levelMaxX, startX + dimensions.width + nodeSpacing);
                                } else {
                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                    setNodePosition(element, levelMaxX, y);
                                    const dimensions = svgHelpers.getNodeDimensions(element);
                                    nodePositions.set(node.id, { x: levelMaxX, y: y, width: dimensions.width });
                                    levelMaxX += dimensions.width + nodeSpacing;
                                }
                            } else {
                                const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                setNodePosition(element, levelMaxX, y);
                                const dimensions = svgHelpers.getNodeDimensions(element);
                                nodePositions.set(node.id, { x: levelMaxX, y: y, width: dimensions.width });
                                levelMaxX += dimensions.width + nodeSpacing;
                            }
                        }
                    });
                }
            });

            // エッジとノードの衝突を検知して回避
            function resolveEdgeNodeCollisions() {
                const maxIterations = 10;
                const collisionMargin = 20;

                for (let iteration = 0; iteration < maxIterations; iteration++) {
                    let hasCollision = false;

                    connections.forEach(conn => {
                        const fromPos = nodePositions.get(conn.from);
                        const toPos = nodePositions.get(conn.to);

                        if (!fromPos || !toPos) return;

                        // 始点と終点の階層を取得
                        let fromLevel = -1, toLevel = -1;
                        treeStructure.levels.forEach((level, idx) => {
                            if (level.some(n => n.id === conn.from)) fromLevel = idx;
                            if (level.some(n => n.id === conn.to)) toLevel = idx;
                        });

                        if (fromLevel === -1 || toLevel === -1 || toLevel <= fromLevel) return;

                        // エッジの経路のX座標範囲を計算
                        const edgeMinX = Math.min(fromPos.x, toPos.x);
                        const edgeMaxX = Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width);

                        // 中間階層のノードをチェック
                        for (let levelIdx = fromLevel + 1; levelIdx < toLevel; levelIdx++) {
                            const level = treeStructure.levels[levelIdx];
                            level.forEach(node => {
                                const nodePos = nodePositions.get(node.id);
                                if (!nodePos) return;

                                const element = document.getElementById(node.id);
                                if (!element || element.classList.contains('hidden')) return;

                                // ノードがエッジの経路内にあるかチェック
                                const nodeLeft = nodePos.x - collisionMargin;
                                const nodeRight = nodePos.x + nodePos.width + collisionMargin;

                                if (nodeLeft < edgeMaxX && nodeRight > edgeMinX) {
                                    // 衝突検出：ノードを右にシフト
                                    const shiftAmount = edgeMaxX - nodeLeft + baseSpacing;
                                    nodePos.x += shiftAmount;
                                    setNodePosition(element, nodePos.x, nodePos.y);
                                    hasCollision = true;
                                }
                            });
                        }
                    });

                    if (!hasCollision) break;
                }
            }

            // resolveEdgeNodeCollisions(); // 一旦無効化

            const maxX = Math.max(...Array.from(nodePositions.values()).map(pos => pos.x + pos.width));
            if (maxX + 100 > containerWidth) {
                containerWidth = maxX + 100;
                container.style.width = containerWidth + 'px';
            }

            // 各階層の最大ノード高さを計算
            const levelMaxHeights = [];
            treeStructure.levels.forEach((level, levelIndex) => {
                let maxHeight = 0;
                level.forEach(node => {
                    const element = document.getElementById(node.id);
                    if (element && !element.classList.contains('hidden')) {
                        const dimensions = svgHelpers.getNodeDimensions(element);
                        maxHeight = Math.max(maxHeight, dimensions.height);
                    }
                });
                levelMaxHeights[levelIndex] = maxHeight;
            });

            // 階層情報をグローバルに保存（エッジレンダラーで使用）
            window.layoutLevelInfo = {
                levelYPositions: levelYPositions,
                levelMaxHeights: levelMaxHeights,
                levelCount: treeStructure.levels.length,
                isVertical: true
            };

            return nodePositions;
        }
    `;
}

module.exports = {
    getVerticalLayout
};