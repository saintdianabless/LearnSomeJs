"use strict";
let colors = ['red', 'blue'];
function RenderWorld(canvas, entities) {
    canvas.width = canvas.width;
    let ctx = canvas.getContext('2d');
    if (ctx) {
        // ctx.strokeStyle = 'black';
        // ctx.strokeRect(0,0, canvas.width, canvas.height);
        for (const entity of entities) {
            let r = canvas.height * 0.9 / 2;
            let x = (entity.x / 10.0) * canvas.width;
            ctx.beginPath();
            ctx.arc(x, canvas.height / 2, r, 0, 2 * Math.PI, false);
            ctx.fillStyle = colors[entity.entity_id];
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = 'dark' + colors[entity.entity_id];
            ctx === null || ctx === void 0 ? void 0 : ctx.stroke();
        }
    }
}
class Entity {
    constructor() {
        this.entity_id = 0;
        this.x = 0;
        this.speed = 2;
    }
    ApplyInput(input) {
        this.x += input.press_time * this.speed;
    }
}
class EntityState {
    constructor() {
        this.entity_id = -1;
        this.position = -1;
        this.last_processed_input = null;
    }
}
class ClientInput {
    constructor() {
        this.entity_id = -1;
        this.press_time = -1;
        this.seq_num = -1;
    }
}
class LagNetwork {
    constructor() {
        this.messages = [];
    }
    // 发送一条消息, 假装是当前时间+lag后收到的
    Send(lag, states) {
        let now = Date.now();
        this.messages.push({
            recv_time: now + lag,
            payload: states,
        });
    }
    // 获取一条"已经"收到的消息
    Recv() {
        let now = Date.now();
        for (let i = 0; i < this.messages.length; i++) {
            let message = this.messages[i];
            if (message.recv_time <= now) {
                this.messages.splice(i, 1);
                return message.payload;
            }
        }
        return null;
    }
}
class Client {
    constructor(id) {
        this.entities = [];
        this.network = new LagNetwork();
        this.server = null;
        this.id = 0;
        this.lag = 0;
        this.prediction = false;
        this.reconciliation = false;
        this.move_left = false;
        this.move_right = false;
        this.last_key_time = 0;
        this.pending_verified = [];
        this.input_seq_num = 0;
        this.interval_id = null;
        this.canvas = document.getElementById(id);
        this.SetUpdateRate(60);
    }
    SetUpdateRate(hz) {
        let interval = 1000 / hz;
        if (this.interval_id !== null) {
            clearInterval(this.interval_id);
        }
        setInterval(() => this.update(), interval);
    }
    update() {
        this.processServerInput();
        this.processInput();
        RenderWorld(this.canvas, this.entities);
    }
    processServerInput() {
        while (true) {
            let entity_states = this.network.Recv();
            if (entity_states === null) {
                break;
            }
            for (let i = 0; i < entity_states.length; i++) {
                let state = entity_states[i];
                if (!this.entities[state.entity_id]) {
                    let entity = new Entity();
                    entity.entity_id = state.entity_id;
                    this.entities[state.entity_id] = entity;
                }
                let entity = this.entities[state.entity_id];
                if (entity.entity_id == this.id) {
                    // in sync with authoritative state
                    entity.x = state.position;
                    if (this.reconciliation) {
                        let j = 0;
                        while (j < this.pending_verified.length) {
                            let input = this.pending_verified[j];
                            if (input.seq_num <= state.last_processed_input) {
                                this.pending_verified.splice(j, 1);
                            }
                            else {
                                entity.ApplyInput(input);
                                j++;
                            }
                        }
                    }
                    else {
                        this.pending_verified = [];
                    }
                }
                else {
                    entity.x = state.position;
                }
            }
        }
    }
    processInput() {
        var _a;
        let now = Date.now();
        let last = this.last_key_time || now;
        let delta = (now - last) / 1000;
        this.last_key_time = now;
        let input = new ClientInput();
        input.entity_id = this.id;
        input.seq_num = this.input_seq_num++;
        if (this.move_left) {
            input.press_time = -delta;
        }
        else if (this.move_right) {
            input.press_time = delta;
        }
        else {
            return;
        }
        (_a = this.server) === null || _a === void 0 ? void 0 : _a.network.Send(this.lag, input);
        if (this.prediction) {
            this.entities[this.id].ApplyInput(input);
        }
        this.pending_verified.push(input);
    }
}
class Server {
    constructor(id = 'server') {
        this.entities = [];
        this.clients = [];
        this.last_processed_input = [];
        this.update_rate = 1;
        this.update_interval_id = null;
        this.network = new LagNetwork();
        this.canvas = document.getElementById(id);
        this.SetUpdateRate(3);
    }
    Connect(client) {
        client.server = this;
        client.id = this.clients.length;
        this.clients.push(client);
        let entity = new Entity();
        this.entities.push(entity);
        entity.entity_id = client.id;
        let spawn_pos = [4, 6];
        entity.x = spawn_pos[client.id];
    }
    SetUpdateRate(hz) {
        this.update_rate = hz;
        if (this.update_interval_id) {
            clearInterval(this.update_interval_id);
        }
        this.update_interval_id = setInterval(() => this.update(), 1000 / this.update_rate);
    }
    update() {
        this.processInputs();
        this.broadcastWorldState();
        RenderWorld(this.canvas, this.entities);
    }
    processInputs() {
        while (true) {
            let message = this.network.Recv();
            if (message === null) {
                break;
            }
            // 省略输入检查
            let input = message;
            let id = input.entity_id;
            this.entities[id].ApplyInput(input);
            this.last_processed_input[id] = input.seq_num;
        }
    }
    // 向所有客户端广播世界状态
    broadcastWorldState() {
        let state = [];
        for (let i = 0; i < this.entities.length; i++) {
            let entity = this.entities[i];
            state.push({
                entity_id: entity.entity_id,
                position: entity.x,
                last_processed_input: this.last_processed_input[i],
            });
        }
        for (const client of this.clients) {
            client.network.Send(client.lag, state);
        }
    }
}
let server = new Server();
let client1 = new Client("player1");
client1.lag = 150;
let client2 = new Client("player2");
client2.lag = 250;
server.Connect(client1);
server.Connect(client2);
function handleInput(e) {
    if (e.code == "ArrowLeft") {
        client1.move_left = (e.type == "keydown");
    }
    else if (e.code == "ArrowRight") {
        client1.move_right = (e.type == "keydown");
    }
    else if (e.code == "KeyA") {
        client2.move_left = (e.type == "keydown");
    }
    else if (e.code == "KeyD") {
        client2.move_right = (e.type == "keydown");
    }
    else {
        // console.log(e);
    }
}
document.body.onkeydown = handleInput;
document.body.onkeyup = handleInput;
function update_parameter() {
    update_parameter_for(client1, "player1");
    update_parameter_for(client2, "player2");
    update_parameter_for_server();
}
function update_parameter_for(client, prefix) {
    client.lag = get_number_from_input(client.lag, prefix + '_lag');
    // console.log(prefix + ' lag: ' + client.lag);
    let prediction = document.getElementById(prefix + '_prediction');
    client.prediction = prediction.checked;
    // console.log(prefix + client.prediction);
    let reconciliation = document.getElementById(prefix + '_reconciliation');
    client.reconciliation = reconciliation.checked;
    // console.log(prefix + client.reconciliation);
}
function update_parameter_for_server() {
    server.SetUpdateRate(get_number_from_input(server.update_rate, 'server_update_rate'));
}
function get_number_from_input(old_value, element_id) {
    let element = document.getElementById(element_id);
    let new_value = parseInt(element.value);
    if (isNaN(new_value)) {
        new_value = old_value;
    }
    element.value = new_value.toString();
    return new_value;
}
update_parameter();
