from backtesting import Strategy


class BaseStrategy(Strategy):
    """Base class for all autotrade strategies."""

    description: str = ""
    keep: bool = False

    def init(self) -> None:
        pass

    def next(self) -> None:
        pass
