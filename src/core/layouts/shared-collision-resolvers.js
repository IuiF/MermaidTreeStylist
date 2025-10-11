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

        // エッジとノードの衝突を回避（全ノード対象）
        function resolveEdgeNodeCollisions(params) {
            const {
                treeStructure,
                nodePositions,
                connections,
                constants,
                isVertical,
                setNodePosition
            } = params;

            const maxIterations = constants.COLLISION_MAX_ITERATIONS;
            const collisionMargin = constants.COLLISION_MARGIN;
            const baseSpacing = constants.BASE_SPACING;

            for (let iteration = 0; iteration < maxIterations; iteration++) {
                let hasCollision = false;

                connections.forEach(conn => {
                    const fromPos = nodePositions.get(conn.from);
                    const toPos = nodePositions.get(conn.to);

                    if (!fromPos || !toPos) return;

                    let fromLevel = -1, toLevel = -1;
                    treeStructure.levels.forEach((level, idx) => {
                        if (level.some(n => n.id === conn.from)) fromLevel = idx;
                        if (level.some(n => n.id === conn.to)) toLevel = idx;
                    });

                    if (fromLevel === -1 || toLevel === -1 || toLevel <= fromLevel) return;

                    // 長距離エッジは除外（大きなギャップを防ぐ）
                    const levelSpan = toLevel - fromLevel;
                    if (levelSpan >= constants.LONG_DISTANCE_THRESHOLD) return;

                    let edgePathBounds;
                    if (isVertical) {
                        edgePathBounds = {
                            minX: Math.min(fromPos.x, toPos.x),
                            maxX: Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width),
                            minY: fromPos.y,
                            maxY: toPos.y
                        };
                    } else {
                        edgePathBounds = {
                            minX: fromPos.x + fromPos.width,
                            maxX: toPos.x,
                            minY: Math.min(fromPos.y, toPos.y),
                            maxY: Math.max(fromPos.y + fromPos.height, toPos.y + toPos.height)
                        };
                    }

                    // 中間階層のノードをチェック
                    for (let levelIdx = fromLevel + 1; levelIdx < toLevel; levelIdx++) {
                        const level = treeStructure.levels[levelIdx];
                        level.forEach(node => {
                            const nodePos = nodePositions.get(node.id);
                            if (!nodePos) return;

                            const element = document.getElementById(node.id);
                            if (!element || element.classList.contains('hidden')) return;

                            const nodeBounds = {
                                left: nodePos.x - collisionMargin,
                                right: nodePos.x + nodePos.width + collisionMargin,
                                top: nodePos.y - collisionMargin,
                                bottom: nodePos.y + (nodePos.height || 0) + collisionMargin
                            };

                            const edgeBounds = {
                                left: edgePathBounds.minX,
                                right: edgePathBounds.maxX,
                                top: edgePathBounds.minY,
                                bottom: edgePathBounds.maxY
                            };

                            if (checkOverlap(nodeBounds, edgeBounds, isVertical)) {
                                const shiftAmount = isVertical
                                    ? edgePathBounds.maxX - nodeBounds.left + baseSpacing
                                    : edgePathBounds.maxY - nodeBounds.top + baseSpacing;

                                if (window.DEBUG_CONNECTIONS) {
                                    console.log('[EdgeNodeCollision] Shifting ' + node.id + ' by ' + shiftAmount + 'px due to edge ' + conn.from + '->' + conn.to);
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
                    }
                });

                if (!hasCollision) break;
            }
        }

        // 点線ノード専用のエッジ衝突回避
        function resolveDashedNodeEdgeCollisions(params) {
            const {
                treeStructure,
                nodePositions,
                connections,
                constants,
                isVertical,
                setNodePosition
            } = params;

            const maxIterations = constants.DASHED_NODE_MAX_ITERATIONS;
            const collisionMargin = constants.COLLISION_MARGIN;
            const baseSpacing = constants.BASE_SPACING;

            for (let iteration = 0; iteration < maxIterations; iteration++) {
                let hasCollision = false;

                treeStructure.levels.forEach((level, levelIndex) => {
                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (!element || !element.classList.contains('dashed-node')) return;

                        const nodePos = nodePositions.get(node.id);
                        if (!nodePos) return;

                        connections.forEach(conn => {
                            if (conn.isDashed) return;
                            const fromPos = nodePositions.get(conn.from);
                            const toPos = nodePositions.get(conn.to);

                            if (!fromPos || !toPos) return;

                            let fromLevel = -1, toLevel = -1;
                            treeStructure.levels.forEach((lvl, idx) => {
                                if (lvl.some(n => n.id === conn.from)) fromLevel = idx;
                                if (lvl.some(n => n.id === conn.to)) toLevel = idx;
                            });

                            if (fromLevel === -1 || toLevel === -1 || fromLevel >= levelIndex || toLevel <= levelIndex) return;

                            const levelSpan = toLevel - fromLevel;
                            if (levelSpan >= constants.LONG_DISTANCE_THRESHOLD) return;

                            const nodeBounds = {
                                left: nodePos.x - collisionMargin,
                                right: nodePos.x + nodePos.width + collisionMargin,
                                top: nodePos.y - collisionMargin,
                                bottom: nodePos.y + nodePos.height + collisionMargin
                            };

                            const edgeBounds = isVertical ? {
                                left: Math.min(fromPos.x, toPos.x),
                                right: Math.max(fromPos.x + fromPos.width, toPos.x + toPos.width),
                                top: fromPos.y,
                                bottom: toPos.y
                            } : {
                                left: fromPos.x + fromPos.width,
                                right: toPos.x,
                                top: Math.min(fromPos.y, toPos.y),
                                bottom: Math.max(fromPos.y + fromPos.height, toPos.y + toPos.height)
                            };

                            if (checkOverlap(nodeBounds, edgeBounds, isVertical)) {
                                const shiftAmount = isVertical
                                    ? edgeBounds.right - nodeBounds.left + baseSpacing
                                    : edgeBounds.bottom - nodeBounds.top + baseSpacing;

                                if (window.DEBUG_CONNECTIONS) {
                                    console.log('[DashedNodeEdgeCollision] Shifting ' + node.id + ' by ' + shiftAmount + 'px due to edge ' + conn.from + '->' + conn.to);
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
