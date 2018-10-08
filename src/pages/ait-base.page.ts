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
import { UUIDData } from '../providers/storage/ait-storage.interfaces';
import { FabAction, FabContainerComponent, FabEmission } from '../components/fab-container/fab-container';
import { ChangeDetectorRef, OnInit, Optional, ViewChild, ComponentFactoryResolver, ViewContainerRef } from '@angular/core';
import { MenuController, NavParams } from 'ionic-angular';
import { AITStorage } from '../providers/storage/ait-storage.service';
import { AITSignal } from '../providers/ait-signal';
import { ScreenOrientation } from '@ionic-native/screen-orientation';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';
import { SotsForAit } from '../providers/sots/ait-sots';
import { SequenceStates } from '../providers/sots/ait-sots.util';
import { AITBrightness } from '../providers/ait-screen';
import { AITBaseSettingsPage } from './ait-basesettings.page';
import { HomeDisplayService } from '../providers/home-display.service';

export class AITBasePage implements OnInit {
  @ViewChild(FabContainerComponent)
  protected menu: FabContainerComponent;

  public _uuidData: UUIDData;

  get uuidData(): UUIDData {
    return this._uuidData;
  }
  set uuidData(value: UUIDData) {
    this._uuidData = value;
  }

  // this type assignment to variable is for angular view
  // can access enum values.
  protected states = SequenceStates;
  // TODO: create a accessor and mutator and tie in FabContainerComponent viewState too.
  protected viewState: SequenceStates;
  protected sots: SotsForAit;
  protected grandTime: string;
  protected isFirstViewing: boolean;

  constructor(
    @Optional() protected componentFactoryResolver: ComponentFactoryResolver,
    @Optional() protected ngDectector: ChangeDetectorRef,
    @Optional() protected navParams: NavParams,
    @Optional() protected homeService: HomeDisplayService,
    @Optional() protected screenOrientation: ScreenOrientation,
    @Optional() protected storage: AITStorage,
    @Optional() protected menuCtrl: MenuController,
    @Optional() protected signal: AITSignal,
    @Optional() protected display: AITBrightness,
    @Optional() protected splashScreen: SplashScreen,
    @Optional() protected statusBar: StatusBar
  ) { }

  ngOnInit(): void {
    this.isFirstViewing = true;
    this.sots = new SotsForAit();

    this.screenOrientation.onChange().subscribe(() => {
      this.ngDectector.detectChanges();
    });

    this.menuCtrl.get('right').ionClose.debounceTime(125).subscribe(() => {
      this.aitLoadData();
    });
  }

  /*
  This event only happens once per page being created. If a page leaves but is cached, then this
  event will not fire again on a subsequent viewing.
  */
  ionViewDidLoad(): void {
    this.createSettingsPage();
    this.createHomePage();
    this.menu.setToLoadedMode();
  }

  protected createSettingsPage(settingsPage?: any): void {
    const rightMenuInnerHTML: ViewContainerRef = this.navParams.data.rightmenu;
    rightMenuInnerHTML.clear();

    const resolvedComponent = this.componentFactoryResolver.resolveComponentFactory<AITBaseSettingsPage>(settingsPage);

    const componentInstance = rightMenuInnerHTML.createComponent<AITBaseSettingsPage>(resolvedComponent);
    componentInstance.instance.uuid = this.navParams.data.id;

    this.menu.setProgramButtonToVisible();
  }

  private createHomePage(): void {
    this.homeService.notifiyAppOfCompletion();

    this.menu.setHomeButtonToVisible();
  }

  ionViewWillEnter(): void {
    this.aitLoadData();
  }

  ionViewDidEnter(): void {
    this.setViewInRunningMode(false);
  }

  private aitLoadData(): void {
    const uuid = this.navParams.data.id;

    if (uuid) {
      this.storage.getItem(uuid).then((value: any) => {

        this.uuidData = (value as UUIDData);
        if (value.hasOwnProperty('hasLastSettingChangedTime')) {
          if (value.hasLastSettingChangedTime || this.isFirstViewing) {
            this.aitBuildTimer();

            value.hasLastSettingChangedTime = false;
            this.storage.setItem(this.uuidData);
          }
        } else {
          this.aitBuildTimer();
        }

      }).catch(() => {
        // console.log("interval-display preinitializeDisplay error")
      });
    }
  }

  protected aitBuildTimer(): void {
    this.aitSubscribeTimer();
    this.aitResetTimer();

    if (this.isFirstViewing) {
      this.isFirstViewing = false;
      this.splashScreen.hide();
    }
  }

  protected aitSubscribeTimer(): void {

  }

  private aitResetTimer(): void {
    this.viewState = SequenceStates.Loaded;
    this.grandTime = this.sots.getGrandTime({ time: -1 });
    this.sots.sequencer.reset();
    this.ngDectector.detectChanges();
  }

  private setViewInRunningMode(value: boolean): void {
    this.menuCtrl.enable(!value, 'left');
    this.menuCtrl.enable(!value, 'right');

    (value) ? this.display.setKeepScreenOn(true) : this.display.setKeepScreenOn(false);
    (value) ? this.statusBar.hide() : this.statusBar.show();
  }

  // when this.fabcontainer buttons are clicked, it will first execute code in
  // fabcontainer.component (Child component). afterwards it will execute this function.
  protected onAction(emission: FabEmission): void {
    switch (emission.action) {
      case FabAction.Home:
        this.sots.sequencer.pause();
        this.setViewInRunningMode(false);
        this.menuCtrl.open('left');
        break;
      case FabAction.Program:
        this.sots.sequencer.pause();
        this.setViewInRunningMode(false);
        this.menuCtrl.open('right');
        break;
      case FabAction.Reset:
        this.aitResetTimer();
        this.setViewInRunningMode(false);
        break;
      case FabAction.Start:
        this.sots.sequencer.start();
        this.setViewInRunningMode(true);
        break;
      case FabAction.Pause:
        this.sots.sequencer.pause();
        this.setViewInRunningMode(false);
        break;
    }
    emission.container.close();
  }
}
