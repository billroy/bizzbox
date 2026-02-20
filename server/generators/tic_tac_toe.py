"""
Self-playing Tic-tac-toe activity generator.
Two AI players with randomized strategies play repeated games.
"""
import random

from .base import BaseActivity


class TicTacToeActivity(BaseActivity):
    activity_type = "tic_tac_toe"
    strategies = [
        "perfect",       # optimal play (usually draws)
        "aggressive",    # tries center + corners first
        "chaotic",       # random moves, frequent mistakes
        "defensive",     # blocks whenever possible
    ]
    titles = [
        "TIC TAC TOE",
        "NOUGHTS & CROSSES",
        "X VS O",
        "3×3 MATCH",
        "GRID BATTLE",
    ]

    def __init__(self, activity_id: str = None, intensity: int = 5):
        super().__init__(activity_id, intensity)
        self.board = [None] * 9  # None, 'X', or 'O'
        self.current_player = 'X'
        self.winner = None       # 'X', 'O', 'draw', or None
        self.win_line = None     # indices of winning line
        self.x_wins = 0
        self.o_wins = 0
        self.draws = 0
        self.game_count = 0
        self.move_count = 0
        self._pause_frames = 0  # pause between games
        self._x_strategy = self.strategy
        self._o_strategy = random.choice(self.strategies)

    LINES = [
        (0, 1, 2), (3, 4, 5), (6, 7, 8),  # rows
        (0, 3, 6), (1, 4, 7), (2, 5, 8),  # cols
        (0, 4, 8), (2, 4, 6),              # diags
    ]

    def _check_winner(self):
        """Check if someone won or if it's a draw."""
        for a, b, c in self.LINES:
            if self.board[a] and self.board[a] == self.board[b] == self.board[c]:
                self.winner = self.board[a]
                self.win_line = [a, b, c]
                return
        if all(cell is not None for cell in self.board):
            self.winner = 'draw'

    def _empty_cells(self):
        return [i for i in range(9) if self.board[i] is None]

    def _find_winning_move(self, player):
        """Find a move that wins for the given player."""
        for i in self._empty_cells():
            self.board[i] = player
            for a, b, c in self.LINES:
                if self.board[a] and self.board[a] == self.board[b] == self.board[c]:
                    self.board[i] = None
                    return i
            self.board[i] = None
        return None

    def _pick_move(self, strategy: str, player: str) -> int:
        """AI move selection based on strategy."""
        empty = self._empty_cells()
        if not empty:
            return -1

        opponent = 'O' if player == 'X' else 'X'

        if strategy == "perfect":
            # Win if possible
            win = self._find_winning_move(player)
            if win is not None:
                return win
            # Block opponent win
            block = self._find_winning_move(opponent)
            if block is not None:
                return block
            # Center
            if 4 in empty:
                return 4
            # Corners
            corners = [c for c in [0, 2, 6, 8] if c in empty]
            if corners:
                return random.choice(corners)
            return random.choice(empty)

        elif strategy == "aggressive":
            # Win if possible
            win = self._find_winning_move(player)
            if win is not None:
                return win
            # Center first
            if 4 in empty:
                return 4
            # Corners
            corners = [c for c in [0, 2, 6, 8] if c in empty]
            if corners:
                return random.choice(corners)
            # Block only 50% of the time
            if random.random() < 0.5:
                block = self._find_winning_move(opponent)
                if block is not None:
                    return block
            return random.choice(empty)

        elif strategy == "chaotic":
            # Win if obvious (30% chance of seeing it)
            if random.random() < 0.3:
                win = self._find_winning_move(player)
                if win is not None:
                    return win
            return random.choice(empty)

        elif strategy == "defensive":
            # Block opponent win first
            block = self._find_winning_move(opponent)
            if block is not None:
                return block
            # Win if possible
            win = self._find_winning_move(player)
            if win is not None:
                return win
            # Center
            if 4 in empty:
                return 4
            return random.choice(empty)

        return random.choice(empty)

    def _new_game(self):
        """Start a new game."""
        self.board = [None] * 9
        self.current_player = random.choice(['X', 'O'])
        self.winner = None
        self.win_line = None
        self.move_count = 0
        self.game_count += 1
        # Occasionally change strategies
        if random.random() < 0.3:
            self._x_strategy = random.choice(self.strategies)
        if random.random() < 0.3:
            self._o_strategy = random.choice(self.strategies)

    def _get_state(self) -> dict:
        return {
            "board": list(self.board),
            "current_player": self.current_player,
            "winner": self.winner,
            "win_line": self.win_line,
            "x_wins": self.x_wins,
            "o_wins": self.o_wins,
            "draws": self.draws,
            "game_count": self.game_count,
            "move_count": self.move_count,
            "strategy": self.strategy,
        }

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        if self.winner is not None:
            # Pause after game ends
            self._pause_frames += 1
            if self._pause_frames >= max(3, 8 - self.intensity):
                self._pause_frames = 0
                self._new_game()
            return self._get_state()

        # Make a move
        strategy = self._x_strategy if self.current_player == 'X' else self._o_strategy
        move = self._pick_move(strategy, self.current_player)
        if move >= 0:
            self.board[move] = self.current_player
            self.move_count += 1

        self._check_winner()

        if self.winner == 'X':
            self.x_wins += 1
        elif self.winner == 'O':
            self.o_wins += 1
        elif self.winner == 'draw':
            self.draws += 1

        if self.winner is None:
            self.current_player = 'O' if self.current_player == 'X' else 'X'

        return self._get_state()
