/**
    AiT - Another Interval Timer
    Copyright (C) 2018 Marc Kassay

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

import { StorageDefaultData } from './ait-storage.defaultdata';
import { AppStorageData, UUIDData } from './ait-storage.interfaces';

@Injectable()
export class AITStorage {
  private status: 'off' | 'booting' | 'on';
  private preOpPromise: Promise<boolean>;

  constructor(public storage: Storage) {
    this.status = 'off';
  }

  async getPagePromise<T>(uuid: string): Promise<T> {
    return await this.isReady().then(async () => {
      const value = await this.storage.get(uuid);
      if (value) {
        return value;
      } else {
        const defaultpage = StorageDefaultData.getPageDataByID(uuid);
        return await this.storage.set(uuid, defaultpage).then(() => {
          return defaultpage;
        });
      }
    });
  }

  /**
   * Ensures that storage is in its "on" state.
   */
  private isReady(): Promise<boolean> {
    if (this.status === 'on') {
      return Promise.resolve(true);
    } else {
      if (this.status === 'off') {
        this.status = 'booting';
        this.preOpPromise = this.preOperationCheck();
      }
      return this.preOpPromise;
    }
  }

  /**
   * Algorithm to be executed once to ensure that storage is ready to be used and APP_DATA has been
   * loaded.
   */
  private preOperationCheck(): Promise<boolean> {
    return this.storage.ready()
      .then((value: LocalForage): Promise<AppStorageData> => {
        if (value) {
          console.log('Storage is getting data from disk.');
          return this.storage.get(StorageDefaultData.APP_ID) as Promise<AppStorageData>;
        } else {
          console.log('Storage can\'t boot-up!');
          // TODO: need to handle this downstream...
          return Promise.reject(new Error('sum ting wong'));
        }
      })
      .then((val: AppStorageData | undefined | null): Promise<boolean> => {
        // if in 'booting' routine, set status to 'on' since
        // the following set() will call preOperationCheck()...
        if (this.status === 'booting') {
          this.status = 'on';
        }

        // as intended, val should always be undefined.
        if (!val) {
          const app_data: UUIDData = StorageDefaultData.getPageDataByID(StorageDefaultData.APP_ID);
          return this.storage.set(app_data.uuid, app_data);
          /*             .then((): Promise<boolean> => {
                        return this.setCached(app_data);
                      }); */
        }
      })
      .catch((reason: any) => {
        console.error(reason);
        this.status = 'off';
        return new Promise<boolean>((resolve, reject) => { resolve(false); });
      });
  }
}
