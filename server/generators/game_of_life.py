"""
Conway's Game of Life activity generator.
Simulates cellular automata on a toroidal grid with multiple seeding strategies.
"""
import random

from .base import BaseActivity


class GameOfLifeActivity(BaseActivity):
    activity_type = "game_of_life"
    strategies = [
        "random_soup",
        "glider_storm",
        "oscillator_garden",
        "spaceship_fleet",
        "methuselah",
    ]
    titles = [
        "GAME OF LIFE",
        "CELLULAR AUTOMATA",
        "CONWAY SIM",
        "LIFE ENGINE",
        "AUTOMATON",
    ]

    COLS = 80
    ROWS = 60

    # ── Pattern library ──────────────────────────────────────────────

    # Glider orientations (4 rotations)
    GLIDERS = [
        [[0, 1, 0],
         [0, 0, 1],
         [1, 1, 1]],

        [[1, 0],
         [0, 1],
         [1, 1]],  # rotated ~90 approximation keeping 5 cells

        [[1, 1, 1],
         [1, 0, 0],
         [0, 1, 0]],

        [[1, 1],
         [1, 0],
         [0, 1]],
    ]

    # Oscillators
    BLINKER = [[1, 1, 1]]

    PULSAR = [
        [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0],
    ]

    PENTADECATHLON = [
        [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
        [1, 1, 0, 1, 1, 1, 1, 0, 1, 1],
        [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
    ]

    # Spaceships
    LWSS = [
        [0, 1, 0, 0, 1],
        [1, 0, 0, 0, 0],
        [1, 0, 0, 0, 1],
        [1, 1, 1, 1, 0],
    ]

    MWSS = [
        [0, 0, 1, 0, 0, 0],
        [0, 1, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 0],
    ]

    HWSS = [
        [0, 0, 1, 1, 0, 0, 0],
        [0, 1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 0, 1],
        [1, 1, 1, 1, 1, 1, 0],
    ]

    # Methuselahs
    R_PENTOMINO = [
        [0, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
    ]

    ACORN = [
        [0, 1, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 0],
        [1, 1, 0, 0, 1, 1, 1],
    ]

    DIEHARD = [
        [0, 0, 0, 0, 0, 0, 1, 0],
        [1, 1, 0, 0, 0, 0, 0, 0],
        [0, 1, 0, 0, 0, 1, 1, 1],
    ]

    # ── Init ─────────────────────────────────────────────────────────

    def __init__(self, activity_id: str = None, intensity: int = 5):
        super().__init__(activity_id, intensity)
        self.generation = 0
        self.population = 0
        self._prev_populations: list[int] = []
        self.grid: list[list[int]] = []
        self._create_empty_grid()
        self._seed_grid()

    def _create_empty_grid(self) -> None:
        """Initialise an empty (all-dead) grid."""
        self.grid = [[0] * self.COLS for _ in range(self.ROWS)]

    # ── Seeding ──────────────────────────────────────────────────────

    def _seed_grid(self) -> None:
        """Dispatch to the appropriate strategy-specific seeder."""
        self._create_empty_grid()
        self.generation = 0
        self._prev_populations = []

        seeders = {
            "random_soup": self._seed_random_soup,
            "glider_storm": self._seed_glider_storm,
            "oscillator_garden": self._seed_oscillator_garden,
            "spaceship_fleet": self._seed_spaceship_fleet,
            "methuselah": self._seed_methuselah,
        }
        seeders[self.strategy]()
        self.population = self._count_population()

    def _seed_random_soup(self) -> None:
        """Fill ~30% of cells at random."""
        for r in range(self.ROWS):
            for c in range(self.COLS):
                if random.random() < 0.30:
                    self.grid[r][c] = 1

    def _seed_glider_storm(self) -> None:
        """Place ~15 gliders at random positions and orientations."""
        for _ in range(15):
            pattern = random.choice(self.GLIDERS)
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(0, self.COLS - 1)
            self._place_pattern(pattern, r, c)

    def _seed_oscillator_garden(self) -> None:
        """Scatter blinkers, pulsars, and pentadecathlons across the grid."""
        # A handful of pulsars
        for _ in range(3):
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(0, self.COLS - 1)
            self._place_pattern(self.PULSAR, r, c)

        # Several pentadecathlons
        for _ in range(4):
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(0, self.COLS - 1)
            self._place_pattern(self.PENTADECATHLON, r, c)

        # Lots of blinkers
        for _ in range(20):
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(0, self.COLS - 1)
            # Randomly orient blinker horizontally or vertically
            pat = self.BLINKER if random.random() < 0.5 else [[1], [1], [1]]
            self._place_pattern(pat, r, c)

    def _seed_spaceship_fleet(self) -> None:
        """Launch LWSS, MWSS, and HWSS from the left edge at random y positions."""
        ships = [self.LWSS, self.MWSS, self.HWSS]
        for _ in range(5):
            ship = random.choice(ships)
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(0, 10)  # near the left edge
            self._place_pattern(ship, r, c)

        # Also place a few heading the other way (mirror horizontally)
        for _ in range(5):
            ship = random.choice(ships)
            mirrored = [row[::-1] for row in ship]
            r = random.randint(0, self.ROWS - 1)
            c = random.randint(self.COLS - 11, self.COLS - 1)
            self._place_pattern(mirrored, r, c)

    def _seed_methuselah(self) -> None:
        """Place R-pentomino, acorn, and diehard patterns at random spots."""
        patterns = [self.R_PENTOMINO, self.ACORN, self.DIEHARD]
        for _ in range(6):
            pat = random.choice(patterns)
            r = random.randint(self.ROWS // 4, 3 * self.ROWS // 4)
            c = random.randint(self.COLS // 4, 3 * self.COLS // 4)
            self._place_pattern(pat, r, c)

    # ── Helpers ──────────────────────────────────────────────────────

    def _place_pattern(self, pattern: list[list[int]], row: int, col: int) -> None:
        """Stamp a 2-D pattern onto the grid with toroidal wrapping."""
        for dr, prow in enumerate(pattern):
            for dc, val in enumerate(prow):
                if val:
                    r = (row + dr) % self.ROWS
                    c = (col + dc) % self.COLS
                    self.grid[r][c] = 1

    def _count_population(self) -> int:
        return sum(cell for row in self.grid for cell in row)

    # ── Simulation step (B3/S23 with toroidal wrapping) ──────────────

    def _step(self) -> list[list[int]]:
        """Compute the next generation and return the new grid."""
        new = [[0] * self.COLS for _ in range(self.ROWS)]
        for r in range(self.ROWS):
            for c in range(self.COLS):
                neighbours = 0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if dr == 0 and dc == 0:
                            continue
                        neighbours += self.grid[(r + dr) % self.ROWS][(c + dc) % self.COLS]
                alive = self.grid[r][c]
                if alive and neighbours in (2, 3):
                    new[r][c] = 1
                elif not alive and neighbours == 3:
                    new[r][c] = 1
        return new

    # ── State serialisation ──────────────────────────────────────────

    def _get_state(self) -> dict:
        """Return the current grid state as a serialisable dict."""
        # Send cells as a flat list of (row, col) pairs for live cells only,
        # which is far more compact than the full 80×60 grid.
        cells = [
            [r, c]
            for r in range(self.ROWS)
            for c in range(self.COLS)
            if self.grid[r][c]
        ]
        return {
            "cells": cells,
            "generation": self.generation,
            "population": self.population,
            "strategy": self.strategy,
            "cols": self.COLS,
            "rows": self.ROWS,
        }

    # ── Public interface ─────────────────────────────────────────────

    def initial_payload(self) -> dict:
        return self._get_state()

    def next_frame(self) -> dict:
        self.grid = self._step()
        self.generation += 1
        self.population = self._count_population()

        # Track recent populations for stability detection
        self._prev_populations.append(self.population)
        if len(self._prev_populations) > 20:
            self._prev_populations.pop(0)

        # Auto-reseed when dead or stable for 20+ frames
        if self.population == 0 or (
            len(self._prev_populations) >= 20
            and len(set(self._prev_populations)) == 1
        ):
            self.strategy = random.choice(self.strategies)
            self._seed_grid()

        return self._get_state()
