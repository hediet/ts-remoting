import * as Common from "example-common";
import { observable, computed, autorun } from "mobx";

export class CurrentBetAsPlayer1 {
	@observable player1Secret: string;

	@computed get myCommitment(): string {
		return Common.createCommitment(this.player1Secret);
	}


	@observable player2Secret: string;
	@observable serverSecret: string;
}

export class Model {
	@observable currentBet: CurrentBetAsPlayer1|null = null;
	@observable serverInterface: Common.ServerInterface|null = null;
	@observable bets = new Map<string, Common.Bet>();

	constructor() {
		autorun(() => this.updateServer());
	}

	private async updateServer() {
		if (!this.serverInterface) return;

		const bets = await this.serverInterface.getBets();
		this.bets = new Map(bets.map(b => [b.betId, b] as [string, Common.Bet]));
	}

	public async startBet() {
		const bet = new CurrentBetAsPlayer1();
		bet.player1Secret = Common.generateSecret();

		const result = await this.serverInterface!.createBetAsPlayer1(100, bet.myCommitment);
		this.currentBet = bet;
	}

	public joinBet(betId: string) {
		if (!this.serverInterface) return;

		const secret = Common.generateSecret();
		this.serverInterface.joinBetAsPlayer2(betId, secret);

	}
}

export class ClientInterfaceImpl implements Common.ClientInterface {
	constructor(private readonly model: Model) { }

	public async player1GetSecret(player2Secret: string, serverSecret: string): Promise<string> {
		const currentBet = this.model.currentBet!;

		currentBet.player2Secret = player2Secret;
		currentBet.serverSecret = serverSecret;
		return currentBet.player1Secret;
	}

	public onFinishedCurrentBet(bet: Common.FinishedBet) {
		
	}

	public onNewBet(bet: Common.Bet) {
		this.model.bets.set(bet.betId, bet);
	}

	public onDeleteBet(betId: string) {
		this.model.bets.delete(betId);
	}
}
