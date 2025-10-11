function getArrowRenderer() {
    return `
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
    `;
}

module.exports = {
    getArrowRenderer
};
