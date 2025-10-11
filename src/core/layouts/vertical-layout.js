function getVerticalLayout() {
    return `
        function verticalLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure) {
            const container = document.getElementById('treeContainer');
            if (!container) {
                console.error('treeContainer element not found');
                return new Map();
            }
            let containerWidth = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientWidth || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);

            const nodeWidthMap = calculateAllNodeWidths(nodes);
            const treeStructure = analyzeTreeStructure(nodes, connections);
            const nodePositions = new Map();

            const leftMargin = LAYOUT_CONSTANTS.LEFT_MARGIN;
            const baseSpacing = LAYOUT_CONSTANTS.BASE_SPACING;
            const edgeClearance = LAYOUT_CONSTANTS.EDGE_CLEARANCE;
            const minLevelSpacing = LAYOUT_CONSTANTS.MIN_LEVEL_SPACING;

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
                    let currentY = y;
                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            setNodePosition(element, leftMargin, currentY);
                            const dimensions = svgHelpers.getNodeDimensions(element);
                            nodePositions.set(node.id, { x: leftMargin, y: currentY, width: dimensions.width, height: dimensions.height });
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                            currentY += dimensions.height + nodeSpacing;
                        }
                    });
                } else {
                    let levelMaxX = leftMargin;

                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            const parents = connections.filter(conn => conn.to === node.id).map(conn => conn.from);

                            if (parents.length > 0) {
                                let selectedParent = null;
                                let minParentLevel = Infinity;
                                let maxParentX = -1;

                                for (const parentId of parents) {
                                    if (nodePositions.has(parentId)) {
                                        let parentLevel = -1;
                                        for (let i = 0; i < treeStructure.levels.length; i++) {
                                            if (treeStructure.levels[i].some(n => n.id === parentId)) {
                                                parentLevel = i;
                                                break;
                                            }
                                        }

                                        const parentPos = nodePositions.get(parentId);

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
                                    const siblings = connections.filter(conn => conn.from === selectedParent).map(conn => conn.to);

                                    const nodeSpacing = calculateNodeSpacing(node.id, connections, true);
                                    let startX = parents.length > 1
                                        ? parentPos.x + parentPos.width + nodeSpacing
                                        : parentPos.x;

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

            // 共通モジュールを使用して衝突を解決
            resolveDashedNodeEdgeCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical: true,
                setNodePosition
            });

            resolveSameLevelCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical: true,
                setNodePosition,
                calculateNodeSpacing
            });

            resolveNodeLabelCollisions({
                treeStructure,
                nodePositions,
                connections,
                constants: LAYOUT_CONSTANTS,
                isVertical: true,
                setNodePosition
            });

            const maxX = Math.max(...Array.from(nodePositions.values()).map(pos => pos.x + pos.width));
            if (maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerWidth) {
                containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
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
