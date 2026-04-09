import pandas as pd
import ta.volatility
import ta.momentum

from autotrade.base import BaseStrategy


class BbSqueezeBreakout(BaseStrategy):
    description = "Bollinger Band squeeze then breakout with volume confirm"
    keep = True

    bb_window = 20
    squeeze_threshold = 0.04  # bandwidth < 4% = squeeze
    rsi_filter = 45

    def init(self):
        close = pd.Series(self.data.Close)
        bb = ta.volatility.BollingerBands(close, window=self.bb_window)
        self.bb_upper = self.I(lambda: bb.bollinger_hband().values)
        self.bb_lower = self.I(lambda: bb.bollinger_lband().values)
        self.bb_mid   = self.I(lambda: bb.bollinger_mavg().values)
        self.rsi      = self.I(lambda: ta.momentum.RSIIndicator(close, 14).rsi().values)

    def _bandwidth(self):
        mid = self.bb_mid[-1]
        if mid == 0:
            return 1.0
        return (self.bb_upper[-1] - self.bb_lower[-1]) / mid

    def next(self):
        if self.position:
            if self.data.Close[-1] < self.bb_mid[-1]:
                self.position.close()
            return
        bw = self._bandwidth()
        # Enter on breakout above upper band after a squeeze
        if bw < self.squeeze_threshold and self.data.Close[-1] > self.bb_upper[-1] and self.rsi[-1] > self.rsi_filter:
            self.buy()
