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

function lerp(start, end, t) {
    return start + t * (end - start);
}

class Diagram {
    constructor(containerId) {
        this.A = { x: 2, y: 2 };
        this.B = { x: 20, y: 8 };
        this.t = 0.3;
        this.root = d3.select(`#${containerId}`);
        this.parent = d3.select(`#${containerId} svg`);
        this.gGrid = this.parent.append('g');  // 背景层
        this.gPoints = this.parent.append('g');  // 路径层
        this.gHandles = this.parent.append('g');  // 交互层

        this.drawGrid();
        this.makeDraggableCicle(this.A);
        this.makeDraggableCicle(this.B);

        this.makeScrubableNumber('t', 0.0, 1.0, 2);
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

        let t = this.t;
        function set(id, fmt, lo, hi) {
            d3.select(id).text(d3.format(fmt)(lerp(lo, hi, t)));
        }
        set("#lerp1", ".2f", 0, 1);
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

    makeScrubableNumber(name, low, high, precision) {
        let diagram = this;
        let elements = diagram.root.selectAll(`[data-name='${name}']`);
        let positionToValue = d3.scaleLinear()  // https://observablehq.com/@d3/d3-scalelinear
            .clamp(true)
            .domain([-100, 100])
            .range([low, high]);

        function updateNumbers() {
            elements.text(() => {
                let format = `.${precision}f`;
                return d3.format(format)(diagram[name]);
            })
        }

        updateNumbers();

        elements.call(d3.drag() // https://github.com/d3/d3-drag/blob/v3.0.0/README.md
            .subject(() => ({ x: positionToValue.invert(diagram[name]), y: 0 }))  // 相当于设定个事件初始值?
            .on('drag', (event) => {
                // console.log(event.x);
                diagram[name] = positionToValue(event.x);
                updateNumbers();
                diagram.update();
            }));
    }
}

let d = new Diagram('demo');