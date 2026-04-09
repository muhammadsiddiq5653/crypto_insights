import pandas as pd
import ta.trend
import ta.momentum

from autotrade.base import BaseStrategy


class EmaCrossoverRsi(BaseStrategy):
    description = "EMA 12/26 crossover + RSI(14) filter, long-only"
    keep = True

    fast_window = 12
    slow_window = 26
    rsi_window = 14
    rsi_entry = 50

    def init(self):
        close = pd.Series(self.data.Close)
        self.fast_ema = self.I(
            lambda: ta.trend.EMAIndicator(close, window=self.fast_window).ema_indicator().values
        )
        self.slow_ema = self.I(
            lambda: ta.trend.EMAIndicator(close, window=self.slow_window).ema_indicator().values
        )
        self.rsi = self.I(
            lambda: ta.momentum.RSIIndicator(close, window=self.rsi_window).rsi().values
        )

    def next(self):
        if self.position:
            if self.fast_ema[-1] < self.slow_ema[-1]:
                self.position.close()
            return
        if self.fast_ema[-1] > self.slow_ema[-1] and self.rsi[-1] > self.rsi_entry:
            self.buy()
