import pandas as pd
import ta.momentum
import ta.volatility

from autotrade.base import BaseStrategy


class RsiMeanReversion(BaseStrategy):
    description = "RSI oversold bounce + Bollinger Band lower touch, long-only"
    keep = True

    rsi_window = 14
    rsi_oversold = 30
    rsi_exit = 65
    bb_window = 20

    def init(self):
        close = pd.Series(self.data.Close)
        self.rsi = self.I(
            lambda: ta.momentum.RSIIndicator(close, window=self.rsi_window).rsi().values
        )
        bb = ta.volatility.BollingerBands(close, window=self.bb_window)
        self.bb_lower = self.I(lambda: bb.bollinger_lband().values)
        self.bb_upper = self.I(lambda: bb.bollinger_hband().values)

    def next(self):
        if self.position:
            if self.rsi[-1] > self.rsi_exit or self.data.Close[-1] > self.bb_upper[-1]:
                self.position.close()
            return
        if self.rsi[-1] < self.rsi_oversold and self.data.Close[-1] <= self.bb_lower[-1] * 1.02:
            self.buy()
