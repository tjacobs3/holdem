import React from "react";
import { Socket } from "socket.io-client";
import { find } from 'lodash';

import Player from './player';
import Settings from './settings';
import ChipValueContext from './contexts/chip_value_context';
import Showdown from './showdown';
import AdminControls from './admin_controls';
import InfoPanel from './info_panel';
import CardTable from './ui/card_table';
import CurrentRoundTable from './ui/current_round_table';

import {
  ACTION__OWNER_CHANGE_GAME_SETTINGS,
  ACTION__OWNER_GIVE_CHIPS,
  ACTION__OWNER_TAKE_CHIPS,
  ACTION__SIT,
  ACTION__STAND,
  Player as PlayerInterface,
  Round,
  GameSettings,
  PlayerAction
} from './constants';

import './styles.scss';

type Props = {
  admin: boolean;
  playerId: string;
  roomCode: string;
  socket: Socket
};

type GameState = {
  actions?: PlayerAction;
  dealerId?: string;
  ownerId?: string;
  players: PlayerInterface[];
  currentRound?: Round;
  gameSettings?: GameSettings;
}

type State = GameState & {
  tableHeight?: number;
  tableWidth?: number;
}

export default class HoldEm extends React.Component<Props, State> {
  playerAreaHeight: number;
  playerAreaWidth: number;
  private tableElement = React.createRef<HTMLDivElement>();

  constructor(props: Props) {
    super(props);

    this.playerAreaHeight = 200;
    this.playerAreaWidth = 300;
  }

  state: State = {
    players: []
  }

  componentDidMount() {
    this.props.socket.on('gameState', (gameState: GameState) => this.setState(gameState));
    window.addEventListener('resize', this.updateDimensions);
    this.updateDimensions();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions);
  }

  updateDimensions = () => {
    if (!this.tableElement.current) return;

    this.setState({
      tableHeight: this.tableElement.current.offsetHeight,
      tableWidth: this.tableElement.current.offsetWidth
    })
  };

  updateGameSettings = (gameSettings: GameSettings) => {
    this.props.socket.emit(ACTION__OWNER_CHANGE_GAME_SETTINGS, gameSettings);
  }

  giveChipsToPlayer = (toPlayerId: string, amount: number) => {
    this.props.socket.emit(ACTION__OWNER_GIVE_CHIPS, toPlayerId, amount);
  }

  takeChipsFromPlayer = (fromPlayerId: string, amount: number) => {
    this.props.socket.emit(ACTION__OWNER_TAKE_CHIPS, fromPlayerId, amount);
  }

  sit = () => this.props.socket.emit(ACTION__SIT)
  stand = () => this.props.socket.emit(ACTION__STAND)

  player(): PlayerInterface | undefined {
    return find(this.state.players, ['id', this.props.playerId]);
  }

  owner(): PlayerInterface | undefined {
    return find(this.state.players, ['id', this.state.ownerId]);
  }

  isOwner() {
    return this.props.playerId === this.state.ownerId;
  }

  showSettings(): boolean {
    return this.isOwner() && !!this.state.gameSettings;
  }

  renderPlayers() {
    const localPlayerIndex = this.state.players.findIndex(player => player.id === this.props.playerId);

    return this.state.players.map((player, index) => {
      // offset so the local player is always bottom center
      const tableIndex = (this.state.players.length + (index - localPlayerIndex)) % this.state.players.length;

      return (
        <Player
          currentRound={this.state.currentRound}
          dealerId={this.state.dealerId}
          key={player.id}
          ownerId={this.state.ownerId}
          player={player}
          playerIndex={tableIndex}
          tableHeight={this.state.tableHeight || 0}
          tableWidth={this.state.tableWidth || 0}
          totalPlayers={this.state.players.length}
        />
      );
    });
  }

  renderGame() {
    if (this.state.currentRound) {
      if (this.state.currentRound.showdown) {
        return (
          <Showdown currentRound={this.state.currentRound} />
        );
      }
    }

    return (
      <React.Fragment>
        {this.renderMiddleTable()}
        {this.renderPlayers()}
      </React.Fragment>
    );
  }

  renderMiddleTable() {
    if (this.state.currentRound) {
      return (
        <CardTable>
          <CurrentRoundTable
            pot={this.state.currentRound.pot}
            cards={this.state.currentRound.communityCards}
          />
        </CardTable>
      );
    } else {
      return (
        <CardTable>
          <h4 className="text-center">
            Waiting on {this.owner()?.name} to start a round.
          </h4>
        </CardTable>
      );
    }
  }

  render() {
    return (
      <ChipValueContext.Provider value={this.state.gameSettings?.chipValue}>
        <div className="holdem d-flex flex-column">
          {this.isOwner() && !!this.state.gameSettings &&
            <React.Fragment>
              <Settings
                gameSettings={this.state.gameSettings}
                players={this.state.players}
                roundInProgress={!!this.state.currentRound}
                onUpdateGameSettings={this.updateGameSettings}
                onGiveChips={this.giveChipsToPlayer}
                onTakeChips={this.takeChipsFromPlayer}
              />
            </React.Fragment>
          }
          <div className="game-table-container flex-grow-1">
            {this.props.admin && (
              <AdminControls currentRound={this.state.currentRound} socket={this.props.socket} />
            )}

            <div className="game-table" ref={this.tableElement}>
              {this.renderGame()}
            </div>
          </div>

          <InfoPanel
            actions={this.state.actions}
            gameSettings={this.state.gameSettings}
            host={this.owner()?.name || ''}
            roomCode={this.props.roomCode}
            socket={this.props.socket}
            standing={!!this.player()?.standing}
            onSit={this.sit}
            onStand={this.stand}
          />
        </div>
      </ChipValueContext.Provider>
    );
  }
}
