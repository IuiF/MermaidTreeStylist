function getSharedLayoutCore() {
    return `
        function createLayoutAxis(isVertical) {
            if (isVertical) {
                return {
                    primary: 'x',
                    secondary: 'y',
                    primaryDim: 'width',
                    secondaryDim: 'height',
                    primaryMargin: LAYOUT_CONSTANTS.LEFT_MARGIN,
                    secondaryStart: 50,
                    getPrimary: (pos) => pos.x,
                    getSecondary: (pos) => pos.y,
                    getPrimaryDim: (dim) => dim.width,
                    getSecondaryDim: (dim) => dim.height,
                    setPosition: (element, primary, secondary) => setNodePosition(element, primary, secondary),
                    createPosition: (primary, secondary, width, height) => ({ x: primary, y: secondary, width, height }),
                    getLevelPositions: (treeStructure, connections, minLevelSpacing, edgeClearance, startPos) =>
                        calculateLevelPositions(treeStructure, connections, minLevelSpacing, edgeClearance, startPos),
                    getLevelMaxDims: (treeStructure) => calculateLevelMaxDimensions(treeStructure, true),
                    getContainerSize: (container) => Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientWidth || LAYOUT_CONSTANTS.CONTAINER_DEFAULT),
                    setContainerSize: (container, size) => { container.style.width = size + 'px'; },
                    getLayoutInfo: (levelPositions, levelMaxDims, levelCount) => ({
                        levelYPositions: levelPositions,
                        levelMaxHeights: levelMaxDims,
                        levelCount,
                        isVertical: true
                    })
                };
            } else {
                return {
                    primary: 'y',
                    secondary: 'x',
                    primaryDim: 'height',
                    secondaryDim: 'width',
                    primaryMargin: LAYOUT_CONSTANTS.TOP_MARGIN,
                    secondaryStart: LAYOUT_CONSTANTS.LEFT_MARGIN,
                    getPrimary: (pos) => pos.y,
                    getSecondary: (pos) => pos.x,
                    getPrimaryDim: (dim) => dim.height,
                    getSecondaryDim: (dim) => dim.width,
                    setPosition: (element, primary, secondary) => setNodePosition(element, secondary, primary),
                    createPosition: (primary, secondary, width, height) => ({ x: secondary, y: primary, width, height }),
                    getLevelPositions: (treeStructure, connections, minLevelSpacing, edgeClearance) => {
                        const levelMaxWidths = calculateLevelMaxDimensions(treeStructure, false);
                        const levelSpacings = [];
                        for (let i = 0; i < treeStructure.levels.length - 1; i++) {
                            levelSpacings[i] = calculateLevelSpacing(treeStructure.levels[i], treeStructure.levels[i + 1], connections, i, i + 1, treeStructure.levels);
                        }
                        const positions = [LAYOUT_CONSTANTS.LEFT_MARGIN];
                        for (let i = 1; i < treeStructure.levels.length; i++) {
                            const spacing = Math.max(levelSpacings[i - 1] || minLevelSpacing, minLevelSpacing);
                            positions[i] = positions[i - 1] + levelMaxWidths[i - 1] + spacing + edgeClearance;
                        }
                        return positions;
                    },
                    getLevelMaxDims: (treeStructure) => calculateLevelMaxDimensions(treeStructure, false),
                    getContainerSize: (container) => Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientHeight || LAYOUT_CONSTANTS.CONTAINER_DEFAULT),
                    setContainerSize: (container, size) => { container.style.height = size + 'px'; },
                    getLayoutInfo: (levelPositions, levelMaxDims, levelCount) => ({
                        levelXPositions: levelPositions,
                        levelMaxWidths: levelMaxDims,
                        levelCount
                    })
                };
            }
        }

        function selectParentNode(parents, nodePositions, treeStructure, axis) {
            let selectedParent = null;
            let bestValue = axis.primary === 'x' ? -1 : Infinity;
            let minParentLevel = Infinity;

            for (const parentId of parents) {
                if (nodePositions.has(parentId)) {
                    const parentLevel = findParentLevel(parentId, treeStructure);
                    const parentPos = nodePositions.get(parentId);
                    const currentValue = axis.getPrimary(parentPos);

                    if (axis.primary === 'x') {
                        if (parentLevel < minParentLevel || (parentLevel === minParentLevel && currentValue > bestValue)) {
                            minParentLevel = parentLevel;
                            bestValue = currentValue;
                            selectedParent = parentId;
                        }
                    } else {
                        if (currentValue < bestValue) {
                            bestValue = currentValue;
                            selectedParent = parentId;
                        }
                    }
                }
            }

            return selectedParent;
        }

        function calculateNodeStartPosition(node, selectedParent, parents, nodePositions, connections, axis, currentMax, isVertical) {
            const parentPos = nodePositions.get(selectedParent);
            const siblings = getSiblings(selectedParent, connections);
            const nodeSpacing = calculateNodeSpacing(node.id, connections, isVertical);

            let startPos;
            if (axis.primary === 'x') {
                startPos = parents.length > 1
                    ? axis.getPrimary(parentPos) + axis.getPrimaryDim(parentPos) + nodeSpacing
                    : axis.getPrimary(parentPos);
            } else {
                startPos = axis.getPrimary(parentPos);
            }

            siblings.forEach(siblingId => {
                if (siblingId !== node.id && nodePositions.has(siblingId)) {
                    const siblingPos = nodePositions.get(siblingId);
                    const siblingSpacing = calculateNodeSpacing(siblingId, connections, isVertical);
                    const siblingEnd = axis.getPrimary(siblingPos) + axis.getPrimaryDim(siblingPos) + siblingSpacing;
                    startPos = Math.max(startPos, siblingEnd);
                }
            });

            return Math.max(startPos, currentMax);
        }

        function layoutNodesWithAxis(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure, isVertical) {
            const layoutData = initializeLayout(nodes, connections, calculateAllNodeWidths, analyzeTreeStructure);
            if (!layoutData) return new Map();

            const { container, treeStructure, nodePositions } = layoutData;
            const axis = createLayoutAxis(isVertical);

            let containerSize = axis.getContainerSize(container);
            const edgeClearance = LAYOUT_CONSTANTS.EDGE_CLEARANCE;
            const minLevelSpacing = LAYOUT_CONSTANTS.MIN_LEVEL_SPACING;

            const levelSecondaryPositions = axis.getLevelPositions(treeStructure, connections, minLevelSpacing, edgeClearance, axis.secondaryStart);

            treeStructure.levels.forEach((level, levelIndex) => {
                const secondaryPos = levelSecondaryPositions[levelIndex];

                if (levelIndex === 0 && isVertical) {
                    let currentPrimary = secondaryPos;
                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            axis.setPosition(element, axis.primaryMargin, currentPrimary);
                            const dimensions = svgHelpers.getNodeDimensions(element);
                            nodePositions.set(node.id, axis.createPosition(axis.primaryMargin, currentPrimary, dimensions.width, dimensions.height));
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, isVertical);
                            currentPrimary += axis.getPrimaryDim(dimensions) + nodeSpacing;
                        }
                    });
                } else {
                    let levelMaxPrimary = isVertical && levelIndex !== 0 ? axis.primaryMargin : axis.primaryMargin;

                    level.forEach(node => {
                        const element = document.getElementById(node.id);
                        if (element && !element.classList.contains('hidden')) {
                            const parents = getParents(node.id, connections);
                            const nodeSpacing = calculateNodeSpacing(node.id, connections, isVertical);
                            const dimensions = svgHelpers.getNodeDimensions(element);

                            let primaryPos;

                            if (parents.length > 0) {
                                const selectedParent = selectParentNode(parents, nodePositions, treeStructure, axis);

                                if (selectedParent) {
                                    primaryPos = calculateNodeStartPosition(node, selectedParent, parents, nodePositions, connections, axis, levelMaxPrimary, isVertical);
                                } else {
                                    primaryPos = levelMaxPrimary;
                                }
                            } else {
                                primaryPos = levelMaxPrimary;
                            }

                            axis.setPosition(element, primaryPos, secondaryPos);
                            nodePositions.set(node.id, axis.createPosition(primaryPos, secondaryPos, dimensions.width, dimensions.height));

                            levelMaxPrimary = Math.max(levelMaxPrimary, primaryPos + axis.getPrimaryDim(dimensions) + nodeSpacing);
                        }
                    });
                }
            });

            resolveAllCollisions({
                treeStructure,
                nodePositions,
                connections,
                isVertical,
                setNodePosition,
                calculateNodeSpacing
            });

            if (nodePositions.size > 0) {
                const positions = Array.from(nodePositions.values());
                const maxPrimary = Math.max(...positions.map(pos => axis.getPrimary(pos) + axis.getPrimaryDim(pos)));

                if (isVertical) {
                    const maxSecondary = Math.max(...positions.map(pos => axis.getSecondary(pos) + axis.getSecondaryDim(pos)));
                    if (maxPrimary + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerSize) {
                        containerSize = maxPrimary + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                        axis.setContainerSize(container, containerSize);
                    }
                } else {
                    const maxY = Math.max(...positions.map(pos => pos.y + pos.height));
                    const maxX = Math.max(...positions.map(pos => pos.x + pos.width));

                    if (maxY + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerSize) {
                        containerSize = maxY + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                        axis.setContainerSize(container, containerSize);
                    }

                    let containerWidth = Math.max(LAYOUT_CONSTANTS.CONTAINER_DEFAULT, container.clientWidth || LAYOUT_CONSTANTS.CONTAINER_DEFAULT);
                    if (maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN > containerWidth) {
                        containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_MARGIN;
                        container.style.width = containerWidth + 'px';
                    }
                }
            }

            const levelMaxDims = axis.getLevelMaxDims(treeStructure);
            window.layoutLevelInfo = axis.getLayoutInfo(levelSecondaryPositions, levelMaxDims, treeStructure.levels.length);

            return nodePositions;
        }
    `;
}

module.exports = {
    getSharedLayoutCore
};
