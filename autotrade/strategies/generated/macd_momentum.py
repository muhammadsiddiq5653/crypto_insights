import pandas as pd
import ta.trend
import ta.momentum

from autotrade.base import BaseStrategy


class MacdMomentum(BaseStrategy):
    description = "MACD histogram crossover + RSI momentum filter"
    keep = True

    fast = 12
    slow = 26
    signal = 9
    rsi_min = 45

    def init(self):
        close = pd.Series(self.data.Close)
        macd_obj = ta.trend.MACD(close, window_fast=self.fast, window_slow=self.slow, window_sign=self.signal)
        self.macd_hist = self.I(lambda: macd_obj.macd_diff().values)
        self.rsi = self.I(
            lambda: ta.momentum.RSIIndicator(close, window=14).rsi().values
        )

    def next(self):
        if self.position:
            if self.macd_hist[-1] < 0:
                self.position.close()
            return
        if (self.macd_hist[-1] > 0 and
                len(self.macd_hist) > 1 and self.macd_hist[-2] <= 0 and
                self.rsi[-1] > self.rsi_min):
            self.buy()
