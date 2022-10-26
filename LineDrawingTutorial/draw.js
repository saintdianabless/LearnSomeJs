const endPointColor = 'hsl(0,50%,50%)';
const pathPointColor = 'hsl(0,40%,70%)';
const scale = 22;

function pointsOnLine(P, Q) {
    let points = [];
    let N = Math.max(Math.abs(P.x - Q.x), Math.abs(P.y - Q.y));
    for (let i = 0; i <= N; i++) {
        let rat = i / N;
        let x = Math.round(P.x + (Q.x - P.x) * rat);
        let y = Math.round(P.y + (Q.y - P.y) * rat);
        points.push({ x: x, y: y });
    }
    return points;
}

class Diagram {
    constructor(containerId) {
        this.A = { x: 2, y: 2 };
        this.B = { x: 20, y: 8 };
        this.parent = d3.select(`#${containerId} svg`);
        this.gGrid = this.parent.append('g');  // 背景层
        this.gPoints = this.parent.append('g');  // 路径层
        this.gHandles = this.parent.append('g');  // 交互层

        this.drawGrid();
        this.makeDraggableCicle(this.A);
        this.makeDraggableCicle(this.B);
        this.update();
    }

    drawGrid() {
        for (let x = 0; x < 25; x++) {
            for (let y = 0; y < 10; y++) {
                this.gGrid.append('rect')
                    .attr('transform', `translate(${x * scale}, ${y * scale})`)
                    .attr('width', scale)
                    .attr('height', scale)
                    .attr('fill', 'white')
                    .attr('stroke', 'gray');
            }
        }
    }

    update() {
        let rects = this.gPoints.selectAll('rect')
            .data(pointsOnLine(this.A, this.B));
        rects.exit().remove();
        rects.enter().append('rect')
            .attr('width', scale - 2)
            .attr('height', scale - 2)
            .attr('fill', pathPointColor)
            .merge(rects)
            .attr('transform', 
                p => `translate(${p.x * scale + 1} ${p.y * scale + 1})`);
    }

    makeDraggableCicle(point) {
        let diagram = this;
        let circle = this.gHandles.append('circle')
            .attr('class', 'draggable')
            .attr('r', scale * 0.75)
            .attr('fill', 'hsl(0,50%,50%)')
            .call(d3.drag().on('drag', onDrag));
    
        function updatePosition() {
            circle.attr('transform',
                `translate(${(point.x + 0.5) * scale} ${(point.y + 0.5) * scale})`);
        }
    
        function onDrag(event) {
            point.x = Math.floor(event.x / scale);
            point.y = Math.floor(event.y / scale);
            updatePosition();
            diagram.update();
        }
    
        updatePosition();
    }
}

let d = new Diagram('demo');