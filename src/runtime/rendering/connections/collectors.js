function getCollectors() {
    return `
        // データ収集モジュール

        const collectors = {
            /**
             * 全接続からエッジ情報を収集
             * @param {Array} connections - 接続情報の配列
             * @param {Object} nodeDepths - ノードの階層マップ
             * @param {Object} connectionsByParent - 親ごとの接続マップ
             * @returns {Array} エッジ情報の配列
             */
            collectEdgeInfos: function(connections, nodeDepths, connectionsByParent) {
                const edgeInfos = [];

                connections.forEach(conn => {
                    const fromElement = svgHelpers.getNodeElement(conn.from);
                    const toElement = svgHelpers.getNodeElement(conn.to);

                    if (!fromElement || !toElement) {
                        if (window.DEBUG_CONNECTIONS && conn.isDashed) {
                            console.log('  - Skipping dashed edge: ' + conn.from + ' --> ' + conn.to +
                                ' fromElement: ' + !!fromElement + ' toElement: ' + !!toElement);
                        }
                        return;
                    }

                    // 非表示ノードのエッジはスキップ
                    if (fromElement.classList.contains('hidden') || toElement.classList.contains('hidden')) {
                        return;
                    }

                    // collapseManagerで折りたたみ状態をチェック
                    if (typeof collapseManager !== 'undefined' && !collapseManager.isEdgeVisible(conn)) {
                        return;
                    }

                    // 点線エッジ（バックエッジ）は交差検出の対象外
                    if (conn.isDashed) {
                        return;
                    }

                    const fromPos = svgHelpers.getNodePosition(fromElement);
                    const fromDim = svgHelpers.getNodeDimensions(fromElement);
                    const toPos = svgHelpers.getNodePosition(toElement);
                    const toDim = svgHelpers.getNodeDimensions(toElement);

                    const siblings = connectionsByParent[conn.from];
                    const siblingIndex = siblings.findIndex(c => c.to === conn.to);
                    const siblingCount = siblings.length;

                    // 子が持つ親の数をカウント
                    const parentCount = connections.filter(c => c.to === conn.to).length;

                    // すべてのエッジは親の中央から出発
                    const y1 = fromPos.top + fromDim.height / 2;
                    const x1 = fromPos.left + fromDim.width;
                    const x2 = toPos.left;
                    const y2 = toPos.top + toDim.height / 2;

                    // 1:1の親子関係を判定（親が1つの子のみ、子が1つの親のみ）
                    const is1to1 = (siblingCount === 1 && parentCount === 1);

                    // 真横にある1:1（Y座標差が小さい）を判定
                    const yDiff = Math.abs(y2 - y1);
                    const is1to1Horizontal = is1to1 && (yDiff < 5);

                    // エッジの階層（親の深さ）
                    const edgeDepth = nodeDepths[conn.from] || 0;

                    edgeInfos.push({
                        conn: conn,
                        x1: x1,
                        y1: y1,
                        x2: x2,
                        y2: y2,
                        yMin: Math.min(y1, y2),
                        yMax: Math.max(y1, y2),
                        siblingIndex: siblingIndex,
                        siblingCount: siblingCount,
                        parentX: fromPos.left,
                        parentY: fromPos.top,
                        depth: edgeDepth,
                        is1to1: is1to1,
                        is1to1Horizontal: is1to1Horizontal
                    });
                });

                return edgeInfos;
            },

            /**
             * すべてのノードの座標を取得
             * @param {string} excludeFrom - 除外する開始ノードID
             * @param {string} excludeTo - 除外する終了ノードID
             * @returns {Array} ノードのバウンディングボックス配列
             */
            getAllNodeBounds: function(excludeFrom, excludeTo) {
                const nodes = [];
                allNodes.forEach(node => {
                    if (node.id === excludeFrom || node.id === excludeTo) return;

                    const element = svgHelpers.getNodeElement(node.id);
                    if (element && !element.classList.contains('hidden')) {
                        const pos = svgHelpers.getNodePosition(element);
                        const dim = svgHelpers.getNodeDimensions(element);
                        nodes.push({
                            id: node.id,
                            left: pos.left,
                            top: pos.top,
                            right: pos.left + dim.width,
                            bottom: pos.top + dim.height,
                            width: dim.width,
                            height: dim.height
                        });
                    }
                });
                return nodes;
            },

            /**
             * すべてのラベルの座標を取得
             * @returns {Array} ラベルのバウンディングボックス配列
             */
            getAllLabelBounds: function() {
                const svgLayer = svgHelpers.getEdgeLayer();
                const labels = svgLayer.querySelectorAll('.connection-label');
                const labelBounds = [];

                labels.forEach(label => {
                    const rectElement = label.querySelector('rect');
                    if (rectElement) {
                        const x = parseFloat(rectElement.getAttribute('x'));
                        const y = parseFloat(rectElement.getAttribute('y'));
                        const width = parseFloat(rectElement.getAttribute('width'));
                        const height = parseFloat(rectElement.getAttribute('height'));

                        labelBounds.push({
                            from: label.getAttribute('data-from'),
                            to: label.getAttribute('data-to'),
                            left: x,
                            top: y,
                            right: x + width,
                            bottom: y + height,
                            width: width,
                            height: height
                        });
                    }
                });

                return labelBounds;
            }
        };

        // 後方互換性のためのエイリアス
        const edgeInfoCollector = {
            collectEdgeInfos: collectors.collectEdgeInfos
        };

        const getAllNodeBounds = collectors.getAllNodeBounds;
        const getAllLabelBounds = collectors.getAllLabelBounds;
    `;
}

module.exports = {
    getCollectors
};
