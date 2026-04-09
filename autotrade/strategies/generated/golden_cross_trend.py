import pandas as pd
import ta.trend
import ta.momentum

from autotrade.base import BaseStrategy


class GoldenCrossTrend(BaseStrategy):
    description = "SMA 50/200 Golden Cross with RSI confirmation, long-only"
    keep = True

    fast_window = 50
    slow_window = 200

    def init(self):
        close = pd.Series(self.data.Close)
        self.sma_fast = self.I(
            lambda: ta.trend.SMAIndicator(close, window=self.fast_window).sma_indicator().values
        )
        self.sma_slow = self.I(
            lambda: ta.trend.SMAIndicator(close, window=self.slow_window).sma_indicator().values
        )
        self.rsi = self.I(
            lambda: ta.momentum.RSIIndicator(close, 14).rsi().values
        )

    def next(self):
        if self.position:
            # Death cross exit
            if self.sma_fast[-1] < self.sma_slow[-1]:
                self.position.close()
            return
        # Golden cross entry + RSI not overbought
        if (self.sma_fast[-1] > self.sma_slow[-1] and
                len(self.sma_fast) > 1 and self.sma_fast[-2] <= self.sma_slow[-2] and
                self.rsi[-1] < 70):
            self.buy()
