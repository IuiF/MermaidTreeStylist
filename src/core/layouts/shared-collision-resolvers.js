function getCollisionResolvers() {
    return `
        function createAxisHelpers(isVertical) {
            return {
                getPrimary: (pos) => isVertical ? pos.x : pos.y,
                getSecondary: (pos) => isVertical ? pos.y : pos.x,
                getPrimaryDim: (pos) => isVertical ? pos.width : pos.height,
                getSecondaryDim: (pos) => isVertical ? pos.height : pos.width,
                updatePosition: (element, pos, shift) => {
                    if (isVertical) {
                        pos.x += shift;
                    } else {
                        pos.y += shift;
                    }
                }
            };
        }

        function checkOverlap(bounds1, bounds2, isVertical) {
            if (isVertical) {
                const xOverlap = bounds1.left < bounds2.right && bounds1.right > bounds2.left;
                const yOverlap = !(bounds2.bottom < bounds1.top || bounds2.top > bounds1.bottom);
                return xOverlap && yOverlap;
            } else {
                const yOverlap = bounds1.top < bounds2.bottom && bounds1.bottom > bounds2.top;
                const xOverlap = !(bounds2.right < bounds1.left || bounds2.left > bounds1.right);
                return xOverlap && yOverlap;
            }
        }

        // エッジとノードの衝突を解決する共通関数
        function resolveEdgeNodeCollisionsCore(params, targetDashedNodes) {
            const {
                treeStructure,
                nodePositions,
                connections,
                constants,
                isVertical,
                setNodePosition
            } = params;

            const maxIterations = targetDashedNodes ? constants.DASHED_NODE_MAX_ITERATIONS : constants.COLLISION_MAX_ITERATIONS;
            const collisionMargin = constants.COLLISION_MARGIN;
            const baseSpacing = constants.BASE_SPACING;

            // レベルインデックスをキャッシュ
            const nodeLevelMap = new Map();
            treeStructure.levels.forEach((level, idx) => {
                level.forEach(n => nodeLevelMap.set(n.id, idx));
            });

            for (let iteration = 0; iteration < maxIterations; iteration++) {
                let hasCollision = false;

                if (targetDashedNodes) {
                    // 点線ノードのみを対象
                    treeStructure.levels.forEach((level, levelIndex) => {
                        level.forEach(node => {
                            const element = document.getElementById(node.id);
                            if (!element || !element.classList.contains('dashed-node')) return;

                            const nodePos = nodePositions.get(node.id);
                            if (!nodePos) return;

                            connections.forEach(conn => {
                                if (conn.isDashed) return;
                                if (processCollision(conn, node, nodePos, element, levelIndex, nodeLevelMap, nodePositions, isVertical, collisionMargin, baseSpacing, setNodePosition, '[DashedNodeEdgeCollision]')) {
                                    hasCollision = true;
                                }
                            });
                        });
                    });
                } else {
                    // 全ノードを対象（中間レベルのみチェック）
                    connections.forEach(conn => {
                        const fromPos = nodePositions.get(conn.from);
                        const toPos = nodePositions.get(conn.to);
                        if (!fromPos || !toPos) return;

                        const fromLevel = nodeLevelMap.get(conn.from);
                        const toLevel = nodeLevelMap.get(conn.to);
                        if (fromLevel === undefined || toLevel === undefined || toLevel <= fromLevel) return;

                        const levelSpan = toLevel - fromLevel;
                        if (levelSpan >= constants.LONG_DISTANCE_THRESHOLD) return;

                        const edgePathBounds = calculateEdgeBounds(fromPos, toPos, isVertical);

                        for (let levelIdx = fromLevel + 1; levelIdx < toLevel; levelIdx++) {
                            treeStructure.levels[levelIdx].forEach(node => {
                                const nodePos = nodePositions.get(node.id);
                                if (!nodePos) return;

                                const element = document.getElementById(node.id);
                                if (!element || element.classList.contains('hidden')) return;

                                if (checkNodeEdgeCollision(nodePos, edgePathBounds, collisionMargin, isVertical)) {
                                    const shiftAmount = calculateShiftAmount(edgePathBounds, nodePos, collisionMargin, baseSpacing, isVertical);

                                    if (window.DEBUG_CONNECTIONS) {
                                        console.log('[EdgeNodeCollision] Shifting ' + node.id + ' by ' + shiftAmount + 'px due to edge ' + conn.from + '->' + conn.to);
                                    }

                                    applyShift(nodePos, shiftAmount, isVertical);
                                    setNodePosition(element, nodePos.x, nodePos.y);
                                    hasCollision = true;
                                }
                            });
                        }
                    });
                }

                if (!hasCollision) break;
            }
        }

        // エッジの境界を計算
        function calculateEdgeBounds(fromPos, toPos, isVertical) {
            return isVertical ? {
                minX: Math.min(fromPos.x, toPos.x),
                maxX: Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width),
                minY: fromPos.y,
                maxY: toPos.y
            } : {
                minX: fromPos.x + fromPos.width,
                maxX: toPos.x,
                minY: Math.min(fromPos.y, toPos.y),
                maxY: Math.max(fromPos.y + fromPos.height, toPos.y + fromPos.height)
            };
        }

        // ノードとエッジの衝突をチェック
        function checkNodeEdgeCollision(nodePos, edgeBounds, margin, isVertical) {
            const nodeBounds = {
                left: nodePos.x - margin,
                right: nodePos.x + nodePos.width + margin,
                top: nodePos.y - margin,
                bottom: nodePos.y + (nodePos.height || 0) + margin
            };
            const bounds = {
                left: edgeBounds.minX,
                right: edgeBounds.maxX,
                top: edgeBounds.minY,
                bottom: edgeBounds.maxY
            };
            return checkOverlap(nodeBounds, bounds, isVertical);
        }

        // シフト量を計算
        function calculateShiftAmount(edgeBounds, nodePos, margin, spacing, isVertical) {
            return isVertical
                ? edgeBounds.maxX - (nodePos.x - margin) + spacing
                : edgeBounds.maxY - (nodePos.y - margin) + spacing;
        }

        // シフトを適用
        function applyShift(nodePos, amount, isVertical) {
            if (isVertical) {
                nodePos.x += amount;
            } else {
                nodePos.y += amount;
            }
        }

        // 点線ノードの衝突処理
        function processCollision(conn, node, nodePos, element, levelIndex, nodeLevelMap, nodePositions, isVertical, margin, spacing, setNodePosition, debugPrefix) {
            const fromPos = nodePositions.get(conn.from);
            const toPos = nodePositions.get(conn.to);
            if (!fromPos || !toPos) return false;

            const fromLevel = nodeLevelMap.get(conn.from);
            const toLevel = nodeLevelMap.get(conn.to);
            if (fromLevel === undefined || toLevel === undefined || fromLevel >= levelIndex || toLevel <= levelIndex) return false;

            const edgeBounds = calculateEdgeBounds(fromPos, toPos, isVertical);
            if (checkNodeEdgeCollision(nodePos, edgeBounds, margin, isVertical)) {
                const shiftAmount = calculateShiftAmount(edgeBounds, nodePos, margin, spacing, isVertical);

                if (window.DEBUG_CONNECTIONS) {
                    console.log(debugPrefix + ' Shifting ' + node.id + ' by ' + shiftAmount + 'px due to edge ' + conn.from + '->' + conn.to);
                }

                applyShift(nodePos, shiftAmount, isVertical);
                setNodePosition(element, nodePos.x, nodePos.y);
                return true;
            }
            return false;
        }

        // エッジとノードの衝突を回避（全ノード対象）
        function resolveEdgeNodeCollisions(params) {
            resolveEdgeNodeCollisionsCore(params, false);
        }

        // 点線ノード専用のエッジ衝突回避
        function resolveDashedNodeEdgeCollisions(params) {
            resolveEdgeNodeCollisionsCore(params, true);
        }

        // 同じ階層内のノード同士の重なりを解消
        function resolveSameLevelCollisions(params) {
            const {
                treeStructure,
                nodePositions,
                connections,
                isVertical,
                setNodePosition,
                calculateNodeSpacing
            } = params;

            treeStructure.levels.forEach((level, levelIndex) => {
                const levelNodes = level.map(node => ({
                    node: node,
                    pos: nodePositions.get(node.id)
                })).filter(item => item.pos).sort((a, b) => {
                    return isVertical ? (a.pos.x - b.pos.x) : (a.pos.y - b.pos.y);
                });

                for (let i = 0; i < levelNodes.length - 1; i++) {
                    const current = levelNodes[i];
                    const next = levelNodes[i + 1];

                    const nodeSpacing = calculateNodeSpacing(next.node.id, connections, isVertical);

                    if (isVertical) {
                        const currentRight = current.pos.x + current.pos.width;
                        const nextLeft = next.pos.x;

                        if (currentRight + nodeSpacing > nextLeft) {
                            const currentTop = current.pos.y;
                            const currentBottom = current.pos.y + (current.pos.height || 0);
                            const nextTop = next.pos.y;
                            const nextBottom = next.pos.y + (next.pos.height || 0);

                            const yOverlap = !(currentBottom < nextTop || currentTop > nextBottom);

                            if (yOverlap) {
                                const shiftAmount = currentRight + nodeSpacing - nextLeft;
                                next.pos.x += shiftAmount;
                                const element = document.getElementById(next.node.id);
                                if (element) {
                                    setNodePosition(element, next.pos.x, next.pos.y);
                                }

                                for (let j = i + 2; j < levelNodes.length; j++) {
                                    levelNodes[j].pos.x += shiftAmount;
                                    const elem = document.getElementById(levelNodes[j].node.id);
                                    if (elem) {
                                        setNodePosition(elem, levelNodes[j].pos.x, levelNodes[j].pos.y);
                                    }
                                }
                            }
                        }
                    } else {
                        const currentBottom = current.pos.y + current.pos.height;
                        const nextTop = next.pos.y;

                        if (currentBottom + nodeSpacing > nextTop) {
                            const shiftAmount = currentBottom + nodeSpacing - nextTop;
                            next.pos.y += shiftAmount;
                            const element = document.getElementById(next.node.id);
                            if (element) {
                                setNodePosition(element, next.pos.x, next.pos.y);
                            }

                            for (let j = i + 2; j < levelNodes.length; j++) {
                                levelNodes[j].pos.y += shiftAmount;
                                const elem = document.getElementById(levelNodes[j].node.id);
                                if (elem) {
                                    setNodePosition(elem, levelNodes[j].pos.x, levelNodes[j].pos.y);
                                }
                            }
                        }
                    }
                }
            });
        }

        // ノードとエッジラベルの衝突を検出して回避
        function resolveNodeLabelCollisions(params) {
            const {
                treeStructure,
                nodePositions,
                connections,
                constants,
                isVertical,
                setNodePosition
            } = params;

            const maxIterations = constants.LABEL_MAX_ITERATIONS;
            const collisionMargin = constants.LABEL_COLLISION_MARGIN;
            const estimatedLabelHeight = constants.LABEL_ESTIMATED_HEIGHT;
            const labelVerticalSpacing = constants.LABEL_VERTICAL_SPACING;
            const labelTopMargin = constants.LABEL_TOP_MARGIN;
            const baseSpacing = constants.BASE_SPACING;

            for (let iteration = 0; iteration < maxIterations; iteration++) {
                let hasCollision = false;

                const labelCountByTarget = {};
                connections.forEach(conn => {
                    if (conn.label && !conn.isDashed) {
                        if (!labelCountByTarget[conn.to]) {
                            labelCountByTarget[conn.to] = 0;
                        }
                        labelCountByTarget[conn.to]++;
                    }
                });

                const predictedLabelBounds = [];
                const labelOffsets = {};

                connections.forEach(conn => {
                    if (!conn.label || conn.isDashed) return;

                    const toPos = nodePositions.get(conn.to);
                    if (!toPos) return;

                    const toElement = document.getElementById(conn.to);
                    if (!toElement || toElement.classList.contains('hidden')) return;

                    if (!labelOffsets[conn.to]) {
                        labelOffsets[conn.to] = 0;
                    }
                    const offset = labelOffsets[conn.to];
                    labelOffsets[conn.to]++;

                    const labelLeft = toPos.x;
                    const labelTop = toPos.y - estimatedLabelHeight - labelTopMargin - (offset * (estimatedLabelHeight + labelVerticalSpacing));
                    const labelWidth = constants.LABEL_ESTIMATED_WIDTH;
                    const labelHeight = estimatedLabelHeight;

                    predictedLabelBounds.push({
                        from: conn.from,
                        to: conn.to,
                        left: labelLeft,
                        top: labelTop,
                        right: labelLeft + labelWidth,
                        bottom: labelTop + labelHeight
                    });
                });

                treeStructure.levels.forEach((level, levelIndex) => {
                    level.forEach(node => {
                        const nodePos = nodePositions.get(node.id);
                        if (!nodePos) return;

                        const element = document.getElementById(node.id);
                        if (!element || element.classList.contains('hidden')) return;

                        const nodeBounds = {
                            left: nodePos.x - collisionMargin,
                            right: nodePos.x + nodePos.width + collisionMargin,
                            top: nodePos.y - collisionMargin,
                            bottom: nodePos.y + nodePos.height + collisionMargin
                        };

                        predictedLabelBounds.forEach(label => {
                            if (label.to === node.id) return;

                            if (checkOverlap(nodeBounds, label, isVertical)) {
                                const shiftAmount = isVertical
                                    ? label.right + collisionMargin - nodePos.x + baseSpacing
                                    : label.bottom + collisionMargin - nodePos.y + baseSpacing;

                                if (window.DEBUG_CONNECTIONS) {
                                    console.log('[NodeLabelCollision] Shifting ' + node.id + ' by ' + shiftAmount + 'px due to label from ' + label.from + ' to ' + label.to);
                                }

                                if (isVertical) {
                                    nodePos.x += shiftAmount;
                                } else {
                                    nodePos.y += shiftAmount;
                                }
                                setNodePosition(element, nodePos.x, nodePos.y);
                                hasCollision = true;
                            }
                        });
                    });
                });

                if (!hasCollision) break;
            }
        }
    `;
}

module.exports = {
    getCollisionResolvers
};
