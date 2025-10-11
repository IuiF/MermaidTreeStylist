function getConnectionRenderer() {
    const connectionLabels = require('./labels').getConnectionLabels();
    const verticalSegmentCalculator = require('./vertical-segment-calculator').getVerticalSegmentCalculator();

    return connectionLabels + verticalSegmentCalculator + `
        let useCurvedLines = true;

        window.toggleLineStyle = function() {
            useCurvedLines = !useCurvedLines;
            return useCurvedLines;
        }

        window.createCSSLines = function(connections, nodePositions) {
            const sortedConnections = [...connections].sort((a, b) => {
                const posA = nodePositions[a.from];
                const posB = nodePositions[b.from];
                const posATo = nodePositions[a.to];
                const posBTo = nodePositions[b.to];

                if (!posA || !posB || !posATo || !posBTo) return 0;

                const levelDiffA = Math.abs(posATo.level - posA.level);
                const levelDiffB = Math.abs(posBTo.level - posB.level);

                return levelDiffB - levelDiffA;
            });

            if (useCurvedLines) {
                return createCurvedLines(sortedConnections, nodePositions);
            }
            return createStraightLines(sortedConnections, nodePositions);
        }

        function createStraightLines(connections, nodePositions) {
            const svgLayer = svgHelpers.getEdgeLayer();
            if (!svgLayer) {
                console.error('SVG layer element not found');
                return;
            }

            if (window.DEBUG_CONNECTIONS) {
                console.log('createStraightLines called with ' + connections.length + ' connections');
                const dashedCount = connections.filter(c => c.isDashed).length;
                console.log('  - Dashed connections: ' + dashedCount);
            }

            const existingLines = svgLayer.querySelectorAll('.connection-line, .connection-arrow, .connection-label');
            existingLines.forEach(line => line.remove());

            labelOffsets = {};

            connections.forEach(conn => {
                const fromElement = svgHelpers.getNodeElement(conn.from);
                const toElement = svgHelpers.getNodeElement(conn.to);

                if (window.DEBUG_CONNECTIONS && conn.isDashed) {
                    console.log('  Straight edge ' + conn.from + ' --> ' + conn.to + ':',
                        'from:', !!fromElement, fromElement ? !fromElement.classList.contains('hidden') : 'N/A',
                        'to:', !!toElement, toElement ? !toElement.classList.contains('hidden') : 'N/A');
                }

                if (areNodesVisible(fromElement, toElement)) {
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

                    const arrow = createArrow(x1, y1, x2, y2, conn);
                    svgLayer.appendChild(arrow);

                    const labelGroup = createConnectionLabel(conn, toElement);
                    if (labelGroup) {
                        svgLayer.appendChild(labelGroup);
                    }
                }
            });

            const labels = svgLayer.querySelectorAll('.connection-label');
            labels.forEach(label => {
                svgLayer.appendChild(label);
            });
        }

        function createCurvedLines(connections, nodePositions) {
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

            function renderAllLabels(connections, svgLayer) {
                connections.forEach(conn => {
                    const fromElement = svgHelpers.getNodeElement(conn.from);
                    const toElement = svgHelpers.getNodeElement(conn.to);
                    if (areNodesVisible(fromElement, toElement)) {
                        const labelGroup = createConnectionLabel(conn, toElement);
                        if (labelGroup) {
                            svgLayer.appendChild(labelGroup);
                        }
                    }
                });
            }

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

            function calculateEdgeLayout(connections, labelBounds) {
                const minOffset = CONNECTION_CONSTANTS.MIN_OFFSET;
                const nodeDepths = connectionUtils.calculateNodeDepths(connections);
                const connectionsByParent = connectionUtils.sortConnectionsByParent(connections);
                const edgeInfos = edgeInfoCollector.collectEdgeInfos(connections, nodeDepths, connectionsByParent);

                edgeInfos.sort((a, b) => a.parentX - b.parentX);

                const parentYPositions = connectionUtils.calculateParentYPositions(edgeInfos);
                const levelInfo = window.layoutLevelInfo || {};
                const depthBounds = depthCalculator.calculateDepthBounds(edgeInfos, levelInfo);

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

                let parentFinalVerticalSegmentX = verticalSegmentCalculator.calculateVerticalSegmentX(edgeInfos, verticalSegmentOptions);

                const edgeToFinalVerticalX = {};

                const nodeDepthMap = {};
                edgeInfos.forEach(edgeInfo => {
                    nodeDepthMap[edgeInfo.conn.from] = edgeInfo.depth;
                });

                const edgeToYAdjustment = detectCollisions(edgeInfos, parentFinalVerticalSegmentX, edgeToFinalVerticalX);

                if (Object.keys(edgeToYAdjustment).length > 0) {
                    if (window.DEBUG_CONNECTIONS) {
                        console.log('[Renderer] Recalculating with', Object.keys(edgeToYAdjustment).length, 'collision avoidance edges');
                    }
                    verticalSegmentOptions.edgeToYAdjustment = edgeToYAdjustment;
                    parentFinalVerticalSegmentX = verticalSegmentCalculator.calculateVerticalSegmentX(edgeInfos, verticalSegmentOptions);
                }

                const edgeToSecondVerticalX = collisionAvoidanceSegmentCalculator.calculateSecondVerticalSegmentX(
                    edgeInfos,
                    edgeToYAdjustment,
                    edgeToFinalVerticalX,
                    parentFinalVerticalSegmentX,
                    nodeDepthMap
                );

                return {
                    edgeInfos: edgeInfos,
                    parentFinalVerticalSegmentX: parentFinalVerticalSegmentX,
                    edgeToFinalVerticalX: edgeToFinalVerticalX,
                    edgeToYAdjustment: edgeToYAdjustment,
                    edgeToSecondVerticalX: edgeToSecondVerticalX
                };
            }

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

            function renderCurvedEdge(conn, x1, y1, x2, y2, parentFinalVerticalSegmentX, edgeToFinalVerticalX, edgeToYAdjustment, edgeToSecondVerticalX, svgLayer, labelBounds) {
                const fromElement = svgHelpers.getNodeElement(conn.from);
                const verticalSegmentX = parentFinalVerticalSegmentX[conn.from] || x1 + CONNECTION_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                const fromPos = svgHelpers.getNodePosition(fromElement);
                const nodeBounds = getAllNodeBounds(conn.from, conn.to);
                const filteredBounds = filterNodeBoundsForDashedEdge(nodeBounds, conn);

                const edgeKey = connectionUtils.createEdgeKey(conn.from, conn.to);
                const finalVerticalX = edgeToFinalVerticalX[edgeKey];
                const yAdjustment = edgeToYAdjustment[edgeKey];
                const secondVerticalX = edgeToSecondVerticalX[edgeKey];

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
                    secondVerticalX
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
                    renderCurvedEdge(conn, x1, y1, x2, y2, layoutData.parentFinalVerticalSegmentX, layoutData.edgeToFinalVerticalX, layoutData.edgeToYAdjustment, layoutData.edgeToSecondVerticalX, svgLayer, labelBounds);
                }
            }

            function finalizeLabels(svgLayer) {
                const labels = svgLayer.querySelectorAll('.connection-label');
                labels.forEach(label => svgLayer.appendChild(label));
            }

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
