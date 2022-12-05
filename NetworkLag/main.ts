let colors = ['red', 'blue'];

function RenderWorld(canvas: HTMLCanvasElement, entities: Entity[]) {
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
            ctx?.stroke();
        }
    }
}

class Entity {
    entity_id: number = 0;
    x: number = 0;
    speed: number = 2;

    ApplyInput(input: ClientInput) {
        this.x += input.press_time * this.speed;
    }
}

class EntityState {
    entity_id: number = -1;
    position: number = -1;
    last_processed_input: any = null;
}

class ClientInput {
    entity_id: number = -1;
    press_time: number = -1;
    seq_num: number = -1;
}

// 服务器向客户端发送的消息: EntityState[]
// 客户端向服务器发送的消息: ClientInput
type Packet = any;

class LagNetwork {
    messages: { recv_time: number, payload: Packet }[] = [];

    // 发送一条消息, 假装是当前时间+lag后收到的
    Send(lag: number, states: Packet) {
        let now = Date.now();
        this.messages.push({
            recv_time: now + lag,
            payload: states,
        });
    }

    // 获取一条"已经"收到的消息
    Recv(): Packet {
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
    entities: Entity[] = [];

    network: LagNetwork = new LagNetwork();
    server: Server | null = null;

    id: number = 0;
    lag: number = 0;

    move_left = false;
    move_right = false;
    last_key_time = 0;
    input_seq_num = 0;

    interval_id: number | null = null;

    canvas: HTMLCanvasElement;

    constructor(id: string) {
        this.canvas = document.getElementById(id) as HTMLCanvasElement;
        this.SetUpdateRate(60);
    }

    SetUpdateRate(hz: number) {
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
            let entity_states = this.network.Recv() as EntityState[];
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

                let entity = this.entities[state.entity_id]!;

                if (entity.entity_id == this.id) {
                    entity.x = state.position;
                } else {
                    entity.x = state.position;
                }
            }
        }
    }

    processInput() {
        let now = Date.now();
        let last = this.last_key_time || now;
        let delta = (now - last) / 1000;
        this.last_key_time = now;

        let input = new ClientInput();
        input.entity_id = this.id;
        input.seq_num = this.input_seq_num++;
        if (this.move_left) {
            input.press_time = -delta;
        } else if (this.move_right) {
            input.press_time = delta;
        } else {
            return;
        }
        this.server?.network.Send(this.lag, input);
    }
}

class Server {
    entities: Entity[] = [];
    clients: Client[] = [];
    last_processed_input: number[] = [];

    update_rate: number = 1;
    update_interval_id: number | null = null;

    network: LagNetwork = new LagNetwork();
    canvas: HTMLCanvasElement;

    constructor(id: string = 'server') {
        this.canvas = document.getElementById(id) as HTMLCanvasElement;

        this.SetUpdateRate(3);
    }

    Connect(client: Client) {
        client.server = this;
        client.id = this.clients.length;
        this.clients.push(client);

        let entity = new Entity();
        this.entities.push(entity);
        entity.entity_id = client.id;

        let spawn_pos = [4, 6];
        entity.x = spawn_pos[client.id];
    }

    SetUpdateRate(hz: number) {
        this.update_rate = hz;

        if (this.update_interval_id) {
            clearInterval(this.update_interval_id);
        }

        this.update_interval_id = setInterval(
            () => this.update(),
            1000 / this.update_rate,
        );
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

            let input = message as ClientInput;
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
            state.push(
                {
                    entity_id: entity.entity_id,
                    position: entity.x,
                    last_processed_input: null,
                }
            );
        }

        for (const client of this.clients) {
            client.network.Send(client.lag, state);
        }
    }
}

let server_fps = 4;

let server = new Server();
server.SetUpdateRate(server_fps);

let client1 = new Client("player1");
client1.lag = 150;
let client2 = new Client("player2");
client2.lag = 250;
server.Connect(client1);
server.Connect(client2);

function handleInput(e: KeyboardEvent) {
    if (e.code == "ArrowLeft") {
        client1.move_left = (e.type == "keydown");
    } else if (e.code == "ArrowRight") {
        client1.move_right = (e.type == "keydown");
    } else if (e.code == "KeyA") {
        client2.move_left = (e.type == "keydown");
    } else if (e.code == "KeyD") {
        client2.move_right = (e.type == "keydown");
    } else {
        console.log(e);
    }
}

document.body.onkeydown = handleInput;
document.body.onkeyup = handleInput;