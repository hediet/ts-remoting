import * as Common from "example-common";
import { SocketIOServer } from "hediet-remoting-socketio-server";
import { SimpleStreamRemoting, ServiceError } from "hediet-remoting";
import { observable } from "mobx";

class Bet {
	private static idCounter: number = 0;

	public readonly id: string;
	public readonly serverCommitment: string;
	public readonly serverSecret: string;

	private player1Secret: string|undefined;
	public player2Secret: string|undefined;

	constructor(private readonly createdBy: string, public readonly player1Commitment: string, 
			private readonly askForPlayer1Secret: (player2Secret: string, serverSecret: string) => Promise<string>) {
		this.id = (Bet.idCounter++).toString();

	}

	public async getPlayer1Secret(): Promise<string> {
		if (!this.player1Secret) {
			if (!this.player2Secret) throw "error";

			const player1Secret = await this.askForPlayer1Secret(this.player2Secret, this.serverSecret);

			if (!Common.checkSecret(player1Secret, this.player1Commitment)) throw "Player 1 lied.";

			this.player1Secret = player1Secret;
		}

		return this.player1Secret;
	}

	public async finishBet(): Promise<Common.FinishedBet> {
		await this.getPlayer1Secret();

		if (!this.player2Secret) throw "error";
		if (!this.player1Secret) throw "error";

		const winner = Common.determineWinner([this.player1Secret, this.player2Secret, this.serverSecret]);

		return { ...this.toSimpleObject(), 
					serverSecret: this.serverSecret, 
					player1Secret: this.player1Secret, 
					player2Secret: this.player2Secret,
					winningPlayer: winner }
	}

	public toSimpleObject(): Common.Bet {
		return { betId: this.id, createdBy: this.createdBy, player1Commitment: this.player1Commitment, serverCommitment: this.serverCommitment };
	}
}

const bets = observable.map<Bet>();
const clientConnections = new Set<ClientConnection>();

class ClientConnection {
	public username: string|undefined = undefined;
	private disposeBetObservable: () => void;

	constructor(private readonly clientInterface: Common.ClientInterface) {
		this.disposeBetObservable = bets.observe(changes => {
			if (changes.type === "add")
				this.clientInterface.onNewBet(changes.newValue);
			else if (changes.type === "delete")
				this.clientInterface.onDeleteBet(changes.oldValue);
		}, true);
	}

	public dispose() {
		this.disposeBetObservable();
	}

	public onFinishedCurrentBet(bet: Common.FinishedBet) {
		this.clientInterface.onFinishedCurrentBet(bet);
	}

	public createBet(player1Commitment: string): Bet {
		if (!this.username) throw new ServiceError("Need to login first");

		const bet = new Bet(this.username, player1Commitment, async (player2Secret, serverSecret) => {
			const result = await this.clientInterface.player1GetSecret(player2Secret, serverSecret);
			return result;
		});

		bets.set(bet.id, bet);

		return bet;
	}
}

class ServerInterfaceImpl implements Common.ServerInterface {
	constructor(public readonly clientConnection: ClientConnection) {}

	public async login(username: string): Promise<void> {
		this.clientConnection.username = username;
	}

	public async createBetAsPlayer1(value: number, randomCommitment: string): Promise<{ betId: string }> {
		const bet = this.clientConnection.createBet(randomCommitment);
		return { betId: bet.id };
	}

	public async getBets(): Promise<Common.Bet[]> {
		return Array.from(bets.values()).map(b => b.toSimpleObject());
	}

	public async joinBetAsPlayer2(betId: string, secret: string): Promise<void> {
		const bet = bets.get(betId);
		if (!bet) throw new ServiceError("Bet does not exist");

		const player1Secret = await bet.getPlayer1Secret();

		this.clientConnection.onFinishedCurrentBet(await bet.finishBet());

		bets.delete(betId);
	}
}

new SocketIOServer(1234, async (stream): Promise<void> => {
	const remoting = new SimpleStreamRemoting(stream);
	const client = remoting.createProxyByClass(Common.ClientInterface);
	const clientConnection = new ClientConnection(client);
	remoting.server.registerObjectByClass(Common.ServerInterface, new ServerInterfaceImpl(clientConnection));
	
	clientConnections.add(clientConnection);
	console.log("client connected");

	await stream.closedPromise;
	console.log("client disconnected");
	clientConnections.delete(clientConnection);
});
