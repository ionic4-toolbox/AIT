import { Component, ViewEncapsulation } from '@angular/core';
import moment from 'moment';
import { AppUtils } from 'src/app/app.utils';
import { IntervalStorageData, Limits } from 'src/app/services/storage/ait-storage.shapes';

import { SettingsPage } from '../settings-page';

@Component({
  selector: 'app-interval-settings',
  templateUrl: './interval-settings.page.html',
  styleUrls: ['./interval-settings.page.scss']
})
export class IntervalSettingsPage extends SettingsPage {
  get data(): IntervalStorageData {
    return this._uuidData as IntervalStorageData;
  }

  get totaltime(): string {
    return AppUtils.totaltime(this.data);
  }

  get countdownLabel(): string {
    if (this.data) {
      return ':' + this.data.countdown;
    } else {
      return ':0';
    }
  }

  private setComputedFactorValue() {
    if (this.data) {
      // For 'x1' factor mode, are '1' and '10' for 'lower and 'upper' limits respectively
      // For 'x10' factor mode, are '0' and '100' for 'lower and 'upper' limits respectively
      const lower = this.data.factor === 1 ? 1 : 0;
      const upper = this.data.factor === 1 ? 10 : 100;
      this.computedFactorValue = { lower: lower, upper: upper };
    } else {
      this.computedFactorValue = { lower: 0, upper: 100 };
    }
  }

  dataChanged(property: string, event: CustomEvent): void {
    if (property === 'activerest') {
      const value = event.detail.value as Limits;

      if (this.data.factor === 10) {
        if (this.clonedForTenFactor === undefined) {
          this.clonedForOneFactor = undefined;
          this.clonedForTenFactor = AppUtils.clone<Limits>(this.data.activerest);
        }

        if ((this.computedFactorValue.upper !== value.upper) ||
          (this.clonedForTenFactor as Limits).upper === -1) {
          (this.clonedForTenFactor as Limits).upper = -1;
          this.data.activerest.upper = value.upper;
        }

        if ((this.computedFactorValue.lower !== value.lower) ||
          (this.clonedForTenFactor as Limits).lower === -1) {
          (this.clonedForTenFactor as Limits).lower = -1;
          this.data.activerest.lower = value.lower;
        }
      } else {
        if (this.clonedForOneFactor === undefined) {
          this.clonedForTenFactor = undefined;
          this.clonedForOneFactor = AppUtils.clone<Limits>(this.data.activerest);
        }

        let proposed = this.clonedForOneFactor.upper + value.upper;
        if ((this.computedFactorValue.upper !== value.upper) && (this.data.activerest.upper !== proposed)) {
          this.data.activerest.upper = proposed;
        }

        proposed = this.clonedForOneFactor.lower + value.lower;
        if ((this.computedFactorValue.lower !== value.lower) && (this.data.activerest.lower !== proposed)) {
          this.data.activerest.lower = proposed;
        }
      }
    } else if (property === 'intervals') {
      if (this.data.factor === 10) {
        this.clonedForIntervalsFactor = undefined;

        this.data.intervals = event.detail.value as number;
      } else {
        if (this.clonedForIntervalsFactor === undefined) {
          this.clonedForIntervalsFactor = this.data.intervals;
        }

        this.data.intervals = this.clonedForIntervalsFactor + event.detail.value as number;
      }
    } else if (property === 'countdown') {
      if (this.data.factor === 10) {
        this.clonedForCountdownFactor = undefined;

        this.data.countdown = event.detail.value as number;
      } else {
        if (this.clonedForCountdownFactor === undefined) {
          this.clonedForCountdownFactor = this.data.countdown;
        }

        this.data.countdown = this.clonedForCountdownFactor + event.detail.value as number;
      }
    } else if (property === 'factor') {
      this.data.factor = event.detail.value === '10' ? 10 : 1;
      this.setComputedFactorValue();
    }
  }
}
