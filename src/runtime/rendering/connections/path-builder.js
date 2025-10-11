function getPathBuilder() {
    return `
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
                secondVerticalX
            } = pathParams;

            const cornerRadius = CONNECTION_CONSTANTS.CORNER_RADIUS;

            // 制御点を計算
            const p1x = x1;
            const p1y = y1;
            let p2x = verticalSegmentX;
            let p2y = y1;
            let p3x = p2x;
            let p3y = y2;
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

            return pathGenerator.generateCurvedPath(points, cornerRadius);
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
    `;
}

module.exports = {
    getPathBuilder
};
