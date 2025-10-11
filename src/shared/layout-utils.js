function getLayoutUtils() {
    return `
        function measureTextWidth(text, font) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = font;
            return context.measureText(text).width;
        }

        function calculateAllNodeWidths(nodes) {
            const padding = 24;
            const nodeWidthMap = new Map();
            const font = '12px Arial, sans-serif';

            nodes.forEach(node => {
                const element = document.getElementById(node.id);
                if (element) {
                    // SVGノードの場合はdata-width属性から取得
                    const dataWidth = element.getAttribute('data-width');
                    if (dataWidth) {
                        nodeWidthMap.set(node.label, parseFloat(dataWidth));
                    } else {
                        // 従来のHTML要素の場合
                        const actualWidth = element.offsetWidth;
                        nodeWidthMap.set(node.label, actualWidth);
                    }
                } else if (!nodeWidthMap.has(node.label)) {
                    const textWidth = measureTextWidth(node.label, font);
                    const calculatedWidth = Math.ceil(textWidth) + padding;
                    nodeWidthMap.set(node.label, calculatedWidth);
                }
            });

            return nodeWidthMap;
        }


        function calculateConnectionLabelSpacing(connections, parentId) {
            const labelFont = '11px Arial, sans-serif';
            const minSpacing = 60;
            const labelPadding = 30;

            let maxLabelWidth = 0;

            connections.forEach(conn => {
                if (conn.from === parentId && conn.label) {
                    const labelWidth = measureTextWidth(conn.label, labelFont);
                    maxLabelWidth = Math.max(maxLabelWidth, labelWidth);
                }
            });

            if (maxLabelWidth > 0) {
                return Math.max(minSpacing, maxLabelWidth + labelPadding);
            }

            return minSpacing;
        }

        function setNodePosition(element, x, y) {
            if (element.tagName === 'g') {
                // SVGノードの場合
                element.setAttribute('transform', 'translate(' + x + ',' + y + ')');
            } else {
                // HTML要素の場合
                element.style.left = x + 'px';
                element.style.top = y + 'px';
            }
        }

        // ノード間のエッジラベル数を計算してスペーシングを決定
        function calculateNodeSpacing(nodeId, connections, isVertical = true) {
            const baseSpacing = 60;
            const incomingEdges = connections.filter(conn => conn.to === nodeId);
            const labelsCount = incomingEdges.filter(conn => conn.label).length;
            if (labelsCount === 0) return baseSpacing;

            const actualLabelHeight = 20;
            const labelVerticalSpacing = 10;

            if (isVertical) {
                // 垂直レイアウト: ラベルは縦に積み重なる
                return baseSpacing + (labelsCount > 0 ? labelsCount * (actualLabelHeight + labelVerticalSpacing) : 0);
            } else {
                // 水平レイアウト: 全ラベルの積み重ね高さを考慮
                const topMargin = 5;
                const totalLabelHeight = actualLabelHeight + topMargin +
                                          (labelsCount - 1) * (actualLabelHeight + labelVerticalSpacing);
                return baseSpacing + totalLabelHeight;
            }
        }

        // 階層間の動的スペーシングを計算
        function calculateLevelSpacing(fromLevel, toLevel, connections, fromLevelIndex, toLevelIndex, allLevels) {
            // このレベル間を通過する全エッジと親ノードを検出
            let passingEdgeCount = 0;
            const passingParentNodes = new Set();

            // 各ノードがどのレベルにあるかのマップを作成
            const nodeToLevel = new Map();
            if (allLevels) {
                allLevels.forEach((level, index) => {
                    level.forEach(node => {
                        nodeToLevel.set(node.id, index);
                    });
                });
            }

            connections.forEach(conn => {
                if (allLevels && fromLevelIndex !== undefined && toLevelIndex !== undefined) {
                    // レベル情報がある場合：通過する全エッジを検出
                    const connFromLevel = nodeToLevel.get(conn.from);
                    const connToLevel = nodeToLevel.get(conn.to);

                    if (connFromLevel !== undefined && connToLevel !== undefined &&
                        connFromLevel <= fromLevelIndex && connToLevel >= toLevelIndex) {
                        passingEdgeCount++;
                        passingParentNodes.add(conn.from);
                    }
                } else {
                    // レベル情報がない場合：従来の直接接続のみ
                    const fromInLevel = fromLevel.find(n => n.id === conn.from);
                    const toInLevel = toLevel.find(n => n.id === conn.to);
                    if (fromInLevel && toInLevel) {
                        passingEdgeCount++;
                        passingParentNodes.add(conn.from);
                    }
                }
            });

            const baseSpacing = 100;
            const edgeIncrement = 3;
            const minSpacing = 80;
            const maxSpacing = 280;

            // エッジレンダラーと同じロジック: max(親ノード数, エッジ数)を使用
            const effectiveLaneCount = Math.max(passingParentNodes.size, passingEdgeCount);

            // Y軸スペーシングはエッジ数に線形比例
            const calculatedSpacing = baseSpacing + edgeIncrement * effectiveLaneCount;

            return Math.max(minSpacing, Math.min(maxSpacing, calculatedSpacing));
        }

        // 兄弟ノードの開始位置を計算
        function calculateSiblingStartPosition(nodeId, parentId, connections, nodePositions, currentPos, fixedSpacing) {
            if (!parentId || !nodePositions.has(parentId)) {
                return currentPos;
            }

            const siblings = connections.filter(conn => conn.from === parentId).map(conn => conn.to);
            const siblingIndex = siblings.indexOf(nodeId);

            let startPos = currentPos;
            for (let i = 0; i < siblingIndex; i++) {
                const siblingId = siblings[i];
                if (nodePositions.has(siblingId)) {
                    const siblingPos = nodePositions.get(siblingId);
                    startPos = Math.max(startPos, siblingPos.endPos + fixedSpacing);
                }
            }

            return Math.max(startPos, currentPos);
        }
    `;
}

module.exports = {
    getLayoutUtils
};