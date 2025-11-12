function getConnectionRenderer() {
    const connectionLabels = require('./labels').getConnectionLabels();
    const verticalSegmentCalculator = require('./vertical-segment-calculator').getVerticalSegmentCalculator();
    const edgeCrossingDetector = require('./edge-crossing-detector').getEdgeCrossingDetector();

    return connectionLabels + verticalSegmentCalculator + edgeCrossingDetector + `
        // 矢印描画関数
        function createArrow(x1, y1, x2, y2, conn) {
            const angle = Math.atan2(y2 - y1, x2 - x1);
            const arrowSize = 8;
            const arrowX = x2;
            const arrowY = y2;

            const p1x = arrowX;
            const p1y = arrowY;
            const p2x = arrowX - arrowSize * Math.cos(angle - Math.PI / 6);
            const p2y = arrowY - arrowSize * Math.sin(angle - Math.PI / 6);
            const p3x = arrowX - arrowSize * Math.cos(angle + Math.PI / 6);
            const p3y = arrowY - arrowSize * Math.sin(angle + Math.PI / 6);

            return svgHelpers.createPolygon(\`\${p1x},\${p1y} \${p2x},\${p2y} \${p3x},\${p3y}\`, {
                class: 'connection-arrow',
                'data-from': conn.from,
                'data-to': conn.to
            });
        }

        function createHorizontalArrow(x2, y2, conn) {
            const angle = 0;
            const arrowSize = 8;

            const p1x = x2;
            const p1y = y2;
            const p2x = x2 - arrowSize * Math.cos(angle - Math.PI / 6);
            const p2y = y2 - arrowSize * Math.sin(angle - Math.PI / 6);
            const p3x = x2 - arrowSize * Math.cos(angle + Math.PI / 6);
            const p3y = y2 - arrowSize * Math.sin(angle + Math.PI / 6);

            return svgHelpers.createPolygon(\`\${p1x},\${p1y} \${p2x},\${p2y} \${p3x},\${p3y}\`, {
                class: 'connection-arrow',
                'data-from': conn.from,
                'data-to': conn.to
            });
        }

        // 依存: svgHelpers (svg-helpers.js), getNodePosition, getNodeDimensions (layout-utils.js)
        let useCurvedLines = false;

        window.toggleLineStyle = function() {
            useCurvedLines = !useCurvedLines;
            return useCurvedLines;
        }

        window.createCSSLines = function(connections, nodePositions) {
            // エッジをレベル差でソート（長いエッジを先に描画して背面に配置）
            const sortedConnections = [...connections].sort((a, b) => {
                const posA = nodePositions[a.from];
                const posB = nodePositions[b.from];
                const posATo = nodePositions[a.to];
                const posBTo = nodePositions[b.to];

                if (!posA || !posB || !posATo || !posBTo) return 0;

                const levelDiffA = Math.abs(posATo.level - posA.level);
                const levelDiffB = Math.abs(posBTo.level - posB.level);

                return levelDiffB - levelDiffA; // 降順（長いエッジが先）
            });

            if (useCurvedLines) {
                return createCurvedLines(sortedConnections, nodePositions);
            }
            return createStraightLines(sortedConnections, nodePositions);
        }

        // ノードの階層（深さ）を計算

        // 曲線パスを生成
        function createCurvedPath(pathParams) {
            const {
                x1, y1, x2, y2,
                verticalSegmentX,
                labelBounds,
                nodeBounds,
                connFrom,
                connTo,
                fromNodeLeft,
                finalVerticalX,
                yAdjustment,
                secondVerticalX,
                crossings
            } = pathParams;

            const cornerRadius = CONNECTION_CONSTANTS.CORNER_RADIUS;

            // 制御点を計算
            const p1x = x1;
            const p1y = y1;
            let p2x = verticalSegmentX;
            let p2y = y1;
            let p3x = p2x;
            let p3y = y2;
            // 最終垂直セグメントは垂直線と同じX座標（ノード左端への長い水平線を回避）
            const p4x = finalVerticalX !== undefined ? finalVerticalX : verticalSegmentX;
            let p4y = y2;

            // 最初の水平線セグメントのY座標調整
            p2y = pathYAdjuster.adjustInitialSegmentY(p1x, p1y, p2x, fromNodeLeft, nodeBounds, connFrom, connTo);

            // Y調整情報がある場合は、事前計算済みの値を使用
            let finalAdjustedY = null;
            if (yAdjustment && yAdjustment.needsAdjustment) {
                finalAdjustedY = yAdjustment.adjustedY;
                p3y = finalAdjustedY;
                p4y = finalAdjustedY;
            }

            // pathGeneratorを使用してSVGパスを生成
            const points = {
                p1: { x: p1x, y: p1y },
                p2: { x: p2x, y: p2y },
                p3: { x: p3x, y: p3y },
                p4: { x: p4x, y: p4y },
                end: { x: x2, y: y2 }
            };

            // 2本目の垂直セグメントX座標が指定されている場合は追加
            if (secondVerticalX !== undefined) {
                points.secondVerticalX = secondVerticalX;
            }

            return pathGenerator.generateCurvedPath(points, cornerRadius, crossings);
        }

        // 点線スタイルを適用
        function applyDashedStyle(element, conn) {
            if (conn.isDashed) {
                element.style.strokeDasharray = '5,5';
                element.style.opacity = '0.6';
            }
        }

        // ノードが表示されているかチェック
        function areNodesVisible(fromElement, toElement) {
            return fromElement && toElement &&
                   !fromElement.classList.contains('hidden') &&
                   !toElement.classList.contains('hidden');
        }

        function createStraightLines(connections, nodePositions) {
            const svgLayer = svgHelpers.getEdgeLayer();
            if (!svgLayer) {
                console.error('SVG layer element not found');
                return;
            }

            // デバッグ
            if (window.DEBUG_CONNECTIONS) {
                console.log('createStraightLines called with ' + connections.length + ' connections');
                const dashedCount = connections.filter(c => c.isDashed).length;
                console.log('  - Dashed connections: ' + dashedCount);
            }

            // 既存の接続線とラベルを削除
            const existingLines = svgLayer.querySelectorAll('.connection-line, .connection-arrow, .connection-label');
            existingLines.forEach(line => line.remove());

            // ラベルオフセットをリセット
            labelOffsets = {};

            let connectionCount = 0;
            connections.forEach(conn => {
                const fromElement = svgHelpers.getNodeElement(conn.from);
                const toElement = svgHelpers.getNodeElement(conn.to);

                if (window.DEBUG_CONNECTIONS && conn.isDashed) {
                    console.log('  Straight edge ' + conn.from + ' --> ' + conn.to + ':',
                        'from:', !!fromElement, fromElement ? !fromElement.classList.contains('hidden') : 'N/A',
                        'to:', !!toElement, toElement ? !toElement.classList.contains('hidden') : 'N/A');
                }

                // 両端のノードが存在し、かつ表示されている場合のみ接続線を描画
                if (areNodesVisible(fromElement, toElement)) {

                    // ノードの位置と寸法を取得
                    const fromPos = svgHelpers.getNodePosition(fromElement);
                    const fromDim = svgHelpers.getNodeDimensions(fromElement);
                    const fromLeft = fromPos.left;
                    const fromTop = fromPos.top;
                    const fromWidth = fromDim.width;
                    const fromHeight = fromDim.height;

                    const toPos = svgHelpers.getNodePosition(toElement);
                    const toDim = svgHelpers.getNodeDimensions(toElement);
                    const toLeft = toPos.left;
                    const toTop = toPos.top;
                    const toWidth = toDim.width;
                    const toHeight = toDim.height;

                    const x1 = fromLeft + fromWidth;
                    const y1 = fromTop + fromHeight / 2;
                    const x2 = toLeft;
                    const y2 = toTop + toHeight / 2;

                    // SVG line要素を作成
                    const line = svgHelpers.createLine({
                        class: conn.isDashed ? 'connection-line dashed-edge' : 'connection-line',
                        x1: x1,
                        y1: y1,
                        x2: x2,
                        y2: y2,
                        'data-from': conn.from,
                        'data-to': conn.to
                    });

                    applyDashedStyle(line, conn);

                    svgLayer.appendChild(line);

                    // 矢印を作成
                    const arrow = createArrow(x1, y1, x2, y2, conn);
                    svgLayer.appendChild(arrow);
                    connectionCount++;

                    // ラベルがある場合は表示
                    const labelGroup = createConnectionLabel(conn, toElement);
                    if (labelGroup) {
                        svgLayer.appendChild(labelGroup);
                    }
                }
            });

            // すべてのラベルを最前面に移動
            const labels = svgLayer.querySelectorAll('.connection-label');
            labels.forEach(label => {
                svgLayer.appendChild(label);
            });
        }

        function createCurvedLines(connections, nodePositions) {
            // 点線エッジ用のノードバウンドフィルタリング
            function filterNodeBoundsForDashedEdge(nodeBounds, edge) {
                if (!edge.isDashed) {
                    return nodeBounds;
                }

                return nodeBounds.filter(n => {
                    const isDashedNode = n.id.includes('_dashed_');
                    if (!isDashedNode) return true;
                    if (n.id === edge.to) return true;

                    const sourceId = edge.from;
                    const targetBaseId = edge.to.includes('_dashed_') ? edge.to.split('_dashed_')[0] : edge.to;
                    const relatedToSource = n.id.startsWith(sourceId + '_dashed_') || n.id.endsWith('_dashed_' + sourceId);
                    const relatedToTarget = n.id.startsWith(targetBaseId + '_dashed_') || n.id.endsWith('_dashed_' + targetBaseId);

                    return !(relatedToSource || relatedToTarget);
                });
            }

            // Phase 0: SVGレイヤー初期化とクリーンアップ
            function initializeAndClearSVGLayer() {
                const svgLayer = svgHelpers.getEdgeLayer();
                if (!svgLayer) {
                    console.error('SVG layer element not found');
                    return null;
                }

                if (window.DEBUG_CONNECTIONS) {
                    console.log('createCurvedLines called with ' + connections.length + ' connections');
                    const dashedCount = connections.filter(c => c.isDashed).length;
                    console.log('  - Dashed connections: ' + dashedCount);
                }

                const existingLines = svgLayer.querySelectorAll('.connection-line, .connection-arrow, .connection-label');
                existingLines.forEach(line => line.remove());
                labelOffsets = {};

                return svgLayer;
            }

            // Phase 1: ラベル描画
            function renderAllLabels(connections, svgLayer) {
                // 表示されるエッジのみをフィルタリング
                const visibleConnections = connections.filter(conn => {
                    const fromElement = svgHelpers.getNodeElement(conn.from);
                    const toElement = svgHelpers.getNodeElement(conn.to);
                    if (!areNodesVisible(fromElement, toElement)) {
                        return false;
                    }

                    // collapseManagerのisEdgeVisibleを使用して折りたたみ状態を考慮
                    if (typeof collapseManager !== 'undefined' && !collapseManager.isEdgeVisible(conn)) {
                        return false;
                    }
                    return true;
                });

                // 表示されるエッジのみでラベルを描画
                visibleConnections.forEach(conn => {
                    const toElement = svgHelpers.getNodeElement(conn.to);
                    const labelGroup = createConnectionLabel(conn, toElement);
                    if (labelGroup) {
                        svgLayer.appendChild(labelGroup);
                    }
                });
            }

            // 衝突判定: Y調整が必要なエッジを検出
            function detectCollisions(edgeInfos, parentFinalVerticalSegmentX, edgeToFinalVerticalX) {
                const edgeToYAdjustment = {};

                edgeInfos.forEach(edgeInfo => {
                    if (edgeInfo.is1to1Horizontal) return;

                    const verticalSegmentX = parentFinalVerticalSegmentX[edgeInfo.conn.from] || edgeInfo.x1 + CONNECTION_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                    const edgeKey = connectionUtils.createEdgeKey(edgeInfo.conn.from, edgeInfo.conn.to);
                    const finalVerticalX = edgeToFinalVerticalX[edgeKey];
                    const p4x = finalVerticalX !== undefined ? finalVerticalX : verticalSegmentX;

                    const nodeBounds = getAllNodeBounds(edgeInfo.conn.from, edgeInfo.conn.to);
                    const filteredBounds = filterNodeBoundsForDashedEdge(nodeBounds, edgeInfo.conn);

                    const adjustedY = pathYAdjuster.adjustFinalSegmentY(p4x, edgeInfo.y2, edgeInfo.x2, filteredBounds, edgeInfo.conn.from, edgeInfo.conn.to);
                    if (adjustedY !== null) {
                        edgeToYAdjustment[edgeKey] = {
                            originalY: edgeInfo.y2,
                            adjustedY: adjustedY,
                            needsAdjustment: true
                        };
                    }
                });

                return edgeToYAdjustment;
            }

            // Phase 2: レイアウト計算
            function calculateEdgeLayout(connections, labelBounds) {
                const minOffset = CONNECTION_CONSTANTS.MIN_OFFSET;
                const nodeDepths = connectionUtils.calculateNodeDepths(connections);
                const connectionsByParent = connectionUtils.sortConnectionsByParent(connections);
                const edgeInfos = edgeInfoCollector.collectEdgeInfos(connections, nodeDepths, connectionsByParent);

                edgeInfos.sort((a, b) => a.parentX - b.parentX);

                const parentYPositions = connectionUtils.calculateParentYPositions(edgeInfos);

                // LayoutResultのmetadataからlevelInfoを取得
                if (!window.currentLayoutResult || !window.currentLayoutResult.metadata) {
                    console.error('[Renderer] LayoutResult not found');
                    return { edgeInfos: [], parentFinalVerticalSegmentX: {}, edgeToFinalVerticalX: {}, edgeToYAdjustment: {}, edgeToSecondVerticalX: {}, edgeCrossings: {} };
                }
                const levelInfo = { ...window.currentLayoutResult.metadata };

                const depthBounds = depthCalculator.calculateDepthBounds(edgeInfos, levelInfo);

                // 垂直セグメント計算の共通オプション
                const verticalSegmentOptions = {
                    parentYPositions: parentYPositions,
                    depthMaxParentRight: depthBounds.depthMaxParentRight,
                    depthMinChildLeft: depthBounds.depthMinChildLeft,
                    labelBounds: labelBounds,
                    getAllNodeBounds: getAllNodeBounds,
                    calculateNodeAvoidanceOffset: calculateNodeAvoidanceOffset,
                    calculateLabelAvoidanceOffset: calculateLabelAvoidanceOffset,
                    minOffset: minOffset
                };

                // 第1段階: 初回計算（衝突回避エッジなし）
                let parentFinalVerticalSegmentX = verticalSegmentCalculator.calculateVerticalSegmentX(edgeInfos, verticalSegmentOptions);

                const edgeToFinalVerticalX = {};

                // ノードのdepthマップを作成（全エッジから）
                const nodeDepthMap = {};
                edgeInfos.forEach(edgeInfo => {
                    nodeDepthMap[edgeInfo.conn.from] = edgeInfo.depth;
                });

                // 衝突判定: Y調整が必要なエッジを検出
                const edgeToYAdjustment = detectCollisions(edgeInfos, parentFinalVerticalSegmentX, edgeToFinalVerticalX);

                // 第2段階: 衝突回避エッジを含めて再計算
                if (Object.keys(edgeToYAdjustment).length > 0) {
                    if (window.DEBUG_CONNECTIONS) {
                        console.log('[Renderer] Recalculating with', Object.keys(edgeToYAdjustment).length, 'collision avoidance edges');
                    }
                    verticalSegmentOptions.edgeToYAdjustment = edgeToYAdjustment;
                    parentFinalVerticalSegmentX = verticalSegmentCalculator.calculateVerticalSegmentX(edgeInfos, verticalSegmentOptions);
                }

                // 2本目の垂直セグメントX座標を計算
                const edgeToSecondVerticalX = collisionAvoidanceSegmentCalculator.calculateSecondVerticalSegmentX(
                    edgeInfos,
                    edgeToYAdjustment,
                    edgeToFinalVerticalX,
                    parentFinalVerticalSegmentX,
                    nodeDepthMap,
                    parentYPositions,
                    depthBounds.depthMaxParentRight,
                    depthBounds.depthMinChildLeft
                );

                const layoutData = {
                    edgeInfos: edgeInfos,
                    parentFinalVerticalSegmentX: parentFinalVerticalSegmentX,
                    edgeToFinalVerticalX: edgeToFinalVerticalX,
                    edgeToYAdjustment: edgeToYAdjustment,
                    edgeToSecondVerticalX: edgeToSecondVerticalX
                };

                // エッジ交差を検出
                const edgeCrossings = edgeCrossingDetector.generateCrossingInfo(edgeInfos, layoutData);
                layoutData.edgeCrossings = edgeCrossings;

                return layoutData;
            }

            // 1:1水平エッジを描画
            function render1to1HorizontalEdge(conn, x1, y1, x2, y2, svgLayer) {
                const line = svgHelpers.createLine({
                    class: conn.isDashed ? 'connection-line dashed-edge' : 'connection-line',
                    x1, y1, x2, y2,
                    'data-from': conn.from,
                    'data-to': conn.to
                });

                applyDashedStyle(line, conn);

                svgLayer.appendChild(line);
                svgLayer.appendChild(createHorizontalArrow(x2, y2, conn));
            }

            // 通常のカーブエッジを描画
            function renderCurvedEdge(conn, x1, y1, x2, y2, parentFinalVerticalSegmentX, edgeToFinalVerticalX, edgeToYAdjustment, edgeToSecondVerticalX, edgeCrossings, svgLayer, labelBounds) {
                const edgeKey = connectionUtils.createEdgeKey(conn.from, conn.to);

                // V2のedgeRoutesが利用可能な場合はそれを使用
                if (window.currentLayoutResult && window.currentLayoutResult.edgeRoutes) {
                    const edgeRoutes = window.currentLayoutResult.edgeRoutes;
                    const edgeRoute = edgeRoutes.get(edgeKey);

                    if (edgeRoute && typeof generateSVGPath === 'function') {
                        const pathData = generateSVGPath(edgeRoute, CONNECTION_CONSTANTS.CORNER_RADIUS);

                        const path = svgHelpers.createPath(pathData, {
                            class: conn.isDashed ? 'connection-line dashed-edge' : 'connection-line',
                            'data-from': conn.from, 'data-to': conn.to,
                            fill: 'none'
                        });

                        applyDashedStyle(path, conn);

                        svgLayer.appendChild(path);
                        svgLayer.appendChild(createHorizontalArrow(x2, y2, conn));
                        return;
                    }
                }

                // 既存システムへのフォールバック
                const fromElement = svgHelpers.getNodeElement(conn.from);
                const verticalSegmentX = parentFinalVerticalSegmentX[conn.from] || x1 + CONNECTION_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                const fromPos = svgHelpers.getNodePosition(fromElement);
                const nodeBounds = getAllNodeBounds(conn.from, conn.to);
                const filteredBounds = filterNodeBoundsForDashedEdge(nodeBounds, conn);

                const finalVerticalX = edgeToFinalVerticalX[edgeKey];
                const yAdjustment = edgeToYAdjustment[edgeKey];
                const secondVerticalX = edgeToSecondVerticalX[edgeKey];
                const crossings = edgeCrossings[edgeKey] || [];

                const pathData = createCurvedPath({
                    x1, y1, x2, y2,
                    verticalSegmentX,
                    labelBounds,
                    nodeBounds: filteredBounds,
                    connFrom: conn.from,
                    connTo: conn.to,
                    fromNodeLeft: fromPos.left,
                    finalVerticalX,
                    yAdjustment,
                    secondVerticalX,
                    crossings
                });

                const path = svgHelpers.createPath(pathData, {
                    class: conn.isDashed ? 'connection-line dashed-edge' : 'connection-line',
                    'data-from': conn.from, 'data-to': conn.to,
                    fill: 'none'
                });

                applyDashedStyle(path, conn);

                svgLayer.appendChild(path);
                svgLayer.appendChild(createHorizontalArrow(x2, y2, conn));
            }

            // Phase 3: 単一エッジ描画
            function renderSingleEdge(edgeInfo, layoutData, svgLayer, labelBounds) {
                const { conn, x1, y1, x2, y2, is1to1Horizontal } = edgeInfo;

                const fromElement = svgHelpers.getNodeElement(conn.from);
                const toElement = svgHelpers.getNodeElement(conn.to);
                if (!areNodesVisible(fromElement, toElement)) {
                    return;
                }

                if (is1to1Horizontal) {
                    render1to1HorizontalEdge(conn, x1, y1, x2, y2, svgLayer);
                } else {
                    renderCurvedEdge(conn, x1, y1, x2, y2, layoutData.parentFinalVerticalSegmentX, layoutData.edgeToFinalVerticalX, layoutData.edgeToYAdjustment, layoutData.edgeToSecondVerticalX, layoutData.edgeCrossings, svgLayer, labelBounds);
                }
            }

            // Phase 4: ラベルを最前面に移動
            function finalizeLabels(svgLayer) {
                const labels = svgLayer.querySelectorAll('.connection-label');
                labels.forEach(label => svgLayer.appendChild(label));
            }

            // メイン処理フロー
            const svgLayer = initializeAndClearSVGLayer();
            if (!svgLayer) return;

            renderAllLabels(connections, svgLayer);
            const labelBounds = getAllLabelBounds();

            const layoutData = calculateEdgeLayout(connections, labelBounds);

            layoutData.edgeInfos.forEach(edgeInfo => {
                renderSingleEdge(edgeInfo, layoutData, svgLayer, labelBounds);
            });

            finalizeLabels(svgLayer);
        }
    `;
}

module.exports = {
    getConnectionRenderer
};
