function getEdgeRouter() {
    return `
        const EDGE_CONSTANTS = {
            DEFAULT_VERTICAL_OFFSET: 50,
            CORNER_RADIUS: 10,
            MIN_OFFSET: 20,
            EDGE_SPACING: 30,
            CLUSTER_X_THRESHOLD: 200,
            COLLISION_PADDING_NODE: 5,
            COLLISION_PADDING_LABEL: 3,
            ENDPOINT_EPSILON: 1.0,
            JUMP_ARC_RADIUS: 8,
            SECOND_VERTICAL_DISTANCE_RATIO: 0.6
        };

        function createEdgeKey(from, to) {
            return from + '->' + to;
        }

        /**
         * 水平線分と垂直線分の交差判定
         * @param {Object} hSeg - 水平セグメント
         * @param {Object} vSeg - 垂直セグメント
         * @returns {Object|null} 交差点 {x, y} または null
         */
        function checkSegmentIntersection(hSeg, vSeg) {
            const hMinX = Math.min(hSeg.start.x, hSeg.end.x);
            const hMaxX = Math.max(hSeg.start.x, hSeg.end.x);
            const hY = hSeg.start.y;

            const vX = vSeg.start.x;
            const vMinY = Math.min(vSeg.start.y, vSeg.end.y);
            const vMaxY = Math.max(vSeg.start.y, vSeg.end.y);

            const epsilon = EDGE_CONSTANTS.ENDPOINT_EPSILON;

            // 水平線のY座標が垂直線のY範囲内かチェック
            if (hY < vMinY || hY > vMaxY) {
                return null;
            }

            // 垂直線のX座標が水平線のX範囲内かチェック
            if (vX < hMinX || vX > hMaxX) {
                return null;
            }

            // 交差点がセグメントの端点に近い場合は除外
            const isNearHorizontalEndpoint =
                Math.abs(vX - hSeg.start.x) < epsilon ||
                Math.abs(vX - hSeg.end.x) < epsilon;

            const isNearVerticalEndpoint =
                Math.abs(hY - vSeg.start.y) < epsilon ||
                Math.abs(hY - vSeg.end.y) < epsilon;

            if (isNearHorizontalEndpoint || isNearVerticalEndpoint) {
                return null;
            }

            return new Point(vX, hY);
        }

        /**
         * エッジルート間の交差を検出
         * @param {Map} edgeRoutes - エッジルートマップ
         * @param {Map} nodePositions - ノード位置マップ
         * @param {Array} connections - 接続配列
         * @returns {Map} エッジキー -> 交差点配列のマップ
         */
        function detectEdgeCrossings(edgeRoutes, nodePositions, connections) {
            const crossings = new Map();

            // エッジごとの開始/終了Y座標を記録
            const edgeYCoords = new Map();
            connections.forEach(conn => {
                const fromPos = nodePositions.get(conn.from);
                const toPos = nodePositions.get(conn.to);
                if (fromPos && toPos) {
                    const key = createEdgeKey(conn.from, conn.to);
                    edgeYCoords.set(key, {
                        startY: fromPos.y + fromPos.height / 2,
                        endY: toPos.y + toPos.height / 2
                    });
                }
            });

            // 全エッジの組み合わせをチェック（点線エッジは除外）
            const edgeKeys = Array.from(edgeRoutes.keys()).filter(key => {
                // 対応するconnectionを探して点線かチェック
                const parts = key.split('->');
                const conn = connections.find(c => c.from === parts[0] && c.to === parts[1]);
                return !conn || !conn.isDashed;
            });

            for (let i = 0; i < edgeKeys.length; i++) {
                const key1 = edgeKeys[i];
                const route1 = edgeRoutes.get(key1);
                const yCoords1 = edgeYCoords.get(key1);

                for (let j = 0; j < route1.segments.length; j++) {
                    const seg1 = route1.segments[j];
                    if (seg1.type !== 'horizontal') continue;

                    for (let k = 0; k < edgeKeys.length; k++) {
                        if (i === k) continue; // 同じエッジは除外

                        const key2 = edgeKeys[k];
                        const route2 = edgeRoutes.get(key2);

                        for (let l = 0; l < route2.segments.length; l++) {
                            const seg2 = route2.segments[l];
                            if (seg2.type !== 'vertical') continue;

                            const intersection = checkSegmentIntersection(seg1, seg2);
                            if (intersection) {
                                if (!crossings.has(key1)) {
                                    crossings.set(key1, []);
                                }

                                // 重複チェック
                                const existing = crossings.get(key1);
                                const isDuplicate = existing.some(p =>
                                    Math.abs(p.x - intersection.x) < 0.1 &&
                                    Math.abs(p.y - intersection.y) < 0.1
                                );

                                if (!isDuplicate) {
                                    existing.push(intersection);
                                }
                            }
                        }
                    }
                }
            }

            // 交差点をX座標順にソート
            crossings.forEach((points, key) => {
                points.sort((a, b) => a.x - b.x);
            });

            return crossings;
        }

        /**
         * 水平セグメントを交差点で分割してジャンプアークを挿入
         * @param {Segment} segment - 水平セグメント
         * @param {Array} crossings - 交差点配列
         * @returns {Array} 分割されたセグメント配列
         */
        function splitSegmentWithJumpArcs(segment, crossings) {
            if (crossings.length === 0) {
                return [segment];
            }

            const result = [];
            const radius = EDGE_CONSTANTS.JUMP_ARC_RADIUS;
            let currentX = segment.start.x;
            const y = segment.start.y;
            const endX = segment.end.x;

            crossings.forEach(crossing => {
                // 交差点までの水平線
                if (currentX < crossing.x - radius) {
                    result.push(new Segment('horizontal',
                        new Point(currentX, y),
                        new Point(crossing.x - radius, y)
                    ));
                }

                // ジャンプアーク
                const arcParams = new ArcParams(
                    crossing.x,
                    y,
                    radius,
                    Math.PI,
                    0
                );
                result.push(new Segment('arc',
                    new Point(crossing.x - radius, y),
                    new Point(crossing.x + radius, y),
                    null,
                    arcParams
                ));

                currentX = crossing.x + radius;
            });

            // 最後のセグメント
            if (currentX < endX) {
                result.push(new Segment('horizontal',
                    new Point(currentX, y),
                    new Point(endX, y)
                ));
            }

            return result;
        }

        /**
         * 2つの矩形範囲が重なるかチェック（ローカル）
         * @param {Object} rect1 - 矩形1
         * @param {Object} rect2 - 矩形2
         * @returns {boolean} 重なっているかどうか
         */
        function _checkRectOverlap(rect1, rect2) {
            const xOverlap = !(rect1.right < rect2.left || rect1.left > rect2.right);
            const yOverlap = !(rect1.bottom < rect2.top || rect1.top > rect2.bottom);
            return xOverlap && yOverlap;
        }

        /**
         * エッジの経路全体でノードとの衝突をチェック（ローカル）
         * @param {number} x1 - 開始X座標
         * @param {number} y1 - 開始Y座標
         * @param {number} x2 - 終了X座標
         * @param {number} y2 - 終了Y座標
         * @param {Array} nodeBounds - ノードのバウンディングボックス配列
         * @returns {Array} 衝突するノードの配列
         */
        function _checkEdgePathIntersectsNodes(x1, y1, x2, y2, nodeBounds) {
            const padding = EDGE_CONSTANTS.COLLISION_PADDING_NODE;
            const pathRect = {
                left: Math.min(x1, x2) - padding,
                right: Math.max(x1, x2) + padding,
                top: Math.min(y1, y2) - padding,
                bottom: Math.max(y1, y2) + padding
            };

            return nodeBounds.filter(node => _checkRectOverlap(pathRect, node));
        }

        /**
         * ノードをY座標範囲で行にグループ化
         * @param {Array} nodeBounds - ノードのバウンディングボックス配列
         * @returns {Array} 行の配列 [{top, bottom, nodes}]
         */
        function _groupNodesIntoRows(nodeBounds) {
            if (!nodeBounds || nodeBounds.length === 0) {
                return [];
            }

            // Y座標でソート
            const sorted = [...nodeBounds].sort((a, b) => a.top - b.top);

            const rows = [];
            let currentRow = {
                top: sorted[0].top,
                bottom: sorted[0].bottom,
                nodes: [sorted[0]]
            };

            for (let i = 1; i < sorted.length; i++) {
                const node = sorted[i];

                // 現在の行と重なっているか確認
                if (node.top <= currentRow.bottom) {
                    // 重なっている→同じ行に追加
                    currentRow.nodes.push(node);
                    currentRow.bottom = Math.max(currentRow.bottom, node.bottom);
                } else {
                    // 重なっていない→新しい行を開始
                    rows.push(currentRow);
                    currentRow = {
                        top: node.top,
                        bottom: node.bottom,
                        nodes: [node]
                    };
                }
            }

            // 最後の行を追加
            rows.push(currentRow);

            return rows;
        }

        /**
         * 行間のギャップを計算
         * @param {Array} rows - 行の配列
         * @returns {Array} ギャップの配列 [{startY, endY, centerY, height}]
         */
        function _findRowGaps(rows) {
            const gaps = [];

            for (let i = 0; i < rows.length - 1; i++) {
                const currentRow = rows[i];
                const nextRow = rows[i + 1];

                const gapStart = currentRow.bottom;
                const gapEnd = nextRow.top;
                const gapHeight = gapEnd - gapStart;

                if (gapHeight > 0) {
                    gaps.push({
                        startY: gapStart,
                        endY: gapEnd,
                        centerY: (gapStart + gapEnd) / 2,
                        height: gapHeight
                    });
                }
            }

            return gaps;
        }

        /**
         * 指定されたY座標から最も近い行間ギャップを見つける
         * @param {number} targetY - 基準Y座標
         * @param {Array} gaps - ギャップの配列
         * @param {number} minGapHeight - 最小ギャップ高さ
         * @param {string} direction - 'above'（上方向）または'below'（下方向）
         * @returns {number|null} ギャップの中央Y座標（見つからない場合はnull）
         */
        function _findNearestSuitableGap(targetY, gaps, minGapHeight, direction) {
            // 十分な高さを持つギャップをフィルタ
            const suitableGaps = gaps.filter(gap => gap.height >= minGapHeight);

            if (suitableGaps.length === 0) {
                return null;
            }

            // 方向に応じてギャップを選択
            let candidateGaps;
            if (direction === 'above') {
                // targetYより上のギャップ（centerYがtargetYより小さい）
                candidateGaps = suitableGaps.filter(gap => gap.centerY < targetY);
            } else {
                // targetYより下のギャップ（centerYがtargetYより大きい）
                candidateGaps = suitableGaps.filter(gap => gap.centerY > targetY);
            }

            if (candidateGaps.length === 0) {
                return null;
            }

            // targetYに最も近いギャップを選択
            candidateGaps.sort((a, b) => {
                const distA = Math.abs(a.centerY - targetY);
                const distB = Math.abs(b.centerY - targetY);
                return distA - distB;
            });

            return candidateGaps[0].centerY;
        }

        /**
         * 水平セグメントがノードと衝突する場合にY座標を調整（ローカル）
         * ノード行間の空間に配置する
         * @param {number} x1 - 水平線開始X座標
         * @param {number} y - 水平線Y座標
         * @param {number} x2 - 水平線終了X座標
         * @param {Array} nodeBounds - ノードのバウンディングボックス配列
         * @returns {number|null} 調整後のY座標（調整不要の場合はnull）
         */
        function _adjustHorizontalSegmentY(x1, y, x2, nodeBounds) {
            if (!nodeBounds || nodeBounds.length === 0) {
                return null;
            }

            const pathIntersectingNodes = _checkEdgePathIntersectsNodes(x1, y, x2, y, nodeBounds);

            if (pathIntersectingNodes.length === 0) {
                return null;
            }

            const nodePadding = EDGE_CONSTANTS.COLLISION_PADDING_NODE;

            // すべての衝突ノードの中で最も上と最も下を見つける
            const topMost = Math.min(...pathIntersectingNodes.map(n => n.top));
            const bottomMost = Math.max(...pathIntersectingNodes.map(n => n.bottom));

            // X範囲内のノードのみをフィルタリング（行計算用）
            const minX = Math.min(x1, x2);
            const maxX = Math.max(x1, x2);
            const nodesInXRange = nodeBounds.filter(node => {
                // ノードのX範囲がセグメントのX範囲と重なっているか
                return !(node.right < minX || node.left > maxX);
            });

            // X範囲内のノードを行にグループ化
            const rows = _groupNodesIntoRows(nodesInXRange);

            // 行間のギャップを計算
            const gaps = _findRowGaps(rows);

            // 最小ギャップ高さ（ノードパディング×2 + エッジ線幅の余裕）
            const minGapHeight = nodePadding * 4;

            // 水平線のY座標を調整（ノードを避ける）
            let adjustedY = null;

            if (window.DEBUG_CONNECTIONS) {
                console.log('[_adjustHorizontalSegmentY] y=' + y + ', topMost=' + topMost + ', bottomMost=' + bottomMost + ', gaps count=' + gaps.length + ', minGapHeight=' + minGapHeight);
                console.log('[_adjustHorizontalSegmentY] gaps:', gaps.map(g => 'centerY=' + g.centerY + ',height=' + g.height));
            }

            if (y < topMost) {
                // 水平線が衝突ノードより上にある場合
                // topMostから上方向で最も近いギャップを探す
                adjustedY = _findNearestSuitableGap(topMost, gaps, minGapHeight, 'above');
                if (window.DEBUG_CONNECTIONS) {
                    console.log('[_adjustHorizontalSegmentY] direction=above, result=' + adjustedY);
                }
                if (adjustedY === null) {
                    // 適切なギャップがない場合は、従来の方法
                    adjustedY = topMost - nodePadding;
                    if (window.DEBUG_CONNECTIONS) {
                        console.log('[_adjustHorizontalSegmentY] fallback above: adjustedY=' + adjustedY);
                    }
                }
            } else if (y >= topMost && y <= bottomMost) {
                // 水平線が衝突ノード範囲内にある場合
                // bottomMostから下方向で最も近いギャップを探す
                adjustedY = _findNearestSuitableGap(bottomMost, gaps, minGapHeight, 'below');
                if (window.DEBUG_CONNECTIONS) {
                    console.log('[_adjustHorizontalSegmentY] direction=below, result=' + adjustedY);
                }
                if (adjustedY === null) {
                    // 適切なギャップがない場合は、従来の方法
                    adjustedY = bottomMost + nodePadding;
                    if (window.DEBUG_CONNECTIONS) {
                        console.log('[_adjustHorizontalSegmentY] fallback below: adjustedY=' + adjustedY);
                    }
                }
            } else {
                return null;
            }

            return adjustedY;
        }

        /**
         * 垂直線と交差するオブジェクトを検出
         * @param {number} x - 垂直線のX座標
         * @param {number} y1 - 開始Y座標
         * @param {number} y2 - 終了Y座標
         * @param {Array} objects - オブジェクトの配列
         * @param {number} padding - パディング
         * @returns {Array} 交差するオブジェクトの配列
         */
        function _findVerticalLineIntersections(x, y1, y2, objects, padding) {
            const yMin = Math.min(y1, y2);
            const yMax = Math.max(y1, y2);
            const lineRect = {
                left: x - padding,
                right: x + padding,
                top: yMin - padding,
                bottom: yMax + padding
            };

            return objects.filter(obj => _checkRectOverlap(lineRect, obj));
        }

        /**
         * ノードを避けるためのX座標オフセットを計算
         * @param {number} x - X座標
         * @param {number} y1 - 開始Y座標
         * @param {number} y2 - 終了Y座標
         * @param {Array} nodeBounds - ノードのバウンディングボックス配列
         * @returns {number} オフセット値
         */
        function _calculateNodeAvoidanceOffset(x, y1, y2, nodeBounds) {
            const padding = EDGE_CONSTANTS.COLLISION_PADDING_NODE;
            const intersections = _findVerticalLineIntersections(x, y1, y2, nodeBounds, padding);

            if (intersections.length === 0) return 0;

            const maxRight = Math.max(...intersections.map(obj => obj.right));
            const offset = maxRight + padding - x;

            return offset;
        }

        /**
         * ラベルを避けるためのX座標オフセットを計算
         * @param {number} x - X座標
         * @param {number} y1 - 開始Y座標
         * @param {number} y2 - 終了Y座標
         * @param {Array} labelBounds - ラベルのバウンディングボックス配列
         * @returns {number} オフセット値
         */
        function _calculateLabelAvoidanceOffset(x, y1, y2, labelBounds) {
            const padding = EDGE_CONSTANTS.COLLISION_PADDING_LABEL;
            const intersections = _findVerticalLineIntersections(x, y1, y2, labelBounds, padding);

            if (intersections.length === 0) return 0;

            const maxRight = Math.max(...intersections.map(obj => obj.right));
            const offset = maxRight + padding - x;

            return offset;
        }

        /**
         * 垂直セグメントの衝突回避オフセットを計算（ノード+ラベル統合版）
         *
         * 設計原則:
         * - すべての垂直セグメント（第1・第2）で同じロジックを使用
         * - ノードとラベル両方の衝突を考慮
         * - DRY原則に従い、衝突回避ロジックを一箇所に集約
         *
         * @param {number} x - X座標
         * @param {number} y1 - 開始Y座標
         * @param {number} y2 - 終了Y座標
         * @param {Array} nodeBounds - ノードのバウンディングボックス配列
         * @param {Array} labelBounds - ラベルのバウンディングボックス配列
         * @returns {number} オフセット値
         */
        function _calculateVerticalSegmentCollisionOffset(x, y1, y2, nodeBounds, labelBounds) {
            // ノード回避オフセットを計算
            const nodeOffset = _calculateNodeAvoidanceOffset(x, y1, y2, nodeBounds);

            // ラベル回避オフセットを計算（ノードオフセット適用後のX座標で）
            const labelOffset = _calculateLabelAvoidanceOffset(x + nodeOffset, y1, y2, labelBounds);

            return nodeOffset + labelOffset;
        }

        /**
         * ノードの階層（depth）を計算
         * @param {Array} connections - 接続情報の配列
         * @returns {Map} ノードIDをキーとした階層マップ
         */
        function calculateNodeDepths(connections) {
            const nodeDepths = new Map();
            const allNodeIds = new Set([...connections.map(c => c.from), ...connections.map(c => c.to)]);
            const childNodeIds = new Set(connections.map(c => c.to));
            const rootNodeIds = [...allNodeIds].filter(id => !childNodeIds.has(id));

            const childrenMap = new Map();
            connections.forEach(conn => {
                if (!childrenMap.has(conn.from)) {
                    childrenMap.set(conn.from, []);
                }
                childrenMap.get(conn.from).push(conn.to);
            });

            const queue = [];
            rootNodeIds.forEach(rootId => {
                nodeDepths.set(rootId, 0);
                queue.push(rootId);
            });

            const maxIterations = allNodeIds.size * allNodeIds.size;
            let processed = 0;

            while (queue.length > 0 && processed < maxIterations) {
                const currentId = queue.shift();
                processed++;
                const currentDepth = nodeDepths.get(currentId);
                const children = childrenMap.get(currentId) || [];

                for (const childId of children) {
                    const newDepth = currentDepth + 1;
                    const existingDepth = nodeDepths.get(childId);

                    if (existingDepth === undefined || newDepth < existingDepth) {
                        nodeDepths.set(childId, newDepth);
                        queue.push(childId);
                    }
                }
            }

            return nodeDepths;
        }

        /**
         * 接続の深さを計算（from→toのレベル差）
         * @param {Object} conn - 接続情報
         * @param {Map} nodeDepths - ノードの深さマップ
         * @returns {number} 深さ（レベル差）
         */
        function calculateConnectionDepth(conn, nodeDepths) {
            const fromDepth = nodeDepths.get(conn.from) || 0;
            const toDepth = nodeDepths.get(conn.to) || 0;
            return toDepth - fromDepth;
        }

        /**
         * 階層ごとの親の右端と子の左端を計算
         * @param {Map} nodePositions - ノード位置マップ
         * @param {Array} connections - 接続配列
         * @param {Map} nodeDepths - ノードの深さマップ
         * @param {Array} levelXPositions - 階層のX座標配列
         * @param {Array} levelMaxWidths - 階層の最大幅配列
         * @returns {Object} depthMaxParentRightとdepthMinChildLeftのオブジェクト
         */
        function calculateDepthBounds(nodePositions, connections, nodeDepths, levelXPositions, levelMaxWidths) {
            const depthMaxParentRight = new Map();
            const depthMinChildLeft = new Map();

            connections.forEach(conn => {
                const fromPos = nodePositions.get(conn.from);
                const toPos = nodePositions.get(conn.to);
                if (!fromPos || !toPos) return;

                const fromDepth = nodeDepths.get(conn.from) || 0;
                const x1 = fromPos.x + fromPos.width;
                const x2 = toPos.x;

                // 階層情報がある場合は使用
                if (levelXPositions && levelXPositions[fromDepth] !== undefined &&
                    levelMaxWidths && levelMaxWidths[fromDepth] !== undefined) {
                    const levelMaxRight = levelXPositions[fromDepth] + levelMaxWidths[fromDepth];
                    if (!depthMaxParentRight.has(fromDepth) || levelMaxRight > depthMaxParentRight.get(fromDepth)) {
                        depthMaxParentRight.set(fromDepth, levelMaxRight);
                    }
                } else {
                    if (!depthMaxParentRight.has(fromDepth) || x1 > depthMaxParentRight.get(fromDepth)) {
                        depthMaxParentRight.set(fromDepth, x1);
                    }
                }

                // 次の階層の左端
                const nextDepth = fromDepth + 1;
                if (levelXPositions && levelXPositions[nextDepth] !== undefined) {
                    if (!depthMinChildLeft.has(fromDepth) || levelXPositions[nextDepth] < depthMinChildLeft.get(fromDepth)) {
                        depthMinChildLeft.set(fromDepth, levelXPositions[nextDepth]);
                    }
                } else {
                    if (!depthMinChildLeft.has(fromDepth) || x2 < depthMinChildLeft.get(fromDepth)) {
                        depthMinChildLeft.set(fromDepth, x2);
                    }
                }
            });

            return { depthMaxParentRight, depthMinChildLeft };
        }

        /**
         * 親ノードをdepthごとにグループ化
         * @param {Array} connections - 接続配列
         * @param {Map} nodeDepths - ノードの深さマップ
         * @returns {Map} depth -> [parentId...]のマップ
         */
        function groupParentsByDepth(connections, nodeDepths) {
            const parentsByDepth = new Map();
            const seenParents = new Set();

            connections.forEach(conn => {
                if (seenParents.has(conn.from)) return;
                seenParents.add(conn.from);

                const depth = nodeDepths.get(conn.from) || 0;
                if (!parentsByDepth.has(depth)) {
                    parentsByDepth.set(depth, []);
                }
                parentsByDepth.get(depth).push(conn.from);
            });

            return parentsByDepth;
        }

        /**
         * 各depthを通過する全エッジ数をカウント
         * @param {Array} connections - 接続配列
         * @param {Map} nodeDepths - ノードの深さマップ
         * @returns {Map} depth -> 通過エッジ数のマップ
         */
        function countEdgesPassingThroughDepth(connections, nodeDepths) {
            const edgesPassingThrough = new Map();

            connections.forEach(conn => {
                const fromDepth = nodeDepths.get(conn.from) || 0;
                const toDepth = nodeDepths.get(conn.to) || 0;

                // エッジが通過する各depthをカウント
                for (let d = fromDepth; d < toDepth; d++) {
                    edgesPassingThrough.set(d, (edgesPassingThrough.get(d) || 0) + 1);
                }
            });

            return edgesPassingThrough;
        }

        /**
         * 等間隔配置のX座標を計算
         * @param {Array} parentInfos - 親ノード情報配列 [{parentId, yPosition, x1, x2}]
         * @param {number} totalEdges - この階層を通過する全エッジ数
         * @param {number} maxParentRight - 親ノード群の最大右端X座標
         * @param {number} minChildLeft - 子ノード群の最小左端X座標
         * @returns {Map} parentId -> X座標のマップ
         */
        function calculateEvenSpacing(parentInfos, totalEdges, maxParentRight, minChildLeft) {
            const result = new Map();

            // Y座標でソート
            parentInfos.sort((a, b) => a.yPosition - b.yPosition);

            const totalParents = parentInfos.length;
            const rawAvailableWidth = minChildLeft - maxParentRight - EDGE_CONSTANTS.MIN_OFFSET * 2;

            // 有効なレーン数は親ノード数とエッジ数の大きい方
            const effectiveLaneCount = Math.max(totalParents, totalEdges);
            const laneSpacing = Math.max(EDGE_CONSTANTS.EDGE_SPACING, rawAvailableWidth / (effectiveLaneCount + 1));

            // 中央配置計算
            const centerX = (maxParentRight + minChildLeft) / 2;
            const totalWidth = laneSpacing * totalParents;
            const startX = centerX - totalWidth / 2;

            // 各親に等間隔でX座標を割り当て
            parentInfos.forEach((parent, index) => {
                let x = startX + (index + 0.5) * laneSpacing;

                // 垂直セグメントX座標は親ノードの右端より右側にある必要がある
                const minX = parent.x1 + EDGE_CONSTANTS.MIN_OFFSET;
                if (x < minX) {
                    x = minX;
                }

                result.set(parent.parentId, x);
            });

            return result;
        }

        /**
         * 親ノードをX座標でクラスタリング
         * X座標が大きく離れているノードを別クラスタに分離
         * @param {Array} parentInfos - 親ノード情報配列
         * @returns {Array<Array>} クラスタの配列
         */
        function clusterParentsByXPosition(parentInfos) {
            if (parentInfos.length === 0) return [];
            if (parentInfos.length === 1) return [parentInfos];

            // X座標でソート
            const sorted = [...parentInfos].sort((a, b) => a.x1 - b.x1);

            const clusters = [];
            let currentCluster = [sorted[0]];

            // X座標の差が大きい箇所で分割
            for (let i = 1; i < sorted.length; i++) {
                const gap = sorted[i].x1 - sorted[i - 1].x1;

                if (gap > EDGE_CONSTANTS.CLUSTER_X_THRESHOLD) {
                    // 大きなギャップ → 新しいクラスタを開始
                    clusters.push(currentCluster);
                    currentCluster = [sorted[i]];
                } else {
                    // 同じクラスタに追加
                    currentCluster.push(sorted[i]);
                }
            }

            // 最後のクラスタを追加
            clusters.push(currentCluster);

            return clusters;
        }

        /**
         * 親ノードから子ノードへのマップを構築（パフォーマンス最適化用）
         *
         * @param {Array} connections - 接続配列
         * @param {Map} nodePositions - ノード位置マップ
         * @returns {Map} parentId -> [{childId, childX}] のマップ
         */
        function buildParentToChildrenMap(connections, nodePositions) {
            const map = new Map();

            connections.forEach(conn => {
                const childPos = nodePositions.get(conn.to);
                if (!childPos) return;

                if (!map.has(conn.from)) {
                    map.set(conn.from, []);
                }

                map.get(conn.from).push({
                    childId: conn.to,
                    childX: childPos.x
                });
            });

            return map;
        }

        /**
         * クラスタごとの境界とメタデータを計算
         *
         * 設計意図:
         * - X座標が近い親ノードは同じクラスタとしてグループ化される
         * - クラスタ内で異なるdepthの親が混在する場合、階層ベースの境界計算は不正確
         * - そのため、実際の親-子関係に基づいて境界を計算する必要がある
         *
         * パフォーマンス:
         * - O(cluster_size) の計算量（親-子マップを使用）
         *
         * @param {Array} cluster - クラスタ内の親ノード情報配列
         * @param {Map} parentToChildren - 親ID -> 子ノード配列のマップ
         * @returns {Object} { maxRight, minLeft, edgeCount }
         */
        function calculateClusterBounds(cluster, parentToChildren) {
            // クラスタ内の親ノードの最大右端
            const maxRight = Math.max(...cluster.map(p => p.x1));

            // クラスタ内の親から実際に出ている全エッジの子ノード位置を収集
            const childPositions = [];
            let edgeCount = 0;

            cluster.forEach(parent => {
                const children = parentToChildren.get(parent.parentId);
                if (children) {
                    children.forEach(child => {
                        childPositions.push(child.childX);
                        edgeCount++;
                    });
                }
            });

            // 実際の子ノードX座標から最小左端を計算
            // これにより、異なるdepthの親が混在する場合でも正確な利用可能幅が得られる
            let minLeft;
            if (childPositions.length > 0) {
                minLeft = Math.min(...childPositions);
            } else {
                // エッジがない場合のフォールバック
                minLeft = maxRight + EDGE_CONSTANTS.DEFAULT_VERTICAL_OFFSET * 2;
            }

            return {
                maxRight: maxRight,
                minLeft: minLeft,
                edgeCount: edgeCount
            };
        }

        /**
         * 親ごとの垂直セグメントX座標を計算（クラスタベース版）
         *
         * アプローチ:
         * 1. X座標が近い親ノードをクラスタリング（CLUSTER_X_THRESHOLD以内）
         * 2. 各クラスタごとに独立して境界とエッジ数を計算
         * 3. クラスタ内で親ノードを等間隔に配置
         *
         * なぜdepthベースではなくclusterベースなのか:
         * - 異なるdepthの親ノードが同じX位置にいる場合、階層ベースの境界は不正確
         * - 実際の親-子関係に基づいた計算により、正確な利用可能幅が得られる
         * - 視覚的に近い親ノードが同じ配置ルールに従うため、一貫性が向上
         *
         * @param {Map} nodePositions - ノード位置マップ
         * @param {Array} connections - 接続配列
         * @param {Map} nodeDepths - ノードの深さマップ
         * @param {Array} levelXPositions - 階層のX座標配列（未使用、後方互換性のため保持）
         * @param {Array} levelMaxWidths - 階層の最大幅配列（未使用、後方互換性のため保持）
         * @returns {Map} parentId -> 垂直セグメントX座標のマップ
         */
        function calculateVerticalSegmentX(nodePositions, connections, nodeDepths, levelXPositions, levelMaxWidths) {
            const result = new Map();

            // パフォーマンス最適化：親-子マップを事前構築（O(connections)）
            const parentToChildren = buildParentToChildrenMap(connections, nodePositions);

            // 親をdepthごとにグループ化（後で全depthをまとめる）
            const parentsByDepth = groupParentsByDepth(connections, nodeDepths);

            // 全depthの親情報を収集
            const allParentInfos = [];
            parentsByDepth.forEach((parentIds, depth) => {
                parentIds.forEach(parentId => {
                    const pos = nodePositions.get(parentId);
                    allParentInfos.push({
                        parentId: parentId,
                        yPosition: pos.y + pos.height / 2,
                        x1: pos.x + pos.width,
                        x2: pos.x,
                        depth: depth
                    });
                });
            });

            // X座標でクラスタリング（全depthまとめて）
            // これにより、視覚的に近い親ノードが同じグループになる
            const clusters = clusterParentsByXPosition(allParentInfos);

            // 各クラスタごとに独立して配置を計算
            clusters.forEach(cluster => {
                // クラスタごとの境界とエッジ数を実際の親-子関係から計算
                // O(cluster_size) の計算量
                const bounds = calculateClusterBounds(cluster, parentToChildren);

                // エッジ数がない場合は親ノード数をフォールバックとして使用
                const effectiveEdgeCount = bounds.edgeCount > 0 ? bounds.edgeCount : cluster.length;

                // 等間隔配置を計算
                const spacing = calculateEvenSpacing(
                    cluster,
                    effectiveEdgeCount,
                    bounds.maxRight,
                    bounds.minLeft
                );

                // 各親に割り当て
                spacing.forEach((x, parentId) => {
                    result.set(parentId, x);
                });
            });

            return result;
        }

        /**
         * 親ごとに衝突回避オフセットを計算
         * 各親に個別のオフセットを適用
         * @param {Map} nodePositions - ノード位置マップ
         * @param {Array} connections - 接続配列
         * @param {Map} nodeDepths - ノードの深さマップ
         * @param {Map} baseVerticalSegmentX - 親ID -> 基本X座標のマップ
         * @param {Array} nodeBounds - ノードバウンディングボックス配列
         * @param {Array} labelBounds - ラベルバウンディングボックス配列
         * @returns {Map} parentId -> オフセット値のマップ
         */
        function _aggregateOffsetsByDepth(nodePositions, connections, nodeDepths, baseVerticalSegmentX, nodeBounds, labelBounds) {
            const parentMaxOffset = new Map();

            // 親をdepthごとにグループ化
            const parentsByDepth = groupParentsByDepth(connections, nodeDepths);

            // 親ごとにオフセットを計算
            parentsByDepth.forEach((parentIds, depth) => {
                parentIds.forEach(parentId => {
                    const baseVerticalX = baseVerticalSegmentX.get(parentId);
                    if (baseVerticalX === undefined) return;

                    let parentOffset = 0;

                    // この親から出る全エッジについてオフセットを計算
                    connections.forEach(conn => {
                        if (conn.from !== parentId) return;

                        const fromPos = nodePositions.get(conn.from);
                        const toPos = nodePositions.get(conn.to);
                        if (!fromPos || !toPos) return;

                        const y1 = fromPos.y + fromPos.height / 2;
                        const y2 = toPos.y + toPos.height / 2;

                        // 統一された衝突回避オフセットを計算（ノード+ラベル）
                        const totalOffset = _calculateVerticalSegmentCollisionOffset(baseVerticalX, y1, y2, nodeBounds, labelBounds);
                        parentOffset = Math.max(parentOffset, totalOffset);
                    });

                    // 各親に個別のオフセットを適用
                    parentMaxOffset.set(parentId, parentOffset);
                });
            });

            return parentMaxOffset;
        }

        /**
         * 衝突回避が必要なエッジの2本目の垂直セグメントX座標を計算（クラスタベース版）
         *
         * 設計原則:
         * 1. 2本目の垂直セグメントX座標は1本目（p4x）以上である必要がある
         * 2. 2本目の垂直セグメントX座標は終点ノード左端（endX）より小さい必要がある
         * 3. Y座標が近い親ノード（クラスタ）は独立して処理される
         * 4. ノードとラベル両方の衝突を考慮（第1垂直セグメントと統一）
         *
         * アプローチ:
         * - 親ノードをY座標でクラスタリング
         * - 各クラスタごとに実際のp4xとendXから有効範囲を計算
         * - クラスタ内で親ノードを等間隔に配置
         * - 統一された衝突回避ロジックを使用（ノード+ラベル）
         *
         * @param {Array} collisionEdges - 衝突回避エッジ情報配列
         * @param {Map} nodeDepths - ノードID -> depth のマップ
         * @param {Map} nodePositions - ノード位置マップ
         * @param {Map} depthMaxParentRight - 階層 -> 親ノードの最大右端X座標（未使用）
         * @param {Map} depthMinChildLeft - 階層 -> 子ノードの最小左端X座標（未使用）
         * @param {Array} nodeBounds - ノードバウンディングボックス配列
         * @param {Array} labelBounds - ラベルバウンディングボックス配列
         * @returns {Map} エッジキー -> 2本目の垂直セグメントX座標のマップ
         */
        function _calculateSecondVerticalSegmentX(collisionEdges, nodeDepths, nodePositions, depthMaxParentRight, depthMinChildLeft, nodeBounds, labelBounds) {
            const edgeToSecondVerticalX = new Map();

            if (collisionEdges.length === 0) {
                return edgeToSecondVerticalX;
            }

            // 親ごとにエッジをグループ化し、各親の範囲を計算
            const parentGroups = new Map();

            collisionEdges.forEach(edge => {
                const parts = edge.edgeKey.split('->');
                const parentId = parts[0];
                const childId = parts[1];

                if (!parentGroups.has(parentId)) {
                    parentGroups.set(parentId, {
                        parentId: parentId,
                        edges: [],
                        minP4x: Infinity,
                        maxEndX: -Infinity
                    });
                }

                const group = parentGroups.get(parentId);

                // エッジ情報に子ノードの位置情報を追加
                const toPos = nodePositions.get(childId);
                edge.targetY = toPos ? toPos.y + toPos.height / 2 : 0;

                group.edges.push(edge);

                // この親から出るエッジの有効範囲を計算
                group.minP4x = Math.min(group.minP4x, edge.p4x);
                group.maxEndX = Math.max(group.maxEndX, edge.endX);
            });

            // 各親グループに対して独立して2本目の垂直セグメントX座標を計算
            parentGroups.forEach((group) => {
                // このグループの有効範囲を計算
                const groupStartX = group.minP4x + EDGE_CONSTANTS.MIN_OFFSET;
                const groupEndX = group.maxEndX - EDGE_CONSTANTS.MIN_OFFSET;

                if (groupStartX >= groupEndX) {
                    // 有効範囲が存在しない場合、p4xを使用
                    group.edges.forEach(edge => {
                        edgeToSecondVerticalX.set(edge.edgeKey, edge.p4x + EDGE_CONSTANTS.MIN_OFFSET);
                    });
                    return;
                }

                // グループ専用の範囲で中央付近を計算
                const availableWidth = groupEndX - groupStartX;
                let secondVerticalX = groupStartX + availableWidth / 2;

                // ノードとラベルの衝突をチェックして、必要ならオフセットを追加
                let maxOffset = 0;
                group.edges.forEach(edge => {
                    // 第2垂直セグメントのY範囲を取得
                    // 中間水平セグメントのY座標（adjustedY）から終点Y座標（targetY）まで
                    const parts = edge.edgeKey.split('->');
                    const fromId = parts[0];
                    const toId = parts[1];

                    const fromPos = nodePositions.get(fromId);
                    const toPos = nodePositions.get(toId);
                    if (!fromPos || !toPos) return;

                    const y1 = fromPos.y + fromPos.height / 2;
                    const y2 = toPos.y + toPos.height / 2;

                    // ターゲットノードを除外したノード境界でオフセット計算
                    const filteredBounds = nodeBounds.filter(n => n.id !== toId);
                    // 統一された衝突回避オフセットを計算（ノード+ラベル）
                    const offset = _calculateVerticalSegmentCollisionOffset(secondVerticalX, y1, y2, filteredBounds, labelBounds);
                    maxOffset = Math.max(maxOffset, offset);
                });

                // 最大オフセットを適用
                secondVerticalX += maxOffset;

                // 各エッジに割り当て
                group.edges.forEach(edge => {
                    edgeToSecondVerticalX.set(edge.edgeKey, secondVerticalX);
                    if (window.DEBUG_CONNECTIONS && edge.edgeKey === 'B2->D5') {
                        console.log('[2ndVertX calc] B2->D5: baseX=' + (secondVerticalX - maxOffset).toFixed(1) + ', offset=' + maxOffset.toFixed(1) + ', final=' + secondVerticalX.toFixed(1));
                    }
                });
            });

            return edgeToSecondVerticalX;
        }

        function routeEdges(input) {
            const { nodePositions, connections, levelXPositions, levelMaxWidths, labelBounds } = input;

            const edgeRoutes = new Map();

            // ノード深さを計算
            const nodeDepths = calculateNodeDepths(connections);

            // 階層ごとの親の右端と子の左端を計算
            const { depthMaxParentRight, depthMinChildLeft } = calculateDepthBounds(
                nodePositions, connections, nodeDepths, levelXPositions, levelMaxWidths
            );

            // ノード境界情報を構築
            const nodeBounds = [];
            nodePositions.forEach((pos, nodeId) => {
                nodeBounds.push({
                    id: nodeId,
                    left: pos.x,
                    right: pos.x + pos.width,
                    top: pos.y,
                    bottom: pos.y + pos.height
                });
            });

            // ラベル境界情報（inputから取得、なければ空配列）
            const labelBoundsArray = labelBounds || [];

            // 第1段階：基本垂直セグメント計算
            const baseVerticalSegmentX = calculateVerticalSegmentX(
                nodePositions, connections, nodeDepths, levelXPositions, levelMaxWidths
            );

            // 第2段階：衝突回避オフセット集約（depth単位で統一）
            const offsetsByParent = _aggregateOffsetsByDepth(
                nodePositions, connections, nodeDepths, baseVerticalSegmentX, nodeBounds, labelBoundsArray
            );

            // 最終的な垂直セグメントX座標（基本 + オフセット）
            const verticalSegmentXByParent = new Map();
            baseVerticalSegmentX.forEach((baseX, parentId) => {
                const offset = offsetsByParent.get(parentId) || 0;
                verticalSegmentXByParent.set(parentId, baseX + offset);
            });

            // 最終セグメントY調整が必要なエッジを検出
            const edgeToYAdjustment = new Map();
            connections.forEach(conn => {
                const fromPos = nodePositions.get(conn.from);
                const toPos = nodePositions.get(conn.to);
                if (!fromPos || !toPos) return;

                const y1 = fromPos.y + fromPos.height / 2;
                const y2 = toPos.y + toPos.height / 2;
                if (y1 === y2) return; // 水平エッジはスキップ

                const x2 = toPos.x;
                let verticalSegmentX = verticalSegmentXByParent.get(conn.from);
                if (verticalSegmentX === undefined) {
                    verticalSegmentX = fromPos.x + fromPos.width + EDGE_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                }

                // 最終セグメントY座標調整チェック（ターゲットノードは除外）
                const filteredBoundsFinal = nodeBounds.filter(n => n.id !== conn.to);
                const adjustedY2 = _adjustHorizontalSegmentY(verticalSegmentX, y2, x2, filteredBoundsFinal);
                if (window.DEBUG_CONNECTIONS && conn.from === 'B2' && conn.to === 'D5') {
                    console.log('[Pre-calc] B2->D5: vertX=' + verticalSegmentX.toFixed(1) + ', y2=' + y2.toFixed(1) + ', x2=' + x2.toFixed(1) + ', adjY2=' + (adjustedY2 !== null ? adjustedY2.toFixed(1) : 'null'));
                }
                if (adjustedY2 !== null) {
                    const edgeKey = createEdgeKey(conn.from, conn.to);
                    edgeToYAdjustment.set(edgeKey, {
                        originalY: y2,
                        adjustedY: adjustedY2,
                        needsAdjustment: true
                    });
                }
            });

            // 衝突回避が必要なエッジを抽出
            const collisionEdges = [];
            edgeToYAdjustment.forEach((yAdjustment, edgeKey) => {
                if (!yAdjustment.needsAdjustment) return;

                const parts = edgeKey.split('->');
                const fromId = parts[0];
                const toId = parts[1];

                const fromPos = nodePositions.get(fromId);
                const toPos = nodePositions.get(toId);
                if (!fromPos || !toPos) return;

                let verticalSegmentX = verticalSegmentXByParent.get(fromId);
                if (verticalSegmentX === undefined) {
                    verticalSegmentX = fromPos.x + fromPos.width + EDGE_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                }

                const fromDepth = nodeDepths.get(fromId) || 0;
                const toDepth = nodeDepths.get(toId) || 0;

                collisionEdges.push({
                    edgeKey: edgeKey,
                    p4x: verticalSegmentX,
                    endX: toPos.x,
                    fromDepth: fromDepth,
                    toDepth: toDepth
                });
            });

            // 第2段階：2本目の垂直セグメントX座標を計算
            const edgeToSecondVerticalX = _calculateSecondVerticalSegmentX(
                collisionEdges, nodeDepths, nodePositions, depthMaxParentRight, depthMinChildLeft, nodeBounds, labelBoundsArray
            );

            // セグメント生成
            connections.forEach(conn => {
                const fromPos = nodePositions.get(conn.from);
                const toPos = nodePositions.get(conn.to);

                if (!fromPos || !toPos) {
                    return;
                }

                const x1 = fromPos.x + fromPos.width;
                let y1 = fromPos.y + fromPos.height / 2;
                const x2 = toPos.x;
                let y2 = toPos.y + toPos.height / 2;

                const edgeKey = createEdgeKey(conn.from, conn.to);

                if (y1 === y2) {
                    // 水平エッジ（1セグメント）
                    const segments = [
                        new Segment('horizontal', new Point(x1, y1), new Point(x2, y2))
                    ];
                    const arrowPoint = new Point(x2, y2);
                    edgeRoutes.set(edgeKey, new EdgeRoute(segments, arrowPoint));
                } else {
                    // 垂直セグメントを含むエッジ
                    let verticalSegmentX = verticalSegmentXByParent.get(conn.from);
                    if (verticalSegmentX === undefined) {
                        verticalSegmentX = x1 + EDGE_CONSTANTS.DEFAULT_VERTICAL_OFFSET;
                    }

                    // 初期セグメントY座標調整（ソースノードを除外）
                    const filteredBoundsInitial = nodeBounds.filter(n => n.id !== conn.from);
                    const adjustedY1 = _adjustHorizontalSegmentY(fromPos.x, y1, verticalSegmentX, filteredBoundsInitial);
                    if (adjustedY1 !== null) {
                        y1 = adjustedY1;
                    }

                    // Y調整情報を取得
                    const yAdjustment = edgeToYAdjustment.get(edgeKey);
                    const needsSecondVertical = yAdjustment && yAdjustment.needsAdjustment;
                    const secondVerticalX = edgeToSecondVerticalX.get(edgeKey);

                    const segments = [];

                    if (needsSecondVertical && secondVerticalX !== undefined) {
                        // 5-7セグメントルーティング（H-V-H-V-H）
                        // 中間水平セグメントのY座標を、正しいX範囲（verticalSegmentX -> secondVerticalX）で元のy2から再計算
                        if (window.DEBUG_CONNECTIONS && edgeKey === 'B2->D5') {
                            console.log('[5-seg] B2->D5: vertX=' + verticalSegmentX.toFixed(1) + ', 2ndVertX=' + secondVerticalX.toFixed(1) + ', y2=' + y2.toFixed(1) + ', preAdjY=' + yAdjustment.adjustedY.toFixed(1));
                        }
                        const filteredBoundsMiddle = nodeBounds.filter(n => n.id !== conn.to);
                        const recalculatedY2 = _adjustHorizontalSegmentY(verticalSegmentX, y2, secondVerticalX, filteredBoundsMiddle);
                        if (window.DEBUG_CONNECTIONS && edgeKey === 'B2->D5') {
                            console.log('[5-seg] B2->D5: recalcY2=' + (recalculatedY2 !== null ? recalculatedY2.toFixed(1) : 'null'));
                        }
                        const adjustedY2 = recalculatedY2 !== null ? recalculatedY2 : yAdjustment.adjustedY;

                        // 2本目の垂直セグメントは常にターゲットのcenterYに戻る
                        const finalY2 = y2;

                        // adjustedY2とfinalY2が同じ場合、5セグメントは不要（3セグメントにフォールバック）
                        const epsilon = 1.0;
                        if (Math.abs(adjustedY2 - finalY2) < epsilon) {
                            // 3セグメントルーティング（H-V-H）
                            segments.push(new Segment('horizontal', new Point(x1, y1), new Point(verticalSegmentX, y1)));
                            segments.push(new Segment('vertical', new Point(verticalSegmentX, y1), new Point(verticalSegmentX, finalY2)));
                            segments.push(new Segment('horizontal', new Point(verticalSegmentX, finalY2), new Point(x2, finalY2)));
                        } else {
                            // 5セグメントルーティング（H-V-H-V-H）
                            // セグメント1: 初期水平線
                            segments.push(new Segment('horizontal', new Point(x1, y1), new Point(verticalSegmentX, y1)));

                            // セグメント2: 第1垂直線
                            segments.push(new Segment('vertical', new Point(verticalSegmentX, y1), new Point(verticalSegmentX, adjustedY2)));

                            // セグメント3: 中間水平線
                            segments.push(new Segment('horizontal', new Point(verticalSegmentX, adjustedY2), new Point(secondVerticalX, adjustedY2)));

                            // セグメント4: 第2垂直線
                            segments.push(new Segment('vertical', new Point(secondVerticalX, adjustedY2), new Point(secondVerticalX, finalY2)));

                            // セグメント5: 最終水平線
                            segments.push(new Segment('horizontal', new Point(secondVerticalX, finalY2), new Point(x2, finalY2)));
                        }
                    } else {
                        // 3セグメントルーティング（H-V-H）
                        // 最終セグメントY座標調整（ターゲットノードは除外）
                        const filteredBoundsFinal = nodeBounds.filter(n => n.id !== conn.to);
                        const adjustedY2 = _adjustHorizontalSegmentY(verticalSegmentX, y2, x2, filteredBoundsFinal);

                        const originalY2 = toPos.y + toPos.height / 2;

                        // 最終水平セグメントがノードと衝突する場合、5セグメントルーティングに変換
                        if (adjustedY2 !== null && Math.abs(adjustedY2 - originalY2) > 1.0) {
                            // 2本目の垂直セグメントX座標を計算（垂直セグメントと終点の中間）
                            const intermediateX = verticalSegmentX + (x2 - verticalSegmentX) * EDGE_CONSTANTS.SECOND_VERTICAL_DISTANCE_RATIO;

                            // 2本目の垂直セグメントは常にターゲットのcenterYに戻る
                            const finalY2 = originalY2;

                            // 5セグメントルーティング（H-V-H-V-H）
                            segments.push(new Segment('horizontal', new Point(x1, y1), new Point(verticalSegmentX, y1)));
                            segments.push(new Segment('vertical', new Point(verticalSegmentX, y1), new Point(verticalSegmentX, adjustedY2)));
                            segments.push(new Segment('horizontal', new Point(verticalSegmentX, adjustedY2), new Point(intermediateX, adjustedY2)));
                            segments.push(new Segment('vertical', new Point(intermediateX, adjustedY2), new Point(intermediateX, finalY2)));
                            segments.push(new Segment('horizontal', new Point(intermediateX, finalY2), new Point(x2, finalY2)));
                        } else {
                            // 通常の3セグメントルーティング
                            if (adjustedY2 !== null) {
                                y2 = adjustedY2;
                            }

                            segments.push(new Segment('horizontal', new Point(x1, y1), new Point(verticalSegmentX, y1)));
                            segments.push(new Segment('vertical', new Point(verticalSegmentX, y1), new Point(verticalSegmentX, y2)));
                            segments.push(new Segment('horizontal', new Point(verticalSegmentX, y2), new Point(x2, y2)));
                        }
                    }

                    // 矢印の位置は最終セグメントの終点
                    const lastSegment = segments[segments.length - 1];
                    const arrowPoint = new Point(lastSegment.end.x, lastSegment.end.y);
                    edgeRoutes.set(edgeKey, new EdgeRoute(segments, arrowPoint));
                }
            });

            // エッジ交差を検出
            const crossings = detectEdgeCrossings(edgeRoutes, nodePositions, connections);

            // 交差があるエッジのセグメントを分割してジャンプアークを挿入
            if (crossings.size > 0) {
                crossings.forEach((crossingPoints, edgeKey) => {
                    const route = edgeRoutes.get(edgeKey);
                    if (!route) return;

                    const newSegments = [];

                    route.segments.forEach(segment => {
                        if (segment.type === 'horizontal') {
                            // この水平セグメントにかかる交差点をフィルタ
                            const segmentCrossings = crossingPoints.filter(p => {
                                const minX = Math.min(segment.start.x, segment.end.x);
                                const maxX = Math.max(segment.start.x, segment.end.x);
                                return p.x >= minX && p.x <= maxX && Math.abs(p.y - segment.start.y) < 0.1;
                            });

                            // セグメントを分割
                            const splitSegments = splitSegmentWithJumpArcs(segment, segmentCrossings);
                            newSegments.push(...splitSegments);
                        } else {
                            // 垂直セグメントはそのまま
                            newSegments.push(segment);
                        }
                    });

                    // ルートを更新
                    edgeRoutes.set(edgeKey, new EdgeRoute(newSegments, route.arrowPoint));
                });
            }

            return edgeRoutes;
        }

        /**
         * セグメントの長さを計算
         * @param {Segment} segment - セグメント
         * @returns {number} セグメントの長さ
         */
        function getSegmentLength(segment) {
            if (segment.type === 'horizontal' || segment.type === 'arc') {
                return Math.abs(segment.end.x - segment.start.x);
            } else if (segment.type === 'vertical') {
                return Math.abs(segment.end.y - segment.start.y);
            }
            return 0;
        }

        /**
         * セグメントの方向を判定
         * @param {Segment} segment - セグメント
         * @returns {string} 方向（'right', 'left', 'up', 'down'）
         */
        function getSegmentDirection(segment) {
            if (segment.type === 'horizontal' || segment.type === 'arc') {
                return segment.end.x > segment.start.x ? 'right' : 'left';
            } else if (segment.type === 'vertical') {
                return segment.end.y > segment.start.y ? 'down' : 'up';
            }
            return 'right';
        }

        /**
         * 2つのセグメント間でカーブを適用可能か判定
         * @param {Segment} seg1 - 最初のセグメント
         * @param {Segment} seg2 - 次のセグメント
         * @param {number} r - コーナー半径
         * @returns {boolean} カーブ適用可能かどうか
         */
        function canApplyCurve(seg1, seg2, r) {
            // 同じタイプのセグメント間ではカーブ不可
            if (seg1.type === seg2.type) {
                return false;
            }

            // arcまたはcurveセグメントがある場合は不可
            if (seg1.type === 'arc' || seg1.type === 'curve' || seg2.type === 'arc' || seg2.type === 'curve') {
                return false;
            }

            // 両方のセグメントが十分な長さを持つ場合のみカーブ適用
            const seg1Length = getSegmentLength(seg1);
            const seg2Length = getSegmentLength(seg2);

            return seg1Length > r * 2 && seg2Length > r * 2;
        }

        /**
         * カーブ付き遷移のSVGパスコマンドを生成
         * @param {Segment} seg1 - 最初のセグメント
         * @param {Segment} seg2 - 次のセグメント
         * @param {number} r - コーナー半径
         * @returns {string} SVGパスコマンド
         */
        function renderCurvedTransition(seg1, seg2, r) {
            const corner = seg1.end;
            let path = '';

            const dir1 = getSegmentDirection(seg1);
            const dir2 = getSegmentDirection(seg2);

            // seg1の終点手前までの直線
            if (seg1.type === 'horizontal') {
                const beforeCornerX = dir1 === 'right' ? corner.x - r : corner.x + r;
                path += ' L ' + beforeCornerX + ' ' + corner.y;
            } else {
                const beforeCornerY = dir1 === 'down' ? corner.y - r : corner.y + r;
                path += ' L ' + corner.x + ' ' + beforeCornerY;
            }

            // Qコマンドでカーブを描画
            path += ' Q ' + corner.x + ' ' + corner.y;

            // seg2の開始点（コーナーの先）
            if (seg2.type === 'horizontal') {
                const afterCornerX = dir2 === 'right' ? corner.x + r : corner.x - r;
                path += ' ' + afterCornerX + ' ' + corner.y;
            } else {
                const afterCornerY = dir2 === 'down' ? corner.y + r : corner.y - r;
                path += ' ' + corner.x + ' ' + afterCornerY;
            }

            return path;
        }

        /**
         * ジャンプアーク（半円）のSVGパスコマンドを生成
         * @param {ArcParams} arcParams - アークパラメータ
         * @param {Point} endPoint - 終点
         * @returns {string} SVGパスコマンド
         */
        function renderJumpArcV2(arcParams, endPoint) {
            // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
            // ジャンプアークは上向きの半円（sweep-flag=1）
            return ' A ' + arcParams.radius + ' ' + arcParams.radius + ' 0 0 1 ' + endPoint.x + ' ' + endPoint.y;
        }

        /**
         * EdgeRouteからSVGパス文字列を生成
         * @param {EdgeRoute} edgeRoute - エッジルート
         * @param {number} cornerRadius - コーナー半径（カーブ用）
         * @returns {string} SVGパス文字列
         */
        function generateSVGPath(edgeRoute, cornerRadius) {
            if (!edgeRoute || !edgeRoute.segments || edgeRoute.segments.length === 0) {
                return '';
            }

            const r = cornerRadius !== undefined ? cornerRadius : EDGE_CONSTANTS.CORNER_RADIUS;
            const segments = edgeRoute.segments;

            // Mコマンドで開始
            let path = 'M ' + segments[0].start.x + ' ' + segments[0].start.y;

            for (let i = 0; i < segments.length; i++) {
                const current = segments[i];
                const next = segments[i + 1];

                // arcセグメントの場合はAコマンドを生成
                if (current.type === 'arc' && current.arcParams) {
                    path += renderJumpArcV2(current.arcParams, current.end);
                    continue;
                }

                // curveセグメントの場合はQコマンドを生成（将来用）
                if (current.type === 'curve' && current.curveParams) {
                    const cp1 = current.curveParams.controlPoint1;
                    path += ' Q ' + cp1.x + ' ' + cp1.y + ' ' + current.end.x + ' ' + current.end.y;
                    continue;
                }

                // 次のセグメントとカーブ適用可能かチェック
                if (next && canApplyCurve(current, next, r)) {
                    path += renderCurvedTransition(current, next, r);
                } else {
                    // 通常の直線
                    path += ' L ' + current.end.x + ' ' + current.end.y;
                }
            }

            return path;
        }
    `;
}

module.exports = {
    getEdgeRouter
};
