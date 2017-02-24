import * as React from "react";
import * as ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { observable, computed, autorun } from "mobx";
import * as classNames from "classnames";
import DevTools from 'mobx-react-devtools'; 

import { Model } from "./models";
import "./style.scss";

@observer
export class GUI extends React.Component<{ model: Model }, {}> {
	render() {
		const model = this.props.model;

		model.currentBet.
		//model.currentBet

		return (
			<div>
				{[
					model.currentBet && (
						<div>
							
						</div>
					)
				]}
				<div>
					<button onClick={() => model.startBet()}>Create a new bet</button>
				</div>
				{
					Array.from(model.bets.values()).map(bet => (
						<div>
							Bet {bet.betId}
						</div>
					))
				}
			</div>
		);
	}
}
