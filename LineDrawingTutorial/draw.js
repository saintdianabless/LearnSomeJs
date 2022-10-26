const endPointColor = 'hsl(0,50%,50%)';
const pathPointColor = 'hsl(0,40%,70%)';
const interpolatePointColor = 'hsl(0,30%,50%)';
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

function lerpPoint(P, Q, t) {
    return {
        x: lerp(P.x, Q.x, t),
        y: lerp(P.y, Q.y, t)
    };
}

function set(id, fmt, lo, hi, t) {
    d3.select(id).text(d3.format(fmt)(lerp(lo, hi, t)));
}

class Diagram {
    constructor(containerId) {
        this.A = { x: 2, y: 2 };
        this.B = { x: 20, y: 8 };
        this.root = d3.select(`#${containerId}`);
        this.parent = d3.select(`#${containerId} svg`);

        this._updateFunctions = []

        this.makeScrubableNumber('t', 0.0, 1.0, 2);
        this.update();
    }

    OnUpdate(f) {
        this._updateFunctions.push(f);
        this.update();
    }

    addGrid() {
        let g = this.parent.append('g');
        for (let x = 0; x < 25; x++) {
            for (let y = 0; y < 10; y++) {
                g.append('rect')
                    .attr('transform', `translate(${x * scale}, ${y * scale})`)
                    .attr('width', scale)
                    .attr('height', scale)
                    .attr('fill', 'white')
                    .attr('stroke', 'gray');
            }
        }

        return this;
    }

    addPathPoints() {
        let g = this.parent.append('g');
        this.OnUpdate(() => {
            let rects = g.selectAll('rect')
                .data(pointsOnLine(this.A, this.B));
            rects.exit().remove();
            rects.enter().append('rect')
                .attr('width', scale - 2)
                .attr('height', scale - 2)
                .attr('fill', pathPointColor)
                .merge(rects)
                .attr('transform',
                    p => `translate(${p.x * scale + 1} ${p.y * scale + 1})`);
        });

        return this;
    }

    addHandles() {
        let g = this.parent.append('g');
        this.makeDraggableCicle(g, this.A);
        this.makeDraggableCicle(g, this.B);

        return this;
    }

    addTrack() {
        let g = this.parent.append('g');
        let line = g.append('line')
            .attr('fill', 'none')
            .attr('stroke', 'gray')
            .attr('stroke-width', 3);
        this.OnUpdate(() => {
            line.attr('x1', (this.A.x + 0.5) * scale)
                .attr('y1', (this.A.y + 0.5) * scale)
                .attr('x2', (this.B.x + 0.5) * scale)
                .attr('y2', (this.B.y + 0.5) * scale);
        });

        return this;
    }

    addInterploated() {
        let g = this.parent.append('g');
        let p = g.append('circle')
            .attr('fill', interpolatePointColor)
            .attr('r', 5);
        this.OnUpdate(() => {
            let pos = lerpPoint(this.A, this.B, this.t);
            p.attr('cx', (pos.x + 0.5) * scale)
                .attr('cy', (pos.y + 0.5) * scale);
        });

        return this;
    }

    addScrubableNumber(name, precision, label_id, lo, hi) {
        this[name] = 0.3;
        this.makeScrubableNumber(name, 0, 1, precision);
        this.OnUpdate(() => {
            set(label_id, ".2f", lo, hi, this[name]);
        });

        return this;
    }

    update() {
        this._updateFunctions.forEach(f => f());
    }

    makeDraggableCicle(g, point) {
        let diagram = this;
        let circle = g.append('circle')
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

let d = new Diagram('demo')
    .addGrid()
    .addPathPoints()
    .addTrack()
    .addScrubableNumber('t', 2, '#lerp1', 0, 1)
    .addScrubableNumber('t2', 2, '#lerp2', 20, 80)
    .addInterploated()
    .addHandles();